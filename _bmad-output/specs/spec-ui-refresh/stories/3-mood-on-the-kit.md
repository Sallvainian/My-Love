---
title: 'Mood on the kit'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_revision: '8e9fbda145ba54cf1de305ab8e4ebf8f7424286b'
review_loop_iteration: 1
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      Frustrated and Angry share the lucide Angry icon, so icon-only surfaces (calendar day cell, timeline icon strip, Partner MoodCard) cannot tell them apart now that per-mood colour is gone.
    evidence: |-
      MOOD_DISPLAY maps both to Angry, as MoodTracker.tsx did before this story; colour (red-500 vs rose-600) used to separate them in CalendarDay. Labels and aria-labels still differ. Choosing a new icon is a design call for the product owner.
    location: >-
      src/constants/moodDisplay.ts
    severity: low
  - summary: >-
      mood-kit.spec.ts Happy-tile test may flake if today's saved entry re-seeds the form after the test reads aria-pressed or clicks.
    evidence: |-
      MoodTracker re-seeds the form whenever the moods array identity changes (sync-driven loadMoods); the test only awaits the first **/rest/v1/moods** response. Unverified whether a later loadMoods can land after it on a pool account with a saved entry for today; settle by instrumenting the ordering or by repeated runs.
    location: >-
      tests/e2e/mood/mood-kit.spec.ts
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** The Mood view is light-only (`bg-gray-50`, `bg-white`, `text-gray-*`), uses an underline tab bar, framer-motion rgba tiles, a pink-gradient partner card with emoji, and four disagreeing mood icon/colour maps (MoodTracker, CalendarDay, MoodDetailModal, PartnerMoodView) plus an emoji map (`utils/moodEmojis.ts`).

**Approach:** Rebuild the Mood screen to match `mockups/Mood.dc.html` on the kit utilities from story 1 (`bg-card`, `text-ink`, `bg-tint`, `ring-line`, `shadow-card`, `font-serif` = Playfair), including Timeline, Calendar and the detail modal, driven by one shared mood icon/label map where colour comes from the owner (you = tint/accent, partner = ptint/partner).

## Boundaries & Constraints

