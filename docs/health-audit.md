# App Health Audit

_Generated 2026-07-25. Companion to [feature-map.md](./feature-map.md), which describes what each
feature does; this document records what is wrong with it._

## Baseline

Everything below passes the mechanical gates. These were run for this audit:

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | exit 0 — no errors |
| Lint | `npm run lint` | exit 0 — no errors |
| Unit tests | `npm run test:unit` | 896 passed / 896, 56 files |
| Build | `fnox exec -- npm run build` | succeeds, 2.9 MB `dist`, 130 KB gzipped entry chunk |
| Runtime deps | `npm audit --omit=dev` | 0 vulnerabilities |
| All deps | `npm audit` | 15 high, all dev/build-only (eslint, playwright-utils, workbox-build) |
| Coverage | `npm run test:unit:coverage` | 32.44% overall (threshold 25%) |

Nothing in this codebase is mechanically broken. Every finding below is a behavioural or design
defect that passes all four gates.

## How this was produced

Eight readers each took one feature area and read the implementation directly — not the feature map.
Each finding was then re-checked by an independent verifier instructed to refute by default: confirm
the quote byte-for-byte, trace callers, and try to prove the code path unreachable or already handled.

- 91 findings proposed, **89 survived** verification, 2 refuted.
- 89/89 surviving quotes confirmed byte-exact at the cited line.
- 40 findings had their severity **lowered** by the verifier, 0 raised, 49 left unchanged.

I then independently re-verified every Critical and the highest-impact High findings against source,
by execution, and against the live production database. One finding was materially corrected as a
result (see `photos-missing-update-policy`), and two findings below are my own.

## Summary

| Severity | Count |
| --- | --- |
| Critical | 3 |
| High | 23 |
| Medium | 46 |
| Low | 18 |
| **Total** | **90** |

### Fix these first

1. **Five modules open the same IndexedDB at version 5; two use bespoke upgrade callbacks, and the first opener permanently decides which stores exist**  
   `src/services/storage.ts`:37 — On a fresh browser profile, mood tracking is permanently broken: every attempt to save a mood throws and the entry never persists. Depending on which module opens first, scripture offline caching and/or background-sync auth-token storage are also dead. Clearing site data is the only recovery, and the user gets no hint that is what is needed.
1. **scripture_seed_test_data is SECURITY DEFINER with an inert production guard and a default PUBLIC execute grant**  
   `supabase/migrations/20260309000001_at_reflection_preset.sql`:41 — Anyone holding the publishable anon key — which is shipped in the deployed JavaScript bundle at https://sallvainian.github.io/My-Love/ — can POST to `/rest/v1/rpc/scripture_seed_test_data` against the production database and insert an unbounded number of fabricated scripture sessions, step states, reflections and prayer messages attributed to the oldest account in `auth.users`. The real couple sees fake sessions and fake prayer messages in their history, and the row count can be driven arbitrarily high.
1. **Partner search can never return a row under the current users RLS policy, making linking unreachable**  
   `src/api/partnerService.ts`:121 — On the Partner tab, typing any name or email into the search box always shows 'No users found matching "..."'. There is no way to find, request, or link a partner through the app at all.

## Findings by area

Each finding carries the exact file and line, the source text at that line, what the user experiences,
the mechanism, a concrete reproduction, and a proposed fix with a rough size (S/M/L).

### Infrastructure & data — offline, service worker, IndexedDB, Supabase, RLS

**11 findings** — 2 critical, 4 high, 3 medium, 2 low

> The Supabase side is mostly well-built: every table in `public` has RLS enabled, no policy uses a bare `true`, the users-table privilege-escalation and RLS-recursion bugs were found and properly fixed, and the scripture RPC surface is `security invoker` with pgTAP coverage. What worries me most is the IndexedDB layer: five call sites all call `openDB(DB_NAME, DB_VERSION=5)` with *different* upgrade callbacks, so whichever one opens the database first on a fresh browser permanently decides which object stores exist. I reproduced this with fake-indexeddb: after `storageService.init()` opens first, saving a mood throws `NotFoundError: No objectStore named moods in this database`. Second concern is a test-seeding RPC (`scripture_seed_test_data`) whose only production guard reads a Postgres setting that nothing in the repo ever sets, leaving it callable against the live database. Third, several client↔policy contradictions have drifted: `partnerService.searchUsers` still assumes the old `USING (true)` users policy that was replaced in Dec 2025, and `photoService.updatePhoto` reports success even when an UPDATE matches zero rows.

#### Critical · Five modules open the same IndexedDB at version 5; two use bespoke upgrade callbacks, and the first opener permanently decides which stores exist

**broken** · `src/services/storage.ts`:37 · effort **S**

```ts
      this.db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
```

**What you see:** On a fresh browser profile, mood tracking is permanently broken: every attempt to save a mood throws and the entry never persists. Depending on which module opens first, scripture offline caching and/or background-sync auth-token storage are also dead. Clearing site data is the only recovery, and the user gets no hint that is what is needed.

**Why:** `DB_NAME`/`DB_VERSION` are shared constants (dbSchema.ts:172-173, version 5), but there are three different upgrade implementations. `dbSchema.upgradeDb` is the complete one (creates all 8 stores). `storage.ts`'s inline callback creates only `messages` and `photos`. `sw-db.ts`'s inline callback stops at v4 (no scripture stores). IndexedDB fires `upgradeneeded` only for the *first* open request that finds a lower version; every later `openDB(name, 5)` sees version 5 and skips upgrade entirely. So whichever module opens first writes the schema, and the missing stores can never be created — a future DB_VERSION bump to 6 will only run the `oldVersion < 6` branch. `settingsSlice.initializeApp` calls `storageService.init()` (settingsSlice.ts:120) and `sessionService.onAuthStateChange` calls `storeAuthToken` -> `sw-db.openDatabase()` (sessionService.ts:66) — both are on the fresh-install path, and neither uses `upgradeDb`.

**Reproduce:** Verified empirically with fake-indexeddb: `await storageService.init()` then `await moodService.create(uuid, ['happy'])` throws `NotFoundError: No objectStore named moods in this database` (BaseIndexedDBService.ts:108), and `scriptureReadingService.get(id)` logs `NotFoundError: No objectStore named scripture-sessions` and silently returns null. In the browser this is the sign-in path: brand-new profile -> sign in -> `storeAuthToken` (or `initializeApp`) creates the DB at v5 with a partial store set -> open the Mood view and save a mood -> save fails every time.

**Fix:** Delete both bespoke upgrade callbacks and route every `openDB` through the single `upgradeDb` from `src/services/dbSchema.ts`: change `src/services/storage.ts:_doInit` and `src/sw-db.ts:openDatabase` to pass `upgrade(db, oldVersion, newVersion) { upgradeDb(db, oldVersion, newVersion); }` exactly as `moodService._doInit` and `scriptureReadingService._doInit` already do. Add a defensive `if (!db.objectStoreNames.contains(...))` guard inside each branch of `upgradeDb` so an already-damaged database can self-heal on a version bump, and add a unit test that opens the DB through `storageService` first and then asserts `moodService.create` and `scriptureReadingService` caching both succeed.

> _Evidence: Reproduced by execution. A throwaway vitest file under `fake-indexeddb` called `storageService.init()` on a fresh database, then listed the object stores: `["messages","photos"]`. `moodService.create()` then threw `NotFoundError: No objectStore named moods in this database`. Exact counts: `grep -rnE "(await |return )openDB[<(]" src/ --include="*.ts"` (excluding tests) returns 5 call sites — `sw-db.ts:25`, `storage.ts:37`, `customMessageService.ts:47`, `moodService.ts:40`, `scriptureReadingService.ts:166`. Three delegate to `upgradeDb`; `sw-db.ts` and `storage.ts` do not._

#### Critical · scripture_seed_test_data is SECURITY DEFINER with an inert production guard and a default PUBLIC execute grant

**risk** · `supabase/migrations/20260309000001_at_reflection_preset.sql`:41 · effort **S**

```ts
  v_env := current_setting('app.environment', true);
```

**What you see:** Anyone holding the publishable anon key — which is shipped in the deployed JavaScript bundle at https://sallvainian.github.io/My-Love/ — can POST to `/rest/v1/rpc/scripture_seed_test_data` against the production database and insert an unbounded number of fabricated scripture sessions, step states, reflections and prayer messages attributed to the oldest account in `auth.users`. The real couple sees fake sessions and fake prayer messages in their history, and the row count can be driven arbitrarily high.

**Why:** The only guard is `IF v_env = 'production' THEN RAISE EXCEPTION`, where `v_env := current_setting('app.environment', true)`. `app.environment` is not a Supabase-managed setting and `rg -n "app.environment" .` over the whole repo returns only the five migration files that *read* it — nothing ever sets it, so `current_setting(..., true)` returns NULL and the guard never fires, in production or anywhere else. The function is `LANGUAGE plpgsql SECURITY DEFINER` (line 224), so its inserts bypass RLS entirely. Migration 20260309000001 first `DROP FUNCTION IF EXISTS scripture_seed_test_data(INT, BOOLEAN, BOOLEAN, TEXT)` (line 12) and then creates a new 5-argument function (line 14); the new object gets Postgres's default `EXECUTE TO PUBLIC` ACL, so `anon` can call it too, not just `authenticated`. `p_session_count` is unvalidated and drives `FOR i IN 1..p_session_count LOOP` (line 92).

**Reproduce:** With only the public anon key from the production bundle: `curl -X POST "$VITE_SUPABASE_URL/rest/v1/rpc/scripture_seed_test_data" -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{"p_session_count":500,"p_include_messages":true,"p_preset":"completed"}'`. Expected: rejected. Actual: 500 completed sessions plus 1500 prayer messages are inserted under the first user in `auth.users` and become visible in that user's scripture history.

**Fix:** Two changes in a new migration. (1) `REVOKE ALL ON FUNCTION public.scripture_seed_test_data(INT, BOOLEAN, BOOLEAN, TEXT, INT[]) FROM PUBLIC, anon, authenticated;` and grant it only to `service_role`, so E2E seeding uses the service key rather than a user session. (2) Replace the string-compare guard with one that fails closed — e.g. `IF coalesce(current_setting('app.environment', true), 'production') <> 'local' THEN RAISE EXCEPTION`. Also clamp `p_session_count` (`IF p_session_count > 10 THEN RAISE EXCEPTION`). Add a pgTAP case in `supabase/tests/database/02_rls_policies.sql` asserting `anon` and `authenticated` cannot execute the function.

#### High · users SELECT policy was narrowed to self+partner, but partnerService still assumes the old read-all policy, so partner search can never return anyone

**broken** · `src/api/partnerService.ts`:117 · effort **M**

```ts
      // Query users table directly (RLS policy allows authenticated users to search)
```

**What you see:** A user who is not yet partnered searches for their partner by email or display name and always gets zero results, with no error shown — the connect-partner flow is unusable for any new couple. If a request is somehow created, the recipient's pending-requests list shows the sender as "Unknown" instead of their name or email.

**Why:** The final users SELECT policy is `USING (id = auth.uid() OR id = public.get_my_partner_id() OR partner_id = auth.uid())` (20260205000001_fix_users_rls_recursion.sql:33-37). For an unpartnered searcher U looking at a stranger S: `S.id = U.id` is false, `get_my_partner_id()` returns NULL so `S.id = NULL` is NULL, and S is unpartnered so `S.partner_id = U.id` is NULL — the row is filtered out. `searchUsers` then adds `.neq('id', currentUser.user.id)`, which removes the only row RLS would have allowed, guaranteeing an empty result. The comment on line 117 describes the `"Authenticated users can read all users" USING (true)` policy that was dropped in 20251206124803_fix_users_rls_policy.sql:8. Same cause hits `sendPartnerRequest`'s target lookup (partnerService.ts:173, which then treats the RLS-filtered empty result as "target has no partner") and `getPendingRequests`'s `.from('users').select(...).in('id', userIds)` enrichment (partnerService.ts:239).

**Reproduce:** Create two fresh accounts A and B with no partner_id set. Sign in as A, open the partner-connect screen, type B's email. Expected: B appears in results. Actual: "no results" — `searchUsers` returns `[]` because the RLS policy filters out B's row before the `.or(email.ilike...)` filter is even relevant.

