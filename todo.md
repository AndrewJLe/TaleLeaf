# TaleLeaf Vision & User Stories

A living backlog describing what TaleLeaf should enable for readers. Each story follows the format: _As a <role>, I want <capability> so that <benefit>_. Acceptance criteria (AC) clarify done.

---

## Epics Overview

1. Authentication & Onboarding
2. User Profile & Identity
3. Library Management
4. Book Ingestion (Upload / Create)
5. Book Editing (Sections)
6. Document Viewing & Context Window
7. Notes & Knowledge Capture (Multi-Note + Tags)
8. Locations & Hierarchies (Nested)
9. AI Assistance & Context Safety
10. Cloud Sync & Offline Resilience
11. Media & File Handling (PDF Storage)
12. Performance, UX Polish & Accessibility
13. Sharing, Collaboration & Spoiler Controls (Future)

---

## 1. Authentication & Onboarding

**Story A1**: As a reader, I want to sign up with email (magic link) so that I can start a private library.

- AC: Magic link flow sends email, redirect establishes session, UI reflects logged-in state.

**Story A2**: As a returning user, I want to sign in quickly so that I can access my books without re‑entering details.

- AC: Previously used method (magic link / OAuth) works; session auto-refreshes.

**Story A3**: As a user, I want to use Google OAuth so that I can avoid email friction.

- AC: One‑click sign in; failure states are surfaced clearly.

**Story A4**: As an authenticated user, I want to be automatically routed to my library after sign in so that I can resume reading quickly.

- AC: Post-auth redirect -> /profile; deep links preserved when coming from a book URL.

---

## 2. User Profile & Identity

**Story P1**: As a user, I want to upload an avatar so that my account feels personal.

- AC: Accepts common image formats, resizes/stores, displays in header/profile.

**Story P2**: As a user, I want to set or update a display name so that my identity appears across the app.

- AC: Validation (length, profanity filter TBD), persists to `profiles` table.

**Story P3 (Future)**: As a user, I want to adjust privacy settings so that I control what’s shared (when sharing exists).

---

## 3. Library Management

**Story L1**: As a user, I want to see all my books in a unified library so that I can pick one to continue reading.

- AC: Merged local + remote; badges: Cloud vs Local; count reflects merged set.

**Story L2**: As a user, I want to delete a book from my library so that I can keep things tidy.

- AC: Confirmation, removes local + remote (sections + PDF) or local-only fallback.

**Story L3**: As a user, I want books ordered by last activity so that active reads surface first.

- AC: Sort by updated_at descending; updates when sections or window change.

**Story L4 (Future)**: As a user, I want to filter/search my library so that I can find a book quickly.

---

## 4. Book Ingestion (Upload / Create)

**Story B1**: As a user, I want to add a book by uploading a PDF so that I can analyze the text while reading.

- AC: PDF validated, page count extracted, pages optionally text-extracted, stored locally + (if signed-in) PDF uploaded to storage + metadata persisted.

**Story B2**: As a user, I want to paste raw text to create a book so that I can work with excerpts or DRM-free text.

- AC: Text chunked into synthetic pages; window defaults to 1–50.

**Story B3**: As a user, I want to set title & (future) author so that metadata is clear.

**Story B4 (Future)**: As a user, I want to ingest EPUB or other formats so that I’m not limited to PDFs.

**Story B5 (Future)**: As a user, I want to resume an interrupted upload so that large files aren’t lost.

---

## 5. Book Editing (Sections)

**Story S1**: As a reader, I want to manage a list of characters with per-character notes so that I can remember roles.

- AC: Add, edit name/notes, delete, order stable. Persisted local + remote.

**Story S2**: As a reader, I want to list chapters and write summaries so that I can recap structure.

**Story S3**: As a reader, I want to track locations with notes so that I understand the world.

**Story S4**: As a reader, I want a general notes section for freeform thoughts so that I can capture ideas.

**Story S5 (Future)**: As a reader, I want undo/redo while editing sections so that mistakes are recoverable.

---

## 6. Document Viewing & Context Window

**Story D1**: As a reader, I want to view my document pages while editing notes so that I stay oriented.

- AC: PDF viewer (IndexedDB-backed) or text viewer shows current page.

**Story D2**: As a reader, I want to set a spoiler-safe context window so that AI won’t leak future plot details.

- AC: Drag/inputs define start/end; bounded by total pages.

**Story D3 (Future)**: As a reader, I want to highlight text passages and convert them into notes or character references.

---

## 7. Notes & Knowledge Capture (Multi-Note + Tags)

**Story N1**: As a reader, I want multiple discrete notes with titles and bodies so that I can segment ideas.

- AC: CRUD notes, default title auto-generated, persisted local + remote.
- AC: Ordering: default chronological; manual drag reorder persists via position field.

**Story N2**: As a reader, I want to tag notes (e.g. `suspect1`, `foreshadowing`) so that I can group investigative threads.

