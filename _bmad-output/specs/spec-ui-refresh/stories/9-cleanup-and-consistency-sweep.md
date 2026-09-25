---
title: 'Cleanup and consistency sweep'
type: 'chore'
created: '2026-09-22'
status: 'done'
baseline_revision: '1ed1444e53fb05453f0ae35fb1ac13a9d3c22f58'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Stories 1-8 moved every screen onto the style kit, but the old styling is still shipped: the Dancing Script font import, the pre-kit `index.css` classes (pink gradients, `bg-white/80` glass, pink scrollbars that stay pink in dark mode), the `sunset`/`coral`/`ocean`/`lavender` Tailwind scales and an unused component. Nothing yet proves the Success signal (the `src/components/` grep and the both-theme screenshots) holds, or keeps it holding.

**Approach:** Delete what nothing references, theme the one remaining global surface (scrollbars) on kit tokens, then lock the Success signal in with a static grep test and an E2E sweep that screenshots every screen at 390×844 in both themes and asserts no light surface in dark.

## Boundaries & Constraints

**Always:** Delete a file or class only after a repo-wide grep (src, tests, index.html, scripts) shows no importer or class use; a comment-only mention is updated, not left dangling. Leftover hex/gradient hits are reported by file:line in the Auto Run Result, never silently excluded: the only exclusion is `AdminPanel/` (SPEC Non-goals: not restyled), and it is pinned by exact count so any change to it fails loudly. E2E imports from `tests/support/merged-fixtures.ts`.

