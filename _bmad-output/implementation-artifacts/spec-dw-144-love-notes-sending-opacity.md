---
title: 'DW-144: Own-message sending bubble opacity'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
baseline_revision: '2614a8bc6ff9bacab81a7b85bd7cf86338099677'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      Sending... caption remains text-gray-400 on Love Notes #FFF5F5 at 2.433:1.
    evidence: |-
      LoveNoteMessage.tsx:332 is still `text-xs text-gray-400`. Installed
      --color-gray-400 oklch(70.7% 0.022 261.325) vs #FFF5F5 is 2.433:1.
      Pre-existing; the human chose to keep the existing caption.
    location: >-
      src/components/love-notes/LoveNoteMessage.tsx:332
    severity: low
---

<intent-contract>

## Intent

**Problem:** Own love-note bubbles already clear WCAG AA at rest (`text-gray-800` on `#FF6B6B` at 5.286:1), but `LoveNoteMessage.tsx:276` still applies `opacity-70` while `isSending` is true. That composites gray-800 on `#FF6B6B` at 0.7 over Love Notes `#FFF5F5` to 2.715:1.

**Approach:** Drop the sending-only `opacity-70` class so in-flight own bubbles stay at the measured rest 5.286:1. Keep the existing `Sending...` aria-live caption as the in-flight cue.

## Boundaries & Constraints

**Always:** Keep the `Sending...` span with `aria-live="polite"` (hidden while `imageUploading`). Keep own fill `bg-[#FF6B6B]`, `text-gray-800`, partner `bg-[#E9ECEF] text-gray-800`, error border, entrance motion, and send/scroll/remove behaviour. Re-measure a sending own bubble over `#FFF5F5` in the browser.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Convert `#FF6B6B` to `bg-coral-500`. Add a hex matcher to `whiteOnColorContrast.test.ts`. Touch partner styling, the new-message chip, Send, the uploading overlay, `motion.div` entrance opacity, frozen scripture, or `isSending` itself (it still gates the caption).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Own sending | `isOwnMessage` true, `message.sending` true, not uploading | Bubble `#FF6B6B` + `text-gray-800`, no `opacity-70`; `Sending...` with `aria-live="polite"` | No error expected |
| Own rest | `sending` false | Same fill/text; no `Sending...` | No error expected |
| Image uploading | `sending` true and `imageUploading` true | `Uploading...` overlay; no `Sending...` caption | No error expected |
| Partner | `isOwnMessage` false | `bg-[#E9ECEF] text-gray-800`; no sending fade | No error expected |

</intent-contract>

## Code Map

- `src/components/love-notes/LoveNoteMessage.tsx:276` — the only production `isSending ? 'opacity-70'` site. Remove that fragment from the bubble `className`. Leave `:273-275` own/partner arms and `:276` `hasError` border.
- `src/components/love-notes/LoveNoteMessage.tsx:96` — `isSending = message.sending ?? false`; keep. `:331-334` is the `Sending...` `aria-live="polite"` span, gated `isSending && !isImageUploading`. `:311-317` uploading overlay is read-only. `:221-224` `motion.div` entrance `opacity` is a different animation; do not change it.
- `src/components/love-notes/LoveNotes.tsx:126` — thread ground `bg-[#FFF5F5]`; compositing backdrop for the old 0.7 fade. Read-only.
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx:271-295` — already asserts `Sending...` and that uploading hides it. Run after the class edit; do not add a hex scanner.
- `tests/unit/a11y/whiteOnColorContrast.test.ts:26-31` — rest-state `text-white` + named `bg-<colour>-<shade>` only. Hex `#FF6B6B` is outside it. Do not extend.
- `_bmad-output/implementation-artifacts/spec-dw-141-love-notes-send-button-contrast.md` — origin of this deferral (rest 5.286:1, sending composite 2.715:1). Read-only.

## Tasks & Acceptance

**Execution:**
- `src/components/love-notes/LoveNoteMessage.tsx` — remove `${isSending ? 'opacity-70' : ''}` from the bubble `className` at line 276; leave fill, text, error border, caption, overlay, and motion entrance unchanged.

