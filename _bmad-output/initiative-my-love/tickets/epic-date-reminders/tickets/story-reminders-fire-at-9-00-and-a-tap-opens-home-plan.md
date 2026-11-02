---
title: 'Reminders fire at 9:00 and a tap opens Home'
type: 'bugfix'
ticket: '8'
created: '2026-11-01'
status: 'built'
baseline_revision: '6e84b584a322b26784c7b7795ff0c577e62e992f'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- **The story's purpose.** Stories 7, 1, 6, 2 and 3 proved what the shell schedules, but not that it fires. Still unchecked:
  - reminders fire at 9:00, in the non-love-note group, and stack with pushes;
  - a tap opens Home;
  - the soonest-64 cut moves on once the earliest reminders pass (R1, R2, R3, R5, R7, R11).
- **The defect found.** On the first cold-start tap (gateway down, access token expired), the shell showed the sign-in screen and `deleteAccountData()` ran: 0 reminders were left pending.
  - `getSession` (`src/api/auth/sessionService.ts:11-13`) maps the SDK's `AuthRetryableFetchError` to `null`.
  - `App.tsx:256-257` then calls `clearAuth()`, and the owner marker deletes every local copy and cancels the reminders.
  - The listener's `INITIAL_SESSION` with a `null` session does the same (`App.tsx:365`).
  - The SDK still holds the session in storage. Any phone cold-started offline more than an hour after its last refresh loses its sign-in and its offline data. This predates the epic.

**Approach:**
- **Fix.** An unreachable server is not a sign-out. When the SDK reports a retryable fetch error, or `INITIAL_SESSION` carries no session, while its storage key still holds a session, the app uses that stored session. The SDK renews it once the server answers. Only an empty store is "signed out".
- **Checks.** On the iPhone Duo simulator, with the shell built from this branch, the session moves the Mac clock with `sudo date` to just before a 9:00 and the person taps reminders.

**Decisions (owner, 2026-11-01):**
- The fix is made in this story, on `loop/integration`.
- The account stays signed in until the person signs out, the app is uninstalled, or the server rejects the refresh token. Losing the network never signs anyone out.
- (Review loop 1) While the app runs on a stored session the SDK cannot use, no data request leaves without a user token. One guard sits in the client's `global.fetch`. It never blocks the auth server's own requests (`/auth/v1/`: sign-in, token refresh, password reset), and a test proves a token refresh goes through while the guard is active.
- (Review loop 1) Signing out while the server is unreachable signs out on this device: the stored session is removed and the usual sign-out cleanup runs. The server-side session is left until it expires.
- (Review loop 1) The review is `thorough`, because this changes sign-in and sign-out code.
- "Network off" here means the local gateway is stopped (`docker stop supabase_kong_My-Love`), never the Mac's Wi-Fi. The Mac clock is moved only for checks that need a reminder to fire, and it is returned to network time straight after each.

## Boundaries & Constraints

**Always:**
- Only an empty SDK session store counts as signed out. The SDK clears its store before it emits `SIGNED_OUT`, and on a non-retryable refresh failure.
- The storage key is the SDK's default (`sb-<first hostname label>-auth-token`), so existing sessions keep working.
- AGENTS.md's null-vs-failed rule (Known pitfalls) applies.
- A request to the project URL outside `/auth/v1/` that carries no user token (no `Authorization` header, or `Bearer <publishable key>`) fails like a network error while a stored session exists. Callers then keep their copies under the failed-read rules.

