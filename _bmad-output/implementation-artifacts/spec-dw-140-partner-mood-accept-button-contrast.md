---
title: 'DW-140: Partner-mood Accept button contrast'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
baseline_revision: '21e4fdf9452656231c15d7f50bff890f6d645ea3'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The partner-mood Accept button pairs `text-white` with `bg-green-500`. Installed `--color-green-500` is oklch(72.3% 0.219 149.579) = #00c950, 2.22:1 against white — below WCAG AA 4.5:1. green-600 is 3.22:1 and still fails; green-700 is 4.94:1 and clears. The pairing is allowlisted in `KNOWN_BELOW_FLOOR`; the honesty test fails if the class is fixed without removing that row.

**Approach:** Darken the Accept ground to `bg-green-700` with `hover:bg-green-800`, keep `text-white`, re-measure against the installed Tailwind palette, and delete the `PartnerMoodView.tsx:green-500` allowlist row so the honesty test stays true.

## Boundaries & Constraints

**Always:** Keep the Accept label, Check icon, `data-testid={`accept-request-${request.id}`}`, `handleAcceptRequest`, layout, spacing, and Decline sibling unchanged. Use the installed Tailwind v4.3.3 palette (`node_modules/tailwindcss/theme.css`), not hard-coded production hex. Re-measure rest and hover against that palette. Remove the green-500 allowlist row in the same change as the class edit.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Touch coral-500 (DW-141), purple/blue badges, the pink-to-rose primary gradient, Decline `bg-gray-500`, the connected-status `bg-green-100 text-green-700` chip, frozen scripture, or Accept/Decline behavior. Do not introduce a theme abstraction or hard-coded replacement hex in production markup.

</intent-contract>

## Code Map

- `src/components/PartnerMoodView/PartnerMoodView.tsx:497` — Accept: `className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-2 font-medium text-white transition-colors hover:bg-green-600"`. Only `bg-green-500` + `text-white` in `src/`. Gated by `receivedRequests.length > 0` at `:475`. Label and icon at `:500-501`. Click at `:496` calls `handleAcceptRequest` (`:310-324`).
- `src/components/PartnerMoodView/PartnerMoodView.tsx:503-510` — Decline sibling: `bg-gray-500 … hover:bg-gray-600`; read-only. Card chrome `:480-482` is `border-blue-200 bg-blue-50`. Use both when judging how green-700 reads next to the surrounding UI.
- `src/components/PartnerMoodView/PartnerMoodView.tsx:543` — connected-status chip `bg-green-100 text-green-700`; different surface, shown only when a partner is connected. Read-only.
- `tests/unit/a11y/whiteOnColorContrast.test.ts:70-75` — delete the `src/components/PartnerMoodView/PartnerMoodView.tsx:green-500` `KNOWN_BELOW_FLOOR` entry. Leave coral-500 (`:64-68`, DW-141). Leave `KNOWN_GRADIENT_BELOW_FLOOR` pink-500/rose-500 (`:207-210`, DW-143). `FROZEN` (`:84`) already skips scripture. Resting-state only: unprefixed `bg-` (`:27-29`, `:267-269`); hover is verified in the browser.
- `node_modules/tailwindcss/theme.css` (locked 4.3.3), `src/index.css:3-4`, `tailwind.config.js` — read-only palette evidence. Project theme does not override green. Re-measure green-700 and green-800 from this checkout after `npm install`.

## Tasks & Acceptance

**Execution:**
- `src/components/PartnerMoodView/PartnerMoodView.tsx` — replace Accept `bg-green-500` with `bg-green-700` and `hover:bg-green-600` with `hover:bg-green-800`; keep the rest of the class list, markup, and click handler.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — delete the `PartnerMoodView.tsx:green-500` `KNOWN_BELOW_FLOOR` row so the honesty test still fails when an allowlisted pairing is gone. Keep coral-500 and the gradient allowlist.

