# Removal Inventory

Every file the scripture removal touches, split by whether it is deleted outright or needs surgery. Line numbers were taken with `grep -n` / `sed -n` on 2026-08-19 against branch `feature/dynamic-events`; re-verify before editing if the branch has moved.

**Read the surgery sections before deleting anything.** Roughly two thirds of the files here are clean deletes; the danger is entirely in the other third, and several of those have no "scripture" in their name.

---

## 1. Pure deletes — whole files

### App code

| Path | Note |
|---|---|
| `src/components/scripture-reading/` | Entire directory: 38 files, 9,640 lines |
| `src/data/scriptureSteps.ts` | |
| `src/hooks/useScriptureBroadcast.ts` | |
| `src/hooks/useScripturePresence.ts` | |
| `src/services/scriptureReadingService.ts` | |
| `src/stores/slices/scriptureReadingSlice.ts` | |
| **`src/hooks/useAutoSave.ts`** | **Generic name, 100% scripture.** Sole consumer is `src/components/scripture-reading/hooks/useSessionPersistence.ts:34`. Not exported from `src/hooks/index.ts`. Leaving it behind breaks the build — it imports `ScriptureSession` from `dbSchema.ts`. |
| **`src/hooks/useMotionConfig.ts`** | **Generic name, 100% scripture.** All consumers are under `src/components/scripture-reading/`. Not exported from `src/hooks/index.ts`. |
| `src/hooks/__tests__/useMotionConfig.test.ts` | |

### Tests

| Path | Note |
|---|---|
| `tests/e2e/scripture/` | 14 spec files, 3,155 lines, 144 tests |
| `tests/api/` | All 4 spec files are scripture |
| `tests/unit/` scripture-named files | 15 files, 5,164 lines |
| `tests/support/fixtures/scripture-navigation.ts` | Paired with `merged-fixtures.ts:21,60` — see §2 |
| `tests/support/fixtures/together-mode.ts` | 100% scripture; every importer is a scripture spec. Paired with `merged-fixtures.ts:23,62` |
| `tests/support/helpers/scripture-cache.ts` | |
| `tests/support/helpers/scripture-lobby.ts` | |
| `tests/support/helpers/scripture-overview.ts` | |
| `tests/support/helpers/scripture-together.ts` | |
| **`tests/support/helpers.ts`** | **The flat file, 679 lines — all 13 exports are scripture.** Do **not** confuse with `tests/support/helpers/index.ts`, the directory barrel, which is domain-neutral and must stay. Same import root, opposite verdicts. |
| **`tests/support/helpers/reflection.ts`** | Already effectively dead: all three would-be consumers declare their own local `generateReflectionNote`. Zero real importers. |
| **`tests/unit/validation/schemas.test.ts`** | 100% scripture — all four schemas under test are scripture-only |
| **`tests/unit/hooks/useAutoSave.test.ts`** | Goes with `src/hooks/useAutoSave.ts` |
| **`tests/integration/example-rpc.spec.ts`** | 100% scripture despite the neutral name. **Leaves `tests/integration/` empty** — see SPEC open questions |

### Database

| Path | Note |
|---|---|
| `supabase/tests/database/01_schema.sql` | All 34 assertions target `scripture_*` |
| `supabase/tests/database/02_rls_policies.sql` | **100% scripture — verified.** Only `public.*` objects named are scripture ones. Holds the suite's only `policies_are` net besides `16_photos_storage_update_policy.sql` |
| `supabase/tests/database/04_reflection_upsert.sql` | 100% scripture |
| `supabase/tests/database/05_bookmarks.sql` | 100% scripture |
| `supabase/tests/database/06_session_reflection.sql` | 100% scripture |
| `supabase/tests/database/07_messages.sql` | 100% scripture — `scripture_messages`, unrelated to `love_notes` |
| `supabase/tests/database/08_session_completion.sql` | 100% scripture |
| `supabase/tests/database/19_together_session_partner_scope.sql` | 100% scripture despite the generic name |
| `supabase/tests/database/{03,09,10,11,12,13}_*.sql` | The six scripture-named pgTAP files |

> **Do not delete any file under `supabase/migrations/`.** See §3.

---

## 2. Surgery — shared files

### 2.1 The choke point

**`tests/support/merged-fixtures.ts`** — 42 spec files import this barrel and 23 are non-scripture. Delete the two fixture files without editing these four lines and the whole Playwright suite fails at import time.

```
21:import { test as scriptureNavFixture } from './fixtures/scripture-navigation';
23:import { test as togetherModeFixture } from './fixtures/together-mode';
60:  scriptureNavFixture,
62:  togetherModeFixture
```

### 2.2 App code

