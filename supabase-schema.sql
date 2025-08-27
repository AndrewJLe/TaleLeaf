-- Phase 1 Minimal Schema (execute in Supabase SQL editor)

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  cover_url text,
  window_start int default 1,
  window_end int default 50,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  type text not null check (type in ('characters','chapters','locations','notes')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
create index if not exists sections_book_idx on sections(book_id);

create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  kind text not null check (kind in ('pdf','text')),
  filename text,
  page_count int,
  storage_key text,
  created_at timestamptz default now()
);
create index if not exists uploads_book_idx on uploads(book_id);

-- RLS
alter table profiles enable row level security;
alter table books enable row level security;
alter table sections enable row level security;
alter table uploads enable row level security;

create policy "profiles_select_self" on profiles for select using ( auth.uid() = id );
create policy "profiles_upsert_self" on profiles for all using ( auth.uid() = id ) with check ( auth.uid() = id );

create policy "books_user_isolation" on books for all using ( auth.uid() = user_id ) with check ( auth.uid() = user_id );
create policy "sections_user_isolation" on sections for all using (
  exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
) with check (
  exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
);
create policy "uploads_user_isolation" on uploads for all using (
  exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
) with check (
  exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
);

-- Trigger to auto-update book updated_at
create or replace function touch_book() returns trigger as $$
begin
  update books set updated_at = now() where id = NEW.book_id;
  return NEW;
end;
$$ language plpgsql;

create trigger sections_touch_book after insert or update on sections
  for each row execute procedure touch_book();

-- =====================================================================
-- Phase 2 Schema Extensions (Notes & Locations Normalization, PDF meta)
-- Guarded to be idempotent via IF NOT EXISTS / create or replace.
-- Refer to todo.md stories N1–N3 (multi-note), H1–H2 (hierarchical locations).
-- =====================================================================

-- 1. Add PDF metadata columns to books (used by upload & meta PATCH route)
alter table books add column if not exists pdf_path text;
alter table books add column if not exists pdf_page_count int;

-- 2. Multi-note normalized table (book_notes)
create table if not exists book_notes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  title text,
  body text not null default '',
  tags text[] not null default '{}',
  position int, -- manual ordering (can be sparse; client may re-pack)
  spoiler_protected boolean not null default false,
  min_visible_page int, -- spoiler unlock threshold (nullable)
  deleted_at timestamptz, -- soft delete tombstone
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists book_notes_book_pos_idx on book_notes(book_id, position);
-- Optional future tag search performance (enable later when needed):
-- create index if not exists book_notes_tags_idx on book_notes using gin (tags);

-- 3. Hierarchical locations table (book_locations)
create table if not exists book_locations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  parent_id uuid references book_locations(id) on delete cascade,
  name text not null,
  notes text default '',
  position int,
  depth int not null default 0,
  deleted_at timestamptz, -- soft delete tombstone
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint book_locations_depth_check check (depth >= 0 and depth <= 10)
);
create index if not exists book_locations_book_parent_pos_idx on book_locations(book_id, parent_id, position);

-- 4. RLS enablement for new tables
alter table if exists book_notes enable row level security;
alter table if exists book_locations enable row level security;

-- 5. RLS policies (ownership via books.user_id)
-- Policies (idempotent via DO block because CREATE POLICY has no IF NOT EXISTS)
DO $$ BEGIN
  CREATE POLICY book_notes_isolation ON book_notes FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY book_locations_isolation ON book_locations FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Update touch_book trigger function to handle DELETE operations generically
create or replace function touch_book() returns trigger as $$
declare
  v_book uuid;
begin
  v_book := coalesce(NEW.book_id, OLD.book_id);
  if v_book is not null then
    update books set updated_at = now() where id = v_book;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql;

-- Re-create existing trigger (no-op if already exists; harmless) and add new ones
drop trigger if exists sections_touch_book on sections;
create trigger sections_touch_book after insert or update or delete on sections
  for each row execute procedure touch_book();

