<!-- bmad:context -->
<!-- Verified 2026-08-17 against d32973db. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## My Love

PWA for couples — daily messages, mood tracking, photos, love-notes chat, scripture reading, partner interactions. React 19, TypeScript, Vite, Tailwind v4, Zustand, Supabase; npm, Node 24. Deployed to GitHub Pages at https://sallvainian.github.io/My-Love/. There is no generated documentation tree. `_bmad-output/` holds the loop's specs and implementation/test artifacts; `implementation-artifacts/deferred-work.md` is the deferred-work ledger.

## Policy

- Never hand-edit `src/types/database.types.ts` or `mise.lock` — both generated. Regenerate types with `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts`.
- Never recreate a `docs/` tree and never re-add vendored tool docs — both were deleted deliberately so that no stale prose can hand an agent wrong context. Durable prose goes in this block.
- Two gitignore mismatches are deliberate; never reconcile them: `.gitignore:131-132` list `CLAUDE.md` and `AGENTS.md` while both are tracked — `git rm --cached` there would delete the repo's only instructions. Separately, `_bmad-output/` matches no gitignore rule at all and its specs and implementation/test artifacts are tracked (36 files); do not add one.
- Never add or repair specs in `tests/e2e-archive/` — frozen documentation, excluded from `tsconfig.test.json` and `tsconfig.tsr.json` and matched by no Playwright project; `tests/e2e-archive/README.md` records why each spec was archived. New E2E goes in `tests/e2e/`.
- Secrets are age-encrypted inline in the committed `fnox.toml`; never write a secret into `.env` or source. Local runs need `fnox exec -- <cmd>`; CI uses GitHub Secrets, not fnox.
- Branch as `<type>/<description>` (`feature/`, `fix/`, `chore/`, `docs/`, `ci/`). Commit as `type(scope): description` — feat, fix, test, docs, chore, refactor, revert, deps, ci, perf, style. Documentation-only changes get their own commit.
- Answer the question asked — "should I do X?" is a question, not a request to do X.
- Fix the cause rather than the symptom, and do not expand scope past it.
- For migrations, mass renames and restructures: propose a config-level alternative first, get approval, then execute step by step. Never delete a source file before its replacement is confirmed working.
- When fixing CI, check every failure mode — lint, typecheck, coverage, tests — before pushing.
- After opening a PR or pushing to one, arm the Claude-review waiter under **Running and verifying** before starting other work, then triage each finding against the actual code and report which hold; never edit or push in response to a review without approval.

## Where things are

- State: `src/stores/useAppStore.ts` composes 11 slices from `src/stores/slices/`; `appSlice` is composed first and owns `isLoading`/`error`/`__isHydrated`; `authSlice` owns `userId` and is not persisted.
- A new view is registered in five hand-maintained places: `ViewType` and `pathMap` in `navigationSlice.ts`, both URL ternaries in `App.tsx` (~174 and ~193), the `currentView ===` render chain (~636), and the `DESTINATIONS` list in `Navigation/NavigationTray.tsx`. Only `pathMap` is typechecked, so missing the rest still compiles, renders nothing, and resets to home on reload.
- E2E fixtures: import `{ test, expect }` from `tests/support/merged-fixtures.ts`, never from `@playwright/test`.

## Running and verifying

- Build and dev need decrypted secrets: `fnox exec -- npm run build`. A bare `npm run build` still exits 0 and writes `dist/`, but Vite inlines the env vars at build time and never evaluates the guard, so the artifact throws "Supabase configuration missing" in the browser.
- `npm run dev` is `scripts/dev-with-cleanup.sh` wrapping a bare `npx vite`, and `dev:raw` is plain `vite` — neither injects secrets, so both need the same `fnox exec --` prefix and both otherwise start a healthy-looking server whose app throws in the browser.
- `npm run test:smoke` only stats and string-matches files in `dist/`; it never loads the app, so it passes on exactly that secret-less artifact.
- Never run `npm run deploy` — the site ships from `.github/workflows/deploy.yml`, and `deploy`'s implicit `predeploy` runs a bare `npm run build` that would publish a secret-less bundle.
- E2E needs `supabase start` running first. `npm run dev:local` is `vite --mode test`: it reads the committed `.env.test`, points at local Supabase, and needs no secrets.
- `npm run typecheck` is `tsc -b --force`, building all three projects referenced from `tsconfig.json`. No vitest or Playwright script runs it — only `npm run test:ci-local` does — and CI runs it inside the `lint` job.
- `npm run lint` is passed `src tests scripts`, but `scripts/**` sits in `eslint.config.js` `ignores` — a green lint says nothing about `scripts/`.
- `npm run test:p1` runs P0 **and** P1, not P1 alone.
- Playwright sets `trace`, `screenshot` and `video` to `'on'`, so a large `test-results/` tree is normal and not evidence of failure.
- Wait for the Claude review by pinning on the commit you pushed, not on the check: poll `gh run list --branch <branch> --workflow claude-code-review.yml --json headSha,status,conclusion,databaseId` and match `headSha` against `git rev-parse HEAD`, until that run reaches `completed`. Reading the `claude-review` check instead is racy in a way an emptiness guard does not cover — until GitHub registers the new run, `gh pr checks` still returns the **previous** run's terminal bucket, and a stale `pass` satisfies both `-n` and `!= pending` on the first poll, delivering an already-actioned review as if it were new. Never trigger on a new `claude[bot]` comment either: `claude-code-review.yml` sets `track_progress: true` and `use_sticky_comment: true`, so the comment is created within seconds reading "Review in progress" and rewritten in place when the review finishes — watch for a new comment id and nothing ever fires.
- Read the review comment whole; never skim it for a verdict line or grep it for section headings. The body is AI-authored markdown whose shape drifts between runs — one round writes `### Suggestions`, the next writes `**Suggestions**` — so any extraction silently drops findings, and a review whose verdict reads "no blocking issues" can still carry Issues and Suggestions that hold up. After the run completes the sticky comment can briefly still show the previous round's text, so confirm the body contains the run id you waited on (every body embeds its own `/actions/runs/<id>` link).

