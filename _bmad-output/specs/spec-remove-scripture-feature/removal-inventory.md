# Removal Inventory

Every file the remaining scripture removal touches, split by whether it is deleted outright or needs surgery. Line numbers were taken with `grep -n` / `sed -n` on **2026-09-15** against `main` (`08f410ca`). Re-verify before editing if the branch has moved.

The August 2026-08-19 tables are a hint, not a map. Dedicated tests listed there as deletes are already gone (`820be2d2`); do not tell the loop to delete them again.

**Read the surgery sections before deleting anything.** The danger is entirely in shared files, and several of those have no "scripture" in their name.

---

## 0. Already gone — do not delete again

Commit `820be2d2` (`test(scripture): remove the scripture reading test suites`): 58 files, 17149 deletions.

| Gone | Count |
|---|---|
| `tests/e2e/scripture/` | 14 specs; directory absent |
| `tests/api/scripture-*.spec.ts` | 4 specs |
| `src/components/scripture-reading/__tests__/` | 10+ component tests |
| scripture-named files under `tests/unit/` | 15 files |
| `supabase/tests/database/{03-13,19}_*.sql` | 12 dedicated pgTAP files |

`tests/api/` now holds **16** live non-scripture specs (`ls tests/api/*.ts | wc -l`). Story 1 must not touch that directory.

---

## 1. Pure deletes — whole files still present

### App code

| Path | Note |
|---|---|
| `src/components/scripture-reading/` | Entire directory: **24 files, 4410 lines** (`find … \| wc -l`; `wc -l $(find …)`). `__tests__/` already empty/gone. |
| `src/data/scriptureSteps.ts` | |
| `src/hooks/useScriptureBroadcast.ts` | |
| `src/hooks/useScripturePresence.ts` | |
| `src/services/scriptureReadingService.ts` | |
| `src/stores/slices/scriptureReadingSlice.ts` | |
| **`src/hooks/useAutoSave.ts`** | **Generic name, 100% scripture.** Sole production consumer: `src/components/scripture-reading/hooks/useSessionPersistence.ts`. Leaving it behind breaks the build — it imports `ScriptureSession` from `dbSchema.ts`. |
| **`src/hooks/useMotionConfig.ts`** | **Generic name, 100% scripture.** All production consumers are under `src/components/scripture-reading/`. |
| `src/hooks/__tests__/useMotionConfig.test.ts` | Travels with `useMotionConfig.ts`. Still on disk. |
| `tests/unit/hooks/useAutoSave.test.ts` | Travels with `useAutoSave.ts`. Still on disk. |
| **`tests/unit/validation/schemas.test.ts`** | 100% scripture — header: "Epic 1 (Scripture Reading)". Travels with the `src/validation/schemas.ts` truncation. |

### Tests — leftover helpers/fixtures only (story 1)

| Path | Note |
|---|---|
| `tests/support/fixtures/scripture-navigation.ts` | Paired with `merged-fixtures.ts:21,66,82` — see §2.1 |
| `tests/support/fixtures/together-mode.ts` | 100% scripture. Paired with `merged-fixtures.ts:23,68,84`. Live E2E specs cite it only in comments (`love-notes-realtime.spec.ts`, `partner-mood-realtime.spec.ts`) — reword those comments, do not delete those specs. |
| `tests/support/helpers/scripture-cache.ts` | |
| `tests/support/helpers/scripture-lobby.ts` | |
| `tests/support/helpers/scripture-overview.ts` | |
| `tests/support/helpers/scripture-together.ts` | |
| **`tests/support/helpers.ts`** | **The flat 679-line file — all 13 exports are scripture.** Do **not** confuse with `tests/support/helpers/index.ts`, the directory barrel, which is domain-neutral and must stay. Same import root, opposite verdicts. |
| **`tests/support/helpers/reflection.ts`** | Zero importers (`rg -l helpers/reflection tests` empty). |

