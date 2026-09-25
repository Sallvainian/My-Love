---
title: 'Home on the kit'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_revision: '8a319e8a2f70ae554a1f7bb66dd55d30e48211d2'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      Birthday countdowns count whole 24-hour periods while event countdowns count calendar days, so the same date can read one day apart on Home now that the hh:mm:ss remainder is gone.
    evidence: |-
      BirthdayCountdown value = years*365 + days from calculateTimeDifference(now, nextBirthday); EventCountdown value = getCalendarDaysDiff(date, now). At noon on 10 March a 12 March birthday reads "1 day" while a 12 March event reads "2 days" (CountdownCards.test.tsx asserts the birthday case). Both formulas predate this story.
    location: >-
      src/components/RelationshipTimers/BirthdayCountdown.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Home mixes five coloured card styles (pink/purple/amber/blue/green 2px borders, yellow birthday card), a gradient daily-message card with 💕💖 emoji and emoji category labels, light-only placeholders, and a floating gradient WelcomeButton — none of it on the style kit story 1 added (CAP-3).

**Approach:** One shared presentational countdown card (icon tile + `muted` label + 22px/700 tabular value) used by Together, both birthdays, wedding, stored events and anniversary countdowns; an "Upcoming" section label with a small secondary Add button over the events slot; the daily message as a kit card in Lora Italic; WelcomeButton deleted. Match `_bmad-output/specs/spec-ui-refresh/mockups/Home.dc.html`.

## Boundaries & Constraints

**Always:** kit utilities only (`bg-card`, `border-line`, `shadow-card`, `bg-tint`, `text-accent`, `bg-ptint`, `text-partner`, `bg-card2`, `text-muted`, `text-ink`, `bg-fill`, `font-lora`); lucide icons only; every existing testid and aria-label on Home keeps working (`time-together`, `birthday-countdown-{name}`, `event-countdown-{slug}`, `events-empty-placeholder`, `events-load-error`, `daily-message`, `message-card`, `message-category-badge`, `message-text`, `message-favorite-button`, `message-favorite-error`, `message-share-button`, `countdown-timer`, `countdown-card-{i}`, `celebration-animation`); an event card keeps its label in an `<h3>` with the description as the only `<p>` sibling after it (`tests/e2e/home/events.spec.ts:262` counts `h3 ~ p`); `WelcomeSplash`, App's `showWelcomeManually`/`handleContinue`/`showSplash` logic and the `onShowWelcome={showWelcomeManually}` prop at `App.tsx:811` stay untouched — story 7 moves the trigger to Settings.

**Never:** no store, service, data or countdown-math change; no edits to `index.css`/`tailwind.config.js` (story 9 removes `.card`/`.btn-icon`); no raw hex, palette shades, gradients or `dark:` variants in touched files; no emoji in any Home chrome (user-authored/bundled message text is untouched); do not touch `WelcomeSplash`, Settings, or other screens.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Wedding without date | `RELATIONSHIP_DATES.wedding === null` | Value "Date TBD" in `text-muted` at countdown size; no `XX:XX:XX` | — |
| Birthday today | today is the birthday | Tile switches to highlight (`bg-fill` + white icon); value "Happy Birthday!"; card stays a plain kit card | — |
| Event today | stored event dated today | Tile highlight as above; value "Today!" (no emoji) | — |
| Event passed | date < local today | Card renders nothing and calls `onRetire` (unchanged) | — |
| Events not yet loaded | slot view `hidden` | "Upcoming" label + Add still render; no placeholder | — |
| Events empty / failed | slot view `empty` / `error` | Kit card with `text-muted` text, same testids, `role="status"` | — |
| Anniversary celebrating | `shouldTriggerCelebration` true | Sparkles tile highlight, value "Today!", CelebrationAnimation Sparkles in `text-accent` | — |

</intent-contract>

## Code Map

