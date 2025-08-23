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
