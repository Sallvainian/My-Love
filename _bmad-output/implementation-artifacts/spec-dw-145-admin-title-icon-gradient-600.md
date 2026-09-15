---
title: 'DW-145: Admin panel title icon gradient'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
baseline_revision: '56eb0a2bc0b5b59bcc1f181880db907e520c27d9'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The Admin Panel title icon still rests on `from-pink-500 to-rose-500` while its ⚙️ is `text-white`. Those stops fail WCAG AA (pink-500 3.58:1, project rose-500 `#f43f5e` 3.67:1). The pairing is split across two literals, so `whiteOnColorContrast.test.ts` never sees it.

**Approach:** Apply the DW-143 resting stops to that leftover box: `from-pink-600 to-rose-600`, and put `text-white` on the same class string so the scanner records the pairing. pink-600 and rose-600 already clear 4.5:1 against white, so the honesty map stays empty.

## Boundaries & Constraints

**Always:** Keep the title-icon `div` at `AdminPanel.tsx:103` as a 10×10 rounded box (`flex h-10 w-10 items-center justify-center rounded-lg`) with `bg-gradient-to-r`. Keep the child span at `:104` as `text-xl text-white` with ⚙️. Use installed Tailwind `pink-600` and project `rose-600` (`tailwind.config.js:66`). After the edit, that one class string must contain `bg-gradient-to-r`, `from-pink-600`, `to-rose-600`, and `text-white` together so the scanner at `whiteOnColorContrast.test.ts:239-279` measures both stops. Leave `KNOWN_GRADIENT_BELOW_FLOOR` empty (`:184`).

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Reopen or edit `spec-dw-143-promote-resting-gradient-to-600.md`. Touch the Create button at `AdminPanel.tsx:149` (already `from-pink-600 to-rose-600` + `text-white`). Touch `src/index.css` `.text-gradient` (`:78`, `text-transparent`). Touch PokeKiss chips (`PokeKissInterface.tsx:314`, `:339`, `:349`). Change the scanner matcher, walk `bg-linear`, or add an honesty-map row. Do not introduce a shared icon component, a theme abstraction, or hard-coded replacement hex.

</intent-contract>

## Code Map

- `src/components/AdminPanel/AdminPanel.tsx:103` — only edit. Today: `className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-pink-500 to-rose-500"`. No `text-white` on this literal, so `findWhiteOnColourPairings` skips the line (`whiteOnColorContrast.test.ts:240`).
- `src/components/AdminPanel/AdminPanel.tsx:104` — child `<span className="text-xl text-white">⚙️</span>`. Read-only. Putting `text-white` on the parent is visually identical.
- `src/components/AdminPanel/AdminPanel.tsx:107` — `data-testid="admin-title"` is the heading, not the icon box. Read-only.
- `src/components/AdminPanel/AdminPanel.tsx:149` — Create Message already `from-pink-600 to-rose-600` + `text-white`. Read-only.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` — run, do not edit. Gradient scan requires `text-white` and `bg-gradient` on the same literal (`:239-265`); unprefixed `from-`/`to-` stops (`:266-268`). `KNOWN_GRADIENT_BELOW_FLOOR` is empty (`:184`). Offenders test (`:335-348`) fails a new 500 stop. Honesty loop (`:351-382`) is a no-op over an empty map. Live canary (`:325-332`) still wants some `pink-600` gradient (the ten CTAs).
- `src/index.css:78` — `.text-gradient` `@apply bg-linear-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent`. Read-only.
- `src/components/PokeKissInterface/PokeKissInterface.tsx:314` `from-pink-400 to-pink-500`, `:339` `from-red-400 to-pink-500`, `:349` `from-green-400 to-green-600`. Read-only; different idiom, `bg-linear`.
- `tailwind.config.js:59-69` — project rose-600 `#e11d48`. Installed pink-600 is Tailwind default. Read-only.
- `_bmad-output/implementation-artifacts/spec-dw-143-promote-resting-gradient-to-600.md` — done; its Never named `:103`. Do not reopen.

## Tasks & Acceptance

