---
title: 'DW-28: Pink primary button contrast'
type: 'bugfix'
created: '2026-08-20'
status: 'done'
baseline_revision: '34f71a72a95f97a1e636692616590f19f5cad800'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      The translucent own-photo badge can still miss WCAG AA over a bright photo.
    evidence: |-
      `bg-pink-600/90` composites to approximately `#e91a84` over white, which is
      about 4.27:1 against the badge's small white text. The same image-dependent
      contrast issue was pre-existing with `bg-pink-500/90`; DW-28 improves the
      token but does not make this non-button overlay opaque.
    location: >-
      src/components/PhotoGallery/PhotoGridItem.tsx:100
    severity: medium
---

<intent-contract>

## Intent

**Problem:** White text on Tailwind v4 `bg-pink-500` resolves to `#f6339a`, which measures only 3.583:1 and fails the WCAG AA 4.5:1 requirement. The current tree contains 18 affected class sites rather than the ledger's 17 because the later `events-form-refresh` action uses the same failing style.

**Approach:** Move every current white-on-`bg-pink-500` site to `pink-600` (`#e60076`, measured at 4.544:1 against white) and move its pink hover state to `pink-700`. Extend the parked Events accessibility scaffold with an empty-state scan and visually verify the consistent primary color in light and dark mode.

## Boundaries & Constraints

**Always:** Use Tailwind v4's resolved palette values rather than v3 hex assumptions; update all 18 current same-line `bg-pink-500`/`text-white` matches across nine source files, including `events-settings-empty-add` and the newer `events-form-refresh`; preserve existing behavior, disabled states, opacity modifiers, layout, and test IDs; keep the accessibility scaffold parked with `test.skip`; leave `_bmad-output/implementation-artifacts/deferred-work.md` untouched.

**Never:** Do not change pink decorations without white text, the separate `.btn-primary` gradient, component behavior, event data setup, or unrelated accessibility findings. Do not introduce a router, a new theme abstraction, or hard-coded replacement hex colors in production markup.

</intent-contract>

## Code Map

- `src/components/MoodTracker/MoodHistoryTimeline.tsx:218` -- one retry action.
- `src/components/PhotoUpload/PhotoUpload.tsx:261,415,425` -- select, retry, and submit actions.
- `src/components/photos/PhotoUploader.tsx:400` -- upload action; the pink progress bar at line 380 is read-only because it has no white text.
- `src/components/MoodTracker/MoodTracker.tsx:563` -- enabled submit-state classes.
- `src/components/Settings/EventsSettings.tsx:363,408,962,973` -- header Add, empty-state Add, refresh-after-not-found, and form submit actions.
- `src/components/Settings/AnniversarySettings.tsx:83,401` -- Add and form submit actions.
- `src/components/PartnerMoodView/PartnerMoodView.tsx:341,417,563` -- notification surface, send-request action, and enabled refresh state.
- `src/components/PhotoGallery/PhotoGallery.tsx:216,250` -- retry and empty-gallery upload actions.
- `src/components/PhotoGallery/PhotoGridItem.tsx:100` -- own-photo badge with its existing `/90` opacity modifier.
- `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-accessibility.spec.ts` -- parked axe coverage currently seeds a row before every section scan, so it never renders `events-settings-empty-add`; use its existing clear/navigate/AxeBuilder helpers for a fourth skipped empty-state case.
- `src/index.css:3` and locked `tailwindcss@4.3.3` `theme.css` -- read-only palette evidence: `pink-500` is `oklch(65.6% 0.241 354.308)`, `pink-600` is `oklch(59.2% 0.249 0.584)`, and `pink-700` is `oklch(52.5% 0.223 3.958)`.

## Tasks & Acceptance

**Execution:**
- `src/components/MoodTracker/MoodHistoryTimeline.tsx`, `src/components/PhotoUpload/PhotoUpload.tsx`, `src/components/photos/PhotoUploader.tsx`, `src/components/MoodTracker/MoodTracker.tsx`, `src/components/Settings/EventsSettings.tsx`, `src/components/Settings/AnniversarySettings.tsx`, `src/components/PartnerMoodView/PartnerMoodView.tsx`, `src/components/PhotoGallery/PhotoGallery.tsx`, `src/components/PhotoGallery/PhotoGridItem.tsx` -- replace each current white-on-pink base with `bg-pink-600` and each paired pink hover with `hover:bg-pink-700`, retaining all other classes and behavior.
- `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-accessibility.spec.ts` -- add and document a fourth parked scan that leaves this worker's events empty, observes `events-settings-empty-add`, and runs axe against the settled events section.

