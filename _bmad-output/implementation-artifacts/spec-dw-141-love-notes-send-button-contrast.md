---
title: 'DW-141: Love-notes Send button contrast'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
baseline_revision: '41b84734fb8f5178ed7dab93d9b43391795ac7d3'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      Own-message bubbles still drop below 4.5:1 while isSending applies
      opacity-70.
    evidence: |-
      LoveNoteMessage.tsx:276 already had `${isSending ? 'opacity-70' : ''}`.
      Group-composite of canvas gray-800 (30,41,57) on #FF6B6B at 0.7 over
      LoveNotes bg #FFF5F5 is 2.715:1. Pre-change white on the same stack was
      2.07:1. Rest of the own bubble is 5.286:1. Removing the fade would change
      in-flight send UX this bundle did not restyle.
    location: >-
      src/components/love-notes/LoveNoteMessage.tsx:276
    severity: low
---

<intent-contract>

## Intent

**Problem:** The love-notes Send button pairs `text-white` with `bg-coral-500` (`#ffa07a`, 1.99:1 against white). No coral shade except 900 clears 4.5:1, so a shade bump would abandon the brand ground. The same screen also paints own-message bubbles and the "New message" chip as `bg-[#FF6B6B] text-white` (~2.78:1), which the white-on-named-swatch guard never sees.

**Approach:** Keep `bg-coral-500` (and `hover:bg-coral-600`) on Send; replace `text-white` with one dark Tailwind text token that measures ≥4.5:1 against `#ffa07a` and `#ff7f50`. Apply that same token to the two `#FF6B6B` + `text-white` surfaces, leaving their hex grounds. Delete the `MessageInput.tsx:coral-500` `KNOWN_BELOW_FLOOR` row in the same change.

## Boundaries & Constraints

**Always:** Keep Send's label (`Send` / `Sending...`), `aria-label="Send message"`, disabled/`canSend` logic, layout, spacing, `focus:ring-coral-500`, and `hover:bg-coral-600`. Use one installed Tailwind text token on all three edited surfaces; prefer `text-gray-800` (already on partner bubbles and the Love Notes heading) if it clears 4.5:1 against coral-500, coral-600, `#FF6B6B`, and `#FF5252` after `npm install`; otherwise the next darker installed gray. Re-measure rest and hover in the browser. Remove the coral-500 allowlist row together with the class edits.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Darken or replace `coral-500` / `coral-600`. Convert `#FF6B6B` to `bg-coral-500`. Touch partner `bg-[#E9ECEF] text-gray-800`, icon-only `#FF6B6B` tints, `NetworkStatusIndicator`, the uploading overlay `text-white` on `bg-black/40`, frozen scripture, the pink-to-rose gradient allowlist, send/scroll/remove behaviour, or introduce a theme abstraction or hard-coded replacement hex for the new text colour.

</intent-contract>

## Code Map

- `src/components/love-notes/MessageInput.tsx:269` — Send: `className="bg-coral-500 hover:bg-coral-600 focus:ring-coral-500 disabled:hover:bg-coral-500 min-h-[44px] rounded-lg px-6 py-2 font-medium text-white ..."`. Label at `:271`. Click `:267` `handleSend`. Image-picker and textarea siblings `:230-261` use coral only as `hover:text-` / `focus:ring-`; read-only.
- `src/components/love-notes/LoveNoteMessage.tsx:271-276` — own arm `'rounded-br-md bg-[#FF6B6B] text-white'`; partner arm `'rounded-bl-md bg-[#E9ECEF] text-gray-800'` is read-only. Uploading overlay `:312-316` `text-white` on `bg-black/40` is read-only.
- `src/components/love-notes/MessageList.tsx:389-401` — `showNewMessageIndicator` chip: `bg-[#FF6B6B] … text-white … hover:bg-[#FF5252]`, label `New message`, `data-testid="new-message-indicator"`. Icon-only `text-[#FF6B6B]` at `:151`, `:350`, `:367` is read-only.
- `tests/unit/a11y/whiteOnColorContrast.test.ts:62-70` — delete the `src/components/love-notes/MessageInput.tsx:coral-500` `KNOWN_BELOW_FLOOR` entry. Leave `KNOWN_GRADIENT_BELOW_FLOOR` pink-500/rose-500 (`:200-203`, DW-143). Keep the project-palette canary that `coral-500` still measures ~1.99:1 against white (`:323-326`); that asserts the loader, not the button. Scanner is rest-state `text-white` + named `bg-<colour>-<shade>` only (`:27-31`, `:259-268`); hover and hex grounds are browser-only.
- `tailwind.config.js:20-31` — project `coral-500: '#ffa07a'`, `coral-600: '#ff7f50'`. `src/index.css:4` `@config '../tailwind.config.js'`. Installed gray tokens live in `node_modules/tailwindcss/theme.css` after `npm install`.