**KEEP, do not delete:** `tests/support/helpers/rls-security.ts`. Live importers: `tests/api/events-wire-contract.spec.ts`, `couple-broadcast-authorization.spec.ts`, `interaction-authorization.spec.ts`, `profile-name-email-ownership.spec.ts`, `tests/e2e/auth/implicit-fragment-rejection.spec.ts`, `tests/unit/helpers/rls-security.test.ts`. The 2026-08-19 "orphaned" premise is false.

**Do not touch `tests/api/`.** Comment citations of deleted scripture specs there stay.

**Do not touch `tests/e2e-archive/`.** Frozen.

### Database tests still present (story 3)

| Path | Note |
|---|---|
| `supabase/tests/database/01_schema.sql` | `select plan(34);` — all assertions target `scripture_*` |
| `supabase/tests/database/02_rls_policies.sql` | **100% scripture.** Replace with a new `policies_are` file for `love_notes` and `users` (local names after `supabase db reset`). |

> **Do not delete any file under `supabase/migrations/`.** See §3.

---

## 2. Surgery — shared files

### 2.1 The choke point (story 1)

**`tests/support/merged-fixtures.ts`** — 59 files import this barrel; every remaining importer is non-scripture. Delete the two fixture files without editing these lines and the whole Playwright suite fails at import time.

```
21:import { test as scriptureNavFixture } from './fixtures/scripture-navigation';
23:import { test as togetherModeFixture } from './fixtures/together-mode';
66:      typeof scriptureNavFixture,
68:      typeof togetherModeFixture,
82:  scriptureNavFixture,
84:  togetherModeFixture,
```

August cited 21/23/60/62. Lines 60/62 have moved to 66/68 plus the `mergeTests(` call at 82/84.

### 2.2 App code (story 2)

| File | Lines | What to do |
|---|---|---|
| `src/App.tsx` | 51-54 | Delete the `ScriptureOverview` lazy import block |
| | 196-197, 215-216 | **Two independent copies of the same route table**, both nested ternaries. Remove the `/scripture` arm from each and re-indent. Editing only one makes the Back button disagree with initial load. |
| | 805-806 | Delete the `currentView === 'scripture'` render line |
| `src/stores/useAppStore.ts` | 15, 95 | Delete import and the `...createScriptureReadingSlice(...)` spread. 12 slices → 11. **Do not touch `version: 0`** — E2E auth fixtures pin it, and no scripture key is persisted. |
| `src/stores/types.ts` | 20, 62 | Delete the `ScriptureSlice` import and its `extends` entry |
| | 23-24 | Delete the `CoupleStats` re-export — scripture-only despite living in the shared barrel. Sole remaining consumers are the scripture slice/service/overview. |
| `src/stores/slices/navigationSlice.ts` | 25, 58 | **Atomic pair** — union member and `Record<ViewType, string>` entry |
| | 39, 98-100 | Delete `navigateScripture` declaration and implementation |
| | 5 | Doc comment lists the destinations |
| `src/stores/slices/authSlice.ts` | 119-144 | **Delete the scripture fields from `signedOutState()`.** Eight are named `partner*`/`my*` but are scripture-owned: `myRole`, `partnerJoined`, `myReady`, `partnerReady`, `partnerLocked`, `partnerDisconnected`, `partnerDisconnectedAt`, `countdownStartedAt` (134-141). `partnerSlice` owns none of them. Deleting by name prefix will get this wrong in both directions. |
| `src/components/Navigation/NavigationTray.tsx` | 23, 54 | Delete the `BookOpen` import (single use) and the `DESTINATIONS` entry. List is currently seven; post-removal six. |
| `src/services/storage.ts` | 39, 49, 332 | Comment-only. Amend, don't delete. The 41-50 paragraph is the incident report justifying why this file delegates to `upgradeDb`. |
| `src/services/eventsService.ts` | 627 | **A non-scripture feature documents a real postgrest-js typing constraint by pointing at `scriptureReadingService.ts:270-275`.** Inline the explanation here rather than lose it. |
| `src/sw-db.ts` | 31-37 | Comment block: the scripture clause goes, the moods/v7 warning stays — it is the standing warning against re-forking the upgrade callback |
| `src/hooks/useFocusTrap.ts` | 84-89 | **Keep the file.** Line 87 is mid-sentence — reword 85-88 as a unit |
| `src/validation/schemas.ts` | 197-260 | Clean truncation — this is the entire tail of the file. **Name hazard:** `SupabaseMessageSchema` here is scripture messages; the same name in `src/api/validation/supabaseSchemas.ts:193` is love messages. Do not delete the wrong one. |
| `src/api/validation/supabaseSchemas.ts` | 252-265, 283 | Delete `CoupleStatsSchema` and the `CoupleStats` type. `TimestampSchema` is consumed by other schemas and stays. `SupabaseMessageSchema` at 193 is love messages and stays. |
| `eslint.config.js` | 104-116, 178-227 | Delete the three scripture `data-testid` `no-restricted-syntax` selectors and the two scripture-only override blocks (`scripture-reading/containers/**`, scripture `no-explicit-any` files list). Do not drop the `src/` zod `no-restricted-imports` block at 159-177 — the containers override repeats it only because flat config replaces rather than merges. |
| `README.md` | 6, 18, 97, 119, 138 | Feature list, slice list, tree, migration count. Documentation-only; own commit if that is the house rule. |
| `AGENTS.md` | 6, 14, 64, 66, 74 | Freeze language becomes past tense / removed once the app code is gone. Do not copy scripture modules as templates either way. |
| `src/types/database.types.ts` | — | **Do not hand-edit.** Regenerate after the drop migration |