- `src/components/RelationshipTimers/TimeTogether.tsx` -- count-up card; today: `border-2 border-pink-300`, h:m:s columns, "...and counting!". Keep 1s interval and `plural()`.
- `src/components/RelationshipTimers/BirthdayCountdown.tsx` -- yellow/purple cards, `Happy Birthday! 🎉`, hh:mm:ss line. Keep state/interval logic.
- `src/components/RelationshipTimers/EventCountdown.tsx` -- `iconColors` amber/blue/green map (drop), `XX:XX:XX` placeholder, `Today! 🎉`, `isRetired`/`onRetire` logic (keep verbatim). Icon map `ring→Gem, plane→Plane, calendar→Calendar` stays.
- `src/components/RelationshipTimers/index.ts` -- barrel; component modules must export only components (`react-refresh/only-export-components`).
- `src/components/CountdownTimer/CountdownTimer.tsx` -- anniversary list rendered inside DailyMessage (`DailyMessage.tsx:370`); inner `CountdownCard` fn uses `bg-white/80`, purple/pink shades, days/hours/min columns; `formatCountdownDisplay` (`src/utils/countdownService.ts:127`) returns long sentences unsuitable as a 22px value.
- `src/components/DailyMessage/DailyMessage.tsx` -- `.card card-hover` + gradient overlay (:243-246), gradient emoji category badge (:256-266), `font-serif text-2xl` text (:273), `.btn-icon` buttons (:285-312), decorative 💕💖 (:316-345), 💕 floating hearts (:215), loading 💕 (:146), red/gradient error state (:115-141), WelcomeButton (:384). Outer wrapper `mx-auto max-w-2xl px-4 py-8` double-pads inside Home's `px-4`.
- `src/components/WelcomeButton/WelcomeButton.tsx` -- only importer is DailyMessage; delete.
- `src/App.tsx:738-812` -- Home column: `space-y-6 pt-4`, birthdays `grid-cols-1 md:grid-cols-2`, events placeholders `border-2 border-gray-200 bg-white … dark:`, events grid `grid-cols-1 md:grid-cols-2`. `setView` is in scope (used at :730).
- `src/components/Navigation/AppNavigation.tsx:88-146` -- golden example of kit utility usage from story 1.
- `src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx:138,204-209`, `tests/e2e/home/events.spec.ts:258` -- assert `Today! 🎉`; update to `Today!`.
- `tests/e2e/navigation/dock.spec.ts:93-114` -- "[P1] should keep the welcome button above the dock on Home"; remove (button no longer exists).
- `tests/e2e/navigation/kit-chrome.spec.ts` -- pattern for both-theme computed-style E2E (`emulateMedia`, wait for `--color-primary`, splash dismissed via `lastWelcomeView`).

## Tasks & Acceptance

