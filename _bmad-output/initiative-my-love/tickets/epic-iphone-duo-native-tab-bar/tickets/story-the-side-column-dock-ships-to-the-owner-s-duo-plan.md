---
title: 'The side-column dock ships to the owner''s Duo'
type: 'chore'
ticket: '5'
created: '2026-10-31'
status: 'done'
baseline_revision: 'f27ee2c74982ca2a20870ef0cd5467aa31261fb3'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/tickets/story-find-how-the-web-code-learns-the-side-column-s-position-and-plan.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stories 2.9, 2.2, 2.8 and 2.4 built the side-column dock, and #421 narrowed the capsule to 40 px, but only the simulator has checked it. Nobody has seen it on the owner's Duo, in Safari, in the Home Screen web app, in the right pane of two apps side by side, or when the outer display flips between its two landscapes.

**Approach:** Ship the web part through `deploy.yml` and let the Duo's shell take it by live update; no native code changed, so no reinstall. A person then runs the checklist below on the owner's Duo and a non-Duo iPhone simulator, and describes what they saw in words. Screenshots are committed only from fictional fixture accounts. A failed check opens a fix story; this story changes no code.

**Decision (owner, 2026-10-31):** this decision replaces the last sentence of the Approach for the left pane. In the left pane of two apps side by side, the dock mirrors the right pane's capsule onto the screen's left edge, as Instagram does. This story makes that change, not a new one. iOS gives the left pane no column, so the shell's native view controller adds an 84 pt left safe-area inset there. That needs a reinstall of the shell from Xcode on each phone, which the owner accepts.

</frozen-after-approval>

## Implementation Notes

Oneshot because the story first shipped code already on main and ended in a person's device check. The owner's left-pane Decision then added one small native change, about 40 lines of Swift.

**Shipped state (checked 2026-10-31):**

- #420 (the loop run: stories 2.9, 2.2, 2.8 and 2.4), #421 (40 px capsule) and #422 (live-update toast) are merged. Main's last web-code commit is `0376b5553455d969de52d89f7ad6faa7648d7800`. The commit after it, `f27ee2c74982ca2a20870ef0cd5467aa31261fb3`, touches only `tests/**`, which `deploy.yml`'s `paths-ignore` skips.
- `deploy.yml` run 41181590598 on `0376b555` succeeded (Apply Migrations, build, deploy, health-check). On the same commit the Tests run 41181590628 passed every stage, including Lint & Type Check, Unit, both E2E shards, the api and integration backend tests, and the Database tests. Burn-in runs on PRs only. CodeQL and Lighthouse also passed. Tests also passed on every later main commit up to `8d59abba`: run 41182293088 on `f27ee2c7`, then `bc3a7145` and `8d59abba`, which are both tsconfig-only changes for tests.
- `https://my-love.sallvain.workers.dev/updates/latest.json` names version `0376b5553455d969de52d89f7ad6faa7648d7800`, so a shell that is opened and then backgrounded picks up the dock.

**Person's checklist.** Before starting, open the shell once and background it so the update installs, then reopen it.

1. Folded portrait, folded landscape in both directions, unfolded landscape, and the shell in the right pane of two apps side by side: the dock is a capsule at the bottom of the column, with six buttons and no gear in the header.
2. Turning the folded display from one landscape to the other moves the column to the left side, and the capsule follows it. Stories 2.2 and 2.8 proved this side flip on the simulator only.
3. Unfolded portrait: today's header gear and the five-button bottom dock. (The left pane was checked here too before the Decision in Intent replaced it with item 8.)
4. Folding, unfolding and rotating switch the dock's form without a reload, and the view on screen stays the same.
5. In every column pose, each view scrolled to its end shows its last item whole and clear of the capsule. Love Notes' composer sits at the bottom of the screen beside the capsule.
6. Each of the six buttons opens its view and shows as active, and a reload reopens that view.
7. The My Love app (the shell) on a non-Duo iPhone simulator, on the deployed build, shows today's header and bottom dock in portrait and in both landscapes.
8. After the shell is reinstalled from Xcode, the shell in the left pane of two apps side by side shows the six-button capsule on the screen's left edge, with no header gear and content clear of it. Swapping panes moves it to the right pane's column and back without a reload.

Two checks were removed at the owner's direction on 2026-10-31; the epic's Decisions of that date record both. The VoiceOver check was dropped because story 8's simulator check meets R3. The Safari and Home Screen web app check was dropped because the couple uses only the native shell. The frozen Problem still names those two surfaces. The owner also directed that a passing item is recorded as a plain pass, which replaces the frozen Approach's "describes what they saw in words".

