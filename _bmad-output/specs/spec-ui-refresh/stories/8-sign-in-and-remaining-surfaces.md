---
title: 'Sign in and remaining surfaces'
type: 'feature'
created: '2026-09-22'
status: 'done'
review_loop_iteration: 1
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      DisplayNameSetup input shows no danger ring while aria-invalid is true.
    evidence: |-
      DisplayNameSetup.tsx passes fieldClass(false); the deleted DisplayNameSetup.css never styled aria-invalid either, so this predates the story. Login now uses fieldClass(Boolean(error)).
    location: >-
      src/components/DisplayNameSetup/DisplayNameSetup.tsx:268
    severity: low
  - summary: >-
      ErrorBoundary fallback crashes if a non-Error value is thrown.
    evidence: |-
      render() calls this.state.error?.message.includes(...); a thrown string or plain object has no message, so .includes on undefined throws inside the root boundary's own fallback. Unchanged pre-existing lines.
    location: >-
      src/components/ErrorBoundary/ErrorBoundary.tsx:46
    severity: medium
  - summary: >-
      Kit dialogs (DisplayNameSetup included) cannot scroll when the panel is taller than a short viewport.
    evidence: |-
      DIALOG_BACKDROP is fixed and centred with no overflow, and DIALOG_PANEL has no max-height; with a landscape phone or an open keyboard the title or submit can sit off-screen. The deleted overlay CSS had the same shape.
    location: >-
      src/components/Settings/kitClasses.ts (DIALOG_BACKDROP / DIALOG_PANEL)
    severity: low
  - summary: >-
      ErrorBoundary error message box has no height limit and centres monospace text.
    evidence: |-
      The box has no max-h/overflow or text-left (ViewErrorBoundary has both); a long message pushes the buttons down. Pre-existing layout.
    location: >-
      src/components/ErrorBoundary/ErrorBoundary.tsx:66
    severity: low
  - summary: >-
      "Loading your data..." screen has no test on its kit heart.
    evidence: |-
      Only the auth loader is asserted (tests/unit/App.eventsSession.test.tsx:271-274); no test renders App with isLoading true, so the data loader could regress to an emoji unnoticed.
    location: >-
      src/App.tsx:657
    severity: low
  - summary: >-
      "Contact admin" stays enabled while the Google redirect is pending.
    evidence: |-
      The button is disabled={isLoading} only, so during "Redirecting to Google..." a click shows the sign-up message beside a spinning Google pill. Pre-existing condition.
    location: >-
      src/components/LoginScreen/LoginScreen.tsx:320
    severity: low
baseline_revision: '89f69b1b44bb4f23028da23f8367ed4506dfe8d1'
---

<intent-contract>

## Intent

**Problem:** Sign in still wears an indigo gradient from `LoginScreen.css`, and the surfaces with no artboard — display-name setup, welcome splash, both error boundaries, the sync toast, the offline banner and App's loading screens — use gray/white light-only boxes, pink gradients, raw hex and emoji, so they ignore dark mode and the kit (CAP-9, rest of CAP-11).

**Approach:** Rebuild LoginScreen to match `mockups/SignIn.dc.html` and move the other surfaces onto kit tokens, reusing the class strings in `src/components/Settings/kitClasses.ts`; then delete `LoginScreen.css` and `DisplayNameSetup.css`. Presentational only.

## Boundaries & Constraints

**Always:** kit tokens only (`bg-page/card/card2/field/tint/dtint`, `text-ink/muted/accent/danger/good`, `border-line`, `shadow-card/float`), no `dark:` variants; lucide icons only; every existing `data-testid`, `role`, `aria-*`, `htmlFor`/`id` pair and behaviour (validation, callback notice, Escape/cancel rules, auto-dismiss, retry/clear-storage) keeps working; colour semantics: pink = actions, green = online/success, red = destructive or failure only.

