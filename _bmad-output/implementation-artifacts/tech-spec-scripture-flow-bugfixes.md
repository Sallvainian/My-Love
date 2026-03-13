---
title: 'Scripture Flow Bugfixes & Simplification'
slug: 'scripture-flow-bugfixes'
created: '2026-03-13'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript ~5.9.3', 'React 19', 'Zustand 5', 'Supabase 2', 'PostgreSQL 17', 'Framer Motion 12', 'Vitest 4', 'Playwright 1.58']
files_to_modify:
  - 'supabase/migrations/{timestamp}_fix_lock_in_last_step.sql (new)'
  - 'supabase/tests/database/11_scripture_lockin.sql'
  - 'src/stores/slices/scriptureReadingSlice.ts'
  - 'src/components/scripture-reading/containers/SoloReadingFlow.tsx'
  - 'src/components/scripture-reading/containers/ScriptureOverview.tsx'
  - 'src/components/scripture-reading/containers/ReadingContainer.tsx'
  - 'tests/unit/stores/scriptureReadingSlice.lockin.test.ts'
code_patterns:
  - 'Zustand slice pattern: actions in slices, types in stores/types.ts'
  - 'Supabase RPC with client-side broadcast via channel.send() (no server-side PERFORM)'
  - 'Online-first for scripture: RPC is source of truth, IndexedDB is read cache'
  - 'Exit confirmation dialog pattern (SoloReadingFlow lines 1320-1374)'
  - 'useCallback with session dependency causes effect re-triggers via dep array'
test_patterns:
  - 'pgTAP: supabase/tests/database/ — test ID format {story}-DB-{N03d}'
  - 'Vitest unit: tests/unit/stores/scriptureReadingSlice.lockin.test.ts — existing lock-in tests'
  - 'Vitest component: src/components/scripture-reading/__tests__/ — 14 test files'
  - 'Playwright E2E: tests/e2e/scripture/ — 14 spec files'
  - 'pgTAP test 4.2-DB-005 currently asserts status=complete on last step — MUST update'
---

# Tech-Spec: Scripture Flow Bugfixes & Simplification

**Created:** 2026-03-13

## Overview

### Problem Statement

The scripture reading flow has multiple logical bugs and dead-end screens, primarily affecting together mode. The most critical: after both partners complete the last verse and fill out the reflection form, submitting it sends the user back to the overview instead of showing the partner's message and Daily Prayer Report. Additionally, several error screens trap users with no escape, ReadingContainer has no exit button, and the code has fire-and-forget async patterns that create race conditions between partners.

### Root Cause Analysis

**Bug 1 — Together mode reflection submit goes to overview:**
- `scripture_lock_in` RPC sets `status = 'complete'` prematurely on the last step (line 376 of `20260301000200` migration). The reflection/report phases haven't happened yet.
- The client `lockIn` action reads `currentPhase` from the RPC response but never reads `status` — so locally `status` stays `'in_progress'` while the DB has `'complete'`.
- `onBroadcastReceived` (slice line 782) nukes the session on ANY broadcast with `currentPhase === 'complete'`: `if (payload.currentPhase === 'complete') { set(resetSessionState(get)); return; }`. During the report/completion flow, if the partner finishes faster and any state sync occurs, this wipes the user's session mid-flow.
- The `isReportEntry` effect (SoloReadingFlow line 436) depends on `markSessionComplete` in its dependency array. `markSessionComplete` is a `useCallback([session, updatePhase])`, so it recreates every time session changes, re-triggering the effect and potentially causing race conditions between the two partners' independent completion flows.

**Bug 2 — Dead-end screens:**
- `complete-unlinked` screen: "Return to Overview" button is `disabled={Boolean(completionError)}` (line 883). If completion fails, the button is disabled and the only option is a Retry that may also fail.
- `completion-error` screen (lines 896-942): Only has a Retry button, no way to return to overview at all.

**Bug 3 — No exit from together-mode reading:**
- `ReadingContainer` has no exit/back button. The only escape routes are: finish all 17 steps, partner disconnects, or use the bottom nav (which leaves an orphaned `in_progress` session on the server).

### Solution

Fix the bugs in dependency order (DB first, then slice, then UI), and simplify the overengineered parts that caused the bugs.

### Scope