**Fix:** Add a narrow SECURITY DEFINER lookup RPC rather than widening the SELECT policy: `public.find_user_for_partnering(p_query text)` returning only `(id, display_name, email)` for at most a handful of rows, restricted to rows where `partner_id IS NULL`, with a minimum query length and a rate guard. Grant EXECUTE to `authenticated` only, and rewrite `partnerService.searchUsers` to call it. Do the same for the sender-name enrichment in `getPendingRequests` (or return the sender's display name as a column on `partner_requests`). Delete the stale comment at partnerService.ts:117. Add pgTAP coverage for the users SELECT policy so the next tightening breaks a test instead of the feature.

#### High · Partner mood broadcasts use a public Realtime channel, so any holder of the anon key can read mood notes and inject fake moods

**risk** · `src/api/moodSyncService.ts`:361 · effort **M**

```ts
      .channel(`mood-updates:${currentUserId}`, {
```

**What you see:** The private note a user attaches to a mood ("had a fight with my mom", up to 200 chars) is transmitted over a Realtime topic that anyone can join. A third party who reads the anon key out of the deployed bundle and knows or guesses a user UUID can subscribe to `mood-updates:{uuid}` and receive every mood that user's partner logs, and can also send a forged `new_mood` event that the victim's app accepts and renders as their partner's mood.

**Why:** Both the sender (`supabase.channel(\`mood-updates:${partnerId}\`)`, line 124) and the receiver (line 361, config `{ broadcast: { self: false } }`) create the channel **without** `private: true`. Supabase only enforces the `realtime.messages` RLS policies on private channels; public channel topics are open to any connection with a valid JWT, and the publishable anon key in `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` is embedded in the production bundle served from GitHub Pages. The scripture feature already does this correctly — `useScriptureBroadcast.ts:112` sets `private: true` and 20260220000001_scripture_lobby_and_roles.sql:70/85 add matching `realtime.messages` SELECT/INSERT policies — so the pattern exists and mood sync simply did not adopt it. On receive, the handler at line 366 copies `payload.payload` straight into a `SupabaseMoodRecord` and calls `callback(mood)` (line 379) with no verification that `user_id` is actually the partner.

**Reproduce:** Take the anon key from the production JS bundle and a target user UUID (partner UUIDs are also exposed as the `partner_id` Sentry tag and in `mood-updates:{partnerId}` sends). From any browser console: `createClient(URL, ANON).channel('mood-updates:<victim-uuid>').on('broadcast', {event:'new_mood'}, console.log).subscribe()`. Every mood the victim's partner logs, note text included, prints. Sending `channel.send({type:'broadcast', event:'new_mood', payload:{...}})` makes a fabricated mood appear in the victim's partner-mood UI.

**Fix:** Add `private: true` to the channel config at both `moodSyncService.ts:124` and `moodSyncService.ts:361`, then add `realtime.messages` RLS policies modelled on 20260220000001_scripture_lobby_and_roles.sql:70-97: SELECT allowed when `topic like 'mood-updates:%'` and `split_part(topic,':',2)::uuid = auth.uid()` (you may only listen on your own channel), INSERT allowed when the topic UUID equals `public.get_my_partner_id()` (you may only publish to your partner's channel). Additionally, validate the received payload in the handler at line 366 — reject it unless `payload.user_id` matches the known partner id — so a forged message cannot reach state even if the channel config regresses.

#### High · Plaintext test-account password committed to a migration that runs against production

**risk** · `supabase/migrations/20260316031209_create_claude_bot_config.sql`:14 · effort **S**

```ts
  ('test_password', '7fCRFw0t4d0GjV6QEObE4yns4TZQsMcM'),
```

**What you see:** A working password for a real account on the production Supabase project sits in the git history of a repository whose build is published to GitHub Pages. Anyone with repository read access — or anyone who obtains the history later — can sign in as that account and read/write whatever that account can reach through RLS.

**Why:** The migration inserts credentials as literal values. RLS on `claude_bot_config` (line 9 with no policies) protects the row from `anon`/`authenticated` at runtime, but that is irrelevant: the secret is in the SQL file itself, in git, and in every checkout and CI log that runs `supabase db reset`. This also contradicts the project's own stated rule that secrets live in `fnox.toml` under the age provider and are never hardcoded in source.

**Reproduce:** `git log -p -- supabase/migrations/20260316031209_create_claude_bot_config.sql` prints the password; `git show 6b858ef4:supabase/migrations/20260316031209_create_claude_bot_config.sql` does the same for any past revision. Use it with `test_email` on the production Supabase auth endpoint to obtain a session.

**Fix:** Rotate the account password immediately (the committed one must be treated as compromised regardless of what happens next). Change the migration to seed only non-secret keys — or nothing at all — and have E2E setup read `CLAUDE_BOT_PASSWORD` from fnox locally and from GitHub Secrets in CI, writing it into `claude_bot_config` at test-setup time with the service-role key. Since the value is already in history, purge it or accept it as burned and never reuse it.

#### High · Three production tables exist in no migration, and the generated types are stale

**risk** · `supabase/migrations/` · effort **M** · _found during my own verification_

**What you see:** Any database rebuilt from the repo differs from production. Local dev, CI, and any new environment are missing three tables and their 14 RLS policies.

**Why:** Production `public` holds 15 tables; `supabase/migrations/` creates 12. The extras are `daily_love_messages` (5 policies), `notifications` (4 policies) and `push_subscriptions` (5 policies). Each returns 0 matching migration files. None appear in the generated `src/types/database.types.ts`, so that file no longer reflects the live schema. The client never queries any of the three — `grep` for `from('notifications')`, `'push_subscriptions'` and `'daily_love_messages'` across `src/` returns nothing.

**Reproduce:** Compare `SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind='r'` against `grep -rhoiE "create table (if not exists )?[a-z_]+" supabase/migrations/`. Production returns 15 rows, migrations define 12.

**Fix:** Decide per table. If `daily_love_messages` / `notifications` / `push_subscriptions` are wanted, capture them with `supabase db diff` into a new migration and regenerate `src/types/database.types.ts`. If they are abandoned experiments, drop them in a migration so production matches the repo. Either way add a CI step that fails on drift (`supabase db diff --linked` producing output).

> _Evidence: Queried production project `xojempkrugifnaveqtqc` via `pg_class` / `pg_policy` on 2026-07-25._

#### Medium · Service-worker background sync stamps every pending mood with the currently stored token's userId, not the mood's own userId

**risk** · `src/sw.ts`:192 · effort **S**

```ts
        const supabaseMood = transformMoodForSupabase(mood, authToken.userId);
```

**What you see:** On a shared device, a mood (and its private note) logged offline by user A gets uploaded to Supabase as user B's mood after A signs out and B signs in. It then shows in B's mood history and is broadcast to B's partner. A's mood is marked synced locally, so A never re-syncs it.

**Why:** `syncPendingMoods` reads *all* unsynced moods (`sw-db.ts:83-87` filters only on `!mood.synced`, with no user scoping) and then builds the insert payload with `transformMoodForSupabase(mood, authToken.userId)` — line 125/129 set `user_id: userId` from the token, discarding `mood.userId` entirely. The in-app path does the opposite: `moodSyncService.syncMood` uses `user_id: mood.userId` (moodSyncService.ts:85), which the moods INSERT policy `WITH CHECK (auth.uid() = user_id)` correctly rejects when they disagree. The SW path passes RLS precisely because it rewrites the owner. Sign-out (`actionService.ts:81`) only calls `clearAuthToken()`; it never clears the local `moods` store, so A's rows survive into B's session, and the next `SIGNED_IN` writes B's token (`sessionService.ts:66`).

**Reproduce:** On one browser profile: sign in as A, go offline, log a mood with a note, sign out (mood stays unsynced in IndexedDB). Sign in as B, go back online. Background Sync (or the on-reconnect sync) fires: A's mood is POSTed to `/rest/v1/moods` with `user_id` = B, accepted by RLS, and appears in B's mood history and in B's partner's realtime feed.

**Fix:** In `src/sw.ts:syncPendingMoods`, skip any mood whose `mood.userId` does not equal `authToken.userId` (leave it pending) and pass `mood.userId` into `transformMoodForSupabase` so the SW and in-app paths agree — an ownership mismatch should then fail RLS loudly rather than silently re-attribute. Better still, filter at the source: give `getPendingMoods` a `userId` argument in `src/sw-db.ts`. Independently, clear the local moods store on sign-out in `actionService.signOut` so one user's offline data cannot outlive their session on a shared device.

#### Medium · Sentry beforeSend strips only user.email/ip, while default console breadcrumbs carry love-message and photo content

**risk** · `src/config/sentry.ts`:36 · effort **S**

```ts
      // Strip PII — only UUIDs should reach Sentry
```

**What you see:** When any error is reported to Sentry, the attached breadcrumb trail can contain the full text of the user's custom love messages (or, on an export/import failure, every custom message they have written) and photo metadata including captions — despite the code asserting that only UUIDs reach Sentry.

**Why:** `beforeSend` deletes `event.user.email` and `event.user.ip_address` (sentry.ts:38-39) and nothing else. `@sentry/react` 10.42.0's default `breadcrumbsIntegration` has `console: true` (confirmed in `node_modules/@sentry/browser/build/npm/cjs/prod/integrations/breadcrumbs.js:15`), so every `console.error/warn` in the app becomes a breadcrumb serialized into the next event. `src/services/storage.ts:184` logs `console.error('[StorageService] Message data:', message)` where `message.text` is user-authored content; `storage.ts:111` logs the whole photo object including `caption`; `customMessageService.ts:293` logs the entire export payload. No `beforeBreadcrumb` hook is configured to scrub any of it.

**Reproduce:** In production with `VITE_SENTRY_DSN` set, fill IndexedDB to its quota (or otherwise make a write fail) and add a custom message. `storageService.addMessage` throws, `console.error('[StorageService] Message data:', message)` runs, and the next error event sent to Sentry carries a console breadcrumb containing the message text.

**Fix:** Add a `beforeBreadcrumb(breadcrumb)` to `Sentry.init` that drops or redacts console breadcrumbs — the cheapest correct version returns `null` for `breadcrumb.category === 'console'`, or strips `breadcrumb.data.arguments` for them. Separately, stop logging whole entities at the three call sites: log an id and a length instead of `photo`/`message`/`exportData` at `storage.ts:111`, `storage.ts:184` and `customMessageService.ts:293`.

#### Medium · scripture_sessions UPDATE policy has USING but no WITH CHECK, letting a member attach an arbitrary third party as user2

**risk** · `supabase/migrations/20260128000001_scripture_reading.sql`:147 · effort **S**

```ts
  FOR UPDATE USING (
```

**What you see:** A session participant can add any user in the system as `user2_id` on their session. That third party then gains SELECT on the session row, SELECT on every reflection in it that is marked `is_shared`, SELECT on the prayer messages, and both send and receive rights on the private `scripture-session:{id}` and `scripture-presence:{id}` Realtime channels — including the ability to inject `state_updated` broadcasts that drive the other participant's UI.

**Why:** Postgres uses the USING expression as the WITH CHECK expression when the latter is omitted. Here USING is `user1_id = auth.uid() OR user2_id = auth.uid()` (line 148), which the post-update row still satisfies via `user1_id` no matter what `user2_id` is set to. Every downstream authorization check keys off session membership — `is_scripture_session_member` (line 120-127), the session SELECT policy (line 134), and both `realtime.messages` policies (20260220000001:70 and :85 select `id from scripture_sessions where user1_id = auth.uid() or user2_id = auth.uid()`) — so writing a stranger's UUID into `user2_id` grants them all of it. No later migration replaces `scripture_sessions_update`.

**Reproduce:** As an authenticated user with session S they created, call PostgREST directly: `PATCH /rest/v1/scripture_sessions?id=eq.<S>` with body `{"user2_id":"<any-other-user-uuid>"}`. Expected: rejected. Actual: accepted. That user can now `select * from scripture_sessions where id = <S>`, read shared reflections and messages in S, and subscribe to and publish on `scripture-session:<S>`.

**Fix:** Replace the policy with one that pins identity on both sides: `DROP POLICY scripture_sessions_update ON scripture_sessions; CREATE POLICY scripture_sessions_update ON scripture_sessions FOR UPDATE USING (user1_id = auth.uid() OR user2_id = auth.uid()) WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());` — and, because membership is what grants access, forbid membership columns from being rewritten by clients at all: keep `user1_id`/`user2_id` mutable only through the existing SECURITY DEFINER join/convert RPCs. Add a pgTAP case asserting a member cannot set `user2_id` to a non-member.

#### Low · IndexedDB quota handling is specified and stubbed but never wired up; only localStorage is monitored, with a hardcoded 5MB estimate

**gap** · `src/services/BaseIndexedDBService.ts`:302 · effort **M**

```ts
  protected handleQuotaExceeded(): never {
```

**What you see:** When IndexedDB hits its origin quota, writes throw a raw `QuotaExceededError` that surfaces as a generic failure. The user gets no warning as they approach the limit and no guidance about what to delete; the app just stops being able to save moods, messages and scripture cache entries.

**Why:** `handleQuotaExceeded` is declared with the comment "Story 4.1: AC-4.1.9 - Quota warnings at 80%, error at 95%" (line 300) but `rg handleQuotaExceeded src/` finds only its own declaration — no call site anywhere. The only quota code that runs is `logStorageQuota()` (App.tsx:293, once per app init), and it measures **localStorage** only, against a hardcoded `const total = 5 * 1024 * 1024` (storageMonitor.ts:55) rather than the real per-origin figure. `navigator.storage.estimate()`, the API that reports actual IndexedDB usage and quota, is never called anywhere in the codebase.

**Reproduce:** Fill the origin's IndexedDB quota (e.g. via devtools or by writing large blobs), then log a mood. `moodService.create` -> `BaseIndexedDBService.add` -> `handleError('add', ...)` rethrows the raw `QuotaExceededError`; no warning was ever shown at 80% and no quota-specific message is shown at failure.

**Fix:** Replace `logStorageQuota`'s hardcoded 5MB accounting with `await navigator.storage.estimate()` (usage/quota covers IndexedDB, Cache Storage and localStorage together), expose it as an async `getStorageEstimate()`, and call it on a schedule rather than once at init. In `BaseIndexedDBService.add/update`, detect `error.name === 'QuotaExceededError'` and route to `handleQuotaExceeded()` so callers get a distinguishable error, then surface a user-facing "storage full" message in the mood/message write paths. If the 80%/95% thresholds from AC-4.1.9 are no longer wanted, delete the stub and the comment instead of leaving a specified behaviour unimplemented.

#### Low · Two-thirds of supabaseSchemas.ts is unreferenced; the interactions and users Supabase boundaries have no runtime validation at all

**gap** · `src/api/validation/supabaseSchemas.ts`:159 · effort **M**

```ts
export const SupabaseInteractionSchema = z.object({
```

**What you see:** Mood and scripture responses are schema-checked, but interaction, user/partner and photo rows flow from Supabase into Zustand state completely unvalidated. A column rename or type change on those tables produces `undefined` deep inside a component instead of a clean parse error at the API boundary, and the inconsistency makes it easy to assume validation exists where it does not.

**Why:** `rg` across `src/` (excluding tests and the definition file) shows only `SupabaseMoodSchema`, `MoodArraySchema` and `CoupleStatsSchema` are ever imported — by `src/api/moodApi.ts` and `src/services/scriptureReadingService.ts`. `SupabaseUserSchema` (line 51), `SupabaseInteractionSchema` (line 159), `SupabasePhotoSchema` (line 225), `SupabaseMessageSchema` (line 205), `InteractionArraySchema` (line 255), `UserArraySchema` (line 261) and all six Insert/Update schemas have zero consumers. Meanwhile `interactionService.ts:185` feeds a raw `postgres_changes` payload into state and `partnerService.ts:118` maps raw `users` rows straight into `UserSearchResult`. Compounding it, `src/validation/schemas.ts:257` also exports a symbol named `SupabaseMessageSchema` describing a *different* table (scripture_messages vs. a non-existent `messages` table) — importing the wrong one type-checks and only fails at parse time.

**Reproduce:** `rg -n 'SupabaseInteractionSchema|InteractionArraySchema|UserArraySchema|SupabaseUserSchema' src/ --glob '!*.test.ts' -g '!supabaseSchemas.ts'` returns no matches, while `src/api/interactionService.ts:185` and `src/api/partnerService.ts:118` both consume Supabase rows with no `.parse()` anywhere in the call chain.

**Fix:** Pick one direction and make it consistent. Either wire the schemas up — `InteractionArraySchema.parse(data)` in `interactionService`'s fetch and realtime handlers, `UserArraySchema.parse(data)` in `partnerService.searchUsers`/`getPendingRequests`, `SupabasePhotoSchema` in `photoService`'s reads — or delete the unused exports so the file reflects reality. Regardless, rename one of the two `SupabaseMessageSchema` exports (e.g. `ScriptureMessageRowSchema` in `src/validation/schemas.ts:257`) to remove the collision.

**Test coverage in this area.** The pgTAP suite (`supabase/tests/database/02_rls_policies.sql`, `select plan(14)`) tests RLS only for the five `scripture_*` tables. There is zero RLS test coverage for `users`, `moods`, `love_notes`, `photos`, `interactions`, or `partner_requests` — which is exactly why the users-SELECT policy could be tightened out from under `partnerService.searchUsers` and the missing photos UPDATE policy could go unnoticed. On the client side there is no test that opens the shared IndexedDB through more than one service in a single process, so the divergent-upgrade bug is invisible to the suite (each existing db test opens through one code path only). `src/sw.ts`, `src/sw-db.ts`, `src/utils/backgroundSync.ts`, `src/utils/storageMonitor.ts`, `src/config/sentry.ts`, and `src/api/errorHandlers.ts` have no unit tests at all; `tests/unit/utils/` contains only `offlineErrorHandler.test.ts` from this area. There is also no test asserting that a Supabase write actually persisted (read-back), which is what would have caught the silent photo-caption update.

### Partner — linking, interactions, display name

**11 findings** — 1 critical, 1 high, 6 medium, 3 low

> This area is the weakest I would expect to find in the codebase. The pure-function layer (interactionValidation, haptics, useVibration) is clean and correct, and the RLS posture on `interactions`/`partner_requests`/`users` is genuinely defensive — `accept_partner_request` is a well-written SECURITY DEFINER RPC that checks recipient identity, pending status, and pre-existing partnerships, and the users UPDATE policy correctly blocks partner_id privilege escalation. But the feature layer above it is largely non-functional: partner search cannot return a single row under the current users SELECT policy, so the entire linking flow is unreachable from the UI; the interactions realtime path uses postgres_changes on a table that no migration adds to the `supabase_realtime` publication (while two other modules in this repo explicitly document abandoning postgres_changes for exactly this class of problem); the notification badge is never seeded on app start and, once seeded, counts the user's own outgoing pokes; and the Fart button shows "Fart sent!" while sending nothing. What worries me most is that none of this is caught by anything — there is zero automated coverage of this entire area.

#### Critical · Partner search can never return a row under the current users RLS policy, making linking unreachable

**broken** · `src/api/partnerService.ts`:121 · effort **M**

```ts
        .neq('id', currentUser.user.id) // Exclude current user
```

**What you see:** On the Partner tab, typing any name or email into the search box always shows 'No users found matching "..."'. There is no way to find, request, or link a partner through the app at all.

**Why:** The final users SELECT policy is `USING (id = auth.uid() OR id = public.get_my_partner_id() OR partner_id = auth.uid())` (20260205000001_fix_users_rls_recursion.sql:33-37). For an unpartnered user the only visible row is their own, and searchUsers explicitly filters that row out with `.neq('id', currentUser.user.id)` before applying the ilike `.or()`. The result set is therefore empty by construction — the `.or()` never has a candidate row to match. The same policy also breaks getPendingRequests: the `.in('id', userIds)` enrichment at partnerService.ts:242 cannot read the requester's row, so `from_user_display_name` and `from_user_email` come back null and PartnerMoodView.tsx:448 renders received requests as 'Unknown User'.

**Reproduce:** Sign in as a user with no partner. Navigate to /partner. The 'Connect with Your Partner' panel renders. Type your partner's exact email into #partner-search and wait past the 300ms debounce. Expected: their row appears with a 'Send Request' button. Actual: 'No users found matching "..."' — a network trace shows GET /rest/v1/users?...&id=neq.<self> returning [].

**Fix:** Add a SECURITY DEFINER RPC (e.g. `search_users(p_query text, p_limit int)`) in a new migration that queries public.users with RLS bypassed, returns only id/email/display_name, requires `char_length(p_query) >= 2`, excludes `auth.uid()` and any row with `partner_id IS NOT NULL`, and is granted only to `authenticated`. Rewrite PartnerService.searchUsers to call it via supabase.rpc instead of `.from('users')`. Do the same for the request enrichment in getPendingRequests — either a `get_pending_partner_requests()` RPC that joins users server-side, or widen the users SELECT policy to include rows referenced by a pending partner_request involving auth.uid(). While there, fix partnerService.ts:173 which discards the PostgREST error from the target-user lookup, so the 'This user already has a partner' pre-check silently never fires.

#### High · unviewedCount is never seeded on app start, so interactions received while the app was closed produce no badge

**broken** · `src/stores/slices/interactionsSlice.ts`:62 · effort **S**

```ts
  unviewedCount: 0,
```

**What you see:** Your partner pokes you overnight. You open the app the next morning, go to the Partner tab, and the heart FAB shows no notification badge. The poke is invisible unless you happen to open the History modal.

**Why:** unviewedCount initialises to 0 and is only ever written in two places: incremented by addIncomingInteraction (live realtime events only) and recomputed inside loadInteractionHistory. `grep -rn loadInteractionHistory src` outside the slice returns exactly one call site — InteractionHistory.tsx:41, guarded by `if (isOpen)`. Nothing in App.tsx's init path, no slice bootstrap, and no PokeKissInterface mount effect ever calls it. So the badge at PokeKissInterface.tsx:404 can only reflect interactions that arrived during the current session while a live subscription happened to be attached.

**Reproduce:** Sign in as user B and close the tab. As user A, insert a poke to B (any path). Reopen the app as B and navigate to /partner. Expected: badge showing 1. Actual: no badge. Now open the FAB and click History — the poke is listed with a 'New' pill, proving the row exists and is unviewed.

**Fix:** Call `loadInteractionHistory()` when PokeKissInterface mounts (alongside the existing subscribeToInteractions effect at PokeKissInterface.tsx:120), or from the app initialisation path in appSlice once userId is known. Prefer a dedicated `loadUnviewedCount()` that calls the already-written but entirely unused `InteractionService.getUnviewedInteractions(userId)` (interactionService.ts:280) so the badge does not require pulling 100 history rows.

#### Medium · Interaction realtime uses postgres_changes on a table no migration adds to supabase_realtime

**broken** · `src/api/interactionService.ts`:185 · effort **S**

```ts
        'postgres_changes',
```

**What you see:** Partner sends a poke or kiss while you have the app open on the Partner tab. No badge appears on the heart FAB, no animation, nothing. The interaction only ever surfaces if you manually open the History modal.

**Why:** subscribeInteractions builds a `postgres_changes` INSERT listener on public.interactions. Realtime only emits postgres_changes for tables that are members of the `supabase_realtime` publication; `grep -rc supabase_realtime supabase/` returns no non-zero file, so nothing under supabase/ (26 migrations, config.toml, seed.sql) ever runs `ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions`. Delivery therefore depends entirely on out-of-band dashboard configuration that is not in the repo and does not survive `supabase db reset`. This is the same failure class the repo already documents twice and worked around: moodSyncService.ts:318-320 'uses Broadcast API instead of postgres_changes because RLS policies on moods table prevent postgres_changes from working' and useRealtimeMessages.ts:7-8 'postgres_changes doesn't work reliably for cross-user updates'.

**Reproduce:** Run `supabase db reset` against the local stack (or provision a fresh project purely from these migrations), sign in as two linked users in two browsers, open /partner in both, and have user A press Kiss. User B's FAB badge stays absent and addIncomingInteraction is never called. Verify with `select * from pg_publication_tables where pubname='supabase_realtime'` — no row for interactions.

**Fix:** Add a migration containing `ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions;`. Unlike moods, the interactions RLS predicate is a flat `auth.uid() = from_user_id OR auth.uid() = to_user_id` that Realtime can evaluate, so postgres_changes is viable here once publication membership exists — no Broadcast rewrite needed. Also surface the subscribe status: interactionService.ts:197-199 only logs it, so a CHANNEL_ERROR leaves the UI silently non-live.

#### Medium · unviewedCount counts the user's own outgoing pokes as unviewed notifications

**broken** · `src/stores/slices/interactionsSlice.ts`:181 · effort **S**

```ts
      const unviewedCount = interactions.filter((i) => !i.viewed).length;
```

**What you see:** You send your partner a kiss, open the History modal, close it, and the heart FAB now shows a '1' badge announcing '1 unviewed interaction' — for a kiss you sent yourself. The count stays inflated until your partner happens to open their app and view it.

**Why:** loadInteractionHistory stores the result of InteractionService.getInteractionHistory, whose query is `.or(from_user_id.eq.${userId},to_user_id.eq.${userId})` (interactionService.ts:237) — both directions. The `viewed` column is per-row, not per-side, and only the recipient can flip it (RLS UPDATE policy `auth.uid() = to_user_id`), so every interaction you sent sits at viewed=false in your own local array. Filtering on `!i.viewed` with no direction predicate therefore counts your own outbound sends as incoming notifications. getUnviewedInteractions (line 152-155) has the identical defect.

**Reproduce:** As a linked user with an empty history, press Kiss on the FAB (succeeds, toast 'Kiss sent!'). Open the FAB, click History, wait for the fetch, close the modal. The FAB now shows badge '1' with aria-label '1 unviewed interaction', even though nothing was received.

**Fix:** In loadInteractionHistory, count only received-and-unviewed: `interactions.filter((i) => !i.viewed && i.toUserId === currentUserId).length`. Apply the same `toUserId === get().userId` predicate in getUnviewedInteractions so the badge-click path can never select an outbound row.

#### Medium · Clicking the badge can pick an outbound interaction; the mark-as-viewed write is blocked by RLS and the failure is swallowed

**broken** · `src/components/PokeKissInterface/PokeKissInterface.tsx`:246 · effort **M**

```ts
    const interaction = unviewed[0];
```

**What you see:** You tap the notification badge expecting to see what your partner sent. Instead you get the animation for a poke you sent, the badge decrements, and after the next history refresh the same phantom count is back. The real received interaction is never shown or cleared.

**Why:** handleBadgeClick takes `unviewed[0]` from getUnviewedInteractions, which (per the finding above) includes outbound rows, and the array is newest-first so a just-sent poke sorts first. handleAnimationComplete then calls markInteractionViewed -> InteractionService.markAsViewed, which issues `.update({viewed:true}).eq('id', interactionId)` with no `.select()` and no row-count assertion. The UPDATE policy is `USING (auth.uid() = to_user_id)` (remote_schema.sql:316-321), so for an outbound row PostgREST matches zero rows and returns 204 with `error === null`. The catch block at interactionService.ts:336 never fires, the slice optimistically flips `viewed: true` locally and decrements unviewedCount, and the DB is untouched — so the next loadInteractionHistory resurrects the row.

**Reproduce:** Send a poke, open and close History so unviewedCount picks it up, then tap the purple badge on the FAB. The 👆 poke overlay plays and the badge disappears. Reopen History (which refetches) and close it: the badge is back at 1, and `select viewed from interactions where id = '<that id>'` is still false.

**Fix:** Two changes. (1) Filter getUnviewedInteractions by `toUserId === get().userId` so only received rows are selectable. (2) Make markAsViewed detect the no-op: append `.select('id')` and throw if the returned array is empty, so a blocked write surfaces instead of being optimistically applied. Additionally, mark received rows viewed when the History modal renders them, so the badge has a bulk-clear path rather than one-at-a-time animation gating.

#### Medium · The Fart button reports 'Fart sent!' but transmits nothing to the partner

**broken** · `src/components/PokeKissInterface/PokeKissInterface.tsx`:234 · effort **M**

```ts
      setShowToast('💨 Fart sent!');
```

**What you see:** You tap Fart, see the 💩 animation and a '💨 Fart sent!' toast, and are then locked out for 30 minutes. Your partner receives nothing — no badge, no animation, no history entry, ever.

**Why:** handleFart (lines 220-239) writes the localStorage cooldown, sets the local animation, and shows the toast. It never resolves a partnerId, never calls a store action, and never touches Supabase — unlike handlePoke (line 171 `await sendPoke(partnerId)`) and handleKiss (line 205). There is also no server-side representation available: the interactions type is constrained to `CHECK ((type = ANY (ARRAY['poke'::text, 'kiss'::text])))` (remote_schema.sql:89) and `InteractionType = 'poke' | 'kiss'` (interactionService.ts:31), so 'fart' has nowhere to go. The button additionally consumes a real 30-minute cooldown for a purely local effect, and unlike poke/kiss it has no partner-configured guard, so it 'works' even when no partner is linked.

**Reproduce:** As two linked users on /partner in separate browsers, user A opens the FAB and taps Fart. A sees the animation and toast. On B's device nothing appears; `select * from interactions where type='fart'` returns zero rows and would violate interactions_type_check if attempted.

**Fix:** Decide and make it honest. Either (a) extend the feature: migration to widen interactions_type_check to include 'fart', widen InteractionType and the FartAnimation dispatch in the incoming path, and route handleFart through a new sendFart store action mirroring sendPoke — or (b) drop the pretence: change the toast to something local ('💨 Nice one'), remove the 30-minute cooldown from the fart path since nothing is transmitted, and note in the component doc that fart is device-local.

#### Medium · There is no way to unlink a partner, and a wrong link is permanently unrecoverable for both users

**gap** · `supabase/migrations/20260205000001_fix_users_rls_recursion.sql`:53 · effort **M**

```ts
      partner_id IS NOT DISTINCT FROM public.get_my_partner_id()
```

**What you see:** Accept a request from the wrong person (or from someone you later want to disconnect from) and both accounts are permanently bound. Neither user can unlink, and neither can ever link to anyone else — they must abandon their accounts or have an operator run SQL.

**Why:** The only code path that writes users.partner_id is accept_partner_request (remote_schema.sql:207-211). The users UPDATE policy explicitly forbids the client from changing it — WITH CHECK requires `partner_id IS NOT DISTINCT FROM public.get_my_partner_id()`. There is no unlink RPC: `grep -rni 'unlink|disconnect_partner|remove_partner' supabase/` returns only scripture test-seed presets, nothing touching users.partner_id. PartnerSlice's action surface (lines 32-39) ends at hasPartner — there is no unlinkPartner. And accept_partner_request refuses to re-link: `IF EXISTS (SELECT 1 FROM users WHERE id IN (v_from_user_id, v_to_user_id) AND partner_id IS NOT NULL) THEN RAISE EXCEPTION 'One or both users already have a partner'` (lines 199-205). The only route back to NULL is `ON DELETE SET NULL` on the FK — i.e. deleting the other account.

**Reproduce:** User A sends B a request; B taps Accept on the wrong row. Both now have partner_id set. B searches the app for any unlink/disconnect control — none exists on /partner, in Settings, or anywhere else. B attempts to link to the correct person: accept_partner_request raises 'One or both users already have a partner'.

**Fix:** Add an `unlink_partner()` SECURITY DEFINER RPC in a new migration that clears partner_id on both `auth.uid()` and its current partner in one statement, declines any lingering pending partner_requests between them, and is granted only to `authenticated`. Expose it as `unlinkPartner()` on PartnerService and PartnerSlice, and add a confirm-guarded 'Disconnect partner' control to the connected state of PartnerMoodView. Cover it with a pgTAP test asserting both rows are cleared and that a third party cannot unlink someone else.

#### Medium · Interaction rate limiting is localStorage-only with no server-side or RLS-level guard

**risk** · `src/components/PokeKissInterface/PokeKissInterface.tsx`:44 · effort **M**

```ts
  const lastTime = localStorage.getItem(RATE_LIMIT_KEYS[type]);
```

**What you see:** The advertised 30-minute cooldown is trivially defeated — clear localStorage, use a private window, or post directly to the REST endpoint — and the recipient can be flooded with pokes/kisses that all land in their history and badge with no server-side ceiling. Nothing bounds row growth on the interactions table either.

**Why:** The entire limit lives in three localStorage keys read by getCooldownRemaining and written after a successful send (line 172). The server has no counterpart: the insert policy is `with check ((( SELECT auth.uid() AS uid) = from_user_id))` (remote_schema.sql:233) — it verifies only that you are not forging the sender. It does not check that to_user_id is your partner, does not check `from_user_id <> to_user_id` (the interactions table has no `different_users` CHECK, even though love_notes got one at remote_schema.sql:93), and imposes no frequency limit. The keys are also not namespaced per user, so on a shared device the cooldown carries across account switches. Grants were broadened to all authenticated roles in 20260725170000_grant_api_roles_on_public.sql, so RLS is the only gate.

**Reproduce:** On /partner, send a poke (cooldown starts, button disables and shows a countdown). Open devtools, run `localStorage.removeItem('lastPokeTime')`, and within a second the 1s interval at PokeKissInterface.tsx:110 resets pokeCooldown to 0 and re-enables the button. Repeat indefinitely — every send inserts a row and, once the realtime publication is fixed, fires a badge increment on the partner.

**Fix:** Enforce server-side. Add a migration with (a) `ALTER TABLE interactions ADD CONSTRAINT different_users CHECK (from_user_id <> to_user_id)`, (b) a WITH CHECK clause on the insert policy requiring `to_user_id = public.get_my_partner_id()` so interactions cannot be addressed to arbitrary user ids, and (c) a BEFORE INSERT trigger or a `send_interaction(type, to_user_id)` RPC that rejects when a row of the same (from_user_id, type) exists within the cooldown window. Keep the localStorage timer purely as UI affordance, and namespace its keys by userId so they do not leak across accounts on a shared device.

#### Low · Realtime channel leaks when the partner view unmounts before the subscribe promise resolves

**broken** · `src/components/PokeKissInterface/PokeKissInterface.tsx`:131 · effort **S**

```ts
        subscriptionRef.current = unsubscribe;
```

**What you see:** Navigating in and out of the Partner tab quickly accumulates orphaned Supabase Realtime channels for the session. Each is an open websocket topic that is never removed, and older ones become unremovable — over a long session this counts against the connection's channel budget and can stop new subscriptions from establishing.

**Why:** The subscribe effect stores the unsubscribe function asynchronously (line 131) but the cleanup at line 143 only fires `if (subscriptionRef.current)`. If the component unmounts while `await subscribeToInteractions()` is still in flight, cleanup sees null and does nothing; the promise then resolves and writes the unsubscribe function to a ref belonging to a dead component, so it is never invoked. The leak is compounded by InteractionService holding a single `this.realtimeChannel` field (line 182) on a module-level singleton keyed to a fixed channel name `'incoming-interactions'` (line 183) — the next subscribe overwrites the field, so the previous channel object is no longer reachable by any code path that could call removeChannel on it. The same effect's early-return guard at line 123 returns undefined instead of a cleanup function, which reproduces this deterministically on every StrictMode dev mount.

**Reproduce:** On /partner with a linked partner, tap another bottom-nav tab within a few hundred milliseconds of the view rendering (before the realtime handshake completes), then return to /partner. Repeat several times. `supabase.getChannels().length` in the console grows by one per cycle and never shrinks; only the most recent channel is reachable via interactionService.realtimeChannel.

**Fix:** Track an `isMounted`/`cancelled` flag in the effect: if the component unmounted before the promise resolved, immediately invoke the returned unsubscribe instead of storing it. Have the cleanup always run — replace the `return;` at line 123 with a cleanup-returning branch. In InteractionService, stop reusing one field and one fixed channel name: return the channel from subscribeInteractions in a closure (`const channel = supabase.channel(\`incoming-interactions:${userId}\`)`) so each subscription owns its own removable channel, and make the unsubscribe idempotent.

#### Low · Sign-out clears only auth identity; the previous user's interactions, badge count and partner stay in the store

**risk** · `src/stores/slices/authSlice.ts`:43 · effort **S**

```ts
  clearAuth: () => {
```

**What you see:** On a shared device, user A signs out and user B signs in without reloading the page. B's heart FAB shows A's leftover unviewed badge, and opening History briefly renders A's poke/kiss history with A's partner before the refetch replaces it.

**Why:** handleSignOut (App.tsx:116-130) calls signOut() and lets onAuthStateChange fire clearAuth — there is no page reload. clearAuth resets only userId/userEmail/isAuthenticated (lines 44-48). It does not touch interactionsSlice's `interactions`/`unviewedCount` (initial state at lines 61-62) or partnerSlice's `partner`/`sentRequests`/`receivedRequests`/`searchResults` (lines 44-50). Those arrays are only ever replaced wholesale by a successful refetch, and unviewedCount is only recomputed inside loadInteractionHistory — which, per the badge-initialisation finding, runs solely when the History modal is opened. So B's badge can carry A's count for the entire session, and InteractionHistory.tsx:55 reads `getInteractionHistory(7)` from the stale array during its own loading state.

**Reproduce:** Sign in as A on /partner, open History so interactions and unviewedCount populate, close it. Go to Settings and Log out. Without reloading, sign in as B. Navigate to /partner and open the FAB: the badge still shows A's count, and opening History shows A's rows while `isLoading` is true.

**Fix:** Add a `reset()` to interactionsSlice (`set({ interactions: [], unviewedCount: 0, isSubscribed: false })`) and to partnerSlice (`set({ partner: null, sentRequests: [], receivedRequests: [], searchResults: [] })`), and invoke them from clearAuth or from a single store-level `resetUserScopedState()` called on sign-out in App.tsx. Signing out should also tear down the interactions realtime channel, which currently survives until PokeKissInterface unmounts.

#### Low · PokeKissInterface and InteractionHistory subscribe to the entire Zustand store

**improvement** · `src/components/PokeKissInterface/PokeKissInterface.tsx`:70 · effort **S**

```ts
  } = useAppStore();
```

**What you see:** On the Partner tab, unrelated activity — mood sync ticks, scripture session state, love-note arrivals, network status flips — re-renders the FAB, all four animated action buttons, and the History modal subtree, contending with Framer Motion animations on low-end phones.

**Why:** `useAppStore()` called with no selector subscribes the component to every state change across all 11 slices. PokeKissInterface does this at lines 63-70 and is mounted for the whole lifetime of the connected partner view (PartnerMoodView.tsx:548). It only needs five stable action references plus the `unviewedCount` number. InteractionHistory does the same at line 31, and because it is rendered unconditionally at PokeKissInterface.tsx:451 it re-runs `getInteractionHistory(7)` at line 55 — which allocates a filtered array and sorts it — on every one of those renders, even while the modal is closed.

**Reproduce:** Open /partner with a linked partner and React DevTools Profiler recording with 'Highlight updates' on. Log a mood in another tab, or let any store-writing background sync run: PokeKissInterface and InteractionHistory both flash as re-rendered despite no interaction state having changed.

**Fix:** Replace the bare `useAppStore()` calls with narrow selectors — `useAppStore((s) => s.unviewedCount)` for the badge and individual `useAppStore((s) => s.sendPoke)` style picks for the actions (Zustand action identities are stable, so these never re-fire). In InteractionHistory, early-return `null` when `!isOpen` before computing history, or move the `getInteractionHistory(7)` call inside the open branch so the filter+sort does not run while the modal is closed.

**Test coverage in this area.** Total. There is not one test for `src/api/interactionService.ts`, `src/api/partnerService.ts`, `src/stores/slices/interactionsSlice.ts`, `src/stores/slices/partnerSlice.ts`, `PokeKissInterface`, `InteractionHistory`, or `DisplayNameSetup` — `grep -rln "PokeKiss|InteractionHistory|interactionService|interactionsSlice|partnerService|partnerSlice"` across all `*.test.ts`/`*.test.tsx`/`*.spec.ts` in src and tests returns zero files. The only unit coverage is `tests/unit/utils/interactionValidation.test.ts` (pure UUID/type validation) and `src/utils/__tests__/haptics.test.ts`. On the DB side, `supabase/tests/database/` has 14 pgTAP files and `grep -rln "interactions|partner_request"` across them returns zero — the `interactions` insert/update policies and both partner RPCs (`accept_partner_request`, `decline_partner_request`) have no RLS tests, despite `02_rls_policies.sql` existing for other tables. The only E2E file, `tests/e2e/partner/partner-mood.spec.ts`, stubs `**/rest/v1/users**` with a canned partnered response, so it structurally cannot exercise the search/link path or the badge lifecycle. Highest-value additions, in order: pgTAP for `accept_partner_request` (already-partnered, wrong-recipient, non-pending) and for the `interactions` UPDATE policy silently affecting zero rows; a unit test that `loadInteractionHistory` counts only received-unviewed; and a two-user E2E covering search -> request -> accept.

### App core — auth, routing, store, persistence, theming

**11 findings** — 1 high, 7 medium, 3 low

> The auth plumbing itself is clean — `sessionService`/`actionService` are small, well-factored, and correctly mirror the Supabase session into a synchronous `authSlice` plus an IndexedDB token for the service worker, and the persist layer has genuinely thoughtful corruption handling for the `shownMessages` Map. What worries me most is that sign-out is only half a sign-out: `clearAuth` resets three fields and nothing else, no store slice, localStorage key, or IndexedDB record is user-scoped or cleared, and both `hasInitialized` (App.tsx) and the module-level `isInitialized` (settingsSlice) make re-initialization impossible for the life of the tab — so an account switch on a shared device silently runs on the previous user's data and produces mood rows that RLS will reject forever. Second concern is blast radius on errors: `main.tsx` never wraps `<App/>`, and the entire authenticated shell (home view, bottom nav, modals) sits outside any boundary, so one render throw is a white screen with no recovery path, while `DisplayNameSetup` is an inescapable full-screen gate with no logout or skip. Routing and theming are the weakest-finished areas: `setView` pushes history unconditionally, entering via `/admin` disables popstate for the session, and the four-theme system has no UI entry point at all while 163 `dark:` variants respond only to the OS setting.

#### High · Sign-out clears only 3 auth fields; all user-scoped state survives and can never be re-initialized

**broken** · `src/stores/slices/authSlice.ts`:43 · effort **M**

```ts
  clearAuth: () => {
```

**What you see:** On a device where both partners sign in, the second user sees the first user's mood history, is told they "already logged a mood today" (pre-filled with the other person's moods and note), and any pending sync fails silently forever — the pending-mood badge never clears.

**Why:** `clearAuth` sets only `userId`/`userEmail`/`isAuthenticated` to null. Nothing clears the persisted `my-love-storage` key (partialize at useAppStore.ts:119-141 persists `settings`, `isOnboarded`, `messageHistory`, `moods`), nothing clears IndexedDB, and `moodService.getAll()` has no `user_id` filter so it returns every mood row on the device. Re-initialization is also impossible: App.tsx:266 guards on `hasInitialized.current`, a `useRef` that is never reset because App stays mounted across sign-out, and settingsSlice.ts:50 `let isInitialized = false` is a module singleton that latches true for the life of the tab. Leftover unsynced rows still carry the previous user's `userId`, so `moodApi.create()` inserts with `user_id = A` while `auth.uid() = B`, which the RLS policy `WITH CHECK (auth.uid() = user_id)` rejects on every retry. App.tsx:323 makes it worse: the `online` handler calls `syncPendingMoods()` with no session guard, so this retry loop also runs while sitting on the login screen.

**Reproduce:** 1. Sign in as user A on a device. 2. Open the Mood tab and log a mood (creates an IndexedDB row with `userId = A`). 3. Tap Logout — login screen appears. 4. Sign in as user B in the same tab. 5. Open the Mood tab: user A's mood for today is shown pre-filled with `isEditing = true` (MoodTracker.tsx:134-153 reads `getMoodForDate(today)` from the store). 6. Edit and save: `moodService.updateMood` writes to A's row, `syncPendingMoods` POSTs `user_id = A` under B's JWT, RLS rejects, and the pending count never reaches zero.

**Fix:** Add a `resetUserScopedState()` action that `clearAuth` (or a new `signOutCleanup` in App.tsx's SIGNED_OUT branch) calls: reset `moods`, `partnerMoods`, `syncStatus`, `messageHistory`, `notes`, `photos`, `partner*` and `scripture*` slices to their initial values, call `useAppStore.persist.clearStorage()`, and call `storageService.clearAllData()` (already exists at src/services/storage.ts:303) plus a `moodService.clear()`. Separately, drop the module-level `isInitializing`/`isInitialized` in settingsSlice.ts:49-50 in favour of store state keyed by `userId`, and reset `hasInitialized.current = false` in App.tsx's signed-out branch so `initializeApp()` re-runs per session. Add a `session` guard to the `handleOnline` sync at App.tsx:323.

#### Medium · The authenticated app shell has no error boundary — one render throw is an unrecoverable white screen

**gap** · `src/main.tsx`:44 · effort **S**

```ts
      <App />
```

**What you see:** Any uncaught error in the home view, the bottom navigation, the photo modals, or in one of App's own effects blanks the entire page. No message, no Try Again, no Clear Storage button — the only escape is for the user to know to clear site data manually.

**Why:** `ErrorBoundary` is applied to exactly four branches of App (LoginScreen 430, DisplayNameSetup 445, WelcomeSplash 496, AdminPanel 507) and `ViewErrorBoundary` only to the lazy non-home views (568). The main authenticated return at App.tsx:516-606 — `NetworkStatusIndicator`, `SyncToast`, `TimeTogether`, `BirthdayCountdown`, `EventCountdown`, `DailyMessage`, `BottomNavigation`, `PhotoUpload`, `PhotoCarousel` — is wrapped by nothing, and `main.tsx` renders `<App/>` bare inside `StrictMode`/`LazyMotion`. React unmounts the whole root when an error reaches it with no boundary. Effects count too: App.tsx:310 `applyTheme(settings.themeName)` throws a TypeError if `themeName` is not one of the four keys in `src/utils/themes.ts`, and since that runs on every load the app is permanently bricked with no in-app recovery — ironically the ErrorBoundary at ErrorBoundary.tsx:75-85 has exactly the "Clear Storage & Reload" button that would fix it.

**Reproduce:** Set `localStorage['my-love-storage']` to a payload whose `state.settings.themeName` is any string outside `sunset|ocean|lavender|rose` (this passes `validateHydratedState`, which only checks truthiness at useAppStore.ts:31). Reload: `getTheme` returns `undefined`, `theme.colors.primary` throws inside the effect at App.tsx:310, React finds no boundary, and the page renders blank on this and every subsequent load.

**Fix:** Wrap `<App />` in `src/main.tsx` with `<ErrorBoundary>` (inside `LazyMotion`, outside `App`) so every branch including the authenticated shell is covered, and additionally wrap the main return block in App.tsx:516-606 so an error in the home view doesn't take down the login screen path. Guard `applyTheme` in `src/utils/themes.ts:70` to fall back to `sunset` when `themes[themeName]` is undefined.

#### Medium · DisplayNameSetup is an inescapable full-screen gate — no skip, no logout, and it fails offline

**broken** · `src/App.tsx`:443 · effort **S**

```ts
  if (needsDisplayName) {
```

**What you see:** A signed-in user whose account has no `user_metadata.display_name` is locked out of the entire app — including every offline-capable feature — whenever the display-name write can't succeed. There is no cancel, no skip, and no sign-out button, so they can't even get back to the login screen.

**Why:** App.tsx:443 returns early with only `<DisplayNameSetup>`, so `BottomNavigation` (the only logout affordance, BottomNavigation.tsx:106-115) is never rendered. `needsDisplayName` is set from `newSession.user.user_metadata?.display_name` at App.tsx:236 on every auth event including `INITIAL_SESSION`, so it re-arms on every reload. `DisplayNameSetup` has exactly one interactive control — the submit button at DisplayNameSetup.tsx:161 — and its handler at DisplayNameSetup.tsx:60 calls `supabase.auth.updateUser(...)`, a network round-trip. On failure it just calls `setError(...)` and re-enables the button. This is an offline-first PWA (service worker, background sync, `NetworkStatusIndicator`) whose entire home view works offline, so a network-dependent hard gate is a contradiction.

**Reproduce:** 1. Sign in with an account that has no `display_name` in `user_metadata` (e.g. one created via the Supabase dashboard or plain email/password signup — `signUp` in actionService.ts:48 never sets it). 2. Go offline (airplane mode / DevTools offline). 3. Reload the app: `getSession()` returns the cached session, `INITIAL_SESSION` fires, `needsDisplayName` becomes true, the modal renders. 4. Type a name and submit: `updateUser` rejects, an error message appears, and there is no other control on the page. Reloading repeats the same state indefinitely.

**Fix:** Render `DisplayNameSetup` as an overlay on top of the normal app shell rather than as an early return, or add a "Skip for now" and a "Sign out" button to `DisplayNameSetup` that call `setNeedsDisplayName(false)` / `handleSignOut()`. Also queue the `updateUser` write for retry when back online instead of blocking on it.

#### Medium · A failed sign-out is swallowed — the user stays logged in with zero feedback

**broken** · `src/App.tsx`:126 · effort **S**

```ts
      console.error('[App] Sign-out failed:', error);
```

**What you see:** The user taps Logout while offline or during a network blip. The button greys out for a moment, comes back, and nothing else happens — they are still fully signed in with no indication that logout failed. On a shared device they will reasonably believe they signed out.

**Why:** `signOut()` in actionService.ts:73-91 rethrows on error, and App's `handleSignOut` catch block only writes to the console before `finally { setIsSigningOut(false) }`. Nothing sets a UI error state. This is not a theoretical path: auth-js `_signOut` calls `this.admin.signOut(accessToken, scope)` and, for anything other than a 404/401/403 AuthApiError (i.e. any network-level failure), returns the error *before* reaching `await this._removeSession()` — so the local session is deliberately left intact and the user really is still authenticated.

**Reproduce:** 1. Sign in. 2. Open DevTools and set the network to Offline (or block `**/auth/v1/logout`). 3. Tap the Logout button in the bottom nav. 4. Observe: the button briefly disables and re-enables, the app stays on the authenticated view, no toast or message appears, and `console.error('[App] Sign-out failed: …')` is the only trace.

**Fix:** Add an error state to `App` (or reuse `setError` from `appSlice`) and render it — e.g. a toast via the existing `SyncToast`-style pattern — in the `catch` at App.tsx:125-127. Also consider calling `supabase.auth.signOut({ scope: 'local' })` as a fallback so the device session is dropped even when the server can't be reached.

#### Medium · Entering via /admin skips route setup, disabling browser Back/Forward for the whole session

**broken** · `src/App.tsx`:147 · effort **S**

```ts
      return; // Don't set up navigation listeners for admin panel
```

**What you see:** After a user opens the admin panel and clicks "Exit Admin", the browser's Back and Forward buttons stop working for the rest of the session — the URL in the address bar changes but the rendered view does not, leaving URL and UI permanently out of sync.

**Why:** The route-detection effect at App.tsx:143-190 returns at line 147 as soon as `pathname.includes('/admin')`, before `window.addEventListener('popstate', handlePopState)` at line 185. The effect's dependency array is `[setView]` (line 190) and `setView` is a stable Zustand action, so the effect never re-runs. `handleAdminExit` (App.tsx:487-491) only flips `showAdmin` and rewrites the URL via `pushState`; it does not re-register the listener. From that point on, every subsequent `pushState` from `setView` builds history entries that nothing listens to.

**Reproduce:** 1. Navigate to `/My-Love/admin` (or `/admin` in dev). 2. Click "Exit Admin" — the home view appears at `/My-Love`. 3. Tap the "Mood" tab, then the "Notes" tab. 4. Press browser Back: the URL reverts to `/My-Love/mood` but the app still renders the Notes view.

**Fix:** Move the `popstate` listener registration above the admin check so it is always installed, and set `showAdmin` from a separate effect (or derive it) rather than short-circuiting the routing effect. Also apply the initial `setView(...)` on the admin path so `currentView` matches the URL after exit.

#### Medium · Home screen permanently shows two expired "Event passed" visit countdowns

**broken** · `src/config/relationshipDates.ts`:52 · effort **M**

```ts
      date: new Date(2025, 10, 26), // November 26, 2025 (month is 0-indexed)
```

**What you see:** The primary screen of the app — the first thing both partners see every session — shows two dead cards reading "Next Visit / Event passed" and "Following Visit / Event passed" for trips that happened eight months ago, alongside a "Wedding / XX:XX:XX / Date TBD" placeholder. There is no way for a user to update them.

**Why:** `RELATIONSHIP_DATES.visits` hardcodes `new Date(2025, 10, 26)` and `new Date(2025, 11, 20)` (Nov 26 and Dec 20, 2025). `App.tsx:549` maps over that array to render an `EventCountdown` for each. `EventCountdown` computes `calculateTimeDifference(now, date)` and, when `timeDiff.isPast`, renders the literal `Event passed` at EventCountdown.tsx:156-158. Because the dates live in a source file rather than in `settings` (which has an `anniversaries` array plus `addAnniversary`/`removeAnniversary` actions at settingsSlice.ts:210-241 that no UI ever calls), the only way to fix it is a code change and redeploy.

**Reproduce:** Open the app today (2026-07-25) on the Home view. The right-hand column shows: "Wedding — XX:XX:XX — Date TBD", "Next Visit — November visit — Event passed", "Following Visit — December visit — Event passed".

**Fix:** Either filter out past visits in `App.tsx:549` (`RELATIONSHIP_DATES.visits.filter(v => v.date >= startOfToday)`), or — better — move visits and the wedding date into `settings.relationship` and expose the existing `addAnniversary`/`removeAnniversary` actions through a small settings UI so the dates can be maintained without a redeploy.

#### Medium · The 4-theme system has no UI entry point, and 163 dark: variants fight the light-only theme

**gap** · `src/stores/slices/settingsSlice.ts`:244 · effort **M**

```ts
  setTheme: (theme) => {
```

**What you see:** Users can never change the theme — the app is permanently 'sunset' and three of the four themes are dead code. Worse, a user whose OS is set to dark mode gets a broken-looking screen: dark-grey timer cards and dark modals sitting on a light pink gradient page background, under a solid white bottom navigation bar.

**Why:** `rg -n "setTheme|applyTheme" src tests` returns only the declaration at settingsSlice.ts:45, the implementation at settingsSlice.ts:244, and the `applyTheme` import/call in App.tsx — no component ever invokes `setTheme`, so `themeName` can only ever be its initial `'sunset'`. Meanwhile `applyTheme` at themes.ts:82 unconditionally does `document.body.style.background = theme.gradients.background`, an inline style that always wins, and all four themes in `themes.ts` are light. `tailwind.config.js` sets no `darkMode` key, so Tailwind's `dark:` variant falls back to `@media (prefers-color-scheme: dark)` — driven purely by the OS and completely disconnected from the app's theme state. `rg -o "dark:" src --glob '*.tsx' | wc -l` gives 163 occurrences across 16 files (e.g. `dark:bg-gray-900` in EventCountdown.tsx:113 and TimeTogether.tsx:41), while `BottomNavigation.tsx:19` is hardcoded `bg-white` with no dark variant at all.

**Reproduce:** Set the OS/browser to dark mode and open the Home view. The `TimeTogether` and `EventCountdown` cards render `dark:bg-gray-900` (near-black) on top of the light `linear-gradient(135deg, #FFE5EC …)` body background set by `applyTheme`, and the fixed bottom nav renders solid white with grey icons. Separately, search the entire UI for any theme picker: there is none.

**Fix:** Pick one direction and finish it. Either (a) delete the unused theme machinery (`setTheme`, the non-sunset entries in `themes.ts`) and commit to `dark:` + OS preference, adding dark variants to `BottomNavigation.tsx:19` and making `applyTheme` emit a dark gradient under `prefers-color-scheme: dark`; or (b) keep the theme system, add `darkMode: ['class']` to `tailwind.config.js`, have `applyTheme` toggle a `dark` class on `documentElement` based on the selected theme, and expose `setTheme` through a settings UI.

#### Medium · Rehydrated settings bypass SettingsSchema — the pre-hydration validator only checks truthiness

**risk** · `src/stores/useAppStore.ts`:31 · effort **S**

```ts
    if (!state.settings.themeName) errors.push('Missing themeName');
```

**What you see:** Structurally invalid settings restored from localStorage flow straight into the store and are then used as if validated, producing a hard crash in an effect rather than a graceful fallback.

**Why:** Every write path validates — `setSettings` (settingsSlice.ts:168) and `updateSettings` (settingsSlice.ts:189) both call `SettingsSchema.parse` — but the read path does not. `validateHydratedState` checks only that `themeName` and `relationship` are truthy, and line 57-59 then downgrades even those to non-critical: `hasCriticalErrors` is true only for the two `messageHistory` shape errors, so a `settings` object that fails both checks still returns `isValid: true` and is handed to Zustand. `getTheme` (themes.ts:66) is a bare `themes[themeName]` lookup with no fallback, so any `themeName` outside the four-value union makes `applyTheme` throw at App.tsx:310 — and per the missing-root-boundary finding, that is a blank page on every subsequent load.

**Reproduce:** Write `{"state":{"settings":{"themeName":"midnight","relationship":{"startDate":"2025-10-18","partnerName":"G","anniversaries":[]}},"messageHistory":{"shownMessages":[]}},"version":0}` to `localStorage['my-love-storage']` and reload. `validateHydratedState` passes it (both checked fields are truthy), the store hydrates with `themeName: 'midnight'`, and the theme effect throws `TypeError: Cannot read properties of undefined (reading 'colors')`. The same shape is what an older build with a since-renamed theme would have left behind.

**Fix:** Run `SettingsSchema.safeParse(data.state.settings)` inside the custom `getItem` at useAppStore.ts:96 (and/or in `onRehydrateStorage`), dropping just `settings` back to defaults when it fails rather than passing it through. Independently, make `getTheme` in themes.ts:66 fall back to `themes.sunset` for unknown names.

#### Low · setView pushes a browser history entry even when the view is unchanged

**broken** · `src/stores/slices/navigationSlice.ts`:56 · effort **S**

```ts
      window.history.pushState({ view }, '', fullPath);
```

**What you see:** Tapping the same bottom-nav tab repeatedly (a very common gesture — people tap the active tab to "go back to the top") stacks up identical history entries. The Android back button and browser Back then require one press per tap before the user can leave the view or exit the app.

**Why:** `setView` unconditionally calls `set({ currentView: view })` and then `window.history.pushState(...)` whenever `skipHistory` is falsy. There is no `if (get().currentView === view) return;` short-circuit, and `BottomNavigation` wires every tab button straight to `onViewChange(view)` with no active-tab check (e.g. line 25 `onClick={() => onViewChange('home')}`). The same happens when `ViewErrorBoundary`'s "Go Home" (App.tsx:568) is pressed while already home.

**Reproduce:** 1. Open the app on the Home view. 2. Tap the "Mood" tab once, then tap "Mood" four more times. 3. Press browser/Android Back: the URL stays `/mood` and the view does not change. 4. You must press Back five times to return to Home.

**Fix:** In `createNavigationSlice.setView`, return early when `get().currentView === view && !skipHistory`, or swap `pushState` for `replaceState` when the target path already equals `window.location.pathname`.

#### Low · App subscribes to the entire Zustand store, re-rendering the whole tree on every store write

**improvement** · `src/App.tsx`:78 · effort **S**

```ts
  } = useAppStore();
```

**What you see:** Every single state change anywhere in the app — each incoming love note over realtime, each scripture presence heartbeat, each photo load, each `updateSyncStatus` tick — re-renders `App` and its whole unmemoized subtree (NetworkStatusIndicator, SyncToast, BottomNavigation, the active view, PhotoUpload, PhotoCarousel). On the Notes and Scripture views this is a continuous render storm.

**Why:** `useAppStore()` is called with no selector. In Zustand 5 that means `useStore(api, identity)`, and because every `set()` produces a new state object, the identity comparison always fails and the component re-renders on every store write regardless of which of the 11 slices changed. App only needs 8 fields (`settings`, `initializeApp`, `isLoading`, `currentView`, `setView`, `syncPendingMoods`, `updateSyncStatus`, `syncStatus`), five of which are stable action references. The same anti-pattern is in `AdminPanel.tsx:16` and `MessageList.tsx:14`.

**Reproduce:** Open the Notes view and have the partner send several messages (or run the scripture presence heartbeat). Add a `console.count('App render')` at the top of `App()` — the counter increments on every realtime payload and every 5-minute sync tick, even though none of App's own 8 destructured values changed.

**Fix:** Replace the bare `useAppStore()` with per-field selectors (`useAppStore((s) => s.currentView)` etc.), or a single `useShallow` selector from `zustand/react/shallow` over the 8 fields. Apply the same change to `AdminPanel.tsx:16` and `MessageList.tsx:14`.

#### Low · persist has version 0 and no migrate function — any future schema bump silently wipes user data

**risk** · `src/stores/useAppStore.ts`:84 · effort **S**

```ts
      version: 0, // State schema version (matches test fixtures)
```

**What you see:** The first time anyone bumps `version` to migrate the persisted schema, every existing user silently loses their theme/relationship settings, favourited messages, entire daily-message history (`shownMessages`), and the localStorage copy of their moods. The only signal is a `console.error` that no user will ever see.

**Why:** Zustand's persist middleware (middleware.mjs:389-406) checks `deserializedStorageValue.version !== options.version`; with no `options.migrate` it logs `"State loaded from storage couldn't be migrated since no migrate function was provided"` and falls through to `return [false, void 0]`, so the persisted state is discarded entirely and initial defaults are merged in. This store persists real user data — `partialize` at useAppStore.ts:119-141 includes `settings`, `messageHistory` (with `favoriteIds`, `viewedIds` and the serialized `shownMessages` Map) and `moods` — and there is no `migrate` option anywhere in the config. The comment on the line itself ("matches test fixtures") shows the version is currently pinned to test fixtures rather than to the schema, which makes an accidental bump more likely, not less.

**Reproduce:** With an existing user's localStorage in place (settings + favourites + 30 days of `shownMessages`), change `version: 0` to `version: 1` in useAppStore.ts:84 and reload. The console prints the migration error and the app comes up with default settings, zero favourites and an empty message history; the previous state is then overwritten on the next `setItem`.

**Fix:** Add a `migrate: (persistedState, version) => { … }` to the persist options that at minimum passes state through unchanged for known versions (and re-runs the Map deserialization logic), so a version bump can never fall into the discard branch. Decouple `version` from the test fixtures — have the fixtures read the version from the store config instead.

**Test coverage in this area.** There are zero tests for `src/App.tsx`, `src/stores/useAppStore.ts` (partialize / onRehydrateStorage / validateHydratedState / version), `authSlice`, `appSlice`, `navigationSlice`, `useAuth`, `ErrorBoundary`, `ViewErrorBoundary`, `useFocusTrap`, and `LoginScreen` — `find src tests -name '*.test.ts*' -o -name '*.spec.ts' | wc -l` returns 94 files, none covering these. The critical uncovered flows are: (a) account switch on one device — no test asserts that user B's store/IndexedDB is free of user A's moods after logout→login; (b) sign-out failure — `tests/e2e/auth/logout.spec.ts` only stubs a 204 success, never a network failure or non-2xx, so the silent-failure path at App.tsx:126 is untested; (c) persist schema migration — `version: 0` has no test asserting what happens to an existing user's localStorage on a version bump; (d) hydration of a structurally-valid-but-semantically-invalid `settings` object. `BottomNavigation.test.tsx` exists but only covers rendering/clicks, not the duplicate-history-entry behaviour of `setView`.

### Mood — entry, offline sync, history, partner mood

**10 findings** — 4 high, 5 medium, 1 low

> The UI layer of the mood feature is genuinely solid — memoized calendar cells, focus trap + ESC in the detail modal, ARIA grid roles, offline banners with a retry button, and 28 passing unit tests on the store slice. The weakness is concentrated entirely in the persistence/sync layer. Two independent writers (the in-app `moodSyncService` and the service worker's `sync` handler) POST the same queued mood with no idempotency key, and `moods` has no uniqueness constraint in Postgres, so a reconnect can silently double-write. Editing today's mood always re-INSERTs rather than UPDATEs, so each edit leaves another row behind that the partner sees. And the calendar's entire data source is device-local IndexedDB that is never scoped by user, never cleared on sign-out, and never hydrated from Supabase — so history vanishes on a second device and leaks across accounts on a shared one. The 929 lines of `moodSyncService.ts` + `moodApi.ts` that own all of this have zero unit tests.

#### High · Service worker and in-app sync both POST the same queued mood on reconnect — no idempotency key, no DB uniqueness

**risk** · `src/api/moodSyncService.ts`:84 · effort **M**

```ts
    const moodInsert: MoodInsert = {
```

**What you see:** After logging a mood while offline and then reconnecting, the same mood appears two (or more) times in the partner's mood list and in the Timeline tab. The duplicates are permanent — nothing ever reconciles or removes them.

**Why:** `moodInsert` at moodSyncService.ts:84-90 omits `id`, so Postgres assigns a fresh `gen_random_uuid()` on every insert. `MoodInsertSchema` does allow an optional `id` but nothing sets it. The `moods` table (base schema migration line 63) has no unique constraint on (user_id, day) — only `idx_moods_user_created`, a plain non-unique index. There are two independent writers: the window context (`App.tsx:323` `handleOnline` → `syncPendingMoods`) and the service worker (`sw.ts:112` `if (event.tag === 'sync-pending-moods')` → `fetch(POST /rest/v1/moods)`). Both fire on the same connectivity restoration, because `MoodTracker.tsx:211` registers the `sync-pending-moods` tag whenever a mood is saved offline. Both call their own `getPendingMoods`/`getUnsyncedMoods` and both see `synced === false`. The `isSyncing` guard at moodSlice.ts:206 only exists in the window's Zustand store and has no visibility into the service worker process, which runs in a separate JS realm.

**Reproduce:** Turn on airplane mode. Open the Mood tab, select 'happy', submit. The offline banner appears and `registerBackgroundSync('sync-pending-moods')` runs. Turn airplane mode off with the app still open in the foreground. The browser fires the SW `sync` event and the window `online` event at essentially the same moment; both read the one unsynced IndexedDB row and both POST it. Open the Partner tab on the other account and hit Refresh: 'Happy' is listed twice with identical timestamps.

**Fix:** Give each mood a stable client-generated identity at creation time. In `moodService.create` (src/services/moodService.ts:67) add a `clientId: crypto.randomUUID()` field to the stored entry and persist it in the IndexedDB record. Send it as the row `id` in both writers — `moodSyncService.syncMood` (line 84) and `sw.ts`'s `transformMoodForSupabase` (line 125) — and switch both inserts to an upsert with conflict-ignore semantics (`supabase.from('moods').upsert(moodInsert, { onConflict: 'id', ignoreDuplicates: true })` and `Prefer: resolution=ignore-duplicates` on the SW's REST call). Because `id` is the primary key, the second writer becomes a no-op and both converge on the same row.

#### High · Editing today's mood INSERTs a new Supabase row every time instead of updating the existing one

**broken** · `src/api/moodSyncService.ts`:93 · effort **M**

```ts
    const syncedMood = await moodApi.create(moodInsert);
```

**What you see:** Every time the user changes their mood or note for today, the partner's mood list gains another entry for today. After three tweaks the partner sees four separate 'today' cards, and the Timeline tab shows four rows under the 'Today' header.

**Why:** `moodService.updateMood` marks the entry unsynced at moodService.ts:133 (`synced: false, // Mark as unsynced after update`) but leaves `supabaseId` on the record untouched. `syncPendingMoods` then picks the entry up again and `syncMood` unconditionally calls `moodApi.create(moodInsert)` at line 93 — there is no branch that checks `mood.supabaseId` and routes to an UPDATE. `moodApi.update` exists (moodApi.ts:321) but `rg -n "moodApi\.(update|delete)" src/` finds hits only inside its own JSDoc examples; it is dead code. `markAsSynced` then overwrites `supabaseId` with the newest row's id (moodService.ts:243), so the previously created row is orphaned and unreachable from the client.

**Reproduce:** Log in, go to the Mood tab, select 'happy', submit. Wait for sync. Now select 'grateful' as well and press 'Update Mood'. Wait for sync. Add a note and press 'Update Mood' again. Sign in as the partner and open the Partner tab: three cards dated today — 'Happy', 'Happy, Grateful', 'Happy, Grateful' + note — instead of one.

**Fix:** In `MoodSyncService.syncMood` (src/api/moodSyncService.ts:75), branch on `mood.supabaseId`: when present call the already-written `moodApi.update(mood.supabaseId, moodInsert)` and return that record; when absent call `moodApi.create`. Note `MoodUpdateSchema` (src/api/validation/supabaseSchemas.ts:137) is missing `mood_types`, so it must be added there too or the multi-mood array will be dropped on update. Fall back to `create` if the update returns PGRST116 (row deleted server-side).

#### High · Local mood store is global, not per-user, and survives sign-out — second account sees and overwrites the first account's moods

**risk** · `src/stores/slices/moodSlice.ts`:156 · effort **L**

```ts
      const allMoods = await moodService.getAll();
```

**What you see:** On a browser where two accounts have both been used, the second user's Mood tab pre-fills with the first user's mood selection and note text, their Calendar shows the first user's mood history, and submitting a mood for today silently corrupts the first user's local entry while never syncing the second user's own mood.

**Why:** `MoodEntry` carries a `userId` field, but no read path filters on it: `loadMoods` calls `moodService.getAll()` (moodSlice.ts:156), `getUnsyncedMoods` calls `this.getAll()` (moodService.ts:217), and `getMoodsInRange` queries the `by-date` index with no user predicate (moodService.ts:186). `App.tsx:124` `await signOut()` does not clear the `moods` object store, and `useAppStore.ts:132` persists `moods: state.moods` to localStorage, which is likewise never cleared. The `by-date` index is declared `{ unique: true }` (dbSchema.ts:252) and that uniqueness is global, not per-user, so only one row can exist for a given calendar day across all accounts. `addMoodEntry` (moodSlice.ts:70) finds the other user's row via `get().moods.find((m) => m.date === today)` and routes to `updateMoodEntry`, which mutates the row in place. `moodService.updateMood` never rewrites `userId`, so the subsequent `syncMood` sends `user_id` = the *first* user's id while `auth.uid()` is the second user's — the RLS policy `WITH CHECK (auth.uid() = user_id)` rejects it, so it fails, stays `synced: false`, and is retried forever.

**Reproduce:** Sign in as user A on a browser, log 'sad' with note 'rough day'. Sign out from the bottom nav. Sign in as user B on the same browser. Open the Mood tab: the note textarea is pre-filled with 'rough day', 'Sad' is highlighted, and the button reads 'Update Mood'. Open the Calendar tab: A's mood history is visible. Select 'happy' and press Update — A's local entry is overwritten and B's mood never reaches Supabase (the sync retries four times per pass and fails with a 42501 RLS error every time).

**Fix:** Scope the local store by user. Add a `by-user-date` compound index in `upgradeDb` (src/services/dbSchema.ts) as a DB v6 upgrade and change the unique constraint from `date` alone to `[userId, date]`. Filter every read in `src/services/moodService.ts` (`getMoodsInRange`, `getUnsyncedMoods`) and `moodSlice.loadMoods` by the authenticated `userId`. Separately, clear the mood cache on sign-out: call `moodService.clear()` and reset `moods`/`partnerMoods` in the store from `App.tsx`'s `handleSignOut`, and drop `moods` from the `partialize` list in `src/stores/useAppStore.ts:132` (it is already the IndexedDB source of truth, so persisting it to localStorage only duplicates data and grows unbounded).

#### High · Calendar reads only device-local IndexedDB and is never hydrated from Supabase — history is empty on any second device

**broken** · `src/components/MoodHistory/MoodHistoryCalendar.tsx`:68 · effort **L**

```ts
      const fetchedMoods = await moodService.getMoodsInRange(startOfMonth, endOfMonth);
```

**What you see:** A user who installs the PWA on a second device (or clears site data, or has IndexedDB evicted under storage pressure) sees a completely blank mood calendar and a 'pending sync' count of 0, while the Timeline tab in the same app shows the full history. Two tabs of the same feature disagree about how many moods the user has logged.

**Why:** The calendar's only data source is `moodService.getMoodsInRange`, which reads the local `moods` object store (moodService.ts:186-196). `rg -n "moodService\." src/` shows the only writers into that store are `moodService.create` (moodSlice.ts:79) and `markAsSynced` (moodSyncService.ts:223) — there is no download path that writes Supabase rows into IndexedDB. `loadMoods` likewise reads only `moodService.getAll()` (moodSlice.ts:156). The Timeline tab, by contrast, goes straight to the server via `moodApi.getMoodHistory` (useMoodHistory.ts:58). The two views of the same feature were implemented against different stores and have drifted: the calendar is write-through-local-only, the timeline is server-only, and neither reconciles with the other. IndexedDB is also not persistent by default, so eviction is silent data loss for the calendar.

**Reproduce:** Log moods for a week on a phone and let them sync. Open https://sallvainian.github.io/My-Love/ on a laptop and sign in as the same user. Mood tab → 'Calendar': every day is grey, footer count absent. Switch to 'Timeline' in the same session: all seven moods are listed.

**Fix:** Add a hydration step to `moodSlice.loadMoods` (src/stores/slices/moodSlice.ts:153): when online, call `moodApi.fetchByDateRange` (already written, src/api/moodApi.ts:193) for the relevant window and upsert any server rows missing locally into IndexedDB keyed on `supabaseId`, then read back from IndexedDB. Alternatively, and more simply, switch `MoodHistoryCalendar.loadMoodsForMonth` (line 62-90) to read from Supabase via `moodApi.fetchByDateRange` with the IndexedDB result merged in for not-yet-synced entries, so calendar and timeline share one source of truth.

#### Medium · subscribeMoodUpdates returns an unsubscribe that closes over the singleton field, not the channel it created — channels leak and stay subscribed

**broken** · `src/api/moodSyncService.ts`:390 · effort **M**

```ts
      if (this.realtimeChannel) {
```

**What you see:** Toggling connectivity (or navigating away) while a subscription is still being established leaves an orphaned Realtime channel open for the rest of the session. The Partner view then shows 'Disconnected' in the status pill even though a live channel is delivering broadcasts, and each subsequent reconnect stacks another zombie channel, so the 'just logged a mood' toast can fire several times for one partner mood.

**Why:** `MoodSyncService` keeps one instance field `this.realtimeChannel` (line 46) that `subscribeMoodUpdates` overwrites at line 360 without removing whatever was there. The returned closure checks `if (this.realtimeChannel)` (line 390) and removes *that* field, not the channel the call created — so whoever unsubscribes last wins and any earlier channel is unreachable. `PartnerMoodView`'s effect makes this reachable: `setupSubscription()` is fired and forgotten at line 201, `unsubscribe` is assigned only after `await moodSyncService.subscribeMoodUpdates(...)` resolves (line 163), and the cleanup at line 214 tests `if (unsubscribe)`. There is no `isMounted` guard (unlike `usePartnerMood.ts:100`, which does have one). If the effect re-runs or unmounts before the `await supabase.auth.getSession()` inside `subscribeMoodUpdates` resolves, cleanup sees `unsubscribe === null`, does nothing, and the promise then resolves and installs a channel nobody holds a handle to.

**Reproduce:** Open the Partner tab with a connected partner. Toggle the device offline and back online in under a second (the effect deps are `[syncStatus.isOnline, fetchPartnerMoods]`, so it tears down and re-runs). The offline pass's cleanup runs while `unsubscribe` is still null, so nothing is removed; the in-flight `getSession()` then resolves and assigns `this.realtimeChannel` to a channel that is now orphaned. Have the partner log a mood: the pink toast fires twice, and the status pill reads 'Disconnected' while broadcasts are still arriving.

**Fix:** Capture the channel in a local const inside `subscribeMoodUpdates` (src/api/moodSyncService.ts:360) and have the returned closure call `supabase.removeChannel(localChannel)` on that captured reference, guarded by an idempotency flag; drop the shared `this.realtimeChannel` field or make it a `Set` for diagnostics only. Separately, add an `isMounted` guard to `PartnerMoodView`'s effect (line 161-204) that calls `unsubscribeFn()` immediately when the effect has already been torn down, mirroring `usePartnerMood.ts:100-103`.

#### Medium · Timeline shows 'No mood history yet' instead of the error whenever the first page fails to load

**broken** · `src/components/MoodTracker/MoodHistoryTimeline.tsx`:165 · effort **S**

```ts
  if (!isLoading && moods.length === 0) {
```

**What you see:** When mood history fails to load — offline, expired session, or any Supabase error — the Timeline tab tells the user 'No mood history yet / Start logging your moods to see your emotional journey'. A user with months of logged moods is told they have none, with no error and no retry affordance.

**Why:** The empty-state guard at line 165 returns before the error guard at line 170 (`if (error) {`). On a failed first page, `useMoodHistory` sets `error` but leaves `moods` at `[]` and `isLoading` at `false` (useMoodHistory.ts:63-68), which is exactly the condition line 165 tests. The error branch is therefore only reachable when a *subsequent* `loadMore` fails after at least one page already succeeded. `moodApi.getMoodHistory` throws unconditionally when offline (`if (!isOnline()) throw handleNetworkError(...)` at moodApi.ts:430), so going offline reliably produces the misleading empty state.

**Reproduce:** Log several moods and let them sync. Go offline. Open the Mood tab and press 'Timeline'. `moodApi.getMoodHistory` throws immediately on the `isOnline()` check, `error` is set to the network message, but the rendered output is the 📊 'No mood history yet' empty state.

**Fix:** In `src/components/MoodTracker/MoodHistoryTimeline.tsx`, move the `if (error)` block (line 170) above the `if (!isLoading && moods.length === 0)` block (line 165), and add a retry button to the error state that re-invokes the initial load. Expose a `retry` callback from `useMoodHistory` (src/hooks/useMoodHistory.ts) by lifting `loadInitialMoods` out of the effect body into a `useCallback` the effect calls.

#### Medium · Realtime broadcast handler drops mood_types, collapsing the partner's multi-mood entry to a single emoji

**broken** · `src/api/moodSyncService.ts`:370 · effort **S**

```ts
        const mood: SupabaseMoodRecord = {
```

**What you see:** When the partner logs 'Happy + Grateful + Loved' the live update shows only '😊 Happy'. After a manual refresh or app reload the same entry correctly shows '😊✨❤️ Happy, Grateful, Loved' — so the display silently changes meaning behind the user's back.

**Why:** The sender includes the array — `mood_types: mood.mood_types,` at moodSyncService.ts:139 — but the receive-side reconstruction at lines 370-377 builds the `SupabaseMoodRecord` from only `id`, `user_id`, `mood_type`, `note`, `created_at`, and `updated_at`. `mood_types` is omitted entirely. It type-checks because `SupabaseMoodSchema` declares `mood_types` as `.nullable().optional()` (src/api/validation/supabaseSchemas.ts:115). `PartnerMoodDisplay` then hits its legacy fallback at line 107-109 (`partnerMood.mood_types && partnerMood.mood_types.length > 0 ? ... : [partnerMood.mood_type]`) and renders one emoji.

**Reproduce:** Sign in as user A on one browser and user B on another. On B's Mood tab, select Happy, Grateful and Loved and press 'Log Mood'. Watch A's Mood tab: the pink 'Your partner is feeling:' card updates live to '😊 Happy' only. Reload A's page — it now reads '😊✨❤️ Happy, Grateful, Loved'.

**Fix:** Add `mood_types: payload.payload.mood_types,` to the object literal at src/api/moodSyncService.ts:370-377. Better, run the payload through `SupabaseMoodSchema.safeParse` before invoking the callback so any future field added to the send side at line 132-143 but forgotten on the receive side fails loudly rather than silently degrading.

#### Medium · Debounced month navigation reads stale year/month, so two quick taps still move only one month

**broken** · `src/components/MoodHistory/MoodHistoryCalendar.tsx`:107 · effort **S**

```ts
    navDebounceRef.current = setTimeout(() => {
```

**What you see:** Tapping the back-chevron three times quickly to reach a month a quarter ago moves the calendar back exactly one month. Every single tap also feels broken because nothing at all happens for 300ms — no header change, no loading skeleton.

**Why:** `handlePreviousMonth` is a `useCallback` over `[currentYear, currentMonth]` (line 112). The scheduled callback at line 107-111 computes `navigateToPreviousMonth(currentYear, currentMonth)` from the closure. Because clicking does not change state until the timer fires, no re-render happens between rapid clicks, so the second click clears the pending timer (line 103-105) and schedules a new one that closes over the *same* `currentYear`/`currentMonth` and therefore computes the same destination. N clicks within the 300ms window collapse to one month of movement rather than N. `handleNextMonth` (line 119-129) has the identical structure, and the ArrowLeft/ArrowRight keyboard handler at line 159-163 routes through the same functions, so held arrow keys are affected too.

**Reproduce:** Open Mood → Calendar in July 2026. Tap the left chevron three times within about half a second. The header goes to 'June 2026' and stops. Expected 'April 2026'.

**Fix:** Make the scheduled update functional so it reads current state instead of a captured value. Replace the `year`/`month` pair with a single `useState<{year:number;month:number}>` and in the timeout call `setCurrentDate((prev) => navigateToPreviousMonth(prev.year, prev.month))`. With that change the debounce can also be dropped entirely: update the month state synchronously on click for instant feedback and debounce only the `loadMoodsForMonth` query inside the effect at line 93-95.

#### Medium · The entire offline sync and reconciliation layer (929 lines) has zero unit tests

**gap** · `src/api/moodSyncService.ts`:189 · effort **M**

```ts
  async syncPendingMoods(): Promise<SyncResult> {
```

**What you see:** The code that decides whether a user's offline-logged mood survives has no automated coverage, so the duplicate-write and duplicate-edit defects above shipped and are not caught by any of the 896 passing tests.

**Why:** `find . -name '*moodSync*' -o -name '*moodApi*'` returns only `src/api/moodSyncService.ts`, `src/api/moodApi.ts` and their coverage HTML — no test file exists for either (451 + 478 = 929 lines per `wc -l`). `tests/unit/stores/moodSlice.test.ts:209` does exercise `syncPendingMoods`, but the slice test mocks `moodSyncService` wholesale, so it asserts the slice's `isSyncing` bookkeeping and nothing about the batch loop at moodSyncService.ts:216-238, the exponential-backoff retry at line 269-310, the `markAsSynced` reconciliation at line 223, or the broadcast payload transform at line 370. `src/sw.ts`'s `syncPendingMoods` (line 151) is likewise untested. This is not a cosmetic gap — it is the data-loss path for every mood logged offline.

**Reproduce:** Run `npm run test:unit` (896 pass). Then edit `src/api/moodSyncService.ts:223` to delete the `await moodService.markAsSynced(mood.id, syncedMood.id);` call — which would make every synced mood re-upload forever — and re-run. All 896 tests still pass.

**Fix:** Add `tests/unit/api/moodSyncService.test.ts` with `supabase`, `moodApi` and `moodService` mocked, covering: (a) a mood carrying `supabaseId` must not produce a second `moodApi.create` call — the regression test for the edit-duplicates defect; (b) `syncPendingMoods` marks each success via `markAsSynced` with the returned server id and continues past a failing entry; (c) `syncMoodWithRetry` stops after 4 attempts and does not retry a permanent 42501 RLS rejection; (d) the broadcast receive handler preserves `mood_types`. Add `tests/unit/api/moodApi.test.ts` asserting the offline `isOnline()` guards throw and that a schema-invalid server response surfaces `ApiValidationError`.

#### Low · getRelativeTime uses wall-clock hours while date headers use calendar days — the same mood reads 'Yesterday' under a 'Nov 15' header

**broken** · `src/utils/dateUtils.ts`:23 · effort **S**

```ts
  const diffDays = Math.floor(diffMs / 86400000);
```

**What you see:** In the Timeline, a mood logged Monday evening, viewed early Wednesday morning, appears under a header reading 'Nov 15' (Monday) but its own timestamp reads 'Yesterday'. On the Mood tab, the partner's Monday-evening mood is labelled 'Yesterday' on Wednesday morning.

**Why:** `getRelativeTime` computes `diffDays` from elapsed milliseconds (dateUtils.ts:23) rather than calendar-day boundaries, then returns 'Yesterday' for any `diffDays === 1` (line 28). A mood at Monday 18:00 viewed Wednesday 01:00 is 31 elapsed hours → `Math.floor(31/24) === 1` → 'Yesterday', even though yesterday was Tuesday. The day header for the same mood comes from `getDateLabel` in moodGrouping.ts:66, which measures from the mood's *local midnight* (`new Date(dateKey)` where `dateKey = date.toDateString()`), giving 49 hours → `2` → the Intl-formatted 'Nov 15'. The correct helper already exists in the same file — `getDaysSince` at dateUtils.ts:176 zeroes both sides with `setHours(0,0,0,0)` — but only `formatRelativeDate` uses it; `getRelativeTime` does not.

**Reproduce:** Log a mood at 6pm on a Monday. Open the app at 1am on the Wednesday. Mood tab → Timeline: the row sits under the 'Nov 15' header (Monday) while its own timestamp text says 'Yesterday'. The same 31-hour window makes the partner card on the Mood tab say 'Yesterday' for a Monday mood.

**Fix:** In `src/utils/dateUtils.ts`, change `getRelativeTime` to derive its day count from the existing `getDaysSince(past)` helper (line 176) instead of `Math.floor(diffMs / 86400000)` at line 23, keeping the sub-24-hour minute/hour branches as-is but gating them on `getDaysSince(past) === 0`. That makes 'Yesterday' mean the previous calendar day and brings it into agreement with `moodGrouping.getDateLabel`. Add a unit test that fixes the clock to Wednesday 01:00 and asserts a Monday 18:00 timestamp does not render 'Yesterday'.

**Test coverage in this area.** `find . -name '*moodSync*' -o -name '*moodApi*'` returns only the source files and coverage HTML — there is no unit test file for either `src/api/moodSyncService.ts` (451 lines) or `src/api/moodApi.ts` (478 lines). That leaves the whole offline queue untested: `syncPendingMoods` batch loop, `syncMoodWithRetry` exponential backoff, `markAsSynced` reconciliation, broadcast send, and broadcast-receive payload transform. `tests/unit/stores/moodSlice.test.ts` mocks `moodSyncService` wholesale, so it proves the slice calls the service but nothing about what the service does. `tests/unit/services/moodService.test.ts` covers IndexedDB CRUD but never asserts the `by-date` unique-index collision path or multi-user isolation. There is also no test that a mood edited twice produces one Supabase row rather than three, and no test at all for `src/sw.ts`'s `syncPendingMoods()`. `moodGrouping` has two duplicate test files (`tests/unit/utils/` and `src/utils/__tests__/`), but neither covers the `getRelativeTime` vs `getDateLabel` disagreement described below.

### Love Notes & Photos

**11 findings** — 6 high, 4 medium, 1 low

> The Love Notes chat is the healthier half: optimistic send, retry-with-cached-blob, blob-URL revocation, signed-URL caching with LRU + in-flight dedup, and DOMPurify on render are all genuinely well built. The Photos half is the weak side — it has two upload components (only the raw-file one is wired up, the compressing one is dead), two photo viewers (only one reachable), and every store action swallows its own errors so the UI reports success on failure. My biggest worries, in order: (1) an image-only love note can never be saved because the `love_notes` CHECK constraint requires `char_length(content) >= 1`, and each attempt leaves an orphaned object in the storage bucket; (2) the gallery upload path skips compression entirely while the modal says "Compressing…", and then always shows "Photo uploaded! ✨" even when the upload was rejected; (3) the `love-notes:{userId}` broadcast channel is public — unlike the scripture channels in the same repo, which are `private: true` and RLS-guarded — so any authenticated user can read or spoof another user's incoming messages.

#### High · Sending an image with no caption always fails — DB CHECK requires content length >= 1

**broken** · `src/components/love-notes/MessageInput.tsx`:131 · effort **S**

```ts
      const sanitizedContent = hasContent ? sanitizeMessageContent(content) : '';
```

**What you see:** User picks a photo, leaves the caption box empty, taps Send. The bubble appears, the image uploads, then it flips to a red-bordered "Failed to send · Tap to retry". Tapping retry re-uploads the image and fails again, forever. Text+image messages work fine, so it looks random to the user.

**Why:** MessageInput allows sending with only an image (`canSend = (hasValidContent || hasImage) && !isSending`, line 202) and passes `''` as the content. notesSlice.sendNote inserts that empty string into `love_notes.content` (notesSlice.ts:373). The table has `alter table "public"."love_notes" add constraint "love_notes_content_check" CHECK (((char_length(content) <= 1000) AND (char_length(content) >= 1)))` (remote_schema.sql:113), so Postgres rejects the row with a 23514 check violation. The image has already been uploaded to storage by that point, so every attempt also leaks an orphaned object.

**Reproduce:** Open Love Notes, tap the image button, choose any valid JPEG, leave the textarea empty, tap Send. Observe the optimistic bubble show the image, then switch to the error state. Check `love_notes` — no row. Check the `love-notes-images` bucket — one object per attempt, all unreferenced.

**Fix:** Either relax the constraint to allow empty content when `image_url IS NOT NULL` (new migration: drop `love_notes_content_check`, re-add as `CHECK (char_length(content) <= 1000 AND (char_length(content) >= 1 OR image_url IS NOT NULL))`), or have `notesSlice.sendNote` substitute a non-empty placeholder. The migration route is correct — the client already treats image-only as a supported case. Additionally, in `sendNote`'s insert-error branch (notesSlice.ts:379-392) call `deleteLoveNoteImage(storagePath)` so the failed attempt does not orphan a storage object.

#### High · Photo upload modal always shows "Photo uploaded! ✨" — photosSlice.uploadPhoto never throws

**broken** · `src/components/PhotoUpload/PhotoUpload.tsx`:89 · effort **S**

```ts
      setStep('success');
```

**What you see:** User uploads a photo that the server rejects (over the bucket's 10MB limit, quota above 95%, RLS failure, network drop). The modal shows the green check and "Photo uploaded! ✨", auto-closes after 3s, and the photo is nowhere in the gallery. No error is ever shown.

**Why:** `photoService.uploadPhoto` catches everything and returns `null` (photoService.ts:371-374). `photosSlice.uploadPhoto` turns that into a thrown Error internally but catches it in its own `catch` and only writes `set({ error: errorMsg, ... })` (photosSlice.ts:117-124); the quota-rejection branch just `return`s (photosSlice.ts:76). So the promise `await uploadPhoto(input)` always resolves. PhotoUpload's `try/catch` can therefore never fire, and it unconditionally reaches `setStep('success')`. PhotoUpload destructures only `{ uploadPhoto, storageWarning }` from the store (line 14) — it never reads `state.error`, so the recorded error has no consumer.

**Reproduce:** Set the account near quota, or select a 12MB JPEG (allowed by PhotoUpload's own 50MB check but over the bucket's 10485760-byte `file_size_limit`). Tap Upload. Modal shows success and closes; refresh the gallery — the photo is absent.

**Fix:** Make `photosSlice.uploadPhoto` rethrow after recording the error (or return a `boolean`/result object), and have `PhotoUpload.handleUpload` branch on it before `setStep('success')`. Also subscribe PhotoUpload to `state.error` so slice-level failures render in the existing error panel (line 364).

#### High · Gallery uploads send the raw file — compression is never called on the live upload path

**broken** · `src/components/PhotoUpload/PhotoUpload.tsx`:77 · effort **M**

```ts
        file: selectedFile,
```

**What you see:** Every gallery photo is stored at full original size. The modal claims "Will compress to ~X KB" and "Compressing and saving...", but a 8MB phone photo consumes 8MB of the 1GB quota. Anything over 10MB is silently rejected by the bucket (and, per the finding above, still reported as success).

**Why:** PhotoUpload.tsx never imports `imageCompressionService` — its only imports are framer-motion, lucide-react, react, and useAppStore (lines 1-4). `handleUpload` builds `PhotoUploadInput` with `file: selectedFile` (the raw `File`) and only loads an `Image` to read `naturalWidth/naturalHeight` for metadata. `photoService.uploadPhoto` uploads `input.file` verbatim. Meanwhile PhotoUpload's own size gate allows 50MB (`const maxSize = 50 * 1024 * 1024;`, line 44) while the bucket is created with `file_size_limit` 10485760 (10MB). The compressing implementation exists only in `src/components/photos/PhotoUploader.tsx`, which is not imported anywhere.

**Reproduce:** Upload a 6MB JPEG through the gallery FAB. Query `select file_size from photos order by created_at desc limit 1` — it equals the original 6MB byte count, not ~300-500KB. Upload a 12MB JPEG — storage returns 413, but the modal still shows success.

**Fix:** In `PhotoUpload.handleUpload`, call `await imageCompressionService.compressImage(selectedFile)` and build the input from `result.blob` / `result.width` / `result.height` / `result.blob.type`, exactly as `photos/PhotoUploader.tsx:171-181` already does. Then delete the duplicate PhotoUploader (see the dead-code finding) so only one implementation exists. Lower the 50MB client gate to match `IMAGE_VALIDATION.MAX_FILE_SIZE_BYTES`.

#### High · love-notes broadcast channel is public — any authenticated user can read or forge another couple's messages

**risk** · `src/stores/slices/notesSlice.ts`:413 · effort **M**

```ts
        const channel = supabase.channel(`love-notes:${partnerId}`);
```

**What you see:** Any signed-in account can subscribe to another user's love-notes topic and receive the full plaintext and image path of every note delivered to them in real time. The same account can broadcast a forged `new_message` payload into a victim's chat, which renders as a message from their partner.

**Why:** Both the sender's channel (`notesSlice.ts:413`) and the receiver's channel (`useRealtimeMessages.ts:67-68`) are created without `{ config: { private: true } }`, so they are public Realtime broadcast topics — authorization is 'any valid JWT', and no `realtime.messages` RLS policy in `supabase/migrations/` matches `topic like 'love-notes:%'`. The scripture feature in this same repo does it correctly: `supabase.channel(channelName, { config: { broadcast: { self: false }, private: true } })` plus explicit SELECT/INSERT policies on `realtime.messages` (20260220000001_scripture_lobby_and_roles.sql:71-97). On receipt, `handleNewMessage` passes the payload straight to `addNote` with no check that `message.to_user_id === userId` or that `from_user_id` is the actual partner (useRealtimeMessages.ts:39-57).

**Reproduce:** Sign in as any user, open devtools, run `window.__APP_STORE__ && supabase.channel('love-notes:<other-user-uuid>').on('broadcast',{event:'new_message'},console.log).subscribe()`. Every note sent to that user prints in full. Conversely, `channel.send({type:'broadcast',event:'new_message',payload:{message:{id:crypto.randomUUID(),from_user_id:'<partner-uuid>',to_user_id:'<victim-uuid>',content:'forged',created_at:new Date().toISOString()}}})` renders a fake partner message in the victim's open chat.

**Fix:** Add `{ config: { private: true } }` to both `supabase.channel()` calls, and add a migration creating `realtime.messages` SELECT/INSERT policies scoped to `topic like 'love-notes:%'` where `split_part(topic, ':', 2)::uuid` is the caller or the caller's `partner_id` — mirroring the scripture policies. Also validate in `handleNewMessage` that `message.to_user_id === userId` before calling `addNote`.

#### High · Deleting a photo in PhotoViewer leaves the deleted photo on screen behind a permanent spinner

**broken** · `src/components/PhotoGallery/PhotoViewer.tsx`:302 · effort **M**

```ts
        const nextIndex = canNavigateNext ? currentIndex : currentIndex - 1;
```

**What you see:** User opens a photo that is not the last in the list, taps the trash icon, confirms Delete. The dialog closes and the viewer shows a black screen with a spinning loader that never stops — still on the photo that was just deleted.

**Why:** The `photos` array is a prop from PhotoGallery's local state, which is never updated by the store delete. So after `deletePhoto`, `photos` still contains the deleted entry and `canNavigateNext` is still true — meaning `nextIndex` evaluates to `currentIndex`, i.e. no navigation at all. `resetTransform()` then runs `setIsLoading(true)` (line 172), but the `<motion.img key={currentPhoto.id}>` (line 456) has an unchanged key, so React does not remount it, no `onLoad` fires, `isLoading` stays true forever, and `style={{ opacity: isLoading ? 0 : 1 }}` keeps the image invisible under the spinner.

**Reproduce:** Have 3+ photos. Open the first one in the gallery viewer. Delete it. Observe the viewer stays on index 0 with a permanent spinner. Arrow-right still lists the deleted photo in the "Photo 1 of N" counter.

**Fix:** Lift photo list ownership: have PhotoViewer read `photos` from the store (as PhotoCarousel does) instead of taking a stale prop, or have PhotoGallery pass a `onPhotoDeleted(id)` callback that removes the id from its local `photos` state. Then clamp `currentIndex` against the new length, and close the viewer when the list becomes empty. Also surface the error — `deletePhoto` never throws, so the `catch` at line 309 is unreachable dead code.

#### High · Gallery grid keeps showing a deleted photo — the refresh effect only reacts to the store growing

**broken** · `src/components/PhotoGallery/PhotoGallery.tsx`:106 · effort **M**

```ts
    if (storePhotos.length > photos.length) {
```

**What you see:** After deleting a photo, the thumbnail stays in the grid until a full page reload. Tapping it reopens the viewer on a photo whose storage object no longer exists, so it shows "Failed to load photo".

**Why:** PhotoGallery keeps its own paginated copy in `const [photos, setPhotos] = useState<PhotoWithUrls[]>([])` (line 33) and only re-fetches when the store has MORE photos than the local copy (line 106) — a condition written for the post-upload case. `photosSlice.deletePhoto` shrinks `state.photos` (line 155-157), so after a delete the store count goes DOWN and the guard is false. For a couple with 20 or fewer photos, `storePhotos.length` and `photos.length` start equal, so the condition can never be true after a delete and the grid never refreshes.

**Reproduce:** With a library of ≤20 photos, open any photo, delete it, close the viewer. The deleted thumbnail is still in the grid. Tap it — the viewer opens and fails to load. Refresh the page and it is finally gone.

**Fix:** Replace the `storePhotos.length > photos.length` heuristic with a real reconciliation: either drive the grid directly off `state.photos` (single source of truth) and keep only pagination offset locally, or compare id sets rather than lengths and re-fetch on any divergence.

#### Medium · Chat pagination sentinel is at the bottom of the list, so opening Love Notes drains the whole history in a loop

**broken** · `src/components/love-notes/MessageList.tsx`:239 · effort **L**

```ts
    rowCount: totalRowCount + (hasMore ? 1 : 0),
```

**What you see:** Opening Love Notes on an account with a long history fires back-to-back `love_notes` queries (50 rows each) until the entire conversation is in memory, instead of one page. On a slow connection the chat visibly thrashes as it snaps to the bottom after each fetch.

**Why:** `isRowLoaded(index)` returns `!hasMore || adjustedIndex < notes.length` (line 221), so the single unloaded index is `notes.length` — the LAST row. `useInfiniteLoader` scans `[startIndex - threshold, stopIndex + threshold]` (verified in node_modules/react-window-infinite-loader/dist/react-window-infinite-loader.js), so `loadMoreRows` fires only when the viewport is near the BOTTOM, never when scrolling up. But older notes are prepended at the top (`notes: [...olderNotes, ...notes]`, notesSlice.ts:191), and the auto-scroll effects (lines 287 and 301/318) put the viewport back at the bottom after every prepend — which immediately re-satisfies the loader's condition against the new sentinel index. The result is an eager fetch loop rather than user-driven pagination, and the header comment "loads older messages when scrolling up" (line 9) never happens.

**Reproduce:** Seed >150 love notes between the pair, open the Love Notes tab, and watch the network panel: three or more sequential `love_notes?...&limit=50` requests fire without any user scrolling.

**Fix:** Invert the loader: reserve index 0 as the unloaded sentinel when `hasMore` is true (shift `adjustedIndex` accordingly and make `isRowLoaded(0)` return `false`), so the load fires at the top. Then add scroll compensation after a prepend — capture the pre-fetch scroll offset and restore it plus the height of the inserted rows — and skip the auto-scroll-to-bottom effect when the length change came from `fetchOlderNotes` rather than a new message.

#### Medium · Failed love-note sends orphan the uploaded image in storage, and retry uploads a second copy

**risk** · `src/stores/slices/notesSlice.ts`:349 · effort **S**

```ts
          const uploadResult = await uploadCompressedBlob(imageBlob, userId);
```

**What you see:** Every love note whose image uploads successfully but whose row insert then fails leaves a permanently unreferenced file in the `love-notes-images` bucket. Each retry adds another. Nothing ever reclaims them; storage usage grows with no user-visible cause.

**Why:** `sendNote` uploads the compressed blob first (line 349), then inserts the row. The insert-failure branch (lines 379-392) only flags the message as errored — it never calls `deleteLoveNoteImage(storagePath)`, even though that function exists (loveNoteImageService.ts:302) and is currently called from nowhere. `retryFailedMessage` then re-uploads the cached `imageBlob` from scratch (line 503), producing a fresh `{userId}/{timestamp}-{uuid}.jpg` path each time, so the earlier upload is never reused or cleaned up. Combined with the image-only-message CHECK violation above, this fires on a completely normal user action.

**Reproduce:** Send an image with no caption (guaranteed insert failure per the CHECK constraint) and tap retry three times. List the `love-notes-images` bucket under your user folder — four objects, zero rows in `love_notes` referencing them.

**Fix:** In both the `sendNote` insert-error branch and the `retryFailedMessage` insert-error branch, `await deleteLoveNoteImage(storagePath)` before marking the message failed (best-effort, swallow the delete error). Better still, cache the successful `storagePath` on the failed note so retry reuses the existing object instead of re-uploading. Longer term, add a scheduled reconciliation that deletes bucket objects with no matching `love_notes.image_url`.

#### Medium · useLoveNotes is mounted twice, causing a duplicate initial fetch and two realtime subscriptions on the same topic

**broken** · `src/components/love-notes/MessageInput.tsx`:48 · effort **S**

```ts
  const { sendNote } = useLoveNotes();
```

**What you see:** Every visit to Love Notes issues two identical 50-row `love_notes` queries and opens two Realtime channels on the same `love-notes:{userId}` topic. Incoming messages run the handler twice (deduped by id, so no visible duplicate) and the arrival vibration is triggered twice.

**Why:** `useLoveNotes(autoFetch = true)` both auto-fetches (`useEffect` at useLoveNotes.ts:126-130) and starts a realtime subscription (`useRealtimeMessages({ enabled: autoFetch })`, line 141). LoveNotes.tsx:36 calls it for the message list, and MessageInput.tsx:48 calls it again just to grab `sendNote` — with the default `autoFetch = true`. `supabase.channel(topic)` returns a new channel object per call, so two subscriptions on the identical topic coexist. The two concurrent `fetchNotes` calls also both run `revokePreviewUrlsFromNotes` and both overwrite `notes` wholesale, so an optimistic message created between them can be dropped.

**Reproduce:** Open the Love Notes tab with devtools open. Network shows two `love_notes?...limit=50` requests; the console shows `[useRealtimeMessages] Setting up Broadcast subscription for:` logged twice for the same user id.

**Fix:** Have MessageInput pull `sendNote` from the store directly (`useAppStore((s) => s.sendNote)`) instead of calling `useLoveNotes()`, or call `useLoveNotes(false)` there. Either way, only the LoveNotes container should own the fetch and the subscription.

#### Medium · Photo caption/tag editing has no entry point — PhotoCarousel, PhotoEditModal and PhotoDeleteConfirmation are unreachable

**gap** · `src/components/PhotoCarousel/PhotoCarousel.tsx`:132 · effort **M**

```ts
  if (!currentPhoto || selectedPhotoId === null) {
```

**What you see:** There is no way to edit a photo's caption in the shipped app. Tapping a thumbnail opens PhotoViewer, which offers only close/navigate/delete — no edit button. Roughly 700 lines of edit UI ship in the bundle and can never be displayed.

**Why:** PhotoCarousel (mounted unconditionally at App.tsx:604) renders `null` unless the store's `selectedPhotoId` is non-null, and `selectPhoto` is only ever called from inside PhotoCarousel itself (`rg 'selectPhoto' src/` hits only PhotoCarousel.tsx:50,58 and photosSlice.ts:215). PhotoGallery abandoned the store selection in favour of local state — `const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)` (line 43), set at line 272 — and renders PhotoViewer instead. So the store's `selectedPhotoId` is never set, PhotoCarousel never mounts, and its children PhotoEditModal and PhotoDeleteConfirmation are dead with it.

**Reproduce:** Open the photo gallery, tap any photo. The overlay that appears has `data-testid="photo-viewer-overlay"`, not `photo-carousel`. There is no edit control anywhere in the flow.

**Fix:** Pick one viewer. Either point PhotoGallery's tap handler at `selectPhoto(photo.id)` and delete PhotoViewer, or add an edit button to PhotoViewer that mounts PhotoEditModal and delete PhotoCarousel/PhotoCarouselControls. Whichever survives, wire the caption save through `photosSlice.updatePhoto` — and land the missing UPDATE RLS policy first, or the edit will save nothing.

#### Low · photos/PhotoUploader.tsx is 482 lines of unreferenced upload code that has drifted from the live implementation

**improvement** · `src/components/photos/PhotoUploader.tsx`:45 · effort **M**

```ts
export function PhotoUploader({
```

**What you see:** Two upload implementations exist with different behaviour; the better one is dead. A maintainer reading `PhotoUploader` would reasonably conclude uploads are compressed and have progress bars and retry toasts — none of which is true of the live `PhotoUpload`.

**Why:** `rg 'PhotoUploader' src/` matches only the file's own definition — nothing imports it. `src/hooks/usePhotos.ts` exists solely to serve it, so it is dead too. The two have drifted substantially: PhotoUploader compresses via `imageCompressionService.compressImage` (line 171), shows a real progress bar bound to `uploadProgress`, and offers retry toasts; the live PhotoUpload does none of that and uploads the raw file. PhotoUploader also has its own latent defect — its AC-6.1.8 fallback at line 197 is unreachable, because `compressImage` never throws (it catches internally and returns `{ fallbackUsed: true }`, imageCompressionService.ts:109-124) and `uploadPhoto` never throws either, so it too always shows a success toast on failure.

**Reproduce:** Run `rg -n 'PhotoUploader' src/` — the only hits are inside the file itself. Run `rg -n 'usePhotos' src/` — only its own definition and PhotoUploader.

**Fix:** Port the two things PhotoUploader gets right — calling `imageCompressionService.compressImage` and binding the progress bar to `uploadProgress` — into `PhotoUpload.tsx`, then delete `src/components/photos/PhotoUploader.tsx` and `src/hooks/usePhotos.ts`. While there, note that `photosSlice` declares `error` and `isLoading`-adjacent keys that collide with `appSlice`'s global `error` (appSlice.ts:26 `setError` is called from settingsSlice.ts:102,157), so photo errors and app-init errors overwrite each other; rename the photo ones to `photosError` / `clearPhotosError`.

**Test coverage in this area.** There is no unit test anywhere for `notesSlice`, `photosSlice`, `photoService`, `loveNoteImageService`, or `imageCompressionService` — `tests/unit/stores/` contains only moodSlice, scriptureReading*, and settingsSlice, and `tests/unit/services/` contains only dbSchema, moodService, and scriptureReadingService. The only component tests in scope are the four in `src/components/love-notes/__tests__/` (FullScreenImageViewer, ImagePreview, LoveNoteMessage, MessageInput), and `MessageInput.test.tsx` mocks `useLoveNotes` wholesale, so the image-only send path is never exercised against a real `sendNote`. `MessageList`, `PhotoGallery`, `PhotoViewer`, `PhotoUpload`, `PhotoEditModal`, and `PhotoCarousel` have no component tests at all. Critically untested flows: optimistic-send reconciliation, retry-after-failure, realtime dedup, upload failure surfacing, and delete-then-refresh state consistency. The two E2E specs (`tests/e2e/photos/photo-upload.spec.ts`, `tests/e2e/notes/love-notes.spec.ts`) cannot catch the false-success bug because the UI genuinely shows the success step.

### Scripture — overview, stats, solo flow, reflection, report

**12 findings** — 3 high, 8 medium, 1 low

> The solo happy path (start → 17 verses → reflection → compose → report) is well-built: focus management, aria-live announcements, offline gating, optimistic step advance with a retry banner, and IndexedDB cache-first reads are all real and coherent. What worries me is the identity model and the write-failure story. `ScriptureSession.userId` is documented as "always user1_id" and is then used everywhere as "the current user" — for the partner (user2) in a together session this makes every user-scoped client write (`scripture_messages` insert, `scripture_bookmarks` insert) fail RLS, and inverts the entire Daily Prayer Report; meanwhile `fetchAndCacheUserSessions` writes the opposite value into the same cache row, so the invariant is not even stable. Separately, the reflection/report layer swallows nearly every failure: reflection-summary save errors, message-send errors, and report-load errors all reach `console.warn`/`logger.info` and nothing else, so the highest-value user data in the feature (their rating, note, and the message to their partner) can vanish with zero UI feedback. Together-mode bookmarks are never written to the server at all, so the reflection screen tells those users they marked no verses.

#### High · session.userId is always user1_id, so for the partner every user-scoped write is RLS-denied and the whole report is inverted

**broken** · `src/components/scripture-reading/hooks/useReportPhase.ts`:192 · effort **M**

```ts
            await scriptureReadingService.addMessage(session.id, session.userId, message);
```

**What you see:** The non-initiating partner (user2) can never send a Daily Prayer Report message — the insert is silently rejected — and their report shows user1's shared bookmarks and user1's standout verses labelled as their own, and user1's message rendered as "Your message to <partner>" instead of "A message from <partner>".

**Why:** `scripture_create_session` reuses the existing lobby row for the pair, and `scriptureReadingService.createSession` maps it with `toLocalSession(validated, validated.user1_id)` (scriptureReadingService.ts:203), so user2's store holds `session.userId === user1_id`. `useReportPhase` then treats `session.userId` as the current user: it passes it as `senderId` to `addMessage`, and uses it in every `r.userId === session.userId` / `m.senderId !== session.userId` filter. The RLS policy `scripture_messages_insert` requires `sender_id = auth.uid()` (20260128000001_scripture_reading.sql:246), so user2's insert is rejected; the rejection is then swallowed by the catch on line 193.

**Reproduce:** Two linked users. User A taps Start → Together (creates the lobby session, user1_id = A). User B taps Start → Together; the RPC reuses A's row and returns user1_id = A, so B's store has session.userId = A. Play through the 17 steps, both submit the reflection summary. On B's device, type a message and tap Send: the POST to /rest/v1/scripture_messages returns 403, B is taken to the report anyway, no "Your message" block appears, and A never receives it. B's report also shows A's standout verses under "Verses That Stood Out".

**Fix:** Stop using `session.userId` as "the current user". Add the authenticated id to the params of `useReportPhase`/`useSessionPersistence` (read `state.userId` from authSlice in `useSoloReadingFlow`) and use it for `addMessage`'s senderId, `toggleBookmark`'s userId, `updateSessionBookmarkSharing`'s userId, and every own-vs-partner filter in the `getSessionReportData` effect. Rename `ScriptureSession.userId` to `user1Id` in `src/services/dbSchema.ts` so the invariant can no longer be misread as "me".

#### High · Together-mode bookmarks are local component state only, so the reflection screen says you marked no verses

**broken** · `src/components/scripture-reading/containers/ReadingContainer.tsx`:193 · effort **M**

```ts
  const handleBookmarkToggle = useCallback(() => {
```

**What you see:** A user who bookmarks verses during a together session reaches the reflection screen and sees "You didn't mark any verses — that's okay" with no chips to select. Their bookmarks are gone, and the Daily Prayer Report shows no bookmark indicators.

**Why:** `ReadingContainer.handleBookmarkToggle` only calls `setBookmarkedSteps` — it never calls `scriptureReadingService.toggleBookmark`, unlike the solo path in `useSessionPersistence.ts:84`. When the phase advances to 'reflection', `ScriptureOverview` (line 303-311) routes to `SoloReadingFlow`, which unmounts `ReadingContainer` (destroying the local Set) and rebuilds the chip list from `flow.bookmarkedSteps`, which `useSessionPersistence` loads from the server via `getBookmarksBySession` (line 72). Nothing was ever written, so the server returns none.

**Reproduce:** Two linked users start a together session. On step 1, 6 and 13 tap the bookmark flag — the icon fills amber each time. Lock in through all 17 steps. On the reflection screen, the "Verses that stood out" section is replaced by "You didn't mark any verses — that's okay", and the later report shows no bookmark indicators on any row.

**Fix:** Extract the debounced write from `useSessionPersistence.handleBookmarkToggle` into a shared hook and use it in `ReadingContainer` instead of the local-only `setBookmarkedSteps`, and seed `ReadingContainer`'s initial Set from `getBookmarksBySession` the same way `useSessionPersistence` does on mount.

#### High · "Waiting for your partner's reflections" never resolves, and a completed report can never be reopened

**gap** · `src/components/scripture-reading/hooks/useReportPhase.ts`:414 · effort **M**

```ts
  }, [reportSubPhase, session, reportReloadKey]);
```

**What you see:** The first partner to finish sits on the report showing a pulsing "Waiting for <name>'s reflections" that never updates, even after the partner finishes minutes later. Tapping "Return to Overview" then makes the report — including the partner's message — permanently unreachable.

**Why:** `getSessionReportData` is fetched once when `reportSubPhase` becomes 'report'; the effect deps are `[reportSubPhase, session, reportReloadKey]` and none of them change while the report is displayed (the partner's completion does a direct table UPDATE with no broadcast — see the comment at scriptureReadingSlice.ts:760). There is no Realtime subscription on `scripture_reflections` or `scripture_messages` anywhere in `src/`. The only manual refresh is `handleRetryReportLoad`, whose button only renders when `reportLoadError` is set — which is unreachable (see report-load-error-unreachable). `handleReturnToOverview` calls `exitSession()`, and `checkForActiveSession` filters to `status === 'in_progress' && mode === 'solo'` (slice line 303), so a completed session has no re-entry path and no history screen exists.

**Reproduce:** Two linked users complete a together session. A finishes and sends a message; B finishes 30 seconds later. A's screen still reads "Waiting for <B>'s reflections" indefinitely and never shows B's message. A taps Return to Overview; from that moment there is no way back to the report — the overview offers only Start, which creates a brand-new session.

**Fix:** Subscribe to Postgres changes (or poll every ~10 s while `reportSubPhase === 'report' && !reportData.isPartnerComplete`) and re-run `getSessionReportData`. Separately, always render a manual "Refresh" control on the report, and add a way back in: relax `checkForActiveSession` to also surface today's completed session, or add a session-history entry point on `ScriptureOverview` backed by `getUserSessions`.

#### Medium · A failed reflection-summary save shows the user nothing — the Continue button just stops working

**broken** · `src/components/scripture-reading/hooks/useReportPhase.ts`:131 · effort **S**

```ts
          handleScriptureError({
```

**What you see:** If the reflection write fails, the user taps Continue, the button greys for a moment and then re-enables, and nothing else happens. No error, no retry hint, no phase change. Their rating, note and standout-verse selections live only in `ReflectionSummary` local state and are lost on refresh or app backgrounding.

**Why:** The catch on line 130 calls `handleScriptureError`, whose SYNC_FAILED branch is just `console.warn('[Scripture] Sync failed — queue for retry')` (scriptureReadingService.ts:56). It never sets the store's `scriptureError`, and the reflection branch of `SoloReadingFlow` (lines 42-64) renders only the sr-announcer and `ReflectionSummary` — there is no error slot at all. The same is true of the inner catch at line 123 (`Reflection saved but failed to advance to report phase`), which strands the user on the reflection screen even though the data saved.

**Reproduce:** Complete all 17 verses of a solo session. Put the device into airplane mode (or block POST /rest/v1/rpc/scripture_submit_reflection). Pick a rating, select a standout verse, tap Continue. Nothing visibly happens; only the devtools console shows '[Scripture] Sync failed — queue for retry'. Reload the page: the resume prompt reappears at step 17 and the rating/note are gone.

**Fix:** Add a `submitError` state to `useReportPhase`, set it in both catch blocks of `handleReflectionSummarySubmit`, expose it through `useSoloReadingFlow`, and render it (with a Retry affordance) in the reflection branch of `SoloReadingFlow.tsx`. `scripture_submit_reflection` is an upsert (ON CONFLICT), so retrying is safe.

#### Medium · A failed partner message is logged and discarded; messageSendFailed is computed but never reaches the UI

**broken** · `src/components/scripture-reading/hooks/useReportPhase.ts`:194 · effort **S**

```ts
            logger.info('Message write failed, proceeding with session completion', error);
```

**What you see:** The user writes a message to their partner, taps Send, and is moved straight to the report as if it succeeded. The message was never stored; the report simply omits the "Your message" block and gives no explanation.

**Why:** `handleMessageSend` wraps `addMessage` in its own try/catch, logs at info level, sets `setMessageSendFailed(true)` and continues to `markSessionComplete`. `messageSendFailed` is returned from `useReportPhase` (line 491) but `useSoloReadingFlow`'s return object (lines 100-156) does not re-export it, so no component can read it — `ReportPhaseView` renders `reportData.userMessage` and nothing else. This is the mechanism that makes the RLS denial in `together-report-identity` invisible.

**Reproduce:** On the message compose screen, block POST /rest/v1/scripture_messages (or reproduce as user2 in a together session, where RLS rejects it). Type a message and tap Send. The Daily Prayer Report appears with no error and no "Your message" section; the console shows only an info-level log.

**Fix:** Re-export `messageSendFailed` from `useSoloReadingFlow`, pass it into `ReportPhaseView`, and render a dismissible banner on the report ("We couldn't deliver your message") with a resend action that calls `scriptureReadingService.addMessage` again.

#### Medium · The report's "Your Reflections" ratings are always empty — the only reflection write uses stepIndex 17, the report reads stepIndex < 17

**gap** · `src/components/scripture-reading/hooks/useReportPhase.ts`:330 · effort **M**

```ts
          (r) => r.userId === session.userId && r.stepIndex < MAX_STEPS && r.rating != null
```

**What you see:** The "Your Reflections" section of the Daily Prayer Report lists all 17 verse references with no rating circle on any row, for every user in every session. The partner's side-by-side rating column never appears. The 1-5 rating the user actually gave on the reflection screen is stored but never shown back to them anywhere.

**Why:** `addReflection` is called in exactly one place in the app — `handleReflectionSummarySubmit` — and always with `MAX_STEPS` (line 100) as the step index, i.e. 17. The report builds `userRatings` and `partnerRatings` from reflections with `stepIndex < MAX_STEPS`, so both sets are always empty and `partnerRatings` is always `null` (line 360-363). `DailyPrayerReport` renders a rating circle only when `rating != null` (line 114), so it renders none. The component's own docblock (line 7) promises "User's step-by-step ratings with bookmark indicators".

**Reproduce:** Complete a full solo session, pick rating 4 on the reflection screen, send or skip the message. On the Daily Prayer Report, every one of the 17 rows shows only the verse reference (plus a bookmark flag where applicable) — no rating badge anywhere, and the 4 you selected is nowhere on screen.

**Fix:** Decide which behaviour is intended. If per-step ratings are wanted, add a rating control to the reading phase that calls `scriptureReadingService.addReflection(sessionId, stepIndex, ...)` for each step. If only the session-level rating exists, change `useReportPhase` to read the `stepIndex === MAX_STEPS` reflection's rating and render it as a single "Session rating" row in `DailyPrayerReport`, and drop the dead `stepIndex < MAX_STEPS` filters.

#### Medium · The report's error banner and Retry button are dead code — a failed fetch renders a blank report instead

**broken** · `src/components/scripture-reading/hooks/useReportPhase.ts`:406 · effort **S**

```ts
          setReportLoadError('Unable to load your daily prayer report right now.');
```

**What you see:** If the report fetch fails, the user sees a fully-rendered Daily Prayer Report with no ratings, no bookmarks, no standout verses and no partner message — indistinguishable from a legitimately empty session — with no error message and no retry.

**Why:** `getSessionReportData` (scriptureReadingService.ts:939) is `Promise.all` over `fetchAndCacheReflections`, `fetchAndCacheBookmarks` and `fetchAndCacheMessages`. All three catch every error and `return []` (lines 741, 764, 787), so the Promise.all can never reject and the `catch` at useReportPhase.ts:404 can never run. `reportLoadError` is therefore permanently null, which also means the `scripture-report-error` block and `handleRetryReportLoad` in `ReportPhaseView.tsx:224-239` are unreachable.

**Reproduce:** Complete a solo session so the report opens. Before the report fetch lands, drop the network (or return 500 from GET /rest/v1/scripture_reflections). The report screen paints with every section empty, no red banner and no Retry button; the only trace is a console.error from the service.

**Fix:** Give `getSessionReportData` a failing path: have `fetchAndCacheReflections`/`Bookmarks`/`Messages` rethrow (or return a `{ data, error }` tuple) and have `getSessionReportData` reject when any leg fails, so the existing `setReportLoadError` + Retry UI actually engages.

#### Medium · The shared 300 ms bookmark debounce collapses N taps into one server toggle, desyncing local and server state

**broken** · `src/components/scripture-reading/hooks/useSessionPersistence.ts`:109 · effort **S**

```ts
          await scriptureReadingService.toggleBookmark(sessionId, stepIndex, userId, false);
```

**What you see:** Double-tapping the bookmark flag leaves the verse looking un-bookmarked while the server records it as bookmarked (and vice-versa). Bookmarking two different verses in quick succession silently drops the first one entirely.

**Why:** The optimistic UI flips state on every tap, but the debounced server call is `toggleBookmark` — a flip, not a set — and only the last scheduled call survives (`clearTimeout` at line 102). Two taps inside 300 ms produce two local flips (net zero) but a single server flip (net one), so the two diverge. Because `bookmarkDebounceRef` is a single ref shared across all step indices rather than keyed per step, a pending write for step N is also cancelled when the user bookmarks step N+1 within the window.

**Reproduce:** On verse 1 of a solo session, tap the bookmark flag twice within ~300 ms. The flag ends up unfilled. Finish the session: the reflection screen offers no chip for verse 1 (it reads local state), but the Daily Prayer Report — which reads bookmarks from the server — shows an amber bookmark indicator on the Psalm 147:3 row. Reloading mid-session also brings the phantom bookmark back.

**Fix:** Key the debounce by step index (`Map<number, Timeout>` instead of one ref), and replace `toggleBookmark` with an explicit set-desired-state call so the server converges on the last known local value rather than applying a flip.

#### Medium · Couple stats never refresh after completing a session — the overview still shows the pre-session numbers

**broken** · `src/components/scripture-reading/containers/ScriptureOverview.tsx`:222 · effort **S**

```ts
  }, [isLoadingPartner, isOnline, loadCoupleStats]);
```

**What you see:** Finish a scripture session, tap Return to Overview, and "Sessions Completed", "Steps Completed", "Last Completed", "Average Rating" and "Bookmarks Saved" all still show the values from before the session. The user has to leave the Scripture tab and come back (or reload) to see their session counted.

**Why:** `ScriptureOverview` is the component that *returns* `<SoloReadingFlow />` (line 291), so it stays mounted for the entire session and its effects never re-run. The stats effect's deps are `[isLoadingPartner, isOnline, loadCoupleStats]` — a stable Zustand action plus two booleans that don't change during a session. `exitSession` → `resetSessionState` deliberately preserves `coupleStats` (slice line 193), so the old values are re-displayed verbatim.

**Reproduce:** Open the Scripture tab with "Sessions Completed: 3". Run a full 17-verse solo session and tap Return to Overview on the report. The card still reads 3, and "Last Completed" still shows the previous date, even though the server now has 4 complete sessions.

**Fix:** Re-fetch after a session ends: either add `void get().loadCoupleStats()` to `exitSession` in `scriptureReadingSlice.ts`, or add `session` to the stats effect's dependency list in `ScriptureOverview` and call `loadCoupleStats()` when it transitions from non-null to null.

#### Medium · loadSession's background-refresh callback has no staleness guard and can revert a step or resurrect an exited session

**risk** · `src/stores/slices/scriptureReadingSlice.ts`:240 · effort **S**

```ts
        set({ session: refreshed })
```

**What you see:** After tapping Continue on the resume prompt, the reading screen can jump backwards one verse; or, if the user exits quickly, they are yanked back out of the overview and into the reading flow they just left.

**Why:** `getSession` returns the cached session immediately and fires `void this.refreshSessionFromServer(sessionId, onRefresh)` (service line 225). The callback passed by `loadSession` is an unguarded `set({ session: refreshed })` — no check that the store still holds the same session, or that it holds a session at all. If the user advances a step or calls `saveAndExit` (which does `set(resetSessionState(get))`, slice line 429) before the in-flight GET resolves, the stale server snapshot overwrites the newer optimistic state, or writes a non-null session back into a store that was just cleared — and `ScriptureOverview` then routes straight back into `SoloReadingFlow`. The same unguarded pattern is used in the version-mismatch path at line 891.

**Reproduce:** On a slow connection with a warm IndexedDB cache, tap Continue on the resume prompt (the reading screen appears instantly from cache). Within the network round-trip, tap the X and then Save & Exit. The overview appears, then a moment later the reading screen returns at the old step index because the background refresh resolved and re-set `session`.

**Fix:** Guard the callback: capture the target `sessionId` and only apply the refresh when `get().session?.id === sessionId`, and merge rather than replace (preserve the locally-advanced `currentStepIndex`/`currentPhase` when they are ahead of the server). Apply the same guard to the refetch inside `lockIn`'s VERSION_MISMATCH branch.

#### Medium · fetchAndCacheUserSessions writes the querying user's id into the cached session row, contradicting the user1_id invariant

**risk** · `src/services/scriptureReadingService.ts`:710 · effort **S**

```ts
      const locals = validated.map((row) => toLocalSession(row, userId));
```

**What you see:** The same session row in IndexedDB holds different `userId` values depending on which fetch wrote it last, so own-vs-partner attribution in the report, bookmark writes, and the `isUser1` role/ready mapping after a reconnect can behave differently between runs for the same user and session.

**Why:** `toLocalSession(row, userId)` takes the "owner" id as a parameter. `createSession` (line 203) and `fetchAndCacheSession` (line 689) both pass `validated.user1_id`, and both `scriptureReadingSlice.ts:766` and `useScriptureBroadcast.ts:76` document the field as "always user1_id". `fetchAndCacheUserSessions` instead passes the id of whoever ran the query, so for user2 it caches the shared together-session row with `userId = user2`. `getSession` is cache-first, so whichever of the two writers ran most recently determines what `loadSession` puts into the store.

**Reproduce:** As user2, open the Scripture tab (this runs checkForActiveSession → getUserSessions → caches the together row with userId = user2). Join the together session and let the broadcast channel drop once so useScriptureBroadcast calls loadSession(sid): the cache hit returns userId = user2, whereas a fresh createSession would have given user1_id. onBroadcastReceived's `isUser1 = session.userId === currentUserId` then evaluates true for user2, swapping myReady/partnerReady and myRole.

**Fix:** Change `fetchAndCacheUserSessions` to `toLocalSession(row, row.user1_id)` so every writer agrees, and (per the together-report-identity fix) rename the field to `user1Id` so no caller can mistake it for the current user.

#### Low · The avgRating precision migration silently reverted the couple-stats CTE optimization to four sequential scans

**improvement** · `supabase/migrations/20260315044923_fix_avg_rating_precision.sql`:38 · effort **S**

```ts
  select
```

**What you see:** `scripture_get_couple_stats` runs four independent filtered scans of `scripture_sessions` plus two joined aggregates on every Scripture-tab open, instead of the single CTE-based plan that was deliberately introduced.

**Why:** `20260217184551_optimize_couple_stats_rpc.sql` replaced the function body with a `with couple_sessions as (...)` CTE feeding five sub-selects. The later `20260315044923_fix_avg_rating_precision.sql` does `create or replace function public.scripture_get_couple_stats()` using the *original* 20260217150353 body (four separate `select ... into` statements, lines 36-90) with only `round(v_avg_rating, 2)` changed to `round(v_avg_rating, 1)`. Since it is the last migration touching the function, the CTE version is dead. Grepping the migrations directory confirms only these three files define it.

**Reproduce:** Run `supabase db reset`, then `\sf public.scripture_get_couple_stats` in psql: the body is the four-query version, not the CTE. `explain analyze select public.scripture_get_couple_stats();` shows four separate scans of scripture_sessions where the 20260217184551 plan showed one.

**Fix:** Add a migration that re-applies the CTE body from `20260217184551_optimize_couple_stats_rpc.sql` with `round(avg(r.rating), 1)`. To stop the drift recurring, move this function into a declarative schema file rather than re-pasting the whole body in each fix migration.

**Test coverage in this area.** The whole two-user together→reflection→report path is untested. `tests/e2e/scripture/scripture-reflection-2.3.spec.ts` "adopts" the seeded session so the browser user is always `user1_id` (line 46: `const activeUserId = sessionRow!.user1_id;`), which is exactly the case where the identity bug does not fire — no test ever runs the report as user2. That test also only awaits the `scripture_messages` POST response without asserting a 2xx, so a 403 would still pass. There is no test that a failed `addReflection`/`addMessage`/`getSessionReportData` produces any user-visible feedback (all three swallow), no test that together-mode bookmarks survive into the reflection screen, no test that couple stats refresh after a session completes, and no unit test for the bookmark debounce with more than one tap inside the 300 ms window. `tests/unit/stores/scriptureReadingSlice.stats.test.ts` covers `loadCoupleStats` in isolation but nothing asserts when it is re-invoked.

### Scripture — Together Mode

**11 findings** — 3 high, 5 medium, 3 low

> The happy path is well built: the RPC layer is properly locked (SELECT ... FOR UPDATE), version-checked, phase-guarded, and RLS-scoped to session members on both broadcast topics, and the simultaneous-lock-in case serialises correctly at the DB. What worries me is everything around the edges of the realtime path. Since migration 20260301000200 removed all server-side realtime.send() calls, partner notification depends entirely on a client-side channel.send() wired through a single module-level `broadcastFnRef` that is null until the channel reaches SUBSCRIBED and is capped at 5 lifetime reconnects — so state changes can be silently dropped with no fallback and no user-visible signal. Session durability is the other weak spot: the scripture slice is not persisted, `checkForActiveSession` filters to solo only, and `scripture_create_session` only reuses lobby-phase sessions, so a single page refresh mid-session permanently splits the couple into two orphaned sessions. Presence disconnect detection has no grace period and mis-reports the local client's own socket failure as the partner leaving.

#### High · Refreshing the page during a together session orphans it and silently creates a second, unlinked session

**broken** · `src/stores/slices/scriptureReadingSlice.ts`:303 · effort **L**

```ts
        .filter((s) => s.status === 'in_progress' && s.mode === 'solo')
```

**What you see:** After a refresh, an OS-triggered PWA restart, or a service-worker update mid-session, the user lands on the Scripture overview with no resume prompt. Tapping Together puts them in a brand-new empty lobby while their partner is still sitting in the old session, waiting. The two are now permanently unable to see each other, and the old session row stays in_progress forever.

**Why:** The scripture slice is not in the Zustand persist partialize list (src/stores/useAppStore.ts:119 lists settings/isOnboarded/messageHistory/moods only), so `session` is gone on reload. The only recovery path is `checkForActiveSession`, and line 303 filters `s.mode === 'solo'`, so a together session is never offered as `activeSession`. Falling back to `createSession('together', partner.id)` does not help either: `scripture_create_session` only reuses an existing pair session when `s.current_phase = 'lobby'`, so a session in reading/countdown phase is not reused and a fresh row is inserted instead.

**Reproduce:** Two devices complete the lobby and reach 'Verse 3 of 17'. User A pulls-to-refresh (or the OS evicts the PWA and it cold-starts). A sees the overview with a Start button and no resume prompt. A taps Start -> Together. A new scripture_sessions row is created (phase lobby, step 0). A is now in lobby session #2; B is still in reading session #1 and after 20s gets the 'Partner reconnecting...' overlay, whose only escape is End Session.

**Fix:** Drop the `mode === 'solo'` filter in checkForActiveSession and let the overview offer resume for together sessions too (routing on mode+phase the way ScriptureOverview already does at lines 291-325). Relax the reuse predicate in scripture_create_session to any in_progress together session for the pair, or add a dedicated scripture_rejoin_session RPC. Belt-and-braces: persist `session.id` (id only, not the whole snapshot) so a reload can re-hydrate via loadSession.

#### High · Reconnect resync calls loadSession, which returns the stale IndexedDB row and rewinds the session to lobby/step 0

**broken** · `src/services/scriptureReadingService.ts`:226 · effort **M**

```ts
      return cached;
```

**What you see:** When the partner reconnects (or the broadcast channel re-subscribes after an error), the reader is bounced out of the current verse back to Verse 1 — and, because countdownStartedAt is never cleared, briefly back through the countdown screen. If the follow-up network refresh fails (which is exactly the situation a reconnect implies), they stay on Verse 1 with a stale version, and their next 'Ready for next verse' tap fails with a red 'Cannot lock in: step mismatch' toast.

**Why:** Both reconnect paths call `loadSession(session.id)`. `loadSession` calls `scriptureReadingService.getSession`, which is cache-first: it returns the IndexedDB row synchronously and only fires a background refresh. Nothing in the together-mode flow ever writes the cache after `createSession` — `scripture_lock_in` / `scripture_toggle_ready` are raw `supabase.rpc` calls in the slice and `updateSession` (the only cache writer) is never invoked in together mode — so the cached row is still the one written at creation time: currentPhase 'lobby', currentStepIndex 0, version 1. `loadSession` then does `set({ session, ... })` with that row, and ScriptureOverview re-routes on `currentPhase === 'lobby'` to LobbyContainer.

**Reproduce:** Two devices at 'Verse 6 of 17'. Put device B in airplane mode for 25 seconds, then restore it. On device A, useScripturePresence flips isPartnerConnected back to true, ReadingContainer:110 fires `void loadSession(session.id)`, and A's screen jumps from Verse 6 to the countdown/Verse 1 until the background fetch lands. Kill A's network at the same moment and A stays on Verse 1 permanently.

**Fix:** Give `getSession` a server-first (or `forceRefresh`) mode and use it from the reconnect paths in ReadingContainer.tsx:110 and useScriptureBroadcast.ts:173 — a resync must not be served from cache. Alternatively have `loadSession` only accept the cached row when its `version` is >= the version already in the store, and clear `countdownStartedAt` in `updatePhase('reading')` so a phase blip cannot re-enter the countdown screen.

#### High · Presence declares the partner gone after two missed heartbeats, and reports the local client's own channel error as a partner disconnect

**broken** · `src/hooks/useScripturePresence.ts`:181 · effort **M**

```ts
                isPartnerConnected: false,
```

**What you see:** A user whose partner simply locked their phone — or a user whose own connection hiccups — gets a full-screen 'Partner reconnecting...' backdrop within 20 seconds, escalating at 30 seconds to 'Your partner seems to have stepped away' with an End Session button that terminates the session for both people. Nothing in the UI distinguishes 'my connection died' from 'their connection died'.

**Why:** This is the un-merged handoff fix, verified absent. (1) No grace period: HEARTBEAT_INTERVAL_MS is 10s and STALE_TTL_MS is 20s, so exactly two missed heartbeats flip isPartnerConnected to false, and ReadingContainer:103-105 turns that single transition straight into setPartnerDisconnected(true) and renders DisconnectionOverlay. Browsers throttle setInterval in backgrounded tabs/PWAs to roughly one tick per minute, so a partner who backgrounds the app trips the threshold every time. (2) No httpSend fallback: sendPresence early-returns at line 75 when `channelRef.current` is null, and the CHANNEL_ERROR branch nulls it at line 186 after removeChannel — so during a local channel error this client emits no presence at all (not even the REST fallback supabase-js would otherwise use for a non-joined channel), which makes the *partner* declare *this* user disconnected 20s later. (3) The same CHANNEL_ERROR branch sets isPartnerConnected:false on line 181, i.e. the local socket's failure is rendered as the partner leaving; and the re-subscribe SUBSCRIBED branch only restores isChannelSubscribed (line 144), never isPartnerConnected, so the overlay persists until a fresh partner heartbeat arrives.

**Reproduce:** Two devices in the reading phase, both connected. Device B presses the power button (screen off) for 30 seconds without leaving the session. On device A the disconnection overlay appears at ~20s and switches to 'Your partner seems to have stepped away' at ~30s, offering End Session — while B is still fully connected. Separately: on device A only, toggle wifi off/on so A's presence channel emits CHANNEL_ERROR; A is told *its partner* is reconnecting, and B (untouched) gets the same overlay 20s later because A stopped emitting presence entirely.

**Fix:** In useScripturePresence, track consecutive missed heartbeats (require ~3 misses / 35s, and pause the stale timer while document.visibilityState === 'hidden') before flipping isPartnerConnected. Use `channel.httpSend('presence_update', ...)` as an explicit REST fallback and stop nulling channelRef on CHANNEL_ERROR until the replacement channel subscribes, so heartbeats keep flowing during a WS blip. Split local-connection health out of PartnerPresenceInfo: the CHANNEL_ERROR branch should set a `isChannelSubscribed:false` / 'you are offline' state, not isPartnerConnected:false, and DisconnectionOverlay should not offer End Session for a purely local fault.

#### Medium · Leaving the lobby with the back button leaves user_ready=true on the server, so the partner can start the session without you

**broken** · `src/components/scripture-reading/containers/LobbyContainer.tsx`:170 · effort **M**

```ts
          onClick={exitSession}
```

**What you see:** A user who readies up, changes their mind and backs out of the lobby is later yanked into a live reading session (countdown, then Verse 1) without ever pressing 'I'm Ready' in that visit. If they do not re-enter, the partner instead gets pulled into a session alone and waits on a lock-in that will never come.

**Why:** `exitSession` (slice:271) only calls `set(resetSessionState(get))` — pure local state. It never calls `scripture_toggle_ready(session_id, false)` and there is no leave/abandon RPC for lobby sessions, so `user1_ready`/`user2_ready` stay true in scripture_sessions. Re-entering via Together reuses the same row (scripture_create_session reuses in_progress lobby sessions for the pair), and the local myReady is back to false so the button reads 'I'm Ready'. When the partner then toggles ready, `v_both_ready := user1_ready AND user2_ready AND user2_id IS NOT NULL` is true, the RPC sets countdown_started_at, and the partner's client broadcasts state_updated — which onBroadcastReceived applies, reconciling myReady back to true and setting countdownStartedAt, so LobbyContainer's Phase C countdown takes over.

**Reproduce:** A and B both open Scripture -> Together. A picks Reader, taps 'I'm Ready', then taps the back arrow (lobby-back-button) and returns to the overview. A taps Together again — the lobby shows 'I'm Ready' (not readied). B now taps 'I'm Ready'. A's screen immediately shows the 3-2-1 countdown and drops into Verse 1 without A ever readying up in this visit.

**Fix:** Make the lobby back button an explicit leave: await `toggleReady(false)` (and ideally a new `scripture_leave_lobby` RPC that also clears the caller's role and broadcasts) before calling exitSession. At minimum, have `exitSession` fire-and-forget scripture_toggle_ready(false) when session.mode === 'together' && currentPhase === 'lobby'.

#### Medium · Both partners can pick the same role; nothing on the client or server prevents it, so roles never alternate complementarily

**broken** · `supabase/migrations/20260301000200_remove_server_side_broadcasts.sql`:72 · effort **M**

```ts
      SET user1_role = p_role::public.scripture_session_role,
```

**What you see:** If both partners tap 'Reader', both see 'You're the Reader' on every even step and 'You're the Responder' on every odd step. Nobody is ever assigned the complementary part, so on every verse both people read the same text and the response prayer is never spoken — the core premise of together mode silently fails, with no warning anywhere.

**Why:** `scripture_select_role` writes the caller's column unconditionally; there is no check that the other user's role differs, and no unique/CHECK constraint on (user1_role, user2_role). The lobby UI never displays the partner's chosen role either — LobbyContainer only renders joined/ready status — so neither user can see the collision. ReadingContainer's effectiveRole (line 184) derives the displayed role purely from `myRole` and step parity, assuming without verification that the partner holds the other role.

**Reproduce:** A opens Together and taps the Reader card. B opens the same lobby and also taps Reader. Neither sees any indication of the other's choice. Both ready up. On Verse 1 both devices show the RoleIndicator 'Reader'; on Verse 2 both show 'Responder'. They stay in lockstep on the same role for all 17 steps.

**Fix:** In scripture_select_role, raise when the partner's role column already equals p_role (or auto-assign the complement and return it in the snapshot), and add the partner's role to the returned snapshot. On the client, disable/annotate the role card the partner already took in LobbyContainer using the user1Role/user2Role already present in StateUpdatePayload, and show 'Partner is the Reader' next to the partner status block.

#### Medium · Lobby actions taken before the broadcast channel subscribes are never sent to the partner, and there is no fallback

**broken** · `src/hooks/useScriptureBroadcast.ts`:179 · effort **M**

```ts
            setBroadcastFn?.((event, payload) => {
```

**What you see:** A user who taps a role and 'I'm Ready' within the first second of entering the lobby can start the countdown on their own device while the partner's lobby still reads 'X is not ready yet' — permanently. One partner ends up in the reading phase, the other is stuck in the lobby with no error and no way to recover except backing out.

**Why:** `setBroadcastFn` is only called inside the `status === 'SUBSCRIBED'` branch, and the effect cleanup sets it back to null. Until the async chain `supabase.realtime.setAuth()` -> `supabase.auth.getUser()` (a network call) -> `channel.subscribe()` -> phx_join round-trip completes, the module-level `broadcastFnRef` in the slice is null, so `broadcastFnRef?.('state_updated', snapshot)` at slice lines 622/670 is a no-op — the optional call swallows it. Because migration 20260301000200 removed every `PERFORM realtime.send()` from the RPCs, there is no server-side fanout to cover the gap, and nothing queues or retries the dropped broadcast. The server state is already mutated at that point, so the two clients are permanently divergent.

**Reproduce:** B is already in the lobby with role selected and 'I'm Ready' pressed. A taps Scripture -> Start -> Together and, as soon as the role cards render (<1s, before the channel finishes joining), taps Reader then 'I'm Ready'. A's toggle_ready RPC sees both users ready, sets countdown_started_at and returns it, so A counts 3-2-1 and enters Verse 1. Neither of A's broadcasts was sent. B's lobby still shows 'A is not ready yet' indefinitely.

**Fix:** Do not gate broadcasting on SUBSCRIBED. Wire `setBroadcastFn` as soon as the channel object exists and let supabase-js fall back to REST for non-joined channels (or call `channel.httpSend(event, payload)` explicitly), and buffer sends that fail. Additionally, disable the role/ready buttons (or show a 'connecting' state) until the channel reports SUBSCRIBED, and have the SUBSCRIBED handler always re-broadcast the current lobby snapshot, not just `partner_joined`.

#### Medium · The lobby has no presence or disconnection detection — a partner who leaves leaves the other waiting indefinitely

**gap** · `src/components/scripture-reading/containers/LobbyContainer.tsx`:199 · effort **M**

```ts
                <span className="text-purple-600">Waiting for {partnerName}...</span>
```

**What you see:** If the partner closes the app, loses connection, or never opens the session at all, the lobby shows 'Waiting for [partner]...' (or, worse, a stale '✓ [partner] has joined!' and '[partner] is not ready yet') forever. There is no timeout, no reconnecting state, and no prompt offering to continue solo after N seconds — the only exits are the back arrow or the small 'Continue solo' link.

**Why:** `useScripturePresence` and `DisconnectionOverlay` are mounted only by ReadingContainer (lines 90 and 222); LobbyContainer imports neither, and there is no equivalent heartbeat on the lobby screen. `partnerJoined` is a one-way latch — `onPartnerJoined` sets it true (slice:729) and nothing ever sets it back to false — so once the partner has been seen, their departure is invisible. The same applies to `partnerReady`, which is only updated by an incoming broadcast.

**Reproduce:** A and B both enter the lobby; A sees '✓ B has joined!'. B force-quits the app. A's lobby keeps showing '✓ B has joined!' and 'B is not ready yet' with a live-looking pulse dot for as long as A leaves the screen open. Variant: B had already tapped Ready before quitting — A then taps Ready, the server sees both ready, the countdown runs and A lands alone in Verse 1, only discovering the problem 20 seconds later via the reading-phase overlay.

**Fix:** Mount useScripturePresence in LobbyContainer too (it already accepts a sessionId and is view/step agnostic) and drive the joined/ready copy from it, so 'has joined' degrades to 'reconnecting…' when the heartbeat lapses. Add a lobby-level timeout (~60s) that surfaces a prominent 'Still waiting — continue solo?' prompt instead of the current tiny link.

#### Medium · Bookmarks made during together-mode reading are local-only and are silently dropped from the Daily Prayer Report

**broken** · `src/components/scripture-reading/containers/ReadingContainer.tsx`:194 · effort **S**

```ts
    setBookmarkedSteps((prev) => {
```

**What you see:** A user flags verses while reading together; the flag animates and stays filled for the rest of the session. When the last verse locks in and the session moves to the reflection/report phase, every bookmark is gone — the Daily Prayer Report shows no standout verses for them, while their partner's solo-mode bookmarks (if any) do appear.

**Why:** ReadingContainer keeps `bookmarkedSteps` in a plain `useState<Set<number>>` (line 76) and `handleBookmarkToggle` only mutates that Set — it never calls `scriptureReadingService.toggleBookmark`, which is what the solo path does at useSessionPersistence.ts:109. Nothing writes a scripture_bookmarks row. When the last lock-in flips currentPhase to 'reflection', ScriptureOverview re-routes to SoloReadingFlow, which mounts useSessionPersistence and reloads bookmarks from the server — finding none — and ReadingContainer unmounts, discarding the local Set.

**Reproduce:** Two devices in a together session. On Verse 2 tap the bookmark flag; it fills. Do the same on Verses 5 and 9. Complete all 17 verses. On the Daily Prayer Report, 'your bookmarks / standout verses' is empty.

**Fix:** Reuse the persistence path instead of duplicating it: have ReadingContainer call `scriptureReadingService.toggleBookmark(session.id, currentStepIndex, <current auth user id>, false)` behind the same 300ms debounce and optimistic-revert logic as useSessionPersistence, and load existing bookmarks on mount. Note that the user id must be the authenticated user (state.userId), not `session.userId`, which holds user1_id for both partners.

#### Low · lock_in_status_changed is applied without checking step_index, so a superseded lock shows a false 'partner is ready' on the next verse

**broken** · `src/hooks/useScriptureBroadcast.ts`:147 · effort **S**

```ts
          onPartnerLockInChanged(partnerLocked);
```

**What you see:** Right after a verse advances, the user can see a green '[Partner] is ready' check on the new verse even though the partner has not locked in yet. The user waits for a step advance that will not happen until the partner actually taps, and if they tap first they are the one left on 'Waiting for X...' — the opposite of what the indicator implied.

**Why:** The payload carries `step_index` (declared in LockInStatusChangedPayload at line 41) but the handler never compares it to `session.currentStepIndex`; it just forwards the boolean to `onPartnerLockInChanged`, which does `set({ partnerLocked: locked })` unconditionally. When both partners lock in within the same round-trip, the RPC serialises on `SELECT ... FOR UPDATE`: the first caller gets both_locked=false and broadcasts `lock_in_status_changed{step_index: N, user1_locked: true}`, while the second caller gets both_locked=true and advances to N+1 locally. The first caller's in-flight partial-lock message then lands on the second client after it has already moved to step N+1 and sets partnerLocked=true for a step nobody has locked.

**Reproduce:** Two devices on Verse 1. Both tap 'Ready for next verse' within the same ~100ms. Both advance to Verse 2. On the device whose RPC landed second, the green '[Partner] is ready' indicator is showing on Verse 2 while the partner's screen shows the un-locked 'Ready for next verse' button.

**Fix:** Pass the step index through: in the lock_in_status_changed handler compare `msg.payload.step_index` against the current `session.currentStepIndex` (available via identityRef, which already mirrors store values) and drop the event when they differ; or change `onPartnerLockInChanged(locked, stepIndex)` in the slice to ignore updates whose stepIndex !== session.currentStepIndex.

#### Low · Presence heartbeat interval is replaced without being cleared, and the presence re-subscribe loop has no retry cap

**risk** · `src/hooks/useScripturePresence.ts`:150 · effort **S**

```ts
            intervalRef.current = setInterval(() => {
```

**What you see:** On a flaky connection the presence channel emits duplicate heartbeats (2x, 3x, ... per 10s) and, if the channel errors persistently — e.g. the session ended so the RLS policy on realtime.messages no longer matches, or the JWT expired — the hook spins in a tight re-subscribe loop: remove channel, getUser(), new channel, CHANNEL_ERROR, repeat, bounded only by network RTT. This burns battery and Realtime quota, and every iteration logs a console warning.

**Why:** The SUBSCRIBED branch assigns `intervalRef.current = setInterval(...)` at line 150 without a preceding clearInterval — note that the stale timer four lines below (line 155) *is* cleared first, so this is an asymmetry, not a deliberate choice. supabase-js re-invokes the subscribe callback with SUBSCRIBED on every successful rejoin (RealtimeChannel.subscribe registers `joinPush.receive('ok', ...)`, and Push.resend preserves recHooks across rejoins), so each socket reconnect adds an orphaned interval that the cleanup at line 225 can no longer reach. Separately, the CHANNEL_ERROR branch increments retryCount at line 187 with no cap — unlike useScriptureBroadcast, which guards with MAX_BROADCAST_RETRIES = 5 (line 46).

**Reproduce:** Start a together reading session and toggle the network off/on three times. Instrument `channel.send` (or watch the network panel): presence_update messages go out 4x per 10s window instead of once. Then end the session on the partner's device so the RLS subquery no longer matches this session id; the presence channel enters a continuous subscribe/CHANNEL_ERROR/removeChannel cycle with repeated `supabase.auth.getUser()` calls.

**Fix:** Clear the previous interval before reassigning at line 150 (mirror the staleTimerRef handling on line 155), and mirror useScriptureBroadcast's guard: add a MAX_PRESENCE_RETRIES constant with exponential backoff, reset the counter on SUBSCRIBED, and stop retrying once the session id is gone from the store.

#### Low · Countdown compares a server epoch timestamp against the client's Date.now() with no skew correction

**broken** · `src/components/scripture-reading/session/Countdown.tsx`:29 · effort **M**

```ts
  const elapsed = Date.now() - startedAt;
```

**What you see:** The two partners do not see the same countdown. On a device whose clock runs ahead of the database, the countdown is skipped entirely and the reading phase starts instantly; on a device whose clock runs behind, the countdown starts at a nonsense digit — a 10s-slow clock renders a giant '13' and counts for 13 seconds while the partner has already been reading for 10.

**Why:** `countdownStartedAt` is `extract(epoch from countdown_started_at) * 1000` — a *server* wall-clock timestamp — but getDigit subtracts it from the *client's* `Date.now()`. Any offset between the device clock and the Postgres clock is applied directly to the countdown, and `Math.ceil((3000 - elapsed) / 1000)` is unbounded above, so a negative elapsed produces digits far larger than 3. The file's own docblock at line 10 claims this 'auto-corrects clock skew', but nothing anywhere in the flow measures or compensates for the offset.

**Reproduce:** On device A set the system clock 10 seconds fast (Settings -> Date & Time, disable automatic). Both partners ready up. Device A's LobbyContainer renders Countdown with a startedAt already 10s in the past: getDigit returns 0, the effect at line 48 fires onComplete immediately and A is on Verse 1. Device B (correct clock) still shows '3'. Reverse the skew and A displays '13' and counts down for 13 seconds.

**Fix:** Derive the countdown from a monotonic local anchor instead of an absolute server timestamp: have the RPC also return the server's `now()` alongside `countdown_started_at`, compute `skew = serverNow - Date.now()` once when the snapshot arrives, and store the countdown deadline as a client-local timestamp. Also clamp getDigit's result to <= 3 so a bad clock can never render an absurd digit, and either fix or delete the 'auto-corrects clock skew' claim in the docblock.

**Test coverage in this area.** There are no multi-client E2E tests anywhere in tests/e2e/scripture/ (`grep -rn "newContext(" tests/e2e/scripture/` returns nothing), so every together-mode assertion is single-browser with a simulated partner. Consequently nothing covers: simultaneous lock-in by both partners, a late-arriving lock_in_status_changed for a superseded step, both partners choosing the same role, or a real countdown running on two clocks. There is also no test for page reload / PWA restart during a together session (no `reload()` call in tests/e2e/scripture/), none for `loadSession` returning a stale IndexedDB row mid-session, none asserting the broadcast retry counter resets after a successful re-subscribe, and none asserting the presence heartbeat interval is not duplicated when SUBSCRIBED fires twice on the same channel.

### Home — daily message, favorites, timers, anniversary, splash

**13 findings** — 1 high, 8 medium, 4 low

> The pure helpers (hashDateString/getDailyMessage/deterministicRandom) are clean and deterministic, and formatDateISO correctly uses local date parts so the rotation key matches wall-clock date. Everything wrapped around them is weaker: the daily message is computed exactly once per app start and never recomputed, so a PWA left open across midnight shows a stale message and can be wedged into a permanent loading spinner by one forward swipe; favoriting a past message silently yanks the user back to today; and the error screen's Retry button is a guaranteed no-op because initializeApp is guarded by a module-level isInitialized flag. The whole anniversary subsystem (CountdownTimer + countdownService + AnniversarySettings, ~830 lines) is unreachable — Settings.tsx is never imported by anything, so settings.relationship.anniversaries is permanently [], and the one countdown bug I could confirm in it (never says "Today is X!" on the actual day) is currently invisible only because of that. Relationship dates are hardcoded module constants whose visit dates are already in the past, so the home screen permanently renders two "Event passed" cards with no UI to change them.

#### High · Favoriting a past message snaps the card back to today

**broken** · `src/stores/slices/messagesSlice.ts`:126 · effort **S**

```ts
      get().updateCurrentMessage();
```

**What you see:** User swipes back three days, finds a message they love, taps the heart — the heart animation fires and the card immediately animates away and replaces itself with today's message. Their place in history is lost.

**Why:** toggleFavorite unconditionally calls updateCurrentMessage() (line 126, commented "Update current message if it's the one being favorited"). updateCurrentMessage always works on today's date (line 151), explicitly forces `currentIndex: 0` when it is non-zero (line 177-183), and then overwrites currentMessage with today's message (line 191-192). Nothing scopes it to the currently-viewed offset.

**Reproduce:** On the home tab press ArrowLeft three times (or swipe left three times) to reach the message from three days ago. Tap the heart. The card is replaced by today's message and canNavigateForward() is now false, so you cannot get back without pressing ArrowLeft three times again.

**Fix:** Drop the updateCurrentMessage() call from toggleFavorite — the favorite state the UI reads (messageHistory.favoriteIds) is already updated by the same set(). If a refresh of currentMessage is genuinely wanted, re-resolve it from `shownMessages.get(dateForCurrentIndex)` instead of forcing index 0.

#### Medium · Daily message never rolls over at midnight while the app stays open

**broken** · `src/stores/slices/settingsSlice.ts`:148 · effort **M**

```ts
      get().updateCurrentMessage();
```

**What you see:** A user who leaves the installed PWA open (or backgrounded on a phone) past midnight still sees yesterday's message all of the next day, with no indication it is stale. Swiping back then shows that same message again as "yesterday".

**Why:** updateCurrentMessage() is the only thing that computes today's message, and grep shows exactly two call sites: initializeApp (settingsSlice.ts:148) and toggleFavorite (messagesSlice.ts:126). There is no interval, no visibilitychange/focus listener, and no date-watch effect anywhere (`rg 'visibilitychange|setInterval' src` returns nothing in DailyMessage/messagesSlice). `const today = new Date()` at messagesSlice.ts:151 is therefore evaluated once per app launch. Because currentIndex stays 0, canNavigateForward() also returns false, so the user cannot reach the new day by swiping either.

**Reproduce:** Open the app at 23:50 and leave the tab/PWA open. At 00:05 the card still shows the previous day's message. Swipe right (forward) — nothing happens (canNavigateForward is false). Swipe left (back) — the card shows the *same* message again, because index 1 now resolves to the day you were already viewing. Only a full reload fixes it.

**Fix:** Add a rollover watcher: in DailyMessage (or a small useDailyRollover hook) register a `visibilitychange` + `focus` listener plus a timeout scheduled for the next local midnight that calls updateCurrentMessage(). Also have updateCurrentMessage compare the cached formatDateISO(today) against messageHistory.lastShownDate so it can detect the day change and reset currentIndex to 0.

#### Medium · navigateToNextMessage sets currentMessage to null on a cache miss, wedging the home screen

**broken** · `src/stores/slices/messagesSlice.ts`:304 · effort **S**

```ts
      currentMessage: targetMessage || null,
```

**What you see:** The message card disappears and is replaced by the pulsing "Loading your daily message..." spinner, then 10 seconds later by the red "Failed to load message" screen. The rest of the home screen (timers) keeps working, so it looks like the message feature crashed.

**Why:** navigateToNextMessage reads `messageHistory.shownMessages.get(dateString)` (line 294) and, unlike navigateToPreviousMessage which recomputes via getDailyMessage on a miss (line 241), it has no fallback — a miss yields `messageId === undefined`, `messages.find` returns undefined, and line 304 stores null. The target date is derived from a fresh `new Date()` (line 288), so combined with the missing midnight rollover the forward target can be a date that was never cached.

**Reproduce:** Open the app before midnight, swipe left once to view yesterday (currentIndex = 1). Leave the app open until after midnight. Swipe right to go forward: newIndex = 0 and targetDate = the new today, which has no entry in shownMessages (updateCurrentMessage only ran yesterday). currentMessage becomes null and the card collapses into the spinner and then the error screen.

**Fix:** Mirror navigateToPreviousMessage: on a cache miss call `getDailyMessage(rotationPool, targetDate)`, store the id into shownMessages, and only then resolve currentMessage. Never assign null from a navigation action.

#### Medium · Retry on the "Failed to load message" screen is a guaranteed no-op and leaves a permanent spinner

**broken** · `src/components/DailyMessage/DailyMessage.tsx`:130 · effort **S**

```ts
              initializeApp();
```

**What you see:** User hits the red "Failed to load message" screen, taps Retry, and the app drops back to the "Loading your daily message..." spinner and stays there forever. Nothing is retried; only a full page reload recovers.

**Why:** initializeApp() returns immediately whenever the module-level `isInitialized` flag is true (settingsSlice.ts:81-84), and that flag is set to true at line 152 on the first successful init. Any failure that happens *after* a successful init (e.g. currentMessage left null by updateCurrentMessage's early returns at lines 136/146, or a null from navigateToNextMessage) therefore cannot be retried. Worse, the click handler also calls setLoadingTimeout(false) (line 129), and the 10-second timeout effect only re-arms when [currentMessage, settings] change (line 106) — neither does — so the component falls into the spinner branch permanently.

**Reproduce:** Reach any state where currentMessage is null/undefined while store `error` is null (e.g. the midnight forward-swipe in finding forward-nav-null-message-wedge). Wait 10 s for the error screen, tap Retry: console logs "[App Init] Skipping - app already initialized" and the UI shows the loading spinner indefinitely.

**Fix:** Make the retry path real: either export a `resetInitialization()` that clears isInitialized/isInitializing before calling initializeApp, or have the Retry button call `loadMessages()` + `updateCurrentMessage()` directly. Also re-arm the timeout by keying the effect on a retry counter so the user is never left on an endless spinner.

#### Medium · Settings screen (the only anniversary UI) is never rendered, so the anniversary countdown can never appear

**gap** · `src/components/Settings/Settings.tsx`:20 · effort **M**

```ts
export const Settings: React.FC = () => {
```

**What you see:** There is no way for the user to add, edit or delete an anniversary anywhere in the app, and the anniversary countdown card advertised on the home screen never shows up.

**Why:** `grep -rn "components/Settings" src tests | grep -v '^src/components/Settings/'` returns no matches — nothing imports Settings.tsx. AnniversarySettings is imported only by Settings.tsx, and addAnniversary/removeAnniversary have no other callers (`rg addAnniversary src` hits only settingsSlice and AnniversarySettings). ViewType (navigationSlice.ts:18) has no 'settings' member and BottomNavigation has no settings tab. settings.relationship.anniversaries therefore stays at its initial `[]` (settingsSlice.ts:61), so the guard at DailyMessage.tsx:359 is always false and CountdownTimer.tsx (275 lines) plus countdownService.ts (152 lines) are dead code.

**Reproduce:** Sign in and tap every one of the seven bottom-nav buttons (Home, Mood, Notes, Partner, Photos, Scripture, Logout). No settings screen exists; no route reaches it. The countdown section under the daily message never renders because anniversaries.length is always 0.

**Fix:** Add 'settings' to ViewType in navigationSlice.ts, a nav entry (or a gear button in the home header), and a lazy `{currentView === 'settings' && <Settings />}` branch in App.tsx alongside the other views — or delete Settings/AnniversarySettings/CountdownTimer/countdownService if the feature is abandoned. Do not leave 830 lines of unreachable UI in the bundle.

#### Medium · Birthday card shows the wrong upcoming age on the birthday itself

**broken** · `src/config/relationshipDates.ts`:75 · effort **S**

```ts
  if (birthdayThisYear <= today) {
```

**What you see:** On the birthday, the card correctly says "Happy Birthday! 🎉" but the subtitle reads "Turning 30" when the person is actually turning 29 that day — one year too high, all day long.

**Why:** getNextBirthday builds this year's birthday at local midnight and rolls to next year whenever `birthdayThisYear <= today` (line 75), with `today = new Date()` including the time of day. So on the birthday it returns next year's date, and getUpcomingAge (line 87) computes `nextBirthday.getFullYear() - birthYear`, i.e. age + 1. Meanwhile BirthdayCountdown.tsx:32 computes isBirthdayToday from raw month/day, so the card enters the celebration branch with the wrong age already rendered in the header at line 100.

**Reproduce:** On 2027-07-09 (Frank, birthYear 1997) open the home tab: the card reads "Frank's Birthday / Turning 31 / Happy Birthday! 🎉" although he is turning 30 that day. Same for Gracie on 2027-03-10.

**Fix:** In getNextBirthday, compare against the start of today (`new Date(y, m, d)`) and use `<` rather than `<=`, so the birthday date itself is returned. getUpcomingAge then yields the correct age and isBirthdayToday agrees with getNextBirthday.

#### Medium · Home screen permanently shows two "Event passed" visit cards from hardcoded 2025 dates

**broken** · `src/config/relationshipDates.ts`:52 · effort **M**

```ts
      date: new Date(2025, 10, 26), // November 26, 2025 (month is 0-indexed)
```

**What you see:** Two of the four countdown cards on the home screen read "Next Visit — Event passed" and "Following Visit — Event passed", permanently, and the user has no way to update them from inside the app.

**Why:** RELATIONSHIP_DATES is a hardcoded module constant with visits fixed at 2025-11-26 and 2025-12-20; App.tsx:549 maps over it unconditionally. Once `now > date`, calculateTimeDifference sets isPast and EventCountdown renders the "Event passed" branch (line 158) forever. Nothing in the store feeds these dates — `rg RELATIONSHIP_DATES src` shows only App.tsx and TimeTogether.tsx as consumers — and TimeTogether's datingStart (line 27) is a second source of truth that duplicates settings.relationship.startDate (used by getAvailableHistoryDays), so changing settings has no effect on the timer.

**Reproduce:** Open the home tab on any date after 2025-12-20 (i.e. today): both visit cards show "Event passed" and the Wedding card shows the "XX:XX:XX / Date TBD" placeholder. There is no UI anywhere to edit or remove them.

**Fix:** Move visits/wedding/birthdays/datingStart into settings (they already have a persisted home in settingsSlice) with editing UI in the Settings screen, and hide or collapse events whose date has passed. At minimum, filter out past visits in App.tsx so stale cards do not accumulate.

#### Medium · Welcome FAB sits on top of the bottom navigation and covers the last tabs on mobile

**broken** · `src/components/WelcomeButton/WelcomeButton.tsx`:13 · effort **S**

```ts
    <div className="fixed right-8 bottom-8 z-50">
```

**What you see:** On a phone-width home screen the pink heart FAB overlaps the Scripture and Logout tabs of the bottom nav; tapping those icons opens the welcome splash instead of navigating/signing out.

**Why:** The FAB is fixed at right:32px / bottom:32px and is 56px square (h-14 w-14, line 46), so it occupies 32–88px from both the right and bottom edges at z-50. The bottom nav is fixed at bottom:0 with an h-16 (64px) row at z-40, and its buttons are flex-1 across a px-4 container, putting the rightmost (Logout) button between roughly 16px and 67px from the right edge with its icon centred around 30–54px above the viewport bottom — entirely inside the FAB's box. The nav's intended safe-area padding does not apply either: it uses the class `safe-area-bottom`, but src/index.css only defines `.safe-top` and `.safe-bottom`, so no env(safe-area-inset-bottom) padding is added to push the row up.

**Reproduce:** Open the home tab in a 390x844 mobile viewport (or an installed PWA on a phone) and tap the Logout icon in the bottom-right of the nav. The welcome splash appears instead of signing out.

**Fix:** Raise the FAB above the nav (e.g. `bottom-24` / `bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)]`), or move the re-view trigger into the message card itself. Separately, fix the nav's class name to the defined `safe-bottom` so iOS home-indicator padding actually applies.

#### Medium · Custom love messages never leave the device

**gap** · `src/services/customMessageService.ts`:1 · effort **M** · _found during my own verification_

**What you see:** Messages written in the Admin Panel are invisible to the partner, do not appear on the user's other devices, and are lost if browser storage is cleared.

**Why:** `grep -c "supabase" src/services/customMessageService.ts` returns 0 — the service is IndexedDB-only (`import { openDB } from 'idb'` at line 1). Every write path in `messagesSlice.ts` (create at :353, update at :387, delete at :419) goes to IndexedDB. Meanwhile production has a `daily_love_messages` table with policies named "Users can insert own custom messages" / "Users can read own custom messages" — server-side support exists and is unused.

**Reproduce:** Open the Admin Panel, create a custom message. Open the app on another device or in a private window with the same account. The message is absent.

**Fix:** Either wire `customMessageService` to the existing `daily_love_messages` table (dual-write, treat IndexedDB as cache), or state in the Admin Panel UI that custom messages are device-local. The current state silently implies sync that does not exist.

> _Evidence: Verified by grep over `src/services/customMessageService.ts` and by listing production policies._

#### Low · Anniversary countdown shows "364 days" on the anniversary itself instead of "Today is X!"

**broken** · `src/utils/countdownService.ts`:93 · effort **S**

```ts
  if (nextDate <= today) {
```

**What you see:** On the actual day of an anniversary the card reads "364 days, 23 hours, 59 minutes until <label>" with the plain calendar icon. The "Today is <label>!" text and the celebration animation are effectively unreachable — they can only appear during the final minute before midnight of the preceding day.

**Why:** getNextAnniversaryDate builds `nextDate` at local midnight of the anniversary (line 84) and then rolls it forward a whole year whenever `nextDate <= today` (line 93), where `today = new Date()` carries the current time-of-day. From 00:00:00.001 on the anniversary onwards, midnight-of-today is <= now, so the function returns next year's date. shouldTriggerCelebration (line 115) and the `days === 0 && hours === 0 && minutes === 0` branch of formatCountdownDisplay (line 128) are then both false all day.

**Reproduce:** Add an anniversary dated the current month/day (once the Settings screen is reachable). Load the home tab on that date at any time after midnight: the countdown card shows ~364 days remaining and never celebrates.

**Fix:** Compare against the start of today, not now: `const startOfToday = new Date(t.getFullYear(), t.getMonth(), t.getDate())` and roll forward only when `nextDate < startOfToday`. Then treat `nextDate` equal to today as the celebration case in shouldTriggerCelebration/formatCountdownDisplay.

#### Low · Favorites are written to IndexedDB and localStorage independently and never reconciled

**risk** · `src/stores/slices/messagesSlice.ts`:119 · effort **S**

```ts
          favoriteIds: state.messages.find((m) => m.id === messageId)?.isFavorite
```

**What you see:** After the app has cleared corrupted localStorage (a path it performs on its own), tapping the heart does nothing visible on the first tap — the icon stays unfilled — and the persisted favourite flag ends up inverted relative to what the user sees.

**Why:** The heart's filled state is decided solely by messageHistory.favoriteIds, which lives in localStorage (DailyMessage.tsx:59), while storageService.toggleFavorite flips Message.isFavorite in IndexedDB (storage.ts:270). loadMessages (messagesSlice.ts:81) never rebuilds favoriteIds from isFavorite, and nothing else reads isFavorite. Line 119 decides add-vs-remove from the IndexedDB-sourced `isFavorite`, so once the two stores disagree the branch is inverted: DB true + favoriteIds empty means the tap flips the DB to false while favoriteIds is left untouched, and the icon never changes.

**Reproduce:** Favourite today's message (DB isFavorite=true, favoriteIds=[id]). Trigger the app's own corrupted-state recovery, which does `localStorage.removeItem('my-love-storage')` (settingsSlice.ts:107 / useAppStore.ts:102), or clear site localStorage manually. Reload: the heart is empty although the DB still says favourited. Tap the heart: the DB flips back to false and the icon stays empty — the tap appears to do nothing.

**Fix:** Pick one store. Simplest: after loadMessages, rebuild `favoriteIds` from `messages.filter(m => m.isFavorite).map(m => m.id)`, and have toggleFavorite derive the add/remove branch from favoriteIds.includes(messageId) rather than from the possibly-stale isFavorite flag (also prevents duplicate ids being pushed into the array).

#### Low · Manually re-viewing the welcome splash resets the 60-minute auto-display timer, contrary to the stated intent

**broken** · `src/App.tsx`:477 · effort **S**

```ts
    localStorage.setItem(LAST_WELCOME_VIEW_KEY, Date.now().toString());
```

**What you see:** After tapping the heart FAB to re-read the welcome message, the automatic splash that was about to appear is pushed back another full hour.

**Why:** showWelcomeManually (line 483) only sets showSplash=true, and the comment above it at line 481 states "Handle manual trigger from button (does NOT reset timer)". But the splash's only exit is the Continue button, whose handler handleContinue writes the lastWelcomeView timestamp at line 477 unconditionally. So every manual view does reset the timer that shouldShowWelcome compares against (line 106).

**Reproduce:** Note the time of the last automatic splash. 59 minutes later tap the heart FAB, read the message, tap Continue. Reload the app one minute later: the splash does not appear, because lastWelcomeView was just rewritten. It will not reappear for another 60 minutes.

**Fix:** Track why the splash is open (e.g. a `splashSource` state of 'auto' | 'manual') and only write LAST_WELCOME_VIEW_KEY in handleContinue when the source is 'auto'.

#### Low · Every countdown card re-renders once per second forever, including cards that can never change

**improvement** · `src/components/RelationshipTimers/EventCountdown.tsx`:108 · effort **S**

```ts
    const interval = setInterval(updateCountdown, 1000);
```

**What you see:** The home tab runs six independent 1 Hz timers, each triggering a React re-render of a Framer Motion subtree, even for cards whose content is provably static — measurable battery/CPU drain on a phone left on the home screen.

**Why:** App.tsx mounts TimeTogether + 2 BirthdayCountdowns + 3 EventCountdowns, each with its own setInterval(…, 1000) that calls three setState() calls per tick. For EventCountdown with `date === null` (the Wedding card) computeEventCountdownState returns the constant `{timeDiff: null, calendarDays: 0, isEventToday: false}` — the interval can never change anything, but it still re-renders every second. The same is true for the two visit cards that are already in the past ("Event passed") and for a birthday card in its "Happy Birthday!" branch. CountdownTimer.tsx:107 explicitly uses a 60 s interval "for battery optimization", so the 1 s intervals here contradict the app's own stated approach.

**Reproduce:** Open the home tab, open React DevTools Profiler (or Performance): six components commit every second indefinitely; the Wedding card commits identical output forever.

**Fix:** Skip the interval entirely when `!date` or when the computed diff is already past, and share a single app-level 1 Hz ticker (a small useNow() hook or context) instead of six independent intervals so there is one timer and one commit per second at most.

**Test coverage in this area.** tests/unit/utils/messageRotation.test.ts is the only test touching this area (it covers hashDateString, getDailyMessage, getAvailableHistoryDays and the deprecated helpers). There is zero coverage for: messagesSlice navigation (navigateToPrevious/NextMessage, canNavigateBack/Forward), toggleFavorite and the favoriteIds/isFavorite dual write, updateCurrentMessage's day-rollover and cache-miss behaviour, countdownService (getNextAnniversaryDate, shouldTriggerCelebration, getUpcomingAnniversaries), relationshipDates (getNextBirthday, getUpcomingAge, calculateTimeDifference), and every timer component. The three highest-severity findings below (midnight rollover, forward-nav null, favorite jump) are all exactly the kind of thing a fake-timers messagesSlice test with vi.setSystemTime would have caught in minutes. E2E only covers welcome-splash display/dismiss and routing (tests/e2e/home/), never the message card itself.

## Test coverage

From `npm run test:unit:coverage`:

| Directory | Statements |
| --- | --- |
| src (App.tsx, main.tsx) | 0% |
| src/api | 3.05% |
| src/stores | 0% |
| src/stores/slices | 34.09% |
| src/config | 20.51% |
| src/data | 16.66% |
| src/services | 39.61% |
| src/utils | 56.17% |
| src/hooks | 64.25% |
| src/validation | 75% |
| **All files** | **32.44%** |

`src/api` at 3.05% is the notable gap: it holds `moodApi.ts` (478 lines), `moodSyncService.ts` (451),
`interactionService.ts` (346) and `partnerService.ts` (340) — the entire Supabase-facing layer, and the
source of several findings above. `src/stores/useAppStore.ts` at 0% covers the persist/partialize
configuration that decides what survives a reload.

## What is healthy

Worth stating plainly, because a defect list distorts the picture:

- Zero `TODO`, `FIXME` or `HACK` comments in `src/`.
- Zero empty `catch` blocks.
- Every one of the 13 lint/type suppressions carries a written justification.
- All 15 production tables have RLS enabled.
- No secrets in source; `fnox` with age encryption, `npm audit --omit=dev` clean.
- CI gates on lint, typecheck, unit coverage, pgTAP database tests, and E2E sharded 4 ways.
- The pure logic layers (`dateUtils`, `messageRotation`, `deterministicRandom`, `interactionValidation`,
  `moodGrouping`, `validation/schemas`) are well tested and were repeatedly cleared by the readers.

