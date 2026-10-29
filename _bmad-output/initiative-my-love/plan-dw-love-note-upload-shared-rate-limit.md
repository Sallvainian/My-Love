---
title: 'Shared database counter for the love-note image upload rate limit'
type: 'bugfix'
ticket: ''
created: '2026-10-29'
status: 'done'
baseline_revision: '63152b33d7ebf6aaedf2d64e8df24f690981f474'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** DW-322 — `upload-love-note-image` keeps its 10-uploads-per-minute-per-user limit in `rateLimitStore`, a module-level `Map` (`supabase/functions/upload-love-note-image/handler.ts:113-115`), so each edge-runtime isolate counts separately and the limit is not enforced once one user's requests spread across isolates (measured locally under `policy = "per_worker"`).

**Approach:** Owner decision 2026-10-29: a shared database counter. A migration adds a per-user count table (RLS on, no client access) and one SECURITY DEFINER RPC that atomically checks and increments the caller's count in a one-minute window and reports `allowed` and `remaining`. The handler calls it through its injected client instead of the `Map`.

## Boundaries & Constraints

**Always:**
- Table and RPC in one new migration; `ENABLE ROW LEVEL SECURITY` there; no policies; `revoke all` on the table from `anon, authenticated` (service_role keeps its default grant, which the api spec uses to reset its own row).
- The RPC takes no arguments: the user is `auth.uid()`, the limit (10) and window (1 minute) are hard-coded in SQL so a caller cannot widen them via `/rest/v1/rpc`. A NULL `auth.uid()` raises `Authentication required`. `security definer`, `set search_path = ''`, `revoke execute … from public, anon`, `grant execute … to authenticated`.
- Atomic per user: lock the caller's row (`insert … on conflict do nothing`, then `select … for update`) so concurrent calls serialize. A refused call does not raise the count.
- Handler order unchanged: auth → limiter → body. The 429 still reads no body and keeps `Retry-After: 60`. `rateLimitRemaining` and `X-RateLimit-Remaining` come from the RPC's `remaining`.
- An RPC error or a reply without a boolean `allowed` fails closed: 500 `{ error: 'Rate limit check failed' }`, body never read, nothing written to Storage.
- `CONFIG.RATE_LIMIT_MAX_UPLOADS` / `RATE_LIMIT_WINDOW_MS` stay as mirrors of the SQL values (Retry-After and tests use them); say so in a comment.

