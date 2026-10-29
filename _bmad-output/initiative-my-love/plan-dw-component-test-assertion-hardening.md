---
title: 'Harden five component tests whose assertions are weaker than their names'
type: 'chore'
ticket: ''
created: '2026-10-29'
status: 'built'
baseline_revision: '210b3a2899d31126886243451dc113327be817b0'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Five component tests (deferred-work DW-276, DW-302, DW-304, DW-305, DW-311) pass for reasons weaker than their names claim: two drive the display-name length rule with a raw `fireEvent.submit`, AdminPanel's failed-delete case checks only that an alert exists, LoveNoteMessage's image mock drops `getSignedImageUrl`'s `forceRefresh` argument, PokeKissInterface's setter spy has no mounted positive control, and two copies of `settleNameLookups` wait only on the partner-name lookup.

**Approach:** Test-only edits, each keeping everything the old assertion checked:
- DW-276: in `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx` drop `submitPastNativeValidation` and drive the two length-rule cases with `submit(user, 'ab ')` (type + `user.click`); in `src/components/shared/__tests__/kitSurfaces.test.tsx:409` prefill `initialName="ab "` and `user.click` the submit button. `'ab '` passes native `minLength={3}` but fails the component's trimmed 3-30 rule. Drop the now-unused `fireEvent` imports.
- DW-302: `tests/unit/components/AdminPanel.accountData.test.tsx:264` also asserts the alert's text `Could not delete this message. Please try again.` (from `DeleteConfirmDialog.tsx:43`).
- DW-304: the `loveNoteImageService` mock in `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` forwards every argument it receives; the retry case asserts `toHaveBeenLastCalledWith(image_url, true)`.
- DW-305: `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` 'ignores a late status…' reports `CHANNEL_ERROR` while mounted and asserts `stateSetterCalls` recorded the warning before unmount.
- DW-311: `settleNameLookups` in `OwnDisplayName.test.tsx` and `LoveNotes.realtimeStatus.test.tsx` waits for `getOwnDisplayName` and `getUser` to be called and settle (`Promise.allSettled`), then — only if both fulfilled, since LoveNotes asks the partner name only then — waits on `getPartnerDisplayName`'s settled results. Both copies stay in their files (extracting a shared helper is DW-313, out of scope).

Done when every edited file's suite passes, the edited assertions fail if the behaviour they name is removed, lint and typecheck are clean, and no non-test file changes.

</intent-contract>

## Implementation Notes

Oneshot: about 60 changed lines, all in test files, each fix local to one helper or case. The real `getOwnDisplayName` and `getUser` never reject (both collapse failures to `null`), so no committed case mocks a rejecting own-name lookup — that would test an unreachable state; the DW-311 helper change is checked with a throwaway rejecting case that is not committed.

Implemented as planned. Files: `DisplayNameSetup.test.tsx` (helper `submitPastNativeValidation` replaced by the constant `SHORT_ONCE_TRIMMED = 'ab '` fed to the existing click-driven `submit`), `kitSurfaces.test.tsx` (prefill `'ab '`, `user.click`, plus the refusal's text so the case pins which check fired), `AdminPanel.accountData.test.tsx`, `LoveNoteMessage.test.tsx`, `PokeKissInterface.test.tsx`, `OwnDisplayName.test.tsx`, `LoveNotes.realtimeStatus.test.tsx`. `fireEvent` imports dropped where unused. kitSurfaces' prefilled `'Fr'` became `'ab '`; the name was arbitrary. Mutation checks (all reverted): no `.trim()` in the length check failed 3 cases; retry without `forceRefresh` failed the retry case; changed delete copy failed the alert case; a spy that records nothing failed the new positive control. The throwaway rejecting-own-name case settled without asking the partner name and passed.

## Plan Change Log

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 0, false 1, maybe-false 0
- findings:
  - `[false]` `[reject]` `data-testid="display-name-form"` (`src/components/DisplayNameSetup/DisplayNameSetup.tsx:257`) is left with no consumer now that the raw-submit helper is gone — verified it is unreferenced (the only one of 13 nearby test ids with no consumer), but it is an inert attribute: no runtime effect, no caller diverges and no rule requires its removal, so there is no bad outcome to fix. Surfaced as an observation in the Auto Run Result instead of a drive-by production edit.

## Verification

**Commands:**
- `npx vitest run src/components/DisplayNameSetup src/components/shared/__tests__/kitSurfaces.test.tsx tests/unit/components/AdminPanel.accountData.test.tsx src/components/love-notes/__tests__/LoveNoteMessage.test.tsx src/components/PokeKissInterface src/components/love-notes/__tests__/OwnDisplayName.test.tsx src/components/love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx` -- expected: all pass
- `npx eslint <edited files>` and `npm run typecheck` -- expected: no new errors

**Manual checks (if no CLI):**
- Mutation spot-checks (reverted): drop `true` from `LoveNoteMessage.tsx:270`; change the delete-failure copy in `DeleteConfirmDialog.tsx`; drop `.trim()` from the length check in `DisplayNameSetup.tsx:95` — each edited assertion must fail on its mutation.

## Auto Run Result

Status: built

**Summary:** Hardened the five component tests named by DW-276, DW-302, DW-304, DW-305 and DW-311 so each assertion proves what its test name claims; test files only, every old check kept.

**Files changed:**
- `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx` — length-rule cases type `'ab '` and submit by `user.click`; raw-submit helper and `fireEvent` import removed.
- `src/components/shared/__tests__/kitSurfaces.test.tsx` — edit-route case prefills `'ab '`, submits by `user.click`, and also asserts the refusal text.
- `tests/unit/components/AdminPanel.accountData.test.tsx` — failed-delete case asserts the alert's text.
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` — image-service mock forwards all arguments; retry asserts `forceRefresh` `true`.
- `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` — positive control: the setter spy records the mounted `CHANNEL_ERROR` dispatch before unmount.
- `src/components/love-notes/__tests__/OwnDisplayName.test.tsx`, `src/components/love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx` — `settleNameLookups` settles the own-name branch first and waits on the partner lookup only when that branch fulfilled.

**Review findings:** 1 finding (quick lens). Patches applied: 0. Deferred: 0. Rejected: 1 — unconsumed `data-testid="display-name-form"`, verdict `false` (inert attribute, no harm at the cited location).

**Follow-up review recommendation:** false — no patched entries (high 0, medium 0, low 0).

**Verification:**
- `npx vitest run` on the seven edited suites — 7 files, 164 tests passed; after the line rewrap, the two DW-311 suites re-run — 23 passed.
- `npx eslint` on the seven edited files — clean; `npm run typecheck` (`tsc -b --force`) — clean; `npx prettier --check` on a rewrapped helper file — clean.
- Mutations, each reverted: no `.trim()` in `DisplayNameSetup.tsx:95` failed 3 cases; retry without `true` at `LoveNoteMessage.tsx:270` failed the retry case; changed delete copy in `DeleteConfirmDialog.tsx:43` failed the alert case; a setter spy that records nothing failed the new positive control. A throwaway (uncommitted) rejecting-own-name case settled immediately without asking the partner name.

**Residual risks / observations:**
- `data-testid="display-name-form"` at `src/components/DisplayNameSetup/DisplayNameSetup.tsx:257` now has no consumer; removing it is a production-markup edit outside this bundle.
- `settleNameLookups` is still duplicated in two files (DW-313, out of scope).
- A synchronously throwing name-lookup mock (not `mockRejectedValue`) would be read as fulfilled by the helper; no current case does that.