**In Scope:**
- Fix `scripture_lock_in` RPC to NOT set `status = 'complete'` on last step
- Fix `onBroadcastReceived` to not nuke sessions during reflection/report phases
- Add escape routes to all dead-end screens
- Add exit button to `ReadingContainer` (hard end via `endSession`)
- Remove `markSessionComplete` from the `isReportEntry` effect dependency array
- Simplify `handleReflectionSummarySubmit` — await async operations before advancing phase
- Update pgTAP test and unit test assertions that expect `status = 'complete'` on last lock-in

**Out of Scope:**
- Full refactor of `SoloReadingFlow` into separate components (large effort, separate spec)
- Together-mode session resume via `checkForActiveSession` (orphaned sessions are a separate concern)
- Stats not updating on return to overview (user confirmed this is a separate issue)
- Together-mode-specific reflection/report (the current shared flow via `SoloReadingFlow` is acceptable per Epic 2 spec — both modes use the same reflection UI)

## Context for Development

### Codebase Patterns

- Scripture is online-first: Supabase RPC is source of truth, IndexedDB is read cache
- Client-side broadcasts only: `channel.send()` after successful RPC, no server-side `PERFORM realtime.send()`
- `onBroadcastReceived` is the single handler for all `state_updated` broadcasts — it must distinguish between "session ended" vs "session phase advanced"
- `SoloReadingFlow` handles both solo and together-mode post-reading phases (reflection, compose, report)
- `markSessionComplete` is a retry-once helper that sets `status: 'complete'`, `completedAt`, `currentPhase: 'complete'`
- Exit confirmation dialog uses Framer Motion `AnimatePresence`, overlay click-to-dismiss, focus trap, Escape key handler
- `scripture_end_session` RPC requires `status = 'in_progress'` — it will fail if status is already `'complete'`
- `endSession` slice action broadcasts `state_updated` with `triggered_by: 'end_session'` after RPC success, then resets local state

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `supabase/migrations/20260301000200_remove_server_side_broadcasts.sql` | Current `scripture_lock_in` RPC definition (lines 268-423) |
| `src/stores/slices/scriptureReadingSlice.ts` | `lockIn` (line 851), `onBroadcastReceived` (line 774), `endSession` (line 998), `updatePhase` (line 290) |
| `src/components/scripture-reading/containers/SoloReadingFlow.tsx` | Reflection submit (line 256), dead-end screens (lines 833-942), `isReportEntry` effect (line 436), exit dialog (lines 1320-1374) |
| `src/components/scripture-reading/containers/ReadingContainer.tsx` | Together-mode reading (373 lines), no exit button, `handleEndSession` already exists (line 132) |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | Routing logic (lines 298-320) |
| `supabase/tests/database/11_scripture_lockin.sql` | pgTAP test 4.2-DB-005 asserts `status = 'complete'` on last lock-in (line 264) |
| `tests/unit/stores/scriptureReadingSlice.lockin.test.ts` | Unit test for broadcast-triggered reflection transition (line 287) |
| `_bmad-output/planning-artifacts/epics/epic-2-reflection-daily-prayer-report.md` | Original spec for reflection/report flow |

### Technical Decisions

1. **RPC fix**: Remove `status = 'complete'` from the last-step branch. Session stays `'in_progress'` with `current_phase = 'reflection'`. The session only becomes `'complete'` when `markSessionComplete` runs client-side after the report phase.
2. **Broadcast guard**: Remove `payload.currentPhase === 'complete'` from the nuke condition. Only nuke when `triggered_by === 'end_session'`. Normal completion doesn't broadcast — it's a direct DB update via `updateSession`.
3. **Eliminate fire-and-forget in reflection submit**: Await `addReflection` + `updateSessionBookmarkSharing` before calling `updatePhase('report')`. If they fail, show an error instead of advancing to a broken state.
4. **Exit from ReadingContainer**: Reuse the existing `handleEndSession` callback (line 132) with a new confirmation dialog. Same visual pattern as SoloReadingFlow's exit dialog.
5. **Ref pattern for effect stability**: Use `useRef` to hold `markSessionComplete` so the `isReportEntry` effect doesn't re-trigger on every session change.

## Implementation Plan

### Tasks

- [x] **Task 1: Fix `scripture_lock_in` RPC — don't set status='complete' on last step**
  - File: `supabase/migrations/{timestamp}_fix_lock_in_last_step.sql` (new)
  - Action: Create a `CREATE OR REPLACE FUNCTION` migration that copies the current `scripture_lock_in` from `20260301000200` (lines 268-423) with ONE change: in the last-step branch (line 375), remove `status = 'complete',` so the UPDATE only sets `current_phase = 'reflection'` and bumps `version`. Keep the `snapshot_json` as-is (it already uses `'currentPhase': 'reflection'`).
  - Notes: The full function body must be included in the migration (CREATE OR REPLACE replaces the whole function). Copy-paste from `20260301000200` lines 268-423 and delete the single `status = 'complete',` line.