**Acceptance Criteria:**
- Given an own love note with `sending` true over Love Notes `#FFF5F5`, when the bubble is shown, then it keeps `bg-[#FF6B6B] text-gray-800` with no `opacity-70`, measured text-on-fill contrast is at least 4.5:1 in light and dark (same as rest 5.286:1), and the `Sending...` span with `aria-live="polite"` remains.
- Given a partner bubble on the same thread, when it is shown, then it stays `bg-[#E9ECEF] text-gray-800`, and send, scroll, and remove behaviour are unchanged.
- Given `whiteOnColorContrast.test.ts`, when the suite runs, then it is unchanged: no hex matcher added, no coral-500 conversion on the bubble.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 11 findings — high 0, medium 0, low 8, false 3, maybe-false 0
- findings:
  - `[low]` `[defer]` Blind hunter: Sending... caption is `text-gray-400` on `#FFF5F5` at 2.433:1 — `LoveNoteMessage.tsx:332` `className="mt-1 px-1 text-xs text-gray-400"`; installed `--color-gray-400: oklch(70.7% 0.022 261.325)` (`node_modules/tailwindcss/theme.css:230`) vs `#FFF5F5` is 2.433:1. Pre-existing; the starting intent said keep the existing caption.
  - `[false]` `[reject]` Blind hunter: dropping the fade adds a new layout line `calculateRowHeight` never budgets — the `Sending...` span at `LoveNoteMessage.tsx:331-334` already rendered when `isSending && !isImageUploading`. The comment at `:233-235` is about the sender/timestamp row's remove control, not the status span. Opacity does not change layout.
  - `[false]` `[reject]` Blind hunter: the uploading test does not assert no `opacity-70`, so an upload-only fade would stay green — the deleted ternary was `isSending ? 'opacity-70'`, and upload notes still set `sending: true` (`notesSlice.ts:453-454`). Restoring that ternary fails the sending test at `LoveNoteMessage.test.tsx:291`. Current uploading bubble has opacity 1 and no `opacity-70`.
  - `[low]` `[reject]` Blind hunter: the error-border fragment on the edited template is untested — `LoveNoteMessage.tsx:276` still has `${hasError ? 'border-2 border-red-500' : ''}`. The current border is intact. Pinning it is extra; an accidental drop of that unchanged fragment is unlikely in everyday use.
  - `[low]` `[reject]` Blind hunter: the spec never requires the new `not.toHaveClass('opacity-70')` checks — the only fix is editing this spec, which the workflow rejects.
  - `[low]` `[reject]` Blind hunter: class-string checks only ban the token `opacity-70`, not `opacity-50` / `opacity-[0.7]` / inline opacity — current computed opacity is 1. A computed-opacity guard is new complexity. The intent forbade teaching `whiteOnColorContrast.test.ts` hex. Accidental `opacity-50` on this bubble is unlikely.
  - `[low]` `[reject]` Intent alignment: tests pin class names, not the 5.286:1 composite over `#FFF5F5` — parent measured the actual `LoveNoteMessage` with compiled `src/index.css`: sending own bubble gray-800 `rgb(30, 41, 57)` on opaque `#FF6B6B` `rgb(255, 107, 107)` at **5.286:1**, opacity 1, no `opacity-70`. The starting intent forbade a hex matcher.
  - `[low]` `[reject]` Intent alignment: spec ACs add browser re-measure, light/dark, and a 4.5:1 floor the starting `intent.md` did not name — spec-only; rejected.
  - `[low]` `[reject]` Intent alignment: tests never render a sending partner — `notesSlice.ts:447-456` sets `sending: true` on the current user's optimistic note (`from_user_id: userId`). A partner row with `sending: true` is not a production path. The deleted class was shared; it is gone for every `isSending`.
  - `[false]` `[reject]` Intent alignment: send/scroll/remove are not in this patch's tests — `MessageInput.tsx`, `MessageList.tsx`, and `onRequestRemove` are not in the diff. Keep-by-omission; those behaviours were not restyled.
  - `[low]` `[reject]` Intent alignment: spec Never-list names chip, Send, overlay, motion entrance, and scripture, which starting `intent.md` did not — spec-only; rejected.

## Design Notes

The human chose drop `opacity-70` and keep the `Sending...` caption. The caption is the remaining in-flight cue; do not invent a replacement fade, spinner, or colour shift.

## Verification

