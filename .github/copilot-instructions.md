# Copilot Instructions for TaleLeaf

You are a pragmatic engineer. Apply best practices, prefer incremental evolution, and keep spoiler safety + data integrity as first-class constraints. Before implementing: validate alignment with product vision, data model roadmap, and AI safety guidelines.

---
## 1. Updated Product Snapshot
TaleLeaf helps readers turn raw narrative into structured understanding (characters, locations, timelines, theories) with spoiler-aware AI assistance. Design values: Calm UI, Trustworthy AI, Fast capture, Portable ownership.

North-star (internal): Weekly Active Book Editors (WABEs). Supporting: Time-to-first-book, Notes-per-book, AI actions/session.

---
## 2. Architecture & Layers
- **App Router Pages:**
  - Landing: `src/app/page.tsx`
  - Library/Profile: `/profile`
  - Book Editor: `/book/[id]`
- **Components:** UI primitives (`components/ui`), domain sections (`components/sections`), editor shells, settings modals.
- **Data Access:** Direct Supabase client on client-side + minimal API routes for server mutations where needed.
- **AI Layer:** `ai-service.ts` centralizes provider selection, prompt shaping, token estimation, context scoping.
- **Storage:**
  - Relational (Supabase Postgres) for books, sections, (upcoming) notes + locations tables.
  - Storage bucket `books` for PDFs (per-user folder). IndexedDB caching for offline PDF pages.
  - LocalStorage for lightweight cached metadata & AI settings.

---
## 3. Evolving Data Model (Current & Planned)
Existing tables (simplified): `books`, `sections`, `uploads`. Upcoming refactors:

### 3.1 Multi-Note Model (New Table: `book_notes`)
Purpose: Replace single monolithic general notes string.
Proposed columns:
| Column | Type | Notes |
|--------|------|-------|
| id | uuid pk | generated |
| book_id | uuid fk books(id) | cascade delete |
| title | text nullable | default derived ("Note N") |
| body | text | markdown/plain |
| tags | text[] default '{}' | user-defined free-form tags (e.g. 'suspect1') |
| position | int | manual ordering (sparse allowed) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |
| min_visible_page | int nullable | spoiler unlock threshold |
| spoiler_protected | boolean default false | gating toggle |

Migration Plan:
1. Create table & RLS (ownership via book_id -> books.user_id).
2. Backfill: if `sections` notes content non-empty, create one note (position=0, title='Imported Notes').
3. Update UI: Replace single notes area with note list (CRUD + drag reorder).
4. Remove old notes field from sections JSON payload after stable release (feature flag).

### 3.2 Hierarchical Locations (Optional Table: `book_locations`)
Move from JSON array in sections to structured table for nesting & querying.
| Column | Type | Notes |
| id | uuid pk |
| book_id | uuid fk books(id) |
| parent_id | uuid nullable fk book_locations(id) | null = root |
| name | text not null |
| notes | text | description |
| position | int | ordering among siblings |
| depth | int generated? | enforce max depth (configurable) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Constraints:
- Enforce depth <= 10 (configurable constant) to avoid pathological recursion.
- Index: (book_id, parent_id, position)

Migration Strategy:
1. Introduce table + RLS.
2. UI dual-source: show table data if exists else fallback to sections JSON.
3. Migration script to copy existing JSON locations -> rows.
4. Deprecate JSON path once adoption stable.

### 3.3 Characters & Chapters
Remain in `sections` JSON short-term. Consider future normalization if we need search / cross-book analytics.

### 3.4 Notes Visibility Logic
When rendering a note marked `spoiler_protected=true` with `min_visible_page=N`, hide (show blurred stub) unless active reader window end >= N.

---
## 4. AI Integration Guidelines
- Always slice context window: `window.start..window.end` pages only.
- Standard system prefix (pseudo):
  "You are TaleLeaf's assistant. You ONLY know the supplied page excerpts (spoiler window). If asked beyond, reply that content is outside current reading window."
- Register new providers by extending `AI_PROVIDERS` with: id, display name, base URL/model, cost metadata, key requirement.
- Providers roadmap: Start with OpenAI (gpt-4o-mini), Anthropic (claude), optional generic OpenRouter (future).
- Cost Classification: Low (<2K tokens), Medium (2–8K), High (>8K) -> gating & confirmation dialog.
- Add negative guard lines: "Do not speculate about future plot events." for generation prompts.

---
## 5. RLS & Security Conventions
- Every row-scoped table must tie to user via `books.user_id` or direct `auth.uid()` equality.
- Storage paths: `${userId}/${bookId}/...` only; do not expose raw storage keys to AI layer.
- API routes MUST verify ownership before mutating.

---
## 6. Sync & Conflict Strategy (Interim)
- Last-write-wins using `updated_at` server timestamps.
- Batched debounce (≥1.5s) for section/note updates.
- Future: Field-level patch log for multi-device reconciliation (not yet implemented).

---
## 7. Offline & Caching
- PDFs cached in IndexedDB via `pdfStorage`; prefer signed URL download then store.
- Local notes/locations hydrated from normalized tables (once migrated) -> fallback to cached snapshot in LocalStorage for quick open.

---
## 8. UX / Accessibility Principles
- Keyboard first: All core actions reachable by tab + shortcut (later).
- Explicit loading & empty states for each pane.
- Avoid layout shift on debounced AI responses.

---
## 9. Collaboration (Future Design Hooks)
- Anticipate shared book sessions: add optional `shared` flag later.
- Spoiler-protected notes already structured for page gating; extend with participant progress later.
- Do NOT bake multi-user assumptions into current state shape yet—keep update functions pure and isolated.

---
## 10. Implementation Priorities (Near Term)
1. Multi-note table + UI (feature flag `notesV2`).
2. Hierarchical locations table + tree UI (feature flag `locationsV2`).
3. AI chapter summary action (safe context + cost estimate).
4. Export (Markdown / JSON) pipeline.
5. Highlight → entity creation groundwork.

---
## 11. Developer Workflow
- Run type checks before committing changes to schema-impacting code.
- Keep migrations & app code in sync: add migration SQL block to `supabase-schema.sql` + note feature flag removal steps.
- Add TODO tags referencing story IDs (e.g., `// TODO N1:`) for traceability.

---
## 12. Adding a New Feature (Definition of Ready Checklist)
Include in PR description:
1. Story ID & summary.
2. Data model delta (tables/columns / none).
3. RLS review (unchanged / new policies snippet).
4. API changes (new route / extended body / none).
5. AI prompt(s) touched (IDs, cost class).
6. Edge cases (≥3) & empty state copy.
7. Performance note (expected token / payload size) if relevant.
8. Rollback plan.

---
## 13. Examples
- **Add Provider:** Extend `AI_PROVIDERS`, implement cost estimate map, ensure key retrieval from settings.
- **New Section/Table:** Create table + migration, add RLS, create adapter hook mapping DB rows ↔ editor state, migrate legacy JSON if needed.

---
## 14. Anti-Patterns to Avoid
- Large unstructured JSON blobs for evolving entities (notes, locations) post-migration.
- AI calls without explicit window enforcement.
- Silent catch blocks for RLS violations (log + surface minimal UX feedback).
- Over-coupling UI components to storage specifics (keep PDF & note sources abstracted).

---
## 15. References
See: `BookEditor.tsx`, `ai-service.ts`, `pdf-storage.ts`, `supabase-storage.ts` for existing patterns. Use them before inventing new ones.

---
When in doubt: preserve spoiler safety, minimize breaking schema churn, and implement behind feature flags until stable.