### 2.3 IndexedDB — `src/services/dbSchema.ts` (story 4)

The four scripture-only stores are `scripture-sessions`, `scripture-reflections`, `scripture-bookmarks`, `scripture-messages`. The five survivors are `messages`, `message-favorites`, `photos`, `moods`, `sw-auth`.

| Lines | What to do |
|---|---|
| 23-95 | Delete the scripture type block |
| 161-188 | Delete the four scripture members from `MyLoveDBSchema` |
| 219-222 | Delete the four `STORE_NAMES` scripture constants |
| 384-411 | Delete the four existence-gated creation branches |
| 208 | `DB_VERSION = 9` → `10` |
| — | **Add** a `deleteObjectStore` block for the four stores, through the `unwrap()` already imported at line 2 |
| 111, 195-207, 244-250 | **Version-history comments — amend, never delete.** 244-250 is the design rationale for the existence-check pattern that every surviving store depends on |

Bumping to v10 re-fires `upgradeDb` for every profile. Existence-gated branches stay correct; verify the moods `else if (tx)` path is still idempotent.

**Operational risk:** `src/sw-db.ts:27` opens the database independently with its own `DB_VERSION`. An installed service worker still on v9 will block the v10 upgrade.

### 2.4 Test infrastructure

| File | Lines | What to do |
|---|---|---|
| `tests/support/fixtures/index.ts` | 49, 69, 89-102 | Delete the `testSession` fixture, its type member and now-unused imports. **`supabaseAdmin` (47, 73) must survive** |
| `tests/support/factories/index.ts` | scripture seed/cleanup helpers | Delete `SeedResult` / `createTestSession` / `cleanupTestSession` and the scripture-only types. **`TypedSupabaseClient` (line 16) must survive**. `linkTestPartners`/`unlinkTestPartners` are domain-neutral; delete only if they have zero remaining importers |
| `tests/support/helpers/navigation.ts` | 13, 20 | Delete `\| 'scripture'` from `NavDestination`; comment says "seven" |
| `tests/e2e/navigation/tray.spec.ts` | 82 | Remove `'scripture'` from the loop. **Silent false-green if missed:** the assertion is `.not.toHaveAttribute` |
| `src/components/Navigation/__tests__/NavigationTray.test.tsx` | 31-39, 110, 128 | `ALL_DESTINATIONS` entry (typed `ViewType[]`), test name says "seven", scripture aria-label |
| | **132-142** | **Retarget, do not delete.** Sole test that a destination selection reports the view and closes the tray; it clicks scripture. Point it at a surviving destination |
| `tests/unit/services/dbSchema.indexes.test.ts` | 38-85 | Delete the two scripture index `it` blocks |
| `tests/unit/stores/loaderIdentityGuards.test.ts` | 163; 1730+ | Delete the `vi.mock` of `scriptureReadingService` and the `checkForActiveSession` / `loadCoupleStats` / `loadSession` / `createSession` describes (and the later `it`s at 2373 and 2555 that call those loaders). The other describes cover notes/moods/photos/partner/events and stay |
| `tests/unit/stores/signOutClearsAccountState.test.ts` | **69-88** | `EXPECTED_RESET` scripture keys. Range is 69-88, not 66-85 (August) and not an inner slice — line 69 is `session: null,` and line 88 is `isInitialized: false,`, both scripture-owned. Key-parity assertion is now at **694**, not 476-480. Pair with `authSlice.ts:119-144` |
| `tests/integration/example-rpc.spec.ts` | whole file | **REWRITE against events, do not delete.** Directory also contains `claude-bot-config-forward-migration.spec.ts`; do not leave `tests/integration/` empty |
| `tests/support/check-constraint-envelopes.ts` | 73 | Comment lists `scripture_reflections` among uncovered check constraints — drop that table from the list when the table is gone (story 3) or when editing this file in story 1 |
| `tests/README.md` | 23, 72-80 | Stale tree listing `tests/e2e/scripture/` — rewrite |
| `tests/support/helpers/persisted-blob.ts` | 17 | Comment cites `./scripture-cache.ts` — reword |
| `tests/support/fixtures/auth.ts` | 92 | Comment says "together-mode tests" — reword |
| `tests/e2e/notes/love-notes-realtime.spec.ts` | 28, 203 | Comments cite `together-mode.ts` as an idiom source — reword, do not delete the spec |
| `tests/e2e/partner/partner-mood-realtime.spec.ts` | 193 | Same |
| `tests/e2e/settings/events-accessibility.spec.ts` | 117-119 | Comments cite `scripture-accessibility.spec.ts` and `useMotionConfig` — reword in story 2 when the hook goes |
| `supabase/tests/database/00_helpers.sql` | 65-90 | Delete `tests.create_session_as_admin`. **Keep 16-59**. `plan(1)` needs no change |
| `supabase/tests/database/15_love_notes_idempotency.sql` | 9 | Stale cross-reference to `03_scripture_rpcs.sql` — cosmetic |
| `supabase/tests/database/23_couple_broadcast_policies.sql` | 15-18, 25-37, 129, 169-180 | Exact-set of six `realtime.messages` policies. After dropping the four scripture policies, the array is the two couple policies. Reword "six" / "four scripture" comments. `plan(10)` stays unless an assertion is removed |

