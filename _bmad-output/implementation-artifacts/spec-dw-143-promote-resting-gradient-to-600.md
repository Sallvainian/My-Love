---
title: 'DW-143: Promote resting pink-to-rose CTA gradient to 600'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
baseline_revision: '647645cfa45daa555112da4da9025f77a28d9505'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings:
  - oversized
deferred:
  - summary: >-
      Admin panel title icon still pairs white text with the old pink-500 / rose-500 gradient.
    evidence: |-
      AdminPanel.tsx:103 is still `bg-gradient-to-r from-pink-500 to-rose-500`
      with a child span at :104 `text-xl text-white`. The scanner requires both
      utilities on the same literal, so this pairing is invisible. Intent named
      :149, not :103. Pre-existing; this change left it.
    location: >-
      src/components/AdminPanel/AdminPanel.tsx:103
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The app's primary CTA is `bg-gradient-to-r from-pink-500 to-rose-500` with `text-white`, copied ten times. Both stops fail WCAG AA (`pink-500` 3.58:1, project `rose-500` `#f43f5e` 3.67:1). Hover already uses the passing 600 pair on two of those buttons, so the control is compliant only while the pointer is on it.

**Approach:** Promote the resting stops to `from-pink-600 to-rose-600` with `text-white` on all ten `bg-gradient-to-r` sites, plus `PokeKissInterface.tsx:439` and `src/index.css` `.btn-primary`, in one change. Darken the two existing `hover:from-pink-600 hover:to-rose-600` pairs to `hover:from-pink-700 hover:to-rose-700` so hover is not lighter than rest. Clear both `KNOWN_GRADIENT_BELOW_FLOOR` counts together.

## Boundaries & Constraints

**Always:** Keep `text-white`, layout, labels, test IDs, disabled/opacity/shadow/scale hover, and `bg-gradient-to-r` / `bg-linear-to-br` / `bg-linear-to-r` direction utilities. Use installed Tailwind `pink-600`/`pink-700` and project `rose-600`/`rose-700` (`tailwind.config.js:66-67`). Empty both gradient-allowlist counts in the same change as the class edits. Update the live `pink-500` gradient canary in the contrast test so it still sees the CTA after the stops move.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Touch `WelcomeSplash.tsx:87` (already 600, `text-transparent`), `src/index.css` `.text-gradient` (`text-transparent`), or `AdminPanel.tsx:103` (gradient with no `text-white` on that literal). Do not ship a subset of the ten, skip the two extras, or leave one allowlist count. Do not introduce a theme abstraction, a shared button component, or hard-coded replacement hex. Do not extend the scanner to `bg-linear` or CSS `@apply`.

</intent-contract>

## Code Map

- Ten `bg-gradient-to-r from-pink-500 to-rose-500` + `text-white` sites (scanner count 10/10): `src/components/DailyMessage/DailyMessage.tsx:133` Retry, `:260` category badge (`text-xs`); `src/components/WelcomeSplash/WelcomeSplash.tsx:110` Continue; `src/components/WelcomeButton/WelcomeButton.tsx:46` welcome FAB; `src/components/PhotoGallery/PhotoGallery.tsx:309` upload FAB; `src/components/ErrorBoundary/ErrorBoundary.tsx:67` Try Again (`hover:from-pink-600 hover:to-rose-600`); `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx:61` Try Again (same hover); `src/components/AdminPanel/AdminPanel.tsx:149` Create Message; `src/components/AdminPanel/CreateMessageForm.tsx:230` Save; `src/components/AdminPanel/EditMessageForm.tsx:252` Save.
- Extra same-stops, not in the count of ten: `PokeKissInterface.tsx:439` `bg-linear-to-br from-pink-500 to-rose-500 text-white` (`data-testid="fab-main-button"`); `src/index.css:53-55` `.btn-primary` `@apply … bg-linear-to-r from-pink-500 to-rose-500 … text-white` (unused in TSX; still required).
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — `KNOWN_GRADIENT_BELOW_FLOOR` `:192-195` `pink-500`/`rose-500` expected 10 each. Scanner `:276` requires `bg-gradient` so `bg-linear` and CSS are invisible. Honesty loop `:381-393`. Live canary `:343` `swatch === 'pink-500'` must move to `pink-600`. Hover stops are unprefixed-only (`:27-29`, lookbehind `:278`).
- Read-only: `WelcomeSplash.tsx:87`; `src/index.css:78` `.text-gradient`; `AdminPanel.tsx:103` icon box; `tailwind.config.js:59-69` rose override; `FROZEN` scripture skip.

