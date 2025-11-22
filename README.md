# TaleLeaf

## Live Link
https://tale-leaf.vercel.app/

TaleLeaf is a spoiler-safe reading companion that helps you turn raw narrative into structured understanding. It sits alongside your books and lets you capture characters, locations, chapters, and notes while using AI that stays strictly inside your current reading window.

Think of it as a focused **reading workbench** for people who annotate, analyze, or study long-form fiction and narrative non-fiction.

---

## Table of Contents

- [What TaleLeaf Is](#what-taleleaf-is)  
- [Core Features](#core-features)  
  - [Book-Centric Workspace](#book-centric-workspace)  
  - [Structured Entities](#structured-entities)  
  - [AI Chat & Context](#ai-chat--context)  
  - [Settings Per Book](#settings-per-book)  
- [How It Works (High-Level Architecture)](#how-it-works-high-level-architecture)  
  - [Frontend](#frontend)  
  - [Data & Storage](#data--storage)  
  - [AI Layer](#ai-layer)  
- [Chunking & Ranking: How TaleLeaf Minimizes Tokens](#chunking--ranking-how-taleleaf-minimizes-tokens)  
  - [Page-Based Context Window](#page-based-context-window)  
  - [Chunking Strategy (Context Window v2 + Supabase)](#chunking-strategy-context-window-v2--supabase)  
  - [Fallback: Local Context Extraction](#fallback-local-context-extraction)  
  - [System Prompt Design](#system-prompt-design)  
- [Development Notes](#development-notes)

---

## What TaleLeaf Is

### A Personal Reading Companion
- Upload a book (PDF or text)
- Set your current page window (e.g., `start`..`end`)
- Ask safe questions that only reference that portion of the book

### A Structured Note System
- Characters, locations, chapters, and notes are first-class entities
- Ordering, tags, and spoiler-aware visibility for each entity
- Designed for deep reading, study, and analysis — not general chit-chat

### An AI Helper With Boundaries
- AI calls are constrained to the selected reading window or preprocessed context
- Prevents accidental spoilers by design
- Useful for summarization, entity extraction, thematic notes, and chapter summaries

---

## Core Features

### Book-Centric Workspace
Each book has its own editor at ` /book/[id] `:

- **Document viewer** – Displays the uploaded PDF/text and support for page navigation.  
- **Context window** – You pick a page range (`window.start..window.end`) that defines the current “reading window” for AI.  
- **Autosave** – Title, window settings, cover, and entity edits are automatically persisted.

### Structured Entities
TaleLeaf breaks your understanding into distinct sections:

#### Characters
- Add / edit characters with `name`, `description`, and `tags`.  
- Reorder characters to match importance or reading flow.  
- Optional AI assistance to suggest characters from the current context.

#### Chapters
- Define chapters with titles, summaries, and tags.  
- Generate AI-powered summaries for a given chapter window.  
- Reorder chapters and keep summaries aligned with pages.

#### Locations
- Track places/settings with descriptions and tags.  
- Use AI to propose locations from the context window.  
- Reorder locations to build your mental map of the story.

#### Notes
- Multiple free-form notes, each with:
  - Title (e.g., `Note 1`, `General Notes`)  
  - Body (markdown/plain text)  
  - Tags (for grouping/filtering)  
  - Ordering position  
  - Per-note “dirty” tracking and Save/Discard controls for batch editing  
- AI-generated notes for themes, motifs, or custom topics  
- **All Notes** view aggregates notes, characters, chapters, and locations for study/export

### AI Chat & Context
A persistent, left-side AI Chat & Context panel in the book editor:

#### Context Window Selection
- Select the page range TaleLeaf is allowed to see (e.g., `window.start..window.end`).  
- All AI responses must stay inside this window to avoid spoilers.

#### AI Chat
- Ask questions such as:
  - “What is happening between pages 45–60?”  
  - “How has Character X changed in this section?”  
- Messages are displayed as a simple Q/A chat.

#### Model Selection & API Keys
- Choose an AI provider/model (e.g., OpenAI, Anthropic).  
- Manage local API keys in Settings:
  - Add / edit / delete keys.  
  - Assign a specific key per provider.  
  - Keys are stored client-side (e.g., `localStorage`) and are never sent to the backend.

### Settings Per Book
The Settings modal for each book provides:

#### AI
- Choose default model/provider for AI actions.  
- Manage API keys (add/edit/delete, active/inactive, last-used timestamp).

#### Book
- Edit title.  
- Re-upload PDF or text.  
- Change cover image.  
- Toggle “Edit current page” text (local override of extraction).  
- Delete book (with confirmation).

---

## How It Works (High-Level Architecture)

### Frontend
- **Framework:** Next.js App Router (TypeScript, React)  
- **Top-level routes:**
  - `app/landing/page.tsx`  
  - `app/profile/page.tsx` (Library)  
  - `app/book/[id]/page.tsx` (Book editor)  
  - `app/auth/callback/page.tsx`  

#### Components
- `components/BookEditor.tsx` – Primary UI shell for a single book.  
- `components/ContextWindow.tsx` – Slider/navigation for selecting pages.  
- `sections/*` – Characters, locations, notes, chapters, all-notes.  
- `ui/*` – Buttons, tooltips, split layout, PDF viewer, toasts, rate limit UI.

### Data & Storage

#### Supabase Postgres
- Stores normalized entities: `books`, `characters`, `chapters`, `locations`, `notes`, `uploads`.  
- Row Level Security (RLS) ensures users only see their own data.

#### Supabase Storage
- PDFs and cover files stored under per-user, per-book paths.

#### IndexedDB / LocalStorage
- Cached PDFs (for offline/fast PDF access).  
- AI settings, API keys, and feature flags.

### AI Layer
Located in `ai-service.ts`:

#### Provider Registry
- `AI_PROVIDERS` lists supported models, cost metadata, and whether they require a key.

#### Chat Wrapper
- Builds the system prompt with current context pages.  
- Calls OpenAI or Anthropic with constructed messages.  

---

## Chunking & Ranking: How TaleLeaf Minimizes Tokens

### Page-Based Context Window
- The page range selected by the user acts as the root constraint.  
- The uploaded book is split into `pages[]`.  
- When the window is `[start, end]`, context is derived from `pages[start-1..end-1]`.  
- This ensures the model only sees the part of the book the reader has reached.

### Chunking Strategy (Context Window v2 + Supabase)

#### Preprocess Step (`/api/books/[id]/context-preprocess`)
- Splits pages into smaller chunks (paragraphs or fixed sizes).  
- Stores them in `book_page_chunks` keyed by `book_id` and `page_number`.  

#### Query Step (`/api/books/[id]/context-window`)
- Given a question and a page window:
  - Filter chunks by page range.  
  - Rank or score chunks by relevance (keyword overlap, BM25, vector search).  
  - Build a concise system prompt plus selected context excerpts.

**System prompt override:**  
- Instead of the client sending raw pages, the backend can return:
  - `systemPrompt` (encoded instructions + excerpts)  
  - `metadata` describing what was used

### Fallback: Local Context Extraction
If Supabase or preprocessing is unavailable:
- Client uses `aiService.extractContextText(book, start, end)`.  
- Concatenates raw page text with page markers: `=== Page N ===`.  
- `extractContextTextChunked` breaks into chunks to meet token budgets.  
- Safety rules remain: **No pages beyond the selected window**.

### System Prompt Design
The system prompt enforces:
- **Scope:** “You ONLY know the supplied page excerpts (spoiler window).”  
- **Page semantics:** How to interpret “Page X?” questions.  
- **Spoiler guardrails:**  
  - Do not speculate about future plot events.  
  - If outside the provided context, respond that the information is not available yet.

---

AndrewJLe
