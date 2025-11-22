# TaleLeaf

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

- Follow patterns in `AGENTS.md` and `copilot-instructions.md`.
- Use hooks in `src/hooks` instead of duplicating logic.
- Keep UI components purely presentational and move logic into hooks or `src/lib` helpers.
- Run type checks and lint before committing.

Key files & locations

- AI service: `src/lib/ai-service.ts`
- Book editor: `src/components/BookEditor.tsx`
- Settings and API key UI: `src/components/SettingsModal.tsx`
- Context-window server helpers: `src/app/api/books/[id]/context-window/route.ts`

Contributing

- Fork, create a branch, and open a PR describing the change and the data model impact (if any).
- Run `npm run format`, `npm run lint`, and `npx tsc --noEmit` before opening a PR.

Contact & notes

- This README is a working summary for developers working on the repository.
- See `AGENTS.md` for team agent rules and `copilot-instructions.md` for the in-repo copilot guidance.

---

If you'd like, I can also:

- run `npm run format` and commit the formatted `README.md` now
- open a small PR with the README
- implement an optional encrypted local store for API keys

GitHub Pages deployment

- This project can be exported to static HTML using `next export` and published to GitHub Pages.
- Caveats: The app uses the App Router and some server-side features; only pages and routes that are fully static will be exported successfully. Test locally with `npm run export`.

Quick deploy steps (recommended via GitHub Actions)

1. A workflow is already included at `.github/workflows/deploy-gh-pages.yml` that runs on pushes to `main` and publishes the `out/` directory to the `gh-pages` branch.
2. If your site will be served from a path (for example: `https://<user>.github.io/<repo>`), set the repository path using `GH_PAGES_BASE_PATH` in CI or rely on `GITHUB_REPOSITORY` (the workflow will pick this up automatically when running on GitHub Actions).

Local test

```powershell
# Build and export static HTML to ./out
npm run export

# Serve the out/ folder locally (optional - using a simple static server)
npx serve out
```

Notes

- If the app requires server-side Next.js features (API routes, dynamic server rendering), consider deploying to Vercel, Netlify, or another hosting service that supports Next.js server runtimes instead of GitHub Pages.
- If you'd prefer an npm script that uses the `gh-pages` package instead of using Actions, I can add that as an alternative.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Optional Cloud Persistence (Phase 1)

To enable multi-device sync using Supabase (kept minimal):

1. Create a Supabase project (free tier).
2. Copy the SQL from `supabase-schema.sql` into the Supabase SQL editor and run it.
3. Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# Optional (future secure server mutations):
# SUPABASE_SERVICE_ROLE_KEY=service_role_key
```

4. Restart dev server.
5. Sign in via magic link (UI to be added) and import local books.

If env vars are absent the app silently falls back to local-only mode.
