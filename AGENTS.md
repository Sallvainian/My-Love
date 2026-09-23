<!-- bmad:context -->
<!-- Verified 2026-09-15 against 04d594f0. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## My Love

PWA for couples — daily messages, mood tracking, photos, love-notes chat, and partner interactions. React 19, TypeScript, Vite, Tailwind v4, Zustand, Supabase; npm, Node 24. Deployed to Cloudflare Workers at https://my-love.sallvain.workers.dev/ (an assets-only Worker defined in `wrangler.jsonc`). There is no generated documentation tree. `_bmad-output/` holds the loop's specs and implementation/test artifacts; `implementation-artifacts/deferred-work.md` is the deferred-work ledger.

## Policy

- Never hand-edit `src/types/database.types.ts` or `mise.lock` — both generated. Regenerate types with `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts`.
- Never recreate a `docs/` tree and never re-add vendored tool docs — both were deleted deliberately so that no stale prose can hand an agent wrong context. Durable prose goes in this file.
- The repo is public. Never write an email address, query output holding personal data, or a real credential into `_bmad-output/`, `.bmad-loop/` or a commit message; refer to people by role. Two real addresses already sit in history at 69a563ee.
- One gitignore mismatch is deliberate; never reconcile it: `.gitignore` lists `CLAUDE.md` and `AGENTS.md` while both are tracked — `git rm --cached` there would delete the repo's only instructions (a plain `git check-ignore` reports tracked files as not ignored; `--no-index` shows the match).
- The scripture-reading feature has been removed from the application (`_bmad-output/specs/spec-remove-scripture-feature/`). Do not re-add it, and do not copy leftover schema or IndexedDB scripture modules as templates.
- Never add or repair specs in `tests/e2e-archive/` — frozen documentation, excluded from `tsconfig.test.json` and `tsconfig.tsr.json` and matched by no Playwright project; its `README.md` records the reason for most of them. New E2E goes in `tests/e2e/`.
- Secrets are age-encrypted inline in the committed `fnox.toml`; never write a secret into `.env` or source. Local runs need `fnox exec -- <cmd>`; CI uses GitHub Secrets, not fnox.
- Branch as `<type>/<description>` (`feature/`, `fix/`, `chore/`, `docs/`, `ci/`). Commit as `type(scope): description` — feat, fix, test, docs, chore, refactor, revert, deps, ci, perf, style. Documentation-only changes get their own commit. A follow-up to an open PR goes on that PR's branch, never a new branch or PR.
- Answer the question asked — "should I do X?" is a question, not a request to do X.
- Fix the cause rather than the symptom, and do not expand scope past it.
- For migrations, mass renames and restructures: propose a config-level alternative first, get approval, then execute step by step. Never delete a source file before its replacement is confirmed working.
- When fixing CI, check every failure mode — lint, typecheck, coverage, tests — before pushing.
- Sallvain starts every bmad-loop run and sweep. Prepare the branch and hand over the command; never launch one yourself.
- Keep loop story specs short and split large ones — `.bmad-loop/policy.toml` budgets 2M tokens per story, and long specs have cost 2.8–7.6M each.

## Where things are

- State: `src/stores/useAppStore.ts` composes 11 slices from `src/stores/slices/`; `appSlice` is composed first and owns `isLoading`/`error`/`__isHydrated`; `authSlice` owns `userId` and `authSessionVersion` and is not persisted.
- A new view is registered in five hand-maintained places: `ViewType` and `pathMap` in `navigationSlice.ts`, both URL ternaries in `App.tsx` (~189 and ~208), the `currentView ===` render chain (home ~715, lazy views ~786-797), and the `DESTINATIONS` list in `Navigation/AppNavigation.tsx` (the bottom dock; Settings is the top-bar gear, not a dock item). Only `pathMap` is typechecked, so missing the rest still compiles, renders nothing, and resets to home on reload.
- E2E fixtures: import `{ test, expect }` from `tests/support/merged-fixtures.ts`, never from `@playwright/test`.
- Loop runs live in `.bmad-loop/runs/<id>/`, finished ones in `.bmad-loop/archive/`; both are gitignored, so a deleted run is unrecoverable. Never delete a run directory — one deletion took stories 1-5 of an active run with it; move it to `archive/` instead.

## Running and verifying