**Acceptance Criteria:**
- Given any affected opaque primary action, when it is shown in its enabled/default state, then its white text is on Tailwind v4 `pink-600` (`#e60076`) with a measured contrast ratio of at least 4.5:1 and its hover state uses `pink-700` where a hover class existed.
- Given the current 18 same-root-cause class sites, when the source is inspected after the change, then every `bg-pink-500` token paired with `text-white` has moved to `bg-pink-600`, including the notification surface and the existing `/90` owner badge.
- Given the Settings events view has no rows for the worker pair, when the new parked accessibility case is activated and run, then `events-settings-empty-add` is visible and the axe scan of `events-settings` reports no violations.
- Given representative affected actions are viewed in both light and dark mode, when default and hover states are inspected, then the darker pink remains readable and visually consistent without changing layout, disabled behavior, or interaction behavior.

## Spec Change Log

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 1: (high 0, medium 1, low 0)
- dismissed:
  - The partner badge's translucent blue background may also fail contrast — the supplied intent is expressly limited to the pink style and its measured inventory, so the blue branch is outside this bundle.
  - Pink-to-rose gradient buttons still use failing light endpoints — the supplied intent identifies the exact `bg-pink-500` root cause and its grep-derived sites, not gradient consumers.
  - The same-line source inventory could miss inherited, multiline, or composed styles — the supplied intent itself anchors the work to the measured `bg-pink-500`/`text-white` inventory, and no missed instance of that root cause was shown.
  - The new Events case is skipped and outside normal Playwright discovery — the intent explicitly calls it a parked scaffold and requests that it remain extended there, not activated in CI; the real Settings UI was separately exercised.
  - The scaffold's target command and imports do not work at its parked storage path — its first line declares the intended `tests/e2e/settings/events-accessibility.spec.ts` target, where all relative imports resolve; parked artifacts are target-relative by repository convention.
  - ESLint does not prove the parked scaffold's imports resolve — each import resolves from the declared target path, and the requested deliverable is a parked source rather than an in-place Playwright test.
  - Hover contrast is not exercised by the parked axe case — Playwright browser inspection verified `pink-700`, white text, and unchanged dimensions after the real Events buttons' hover transitions; permanent hover automation was not requested.
  - Dark mode is not selected by the parked axe case — the real Events header Add, empty-state Add, and form submit controls were inspected in both emulated color schemes with identical computed colors and geometry.
  - The other changed surfaces lack individual runtime contrast tests — all opaque sites share the same measured Tailwind token, the exact 18-site source change is checked, and the intent requests representative visual confirmation rather than a new app-wide active suite.
  - The Events refresh-after-not-found branch has no axe scenario — the intent specifically asks to add the previously missed empty-state scan; the later refresh site is covered by the exact class inventory and unchanged component behavior.
  - The diff contains no executable contrast calculator — the palette was measured from Tailwind v4's locked OKLCH values and the built UI exposed those exact computed values; committing a calculator is not part of the supplied surface.
  - The displayed hex and ratio round differently — the ratio is calculated from Tailwind's full OKLCH value while the hex is a rounded display value; both calculations clear 4.5:1 and no product consequence follows.
  - Manual results were not yet recorded in the spec — that proposed fix edits the spec under review and must be dismissed; the required final result section records the completed checks after triage.
  - A centralized shared token was not introduced — the intent's explicit 17-site inventory makes a site-by-site utility migration the strongest reading, and no app-owned shared primary-button token exists for these consumers.
  - Updating the notification and owner badge exceeds a semantic button-only reading — the intent also says all measured sites across nine files, so including the two non-button pink surfaces follows the stronger exact-inventory reading.
  - The diff's permanent evidence is narrower than the app-wide rendered outcome — the implementation was also verified on the real Settings UI in light and dark modes, while source scans and the shared opaque token establish the remaining matching sites; the image-dependent badge is deferred above.
  - Parked coverage is prospective rather than continuously executed — that is the explicitly requested scaffold state, not an implementation defect.
