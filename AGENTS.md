<!-- bmad:context -->
<!-- Verified 2026-08-17 against b2d0dcc1. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## My Love

PWA for couples — daily messages, mood tracking, photos, love-notes chat, scripture reading, partner interactions. React 19, TypeScript, Vite, Tailwind v4, Zustand, Supabase; npm, Node 24. Deployed to GitHub Pages at https://sallvainian.github.io/My-Love/. There is no generated documentation tree: this file is the only prose description of the project, and the code is the only other source. `_bmad-output/` holds one file, `implementation-artifacts/deferred-work.md`.

## Policy

- Never hand-edit `src/types/database.types.ts` or `mise.lock` — both generated. Regenerate types with `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts`.
- Never add or repair specs in `tests/e2e-archive/` — frozen documentation, excluded from `tsconfig.test.json` and `tsconfig.tsr.json` and matched by no Playwright project. New E2E goes in `tests/e2e/`.
- Secrets are age-encrypted inline in the committed `fnox.toml`; never write a secret into `.env` or source. Local runs need `fnox exec -- <cmd>`; CI uses GitHub Secrets, not fnox.
- Branch as `<type>/<description>` (`feature/`, `fix/`, `chore/`, `docs/`, `ci/`). Commit as `type(scope): description` — feat, fix, test, docs, chore, refactor, revert, deps, ci, perf, style. Documentation-only changes get their own commit.
- Answer the question asked — "should I do X?" is a question, not a request to do X.
- Fix the cause rather than the symptom, and do not expand scope past it.
- For migrations, mass renames and restructures: propose a config-level alternative first, get approval, then execute step by step. Never delete a source file before its replacement is confirmed working.
- When fixing CI, check every failure mode — lint, typecheck, coverage, tests — before pushing.

## Where things are

- State: `src/stores/useAppStore.ts` composes 11 slices from `src/stores/slices/`; `appSlice` is composed first and owns `isLoading`/`error`/`__isHydrated`; `authSlice` owns `userId` and is not persisted.
- E2E fixtures: import `{ test, expect }` from `tests/support/merged-fixtures.ts`, never from `@playwright/test`.

## Running and verifying

- Build and dev need decrypted secrets: `fnox exec -- npm run build`. A bare `npm run build` still exits 0 and writes `dist/`, but Vite inlines the env vars at build time and never evaluates the guard, so the artifact throws "Supabase configuration missing" in the browser.
- E2E needs `supabase start` running first.
- `npm run typecheck` is `tsc -b --force`; no test script covers it, and CI runs it inside the `lint` job.
- `npm run lint` is passed `src tests scripts`, but `scripts/**` sits in `eslint.config.js` `ignores` — a green lint says nothing about `scripts/`.
- `npm run test:p1` runs P0 **and** P1, not P1 alone.
- Playwright sets `trace`, `screenshot` and `video` to `'on'`, so a large `test-results/` tree is normal and not evidence of failure.

## Conventions that differ from defaults

- Import Zod from `zod/v4`, never bare `'zod'` — bare resolves to the v3-compatibility surface.
- Do not use the `@/` alias inside `src/` — `vite.config.ts` configures no alias, so it typechecks and then fails to resolve in a production build. Use relative paths; `@/` is for tests only.
- Navigation is `navigationSlice.currentView`; do not add react-router.
- Vite chunking lives in `rolldownOptions.output.codeSplitting.groups`, not `manualChunks`.
- There is no formatter — match surrounding style by hand and do not re-add Prettier.
- In IndexedDB services, reads return `null`/`[]` on failure and writes throw. The Supabase API layer is not consistent about this — `moodApi.fetchByUser` throws on a read while `photoService.getPhotos` returns `[]` — so check the function you are calling.
- After a mutation that changes both server and client state, wait on all three layers: the RPC response, then the Zustand store, then the UI assertion.

## Known pitfalls

- Any async store action that `set()`s after an `await` must first re-check `if (get().userId !== capturedUserId) return`. The guard is copy-pasted at 19 sites with no shared helper and covers the loaders only — mutators such as `addMoodEntry`, `sendNote`, `uploadPhoto` and `selectRole` still lack it.
- `BaseIndexedDBService.getAll()` returns every account's rows. Scope by `userId` in the service, as `moodService.getAllForUser` does, before anything reaches UI state.
- Route new Realtime work through `moodSyncService`'s refcounted registry or `sendEphemeralBroadcast()`; never call `supabase.channel()` directly. `useScriptureBroadcast`, `useScripturePresence`, `useRealtimeMessages` and `interactionService` still do, and carry the teardown bugs those two modules fixed.
- A retryable INSERT must reuse one client-generated key across attempts, backed by a DB `UNIQUE` constraint plus `.upsert(..., { onConflict, ignoreDuplicates: true })`. Copy `notesSlice.ts` or `photoService.ts`; there is no shared helper.
- Do not remove the `nodeName` shim from `tests/setup.ts` — without it DOMPurify sees every tag as `''` under happy-dom and text inside `<script>`/`<style>` survives sanitization. It must stay in `setupFiles`.
- Do not rewrite the shell idioms in `playwright.config.ts` to POSIX — the `stdio` stderr suppression and the double-quoted `docker inspect --format` are required by `cmd.exe`, and every E2E test 401s without them. Its Supabase env block must stay unguarded.
- Three data models, so check which one a feature uses before writing data-layer code: scripture reading is online-first (Supabase RPC is the source of truth, IndexedDB a read cache), photos is Supabase-only (`photoService` never touches IndexedDB), and the rest are offline-first with IndexedDB primary.

<!-- /bmad:context -->