**Execution:**
- `src/components/RelationshipTimers/CountdownCard.tsx` -- NEW presentational card: props `icon` (LucideIcon), `tone` ('you' tint/accent | 'partner' ptint/partner), `highlight` (tile `bg-fill text-white`), `label`, `value`, `valueMuted`, optional `trailing`, `description`, `iconFilled`, `testId`. Card `rounded-[20px] border border-line bg-card p-3.5 shadow-card flex flex-col gap-2.5`; tile 36px `rounded-xl`; label `<h3>` 14px `text-muted` normal weight; value `<div>` 22px bold `tabular-nums` (`text-ink`, or `text-muted` when `valueMuted`); description `<p>` 13px `text-muted`; `trailing` bottom-right 13px `text-muted tabular-nums`. -- one card shape for CAP-3.
- `src/components/RelationshipTimers/TimeTogether.tsx` -- CountdownCard: filled `Heart`, label "Together for", value days (years prefix kept when > 0), trailing `{h}h {m}m {s}s` (padded 2-digit). -- mockup Together card.
- `src/components/RelationshipTimers/BirthdayCountdown.tsx` -- add `tone?: 'you' | 'partner'` (default 'you'); CountdownCard with `Cake`, label "{name} turns {age}", value "N day(s)", today → `highlight` + "Happy Birthday!". Drop hh:mm:ss and motion. -- mockup birthday cards.
- `src/components/RelationshipTimers/EventCountdown.tsx` -- CountdownCard with tone 'you'; no date → value `placeholderText` muted; today → highlight + "Today!"; future → "N day(s)"; description passed through. Keep retire logic and testid slug. -- colour lives only in the tile.
- `src/components/CountdownTimer/CountdownTimer.tsx` -- each anniversary renders CountdownCard (`Calendar`, or `Sparkles` + highlight when celebrating), label = `anniversary.label`, value "N day(s)" or "Today!", trailing `{h}h {m}m`, description; keep testids, entry motion, interval and celebration logic; CelebrationAnimation icons `text-accent`; drop the now-unused `formatCountdownDisplay` import. -- SPEC assumption: CountdownTimer adopts the CAP-3 card.
- `src/App.tsx` -- Home column `space-y-4 pt-3`; birthdays and event cards `grid grid-cols-2 gap-3`; [partner]'s birthday `tone="partner"`; before the events slot an "Upcoming" row: section label (12px 600 uppercase `tracking-[.08em]` `text-muted`) + Add button (36px pill `bg-tint text-accent` 13px 600, `Plus` 16px, `aria-label="Add event"`, `data-testid="home-add-event"`, `onClick={() => setView('settings')}`); empty/error placeholders become kit cards with `text-muted` text. Leave `onShowWelcome={showWelcomeManually}` as is.
- `src/components/DailyMessage/DailyMessage.tsx` -- drop the WelcomeButton import/render and the `onShowWelcome` destructure (keep the optional prop in `DailyMessageProps`, documented as reserved until story 7); wrapper `relative w-full`; kit card `p-5 gap-3.5`; category chip 28px pill `bg-tint text-accent` 12px 600 with lucide icon per category (reason `Heart`, memory `Sparkles`, affirmation `Star`, future `Rainbow`, custom `MessageCircleHeart`), labels without emoji; text `font-lora italic font-medium text-[21px] leading-[1.45] text-ink`; favourite 44px circle `bg-tint text-accent` (filled heart when favourited), share 44px circle `bg-card2 text-muted`, left-aligned `flex gap-2`, favourite error `text-danger` beside them; remove gradient overlay and decorative emoji; floating hearts and loading indicator use lucide `Heart` in `text-accent`; error state on kit (`text-muted` icon, `text-ink` heading, primary pill `bg-fill text-white` Retry); swipe hint `text-muted`.
- `src/components/WelcomeButton/WelcomeButton.tsx` -- delete (unreferenced after the above).
- `src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx`, `tests/e2e/home/events.spec.ts` -- `Today! 🎉` → `Today!`.
- `tests/e2e/navigation/dock.spec.ts` -- remove the welcome-button test.
- `tests/e2e/home/home-kit.spec.ts` -- NEW E2E at 390×844, light and dark: covers the ACs below.

**Acceptance Criteria:**
- Given Home at 390×844 in light and dark, when it renders, then `time-together`, both birthday cards, `event-countdown-wedding` share one value style (22px, 700, `tabular-nums`) and card background equals the kit `card` colour (`rgb(255,255,255)` / `rgb(20,25,37)`), and no card has a 2px border.
- Given Home at 390px, when birthdays render, then the [owner] and [partner] cards sit side by side (same top, different left).
- Given the wedding has no date, when Home renders, then the wedding card shows "Date TBD" in the kit `muted` colour.
- Given Home, when rendered, then an "Upcoming" label and an "Add event" button show, and clicking it navigates to `/settings`.
- Given Home, when the daily message renders, then `message-text` computes Lora, italic, 500, 21px, and `#main-content` text outside `message-text` contains no emoji (`/\p{Extended_Pictographic}/u`).
- Given Home, when rendered, then no "View welcome message again" button exists, and the welcome splash still appears on first visit (`tests/e2e/home/welcome-splash.spec.ts` stays green).