## Tasks & Acceptance

**Execution:**
- `src/components/DailyMessage/DailyMessage.tsx`, `src/components/WelcomeSplash/WelcomeSplash.tsx`, `src/components/WelcomeButton/WelcomeButton.tsx`, `src/components/PhotoGallery/PhotoGallery.tsx`, `src/components/AdminPanel/AdminPanel.tsx`, `src/components/AdminPanel/CreateMessageForm.tsx`, `src/components/AdminPanel/EditMessageForm.tsx` — replace resting `from-pink-500 to-rose-500` with `from-pink-600 to-rose-600`; keep `text-white` and all other classes. Do not edit `AdminPanel.tsx:103`.
- `src/components/ErrorBoundary/ErrorBoundary.tsx`, `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx` — same resting-stop bump, and replace `hover:from-pink-600 hover:to-rose-600` with `hover:from-pink-700 hover:to-rose-700`.
- `src/components/PokeKissInterface/PokeKissInterface.tsx` — same resting-stop bump on the FAB; keep `bg-linear-to-br`.
- `src/index.css` — same resting-stop bump on `.btn-primary` only.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — clear both `KNOWN_GRADIENT_BELOW_FLOOR` entries together; retarget the `:343` canary from `pink-500` to `pink-600`. Leave the `bg-gradient` matcher and frozen skip.