- [x] **Task 1b: Fix `ScriptureOverview.tsx` routing for post-reading phases**
  - File: `src/components/scripture-reading/containers/ScriptureOverview.tsx`, lines 298-320
  - Action: Add a routing condition before the `currentPhase === 'reading'` check (line 309) that routes to `SoloReadingFlow` when `currentPhase` is `'reflection'`, `'report'`, `'compose'`, or `'complete'` — regardless of mode. This ensures together-mode sessions that are past the reading phase (and now have `status = 'in_progress'` after Task 1) still route correctly on page refresh.
  - Notes: Before Task 1, together-mode sessions in reflection/report had `status = 'complete'` which matched line 304. After Task 1, `status` stays `'in_progress'` and `currentPhase` is `'report'` — no existing condition catches this. Without this fix, a page refresh during reflection/report in together-mode drops the user to overview with an orphaned session.

- [x] **Task 2: Update pgTAP test for last-step lock-in**
  - File: `supabase/tests/database/11_scripture_lockin.sql`, lines 261-266
  - Action: Change the assertion from `'complete'` to `'in_progress'`:
    ```sql
    select is(
      (select status::text from public.scripture_sessions
       where id = current_setting('tests.session_last')::uuid),
      'in_progress',
      '4.2-DB-005: status remains in_progress after last step lock-in (completion happens after report phase)'
    );
    ```

- [x] **Task 3: Fix `onBroadcastReceived` — stop nuking sessions on `currentPhase === 'complete'`**
  - File: `src/stores/slices/scriptureReadingSlice.ts`, line 782
  - Action: Change:
    ```ts
    if (payload.triggered_by === 'end_session' || payload.currentPhase === 'complete') {
    ```
    To:
    ```ts
    if (payload.triggered_by === 'end_session') {
    ```
  - Notes: `endSession` already sets `triggered_by: 'end_session'` in its broadcast payload. The `currentPhase === 'complete'` check was redundant and harmful — `markSessionComplete` uses a direct DB update via `updateSession`, not a broadcast, so no broadcast with `currentPhase: 'complete'` is ever sent during normal completion. Add an inline comment above the guard: `// Only reset on explicit end_session — markSessionComplete uses direct DB update, not broadcast`.

- [x] **Task 4: Fix `handleReflectionSummarySubmit` — await async before phase advance**
  - File: `src/components/scripture-reading/containers/SoloReadingFlow.tsx`, lines 256-312
  - Action: Replace the two separate fire-and-forget `void (async () => { ... })()` blocks plus the synchronous `updatePhase('report')` with a single async block that awaits both `addReflection` and `updateSessionBookmarkSharing` before calling `updatePhase('report')` and `updateSession`. On failure, set `isSubmittingSummary = false` without advancing phase so the user can retry.
  - Notes: The new code:
    ```ts
    const handleReflectionSummarySubmit = useCallback(
      (data: ReflectionSummarySubmission) => {
        if (!session || isSubmittingSummary) return;
        setIsSubmittingSummary(true);

        void (async () => {
          try {
            const isShared = session.mode === 'together';
            const jsonNotes = JSON.stringify({
              standoutVerses: data.standoutVerses,
              userNote: data.notes,
            });
            await scriptureReadingService.addReflection(
              session.id, MAX_STEPS, data.rating, jsonNotes, isShared
            );
            try {
              await scriptureReadingService.updateSessionBookmarkSharing(
                session.id, session.userId, data.shareBookmarkedVerses
              );
            } catch (e) {
              console.error('Bookmark sharing preference failed to save', e);
            }
            updatePhase('report');
            await scriptureReadingService.updateSession(session.id, {
              currentPhase: 'report',
            });
          } catch (error) {
            handleScriptureError({
              code: ScriptureErrorCode.SYNC_FAILED,
              message: 'Failed to save reflection summary',
              details: error,
            });
          } finally {
            setIsSubmittingSummary(false);
          }
        })();
      },
      [isSubmittingSummary, session, updatePhase]
    );
    ```