create trigger if not exists book_notes_touch_book after insert or update or delete on book_notes
  for each row execute procedure touch_book();

create trigger if not exists book_locations_touch_book after insert or update or delete on book_locations
  for each row execute procedure touch_book();

-- 7. (Optional Backfill) Legacy notes -> first book_notes row.
-- Run manually AFTER deploying & before enabling notesV2 flag for users.
-- with legacy as (
--   select s.book_id, (s.data->>'content') as legacy_body
--   from sections s
--   where s.type = 'notes' and coalesce(s.data->>'content','') <> ''
-- )
-- insert into book_notes (book_id, body, position, title)
-- select book_id, legacy_body, 0, 'Imported Notes' from legacy
-- on conflict do nothing;

-- 8. (Optional Migration) Legacy locations JSON -> book_locations rows.
-- Provides flat import at depth 0; hierarchical reconstruction (if ever stored) would require nested JSON.
-- with locs as (
--   select s.book_id, jsonb_array_elements(coalesce(s.data->'items','[]'::jsonb)) as loc
--   from sections s where s.type = 'locations'
-- )
-- insert into book_locations (book_id, name, notes, position, depth)
-- select book_id,
--        coalesce(loc->>'name','Unnamed'),
--        coalesce(loc->>'notes',''),
--        row_number() over (partition by book_id order by (loc->>'name')) - 1,
--        0
-- from locs
-- on conflict do nothing;

-- =====================================================================
-- End Phase 2 Extensions
-- =====================================================================

-- =====================================================================
-- Phase 2.1 Finalization
-- Additional triggers & indexes for consistency and performance.
-- =====================================================================

-- Index to speed user library ordering queries
create index if not exists books_user_updated_idx on books(user_id, updated_at desc);

-- Ensure book.updated_at auto-refreshes on direct updates (e.g., title/window changes)
create or replace function books_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists books_touch_row on books;
create trigger books_touch_row before update on books
  for each row execute procedure books_set_updated_at();

-- Touch book on uploads changes as well (PDF reupload etc.)
drop trigger if exists uploads_touch_book on uploads;
create trigger uploads_touch_book after insert or update or delete on uploads
  for each row execute procedure touch_book();

-- =====================================================================
-- Schema Version Marker
-- Current logical schema version: 2025-08-23-phase2.1
-- =====================================================================

-- =====================================================================
-- Phase 2.2 Extensions (Tag Colors & Note Groups)
-- Adds:
--   * book_tags table for persistent per-book tag color metadata
--   * book_note_groups table for grouping notes (name + color + ordering)
--   * group_id column on book_notes referencing book_note_groups
-- Idempotent guards included so file can be re-run safely.
-- =====================================================================

-- 1. Tag metadata table (one row per unique tag name per book)
create table if not exists book_tags (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  name text not null,
  color text not null default '#6366F1', -- default indigo tone
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint book_tags_color_format check (color ~* '^#[0-9A-F]{6}$')
);
-- Enforce name uniqueness (store lowercase canonical form)
create unique index if not exists book_tags_book_name_idx on book_tags(book_id, name);
-- Backfill existing rows to lowercase once (harmless if already lowercase)
update book_tags set name = lower(name) where name <> lower(name);
-- Trigger to force lowercase & updated_at
create or replace function book_tags_normalize() returns trigger as $$
begin
  new.name = lower(new.name);
  new.updated_at = now();
  return new;
end;$$ language plpgsql;
drop trigger if exists book_tags_normalize_trg on book_tags;
create trigger book_tags_normalize_trg before insert or update on book_tags
  for each row execute procedure book_tags_normalize();
create index if not exists book_tags_book_idx on book_tags(book_id);

-- 2. Note groups table (for organizing note cards)
create table if not exists book_note_groups (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  name text not null,
  color text not null default '#F59E0B', -- default amber tone
  position int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint book_note_groups_color_format check (color ~* '^#[0-9A-F]{6}$')
);
create unique index if not exists book_note_groups_book_lower_name_idx on book_note_groups(book_id, lower(name));
create index if not exists book_note_groups_book_pos_idx on book_note_groups(book_id, position);