| File | Lines | What to do |
|---|---|---|
| `src/App.tsx` | 45-48 | Delete the `ScriptureOverview` lazy import block |
| | 173-186, 192-205 | **Two independent copies of the same route table**, both nested ternaries. Remove the `/scripture` arm from each and re-indent the whole expression. Editing only one makes the Back button disagree with initial load. |
| | 713-714 | Delete the `currentView === 'scripture'` render line |
| `src/stores/useAppStore.ts` | 15, 82 | Delete import and the `...createScriptureReadingSlice(...)` spread. 12 slices → 11. **Do not touch `version: 0`** — E2E auth fixtures pin it, and no scripture key is persisted, so no migration is needed. |
| `src/stores/types.ts` | 20, 62 | Delete the `ScriptureSlice` import and its `extends` entry |
| | 23-24 | Delete the `CoupleStats` re-export — scripture-only despite living in the shared barrel |
| `src/stores/slices/navigationSlice.ts` | 24, 57 | **Atomic pair** — union member and `Record<ViewType, string>` entry |
| | 38, 96-98 | Delete `navigateScripture` declaration and implementation |
| | 5 | Doc comment lists the destinations |
| `src/stores/slices/authSlice.ts` | 103-128 | **Delete 21 fields from `signedOutState()`.** Eight are named `partner*`/`my*` but are scripture-owned: `myRole`, `partnerJoined`, `myReady`, `partnerReady`, `partnerLocked`, `partnerDisconnected`, `partnerDisconnectedAt`, `countdownStartedAt`. `partnerSlice` owns none of them. Deleting by name prefix will get this wrong in both directions. |
| | 45-48 | Comment sentence spans scripture and non-scripture examples — reword, don't delete |
| `src/components/Navigation/NavigationTray.tsx` | 23, 54 | Delete the `BookOpen` import (single use) and the `DESTINATIONS` entry |
| | 155 | Prose list of destinations inside a comment |
| `src/services/storage.ts` | 37-38, 47-49, 273-276 | Comment-only. The 47-49 paragraph is the incident report justifying why this file delegates to `upgradeDb` — amend, don't delete |
| `src/services/eventsService.ts` | 367-370 | **A non-scripture feature documents a real postgrest-js typing constraint by pointing at `scriptureReadingService.ts:270-275`.** Inline the explanation here rather than lose it |
| `src/sw-db.ts` | 31-37 | Comment block: the scripture clause goes, the moods/v7 warning stays — it is the standing warning against re-forking the upgrade callback |
| `src/hooks/useFocusTrap.ts` | 84-89 | **Keep the file** (7 non-scripture consumers). Line 87 is mid-sentence — reword 85-88 as a unit |
| `src/validation/schemas.ts` | 208-272 | Clean truncation — this is the entire tail of the file. **Name hazard:** `SupabaseMessageSchema` here is scripture messages; the same name in `src/api/validation/supabaseSchemas.ts:286` is love messages. Do not delete the wrong one. |
| `src/api/validation/supabaseSchemas.ts` | 263-277, 295 | Mid-file excision. `TimestampSchema` is consumed by 19 other schemas and stays |
| `src/types/database.types.ts` | — | **Do not hand-edit.** Regenerate after the drop migration |

### 2.3 IndexedDB — `src/services/dbSchema.ts`

The four scripture-only stores are `scripture-sessions`, `scripture-reflections`, `scripture-bookmarks`, `scripture-messages`. The other four (`messages`, `photos`, `moods`, `sw-auth`) are untouched.

| Lines | What to do |
|---|---|
| 23-95 | Delete the scripture type block (`ScriptureSessionMode/Phase/Status`, `ScriptureSession`, `ScriptureReflection`, `ScriptureBookmark`, `ScriptureMessage`) |
| 149-176 | Delete 4 of 8 members from `MyLoveDBSchema` |
| 200-203 | Delete the 4 `STORE_NAMES` constants — zero production consumers; only `dbSchema.test.ts:197-200` asserts them |
| 316-343 | Delete the four existence-gated creation branches |
| 190 | `DB_VERSION = 7` → `8` |
| — | **Add** a `deleteObjectStore` block for the four stores, through the `unwrap()` already imported at line 2 — the typed wrapper cannot name stores absent from `MyLoveDBSchema` |
| 111, 183-186, 229-234 | **Version-history comments — amend, never delete.** 229-234 is the design rationale for the existence-check pattern that every surviving store depends on; it happens to be worded around the scripture incident |

Bumping to v8 re-fires `upgradeDb` for every profile, re-entering the moods `else if (tx)` branch at 284-308. That branch is idempotent (both inner guards check `indexNames.contains`), so it is safe — but verify it.

**Operational risk:** `src/sw-db.ts:27` opens the database independently with its own `DB_VERSION`. An installed service worker still on v7 will block the v8 upgrade with a `versionchange` blocked event. This is a SPEC open question.

### 2.4 Test infrastructure

