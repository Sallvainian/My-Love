---
title: 'DW-146: Sending... caption contrast'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
baseline_revision: '0dd0aec123f44340db6e4dd0e4234e6b98b01d45'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** The in-flight `Sending...` caption at `LoveNoteMessage.tsx:332` is still `text-xs text-gray-400` over Love Notes `bg-[#FFF5F5]`. Installed `--color-gray-400` oklch(70.7% 0.022 261.325) is 2.433:1 against that ground, below the 4.5:1 AA floor for `text-xs`.

**Approach:** Replace only that caption's gray class with the first installed Tailwind gray token that measures at least 4.5:1 on `#FFF5F5`. Prefer `text-gray-500` (4.521:1); if the browser measure falls short, use `text-gray-600` (7.068:1). Keep the Sending... text, `aria-live="polite"`, and the `isSending && !isImageUploading` gate.

## Boundaries & Constraints

**Always:** Keep the `Sending...` span with `aria-live="polite"`, gated `isSending && !isImageUploading`. Keep `mt-1 px-1 text-xs`. Use an installed Tailwind gray token (not a hard-coded hex). Re-measure the caption over `#FFF5F5` in the browser after `npm install`; if gray-500 is below 4.5:1, use gray-600. Keep own fill `bg-[#FF6B6B] text-gray-800`, partner `bg-[#E9ECEF] text-gray-800`, thread `bg-[#FFF5F5]`.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Add a fade, spinner, or bubble colour-shift. Restyle partner bubbles, Send, the uploading overlay, or the thread ground. Touch other `text-gray-400` sites in this file (remove button `:261`, image loader `:283`) or the sender/timestamp `text-gray-500` at `:239`. Convert `#FFF5F5` to a named token. Add a hex matcher to `whiteOnColorContrast.test.ts`. Touch frozen scripture.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Own sending | `isOwnMessage` true, `message.sending` true, not uploading | `Sending...` with `aria-live="polite"` and the chosen gray class; ≥4.5:1 on `#FFF5F5`; bubble unchanged | No error expected |
| Own rest | `sending` false | No `Sending...` caption | No error expected |
| Image uploading | `sending` true and `imageUploading` true | `Uploading...` overlay; no `Sending...` caption | No error expected |
| Partner | `isOwnMessage` false | `bg-[#E9ECEF] text-gray-800`; no caption restyle | No error expected |

</intent-contract>

## Code Map

