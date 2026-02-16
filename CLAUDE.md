# CLAUDE.md

## 🚨 MANDATORY RULE: DISPLAY AT START OF EVERY RESPONSE 🚨

## MANDATORY: Use td for Task Management

Run td usage --new-session at conversation start (or after /clear). This tells you what to work on next.

Sessions are automatic (based on terminal/agent context). Optional:
- td session "name" to label the current session
- td session --new to force a new session in the same context

Use td usage -q after first read.

## Issue Tracking with Beads (`bd`)

Use `bd` (beads) for project-level issue tracking (bugs, features, tasks with dependencies). Issues persist in git across sessions.

**Session start:** `bd prime` is auto-injected via hooks. Check `bd ready` for available work.

**Workflow:**
1. `bd ready` — find unblocked issues
2. `bd show <id>` — review issue details
3. `bd update <id> --status=in_progress` — claim it before coding
4. Write code, commit
5. `bd close <id>` — mark complete
6. `bd sync` — sync beads changes with git

**Creating issues:** When you discover bugs, new features, or follow-up work during development:
```bash
bd create --title="Short description" --description="Context and what needs to be done" --type=task|bug|feature --priority=2
```
Priority: 0-4 (0=critical, 4=backlog). Do NOT use "high"/"medium"/"low".

**Dependencies:** `bd dep add <child> <parent>` — child depends on parent (parent blocks child).

**Session close:** Before saying "done", run: `bd sync` then push.

**WARNING:** Never use `bd edit` — it opens $EDITOR which blocks agents.

**td vs bd:** Use `td` for session-level task management (what to work on right now). Use `bd` for persistent issue tracking (bugs, features, tasks that span sessions).

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

My Love is a PWA (Progressive Web App) for couples to exchange daily love messages, mood tracking, photo sharing, love notes chat, scripture reading, and partner interactions. Built with React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand, and Supabase.

Live URL: https://sallvainian.github.io/My-Love/

## Commands

### Development

```bash
npm run dev              # Start dev server (runs cleanup script wrapper)
npm run dev:raw          # Start Vite dev server directly
npm run preview          # Preview production build (dotenvx decrypts .env)
npm run build            # Production build (dotenvx + tsc + vite)
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint (src, tests, scripts)
npm run lint:fix         # ESLint fix + Prettier
npm run format           # Prettier write
npm run format:check     # Prettier check
```

### Testing

```bash
# Unit tests (Vitest + happy-dom)
npm run test:unit              # Run all unit tests
npm run test:unit:watch        # Watch mode
npm run test:unit:ui           # Vitest UI
npm run test:unit:coverage     # With coverage (80% threshold)

# E2E tests (Playwright, requires local Supabase running)
npm run test:e2e               # All E2E tests (cleanup wrapper)
npm run test:e2e:raw           # Playwright directly
npm run test:e2e:ui            # Playwright UI mode
npm run test:e2e:debug         # Debug mode
npm run test:p0                # Priority 0 tests only
npm run test:p1                # Priority 0+1 tests

# Run a single unit test file
npx vitest run tests/unit/services/moodService.test.ts --silent

# Run a single E2E test file
npx playwright test tests/e2e/mood/mood-tracker.spec.ts

# Run E2E tests matching a pattern
npx playwright test --grep "mood tracker"

# Database tests (pgTAP via Supabase CLI)
npm run test:db                # supabase test db

# Smoke tests (post-build verification)
npm run test:smoke
```

### Supabase

```bash
supabase start           # Start local Supabase (required for E2E tests)
supabase stop            # Stop local Supabase
supabase status          # Show connection URLs and keys
supabase db reset        # Reset DB and re-run all migrations
supabase migration new <name>  # Create new migration file
supabase gen types typescript --local > src/types/database.types.ts  # Regenerate types
```

## Architecture

### State Management: Zustand Sliced Store

Single Zustand store (`src/stores/useAppStore.ts`) composed from 10 slices via the slice pattern:

- `appSlice` - initialization, loading states
- `settingsSlice` - theme, relationship config
- `navigationSlice` - current view routing
- `messagesSlice` - daily love messages, favorites
- `moodSlice` - mood tracking, partner mood sync
- `interactionsSlice` - poke/kiss/fart interactions
- `partnerSlice` - partner data, display name
- `notesSlice` - love notes chat messages
- `photosSlice` - photo gallery
- `scriptureReadingSlice` - scripture reading sessions

State is persisted to `localStorage` via `zustand/persist`. The store uses custom serialization for `Map` objects in `messageHistory.shownMessages`.

### Data Layer: Offline-First with Cloud Sync

**Offline-first architecture** — UI reads/writes IndexedDB as the primary data store. Supabase is the sync and sharing layer, not the source of truth for local user data.