- [x] **Task 5: Stabilize `isReportEntry` effect — remove `markSessionComplete` from deps**
  - File: `src/components/scripture-reading/containers/SoloReadingFlow.tsx`
  - Action: Add a ref to hold `markSessionComplete` above the effect:
    ```ts
    const markSessionCompleteRef = useRef(markSessionComplete);
    markSessionCompleteRef.current = markSessionComplete;
    ```
    Inside the effect (line 454), change `markSessionComplete()` to `markSessionCompleteRef.current()`. Remove `markSessionComplete` from the dependency array at line 477.
  - Notes: This prevents the effect from re-firing every time `session` changes (which recreates `markSessionComplete`). The ref always points to the latest version. Also audit the other 3 dep arrays that include `markSessionComplete` (lines 371, 396, 421) — if any of them feed into an effect dep array, apply the same ref pattern. If they're only used as click handlers, they're fine as-is.

- [x] **Task 6a: Fix `complete-unlinked` dead-end — enable Return button on error**
  - File: `src/components/scripture-reading/containers/SoloReadingFlow.tsx`, line 883
  - Action: Remove `disabled={Boolean(completionError)}` from the "Return to Overview" button. The user's reflections are already saved — they should always be able to leave.

- [x] **Task 6b: Fix `completion-error` dead-end — add Return to Overview button**
  - File: `src/components/scripture-reading/containers/SoloReadingFlow.tsx`, lines 896-942
  - Action: Add a "Return to Overview" button after the Retry button (inside the `space-y-5` div):
    ```tsx
    <button
      type="button"
      onClick={() => exitSession()}
      data-testid="scripture-completion-error-return-btn"
      className={`text-sm font-medium text-purple-600 hover:text-purple-800 ${FOCUS_RING}`}
    >
      Return to Overview
    </button>
    ```
  - Notes: Uses `exitSession()` (local-only reset) because the user is on an error screen where the server is already in a failed state — calling `endSession` (RPC) would likely also fail. This creates an orphaned `in_progress` session in the DB, which is acceptable: `checkForActiveSession` will resolve it on next app load.