---

## 3. Database

### 3.1 Migrations are append-only here

**Do not delete the scripture migrations.** Surviving migration `20260818000000_revoke_anon_execute_and_fix_partner_guards.sql` issues `grant execute on function public.scripture_*` at lines 271-294. Delete the creating migrations and a fresh `supabase db reset` fails with `42883 function does not exist`.

Add **one new forward migration**, ordered after `20260912030000_profile_name_email_ownership.sql`.

### 3.2 What the drop migration must remove

Signatures below are quoted from the canonical `GRANT` block at `20260818000000:265-295`; the two without an entry there are noted.

**Realtime policies** (drop before the function they call):
- `scripture_session_members_can_receive_broadcasts` on `realtime.messages` (`20260220000001:70`)
- `scripture_session_members_can_send_broadcasts` on `realtime.messages` (`20260220000001:85`)
- `scripture_presence_members_can_receive_broadcasts` on `realtime.messages` (`20260222000001:300`)
- `scripture_presence_members_can_send_broadcasts` on `realtime.messages` (`20260222000001:315`)

These will **not** disappear with `DROP TABLE`. `23_couple_broadcast_policies.sql` fails until the array is updated in the same change.

**Trigger** (drop first among table objects):
- `scripture_sessions_freeze_membership` on `public.scripture_sessions` — created at `20260818000001:314`