## Tasks & Acceptance

**Execution:**
- `src/components/love-notes/MessageInput.tsx` — keep `bg-coral-500` / `hover:bg-coral-600`; replace Send's `text-white` with the chosen dark token; leave the rest of the class list, markup, and `handleSend`.
- `src/components/love-notes/LoveNoteMessage.tsx` — on the own-message arm only, keep `bg-[#FF6B6B]` and replace `text-white` with that same token.
- `src/components/love-notes/MessageList.tsx` — on the new-message chip only, keep `bg-[#FF6B6B]` / `hover:bg-[#FF5252]` and replace `text-white` with that same token.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — delete the `MessageInput.tsx:coral-500` `KNOWN_BELOW_FLOOR` row so the honesty test still fails when an allowlisted pairing is gone. Keep the gradient allowlist and the coral-500 palette canary.

**Acceptance Criteria:**
- Given the love-notes composer, when Send is shown enabled, then its label remains `Send` with dark text on opaque project `coral-500` (`#ffa07a`), hover uses `coral-600` (`#ff7f50`), measured contrast is at least 4.5:1 in rest and hover in light and dark mode, and `aria-label`, `Sending...`, disabled rules, focus ring, and `handleSend` stay unchanged.
- Given an own love note and a partner love note, when both bubbles are shown, then the own bubble keeps `bg-[#FF6B6B]` with the same dark text token at ≥4.5:1, the partner bubble stays `bg-[#E9ECEF] text-gray-800`, and the uploading overlay stays white on `bg-black/40`.
- Given the list is scrolled up with a new message waiting, when the "New message" chip is shown, then it keeps `bg-[#FF6B6B]` and `hover:bg-[#FF5252]`, uses the same dark text token at ≥4.5:1 in rest and hover, and still reads `New message` with `data-testid="new-message-indicator"`.
- Given `tests/unit/a11y/whiteOnColorContrast.test.ts` after the class edits, when the suite runs, then it passes, the `MessageInput.tsx:coral-500` key is absent, remaining gradient stops still fail as recorded, and frozen scripture is still unscanned.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 14 findings — high 0, medium 0, low 9, false 3, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind hunter: hex own-bubble and chip can revert to `text-white` without failing the named-swatch scanner — current production is `text-gray-800` on `#FF6B6B` at 5.286:1. Teaching `findWhiteOnColourPairings` to parse `bg-[#RRGGBB]` is a new guard model, not a direct correction, and an accidental two-literal revert is unlikely in everyday use.
  - `[low]` `[defer]` Blind hunter: own-bubble `opacity-70` while `isSending` composites gray-800 on `#FF6B6B` over `#FFF5F5` to 2.715:1 — pre-existing fade at `LoveNoteMessage.tsx:276`; white on the same stack was 2.07:1. Rest is 5.286:1. Removing the fade would restyle in-flight send UX this bundle did not change.
  - `[false]` `[reject]` Blind hunter: chip hover at ~4.60:1 is too tight so gray-900 should bind all three surfaces — Always prefers `text-gray-800` if it clears 4.5:1 against `#FF5252`. Parent measured chip hover at 4.597:1, which meets the floor.
  - `[low]` `[reject]` Blind hunter: a lighter token such as `text-gray-500` on Send would not fail the rest-state `text-white` scanner — reverting Send to `text-white` still fails the empty allowlist at 1.99:1. A dark-on-colour scanner is a new guard; swapping to gray-500 is unlikely in everyday use.
  - `[low]` `[reject]` Blind hunter: `whiteOnColorContrast.test.ts:125-127` still says the Send button is the worst pairing — that paragraph is why `readProjectPalette` exists (`it was invisible here until this function existed`). Send is still `bg-coral-500`. Rewriting the historical comment is not a product correction.
  - `[false]` `[reject]` Blind hunter: empty `KNOWN_BELOW_FLOOR` makes solid honesty a no-op — the loop still asserts every remaining recorded solid (none). That is the intended end state after the last solid row. Gradient counts are still checked.
  - `[low]` `[reject]` Blind hunter: spec Approach only names `#ffa07a` / `#ff7f50` while Always/AC3 also require `#FF6B6B` / `#FF5252` — the only fix is editing this spec, which the workflow rejects.
  - `[low]` `[reject]` Blind hunter: the diff has no committed gray-800 ratios against the four grounds — the only fix is editing this spec. Parent measured rest and hover in Chromium against compiled `src/index.css`.
  - `[low]` `[defer]` Edge-case hunter: sending own-note text composites below 4.5:1 — same pre-existing `opacity-70` as the second row. Guard snippet was to remove the fade and keep a Sending... span; that restyles in-flight UX.
  - `[low]` `[reject]` Verification gap: hex surfaces can revert to `text-white` without failing verification — same unguarded-hex claim as the first row, pre-verified. Filed disposition was patch (extend the scanner to hex). Extending the matcher is a new guard model; current hex sites are dark text at 5.286:1; an accidental revert is unlikely.
  - `[low]` `[reject]` Intent alignment: remaining tests live at `text-white` + named `bg-<colour>-<shade>`, not at computed gray-on-coral 4.5:1 — the honesty test's job is below-floor white pairings. Parent measured the new pair in the browser. A ratio canary is extra surface the starting intent did not ask for.
  - `[false]` `[reject]` Intent alignment: the diff over-commits relative to R1 and misses R2 — the starting intent required a same-session hex decision. The spec records R3 (keep hex, apply dark text). That is a defensible reading, not a missed arm.
  - `[low]` `[reject]` Intent alignment: spec ACs expand to hover, `#FF5252`, and both colour schemes while tests do not — Send and the chip have no `dark:` utilities; both schemes resolved the same opaque swatches. Hover is outside the rest-only scanner (`whiteOnColorContrast.test.ts:26-29`). Parent measured Send hover 5.871:1 and chip hover 4.597:1.
  - `[low]` `[reject]` Intent alignment: deleting the allowlist row does not prove the replacement colour clears 4.5:1 against `#ffa07a` — grouped with the tests-don't-measure-the-new-pair row. Allowlist removal is the one test action the starting intent named; browser measurement covers the ratio.