**Execution:**
- `src/components/AdminPanel/AdminPanel.tsx` — on the title-icon `div` at `:103` only, replace `from-pink-500 to-rose-500` with `from-pink-600 to-rose-600` and add `text-white` to that same `className` string. Leave layout, direction, child span, Create button, and every other class untouched.

**Acceptance Criteria:**
- Given the Admin Panel header, when the title row is shown in light or dark mode, then the ⚙️ sits on `bg-gradient-to-r from-pink-600 to-rose-600`, the icon box still measures 10×10 and rounded-lg, the glyph stays `text-xl text-white`, and both stops measure at least 4.5:1 against white.
- Given `tests/unit/a11y/whiteOnColorContrast.test.ts` after that class edit, when the suite runs, then it passes, `KNOWN_GRADIENT_BELOW_FLOOR` is still empty, the scanner reports the `:103` pairing as `pink-600` and `rose-600` gradient stops, and reverting those stops to `pink-500`/`rose-500` would fail the offenders test.
- Given the Create Message button, `.text-gradient`, PokeKiss chips, and the contrast-test matcher, when this change lands, then those four surfaces are byte-for-byte unchanged.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 10 findings — high 0, medium 0, low 5, false 5, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind hunter: AC2/verification claim that a green vitest run witnesses the `:103` pairing — `whiteOnColorContrast.test.ts:332` is only `gradients.some(swatch === 'pink-600')`, already true from the ten CTAs including Create at `AdminPanel.tsx:149`. Starting intent named findability via parent `text-white`, an empty honesty map, and offenders failing a 500 revert; a `:103` presence canary is extra surface. Accidental one-line revert is unlikely.
  - `[low]` `[reject]` Blind hunter: dropping parent `text-white` restores split-literal blindness while the suite stays green — `whiteOnColorContrast.test.ts:240` `if (!classes.includes('text-white')) continue;`. Dropping that class alone leaves `from-pink-600 to-rose-600`, still ≥4.5:1. Recreating the leftover needs both a stop revert and dropping parent `text-white`. Same extra canary as the first row.
  - `[low]` `[reject]` Blind hunter: no source comment that parent `text-white` is a scanner flag — the same-literal rule is already at `whiteOnColorContrast.test.ts:231-237`. A comment line above the box would also shift every `:103` citation the finding itself warns about.
  - `[false]` `[reject]` Blind hunter: ⚙️ is emoji presentation so `text-white` does not paint it and 1.4.3 is the wrong bar — headed fixture measured the child span `color: rgb(255, 255, 255)` at 20px on the 600 sweep; the screenshot showed a light gear. Intent required keeping `<span className="text-xl text-white">⚙️</span>`. A lucide swap is excluded.
  - `[false]` `[reject]` Blind hunter: light-or-dark AC is vacuous because Admin Panel has no `dark:` classes — header is `bg-white/90` (`AdminPanel.tsx:97`) with no `dark:` on the icon box. Both schemes resolved the same `linear-gradient(to right, oklch(0.592 0.249 0.584), rgb(225, 29, 72))`. The dark limb holds; it does not ask for a dark restyle.
  - `[low]` `[reject]` Verification gap: restoring the original `:103` string (500 stops, no parent `text-white`) stays green — pre-verified. Offenders at `:348` only see stops on a `text-white` + `bg-gradient` literal. Starting intent left the matcher alone and named the empty honesty map; a two-hit `AdminPanel.tsx` `pink-600`/`rose-600` canary is extra and would also fail if Create at `:149` vanished. Same unguarded-revert claim as the first two rows.
  - `[false]` `[reject]` Intent alignment: Reading D (a test that names `:103`) is unimplemented — the auditor called that a stretch of “sees.” Reading A is findability in the existing finder (`:240`, `:265`) plus offenders on a 500 revert. The diff implements A/B/C.
  - `[low]` `[reject]` Intent alignment: no test file in the diff, so omitting parent `text-white` stays green — same split-literal blindness as the verification-gap row.
  - `[false]` `[reject]` Intent alignment: the new spec adds 10×10/`rounded-lg`, light-and-dark, and lint/typecheck/build surfaces `intent.md` did not name — those are verification of the same class string. Fixing this would be editing this spec.
  - `[false]` `[reject]` Intent alignment: Reading A wanted no spec file, but the diff adds `spec-dw-145-admin-title-icon-gradient-600.md` — the spawn required `$bmad-build-auto`, which is Reading B. The spec is process, not a second product surface.

