---
title: 'Profile edits name and birthday on one-field pages'
type: 'feature'
ticket: '7'
created: '2026-11-03'
status: done
baseline_revision: '666275e27ad916fe29b39a82b015fe52d1b94974'
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

**Problem:** The display name is edited in a modal (`DisplayNameSetup` mode `edit`) and the birthday in an always-open form with its own Save, both inside the old Account section of the top Settings page; there is no Profile row or page and no one-field edit page for later stories to reuse (R4, R3, R1).

**Approach:** Add the top page's `Account` group with a Profile row (value: display name), the Profile page (header: initial avatar, name, email; rows Name and Birthday), and a reusable one-field edit page (Save in the bar, disabled until the value differs and is valid, Error box, returns one level after a save, reloads to the page above it). Name writes through a new `profileSlice.setDisplayName` (server first, then state and copy), so the top-page row, the header and the Name row all read `ownProfile`. Remove the identity row, the name editor and the birthday editor from the old section.

## Boundaries & Constraints

**Always:** Strings verbatim from EXPERIENCE.md (`Account`, `Profile`, `Name`, `Birthday`, `Not set`, `Save`). Offline refusals unchanged and never typed by hand: name `offlineMessage('Name changes', 'save')`, birthday `offlineMessage('Profile changes')`, checked with `isOnline()` in the component before any request; the store actions keep `requireOnline`. Name rule unchanged: trimmed, 3–30 characters, not the account email (case-insensitive), not `Unknown`, with today's two refusal messages from `DisplayNameSetup.tsx:125-140`. Birthday rule unchanged: a real `YYYY-MM-DD` (`parseEventDate`), not before `1900-01-01`, before today (field `min`/`max` as today). Every async store action captures and re-checks `{ userId, authSessionVersion }`. Kit classes and tokens only, no `dark:` variant; 44pt targets, 16px fields. Register pages in `SUBPAGES`, open them with `SettingsRow target`; never `pushState` by hand. Match surrounding style by hand (no `prettier --write`). A moved test assertion keeps what it checked.

**Never:** No change to `DisplayNameSetup` or the signup gate in `App.tsx`. No new local-copy kind, store field outside `profileSlice`, or migration (the column grant already allows `display_name`). Do not touch Together since, Wedding, Countdowns or `CountdownMarks` beyond relabelling the old section. No screen-reader or keyboard requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rows before any answer | `ownProfile` null, load not failed | top row and Profile rows show no value; Name and Birthday rows disabled | — |
| Failed read, nothing saved | `ownProfile` null, `ownProfileLoadFailed` | no values; Name and Birthday rows enabled; pages open with an empty field | — |
| Saved copy, offline | copy `{displayName:'Jessie'}` | rows show `Jessie`; Name page prefilled `Jessie` | — |
| Unset | `displayName`/`birthday` null | Profile's Name/Birthday rows read `Not set`; top row no value | — |
| Name save | `Casey` typed, online | one PATCH of `display_name`; store, copy, top row, header and Name row show `Casey`; page returns to Profile | — |
| Name invalid | `ab`, 31 chars, or unchanged | Save disabled | — |
| Name refused by rule | the account email or `Unknown` | page stays, value kept, Error box shows today's message, no write | — |
| Birthday future/today/pre-1900 | e.g. tomorrow | Save disabled | — |
| Offline Save | `navigator.onLine` false | no request; Error box shows the refusal; field keeps the typed value; row unchanged | — |
| Save error | service throws | Error box with the message; value kept; row unchanged; cleared on next Save or leaving | — |
| Leave without Save | back arrow / browser back | edit discarded, no write | — |
| Reload / fresh load on a one-field page | `/settings/profile/name` | shows Profile; entry with `inApp` → `history.back()`, without → URL replaced by `/settings/profile` | — |

</intent-contract>

## Code Map

