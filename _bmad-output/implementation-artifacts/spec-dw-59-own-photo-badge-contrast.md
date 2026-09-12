---
title: 'DW-59: Own-photo badge contrast'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: '172f1b5d42381f5c9f27def65b6488b305ce769e'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The own-photo badge uses `bg-pink-600/90`, letting bright photo pixels reduce contrast with its small white “You” label to approximately 4.269:1 over white. DW-59 requires at least 4.5:1 regardless of the photo underneath.

**Approach:** Use the existing opaque Tailwind pink palette for this badge and verify its rendered contrast over bright imagery in light and dark mode. Preserve the label, layout, and interaction behavior.

## Boundaries & Constraints

**Always:** Keep the “You” label, white text, icon, sizing, spacing, badge placement, test IDs, thumbnail behavior, caption overlay, pointer selection, and Enter/Space selection unchanged. Use the installed Tailwind palette and rendered styles when verifying contrast.

**Never:** Edit the deferred-work ledger; the orchestrator records resolution. Change the partner badge, unrelated pink surfaces, theme configuration, data services, generated files, or archived tests. Introduce hard-coded production colors or a new styling abstraction for this localized fix.

</intent-contract>

## Code Map

- `src/components/PhotoGallery/PhotoGridItem.tsx:100` — the `photo.isOwn` branch uses `bg-pink-600/90 text-white`; remove its background transparency. The partner branch uses blue and is outside this bundle.
- `src/components/PhotoGallery/PhotoGridItem.tsx:23` — the real component accepts a `PhotoWithUrls` and selection callback. Its type-only service import permits an isolated browser render without account or database setup. Image loading uses IntersectionObserver; wait for the bright image to load before measuring.
- `src/components/PhotoGallery/PhotoGridItem.tsx:55` — click, Enter, and Space share `handleClick` and pass `photo.id` to the callback. Badge label and icon are at lines 104–105.
- `src/index.css:3`, `tailwind.config.js` — real stylesheet imports Tailwind; app theme extensions do not override pink. Read-only styling inputs for browser verification.
- `package-lock.json`, installed `node_modules/tailwindcss/theme.css` — read-only palette source; previous DW-28 evidence records pink-600 as `oklch(59.2% 0.249 0.584)`, approximately 4.544:1 with white when opaque. Re-measure from this checkout.
- `tests/e2e/photos/photo-gallery.spec.ts` — existing gallery coverage uses authenticated fixtures and mocked photos; no focused contrast check exists. A temporary browser harness can exercise the actual component and CSS without expanding the permanent suite for a one-token fix.
- `_bmad-output/implementation-artifacts/spec-dw-28-pink-primary-button-contrast.md` — historical context for the opacity defect; read-only.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/PhotoGallery/PhotoGridItem.tsx` — replace the own-photo badge's `bg-pink-600/90` with opaque `bg-pink-600`; preserve all other markup and behavior.
- [x] `_bmad-output/implementation-artifacts/spec-dw-59-own-photo-badge-contrast.md` — record verification using the actual component and stylesheet over a loaded bright image, including both themes, contrast, layout, labels, and selection behavior. Keep temporary verification harness files out of the final source diff.

**Acceptance Criteria:**
- Given an own-photo thumbnail with bright white imagery in light or dark mode, when its loaded badge is rendered, then the “You” label has white text on an opaque existing pink background with measured contrast of at least 4.5:1 in each mode.
- Given the same photo grid item before and after the fix, when its badge is inspected, then its label, icon, dimensions, spacing, and top-right placement remain unchanged, and the partner badge remains unchanged.
- Given an own-photo item with its image loaded, when the user clicks it or selects it with Enter or Space, then each action calls the existing selection callback once with that photo's ID; the caption overlay and image behavior remain unchanged.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 7 findings — high 0, medium 0, low 6, false 1, maybe-false 0
- All four review layers completed. The edge-case hunter returned no findings. The fourth reviewer started when a slot became available under the platform's three-child concurrency limit; triage began after all results arrived.
- findings:
  - `[low]` `[reject]` Blind hunter: browser version, viewport, and device scale factor are absent from the verification prose — this is a reporting improvement rather than a demonstrated rendering defect. Its proposed fix edits this build's spec, which the workflow explicitly rejects.
  - `[low]` `[reject]` Blind hunter: the spec omits calculation code and screenshot sampling details — the retained temporary measurement script uses browser sRGB colors and WCAG relative luminance, and the parent independently read its assertions and output. The suggested spec-only edit is rejected by the workflow.
  - `[low]` `[reject]` Blind hunter: screenshots have no artifact links in the spec — the screenshots were retained in the system temporary directory and inspected by both agents. The suggested fix only changes this spec and is rejected by the workflow.
  - `[low]` `[reject]` Blind hunter: removing the harness leaves no reconstruction recipe in the spec — the final diff deliberately omits temporary verification infrastructure for the localized utility change. The proposed fix edits this spec and is rejected by the workflow.
  - `[low]` `[reject]` Verification gap: existing gallery tests would not catch a future return of `/90` — the filed regression gap is valid and pre-existing, but there is no remaining current contrast defect. An accidental reversal of this isolated utility is unlikely during everyday use, and a permanent browser harness adds complexity beyond a direct correction. The low finding is rejected under the workflow's proportionality rule; current rendered acceptance was verified.
  - `[false]` `[reject]` Intent alignment: isolated component verification differs from full gallery navigation and production image loading — it does not demonstrate an unmet requirement. The actual badge and stylesheet were rendered; opaque background alpha removes dependence on image pixels. `PhotoGallery.tsx:272` mounts this component without an opacity override, and its unchanged selection callback receives exactly one call per tested action. The supplied intent does not request new navigation or storage coverage.
  - `[low]` `[reject]` Intent alignment: executable checks and screenshots are absent from the committed diff — this accurately limits repeatability from the diff alone, but the parent inspected the retained measurement scripts, outputs, and screenshot. Permanent test artifacts are not an explicit intent requirement, and adding browser infrastructure is disproportionate to this low-impact change. No present readability or behavior failure was found.

## Verification

**Commands:**
- `npm run lint` — exits successfully; distinguish existing warnings from errors.
- `npm run typecheck` — all referenced TypeScript projects pass; report any existing environment limitation with evidence instead of changing unrelated code.
- `fnox exec -- npm run build` — secret-injected production build succeeds.
- `git diff --check` — no whitespace errors.

**Browser checks:**
- Render the actual `PhotoGridItem` and `src/index.css` with a loaded white image in both light and dark color schemes. Measure resolved foreground/background colors and alpha, verify contrast at least 4.5:1, and compare baseline geometry and labels. Exercise click, Enter, Space, and caption hover. Record results here and inspect a screenshot.

**Results — 2026-09-12:**
- `npm run lint`: passed (exit 0), with three existing `react-refresh/only-export-components` warnings at unchanged `src/components/RelationshipTimers/EventCountdown.tsx:68`, `:91`, and `:132`.
- `npm run typecheck`: passed (exit 0) across all referenced projects, with no diagnostics.
- `fnox exec -- npm run build`: passed (exit 0), including the production application and PWA service worker. The build reports the existing `inlineDynamicImports` deprecation warning.
- `git diff --check`: passed (exit 0).
- Browser verification used the actual current component beside its source from baseline `172f1b5d42381f5c9f27def65b6488b305ce769e`, importing the real `src/index.css` through Vite. Both own-photo and partner variants rendered 240 × 240 white SVG image fixtures. Measurement waited for IntersectionObserver loading, `complete === true`, natural dimensions 240 × 240, image opacity 1, and settled fonts/transitions.
- Installed and locked Tailwind `4.3.3` supplies `--color-pink-600: oklch(59.2% 0.249 0.584)`. In both emulated light and dark color schemes (confirmed with `matchMedia`), the changed badge resolves to `oklch(0.592 0.249 0.584)`, background alpha 1 and element opacity 1, with `rgb(255, 255, 255)` text. Browser sRGB canvas rasterization and independently sampled screenshot pixels both give opaque background `rgb(230, 0, 118)` (`#e60076`): WCAG relative-luminance contrast is **4.53936:1** in each mode. The baseline `/90` background composites to `rgb(232, 26, 132)` over the loaded white image, measuring **4.27515:1**. These ratios use the browser's 8-bit rendered channels, accounting for the small difference from the historical full-precision palette estimates.
- Before/after geometry matches in both modes: own badge 53.78125 × 24 px, top/right offsets 8 px, icon 12 × 12 px, padding 4 px vertically and 8 px horizontally, gap 4 px, font size 12 px, line height 16 px, and font weight 500. The `You` label, complete icon markup, rounded shape, role, tab index, accessible label, and test IDs are preserved. The partner badge's resolved colors, label, icon, geometry (74.296875 × 24 px), and placement match the baseline.
- In each theme, both baseline and changed own-photo items passed pointer click, Enter, and Space checks: each action added exactly one callback with `dw59-own-photo`. Caption hover still transitions opacity from 0 to 1 and retains its text, gradient, and 12 px padding. Loaded image dimensions, `object-fit: cover`, `loading="lazy"`, alt text, and opacity remain unchanged.
- Captured light/dark comparison and hover screenshots outside the repository and visually inspected the default comparison and dark hover state; white imagery, readable labels, matching badge placement, caption overlay, and keyboard focus are visible. The temporary harness and baseline copy were removed from the checkout. No permanent tests, styling configuration, partner styles, or deferred-work ledger entries were changed.

