---
project_name: 'My-Love'
user_name: 'Frank'
date: '2026-07-25'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
previous_revision_date: '2026-03-20'
rule_count: 136
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Runtime:** Node 24.13.0 (pinned in BOTH `.mise.toml` and `.node-version` -- keep them in sync)
- **Language:** TypeScript ~5.9.3 (strict mode, ES2022, verbatimModuleSyntax)
- **UI Framework:** React ^19.2.8 (react-jsx transform)
- **Build:** Vite ^7.3.6 (bundler module resolution, manual chunk splitting, vite-plugin-checker for dev overlay)
- **State:** Zustand ^5.0.14 (slice-based, persist middleware -> localStorage)
- **Backend:** Supabase ^2.110.8 (PostgreSQL 17 + RLS + Realtime subscriptions + Storage + Broadcast channels)
- **Local DB:** idb ^8.0.3 (IndexedDB for offline-first persistence)
- **Validation:** Zod ^4.4.3 -- imported via the `zod/v4` subpath, and declared in `devDependencies` (see language rules)
- **Styling:** Tailwind CSS ^4.1.17 + @tailwindcss/postcss ^4.3.3 (utility-first, PostCSS; NO class-sorting plugin)
- **Animation:** Framer Motion ^12.42.2 (lazy-loaded via `LazyMotion` with `domAnimation`)
- **Icons:** Lucide React ^0.577.0 (tree-shakeable)
- **PWA:** vite-plugin-pwa ^1.3.0 (injectManifest strategy, custom sw.ts) + workbox-window ^7.4.1
- **Sanitization:** DOMPurify ^3.4.12 (XSS prevention for user content -- see happy-dom shim in testing rules)
- **Virtualization:** react-window ^2.3.0 + react-window-infinite-loader ^2.0.1
- **SSE:** eventsource ^4.1.0
- **Error Tracking:** @sentry/react ^10.68.0 (prod-only, PII-stripped, ignores chunk/network/ResizeObserver errors) + @sentry/vite-plugin ^5.4.0 (sourcemap upload, gated on `SENTRY_AUTH_TOKEN`)
- **Unit Tests:** Vitest ^4.1.10 (happy-dom ^20.11.1, V8 coverage, 25% thresholds) + @vitest/coverage-v8 ^4.1.10
- **E2E Tests:** Playwright ^1.62.0 (Chromium) + @seontechnologies/playwright-utils ^3.14.0 + @axe-core/playwright ^4.12.1
- **Test Data:** @faker-js/faker ^10.5.0
- **Linting:** ESLint ^9.39.2 + typescript-eslint ^8.65.0 (flat config)
- **Formatting:** NONE. Prettier was deliberately removed (PR #221) -- there is no formatter, no `format` script, and no config file. Match surrounding style by hand.
- **Dead-code analysis:** `tsr` run via `npx` against `tsconfig.tsr.json` (`npm run deadcode`)
- **Bundle analysis:** rollup-plugin-visualizer ^6.0.5 (emits `dist/stats.html`)
- **Package Manager:** npm (package-lock.json)
- **Dependency pins:** package.json `overrides` pins ~18 transitive deps (glob, tar, ws, brace-expansion, uuid, @babel/core, lodash, ...) to close Dependabot/code-scanning alerts (PR #215). Do NOT drop entries from this block when bumping dependencies.
- **Secrets Management:** fnox with age encryption provider (encrypted ciphertext in `fnox.toml`, committed to git; age keys at `~/.age/key.txt`)

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

- **`import type` required:** `verbatimModuleSyntax` is enabled -- use `import type { X }` for type-only imports or the build will fail
- **No `any`:** ESLint enforces `@typescript-eslint/no-explicit-any: 'error'` -- use `unknown`, specific types, or generics instead
- **Explicit return types:** All exported functions must declare return types (components return `ReactElement`)
- **Unused vars prefix:** Unused parameters/variables must be prefixed with `_` (e.g., `_event`, `_unused`)
- **Path alias:** Use `@/` for imports from `src/` (e.g., `import { X } from '@/services/myService'`) -- configured in vitest.config.ts and tsconfig.app.json, NOT in vite.config.ts
- **Named exports only:** No default exports for components or services -- use named exports + barrel files
- **Import order:** Node built-ins -> External packages -> `@/` internal modules -> Relative imports
- **Error handling split:** Read operations return `null`/`[]` on failure; write operations throw `SupabaseServiceError`
- **Env vars:** Access via `import.meta.env.VITE_*` -- never use `process.env` in client code
- **Module system:** ESM only (`"type": "module"` in package.json) -- `.cjs` extension required for CommonJS scripts
- **Zod imports use the `zod/v4` subpath -- NEVER bare `'zod'`:** Every importer in `src/` uses `import { z } from 'zod/v4'` or `import { ZodError } from 'zod/v4'` (moodApi, supabaseSchemas, migrationService, moodService, scriptureReadingService, settingsSlice, errorMessages, schemas). Bare `'zod'` resolves to the v3-compatibility surface and silently diverges in behavior.
- **Zod lives in `devDependencies` on purpose:** It is used in production `src/` code and is listed in the `vendor-state` manual chunk, so it bundles correctly. Do not "fix" this by moving it to `dependencies` without re-checking `vite.config.ts` chunking.
- **Dual validation:** Local schemas in `src/validation/schemas.ts` validate IndexedDB writes; API response schemas in `src/api/validation/supabaseSchemas.ts` validate Supabase responses -- agents must use the correct schema layer
- **Re-export Zod types via `stores/types.ts`:** Zod-inferred types from `src/api/validation/supabaseSchemas.ts` that are consumed by UI components must be re-exported through `src/stores/types.ts` using `export type { X } from '../api/validation/supabaseSchemas'` -- this is the single source of truth; never import from `supabaseSchemas.ts` directly in components
- **Catch blocks must never be empty:** In scripture code, catch blocks must call `handleScriptureError()` or re-throw. Outside scripture code, catch blocks must re-throw or map to the feature's error handler.
- **No `console.log` in src code:** ESLint enforces `no-console: 'error'` (only `console.warn` and `console.error` are allowed). Use `logger.debug()` (dev-only) or `logger.info()` (operational) from `src/utils/logger.ts`. Exception: `src/sw.ts` and `src/sw-db.ts` (service workers) are exempt since they can't import the logger utility.
- **Logger imports use relative paths:** Import logger via relative paths (e.g., `../../utils/logger`), NOT the `@/utils/logger` path alias. The alias is not configured in `vite.config.ts` and will break production builds. The `@/` alias only works in vitest.config.ts and tsconfig.app.json.
- **Date utilities consolidated:** All date formatting/comparison/arithmetic lives in `src/utils/dateUtils.ts`. Functions include `formatDateISO()` (local timezone, NOT UTC), `formatRelativeDate()`, `isToday()`, `isSameDay()`, `addDays()`, `getRelativeTime()`, etc. Do not create new date utility files or inline date logic -- import from `dateUtils.ts`.

### Framework-Specific Rules (React + Zustand)

- **No default exports:** Components use named exports only -- wrap with barrel `index.ts` files
- **Feature-based folders:** Each UI feature gets its own directory under `src/components/` with co-located sub-components
- **Zustand slice pattern:** New state domains go in `src/stores/slices/{domain}Slice.ts`, composed in `useAppStore.ts`
- **Store types centralized:** All store types live in `src/stores/types.ts` -- never define slice types in the slice file (prevents circular imports)
- **No router:** Navigation uses `navigationSlice.currentView` -- do NOT add react-router or any client-side router
- **Hydration validation:** Zustand persist middleware requires `validateHydratedState()` -- new slices must add their validation logic there
- **Map serialization:** `messageHistory.shownMessages` is a Map -- requires custom serialize/deserialize in persist storage config
- **Lazy loading:** Heavy components (Supabase-dependent, photo gallery, AdminPanel) must use `React.lazy()` + `<Suspense>`
- **Error boundaries:** Wrap new feature areas with `<ViewErrorBoundary>` -- top-level `<ErrorBoundary>` catches uncaught errors
- **Unmount safety:** Use `isMountedRef` pattern in effects that set state after async operations
- **Combined-effects rule:** Effects that share refs and trigger on the same dependency must be combined into a single effect to prevent race conditions.
- **DOMPurify required:** All user-generated HTML content must be sanitized with `DOMPurify.sanitize()` before rendering
- **PWA pitfall:** `vite-plugin-pwa` uses `injectManifest` -- runtime caching is in `src/sw.ts`, NOT in vite config's workbox section (which is ignored). Navigation requests use `NetworkFirst` via `NavigationRoute` in `sw.ts` -- `index.html` is intentionally excluded from the precache manifest (`globIgnores: ['**/*.html']`) so stale HTML is never served after deployments
- **Two data models:** Most features are offline-first (IndexedDB primary, Supabase syncs). Scripture reading is the opposite -- online-first (Supabase RPC is source of truth, IndexedDB is read cache). Agents must check which model a feature uses before implementing data layer code.
- **PendingRetry pattern:** Scripture feature uses `isPendingLockIn`/`isPendingReflection` flags + `retryFailedWrite()` for graceful offline recovery of failed Supabase writes
- **React 19 hooks lint rules:** `react-hooks/set-state-in-effect` and `react-hooks/purity` are set to `warn` (not error) -- legitimate patterns like blob URL lifecycle and timer setup trigger these
- **Stats stale-cache preservation:** When a Zustand action loads stats via an RPC (e.g., `loadCoupleStats()`), only update state if the result is non-null -- preserve cached data on failure. Always reset `isStatsLoading` in a `finally` block so loading state never gets stuck.
- **Skeleton first-load pattern:** Use `showSkeleton = isLoading && !stats` -- render the skeleton loader only when no cached data exists. If stale data is available, show it during refresh rather than a full skeleton.
- **Zero-state fallback over empty fragment:** When an API returns null post-load, use `effectiveData = data ?? zeroStateObject` to render a zero-state display instead of returning an empty fragment or hiding the section. Pair with an `isZeroState(data)` guard to show the zero-state message.
- **Sentry integration:** `initSentry()` called in `main.tsx` before `createRoot`. Use `setSentryUser(userId, partnerId)` after auth, `clearSentryUser()` on sign-out. Only UUIDs reach Sentry -- PII is stripped in `beforeSend`. Config in `src/config/sentry.ts`.
- **ESLint store-access guardrails:** Components/hooks must NOT use `useAppStore.getState()` -- ESLint `no-restricted-properties` enforces this. Use `useAppStore` with a `useShallow` selector instead. Tests are exempt.
- **ESLint submission control enforcement:** Scripture submit/continue buttons must include a `disabled` prop -- ESLint `no-restricted-syntax` enforces via data-testid matching (`scripture-message-send-btn`, `scripture-reflection-continue`, `scripture-reflection-summary-continue`).
- **ESLint container import restrictions:** Scripture container components (`src/components/scripture-reading/containers/`) must NOT import from `@supabase/supabase-js` or service modules directly -- they must go through Zustand slice actions. Exception: `scriptureReadingService` is allowed.
- **Love notes rate limiting:** Client-side rate limit of 10 messages per minute enforced in NotesSlice.
- **Auth centralization (authSlice):** User identity (`userId`, `userEmail`, `isAuthenticated`) is centralized in `src/stores/slices/authSlice.ts`. Populated by `onAuthStateChange` in `App.tsx`, NOT persisted to localStorage. All slices read `userId` synchronously via `get().userId` instead of making async `supabase.auth.getUser()` calls. Use `setAuthUser(userId, email?)` after auth, `clearAuth()` on sign-out.
- **Typecheck command:** `npm run typecheck` runs `tsc -b --force` (project references build mode), NOT `tsc --noEmit`. The build command uses `tsc -p tsconfig.app.json` for the production build only.
- **react-window scroll-to-row timing:** When using `react-window` virtualised lists, wrap `scrollToRow()` / `scrollToItem()` in `requestAnimationFrame()` to defer one frame -- this allows react-window to complete its layout pass before scrolling. Direct calls will silently no-op or scroll to the wrong position.
- **Persist store identity:** The Zustand persist key is `my-love-storage` with schema `version: 0`. Test fixtures assume both -- changing either invalidates every stored fixture and every user's local state.
- **`window.__APP_STORE__` is non-production only:** Assigned in `useAppStore.ts` guarded by `import.meta.env.MODE !== 'production'`. It exists under `--mode test` (which is how Playwright runs the dev server) but is absent from production builds -- never rely on it in app code.
- **Tailwind v4 uses the JS-config bridge, not CSS-first:** `src/index.css` uses `@import 'tailwindcss'` (not `@tailwind` directives) followed by `@config '../tailwind.config.js'`, with `@layer base`/`@layer components` for custom classes. All theme extensions (sunset/coral/ocean/lavender/rose palettes, fonts, keyframes) live in `tailwind.config.js`, NOT in CSS `@theme` blocks. PostCSS runs `@tailwindcss/postcss` + `autoprefixer` (`postcss.config.js`).

### Together Mode / Realtime Architecture (Epic 4)

- **Client-side broadcasts only:** All Supabase Realtime broadcasts are sent from the client via `channel.send()` after a successful RPC call. Server-side `PERFORM realtime.send()` was removed because it doesn't work in local Docker. RPCs mutate DB state; the calling client broadcasts the event.
- **Broadcast hook singleton:** `useScriptureBroadcast` is the ONLY place that imports `supabase` for Broadcast -- do NOT import supabase for broadcast in components or other hooks. It wires `setBroadcastFn` so slice actions can call `channel.send()`.
- **Two separate channels:** `scripture-session:{sessionId}` (state events: partner_joined, state_updated, session_converted, lock_in_status_changed) and `scripture-presence:{sessionId}` (ephemeral position/heartbeat, 10s interval, 20s stale TTL). Never combine them.
- **Presence is ephemeral:** `useScripturePresence` returns `{ view, stepIndex, ts, isPartnerConnected }` -- purely local state, NOT stored in Zustand or IndexedDB. Stale presence (>20s) is silently dropped.
- **Reconnection pattern:** Both broadcast and presence hooks auto-retry on `CHANNEL_ERROR` or `CLOSED` by incrementing a `retryCount` state variable to trigger `useEffect` re-run. After re-subscribe, `loadSession` is called to resync state from DB.
- **Duplicate subscribe guard:** Hooks check `channelRef.current?.state === 'subscribed'` to handle React StrictMode double-mount.
- **Session roles:** `SessionRole = 'reader' | 'responder'` -- selected in lobby via `selectRole` action -> `scripture_select_role` RPC.
- **Phase guard RPCs:** Lobby RPCs (`scripture_select_role`, `scripture_toggle_ready`, `scripture_convert_to_solo`, `scripture_lock_in`, `scripture_undo_lock_in`, `scripture_end_session`) enforce phase guards to prevent invalid state transitions at the DB level.
- **RLS for private channels:** RLS policies gate access to `scripture-session:{session_id}` and `scripture-presence:{session_id}` broadcast channels -- only session participants can subscribe.

### Testing Rules

- **Unit tests (Vitest):** Environment is `happy-dom` -- setup file at `tests/setup.ts` mocks `fake-indexeddb`, `window.matchMedia`, `IntersectionObserver`, `ResizeObserver`
- **happy-dom `nodeName` shim is load-bearing -- do NOT remove it from `tests/setup.ts`:** happy-dom only implements `nodeName` on `Element.prototype`, so the `Node.prototype` getter returns `''` for elements. DOMPurify >= 3.4.8 reads the tag name through the cached `Node.prototype` getter (DOM-clobbering hardening), so under happy-dom every element resolves to tagName `''`, the `FORBID_CONTENTS` lookup misses, and text inside `<script>`/`<style>`/`<title>`/`<iframe>` is hoisted into sanitized output instead of dropped. This is a TEST-ENVIRONMENT ARTIFACT ONLY -- production is unaffected. The shim must live in `setupFiles` because DOMPurify caches the getter at module-evaluation time. Remove only once happy-dom defines `nodeName` on `Node.prototype`.
- **Test co-location:** Component tests go in `src/components/{feature}/__tests__/*.test.tsx`; service/util tests go in `tests/unit/`
- **E2E tests (Playwright):** Organized by feature area under `tests/e2e/{feature}/` (auth, home, mood, navigation, notes, offline, partner, photos, scripture) -- 28 spec files
- **`tests/e2e-archive/` is dead code:** Excluded from `tsconfig.test.json` and `tsconfig.tsr.json`, and not matched by any Playwright project. It is neither run nor typechecked -- never add or update tests there.
- **No TDD guard:** `tdd-guard-vitest` was removed (PR #222). No test-gating hooks remain in the Vitest setup.
- **API tests:** `tests/api/` directory for API-level tests (e.g., `scripture-lobby-4.1.spec.ts`). These use the `api` Playwright project, which runs without a browser context. There is no `setup` project -- auth is provisioned by `globalSetup`, so no project declares `dependencies`.
- **Integration tests:** `tests/integration/` directory uses the `integration` Playwright project.
- **E2E fixtures:** Always import `{ test, expect }` from `tests/support/merged-fixtures` -- never from `@playwright/test` directly
- **E2E auth setup:** Worker-isolated test users created via Supabase Admin API. `globalSetup` (`tests/support/auth/global-setup.ts`) provisions 24 isolated worker user-pairs. Auth state in `tests/.auth/worker-{n}.json`
- **Playwright artifacts are always-on:** `trace`, `screenshot`, and `video` are all set to `'on'` (not `'on-first-retry'`), so every local run writes a large `test-results/` tree. Do not interpret their presence as evidence of failure.
- **Playwright projects:** `chromium` (testDir `tests/e2e`), `api` (testDir `tests/api`, baseURL = `SUPABASE_URL`, no browser context), `integration` (testDir `tests/integration`). Root `testDir` is `./tests`.
- **CI parallelism:** 4 shards x 2 workers (`workers: process.env.CI ? 2 : undefined`). Local runs are unbounded. Shards split by test count, and the suite is duration-skewed, so shard timings differ even when counts match.
- **Coverage thresholds:** 25% minimum for lines, functions, branches, statements (V8 provider)
- **Test env vars:** Vitest config injects mock `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` -- do not use real credentials in tests
- **Test file relaxations:** Test files allow `@ts-ignore`, unused vars, empty patterns, non-standard hook usage -- see `eslint.config.js` test overrides
- **E2E local Supabase:** Playwright config auto-detects local Supabase via `supabase status -o env` and re-signs JWT tokens when GoTrue uses ES256 signing keys -- E2E tests require `supabase start` running locally
- **pgTAP test ID format:** Database tests follow `{story}-DB-{N03d}` format (e.g., `3.1-DB-001`, `3.1-DB-001a`) -- include the test ID in the `is()`/`ok()` message string so failures are traceable to stories
- **pgTAP RPC isolation requirement:** Any pgTAP test for a SECURITY DEFINER RPC touching couple data must verify both directions: (a) User A cannot see Couple B's data, and (b) both partners see their shared couple aggregate (partner B sees partner A's solo sessions). Use `tests.authenticate_as()` + `set_config('request.jwt.claims', ...)` to simulate different auth contexts within a single test transaction.
- **E2E zero-state removal rule:** Do NOT write E2E tests for zero-state UI rendering when the state requires a clean database and cannot be made parallel-safe without mocking. That scenario is covered by unit tests (component rendering) + pgTAP (RPC correctness). An E2E test with mocks is semantically identical to the unit test and adds no value.
- **Together Mode E2E fixture:** `tests/support/fixtures/together-mode.ts` provides the `togetherMode` fixture -- seeds users, links partners, navigates both to role selection. Tests receive `{ seed, partnerContext, partnerPage, sessionIdsToClean, uiSessionId }`.
- **E2E store manipulation:** Inject state with `page.evaluate(() => window.__APP_STORE__?.setState(...))`. See the `window.__APP_STORE__` rule under Framework-Specific Rules for its production guard.
- **E2E helper modules:** `tests/support/helpers/scripture-lobby.ts` exports timeout constants (`SESSION_CREATE_TIMEOUT_MS`, `REALTIME_SYNC_TIMEOUT_MS`, etc.) and response predicates (`isToggleReadyResponse`, `isSelectRoleResponse`, `isLockInResponse`). `tests/support/helpers/scripture-together.ts` exports `startTogetherSessionForRole`, `setupBothUsersInReading`, `jumpToStep`. Always import from these helpers instead of re-defining.
- **Hybrid sync pattern (3-layer wait):** After any mutation that changes server + client state, use all three layers: (1) NETWORK: `waitForScriptureRpc` / `interceptNetworkCall`, (2) STORE: `waitForScriptureStore`, (3) UI: `expect(locator).toBeVisible()`.
- **Priority tags:** E2E tests use `[P0]`/`[P1]`/`[P2]`/`[P3]` in test names for selective execution. P0 = critical path (run on every push), P1 = core features, P2/P3 = secondary/edge cases.
- **Burn-in for flaky detection:** `npm run test:burn-in` runs Playwright tests in a loop locally (default 10 iterations). CI behavior differs -- see Development Workflow Rules.

### Code Quality & Style Rules

- **No automated formatter -- match style by hand:** Prettier was removed (PR #221); there is no config file, no `format` script, and no Tailwind class-sorting plugin. Write: 2-space indent, single quotes (double in JSX), semicolons, ~100-char lines, ES5 trailing commas, always-parenthesized arrow params, LF endings. Never reformat lines you did not otherwise change, and do not re-add Prettier.
- **ESLint flat config:** `eslint.config.js` (not `.eslintrc`) -- uses `typescript-eslint` with recommended config
- **`scripts/**` is entirely unlinted:** It sits in ESLint's global `ignores`, alongside `dist/`, `dev-dist/`, `coverage/`, `**/*.config.{js,ts}`, and `src/types/database.types.ts`. A green `npm run lint` says nothing about the shell/mjs/cjs helpers in `scripts/`.
- **File naming:** PascalCase for components (`LoveNoteMessage.tsx`), camelCase for services/utils (`dateUtils.ts`), kebab-case for feature directories (`love-notes/`)
- **Slice naming:** `{domain}Slice.ts` (e.g., `messagesSlice.ts`, `moodSlice.ts`)
- **Story annotations:** Components reference Story/AC numbers in JSDoc headers (e.g., `Story 2.1: AC-2.1.1`)
- **Validation at boundaries:** Zod schemas in `src/validation/schemas.ts` validate data entering the app from Supabase -- validate in the service layer before IndexedDB writes
- **IndexedDB services:** All IndexedDB services extend `BaseIndexedDBService<T>` -- call `await service.init()` before use; implements initialization guard against concurrent setup
- **Per-feature ESLint overrides:** Scripture Reading files (`src/services/scriptureReadingService.ts`, `src/stores/slices/scriptureReadingSlice.ts`, `src/hooks/useScriptureBroadcast.ts`, `src/components/scripture-reading/**`) have their own strict `no-explicit-any` enforcement block in `eslint.config.js` -- new features with similar strictness requirements should follow this pattern
- **`data-testid` for metric cards:** Stats/metrics cards use `{feature}-stats-{metric}` naming (e.g., `scripture-stats-sessions`, `scripture-stats-last-completed`, `scripture-stats-avg-rating`). The wrapping section uses `{feature}-stats-section` and the skeleton uses `{feature}-stats-skeleton`.
- **Component subdirectory pattern:** Scripture reading uses `containers/` for data-connected components (e.g., `LobbyContainer.tsx`, `ReadingContainer.tsx`), `session/` for session lifecycle components (e.g., `Countdown.tsx`, `DisconnectionOverlay.tsx`, `LockInButton.tsx`), and `reading/` for presentational components (e.g., `PartnerPosition.tsx`, `RoleIndicator.tsx`).

### Development Workflow Rules

- **Branch naming:** `epic-N/description` (e.g., `epic-4/together-mode-synchronized-reading`) -- all epic work stays on feature branch until PR
- **Commit format:** `type(scope): description` -- types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `revert`
- **One story per commit:** Never mix Story 1.2 and Story 1.3 work in the same commit
- **Separate docs from code:** Documentation-only changes get their own commit
- **Sprint tracking separate:** Status YAML updates get their own `chore(sprint)` commit
- **Build command:** `tsc -p tsconfig.app.json && vite build` -- fnox decrypts env vars via `fnox exec -- npm run build`
- **Local lifecycle scripts:** `npm run dev:local` (`vite --mode test`, points at local Supabase), `npm run supabase:up` / `supabase:down`, `npm run perf:bundle-report`, `npm run test:ci-local` (full CI pipeline locally), `npm run deadcode`
- **Deploy target:** GitHub Pages at `/My-Love/` subpath -- `base` in vite config switches between `/My-Love/` (prod) and `/` (dev)
- **Pre-deploy check:** `npm run predeploy` runs build + smoke tests before deployment
- **CI workflows (9 total):** `test.yml`, `deploy.yml`, `supabase-migrations.yml`, `claude.yml`, `claude-code-review.yml`, `codeql.yml`, `dependency-review.yml`, `bundle-size.yml`, `lighthouse.yml`. The Gemini AI review/triage workflows and the CI-failure auto-fix workflow have been deleted -- do not reference them.
- **Test pipeline shape:** Stage 0 `changes` (change detection) gates everything; then `lint`, `unit-tests`, `db-tests`, `backend-tests` (matrix: integration | api), `e2e-tests` (4 shards) and `burn-in` all run IN PARALLEL off that gate; then `merge-reports`, then `test-summary`.
- **`test-summary` is the sole required status check:** It runs with `if: always()` and must never be gated by `paths-ignore` or skipped -- a required check that never runs is treated as pending and blocks the PR forever.
- **Docs-only PRs skip app stages:** Stage 0 marks a PR docs-only when every changed path matches `^docs/`, `^_bmad-output/`, or `\.md$`. It fails safe -- an empty diff or a non-PR event runs the full suite.
- **Do NOT reintroduce the E2E P0 gate:** It was deliberately deleted (PR #223). The 4 shards already include every `[P0]` test, so the gate added ~6.4 min of serial duplicate work to every green run.
- **Burn-in is narrow:** PRs to `main` only, only on E2E specs changed vs the base ref, 5 iterations. It detects changed specs BEFORE provisioning so no-op runs don't pay the ~2.5 min setup cost.
- **Composite actions:** `.github/actions/setup-supabase` and `.github/actions/setup-playwright-e2e` (caches browsers, `npm ci`, starts Supabase, installs Chromium). Reuse these instead of inlining setup steps.
- **Secrets in CI:** GitHub Secrets injected directly as environment variables -- fnox is NOT used in CI
- **Dependabot:** Weekly grouped PRs for npm (production/dev dependencies) and GitHub Actions updates

### Critical Don't-Miss Rules

- **No `process.env`:** This is a browser app -- use `import.meta.env.VITE_*` exclusively
- **No react-router:** The app uses Zustand `navigationSlice` for view switching -- adding a router would break the architecture
- **No workbox config in vite:** With `strategies: 'injectManifest'`, the `workbox` section in vite config is completely ignored -- all runtime caching goes in `src/sw.ts`
- **Supabase types are auto-generated:** `src/types/database.types.ts` is generated from Supabase schema -- never edit manually, regenerate with `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts`
- **Dual persistence model:** Small state -> localStorage (Zustand persist), large data -> IndexedDB (via `idb`), remote -> Supabase -- never store blobs in localStorage
- **Offline-first:** The app must work offline -- all features need graceful degradation when network is unavailable; use `isOnline()` checks and `SupabaseServiceError.isNetworkError`
- **GitHub Pages base path:** Production builds use `/My-Love/` as base -- all asset URLs must be relative or use the Vite `base` config; absolute paths will break on GH Pages
- **Secrets management (fnox/age):** Secrets are encrypted with age and stored inline in `fnox.toml` (committed to git). Decryption key is at `~/.age/key.txt` (never committed). Use `fnox exec -- <command>` locally. In CI, use GitHub Secrets directly. No `.env`, `.env.keys`, or `dotenvx` -- those are legacy patterns.
- **Scripture is the exception:** Unlike every other feature, scripture reading is online-first -- writes go to Supabase RPC first (throw on failure), IndexedDB is just a read cache. Do NOT apply the offline-first pattern to scripture code.
- **Don't mix validation layers:** `src/validation/schemas.ts` is for local data entering IndexedDB; `src/api/validation/supabaseSchemas.ts` is for validating API responses from Supabase. Using the wrong layer will cause silent data corruption or false validation failures.
- **E2E imports:** Always `import { test, expect } from 'tests/support/merged-fixtures'` in E2E tests -- importing directly from `@playwright/test` will miss custom fixtures and auth setup
- **SECURITY DEFINER RPC for couple-aggregate queries:** When a query must aggregate data across both partners in ways RLS can't express (e.g., user A seeing user B's solo sessions), use a `SECURITY DEFINER` RPC with `set search_path = ''`. Validate auth internally via `v_user_id := (select auth.uid())` and raise exception if null. Grant `execute` to `authenticated` role. Plain queries with RLS cannot satisfy this requirement.
- **CTE-based RPC aggregation:** RPCs that compute multiple aggregates from the same base dataset must use a single CTE to filter once, then compute all metrics via sub-selects. Never write 4+ sequential queries against the same filtered rows.
- **No server-side broadcasts:** `PERFORM realtime.send()` does NOT work in local Docker Supabase. All Realtime broadcast events must be sent client-side via `channel.send()` after a successful RPC call. This was explicitly removed in migration `20260301000200_remove_server_side_broadcasts.sql`.
- **Sentry PII rules:** Only UUIDs reach Sentry -- `beforeSend` strips `event.user.email` and `event.user.ip_address`. Use `setSentryUser(userId, partnerId)` after auth (sets user ID + partner tag). Never pass PII to Sentry tags or breadcrumbs.
- **ES256 JWT re-signing:** Supabase CLI v2.71.1+ defaults GoTrue to ES256 but `supabase status -o env` still outputs stale HS256-signed keys. `playwright.config.ts` re-signs tokens using the GoTrue ES256 private key extracted from the Docker container. If E2E auth fails with 401s, check that the re-signing logic in `playwright.config.ts` is running.
- **`playwright.config.ts` is deliberately Windows-hardened -- do not "clean up" its shell idioms:** (1) stderr is suppressed with `stdio: ['ignore', 'pipe', 'ignore']`, NOT `2>/dev/null` -- `execSync` shells through `cmd.exe` on Windows, which reads that redirect as a path and fails the command outright, dropping the whole block into the catch so no local Supabase env vars are ever set. (2) The `docker inspect --format` string uses DOUBLE quotes -- `cmd.exe` does not treat `'` as a quote character, so a single-quoted format string arrives as separate argv entries. Rewriting either to POSIX idiom makes every E2E test 401.
- **The Supabase env block in `playwright.config.ts` runs unconditionally:** It used to be guarded by `if (!process.env.SUPABASE_URL)`, but CI exports `SUPABASE_URL` before Playwright starts, so the guard skipped the block exactly where it mattered -- the `VITE_*` force-set never ran and every Realtime handshake was rejected with 403. `??=` still preserves externally-provided `SUPABASE_*` values; the `VITE_*` vars use plain `=` because fnox may inject production values and Vite gives `process.env` highest priority.
- **`npm run deadcode` output is pre-filtered:** `scripts/deadcode.sh` excludes known false positives (`React.lazy` dynamic-import chains, `database.types.ts`, `tests/setup.ts`, and bypassed barrel files). A reported hit is a candidate, not proof of dead code -- and its exclusion list is not a file inventory (it still names `validation/index.ts`, which was deleted in the dead-code sweep).
- **`tsconfig.tsr.json` is standalone:** It is NOT listed in `tsconfig.json`'s `references` and exists solely for the `tsr` dead-code run. `npm run typecheck` (`tsc -b --force`) does not build it.
- **TypeScript config composition:** Three tsconfig files composed via project references: `tsconfig.app.json` (src/), `tsconfig.node.json` (vite/vitest configs), `tsconfig.test.json` (tests, relaxed strictness). Build uses `tsc -p tsconfig.app.json`; typecheck uses `tsc -b --force` (validates all project references).
- **Vite manual chunk splitting:** Production builds split vendor code into named chunks (`vendor-react`, `vendor-supabase`, `vendor-state`, `vendor-animation`, `vendor-icons`) for optimal caching. New heavy dependencies should be added to an appropriate chunk in `vite.config.ts` `rollupOptions.output.manualChunks`.
- **`no-useless-catch` disabled:** ESLint's `no-useless-catch` is turned off project-wide -- catch-and-rethrow is allowed for debugging breakpoints and error boundary patterns.
- **Test JUnit output:** Vitest outputs JUnit XML to `test-results/vitest-junit.xml` for CI consumption.

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

Last Updated: 2026-07-25 (previous revision 2026-03-20)
