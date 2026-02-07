---
project_name: 'My-Love'
user_name: 'Sallvain'
date: '2026-02-04'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 48
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Language:** TypeScript ~5.9.3 (strict mode, ES2022, verbatimModuleSyntax)
- **UI Framework:** React ^19.2.3 (react-jsx transform)
- **Build:** Vite ^7.3.1 (bundler module resolution, manual chunk splitting)
- **State:** Zustand ^5.0.10 (slice-based, persist middleware → localStorage)
- **Backend:** Supabase ^2.90.1 (PostgreSQL + RLS + Realtime subscriptions + Storage)
- **Local DB:** idb ^8.0.3 (IndexedDB for offline-first persistence)
- **Validation:** Zod ^4.3.5 (schema validation at data boundaries)
- **Styling:** Tailwind CSS ^4.1.17 (utility-first, PostCSS, class sorting via Prettier plugin)
- **Animation:** Framer Motion ^12.27.1
- **Icons:** Lucide React ^0.562.0 (tree-shakeable)
- **PWA:** vite-plugin-pwa ^1.2.0 (injectManifest strategy, custom sw.ts)
- **Sanitization:** DOMPurify ^3.3.1 (XSS prevention for user content)
- **Virtualization:** react-window ^2.2.5
- **Unit Tests:** Vitest ^4.0.17 (happy-dom, V8 coverage, 80% thresholds)
- **E2E Tests:** Playwright ^1.57.0 (Chromium)
- **Linting:** ESLint ^9.39.2 + typescript-eslint ^8.53.1 (flat config)
- **Formatting:** Prettier ^3.8.0 (100 char width, single quotes, trailing commas ES5)
- **Package Manager:** npm (package-lock.json)
- **Env Management:** dotenvx (encrypted .env, decrypted at build/runtime)

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

- **`import type` required:** `verbatimModuleSyntax` is enabled — use `import type { X }` for type-only imports or the build will fail
- **No `any`:** ESLint enforces `@typescript-eslint/no-explicit-any: 'error'` — use `unknown`, specific types, or generics instead
- **Explicit return types:** All exported functions must declare return types (components return `ReactElement`)
- **Unused vars prefix:** Unused parameters/variables must be prefixed with `_` (e.g., `_event`, `_unused`)
- **Path alias:** Use `@/` for imports from `src/` (e.g., `import { X } from '@/services/myService'`)
- **Named exports only:** No default exports for components or services — use named exports + barrel files
- **Import order:** Node built-ins → External packages → `@/` internal modules → Relative imports
- **Error handling split:** Read operations return `null`/`[]` on failure; write operations throw `SupabaseServiceError`
- **Env vars:** Access via `import.meta.env.VITE_*` — never use `process.env` in client code
- **Module system:** ESM only (`"type": "module"` in package.json) — `.cjs` extension required for CommonJS scripts

### Framework-Specific Rules (React + Zustand)

- **No default exports:** Components use named exports only — wrap with barrel `index.ts` files
- **Feature-based folders:** Each UI feature gets its own directory under `src/components/` with co-located sub-components
- **Zustand slice pattern:** New state domains go in `src/stores/slices/{domain}Slice.ts`, composed in `useAppStore.ts`
- **Store types centralized:** All store types live in `src/stores/types.ts` — never define slice types in the slice file (prevents circular imports)
- **No router:** Navigation uses `navigationSlice.currentView` — do NOT add react-router or any client-side router
- **Hydration validation:** Zustand persist middleware requires `validateHydratedState()` — new slices must add their validation logic there
- **Map serialization:** `messageHistory.shownMessages` is a Map — requires custom serialize/deserialize in persist storage config
- **Lazy loading:** Heavy components (Supabase-dependent, photo gallery) must use `React.lazy()` + `<Suspense>`
- **Error boundaries:** Wrap new feature areas with `<ViewErrorBoundary>` — top-level `<ErrorBoundary>` catches uncaught errors
- **Unmount safety:** Use `isMountedRef` pattern in effects that set state after async operations
- **DOMPurify required:** All user-generated HTML content must be sanitized with `DOMPurify.sanitize()` before rendering
- **PWA pitfall:** `vite-plugin-pwa` uses `injectManifest` — runtime caching is in `src/sw.ts`, NOT in vite config's workbox section (which is ignored)