**Commands:**
- `npx vitest run src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` — expected: pass; sending caption still present; uploading still hides it.
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` — expected: pass; file undiffed.
- `npm run lint` — expected: exit 0; existing EventCountdown Fast Refresh warnings only.
- `npm run typecheck` — expected: exit 0, or only pre-existing diagnostics with evidence.
- `fnox exec -- npm run build` — expected: secret-injected production build exit 0.
- `git diff --check` — expected: no whitespace errors.
- Confirm `_bmad-output/implementation-artifacts/deferred-work.md` has no diff.

**Browser checks:**
- Render the actual `LoveNoteMessage` with `src/index.css` for own sending, own rest, partner, and uploading, in both color schemes. Measure resolved foreground, background, and alpha on the sending own bubble over `#FFF5F5`. Confirm ≥4.5:1, no `opacity-70`, caption and overlay unchanged. Keep temporary harnesses out of the final source diff.

## Auto Run Result

### Summary

Removed `${isSending ? 'opacity-70' : ''}` from the love-note bubble so in-flight own messages stay at the measured rest 5.286:1. Kept the `Sending...` aria-live caption, `#FF6B6B` fill, `text-gray-800`, partner bubbles, and send/scroll/remove behaviour. Did not convert the hex ground to coral-500 or add a contrast-scanner hex matcher. Did not edit the deferred-work ledger.

### Files changed

- `src/components/love-notes/LoveNoteMessage.tsx` — dropped the sending-only `opacity-70` class from the bubble; fill, text, error border, caption, overlay, and motion entrance unchanged.
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` — own rest, own sending, and partner rows now assert fill/text, no `opacity-70`, and the sending caption's `aria-live="polite"`.
- `_bmad-output/implementation-artifacts/spec-dw-144-love-notes-sending-opacity.md` — implementation contract, review triage, and this result.

### Review findings

- Patches applied: 0 (high 0, medium 0, low 0).
- Items deferred: 1 (low) — `Sending...` caption remains `text-gray-400` on `#FFF5F5` at 2.433:1.
- Rejected findings: 10, recorded above. Three false (status span is not a new layout line; upload-only fade would restore the shared `isSending` ternary the sending test already pins; send/scroll/remove files are unchanged). Seven low (untested error border; spec does not name the new class assertions; other opacity tokens; tests don't measure 5.286:1; spec light/dark floor vs `intent.md`; sending partner; extra Never-list).
- Follow-up review recommended: `false`; no review patch was applied.

### Verification performed

- `npx vitest run src/components/love-notes/__tests__/LoveNoteMessage.test.tsx`: 25/25 passed. Sending caption present with `aria-live="polite"`; uploading still hides it; own/partner bubbles have no `opacity-70`.
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts`: 6/6 passed; file undiffed.
- `npm run lint`: exit 0, no warnings.
- `npm run typecheck`: exit 0.
- `fnox exec -- npm run build`: exit 0 (existing `inlineDynamicImports` deprecation on the service worker).
- `git diff --check`: clean.
- `_bmad-output/implementation-artifacts/deferred-work.md`: no diff.
- Browser: actual `LoveNoteMessage` with compiled `src/index.css`, light and dark `color-scheme`, thread `bg-[#FFF5F5]` → `rgb(255, 245, 245)`. Temporary harness kept out of the source diff.
  - Own sending: `bg-[#FF6B6B]` `rgb(255, 107, 107)` + gray-800 `oklch(0.278 0.033 256.848)` → `rgb(30, 41, 57)`, opacity 1, no `opacity-70`, **5.286:1**, `Sending...` `aria-live="polite"`.
  - Own rest: same pair, **5.286:1**, no caption.
  - Partner: `bg-[#E9ECEF] text-gray-800`, **12.371:1**, no sending fade.
  - Uploading: own fill, opacity 1, `Uploading...` overlay, no `Sending...`.
  - Dark scheme resolved the same tokens.

### Residual risks

The honesty test still measures only `text-white` on named `bg-<colour>-<shade>`. Hex `#FF6B6B` is outside it, as required. The in-flight cue is caption-only; that caption stays `text-gray-400` at 2.433:1 on `#FFF5F5` (deferred). No remaining sending-bubble contrast defect on the own-message fill.
