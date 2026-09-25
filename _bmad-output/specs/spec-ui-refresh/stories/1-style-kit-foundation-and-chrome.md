---
title: 'Style kit foundation and chrome'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_revision: '5597e124b43a2374ff80372c2786e1b4abbf1f81'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      The PWA manifest keeps pink theme_color and background_color, so in dark mode the installed app launches on a pink splash and a pink status bar.
    evidence: |-
      vite.config.ts:69-70 set theme_color '#FF6B9D' and background_color '#FFE5EC'; index.html has no per-scheme theme-color meta. Pre-existing, and no spec-ui-refresh story names it, yet CAP-2 asks every surface to follow the OS theme.
    location: >-
      vite.config.ts:69
    severity: low
---

<intent-contract>

## Intent

**Problem:** The app has no shared style kit: colours are raw palette shades per component, the page ground is a pink gradient painted in both themes, and the chrome's wordmark is Dancing Script. Every later UI-refresh story needs the kit tokens to exist first.

**Approach:** Define every token in `design-tokens.md` once in `src/index.css` as Tailwind v4 utilities whose values switch under `prefers-color-scheme: dark`, load Lora, paint the page ground from the `page` token, and restyle `AppNavigation` on the kit (heart + Lora wordmark, glass bar and dock, tint/accent active states, kit badge).

## Boundaries & Constraints

**Always:** Colour utilities: `bg-/text-/border-/ring-` × `page card card2 ink muted accent fill tint partner ptint good danger dtint line glass field`; shadows `shadow-card` (dark: none) and `shadow-float`; font `font-lora`. Values from `design-tokens.md` except the three light-theme contrast fixes in Design Notes. Existing testids, aria labels, `aria-current`, the 4rem bar height, `--dock-clearance`, dock geometry (`max-w-md`, inset, 60px, z-40) stay unchanged. Theme variables live under a `--kit-*` prefix and are wired with `@theme inline`, because `applyTheme()` writes `--color-accent`/`--color-primary`/… inline on `<html>` and would otherwise override them.

**Never:** Do not remove Dancing Script from the font import, `font-cursive` from `tailwind.config.js`, or any existing `index.css` class (`.card`, `.btn-*`, `.glass`, `.bg-sunset`…) — unmigrated screens still use them until story 9. Do not set a body text colour (unmigrated light-only cards would lose their inherited text in dark). Do not restyle any view other than the chrome. No manual theme toggle, no store/schema change. Do not touch the scrollbar colours.

</intent-contract>

## Code Map