-- 3. Add group association to book_notes (nullable)
alter table book_notes add column if not exists group_id uuid references book_note_groups(id) on delete set null;
create index if not exists book_notes_group_idx on book_notes(group_id);

-- 4. Enable RLS (if not already) & policies for new tables
alter table if exists book_tags enable row level security;
alter table if exists book_note_groups enable row level security;

DO $$ BEGIN
  CREATE POLICY book_tags_isolation ON book_tags FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY book_note_groups_isolation ON book_note_groups FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Touch trigger support (reuse existing touch_book function)
-- For book_tags
DROP TRIGGER IF EXISTS book_tags_touch_book ON book_tags;
CREATE TRIGGER book_tags_touch_book
AFTER INSERT OR UPDATE OR DELETE ON book_tags
FOR EACH ROW EXECUTE PROCEDURE touch_book();

-- For book_note_groups
DROP TRIGGER IF EXISTS book_note_groups_touch_book ON book_note_groups;
CREATE TRIGGER book_note_groups_touch_book
AFTER INSERT OR UPDATE OR DELETE ON book_note_groups
FOR EACH ROW EXECUTE PROCEDURE touch_book();

-- 6. Updated schema version marker
-- Current logical schema version: 2025-08-25-phase2.2
-- =====================================================================

-- =====================================================================
-- Phase 3 Normalization (Characters, Chapters, Tag Joins, Audit Log)
-- Goals:
--  * Move characters & chapters out of generic sections JSON.
--  * Introduce per-entity tag join tables with optional color overrides.
--  * Provide unified view for querying tagged entities across types.
--  * Add soft-delete audit log for future restore capability.
--  * Idempotent (safe re-run).
-- =====================================================================

-- 1. Core entity tables ------------------------------------------------
create table if not exists book_characters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  name text not null,
  notes text default '',
  position int,
  deleted_at timestamptz, -- soft delete tombstone
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists book_characters_book_pos_idx on book_characters(book_id, position);

create table if not exists book_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  title text not null,
  notes text default '',            -- free-form user notes
  summary text default '',          -- concise summary (AI or manual)
  analysis text default '',         -- deeper analysis / themes
  position int,
  deleted_at timestamptz, -- soft delete tombstone
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists book_chapters_book_pos_idx on book_chapters(book_id, position);

-- (book_locations already defined earlier; reused for normalized locations)

-- 2. Tag join tables (explicit per entity for referential integrity) ----
-- Optional per-assignment color override; NULL -> fall back to book_tags.color

create table if not exists book_character_tags (
  character_id uuid references book_characters(id) on delete cascade,
  tag_id uuid references book_tags(id) on delete cascade,
  color_override text check (color_override is null or color_override ~* '^#[0-9A-F]{6}$'),
  book_id uuid, -- denormalized for RLS performance
  created_at timestamptz default now(),
  primary key(character_id, tag_id)
);
create index if not exists book_character_tags_book_tag_idx on book_character_tags(book_id, tag_id);

create table if not exists book_chapter_tags (
  chapter_id uuid references book_chapters(id) on delete cascade,
  tag_id uuid references book_tags(id) on delete cascade,
  color_override text check (color_override is null or color_override ~* '^#[0-9A-F]{6}$'),
  book_id uuid,
  created_at timestamptz default now(),
  primary key(chapter_id, tag_id)
);
create index if not exists book_chapter_tags_book_tag_idx on book_chapter_tags(book_id, tag_id);

create table if not exists book_location_tags (
  location_id uuid references book_locations(id) on delete cascade,
  tag_id uuid references book_tags(id) on delete cascade,
  color_override text check (color_override is null or color_override ~* '^#[0-9A-F]{6}$'),
  book_id uuid,
  created_at timestamptz default now(),
  primary key(location_id, tag_id)
);
create index if not exists book_location_tags_book_tag_idx on book_location_tags(book_id, tag_id);