## Design Notes

Session decision on the hex pairings: join the dark-text treatment, stay hex. They are the same 1.4.3 defect on the same screen (~2.78:1 white on `#FF6B6B`); the human already chose dark text over darkening the Send ground. `#FF6B6B` is a different fill from coral-500 (NetworkStatusIndicator names it "Error Coral Red"), so converting bubbles to `bg-coral-500` would restyle the thread. `text-gray-800` is the first candidate because partner bubbles already use it; confirm against installed gray after `npm install`.

## Verification

**Commands:**
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` — expected: pass; no `coral-500` key left in `KNOWN_BELOW_FLOOR`; pink/rose gradient allowlist remains; palette canary still ~1.99:1 for white-on-coral-500.
- `npm run lint` — expected: exit 0; existing EventCountdown Fast Refresh warnings only.
- `npm run typecheck` — expected: exit 0, or only pre-existing diagnostics with evidence.
- `fnox exec -- npm run build` — expected: secret-injected production build exit 0.
- `git diff --check` — expected: no whitespace errors.
- Confirm `_bmad-output/implementation-artifacts/deferred-work.md` has no diff.

**Browser checks:**
- Render the actual Send button, an own bubble, a partner bubble, and the new-message chip with `src/index.css` in both color schemes, including Send hover and chip hover. Measure resolved foreground, background, and alpha. Confirm ≥4.5:1 on every edited rest and hover state, unchanged labels/geometry, and that partner bubbles plus icon-only `#FF6B6B` tints are untouched. Keep temporary harnesses out of the final source diff.

