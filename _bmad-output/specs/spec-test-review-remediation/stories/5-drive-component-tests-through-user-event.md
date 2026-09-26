---
title: 'Drive component tests through user-event'
type: 'chore'
created: '2026-09-25'
status: 'done'
baseline_revision: '95f6f4271754125c453af32139107353cb108aa5'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/corrections.md'
warnings: ['oversized']
deferred:
  - summary: >-
      LoginScreen's empty-fields check cannot be reached from the UI, so its kit test covers it only through a raw form submit.
    evidence: |-
      The submit button is disabled while either field is empty (src/components/LoginScreen/LoginScreen.tsx:276), and a browser refuses implicit submission when the default button is disabled. The "Please enter both email and password" branch (LoginScreen.tsx:107-110) runs only under a synthetic submit event, which LoginScreen.kit.test.tsx:97 keeps with a same-line reason. Pre-existing: either the branch is dead code or the test premise needs a product decision.
    location: >-
      src/components/LoginScreen/LoginScreen.tsx:107
    severity: low
  - summary: >-
      A fresh M5 re-review may still score the 16 commented raw user-action dispatches this story kept.
    evidence: |-
      The registry's M5 rule (criteria-registry.md:169) has no exemption mechanism. The folder-run workers did not score fireEvent.submit past native validation, click-without-focus cases, img error or window online (test-review-target-src.md:398), which covers most kept lines, but the same-batch refresh.click() pairs in EventsSettings.test.tsx were scored (folder row at :1422 at 92f1c517). Settle by running bmad-testarch-test-review on src/ and tests/unit/ and reading the M5 rows.
    location: >-
      src/components/Settings/__tests__/EventsSettings.test.tsx:1299
    severity: medium (unverified)
  - summary: >-
      AGENTS.md does not record that user-event hangs under Vitest fake setTimeout without both advanceTimers and a jest-global shim.
    evidence: |-
      Testing Library only recognises Jest fake timers (jestFakeTimersAreEnabled checks a `jest` global plus setTimeout.clock, which vi's faked setTimeout carries). PhotoUpload.autoClose.test.tsx needed userEvent.setup({ advanceTimers }) and vi.stubGlobal('jest', …); the next file that fakes setTimeout will hit the same hang. The fix edits an agent-context file.
    location: >-
      AGENTS.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** 255 M5 rows (232 in `findings-src.md` folder run, 23 in `findings-unit.md` folder run; the suite-run tables repeat them as "M5 Low-level event dispatch") flag `fireEvent`, raw `HTMLElement.click()` and `form.dispatchEvent` in Vitest component tests, although `@testing-library/user-event` 14.6.7 is a dependency. `fireEvent.click` skips pointer events, focus and disabled checks, which is why the a11y/focus files carry manual `opener.focus()` workarounds. Some tests named for a key press never press it (`MessageInput.test.tsx` "should add newline on Shift+Enter" only calls `fireEvent.change`).

**Approach:** In every file in the Code Map, replace `fireEvent.click/change/keyDown/submit` and raw `.click()` with a per-test `const user = userEvent.setup()` and `await user.click / type / clear / paste / keyboard / tab / upload / selectOptions / dblClick`. Convert shared helpers (`openWith`, `openBy`, `activateHistory`, `openRemoval`, `submitForm`, `fillForm`, `selectFile`/`pickPhoto`/`pick`, `type`, `save`, `submit`, `clickDialogButton`) to async user-event helpers, which clears most rows at once. Every test named for a key press or gesture performs it through user-event.

## Boundaries & Constraints

**Always:**
- Keep or strengthen what each test proves; every existing assertion stays. Tests that were sync become `async`.
- Drop the manual `opener.focus()` / `.focus()` workarounds (and their "fireEvent does not focus" comments) only where `user.click` now moves focus the same way; keep the focus assertions.
- A raw dispatch stays only where user-event cannot reach the state the test is about, with a same-line `// raw <event>: <reason>` comment. The known cases: `fireEvent.error` on an `<img>` (a resource event, not a user action); `window` `online` events; `fireEvent.submit` that deliberately bypasses native constraint validation or a missing submit button (`DisplayNameSetup.test.tsx` `submitPastNativeValidation`, `EventsSettings.test.tsx` "blocks direct and keyboard submissions"); the same-batch `act(() => { refresh.click(); refresh.click(); })` pairs and the in-microtask `form.dispatchEvent` in `EventsSettings.test.tsx`, which prove a ref guard before React commits — a `user.dblClick` re-renders between clicks and would stop proving it. Any further kept raw dispatch is listed in the Auto Run Result with its reason.
- Match surrounding style by hand; relative imports in `src/`; no `prettier --write`.

**Never:**
- Weaken, skip or delete a test to satisfy M5; change app code (except a `data-testid`/aria hook if a query needs one — none expected); touch e2e, api or archive specs; fix rows of other rule ids (other stories own them).
- Change a test's premise to fit user-event: if `maxLength` or `accept` would stop user-event reaching the asserted value, use `userEvent.setup({ applyAccept: false })` for files, and for an over-length value keep the raw `fireEvent.change` with a same-line reason.

</intent-contract>

## Code Map

M5 rows by file (row counts from the folder runs; line numbers are from 92f1c517 — locate by content). `grep -n "fireEvent\.\|\.click()\|dispatchEvent" <file>` lists every site.

- **G1 EventsSettings** — `src/components/Settings/__tests__/EventsSettings.test.tsx` (37 rows, 64 calls; helpers `submitForm` ~:235, `fillForm`/`prepareForm`; raw-click pairs ~:1255, :1508, :1756 and `dispatchEvent` ~:1442 stay per Boundaries), `EventsSettings.focus.test.tsx` (14; helper `openBy` ~:175 with the focus workaround), `EventsSettings.pagination.test.tsx` (11), `EventsSettings.lifetime.test.tsx` (4), `EventsSettings.errorIsolation.test.tsx` (1).
- **G2 other Settings** — `src/components/Settings/__tests__/AnniversarySettings.a11y.test.tsx` (13; helper `openWith` ~:63 with the focus workaround; Escape/Tab tests), `AnniversarySettings.writes.test.tsx` (6), `Settings.displayName.test.tsx` (10), `Settings.birthdayWedding.test.tsx` (7; date inputs), `Settings.togetherSince.test.tsx` (3; date + time inputs), `Settings.kit.test.tsx` (3), `Settings.mobileDataPhotos.test.tsx` (1; "Enter and Space reach it" — press both via `user.keyboard`).
- **G3 love-notes** — `src/components/love-notes/__tests__/MessageInput.test.tsx` (24; file inputs → `user.upload`; Enter/Shift+Enter/Escape tests; the corrections Shift+Enter item: type text, press `{Shift>}{Enter}{/Shift}`, assert no send and a newline in the value), `NoteRemoval.test.tsx` (13; helper `openRemoval`), `FullScreenImageViewer.test.tsx` (6), `FailedNoteRemoval.test.tsx` (4), `LoveNoteMessage.test.tsx` (3; `fireEvent.error(img)` ~:816 stays), `ImagePreview.test.tsx` (2).
- **G4 photos** — `src/components/PhotoGallery/__tests__/PhotoViewer.focus.test.tsx` (13; arrow keys, Escape with focus on `<body>`, double-tap Delete), `PhotoImageStates.test.tsx` (5; `fireEvent.error` ~:247 stays), `PhotoGallery.pagination.test.tsx` (3), `PhotoGallery.kit.test.tsx` (3), `src/components/PhotoUpload/__tests__/PhotoUpload.autoClose.test.tsx` (2; fakes `setTimeout` at ~:96 → `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`), `PhotoUpload.offline.test.tsx` (2), `PhotoUpload.validation.test.tsx` (1; invalid-type file → `applyAccept: false`), `src/components/shared/__tests__/photoDialogsA11y.test.tsx` (12; helper at ~:90 picks a file; overlay-tap tests).
- **G5 onboarding, shared, mood, misc src** — `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx` (10; helpers `submit` ~:73, `submitPastNativeValidation` ~:87 whose `fireEvent.submit` stays; `maxLength={30}` input; fake Date only at ~:120), `src/components/LoginScreen/__tests__/LoginScreen.kit.test.tsx` (2 folder + suite rows at :96/:176 submit → click the submit button), `src/components/shared/__tests__/kitSurfaces.test.tsx` (2 + suite :342 submit), `kitDialogs.test.tsx` (1), `src/components/Navigation/__tests__/AppNavigation.test.tsx` (2), `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` (9; already imports userEvent; fakes only Date/setInterval at ~:400), `src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx` (1), `src/components/MoodTracker/__tests__/MoodTracker.draftPreservation.test.tsx` (1), `src/components/MoodHistory/__tests__/MoodDetailModal.focus.test.tsx` (1).
- **G6 tests/unit** — `tests/unit/components/AdminPanel.accountData.test.tsx` (11 rows, 26 calls), `tests/unit/components/LoginScreen.callbackNotice.test.tsx` (4; `fireEvent.submit` :117 → click `submit-button`), `tests/unit/components/CreateMessageForm.submitKey.test.tsx` (helpers `type` :45, `save` :49), `tests/unit/api/partnerService.check.test.tsx` (4), `tests/unit/App.eventsSession.test.tsx` (:701), `tests/unit/App.localCopyRefresh.test.tsx` (:256/:263 raw `gate.click()`; its `online` dispatches stay), `tests/unit/services/dbSchema.test.ts` (:1069 `clickDialogButton` raw click, used by five tests).

user-event pitfalls (UNVERIFIED in this repo until run): `user.type` treats `{` and `[` as key descriptors (escape or use `user.paste`); long strings are faster with `user.clear` + `user.paste`; `user.upload` filters by `accept` unless `applyAccept: false`; `user.type` into `type="date"`/`"time"` needs a full valid value; with faked `setTimeout` user-event hangs without `advanceTimers`.

## Tasks & Acceptance

**Execution (one commit per group, `test(<scope>): drive … through user-event`):**
- G1 files above -- convert every dispatch and helper; keep the three raw-click pairs and the `dispatchEvent` with same-line reasons -- 67 rows.
- G2 files above -- convert; remove the `openWith` focus workaround; Escape/Tab tests use `user.keyboard('{Escape}')` / `user.tab()` -- 43 rows.
- G3 files above -- convert; make "Shift+Enter" press it -- 52 rows plus the corrections item.
- G4 files above -- convert; `advanceTimers` for autoClose; `applyAccept: false` where a rejected file type is the premise -- 41 rows.
- G5 files above -- convert; submits go through the submit button except the justified `submitPastNativeValidation` -- 29 rows plus suite submit rows.
- G6 files above -- convert -- 23 rows.

**Acceptance Criteria:**
- Given the Code Map files, when `grep -nE "fireEvent\.|\.click\(\)|dispatchEvent\("` runs over them, then every remaining hit carries a same-line `// raw …: <reason>` comment and belongs to a case named in Boundaries or listed in the Auto Run Result.
- Given any test whose name names a key press or gesture (Enter, Shift+Enter, Space, Escape, Tab, arrow keys, tap, double-tap), when it runs, then it performs that input through user-event.
- Given the a11y/focus helpers, when they open a dialog, then focus reaches the opener through `user.click`, with no manual `.focus()` workaround.
- Given the finished story, when `npm run lint`, `npm run typecheck` and `npm run test:unit` run, then all exit 0.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- verdicts: 24 findings — high 0, medium 2, low 11, false 10, maybe-false 1
- findings:
  - `[low]` `[patch]` Blind: EventsSettings "blocks direct and keyboard submissions" raw-submit comment claims a browser submits on Enter, but with no submit button and two blocking fields it does not — comments on all three raw submits and the stale one above them reworded (ce1409d5).
  - `[low]` `[patch]` Blind: kitSurfaces raw-submit comment blames native minLength, but a prefilled value never fails it in a browser; happy-dom blocks the click — comment reworded to name happy-dom (ce1409d5).
  - `[low]` `[defer]` Blind: LoginScreen.kit:97 tests an empty-fields branch no user can reach (button disabled, implicit submission refused) — pre-existing app/test premise; deferred.
  - `[medium]` `[patch]` Blind: LoginScreen.kit notice test changed premise from a validation-failing attempt to a valid sign-in, duplicating callbackNotice — restored through user-event with `person@localhost`: asserts the validation error, notice gone, signIn not called; moving setNoticeDismissed below the validation makes it fail (ce1409d5).
  - `[false]` `[reject]` Blind: PhotoViewer double-tap via user.dblClick no longer proves the handleDeleteConfirm guard — the old pair of fireEvent.click calls also re-rendered between clicks (each wrapped in act) and React skips onClick on the disabled button (`disabled={isDeleting}`), so the test proves exactly what it did before.
  - `[false]` `[reject]` Blind: mobileDataPhotos "Enter and Space reach it" focuses by click, not Tab — the name says the keys reach the switch; the test now presses Enter and Space on it and asserts each toggles and saves, which it never did before.
  - `[low]` `[patch]` Blind: jest stub makes Testing Library drive vi's clock, so the autoClose "findByText polls on setTimeout" comment is stale, and AGENTS.md lacks the trap — comment rewritten to say findByText would move the 3 s timer (ce1409d5); the AGENTS.md note is deferred (agent-context file).
  - `[false]` `[reject]` Blind: MoodDetailModal replaced a setup .focus() with a click on a handler-less trigger (churn) — the click only moves focus, as the AC asks for openers; no test outcome changes and no harm is named.
  - `[low]` `[reject]` Blind: four clear-then-type helpers differ (paste vs type) — no fixture in these files contains `{`/`[` or needs the other behaviour; unifying them means a new shared test-support module.
  - `[low]` `[patch]` Blind: the UserEvent type import is written two ways — FailedNoteRemoval and MessageInput switched to the separate `import type` line the other 13 files use (ce1409d5).
  - `[low]` `[reject]` Blind: the spec's Verification line on typecheck contradicts itself — the fix edits this build's spec; typecheck exited 0 in this worktree (recorded below).
  - `[low]` `[reject]` Blind: `// raw online` comments added in App.localCopyRefresh but not in MessageList.offlineLoadMore or usePhotoImage — those files carry no M5 row and an online event is not a user action, so the intent excludes them.
  - `[low]` `[patch]` Edge: FullScreenImageViewer "should not respond to other keys" can flake — the close button takes focus after a 100 ms timer, and Enter/Space would then press it — the test now waits for that focus and blurs to <body> before the keys (ce1409d5).
  - `[false]` `[reject]` Edge: openFromEmptyState and several harnesses still call opener.focus() — they open by rerender, not a click, so .focus() sets the starting focus rather than standing in for a click; the AC covers openers reached by clicks.
  - `[false]` `[reject]` Edge: PhotoViewer.focus "…or Escape dies on the first click" presses neither — the title names a failure mode; a click-then-Escape could not fail here because the window-level Escape fallback closes the viewer from <body>, so the attribute check is the failable one. Renaming is story 8 (L5).
  - `[medium]` `[patch]` VerificationGap: no test proves the callback notice retires on an attempt that fails client-side validation — same root cause as the LoginScreen.kit premise row; patched there (ce1409d5).
  - `[maybe-false]` `[defer]` Intent: a re-review may still score the commented raw user-action dispatches as M5 — settle by re-running test-review on src/ and tests/unit/; deferred as medium (unverified).
  - `[false]` `[reject]` Intent: the gesture clause reaches accountDataSlices "tap" tests — they are store-slice tests with no UI; the name describes the action the slice models, and no gesture can be performed.
  - `[false]` `[reject]` Intent: PhotoViewer.focus:286 performs no Escape or click — same refutation as the Edge row.
  - `[low]` `[patch]` Intent: EventsSettings:1499 keyboard path still ends in a raw submit — same root cause as the Blind comment row; patched there.
  - `[low]` `[defer]` Intent: LoginScreen.kit:97 and kitSurfaces:345 test states no user reaches — LoginScreen part deferred with the Blind row; the kitSurfaces part is refuted (a browser would submit the untouched prefilled value; only happy-dom blocks it, now said in the comment).
  - `[false]` `[reject]` Intent: PhotoUpload.validation dropped the valueWrites assertion — user-event owns the file input's value, so the spy cannot work; the replacement asserts the reset and a same-file re-pick, and removing the reset at PhotoUpload.tsx:65 fails it (auditor verified).
  - `[false]` `[reject]` Intent: PhotoViewer double-tap change — the auditor itself found it changes nothing (act-wrapped clicks and a disabled button before and after).
  - `[false]` `[reject]` Intent: commit grouping read as G1–G6 — the story spec defines the finding groups; six group commits plus one review-fix commit follow it.

## Design Notes

```ts
async function openWith(user: UserEvent, name: string) {
  const opener = screen.getAllByRole('button', { name: new RegExp(name) })[0];
  await user.click(opener); // focuses the opener, as a real click does
  return opener;
}
```
Create `userEvent.setup()` inside each test (or a `beforeEach` that stores it), not at module level.

## Auto Run Result

Status: done

**Summary:** Every M5 row (232 in findings-src, 23 in findings-unit; the suite-run tables repeat them) now drives the UI through `userEvent.setup()` — click, type, clear, paste, keyboard, tab, upload, dblClick. The shared helpers (`openWith`, `openBy`, `activateHistory`, `openRemoval`, `submitForm`, `fillForm`, `selectFile`, `type`, `save`, `clickDialogButton` …) are async and take a per-test `user`, and the manual `opener.focus()` workarounds they carried are gone. Every test named for a key press or gesture performs it; "should add newline on Shift+Enter" types, presses `{Shift>}{Enter}{/Shift}`, and asserts the newline and no send. No app code changed and no test was removed.

**Commits:** G1 144dc30c, G2 add19514, G3 2e908215, G4 8c2fc20e, G5 cbdfcbcb, G6 3d612c1f, review fixes ce1409d5; spec record on top.

**Files changed (42 test files):**
- G1 EventsSettings (`.test`, `.focus`, `.pagination`, `.lifetime`, `.errorIsolation`): helpers and all dispatches through user-event.
- G2 AnniversarySettings `.a11y`/`.writes`, Settings `.displayName`/`.birthdayWedding`/`.togetherSince`/`.kit`/`.mobileDataPhotos`: dialogs, date/time inputs, Escape/Tab, Enter and Space on the switch.
- G3 love-notes MessageInput, NoteRemoval, FullScreenImageViewer, FailedNoteRemoval, LoveNoteMessage, ImagePreview: uploads, keyboard sends, Shift+Enter.
- G4 PhotoViewer.focus, PhotoImageStates, PhotoGallery `.pagination`/`.kit`, PhotoUpload `.autoClose`/`.offline`/`.validation`, shared/photoDialogsA11y: uploads (`applyAccept: false` where a rejected type is the premise), fake-timer setup in autoClose.
- G5 DisplayNameSetup, LoginScreen.kit, kitSurfaces, kitDialogs, AppNavigation, PokeKissInterface, PartnerMoodView.kit, MoodTracker.draftPreservation, MoodDetailModal.focus.
- G6 tests/unit AdminPanel.accountData, LoginScreen.callbackNotice, CreateMessageForm.submitKey, partnerService.check, App.eventsSession, App.localCopyRefresh, services/dbSchema.

**Raw dispatches kept, each with a same-line `// raw …: <reason>`:**
- Named in Boundaries: `fireEvent.error` on images (PhotoImageStates, LoveNoteMessage); window `online` (App.localCopyRefresh); `submitPastNativeValidation` (DisplayNameSetup); the three same-batch `refresh.click()` pairs, the in-microtask `dispatchEvent`, and the three buttonless `fireEvent.submit` calls in EventsSettings.test.
- Beyond Boundaries: EventsSettings.pagination Load-more click (the premise is an activation that never focuses the control; `user.click` focuses it); LoginScreen.kit:97 submit (button disabled while empty — deferred as unreachable); kitSurfaces:345 submit (happy-dom blocks the click-driven submit on the prefilled 2-char name); PokeKissInterface two `poke-animation` clicks (stand in for the animation ending without moving focus off the badge).

**Other departures:** PhotoUpload.autoClose stubs a `jest` global so Testing Library advances vi's faked clock (otherwise every user-event action hangs); PhotoUpload.validation asserts the input reset and a same-file re-pick instead of a `value` setter spy; dbSchema attaches the rejection check before the "Not now" click, because the dismiss rejects mid-click.

**Review:** 24 findings (high 0, medium 2, low 11, false 10, maybe-false 1). Patched 6 entries (1 medium: the LoginScreen notice premise; 5 low: EventsSettings and kitSurfaces comments, autoClose comment, import style, FullScreenImageViewer focus race) in ce1409d5. Deferred 3 (unreachable LoginScreen empty-fields branch, re-review scoring of kept raw dispatches, AGENTS.md fake-timer note). Rejected 15 with reasons in the triage log. Follow-up review recommended: false — first pass, no high and one medium entry patched.

**Verification (after patches):** `npm run lint` exit 0; `npm run typecheck` exit 0 with no errors in this worktree; `npm run test:unit` 155 files / 2796 tests passed; the 42 changed files under `--sequence.shuffle --sequence.seed=1` 678 passed (seed 7 also passed before patches). The LoginScreen.kit fix was shown to fail with `setNoticeDismissed(true)` moved below the email check, then restored.

**Residual risks:** A fresh M5 re-review may still score the kept, commented raw dispatches (deferred, unverified). Two Vitest cache folders were left by the implementer at `src/components/Settings/__tests__/node_modules/` and `src/components/love-notes/__tests__/node_modules/`; both are gitignored and harmless, and were not deleted.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0 (worktree-only TS2883 in `tests/support/merged-fixtures.ts` is the known baseline).
- `npx vitest run <each group's files>` after each group -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `npx vitest run --sequence.shuffle --sequence.seed=1` over the changed files -- expected: all pass.
