---
title: 'Settings on the kit'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_revision: 'cab49b09ec4fe4e527fc2e5dac75c5e3a9469680'
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/specs/spec-ui-refresh/design-tokens.md'
  - '{project-root}/_bmad-output/specs/spec-ui-refresh/mockups/Settings.dc.html'
warnings: [oversized]
deferred:
  - summary: >-
      Anniversary add/edit and delete dialogs have no role="dialog", aria-modal, aria-labelledby, focus trap, Escape handling or focus return.
    evidence: |-
      Pre-existing at baseline cab49b09 (AnniversarySettings.tsx dialogs are plain motion.divs); EventForm and EventDeleteConfirmation in EventsSettings.tsx have all five via useFocusTrap.
    location: >-
      src/components/Settings/AnniversarySettings.tsx
    severity: medium
  - summary: >-
      About row shows a hard-coded "Version 1.0.0" while package.json says 0.0.0.
    evidence: |-
      Pre-existing copy in Settings.tsx at baseline; the artboard also shows 1.0.0. A build-time version would need a Vite define.
    location: >-
      src/components/Settings/Settings.tsx
    severity: low
  - summary: >-
      Kit class strings live in src/components/Settings/kitClasses.ts while PhotoEditModal/PhotoDeleteConfirmation and SECTION_LABEL (MoodTracker, PartnerMoodView, Settings) keep their own copies.
    evidence: |-
      Photo dialogs already drifted (z-[70] and bordered header/footer vs z-50 and none). Story 8 (CAP-11, one dialog pattern) should move the module to a shared location and consume it.
    location: >-
      src/components/Settings/kitClasses.ts
    severity: low
  - summary: >-
      Anniversary form field and save errors are not linked or announced (no aria-invalid, aria-describedby, role="alert").
    evidence: |-
      Pre-existing at baseline cab49b09; EventForm in the same directory has all of them.
    location: >-
      src/components/Settings/AnniversarySettings.tsx
    severity: low
  - summary: >-
      Every anniversary row's Edit and Delete buttons share the accessible names "Edit anniversary" / "Delete anniversary".
    evidence: |-
      Pre-existing labels (frozen by this story's spec); aria-describedby pointing at the row's h4 would distinguish them, as Events does with the label in the name.
    location: >-
      src/components/Settings/AnniversarySettings.tsx
    severity: low
  - summary: >-
      Kit input and unselected-option boundaries (ring-line on bg-field over bg-card) are about 1.1:1, below WCAG 1.4.11's 3:1.
    evidence: |-
      Values come from the approved kit tokens (design-tokens.md line/field); the same pattern ships in story 6's PhotoEditModal. A kit-level decision.
    location: >-
      src/components/Settings/kitClasses.ts
    severity: low
  - summary: >-
      Dialog backdrops pad with p-4 and ignore safe-area insets under viewport-fit=cover.
    evidence: |-
      Pre-existing padding; DIALOG_BACKDROP now centralises it for Settings, so max(1rem, env(safe-area-inset-*)) would be a one-line fix.
    location: >-
      src/components/Settings/kitClasses.ts
    severity: low
  - summary: >-
      Anniversary delete dialog keeps Cancel enabled while a delete is in flight (Events disables it).
    evidence: |-
      Pre-existing at baseline; AnniversarySettings delete Cancel has no disabled={isDeleting}.
    location: >-
      src/components/Settings/AnniversarySettings.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** Settings still renders from `Settings.css` (raw hex, a red-gradient Sign Out block, grey section bars, light-only surfaces) and its Events/Anniversary children repeat their section titles as inner h2s, use amber/blue/purple/red-600 controls and gray-* dialogs. The only way to replay the welcome splash left with story 2's removal of the Home heart button.

**Approach:** Rebuild Settings as `mockups/Settings.dc.html`: Playfair title, section labels Account / Countdowns / About, grouped kit list cards with hairline dividers, a quiet Sign out card, plus an About "Replay welcome message" row wired to App's existing `showWelcomeManually`. Restyle EventsSettings and AnniversarySettings in place (rows, modals, notices) on kit tokens and delete `Settings.css`. Presentational only.

## Boundaries & Constraints

**Always:**
- Kit utilities only (`bg-card`, `text-ink`, `text-muted`, `bg-tint`/`text-accent`, `bg-dtint`/`text-danger`, `text-partner`, `bg-card2`, `bg-field`, `border-line`/`ring-line`, `shadow-card`, `bg-fill`); no raw hex, no `gray-*`/`amber-*`/`blue-*`/`purple-*`/`red-*`/`pink-*` shades, no gradients, no `dark:` variants in `src/components/Settings/`. Icons lucide-react only.
- Every existing data-testid, aria-label, role and dialog name keeps working with the same text: `settings-view`, `settings-display-name` (holds exactly the name label text), `settings-display-name-edit` (disabled while `nameLookup === null`), `settings-sign-out`, every `events-*` / `event-*` testid, `aria-label="Add event"`, button name `Add Anniversary`, headings `Add/Edit Event`, `Add/Edit Anniversary`, `Delete this event?`, `Delete Anniversary?`, submit texts `Add`/`Update`, copy of the empty/error/history notices.
- All EventsSettings state, focus and async logic (refs, focus fallbacks, retry/history locks, session guards) is untouched; only markup classes and the header block change.
- Dialogs follow story 6's kit dialog (`PhotoEditModal`, `PhotoDeleteConfirmation`): `bg-card` radius 20px `shadow-float`, `bg-black/50` backdrop, Inter 600 18px `text-ink` title, 48px pill buttons (primary `bg-fill text-white`, secondary `bg-tint text-accent`, destructive `bg-dtint text-danger`), inputs 48px radius 14px `bg-field` inset 1px `ring-line`, label 600 13px, field errors `text-danger` with `ring-danger`.

**Never:** No store, service, schema or data-flow change; no new partner/name reads in EventsSettings (use the store's `partner?.displayName` only). Do not touch `DisplayNameSetup`, `WelcomeSplash`, `DailyMessage` or `LoginScreen` (story 8/9). Do not delete `DailyMessage`'s `onShowWelcome` prop. No framer-motion removal. AdminPanel untouched.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Replay | Tap About → "Replay welcome message" | App's `showWelcomeManually` runs; `welcome-splash` shows; Continue returns to Settings; `lastWelcomeView` is not rewritten | Row not rendered when no handler is passed |
| Name loading | `nameLookup === null` | Display-name row button disabled, subtitle "Loading..." | — |
| Sign out | tap Sign out | row disabled, `Loader2` spin + "Signing out…" | failure → kit `role="alert"` banner (`bg-dtint text-danger`), row re-enabled |
| No email | `authService.getUser()` → no email | account identity row not rendered (as today) | — |
| Events empty | settled, zero events | `events-settings-empty` compact row inside the card with its copy + `events-settings-empty-add` small secondary pill | — |
| Anniversaries empty | zero anniversaries | subtitle "Special dates · none yet", no empty block | — |

</intent-contract>

## Code Map

- `src/components/Settings/Settings.tsx` -- the page; `import './Settings.css'` :21; sections :131-260; DisplayNameSetup mount :268 must stay outside any `overflow-hidden` card.
- `src/components/Settings/Settings.css` -- delete. Its `.loading-spinner`/`.spinner-*`/`.error-icon` names also exist in `DisplayNameSetup.css` and `LoginScreen.css`, which define their own copies -- deleting this file does not affect them.
- `src/components/Settings/EventsSettings.tsx` -- header block :447-478 (h2 "Event Countdowns" + Add button with `addButtonRef`, the focus fallback -- must stay mounted in the header row); load notice :419-443 (amber); loading/empty slots :493-526; rows :528-607 (purple edit, red delete, h3 labels); history box :609-654 (purple outline); EventForm panel :920-1177; delete dialog :1292-1374 (blue refresh :1354).
- `src/components/Settings/AnniversarySettings.tsx` -- header :83-101 (h2 "Anniversary Countdowns", pink-600 button), list :103-158, delete modal :179-225, AnniversaryForm :309-428.
- `src/App.tsx:674` `showWelcomeManually`; `:850` `<Settings />` render; splash return :687-695 (splash replaces the app; main remounts with `currentView` unchanged).
- `src/components/PhotoEditModal/PhotoEditModal.tsx`, `PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx` -- kit dialog classes to copy.
- `src/components/PartnerMoodView/PartnerMoodView.tsx:49` `SECTION_LABEL` constant; `MoodTracker.tsx:289` title classes `font-serif text-[30px] leading-[1.1] font-semibold text-ink`; `PhotoGallery.tsx:251` page wrapper `flex flex-col gap-4 px-4 pt-3 pb-6` (main already pads `--dock-clearance`).
- Tests pinned to old styling: `src/components/Settings/__tests__/EventsSettings.test.tsx:1592-1597` (asserts `bg-blue-600`), `:1711` comment about the `hidden sm:inline` span. Other Settings unit tests and `tests/e2e/settings/*`, `tests/e2e/auth/{logout,display-name-setup}.spec.ts`, `tests/e2e/account-data/cross-device.spec.ts:100-109` use testids/names listed under Always.
- `tests/e2e/home/home-kit.spec.ts` -- pattern for a kit E2E (viewport 390x844, `emulateMedia`, computed-colour constants, splash dismissed via `lastWelcomeView`).

## Tasks & Acceptance

**Execution:**
- `src/components/Settings/Settings.tsx` -- drop the CSS import; accept optional `onShowWelcome?: () => void`. Page wrapper keeps the deleted CSS's centred 800px cap (`mx-auto w-full max-w-[800px]` plus the Photos padding). Import the row/tile/divider class strings from the shared `kitClasses.ts` (below) instead of redefining them. Layout per mockup: h1 "Settings"; `<h2>` section labels (12px 600 uppercase `.08em` `text-muted`) Account / Countdowns / About; kit cards (`bg-card border border-line rounded-[20px] p-3 shadow-card`, rows `min-h-12 gap-3`, full-bleed 1px `bg-line` dividers). Account card: identity row (40px `bg-fill` white initial avatar = first code point (`Array.from(...)[0]`, never `charAt(0)`, so an emoji name does not split a surrogate pair) of the chosen display name, else of the email; email 15px 500 `text-ink`; "Signed in" 13px `text-muted`), then the display-name row as one `<button data-testid="settings-display-name-edit">` (Pencil icon tile, "Display name" title preceded by an `sr-only` "Change " so the accessible name carries the verb the old "Change" button had, subtitle `<span data-testid="settings-display-name">`, ChevronRight muted). Countdowns card wraps `<EventsSettings/>`, divider, `<AnniversarySettings/>`. About card: info row (Info tile, "My Love", "Version 1.0.0 · made for the two of you"), divider, `<button data-testid="settings-replay-welcome">` row (RotateCcw tile, "Replay welcome message", ChevronRight) only when `onShowWelcome` is set. Separate Sign out card: `<button data-testid="settings-sign-out">` row, LogOut on a 36px `bg-dtint` tile, `text-danger` 15px 500 "Sign out". Error banner on kit.
- `src/App.tsx` -- pass `onShowWelcome={showWelcomeManually}` to `<Settings />`.
- `src/components/Settings/Settings.css` -- delete after the above renders.
- `src/components/Settings/EventsSettings.tsx` -- replace the header block with a group row: 36px Calendar tile, `<h3>`"Events", subtitle always "Shared with your partner" (do not read the store's `partner`: only PartnerMoodView loads it, so the name would appear or not depending on navigation history), 44px round `bg-tint text-accent` Plus button keeping ref/testid/aria-label. Rows: no per-row card; divider-separated rows, label `<h4>` 15px 500 ink, date/description 13px muted, "Added by your partner" `text-partner`; Edit = 44px `bg-card2 text-muted` circle, Delete = 44px `bg-dtint text-danger` circle. Loading/empty/history/notice on kit (notices `bg-card2` radius 14px `text-ink`; Retry, Load more and empty-add as small 36px secondary pills). EventForm, icon radio group (selected `bg-tint text-accent ring-2 ring-accent`, else `ring-1 ring-line text-muted`), and delete dialog on the kit dialog; delete Refresh = primary `bg-fill text-white`; delete-confirm destructive; failure boxes `bg-dtint text-danger`; required `*` in `text-danger`.
- `src/components/Settings/AnniversarySettings.tsx` -- same group row (Heart tile, `<h3>`"Anniversaries", subtitle "Special dates" + " · none yet" when empty, Plus button `aria-label="Add Anniversary"`); rows/edit/delete as Events; form and delete modal on the kit dialog.
- `src/components/Settings/kitClasses.ts` -- new: the kit class strings (divider, group row/tile/title/subtitle, add/edit/delete icon buttons, item row, small secondary pill, notice, dialog backdrop/panel/title/close, primary/secondary/destructive pills, field label/error/failure box, `fieldClass()` with `scheme-light-dark` on 48px inputs) shared by Settings, EventsSettings and AnniversarySettings -- one source, so the card's `p-3` and the divider's `-mx-3` cannot drift apart.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` -- update the `bg-blue-600` assertion to the kit primary classes; `renderedLabels()` reads level-4 headings (rows are h4); rename the test titled "...icon-only below the sm breakpoint" and its comment, since the button is icon-only at every width; add one case asserting the Events subtitle reads "Shared with your partner".
- `src/components/Settings/__tests__/Settings.kit.test.tsx` -- new (plus one case in an existing AnniversarySettings test file): one test per I/O matrix row not already covered -- replay calls `onShowWelcome` and the row is absent without it; sign-out in-flight state (disabled, "Signing out…") and failure (`role="alert"`, row re-enabled); no identity row without an email; display-name row disabled with "Loading..." while the first read is pending; avatar initial from the display name, from the email when the name is `unset`, and a whole emoji for an emoji-led name; the display-name row's accessible name contains "Change"; Anniversaries empty subtitle "Special dates · none yet". Also: no "Event Countdowns"/"Anniversary Countdowns" text, the three section labels render.
- `tests/e2e/settings/settings-kit.spec.ts` -- new, both themes at 390x844: settings-view shows exactly one "Events" and one "Anniversaries" heading and none of the old inner titles; Sign out computed `background-image` is `none` and colour is kit danger; cards compute kit card background; replay row opens `welcome-splash`, `welcome-continue-button` returns to `settings-view`; `scrollWidth === clientWidth`.

**Acceptance Criteria:**
- Given Settings at 390x844 in light or dark, when it renders, then it reads as `mockups/Settings.dc.html` (title, three labels, grouped cards, quiet Sign out) with no light surface in dark mode.
- Given the source tree, when grepping `src/components/Settings/`, then no `#hex`, `gray-|amber-|blue-|purple-|red-|pink-` shade, gradient, `dark:` or `Settings.css` reference remains.
- Given the existing Settings unit and E2E suites, when run, then they pass with no assertion changed except the `bg-blue-600` one at `EventsSettings.test.tsx:1592`, the `renderedLabels()` heading level and the renamed Add-button test title.

## Spec Change Log

### 2026-09-22 — review pass 1 loopback (bad_spec)
- **Trigger:** Events subtitle was specified as "Shared with {store `partner?.displayName` | 'your partner'}", but `partner` is loaded only by `PartnerMoodView` (`PartnerMoodView.tsx:111`) and the accept-request path, and is not persisted -- so a cold open of Settings says "your partner" and the same screen shows the name after the Partner view was visited (Blind Hunter, Edge Case Hunter, Verification Gap, Intent Alignment all found it).
- **Amended:** Events subtitle is the constant "Shared with your partner" with a unit test. Folded in the verified low fixes from the same pass so they survive re-derivation: avatar initial by code point; `sr-only` "Change " on the display-name row; Settings.tsx imports the shared `kitClasses.ts` strings rather than duplicating them; page keeps the 800px centred cap the deleted CSS had; stale Add-button test title renamed; tests for the Loading... row, email-fallback initial and emoji initial; AC wording now names the `renderedLabels()` level change the h4 outline forces.
- **Known-bad state avoided:** a subtitle whose text depends on which screen the user opened first; an avatar showing a lone surrogate; a display-name button with no verb; Settings stretching edge to edge on wide screens; class strings duplicated between Settings.tsx and kitClasses.ts.
- **KEEP:** Attempt 1 is saved at `_bmad-output/implementation-artifacts/story-7-attempt-1.patch` (apply from the repo root with `git apply`) and passed typecheck, lint, 187 Settings unit tests and 39 E2E tests. Start from it and change only what this entry amends. Keep in particular: `kitClasses.ts` and its `fieldClass()`; the h1 → h2 → h3 → h4 outline; the Events empty row keeping `events-settings-empty`/`-empty-add`; Anniversaries' "Special dates · none yet" subtitle with no empty block and `data-testid="anniversaries-subtitle"`; the Add Anniversary button's `aria-label`; the dialog pieces copied from PhotoEditModal/PhotoDeleteConfirmation; `Settings.kit.test.tsx` and `tests/e2e/settings/settings-kit.spec.ts` as written, plus the new cases above.

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 33 findings — high 0, medium 1, low 22, false 10, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) Avatar initial uses `charAt(0)`, splitting an emoji surrogate pair — real for an emoji-led name; moot this pass, folded into the loopback amendment (code-point initial + test).
  - `[low]` `[bad_spec]` (blind) Events "Shared with {partner}" reads store `partner`, which Settings never loads — confirmed: only `PartnerMoodView.tsx:111` and the accept path call `loadPartner()`, not persisted; spec Tasks prescribed it. Amended: constant "Shared with your partner" + unit test.
  - `[false]` `[reject]` (blind) Load/history error notices look neutral — the copy itself states the failure and the load notice carries Retry; the kit reserves red for destructive and defines no warning colour.
  - `[medium]` `[defer]` (blind) Anniversary dialogs lack role=dialog, aria-modal, focus trap, Escape and focus return — pre-existing (baseline AnniversarySettings had none); the new aria-label on the icon-only Add is an improvement over the old nameless phone button.
  - `[low]` `[patch]` (blind) Settings.tsx duplicates DIVIDER/TILE/ROW from kitClasses.ts — named harm: card `p-3` and divider `-mx-3` drift; moot, folded into amendment (import shared strings).
  - `[low]` `[reject]` (blind) Countdown components assume a `p-3` parent — both are mounted only inside the Settings Countdowns card; decoupling adds structure for a mount that does not exist.
  - `[false]` `[reject]` (blind) Dialogs inside the card could be clipped — no ancestor card has transform/filter/overflow; the Settings comment is about DisplayNameSetup only and is accurate.
  - `[false]` `[reject]` (blind) Anniversaries empty state lost its CTA — it is exactly the approved artboard; the + button is visible and named "Add Anniversary".
  - `[low]` `[patch]` (blind) Display-name row's accessible name lost the "Change" verb — confirmed (name was "Display name [owner]"); moot, folded into amendment (`sr-only` "Change ").
  - `[low]` `[reject]` (blind) Replay returns to the top of Settings and re-reads — the splash replaces the app tree by existing App design; rare action, fix would restructure App.
  - `[false]` `[reject]` (blind) console.error spy never restored in Settings.kit.test — vitest isolates per file and the sibling Settings.displayName.test uses the same pattern; no test relies on console output, so nothing is hidden.
  - `[low]` `[patch]` (blind) Stale test title "icon-only below the sm breakpoint" — confirmed; moot, folded into amendment (rename).
  - `[low]` `[reject]` (blind) E2E finds cards via `locator('..')`; Account/About cards unchecked — fix adds testids for a hypothetical restructure; kit-token grep covers colours.
  - `[low]` `[defer]` (blind) Hard-coded "Version 1.0.0" vs package.json 0.0.0 — pre-existing copy, kept by the artboard.
  - `[low]` `[defer]` (blind) Anniversary delete buttons lack type=button; Cancel enabled while deleting — type is irrelevant (not inside a form); Cancel-while-deleting is pre-existing behaviour.
  - `[low]` `[bad_spec]` (edge) Subtitle depends on whether loadPartner ran; unlinked user told events are shared — same root as the partner row above; same amendment.
  - `[low]` `[patch]` (edge) Avatar `charAt(0)` lone surrogate — same as the blind avatar row; folded into amendment.
  - `[low]` `[reject]` (edge) Replay tapped mid sign-out drops a failed sign-out's alert — needs a sub-second tap race plus a failed sign-out; fix is an added guard.
  - `[low]` `[patch]` (edge) Deleting Settings.css dropped the 800px centred cap — confirmed (`Settings.css:8-9`); moot, folded into amendment (`mx-auto w-full max-w-[800px]`).
  - `[low]` `[reject]` (edge) AC says only the bg-blue-600 assertion changed but `renderedLabels()` level changed too — fix is editing this spec's wording (done anyway inside the loopback amendment).
  - `[low]` `[reject]` (edge) A recursive grep finds `bg-red-500` in a negative test assertion — fix is spec wording; `not.toHaveClass('bg-red-500')` renders nothing.
  - `[low]` `[patch]` (verification-gap) Events subtitle has no test — pre-verified; moot, folded into amendment (unit case).
  - `[low]` `[patch]` (verification-gap) Avatar email fallback untested — pre-verified; moot, folded into amendment (unset-name case).
  - `[low]` `[bad_spec]` (verification-gap other) Partner name appears only after the Partner view loaded it — same root as the partner row; same amendment.
  - `[low]` `[patch]` (verification-gap other) No max-width on wide screens — same as the edge max-width row; folded.
  - `[false]` `[reject]` (intent) Events empty state differs from the artboard — SPEC constraint "existing data-testids keep working" (part of the intent) requires `events-settings-empty`/`-empty-add`, used by eight E2E specs and the focus fallback.
  - `[false]` `[reject]` (intent) "Add Anniversary" vs artboard "Add anniversary" — same SPEC constraint; `cross-device.spec.ts:100` and the unit test use the existing name.
  - `[false]` `[reject]` (intent) Row gap 6px everywhere vs 12px in About/Sign-out — the artboard's 12px cards hold one child, so its gap renders nothing; no visible difference.
  - `[false]` `[reject]` (intent) "Sign Out" became "Sign out" — that is the artboard's text.
  - `[false]` `[reject]` (intent) Light danger #cf2121 vs artboard #dc2626 — story 1's contrast-driven token (`src/index.css:40-43`), not this story's choice.
  - `[low]` `[reject]` (intent) No screenshot comparison; dialogs and Account/About not checked at the rendered surface — story 9 owns the both-theme screenshot sweep (stories.yaml id 9); the colour grep proves kit-only tokens.
  - `[low]` `[bad_spec]` (intent) Cold Settings shows "your partner" rather than a name — same root as the partner row; same amendment.
  - `[false]` `[reject]` (intent) "No floating button on Home" outside the diff — story 2 already removed it (`src/components/WelcomeButton/` no longer exists; `DailyMessage.tsx:24-27`).

### 2026-09-22 — Review pass
- verdicts: 28 findings — high 0, medium 1, low 20, false 7, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) Avatar initial by code point still splits flags, skin-tone and ZWJ emoji — fixed: first grapheme via `Intl.Segmenter`, unit case with 👍🏽.
  - `[low]` `[patch]` (blind) Email and display-name lines `truncate`, hiding long values (deleted CSS wrapped the name) — fixed: `break-words` on both.
  - `[false]` `[reject]` (blind) carried: load/history error notices look neutral — the copy states the failure and carries Retry; red is reserved for destructive.
  - `[low]` `[patch]` (blind) Empty Events row squeezes its copy to ~120px beside the `shrink-0` pill at 390px — fixed: row `flex-wrap`, text `min-w-48`.
  - `[low]` `[defer]` (blind) `kitClasses.ts` lives under Settings/ while Photo dialogs and `SECTION_LABEL` keep their own copies — story 8 (CAP-11 "one dialog pattern") owns consolidating the dialog pieces; the Photo copies predate this story.
  - `[false]` `[reject]` (blind) No accessibility scan covers the restyled page — ran a temporary axe scan of `settings-view` and of the open Anniversary form at 390x844 in light and dark: 0 violations in all four.
  - `[low]` `[reject]` (blind) The kit-tokens-only rule is checked only by a grep — story 9 runs the repo-wide Success-signal grep; a lint rule is new tooling beyond this story.
  - `[low]` `[defer]` (blind) Anniversary field and save errors are not announced (no aria-invalid/describedby/role) — pre-existing at baseline.
  - `[low]` `[defer]` (blind) Every anniversary row's Edit/Delete share one accessible name — pre-existing aria-labels, which the spec freezes.
  - `[low]` `[defer]` (blind) Input and unselected icon-option boundaries are ~1.1:1 — approved kit `line`/`field` tokens, same as story 6's PhotoEditModal; a kit-level decision.
  - `[low]` `[defer]` (blind) Dialog backdrop ignores safe-area insets — pre-existing `p-4`.
  - `[low]` `[reject]` (blind) carried: E2E checks less than it appears (no long data, no 320px, no dialogs in dark) — story 9 owns the both-theme screenshot sweep; the colour grep proves kit-only tokens.
  - `[low]` `[patch]` (blind) Loading slot lacks the leading divider the other slots have — fixed: `DIVIDER` before the loading row.
  - `[low]` `[reject]` (edge) Replay tapped mid sign-out leaves the splash up across sign-out — needs a sub-second tap race; fix is an added guard.
  - `[low]` `[reject]` (edge) Tab escaping an untrapped dialog onto Replay discards unsaved input — rests on the already-deferred missing focus trap plus a keyboard path out of a modal; fix is a guard.
  - `[low]` `[patch]` (edge) Avatar grapheme split — same root as the blind avatar row; same fix.
  - `[low]` `[patch]` (edge) Overflow measured before the events list settles — fixed: wait for `events-settings-loading` count 0.
  - `[low]` `[patch]` (edge) Display name truncated — same root as the blind truncate row; same fix.
  - `[low]` `[patch]` (verification-gap other) Selected icon option's focus only adds a ring offset, since the focused radio is always the selected one — fixed: `peer-focus-visible:outline-2 outline-offset-4 outline-accent`, offset-only classes dropped.
  - `[low]` `[reject]` (intent) Events subtitle is generic, not the partner's name as on the artboard — deliberate loopback-1 amendment; plainly no user meets a defect ("Shared with your partner" is accurate), and the name needs a new async read plus prop and mock changes, not a direct correction.
  - `[medium]` `[defer]` (intent) carried: Anniversary dialogs have the kit look but not dialog semantics/focus trap — already deferred in pass 1.
  - `[low]` `[reject]` (intent) carried: no visual/screenshot check of dialogs, Account/About, typography — story 9's screenshot sweep.
  - `[false]` `[reject]` (intent) carried: danger constant #cf2121 vs artboard #dc2626 — story 1 token (`src/index.css:40-43`).
  - `[low]` `[reject]` (intent) Kit-token rule only by grep — same as the blind grep row.
  - `[false]` `[reject]` (intent) carried: "no floating button on Home" outside the diff — story 2 removed it.
  - `[false]` `[reject]` (intent) carried: Events empty state is a compact row, not the artboard's subtitle — SPEC testid constraint.
  - `[false]` `[reject]` (intent) carried: "Add Anniversary" casing — SPEC aria-label constraint.
  - `[false]` `[reject]` (intent) Item lists render under group rows the artboard does not show — the artboard draws the empty state; existing CRUD lists must remain (no feature removal).

## Design Notes

The mockup draws both countdown groups empty ("· none yet" subtitles, no list). Events keeps its `events-settings-empty` / `events-settings-empty-add` elements because eight E2E specs and the focus-fallback logic depend on them, so its "none yet" state is that compact row rather than subtitle text. Anniversaries has no such dependents and follows the mockup exactly.

Heading outline: h1 Settings → h2 section labels → h3 group titles → h4 row labels (axe `heading-order` runs in `events-accessibility.spec.ts`).

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0, or only the known loop-worktree TS2883 errors in files this story does not touch
- `npm run lint` -- expected: exit 0
- `npx vitest run src/components/Settings` -- expected: all pass
- `npx playwright test tests/e2e/settings tests/e2e/auth/logout.spec.ts tests/e2e/auth/display-name-setup.spec.ts --project=chromium` (needs `supabase start`) -- expected: all pass
- `grep -nE '#[0-9a-fA-F]{3,6}\b|(gray|amber|blue|purple|red|pink|rose)-[0-9]|\b(from|via|to)-[a-z]+-[0-9]|bg-(linear|gradient)|dark:' src/components/Settings/*.tsx` -- expected: no matches

## Auto Run Result

Status: done

**Summary:** Settings rebuilt on the style kit per `mockups/Settings.dc.html`: Playfair title, Account / Countdowns / About section labels, grouped kit cards with hairline dividers, an avatar identity row, a display-name row button, a Countdowns card holding the restyled Events and Anniversaries groups (one h3 each, h4 rows, round tinted Add buttons, kit dialogs), an About card with the new "Replay welcome message" row wired to App's existing `showWelcomeManually`, and a quiet Sign out card. `Settings.css` deleted. One bad_spec loopback (Events subtitle now the constant "Shared with your partner"), then six low patches.

**Files changed:**
- `src/App.tsx` -- passes `onShowWelcome={showWelcomeManually}` to Settings.
- `src/components/Settings/Settings.tsx` -- page rebuilt on the kit; replay row; grapheme avatar initial; 800px centred cap.
- `src/components/Settings/Settings.css` -- deleted.
- `src/components/Settings/kitClasses.ts` -- new shared kit class strings and `fieldClass()`.
- `src/components/Settings/EventsSettings.tsx` -- group header row, divider rows, kit notices/pills, kit form and delete dialogs; logic untouched.
- `src/components/Settings/AnniversarySettings.tsx` -- same group row, "Special dates · none yet" subtitle, kit rows and dialogs.
- `src/components/Settings/__tests__/Settings.kit.test.tsx` -- new unit coverage for every I/O matrix row plus avatar and accessible-name cases.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` -- kit class assertion, h4 helper, renamed Add test, subtitle case.
- `src/components/Settings/__tests__/AnniversarySettings.writes.test.tsx` -- subtitle and h4 cases.
- `tests/e2e/settings/settings-kit.spec.ts` -- new E2E in both themes at 390x844 (headings, card colours, quiet Sign out, no overflow, replay round trip).

**Review findings:** pass 1 -- 33 findings: 1 bad_spec loopback (partner-name subtitle), 9 low fixes folded into the amendment, 3 deferred, rest rejected or false (see Review Triage Log). Pass 2 -- 28 findings: 6 low patches applied (grapheme avatar, break-words, empty-row wrap, loading divider, icon-option focus outline, E2E settle wait), 5 new deferrals, 1 carried deferral, rest rejected or false with reasons in the log.

**Follow-up review recommended:** false -- patched this pass: high 0, medium 0, low 6.

**Verification:** `npm run typecheck` exit 0; `npm run lint` exit 0; `npx vitest run src/components/Settings` 192/192 passed; `npx playwright test tests/e2e/settings tests/e2e/auth/logout.spec.ts tests/e2e/auth/display-name-setup.spec.ts tests/e2e/account-data/cross-device.spec.ts --project=chromium` 39/39 passed against local Supabase; colour/gradient/`dark:` grep over `src/components/Settings/*.ts{,x}` no matches; ad-hoc axe scan of settings-view and the open Anniversary form in light and dark: 0 violations.

**Residual risks:** no visual screenshot comparison against the artboard was done in this run (story 9 owns the both-theme sweep); the Events subtitle does not name the partner (Photos does, via `getPartnerDisplayName`); Anniversary dialogs still lack dialog semantics and a focus trap (deferred); the full unit suite's `tests/unit/a11y/whiteOnColorContrast.test.ts` could not resolve `node_modules/tailwindcss/theme.css` in this worktree during attempt 1 (environment, not this change).
