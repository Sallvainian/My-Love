---
title: 'DW-139/DW-142: badge contrast shade bumps'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
baseline_revision: '9c6e210ab50f6b2da68c34ecb2045cfa8a50071a'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings:
  - multiple-goals
deferred: []
---

<intent-contract>

## Intent

**Problem:** Two remaining one-step Tailwind-palette badges pair small white text with colours below WCAG AA 4.5:1. InteractionHistory's New badge uses `bg-purple-500` (installed `--color-purple-500` oklch(62.7% 0.265 303.9) = #ad46ff, 4.12:1). PhotoGridItem's partner arm uses `bg-blue-500/90` (`--color-blue-500` oklch(62.3% 0.214 259.815) = #2b7fff, 3.76:1 even at full opacity; `/90` over a photo is worse). Both are `text-xs`, so the 3:1 large-text allowance does not apply. Both sit in `KNOWN_BELOW_FLOOR`; that honesty test fails if the classes are fixed without removing the rows.

**Approach:** Move each badge onto the first shade that clears 4.5:1 against white, matching DW-28's pink-600 and DW-134's red-600 precedent: `bg-purple-600` (5.53:1) and opaque `bg-blue-600` (5.26:1). Drop those two `KNOWN_BELOW_FLOOR` rows in the same change so the honesty test stays true.

## Boundaries & Constraints

**Always:** Use the installed Tailwind v4.3.3 palette (`node_modules/tailwindcss/theme.css`), not hard-coded production hex. Keep New/Partner/You labels, `text-white`, `text-xs`, layout, placement, visibility (`!sent && !interaction.viewed` for New; `photo.isOwn` for You vs Partner), test IDs, and interaction/thumbnail behaviour. Make the partner arm opaque the way DW-59 made the own-photo arm opaque. Remove both allowlist rows together with the class edits.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Touch frozen scripture `purple-500` under `src/components/scripture-reading/`. Change the own-photo `bg-pink-600` arm, coral-500, green-500, or the pink-to-rose gradient allowlist. Introduce a theme abstraction or hard-coded replacement hex in production markup.

</intent-contract>

## Code Map

- `src/components/InteractionHistory/InteractionHistory.tsx:183` — New badge: `className="rounded-full bg-purple-500 px-3 py-1 text-xs font-medium text-white"`. Gated at `:182` by `!sent && !interaction.viewed`. Only non-frozen `bg-purple-500` + `text-white` in `src/`.
- `src/components/PhotoGallery/PhotoGridItem.tsx:100` — `photo.isOwn ? 'bg-pink-600 text-white' : 'bg-blue-500/90 text-white'`. Change the second arm only. Own arm, badge chrome (`:97-106`, `data-testid="photo-grid-item-owner-badge"`), click/Enter/Space (`:54-72`) are read-only.
- `tests/unit/a11y/whiteOnColorContrast.test.ts:77-87` — remove the `PhotoGridItem.tsx:blue-500` and `InteractionHistory.tsx:purple-500` `KNOWN_BELOW_FLOOR` entries. Leave coral-500 (`:64-68`, DW-141) and green-500 (`:71-75`, DW-140). Leave `KNOWN_GRADIENT_BELOW_FLOOR` pink-500/rose-500 (`:218-221`, DW-143). `FROZEN` (`:95`) already skips scripture. `:259-260` quotes the live partner arm as the `className={…}` example — update that quote if the arm changes. `:281` documents opacity matching in general; leave it.
- `src/components/scripture-reading/` — frozen purple pairings; read-only.
- `node_modules/tailwindcss/theme.css` (locked 4.3.3), `src/index.css:3-4`, `tailwind.config.js` — read-only palette evidence. Re-measure purple-600 and blue-600 from this checkout after `npm install`.

## Tasks & Acceptance

**Execution:**
- `src/components/InteractionHistory/InteractionHistory.tsx` — replace the New badge's `bg-purple-500` with `bg-purple-600`; keep the rest of the class list and the unviewed-received gate.
- `src/components/PhotoGallery/PhotoGridItem.tsx` — replace the partner arm `bg-blue-500/90 text-white` with opaque `bg-blue-600 text-white`; leave the `bg-pink-600` own arm and all other markup.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — delete the two `KNOWN_BELOW_FLOOR` rows named above so the honesty test still fails when an allowlisted pairing is gone. Keep coral-500, green-500, and the gradient allowlist.

**Acceptance Criteria:**
- Given a received unviewed interaction in Interaction History, when the New badge is shown, then its label remains `New` with white `text-xs` on opaque Tailwind `purple-600`, measured contrast against white is at least 4.5:1 in light and dark mode, and sent or already-viewed rows still omit the badge.
- Given a partner photo thumbnail with bright imagery in light or dark mode, when its loaded owner badge is shown, then the label remains `Partner` with white `text-xs` on opaque Tailwind `blue-600` (no `/90`), measured contrast against white is at least 4.5:1 in each mode, and the own-photo arm remains opaque `bg-pink-600` with label `You`.
- Given `tests/unit/a11y/whiteOnColorContrast.test.ts` after the class edits, when the suite runs, then it passes, those two `KNOWN_BELOW_FLOOR` keys are absent, remaining allowlisted solids and gradient stops still fail as recorded, and frozen scripture `purple-500` is still unscanned.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 14 findings — high 0, medium 0, low 8, false 6, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind hunter: scanner still treats `bg-blue-600/90` as opaque blue-600, so a `/90` revert would pass at ~4.46:1 over white — current partner arm is opaque `bg-blue-600` with measured alpha 1 and 5.25:1. Extending the scanner to composite every opacity modifier is a new guard model, not a direct correction, and an accidental `/90` revert is unlikely in everyday use.
  - `[low]` `[reject]` Blind hunter: nothing pins that the New and Partner badges still exist on purple-600 / blue-600 — the honesty test's job is below-floor pairings, not presence canaries. Deleting those badges is not a contrast regression this bundle was asked to lock; adding presence tests is extra surface.
  - `[false]` `[reject]` Blind hunter: spec is `in-review` with empty triage/verification blocks — that is the workflow state before Finalize; this pass records results here rather than a missing product check.
  - `[false]` `[reject]` Blind hunter: light/dark ACs and “loaded owner badge” wording overstate restyling — `InteractionHistory.tsx:94` is `bg-white` with no `dark:` on the New badge, and `PhotoGridItem.tsx:96-107` always paints the owner badge. Neither is a contrast failure; both schemes measured the same tokens.
  - `[low]` `[reject]` Blind hunter: Code Map still quotes pre-change classes and old line numbers — the only fix is editing this spec, which the workflow rejects.
  - `[low]` `[reject]` Blind hunter: New-badge visibility is untested and the `{/* Viewed Badge */}` comment at `InteractionHistory.tsx:181` names the opposite of `!sent && !interaction.viewed` — the comment is pre-existing and untouched. Browser checks showed New only on unviewed received rows; adding a testid and a component suite is more than a one-token shade bump.
  - `[low]` `[reject]` Verification gap: Partner `/90` can drop below AA without failing the contrast guard — same claim as the first row. The matcher at `whiteOnColorContrast.test.ts:270-275` still documents measuring the opaque bound. Production is opaque; compositing `/90` over white would change every opacity pairing in the tree, not a trivial patch.
  - `[false]` `[reject]` Intent alignment: purple-600 / blue-600 are not pinned to 5.53:1 / 5.26:1 — `whiteOnColorContrast.test.ts:361-374` still measures those `text-white` pairings against the installed palette and fails if they drop below 4.5:1. The bundle named 600 as the first shade that clears, not a new exact-ratio canary.
  - `[low]` `[reject]` Intent alignment: the scanner still ignores opacity and the photograph — grouped with the first verification-gap row; no remaining current `/90` on the partner arm.
  - `[false]` `[reject]` Intent alignment: tests never mention 5.53:1 or 5.26:1 — those figures motivated the shade; AA is 4.5:1, which the scanner already enforces.
  - `[low]` `[reject]` Intent alignment: labels, gates, test IDs, and click/Enter/Space are untested in the committed diff — starting intent is two class tokens and two allowlist rows. Parent browser checks exercised those extras; a permanent harness was explicitly kept out of the source diff.
  - `[false]` `[reject]` Intent alignment: light and dark mode are not in the committed tests — the changed badges have no `dark:` utilities; both schemes resolved the same opaque swatches.
  - `[low]` `[reject]` Intent alignment: resolved FG/BG/alpha over a loaded photo is not in the committed diff — the spec itself says to keep temporary harnesses out. Parent measurement used the real components and `src/index.css`.
  - `[false]` `[reject]` Intent alignment: frozen scripture skip is not newly asserted — `FROZEN` at `whiteOnColorContrast.test.ts:84` is unchanged and scripture has no diff.

## Verification

**Commands:**
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` — expected: pass; no `purple-500` or `blue-500` keys left in `KNOWN_BELOW_FLOOR`.
- `npm run lint` — expected: exit 0; existing EventCountdown Fast Refresh warnings only.
- `npm run typecheck` — expected: exit 0, or only pre-existing diagnostics with evidence.
- `fnox exec -- npm run build` — expected: secret-injected production build exit 0.
- `git diff --check` — expected: no whitespace errors.
- Confirm `_bmad-output/implementation-artifacts/deferred-work.md` has no diff.

**Browser checks:**
- Render the actual New badge and the actual PhotoGridItem partner/own badges with `src/index.css` in both color schemes. Measure resolved foreground, background, and alpha. Confirm ≥4.5:1, opaque partner background, unchanged labels/geometry, and unchanged PhotoGridItem click/Enter/Space selection. Keep temporary harnesses out of the final source diff.

## Auto Run Result

### Summary

Moved the InteractionHistory New badge from `bg-purple-500` to opaque `bg-purple-600`, and the PhotoGridItem partner arm from `bg-blue-500/90` to opaque `bg-blue-600`. Removed those two `KNOWN_BELOW_FLOOR` rows so the honesty test still fails when an allowlisted pairing is gone. Frozen scripture purple, own-photo `bg-pink-600`, coral-500, green-500, the pink-to-rose gradient, and the deferred-work ledger were not changed.

### Files changed

- `src/components/InteractionHistory/InteractionHistory.tsx` — New badge uses `bg-purple-600`; unviewed-received gate unchanged.
- `src/components/PhotoGallery/PhotoGridItem.tsx` — partner arm is opaque `bg-blue-600 text-white`; own arm stays `bg-pink-600 text-white`.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — dropped the `purple-500` and `blue-500` allowlist rows; updated the live `className={…}` example; left the opacity-matcher comment.
- `_bmad-output/implementation-artifacts/spec-dw-139-142-badge-contrast-shades.md` — implementation contract, review triage, and this result.

### Review findings

- Patches applied: 0 (high 0, medium 0, low 0).
- Items deferred: 0.
- Rejected findings: 14, recorded above. Eight low (opacity-blind scanner, presence canaries, stale Code Map, untested New-badge gate, verification-gap `/90` composite, intent-alignment opacity/labels/browser-harness). Six false (empty in-review logs, light/dark restyle wording, unpinned 5.53/5.26 figures, light/dark tests, scripture skip not re-asserted).
- Follow-up review recommended: `false`; no review patch was applied.

### Verification performed

- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts`: 6/6 passed. `KNOWN_BELOW_FLOOR` has no `purple-500` or `blue-500` keys; coral-500, green-500, and the pink/rose gradient allowlist remain.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `fnox exec -- npm run build`: exit 0 (existing `inlineDynamicImports` deprecation warning on the service worker).
- `git diff --check`: clean.
- `_bmad-output/implementation-artifacts/deferred-work.md`: no diff.
- Browser: real `InteractionHistory` and `PhotoGridItem` with `src/index.css`, light and dark (`matchMedia` confirmed). Temporary harness deleted afterward.
  - New: label `New`, `text-xs` / weight 500, white on opaque purple-600 `oklch(0.558 0.288 302.321)` → canvas `rgb(152, 16, 250)` alpha 1, **5.54:1**. Shown on unviewed received; omitted on viewed received and sent.
  - Partner: label `Partner`, opaque `bg-blue-600` (no `/90`) `oklch(0.546 0.245 262.881)` → `rgb(21, 93, 252)` alpha 1, **5.25:1**. Geometry 74.73×24 px, top/right 8 px.
  - Own: label `You`, opaque `bg-pink-600` `oklch(0.592 0.249 0.584)` → `rgb(230, 0, 118)` alpha 1, **4.54:1**. Geometry 53.42×24 px, top/right 8 px.
  - Click, Enter, and Space each selected `own-photo` once per scheme.

### Residual risks

The honesty test still measures the opaque swatch when a `/90` modifier is present. A later revert of only the partner opacity would not fail that suite. Current production classes are opaque. No unresolved contrast defect remains in this bundle.