## Conventions that differ from defaults

- Do not use the `@/` alias inside `src/` — `vite.config.ts` configures no alias, so it typechecks and then fails to resolve in a production build. Use relative paths; `@/` is for tests only.
- Navigation is `navigationSlice.currentView`; do not add react-router.
- Vite chunking lives in `rolldownOptions.output.codeSplitting.groups`, not `manualChunks`.
- There is no formatter — match surrounding style by hand and do not re-add Prettier.
- In IndexedDB services, reads return `null`/`[]` on failure and writes throw. The Supabase API layer is not consistent about this — `moodApi.fetchByUser` throws on a read while `photoService.getPhotos` returns `[]` — so check the function you are calling.
- After a mutation that changes both server and client state, wait on all three layers: the RPC response, then the Zustand store, then the UI assertion.

## Known pitfalls

- Any async store action that `set()`s after an `await` must first re-check `if (get().userId !== capturedUserId) return`. The guard is copy-pasted at 19 sites with no shared helper and coverage is uneven both ways: the `createSession` mutator has it, while `addMoodEntry`, `sendNote`, `uploadPhoto`, `selectRole` and every `messagesSlice` loader lack it.
- Sign-out clears account state only through `signedOutState()` in `authSlice.ts` — the store itself survives sign-out, so a new account-scoped field must be added there in the same commit. Five successive commits have widened this reset, and a partial reset leaks the previous couple's data on a shared device.
- `BaseIndexedDBService.getAll()` returns every account's rows. Scope by `userId` in the service, as `moodService.getAllForUser` does, before anything reaches UI state.
- IndexedDB schema changes go in `src/services/dbSchema.ts` alone: bump `DB_VERSION` and gate each branch on whether the store exists, never on `oldVersion < N`. Five modules open `my-love-db` and only the one that wins the versionchange transaction runs its callback, so a service with a private upgrade callback silently decides the schema for everyone.
- Route new Realtime work through `moodSyncService`'s refcounted registry or `sendEphemeralBroadcast()`; never call `supabase.channel()` directly. `useScriptureBroadcast`, `useScripturePresence`, `useRealtimeMessages` and `interactionService` still do, and carry the teardown bugs those two modules fixed.
- Never `PERFORM realtime.send()` inside an RPC — the local Docker Realtime service has no replication slot to deliver it. Return the snapshot and broadcast client-side, as `scriptureReadingSlice` does at 7 sites. Four migrations predating `20260301000200` still contain the removed pattern; do not copy them as templates.
- A retryable INSERT must reuse one client-generated key across attempts, backed by a DB `UNIQUE` constraint plus `.upsert(..., { onConflict, ignoreDuplicates: true })`. Copy `notesSlice.ts` or `photoService.ts`; there is no shared helper. A retryable Storage upload additionally needs an UPDATE policy on `storage.objects` for its bucket, because an overwrite is an UPDATE and without one every retry is rejected.
- Supabase policy work has three traps: a policy on `public.users` must not read `public.users`, which raises 42P17 on every query against it — go through `public.get_my_partner_id()`; `users.partner_id` changes only via the `accept_partner_request` RPC, never a client UPDATE; and every storage object path must start with the uploader's `auth.uid()`, which 11 policies key on.
- `supabase/tests/database/02_rls_policies.sql` and `16_photos_storage_update_policy.sql` assert the exact policy set with pgTAP `policies_are`, so adding, renaming or dropping a policy fails `supabase test db` inside a file the migration never mentions until those arrays are edited in the same change.
- E2E accounts come from the per-worker pool in `tests/support/auth/worker-pool.ts`, keyed on `TEST_WORKER_INDEX` — never `TEST_PARALLEL_INDEX`, which diverges from it on retry. A spec must not link or unlink partners, reset a password, or null a shared row at teardown; those rows belong to other workers.
- Do not remove the `nodeName` shim from `tests/setup.ts` — without it DOMPurify sees every tag as `''` under happy-dom and text inside `<script>`/`<style>` survives sanitization. It must stay in `setupFiles`.
- Do not rewrite the shell idioms in `playwright.config.ts` to POSIX — the `stdio` stderr suppression and the double-quoted `docker inspect --format` are required by `cmd.exe`, and without them the whole env block falls into its catch and no local Supabase vars are ever set. Separately, its Supabase env block must stay unguarded: re-guarding it drops the dev server onto the `.env.test` placeholder key and every Realtime handshake is rejected with 403.
- Three data models, so check which one a feature uses before writing data-layer code: scripture reading is server-authoritative with IndexedDB as a read cache; photos, love notes and partner interactions are Supabase-only; only mood and daily/custom messages are offline-first with IndexedDB primary.

<!-- /bmad:context -->