- **IndexedDB** (via `idb` library): Primary local storage. Schema defined in `src/services/dbSchema.ts` (versioned, currently v5). Services extend `BaseIndexedDBService` for CRUD operations. Entries are created with `synced: false` and `supabaseId: null`.
- **Supabase**: Cloud backend for cross-device sync, partner features (realtime mood, love notes, interactions), and data persistence. Client singleton in `src/api/supabaseClient.ts`.
- **Sync strategy** (moods/photos/interactions): Three triggers — (1) immediate on creation, (2) periodic while app is open, (3) Background Sync API via service worker when app is closed. Partial failure handling: failed entries are retried on next sync pass.
- **Scripture feature uses the opposite pattern**: Online-first with optimistic UI. Supabase is the source of truth; IndexedDB is a read cache. Writes go to Supabase RPC first and throw on failure (no offline queue). Reads use cache-first with fire-and-forget background refresh. The Zustand slice updates state optimistically before server confirmation, with `pendingRetry` state for user-triggered retry on failure.

### Service Worker (`src/sw.ts`)

Custom InjectManifest strategy (not GenerateSW). Handles:
- Precaching static assets (images/fonts only - JS/CSS use NetworkFirst)
- Background Sync for mood entries via direct IndexedDB + Supabase REST API calls
- Cache strategies: NetworkFirst for navigation/API, CacheFirst for images/fonts
- Database operations in `src/sw-db.ts` (separate from app IndexedDB code)

### Environment Variables

Uses [dotenvx](https://dotenvx.com) for encrypted `.env` files committed to git. The `.env.keys` file (gitignored) contains the decryption key.

Key env vars:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Supabase anon/public key

For E2E tests, `.env.test` provides plain-text local Supabase values. Playwright config auto-detects local Supabase via `supabase status -o env`.

### Authentication

Email/password auth via Supabase Auth. The app expects exactly 2 users linked via `partner_id` in the `users` table. Partner detection is automatic.

### Testing Architecture

**Unit tests** (`tests/unit/`): Vitest + happy-dom + React Testing Library. Setup in `tests/setup.ts`. Uses `fake-indexeddb` for IndexedDB mocking.

**E2E tests** (`tests/e2e/`): Playwright with merged fixtures from `@seontechnologies/playwright-utils` and custom fixtures (`tests/support/merged-fixtures.ts`). Always import `{ test, expect }` from `tests/support/merged-fixtures` in E2E tests.

**Auth setup** (`tests/support/auth-setup.ts`): Creates worker-isolated test users via Supabase Admin API before tests run. Each parallel worker gets its own user pair (user + partner) to prevent cross-contamination. Auth state stored in `tests/.auth/worker-{n}.json`.

**API tests** (`tests/api/`): Playwright-based API tests against Supabase endpoints.

**Database tests** (`supabase/tests/database/`): pgTAP tests run via `supabase test db`.

### Supabase Migrations

Located in `supabase/migrations/`. Named as `YYYYMMDDHHmmss_description.sql`. Tables: `users`, `moods`, `interactions`, `photos`, `love_note_images`, `scripture_*` tables. All tables have RLS enabled.

### Validation

Zod schemas in `src/validation/schemas.ts` with user-facing error messages in `src/validation/errorMessages.ts`.

### Routing

No router library - navigation is managed via `navigationSlice` in Zustand store. `App.tsx` renders views conditionally based on `currentView` state.

### Base Path

Production builds use `/My-Love/` base path for GitHub Pages deployment. Development uses `/`. Configured in `vite.config.ts` via `mode === 'production'` check.

## Key Conventions

- Package manager: **npm** (see `package-lock.json`)
- Node version: **v24.13.0** (see `.nvmrc`)
- Path alias: `@/` maps to `src/` (configured in vitest.config.ts, not in vite.config.ts)
- Generated types: `src/types/database.types.ts` is auto-generated from Supabase schema - do not edit manually
- ESLint enforces `no-explicit-any` as error
- Prettier with `tailwindcss` plugin for class sorting
- CI workflows in `.github/workflows/`: deploy, test, migrations, code review

## Retrospective Guardrails (Epic Carry-Over)

- Catch blocks must never be empty. In scripture code, catch blocks must call `handleScriptureError()` or re-throw; outside scripture code, re-throw or map to the feature's error handler.
- For scripture-reading container code and new architecture-conforming work, do not import `supabase` or service modules directly; go through Zustand slice actions (legacy exception: `scriptureReadingService` adapter until refactor).
- New scope discovered during development must be captured as a follow-up story. Do not reopen a story in review unless there is a critical regression or security fix approved by the owner.