**Acceptance Criteria:**
- Given each of the ten `bg-gradient-to-r` + `text-white` CTAs (including the `text-xs` category badge), when shown at rest in light or dark mode, then the fill is `from-pink-600 to-rose-600`, the label/icon stays white, and both stops measure at least 4.5:1 against white.
- Given ErrorBoundary and ViewErrorBoundary Try Again, when hovered, then the fill uses `from-pink-700 to-rose-700` (darker than rest, not the old 600 hover). Other listed controls keep their existing non-colour hover (shadow/scale).
- Given the PokeKiss main FAB and `.btn-primary`, when shown at rest, then they use `from-pink-600 to-rose-600` with `text-white` and keep their current direction utilities (`bg-linear-to-br` / `bg-linear-to-r`).
- Given `tests/unit/a11y/whiteOnColorContrast.test.ts` after the class edits, when the suite runs, then it passes, both gradient-allowlist counts are gone, remaining solid allowlist rows (if any) still fail as recorded, and a new `bg-gradient` + `text-white` stop below 4.5:1 still fails.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 18 findings — high 0, medium 1, low 14, false 3, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind hunter: emptying `KNOWN_GRADIENT_BELOW_FLOOR` leaves no 10/10 passing inventory, so two of the ten CTAs could disappear or become an unknown swatch while `gradients.length > 15` and one `pink-600` remain — reverting those two to 500 still fails the below-floor test (`whiteOnColorContrast.test.ts:335-348`). The starting intent named clearing the failing counts, not a new presence canary. Adding `toBe(10)` on `pink-600`/`rose-600` is extra surface.
  - `[low]` `[reject]` Blind hunter: hover 700 on ErrorBoundary / ViewErrorBoundary is untested — rest stays `from-pink-600 to-rose-600` at ≥4.5:1. The original intent authorized darken or drop; hover 600 after rest 600 is not lighter than rest. Pinning 700 would add a test the starting intent did not name. Accidental revert of two hover strings is unlikely in everyday use.
  - `[low]` `[reject]` Blind hunter: PokeKiss FAB and `.btn-primary` can revert to 500 without failing the contrast guard — scanner still requires `bg-gradient` and only walks `.tsx` (`whiteOnColorContrast.test.ts:265`, `:194-211`). Intent required those two class edits in the same change and named allowlist-clear as the test action. Extending the scanner is a new guard; a string canary is extra. Accidental one-line revert is unlikely.
  - `[medium]` `[defer]` Blind hunter: `AdminPanel.tsx:103` is still `from-pink-500 to-rose-500` with a child `text-xl text-white` ⚙️ — pre-existing split-literal pairing the scanner does not see. Intent named `:149`, not `:103`. Left as leftover debt.
  - `[low]` `[reject]` Blind hunter: expanded PokeKiss chips still use `bg-linear-to-br` + `from-pink-400 to-pink-500` / `from-red-400 to-pink-500` / purple and green with `text-white` (`PokeKissInterface.tsx:305-349`, `:416`) — pre-existing different idiom, not the CTA `from-pink-500 to-rose-500` pair. Intent named the main FAB at `:439` only.
  - `[false]` `[reject]` Blind hunter: suite never pins resting 4.54:1 / 4.70:1 — `whiteOnColorContrast.test.ts:335-348` already fails any scanned stop below 4.5:1, including `pink-600` / `rose-600`. AA is the floor; exact ledger ratios are motivation, not a new canary.
  - `[low]` `[reject]` Blind hunter: file-level comments still quote the 500 pair and the honesty loop still says “fix some of the ten” over an empty map — historical (why gradients were added). The empty-map block at `:177-183` already records DW-143. Rewriting comments is not a product correction.
  - `[low]` `[reject]` Blind hunter: done specs DW-139/140/141 still say leave `KNOWN_GRADIENT_BELOW_FLOOR` pink-500/rose-500 — those Code Maps are snapshots of a prior tree. Editing completed artifacts is not this change; implementers of this bundle use this spec.
  - `[low]` `[reject]` Verification gap: PokeKiss main FAB stops can revert below AA without failing the contrast guard — same unguarded-`bg-linear` claim as the third row. Filed disposition was defer (scanner follow-up). Extending `findWhiteOnColourPairings` is a new guard; current production is `from-pink-600 to-rose-600`; an accidental revert is unlikely.
  - `[low]` `[reject]` Verification gap: ErrorBoundary / ViewErrorBoundary hover 700 can revert to 600 with no test failure — same hover-pin claim as the second row. Filed disposition was defer (new hover guard). Original intent authorized drop; rest remains AA.
  - `[low]` `[reject]` Intent alignment: tests cover the ten `bg-gradient` sites only negatively, with no `rose-600` or per-site 600 canary — grouped with the first row. Allowlist-clear plus the below-floor test is the test action the starting intent named.
  - `[low]` `[reject]` Intent alignment: dropping `text-white` would hide a site from the scanner — documented model at `whiteOnColorContrast.test.ts:30-31` and `:249`. Removing white text is a visible restyle, not an accidental below-floor pairing.
  - `[low]` `[reject]` Intent alignment: PokeKiss is class-edit-only — same `bg-linear` gap as the third and ninth rows.
  - `[low]` `[reject]` Intent alignment: `.btn-primary` is class-edit-only — CSS is not walked; the class has no TSX caller. Intent still required the `@apply` stop bump, which the diff made.
  - `[low]` `[reject]` Intent alignment: hover is class-edit-only — same as the second and tenth rows. Lookbehind at `:267` is rest-only by design (`:27-29`).
  - `[false]` `[reject]` Intent alignment: emptying the map makes the honesty loop vacuous — `whiteOnColorContrast.test.ts:177-184` keeps the Map so a new failing idiom can be recorded. That is the intended end state after both counts are cleared; the offenders test is the floor.
  - `[low]` `[reject]` Intent alignment: Reading B (`AdminPanel.tsx:103`, `.text-gradient`) is unimplemented — original decision glosses “everywhere the idiom appears” as the ten named sites plus PokeKiss and `.btn-primary`, “with text-white.” `.text-gradient` is `text-transparent`. `:103` is the deferred leftover above.
  - `[false]` `[reject]` Intent alignment: tests cannot tell darken-to-700 from drop — both arms satisfy “hover is not lighter than rest.” Distinguishing authorized alternatives is not a missing pin of the intent.

## Design Notes

Hover uses the darken arm of the authorized "darken or drop" constraint, matching DW-28's one-shade-darker hover (`pink-600` rest → `pink-700` hover). Dropping the hover classes would also satisfy "not lighter than rest" but would remove the only colour hover those two buttons have.

The scanner still requires `bg-gradient` and only walks `.tsx`, so PokeKiss (`bg-linear-to-br`) and `.btn-primary` (CSS) stay uncounted; they are class-edit-only on purpose.