## Auto Run Result

### Summary

Kept brand `coral-500` on the love-notes Send button, replaced `text-white` with installed Tailwind `text-gray-800` on Send, own-message bubbles, and the "New message" chip (hex grounds unchanged), and removed the `MessageInput.tsx:coral-500` `KNOWN_BELOW_FLOOR` row. Partner bubbles, icon-only `#FF6B6B` tints, the uploading overlay, and the deferred-work ledger were not changed.

### Files changed

- `src/components/love-notes/MessageInput.tsx` — Send keeps `bg-coral-500` / `hover:bg-coral-600`; `text-white` → `text-gray-800`.
- `src/components/love-notes/LoveNoteMessage.tsx` — own arm keeps `bg-[#FF6B6B]`; `text-white` → `text-gray-800`.
- `src/components/love-notes/MessageList.tsx` — chip keeps `bg-[#FF6B6B]` / `hover:bg-[#FF5252]`; `text-white` → `text-gray-800`.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — dropped the coral-500 allowlist row; gradient allowlist and the white-on-coral-500 palette canary remain.
- `_bmad-output/implementation-artifacts/spec-dw-141-love-notes-send-button-contrast.md` — implementation contract, review triage, and this result.

### Review findings

- Patches applied: 0 (high 0, medium 0, low 0).
- Items deferred: 1 (low) — sending own-bubble `opacity-70` still composites below 4.5:1.
- Rejected findings: 12, recorded above. Nine low (unguarded hex, lighter-token Send, stale palette-loader comment, spec Approach vs Always, uncommitted ratios, verification-gap hex scanner, tests don't measure the new pair, hover/dark not in tests, allowlist vs proving the new pair). Three false (chip hover already ≥4.5:1, empty allowlist is the intended end state, R3 is a valid hex decision).
- Follow-up review recommended: `false`; no review patch was applied.

### Verification performed

- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts`: 6/6 passed. `KNOWN_BELOW_FLOOR` has no `coral-500` key; pink/rose gradient allowlist remains; palette canary still ~1.99:1 for white-on-coral-500.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `fnox exec -- npm run build`: exit 0 (existing `inlineDynamicImports` deprecation warning on the service worker).
- `git diff --check`: clean.
- `_bmad-output/implementation-artifacts/deferred-work.md`: no diff.
- Installed Tailwind 4.3.3. `--color-gray-800: oklch(27.8% 0.033 256.848)`. Project `coral-500: '#ffa07a'`, `coral-600: '#ff7f50'`.
- Browser: markup with the production stylesheet compiled from `src/index.css`, light and dark (`colorScheme`). Temporary harness kept out of the source diff.
  - Send rest: label `Send`, `aria-label="Send message"`, gray-800 `oklch(0.278 0.033 256.848)` → canvas `rgb(30, 41, 57)` on opaque coral-500 `rgb(255, 160, 122)` alpha 1, **7.378:1**. Height 44px.
  - Send hover: same text on opaque coral-600 `rgb(255, 127, 80)`, **5.871:1**.
  - Own bubble: `bg-[#FF6B6B]` `rgb(255, 107, 107)` with the same text, **5.286:1**.
  - Chip rest: label `New message`, `data-testid="new-message-indicator"`, same pair, **5.286:1**.
  - Chip hover: `hover:bg-[#FF5252]` `rgb(255, 82, 82)`, **4.597:1**.
  - Partner bubble stayed `bg-[#E9ECEF] text-gray-800` at 12.371:1. Icon tint stayed `#FF6B6B`. Overlay stayed white. Dark scheme resolved the same tokens.

### Residual risks

The honesty test still measures only `text-white` on named `bg-<colour>-<shade>`. Hex grounds and hover are browser-only. Tightest edited state is chip hover at 4.597:1. Sending own bubbles still use pre-existing `opacity-70` at 2.715:1 (deferred). No remaining rest-state contrast defect on the three edited surfaces.