| File | Lines | What to do |
|---|---|---|
| `tests/support/fixtures/index.ts` | 21-22, 51-65, 11-12 | Delete the `testSession` fixture, its type member and now-unused imports. **`supabaseAdmin` (35-49) must survive** — non-scripture event specs use it |
| `tests/support/factories/index.ts` | 22-30, 39-44, 49-162, 240-272 | Delete `SeedResult`, `SeedPreset`, `CreateTestSessionOptions`, `createTestSession`, `cleanupTestSession`. **`TypedSupabaseClient` (line 16) must survive** — imported by `events-crud.spec.ts:25`, `home/events.spec.ts:28`, `helpers/supabase.ts:9`. `linkTestPartners`/`unlinkTestPartners` are domain-neutral; decide separately |
| `tests/support/helpers/navigation.ts` | 20 | Delete `\| 'scripture'` from `NavDestination`; line 13 comment says "seven" |
| `tests/e2e/navigation/tray.spec.ts` | 82 | Remove `'scripture', ` from the loop. **Silent false-green if missed:** the assertion is `.not.toHaveAttribute`, so a stale entry passes vacuously against a testid that no longer exists |
| `src/components/Navigation/__tests__/NavigationTray.test.tsx` | 37, 110, 128 | `ALL_DESTINATIONS` entry (typed `ViewType[]`, so it is a compile-time tripwire — good), test name says "seven", scripture aria-label assertion |
| | **132-142** | **Retarget, do not delete.** This is the only test covering "selecting a destination reports the view and closes the tray" and it clicks scripture. Point it at a surviving destination |
| `tests/unit/services/dbSchema.indexes.test.ts` | 38-85 | Delete the two scripture index `it` blocks |
| `tests/unit/stores/loaderIdentityGuards.test.ts` | 102-115, 603-763 | Delete the `vi.mock` and 4 of ~22 `describe` blocks (`checkForActiveSession`, `loadCoupleStats`, `loadSession`, `createSession`). The other 18 cover notes/moods/photos/partner/events and stay. Line 27 comment needs rewording |
| `tests/support/helpers/rls-security.ts` | 4 | Body is domain-neutral; only consumer is a scripture spec. Keep-or-delete is a SPEC open question |
| `supabase/tests/database/00_helpers.sql` | 61-90 | Delete `tests.create_session_as_admin`. **Keep 16-59** — `create_test_user`/`authenticate_as`/`reset_role` are used by six non-scripture files. `plan(1)` needs no change |
| `supabase/tests/database/15_love_notes_idempotency.sql` | 9 | Stale cross-reference to `03_scripture_rpcs.sql` — cosmetic |

---

## 3. Database

### 3.1 Migrations are append-only here

**Do not delete the nine scripture migrations.** Surviving migration `20260818000000_revoke_anon_execute_and_fix_partner_guards.sql` issues `grant execute on function public.scripture_*` at lines 271-294. Delete the creating migrations and a fresh `supabase db reset` fails with `42883 function does not exist`. Migration history is order-dependent.

Instead add **one new forward migration**, ordered after `20260818000001`.

### 3.2 What the drop migration must remove

Signatures below are quoted from the canonical `GRANT` block at `20260818000000:265-295`; the two without an entry there are noted.

**Trigger** (drop first):
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

**Tables** (5, child → parent — this auto-drops all 15 RLS policies and the indexes):
```
public.scripture_messages
public.scripture_reflections
public.scripture_bookmarks
public.scripture_step_states
public.scripture_sessions
```

**Enum types** (4):
```
public.scripture_session_mode      -- 20260128000001
public.scripture_session_phase     -- 20260128000001
public.scripture_session_status    -- 20260128000001
public.scripture_session_role      -- 20260220000001:18  (created lowercase; easy to miss)
```

These are the only four enums in `database.types.ts` `public.Enums`, so after regeneration that block correctly becomes `[_ in never]: never`.

### 3.3 Migrations that are scripture-only but must still stay on disk

`20260204000001_unlinked_preset.sql`, `20260217184551_optimize_couple_stats_rpc.sql`, `20260221000001_fix_function_search_paths.sql`, `20260301000200_remove_server_side_broadcasts.sql`, `20260309000001_at_reflection_preset.sql`, `20260313000001_fix_lock_in_last_step.sql`, `20260315044923_fix_avg_rating_precision.sql`, `20260818000001_partner_scoped_together_sessions_and_seeder_guard.sql` — all 100% scripture despite several having generic names. They stay because history is order-dependent.

### 3.4 Nothing is shared

Verified: no `daily_prayer` table exists anywhere in the repo. `scripture_messages` is unrelated to `love_notes`. `couple_stats` is an RPC, not a table. `14_moods_idempotency.sql`, `16_photos_storage_update_policy.sql` and `20_events.sql` contain zero scripture references.