**Functions** (12):
```
public.is_scripture_session_member(uuid)
public.scripture_seed_test_data(int, boolean, boolean, text, int[], uuid, uuid)
public.scripture_create_session(text, uuid)
public.scripture_get_couple_stats()
public.scripture_submit_reflection(uuid, int, int, text, boolean)
public.scripture_select_role(uuid, text)
public.scripture_toggle_ready(uuid, boolean)
public.scripture_convert_to_solo(uuid)
public.scripture_lock_in(uuid, int, int)
public.scripture_undo_lock_in(uuid, int)
public.scripture_end_session(uuid)
public.scripture_sessions_freeze_membership()          -- trigger fn, not in the GRANT block
```

**Tables** (5, child → parent — this auto-drops the table RLS policies and the indexes, not the realtime.messages policies):
```
public.scripture_messages
public.scripture_reflections
public.scripture_bookmarks
public.scripture_step_states
public.scripture_sessions
```

**Enum types** (4):
```
public.scripture_session_mode
public.scripture_session_phase
public.scripture_session_status
public.scripture_session_role      -- 20260220000001:18 (created lowercase; easy to miss)
```

These are still the only four enums in `database.types.ts` `public.Enums`, so after regeneration that block correctly becomes `[_ in never]: never`.

### 3.3 Scripture-only migrations that must still stay on disk

`20260128000001_scripture_reading.sql`, `20260130000001_scripture_rpcs.sql`, `20260204000001_unlinked_preset.sql`, `20260217150353_scripture_couple_stats.sql`, `20260217184551_optimize_couple_stats_rpc.sql`, `20260220000001_scripture_lobby_and_roles.sql`, `20260221000001_fix_function_search_paths.sql`, `20260221211137_scripture_lobby_phase_guards.sql`, `20260222000001_scripture_lock_in.sql`, `20260228000001_scripture_end_session.sql`, `20260301000100_fix_scripture_create_session_together_lobby.sql`, `20260301000200_remove_server_side_broadcasts.sql`, `20260309000001_at_reflection_preset.sql`, `20260313000001_fix_lock_in_last_step.sql`, `20260315044923_fix_avg_rating_precision.sql`, `20260725180000_scripture_seed_test_data_explicit_users.sql`, `20260818000001_partner_scoped_together_sessions_and_seeder_guard.sql` — stay because history is order-dependent. Later non-scripture migrations may mention them in comments (`20260912030000:137` cites the freeze trigger); leave those comments or reword, never delete the file.

### 3.4 Nothing else is shared

Verified: no `daily_prayer` table. `scripture_messages` is unrelated to `love_notes`. `couple_stats` is an RPC, not a table.

Shared objects scripture only *reads*, which must survive: `public.users`, `public.partner_requests`, `public.get_my_partner_id()`, `public.accept_partner_request`, `public.decline_partner_request`.

---

## 4. Exact-set assertions — the trip hazards

Each of these enumerates the scripture surface and fails the moment its subject changes. They do not fail gracefully and they are not near the code that breaks them.

### 4.1 `supabase/tests/database/18_function_execute_grants.sql` — FN-GRANT-008

Highest-value single edit in the drop story. Verbatim, lines 128-132 (re-read 2026-09-15, unchanged in content):

```sql
  'accept_partner_request, decline_partner_request, get_my_partner_id, '
  || 'is_scripture_session_member, scripture_convert_to_solo, scripture_create_session, '
  || 'scripture_end_session, scripture_get_couple_stats, scripture_lock_in, '
  || 'scripture_select_role, scripture_submit_reflection, scripture_toggle_ready, '
  || 'scripture_undo_lock_in',
```

Must become exactly:

```sql
  'accept_partner_request, decline_partner_request, get_my_partner_id',
```

Same file, also required:
- Delete FN-GRANT-003/004 (lines 93-103) and FN-GRANT-007 (158-161) — **3 assertions**. `has_function_privilege` with a text signature **errors** on a missing function (`42883`); it does not return false.
- Renumber `select plan(21);` (line 29) → `plan(18)`
- Reword comments at 108, 143, 154-157
- **Keep** FN-GRANT-001/002 (61-90) plus 005/006/009 and Parts 2/3