- Build and dev need decrypted secrets: `fnox exec -- npm run build`. A bare `npm run build` still exits 0 and writes `dist/`, but Vite inlines the env vars at build time and never evaluates the guard, so the artifact throws "Supabase configuration missing" in the browser.
- `npm run dev` is `scripts/dev-with-cleanup.sh` wrapping a bare `npx vite`, and `dev:raw` is plain `vite` — neither injects secrets, so both need the same `fnox exec --` prefix and both otherwise start a healthy-looking server whose app throws in the browser.
- `npm run test:smoke` only stats and string-matches files in `dist/`; it never loads the app, so it passes on exactly that secret-less artifact.
- E2E needs `supabase start` running first, on CLI 2.117.0 or newer — older releases bundle a Realtime without the `httpSend` route, so `tests/api/couple-broadcast-authorization.spec.ts` fails with a 404 that reads like an app bug. `npm run dev:local` is `vite --mode test`: it reads the committed `.env.test`, points at local Supabase, and needs no secrets.
- A spec that calls an Edge Function belongs in the `api` Playwright project — CI starts `edge-runtime` only for that leg (`needs-edge-functions` in `test.yml`), and elsewhere Kong answers 503 from `/functions/v1/…`, which is a missing service, not a broken function.
- `npm run typecheck` is `tsc -b --force`, building the three projects referenced from `tsconfig.json`. No test script runs it — `npm run test:ci-local` and CI's `lint` job do.
- `npm run lint` is passed `src tests scripts`, but `scripts/**` sits in `eslint.config.js` `ignores` — a green lint says nothing about `scripts/`.
- `npm run test:p1` runs P0 **and** P1, not P1 alone.
- Since `fa5ed66b`, `test.yml` gates every stage on the paths a PR changed and `Test Summary` is the only required check, so a green PR proves only that the gated-in stages ran; read the `changes` job outputs before treating green as coverage. Pushes to main and the weekly cron still run everything.
- Playwright sets `trace`, `screenshot` and `video` to `'on'`, so a large `test-results/` tree is normal and not evidence of failure.
- Read the review comment whole; never skim it for a verdict line or grep it for section headings. The body is AI-authored markdown whose shape drifts between runs — one round writes `### Suggestions`, the next writes `**Suggestions**` — so any extraction silently drops findings, and a review whose verdict reads "no blocking issues" can still carry Issues and Suggestions that hold up. After the run completes the sticky comment can briefly still show the previous round's text, so confirm the body contains the run id you waited on (every body embeds its own `/actions/runs/<id>` link).
- Rotate the Claude bot test login by updating `CLAUDE_BOT_PASSWORD` in `fnox.toml`, then `fnox exec -- node scripts/provision-claude-bot.mjs`; no migration seeds that password any more.

## Conventions that differ from defaults

- Do not use the `@/` alias inside `src/` — `vite.config.ts` configures no alias, so it typechecks and then fails to resolve in a production build. Use relative paths; `@/` is for tests only.
- Navigation is `navigationSlice.currentView`; do not add react-router.
- Vite chunking lives in `rolldownOptions.output.codeSplitting.groups`, not `manualChunks`.
- There is no formatter — match surrounding style by hand and do not re-add Prettier.
- In IndexedDB services, reads return `null`/`[]` on failure and writes throw. The Supabase API layer is not consistent about this — `moodApi.fetchByUser` and `photoService.getPhotos` throw on a read while `partnerService.getPartner` returns `null` — so check the function you are calling.
- After a mutation that changes both server and client state, wait on all three layers: the RPC response, then the Zustand store, then the UI assertion.
- Parse a `YYYY-MM-DD` string with `parseEventDate` from `src/services/eventsService.ts`, never `new Date(string)` — the date-only form parses as UTC midnight and shows the previous day west of UTC.

## Known pitfalls