### Testing Rules

- **Unit tests (Vitest):** Environment is `happy-dom` — setup file at `tests/setup.ts` mocks `fake-indexeddb`, `window.matchMedia`, `IntersectionObserver`, `ResizeObserver`
- **Test co-location:** Component tests go in `src/components/{feature}/__tests__/*.test.tsx`; service/util tests go in `tests/unit/`
- **E2E tests (Playwright):** Organized by feature area under `tests/e2e/{feature}/` (auth, home, mood, notes, photos, scripture, offline, partner)
- **Coverage thresholds:** 80% minimum for lines, functions, branches, statements — builds fail below this
- **TDD Guard:** `tdd-guard-vitest` reporter is active — follows TDD workflow enforcement
- **Test env vars:** Vitest config injects mock `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — do not use real credentials in tests
- **Test file relaxations:** Test files allow `@ts-ignore`, unused vars, empty patterns, non-standard hook usage — see `eslint.config.js` test overrides

### Code Quality & Style Rules

- **Prettier config:** 100 char width, 2-space indent, single quotes, ES5 trailing commas, LF line endings, Tailwind class sorting
- **ESLint flat config:** `eslint.config.js` (not `.eslintrc`) — uses `typescript-eslint` with recommended config
- **File naming:** PascalCase for components (`LoveNoteMessage.tsx`), camelCase for services/utils (`dateFormatters.ts`), kebab-case for feature directories (`love-notes/`)
- **Slice naming:** `{domain}Slice.ts` (e.g., `messagesSlice.ts`, `moodSlice.ts`)
- **Story annotations:** Components reference Story/AC numbers in JSDoc headers (e.g., `Story 2.1: AC-2.1.1`)
- **Validation at boundaries:** Zod schemas in `src/validation/schemas.ts` validate data entering the app from Supabase — validate in the service layer before IndexedDB writes
- **IndexedDB services:** All IndexedDB services extend `BaseIndexedDBService<T>` — call `await service.init()` before use; implements initialization guard against concurrent setup

### Development Workflow Rules

- **Branch naming:** `feature/epic-N-description` — all epic work stays on feature branch until PR
- **Commit format:** `type(scope): description` — types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`
- **One story per commit:** Never mix Story 1.2 and Story 1.3 work in the same commit
- **Separate docs from code:** Documentation-only changes get their own commit
- **Sprint tracking separate:** Status YAML updates get their own `chore(sprint)` commit
- **Build command:** `dotenvx run --overload -- bash -c 'tsc -b && vite build'` — requires dotenvx for env decryption
- **Deploy target:** GitHub Pages at `/My-Love/` subpath — `base` in vite config switches between `/My-Love/` (prod) and `/` (dev)
- **Pre-deploy check:** `npm run predeploy` runs build + smoke tests before deployment

### Critical Don't-Miss Rules

- **No `process.env`:** This is a browser app — use `import.meta.env.VITE_*` exclusively
- **No react-router:** The app uses Zustand `navigationSlice` for view switching — adding a router would break the architecture
- **No workbox config in vite:** With `strategies: 'injectManifest'`, the `workbox` section in vite config is completely ignored — all runtime caching goes in `src/sw.ts`
- **Supabase types are auto-generated:** `src/types/database.types.ts` is generated from Supabase schema — never edit manually, regenerate with `supabase gen types typescript`
- **Dual persistence model:** Small state → localStorage (Zustand persist), large data → IndexedDB (via `idb`), remote → Supabase — never store blobs in localStorage
- **Offline-first:** The app must work offline — all features need graceful degradation when network is unavailable; use `isOnline()` checks and `SupabaseServiceError.isNetworkError`
- **GitHub Pages base path:** Production builds use `/My-Love/` as base — all asset URLs must be relative or use the Vite `base` config; absolute paths will break on GH Pages
- **Encrypted env:** `.env` is encrypted with dotenvx — `.env.keys` contains decryption key and is gitignored; never commit plaintext secrets

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-02-04