**Never:**
- Turn off the Mac's network.
- Change `deleteAccountData()`, the owner-marker logic or the reminder code to work around the defect.
- Touch the 103 test files that mock `supabaseClient`.
- Set `refresh_token`/JWT expiry.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline cold start, token expired | Stored session, refresh throws `AuthRetryableFetchError` | Stored session returned; app opens signed in; no data deleted; reminders kept | Warning logged |
| Server back | Same, then the gateway answers | SDK renews the token (`TOKEN_REFRESHED`); app continues | none |
| True sign-out | Storage key empty | `null`; app clears auth as today | none |
| Revoked refresh token | Non-retryable refresh error; SDK clears storage | `null`; sign-in screen | none |
| Corrupt stored value | Unparsable JSON or missing `user.id`/`access_token` | `null` | Caught; no throw |
| Data request without a user token | Stored session present; SDK has no live session (refresh cooldown, or GoTrue down) | Request rejected before sending, like `fetch` failing; no copy overwritten | `TypeError('Failed to fetch')` |
| Auth request while guard active | Same state; `POST /auth/v1/token?grant_type=refresh_token` | Passes through to `fetch` unchanged | none |
| Data request with a user token | `Authorization: Bearer <user JWT>` | Passes through | none |
| Data request, nobody signed in | No stored session | Passes through (anon is legitimate) | none |
| Offline sign-out on a stored session | `signOut()` returns `AuthRetryableFetchError` | Stored key removed, `signOut({ scope: 'local' })` emits `SIGNED_OUT`, cleanup runs, login screen | none |
| Online sign-out | `signOut()` succeeds | Unchanged | none |

</frozen-after-approval>

## Code Map

- **Work to keep.** The first implementation is saved as a patch: `/private/tmp/claude-501/-Users-sallvain-Projects-My-Love/01446133-fab0-4353-8e06-ff5fd8056ab8/scratchpad/story-4-8-fix-v1.patch`. It was reviewed and correct as far as it went. Start from it: `git apply` it, then make the changes below.
  - **KEEP:**
    - `readStoredSession`'s shape checks.
    - The retryable branch in `getSession`.
    - The null-`INITIAL_SESSION` substitution.
    - The `storageKey` comment.
    - The 20 tests in `sessionService.test.ts`.
- `src/api/authStorage.ts` (new). It replaces v1's `authStorageKey.ts`, and holds everything that must not import `supabaseClient`, because `supabaseClient` imports it:
  - `AUTH_STORAGE_KEY`, built as the SDK builds its default (`supabase-js/dist/index.mjs:651`);
  - `readStoredSession()`, moved here from `sessionService`;
  - `createSessionGuardedFetch({ supabaseUrl, supabaseKey, fetchImpl })`, which returns a `fetch`. A request has no user token when its `Authorization` header is missing or equals `Bearer ${supabaseKey}`. The guard throws `new TypeError('Failed to fetch')` only when the URL is under `supabaseUrl`, the path does not start with `/auth/v1/`, the request has no user token, and `readStoredSession()` is non-null. Every other request goes to `fetchImpl` unchanged.

  Headers can arrive as `init.headers` (an object or `Headers`) or on a `Request` input. Read both.
- `src/api/supabaseClient.ts`. Set `auth.storageKey: AUTH_STORAGE_KEY`, and `global: { fetch: createSessionGuardedFetch({ supabaseUrl, supabaseKey: supabaseAnonKey, fetchImpl: (...a) => fetch(...a) }) }`.
  - **Why `global.fetch` reaches everything:** supabase-js passes it to the auth client raw (`index.mjs:665`) and wraps it in `fetchWithAuth` for data calls (`:291-303`). That wrapper sets `Bearer <key>` when `getSession` has no session, and nothing here sets `omitApiKeyAsBearer`.
  - **Why the guard is needed:** during `REFRESH_FAILURE_COOLDOWN_MS` (60 s after a failed refresh, `GoTrueClient.js:4208-4212`), or while GoTrue is down, data calls go out as anon and RLS answers `[]`.
  - **Don't add an export to `supabaseClient`.** 103 test files mock it whole.
- `src/api/auth/sessionService.ts`. Import `readStoredSession` from `../authStorage`; otherwise it stays as in v1.
- `src/api/auth/actionService.ts:82` (`signOut`). When `supabase.auth.signOut()` returns an error for which `isAuthRetryableFetchError` is true:
  1. remove `AUTH_STORAGE_KEY` from `localStorage`;
  2. call `supabase.auth.signOut({ scope: 'local' })`. With no stored session, `_signOut` skips the server and runs `_removeSession`, which emits `SIGNED_OUT` (`GoTrueClient.js:3424-3452`);
  3. throw only if that second call errors.

  Every other error still throws. The `removePushRegistration` call and the `clearAuthToken` call stay as they are.
