-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.book_chapter_tags (
  chapter_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  book_id uuid NOT NULL,
  color_override text CHECK (color_override ~* '^#[0-9A-F]{6}$'::text),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_chapter_tags_pkey PRIMARY KEY (chapter_id, tag_id),
  CONSTRAINT book_chapter_tags_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.book_chapters(id),
  CONSTRAINT book_chapter_tags_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT book_chapter_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.book_tags(id)
);
CREATE TABLE public.book_chapters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  title text NOT NULL,
  number integer NOT NULL,
  content text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  notes text DEFAULT ''::text,
  summary text DEFAULT ''::text,
  analysis text DEFAULT ''::text,
  position integer,
  CONSTRAINT book_chapters_pkey PRIMARY KEY (id),
  CONSTRAINT book_chapters_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.book_character_tags (
  character_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  book_id uuid NOT NULL,
  color_override text CHECK (color_override ~* '^#[0-9A-F]{6}$'::text),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_character_tags_pkey PRIMARY KEY (character_id, tag_id),
  CONSTRAINT book_character_tags_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.book_characters(id),
  CONSTRAINT book_character_tags_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT book_character_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.book_tags(id)
);
CREATE TABLE public.book_characters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  notes text DEFAULT ''::text,
  position integer,
  CONSTRAINT book_characters_pkey PRIMARY KEY (id),
  CONSTRAINT book_characters_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.book_location_tags (
  location_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  book_id uuid NOT NULL,
  color_override text CHECK (color_override ~* '^#[0-9A-F]{6}$'::text),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_location_tags_pkey PRIMARY KEY (location_id, tag_id),
  CONSTRAINT book_location_tags_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.book_locations(id),
  CONSTRAINT book_location_tags_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT book_location_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.book_tags(id)
);
CREATE TABLE public.book_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  parent_id uuid,
  name text NOT NULL,
  notes text DEFAULT ''::text,
  position integer,
  depth integer NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 10),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_locations_pkey PRIMARY KEY (id),
  CONSTRAINT book_locations_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT book_locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.book_locations(id)
);
CREATE TABLE public.book_note_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#F59E0B'::text CHECK (color ~* '^#[0-9A-F]{6}$'::text),
  position integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_note_groups_pkey PRIMARY KEY (id),
  CONSTRAINT book_note_groups_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.book_note_tags (
  note_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  book_id uuid NOT NULL,
  color_override text CHECK (color_override ~* '^#[0-9A-F]{6}$'::text),
  CONSTRAINT book_note_tags_pkey PRIMARY KEY (note_id, tag_id),
  CONSTRAINT book_note_tags_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.book_notes(id),
  CONSTRAINT book_note_tags_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT book_note_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.book_tags(id)
);
CREATE TABLE public.book_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  title text,
  body text NOT NULL DEFAULT ''::text,
  position integer,
  spoiler_protected boolean NOT NULL DEFAULT false,
  min_visible_page integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  group_id uuid,
  CONSTRAINT book_notes_pkey PRIMARY KEY (id),
  CONSTRAINT book_notes_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT book_notes_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.book_note_groups(id)
);
CREATE TABLE public.book_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366F1'::text CHECK (color ~* '^#[0-9A-F]{6}$'::text),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_tags_pkey PRIMARY KEY (id),
  CONSTRAINT book_tags_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.books (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  cover_url text,
  window_start integer DEFAULT 1,
  window_end integer DEFAULT 50,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  pdf_path text,
  pdf_page_count integer,
  CONSTRAINT books_pkey PRIMARY KEY (id),
  CONSTRAINT books_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.book_chapter_map (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  chapter_index integer NOT NULL,
  start_page integer NOT NULL,
  end_page integer NOT NULL,
  title text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_chapter_map_pkey PRIMARY KEY (id),
  CONSTRAINT book_chapter_map_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.book_page_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  page_number integer NOT NULL,
  intra_index integer NOT NULL,
  raw_text text NOT NULL,
  token_count integer,
  embedding vector(1536),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_page_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT book_page_chunks_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.book_paragraph_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  chunk_id uuid NOT NULL,
  summary_json jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_paragraph_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT book_paragraph_summaries_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT book_paragraph_summaries_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES public.book_page_chunks(id)
);
CREATE TABLE public.book_page_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  page_number integer NOT NULL,
  summary_json jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_page_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT book_page_summaries_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.book_chapter_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  chapter_index integer NOT NULL,
  summary_json jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT book_chapter_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT book_chapter_summaries_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);