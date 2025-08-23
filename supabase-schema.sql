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