**Never:**
- No `Map` or other in-memory fallback. No change to the client (`src/services/loveNoteImageService.ts`), the body-reading code, or `CONFIG.MAX_*`.
- Never hand-edit `src/types/database.types.ts`; never run `supabase db reset` (the local stack is shared) — apply with `supabase migration up`.
- Never edit `_bmad-output/initiative-my-love/deferred-work.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First upload | no row for user | row created, count 1; `allowed=true, remaining=9` | — |
| 10th in window | count 9, window < 1 min old | count 10; `allowed=true, remaining=0` | — |
| 11th in window | count 10 | count stays 10; `allowed=false, remaining=0`; handler 429 | Retry-After 60, body unread |
| Window expired | window started ≥ 1 min ago | window restarts at now, count 1; `remaining=9` | — |
| Two users | separate rows | counts independent | — |
| No session | `auth.uid()` NULL | raises `Authentication required` | anon has no EXECUTE either |
| RPC fails | `{ error }` or malformed data | handler 500 `Rate limit check failed` | no body read, no upload |

</intent-contract>

## Code Map

- `supabase/functions/upload-love-note-image/handler.ts` -- `UploadSupabaseClient` (~L96): add `rpc(fn: 'claim_love_note_upload')` returning `PromiseLike<{ data: Array<{ allowed: boolean; remaining: number }> | null; error: { message: string } | null }>`. Delete `rateLimitStore` (L113-115) and exported `checkRateLimit` (L162-181); replace the call at L313 with the RPC. Module header L13-14 ("per isolate") and L53-58 mention the limiter: reword only what the change makes false.
- `supabase/functions/upload-love-note-image/index.ts` -- unchanged except the "Rate limiting" bullet may say "shared, database-backed"; the real supabase-js client provides `rpc`.
- `supabase/functions/upload-love-note-image/handler.test.ts` -- `fakeClient` (L56-95): add `rpc` backed by a per-fake counter that mirrors the SQL (allowed while count < MAX), record calls, plus options `rpcError?: string` and `rpcData?: unknown`. Existing steps "eleventh upload" (L640) and "lowers by exactly one" (L590) must still pass unchanged.
- `supabase/migrations/20261029000000_love_note_upload_counts.sql` -- new. Template for header/grants: `20260926010000_my_pending_partner_requests.sql`; for table+RLS: `20260922000000_local_data_tables.sql`. Table `public.love_note_upload_counts (user_id uuid primary key references auth.users(id) on delete cascade, window_started_at timestamptz not null default now(), upload_count integer not null default 0 check (upload_count >= 0))`. Function `public.claim_love_note_upload() returns table (allowed boolean, remaining integer)`, plpgsql.
- `supabase/tests/database/18_function_execute_grants.sql` -- FN-GRANT-008 expected string (L105) gains `claim_love_note_upload` in alphabetical order; add an `ok(has_function_privilege(...))` FN-GRANT-012 and bump `plan(20)`.
- `supabase/tests/database/34_love_note_upload_counts.sql` -- new pgTAP file, helpers inline (copy from `32_my_pending_partner_requests.sql`).
- `src/types/database.types.ts` -- regenerate only.
- `tests/api/upload-love-note-image-limits.spec.ts` -- first test's comment (L118-123) describes the isolate `Map`; rewrite it to point at the new case, assertions unchanged. Add the wire case. Uses `request`/`apiRequest`, `authToken`, `supabaseAdmin`, `cleanup.defer`, `resolveOwnPair`, `pngBody`, `listOwnPrefix`, `removeObjects` already in the file. `fullyParallel` is on, but each live worker has its own account, so one user's counter is touched serially.
- Not touched: `tests/support/helpers/row-audit.ts` lists audited tables explicitly; the new table is not in it, and the wire case deletes its own counter row anyway.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261029000000_love_note_upload_counts.sql` -- create table, RLS, revokes, function, comments, grants per Boundaries; header explains DW-322, fixed-window semantics and that the function must be deployed after this migration -- the shared store
- [x] `supabase/tests/database/34_love_note_upload_counts.sql` -- assert: RLS on; zero policies on the table; `authenticated`/`anon` lack SELECT/INSERT/UPDATE/DELETE; function is SECURITY DEFINER; 10 calls give `remaining` 9..0 all allowed; 11th not allowed, remaining 0, stored count still 10; second user independent; after moving `window_started_at` back 61 s (as postgres) next call allowed with remaining 9; cleared JWT raises `Authentication required` -- pins the matrix in SQL
- [x] `supabase/tests/database/18_function_execute_grants.sql` -- grant list and new ok() -- pinned exact grant set
- [x] `supabase/functions/upload-love-note-image/handler.ts` -- per Code Map -- the fix
- [x] `supabase/functions/upload-love-note-image/handler.test.ts` -- fake `rpc`; new steps: RPC error → 500 `Rate limit check failed`, `pulls === 0`, no upload; malformed data (`[]`) → same 500; the RPC is called once per authenticated POST with name `claim_love_note_upload` and not at all for 401/405/OPTIONS; remaining in body/header equals the fake RPC's `remaining` -- unit cover
- [x] `src/types/database.types.ts` -- `supabase migration up` then regenerate with the AGENTS.md command -- generated types
- [x] `tests/api/upload-love-note-image-limits.spec.ts` -- new `[P0]` case: delete own `love_note_upload_counts` row via `supabaseAdmin` at start and in `cleanup.defer` (registered before uploading), together with removing created objects; upload 10 small PNGs, assert each 200 with `x-ratelimit-remaining` exactly 9..0; 11th is 429, `Retry-After` 60, `error` `Rate limit exceeded`; prefix grew by exactly 10 -- proves one counter across isolates