- [x] **Task 7: Add exit button and confirmation dialog to ReadingContainer**
  - File: `src/components/scripture-reading/containers/ReadingContainer.tsx`
  - Action: Add state + UI for exit confirmation:
    1. Add state: `const [showExitConfirm, setShowExitConfirm] = useState(false);`
    2. Add an X button in the header (before the step progress):
       ```tsx
       <button
         onClick={() => setShowExitConfirm(true)}
         className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg p-2 text-purple-600 hover:text-purple-800 ${FOCUS_RING}`}
         aria-label="Exit reading"
         data-testid="reading-exit-button"
         type="button"
       >
         <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
         </svg>
       </button>
       ```
    3. Add confirmation dialog (before closing `</main>`), using the same visual pattern as SoloReadingFlow's exit dialog (lines 1320-1374) but with together-mode text:
       - Title: "End this session?"
       - Description: "This will end the session for both of you."
       - Primary button: "End Session" (calls `handleEndSession()`, disabled when `isSyncing`)
       - Secondary button: "Cancel" (dismisses dialog)
    4. Use `AnimatePresence` + `motion.div` for overlay and dialog animations (Framer Motion is already imported in this file).
  - Notes: This exit button covers the **reading phase only**. `SoloReadingFlow`'s existing exit dialog (lines 1320-1374) already covers reflection, report, and compose phases. `handleEndSession` already exists at line 132. `endSession` calls the `scripture_end_session` RPC which sets `status = 'ended_early'` and broadcasts to the partner. The partner's `onBroadcastReceived` will catch `triggered_by: 'end_session'` and reset their session.

- [x] **Task 8: Update unit test assertions for lock-in broadcast**
  - File: `tests/unit/stores/scriptureReadingSlice.lockin.test.ts`, around line 287
  - Action: If there are test assertions that expect `status = 'complete'` after last-step lock-in broadcast, update them to expect `status = 'in_progress'`. The existing test at line 287 uses `currentPhase: 'reflection'` in the broadcast payload (correct), but verify no other assertions in the file check for `status: 'complete'`.

### Acceptance Criteria

- [x] AC 1: Given both users lock in on step 16 (last step), when the `scripture_lock_in` RPC executes, then `current_phase` is set to `'reflection'` and `status` remains `'in_progress'`.
- [x] AC 2: Given a user is in the reflection or report phase, when a `state_updated` broadcast is received with `currentPhase: 'complete'` but without `triggered_by: 'end_session'`, then the session is NOT reset and the phase/version update is applied normally.
- [x] AC 3: Given a user is in any phase, when a `state_updated` broadcast with `triggered_by: 'end_session'` is received, then the session IS reset to overview.
- [x] AC 4: Given a user submits the reflection summary, when `addReflection` fails, then the phase does NOT advance to 'report', the user remains on the reflection screen, and the Continue button becomes re-enabled.
- [x] AC 5: Given a user submits the reflection summary, when all server writes succeed, then the phase advances to 'report' and the MessageCompose screen renders (linked user) or complete-unlinked screen renders (unlinked user).
- [x] AC 6: Given the user is on the `complete-unlinked` screen with a completion error, when they tap "Return to Overview", then they are returned to the scripture overview (button is NOT disabled by error state).
- [x] AC 7: Given the user is on the `completion-error` screen, when they see the error, then a "Return to Overview" button is visible and tapping it returns them to the scripture overview.
- [x] AC 8: Given the user is in together-mode reading, when they tap the X button, then a confirmation dialog appears with "End this session?" text, and tapping "End Session" calls `endSession()` and returns both users to overview.
- [x] AC 9: Given the user is in together-mode reading and taps the X button, when they tap "Cancel" on the confirmation dialog, then the dialog dismisses and reading continues.
- [x] AC 10: Given both users complete the full together-mode flow (lobby, reading, last lock-in, reflection, compose/skip, report), when the Daily Prayer Report renders, then the user sees their own ratings/bookmarks and the partner's message (if sent).

## Additional Context

### Dependencies

- Task 1 (RPC migration) must be applied first — it's the DB-level root cause
- Task 1b (routing fix) must accompany Task 1 — without it, together-mode page refreshes during reflection/report break
- Task 2 (pgTAP update) must match Task 1 — run together via `supabase db reset`
- Task 3 (broadcast guard) must be done before testing the full together-mode flow
- Tasks 4, 5, 6a, 6b, 7, 8 are independent of each other but all depend on Tasks 1-3
- No new npm dependencies required

### Testing Strategy

- **Task 1 + 2**: Run `supabase db reset && npm run test:db` — pgTAP test 4.2-DB-005 must pass with updated assertion
- **Task 3**: Update or add Vitest test in `scriptureReadingSlice.lockin.test.ts` — verify `onBroadcastReceived` with `currentPhase: 'complete'` does NOT reset session (no `triggered_by: 'end_session'`), and verify it DOES reset when `triggered_by: 'end_session'` is present
- **Task 4**: Vitest test — mock `addReflection` to throw, verify phase stays at `'reflection'` and `isSubmittingSummary` resets to false
- **Task 5**: Verify no spurious effect re-runs (test that `reportSubPhase` doesn't flicker during session phase changes)
- **Task 1b**: Verify routing by checking `ScriptureOverview.tsx` routes together-mode sessions with `currentPhase = 'report'` and `status = 'in_progress'` to `SoloReadingFlow`
- **Tasks 6a, 6b, 7**: Manual UI testing — navigate to each screen and verify escape routes work. Consider adding Playwright tests for error-state escape routes in a follow-up if error-state test infrastructure is built
- **AC 10 (full flow)**: Manual end-to-end test with two browser tabs: lobby, reading, last lock-in, reflection, compose, report. Verify both users see the Daily Prayer Report with correct data.

### Notes

- `SoloReadingFlow` at 1,378 lines is a strong candidate for future refactoring (split reflection/report into separate container components). This spec fixes the bugs with minimal structural changes. A follow-up spec can address the structural debt.
- The `scripture_lock_in` RPC has unused variable declarations (`v_lock_payload`, `v_snapshot`) left over from removed `PERFORM realtime.send()` calls. The new migration can clean these up since it replaces the full function body.
- `checkForActiveSession` ignoring together-mode sessions is a known gap but out of scope for this spec.
- `scripture_end_session` RPC has a status guard: `IF v_session.status != 'in_progress'`. After Task 1, the status will be `'in_progress'` during reflection/report, so `endSession` will work correctly if a user exits during those phases. Previously it would have failed because status was prematurely `'complete'`.

## Review Notes
- Adversarial review completed
- Findings: 13 total, 3 fixed, 10 skipped (noise/not applicable)
- Resolution approach: auto-fix
- F1 (High): Added focus trap, Escape key handler, and aria-modal to ReadingContainer exit dialog
- F2 (High): Moved `updatePhase('report')` after `updateSession` succeeds — no more optimistic phase advance on server failure
- F3 (Medium): Added `min-h-[48px]` touch target to completion-error Return button