**Never:** change auth, store, API or copy beyond what the artboard shows; touch `index.css` component classes, `tailwind.config.js` or Dancing Script (story 9); restyle AdminPanel; raw hex, `from-*`/`to-*` gradients, `gray-*`/`slate-*`/`red-*`/`green-*`/`yellow-*` palette classes, or emoji in any touched file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sign in, light/dark | signed out, 390×844 | `page` ground, heart + "My Love" Lora Italic 34px, "Welcome back — sign in to continue", kit card with Email/Password, pink "Sign in", OR divider, `card2` "Continue with Google", "Need an account? Contact admin" | no horizontal overflow |
| Sign-in error | bad credentials / validation | `login-error` `role="alert"` on `dtint` + `danger` with lucide icon, inside the card | unchanged messages |
| Callback notice | `callbackOutcome` set | `login-notice` `role="status"` on `card2`, `ink` text, lucide `Info` | retired on next attempt, as today |
| Offline / connecting | `useNetworkStatus` | banner on `card2` + bottom `line`; offline dot/icon `muted`, connecting `accent` + spin; online compact dot `good` | none |
| Sync toast | success / partial / all failed / none | `card` toast, `line` border, `shadow-float`; icon `good` / `accent` / `danger` / `muted`; text `ink` | dismiss button keeps `aria-label` |

</intent-contract>

## Code Map

- `src/components/LoginScreen/LoginScreen.tsx` -- 379 lines; markup at :169-377 uses `LoginScreen.css` classes and inline spinner/Google SVGs with hex fills. Heading today `<h1>Welcome Back</h1>`; artboard makes the wordmark the heading.
- `src/components/LoginScreen/LoginScreen.css` -- delete; its classes are used nowhere else (grep).
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx` -- markup :180-327; title "Welcome! 👋"; used by App signup gate (`src/App.tsx:636`) and Settings edit (`Settings/Settings.tsx:280`). Unit tests assert heading text contains "Welcome!", dialog role/accessible name, testids — no class asserts.
- `src/components/DisplayNameSetup/DisplayNameSetup.css` -- delete.
- `src/components/Settings/kitClasses.ts` -- reuse `DIALOG_BACKDROP`, `DIALOG_PANEL`, `DIALOG_TITLE`, `PRIMARY_BUTTON`, `SECONDARY_BUTTON`, `DESTRUCTIVE_BUTTON`, `FIELD_LABEL`, `FAILURE_BOX`, `NOTICE`, `fieldClass()`; widen its header comment to name the new consumers.
- `src/components/WelcomeSplash/WelcomeSplash.tsx` -- gradient ground, emoji rain, `.card`, gradient heading/button.
- `src/components/ErrorBoundary/ErrorBoundary.tsx` -- gray/white card, emoji, gradient button; mounted in `main.tsx:42` and App.
- `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx` -- same; testids `view-error-boundary`, `error-go-home`, `error-try-again`.
- `src/components/shared/SyncToast.tsx` -- green/yellow/red/gray palette config at :80-120; keep position `top-[calc(5rem+env(safe-area-inset-top))]`.
- `src/components/shared/NetworkStatusIndicator.tsx` -- raw `#FF6B6B/#FCC419/#51CF66` at :57-99 and header comment; keep `data-status`, `role`, `aria-label`.
- `src/App.tsx:606-613, 651-658` -- auth/data loading screens show a 💕 emoji; keep the `Loading...` / `Loading your data...` text (E2E matches it exactly).
- `tests/e2e/auth/bootstrap-notification-order.spec.ts:92` -- asserts heading `Welcome Back`; update to the new heading name `My Love`.
- `tests/e2e/settings/settings-kit.spec.ts` -- pattern for a 390×844 both-theme kit E2E (`emulateMedia`, computed colours); signed-out specs use `test.use({ authSessionEnabled: false })`.

## Tasks & Acceptance