**Acceptance Criteria:**
- Given a user with no recent uploads and the function served with `policy = "per_worker"`, when they POST 11 valid images back to back over the wire, then the first 10 answer 200 with `X-RateLimit-Remaining` 9, 8, … 0 in order and the 11th answers 429 with `Retry-After: 60`, whichever isolates serve them.
- Given the limit is reached, when the user calls `/rest/v1/rpc/claim_love_note_upload` or tries to read/update/delete `love_note_upload_counts` with their own JWT, then the RPC answers `allowed=false` and the table is not readable or writable.
- Given the RPC errors, when the user uploads, then the response is 500 and nothing is stored.

## Design Notes

Fixed window per user, opened by the first counted upload. It can admit up to 20 in a 60 s span straddling a window edge; the old per-isolate sliding window admitted 10 × isolates. A sliding window would need a row per upload, which the decision ("keep each user's upload count") did not choose. `Retry-After: 60` stays a correct upper bound.

```sql
insert into public.love_note_upload_counts (user_id) values (v_uid) on conflict (user_id) do nothing;
select window_started_at, upload_count into v_start, v_count
  from public.love_note_upload_counts where user_id = v_uid for update;
if v_start <= now() - interval '1 minute' then v_start := now(); v_count := 0; end if;
```

Edge functions are not deployed by `deploy.yml`; the function deploy that ships this must follow `supabase db push`, or every upload answers 500.

## Implementation Notes

- Types: the installed CLI (2.122.0) emits unformatted output with generator changes unrelated to this migration (`ComputedFields`, view nullability), a 975-line diff. Regenerated instead with CI's pinned CLI (`npx supabase@2.118.0 gen types typescript --local`) and formatted with `oxfmt` (`semi: false`, `printWidth: 80`), which reproduces the committed file byte for byte except the new table and function, `Args: never` → `Record<PropertyKey, never>` on the two existing no-argument functions, and the trailing blank line.
- Handler also fails closed on a rejected `rpc` promise and on a non-numeric `remaining`, both mapped to the same 500.
- Wire case: against the old `Map` handler it passed when run alone (one isolate served all 11 requests) but failed 3/3 under the plan's `--repeat-each=3` run, where concurrent workers spread requests across isolates; with this change, 21/21 passed.

## Plan Change Log

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 1, false 1, maybe-false 0
- findings:
  - `[false]` `[reject]` `src/types/database.types.ts` was not made with the AGENTS.md command and flips `Args: never` to `Record<PropertyKey, never>` on two untouched functions, which "the next regeneration with the installed CLI will flip back" — the AGENTS.md command run with the installed CLI 2.122.0 also emits `Args: Record<PropertyKey, never>` for all three no-argument functions, so nothing flips back. The baseline's `Args: never` matches neither CLI. `npx tsc -b --force` exits 0, `partnerService.ts` included.
  - `[low]` `[patch]` `handler.test.ts`, step "each accepted upload by one user lowers the remaining allowance by exactly one": the comment "A fresh id, so no other step shares this user's window" became false, because the fake counts per `fakeClient()` closure, not per user id — the implementer reworded it to "This step's own fake client, so its rate-limit count is shared with no other step."; code and assertions unchanged.

## Verification

**Commands:**
- `supabase migration up` -- expected: applies only the new migration
- `supabase test db` -- expected: all files pass, including 18 and 34
- `deno test --no-lock supabase/functions/upload-love-note-image/` -- expected: all pass
- `npx tsc -b --force` (or `npm run typecheck`) and `npx eslint tests/api/upload-love-note-image-limits.spec.ts` -- expected: no new errors
- `supabase functions serve` in the background, then `npx playwright test --project=api tests/api/upload-love-note-image-limits.spec.ts --repeat-each=3` -- expected: all pass; stop the serve afterwards