## Spec Change Log

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 24 findings — high 0, medium 5, low 15, false 4, maybe-false 0
- findings:
  - `[medium]` `[defer]` Birthday cards count whole 24h periods while event cards count calendar days, and the removed hh:mm:ss no longer explains the birthday number — the two formulas predate this story (BirthdayCountdown `years*365+days`, EventCountdown `getCalendarDaysDiff`); removing the remainder was the artboard's call. Deferred.
  - `[low]` `[reject]` Anniversary under 24h away reads "0 days" + "05h 12m" — accurate, shown for a few hours a year; a days==0 branch adds complexity.
  - `[low]` `[patch]` `formatCountdownDisplay` and `DECORATIVE_EMOJI_FLOAT_DURATION(_ALT)` left without callers — deleted.
  - `[low]` `[patch]` Stale "updates every second for real-time display" comments; unused `timeDiff` in EventCountdown state — comments corrected, `timeDiff` removed.
  - `[low]` `[reject]` Favourite button has no disabled look and buttons lost `.btn-icon` hover/press — the old `.btn-icon` had no disabled style either and Home renders only for signed-in users (LoginScreen otherwise); the kit defines no press state.
  - `[low]` `[patch]` "Happy Birthday!" wraps in the half-width card; long unbroken event labels can overflow it — `break-words` added to label and description; the twice-a-year wrap is accepted (grid rows stretch equally).
  - `[medium]` `[patch]` E2E emoji check strips only `message-text`, so user-authored event/anniversary text would fail it — now also strips stored-event `h3`/`p` and `countdown-timer` (same root cause as the edge-case row below).
  - `[low]` `[patch]` Lora check reads only computed `fontFamily` — added the `document.fonts.load('italic 500 21px Lora')` face check.
  - `[low]` `[reject]` "Upcoming" h2 follows h3 card labels — descending levels are allowed by heading-order; the missing h1 predates this story.
  - `[low]` `[reject]` No manual welcome replay until story 7 — the invocation intent sanctions this interim ("story 7 adds the Settings replay row"); the automatic 60-minute splash still runs.
  - `[medium]` `[patch]` New paths untested (TimeTogether output, category chips, tone wiring) — grouped with the verification-gap rows below; tests added there.
  - `[false]` `[reject]` Category chip renders empty for an unknown category — `MessageCategory` is a closed union and `customMessagesApi` normalises unknown server categories to `custom`, so no unknown key reaches the lookup.
  - `[medium]` `[patch]` (edge) Emoji assertion counts user-written event/anniversary text as chrome — fixed with the grouped emoji-check patch above.
  - `[low]` `[patch]` (edge) `toHaveTextContent('1 day')` also matches "11 days" — value element now asserted exactly.
  - `[low]` `[patch]` (gap) Category chip label/icon unasserted — DailyMessage test asserts "Why I Love You" + `svg.lucide-heart`, no emoji.
  - `[medium]` `[patch]` (gap) TimeTogether value/trailing untested and its years branch was untested — a test past the first anniversary now asserts the year and h/m/s output.
  - `[low]` `[patch]` (gap) Non-celebrating anniversary card untested — test asserts "3 days", "12h 00m", `lucide-calendar`, `bg-tint` tile.
  - `[low]` `[patch]` (gap) [partner]'s partner tone not asserted at Home level — home-kit E2E checks both tile colours in both themes.
  - `[low]` `[reject]` (intent) Manual replay unreachable until story 7 — same as the replay row above; intent-sanctioned.
  - `[low]` `[reject]` (intent) Reserved `onShowWelcome` prop on DailyMessage is inert — the intent requires App's `onShowWelcome` wiring to stay intact; story 7 rewires it.
  - `[low]` `[patch]` (intent) Message card surface unchecked in the rendered page — `message-card` added to the kit-card background check.
  - `[false]` `[reject]` (intent) Light muted is `#646b78`, not the artboard's `#6b7280` — story 1's deliberate contrast fix, documented in `src/index.css`.
  - `[false]` `[reject]` (intent) LoadingSpinner recolour is outside Home — required by this spec's colour grep over touched files; `border-accent` is the kit token, no bad outcome.
  - `[false]` `[reject]` (intent) Settings persistence spec dropped its amber assertion — the per-icon colour it pinned is removed by this story; the glyph assertion remains.

## Design Notes

- [owner] = `you` tone, [partner] = `partner` tone because the approved artboard hard-codes it; birthdays come from static config, not the signed-in user.
- The Add button navigates to Settings (where events are created); opening the editor directly would need new cross-view state, which the SPEC's no-store-change non-goal forbids.
- The swipe hint stays (restyled `muted`) though the artboard omits it: it is the only cue for the swipe gesture.
- Events flow two-up like the birthdays, keeping App's existing "real cards flow two-up like the birthday pair" rule.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors other than the worktree-only TS2883 in `tests/support/merged-fixtures.ts`
- `npm run lint` -- expected: 0 errors
- `npx vitest run src/components/RelationshipTimers tests/unit/components/DailyMessage.favoriteError.test.tsx tests/unit/App.eventsSession.test.tsx` -- expected: pass
- `npx playwright test tests/e2e/home tests/e2e/navigation --project=chromium` (local Supabase running) -- expected: pass
- `grep -nE "#[0-9a-fA-F]{3,6}\b|coral-|gradient|from-[a-z]|\bto-[a-z]|dark:|-(gray|pink|rose|purple|yellow|green|amber|blue|red)-[0-9]" <touched src files>` -- expected: no matches

