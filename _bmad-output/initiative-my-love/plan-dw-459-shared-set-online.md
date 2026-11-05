---
title: 'DW-459: one shared setOnline for the unit tests'
type: 'chore'
ticket: 'DW-459'
created: '2026-11-04'
status: 'built'
baseline_revision: '645840a380306581c1f6b91784c1d75c26e902a1'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Fourteen unit test files each define a private `setOnline`, against AGENTS.md's shared-helper rule, and `fakeEventsBackend.ts` exports its own copy too. Ten copies set `navigator.onLine` with `Object.defineProperty`, which is exactly what `tests/unit/stores/navigatorFixtures.ts` already does. The other four (`pushPreferencesService`, `accountDataApis`, `profileService`, `coupleSettingsService`) use `vi.spyOn(navigator, 'onLine', 'get')`.

**Approach:** Delete every local copy and import `setOnline` from `navigatorFixtures.ts`. `fakeEventsBackend.ts` re-exports it, the way `accountDataFixtures.ts` does, so its two suites keep their import. The four spy-form files switch to the shared `defineProperty` stub. Each one already calls `setOnline(true)` in `beforeEach`, and no other code in those files spies on `onLine`, so a second, spy-based helper is not needed. `notesSliceQueueFixture.ts` stays as it is: its `setOnline` drives a stateful getter that `stubOnline` installs, so it is a different helper.

</frozen-after-approval>

## Implementation Notes

Oneshot: the change is mechanical, about 60 lines across 15 test files, with no behaviour change. I checked teardown file by file before switching. `restoreMocks: true` in `vitest.config.ts` puts back only `vi.spyOn` spies, not a property set with `defineProperty`, so the four spy-form files are safe only because each one's top-level `beforeEach` calls `setOnline(true)`. Each test file still gets its own environment, so the stub cannot leak into another file. The affected files pass in order and shuffled with seeds 11 and 463 (16 files, 469 tests); typecheck and eslint are clean.

## Verification

**Commands:**
- `grep -rn "function setOnline" tests` -- expected: only `navigatorFixtures.ts` and `notesSliceQueueFixture.ts`
- `npx vitest run <the 14 files> tests/unit/services/eventsService.test.ts tests/unit/services/eventsService.writes.test.ts` -- expected: all pass
- `npm run typecheck` and `npx eslint <changed files>` -- expected: clean

## Review Triage Log

Quick review: 0 high, 0 medium, 2 low (patched), 1 false.

- low, patched: the Implementation Notes credited `restoreMocks` for resetting the `defineProperty` stub. It resets only spies, and the `beforeEach` `setOnline(true)` is what keeps each test online. The note now says so.
- low, patched: the `navigatorFixtures.ts` header named only `accountDataFixtures.ts` as re-exporting `setOnline`. It now also names `fakeEventsBackend.ts`, plus the rule that a file which sets the stub offline must reset it in `beforeEach`.
- false: "the ledger update is not in the diff." The DW-459 entry was edited after the diff file was written, and it is in this commit.
