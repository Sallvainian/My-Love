---
title: 'Remove scripture from the application'
type: 'chore'
created: '2026-09-15'
status: ready-for-dev
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 77e71d7e93542d87e910d8dfefb3beaa9431349a
context: []
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** Scripture reading still ships in the running app — route, tray destination, lazy view, store slice, hooks, and services — after its dedicated tests were already deleted in `820be2d2`.

**Approach:** Delete the scripture app modules and the three remaining tests that travel with them, then edit the shared `src/` files (and the shared tests that would otherwise fail typecheck, unit, or Chromium Playwright) so the app has no scripture surface. Leave IndexedDB schema and generated DB types for stories 4 and 3. Do not require `npm run test:ci-local`: its burn-in includes `tests/api/upload-love-note-image-limits.spec.ts`, which this story must not touch; a 503 there is missing edge-runtime (AGENTS.md), not a scripture regression.

## Boundaries & Constraints

**Always:**
- Change `navigationSlice.ts` `ViewType` (`:25`) and `pathMap` (`:58`) in the same edit (`pathMap` is `Record<ViewType, string>`).
- Change `authSlice.ts` `signedOutState()` scripture fields (`:119-144`) in the same edit as `EXPECTED_RESET` in `tests/unit/stores/signOutClearsAccountState.test.ts:69-88`. Key-parity is at `:694`.
- Delete `src/hooks/useAutoSave.ts` and `src/hooks/useMotionConfig.ts` with their tests. Zero non-scripture production importers; leaving `useAutoSave.ts` breaks the build (it imports `ScriptureSession` from `dbSchema.ts`).
- Delete `src/validation/schemas.ts:197-260` (scripture `SupabaseMessageSchema`). Keep `src/api/validation/supabaseSchemas.ts:193` (love-messages `SupabaseMessageSchema`). Delete `CoupleStatsSchema` (`:252-265`) and `CoupleStats` (`:283`); keep `TimestampSchema`.
- Keep `src/hooks/useFocusTrap.ts`; reword the comment at `:85-88` as one unit (line 87 is mid-sentence).
- In `eventsService.ts:627`, inline the postgrest-js `RejectExcessProperties` / index-signature-`never` explanation from `scriptureReadingService.ts:270-275` rather than pointing at a deleted file.
- Strip eslint scripture `data-testid` selectors (`eslint.config.js:104-116`) and the two scripture-only override blocks (`:178-227`). Keep the `src/` zod `no-restricted-imports` block at `:159-177`.
- `useAppStore.ts` persist `version: 0` stays. Do not touch `src/services/dbSchema.ts` or `src/types/database.types.ts`.
- Documentation-only edits (`README.md`, `AGENTS.md`) get their own commit.

**Never:**
- Do not delete `src/components/scripture-reading/__tests__/` or the 15 scripture-named unit files — `820be2d2` already removed them.
- Do not delete `src/hooks/useFocusTrap.ts`.
- Do not hand-edit `src/types/database.types.ts`. Do not change IndexedDB schema or `DB_VERSION`.
- Do not touch `tests/api/` or `tests/e2e-archive/`.
- Do not require `npm run test:ci-local`. Its burn-in includes `tests/api/upload-love-note-image-limits.spec.ts`; a 503 there is missing edge-runtime, not a scripture regression.
- Do not delete `tests/support/helpers/index.ts` (directory barrel) or `tests/support/helpers/rls-security.ts`.
- Do not treat `myRole` / `partnerJoined` / `myReady` / `partnerReady` / `partnerLocked` / `partnerDisconnected` / `partnerDisconnectedAt` / `countdownStartedAt` (`authSlice.ts:134-141`) as `partnerSlice` fields — they are scripture-owned.
- Do not add replacement functionality.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Direct scripture URL | Path `/scripture` on load | `currentView` is `home`; no scripture view mounts | No error expected |
| Popstate scripture URL | Browser Back/Forward to `/scripture` | Same as load: home, not a scripture page | No error expected |
| Tray destinations | Open navigation tray | Six destinations; no Scripture / `nav-scripture` / `BookOpen` | No error expected |
| Select a remaining destination | Click a surviving tray item (e.g. notes) | Reports that view and closes the tray | No error expected |
| Sign-out reset | `clearAuth` after a session with leftover account state | `signedOutState()` keys match `EXPECTED_RESET`; no scripture keys remain | No error expected |