Shared objects scripture only *reads*, which must survive: `public.users`, `public.partner_requests`, `public.get_my_partner_id()`, `public.accept_partner_request`, `public.decline_partner_request`.

---

## 4. Exact-set assertions — the four trip hazards

Each of these enumerates the scripture surface and fails the moment its subject changes. They do not fail gracefully and they are not near the code that breaks them.

### 4.1 `supabase/tests/database/18_function_execute_grants.sql` — FN-GRANT-008

Highest-value single edit in the whole job. Verbatim, lines 128-132:

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
- Delete FN-GRANT-003/004 (lines 93-103) and FN-GRANT-007 (158-161) — **3 assertions**. `has_function_privilege` with a text signature **errors** on a missing function (`42883`); it does not return false. These abort the file before FN-GRANT-008 runs.
- Renumber `select plan(21);` (line 29) → `plan(18)`
- Reword comments at 108 and 143
- **Keep** FN-GRANT-001/002 (61-90) — they enumerate `pg_proc` generically and need no edit — plus 005/006/009 and Parts 2/3

### 4.2 `tests/unit/services/dbSchema.test.ts` — four assertions, not three

```
 73:      expect(db.objectStoreNames.length).toBe(8);      -> becomes 4
106:      expect(dbV4.objectStoreNames.length).toBe(4);    -> DO NOT TOUCH
127:      expect(dbV5.objectStoreNames.length).toBe(8);    -> deleted with its block, see below
219:      expect(DB_VERSION).toBe(7);                      -> becomes 8
```

**Line 73** becomes `4`.

**Line 106 must not be touched.** It asserts the v4 (pre-scripture) store count, which coincidentally equals the post-removal count. A blind find-and-replace on `toBe(8)` is safe here; a blind replace involving the number `4` is not.

**Line 127 is not edited — it is deleted.** It sits inside the `describe('upgrade from v4 to v5', ...)` block that opens at line 77 and closes at **129** (verified: the next `describe` opens at 131). Deleting that block removes line 127 with it. Do not both edit 127 and delete its enclosing block.

**Line 219 `expect(DB_VERSION).toBe(7);`** lives in a separate `describe('DB constants', ...)` block at 211+ and must become `8` when story 4 bumps `DB_VERSION`. This is a version assertion, not a store-count assertion, which is why it is easy to miss when hunting for counts.

Also delete: the scripture `contains` checks at 61-65 and 107-119, the whole "upgrade from v4 to v5" describe at **77-129**, the four index tests at 132-170, and the `STORE_NAMES` assertions at 196-201.

### 4.3 `tests/unit/services/storageSchema.test.ts` — `ALL_STORES`

Lines 23-32. Remove entries 28-31 only:

```
28:  'scripture-sessions',
29:  'scripture-reflections',
30:  'scripture-bookmarks',
31:  'scripture-messages',
```

The list stays — it is the regression net for a real defect where `storage.ts` created only two stores.

### 4.4 `tests/unit/stores/signOutClearsAccountState.test.ts` — `EXPECTED_RESET`

Two coupled assertions. The key-parity one, verbatim at 476-480:

```js
  it('signedOutState() and this test agree on which fields exist', () => {
    // Catches drift in the other direction: a field ADDED to the source without
    // being added here would otherwise go unasserted forever.
    expect(Object.keys(signedOutState()).sort()).toEqual(Object.keys(EXPECTED_RESET).sort());
  });
```

`EXPECTED_RESET` (lines **66-85**) must shrink in exact lockstep with `signedOutState()` in `authSlice.ts:103-128`. The duplication is deliberate — the comment at 249-252 says so — and must not be refactored into a derivation.

**The range is 66-85, not 67-84.** Line 66 is `session: null,` and line 85 is `isInitialized: false,` — both scripture-owned, and both just outside the tempting inner range. The 20 field names in 66-85 match, in order, the 20 fields in `authSlice.ts:104-128`. `EXPECTED_RESET` is typed `Record<string, unknown>`, so TypeScript will not catch a mismatch — only the runtime key-parity assertion at :479 will, and it will fail.

Also in this file: delete `SECRETS.reflection` (100), the fixture at 157, the test at 228, and the whole `it` at 379-393.

---

## 5. Coverage genuinely lost

Not blockers, but they should be a conscious choice rather than a side effect:

- **`policies_are` coverage.** `02_rls_policies.sql` is the only exact-policy-set net besides `16_photos_storage_update_policy.sql`. All of it is scripture, so nothing non-scripture regresses — but the pattern leaves the suite.
- **`tests/integration/`** becomes empty. `example-rpc.spec.ts` is the repo's documented worked example for integration testing.
- **`19_together_session_partner_scope.sql` TS-007**, the seeder-role-guard test, has no analogue for other RPCs. The vulnerability it covers becomes moot once the tables are gone.