- AC: Free-form tag entry, de-duplicate case-insensitive, filter chips UI (future).

**Story N3**: As a reader, I want to mark a note as spoiler-protected until page X so that co-readers aren’t spoiled.

- AC: If current window end < threshold: show blurred placeholder with unlock hint.

**Story N4 (Future)**: As a reader, I want to search my notes so that I can find earlier thoughts quickly.

**Story N5 (Future)**: As a reader, I want AI to summarize all tagged `suspect` notes.

---

## 8. Locations & Hierarchies (Nested)

**Story H1**: As a reader, I want hierarchical (nested) locations so that I can model regions/cities/landmarks.

- AC: parent_id nullable; depth limited to 10 (config constant); drag to reparent respects depth.

**Story H2**: As a reader, I want collapse/expand of nested branches so that large worlds stay navigable.

**Story H3 (Future)**: As a reader, I want location breadcrumbs for orientation.

---

## 9. AI Assistance & Context Safety

**Story AI1**: As a user, I want to ask AI about the current window so that I get spoiler-safe assistance.

- AC: Only pages within window are included in prompt.

**Story AI2**: As a user, I want automatic cost estimation so that I understand token spend.

**Story AI3 (Future)**: As a user, I want AI to propose new characters/locations from current window.

**Story AI4 (Future)**: As a user, I want AI to summarize a selected range of pages.

---

## 10. Cloud Sync & Offline Resilience

**Story C1**: As an authenticated user, I want my books & sections to sync so that I can continue on another device.

- AC: Upserts book + sections; remote fetch merges with local; PDF path stored but pages still local.

**Story C2**: As a user, I want offline access to previously opened books so that travel doesn’t block reading.

- AC: IndexedDB PDFs and localStorage metadata load without network.

**Story C3**: As a user, I want graceful degradation when cloud unavailable so that I can keep reading.

- AC: Clear badges & non-blocking errors.

**Story C4 (Future)**: As a user, I want conflict resolution if I edit the same book on two devices.

---

## 11. Media & File Handling

**Story M1**: As a user, I want my original PDFs stored securely so that I can rehydrate viewer anywhere.

- AC: Private bucket, per-user folder, signed downloads.

**Story M2 (Future)**: As a user, I want cover images auto-generated (e.g. via AI) when missing.

**Story M3 (Future)**: As a user, I want file size warnings for large PDFs.

---

## 12. Performance, UX & Accessibility

**Story X1**: As any user, I want the UI to stay responsive during heavy PDF extraction so that the app feels stable.

- AC: Progress messages + async yields.

**Story X2**: As a keyboard user, I want to navigate major actions without a mouse.

**Story X3 (Future)**: As a user, I want dark mode for night reading.

---

## 13. Sharing, Collaboration & Spoiler Controls (Future)

**Story SH1**: As a user, I want to export my book notes (Markdown/JSON) so that I can archive or share externally.
**Story SH2**: As a user, I want to share a read-only snapshot with friends so that they can view progress.
**Story SH3**: As a group, we want collaborative editing (presence, permission tiers) so we can run a book club.
**Story SH4**: As a group, we want per-user progress tracking so spoiler-protected notes unlock individually.

---

## Cross-Cutting Technical Tasks (Backlog)

- Add server-side invariant tests for RLS access patterns.
- Implement `book_notes` table + migration & backfill importer (N1).
- Implement `book_locations` table + migration & dual-source adapter (H1).
- Sections API partial update + versioning (foundation for conflict resolution).
- Introduce optimistic UI + diff merging for notes & locations.
- Background PDF text extraction worker (web worker) + progress channel.
- Centralize analytics/event logging (privacy-first, local buffer with debounce flush).
- Rate limiting / abuse protection for AI endpoints.
- Feature flags (`notesV2`, `locationsV2`, `aiSummaries`, `collabPreview`).
- Prompt registry & evaluation harness.
- Export pipeline (Markdown + JSON) & download packaging.
- Performance budget instrumentation (ingestion time metrics).

---

## Prioritized Near-Term (Draft v2)

1. Multi-note model (schema + UI behind `notesV2`) – Stories N1–N3
2. Hierarchical locations (schema + tree UI behind `locationsV2`) – H1–H2
3. AI chapter summaries (AI4) – baseline summarizer prompt & cost gating
4. Export notes (Markdown/JSON) – SH1
5. Highlight → character/note creation foundation (D3) – selection capture + mapping
6. Tag filtering (basic inline filter) – N2

---

## Definition of Done (General)

- Meets acceptance criteria
- Type-safe (no new TS errors)
- RLS policies updated if needed
- Handles empty / error / loading states
- Accessible labels & keyboard focus for new UI
- Minimal regressions (manual smoke of auth, upload, edit, AI prompt)

---

## Notes

This file should be updated when scope changes. Before implementing a feature, reference its story ID and update status here.
