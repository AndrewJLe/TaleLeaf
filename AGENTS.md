## Agents Documentation

This document defines the rules, responsibilities, and workflows for all agents working within the project. Its purpose is to ensure consistent code quality, architectural stability, and safe interactions with application data and infrastructure.

---

## Agent Guidelines

### Do’s

- Use existing components before creating new ones.
- Confirm with the user before making any large structural, architectural, or design changes.
- Follow ESLint and TypeScript guidelines strictly.
- Prefer functional, composable React components.
- Use hooks from `/hooks` whenever available instead of duplicating logic.
- Maintain clear separation of concerns:
  - UI lives in `/components`
  - Logic lives in `/hooks` and `/lib`
- Use the shared Supabase client utilities from `/lib` rather than creating new instances.
- Ensure all async operations are fully typed with accurate return shapes.
- Access environment variables only through approved configuration helpers.
- Follow Next.js conventions regarding routing, server/client boundaries, caching, and data-fetching.
- Keep all component props typed, minimal, and documented.
- Validate assumptions with the user before modifying data structures, shared interfaces, or database schemas.

### Don’ts

- Do not hard-code colors; always use design tokens or utility classes.
- Do not create duplicate components, hooks, or helper functions.
- Do not bypass existing abstractions (hooks, lib utilities, Supabase wrappers).
- Do not introduce new state management libraries without approval.
- Do not mix server and client logic in the same file.
- Do not modify database schemas or expand tables without explicit confirmation.
- Do not disable ESLint rules unless absolutely necessary and documented.
- Do not log or expose sensitive data in errors, logs, or responses.
- Do not create circular dependencies across components, hooks, or lib modules.
- Do not use magic numbers; place constants in `/constants`.

---

## Project Structure Overview

/src
/app → Next.js routes and server components
/components → UI components only
/hooks → Reusable client/server logic
/lib → Supabase utilities, shared logic, config helpers
/constants → Shared constants and application-wide values

---

## Agent Responsibilities

| Agent    | Responsibilities                                                               |
| -------- | ------------------------------------------------------------------------------ |
| Planner  | Breaks tasks into steps, clarifies requirements, and confirms user intent.     |
| Builder  | Implements components, hooks, utilities, and requested features.               |
| Reviewer | Audits generated code for accuracy, quality, safety, and guideline compliance. |

---

## Communication Rules

- Ask clarifying questions before writing or modifying core logic.
- Always reference file paths explicitly when proposing changes.
- When modifying existing files, provide the diff or patch when requested.
- Keep responses concise and technical unless the user asks otherwise.
- Confirm assumptions before altering schemas, APIs, or shared interfaces.

---

## Safety and Security Guidelines

- Never log or expose JWTs, session objects, API keys, or sensitive Supabase data.
- Use server-side environment variables only inside server-designated files.
- Apply row-level security (RLS) and rely on Supabase policies when applicable.
- Handle errors safely and never return raw stack traces, tokens, or unfiltered exceptions.

---

## Definition of Done

A task is considered complete when all of the following are true:

- Code compiles with no TypeScript errors.
- ESLint passes with no warnings or ignored rules.
- Prettier formatting is applied.
- Components and hooks are fully typed with appropriate return values.
- No duplicate logic or unnecessary abstractions are introduced.
- The user has reviewed and confirmed the output.

---

## Developer Commands

### Type Checking

#### Single file

npx tsc --noEmit --pretty --project tsconfig.json <path/to/file.ts>

#### Entire project

npm run type-check

### Formatting

#### Single File

npx prettier --write <file_path>

#### All files

npm run format

### Linting

#### Project-wide

npm run lint

#### Single file

npx eslint <file_path>

### Dev Server

Start the local Next.js development environment:
npm run dev