- `src/components/love-notes/LoveNoteMessage.tsx:332` — the only production edit. Today: `<span className="mt-1 px-1 text-xs text-gray-400" aria-live="polite">Sending...</span>`. Gated at `:331` `isSending && !isImageUploading`. Caption sits outside the bubble (`:270-328`) so contrast is vs thread `#FFF5F5`, not vs `#FF6B6B`.
- `src/components/love-notes/LoveNoteMessage.tsx:96` — `isSending = message.sending ?? false`; keep. `:98` `isImageUploading`. `:273-276` own/partner fill/text and error border — read-only. `:311-317` uploading overlay `text-white` on `bg-black/40` — read-only. `:221-224` `motion.div` entrance opacity — read-only. `:239` sender/timestamp already `text-xs text-gray-500` — reuse pointer for gray-500, not an edit. `:261` remove button `text-gray-400` — read-only. `:283` loader `text-gray-400` — read-only.
- `src/components/love-notes/LoveNotes.tsx:126` — thread ground `bg-[#FFF5F5]`; compositing backdrop. Read-only.
- `src/components/love-notes/MessageInput.tsx:264-272` — Send `bg-coral-500` / `text-gray-800`; label `Send`/`Sending...`. Read-only.
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx:277-307` — already asserts `Sending...`, `aria-live="polite"`, and that uploading hides it. Extend the sending case to pin the chosen gray class; do not add a hex scanner.
- `tests/unit/a11y/whiteOnColorContrast.test.ts:26-31` — rest-state `text-white` + named `bg-<colour>-<shade>` only. Dark-on-hex caption is outside it. Do not extend.
- `_bmad-output/implementation-artifacts/spec-dw-144-love-notes-sending-opacity.md` — origin of this deferral. Read-only.
- `node_modules/tailwindcss/theme.css` — installed gray tokens after `npm install`. Read-only.

## Tasks & Acceptance

**Execution:**
- `src/components/love-notes/LoveNoteMessage.tsx` — on the `Sending...` span at `:332` only, replace `text-gray-400` with the first installed gray token that measures ≥4.5:1 on `#FFF5F5` (`text-gray-500` first; `text-gray-600` if the browser measure falls short). Leave `mt-1 px-1 text-xs`, `aria-live="polite"`, the `:331` gate, bubble fill/text, overlay, Send, and thread ground unchanged.
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` — in the sending-indicator case, assert the caption still reads `Sending...` with `aria-live="polite"` and has the chosen gray class (not `text-gray-400`). Keep the uploading case hiding `Sending...`.

**Acceptance Criteria:**
- Given an own love note with `sending` true and not uploading, over Love Notes `#FFF5F5`, when the caption is shown, then it still reads `Sending...` with `aria-live="polite"`, uses `text-xs` plus an installed gray token at ≥4.5:1 in light and dark, and the bubble stays `bg-[#FF6B6B] text-gray-800` with no fade, spinner, or colour-shift.
- Given `sending` false, or `sending` true with `imageUploading` true, when the row is shown, then rest omits `Sending...`, and uploading shows `Uploading...` with no `Sending...`.
- Given a partner bubble, Send, the uploading overlay, and the thread ground, when this change lands, then those surfaces are unchanged.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 15 findings — high 0, medium 0, low 8, false 7, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind hunter: spec requires a browser measure the diff never records — parent measured compiled `src/index.css` in Chromium: caption `text-gray-500` `oklch(0.551 0.027 264.364)` → `rgb(106, 114, 130)` alpha 1 on `#FFF5F5` `rgb(255, 245, 245)` at **4.521:1**. Approach's first token holds; gray-600 is not triggered. A missing figure in git is not a contrast failure.
  - `[low]` `[reject]` Blind hunter: sending test never pins `mt-1 px-1 text-xs` — current span is still `className="mt-1 px-1 text-xs text-gray-500"`. Starting intent was replace only the gray class. Extra three-class pins are extra surface; an accidental drop of those utilities on this one span is unlikely.
  - `[low]` `[reject]` Blind hunter: sending test never asserts the caption sits outside the bubble — the span remains a sibling after the bubble (`LoveNoteMessage.tsx:328-334`). This change only swapped the gray class. Nesting it inside the bubble is not a likely everyday regression; a containment assertion is extra.
  - `[low]` `[reject]` Blind hunter: caption has no fade/opacity guard — current span has no `opacity-*` class; computed opacity is 1. Starting intent forbade adding a fade. A hypothetical `opacity-70` pin is extra; an accidental fade on this caption is unlikely.
  - `[low]` `[reject]` Blind hunter: unit test never mounts `#FFF5F5` / `src/index.css` — spec Execution asked to pin the gray class, not a hex compositor. Parent measured 4.521:1 over `#FFF5F5`. Loading the production stylesheet in this unit file is a new guard model.
  - `[false]` `[reject]` Blind hunter: light/dark AC is vacuous because Love Notes has no dark thread — `src/components/love-notes` has no `dark:` utilities; thread is hardcoded `bg-[#FFF5F5]`. Both schemes resolved the same gray-500 on `#FFF5F5` at 4.521:1. The dark limb holds; it does not ask for a dark restyle.
  - `[low]` `[reject]` Blind hunter: spec still describes the pre-change defect as current — the only fix is editing this spec, which the workflow rejects. Code Map is the pre-change investigation map.
  - `[false]` `[reject]` Blind hunter: partner/overlay/Send/thread “unchanged” rows are untested in this diff — `MessageInput.tsx`, `LoveNotes.tsx`, and overlay `:311-317` are not in the diff. Partner bubble is still asserted at `LoveNoteMessage.test.tsx:99`. Keep-by-omission.
  - `[false]` `[reject]` Blind hunter: frontmatter `warnings: oversized` is unexplained — step-02 required `oversized` when the spec exceeded 1600 tokens. Process flag, not a product defect. Fix would be editing this spec.
  - `[low]` `[reject]` Intent alignment: tests live on class strings, not a measured ratio over `#FFF5F5` — `whiteOnColorContrast.test.ts:26-31` is rest-state `text-white` + named `bg-<colour>-<shade>` only. Starting intent named gray-500 as the first token; tests pin that class. Parent measured 4.521:1. A ratio canary is extra surface the starting intent did not ask for.
  - `[false]` `[reject]` Intent alignment: browser-measure fallback is not evidenced in the diff — parent measured 4.521:1; gray-600 is not needed. Spec Verification is parent-run, not a committed artifact.
  - `[low]` `[reject]` Intent alignment: spec ACs add light-and-dark the starting `intent.md` did not name — the only fix is editing this spec. Both schemes already resolve the same tokens.
  - `[false]` `[reject]` Intent alignment: new assertions cover only the gray class, not the cue keep-list — pre-existing sending case still asserts `Sending...` and `aria-live="polite"` (`LoveNoteMessage.test.tsx:287-288`); uploading still hides it (`:307-308`); rest omits it (`:87`). Those ran in 25/25.
  - `[false]` `[reject]` Intent alignment: added test lines only re-assert the own bubble keep-list — Send, overlay, partner, and thread files have no diff. Same keep-by-omission as the eighth row.
  - `[low]` `[reject]` Intent alignment: the spec file adds surfaces the starting bundle did not name — the only fix is editing this spec. Source satisfies those extras by not touching those lines.