## Verification

**Commands:**
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` — expected: pass; `KNOWN_GRADIENT_BELOW_FLOOR` empty; canary matches `pink-600`.
- `npm run lint` — expected: exit 0; existing EventCountdown Fast Refresh warnings only.
- `npm run typecheck` — expected: exit 0, or only pre-existing diagnostics with evidence.
- `fnox exec -- npm run build` — expected: secret-injected production build exit 0.
- `git diff --check` — expected: no whitespace errors.
- Confirm `_bmad-output/implementation-artifacts/deferred-work.md` has no diff.

## Auto Run Result

Status: done

**Summary:** Promoted the resting pink-to-rose CTA from `from-pink-500 to-rose-500` to `from-pink-600 to-rose-600` with `text-white` on the ten `bg-gradient-to-r` sites, the PokeKiss main FAB, and `.btn-primary`. Darkened ErrorBoundary / ViewErrorBoundary hover to `from-pink-700 to-rose-700`. Cleared both `KNOWN_GRADIENT_BELOW_FLOOR` counts and retargeted the gradient canary to `pink-600`. Did not edit `deferred-work.md`.

**Files changed:**
- `src/components/DailyMessage/DailyMessage.tsx` — Retry and category badge rest at 600
- `src/components/WelcomeSplash/WelcomeSplash.tsx` — Continue rest at 600
- `src/components/WelcomeButton/WelcomeButton.tsx` — welcome FAB rest at 600
- `src/components/PhotoGallery/PhotoGallery.tsx` — upload FAB rest at 600
- `src/components/ErrorBoundary/ErrorBoundary.tsx` — Try Again rest 600, hover 700
- `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx` — Try Again rest 600, hover 700
- `src/components/AdminPanel/AdminPanel.tsx` — Create Message rest at 600
- `src/components/AdminPanel/CreateMessageForm.tsx` — Save rest at 600
- `src/components/AdminPanel/EditMessageForm.tsx` — Save rest at 600
- `src/components/PokeKissInterface/PokeKissInterface.tsx` — main FAB rest at 600 (`bg-linear-to-br` kept)
- `src/index.css` — `.btn-primary` rest at 600 (`bg-linear-to-r` kept)
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — empty gradient allowlist; canary `pink-600`
- `_bmad-output/implementation-artifacts/spec-dw-143-promote-resting-gradient-to-600.md` — this spec

**Review findings:** patches applied 0. Deferred 1: AdminPanel title icon still white on pink-500/rose-500 (`AdminPanel.tsx:103`). Rejected 17: weak 10/10 presence canary; untested hover 700; untested PokeKiss/`.btn-primary`; expanded PokeKiss chips (different idiom); stale 500 comments; stale DW-139/140/141 Code Maps; verification-gap duplicates of PokeKiss and hover; intent-alignment duplicates of inventory/text-white/PokeKiss/`.btn-primary`/hover; Reading B extras; plus three false (exact 4.54/4.70 lock, vacuous honesty loop, darken-vs-drop pin).

**Follow-up review recommendation:** false. Patched this pass: high 0, medium 0.

**Verification:**
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` — 6 passed
- `npm run lint` — exit 0, no EventCountdown warnings
- `npm run typecheck` — exit 0
- `fnox exec -- npm run build` — exit 0
- `git diff --check` — clean
- `deferred-work.md` — no diff
- Palette math: pink-600 4.544:1, rose-600 (`#e11d48`) 4.697:1, pink-700 5.894:1, rose-700 6.285:1
- Headed Chromium fixture with production CSS: rest `oklch(0.592 0.249 0.584)` → `rgb(225, 29, 72)`; Try Again hover `oklch(0.525 0.223 3.958)` → `rgb(190, 18, 60)`; FAB `to right bottom`; `.btn-primary` same 600 sweep; `text-white` in light and on a dark ground. Live app routes (home/welcome/photos/admin after login) were not exercised.

**Residual risks:** AdminPanel icon box leftover (deferred). PokeKiss chips and `.text-gradient` still use 500 stops; chips are white-on-sub-AA and unscanned (`bg-linear`). Scanner still ignores `bg-linear` and CSS `@apply`. CTA is visibly darker at rest.