- `src/App.tsx`. No change.
- **Tests:**
  - New `src/api/__tests__/authStorage.test.ts` gets the guard rows of the matrix. One test is a refresh `POST` to `/auth/v1/token?grant_type=refresh_token`, with no user token, passing through while a session is stored. Cover `Headers`, plain-object headers and a `Request` input.
  - `src/api/auth/__tests__/sessionService.test.ts` (from v1) imports the key from `../../authStorage`.
  - `src/api/auth/__tests__/authServices.test.ts`: offline sign-out (first call retryable, key removed, second call `{ scope: 'local' }`, no throw), plus a non-retryable error still throwing.
- **Ledger.** Add two entries to `_bmad-output/initiative-my-love/deferred-work.md`, in the existing entry format:
  - the simulator ignores a host clock jump until rebooted, and the driver has no step for it;
  - a reminder firing with the shell in front was never observed.
- **Driver.** `scripts/sim-driver/sim`, with `build`, `signin`, `launch`, `background`, `pending`, `center`, `push FILE`, `dump`, `screenshot` and `dates many`. The seed is `seed-fire.mjs` in the scratchpad, run from the repo root with `node --input-type=module < …`. Set the clock with `sudo /bin/date`, never a bare `date`, which resolves to GNU date.

## Tasks & Acceptance

**Execution:**
- [x] Apply the v1 patch, then move its key and reader into `src/api/authStorage.ts` -- KEEP the reviewed work.
- [x] `src/api/authStorage.ts`, `src/api/supabaseClient.ts`: `createSessionGuardedFetch`, wired through `global.fetch` -- no anon data request on a stored session.
- [x] `src/api/auth/actionService.ts`: the offline sign-out fallback -- sign-out works in the adopted state.
- [x] Tests (`authStorage.test.ts`, `sessionService.test.ts`, `authServices.test.ts`): one per matrix row, including the refresh passing through the active guard.
- [x] `_bmad-output/initiative-my-love/deferred-work.md`: the two entries.
- [x] Simulator re-run. The coordinating session runs it with the person, after the code tasks. An implementer does only the code, test and ledger tasks, never touches the simulator, Docker, the Mac clock or the network, and does not commit.

**Acceptance Criteria:**
- Given Kong down and the clock 2 h ahead, when the shell cold-starts, then it opens signed in. Once the welcome splash is dismissed it shows Home, and `sim pending` is unchanged.
- Given that state, when Kong comes up with the clock still 2 h ahead and the shell is foregrounded, then the token renews: the stored `expires_at` moves later, and the shell stays signed in with its reminders.
- Given Kong down and the shell on a stored session, when the person signs out in Settings, then the login screen shows and `sim pending` is 0.
- The firing, tap, push-stack and 64-cut results from the first run stand. They are recorded in Implementation Notes, and the auth change does not touch that code.
- At the end the Mac is on network time, Kong is up, and `sim dates clear` then `sim provision` have run.

## Implementation Notes

**First pass (2026-11-01, oneshot route):**
- **Setup:** the shell was built from `6e84b584` and Casey was signed in. The seed placed every kind of date on 11-03, "Week mark" on 11-09 and "Month mark" on 12-02, both marked. `sim pending` listed 16. A relaunch with Kong down kept all 16.
- **First jump found two limits of the method:**
  - **The simulator doesn't pick up a clock jump.** Moving the Mac clock to 11-02 08:58:30 fired nothing: the 8 reminders stayed pending. The simulator has to be rebooted after each jump.
  - **The Wi-Fi script left the Mac offline.** Its power-on did not rejoin the network, and the owner had to reconnect by hand. Turning off the Mac network was dropped (see Decisions).
- **After the reboot at 08:57:** all 8 fired at 9:00. `sim center` showed `{"count":8,"text":"Tomorrow: Jessie turns 34"}`. The person expanded the stack and read all 8 expected texts in the one My Love group.
- **Cold tap, with Kong down and the token about 13 h old:** about 25 s on the loading screen, then the sign-in page. `sim pending` showed 0. `sb-127-auth-token` was still stored and the owner marker was gone. The evidence is in the scratchpad (`ls-after-signout.sqlite3`, `app-log.txt`). Root cause is in Intent.
- **The clock is back on network time.**