create table if not exists book_note_tags (
  note_id uuid references book_notes(id) on delete cascade,
  tag_id uuid references book_tags(id) on delete cascade,
  color_override text check (color_override is null or color_override ~* '^#[0-9A-F]{6}$'),
  book_id uuid,
  created_at timestamptz default now(),
  primary key(note_id, tag_id)
);
create index if not exists book_note_tags_book_tag_idx on book_note_tags(book_id, tag_id);

-- 3. RLS enablement ----------------------------------------------------
alter table if exists book_characters enable row level security;
alter table if exists book_chapters enable row level security;
alter table if exists book_character_tags enable row level security;
alter table if exists book_chapter_tags enable row level security;
alter table if exists book_location_tags enable row level security;
alter table if exists book_note_tags enable row level security;

-- 4. RLS policies (idempotent via DO blocks) ---------------------------
DO $$ BEGIN
  CREATE POLICY book_characters_isolation ON book_characters FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY book_chapters_isolation ON book_chapters FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Join tables: rely on denormalized book_id for fast RLS evaluation
DO $$ BEGIN
  CREATE POLICY book_character_tags_isolation ON book_character_tags FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY book_chapter_tags_isolation ON book_chapter_tags FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY book_location_tags_isolation ON book_location_tags FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY book_note_tags_isolation ON book_note_tags FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Trigger functions for updated_at + denormalized book_id -----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql;

-- Reuse generic touch_book already defined for bumping books.updated_at

create or replace function set_join_book_id_from_character() returns trigger as $$
begin
  select book_id into new.book_id from book_characters where id = new.character_id;
  return new;
end;$$ language plpgsql;

create or replace function set_join_book_id_from_chapter() returns trigger as $$
begin
  select book_id into new.book_id from book_chapters where id = new.chapter_id;
  return new;
end;$$ language plpgsql;

create or replace function set_join_book_id_from_location() returns trigger as $$
begin
  select book_id into new.book_id from book_locations where id = new.location_id;
  return new;
end;$$ language plpgsql;

create or replace function set_join_book_id_from_note() returns trigger as $$
begin
  select book_id into new.book_id from book_notes where id = new.note_id;
  return new;
end;$$ language plpgsql;

-- 6. Triggers -----------------------------------------------------------
drop trigger if exists book_characters_updated_at_trg on book_characters;
create trigger book_characters_updated_at_trg before update on book_characters
  for each row execute procedure set_updated_at();
drop trigger if exists book_chapters_updated_at_trg on book_chapters;
create trigger book_chapters_updated_at_trg before update on book_chapters
  for each row execute procedure set_updated_at();

-- Touch book on entity changes
create trigger if not exists book_characters_touch_book after insert or update or delete on book_characters
  for each row execute procedure touch_book();
create trigger if not exists book_chapters_touch_book after insert or update or delete on book_chapters
  for each row execute procedure touch_book();

-- Join book_id population + touch
drop trigger if exists book_character_tags_set_book_id on book_character_tags;
create trigger book_character_tags_set_book_id before insert on book_character_tags
  for each row execute procedure set_join_book_id_from_character();
create trigger if not exists book_character_tags_touch_book after insert or update or delete on book_character_tags
  for each row execute procedure touch_book();

drop trigger if exists book_chapter_tags_set_book_id on book_chapter_tags;
create trigger book_chapter_tags_set_book_id before insert on book_chapter_tags
  for each row execute procedure set_join_book_id_from_chapter();
create trigger if not exists book_chapter_tags_touch_book after insert or update or delete on book_chapter_tags
  for each row execute procedure touch_book();

drop trigger if exists book_location_tags_set_book_id on book_location_tags;
create trigger book_location_tags_set_book_id before insert on book_location_tags
  for each row execute procedure set_join_book_id_from_location();
create trigger if not exists book_location_tags_touch_book after insert or update or delete on book_location_tags
  for each row execute procedure touch_book();

