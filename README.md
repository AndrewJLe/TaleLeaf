# TaleLeaf
<<<<<<< HEAD

TaleLeaf helps readers turn raw narrative into structured understanding (characters, locations, timelines, and notes) with spoiler-aware AI assistance.

TL;DR

- Local-first Next.js app for collecting and annotating books and PDFs.
- AI integrations live in `src/lib/ai-service.ts` and are feature-flagged for debug preview.
- API keys are stored locally (user-visible) and managed in the Settings UI.

Features

- Book library + editor with sections for chapters, characters, locations, and notes.
- PDF upload + viewer with page-scoped context windows for AI prompts.
- AI actions: summarization, extraction, and other context-window-aware generation.
- Local API key vault (add / edit / delete / select per provider) surfaced in `Settings`.
- Debug preview for AI prompts when `debugAIChat` feature flag is enabled.

Quick start (development)

1. Install dependencies

```powershell
npm install
```

2. Run dev server

```powershell
npm run dev
```

3. Useful tasks

```powershell
npm run build       # production build
npx tsc --noEmit    # type check
npm run lint        # eslint
npm run format      # prettier formatting
```

Architecture overview

- Next.js (App Router). Key pages: `src/app/page.tsx`, `src/app/book/[id]/page.tsx`, `src/app/profile/page.tsx`.
- Components live under `src/components` (UI primitives in `src/components/ui`, domain sections in `src/components/sections`).
- Hooks under `src/hooks` for reusable logic (book persistence, AI generation helpers, normalized entities).
- AI integration and providers live at `src/lib/ai-service.ts` — central place to add new providers, manage provider selection, and build chat payloads.
- Supabase helpers and server adapters live in `src/lib` and `src/lib/server`.

AI integration notes

- `src/lib/ai-service.ts` centralizes provider mapping, system prompt building, and provider-specific chat calls.
- API keys are stored locally in a structured format (`StoredApiKey`) inside the AI settings persisted to localStorage. The UI in `Settings` provides add/edit/delete and provider-level selection.
- There is a migration helper to convert legacy provider->secret maps into structured records.
- For debugging, the `debugAIChat` feature flag toggles a preview flow that shows the exact system prompt + messages + context snippet that would be sent to a provider.

Security and privacy

- Stored API keys are kept locally (in browser storage) and are visible to the user via the Settings UI. They are not (by default) encrypted before being persisted.
- If you require stronger protection, consider encrypting the secrets with the Web Crypto API or storing them in a secure server-side vault.
- The app enforces spoiler-gating on note visibility by page ranges when rendering AI-supplied content.

Feature flags

- Flag definitions live in `src/constants/featureFlags.ts`.
- Notable flags:
  - `debugAIChat` — swap send button for a prompt preview + show system prompt JSON for debugging.
  - `notesV2`, `locationsV2` — feature-flagged migrations and UI for notes/locations if present.

Developer guidance & conventions

# TaleLeaf

TaleLeaf is a spoiler-safe reading companion that helps you turn raw narrative into structured understanding. It sits alongside your books and lets you capture characters, locations, chapters, and notes while using AI that stays strictly inside your current reading window.

Think of it as a focused **reading workbench** for people who annotate, analyze, or study long-form fiction and narrative non-fiction.

---

## Table of Contents

- [What TaleLeaf Is](#what-taleleaf-is)
- [Core Features](#core-features)
- [How It Works (High-Level Architecture)](#how-it-works-high-level-architecture)
- [Chunking & Ranking: How TaleLeaf Minimizes Tokens](#chunking--ranking-how-taleleaf-minimizes-tokens)
- [Development Notes](#development-notes)
- [Deploying to GitHub Pages](#deploying-to-github-pages)

---

## What TaleLeaf Is

### A Personal Reading Companion
- Upload a book (PDF or text)
- Set your current page window (e.g., `start..end`)
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
Each book has its own editor at `/book/[id]`:

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
- Multiple free-form notes, each with title, body, tags, and ordering position.
- Per-note dirty tracking and Save/Discard controls for batch editing.
- AI-generated notes for themes, motifs, or custom topics.
- **All Notes** view aggregates notes, characters, chapters, and locations for study/export.

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
- **Top-level routes:** `app/page.tsx`, `app/profile/page.tsx`, `app/book/[id]/page.tsx`, `app/auth/callback/page.tsx`

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
Located in `src/lib/ai-service.ts`:

#### Provider Registry
- `AI_PROVIDERS` lists supported models, cost metadata, and whether they require a key.

#### Chat Wrapper
- Builds the system prompt with current context pages.
- Calls providers (OpenAI/Anthropic) with constructed messages and records key usage locally.

---

## Chunking & Ranking: How TaleLeaf Minimizes Tokens

### Page-Based Context Window
- The page range selected by the user acts as the root constraint.
- The uploaded book is split into `pages[]`.
- When the window is `[start, end]`, context is derived from `pages[start-1..end-1]`.

### Chunking Strategy (Context Preprocess + Supabase)

#### Preprocess Step (`/api/books/[id]/context-preprocess`)
- Splits pages into smaller chunks (paragraphs or fixed sizes).
- Stores them in `book_page_chunks` keyed by `book_id` and `page_number`.

#### Query Step (`/api/books/[id]/context-window`)
- Given a question and a page window:
  - Filter chunks by page range.
  - Rank or score chunks by relevance (keyword overlap, BM25, vector search).
  - Build a concise system prompt plus selected context excerpts.

**System prompt override:** the backend can return `systemPrompt` and `metadata` describing what was used.

### Fallback: Local Context Extraction
- If Supabase or preprocessing is unavailable, client uses `aiService.extractContextText(book, start, end)` and concatenates raw page text with page markers.

### System Prompt Design
- Enforces scope: only supplied page excerpts are known.
- Spoiler guardrails: do not speculate about future plot events.

---

## Development Notes

### Quick start (development)

1. Install dependencies

```powershell
npm install
```

2. Run dev server

```powershell
npm run dev
```

3. Useful tasks

```powershell
npm run build       # production build
npx tsc --noEmit    # type check
npm run lint        # eslint
npm run format      # prettier formatting
```

### Key files & locations
- AI service: `src/lib/ai-service.ts`
- Book editor: `src/components/BookEditor.tsx`
- Settings and API key UI: `src/components/SettingsModal.tsx`
- Context-window server helpers: `src/app/api/books/[id]/context-window/route.ts`

---

## Deploying to GitHub Pages

- The project can be exported to static HTML using `next export` and published to GitHub Pages.
- The repo is configured to deploy to `https://andrewjle.github.io/TaleLeaf/` using a GitHub Actions workflow that publishes the `out/` directory to `gh-pages`.

Local test

```powershell
# Build and export static HTML to ./out
npm run export

# Serve the out/ folder locally
npx serve out
```

Notes
- `next export` only supports statically-renderable pages. The App Router and server-only APIs may require changes before a full static export works. If you need server runtimes, consider Vercel or Netlify.

---

If you'd like me to resolve anything else (push after resolving remaining conflicts, run the export and report errors, or switch deploy method), say the word and I'll continue.