**Fix (2026-11-01, full route):**
- **Code:**
  - New `src/api/authStorageKey.ts`, passed as `storageKey` in `src/api/supabaseClient.ts`.
  - In `src/api/auth/sessionService.ts`: `readStoredSession`, the retryable branch in `getSession`, and the null-`INITIAL_SESSION` substitution.
  - New `src/api/auth/__tests__/sessionService.test.ts` (20 tests), instead of extending `authServices.test.ts`.
  - `App.tsx` is unchanged.
- **Commands:**
  - `npm run lint`, `npm run typecheck` and `npm run test:unit` all exit 0.
  - `npx vitest run src/api/auth`: 56 passed.
  - `npx playwright test tests/e2e/auth`: 39 passed.
- **Note:** `sudo date` resolves to Homebrew's GNU date on this Mac, so the clock is set with `sudo /bin/date`. The failed `0026` command earlier was a typo in the year.

**Simulator checks, shell built from the fixed tree (`sim build`, sim-tree-1793585323):**
1. **Defect re-test.** Kong was down and the clock 2 h ahead (11-01 22:10). The cold start opened the signed-in app (the welcome splash), and 16 were still pending. After real time and Kong came back, the shell was still signed in with 16 pending. At real time the token had not expired, so the renewal itself is covered by the unit test, not by this run.
2. **Firing with the network off, then a tap from a cold start.** Kong was down and the shell terminated. The clock was set to 11-02 08:57 and the simulator rebooted. At 09:00 `{"count":8,"text":"Tomorrow: Jessie turns 34"}`. The person tapped one, and the shell opened on Home, signed in (the heart is current in the dock).
3. **Tap from the background.** The shell was on Love Notes, then `sim background`. The person tapped a reminder. iOS showed the restored Love Notes for under a second, then the shell routed to Home. This is the expected order: iOS restores the scene, then delivers the action.
4. **Stacking with a push.** A push with `thread-id` `partner-activity` took the group from 6 to 7, still one group, with the push on top.
5. **"Today:" reminders.** The clock was set to 11-03 08:57 and the simulator rebooted. At 09:00 the person read Today: First dance, Our anniversary, Wedding day, Casey turns 30 and Jessie turns 34 in the one My Love group. iOS trimmed the older items, so the count was 7.
6. **The 64 cut moving on.** After `sim dates many` there were 64 pending, with Event 44 the last event included. With Kong down the clock was set to 11-02 08:57, the simulator rebooted, and the shell was backgrounded before 9:00 and brought to the foreground at 09:00:41. 64 were pending. Gone: Tomorrow: Event 1 and Tomorrow: Anniversary 1. New: Tomorrow: Event 45 and Tomorrow: Event 46.
7. **Cleanup.** Network time is on (21:25 real), Kong is up, `sim dates clear` and `sim provision` have run, and the relaunched shell has 6 pending.

**Review loop 1 re-implementation (2026-11-01):**
- **Code:** the v1 patch was applied and reshaped. The key and reader moved to `src/api/authStorage.ts`, with `createSessionGuardedFetch`, which is wired through `global.fetch`. The offline sign-out fallback is in `actionService.signOut`. DW-375 and DW-376 are in the ledger.
- **Commands:**
  - `npm run lint`, `npm run typecheck` and `npm run test:unit` all exit 0 (223 files, 3703 tests).
  - `npx playwright test tests/e2e/auth`: 39 passed.
  - The implementer also ran the whole chromium project: 271 passed.