drop trigger if exists book_note_tags_set_book_id on book_note_tags;
create trigger book_note_tags_set_book_id before insert on book_note_tags
  for each row execute procedure set_join_book_id_from_note();
create trigger if not exists book_note_tags_touch_book after insert or update or delete on book_note_tags
  for each row execute procedure touch_book();

-- 7. Unified tagged entities view --------------------------------------
create or replace view book_tagged_entities as
  select 'character'::text as entity_type, c.book_id, c.id as entity_id, t.id as tag_id, t.name as tag_name,
         coalesce(ct.color_override, t.color) as color, ct.created_at as tagged_at
  from book_character_tags ct
  join book_characters c on c.id = ct.character_id
  join book_tags t on t.id = ct.tag_id
  union all
  select 'chapter', ch.book_id, ch.id, t.id, t.name,
         coalesce(cht.color_override, t.color), cht.created_at
  from book_chapter_tags cht
  join book_chapters ch on ch.id = cht.chapter_id
  join book_tags t on t.id = cht.tag_id
  union all
  select 'location', l.book_id, l.id, t.id, t.name,
         coalesce(lt.color_override, t.color), lt.created_at
  from book_location_tags lt
  join book_locations l on l.id = lt.location_id
  join book_tags t on t.id = lt.tag_id
  union all
  select 'note', n.book_id, n.id, t.id, t.name,
         coalesce(nt.color_override, t.color), nt.created_at
  from book_note_tags nt
  join book_notes n on n.id = nt.note_id
  join book_tags t on t.id = nt.tag_id;

-- 8. Soft-delete audit log ----------------------------------------------
create table if not exists book_entity_deletions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  entity_type text not null check (entity_type in ('character','chapter','location','note')),
  entity_id uuid not null,
  payload jsonb not null,
  deleted_at timestamptz default now()
);
alter table if exists book_entity_deletions enable row level security;
DO $$ BEGIN
  CREATE POLICY book_entity_deletions_isolation ON book_entity_deletions FOR ALL USING (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from books b where b.id = book_id and b.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- (Optional) Triggers for logging deletes can be added later when application switches to normalized tables.

-- 9. Backfill Helpers (Manual Execution) -------------------------------
-- Example: Characters JSON -> book_characters & tags
-- with raw_chars as (
--   select s.book_id, jsonb_array_elements(coalesce(s.data->'items','[]'::jsonb)) as item
--   from sections s where s.type = 'characters'
-- )
-- insert into book_characters (book_id, name, notes, position)
-- select book_id,
--        coalesce(item->>'name','Unnamed'),
--        coalesce(item->>'notes',''),
--        (row_number() over (partition by book_id order by (item->>'name'))) * 1000
-- from raw_chars
-- on conflict do nothing;
--
-- -- Tags for characters
-- with char_tags as (
--   select c.id as character_id, c.book_id, jsonb_array_elements_text(item->'tags') as tag_name
--   from sections s
--   join book_characters c on c.book_id = s.book_id
--   cross join jsonb_array_elements(coalesce(s.data->'items','[]'::jsonb)) as item
--   where s.type = 'characters'
-- )
-- , upsert_tags as (
--   insert into book_tags (book_id, name)
--   select distinct book_id, lower(tag_name) from char_tags where tag_name <> ''
--   on conflict (book_id, name) do nothing
--   returning id, book_id, name
-- )
-- insert into book_character_tags (character_id, tag_id)
-- select ct.character_id, t.id
-- from char_tags ct
-- join book_tags t on t.book_id = ct.book_id and t.name = lower(ct.tag_name)
-- left join book_character_tags existing on existing.character_id = ct.character_id and existing.tag_id = t.id
-- where ct.tag_name <> '' and existing.character_id is null;

-- Repeat analogous backfill for chapters & locations as needed.

-- 10. Schema Version Marker --------------------------------------------
-- Current logical schema version: 2025-08-25-phase3.0
-- =====================================================================