- Any async store action that `set()`s after an `await` must capture `{ userId, authSessionVersion }` first and re-check both before writing — `authSessionVersion` is bumped on every sign-out, so a same-account re-login is caught too. The pair is copy-pasted at 26 sites with no shared helper, and `sendNote`'s image branch still lacks it.
- Sign-out discards account state only through `discardAccountState()` in `authSlice.ts`, which spreads `signedOutState()` — the store itself survives sign-out, so a new account-scoped field must be added to `signedOutState()` in the same commit; a partial reset leaks the previous couple's data on a shared device.
- `BaseIndexedDBService.getAll()` returns every account's rows. Scope by `userId` in the service, as `moodService.getAllForUser` does, before anything reaches UI state.
- IndexedDB schema changes go in `src/services/dbSchema.ts` alone: bump `DB_VERSION` and gate each branch on whether the store exists, never on `oldVersion < N`. Four modules open `my-love-db` and all delegate to `upgradeDb`; only the one that wins the versionchange transaction runs its callback, so a private upgrade callback anywhere would silently decide the schema for everyone.
- Route new Realtime work through `moodSyncService`'s refcounted registry or `sendEphemeralBroadcast()`; never call `supabase.channel()` directly. `useRealtimeMessages` and `interactionService` still do, and carry the teardown bugs those two modules fixed.
- A partner or session lookup that answers `null` for both "unlinked / signed out" and "the read failed" must never gate Realtime delivery or clear a snapshot: use `lookupPartnerId()`'s status from `supabaseClient.ts`, and let only a successful read overwrite a snapshot — eight fixes in September 2026 chased this one bug across mood, notes and interactions, because `SUBSCRIBED` fires once and nothing re-arms a muted channel.
- Never `PERFORM realtime.send()` inside an RPC — the local Docker Realtime service has no replication slot to deliver it. Return the snapshot and broadcast client-side with `sendEphemeralBroadcast()`, as `notesSlice.sendNote` and `moodSyncService` do. Four scripture migrations predating `20260301000200` still contain the removed pattern; do not copy them as templates.
- A retryable INSERT must reuse one client-generated key across attempts, backed by a DB `UNIQUE` constraint plus `.upsert(..., { onConflict, ignoreDuplicates: true })`. Copy `notesSlice.ts` or `photoService.ts`; there is no shared helper. A retryable Storage upload additionally needs an UPDATE policy on `storage.objects` for its bucket, because an overwrite is an UPDATE and without one every retry is rejected.
- Supabase policy work has four traps: a policy on `public.users` must not read `public.users`, which raises 42P17 on every query against it — go through `public.get_my_partner_id()`; `users.partner_id` changes only via the `accept_partner_request` RPC, never a client UPDATE; every storage object path must start with the uploader's `auth.uid()`, which 7 of the 9 `storage.objects` policies key on; and an UPDATE policy must state `WITH CHECK` explicitly, because Postgres reuses `USING` as the check and this repo was bitten twice.
- A new public table must `ENABLE ROW LEVEL SECURITY` in its creating migration — `20260725170000_grant_api_roles_on_public.sql` grants ALL on future tables to `anon` and `authenticated`, so a table without RLS is open to every user. Declare policies that call `get_my_partner_id()` as `TO authenticated`.
- Seven files under `supabase/tests/database/` assert exact policy sets with pgTAP `policies_are`, so adding, renaming or dropping a policy fails `supabase test db` in a file the migration never mentions until those arrays are edited in the same change. Declare pgTAP helpers inline — `00_helpers.sql` rolls back before later files run.
- E2E accounts come from the per-worker pool in `tests/support/auth/worker-pool.ts`, keyed on `TEST_WORKER_INDEX` — never `TEST_PARALLEL_INDEX`, which diverges from it on retry. A spec must not link or unlink partners, reset a password, or null a shared row at teardown; those rows belong to other workers.
- Do not remove the `nodeName` shim from `tests/setup.ts` — without it DOMPurify sees every tag as `''` under happy-dom and text inside `<script>`/`<style>` survives sanitization. It must stay in `setupFiles`.
- Do not rewrite the shell idioms in `playwright.config.ts` to POSIX — the `stdio` stderr suppression and the double-quoted `docker inspect --format` are required by `cmd.exe`, and without them the whole env block falls into its catch and no local Supabase vars are ever set. Separately, its Supabase env block must stay unguarded: re-guarding it drops the dev server onto the `.env.test` placeholder key and every Realtime handshake is rejected with 403.
- Check which data model a feature uses before writing data-layer code: photos, love notes and partner interactions are Supabase-only, while mood and the bundled daily messages are offline-first with IndexedDB primary.

<!-- /bmad:context -->

## Maintained by hand

These rules sit outside the generated block so a context refresh never rewrites them. Edit them directly.

- `_bmad-output/` is gitignored and untracked. Loop worktrees get the specs from `worktree_seed = [".claude/skills", "_bmad-output/specs"]` in the local, gitignored `.bmad-loop/policy.toml`; the loop seeds and carries back the ledger and sprint board itself. Never track a file under `_bmad-output/specs/` — a seeded directory is skipped whole once any child is tracked, and every worktree then fails with "no stories.yaml found".
- The bottom dock is `fixed` at `z-40`, so layout cannot see it. Anything anchored to the bottom of the screen, or sized to the full viewport height, must reserve `--dock-clearance` (defined in `src/index.css`), as `<main>` in `App.tsx` and `LoveNotes.tsx` do; a hard-coded height ends up under the dock and nothing typechecks it. The dock is full at five `DESTINATIONS`, with no room on a phone for a sixth, so a new view needs a design decision about where it lives, not a sixth dock item.
- The site ships from `.github/workflows/deploy.yml`, which applies migrations before it deploys. `npx wrangler deploy` uploads whatever is in `dist/` without building, so deploy by hand only right after `fnox exec -- npm run build` — a bare build is a secret-less bundle. Never rename the Worker in `wrangler.jsonc`: the name is part of the origin, and a new origin strands every device's IndexedDB and localStorage.