## Auto Run Result

Status: done

**Summary:** Home now renders on the style kit. A shared `CountdownCard` (icon tile, muted label, 22px/700 tabular value) serves Together, both birthdays ([partner] in partner tone), the wedding ("Date TBD" muted), stored events and anniversary countdowns. An "Upcoming" label with an Add event button (goes to Settings) sits above the events slot. The events placeholders are kit cards. The daily message is a kit card with a lucide category chip, Lora Italic 21px text, and tinted/neutral icon buttons, with no decorative emoji. WelcomeButton is deleted. WelcomeSplash and App's `showWelcomeManually` / `onShowWelcome` wiring are untouched for story 7.

**Files changed:**
- `src/components/RelationshipTimers/CountdownCard.tsx` — new shared countdown card.
- `src/components/RelationshipTimers/TimeTogether.tsx`, `BirthdayCountdown.tsx`, `EventCountdown.tsx` — render through CountdownCard; per-icon colour map, hh:mm:ss lines and emoji removed.
- `src/components/CountdownTimer/CountdownTimer.tsx` — anniversaries render CountdownCard; celebration sparkles in `text-accent`.
- `src/components/DailyMessage/DailyMessage.tsx` — kit card, category chips, Lora text, kit buttons/error/loading; WelcomeButton render removed.
- `src/components/WelcomeButton/WelcomeButton.tsx` — deleted.
- `src/App.tsx` — Home spacing, two-up grids, [partner] partner tone, Upcoming row + Add event, kit placeholders, spinner on `border-accent`.
- `src/utils/countdownService.ts`, `src/constants/animations.ts` — removed code left without callers.
- Tests: new `tests/e2e/home/home-kit.spec.ts` and `src/components/RelationshipTimers/__tests__/CountdownCards.test.tsx`; updated `EventCountdown.test.tsx`, `App.eventsSession.test.tsx`, `DailyMessage.favoriteError.test.tsx`, `tests/e2e/home/events.spec.ts`, `tests/e2e/settings/events-persistence.spec.ts`; the welcome-button test was removed from `tests/e2e/navigation/dock.spec.ts`.

**Review findings:** 24 total. 14 patched (dead code, stale comments, overflow wrapping, the emoji-check scope, the Lora face check, exact value assertion, and tests for category chips, TimeTogether, non-celebrating anniversaries, the tone wiring and the message card). 1 deferred (birthday vs event day-count formulas). 9 rejected, with reasons in the Review Triage Log.

**Follow-up review recommended:** false. Patched at entry verdict: 0 high, 3 medium entries (emoji-check group, untested-paths group, TimeTogether gap), 11 low. All the patches are exercised by the passing runs below, so no specific unverified risk remains.

**Verification:**
- `npm run typecheck`: 0 errors. `npm run lint`: clean. The colour grep over touched `src` files: no matches.
- `npx vitest run`: 2021 pass. The 6 failures are all in `tests/unit/a11y/whiteOnColorContrast.test.ts`, which reads `node_modules/tailwindcss/theme.css` from the worktree root, and the worktree has no `node_modules`. With a temporary `node_modules/tailwindcss` link it passes 6/6; the link was removed afterwards.
- Playwright chromium on local Supabase, covering `tests/e2e/home`, `navigation`, `settings`, `account-data` and `auth/bootstrap-notification-order.spec.ts`: 78 passed.

**Residual risks:**
- The birthday day count uses whole 24h periods while events use calendar days (deferred).
- Manual welcome replay is unavailable until story 7 ships its Settings row; the automatic splash still works.
- 💕 emoji remain on the pre-Home auth/data loading screens (`App.tsx` ~609/~656), which belong to CAP-11 / story 8.
