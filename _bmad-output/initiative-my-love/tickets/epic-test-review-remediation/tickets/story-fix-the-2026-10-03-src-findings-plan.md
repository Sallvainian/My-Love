---
title: 'Fix the 2026-10-03 src findings'
type: 'chore'
ticket: '12'
created: '2026-10-28'
status: done
baseline_revision: 'c92214a7ecb2eac4b383adc8b7ae4b95b12d1a71'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-src.md'
  - '{project-root}/AGENTS.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The 2026-10-03 TEA re-review of `src/` left 21 rows in co-located Vitest files: 9 M2 (hand-built photo rows double-cast to `PhotoWithUrls`; inline events load/write results), 5 L1 (lookups by copy where a role or test id exists), 3 L3 (class-checked elements found by text), 1 L5 (haptics names state the platform call), 3 L7 (two matcher styles for one check in a file). `corrections.md` names none of these rows.

**Approach:** Fix each row as its finding suggests, located by content: build photo rows on `createPhotoInsert`; add `loadFailure` to the events kit and use the kit builders; query by role or test id and assert copy as the value; add three test hooks; rename to behaviour; use `toHaveClass` throughout. One commit per finding group.

## Boundaries & Constraints

**Always:** Every rewritten assertion proves at least what it did (the copy stays an asserted value, never dropped). App-code changes are `data-testid` attributes only. Relative imports inside `src/` (never `@/`). Match surrounding style by hand; never run `prettier --write`. Commits `test(scope): …`, one per group: M2 photos, M2 events, L1, L3 (with its test hooks), L5, L7.

**Never:** Touch files the findings do not name (other `EventsSettings.*` files with inline literals stay as they are). Edit `tests/support/factories/photos.ts` (read only for this story). Weaken, skip or delete a test. Change the ticket plan's status beyond this workflow.

</intent-contract>

## Code Map