- `src/components/Settings/Settings.tsx` -- top page built in `Settings`; `SUBPAGES` at :534; old Account section :788-850 holds identity row, `settings-display-name-edit` + `DisplayNameSetup` (:822-843, :882-907), `BirthdayRow`/`BirthdayForm` (:241-349), `TogetherSinceRow`, `WeddingRow`. Name read state :570-639 (`nameReading`, `nameReadToken`, `userEmail` via `useState` hack, avatar grapheme logic). `formatDateOnly` :231.
- `src/components/Settings/stack/SettingsStack.tsx` -- `SettingsPageSpec`, `replaceSettingsRoute`, `parentOf`, `goBack` (inApp → `history.back()`, else replace with parent), unknown-path redirect layout effect; bar rendered per page inside the `key={path}` div.
- `src/components/Settings/stack/SettingsBar.tsx` -- grid `64px_1fr_64px`; trailing cell `<div className="flex justify-center">{trailing}</div>`; `trailing` prop is unused today.
- `src/components/Settings/stack/SettingsRows.tsx` -- `SettingsGroup`, `SettingsRow` (no `disabled` yet).
- `src/components/Settings/NotificationsPage.tsx` -- Error box pattern (`FAILURE_BOX flex items-start gap-2`, `CircleAlert`, `role="alert"`).
- `src/stores/slices/profileSlice.ts` -- `setBirthday` is the template for `setDisplayName` (requireOnline, `serializeAccountDataWrite`, `isCurrent`, `saveOwnProfileCopy`); module and `ownProfileLoadFailed` docs describe the old re-read flow.
- `src/services/profileService.ts` -- `saveBirthday` is the template for `saveDisplayName`; `requireSessionUser` gives the email; `toOwnProfile` applies the seed rule.
- `src/api/supabaseClient.ts:477` `isSeedFallbackName`, `SEED_FALLBACK_NAME`; `src/api/auth/sessionService.ts` `getSession` (answers with the stored session offline) via `authService.getSession`.
- `src/components/shared/kitClasses.ts` -- `fieldClass(false)` (h-12, 16px, `scheme-light-dark`), `FAILURE_BOX`, `CARD`, `FOOTNOTE`.
- Tests: `Settings.displayName.test.tsx` (old name flow), `Settings.birthdayWedding.test.tsx` (Birthday describe), `Settings.kit.test.tsx` and `Settings.mobileDataPhotos.test.tsx` (`renderSettings` waits on `settings-display-name`; kit has identity/avatar cases :350-390 and the h2 order :102), `SettingsStack.test.tsx` + `settingsStackKit.ts` (history patterns), `tests/unit/services/profileService.test.ts`, `tests/unit/stores/birthdaysWedding.test.ts`.
- E2E: `tests/e2e/auth/display-name-setup.spec.ts:290-340`, `tests/e2e/offline/needs-a-connection.spec.ts:248-295`, `tests/e2e/settings/birthdays-wedding.spec.ts` (`openPartnerSettings` asserts `settings-birthday-value`; the birthday test fills `settings-birthday-date`), `tests/e2e/offline/birthdays-wedding-offline.spec.ts:166-210`; `settings-kit.spec.ts` and `push-switches-web.spec.ts` look up the h2 `Account` (one must remain).

## Tasks & Acceptance