### 4.2 `tests/unit/services/dbSchema.test.ts`

Current numbers (2026-09-15). **Do not reuse the August `toBe(8)→4` / `toBe(7)→8` instructions.**

```
 73:      expect(db.objectStoreNames.length).toBe(9);      -> becomes 5
106:      expect(dbV4.objectStoreNames.length).toBe(4);    -> DO NOT TOUCH
127:      expect(dbV5.objectStoreNames.length).toBe(9);    -> deleted with its it, see below
344:      expect(db.objectStoreNames.length).toBe(9);      -> becomes 5 (strip scripture getAll above it)
488:      expect(DB_VERSION).toBe(9);                      -> becomes 10
```

**A blind replace of `toBe(9)` is the bug.** It is both a store count (→5) and the version assertion (→10).

**Line 106 must not be touched.** It asserts the v4 (pre-scripture) store count.

**Line 127 is not edited — its `it` is deleted.** It sits in `it('should add scripture stores when upgrading from v4')` at 78-128. Do **not** wholesale-delete `describe('upgrade from v4 to v5')` at 77: the next `it` at 130 (`should add the messages by-user index to a store that already exists`) is surviving functionality.

**Line 344** lives in `describe('upgrade from v7 to v8')` at 171 / `it` at 315. Remove the four `getAll('scripture-*')` expects at 335-340; change length to 5. Do not delete the it — it proves messages `by-user` and other stores' rows.

**Line 488** lives in `describe('DB constants')` at 479.

Also delete: the scripture `contains` checks at 61-65 and 107-119, the four scripture index tests at 397-435, and the `STORE_NAMES` scripture assertions at 464-469.

### 4.3 `tests/unit/services/storageSchema.test.ts` — `ALL_STORES`

Lines 24-34. Remove entries 30-33 only:

```
30:  'scripture-sessions',
31:  'scripture-reflections',
32:  'scripture-bookmarks',
33:  'scripture-messages',
```

Keep `message-favorites` (line 26). The list stays — it is the regression net for a real defect where `storage.ts` created only two stores. `expect(db.objectStoreNames.length).toBe(ALL_STORES.length)` at 106 will then expect 5.

### 4.4 `tests/unit/stores/signOutClearsAccountState.test.ts` — `EXPECTED_RESET`

Key-parity, now at **694** (was 476-480):

```js
    expect(Object.keys(signedOutState()).sort()).toEqual(Object.keys(EXPECTED_RESET).sort());
```

`EXPECTED_RESET` scripture keys are lines **69-88**. The range is 69-88, not 66-85 and not 70-87. Line 69 is `session: null,` and line 88 is `isInitialized: false,` — both scripture-owned. Events keys at 89-94 stay. Pair with `authSlice.ts:119-144`. `EXPECTED_RESET` is typed `Record<string, unknown>`, so TypeScript will not catch a mismatch.

### 4.5 `supabase/tests/database/23_couple_broadcast_policies.sql` — NEW since August

`policies_are` at 25-37 lists six `realtime.messages` policies, four of them scripture. After the drop:

```sql
  array[
    'couple_broadcast_recipient_can_receive',
    'couple_broadcast_partner_can_send'
  ],
```

Header comments at 15-18 and the PERMISSIVE comments at 169-180 name the four scripture policies; reword. `plan(10)` stays.

---

## 5. Coverage genuinely lost / replaced

- **`policies_are` for scripture tables** goes with `02_rls_policies.sql`. Replacement coverage for `love_notes` and `users` is required (Sallvain 2026-08-19), written against **local** names after `supabase db reset`. `25_profile_name_email_ownership.sql:28-31` still notes that no file pins the users policy set.
- **`tests/integration/example-rpc.spec.ts`** is rewritten against events, not deleted. The directory is no longer a single file.
- Dedicated E2E/API/unit/component/pgTAP suites are already gone; that coverage loss is already accepted.