**Never:** No restyle of AdminPanel. No change to `src/utils/themes.ts`/`applyTheme()` (settings data, outside components). No removal of used classes (`.animate-heart` + `@keyframes heartBeat`, `.safe-top`) or of the `rose` scale (AdminPanel uses `rose-50`/`rose-600`). No removal of the unused Tailwind `animation`/`keyframes` entries or `safe-bottom` (not colour, not listed). No deleting `src/hooks/usePhotos.ts` (a hook, not a component). No edits under `tests/e2e-archive/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Grep clean | `src/components/**` minus `__tests__` and `AdminPanel/` | 0 hits for `#[0-9a-fA-F]{3,6}\b`, `coral-`, `bg-gradient`/`bg-linear`, `\b(from|via|to)-<colour>-<shade>`, `font-cursive` | test lists each offending file:line |
| AdminPanel pinned | `src/components/AdminPanel/**` | exactly the 5 gradient lines found today (AdminPanel.tsx:92,103,149; CreateMessageForm.tsx:237; EditMessageForm.tsx:252) | count mismatch fails with a message to update the pin |
| Dark sweep | each screen, `colorScheme: 'dark'`, 390×844 | body ground `rgb(11, 14, 20)`, no in-viewport visible element with an opaque (alpha ≥ .5) background of relative luminance > .4; no computed font-family contains "Dancing Script" | failure names the element's tag/testid/class and colour |

</intent-contract>

## Code Map

- `src/index.css:1` -- Google Fonts import; drop `family=Dancing+Script:wght@400;500;600;700&`, keep Inter, Playfair, Lora.
- `src/index.css:100-117` -- base scrollbar: raw `#fdf2f8` track / `#f9a8d4` thumb, light-only. Track -> `var(--kit-page)`; thumb -> a kit-derived pink (e.g. `color-mix(in srgb, var(--kit-fill) 40%, transparent)`), so no hex remains outside the `--kit-*` definitions.
- `src/index.css:120-209` -- remove (0 class uses, verified by token grep over src/tests/index.html): `.card`, `.card-hover`, `.btn-primary`, `.btn-secondary`, `.btn-icon`, `.input`, `.text-gradient`, `.floating-hearts` (+ its `@keyframes float` at :233), `.scrollbar-thin`, `.scrollbar-thumb-pink-300`, `.scrollbar-track-pink-50`, `.glass`, `.bg-sunset/.bg-ocean/.bg-lavender/.bg-rose`, and the trailing `@media (hover:none)` block that only targets the btn classes. KEEP `.animate-heart` (DailyMessage.tsx:322), `@keyframes heartBeat`, `--dock-clearance`, `.safe-top` (AppNavigation.tsx:76), `.safe-bottom`.
- `tailwind.config.js:7-58` -- delete `sunset`, `coral`, `ocean`, `lavender` scales (only users: `whiteOnColorContrast.test.ts:315-318`); keep `rose`. `:75` delete `cursive: ['Dancing Script', 'cursive']` (0 `font-cursive` uses in src).
- `tests/unit/a11y/whiteOnColorContrast.test.ts:309-319` -- "reads the project's own palette" asserts coral/sunset/ocean; re-point it at `readProjectPalette()` returning `rose-600` from the config (#e11d48), and update the `:112-120` doc comment that names coral/sunset as the project palette.
- `src/components/photos/PhotoUploader.tsx` -- 482 lines, 21 palette-shade classes, 0 importers (`git grep PhotoUploader` hits only itself and a comment); delete the file (its folder then empties).
- `tests/unit/stores/loaderIdentityGuards.test.ts:1150-1153` -- comment says `usePhotos`' only consumer is PhotoUploader "which nothing imports"; reword to say it has no consumer.
- `tests/e2e/navigation/kit-chrome.spec.ts` -- pattern for `emulateMedia({ colorScheme })`, ground colours and waiting for `applyTheme()`; `tests/e2e/auth/login-kit.spec.ts` -- `test.use({ authSessionEnabled: false })` for signed-out Sign in.
- `tests/support/helpers/navigation.ts` -- `navigateTo(view)` clicks `nav-${view}`.
- Palette/hex/gradient scan today (verified): 0 hits in `src/components` outside `AdminPanel/` and `photos/PhotoUploader.tsx`; no `coral-`, no `font-cursive`, no hex.

## Tasks & Acceptance

**Execution:**
- [x] `src/index.css` -- drop Dancing Script from the import; theme scrollbars on kit variables; remove the unused classes and keyframe listed in Code Map -- CAP-1/CAP-2/CAP-10 cleanup
- [x] `tailwind.config.js` -- remove the four unused scales and the `cursive` family -- unused palette
- [x] `tests/unit/a11y/whiteOnColorContrast.test.ts` -- re-point the project-palette assertion at `rose` -- keeps the guard proving the config is read
- [x] `src/components/photos/PhotoUploader.tsx` -- delete after re-grepping importers; `loaderIdentityGuards.test.ts` comment -- unused component
- [x] `tests/unit/config/styleKitSweep.test.ts` -- new: the grep of the I/O matrix over `src/components` (`.ts`/`.tsx`/`.css`, `__tests__` skipped) with the AdminPanel pin; plus `src/index.css` has no `Dancing` and `tailwind.config.js` has no `sunset|coral|ocean|lavender|cursive` -- Success signal, durable
- [x] `tests/e2e/navigation/theme-sweep.spec.ts` -- new [P1]: for home, mood, notes, photos, partner, settings and signed-out Sign in, in light and dark at 390×844: attach a full-page screenshot (`testInfo.attach`), assert the ground colour; in dark also the no-light-surface and no-Dancing-Script checks of the I/O matrix -- CAP-2 at the rendered surface

**Acceptance Criteria:**
- Given the built app, when fonts load, then no request or `@import` names Dancing Script.
- Given `src/index.css` and `tailwind.config.js`, when searched, then none of the removed classes, scales or `cursive` family remain and the kept ones still resolve (typecheck, lint, unit, and `fnox exec -- npm run build` green).
- Given every screen at 390×844, when screenshotted in light and dark, then 14 screenshots are attached to the E2E report and dark shows no light surface or pink ground.

## Design Notes

"No light surface" is measured, not eyeballed: luminance > .4 catches white, `page`/`card2` light values and pale pinks while passing kit dark surfaces (< .02), `fill` #db2777 (~.2) and black scrims. Skip `<img>`/`<video>`/`<canvas>` and elements with `opacity`/`visibility` hiding them. Photos may render the empty state on the test account; either state is a valid screen.

## Verification

**Commands:**
- `npx vitest run tests/unit/config/styleKitSweep.test.ts tests/unit/a11y/whiteOnColorContrast.test.ts tests/unit/stores/loaderIdentityGuards.test.ts` -- expected: pass
- `npm run typecheck && npm run lint && npm run test:unit` -- expected: pass
- `fnox exec -- npm run build` -- expected: exit 0
- `npx playwright test tests/e2e/navigation/theme-sweep.spec.ts tests/e2e/navigation/kit-chrome.spec.ts --project=chromium` with `supabase start` running -- expected: pass, 14 screenshots attached

## Spec Change Log

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 36 findings — high 0, medium 2, low 25, false 9, maybe-false 0 (17 patch rows in 8 root-cause entries, 19 rejected)
- findings:
  - `[low]` `[patch]` (blind) styleKitSweep misses solid palette shades and indigo — real: only gradient stops were matched; CAP-1/Constraints forbid palette shades. Fix: one palette-shade rule over every colour prefix.
  - `[low]` `[patch]` (blind) hex rule misses 8-digit hex; misses rgb()/oklch() literals; flags `#add` in text — 8-digit real (fixed with `{3,8}`); colour functions: 0 in src/components, not a regression path worth a rule; `#add` false-positive has no occurrence and would fail loudly.
  - `[low]` `[reject]` (blind) static sweep scans only src/components — the SPEC Success signal defines the grep over src/components; App.tsx is outside the stated signal.
  - `[low]` `[reject]` (blind) findLightSurfaces ignores background-image and pseudo-elements — real but gradients in components are already banned by the static sweep; parsing images/pseudos adds branches for an unlikely case.
  - `[low]` `[reject]` (blind) "no pink ground" checked only on body — a full-screen `bg-fill` view root is unlikely and would need a new per-view check.
  - `[medium]` `[patch]` (blind) dark check stops at the viewport while the screenshot is full-page — real: below-fold cards on Home/Settings unmeasured. Fix: in-viewport filter dropped.
  - `[low]` `[reject]` (blind) text colour never checked — outside the CAP-2 surface claim; adding contrast checks is new scope, and kitSurfaces.test.tsx plus the per-screen kit specs cover text tokens.
  - `[low]` `[reject]` (blind) sweep doesn't open dialogs/splash — covered by kitSurfaces.test.tsx (story 8) and the per-screen kit specs; driving every dialog is more than a direct fix.
  - `[low]` `[patch]` (blind) contrast palette test no longer proves the merged palette uses project values — real. Fix: readPalette() vs readProjectPalette() equality on rose-600.
  - `[low]` `[patch]` (blind) AdminPanel pin counts lines, not what they contain — real (swap gradient for hex stays green). Fix: pin per file per rule.
  - `[low]` `[patch]` (blind) Dancing guard ignores index.html and requests — real for index.html (fixed: unit assertion); request watching dropped, index.html + index.css are the only font sources.
  - `[low]` `[reject]` (blind) PAGE_GROUND/poll duplicated from kit-chrome.spec.ts — the same per-spec constants idiom as login-kit.spec.ts; no named divergence.
  - `[low]` `[patch]` (edge) 8-digit hex — same root as the hex row; fixed there.
  - `[low]` `[patch]` (edge) solid palette/colour functions — same root as the palette row; fixed there.
  - `[low]` `[patch]` (edge) bg-radial/bg-conic/*-gradient( missed — real regex gap. Fix: gradient rule widened.
  - `[false]` `[reject]` (edge) `#add`/`#123` false positives — no such text exists in src/components (sweep passes); a hit would fail loudly and name the line.
  - `[low]` `[reject]` (edge) background-image/pseudo light surfaces — same as the blind row; rejected there.
  - `[false]` `[reject]` (edge) occluded/clipped elements give false failures — the sweep passed 16/16; no false failure occurs.
  - `[false]` `[reject]` (edge) late-mounting surfaces flake the one-shot read — ready() waits for per-view testids and the run passed; no flake observed.
  - `[false]` `[reject]` (edge) color-mix() unsupported in Safari <16.2 / Chrome <111 (thumb) — Tailwind v4, which the app already ships, requires Safari 16.4+/Chrome 111+, so those browsers are unsupported already.
  - `[false]` `[reject]` (edge) color-mix() unsupported (scrollbar-color) — same refutation.
  - `[low]` `[reject]` (edge) 12×12px floor contradicts the matrix's literal wording — real, but the dot is the kit `good` token used exactly as design-tokens.md prescribes ("online / connected dot"); the only fix is to edit this build's spec.
  - `[low]` `[patch]` (verification-gap) themed scrollbar unverified — pre-verified. Fix: computed scrollbar-color track asserted per theme.
  - `[low]` `[patch]` (intent) grep narrower than the Success signal (`from-fill` etc.) — same root as the pattern rows; fixed there (kit-token gradients remain caught by the gradient rule when written as bg-gradient/bg-linear).
  - `[low]` `[patch]` (intent) CAP-1 indigo/palette shades unguarded — same root as the palette row.
  - `[false]` `[reject]` (intent) leftovers reported only in a code comment — the Auto Run Result below lists them by file:line.
  - `[low]` `[patch]` (intent) pin counts lines — same as the blind pin row.
  - `[low]` `[patch]` (intent) hex outside src/components unreported (themes.ts, settingsSlice.ts:129) — reported in the Auto Run Result; no code change (outside the Success grep and a Never).
  - `[low]` `[reject]` (intent) CAP-2 samples only default screens — same as the dialogs row.
  - `[medium]` `[patch]` (intent) dark scan viewport-only — same as the blind viewport row.
  - `[low]` `[reject]` (intent) 12px floor — same as the edge floor row.
  - `[low]` `[patch]` (intent) scrollbar and index.css hex unguarded — scrollbar fixed with the verification-gap row; index.css hex: unit assertion that every hex sits on a `--kit-*` line.
  - `[false]` `[reject]` (intent) light mode checks only the ground — light is compared by a human against the artboards; the spec's matrix defines the automated checks for dark only.
  - `[false]` `[reject]` (intent) mockup comparison not automated — "recognisably its approved artboard" is a human judgement; the 14 screenshots are attached for it.
  - `[false]` `[reject]` (intent) CAP-1 vs Non-goals on AdminPanel — the SPEC Non-goals exclude AdminPanel; the hits are pinned and reported, not silently whitelisted.
  - `[low]` `[patch]` (intent) Dancing check runs only in dark — real. Fix: runs in both themes.

## Auto Run Result

Status: done

**Summary:** Removed the leftover pre-kit styling and locked the UI refresh's Success signal in with tests. Dancing Script import and `cursive` family gone; 17 unused `index.css` classes, `@keyframes float` and the btn-only media block removed; scrollbars now themed on kit variables (were pink in dark); `sunset`/`coral`/`ocean`/`lavender` scales removed (`rose` kept for AdminPanel); unused `PhotoUploader.tsx` deleted (grep: no importers, only a test comment, now reworded).

**Files changed:**
- `src/index.css` -- font import, kit-token scrollbars, unused classes/keyframe removed
- `tailwind.config.js` -- four unused scales and `cursive` removed
- `src/components/photos/PhotoUploader.tsx` -- deleted (unreferenced)
- `tests/unit/config/styleKitSweep.test.ts` -- new: Success-signal grep (hex 3-8, palette shades, gradients, `font-cursive`) over `src/components`, AdminPanel pinned per file per rule, no Dancing in index.css/index.html, index.css hex only on `--kit-*` lines, removed scales stay out
- `tests/e2e/navigation/theme-sweep.spec.ts` -- new [P1]: 7 screens × 2 themes at 390×844, 14 full-page screenshots, ground + scrollbar track + no Dancing Script in both, whole-page no-light-surface check in dark
- `tests/unit/a11y/whiteOnColorContrast.test.ts` -- project-palette test re-pointed at `rose-600`, merged-palette equality added
- `tests/unit/stores/loaderIdentityGuards.test.ts` -- comment only

**Leftover hex/gradient (reported, not fixed):**
- `src/components/AdminPanel/` (SPEC Non-goal, pinned by exact count): gradients at `AdminPanel.tsx:92,103,149`, `CreateMessageForm.tsx:237`, `EditMessageForm.tsx:252`; plus 96 palette-shade lines across AdminPanel.tsx 9, CreateMessageForm.tsx 23, DeleteConfirmDialog.tsx 11, EditMessageForm.tsx 29, MessageList.tsx 15, MessageRow.tsx 9.
- Outside `src/components` (not in the Success grep, not changed): `src/utils/themes.ts` raw hex + `linear-gradient` strings written by `applyTheme()` as CSS variables (the kit's `@theme inline` keeps them from reaching kit utilities); `src/stores/slices/settingsSlice.ts:129` raw hex accent default.
- Zero hits anywhere else in `src/components`.

**Review:** 36 findings (high 0, medium 2, low 25, false 9). 8 patch entries applied (1 medium: dark scan was viewport-only; 7 low: sweep regex gaps, pin granularity, index.html/index.css guards, merged-palette assertion, scrollbar check, Dancing check in both themes). 0 deferred. 19 rejected — each reason is in the triage log (notably: the ≤12px dot floor stays because the kit `good` token is prescribed for the connected dot; dialogs/splash are covered by `kitSurfaces.test.tsx` and the per-screen kit specs; color-mix() is supported by every browser Tailwind v4 already requires).

**Follow-up review recommended:** false — patched: high 0, medium 1, low 7.

**Verification:** `npm run typecheck` 0; `npm run lint` 0; `fnox exec -- npm run build` 0 (built CSS has no Dancing Script); `npx vitest run` 116 files / 2123 tests passed (with a temporary copy of `node_modules/tailwindcss/theme.css`, removed after — this worktree has no own `node_modules`, so without it the 5 palette-reading cases in `whiteOnColorContrast` fail on ENOENT); `npx playwright test tests/e2e/navigation/ --project=chromium` 27 passed against local Supabase. Each new guard was red-checked by reintroducing its defect.

**Residual risks:** Notes and Partner are swept in whatever partner state the pooled test account has. Light theme is checked automatically only for ground, scrollbar and font; artboard likeness is a human look at the attached screenshots. `src/hooks/usePhotos.ts` now has no consumer (kept; a hook, not a component).