</intent-contract>

## Code Map

Re-verified 2026-09-15 on `5b9a18b74f3e89281417cecef32cca974f396b69` (worktree 2). Inventory line numbers still match.

**Pure deletes (inventory §1 App code):**
- `src/components/scripture-reading/` — 24 files, 4410 lines; `__tests__/` already gone
- `src/data/scriptureSteps.ts`
- `src/hooks/useScriptureBroadcast.ts`, `src/hooks/useScripturePresence.ts`
- `src/services/scriptureReadingService.ts`
- `src/stores/slices/scriptureReadingSlice.ts`
- `src/hooks/useAutoSave.ts` — sole production importer `useSessionPersistence.ts` (deleted with the directory)
- `src/hooks/useMotionConfig.ts` — production importers only under `scripture-reading/`
- `src/hooks/__tests__/useMotionConfig.test.ts`
- `tests/unit/hooks/useAutoSave.test.ts`
- `tests/unit/validation/schemas.test.ts` — header: "Epic 1 (Scripture Reading)"

**Compile-graph (typecheck includes `tests/` via `tsconfig.test.json`):**
- `tests/support/helpers/scripture-lobby.ts:10` imports `src/components/scripture-reading/constants`. Only tests/ importer of deleted src.
- Importers of that helper: `tests/support/helpers/scripture-together.ts:16`, `tests/support/fixtures/together-mode.ts:17`.
- `tests/support/merged-fixtures.ts:23,68,84` import `together-mode`. 59 files import this barrel. Edit those three lines in the **same commit** as deleting `together-mode.ts`. Leave `scripture-navigation` (`:21,66,82`) unless this change also deletes that file — it does not import deleted src.
- If those files are already gone (story 1), skip.

**Shared src surgery (inventory §2.2):**
- `src/App.tsx:51-54` lazy `ScriptureOverview`; `:196-197` and `:215-216` two independent `/scripture` ternaries (edit both); `:805-806` render arm
- `src/stores/useAppStore.ts:15,95` import + `...createScriptureReadingSlice(...)` (12 slices → 11). Do not touch `version: 0` at `:100`
- `src/stores/types.ts:20,62` `ScriptureSlice`; `:23-24` `CoupleStats` re-export
- `src/stores/slices/navigationSlice.ts:5` doc list; `:25` union; `:39,98-100` `navigateScripture`; `:58` `pathMap`
- `src/stores/slices/authSlice.ts:119-144` entire scripture block including the eight `partner*`/`my*` names at `:134-141`
- `src/components/Navigation/NavigationTray.tsx:23` `BookOpen` (single use); `:54` DESTINATIONS entry (seven → six)
- `src/services/storage.ts:39,49,332` comment-only amend; keep the `:41-50` incident report
- `src/services/eventsService.ts:624-627` inline typing constraint
- `src/sw-db.ts:31-37` drop scripture clause; keep moods/v7 warning
- `src/hooks/useFocusTrap.ts:85-88` reword as a unit (keep MoodDetailModal, MoodHistoryCalendar, FullScreenImageViewer)
- `src/stores/slices/partnerSlice.ts:66` "ScriptureOverview reports 'loading'" — surviving src comment; drop the scripture clause
- `src/hooks/useRealtimeMessages.ts:248-249` "the same guard useScriptureBroadcast carries" — drop the scripture pointer
- `src/validation/schemas.ts:197-260` truncate tail
- `src/api/validation/supabaseSchemas.ts:252-265,283`
- `eslint.config.js:104-116,178-227` (keep `:159-177`)
- `README.md:6,18,97,119,138` — own docs commit
- `AGENTS.md:6,14,27,64,66,74` — freeze → removed; "12 slices" → 11; own docs commit