- **Simulator re-run, on build sim-tree-1793592392:**
  1. **Offline cold start.** Kong was down and the clock set with `sudo /bin/date 110200072026` (2 h ahead). The stored token was 3635 s past expiry. The shell opened signed in on the welcome splash, 6 were pending, and `sim tap` on Continue showed Home with the heart current.
  2. **Real renewal.** Kong came up with the clock still ahead, and the shell was backgrounded and foregrounded. The stored `expires_at` moved from 1793596025 to 1793596183, which is a new token, and the shell stayed signed in on Home with 6 pending.
     - **Clock skew:** the Docker VM stayed on real time (`04:08 UTC` against the Mac's 00:08 CST), so the new token still read as expired by the Mac clock. That is skew created by the test.
  3. **Offline sign-out.** Kong was down. Settings, then Sign out, reached the login screen. `sim pending` was `[]` and no session was stored.
  4. **Cleanup.** Network time is back (22:12 real), Kong is up, `sim dates clear` and `sim provision` have run, and Casey is signed back in with 6 pending.

**Review pass 2 patches (2026-11-01):**
- **Patches applied:** the seven listed in the Review Triage Log.
- **Commands:**
  - `npm run lint` and `npm run typecheck` exit 0.
  - `npm run test:unit`: 223 files, 3706 tests.
  - `SEED=7 npm run test:unit:coverage` exits 0.
  - `npx playwright test tests/e2e/auth`: 39 passed.
- **Real-client cases** in `tests/unit/api/supabaseClientAuthFlow.test.ts`:
  - The implementer confirmed both fail when the `global.fetch` wiring, or the stored-session sign-out branch, is disabled.
  - They fake only `Date`, and move it 31 s ahead per failed fetch, so the SDK's refresh backoff gives up after one attempt.
  - The query uses `.retry(false)`.
- **No simulator re-run on the patched tree.** The patches touch the case where the stored session is already gone, plus logging and comments, and the real-client tests cover the sign-out path.


- **The simulator ignores a host clock jump.** Its notification scheduler fires only after a reboot, and the simulator driver has no command for this. The device check in story 5 is unaffected.
- **A reminder firing with the shell in the foreground** shows a banner, according to the plugin's default `willPresent`. This was not observed here, because the shell was backgrounded at 9:00 in every run.

## Plan Change Log

- **Loop 1 (intent_gap, owner answers 2026-11-01).**
  - **Triggering findings:** anon reads while on a stored session (high), and offline sign-out failing (medium).
  - **What changed:**
    - Owner decisions, an Always invariant and six matrix rows were added to the frozen block.
    - The Code Map, Tasks and ACs were rewritten.
  - **Known-bad states avoided:**
    - a reconnect's anon read saving `[]` over the copies;
    - a guard that blocks the token refresh it waits for;
    - a sign-out that fails while offline.
  - **KEEP:** the v1 patch (see Code Map).

## Review Triage Log

**Pass 1 (quick lens, 6 findings).** Verdicts: high 1, medium 1, low 2, false 0, maybe-false 0, rejected 2. Routing: intent_gap 2 (loopback), patch 1 (deferred until the re-derived code exists), rejected 2.

1. **high, intent_gap. Anon reads overwrite copies while the app runs on a stored session.**
   - **The window:** while the SDK has no live session, `_getSessionToken` returns `null` and `fetchWithAuth` sends the publishable key (`supabase-js index.mjs:829-835`, `:298-303`). That happens during the 60 s `REFRESH_FAILURE_COOLDOWN_MS` after a failed refresh (`GoTrueClient.js:4208-4212`, `:4321-4324`), or while GoTrue is down and PostgREST is up.
   - **The damage:** RLS answers `[]`. `eventsService.getEventsPage` (`:332`) has no session check, so a reconnect's `refreshLocalCopies` saves `[]` over the events copy and the re-plan cancels the reminders.
   - **Why it's new:** the state could not occur before this change. `photoService.listAllPhotos:195` already guards against the same hazard.
   - **Why it's an intent gap:** the fix needs a new frozen invariant, "no account request goes out without a live SDK session".
2. **medium, intent_gap. Sign-out fails offline in the adopted state.**
   - In `_signOut` (`GoTrueClient.js:3430-3432`), a retryable `sessionError` returns before `_removeSession()`. So `actionService.signOut:82` throws, and Settings shows "Failed to sign out".
   - That contradicts the owner decision "stays signed in until the person signs out". On a shared device, the account stays.
   - **Why it's an intent gap:** offline sign-out in this state is not in the frozen matrix.
3. **low, rejected (the fix edits this plan). "Server back" is not verified.**
   - The unit test emits `TOKEN_REFRESHED` by hand, and the simulator run's token had not expired at real time.
   - The re-run must exercise a real renewal.
4. **low, rejected (the fix edits this plan). AC 1's "on Home" is not shown.** The welcome splash was recorded, not Home. The re-run taps Continue and records Home.
5. **low, rejected (the fix edits this plan). AC 5 says "gateway up", but check 5 ran with Kong down.** Running it offline is the stricter condition. It is recorded here.
6. **low, patch. The two "Observations, not fixed" are missing from `deferred-work.md`.**
   - AGENTS.md says a deferred finding goes into the ledger in the same change.
   - The two entries are added when the loopback's code lands.

**Pass 2 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; 17 findings).** Verdicts: high 0, medium 3, low 9, false 2, maybe-false 1, descriptive 2. Routing: patch 7 groups, defer 3 (DW-377, DW-378, DW-379), rejected 5.

