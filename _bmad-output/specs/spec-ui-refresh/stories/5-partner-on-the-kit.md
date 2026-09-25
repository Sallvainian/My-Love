---
title: 'Partner on the kit'
type: 'feature'
created: '2026-09-22'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      The unviewed-count badge (the only path that marks an interaction viewed) is a pointer-only span inside the History button, so keyboard and screen-reader users cannot play or clear unviewed interactions.
    evidence: |-
      Pre-existing: before this story the badge was an onClick div nested inside the FAB button with the same stopPropagation pattern; the story preserved it on purpose (Design Notes). Enter/Space on the History button opens the sheet, never the badge. Fix needs a design decision: a sibling focusable badge button, or marking viewed from the history sheet.
    location: >-
      src/components/PokeKissInterface/PokeKissInterface.tsx (History button / notification-badge)
    severity: medium
baseline_revision: '4432e30e134840aff696f7a684a318278cb197ea'
---

<intent-contract>

## Intent

**Problem:** The Partner view overflows a 390px phone horizontally and is drawn in light-only gray/pink/gradient styles with emoji, unlike the approved artboard `mockups/Partner.dc.html` (CAP-6, CAP-2 for Partner).

**Approach:** Rebuild `PartnerMoodView`, `PokeKissInterface` and `InteractionHistory` on the kit tokens so the connected view reads: partner name title + connection subtitle + refresh icon button, a "Feeling right now" card, "Send a little something" with History link + count badge over three action tiles (Poke `Zap`, Kiss `Heart` filled, Fart `Wind`), and a "Recent moods" list card; the history opens as a kit bottom sheet. Presentational only.

## Boundaries & Constraints

**Always:**
- Colours only from kit utilities (`bg-page`, `bg-card`, `bg-card2`, `text-ink`, `text-muted`, `text-accent`, `bg-fill`, `bg-tint`, `text-partner`, `bg-ptint`, `bg-good`, `text-danger`, `bg-dtint`, `border-line`, `shadow-card`, `shadow-float`); no `dark:` variants needed. Page title `font-serif text-[30px] leading-[1.1] font-semibold text-ink`; section label `px-1 text-xs font-semibold tracking-[.08em] text-muted uppercase`; kit card `rounded-[20px] border border-line bg-card shadow-card`.
- Mood icons/labels only from `MOOD_DISPLAY` / `MOOD_TONE.partner` (`src/constants/moodDisplay.ts`); lucide icons only; no emoji anywhere in these three components (toasts, loading, empty states, animations). User note text untouched.
- Keep every existing testid, aria-label, role and copy tests rely on: `partner-mood-view`, `partner-mood-card` (on both the current card and each recent row), `partner-mood-notification`, `realtime-connection-status`, `partner-mood-refresh-button`, `partner-mood-error`, `partner-mood-offline-notice`, `partner-mood-loading`, `partner-mood-empty-state`, `partner-mood-list`, `partner-connection-error` (exact text only), all connect-UI testids and the `Search by email or display name` label / `Send Request` / `Accept` / `Decline` names, `poke-button`/`kiss-button`/`fart-button` (aria-labels Poke/Kiss/Fart), `history-button`, `notification-badge` (text = count, aria-label `N unviewed interaction(s)`), `toast-notification` (no role), `interaction-connection-warning` (`role="alert"`, `aria-live="assertive"`, same sentence), `interaction-history-modal`, `interaction-history-backdrop`, `close-history-button` (aria-label Close), `interaction-${id}`, the `MoodCard` named export, the `[PartnerMoodView] Realtime status changed:` log line.
- Toast copy drops only its emoji: `Poke sent!`, `Kiss sent!`, `Fart sent!`.
- The no-partner connect UI and loading/error/offline states are restyled on the kit too (CAP-2), same behaviour.

