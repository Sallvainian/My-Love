---
title: 'Settings is the sixth button in the column dock'
type: 'feature'
ticket: '8'
created: '2026-10-30'
status: done
baseline_revision: 'a9dd3aaf7bbb2e8b51ece3ff4e1c802123f972b5'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/tickets/story-the-dock-becomes-a-capsule-in-the-side-column-without-coveri-plan.md', '{project-root}/_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/tickets/story-the-simulator-driver-is-a-repo-tool-plan.md']
warnings: []
deferred:
  - summary: >-
      The sim driver's signin appends to whatever the login fields already hold, so a retry after a failed first attempt types onto the leftover email and is refused.
    evidence: |-
      scripts/sim-driver/RunnerUITests/Drive.swift signIn taps the first web text field and calls typeText(email) with no clear first. In story 8's run `sim signin` exited 1 on its first try right after `sim build` on both the Duo and the iPhone 17 simulators (no assertion message in the drive log); on the iPhone 17 the retry produced `…comsest.example.com` and "Invalid email or password", and only `xcrun simctl terminate` plus `sim launch` recovered. The first-try failure itself is not yet explained.
    location: >-
      scripts/sim-driver/RunnerUITests/Drive.swift:59
    severity: medium
  - summary: >-
      Story 8's column-form clause on AGENTS.md's "A new view is registered in five hand-maintained places" line sits inside the bmad:context managed block, so a context refresh may drop it.
    evidence: |-
      AGENTS.md lines 1-2 open the managed block ("edits inside this block are replaced on refresh") and it closes at line 90; the edited bullet is line 27. The Maintained-by-hand dock paragraph carries the same fact outside the block, so the rule survives there, but a refresh that rewrites line 27 from older wording would again say Settings is never a dock item. Fix by having the next refresh keep the column-form exception, or by dropping the clause from line 27 and relying on the hand-maintained paragraph; deferred because the fix edits agent-context files.
    location: >-
      AGENTS.md:27
    severity: low
---

<intent-contract>

## Intent

**Problem:** In the Duo shell's column poses, story 2's capsule holds five buttons while Settings stays a gear in the header, so the column is not the one place to reach every destination (R8).

**Approach:** In the column form only, `AppNavigation` renders Settings as a sixth capsule button after the five and replaces the header gear with an `aria-hidden` spacer of the gear's size, so the wordmark stays centred; the bottom form, header gear included, is unchanged. Check every column pose and the gear forms through `scripts/sim-driver/sim`.

## Boundaries & Constraints