**Patched:**
1. **medium, patch. The guard and the offline sign-out are tested only against a mocked client** (VG gap 1, VG gap 2, BH "no test confirms the setup", IA "refresh test is factory-level", IA "key tested against a literal").
   - Dropping `global.fetch` or `storageKey`, or an SDK bump, would leave the suite green.
   - Fix: real-client cases in `tests/unit/api/supabaseClientAuthFlow.test.ts`:
     - a data request on an expired stored session is refused, and the refresh reaches `fetch`;
     - an offline `signOut` emits `SIGNED_OUT` and empties the key.
2. **low, patch. A double `SIGNED_OUT`** (VG other, ECH 1).
   - When the token is still valid and the server is unreachable, `_signOut` already removed the session (`GoTrueClient.js:3439-3449`), so the fallback emitted a second `SIGNED_OUT`.
   - The second `clearAuth` is harmless: `authSlice.ts:325-333` finds no outgoing user. But before this change the same case threw "Sign-out failed".
   - Fix: fall back only while a session is stored; otherwise the sign-out is treated as done.
3. **low, patch. The comment says the server session is "left to expire"** (BH). No timebox is configured, so it never expires. The comment is corrected, and revocation is deferred as DW-377.
4. **low, patch. The comment says the guard "sees every request"** (BH, ECH 3 claim). The Realtime WebSocket bypasses `fetch`. The comment is corrected, and the Realtime behaviour is deferred as DW-378.
5. **low, patch. `getSession` dropped its error log** (BH) for a retryable error with nothing stored. The log is restored, and the doc comment now says `getSession` may return an expired stored session.
6. **low, patch. The guard refuses silently** (BH). A `logger.debug` line now names the refused path.
7. **low, patch. A spy leaks when a test fails** (BH). `authStorage.test.ts` restored its spy only as the test's last statement; spies are now restored in `afterEach`.

**Deferred:**
- **DW-377, low.** An offline sign-out leaves the refresh token valid on the server.
- **DW-378, maybe-false, medium if true.** Realtime may join as anon on a stored session, and channels may stay muted. Unverified whether the channels rejoin with the new token. A simulator delivery check would settle it.
- **DW-379, low.** AGENTS.md lacks the new session rules. The fix edits an agent-context file.

**Rejected:**
- **ECH 2, low.** `localStorage.removeItem` throwing. WKWebView and browsers always provide it here, and the fix would add a guard for a state not shown to be reachable.
- **BH, false. "A failed local sign-out leaves the app unprotected."** With the key removed, `signOut({ scope: 'local' })` reads empty storage, finds no session and no error, and `_removeSession` resolves (`GoTrueClient.js:3424-3452`). The failure it assumes has no reachable cause.
- **BH, low. The plan is missing from the diff, and its text is stale.**
  - The plan is untracked until the commit step, which commits it.
  - Updating the stale "Fix" text would mean editing the plan.
- **IA, false. `getAuthStatus` and `getCurrentUserIdOfflineSafe` now return the stored session.** That is intended, per the owner's decision that losing the network never signs anyone out.
- **IA, descriptive. Device-level evidence lives only in the plan's simulator notes.** The story is a hand check by design, and patch 1 adds the client-level tests.

## Design Notes

The three-way rule copies `lookupPartnerId`. The stored session may carry an expired access token. Offline, every read comes from the local copies, and the SDK's auto-refresh ticker emits `TOKEN_REFRESHED` once the gateway answers, which the listener already handles.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test:unit` -- expected: clean and green.
- `npx vitest run src/api/auth` -- expected: the new tests pass.
- `npx playwright test tests/e2e/auth` (with `supabase start` running) -- expected: green.

**Manual checks:** the simulator ACs above, run after `sim build` from the fixed tree. The re-test of the defect comes first.