**Acceptance Criteria:**
- Given a received partner request, when the Accept button is shown, then its label remains `Accept` with white text on opaque Tailwind `green-700`, hover uses `green-800`, measured contrast against white is at least 4.5:1 in rest and hover in light and dark mode, and the Check icon, test id, and `handleAcceptRequest` click remain unchanged.
- Given that same received-request card, when Accept sits beside Decline, then Decline stays `bg-gray-500 hover:bg-gray-600`, the card stays `border-blue-200 bg-blue-50`, and Accept remains the clearly positive action without layout or spacing changes.
- Given `tests/unit/a11y/whiteOnColorContrast.test.ts` after the class edits, when the suite runs, then it passes, the `PartnerMoodView.tsx:green-500` key is absent, remaining allowlisted solids (coral-500) and gradient stops still fail as recorded, and frozen scripture is still unscanned.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 18 findings — high 0, medium 0, low 11, false 7, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind hunter: the contrast guard ignores `hover:bg-`, so restoring `hover:bg-green-600` would keep the suite green — current hover is opaque green-800 at 7.13:1 in the browser. The suite's rest-only model is documented at `whiteOnColorContrast.test.ts:26-29` and `:260-261`. Extending it (even file-locally) is a new guard, and an accidental hover-only revert is unlikely in everyday use.
  - `[low]` `[reject]` Blind hunter: the spec body never records a green-800 ratio — the only fix is editing this spec, which the workflow rejects. Parent measurement of installed `--color-green-800: oklch(44.8% 0.119 151.328)` is 7.09:1 / canvas 7.13:1.
  - `[false]` `[reject]` Blind hunter: Accept vs Decline fill luminance is ~1.02:1, so hue is all that is left of “positive” — WCAG 1.4.3 is text-on-ground, not sibling-fill contrast. Screenshots still show green Accept next to gray Decline with distinct labels and icons. The human chose this shade and forbade editing Decline.
  - `[low]` `[reject]` Blind hunter: AC2 never defines “clearly positive action” — the only fix is editing this spec, which the workflow rejects.
  - `[low]` `[reject]` Blind hunter: Problem never says the live pre-change hover was already `hover:bg-green-600` — spec-only edit; rejected.
  - `[false]` `[reject]` Blind hunter: WCAG 1.4.11 vs the blue-50 card is missing from ACs — current green-700 vs `--color-blue-50: oklch(97% 0.014 254.604)` is 4.54:1, above the 3:1 non-text floor. No remaining defect; the intent is white-on-green 1.4.3.
  - `[low]` `[reject]` Blind hunter: no `toBeCloseTo` canary for green-700/800 — the rest-state floor check already fails if `bg-green-700` drops below 4.5:1. A named-ratio canary is extra surface the intent did not ask for.
  - `[low]` `[reject]` Blind hunter: `partnerService.check.test.tsx` clicks Accept but does not assert classes — that spec is CHECK-error copy. Pinning utilities there is extra; the honesty test already measures the rest pairing.
  - `[false]` `[reject]` Blind hunter: light/dark ACs are not a second measurement — Accept has no `dark:` class. Parent measured both `colorScheme`s; rest and hover resolved the same opaque green-700 / green-800.
  - `[false]` `[reject]` Blind hunter: Accept has no `focus:ring` so keyboard never reaches `hover:bg-green-800` — `src/index.css:73` `"outline-none"` is only on `.input`. This button does not reset outline. Missing custom ring is pre-existing and not the 1.4.3 defect this bundle was asked to close.
  - `[low]` `[reject]` Blind hunter: Code Map says hover is browser-only while the first AC requires hover ≥4.5:1 — spec-only disagreement; rejected.
  - `[low]` `[reject]` Verification gap: Accept hover can drop below AA without failing the contrast guard — same claim as the first row, pre-verified. Current hover is 7.13:1. A PartnerMoodView-local hover matcher would change the rest-only contract for one control; an accidental `hover:bg-green-600` revert is unlikely.
  - `[low]` `[reject]` Intent alignment: tests never name `bg-green-700` or `hover:bg-green-800` — the honesty test's job is below-floor pairings, not presence canaries. Rest `green-700` is scanned; if it fell below 4.5:1 the suite would fail.
  - `[false]` `[reject]` Intent alignment: no new `toBeCloseTo` for green-700/800 — the decision named 700/800 as the shades that clear, not a new exact-ratio canary. AA is 4.5:1, which the scanner already enforces for rest.
  - `[low]` `[reject]` Intent alignment: `hover:bg-green-800` never enters `findWhiteOnColourPairings()` — grouped with the first verification-gap row; current hover is 7.13:1.
  - `[low]` `[reject]` Intent alignment: surrounding-UI look is not in the committed diff — the spec itself says to keep temporary harnesses out. Parent rendered Accept beside Decline on the blue-50 card; labels, icons, and hue still mark Accept as the positive action.
  - `[false]` `[reject]` Intent alignment: light and dark are not in the committed tests — Accept has no `dark:` utilities; both schemes resolved the same swatches.
  - `[false]` `[reject]` Intent alignment: spec ACs expand to hover/light-dark/surrounding-UI while the code hunks are the class edit plus the honesty row — that is the decision sentence. Browser re-measure is verification, not a source artifact. Coral, purple, blue, the primary gradient, and the deferred-work ledger were not edited.