## Auto Run Result

Status: done

### Summary

Made the own-photo badge opaque by replacing `bg-pink-600/90` with `bg-pink-600`. The rendered white label now measures 4.53936:1 over bright imagery in both light and dark mode. Label, geometry, icon, thumbnail loading, caption hover, and pointer/keyboard selection remain unchanged.

### Files changed

- `src/components/PhotoGallery/PhotoGridItem.tsx` — removed transparency from the own-photo badge's pink background.
- `spec-dw-59-own-photo-badge-contrast.md` — recorded the implementation contract, acceptance checks, review triage, and completed result.

### Review findings

- Patches applied: 0 (high 0, medium 0, low 0).
- Items deferred: 0. The orchestrator-owned deferred-work ledger remains untouched.
- Rejected findings: 7, each recorded above. Four blind-hunter suggestions proposed spec-only evidence additions (environment metadata, calculation details, screenshot links, and harness reconstruction). The persistent contrast-test gap was rejected as low and disproportionate for this isolated fix. The component-versus-gallery observation showed no unmet requirement. The missing committed browser artifacts were acknowledged as an evidence limitation without a current product defect.
- Follow-up review recommended: `false`; no review patch was needed and no specific unresolved implementation risk was identified.

### Verification performed

- The parent read the complete staged diff and independently reran lint, full typecheck, the secret-injected production/PWA build, and both working-tree and staged whitespace checks: all passed. Lint retains three existing EventCountdown Fast Refresh warnings; the build retains its existing `inlineDynamicImports` deprecation warning.
- The parent inspected the temporary browser scripts and recorded outputs, confirmed light/dark media selection and 4.53936:1 contrast with alpha 1, and visually inspected the comparison screenshot. Browser logging contains only an unrelated harness favicon 404.
- The real component was compared with the full baseline revision's component over loaded white images, verifying unchanged geometry, labels, icon, partner appearance, lazy image behavior, caption hover, and one callback per click/Enter/Space action in each theme.
- Confirmed the production diff is one utility-token change and the deferred-work ledger has no diff from the baseline.

### Residual risks

There is no permanent contrast regression test; browser verification used temporary harness files and retained system-temporary evidence. A future palette or utility change should remeasure this badge because its measured ratio is only slightly above 4.5:1. No unresolved defect remains in this bundle.