## Auto Run Result

Status: built

**Summary:** DW-322 is fixed. `upload-love-note-image` no longer keeps its 10-per-minute-per-user limit in an isolate-local `Map`. Each user's count now lives in one row of `public.love_note_upload_counts`, and `public.claim_love_note_upload()` checks and increments it atomically. Every edge-runtime isolate therefore enforces the same limit. The handler calls the RPC with the caller's JWT, and an RPC error or a malformed reply fails closed with 500 before the body is read.

**Files changed:**
- `supabase/migrations/20261029000000_love_note_upload_counts.sql`: new count table, with RLS on, no policies and no client grants, plus the SECURITY DEFINER RPC. The RPC takes no arguments, has a fixed one-minute window, and locks the caller's row.
- `supabase/functions/upload-love-note-image/handler.ts`: `rateLimitStore`/`checkRateLimit` are replaced by `claimUpload` through `UploadSupabaseClient.rpc`. The module header and the `CONFIG` mirror comment are updated.
- `supabase/functions/upload-love-note-image/index.ts`: the feature bullet now says the limit is shared and database-backed.
- `supabase/functions/upload-love-note-image/handler.test.ts`: the fake `rpc` mirrors the SQL, and 12 new steps cover claim calls, 429, fail-closed 500s and the remaining count taken from the RPC.
- `supabase/tests/database/34_love_note_upload_counts.sql`: new pgTAP file with 21 assertions covering structure, privileges and the full I/O matrix.
- `supabase/tests/database/18_function_execute_grants.sql`: the pinned grant list gains `claim_love_note_upload`, and FN-GRANT-012 is added.
- `src/types/database.types.ts`: regenerated, with the new table and function added.
- `tests/api/upload-love-note-image-limits.spec.ts`: new `[P0]` wire case: ten uploads read 9..0 in order and the eleventh gets 429 with `Retry-After: 60`. The stale per-isolate comment in the first case is rewritten.
- `_bmad-output/initiative-my-love/plan-dw-love-note-upload-shared-rate-limit.md`: this plan.

**Review findings:** 1 patch applied (low: a stale test comment). 0 deferred. 1 rejected (false): the types `Args` drift claim, because the installed CLI produces the same `Record<PropertyKey, never>` form and the typecheck passes.

**Follow-up review recommended:** false. Patched counts: high 0, medium 0, low 1.

**Verification:**
- `supabase migration up --local`: applied only the new migration.
- `supabase test db`: 21 files, 407 tests, PASS. Re-run after the patch: PASS.
- `deno test --no-lock supabase/functions/upload-love-note-image/`: 5 passed (48 steps), 0 failed. Re-run after the patch: same.
- `npx tsc -b --force`: exit 0. `npx eslint tests/api/upload-love-note-image-limits.spec.ts`: clean. Both re-run after the patch.
- `supabase functions serve` plus `npx playwright test --project=api tests/api/upload-love-note-image-limits.spec.ts --repeat-each=3`: 21 passed, and the row audit found no leftover rows. The serve was stopped afterwards. It was not re-run after the patch, which only changed a comment in the Deno test file.

**Residual risks:**
- Deploy order: `deploy.yml` does not deploy Edge Functions. The hosted `upload-love-note-image` must be deployed only after `supabase db push` has applied this migration, or every upload answers 500 `Rate limit check failed`.
- Fixed-window semantics can admit up to 20 uploads in a 60 s span that straddles a window edge (see Design Notes).
- Refusals decided after the limiter (411/413/415) still use up a slot, as before; the difference is that the slot is now counted across isolates. The other uploading cases in the api spec share the pool account's count with the wire case. The wire case resets the count before and after itself, and all runs passed. A worker that ran the file's non-resetting upload cases more than 10 times within a minute could still see a 429 there.
- The wire case only shows the old bug under concurrency: against the old `Map` handler it passed when run alone. The pgTAP file is the concurrency-independent proof.
