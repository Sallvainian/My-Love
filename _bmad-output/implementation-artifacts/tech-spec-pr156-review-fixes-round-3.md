---
title: 'PR #156 Review Fixes — Round 3'
type: 'bugfix'
created: '2026-03-15'
status: 'done'
baseline_commit: '884f9fa'
context: ['_bmad-output/project-context.md']
---

# PR #156 Review Fixes — Round 3

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Claude's code review found 4 remaining bugs: presence hook auth failure leaves stale connection UI, staleTimerRef leaks on CHANNEL_ERROR, selectRole success path doesn't defensively clear scriptureError, and lock-in broadcast fires when session is null.

**Approach:** 4 targeted fixes across 2 files. No architectural changes.

## Boundaries & Constraints

**Always:** Preserve existing test behavior. Run typecheck + lint + format after changes.

**Never:** Refactor surrounding code. Touch files not listed.

</frozen-after-approval>

## Code Map

- `src/hooks/useScripturePresence.ts` -- Presence channel hook (fixes 1-2)
- `src/stores/slices/scriptureReadingSlice.ts` -- Scripture store (fixes 3-4)

## Tasks & Acceptance

**Execution:**
- [ ] `useScripturePresence.ts:188-195` -- Auth failure catch: reset connection state, clear staleTimerRef/intervalRef, clean up channel + null ref (matches CHANNEL_ERROR handler pattern)
- [ ] `useScripturePresence.ts:163-184` -- CHANNEL_ERROR handler: clear staleTimerRef alongside intervalRef (timer leak)
- [ ] `scriptureReadingSlice.ts:618-626` -- selectRole success set(): add `scriptureError: null` for defensive consistency
- [ ] `scriptureReadingSlice.ts:882-888` -- Guard lock-in broadcast inside `if (currentSession)` block

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors
- `npm run lint` -- expected: no errors
- `npm run format:check` -- expected: all files formatted
- `npx vitest run --silent` -- expected: all unit tests pass
