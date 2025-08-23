-- Backfill Script: Legacy Notes Migration
-- Run this AFTER deploying schema updates and BEFORE enabling notesV2 for users
-- This script migrates existing monolithic notes from sections.data->>'content' to book_notes table

-- Only proceed if book_notes table exists and is empty (safety check)
DO $$
BEGIN
  -- Check if book_notes table exists
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'book_notes') THEN
    RAISE EXCEPTION 'book_notes table does not exist. Deploy schema first.';
  END IF;
  
  -- Check if book_notes is empty (avoid double migration)
  IF EXISTS (SELECT 1 FROM book_notes LIMIT 1) THEN
    RAISE NOTICE 'book_notes table already contains data. Skipping migration.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Starting legacy notes migration...';
END $$;

-- Migrate legacy notes content to normalized book_notes
-- Creates one note per book with non-empty legacy content
WITH legacy_notes AS (
  SELECT 
    s.book_id,
    TRIM(s.data->>'content') as legacy_content,
    s.updated_at
  FROM sections s
  WHERE s.type = 'notes' 
    AND s.data->>'content' IS NOT NULL 
    AND TRIM(s.data->>'content') <> ''
),
migration_data AS (
  SELECT 
    book_id,
    legacy_content,
    'Imported Notes' as title,
    0 as position,  -- First position
    false as spoiler_protected,
    updated_at
  FROM legacy_notes
)
INSERT INTO book_notes (
  book_id, 
  title, 
  body, 
  tags, 
  position, 
  spoiler_protected,
  min_visible_page,
  created_at,
  updated_at
)
SELECT 
  book_id,
  title,
  legacy_content,
  '{}',  -- empty tags array
  position,
  spoiler_protected,
  NULL,  -- no spoiler page restriction
  updated_at,  -- preserve original timestamp
  updated_at
FROM migration_data;

-- Report migration results
DO $$
DECLARE
  migrated_count INTEGER;
  total_books INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM book_notes WHERE title = 'Imported Notes';
  SELECT COUNT(DISTINCT book_id) INTO total_books FROM sections WHERE type = 'notes';
  
  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '  - Migrated % legacy notes', migrated_count;
  RAISE NOTICE '  - Total books with notes sections: %', total_books;
  RAISE NOTICE '  - Books without content: %', total_books - migrated_count;
  
  IF migrated_count > 0 THEN
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Enable notesV2 feature flag for testing';
    RAISE NOTICE '  2. Verify notes appear correctly in UI';
    RAISE NOTICE '  3. After stable: mark books as migrated to prevent legacy editing';
  END IF;
END $$;

-- Optional: Add a migration marker to books (uncomment if desired)
-- This prevents users from editing legacy notes after they've used notesV2
-- ALTER TABLE books ADD COLUMN IF NOT EXISTS notes_migrated_at timestamptz;
-- UPDATE books SET notes_migrated_at = now() 
-- WHERE id IN (SELECT DISTINCT book_id FROM book_notes WHERE title = 'Imported Notes');