- `tests/support/factories/photos.ts` -- `createPhotoInsert(input)` returns the photos `Insert` (`id`, `created_at` optional). Read only. Reach it from `src/components/*/__tests__/` as `../../../../tests/support/factories/photos` (same depth as `src/api/auth/__tests__/authServices.test.ts:3`).
- `src/services/photoService.ts:52` -- `PhotoWithUrls = SupabasePhoto & { signedUrl, isOwn }`; every column required.
- M2 photo builders (each `as unknown as PhotoWithUrls`): `PhotoGallery/__tests__/PhotoGallery.kit.test.tsx` `photo()`, `PhotoGallery.pagination.test.tsx` `photo()`, `PhotoGridItem.recovery.test.tsx` `PHOTO`, `PhotoImageStates.test.tsx` `photo()`, `PhotoViewer.focus.test.tsx` `photo` + `TWO_PHOTOS` (second cast too), `shared/__tests__/photoDialogsA11y.test.tsx` `photo`.
- `src/components/Settings/__tests__/eventsSettingsKit.tsx` -- `loadOk`, `writeFailure`, `EventLoadResult`; `oldOutcomes` builds both shapes inline. Add `loadFailure` beside `loadOk`.
- Inline load/write literals: `EventsSettings.test.tsx` (8 `status: 'failure'`, 2 `resolve`/`finishLoad({ status: 'success' })`), `EventsSettings.session.test.tsx` (5 failure), `EventsSettings.errorIsolation.test.tsx` (`addEvent` returns a cast `{ success: false, code: 'offline', … }`; one inline failed load).
- L1: `love-notes/__tests__/MessageInput.test.tsx` (`findByText`/`queryByText('Failed to send. Try again.')`; an offline refusal sets no error, so no `alert` renders), `PartnerMoodView/__tests__/PartnerMoodView.search.test.tsx` (`queryByText(MISSING)` ×3 → `partner-search-empty`, `queryByText(TAKEN)` → `partner-search-taken`), `DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx` (`queryByText(/Welcome!/)`; Welcome lives only in the h2), `PhotoGallery.pagination.test.tsx` (`getByText(/Photo N of M/)` ×4 → `photo-viewer-position`, text `Photo N of M • Your photo`), `RelationshipTimers/__tests__/EventCountdown.test.tsx` (`'Old Event'`, `'Today!'` ×2, `'Trip to Boston'`, `'Weekend visit'` → `countdown-label`/`-value`/`-description` in `CountdownCard.tsx`).
- L3 hooks: `LoginScreen/LoginScreen.tsx` OR divider div → `login-divider`; `love-notes/MessageInput.tsx` counter div → `message-input-counter` (test file reads it at 905 and 955); `love-notes/LoveNotes.tsx` partner row → `notes-partner-avatar`, `notes-partner-name`, `notes-partner-connected` (the "Connected" `<p>`), used in `LoveNotes.realtimeStatus.test.tsx`'s partner-row tests.
- L5: `src/utils/__tests__/haptics.test.ts` the three "calls navigator.vibrate …" names.
- L7: `PhotoGallery.kit.test.tsx` every `className` substring/regex check; `shared/__tests__/kitSurfaces.test.tsx` the toast's `className).toContain`; `love-notes/__tests__/OwnDisplayName.test.tsx` `partner-name` `toHaveTextContent('Partner Name')`.
- Env: the worktree has no `node_modules`; Vitest resolves up to the main checkout. `npm run typecheck` there shows environmental TS2883 errors in `tests/support/merged-fixtures.ts`; only other errors count. Never symlink `node_modules`.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/PhotoGallery/__tests__/{PhotoGallery.kit,PhotoGallery.pagination,PhotoGridItem.recovery,PhotoImageStates,PhotoViewer.focus}.test.tsx`, `src/components/shared/__tests__/photoDialogsA11y.test.tsx` -- build each row on `createPhotoInsert` per Design Notes, no cast -- commit `test(photos): …`.
- [x] `src/components/Settings/__tests__/eventsSettingsKit.tsx` -- add `export function loadFailure(error: string): EventLoadResult` beside `loadOk`; build `oldOutcomes` from `loadOk`/`loadFailure` -- the one builder the other files use.
- [x] `src/components/Settings/__tests__/{EventsSettings,EventsSettings.session,EventsSettings.errorIsolation}.test.tsx` -- replace every listed literal with `loadFailure(…)`/`loadOk`/`writeFailure('offline', saveMessage)`; drop casts, `as const` and now-unused type imports -- commit `test(settings): …` with the kit.
- [x] `src/components/{love-notes/__tests__/MessageInput,PartnerMoodView/__tests__/PartnerMoodView.search,DisplayNameSetup/__tests__/DisplayNameSetup,PhotoGallery/__tests__/PhotoGallery.pagination,RelationshipTimers/__tests__/EventCountdown}.test.tsx` -- query by the role/test id in the Code Map; the copy stays an exact asserted value (absence: `queryByRole('alert')`, the test id, or `not.toHaveTextContent` on the role-located heading) -- commit `test(l1): …`.
- [x] `src/components/LoginScreen/LoginScreen.tsx`, `src/components/love-notes/MessageInput.tsx`, `src/components/love-notes/LoveNotes.tsx`, then `LoginScreen/__tests__/LoginScreen.kit.test.tsx`, `love-notes/__tests__/MessageInput.test.tsx`, `love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx` -- add the five test ids; locate by them, assert text and classes -- commit `test(l3): …`.
- [x] `src/utils/__tests__/haptics.test.ts` -- rename the three tests to what the user feels (e.g. `vibrates once for 50ms on a mood save`) -- commit `test(haptics): …`.
- [x] `src/components/PhotoGallery/__tests__/PhotoGallery.kit.test.tsx`, `src/components/shared/__tests__/kitSurfaces.test.tsx`, `src/components/love-notes/__tests__/OwnDisplayName.test.tsx` -- `toHaveClass`/`not.toHaveClass` (jest-dom 7.0.1 accepts a RegExp); `grid.className).toBe(skeletonGrid.className)` → `expect(grid).toHaveClass(skeletonGrid.className, { exact: true })`; `partner-name` `.textContent).toBe('Partner Name')` -- commit `test(l7): …`.

**Acceptance Criteria:**
- Given the six photo files, when grepped for `as unknown as PhotoWithUrls`, then none remains and each builds its rows with `createPhotoInsert`.
- Given the three EventsSettings files and the kit, when grepped for `status: 'failure'`, `status: 'success'` or `success: false`, then the only hits are inside the kit's builders.
- Given the files named for L1, L3 and L7, when grepped for the lookups and matchers each row names, then none remains, and `PhotoGallery.kit.test.tsx` and `kitSurfaces.test.tsx` contain no `className).toContain`.
- Given `haptics.test.ts`, when its test names are listed, then none mentions `navigator.vibrate` in the three rows' tests.
- Given each L3 test, when the copy of its element changes, then only the copy assertion fails, not the lookup.
- Given the changed files, when lint, typecheck and their Vitest suites run, then all pass with no new non-TS2883 typecheck error.

## Implementation Notes

- Photo rows: the Design Notes builder as written does not typecheck. The photos `Insert` type leaves `caption` and `mime_type` optional as well as `id` and `created_at`, so a row whose post-factory spread restates only `id`/`created_at` is rejected as `PhotoWithUrls` (`caption: string | null | undefined`). Each builder therefore restates all four (`id`, `caption`, `mime_type: 'image/jpeg'`, `created_at`), the same set `loaderIdentityGuards.photos.test.ts` `photoRow` restates. `PhotoGallery.pagination`'s single `as PhotoWithUrls` on the DW-201 row became a type annotation, and `PhotoViewer.focus`'s second `TWO_PHOTOS` cast went with it.
- Exact copy: where a lookup moved from `getByText(copy)` (an exact match) to a role or test id in a file whose text matcher is `toHaveTextContent`, the copy is asserted with an anchored RegExp (`/^…$/`), so it stays exact without adding a second matcher style to the file. The pagination suite, which already reads `.textContent).toBe`, and EventCountdown, which had no element text matcher, use `.textContent).toBe`.
- L7 negatives: `not.toHaveClass('a')` checks one token, weaker than the `className` substring check it replaces, so the negative checks use a RegExp (`/\bfixed\b/`, `/text-white/`, `/(sm|md|lg):grid-cols/`), which jest-dom 7.0.1 tests against each class token.
- L3: the "harper" test's `findByText` became a `waitFor` on the `notes-partner-name` element. Copy mutations of the OR divider and "Connected" line were run and failed only on the copy assertion.
- `npm run typecheck` in this worktree reported no TS2883 errors (exit 0).

## Plan Change Log

## Review Triage Log

### 2026-10-28 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `DisplayNameSetup.test.tsx` "wears edit copy rather than the first-run welcome": `expect(heading).not.toHaveTextContent('Welcome!')` checks only the h2, while the replaced `screen.queryByText(/Welcome!/)` searched the whole page, so a "Welcome!" rendered outside the heading in edit mode would now pass, against the Always rule that a rewrite proves at least what it did — routed patch, not bad_plan: the one-line fix is trivial, adds no surface, and a re-derivation would reproduce the other 20 rows unchanged. Fixed by the step-03 implementer: `expect(document.body).not.toHaveTextContent('Welcome!')`, folded into the `test(l1)` commit by fixup/autosquash; its message was then reworded to say "absent from the whole page". Lint, typecheck and the 18 changed suites re-run green.

## Design Notes

Photo rows carry `id` and `created_at` in a spread after the factory's body, so the result is a full `PhotoWithUrls` with no cast (the pattern in `tests/unit/stores/loaderIdentityGuards.photos.test.ts` `photoRow`):

```ts
function photo(index: number, isOwn = true): PhotoWithUrls {
  const owner = isOwn ? 'me' : 'partner';
  const keys = { id: `photo-${index}`, created_at: '2026-09-01T10:00:00.000Z' };
  return {
    ...createPhotoInsert({ ...keys, user_id: owner, storage_path: `${owner}/${index}.jpg`, mime_type: 'image/jpeg', file_size: 68 }),
    ...keys,
    signedUrl: null,
    isOwn,
  };
}
```

Keep each file's existing `caption`. Where a file omitted `user_id` or `created_at`, add the value the rest of that file implies (`'me'`, `'2026-09-01T10:00:00.000Z'`).

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: no error other than TS2883 in `tests/support/merged-fixtures.ts`
- `npx vitest run <each changed test file>` -- expected: all pass

## Auto Run Result

Status: built

**Summary:** Fixed all 21 rows of the 2026-10-03 src/ review (9 M2, 5 L1, 3 L3, 1 L5, 3 L7), one commit per finding group, six commits from `c92214a7ecb2eac4b383adc8b7ae4b95b12d1a71`: `00972624` test(photos), `0eb9c3d6` test(settings), `694149ef` test(l1), `0575c646` test(l3), `0748536c` test(haptics), `3925cb6f` test(l7).

**Files changed:**
- `src/components/PhotoGallery/__tests__/PhotoGallery.kit.test.tsx`: M2, photo rows built on `createPhotoInsert`. L7, `toHaveClass` throughout, with a RegExp for negative checks and `{ exact: true }` for the skeleton/grid comparison.
- `src/components/PhotoGallery/__tests__/PhotoGallery.pagination.test.tsx`: M2, the factory builds the rows. L1, the position is read through `photo-viewer-position` with exact text.
- `src/components/PhotoGallery/__tests__/PhotoGridItem.recovery.test.tsx`, `PhotoImageStates.test.tsx`, `PhotoViewer.focus.test.tsx`, `src/components/shared/__tests__/photoDialogsA11y.test.tsx`: M2, the factory builds the rows and no cast remains.
- `src/components/Settings/__tests__/eventsSettingsKit.tsx`: new `loadFailure(error)` builder. `oldOutcomes` is built from the kit's builders.
- `src/components/Settings/__tests__/EventsSettings.test.tsx`, `EventsSettings.session.test.tsx`, `EventsSettings.errorIsolation.test.tsx`: M2, the inline literals became `loadFailure`, `loadOk` and `writeFailure('offline', …)`.
- `src/components/love-notes/__tests__/MessageInput.test.tsx`: L1, the alert is found by role and absence is checked by role. L3, the counter is found by test id.
- `src/components/PartnerMoodView/__tests__/PartnerMoodView.search.test.tsx`: L1, absence is checked by `partner-search-empty` and `partner-search-taken`.
- `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx`: L1, absence of "Welcome!" is checked across the page with `document.body`.
- `src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx`: L1, the card is read through the `countdown-label`, `-value` and `-description` ids.
- `src/components/LoginScreen/LoginScreen.tsx`, `src/components/love-notes/MessageInput.tsx`, `src/components/love-notes/LoveNotes.tsx`: L3 test hooks (`login-divider`, `message-input-counter`, `notes-partner-avatar`, `notes-partner-name`, `notes-partner-connected`). These are attribute-only changes.
- `src/components/LoginScreen/__tests__/LoginScreen.kit.test.tsx`, `src/components/love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx`: L3, elements are found by the new ids, and copy and classes are asserted separately.
- `src/utils/__tests__/haptics.test.ts`: L5, three tests renamed to the behaviour.
- `src/components/shared/__tests__/kitSurfaces.test.tsx`: L7, the toast's `top-[…]` check folded into `toHaveClass`.
- `src/components/love-notes/__tests__/OwnDisplayName.test.tsx`: L7, the `partner-name` check uses an exact `.textContent).toBe`.

**Review findings:** 1 finding (quick lens). Patches applied: 1 low, the DisplayNameSetup absence check restored to page-wide reach. Deferred: none. Rejected: none.

**Follow-up review recommendation:** false. Only one `low` patch was applied: no `high`, and fewer than two `medium`.

**Verification:** `npm run lint` exited 0. `npm run typecheck` exited 0 with zero `error TS` lines, TS2883 included. `npx vitest run` on the 18 changed test files passed 18 files and 273 tests, before and after the patch. The implementer also changed the OR divider and "Connected" copy as a mutation check: only the copy assertions failed, and both files were restored.

**Residual risks:**
- The ticket's verify step also calls for a fresh `bmad-tea-test-review` run on `src/` reporting no Critical or High. That run belongs to the orchestrator or owner, as for stories 10 and 11, and was not run here.
- Five other `EventsSettings.*` suites (`addEdit`, `delete`, `lifetime`, `pagination`, `reconciliation`) still build failed-load literals inline. No 2026-10-03 row names them, so they were left alone, but a fresh review may flag them as M2 (Medium).
- The Design Notes example restates only `id`/`created_at`. That does not typecheck, because `caption` and `mime_type` are optional too. The code restates all four, as recorded in Implementation Notes.
