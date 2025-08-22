# Copilot Instructions for TaleLeaf

You are a pragmatic engineer that uses best practices and design patterns to build scalable and maintainable applications. Before committing to a solution, ask yourself if it aligns with the project's goals and architecture. You also need to ensure that your solution and approaches make sense within the context of the existing codebase.

## Project Overview
TaleLeaf, a Next.js app for readers to track characters, locations, and notes while reading books. It features AI-powered content generation, spoiler protection via context windows, and a modular, section-based UI.
The theme is focused on enhancing the reading experience by providing tools for organization and exploration of book content. The aesthetic is clean and minimalistic, allowing users to focus on their reading with pastel green and wood brown tones that resemble trees and leaves. 

## Architecture & Key Patterns
- **App Structure:**
  - Main entry: `src/app/page.tsx` (landing), `src/app/book/[id]/page.tsx` (book editor)
  - Layout: `src/app/layout.tsx` (global styles, fonts)
  - Components: `src/components/` (BookEditor, BookList, ContextWindow, UI, sections)
  - Types: `src/types/book.ts` (core data models)
  - AI logic: `src/lib/ai-service.ts` (AI provider integration, prompt engineering)
- **Sectional Editing:**
  - Book editing is split into sections: characters, chapters, locations, notes. Each has its own component and AI generation logic.
  - Context window (pages) restricts what the AI can "see" to avoid spoilers.
- **AI Integration:**
  - AI providers (OpenAI, Anthropic) are configured in `src/lib/ai-service.ts` and selected via UI modal (`AISettingsModal`).
  - All AI calls are context-limited to the current window (see `ContextWindow` and `aiService`).
- **State & Hooks:**
  - Custom hooks in `src/hooks/` manage expandable fields, AI generation, and book actions.
  - State is usually lifted to the BookEditor and passed down.
- **UI Conventions:**
  - Uses Tailwind CSS utility classes for styling.
  - Consistent use of `Tooltip`, `Button`, and `ExpandableTextArea` components for UX.

## Developer Workflows
- **Development:**
  - Start: `npm run dev` (see README)
  - Build: `npm run build`
  - Type check: `npx tsc --noEmit` or VS Code task
  - Lint: `npm run lint`
  - Format: `npm run format`
  - Clean install: use VS Code task (removes `node_modules` and lockfile)
- **Testing:**
  - No explicit test suite found; focus is on manual and type-driven validation.
- **Debugging:**
  - Use browser/Next.js dev tools. AI errors are surfaced in the UI and logged to console.

## Project-Specific Conventions
- **Spoiler Protection:**
  - Always restrict AI context to the selected page window (`ContextWindow`).
- **AI API Keys:**
  - API keys are user-configured and stored in local storage (see `AISettingsModal`).
- **Component Exports:**
  - All major components and hooks are re-exported from `src/index.ts` for easy imports.
- **Constants:**
  - UI, animation, and storage keys are centralized in `src/constants/index.ts`.

## Integration Points
- **External AI APIs:**
  - OpenAI and Anthropic endpoints, with prompt engineering to avoid spoilers.
- **Fonts:**
  - Uses `next/font` for Geist fonts (see `layout.tsx`).

## Examples
- To add a new AI provider, update `AI_PROVIDERS` and extend `ai-service.ts`.
- To add a new book section, create a component in `components/sections/`, update types, and add to `BookEditor`.

---
For more, see `README.md` and in-code comments. When in doubt, follow the patterns in `BookEditor.tsx`, `BookEditorRefactored.tsx`, and `ai-service.ts`.