- addressed_findings:
  - `[low]` `[patch]` Rewrote the scaffold's measured-first-run comment as historical evidence and recorded DW-28's `pink-600`/`pink-700` resolution, avoiding guidance that still assigned the fixed defect to a future R-009 owner.

## Design Notes

Tailwind v4 source values were converted from OKLCH to clipped sRGB and evaluated with WCAG relative luminance. `pink-500` resolves to `#f6339a` (3.583:1 against white), `pink-600` to `#e60076` (4.544:1), and `pink-700` to `#c6005c` (5.894:1). `pink-600` is the smallest palette change that passes and preserves the existing visual hierarchy; `pink-700` keeps hover feedback visibly darker. The post-ledger refresh action is included because it is the eighteenth instance of the exact root-cause style.

## Verification

**Commands:**
- `rg -n 'bg-pink-500.*text-white|text-white.*bg-pink-500' src` -- expected: no matches.
- `git diff -U0 34f71a72a95f97a1e636692616590f19f5cad800 -- src | rg '^\+.*(bg-pink-600.*text-white|text-white.*bg-pink-600)' | wc -l` -- expected: 18 changed same-root-cause sites.
- `npm run lint` -- expected: exits successfully.
- `npm run typecheck` -- expected: the clean target checkout passes; in this nested bmad-loop worktree, exactly the six known `TS2883` diagnostics at unchanged `tests/support/merged-fixtures.ts:53` are permitted, with zero additional TypeScript diagnostics because DW-30 owns that fixture repair.
- `npx tsc -p tsconfig.app.json --noEmit` -- expected: the changed application project exits successfully.
- `fnox exec -- npm run build` -- expected: secret-injected production build exits successfully.
- `npx eslint --no-ignore _bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-accessibility.spec.ts` -- expected: the parked TypeScript scaffold parses and lints successfully despite `_bmad-output` being excluded from the normal lint command and Playwright projects.
- `rg -n '^  test\.skip\(' _bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-accessibility.spec.ts | wc -l` -- expected: 4 parked accessibility cases.

**Manual checks (if no CLI):**
- Inspect representative affected actions, including both Events Add buttons and the form submit action, in light and dark mode at default and hover; expect consistent darker pink, readable white labels, and unchanged geometry.

## Auto Run Result

### Summary

Changed every current same-root-cause white-on-`bg-pink-500` site to Tailwind v4 `pink-600` and every paired pink hover to `pink-700`. The current tree had 18 sites, not the ledger's 17, because the later Events refresh action used the same style. Added the requested fourth parked axe scenario for the empty Events state and updated the scaffold's historical measurement commentary.

### Files changed

- `src/components/MoodTracker/MoodHistoryTimeline.tsx` — darkened the history retry action.
- `src/components/MoodTracker/MoodTracker.tsx` — darkened the enabled mood submit state and hover.
- `src/components/PartnerMoodView/PartnerMoodView.tsx` — darkened the notification, request, and enabled refresh surfaces.
- `src/components/PhotoGallery/PhotoGallery.tsx` — darkened retry and empty-gallery upload actions.
- `src/components/PhotoGallery/PhotoGridItem.tsx` — moved the own-photo badge to the darker pink token while retaining its existing opacity.
- `src/components/PhotoUpload/PhotoUpload.tsx` — darkened select, retry, and submit actions.
- `src/components/Settings/AnniversarySettings.tsx` — darkened Add and form-submit actions.
- `src/components/Settings/EventsSettings.tsx` — darkened header Add, empty-state Add, refresh-after-not-found, and form-submit actions.
- `src/components/photos/PhotoUploader.tsx` — darkened the upload action.
- `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-accessibility.spec.ts` — added the fourth parked empty-state scan and made the original failure narrative historical.
- `_bmad-output/implementation-artifacts/spec-dw-28-pink-primary-button-contrast.md` — captured the implementation contract, review triage, deferred item, and verification evidence.

### Review findings