**Execution:**
- `src/components/LoginScreen/LoginScreen.tsx` -- rebuild per artboard: full-height `bg-page` column centred, max width ~400px; `<h1>` wordmark (filled lucide `Heart` 24px `accent` + "My Love" `font-lora italic font-semibold text-[34px] text-ink`); 15px `muted` subtitle; one kit card (radius 20, `line` border, `shadow-card`, p-5, gap 14px) holding the form (labels 13px 600, `fieldClass(Boolean(error))` inputs, so the danger ring mirrors `aria-invalid` as the deleted `.form-input[aria-invalid='true']` rule did), primary "Sign in" (spinner = lucide `Loader2`), OR divider (12px 600 tracking .08em `muted`, `line` rules), `card2`/`ink` 48px pill "Continue with Google" (no multicolour logo); footer 14px `muted` "Need an account?" + `accent` 600 "Contact admin" button; error/notice per matrix; drop the CSS import -- CAP-9.
- `src/components/LoginScreen/LoginScreen.css`, `src/components/DisplayNameSetup/DisplayNameSetup.css` -- delete after their components render from the kit.
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx` -- kit dialog (backdrop, `card` panel `max-w-md`, Inter 600 18px title, 14px `muted` subtitle), kit label/input, 13px `muted` hint, `FAILURE_BOX` error, Cancel = secondary pill, submit = primary pill with `Loader2`; title "Welcome!" (emoji dropped).
- `src/components/WelcomeSplash/WelcomeSplash.tsx` -- `bg-page` ground; rain of lucide `Heart` icons in `accent` at low opacity (motion kept); kit card; `Heart` 80px `accent`; heading Playfair (`font-serif`) 600 30px `ink`; caption Inter 15px `ink` (kit body size); primary pill Continue with `ArrowRight`; testids kept.
- `src/components/ErrorBoundary/ErrorBoundary.tsx`, `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx` -- `bg-page` ground (full-screen one only), kit card with `p-5` (kit card padding is 12–20px; same for the splash card), 40px radius-12 icon tile (`tint`/`accent`: `HeartCrack`/`TriangleAlert`/`WifiOff`) replacing emoji, `ink` Inter 600 18px title in both boundaries, `muted` body, error text in `card2` box; Try Again primary, Go Home secondary, Clear Storage & Reload destructive.
- `src/components/shared/SyncToast.tsx`, `src/components/shared/NetworkStatusIndicator.tsx` -- per matrix; dismiss is a transparent `muted` 44px (`h-11 w-11`) kit icon button.
- `src/App.tsx` -- loading screens: filled lucide `Heart` `accent` `animate-pulse` in place of 💕.
- `tests/unit/App.eventsSession.test.tsx` -- while the auth loader shows (before the session lookup resolves), assert its container holds an `svg` with `text-accent` and no `\p{Extended_Pictographic}` character.
- `tests/unit/a11y/whiteOnColorContrast.test.ts` -- lower the two canary minimums to just under the new counts, per that file's own instruction (they were 17 pairings / 14 stops before this story; measure after), and record the counts in its comment.
- `src/components/LoginScreen/__tests__/LoginScreen.kit.test.tsx` (new) and `src/components/shared/__tests__/kitSurfaces.test.tsx` (new) -- render each surface (error + notice states, toast variants, offline/connecting/online, both boundaries' fallbacks, splash, setup dialog) and assert kit classes present, and no emoji / hex (`#[0-9a-fA-F]{3,8}`) / gradient / `bg-white` / palette class (`gray|slate|red|green|yellow|pink|rose|indigo|purple|violet|blue|amber|orange|emerald`) in `container.innerHTML`.
- `tests/e2e/auth/login-kit.spec.ts` (new) and `tests/e2e/auth/bootstrap-notification-order.spec.ts` -- signed-out, 390×844, light and dark: the `login-screen` root's background-color = kit `page` and background-image `none` (not `body`, which is `bg-page` app-wide), card = kit `card`, submit background = `rgb(219, 39, 119)`, wordmark font-family contains Lora, `scrollWidth === clientWidth`; update the heading assertion.

**Acceptance Criteria:**
- Given the repo, when grepping touched component files for `#[0-9a-fA-F]{3,6}`, `from-`/`to-`/`via-` gradients, `gray-|slate-|red-|green-|yellow-|pink-|rose-|indigo-` or emoji, then nothing matches, and `LoginScreen.css` / `DisplayNameSetup.css` no longer exist.
- Given a signed-out visit at 390×844 in dark mode, when the login screen renders, then no light surface or pink ground shows and it is recognisably `mockups/SignIn.dc.html`.
- Given any existing unit or E2E test of these surfaces, when run, then it passes (only the `Welcome Back` heading assertion and the contrast canary minimums change).

## Spec Change Log

