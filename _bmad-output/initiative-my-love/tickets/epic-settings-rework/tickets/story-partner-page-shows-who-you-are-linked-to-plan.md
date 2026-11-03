---
title: 'Partner page shows who you are linked to'
type: 'feature'
ticket: '8'
created: '2026-11-03'
status: done
baseline_revision: 'e9aab4827b00003722790a6ea858c49bc0512e77'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md'
  - '{project-root}/_bmad-output/initiative-my-love/ux-settings-page/DESIGN.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Settings has no Partner row or page, so nothing in Settings says who the account is linked to (R5, R1). `PartnerInfo.connectedAt` is fed from `users.updated_at`, which changes on any profile edit, so the app has no true link date; and the store cannot tell "server said unlinked" from "nothing answered yet" (both are `partner === null`, no error).

**Approach:** Add a top-page `Partner` group with the Partner row, and a `/settings/partner` page with three states (linked read-only rows; not linked with lead line and `Go to Partner`; unknown with the Partner view's load-error card). Source Linked since from the accepted `partner_requests` row's `updated_at` inside `partnerService.getPartner`, renamed `linkedSince` and saved in the existing `partner` local copy. Add `partnerKnown` to `partnerSlice` so `Not linked` shows only after a loaded answer.

## Boundaries & Constraints

**Always:** Strings verbatim from EXPERIENCE.md (`Partner`, `Name`, `Email`, `Linked since`, `Not linked`, `You aren't linked with a partner yet.`, `Go to Partner`, and the Partner view's `Couldn't load your partner` with its offline/retry lines). Read-only rows: no chevron, not a button, no pressed state, value muted, never reduced opacity (DESIGN Read-only row). Lead line: 15px / 1.45, muted, `px-1`, on the page ground above the card. Top-page group order Account, Partner, Preferences, About. Partner row tile icon `Users` (lucide, "two people"); `Go to Partner` row also `Users` tile. Kit classes/tokens only, no `dark:`; 44pt targets. Register the page in `SUBPAGES`, open it with `SettingsRow target`; `Go to Partner` calls `navigatePartner()` (never `pushState` by hand). `partnerKnown` goes into `signedOutState()` in the same commit. The added read follows `getPartner`'s session re-check after its await. Match surrounding style by hand (no `prettier --write`); a moved assertion keeps what it checked.

**Never:** No new local-copy kind (so no auth-bootstrap/login.spec stubs are needed), no migration, no change to the Partner view's behaviour or its connect flow, no unlink action, no Dates row (story 9), no change to `users` read columns in `getPartner` (E2E routes pin `select=partner_id%2Cupdated_at`). No screen-reader or keyboard requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Linked, link date known | `partner` set, `linkedSince` ISO | Row value = partner name; page: Name, Email, Linked since (long local date, e.g. `February 3, 2022`) | — |
| Linked, no accepted request | `linkedSince: null` | Page shows Name and Email only; no Linked since row | — |
| Not linked (loaded) | `partner` null, `partnerKnown`, no error | Row `Not linked`; page lead line + `Go to Partner`; tap opens the Partner view (`/partner`) | — |
| Not answered yet | `partner` null, `!partnerKnown`, no error | Row no value; page shows nothing under the title (no rows, never Not linked) | — |
| Failed read, nothing saved | `partnerLoadError` | Row no value; page shows the load-error card (`partner-load-error`): online → `Something went wrong. Please try again.` + Try again (calls `loadPartner`); offline → `You're offline. Connect to load your partner.`, no button | — |
| Failed read, copy saved | copy linked, server error | Linked page from the copy | — |
| Request read fails | users reads OK, `partner_requests` read errors | `getPartner` → `{status:'error'}` (copy and shown partner untouched) | logged like the partner-record failure |
| Session changes during request read | sign-out mid-read | `{status:'error'}` via `sessionMismatch` | — |
| Old saved copy | copy with `connectedAt`, no `linkedSince` | Parses; `linkedSince` null (row hidden) until the next refresh | — |
| Sign-out | any | `partnerKnown` false again | — |

</intent-contract>

## Code Map

- `src/api/partnerService.ts:53-61,103-176` -- `PartnerInfo.connectedAt` (rename to `linkedSince`, doc: accepted request's `updated_at`, `null` when the pair has none); `getPartner` reads `users` twice with `sessionMismatch(userId)` after each await. Add the third read after the partner record: `from('partner_requests').select('updated_at').eq('status','accepted').or(\`and(from_user_id.eq.${userId},to_user_id.eq.${partnerId}),and(from_user_id.eq.${partnerId},to_user_id.eq.${userId})\`).order('updated_at',{ascending:false}).limit(1).maybeSingle()`; RLS policy "Users can view their requests" allows both partners. Keep the first read's `select('partner_id, updated_at')` unchanged.
- `src/stores/slices/partnerSlice.ts` -- `normalizePartnerCopy` (map `linkedSince` to string-or-null, drop legacy `connectedAt`); `loadPartner` sets `partner` from copy (step 1) and server answer (step 3): set `partnerKnown: true` at both; error/offline branches leave it. Add `partnerKnown: boolean` to `PartnerSlice` with a doc.
- `src/stores/slices/authSlice.ts:~170` -- `signedOutState()` partner block: add `partnerKnown: false`.
- `src/components/PartnerMoodView/PartnerMoodView.tsx:398-425` -- the load-error card; extract to `PartnerLoadError.tsx` (props `isOnline`, `onRetry`), keeping its markup, classes (`CARD`/`PILL` consts there), strings and test ids `partner-load-error` / `partner-load-retry`; the view renders it in place. The view's test mocks the store wholesale, so the component must take props, not read the store.
- `src/components/Settings/Settings.tsx` -- `SUBPAGES` (add `partner`, large `Partner`); top page: `SettingsGroup label="Partner"` with `<PartnerRow key="partner" />` after Account; update the file doc.
- `src/components/Settings/ProfilePage.tsx` -- template for a page module (row + page); `src/components/Settings/stack/SettingsRows.tsx` -- `SettingsGroup`, `SettingsRow`; add a `ReadOnlyRow` export here (label ink 15px medium, value muted 15px, `GROUP_ROW`-height row `min-h-11`, no chevron, value wraps/breaks for a long email).
- `src/components/Settings/settingsFields.ts` -- add `formatInstantDate(iso)`: long local date (`dateStyle: 'long'`, as `formatDateOnly`) of an ISO instant, `null` when unparsable (`new Date` is fine for a full timestamp; never for `YYYY-MM-DD`).
- `src/components/shared/kitClasses.ts` -- `CARD`, `FOOTNOTE`, `GROUP_ROW`, `SECTION_LABEL`.
- Tests: `Settings.kit.test.tsx:98` h2 order becomes `['Account', 'Partner', 'About', 'Together', 'Countdowns']`; fixtures with `connectedAt: null` rename to `linkedSince: null` (`CountdownMarks.test.tsx:108`, `EventsSettings.delete.test.tsx:306`, `CountdownCards.test.tsx:389`, `dateRemindersAtLaunch.test.ts:161`, `partnerSlice.localCopy.test.ts:41`, `coupleSettings.test.ts:352`); `tests/unit/api/partnerServiceDisplayName.test.ts` stubs `from().select().eq().maybeSingle()` only — extend its harness for the request chain; `tests/unit/stores/partnerSlice.localCopy.test.ts`, `loaderIdentityGuards.partner.test.ts`, `signOutClearsAccountState.test.ts`.
- E2E: `tests/e2e/settings/settings-stack.spec.ts` (pattern, `openSettingsFromHome` from `tests/support/helpers/settings-screen`), `tests/e2e/offline/needs-a-connection.spec.ts:333-336` (routes `users?select=partner_id*` to fake unlinked), `tests/support/helpers/reads.ts` (add `LINKED_SINCE_READ = '**/rest/v1/partner_requests?select=updated_at*'`), `resolveOwnPair` in `tests/support/helpers/events.ts`. Pool couples are linked without a request, so their Linked since is hidden for real. `settings-kit.spec.ts` / `push-switches-web.spec.ts` look up h2s — check them.

## Tasks & Acceptance

**Execution:**
- [x] `src/api/partnerService.ts` -- rename `connectedAt`→`linkedSince`; add the accepted-request read with `sessionMismatch` after it; an error → `{status:'error', reason}` with a `console.error` like the partner-record one; no row → `null`.
- [x] `src/stores/slices/partnerSlice.ts`, `src/stores/slices/authSlice.ts` -- `partnerKnown` (set true when a copy or server answer is applied; reset in `signedOutState`); `normalizePartnerCopy` handles `linkedSince` and old copies.
- [x] `src/components/PartnerMoodView/PartnerLoadError.tsx` (new), `PartnerMoodView.tsx` -- extract the card; view behaviour and DOM unchanged.
- [x] `src/components/Settings/settingsFields.ts` -- `formatInstantDate`.
- [x] `src/components/Settings/stack/SettingsRows.tsx` -- `ReadOnlyRow` (`testId` prop).
- [x] `src/components/Settings/PartnerPage.tsx` (new) -- `PartnerRow` (top page; `settings-partner-row`; value per matrix) and `PartnerPage`: linked → card of `ReadOnlyRow`s (`settings-partner-name`, `settings-partner-email`, `settings-partner-linked-since` only when known); unlinked → lead line `settings-partner-lead` + card with `SettingsRow` `Go to Partner` (`settings-go-to-partner`, `onClick` = `navigatePartner`); error → `PartnerLoadError` with `syncStatus.isOnline` and `loadPartner`; waiting → nothing. File doc.
- [x] `src/components/Settings/Settings.tsx` -- register `partner`; Partner group; doc.
- [x] `src/components/Settings/__tests__/Settings.partner.test.tsx` (new) -- every matrix row at the component level through the real store (pattern: `Settings.profile.test.tsx`): row values, three page states, Linked since hidden when null, Go to Partner opens the partner view, retry calls `loadPartner`, offline line, a failed read never shows Not linked.
- [x] Unit tests -- `partnerServiceDisplayName.test.ts` (or a sibling `partnerServiceLinkedSince.test.ts`): request read query (status accepted, both directions, newest), no row → null, error → error, session change → error; `partnerSlice.localCopy.test.ts`: `partnerKnown` from copy and from server, not on error/offline, old copy → `linkedSince` null; `signOutClearsAccountState.test.ts` covers `partnerKnown`; fixture renames; `Settings.kit.test.tsx` h2 order; `PartnerMoodView.kit.test.tsx` still green.
- [x] `tests/e2e/settings/partner-page.spec.ts` (new) -- linked pool account: Partner row shows the partner name; page shows Name and Email and no Linked since; with `LINKED_SINCE_READ` fulfilled `{ updated_at: '2022-02-03T12:00:00Z' }` the Linked since row shows a 2022 date; with `users?select=partner_id*` fulfilled as unlinked the row reads `Not linked`, the page shows the lead line and `Go to Partner` opens `/partner`. Back returns one level. Fixtures from `merged-fixtures`.
- [x] `_bmad-output/initiative-my-love/deferred-work.md` -- new DW: `PartnerMoodView` shows the Connect UI for one render before `loadPartner` raises `isLoadingPartner` (it cannot tell unanswered from unlinked); `partnerKnown` now exists to fix it. And `getPartner` still selects `users.updated_at`, now unused, kept because E2E routes pin that URL.

**Acceptance Criteria:**
- Given Settings' top page, when it opens, then the `Partner` group follows `Account` and holds the Partner row, whose value is the partner's name when linked, `Not linked` only after a loaded unlinked answer, and empty otherwise.
- Given a linked account whose accepted request exists, when the Partner page opens, then Name, Email and Linked since show as read-only rows with no chevron; without that request, Linked since is absent.
- Given an unlinked account, when the Partner page opens, then it shows `You aren't linked with a partner yet.` and `Go to Partner`, which opens the Partner view.
- Given a failed partner read with nothing saved, when the Partner page opens, then it shows `Couldn't load your partner` with the offline or retry line and never the not-linked page.

## Implementation Notes

- Implemented by a Sonnet subagent from this plan; the orchestrating session rewrapped one doc line and fixed an import order in `Settings.tsx`.
- `ReadOnlyRow` uses `GROUP_ROW` (`min-h-12`) rather than `min-h-11`, to match the other rows in the card (both meet the 44pt floor).
- `Partner` was not added to the h2 lists in `settings-kit.spec.ts` / `push-switches-web.spec.ts`; neither asserts the full list, and both pass.
- The deferred-work entries are DW-428 (Partner view's one-render Connect flash; `partnerKnown` can fix it) and DW-429 (`users.updated_at` still selected, unused).
- E2E ran on the local stack through a scratch shim around the `supabase` 2.122.0 binary with stdin from `/dev/null` (the PATH CLI 3.0.0 rejects the repo's `config.toml`), as stories 5.4 to 5.7 did; nothing in the repo changed for it.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `PartnerRow` ignored `partnerLoadError`, so after an earlier unlinked answer (`partnerKnown: true`) a refresh with no readable copy whose read fails left the row reading `Not linked` above a page showing `Couldn't load your partner` — fixed: the row shows no value whenever `partnerLoadError` is true; new `Settings.partner.test.tsx` case with both flags set.
  - `[low]` `[patch]` `PartnerPage` gated the error card on `partnerLoadError` alone, and `loadPartner` keeps that flag until an answer, so after Try again the card and its enabled button stayed up (the Partner view hides it while `isLoadingPartner`) — fixed: while `partnerLoadError && isLoadingPartner` the page renders nothing and never falls through to the linked or not-linked branches; new test.
  - `[low]` `[patch]` `partner-page.spec.ts` asserted `toHaveURL(/\/partner$/)` after Go to Partner, which `/settings/partner` already matched — fixed: polls `new URL(page.url()).pathname` to equal `/partner`, heading check kept.

## Design Notes

- Linked since lives in `PartnerInfo` and the existing `partner` copy, not a new kind: it changes only when the link does, so one read and one copy keep it consistent with the name, and no new refresher needs stubbing.
- A failed request read fails the whole partner read rather than hiding the row: it hits the same PostgREST as the two `users` reads, and an "error" answer keeps the shown partner and copy, while a `null` would overwrite a known date in the copy.
- Page state precedence: `partnerLoadError` → unknown card; else `partner` → linked; else `partnerKnown` → not linked; else nothing. Same order the Partner view uses, plus the `partnerKnown` gate.
- The field is renamed (`connectedAt` → `linkedSince`) so an old copy holding a profile `updated_at` is never shown as a link date.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0, no warnings.
- `npm run typecheck` -- expected: exit 0 (worktree TS2883 baseline excepted if present at the baseline).
- `npx vitest run src/components/Settings src/components/PartnerMoodView tests/unit/api tests/unit/stores` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/settings tests/e2e/partner tests/e2e/offline/partner-offline-copy.spec.ts tests/e2e/offline/needs-a-connection.spec.ts` -- expected: pass on the local stack.

**Manual checks (if no CLI):**
- `grep -rn "connectedAt" src tests` -- expected: only the legacy-copy mention in `partnerSlice.ts` (and its test).

## Auto Run Result

Status: built

**Summary.** The top Settings page has a `Partner` group right after `Account`, holding the Partner row: the partner's name when linked, `Not linked` only after a loaded unlinked answer, and no value before any answer or after a failed read. The row opens `/settings/partner` (large title), which has three states: linked shows Name, Email and Linked since as read-only rows (no chevron, not buttons), with Linked since hidden when the pair has no accepted request; not linked shows `You aren't linked with a partner yet.` and a `Go to Partner` row that opens the Partner view; a failed read with nothing saved shows the Partner view's own load-error card (`Couldn't load your partner`, with the retry button online or the offline line), now one shared `PartnerLoadError` component. Linked since is the accepted `partner_requests` row's `updated_at`, read inside `partnerService.getPartner` (either direction, newest, session re-checked; a failed read makes the whole answer an error). It travels in the existing `partner` local copy as `PartnerInfo.linkedSince`, which replaces `connectedAt` (that came from `users.updated_at`, which any profile edit changes); an old copy's `connectedAt` is dropped, never shown. `partnerSlice` gains `partnerKnown`, true once a copy or server answer is applied and reset by `signedOutState()`, which separates "unlinked" from "not answered yet". No new local-copy kind, so no refresher stubs were needed.

**Files changed**
- `src/api/partnerService.ts`: `linkedSince` from the accepted request; third read in `getPartner`.
- `src/stores/slices/partnerSlice.ts`: `partnerKnown`; `normalizePartnerCopy` reads `linkedSince` and drops a legacy `connectedAt`. `src/stores/slices/authSlice.ts`: `partnerKnown: false` in `signedOutState()`.
- `src/components/PartnerMoodView/PartnerLoadError.tsx` (new): the load-error card, extracted; `PartnerMoodView.tsx` renders it with no change to behaviour or DOM.
- `src/components/Settings/PartnerPage.tsx` (new): `PartnerRow`, `PartnerPage`.
- `src/components/Settings/Settings.tsx`: `partner` subpage, Partner group, file doc.
- `src/components/Settings/stack/SettingsRows.tsx`: `ReadOnlyRow`. `src/components/Settings/settingsFields.ts`: `formatInstantDate`.
- Tests: `Settings.partner.test.tsx` (new, 21 cases); `partnerServiceDisplayName.test.ts` (link-date cases); `partnerSlice.localCopy.test.ts` (`partnerKnown`, old copy); `signOutClearsAccountState.test.ts`; `Settings.kit.test.tsx` h2 order; `connectedAt` → `linkedSince` fixture renames in six files.
- E2E: `tests/e2e/settings/partner-page.spec.ts` (new, 3 tests); `tests/support/helpers/reads.ts` gains `LINKED_SINCE_READ`.
- `deferred-work.md`: DW-428, DW-429.

**Review findings.** One quick pass: 3 findings, all low, all patched as logged above. Nothing deferred, nothing rejected.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 0, low 3.

**Verification** (after the patches)
- `npm run lint`: exit 0. `npm run typecheck`: exit 0.
- `npm run test:unit`: 229 files, 4037 tests passed.
- `npx vitest run src/components/Settings src/components/PartnerMoodView tests/unit/api tests/unit/stores --sequence.shuffle --sequence.seed=91`: 99 files, 1907 passed (before the patches).
- `npx playwright test tests/e2e/settings tests/e2e/partner tests/e2e/offline/partner-offline-copy.spec.ts tests/e2e/offline/needs-a-connection.spec.ts`: 105 passed, on the local stack through the scratch CLI shim.
- `grep -rn "connectedAt" src tests`: only the legacy-copy mentions in `partnerSlice.ts` (plus the unrelated `partnerDisconnectedAt`).
- Every I/O matrix row has a passing covering test.

**Residual risks**
- **No device or simulator check, no visual review.** The read-only rows (a long email wrapping right-aligned) and the lead line have not been looked at on screen, light or dark.
- **Linked since on real couples.** Only the owner's couple has an accepted request (epic Notes); the E2E proves the date path with a fulfilled read, and the pool's real path only with no row.
- **One extra read per partner load.** `getPartner` now makes three requests; a failure of the new one fails the whole load (kept partner and copy, as for any failed read).
- **No unknown-state E2E.** The failed-read page is covered by component tests only.
- **E2E ran on Supabase CLI 2.122.0**, not the CI-pinned version.