**Always:**
- Form comes from `useSideColumn()` alone, as story 2 built it.
- Column form: one `<nav data-testid="nav-dock">` with six buttons in order Home, Mood, Love Notes, Photos, Partner, Settings; Settings uses the same button markup as the other column buttons (icon only, `h-11 w-11`, `bg-tint text-accent` when active, `aria-current="page"` when `currentView === 'settings'`), `aria-label="Settings"`, `data-testid="nav-settings"`, and calls `onViewChange('settings')` as the gear does. A `settings` badge count stays ignored in both forms.
- Column form header: no button; the left spacer stays (the slot for the backlog's future notifications button) and a matching `aria-hidden` `min-h-11 min-w-11` spacer takes the gear's place.
- Bottom form: header gear and five-button dock exactly as today.
- Clearance stays horizontal via story 2's `index.css` variables; no new dock variables unless the six-button capsule is found covering something.

**Never:**
- A sixth button in the bottom dock, or removing the gear where there is no column.
- Native code, `ios/App`, `capacitor.config.ts`; a notifications button (that is the backlog story's).
- Committing screenshots; leaving a sim build in the repo's `dist/` or `ios/App/App/public/`, or an update server running.

## I/O & Edge-Case Matrix

| Scenario | `useSideColumn()` / `currentView` | Expected | Error Handling |
|----------|--------------|---------------------------|----------------|
| No column | `null` / any | Gear in header, five-button dock | — |
| Right/left column | `'right'`/`'left'` / `home` | Six column buttons, header has no button, two spacers | — |
| Settings open in column | `'right'` / `settings` | Column Settings button `aria-current="page"` + `bg-tint` | — |
| Form switch on Settings | `null` → `'right'` → `null` / `settings` | Gear ↔ column button, `aria-current` follows, no `onViewChange` call | — |

</intent-contract>

## Code Map

- `src/components/Navigation/AppNavigation.tsx` -- `DESTINATIONS` (comment "Settings is not here"), header gear block, column/bottom `<nav>` map; `SettingsIcon` already imported; update the file-header comment ("The header and its gear are the same in both forms").
- `src/components/Navigation/__tests__/AppNavigation.test.tsx` -- `sideColumn` hoisted mock drives the form; tests at "keeps one Primary nav of five labelled buttons … (column %s)" and "shows icons only in the column" assume five column buttons and a header gear in every form — split into bottom vs column expectations.
- `tests/e2e/navigation/dock.spec.ts`, `tests/e2e/navigation/kit-chrome.spec.ts`, `tests/e2e/settings/` -- bottom-form E2E; should pass unchanged.
- `AGENTS.md:27` -- "(the bottom dock; Settings is the top-bar gear, not a dock item)"; the dock paragraph under "Maintained by hand" ("The dock is full at five `DESTINATIONS`…") -- add that in the column form Settings is the capsule's sixth button and the header has no gear.
- `scripts/sim-driver/sim` -- `provision`, `build`, `signin`, `pose`, `rotate`, `tap`, `scroll`, `dump`, `screenshot`; story 2's Implementation Notes record the exact procedure, page sizes and capsule frames (five-button capsule 84×252; six buttons → ~300 pt tall), and that `aria-current` is not exposed to XCUITest, so the active button is read from a screenshot.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/Navigation/AppNavigation.tsx` -- column form appends Settings to the capsule and swaps the header gear for a spacer, per Always; update comments.
- [x] `src/components/Navigation/__tests__/AppNavigation.test.tsx` -- every I/O matrix row: header buttons and dock buttons (testids, labels, order) per form, column Settings click reports `'settings'`, active highlight + `aria-current`, form switch while on Settings, fresh column mount on Settings, settings badge ignored in the column.
- [x] `AGENTS.md` -- the two lines named in the Code Map, for column poses.
- [x] Simulator run through `scripts/sim-driver/sim` (provision, build, signin) -- every simulator AC; record commands, exit codes and readings in Implementation Notes; screenshots go to the session scratchpad only.

**Acceptance Criteria:**
- Given the Duo simulator with a signed-in fixture account, when in folded portrait, both folded landscapes and unfolded landscape, then `sim dump` shows six buttons labelled Home, Mood, Love Notes, Photos, Partner, Settings in that order with frames inside the column, the capsule's top below the header's bottom, and no Settings button in the header.
- Given each of those column poses, when the column's Settings button is tapped, then Settings opens and that button alone shows the active highlight in a screenshot.
- Given the Duo in unfolded portrait and an iPhone 17 simulator in portrait, when `dump` runs, then the header holds the Settings gear, the dock holds five buttons in a row, and tapping the gear opens Settings.
- Given every pose above, when `dump` runs, then the wordmark text's frame centre is within 2 pt of the page's horizontal centre.
- Given each column pose, when each of the six views is scrolled to its end, then its last item's frame is whole and does not intersect the six-button capsule.
- Given the bottom form, when the navigation and settings E2E specs run, then every spec passes.

## Implementation Notes

Run 2026-10-30 on the iPhone Duo simulator (iOS 27.1, `A0A486ED…`) and the iPhone 17 simulator (iOS 27.2, `73CC7947…`), local stack, every device command through `scripts/sim-driver/sim`, no person acting. Screenshots and dumps are in the session scratchpad, not the repo. The active button was read from each screenshot, sampled 6 pt inside the button's left edge at mid-height: tint `rgb(252,231,243)` against glass `rgb(255,253,253)` or similar.

**Setup.** `sim provision` → exit 0 (`reset` for both accounts, `linked as partners`, `seeded 6 events, 70 moods, 80 love notes, 24 photos`). `sim build` → exit 0 (`installed sim-tree-1793416802 … (readout: 0 …)`). `sim signin` → exit 1 on the first try (the drive log had no assertion message), then exit 0 (`signed in as simdriver@…`, `dismissed the welcome splash`).

**AC 1, 2, 4, 5: column poses.** Capsule frame and button order come from `dump`. "Settings outside nav" counts Settings buttons whose frame is outside the capsule. The header's bottom is the `banner` frame's bottom (64 in every column pose). The wordmark is the header's `My Love` text. The gap is page height minus the bottom of the last item at the scrolled end.

| Pose (reached with) | Page | Capsule (x y w×h) | Buttons top to bottom | Settings outside nav | Wordmark text / text+heart centre vs page centre | Taps: highlighted | End gap: Home / Mood / Love Notes / Photos / Partner / Settings |
|---|---|---|---|---|---|---|---|
| Unfolded landscape (landscapeLeft, as found) | 951×669 | 867 319 84×300 | Home, Mood, Love Notes, Photos, Partner, Settings | none | +10.0 / +0.0 | each tap highlighted only the tapped button | 50 / 57 / 46 / 91 / 71 / 71 |
| Folded landscape-secondary (`pose closed`, landscapeRight) | 678×466 | 594 116 84×300 | same | none | +10.0 / +0.0 | each tap highlighted only the tapped button | 50 / 57 / 46 / 91 / 71 / 70 |
| Folded landscape-primary (`rotate`, landscapeLeft) | 678×466 | 0 116 84×300 | same | none | +10.0 / +0.0 | each tap highlighted only the tapped button | 50 / 57 / 46 / 91 / 71 / 70 |
| Folded portrait (`rotate`, portrait) | 466×678 | 382 328 84×300 | same | none | +10.0 / +0.0 | each tap highlighted only the tapped button | 51 / 57 / 46 / 90 / 71 / 70 |

In every column pose all six buttons are 44×44 and lie inside the capsule, and the capsule lies inside the column: x ≥ page width − 84 on the right, x + w ≤ 84 on the left. The capsule's top (116 to 328) is below the header's bottom (64), and its bottom is 50 pt above the page bottom (1rem + 34). The header holds no button. Each tap on the column's Settings opened Settings, with the `Settings` heading as the first text. After the tap, the sampler found that button tinted and the other five on glass. At every view's scrolled end the last item was whole and did not intersect the capsule:
- Home: "Swipe left or right…"
- Mood: Log Mood
- Love Notes: Send message, right edge 851 / 578 / 366 against the capsule at 867 / 594 / 382; x618 against the left capsule's right edge at 84
- Photos: "You've reached the end of your memories"
- Partner: the last history date
- Settings: Sign out

**AC 3: bottom form.**
- Duo unfolded portrait, reached with `pose open`, then `rotate 2` and `rotate`:
  - page 669×951, header bottom 146
  - Settings gear at x613 y92 inside the header
  - `nav` 449×60 at y841 holding Home, Mood, Love Notes, Photos and Partner in one row at y849
  - wordmark text centre +10.0, text+heart centre +0.0
- The view was still Settings from the folded-portrait checks, so after this form switch the gear was the tinted control and the dock buttons were on glass.
- `tap` on Home opened Home. `tap 635 114` on the gear opened Settings, and the gear alone was tinted.
- iPhone 17 portrait:
  - Build, boot and sign-in: `xcrun simctl boot`, then `sim --device … build` → exit 0. `signin` failed on its first try with the same symptom as on the Duo. The retry typed onto the leftover email text (`…comsest.example.com`, "Invalid email or password"). It passed after `xcrun simctl terminate` and `sim launch`.
  - Readings: page 402×874, header bottom 126. The gear is at x346 y72. Home through Partner sit in one row at y772, with Home 94 wide because it is active. Wordmark text centre +10.0, text+heart centre +0.0. Tapping the gear opened Settings, with the gear tinted.
  - Cleanup: `sim --device … uninstall` → exit 0, then `xcrun simctl shutdown` → exit 0.

**AC 6, Commands.**
- `npx vitest run src/components/Navigation` → 44 passed. Against the baseline `AppNavigation.tsx`, 6 of the new tests fail: six buttons in the column (left and right), icons only with notes and with settings active, the column Settings click, and the form switch on Settings.
- `npm run test:unit` → exit 0, 203 files, 3210 tests.
- `npm run typecheck` → exit 0, with no TS2883.
- `npm run lint` → exit 0.
- `npm run test:e2e -- tests/e2e/navigation tests/e2e/settings` → exit 0, 80 passed.
- `git status --short` → only the three planned files and this plan.
- `ls dist ios/App/App/public` → neither exists (exit 2).
- `pgrep -fl "http.server|wrangler"` → nothing (exit 1).
- The Duo holds the working tree's shell, with no readout, signed in as the first fixture account, unfolded in portrait.

## Plan Change Log

- AC 4's "the wordmark text's frame centre is within 2 pt of the page's horizontal centre" does not hold in any pose, and it did not hold before this change. The wordmark is a heart icon (`h-3.5`, 14 pt) plus `gap-1.5` (6 pt) plus the text, all centred as one group. The text's own centre therefore sits (14 + 6) / 2 = 10 pt right of the page centre. The readings show +10.0 in all four column poses, in Duo unfolded portrait (bottom form, gear present) and on the iPhone 17. Computed from the text frame, the group's centre (text left − 20 to text right) is +0.0 in every pose. The column form's spacer therefore keeps the wordmark exactly where the gear left it. AC 4 is met as "centred as the bottom form centres it". The wordmark markup was not changed, because that is outside this story.
- The fold (`pose closed`) left the Duo in landscapeRight, so the poses ran in the order unfolded landscape, folded landscape-secondary, folded landscape-primary, folded portrait. Rotation cycles portrait → landscapeRight → landscapeLeft → portrait.

## Review Triage Log

### 2026-10-31 — Review pass
- verdicts: 4 findings — high 0, medium 1, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` AC 4 measures the wordmark text alone, which sits 10 pt right of the page centre in every pose — real but pre-existing and harmless: `AppNavigation.tsx` centres the 14 pt heart, the 6 pt `gap-1.5` and the text as one group, the group is 0.0 pt off centre in every pose including the unchanged bottom form, and the ticket asks that the wordmark "stays centred"; changing the wordmark would alter the bottom form, which the intent keeps exactly as today, so the only fix is rewording this build's plan, which triage rejects.
  - `[medium]` `[defer]` `sim signin` is not retry-safe and the defect was recorded only in the plan — verified: `Drive.swift:59-69` calls `typeText(email)` without clearing the field; pre-existing driver code, not caused by this change; added to the plan's `deferred` list, which the run carries into the ledger.
  - `[low]` `[defer]` the AGENTS.md line-27 edit sits inside the `bmad:context` managed block and may be replaced on refresh — verified at AGENTS.md:1-2 and :90; the fix edits agent-context files, so deferred.
  - `[low]` `[patch]` `src/index.css:189` comment still gave the capsule as "about 250px" — fixed: the implementer changed it to "about 300px", the measured six-button capsule.

## Verification

**Commands:**
- `npx vitest run src/components/Navigation` -- expected: pass
- `npm run test:unit`, `npm run typecheck`, `npm run lint` -- expected: clean (worktree TS2883 baseline excepted)
- `npm run test:e2e -- tests/e2e/navigation tests/e2e/settings` with `supabase start` -- expected: pass
- `git status --short`; `ls dist ios/App/App/public 2>/dev/null`; `pgrep -fl "http.server|wrangler"` -- expected: only planned files; no test build in the repo; no server

## Auto Run Result

**Status:** built

**Summary:** In the column form `AppNavigation` appends Settings as the capsule's sixth button (same icon-only `h-11 w-11` markup, `aria-current="page"` and tint when Settings is open, `aria-label="Settings"`, `data-testid="nav-settings"`, `onViewChange('settings')`), and the header's gear gives way to an `aria-hidden` gear-sized spacer so the wordmark stays centred; the bottom form keeps the gear and five-button dock unchanged. A `settings` badge count stays ignored in both forms.

**Files changed:**
- `src/components/Navigation/AppNavigation.tsx` — `SETTINGS` destination appended in the column form, header gear swapped for a spacer there, comments updated.
- `src/components/Navigation/__tests__/AppNavigation.test.tsx` — bottom and column expectations split; column Settings click, active highlight, form switch on Settings, fresh column mount on Settings and the ignored settings badge covered.
- `src/index.css` — column-form comment's capsule height corrected to about 300px (review patch).
- `AGENTS.md` — the view-registration line and the dock paragraph now say Settings is the capsule's sixth button in column poses and the header has no gear there.
- This plan — Implementation Notes with the simulator readings, Plan Change Log, Review Triage Log.

**Review findings:** 4 from the Quick lens. Patched 1 (low: the `index.css` capsule-height comment). Deferred 2 (medium: `sim signin` types onto leftover text on a retry; low: the AGENTS.md line-27 clause sits inside the managed block). Rejected 1 (low: AC 4's text-only centre reads +10 pt in every pose, pre-existing; the wordmark group is 0.0 pt off centre, and the only fix is rewording the plan).

**Follow-up review recommended:** false — first pass, patched entries by verdict: high 0, medium 0, low 1.

**Verification (fresh on this attempt, after the patch):**
- `npx vitest run src/components/Navigation` — 44 passed.
- `npm run test:unit` — 203 files, 3210 tests passed.
- `npm run typecheck` — exit 0, no TS errors.
- `npm run lint` — exit 0.
- `npm run test:e2e -- tests/e2e/navigation tests/e2e/settings` (local Supabase up) — 80 passed.
- `git status --short` showed only the planned files; `ls dist ios/App/App/public` found neither; `pgrep -fl "http.server|wrangler"` found nothing.
- Simulator checks through `scripts/sim-driver/sim`, recorded in Implementation Notes by the implementing session: six buttons in order inside the column in all four column poses, capsule 84×300 below the header, no header button, each tap highlighting only its button, every view's end clear of the capsule; gear plus five-button dock in Duo unfolded portrait and on the iPhone 17.

**Residual risks:**
- AC 4 as worded (the text's own centre within 2 pt) is not met in any pose, including the bottom form before this change; the wordmark as a whole is centred.
- The side-by-side right pane was not checked on the simulator (as in story 2); story 5's device check covers it.
- `sim signin` needed a terminate-and-relaunch to recover after a failed first try (deferred).
- The earlier rolled-back attempt at `refs/attempt-preserve-dirty/20261030-194727-ce60-a9dd3aaf-1` was not applied; this attempt was implemented fresh from the plan and every gate ran on it.