**Results (owner, 2026-10-31):** items 1–8 pass. Item 8 was checked after the shell was reinstalled over the top on the owner's Duo from `a9139a57` (Debug build, `fnox exec -- npm run ios:sync` and then an `xcrun devicectl` install). One follow-up check also passed: turning the folded phone back moves the capsule to the right. The pane swap switches the dock as specified, but the owner rejected the specified left-pane behaviour (the Decision in Intent).

**Left-pane change:** `MainViewController` in `ios/App/App/NativeAuth.swift` adds an 84 pt left `additionalSafeAreaInsets` when the system insets are exactly the left pane's. Those are no top, left or right inset, a bottom inset, and an iPhone, matching story 7's 0/0/34/0 for that pane. Each re-layout clears it again once the pane changes. No web code changes: `useSideColumn` reads the new inset as a left column, and `src/index.css` already sizes every side clearance from `env(safe-area-inset-left)`. The simulator driver cannot enter split view, so the mechanism was proven with a temporary build that skipped the top-inset check. On the Duo simulator in unfolded portrait, that build put the six-button capsule at x 24 inside the 84 pt left column, with the content padded beside it and no header gear. The temporary build was then reverted, and the final Swift was built and installed through `sim build`. On it, unfolded portrait shows the header gear (44×44 at x 613) and the bottom dock, while unfolded landscape and folded portrait show the capsule on the right (x 891 and x 406). The temporary build's dump also read the six labels Home through Settings on the left capsule. Other iPhones cannot match the rule: story 9 measured the iPhone 17 shell at 62/0/34/0 in portrait and 0/62/20/62 in both landscapes.

## Verification

**Commands:**
- `gh run view 41181590598` -- expected: every deploy job succeeded on `0376b555`
- `curl -s https://my-love.sallvain.workers.dev/updates/latest.json` -- expected: `version` is `0376b5553455d969de52d89f7ad6faa7648d7800`

**Manual checks:**
- The person's checklist above, each item reported as pass or fail; item 8 after the shell is reinstalled from Xcode.

## Review Triage Log

**Pass 1 (quick lens, documentation-only diff):** 10 findings. 7 patched, 1 sent back to the owner, 2 dropped.
- patch (low): the VoiceOver Decision said "every column pose"; it now names the four poses story 8 read.
- patch (low): the Safari and web-app Decision stated R5 met; it now records an inference the owner accepts.
- patch (low): `verify` lost its comma before the last item; restored.
- patch (low): "Stories 2.2 and 8" changed to "2.2 and 2.8".
- patch (low): CI evidence named only `0376b555`; the Tests runs on every later main commit up to `8d59abba` are now recorded.
- patch (low): the ticket's screenshot rule was narrower than the epic's Constraint; widened at the owner's request.
- patch (medium): the pane swap and the flip back were never asked for. The owner checked both. The flip back passed. The swap matched the spec, and the owner rejected the specified left-pane behaviour, which led to the Decision in Intent.
- owner decision: a passing item is recorded as a plain pass, not described in words.
- false: item 7's surface was ambiguous. The owner ran it in the app.
- rejected (low): the new Decisions overstate evidence beyond what the two notes above fix. Nothing more to change.

**Pass 2 (quick lens, with the left-pane change):** 10 findings. 8 patched, 2 false.
- patch (low): the plan said it adds no code; corrected.
- patch (medium): checklist item 3 still expected the bottom dock in the left pane; split out, and item 8 added for the left pane after the reinstall.
- patch (low): the plan did not record the final build after the temporary one; recorded with its three poses.
- patch (low): the ticket's description still said live update only and "described in words"; corrected.
- patch (medium): R1 and R5 still gave the left pane the bottom dock; both edited to match the Decision.
- patch (low): the Decision did not mention the device-check Constraint; it now says how it narrows it.
- patch (low): code and documentation would share one commit on a `docs/` branch; split into two commits on a `fix/` branch.
- patch (low): the `useSideColumn.ts` header comment did not mention the left pane's native inset; added.
- false: the rule could add a column on other iPhones. Story 9 measured the iPhone 17 shell at 62/0/34/0 in portrait (top inset) and 0/62/20/62 in both landscapes (side insets), so the rule cannot match.
- false: R3 is unread for the left capsule. R3 asks for all six names in one column pose, and the epic's 2026-10-30 Decision accepts the driver's reading. The temporary build's dump also read all six on the left capsule.
- pending, not a defect: no device result existed yet for the left pane. Checklist item 8 has since passed on the owner's Duo.