- Patches applied: 1 low — corrected the scaffold comment that still described the fixed contrast defect as future R-009 work.
- Items deferred: 1 medium — the pre-existing translucent own-photo badge can still fall below 4.5:1 over a bright image; recorded in frontmatter without editing the orchestrator-owned ledger.
- Dismissed findings:
  - The blue partner badge can fail contrast — outside the supplied pink-only intent.
  - Pink-to-rose gradient buttons retain light endpoints — outside the exact `bg-pink-500` root cause and measured inventory supplied by the intent.
  - Same-line search could miss inherited or composed styles — the supplied intent itself defines the grep-derived inventory, and no missed instance of that root cause was shown.
  - The new Events case is skipped/outside Playwright discovery — explicitly requested as a parked scaffold; the real Settings UI was exercised separately.
  - Parked-path imports and target command do not run in place — the artifact declares its target path, where the imports resolve, following the repository's target-relative scaffold convention.
  - ESLint does not resolve the parked imports — their resolution was verified from the declared target, and in-place execution was not claimed.
  - Hover is absent from the parked axe scan — real browser checks verified the requested default/hover colors and unchanged geometry.
  - Dark mode is absent from the parked axe scan — real browser checks exercised both color schemes with identical button colors and geometry.
  - The other changed surfaces lack individual runtime scans — all opaque sites share the measured token, the exact 18-site mutation is checked, and representative visual confirmation is the requested acceptance surface.
  - The conditional Events refresh has no axe scenario — the intent specifically requests the missed empty-state scan; source inventory covers this later same-root-cause site.
  - No contrast calculator was committed — measurement used the locked Tailwind v4 OKLCH values and the built UI exposed those exact computed values.
  - Rounded hex ratios differ slightly — the recorded ratios use full OKLCH-derived channels; both rounded and full calculations exceed 4.5:1.
  - Manual results were not yet in the spec during review — spec-only review findings are dismissed, and this final result now records them.
  - No centralized token was added — the explicit site inventory makes the site-by-site utility migration the strongest intent reading, and these consumers share no app-owned primary token.
  - Two non-button surfaces were changed — the stronger exact-inventory reading explicitly requires all measured sites across nine files.
  - Permanent evidence is narrower than the app-wide outcome — shared opaque-token evidence plus real light/dark UI checks cover the requested result; the image-dependent badge is separately deferred.
  - Parked coverage is prospective — that is the requested scaffold state, not an implementation defect.

### Follow-up review recommendation

`false`. This pass patched high 0, medium 0, low 1; score = `3 × 0 + 1 × 1 = 1`, below the threshold of 5.

### Verification performed

- Tailwind v4 palette measurement: `pink-500` resolves to `#f6339a` at 3.583:1 against white; `pink-600` resolves to `#e60076` at 4.544:1; `pink-700` resolves to `#c6005c` at 5.894:1.
- Root-cause source scan: zero remaining `bg-pink-500`/`text-white` matches; the baseline diff contains exactly 18 `bg-pink-600` replacement lines.
- `npm run lint`: passed with 0 errors and three unchanged Fast Refresh warnings in `EventCountdown.tsx`.
- `npm run typecheck`: emitted exactly the six documented nested-worktree `TS2883` diagnostics at unchanged `tests/support/merged-fixtures.ts:53`, with zero additional diagnostics; DW-30 owns that fixture repair.
- `npx tsc -p tsconfig.app.json --noEmit`: passed.
- `fnox exec -- npm run build`: passed and produced the secret-injected production/PWA build.
- Parked scaffold validation: focused ESLint passed, `git diff --check` passed, and four actual `test.skip` cases are present. Direct Playwright discovery correctly finds no file because `_bmad-output` is outside configured projects.
- Real browser inspection against local Supabase: `events-settings-add`, `events-settings-empty-add`, and `events-form-submit` computed to `oklch(0.592 0.249 0.584)` with white text by default and `oklch(0.525 0.223 3.958)` on hover in both light and dark mode. Their dimensions remained `126.5625 × 64`, `205.109375 × 40`, and `193 × 40` pixels respectively; the form dialog settled to opacity 1.

### Residual risks

- The deferred own-photo badge remains image-dependent because of its existing `/90` opacity.
- The four Events axe scenarios remain parked rather than continuous CI inputs, as requested.
- The repository-wide composite typecheck remains nonzero only for the documented nested-worktree fixture diagnostics owned by DW-30; the changed application project is clean.