## Verification

**Commands:**
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` — expected: pass; no `green-500` key left in `KNOWN_BELOW_FLOOR`; coral-500 and the pink/rose gradient allowlist remain.
- `npm run lint` — expected: exit 0; existing EventCountdown Fast Refresh warnings only.
- `npm run typecheck` — expected: exit 0, or only pre-existing diagnostics with evidence.
- `fnox exec -- npm run build` — expected: secret-injected production build exit 0.
- `git diff --check` — expected: no whitespace errors.
- Confirm `_bmad-output/implementation-artifacts/deferred-work.md` has no diff.

**Browser checks:**
- Render the actual Accept (and sibling Decline) markup with `src/index.css` in both color schemes, including hover. Measure resolved foreground, background, and alpha. Confirm ≥4.5:1 on rest and hover, unchanged labels/geometry, and that green-700 still reads as the positive action on the blue-50 card next to gray-500 Decline. Keep temporary harnesses out of the final source diff.

## Auto Run Result

### Summary

Moved the partner-mood Accept button from `bg-green-500 hover:bg-green-600` to opaque `bg-green-700 hover:bg-green-800`, kept `text-white`, and removed the `PartnerMoodView.tsx:green-500` `KNOWN_BELOW_FLOOR` row so the honesty test still fails when an allowlisted pairing is gone. Coral-500, purple/blue badges, the pink-to-rose gradient, Decline, the connected-status chip, and the deferred-work ledger were not changed.

### Files changed

- `src/components/PartnerMoodView/PartnerMoodView.tsx` — Accept uses `bg-green-700` / `hover:bg-green-800`; label, Check icon, test id, and `handleAcceptRequest` unchanged.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — dropped the `green-500` allowlist row; coral-500 and the pink/rose gradient allowlist remain.
- `_bmad-output/implementation-artifacts/spec-dw-140-partner-mood-accept-button-contrast.md` — implementation contract, review triage, and this result.

### Review findings

- Patches applied: 0 (high 0, medium 0, low 0).
- Items deferred: 0.
- Rejected findings: 18, recorded above. Eleven low (hover-blind scanner, unrecorded green-800 ratio, unfalsifiable AC2, Problem omitting pre-change hover, missing green canary, CHECK-test class pin, Code Map vs AC hover, verification-gap hover, unnamed class tokens, hover not scanned, surrounding-UI not in the diff). Seven false (Accept vs Decline luminance, 1.4.11 vs the card, light/dark restyle, missing focus ring, green `toBeCloseTo`, light/dark tests, spec ACs vs mechanical hunks).
- Follow-up review recommended: `false`; no review patch was applied.

### Verification performed

- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts`: 6/6 passed. `KNOWN_BELOW_FLOOR` has no `green-500` key; coral-500 and the pink/rose gradient allowlist remain.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `fnox exec -- npm run build`: exit 0 (existing `inlineDynamicImports` deprecation warning on the service worker).
- `git diff --check`: clean.
- `_bmad-output/implementation-artifacts/deferred-work.md`: no diff.
- Installed Tailwind 4.3.3. `--color-green-700: oklch(52.7% 0.154 150.069)`; `--color-green-800: oklch(44.8% 0.119 151.328)`. Project theme does not override green.
- Browser: Accept and Decline markup with the production stylesheet compiled from `src/index.css`, light and dark (`colorScheme`). Temporary harness kept out of the source diff.
  - Rest: label `Accept`, white on opaque green-700 `oklch(0.527 0.154 150.069)` → canvas `rgb(0, 130, 54)` alpha 1, **4.95:1**. Geometry `display:flex`, gap 4px, padding 8px 12px, 98.42×40 px.
  - Hover: same label on opaque green-800 `oklch(0.448 0.119 151.328)` → `rgb(1, 102, 48)` alpha 1, **7.13:1**.
  - Dark scheme resolved the same tokens (no `dark:` on Accept).
  - Decline stayed gray-500 `oklch(0.551 0.027 264.364)`. Card stayed blue-50 / blue-200 `oklch(0.97 0.014 254.604)` / `oklch(0.882 0.059 254.128)`. Green-700 still reads as the positive action next to gray Decline.

### Residual risks

The honesty test still measures only unprefixed `bg-`. A later revert of only `hover:bg-green-800` to `hover:bg-green-600` would not fail that suite. Current production hover is green-800 at 7.13:1. No unresolved contrast defect remains in this bundle.