**Shared tests that travel with the app (inventory §2.4 / §4.4):**
- `src/components/Navigation/__tests__/NavigationTray.test.tsx:31-39` `ALL_DESTINATIONS`; `:110` "seven"; `:128` scripture aria-label; **`:132-142` retarget, do not delete** (only coverage that a destination reports the view and closes the tray). Point the click at a surviving destination (notes is already used elsewhere in the file).
- `tests/unit/stores/signOutClearsAccountState.test.ts:69-88` `EXPECTED_RESET`; also drop `SECRETS.reflection` (`:106`), seed `:209-211`, scripture half of `:339-350`, and the whole `:591-606` write-lock test. Keep key-parity `:694`.
- `tests/unit/stores/loaderIdentityGuards.test.ts:163-175` `vi.mock` of `scriptureReadingService`; fns `:60-63`; describes `checkForActiveSession` / `loadCoupleStats` / `loadSession` / `createSession` at `:1730-1893`; later `it`s at `:2373` and `:2555`. Keep notes/moods/photos/partner/events describes.
- `tests/e2e/settings/events-accessibility.spec.ts:117-121` — reword; `useMotionConfig` is gone.
- `tests/unit/utils/basePath.test.ts:38` `ROUTES` still lists `/scripture` as "every route the app can be on" — drop it with `pathMap`.
- `tests/unit/a11y/whiteOnColorContrast.test.ts:64-69,214` `FROZEN = 'src/components/scripture-reading/'` — remove the skip once the directory is gone.

**Leave alone:** `src/services/dbSchema.ts`, `src/types/database.types.ts`, `tests/unit/services/dbSchema*.test.ts`, `tests/unit/services/storageSchema.test.ts` (story 4). `tests/e2e/navigation/tray.spec.ts:82` and `tests/support/helpers/navigation.ts:20` are story 1 leftover E2E surgery (false-green / type-only); do not require them unless a command you run fails.

## Tasks & Acceptance

**Execution:**
- `src/components/scripture-reading/` plus `src/data/scriptureSteps.ts`, `src/hooks/useScriptureBroadcast.ts`, `src/hooks/useScripturePresence.ts`, `src/services/scriptureReadingService.ts`, `src/stores/slices/scriptureReadingSlice.ts`, `src/hooks/useAutoSave.ts`, `src/hooks/useMotionConfig.ts` -- delete -- dedicated app modules
- `src/hooks/__tests__/useMotionConfig.test.ts`, `tests/unit/hooks/useAutoSave.test.ts`, `tests/unit/validation/schemas.test.ts` -- delete -- tests that travel with those modules
- `tests/support/helpers/scripture-lobby.ts`, `tests/support/helpers/scripture-together.ts`, `tests/support/fixtures/together-mode.ts`, and `tests/support/merged-fixtures.ts:23,68,84` -- delete helpers / drop together-mode from the barrel in the same commit -- otherwise `tsc -b` fails after constants.ts is gone. Skip if already absent
- `src/App.tsx` -- drop lazy import, both `/scripture` URL arms, and the render arm -- CAP-1 route/view
- `src/stores/useAppStore.ts` and `src/stores/types.ts` -- drop slice import, spread, `ScriptureSlice`, `CoupleStats` re-export -- 11 slices; keep persist `version: 0`
- `src/stores/slices/navigationSlice.ts` -- drop `'scripture'`, `pathMap` entry, `navigateScripture`, and the doc-comment list -- atomic pair
- `src/stores/slices/authSlice.ts` and `tests/unit/stores/signOutClearsAccountState.test.ts` -- drop scripture `signedOutState()` fields and matching `EXPECTED_RESET` keys/tests -- atomic pair; include the eight `partner*`/`my*` names
- `src/components/Navigation/NavigationTray.tsx` and `src/components/Navigation/__tests__/NavigationTray.test.tsx` -- drop BookOpen + DESTINATIONS entry; retarget the select-and-close test; six destinations -- tray surface
- `src/validation/schemas.ts` and `src/api/validation/supabaseSchemas.ts` -- truncate scripture tail; drop `CoupleStatsSchema`/`CoupleStats`; keep love `SupabaseMessageSchema` and `TimestampSchema` -- name collision
- `src/services/eventsService.ts`, `src/services/storage.ts`, `src/sw-db.ts`, `src/hooks/useFocusTrap.ts`, `src/stores/slices/partnerSlice.ts`, `src/hooks/useRealtimeMessages.ts` -- amend comments; inline the postgrest-js constraint -- no dangling pointers
- `eslint.config.js` -- drop scripture selectors and two override blocks; keep zod block `:159-177`
- `tests/unit/stores/loaderIdentityGuards.test.ts` -- drop scripture mock, fns, and describes/`it`s listed in Code Map -- unit suite compiles
- `tests/e2e/settings/events-accessibility.spec.ts`, `tests/unit/utils/basePath.test.ts`, `tests/unit/a11y/whiteOnColorContrast.test.ts` -- drop scripture route / FROZEN skip / useMotionConfig comments
- `README.md` and `AGENTS.md` -- remove scripture from the shipped feature list and freeze language; 12 slices → 11 -- own docs commit