**Never:** No store, API, schema or send/cooldown/subscription logic change. No new partner actions. Do not touch `tests/e2e-archive/`. Do not import `@playwright/test` in specs (use `tests/support/merged-fixtures.ts`). No `@/` imports inside `src/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Several moods | partner linked, `partnerMoods.length >= 2` | Newest in "Feeling right now" card (ptint chips, one per mood, + date · time line, note if any); the rest as rows in the "Recent moods" card (`partner-mood-list`) | No error expected |
| One mood | `partnerMoods.length === 1` | Current card only; no "Recent moods" label or list | No error expected |
| No moods | linked, not refreshing, 0 moods | Kit empty-state card (`partner-mood-empty-state`), no current card | No error expected |
| Long partner name | displayName ~40 chars at 390px | Title truncates/wraps inside the row; refresh button stays 44px; `scrollWidth === clientWidth` | No error expected |
| Offline | `syncStatus.isOnline === false` | Subtitle reads `Offline` with muted dot, refresh disabled, offline notice card shown | No error expected |
| Unviewed interactions | `unviewedCount > 0` | Badge with the count inside the History button; tapping the badge plays that interaction's animation and does not open the history sheet; tapping History elsewhere opens the sheet | No error expected |
| Cooldown | poke sent < 30 min ago | Poke tile disabled, shows remaining `m:ss` under its label | No error expected |

</intent-contract>

## Code Map

- `src/components/PartnerMoodView/PartnerMoodView.tsx` -- connected header `:504-560` (source of the overflow: non-shrinking title row + text Refresh button + 56px FAB whose menu is absolutely positioned under it), notification toast `:318-340` (`w-full mx-4 left-1/2 -translate-x-1/2` → use `inset-x-4 mx-auto max-w-md`), connect UI `:354-490`, 💕 loading `:495`/`:585`, `MoodCard` `:637-682` (unit-tested export; keep `formatDate: (date: string) => string` prop compatible), `formatDate` `:219` parses a `YYYY-MM-DD` with `new Date(date)` — switch to `parseEventDate` (`src/services/eventsService.ts:200`) per AGENTS.md since the line is rewritten. `connectionStatus` states map to subtitle: connected → `bg-good` dot + "Connected"; reconnecting/disconnected → muted dot + "Reconnecting"/"Disconnected"; offline → "Offline".
- `src/components/PokeKissInterface/PokeKissInterface.tsx` -- FAB, `isExpanded`, click-outside effect, `expandDirection` prop and gradient pills `:86-119,295-470` are replaced by the label row + tiles; badge click handler `handleBadgeClick` `:271` keeps working from the badge span (stopPropagation, as it does inside the FAB today); animations `:504-626` keep motion, swap emoji for lucide icons in `text-accent`/`text-partner`, fart backdrop/gradient `:578,:619` → `bg-black/30` + `bg-tint` circle; warning `:369` and toast `:486` → kit pill (`bg-card text-ink border border-line shadow-float`; warning `bg-dtint text-danger`), positioned `inset-x-4 mx-auto w-fit max-w-md`.
- `src/components/InteractionHistory/InteractionHistory.tsx` -- modal `:93-200` → bottom sheet per `src/components/MoodHistory/MoodDetailModal.tsx:66-79` (`rounded-t-[20px] bg-card shadow-float`, `max-h-[80vh]`, inner scroll); rows `:142` sent `bg-tint`/`text-accent`, received `bg-ptint`/`text-partner`, no 2px borders; poke icon `Zap`, kiss `Heart` filled; 💕/💝 `:119,:126` → lucide in icon tile; "New" = kit badge `bg-fill text-white`.
- Idioms to copy: page title and segmented wrapper `src/components/MoodTracker/MoodTracker.tsx:287-318`; partner avatar/chips `src/components/MoodTracker/PartnerMoodDisplay.tsx:134-184`; centred kit dialog `src/components/love-notes/NoteRemoveConfirmation.tsx:170-190`.
- Tests that change: `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx:95,145,166,181` (drop FAB clicks); `tests/e2e/partner/partner-mood.spec.ts:89-94`; `tests/e2e/partner/interaction-subscription-warning.spec.ts:20` (wait on `poke-button`); `tests/e2e/partner/interaction-record-ownership.spec.ts:30` (`getByRole('button', { name: 'Poke' })`). Harnesses `tests/support/harnesses/interaction-{realtime,record-ownership}.tsx` mount `PokeKissInterface` with no props — keep that working.
- E2E template: `tests/e2e/mood/mood-kit.spec.ts` (KIT_* RGB constants, `openMood`, `expectNoHorizontalOverflow` `:65-76`, `chromeText` emoji check). Worker accounts are already linked (`tests/support/auth/global-setup.ts` ~171); partner moods arrive via `moodSyncService.fetchMoods` (`src/stores/slices/moodSlice.ts:355`) — stub `**/rest/v1/moods**` with three partner rows (columns per `src/types/database.types.ts` `moods`) for stable content.

## Tasks & Acceptance

**Execution:**
- `tests/e2e/partner/partner-kit.spec.ts` -- new; write first and confirm the overflow assertion fails on the current code -- proves the fix. For light and dark at 390x844 with stubbed moods: `document.documentElement.scrollWidth - clientWidth` polls to 0; page ground `KIT_PAGE`; `h1` is the partner display name in Playfair (no "'s Moods"); poke/kiss/fart tiles visible with no prior click and `KIT_CARD` background; ≥2 `partner-mood-card`; no `\p{Extended_Pictographic}` in view chrome (notes removed); open `history-button` → `interaction-history-modal` has `KIT_CARD` background and overflow is still 0. Plus one dark check of the connect UI (stub `users?select=partner_id*` → `{ partner_id: null }`, as `tests/e2e/errors/check-error-path-consistency.spec.ts` does): search card `KIT_CARD`, no overflow.
- `src/components/PartnerMoodView/PartnerMoodView.tsx` -- rebuild per Intent, Code Map and matrix.
- `src/components/PokeKissInterface/PokeKissInterface.tsx` -- label row + History button/badge + 3-column tile grid (92px tiles, `bg-card` inset `line`, 40px `tint` icon tile, 600 14px `ink` label; disabled `opacity-50`).
- `src/components/InteractionHistory/InteractionHistory.tsx` -- kit sheet.
- Existing tests in Code Map -- update FAB usages only.
- `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` -- add: tiles render without any click; badge click plays the animation without opening history; cooldown tile disabled with `m:ss`; toasts carry no emoji.
- `src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx` -- new, store mocked as in `tests/unit/api/partnerService.check.test.tsx:6-18`; covers matrix rows several/one/no moods and offline.

**Acceptance Criteria:**
- Given a signed-in linked user at 390x844 in either OS theme, when `/partner` renders, then `document.documentElement.scrollWidth` equals `clientWidth` and the view matches the artboard's order: title, current-mood card, action label + tiles, recent moods.
- Given dark mode, when any Partner surface renders (connected view, connect UI, history sheet, toasts), then no light surface or pink ground shows.
- Given the diff, when grepping the three components, then no raw hex, `gray-`/`pink-`/`purple-`/`red-`/`green-`/`yellow-`/`blue-` palette class, `from-`/`to-` gradient or emoji remains.

## Spec Change Log

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 24 findings — high 0, medium 4, low 13, false 4, maybe-false 3
- findings:
  - `[medium]` `[patch]` Blind: history sheet sets role=dialog/aria-modal but no focus trap, Escape or focus return — confirmed against `MoodDetailModal.tsx:48`; added `useFocusTrap(sheetRef, isOpen, { onEscape: onClose, initialFocusRef: closeButtonRef })` in `InteractionHistory.tsx`.
  - `[medium]` `[defer]` Blind: badge is pointer-only, keyboard cannot mark interactions viewed — real but pre-existing (old badge was the same nested div inside the FAB); recorded in `deferred`.
  - `[low]` `[patch]` Blind: current-mood card has no key, so a realtime mood swaps content in place without its enter animation — added `key={latestMood.supabaseId || latestMood.date}`.
  - `[false]` `[reject]` Blind: recent-row fallback keys are position-based — partner moods always carry `supabaseId: record.id` (`moodSlice.ts:391`), so the fallback never renders; the old list used the same fallback.
  - `[low]` `[patch]` Blind: no test for the online connection-status mapping — grouped with the verification-gap row below; kit unit test now fires SUBSCRIBED/TIMED_OUT/CHANNEL_ERROR and asserts Connected/Reconnecting/Disconnected.
  - `[low]` `[patch]` Blind: the `parseEventDate` date fix is unguarded — grouped with the verification-gap row below; kit unit test now asserts row, current-card and `Today` labels under the pinned America/New_York TZ.
  - `[low]` `[patch]` Blind: E2E checks `>= 2` mood cards though three are stubbed — now exactly 3 cards and exactly 2 inside `partner-mood-list`.
  - `[low]` `[patch]` Blind: matrix long-name row requires a 44px refresh button but nothing measures it — E2E now asserts a 44x44 bounding box.
  - `[low]` `[patch]` Blind: dark-mode criterion not exercised for toasts/warning/notification — E2E now clicks Fart (local-only) and asserts the toast is on `KIT_CARD` with no emoji; the realtime notification and connection warning need injected Realtime events and stay covered by code inspection only (kit tokens).
  - `[low]` `[patch]` Blind: overflow check with the sheet open cannot fail (fixed boxes do not add to scrollWidth) — E2E now polls the sheet's bounding box to lie within 0..viewport width and checks the sheet text for emoji.
  - `[low]` `[reject]` Blind: Playfair check reads the declared font stack, not the loaded font — same pattern as the Mood/Home kit specs; checking `document.fonts` would add network-dependent flakiness for a cosmetic guarantee.
  - `[false]` `[reject]` Blind: "Feeling right now" label is 13px while other section labels are 12px — the artboard sets exactly 13px on that label and 12px on the others (`mockups/Partner.dc.html`).
  - `[medium]` `[defer]` Edge: badge pointer-only / 20px target — same root cause as the Blind badge row; deferred with it.
  - `[medium]` `[patch]` Edge: sheet traps no focus and ignores Escape — same root cause as the Blind dialog row; fixed by the same `useFocusTrap` call.
  - `[low]` `[reject]` Edge: a weeks-old newest mood shows under "Feeling right now" — the label is the approved artboard copy and the card always shows the mood's date line beneath it; the fix would add branching and change approved copy.
  - `[low]` `[patch]` Verification gap: formatDate switch to `parseEventDate` not pinned by any date assertion — added date-label assertions (`Fri 11 Sep`, `Saturday 12 September`, `Today`) to `PartnerMoodView.kit.test.tsx`.
  - `[low]` `[patch]` Verification gap: Connected/Reconnecting/Disconnected labels unverified — kit unit test captures the status callback and asserts each label.
  - `[low]` `[patch]` Verification gap: no-emoji rule unchecked for animations and history sheet — `PokeKissInterface.test.tsx` now checks `poke-animation` and `fart-animation` text; E2E checks the opened sheet's text.
  - `[low]` `[patch]` Intent: date format differs from the artboard ("Thu, Mar 19" vs "Thu 19 Mar" / "Friday 20 March") — `formatDate(date, style)` now renders the artboard formats, keeping Today/Yesterday.
  - `[maybe-false]` `[reject]` Intent: overflow not measured in offline, toast, cooldown, badge or animation states — toasts/overlays are fixed-position and the tile grid uses `min-w-0`; settling it needs a run per state, and if true it is only low.
  - `[false]` `[reject]` Intent: no mobile emulation, only a 390px desktop viewport — the assertion compares against `clientWidth`, which absorbs classic scrollbars, exactly as `mood-kit.spec.ts:65-76` does; the intent names a width, not a device.
  - `[maybe-false]` `[reject]` Intent: tiles use `min-h-[92px]` and dividers do not bleed past card padding — `min-h` is needed for the cooldown line; pixel-level differences would need a visual comparison and are only low if true.
  - `[maybe-false]` `[reject]` Intent: no evidence the overflow test was red first — the implementer reported a 115px overflow on the old code; not re-run by me, and only low if untrue since the test now guards the fixed state.
  - `[false]` `[reject]` Intent: spec imports `type { Page }` from `@playwright/test` — type-only import; `test`/`expect` come from `merged-fixtures`, matching `mood-kit.spec.ts:12` and `home-kit.spec.ts`.

## Design Notes

The mockup has no FAB, so `fab-main-button` and `expandDirection` are removed; the four tests that clicked it change to target the tiles directly. The badge stays a non-button element inside the History button with its own `onClick` + `stopPropagation`, exactly as it sits inside the FAB today, so the only path that marks an interaction viewed survives. The current-mood card reuses `MoodCard` (e.g. `variant="current"`) so `partner-mood-realtime.spec.ts:190` still finds the newest note in a `partner-mood-card`.

## Verification

**Commands:**
- `npx vitest run src/components/PokeKissInterface src/components/PartnerMoodView tests/unit/api/partnerService.check.test.tsx` -- expected: all pass
- `npx playwright test tests/e2e/partner tests/e2e/errors/check-error-path-consistency.spec.ts tests/e2e/navigation/dock.spec.ts --reporter=line` -- expected: all pass (needs `supabase start`, already running)
- `npm run typecheck` -- expected: no errors other than the worktree-only TS2883 in `tests/support/merged-fixtures.ts`
- `npm run lint` -- expected: exit 0

## Auto Run Result

Status: done

**Summary:** The Partner view is rebuilt on the style kit to match `mockups/Partner.dc.html` and now fits a 390px phone (`scrollWidth === clientWidth`, asserted in E2E in light and dark). The connected view shows the partner's name as a Playfair title with a one-word realtime status and a 44px refresh icon button, a "Feeling right now" card, "Send a little something" with a History link and unviewed-count badge over three Poke/Kiss/Fart tiles, and a "Recent moods" list card. The history opens as a kit bottom sheet with a focus trap. The connect UI, loading, error, offline, toast and animation surfaces are on kit tokens with no emoji. Date labels use `parseEventDate` and the artboard formats.

**Files changed:**
- `src/components/PartnerMoodView/PartnerMoodView.tsx` — kit layout, overflow fix, current/row `MoodCard` variants, artboard date formats, kit connect UI and states.
- `src/components/PokeKissInterface/PokeKissInterface.tsx` — FAB replaced by label row + History/badge + three action tiles; kit toasts and emoji-free animations.
- `src/components/InteractionHistory/InteractionHistory.tsx` — kit bottom sheet with `useFocusTrap`, tint/ptint rows.
- `src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx` — new: several/one/no moods, offline, status labels, date labels, no emoji.
- `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` — FAB clicks dropped; tiles, History, badge, cooldown, emoji-free toast/animation tests.
- `tests/e2e/partner/partner-kit.spec.ts` — new: 390x844 light/dark overflow, colours, title, counts, 44px refresh, fart toast, history sheet bounds; dark connect UI.
- `tests/e2e/partner/partner-mood.spec.ts`, `interaction-subscription-warning.spec.ts`, `interaction-record-ownership.spec.ts` — target the tiles instead of the removed FAB.

**Review findings:** 24 findings. 11 patch rows applied (one medium entry: the sheet focus trap, reported by two layers; the rest low: current-card key, artboard date format, and test tightening for dates, status labels, emoji, counts, 44px refresh, fart toast, sheet bounds). 2 rows deferred (one entry: the pointer-only badge, pre-existing). Rejected: 4 false (position keys never used, 13px label matches the artboard, no mobile emulation needed, type-only Playwright import has precedent), 3 maybe-false only low if true (other-state overflow, min-h/divider pixel differences, red-first evidence), 3 low not worth it (declared-font check, "Feeling right now" for stale moods, which is approved copy).

**Follow-up review recommended:** false. Patched entries by verdict: high 0, medium 1, low 10 (rows). One medium patch on a first pass does not meet the threshold.

**Verification:** `npx vitest run src/components/PokeKissInterface src/components/PartnerMoodView tests/unit/api/partnerService.check.test.tsx` — 46 passed. `npx playwright test tests/e2e/partner tests/e2e/errors/check-error-path-consistency.spec.ts tests/e2e/navigation/dock.spec.ts --reporter=line` — 20 passed. `npm run typecheck` — exit 0 (no TS2883 in this run). `npm run lint` — exit 0. The implementer reported that the new overflow assertion failed on the pre-change code with a 115px overflow (not re-run by the orchestrator).

**Residual risks:** The focus trap and Escape handling on the history sheet have no dedicated test. The realtime "just logged a mood" toast and the connection warning are restyled but not rendered by any test. The badge stays pointer-only (deferred). The E2E stubs the partner identity and moods rather than using live worker data.