**Execution:**
- [x] `src/services/profileService.ts` -- add `saveDisplayName(name)`: `requireOnline('Name changes')`; trims; refuses (as `AccountDataError('invalid-response', <today's message>)`) a name equal to the session email or `SEED_FALLBACK_NAME`, and a length outside 3–30; plain `update({ display_name, updated_at })` `.eq('id')` `.select('display_name, birthday')` `.maybeSingle()`; no row → `'Could not find your profile to save the name to'`; returns `toOwnProfile`. Update the module doc.
- [x] `src/stores/slices/profileSlice.ts` -- add `setDisplayName(name)` mirroring `setBirthday` (requireOnline `'Name changes'`, queue, session re-check, state + copy); rewrite the module and `ownProfileLoadFailed` docs (no re-read after a name save any more).
- [x] `src/components/Settings/settingsFields.ts` (new) -- `formatDateOnly` (moved from `Settings.tsx`), `BIRTHDAY_MIN`, `latestBirthday()` (yesterday, local `YYYY-MM-DD`), `isValidBirthday(value)`, `isValidDisplayName(value)` (trimmed 3–30).
- [x] `src/components/Settings/stack/settingsPageContext.ts` (new) -- context `{ goBack, barTrailing: HTMLElement | null }` and `useSettingsPage()`.
- [x] `src/components/Settings/stack/SettingsBarAction.tsx` (new) -- portals its children into `barTrailing` (renders nothing until it exists).
- [x] `src/components/Settings/stack/SettingsBar.tsx` -- `trailingRef` on the trailing cell.
- [x] `src/components/Settings/stack/SettingsStack.tsx` -- `SettingsPageSpec.reloadsToParent?: boolean`; when the stack mounts on such a usable page (guarded by a ref, StrictMode-safe) show its parent: `history.back()` when the entry has `inApp`, else `replaceSettingsRoute(parent)`, then `showSettingsPage(parent)`; provide the context (`goBack`, trailing slot held in state via the callback ref). Header doc updated.
- [x] `src/components/Settings/stack/SettingsRows.tsx` -- `SettingsRow` `disabled` prop (`disabled:cursor-not-allowed disabled:opacity-60`).
- [x] `src/components/Settings/stack/OneFieldPage.tsx` (new) -- props `label`, `saved`, `isValid`, `save`, `offlineRefusal`, `renderField({ id, value, onChange, disabled })`, `testId`. Local value from `saved` at mount; Save (`SettingsBarAction`, text button, accent 17px semibold, `min-h-11`, 50% opacity disabled, `data-testid="settings-field-save"`) enabled only when `value.trim() !== saved` and valid and not saving; Enter submits the same way; offline → Error box with `offlineRefusal`, no call; success → `goBack()` only if still mounted; failure → Error box (`settings-field-error`) with the message; error cleared on the next Save. One `CARD` holding the field with an sr-only label; field focused on mount.
- [x] `src/components/Settings/ProfilePage.tsx` (new) -- `ProfileRow` (top page: `User` icon, `Profile`, value `ownProfile?.displayName`, `target="profile"`, `settings-profile-row`); `ProfilePage` (header `settings-profile-header`: 40px `bg-fill` avatar `settings-avatar` with the first grapheme of name else email, name in row-label type, email `settings-email` in footnote type from `authService.getSession()`; card with `Name` → `profile/name` and `Birthday` → `profile/birthday`, values per matrix, disabled while `ownProfile === null && !ownProfileLoadFailed`, ids `settings-profile-name` / `settings-profile-birthday`); `NamePage` (text field, `maxLength=30`, `autoComplete="nickname"`); `BirthdayPage` (date field with `min`/`max`).
- [x] `src/components/Settings/Settings.tsx` -- `SUBPAGES`: `profile` (large `Profile`), `profile/name` (small `Name`, `reloadsToParent`), `profile/birthday` (small `Birthday`, `reloadsToParent`); `SettingsGroup label="Account"` with `ProfileRow` before Preferences; remove the identity row, name row, `DisplayNameSetup`, `BirthdayRow`/`BirthdayForm`, the name-read state and `userEmail`; keep one mount effect calling `loadOwnProfile`; relabel the old section `Together` (`settings-together-label`); import `formatDateOnly`; doc updated.
- [x] `src/components/Settings/__tests__/Settings.profile.test.tsx` (`git mv` from `Settings.displayName.test.tsx`) -- rewrite for the new pages, covering every matrix row; move in the Birthday cases from `Settings.birthdayWedding.test.tsx` (now "Save disabled" instead of an error line); the identity/avatar cases from `Settings.kit.test.tsx` move here as header cases.
- [x] `src/components/Settings/__tests__/Settings.birthdayWedding.test.tsx`, `Settings.kit.test.tsx`, `Settings.mobileDataPhotos.test.tsx` -- drop the moved cases; settle on the store (`ownProfile !== null || ownProfileLoadFailed`) instead of `settings-display-name`; h2 order `['Account', 'About', 'Together', 'Countdowns']`.
- [x] `src/components/Settings/__tests__/SettingsStack.test.tsx` -- `reloadsToParent` (in-app entry calls `history.back()` once and shows the parent; fresh load replaces the URL; a push to it within the mounted stack shows it), and a page's `SettingsBarAction` renders in the bar and `goBack` returns one level.
- [x] `tests/unit/services/profileService.test.ts`, `tests/unit/stores/birthdaysWedding.test.ts` (or a sibling store test) -- `saveDisplayName` payload, refusals and no-row case; `setDisplayName` offline refusal, state + copy, stale-session discard.
- [x] E2E: `display-name-setup.spec.ts` (Settings → Profile → Name → Save; the Name row, the header and, after back, the top-page Profile row show the new name with no reload; DB holds it; chat part unchanged), `needs-a-connection.spec.ts` (offline Save on the Name page: refusal in `settings-field-error`, typed value kept, no request, page stays), `birthdays-wedding.spec.ts` (`openPartnerSettings` drops the birthday assertion; the birthday test opens Profile, checks `Not set`, saves on the Birthday page), `birthdays-wedding-offline.spec.ts` (offline Save on the Birthday page).
- [x] `AGENTS.md` -- Settings-subpage rule: `reloadsToParent` for a one-field or form page, and fields are edited on `OneFieldPage`.
- [x] `_bmad-output/initiative-my-love/deferred-work.md` -- new DW: `DisplayNameSetup`'s `edit` mode, `onCancel` and `initialName` are unused, and its name rules duplicate `profileService.saveDisplayName`; for the sweep (story 16).