**Acceptance Criteria:**
- Given a signed-in session, when the location is `/scripture` (load or popstate), then the app shows home and does not mount a scripture view.
- Given the navigation tray is open, when destinations are listed, then there are six items and none is Scripture.
- Given the tray is open, when a surviving destination is selected, then `onViewChange` reports that view and the tray closes.
- Given `clearAuth`, when `signedOutState()` is compared to `EXPECTED_RESET`, then the key sets match and neither contains scripture fields (`session`, `myRole`, `partnerJoined`, `isInitialized` from the old scripture block, etc.).
- Given `rg -i scripture src tests eslint.config.js README.md AGENTS.md` (excluding `tests/e2e-archive/`, `tests/api/` comment citations, `src/services/dbSchema.ts`, and `src/types/database.types.ts`), when the story is done, then remaining hits are only amended historical comments that no longer name a live module, or files this story was told to leave alone.

## Spec Change Log

- 2026-09-15 — Sallvain: story-2 verification is `npm run typecheck && npm run lint && npm run test:unit && npx playwright test --project=chromium`. Do not run `npm run test:ci-local`; its burn-in of `tests/api/upload-love-note-image-limits.spec.ts` is out of scope (must not touch `tests/api/`) and a 503 is missing edge-runtime, not a scripture regression.
- 2026-09-15 — Sallvain: strip leftover `## Auto Run Result` / `Status: blocked` from this spec. The loop treats that heading as a fresh blocked verdict, so a re-drive with it still present pauses immediately on the old upload-test 503.

## Review Triage Log

## Design Notes

`signedOutState()` scripture block is `:119-144` as a unit. Deleting by `partner*`/`my*` prefix is wrong in both directions: eight of those names are scripture-owned (`:134-141`) and `partnerSlice` owns none of them; `partner` / `isLoadingPartner` / request fields above `:119` stay.

`useAutoSave.ts:11` `import type { ScriptureSession } from '../services/dbSchema'` — after the only consumer is deleted, the file is a typecheck failure against story 4's later schema strip if left behind, and a semantic leak if left with the type.

Inline for `eventsService.ts` from `scriptureReadingService.ts:271-274`: "Typed with the generated Update row rather than Record<string, unknown>: postgrest-js (>= supabase-js 2.105) wraps .update() payloads in RejectExcessProperties, which resolves an index signature to `never`."

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0
- `npm run test:unit` -- expected: exit 0
- `npx playwright test --project=chromium` -- expected: exit 0 (needs local Supabase)