## Design Notes

The scanner judges one string literal. Child `text-white` at `:104` does not attach to the parent's `from-`/`to-` stops. Adding `text-white` on `:103` is the visibility fix, not a colour change: the ⚙️ is already white.

## Verification

**Commands:**
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` — expected: pass; empty gradient allowlist; `:103` now among measured `pink-600`/`rose-600` gradient pairings.
- `npm run lint` — expected: exit 0.
- `npm run typecheck` — expected: exit 0, or only pre-existing diagnostics with evidence.
- `fnox exec -- npm run build` — expected: secret-injected production build exit 0.
- `git diff --check` — expected: no whitespace errors.
- Confirm `_bmad-output/implementation-artifacts/deferred-work.md` has no diff.
- Confirm `tests/unit/a11y/whiteOnColorContrast.test.ts`, `src/index.css`, and `PokeKissInterface.tsx` have no diff.

**Browser checks:**
- Open Admin Panel. Confirm the header ⚙️ box is the darker 600 sweep, white glyph, unchanged size. Confirm Create Message still uses the 600 pair. Measure both icon-box stops against white at ≥4.5:1 in light and dark.

## Auto Run Result

**Summary:** Resting Admin Panel title-icon gradient moved from `from-pink-500 to-rose-500` to `from-pink-600 to-rose-600`, with `text-white` on that same class string so `findWhiteOnColourPairings` records both stops. Child ⚙️ span, Create Message, `.text-gradient`, PokeKiss chips, the scanner matcher, `spec-dw-143`, and `deferred-work.md` were not edited.

**Files changed:**
- `src/components/AdminPanel/AdminPanel.tsx` — title-icon `div` at `:103` is now `bg-gradient-to-r from-pink-600 to-rose-600 text-white`; layout and child span unchanged
- `_bmad-output/implementation-artifacts/spec-dw-145-admin-title-icon-gradient-600.md` — this spec

**Review findings:** patches applied 0. Deferred 0. Rejected 10: no unique `:103` scan canary (3 rows: Blind hunter AC2, Blind hunter drop-`text-white`, verification-gap original-string revert); no scanner-flag comment; emoji-vs-1.4.3 (false); vacuous dark-mode AC (false); unimplemented stretch Reading D (false); intent-alignment duplicate of the unguarded revert; extra spec verification surfaces (false); spec file as Reading B process (false).

**Follow-up review recommendation:** false. Patched this pass: high 0, medium 0.

**Verification:**
- `npx vitest run tests/unit/a11y/whiteOnColorContrast.test.ts` — 6 passed
- `npm run lint` — exit 0
- `npm run typecheck` — exit 0
- `fnox exec -- npm run build` — exit 0
- `git diff --check` — clean
- `deferred-work.md`, `whiteOnColorContrast.test.ts`, `src/index.css`, `PokeKissInterface.tsx` — no diff
- Scanner on `AdminPanel.tsx:103` now matches `text-white` + `bg-gradient` + stops `pink-600`/`rose-600`
- Headed Chromium fixture against production `index-DGil5-nB.css`: icon box 40×40, `border-radius: 8px`, child `color: rgb(255, 255, 255)` at 20px; `background-image: linear-gradient(to right, oklch(0.592 0.249 0.584) 0%, rgb(225, 29, 72) 100%)` in light and dark; Create Message the same 600 pair. Canvas pink-600 `rgb(230, 0, 118)` 4.539:1; rose-600 `rgb(225, 29, 72)` 4.697:1. Live `/admin` was not opened (`App.tsx` requires a session before splash/admin).

**Residual risks:** Live Admin Panel route after login was not exercised. PokeKiss chips and `.text-gradient` still use 500 stops (out of scope). Scanner still ignores `bg-linear` and CSS `@apply`. A revert of the whole original `:103` string (500 and no parent `text-white`) would not fail the contrast suite.