- `src/index.css:1` -- Google Fonts import; append `family=Lora:ital,wght@1,500;1,600`, keep Dancing Script.
- `src/index.css:14-16` -- body `bg-linear-to-br from-pink-50…` → `bg-page`; keep `min-h-screen font-sans`.
- `src/index.css:132-137` -- `:root { --dock-clearance }` precedent for plain custom properties; add `--kit-*` light values in `:root` and dark values in `@media (prefers-color-scheme: dark) { :root {…} }` (Tailwind's default `dark:` is media-based; no `darkMode`/`@custom-variant` is configured).
- `src/utils/themes.ts:83-84` -- `document.body.style.background = theme.gradients.background` paints the gradient inline over any CSS ground (called from `App.tsx:449`). Delete those two lines only; the `--color-*`/`--gradient-*` setters stay (`MoodTracker.tsx:588` reads `--color-text`; `persisted-events-strip.spec.ts:120` reads `--color-primary`). No UI calls `setTheme`.
- `src/components/Navigation/AppNavigation.tsx:19-23` -- header comment about "a notch deeper than the artboard"; rewrite for the kit. `:51` `GLASS` const, `:83` wordmark, `:90-94` gear, `:105` dock, `:118-122` dock items, `:137` badge (`bg-purple-600`).
- `src/components/Navigation/__tests__/AppNavigation.test.tsx` -- contract tests (header text `/^My Love$/`, one button in header); lucide icons render `aria-hidden`, so the heart adds no text.
- `tests/e2e/navigation/dock.spec.ts` -- structure/fixtures to copy for the new spec (imports from `merged-fixtures`, `lastWelcomeView` init script).
- `_bmad-output/specs/spec-ui-refresh/mockups/Home.dc.html:15-20` -- reference markup for bar (heart 14px `accent`, Lora 600 19px `ink`, gear 20px `muted`) and dock (`glass`, blur 16px, `box-shadow: var(--float), 0 0 0 1px var(--line)`, pill `tint`/`accent` 600 14px, inactive 22px `muted`).

## Tasks & Acceptance

**Execution:**
- [x] `src/index.css` -- Lora import; `--kit-*` values light + dark (incl. card/float shadows); `@theme inline` mapping `--color-<token>: var(--kit-<token>)`, `--shadow-card`, `--shadow-float`, `--font-lora: 'Lora', serif`; body `bg-page` -- single token source
- [x] `src/utils/themes.ts` -- remove the inline body background -- it overrides the themed ground
- [x] `src/components/Navigation/AppNavigation.tsx` -- bar and dock `bg-glass` + 16px blur; dock `shadow-float ring-1 ring-line`; wordmark = lucide `Heart` 14px `fill-current text-accent` + "My Love" `font-lora italic font-semibold text-[19px] text-ink` with `data-testid="app-wordmark"` on the wrapper; gear `text-muted`, active `bg-tint text-accent`; dock inactive `text-muted` (hover `text-ink`), active pill `bg-tint text-accent`; badge `bg-fill` white 11px bold 20px pill; rewrite the colour comment -- CAP-10 + chrome on kit
- [x] `tests/e2e/navigation/kit-chrome.spec.ts` [P1] -- for light and dark (`page.emulateMedia({ colorScheme })`), after `--color-primary` is set on `<html>` (applyTheme ran): body `backgroundColor` is the `page` value and `backgroundImage` is `none`; wordmark computed `font-family` starts with `Lora`, `font-style` italic, and `document.fonts.check('italic 600 19px Lora')` is true after `document.fonts.ready` -- observes ground + wordmark at the rendered surface

**Acceptance Criteria:**
- Given light and dark OS themes, when any app view loads and settings hydrate, then the page ground is solid `#fdf4f7` / `#0b0e14` with no gradient.
- Given any app view, when it renders, then the top bar shows a pink heart plus "My Love" in Lora Italic 600 19px, and no chrome element uses Dancing Script.
- Given either theme, when a dock item or the gear is active, then it shows `tint` background with `accent` text/icon, inactive items are `muted`, and bar and dock are `glass` with blur — matching `mockups/Home.dc.html`.
- Given a component using `bg-card text-ink shadow-card` (etc.), when the OS theme flips, then the colours switch to the dark column without a `dark:` variant.
- Given unmigrated screens (Home cards, Mood, Partner, Notes, Photos, Settings, Sign in), when viewed after this change, then they still render with their existing classes (no removed class, no lost font).

## Spec Change Log

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 22 findings — high 0, medium 7, low 13, false 2, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) `document.fonts.check` passes with no Lora face loaded — confirmed by two reviewers in Chromium; replaced with `document.fonts.load(...).length > 0`.
  - `[medium]` `[patch]` (blind) `@theme inline` untested; dropping `inline` would turn `text-accent` into applyTheme's #FFD700 unnoticed — added a computed-colour assertion on active `nav-home` in both themes.
  - `[low]` `[reject]` (blind) `whiteOnColorContrast.test.ts` matches only `bg-<hue>-<shade>`, so `bg-fill text-white` escapes it — real, but `fill` is one fixed value (#db2777, 4.60:1 with white, recorded beside the token); teaching the guard to parse `--kit-*` is new parsing logic for a pairing that cannot drift per component.
  - `[low]` `[reject]` (blind) In dark, the active pill over an unmigrated white card scrolling under the 78% glass measures ~2.9:1 — transient: stories 2–8 move every card to `bg-card`; a fix would add per-state backgrounds to the chrome for an interim state.
  - `[medium]` `[patch]` (blind) `App.tsx:609,656` loading text `text-gray-600` sits directly on the new dark ground (~2.5:1) — caused by this change; both lines now `text-muted`.
  - `[low]` `[patch]` (blind) New comments cite `mockups/Home.dc.html` / `design-tokens.md`, which live in gitignored `_bmad-output/` — reworded to "the approved style kit".
  - `[low]` `[defer]` (blind) PWA manifest `theme_color #FF6B9D` / `background_color #FFE5EC` (`vite.config.ts:69-70`) stay pink, so dark launch splash and status bar are pink — pre-existing, and no story in spec-ui-refresh covers it; deferred.
  - `[low]` `[patch]` (blind) Wordmark heart kept lucide's stroke 2 over the fill (artboard: stroke 0) — `strokeWidth={0}`.
  - `[low]` `[patch]` (blind) `GLASS` comment said bar and dock never drift apart, but the dock adds saturation on purpose — comment reworded.
  - `[medium]` `[patch]` (edge) Dark `--kit-shadow-card: none` makes Tailwind's composed `box-shadow` list invalid (`none` cannot appear in a list), dropping rings/focus rings on any `shadow-card` element — now `0 0 #0000`.
  - `[medium]` `[patch]` (edge) Lora check ineffective — same root cause as the first row; same fix.
  - `[false]` `[reject]` (edge) `good #15803d` fails 4.5:1 on tinted fills — every artboard uses `good` only as an 8px dot (Notes "Online", Partner "Connected", whose text is `muted`); non-text needs 3:1, which it clears everywhere.
  - `[medium]` `[patch]` (verification-gap) Lora check ineffective — same root cause as the first row; same fix.
  - `[medium]` `[patch]` (verification-gap) No test observes `text-accent` surviving applyTheme — same root cause as the second row; same fix.
  - `[false]` `[reject]` (intent) Type roles and radii not defined as tokens — design-tokens.md labels only the Colour table rows as tokens (column "Token"); Type rows are "Role" and components are specs, not tokens.
  - `[low]` `[reject]` (intent) design-tokens.md still lists the three pre-fix light values — the fix edits the spec; the deviation and its reason sit beside the tokens in `src/index.css`, and later stories consume utilities, not hex.
  - `[low]` `[patch]` (intent) Chrome colours, wordmark weight and size not asserted — grouped with the second row; the E2E now also asserts wordmark `font-weight: 600` and `font-size: 19px`.
  - `[low]` `[reject]` (intent) Mood/Partner `bg-gray-50` and WelcomeSplash gradient still paint over the ground — out of scope by intent: stories 3, 5 and 8 own them.
  - `[low]` `[defer]` (intent) Manifest background colour — same root cause as the manifest row; deferred with it.
  - `[low]` `[reject]` (intent) Contrast guard cannot see kit tokens — same as the third row; same reason.
  - `[low]` `[reject]` (intent) Dark mode shows unmigrated light cards on the dark ground — accepted by the story's invocation note (unmigrated screens keep rendering until their stories).
  - `[low]` `[patch]` (intent) Dark card shadow `none` vs the mockup's faint inset — grouped with the shadow row; `0 0 #0000` keeps design-tokens.md's "dark none" visually while staying valid.

### 2026-09-22 — Review pass
- verdicts: 16 findings — high 0, medium 0, low 8, false 8, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) `document.fonts.load('italic 600 19px Lora').length > 0` still passes when only the italic 500 face or an upright face exists, because font matching settles for the nearest weight/style — the E2E now maps the returned faces to `{ style, weight }` and asserts one is `{ style: 'italic', weight: '600' }`; both themes pass.
  - `[low]` `[reject]` (blind) E2E asserts no glass/blur, tint pill, muted inactive items, gear active state or badge — the one `text-accent` assertion already exercises the same `@theme inline` → `--kit-*` path every other colour utility uses, and the verification-gap layer found no gap; per-state CSS assertions would be new test surface for class strings visible in `AppNavigation.tsx`.
  - `[false]` `[reject]` (blind) Kit misses `on-fill`, so the badge hardcodes `text-white` — every mockup sets `--on-fill: #ffffff` in both themes, so `text-white` renders identically; design-tokens.md and the intent's exhaustive utility list both leave it out.
  - `[low]` `[reject]` (blind) `--color-accent` names both the kit theme variable and applyTheme's inline gold — no code reads `var(--color-accent)` (grep of `src/`), `src/index.css:10-14` already documents the clash, and removing it means renaming applyTheme's variables, which a test reads as a hydration signal.
  - `[false]` `[reject]` (blind) `backdrop-blur-[16px]` duplicates `backdrop-blur-lg` — both are 16px in Tailwind v4; it renders identically, and the spec names the 16px value.
  - `[low]` `[patch]` (blind) `src/index.css` comments: `font-lora` was listed as resolving to a `--kit-*` variable, and "#c8216b (3.91:1 on tint)" read as if the new value failed — comment now says `font-lora` is the same in both themes and gives before → after ratios, measured with the WCAG formula (accent 3.91 → 4.60 on tint; muted 4.24 → 4.71 on card2, 4.48 → 4.97 on page; danger 4.23 → 4.72 on dtint).
  - `[false]` `[reject]` (edge) Dark ground leaves Mood/Partner `text-gray-900` headings on near-black — both roots are `min-h-screen bg-gray-50` (`MoodTracker.tsx:310`, `PartnerMoodView.tsx:344`), so that text sits on gray-50, not on the ground.
  - `[low]` `[reject]` (edge) Scrollbar stays pink on the dark ground — out of scope by intent: "Do not touch the scrollbar colours."
  - `[false]` `[reject]` (edge) Removing the body write left `--gradient-background` with no reader — the removed line used `theme.gradients.background` directly (baseline `themes.ts:84`), so the variable had no reader before this change either.
  - `[low]` `[reject]` (edge) carried — Light accent/muted/danger differ from design-tokens.md — the intent itself allows the three Design Notes fixes; later stories use the utilities, not hex values.
  - `[false]` `[reject]` (intent) `App.tsx` loading-text edit crosses "restyle no other view" — the loading screen is not a `ViewType` view, and the edit repairs a contrast failure this change's dark ground caused.
  - `[low]` `[patch]` (intent) carried — Dark `shadow-card` is `0 0 #0000`, not literal `none` — the previous pass applied this on purpose (a bare `none` inside Tailwind's composed `box-shadow` list is invalid); not re-patched.
  - `[low]` `[reject]` (intent) New spec covers only `page`, `accent` and the wordmark; the other tokens, glass, tint, badge and unmigrated screens are untested — same root cause as the second row; same reason. Unmigrated screens are covered by the manual screenshot check.
  - `[false]` `[reject]` (intent) Deleting the body write stops app themes from changing the ground — the intent requires the ground to come from `page`, and nothing in the UI calls `setTheme` (only `settingsSlice.ts` defines it).
  - `[false]` `[reject]` (intent) carried — Type roles and component specs are not tokens — design-tokens.md labels only the Colour rows as tokens.
  - `[false]` `[reject]` (intent) The font check proves a face loads, not that glyphs are drawn in Lora — the computed `font-family` starts with Lora and a matching face is loaded, so the browser draws with it. The weight/style part of the gap is the first row.

## Design Notes

**Light-theme contrast fixes.** SPEC requires text ≥ 4.5:1 in both themes, but three approved light values fail on the kit's own tinted fills (measured, WCAG formula): `accent #db2777` on `tint` 3.91:1 (active dock pill, secondary buttons, chips), `muted #6b7280` on `card2` 4.24:1 and on `page` 4.48:1 (segmented control, section labels), `danger #dc2626` on `dtint` 4.23:1 (destructive dialog action). Each is darkened along its own hue just far enough to clear 4.5:1 on every kit surface: `accent #c8216b` (≥4.60), `muted #646b78` (≥4.56), `danger #cf2121` (≥4.59). `fill` stays `#db2777` (white on it 4.60). Every dark value already passes (lowest 4.91) and is used as given. Record the three light deviations in a comment beside the tokens. Precedent: spec-bottom-dock-navigation deepened artboard colours for the same reason.

**Why `@theme inline` and `--kit-*`:** `@theme inline { --color-accent: var(--kit-accent); }` makes `text-accent` emit `color: var(--kit-accent)`, so the `prefers-color-scheme` override of `--kit-accent` flips it, and `applyTheme`'s inline `--color-accent` on `<html>` cannot reach it.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0
- `npm run test:unit` -- expected: all pass
- `fnox exec -- npm run build` then `grep -o 'kit-accent' dist/assets/*.css | head -1` -- expected: build exits 0 and the token is emitted
- `npx playwright test tests/e2e/navigation` (with `supabase start`) -- expected: all pass

**Manual checks:**
- `npm run dev:local`, 390×844, light and dark: screenshot Home, Mood, Notes, Photos, Partner, Settings; chrome matches the artboard, and every view still renders (dark screenshots may show unmigrated light surfaces on the dark ground — expected until their stories).


## Auto Run Result

Status: done (follow-up review pass)

**Summary:** Story 1 (committed as `adff43df`) adds the style kit: 16 colour tokens, 2 shadows and the Lora font. It paints the page ground from `page` and restyles the top bar and dock on the kit. This follow-up pass ran four reviewers over the diff from `5597e124b43a2374ff80372c2786e1b4abbf1f81`. It applied two low-severity patches: a stricter font test and corrected comments.

**Files changed (whole story):**
- `src/index.css` — Lora import; `--kit-*` light/dark values; `@theme inline` mapping; body `bg-page`. This pass also corrected two comments.
- `src/utils/themes.ts` — removed the inline body gradient.
- `src/components/Navigation/AppNavigation.tsx` — the chrome now uses the kit: heart + Lora wordmark, glass, tint/accent, badge.
- `src/App.tsx` — loading-screen text changed to `text-muted`.
- `tests/e2e/navigation/kit-chrome.spec.ts` — ground, accent and wordmark checks in both themes. This pass tightened the Lora face check to require italic 600.

**Review findings (this pass, 16):**
- Patches applied (2, both low): the Lora face check now needs `{ style: 'italic', weight: '600' }`; the `index.css` comments are corrected (`font-lora` does not change with the theme; contrast ratios are now given before → after).
- Carried (2): the dark `shadow-card` value and the three light-value deviations. Both were decided last pass and neither was re-patched.
- Deferred: none new. The existing manifest-colour entry is untouched.
- Rejected:
  - Chrome state CSS is not asserted (2 rows): the same `@theme inline` path is already proven by `text-accent`.
  - `--color-accent` name clash: nothing reads it, and the clash is documented in `index.css`.
  - Pink scrollbar in dark: the intent says not to touch scrollbar colours.
  - False (8): `on-fill` is white in both themes. `backdrop-blur-[16px]` is the same as `-lg`. Mood/Partner text sits on `bg-gray-50`. `--gradient-background` was unread before this change. The loading screen is not a view. Nothing calls `setTheme`. Type roles are not tokens. The font face is loaded and first in the computed family.

**Follow-up review recommendation:** false. This is a follow-up pass, and it patched no high findings (patched: high 0, medium 0, low 2).

**Verification (this pass):**
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0.
- `npm run test:unit` — 2013 passed, 6 failed, all in `tests/unit/a11y/whiteOnColorContrast.test.ts`. That test fails with ENOENT on `node_modules/tailwindcss/theme.css`, because this loop worktree's `node_modules` holds no packages (they resolve from the main checkout). The diff does not touch that test or the file it reads.
- `fnox exec -- npm run build` — exit 0; `kit-accent` is emitted in `dist/assets/index-*.css`.
- `npx playwright test tests/e2e/navigation` (local Supabase running) — 14 passed, including both `kit-chrome` tests (light and dark).
- Manual screenshot checks were not run on this pass.

**Residual risks:**
- In dark mode, unmigrated screens show light surfaces on the dark ground until stories 2–8.
- The PWA manifest colours stay pink (already deferred).
- The contrast unit test cannot run inside loop worktrees until they have their own `node_modules`.