## Verification

**Commands:**
- `npx vitest run src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` — expected: pass; sending caption present with `aria-live="polite"` and the chosen gray class; uploading still hides it.
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` — expected: pass; file undiffed.
- `npm run lint` — expected: exit 0.
- `npm run typecheck` — expected: exit 0, or only pre-existing diagnostics with evidence.
- `fnox exec -- npm run build` — expected: secret-injected production build exit 0.
- `git diff --check` — expected: no whitespace errors.
- Confirm `_bmad-output/implementation-artifacts/deferred-work.md` has no diff.

**Browser checks:**
- Render the actual `LoveNoteMessage` with `src/index.css` for own sending, own rest, partner, and uploading, in both color schemes. Measure resolved foreground, background, and alpha of the `Sending...` caption over `#FFF5F5`. Confirm ≥4.5:1. If gray-500 falls short, switch to gray-600 and re-measure. Keep temporary harnesses out of the final source diff.

## Auto Run Result

### Summary

Replaced the in-flight `Sending...` caption class from `text-gray-400` to installed Tailwind `text-gray-500` so the caption measures 4.521:1 on Love Notes `#FFF5F5`. Kept the Sending... text, `aria-live="polite"`, the `isSending && !isImageUploading` gate, own/partner bubble fills, Send, the uploading overlay, and the thread ground. Did not add a fade, spinner, or bubble colour-shift. Did not edit the deferred-work ledger.

### Files changed

- `src/components/love-notes/LoveNoteMessage.tsx` — `Sending...` span `text-gray-400` → `text-gray-500`; `mt-1 px-1 text-xs`, `aria-live="polite"`, and the `:331` gate unchanged.
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` — sending case pins `text-gray-500` and not `text-gray-400`.
- `_bmad-output/implementation-artifacts/spec-dw-146-sending-caption-contrast.md` — implementation contract, review triage, and this result.

### Review findings

- Patches applied: 0 (high 0, medium 0, low 0).
- Items deferred: 0.
- Rejected findings: 15, recorded above. Eight low (unpinned `mt-1 px-1 text-xs`; caption containment; caption opacity guard; unit test without `#FFF5F5`; Code Map still quotes pre-change classes; tests don't measure 4.521:1; spec light/dark vs `intent.md`; spec extras vs starting bundle). Seven false (browser measure holds at 4.521:1 so gray-600 is unused; no dark restyle needed; keep-list files have no diff; oversized is a process flag; measure is parent-run; cue keep-list already asserted; negative keep-list is keep-by-omission).
- Follow-up review recommended: `false`; no review patch was applied.

### Verification performed

- `npx vitest run src/components/love-notes/__tests__/LoveNoteMessage.test.tsx`: 25/25 passed. Sending caption present with `aria-live="polite"` and `text-gray-500`; uploading still hides it.
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts`: 6/6 passed; file undiffed.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `fnox exec -- npm run build`: exit 0 (existing `inlineDynamicImports` deprecation on the service worker).
- `git diff --check`: clean.
- `_bmad-output/implementation-artifacts/deferred-work.md`: no diff.
- Browser: compiled `src/index.css` (`dist/assets/index-DtO41SSy.css`), light and dark `color-scheme`. Temporary harness kept out of the source diff.
  - Thread ground: `bg-[#FFF5F5]` `rgb(255, 245, 245)`.
  - Own sending caption: `Sending...`, `aria-live="polite"`, `text-xs` / 12px, class `text-gray-500`, fg `oklch(0.551 0.027 264.364)` → `rgb(106, 114, 130)`, alpha 1, **4.521:1**. Bubble stays `bg-[#FF6B6B]` `rgb(255, 107, 107)` + gray-800 `rgb(30, 41, 57)`, opacity 1, **5.286:1**.
  - Own rest: same bubble pair, no `Sending...`.
  - Partner: `bg-[#E9ECEF]` `rgb(233, 236, 239)` + `text-gray-800`, **12.371:1**, no caption restyle.
  - Uploading: `Uploading...` overlay; no `Sending...`.
  - Dark scheme resolved the same tokens and ratios.

### Residual risks

The honesty test still measures only `text-white` on named `bg-<colour>-<shade>`. Dark-on-hex caption contrast is browser-only; the class assertions in `LoveNoteMessage.test.tsx` are the pin. 4.521:1 is 0.021 above the AA floor, so a Tailwind gray-500 lightening could drop it. No remaining sending-caption contrast defect on the Love Notes thread ground.