**Acceptance Criteria:**
- Given Settings' top page, when it opens, then `Account` is the first group, holding `Profile` with the display name on the right, and the old section shows no identity, name or birthday editor.
- Given the Profile page, when the Name page saves a new name online, then the page returns to Profile and the Name row, the header and (after back) the top-page Profile row show it without a reload.
- Given the Birthday page, when a date today or later is picked, then Save stays disabled.
- Given either page offline, when Save is tapped, then the refusal shows in the Error box, no request is sent and the typed value stays.
- Given `/settings/profile/name` is reloaded, then Profile is shown and one back arrow press returns to the top page.

## Implementation Notes

- Implemented by a Sonnet subagent from this plan; `Settings.displayName.test.tsx` moved with `git mv` to `Settings.profile.test.tsx` and was rewritten against the real store and `profileService`, with only Supabase faked.
- Beyond the task list: `Settings.notifications.test.tsx` settled on `settings-display-name` and was moved to the store settle; `tests/support/helpers/reads.ts` gains `OWN_PROFILE_WRITE` for the name PATCH in E2E.
- The deferred-work entry is DW-427.
- E2E ran on the local stack through a scratch `supabase status -o env` shim (the installed CLI 3.0.0 rejects the repo's `config.toml`), as stories 5.4 to 5.6 did; nothing in the repo changed for it.
- Known: a reload on a one-field page renders it for one pre-paint commit before the layout effect shows the parent, so the parent arrives with the pop animation and focus on the row that opened the field.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 4 findings — high 0, medium 1, low 3, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` `OneFieldPage` seeded the field from `saved` once but compared Save against the current `saved`, so a page opened on the saved copy whose server answer then changed `saved` showed the stale value with Save on, and a tap wrote it back over the newer one (the hazard the deleted "disables Change across the re-read" test guarded) — fixed: the page keeps the `saved` it last followed and, in render, moves an untouched field with it; an edited value is left. Two new `Settings.profile.test.tsx` cases (untouched follows with Save off; edited survives); the first fails without the fix.
  - `[low]` `[patch]` E2E row checks in `display-name-setup.spec.ts`, `needs-a-connection.spec.ts` and `birthdays-wedding.spec.ts` narrowed exact `toHaveText` + `toBeVisible` to substring `toContainText` on the whole row (AGENTS.md L4) — fixed: `toBeVisible()` plus exact `toHaveAccessibleName('Profile, …' / 'Name, …' / 'Birthday, Not set')`; only the post-save Birthday row uses a year regex, since its date text is locale-formatted.
  - `[low]` `[patch]` `birthdays-wedding.spec.ts:98` JSDoc line ran to ~130 columns — fixed: paragraph rewrapped, same words.
  - `[low]` `[patch]` `ProfilePage.tsx` email line combined `FOOTNOTE` (`px-1`) with `px-0`, so stylesheet order decided its inset — fixed: footnote type classes without the inset; unused `FOOTNOTE` import removed.

## Design Notes

- Save lives in the page, not the stack: a portal into the bar's trailing cell keeps the field's state, validity and saving flag in one component without lifting them into the stack or a store.
- Reload of a one-field page uses `history.back()` on an app-created entry because replacing it with the parent would leave two identical entries, so the next back would appear to do nothing.
- Writing the name through `profileSlice` (the write returns the stored row) removes the old re-read and its stale-prefill hazard, so a failed read may now show and prefill the saved copy, as EXPERIENCE's Loading rule asks.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0, no warnings.
- `npm run typecheck` -- expected: exit 0 (the worktree TS2883 baseline excepted if present at the baseline).
- `npx vitest run src/components/Settings tests/unit/services/profileService.test.ts tests/unit/stores` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/settings tests/e2e/auth/display-name-setup.spec.ts tests/e2e/offline/needs-a-connection.spec.ts tests/e2e/offline/birthdays-wedding-offline.spec.ts` -- expected: pass on the local stack.

**Manual checks (if no CLI):**
- `grep -rn "settings-display-name\|settings-birthday-date\|settings-identity" src tests` -- expected: no match.

## Auto Run Result

Status: built

**Summary.** The top Settings page opens with an `Account` group holding the Profile row, whose value is the display name. Profile (`/settings/profile`, large title) shows a header (initial avatar, name, email from the stored session) and the Name and Birthday rows, which show no value until the profile's first answer, read `Not set` when unset, and are disabled until an answer (copy, server or a failed read) arrives. Each row opens a one-field page built on the new reusable `OneFieldPage`: Save in the bar through `SettingsBarAction` (a portal into the bar's trailing cell), disabled until the value differs and is valid, offline refusal and save errors in the Error box with the typed value kept, one level back after a save, and a reload showing the page above (`reloadsToParent`; `history.back()` on an app-created entry, URL replace on a fresh load). The name now writes through `profileSlice.setDisplayName` → `profileService.saveDisplayName` (server first, then state and copy, same refusals as the signup gate), so the top row, the header and the Name row follow a save with no reload. The birthday keeps its rules (after 1900, before today) and `setBirthday`. The identity row, name modal and birthday form are gone from the old section, which is relabelled `Together` until story 10.