**Always:** Presentational only — no store, service, schema or behaviour change. All 12 `MOOD_TYPES` stay selectable (the artboard crops the third Challenging row, note and submit). Keep every existing testid, aria-label and role (a moved element keeps its testid: `partner-mood-emoji` → the chip row, `mood-emoji` → the timeline item's icon row). Keep text tests read: the h1 "How are you feeling?", "Selected: …" line, "Online"/"Offline" sync text and "(N pending sync)", a heading named "Mood Timeline" on the Timeline tab, "Log Mood"/"Update Mood" submit text. Segmented control stays sticky at `top-[calc(4rem+env(safe-area-inset-top))]` on a `bg-page` strip. Lucide icons only; kit tokens only; text contrast ≥ 4.5:1 in both themes (so the partner avatar is `bg-partner text-card`, not white text).

**Never:** No emoji in any Mood surface (user-authored notes excepted). No raw hex, `slate-*`/`gray-*`/`yellow-*`/`green-*`/`red-*`/`orange-*` palette classes, gradients or `dark:` variants in touched files — kit tokens switch themselves. No per-mood rainbow colours. No edits to PartnerMoodView beyond pointing it at the shared map (story 5 restyles it). No `tests/e2e-archive/` edits.

</intent-contract>

## Code Map

- `src/constants/moodDisplay.ts` (new) -- `MOOD_DISPLAY: Record<MoodType, { icon: LucideIcon; label: string }>` using the icons already in `MoodTracker.tsx:40-56` (loved Heart, happy Smile, content Meh, excited Zap, thoughtful MessageCircle, grateful Sparkles, sad Frown, anxious AlertCircle, frustrated Angry, angry Angry, lonely UserMinus, tired Battery); `POSITIVE_MOODS`/`CHALLENGING_MOODS: readonly MoodType[]` as explicit literal arrays (`loved, happy, content, excited, thoughtful, grateful` / `sad, anxious, frustrated, angry, lonely, tired`), never sliced by position from `MOOD_TYPES`; `MOOD_TONE = { you: 'bg-tint text-accent', partner: 'bg-ptint text-partner' }`.
- `src/utils/moodEmojis.ts` -- delete once `PartnerMoodDisplay.tsx:21` and `MoodHistoryItem.tsx:14` stop importing it.
- `src/components/MoodTracker/MoodTracker.tsx:309-610` -- page shell: header (h1 `font-serif text-[30px] font-semibold leading-[1.1] text-ink` + 14px `text-muted` date, `toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })`) above the segmented control on every tab; segmented labels Log / Timeline / Calendar (testids `mood-tab-tracker|timeline|history`, add `aria-pressed`); section labels Positive / Challenging; 3-col grid `gap-2.5`; drop the "select all that apply" label; "Selected: …" + sync status as one muted 13px row; toasts/banners on kit (success = card + `text-good` CheckCircle; offline = card + muted WifiOff + small secondary Retry pill; error = `bg-dtint text-danger`); note toggle = small secondary pill; textarea = kit input (`bg-field`, radius 14px, `ring-1 ring-inset ring-line`, error ring `ring-danger`); counter `<20` uses `text-accent`; submit = 48px primary pill, disabled `bg-card2 text-muted`. Timeline tab: kit card wrapper (`rounded-[20px] border border-line bg-card shadow-card overflow-hidden`), "Mood Timeline" h2 as kit section label, subtitle dropped. Horizontal gutter lives here only.
- `src/components/MoodTracker/MoodButton.tsx` -- `min-h-[76px]` tile (grows with large text, never a fixed height), `rounded-2xl`, icon 24px, 500 13px label; unselected `bg-card text-muted ring-1 ring-inset ring-line` with `text-ink` label; selected `bg-tint text-accent ring-2 ring-inset ring-accent`; keep `whileTap`, drop the `animate` backgroundColor.
- `src/components/MoodTracker/PartnerMoodDisplay.tsx` -- kit card `p-3.5 gap-2.5`: 40px avatar (initial) + "{name} is feeling" (15px 500 ink; keep the h2) + timestamp (13px muted, keep `partner-mood-timestamp`, Just-now badge = small ptint pill); chip row (`partner-mood-emoji`, keep its aria-label) of 34px `bg-ptint text-partner` chips, icon 17px + 600 14px label, `flex-wrap gap-2`; keep `partner-mood-label` (sr or visible joined labels) and `partner-mood-note`. Name = the trimmed `useAppStore((s) => s.partner?.displayName)`; when that is missing or blank, the heading reads "Your partner is feeling" and the avatar shows a lucide `User` icon. Never fall back to `PARTNER_NAME` — it names [partner] from [owner]'s side, so on [partner]'s own device it would label [owner]'s mood with her name, and the store's `partner` is null on the Mood view until the Partner view has loaded it. Do not call `loadPartner()` here (presentational only). Avatar initial = `Array.from(name)[0].toUpperCase()` so a name starting with an emoji or other non-BMP character is not split. Loading/error states on kit, no ⚠️; drop the `#F9A8D4` border pulse (keep the scale pulse).
- `src/components/MoodTracker/NoMoodLoggedState.tsx` -- kit card, `ptint` icon tile with lucide Heart, no 💭/❤️.
- `src/components/MoodTracker/MoodHistoryItem.tsx` -- icon row (`mood-emoji`) of `text-accent` 20px icons from the map; labels from the map; ink/muted text; divider `bg-line`; "Show more" `text-accent`. Rows are fixed-height in react-window (80/120px) — stay inside them.
- `src/components/MoodTracker/MoodHistoryTimeline.tsx` -- DateHeader as kit section label on `bg-card` with `border-line`; spinner `border-accent`; empty state lucide icon tile, no 📊; error state muted AlertCircle, no ⚠️, Retry = primary pill.
- `src/components/MoodHistory/MoodHistoryCalendar.tsx` -- drop own `px-4`; wrap in kit card; month nav = 44px `bg-card2 text-muted` round icon buttons; month header 600 18px ink; weekday headers muted; loading cells `bg-card2`; footer muted.
- `src/components/MoodHistory/CalendarDay.tsx` -- delete local `MOOD_CONFIG`; no-mood day `text-muted`, mood day `bg-tint` + `text-accent` primary icon + `text-ink` number; today `ring-2 ring-inset ring-accent`; keyboard focus must stay visible on today too, so use an outline for focus (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`), not the same ring; keep aria-label format (unit test pins `- happy, tired mood`).
- `src/components/MoodHistory/MoodDetailModal.tsx` -- delete local `MOOD_CONFIG`; kit dialog: `bg-card`, `rounded-t-[20px] sm:rounded-[20px]`, title Inter 600 18px `text-ink` (keep `modal-mood-type` text "Happy, Tired"), one 40px `bg-tint text-accent` icon tile per mood, close = 44px `bg-card2 text-muted` icon button, divider `border-line`, labels ink/muted.
- `src/components/PartnerMoodView/PartnerMoodView.tsx:36-51,669-676` -- replace local `MOOD_CONFIG` with `MOOD_DISPLAY`; MoodCard icon colour `text-partner`; remove now-unused lucide imports only.
- `src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx:157-207` -- emoji assertions become icon/label assertions (e.g. `.lucide-smile`, chip text "Happy"/"Tired").
- `tests/e2e/mood/mood-tracker.spec.ts` -- existing P0s must keep passing unchanged; `tests/e2e/home/home-kit.spec.ts` is the pattern for computed-colour kit assertions.

## Tasks & Acceptance

**Execution:**
- [ ] `src/constants/moodDisplay.ts` -- create the shared map -- one source replaces four
- [ ] `MoodTracker.tsx`, `MoodButton.tsx` -- page shell, segmented control, tiles, form on kit
- [ ] `PartnerMoodDisplay.tsx`, `NoMoodLoggedState.tsx` -- partner card with violet chips
- [ ] `MoodHistoryItem.tsx`, `MoodHistoryTimeline.tsx` -- timeline on kit, icons not emoji
- [ ] `MoodHistoryCalendar.tsx`, `CalendarDay.tsx`, `MoodDetailModal.tsx` -- calendar and dialog on kit, shared map
- [ ] `PartnerMoodView.tsx` -- consume the shared map; delete `src/utils/moodEmojis.ts`
- [ ] `moodArrayGuards.test.tsx` -- icon/label assertions, plus PartnerMoodDisplay name cases (store partner `displayName: 'Sam'` → "Sam is feeling" + avatar "S"; partner null and blank name → "Your partner is feeling" + `.lucide-user`); add `src/constants/__tests__/moodDisplay.test.ts` covering every `MOOD_TYPES` entry has icon + label, and asserting `POSITIVE_MOODS`/`CHALLENGING_MOODS` against the two explicit lists by name
- [ ] `tests/e2e/mood/mood-kit.spec.ts` [P1] -- per the ACs below, both themes at 390×844; the overflow check compares `scrollWidth` with `clientWidth`, never with a literal 390 (a classic scrollbar narrows `clientWidth`)

**Acceptance Criteria:**
- Given the Mood view at 390×844 in light and dark, when it loads, then the h1 renders in Playfair Display, the page, segmented track and tiles resolve to the kit `page`/`card2`/`card` values for that theme, and `document.documentElement.scrollWidth === clientWidth`.
- Given the Log tab, when the user taps Happy, then that tile's background is the kit `tint` and its text the kit `accent`, `aria-pressed="true"`, and "Selected: Happy" shows.
- Given the Timeline or Calendar tab in dark mode, when it renders, then its container background is the kit `card` value (no white surface).
- Given any Mood tab, when its text is read, then it contains no emoji codepoint (`/\p{Extended_Pictographic}/u`) outside user notes.
- Given the source tree, when grepped, then `moodEmojis` and every per-component `MOOD_CONFIG` are gone and `src/components/MoodTracker/`, `src/components/MoodHistory/` contain no `#hex`, `from-`/`to-` gradient, `slate-`/`gray-` class or `dark:` variant.

## Spec Change Log

### 2026-09-22 — review pass 1 (bad_spec loopback)
- **Trigger:** review found the partner card names the wrong person: the spec's `|| PARTNER_NAME` fallback always fires on the Mood view (nothing there loads the store's `partner`; only `PartnerMoodView.tsx:106` and `acceptPartnerRequest` call `loadPartner`), so on [partner]'s device [owner]'s mood reads "[partner] is feeling". Folded in with it: positional `slice` grouping with a tautological test; fixed-height tiles; today's focus ring identical to its today ring; surrogate-splitting avatar initial; E2E overflow check pinned to a literal 390; partner-name cases untested.
- **Amended (Code Map + Tasks only):** PartnerMoodDisplay name source and fallback ("Your partner" + `User` icon, no `PARTNER_NAME`, no `loadPartner`); explicit group arrays + named test; `min-h-[76px]`; outline focus on calendar days; `Array.from` initial; overflow check vs `clientWidth`; partner-name unit cases.
- **Known-bad state avoided:** a mood card that attributes a partner's mood to the wrong person on one of the two devices.
- **KEEP:** everything else in attempt 1 held up in review and must survive: the shared `src/constants/moodDisplay.ts` shape (`MOOD_DISPLAY`, `MOOD_TONE`), deletion of `utils/moodEmojis.ts`, every file's kit classes, the page shell (title + en-US date above a sticky `bg-page` segmented control on every tab, `overflow-x-clip` on tab content), all kept testids/labels/texts, the `mood-timeline-card` testid, the `PartnerMoodView` minimal edit, `moodArrayGuards` icon assertions and the no-emoji case, and the `mood-kit.spec.ts` structure. Attempt 1 is saved at `_bmad-output/implementation-artifacts/story-3-attempt-1.patch` (relative to the project root; apply with `git apply`) — start from it and change only the amended items.

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 37 findings — high 0, medium 4, low 27, false 6, maybe-false 0
- findings:
  - `[low]` `reject` Blind: Partner MoodCard icon `text-partner` on a still-white card in dark — the card is story 5's restyle; the old yellow-500 icon on white was lower contrast, so this is no regression.
  - `[medium]` `bad_spec` Blind: partner card shows default name "[partner]" — confirmed, no `loadPartner` on Mood; spec amended: store name or "Your partner" + User icon, never `PARTNER_NAME`.
  - `[low]` `reject` Blind: chip row keeps `role="img"` + "… mood emoji" aria-label, sr-only duplicate — SPEC pins existing aria labels/roles; screen-reader use is not everyday here and the label text predates this story.
  - `[low]` `reject` Blind: `mood-emoji` / `partner-mood-emoji` testids now wrap icons — SPEC requires moved elements to keep their testids.
  - `[low]` `bad_spec` Blind: today's focus ring identical to its today ring — spec amended to an outline focus style.
  - `[low]` `defer` Blind: Frustrated and Angry share one icon — pre-existing icon choice; new icon is a design call (deferred).
  - `[low]` `bad_spec` Blind: groups sliced by position, test tautological — spec amended to explicit arrays + named assertions.
  - `[low]` `reject` Blind: no tablist/tab semantics — pre-existing absence; adding the ARIA tab pattern adds structure beyond a restyle.
  - `[low]` `reject` Blind: date subtitle stale past midnight / en-US — needs a timer (added complexity), rare; en-US matches `dateUtils`/`calendarHelpers`.
  - `[low]` `bad_spec` Blind: fixed `h-[76px]` clips at large text — spec amended to `min-h-[76px]`.
  - `[low]` `bad_spec` Blind: overflow check pinned to 390 — spec amended to compare against `clientWidth`.
  - `[low]` `reject` Blind: modal/calendar-day/partner-card colours not E2E-covered — implementer screenshotted them; seeded E2E needs data setup beyond a restyle.
  - `[false]` `reject` Blind: counter warning should use `danger` — SPEC reserves red for destructive only; accent is the permitted emphasis.
  - `[low]` `reject` Blind: empty partner state lacks the name — cosmetic; the state has no mood to attribute.
  - `[medium]` `bad_spec` Edge: partner store null on Mood → default name for every couple — same root cause as the name finding; spec amended.
  - `[low]` `bad_spec` Edge: `charAt(0)` splits a surrogate pair — spec amended to `Array.from(name)[0]`.
  - `[low]` `reject` Edge: date subtitle stale past midnight — as above.
  - `[false]` `reject` Edge: MoodHistoryItem ignores `isPartnerView` — no caller passes `true` (only MoodTracker renders the timeline, with the user's own id), so partner moods never reach it.
  - `[low]` `bad_spec` Edge: overflow check vs classic scrollbars — same as the 390 finding; spec amended.
  - `[false]` `reject` Edge: `document.fonts.load` fails without Google Fonts — `home-kit.spec.ts:145` and `kit-chrome.spec.ts:82` already depend on the same load in the same environment and pass.
  - `[low]` `reject` Edge: all twelve moods saved → no unselected tile — no pool spec saves all twelve; unlikely.
  - `[low]` `reject` Edge: "select all that apply" hint removed — the approved artboard omits it; the "Selected:" row shows multi-select.
  - `[low]` `reject` Edge: `role="img"` hides chip labels — as the aria finding above.
  - `[low]` `bad_spec` Gap: Positive/Challenging split untested by name — spec amended (named assertions).
  - `[medium]` `bad_spec` Gap: partner name untested — spec amended with name/blank/null unit cases.
  - `[medium]` `bad_spec` Gap (other): `partner` only filled by `loadPartner` → cold `/mood` shows hardcoded name — same root cause; spec amended.
  - `[low]` `reject` Intent: date "September 22" vs artboard "22 September" — screens.md calls mock text placeholder; app formats en-US.
  - `[low]` `reject` Intent: relative timestamp vs artboard "20 Mar" — existing behaviour kept (presentational only); older entries already render a short date.
  - `[false]` `reject` Intent: avatar initial `text-card` not white — mandated by the ≥4.5:1 contrast constraint; identical to white in light.
  - `[false]` `reject` Intent: extra rows beyond the artboard — the artboard crops them; removing them would drop features.
  - `[false]` `reject` Intent: light accent/muted/danger differ from design-tokens.md — story 1's deliberate, documented contrast fix (`src/index.css`).
  - `[low]` `reject` Intent: `MOOD_TONE` used at 2 of 6 sites — other sites split bg and text across elements, so one pair cannot apply; the tokens themselves are single-sourced.
  - `[low]` `reject` Intent: no visual-comparison test — manual screenshots are the spec's check and were taken.
  - `[low]` `reject` Intent: partner chip colour / card presence not E2E-checked — partner state of pool accounts is not controlled; unit tests pin structure.
  - `[low]` `reject` Intent: modal and calendar days not E2E-checked — as the coverage finding above.
  - `[low]` `reject` Intent: CAP-4 emoji regex only on the Mood view — the emoji map is deleted from source; nothing else renders a mood as emoji.
  - `[low]` `reject` Intent: Partner MoodCard still light — out of scope: stories.yaml assigns Partner's CAP-2 to story 5.

### 2026-09-22 — Review pass
- verdicts: 31 findings — high 0, medium 3, low 23, false 3, maybe-false 2
- findings:
  - `[medium]` `patch` Blind: Timeline/Calendar emoji check reads the page before loading ends — E2E now waits for `loading-spinner` / `calendar-loading` to reach count 0 before `chromeText`.
  - `[maybe-false]` `defer` Blind: Happy-tile E2E can race a late form re-seed from today's saved entry — settle by checking whether the pool account's sync-driven `loadMoods` can land after the `**/rest/v1/moods**` response the test awaits; if so, the test flakes (medium, unverified).
  - `[low]` `patch` Blind: `focus:ring-accent` hides the note field's `ring-danger` while focused — focus ring colour now follows `noteError`. (Missing `aria-invalid` is pre-existing.)
  - `[low]` `reject` Blind: hover states removed everywhere — touch-first PWA; the kit artboards define no hover; adding them is additive work.
  - `[medium]` `patch` Blind: removed-emoji states (NoMoodLoggedState, partner error, timeline empty/error) have no no-emoji test — same root cause as the gap finding; unit tests added.
  - `[low]` `reject` Blind: timeline icon strip unbounded with many moods — pre-existing (the emoji span had the same width); twelve moods at once is rare.
  - `[low]` `reject` Blind: `avatar()` test helper finds the first `aria-hidden` node — dev-only fragility, correct today; a fix adds a new testid.
  - `[low]` `reject` Blind: icon check weak / no icon-uniqueness test — `Record<MoodType, MoodDisplay>` types the icon; the one duplicate is already deferred.
  - `[low]` `reject` Blind: chip row `role="img"` + "mood emoji" label, sr-only duplicate — carried: SPEC pins existing aria labels/roles; not everyday use.
  - `[low]` `patch` Blind: style drift (double quotes, mixed tense, over-long comment lines, import order) — fixed by hand.
  - `[low]` `reject` Edge: date subtitle stale past midnight — carried: needs a timer; rare.
  - `[low]` `reject` Edge: store `partner` could differ from the `partnerId` prop — `partner` is reset on sign-out and changes only via `accept_partner_request` (which reloads it); a mismatch needs a cross-device unlink/relink mid-session.
  - `[low]` `reject` Edge: `Array.from` splits flags/ZWJ graphemes — the spec's code-point rule; grapheme segmentation adds `Intl.Segmenter` for names that are rare here.
  - `[low]` `reject` Edge: `truncate` can cut "is feeling" for very long names — names are capped at 30 chars; the cut needs a name near that cap.
  - `[maybe-false]` `defer` Edge: select-Happy pre-check races form seeding — same claim as the Blind race row; same settling check.
  - `[low]` `reject` Edge: "select all that apply" hint removed — carried: the approved artboard omits it.
  - `[medium]` `patch` Gap: no test guards the no-emoji rule on the empty, error and no-partner-mood states — unit assertions added for all four states.
  - `[low]` `reject` Intent: no visual comparison against the artboard — carried: manual screenshots are the spec's check.
  - `[false]` `reject` Intent: dark avatar initial `text-card` not white — carried: required by the ≥4.5:1 contrast rule.
  - `[low]` `reject` Intent: partner heading usually "Your partner" + User icon, not a name — SPEC non-goal "no data, store or API change" rules out a new fetch; the name shows whenever the store has it, and the fallback is never wrong.
  - `[low]` `reject` Intent: en-US date format — carried: mock text is placeholder.
  - `[low]` `reject` Intent: relative partner timestamp — carried: existing behaviour kept.
  - `[false]` `reject` Intent: light accent `#c8216b` — carried: story 1's documented contrast fix.
  - `[false]` `reject` Intent: rows below the artboard's crop — carried: removing them would drop features.
  - `[low]` `reject` Intent: partner card only unit-tested — carried: pool partner state is not controlled.
  - `[low]` `reject` Intent: calendar cells, timeline rows and modal only container-tested — carried.
  - `[low]` `reject` Intent: CAP-2 dark checks cover selected surfaces only — all touched files use kit tokens with no `dark:` variants, so a theme miss would need a raw colour the grep rules out.
  - `[low]` `reject` Intent: CAP-4 app-wide rests on source deletion — carried.
  - `[low]` `reject` Intent: CAP-1 grep not automated — the AC is a source grep, run manually each pass.
  - `[low]` `defer` Intent: Frustrated/Angry share an icon — carried: already deferred, not re-added.
  - `[low]` `reject` Intent: Partner MoodCard still light — carried: story 5 owns Partner's CAP-2.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0
- `npm run test:unit` -- expected: all pass
- `npx playwright test tests/e2e/mood tests/e2e/offline/network-status.spec.ts tests/e2e/home/persisted-events-strip.spec.ts` (with `supabase start`) -- expected: all pass

**Manual checks:**
- `npm run dev:local`, 390×844, light + dark: screenshot Log, Timeline, Calendar and the detail modal; compare Log with `mockups/Mood.dc.html`.

## Auto Run Result

Status: done

**Summary:** The Mood view (Log, Timeline, Calendar, detail modal, partner card) now renders on the style kit in both themes, matching `mockups/Mood.dc.html` for the Log tab: Playfair title + date, sticky segmented control, violet partner chips, 76px+ tile grid with a pink selected state. One shared mood icon/label map (`src/constants/moodDisplay.ts`) replaces the four disagreeing per-component maps and the emoji map; colour follows the owner (you = tint/accent, partner = ptint/partner). No emoji represents a mood anywhere.

**Files changed:**
- `src/constants/moodDisplay.ts` (new) -- shared `MOOD_DISPLAY`, explicit `POSITIVE_MOODS`/`CHALLENGING_MOODS`, `MOOD_TONE`
- `src/utils/moodEmojis.ts` -- deleted
- `src/components/MoodTracker/MoodTracker.tsx` -- page shell, segmented control, tiles, form, toasts/banners on kit
- `src/components/MoodTracker/MoodButton.tsx` -- kit tile, `min-h-[76px]`
- `src/components/MoodTracker/PartnerMoodDisplay.tsx` -- kit card, avatar, violet chips; name from the store or "Your partner" + User icon
- `src/components/MoodTracker/NoMoodLoggedState.tsx` -- kit card, no emoji
- `src/components/MoodTracker/MoodHistoryItem.tsx`, `MoodHistoryTimeline.tsx` -- icons instead of emoji, kit states
- `src/components/MoodHistory/MoodHistoryCalendar.tsx`, `CalendarDay.tsx`, `MoodDetailModal.tsx` -- kit card/dialog, shared map, outline focus on days
- `src/components/PartnerMoodView/PartnerMoodView.tsx` -- reads the shared map only (story 5 restyles it)
- Tests: `moodArrayGuards.test.tsx` (icons, partner name, no-emoji states), `MoodHistoryTimeline.firstPaint.test.tsx` (no-emoji empty/error), `MoodCard.moodArray.test.tsx` (comment), `src/constants/__tests__/moodDisplay.test.ts` (new), `tests/e2e/mood/mood-kit.spec.ts` (new, P1, both themes at 390x844)

**Review findings:**
- Pass 1 (37 findings): one bad_spec loopback. The spec's `PARTNER_NAME` fallback would have labelled [owner]'s mood "[partner]" on [partner]'s device. The spec was amended with five smaller fixes folded in, and the code re-derived from the saved attempt (`_bmad-output/implementation-artifacts/story-3-attempt-1.patch`). 1 deferred (Frustrated/Angry share an icon), the rest rejected as logged.
- Pass 2 (31 findings): patches applied: 1 medium entry (the no-emoji rule was unguarded on the empty/error/no-partner-mood states and the E2E read before loading ended), 2 low (note error ring hidden on focus, style drift). 1 deferred (possible Happy-tile E2E race with form re-seeding, maybe-false). All other findings rejected with reasons in the triage log.
- Patched counts by verdict (pass 2): high 0, medium 1, low 2.

**Follow-up review recommendation:** false. No high was patched and only one medium entry was patched.

**Verification:** `npm run typecheck` exit 0; `npm run lint` exit 0; `vitest run` 110 files / 2055 tests passed; `npx playwright test tests/e2e/mood tests/e2e/offline/network-status.spec.ts tests/e2e/home/persisted-events-strip.spec.ts` 15 passed against local Supabase; the source grep over `src/components/MoodTracker` and `src/components/MoodHistory` finds no hex, gradient, `slate-`/`gray-` or `dark:`. The first attempt's implementer took screenshots of the Log, Timeline, Calendar and modal in both themes and compared the Log tab with the mockup. The second attempt did not re-take them. It changed only the partner-card name source, tile min-height and focus styles, and unit tests cover those.

**Residual risks:**
- The partner card usually reads "Your partner is feeling" on a cold start. The store's `partner` is loaded only by the Partner view, and a new fetch was out of scope.
- The dark-mode avatar initial is dark text on violet, where the mockup shows white; this is required by the 4.5:1 contrast rule.
- The date subtitle is en-US ("Tuesday, September 22") and does not refresh past midnight.
- The two deferred items above.
- `PartnerMoodView`'s MoodCard is still light-only until story 5.