### 2026-09-22 — Review loop 1 (bad_spec)
- **Triggering findings:** (1) the spec prescribed `fieldClass(false)` for the login inputs, which dropped the red ring the deleted `.form-input[aria-invalid='true']` rule drew on a failed sign-in while `aria-invalid` stays set; (2) the spec prescribed a 17px splash caption, off the kit's 15px body size, against "the rest follow design-tokens.md".
- **Amended (Tasks & Acceptance only):** login inputs use `fieldClass(Boolean(error))`; splash caption 15px. Folded in this pass's patch-level findings so re-derivation does not repeat them: boundary and splash cards `p-5`, 40px icon tiles, 18px titles in both boundaries, 44px toast dismiss button; the no-off-kit helper also rejects 8-digit hex, `bg-white` and `purple|violet|blue|amber|orange|emerald`; the E2E reads the `login-screen` root's background (not `body`) and `background-image: none`; a unit assertion on App's auth loader heart; the contrast-canary edit is now a listed task and allowed by the third AC.
- **Known-bad state avoided:** a failed sign-in whose fields look valid; a splash caption off the type scale; kit sizes chosen per file instead of from design-tokens.md.
- **KEEP:** everything else in attempt 1 held up in review and must survive: the LoginScreen structure and copy from the artboard (h1 wordmark "My Love", subtitle, card with notice/error/fields/Sign in/OR/Google pill without logo, "Need an account? Contact admin" footer, `Loader2` spinners, `FIELD_DISABLED` dimming, `mt-1 w-full` submit); DisplayNameSetup on `DIALOG_BACKDROP`/`DIALOG_PANEL max-w-md`/`DIALOG_TITLE`, `grid gap-5` form, secondary Cancel + primary submit with the `w-full` for the bare gate, "Welcome!" title; WelcomeSplash lucide heart rain in `text-accent` with `style` width/height, the button inside a `motion.div` wrapper so framer's inline opacity does not fight the kit hover; boundaries' `grid gap-3` action column (PILL's `flex-1` has no height in a flex column), `type="button"` on buttons, `break-words` error text in `card2`; SyncToast `rounded-[20px] border-line bg-card shadow-float` with icon-only colour and `CircleCheck`/`CircleAlert`; NetworkStatusIndicator `card2` strip + `border-line`, `ink` label, header comment explaining the colour choice; kitClasses header comment naming the new consumers; `bootstrap-notification-order.spec.ts` heading `My Love`; test files `LoginScreen.kit.test.tsx`, `kitSurfaces.test.tsx` (framer-motion Proxy mock), `login-kit.spec.ts`. The contrast canary counts measured in attempt 1 were 10 pairings and 8 gradient stops (minimums `> 8` and `> 6`); `tests/unit/a11y/whiteOnColorContrast.test.ts` cannot read `node_modules/tailwindcss/theme.css` inside this worktree (ENOENT, install layout), so verify it with a temporary copy pointed at `/Users/sallvain/Projects/My-Love/node_modules/tailwindcss/theme.css`, then delete the copy.

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 28 findings — high 0, medium 1, low 22, false 5, maybe-false 0
- findings:
  - `[low]` `[bad_spec]` Login inputs show no invalid ring though `aria-invalid` is set (blind) — deleted CSS drew `border-color: #ef4444` on `.form-input[aria-invalid='true']`; spec prescribed `fieldClass(false)`. Amended to `fieldClass(Boolean(error))`.
  - `[low]` `[reject]` "Contact admin" message shows in the red failure box (blind) — pre-existing: the old `.login-error` box was red too; rarely clicked, and a fix needs a separate notice state.
  - `[low]` `[reject]` Google "G" logo dropped against Google branding guidance (blind) — the intent is to match the artboard, which shows no logo.
  - `[low]` `[patch]` E2E page-ground check reads `body`, which is `bg-page` app-wide (blind) — true (`src/index.css` body rule); moot under bad_spec, folded into the amended E2E task.
  - `[low]` `[reject]` Lora check reads the declared font family, not a loaded face (blind) — a `document.fonts` check would tie the E2E to the Google Fonts network; declared family is what the spec asks.
  - `[low]` `[patch]` No-off-kit helper misses purple/blue/amber, `bg-white`, 8-digit hex (blind) — true; moot, folded into the amended unit-test task (`bg-black` stays allowed: it is the kit backdrop).
  - `[false]` `[reject]` Display-name edit row now splits Cancel/Save 50/50 (blind) — that is the one kit dialog pattern (`PILL` `flex-1`) every other kit dialog uses, which CAP-11 asks for.
  - `[false]` `[reject]` Display-name dialog now under the sync toast (blind) — every kit dialog is `z-50` under the `z-[100]` toast app-wide; a toast over a scrim is the app's convention, not a defect of this dialog.
  - `[low]` `[reject]` No test renders the loading/spinner branches (blind) — unlikely to regress; fix is new tests, not a correction.
  - `[low]` `[reject]` Contrast-canary lowering hides that main was already red at 17 pairings (blind) — the edit follows the file's own "re-set as each kit story styles pairings out"; recorded in Auto Run Result.
  - `[low]` `[reject]` Google pill and Contact-admin link write classes by hand; no neutral pill constant (blind) — needs a new export in kitClasses; no named caller that diverges today.
  - `[false]` `[reject]` Partial sync failure looks like success (blind) — partial uses `CircleAlert`, success `CircleCheck`, and the message names the failed count.
  - `[low]` `[bad_spec]` Login fields always `fieldClass(false)` (edge) — same defect as the first row; same amendment.
  - `[low]` `[defer]` DisplayNameSetup input shows no invalid ring (edge) — pre-existing: the deleted `DisplayNameSetup.css` had no `aria-invalid` rule; moot this pass (bad_spec), re-check next pass.
  - `[low]` `[defer]` DisplayNameSetup panel can overflow a short viewport with no scroll (edge) — pre-existing: old overlay had no `max-height`/`overflow` either; moot this pass.
  - `[medium]` `[defer]` ErrorBoundary fallback crashes if a non-Error is thrown (`message.includes` on undefined) (edge) — pre-existing, unchanged lines; moot this pass.
  - `[low]` `[bad_spec]` Deleted invalid-field CSS rules dropped (edge) — same defect as the first row; same amendment.
  - `[false]` `[reject]` Removed `z-index: 9999` lets the toast over the scrim (edge) — same refutation as the blind z-index row.
  - `[low]` `[reject]` Spec claim "only the heading assertion changes" misses the contrast-canary edit (edge) — the fix is a spec edit; the amendment now lists that task anyway.
  - `[low]` `[patch]` App.tsx loader heart has no rendered-markup test (verification-gap) — filed pre-verified; moot, folded into the amended tasks as an `App.eventsSession.test.tsx` assertion.
  - `[false]` `[reject]` whiteOnColorContrast cannot run in this worktree (verification-gap, other) — install layout (no local `node_modules/tailwindcss`); a copy pointed at the main checkout's palette passes 6/6.
  - `[low]` `[patch]` Error-boundary icon tiles 48px, kit says 36–40px (intent) — moot, folded (40px).
  - `[low]` `[patch]` SyncToast dismiss 36px, kit icon button 44px (intent) — moot, folded (`h-11 w-11`).
  - `[low]` `[patch]` Boundary and splash cards padded 24–32px, kit says 12–20px (intent) — moot, folded (`p-5`).
  - `[low]` `[bad_spec]` Splash caption 17px, kit body 15px (intent) — spec prescribed 17px; amended to 15px.
  - `[low]` `[patch]` Boundary titles 20px vs 18px (intent) — moot, folded (18px both).
  - `[low]` `[reject]` Tests check class names more than the rendered artboard in both themes (intent) — screenshot comparison stays a manual check; E2E per theme already covers ground, card, fill, font and overflow.
  - `[low]` `[reject]` Contrast-canary edit outside the spec's stated test changes (intent) — duplicate of the edge claim row; amendment lists it.

### 2026-09-22 — Review pass
- verdicts: 33 findings — high 0, medium 0, low 22, false 11, maybe-false 0
- findings:
  - `[low]` `[patch]` Login root lost the bottom safe-area padding (blind) — deleted `.login-screen` had `padding-bottom: calc(1rem + env(safe-area-inset-bottom))` under `viewport-fit=cover`. Fixed: root is `pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]`.
  - `[low]` `[reject]` Non-field errors (Contact admin, Google failure) now ring both fields red (blind) — parity with the deleted rule, which keyed on the same `aria-invalid` that every error set; both triggers are rare and a fix needs a new field-error state.
  - `[low]` `[defer]` DisplayNameSetup shows no invalid ring (blind) — carried: pre-existing, deleted CSS had no `aria-invalid` rule.
  - `[low]` `[defer]` ErrorBoundary message box has no height limit and centres monospace text (blind) — pre-existing: the old box had neither `max-h` nor `text-left`.
  - `[low]` `[reject]` Pass 1 deferrals not recorded anywhere lasting (blind) — pass 1 was a bad_spec loop, so its defers were moot; this pass records them in `deferred`. The fix is a spec edit.
  - `[false]` `[reject]` Big splash heart not hidden from screen readers (blind) — lucide-react 1.47 adds `aria-hidden="true"` by default when no a11y prop is passed (`buildLucideIconNode.mjs:48`).
  - `[low]` `[patch]` 18px above Sign in vs the artboard's 32px; inputs 16px vs 14px side padding (blind) — gap fixed with `mt-[18px]`; padding kept: `fieldClass` is the kit's shared input and design-tokens.md sets no padding.
  - `[low]` `[reject]` Off-kit helper duplicated in two test files (blind) — a shared helper is a new module; no named caller diverges today.
  - `[low]` `[patch]` PALETTE misses lime/teal/cyan/sky/fuchsia/zinc/neutral/stone and decoration/caret/accent (blind) — added to both copies.
  - `[low]` `[patch]` E2E never reads input or Google-pill surfaces in dark (blind) — added `field` and `card2` background assertions in both themes.
  - `[low]` `[defer]` "Loading your data..." screen untested (blind) — same gap as the verification-gap row; needs a new App test holding `isLoading`.
  - `[low]` `[patch]` Stale "byte-identical" comment in DisplayNameSetup (blind) — reworded to say the gate renders a bare full-width submit with no actions row.
  - `[low]` `[reject]` Spec's colour rule contradicted by accent on connecting/partial/error tiles (blind) — prescribed by the intent-contract matrix; the fix is a spec edit.
  - `[low]` `[reject]` kitClasses lives under `Settings/` though now app-wide (blind) — moving it touches every consumer; a move breaks loudly at compile time, and story 9 is the sweep.
  - `[low]` `[defer]` DisplayNameSetup input keeps `fieldClass(false)` (edge) — carried: same as the blind row; pre-existing.
  - `[low]` `[defer]` "Contact admin" stays enabled while the Google redirect spins (edge) — pre-existing unchanged `disabled={isLoading}`.
  - `[false]` `[reject]` Sync toast above the display-name scrim after `z-9999` removal (edge) — carried: every kit dialog is `z-50` under the `z-[100]` toast.
  - `[low]` `[patch]` Login safe-area padding dropped (edge) — same defect as the first row; same fix.
  - `[low]` `[defer]` Data loader heart has no rendered-markup test (verification-gap) — filed pre-verified, disposition defer.
  - `[low]` `[patch]` Login safe-area padding dropped (verification-gap, other) — same defect as the first row; same fix.
  - `[false]` `[reject]` whiteOnColorContrast cannot run in this worktree (verification-gap, other) — carried: install layout; 6/6 pass against the main checkout's palette.
  - `[low]` `[patch]` Space above Sign in 18px vs 32px (intent) — same as the blind gap row; fixed.
  - `[low]` `[reject]` Input padding 16px vs artboard 14px (intent) — `fieldClass` is the shared kit input; design-tokens.md specifies none.
  - `[false]` `[reject]` "Contact admin" is `accent` where the artboard leaves the default link colour (intent) — the browser default blue is off-kit; the artboard sets no colour.
  - `[false]` `[reject]` Dark card shadow differs from the artboard (intent) — the `--kit-shadow-card` token predates this diff and follows design-tokens.md ("dark none").
  - `[false]` `[reject]` Wordmark is an `<h1>` where the artboard uses a div (intent) — the artboard has no semantics; the login screen needs a heading, and the E2E asserts it.
  - `[low]` `[reject]` Tests check class names more than the rendered artboard (intent) — carried from pass 1.
  - `[false]` `[reject]` `danger` used for failures vs design-tokens' "destructive only" (intent) — the intent contract says "destructive or failure", and `FAILURE_BOX` is the kit's failure surface from story 7.
  - `[false]` `[reject]` Partial sync shown in pink `accent` (intent) — prescribed by the intent-contract matrix; icon shape (`CircleAlert`) and text carry the failure.
  - `[false]` `[reject]` ErrorBoundary error text in `font-mono` (intent) — unchanged pre-existing styling for an error dump, not a type-scale role.
  - `[false]` `[reject]` DIALOG_PANEL has no `border-line` (intent) — that is the kit Dialog entry and the one dialog pattern stories 6–7 established.
  - `[false]` `[reject]` CAP-11 app-wide surfaces (unused `PhotoUploader.tsx`) not covered (intent) — unused-component removal is story 9's scope.
  - `[low]` `[reject]` Contrast-canary edit is unrelated to the intent (intent) — carried: listed task; a side effect the file itself asks for.

## Design Notes

Kit has no warning colour and `danger` is for destructive/failure only, so "offline" is a neutral `muted` state and "connecting" is `accent`; green stays "online". The multicolour Google logo is dropped because the artboard shows none and its brand hex would fail the CAP-1 grep.

## Verification

**Commands:**
- `npm run typecheck && npm run lint` -- expected: exit 0
- `npx vitest run src/components tests/unit` -- expected: all pass
- `npx playwright test tests/e2e/auth --project=chromium` (with `supabase start` running) -- expected: all pass

**Manual checks (if no CLI):**
- Screenshot login at 390×844 light and dark via `npm run dev:local`, compare with `mockups/SignIn.dc.html`.

## Auto Run Result

Status: done

**Summary:** Sign in rebuilt to `mockups/SignIn.dc.html` (page ground, "My Love" Lora wordmark heading, one kit card with fields, pink "Sign in", OR divider, neutral "Continue with Google" pill, "Need an account? Contact admin"), and the surfaces with no artboard (display-name dialog, welcome splash, both error boundaries, sync toast, offline banner, App loading screens) moved onto kit tokens. `LoginScreen.css` and `DisplayNameSetup.css` deleted. Presentational only.

**Files changed:**
- `src/components/LoginScreen/LoginScreen.tsx` — artboard rebuild; danger ring mirrors `aria-invalid`; safe-area bottom padding kept.
- `src/components/LoginScreen/LoginScreen.css`, `src/components/DisplayNameSetup/DisplayNameSetup.css` — deleted.
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx` — kit dialog, field, failure box, pills; "Welcome!" without emoji.
- `src/components/WelcomeSplash/WelcomeSplash.tsx` — page ground, lucide heart rain, kit card, Playfair heading, 15px caption, primary pill.
- `src/components/ErrorBoundary/ErrorBoundary.tsx`, `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx` — kit card, 40px icon tile, kit buttons (destructive Clear Storage).
- `src/components/shared/SyncToast.tsx`, `src/components/shared/NetworkStatusIndicator.tsx` — kit card toast with icon-only colour; neutral banner, no raw hex.
- `src/App.tsx` — loading screens use a lucide accent heart.
- `src/components/Settings/kitClasses.ts` — header comment names the new consumers.
- Tests: new `LoginScreen.kit.test.tsx`, `shared/__tests__/kitSurfaces.test.tsx`, `tests/e2e/auth/login-kit.spec.ts`; `App.eventsSession.test.tsx` loader assertion; `bootstrap-notification-order.spec.ts` heading "My Love"; `whiteOnColorContrast.test.ts` canary minimums lowered to `> 8` / `> 6` (measured 10 pairings / 8 stops). Note: that canary's `> 24` was already failing on main before this story (17 pairings after story 7).

**Review findings:** pass 1 (28 findings) looped once as bad_spec (login `fieldClass(false)` and 17px splash caption were spec-prescribed); patch-level findings folded into the amended spec. Pass 2 (33 findings): 5 patch entries applied (safe-area padding, 32px gap above Sign in, stale comment, wider palette regex, E2E field/pill surfaces) — all `low`; 6 items deferred (see frontmatter); every rejected finding and its reason is in the Review Triage Log.

**Follow-up review recommended:** false — patched this pass: high 0, medium 0, low 5.

**Verification:** `npm run typecheck` 0; `npm run lint` 0; `npx vitest run src/components tests/unit` 1945 passed, 6 failed — all 6 in `whiteOnColorContrast.test.ts` from ENOENT on `node_modules/tailwindcss/theme.css` in this worktree (install layout); a temporary copy pointed at the main checkout's palette passed 6/6. E2E chromium (auth specs except `token-persistence-overlap.spec.ts`, which cannot load here for the same install reason, plus welcome-splash and settings-kit): 30 passed, 1 failed — `login.spec.ts:54`, a 401 on `local_data_uploads` that also failed 5 of 6 runs on the unchanged baseline. The implementation agent screenshotted login at 390×844 in light, dark and dark-with-error.

**Residual risks:** the pre-existing `login.spec.ts:54` flake; splash, dialog and error screens were checked by class assertions, not in a browser; deferred items above.