**Files changed**
- `src/components/Settings/ProfilePage.tsx` (new): `ProfileRow`, `ProfilePage`, `NamePage`, `BirthdayPage`.
- `src/components/Settings/stack/OneFieldPage.tsx` (new): the reusable one-field edit page.
- `src/components/Settings/stack/SettingsBarAction.tsx`, `stack/settingsPageContext.ts` (new): bar action portal and the page context (`goBack`, trailing cell).
- `src/components/Settings/settingsFields.ts` (new): `formatDateOnly` (moved), birthday bounds and validity, name validity.
- `src/components/Settings/stack/SettingsStack.tsx`: `reloadsToParent`, context provider. `stack/SettingsBar.tsx`: `trailingRef`. `stack/SettingsRows.tsx`: `disabled` on `SettingsRow`.
- `src/components/Settings/Settings.tsx`: Account group and Profile subpages; old identity, name and birthday editors and their state removed; old section relabelled `Together`.
- `src/services/profileService.ts`: `saveDisplayName`. `src/stores/slices/profileSlice.ts`: `setDisplayName`; docs.
- Unit tests: `Settings.profile.test.tsx` (moved from `Settings.displayName.test.tsx`, rewritten, 40 cases); `SettingsStack.test.tsx`, `profileService.test.ts`, `birthdaysWedding.test.ts` extended; `Settings.birthdayWedding`, `Settings.kit`, `Settings.mobileDataPhotos`, `Settings.notifications` tests updated.
- E2E: `display-name-setup.spec.ts`, `needs-a-connection.spec.ts`, `birthdays-wedding.spec.ts`, `birthdays-wedding-offline.spec.ts`; `tests/support/helpers/reads.ts` gains `OWN_PROFILE_WRITE`.
- `AGENTS.md`: Settings-subpage rule names `reloadsToParent` and `OneFieldPage`. `deferred-work.md`: DW-427 (`DisplayNameSetup` edit mode now unused; name rules duplicated with `saveDisplayName`).

**Review findings.** One quick pass: 4 findings (medium 1, low 3), all patched as logged above. Nothing deferred, nothing rejected.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 1, low 3 (one medium is under the two-medium threshold).

**Verification** (after the patches)
- `npm run lint`: exit 0. `npm run typecheck`: exit 0.
- `npm run test:unit`: 228 files, 4001 tests passed.
- `npx vitest run src/components/Settings tests/unit/services/profileService.test.ts tests/unit/stores/birthdaysWedding.test.ts --sequence.shuffle`: 444 passed on seeds 1 to 5 (before the patches; the patched files pass unshuffled in the full run).
- `npx playwright test tests/e2e/settings tests/e2e/auth/display-name-setup.spec.ts tests/e2e/offline/needs-a-connection.spec.ts tests/e2e/offline/birthdays-wedding-offline.spec.ts`: 77 passed, row audit clean, on the local stack through the scratch `supabase` CLI shim.
- `grep -rn "settings-display-name\|settings-birthday-date\|settings-identity" src tests`: no match.
- Every I/O matrix row has a passing covering test.

**Residual risks**
- **No device or simulator check, no visual review.** The Profile header and the bar's Save (in the 64px trailing cell) have not been looked at on screen, light or dark.
- **Reload transition.** A reload on a one-field page renders it for one pre-paint commit, then shows the parent with the pop animation and focus on the row that opened it, rather than no animation as other reloads have.
- **Stack mounted by history onto a one-field entry** (back from another view into it) also goes up one more entry with `history.back()`.
- **DW-427 numbering** was taken from this worktree's ledger copy; another loop worktree could pick the same number.
