---
id: SPEC-ui-refresh
companions:
  - design-tokens.md
  - screens.md
  - ../../implementation-artifacts/spec-bottom-dock-navigation.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# My Love UI refresh — one visual language

## Why

A pain and a vision. The app grew screen by screen and no two screens match: five-plus pinks, coral chat, an indigo login, a red-gradient sign-out, four card styles, four dialog patterns, three component CSS files with clashing global class names, emoji mixed with icons — and dark mode that covers half the app, leaving dark cards on a pale pink page and whole views (Mood, Partner, Love Notes, Photos) fully light. Partner even overflows the phone width. Sallvain approved a redesign of every screen on one style kit, built on the new bottom-dock chrome (`spec-bottom-dock-navigation`); the approved artboards are in `mockups/`.

## Capabilities

- **CAP-1**
  - **intent:** Every screen draws colour, type, radius and components from one shared style kit (`design-tokens.md`).
  - **success:** No raw hex, `coral-*`, indigo or gradient colour remains in `src/components/` outside the token source; every card, button, chip, input and dialog is a kit component.
- **CAP-2**
  - **intent:** Every user-facing surface, page ground included, follows the OS light/dark theme.
  - **success:** 390×844 dark-mode screenshots of every screen show no light surface and no pink ground.
- **CAP-3**
  - **intent:** Home shows four uniform countdown cards and a restyled daily-message card.
  - **success:** Matches `mockups/Home.dc.html` in both themes (countdowns share layout and value size; message in Lora Italic; no decorative emoji).
- **CAP-4**
  - **intent:** Mood uses the kit title, a segmented control, violet icon chips for the partner's mood, and a tile grid with a pink selected state.
  - **success:** Matches `mockups/Mood.dc.html`; no emoji represents a mood anywhere in the app.
- **CAP-5**
  - **intent:** Love Notes has one chrome, a partner row, kit bubbles and a pill composer.
  - **success:** Matches `mockups/Notes.dc.html`; the in-view header bar is gone; send button and own bubble are the same pink.
- **CAP-6**
  - **intent:** Partner fits the phone and presents name, connection, current mood, three action tiles with History, and recent moods.
  - **success:** `document.documentElement.scrollWidth === clientWidth` on Partner at 390px; matches `mockups/Partner.dc.html`.
- **CAP-7**
  - **intent:** Photos has a titled grid with an Upload button in the header, and the empty state only when there are no photos.
  - **success:** Matches both `hasPhotos` states of `mockups/Photos.dc.html`; no floating upload FAB.
- **CAP-8**
  - **intent:** Settings is grouped list cards with a quiet destructive Sign out, and About carries a "Replay welcome message" row (the floating Home heart button is removed).
  - **success:** Matches `mockups/Settings.dc.html` plus the replay row, which opens the existing welcome splash; `Settings.css` deleted; no duplicate section headings; no floating button on Home.
- **CAP-9**
  - **intent:** Sign in matches the rest of the app.
  - **success:** Matches `mockups/SignIn.dc.html`; `LoginScreen.css` deleted.
- **CAP-10**
  - **intent:** The top bar wordmark is a pink heart plus "My Love" in Lora Italic 19px.
  - **success:** No Dancing Script renders anywhere; the font import is removed.
- **CAP-11**
  - **intent:** Surfaces without an artboard — dialogs, sheets, confirms, toasts, banners, spinners, error screens, display-name setup, welcome splash — follow the kit with one dialog pattern.
  - **success:** Each renders on kit tokens in both themes; `DisplayNameSetup.css` deleted; the four photo/note dialog styles collapse to one.

## Constraints

- Tokens are defined once in `src/index.css` as Tailwind v4 utilities with dark values under `prefers-color-scheme`; components never use raw hex or palette shades for surfaces, text or accents.
- Colour semantics are fixed: pink = you and actions; violet = partner identity; green = online; red = destructive only. Text contrast ≥ 4.5:1 in both themes.
- Fonts: Inter body; Playfair Display page titles only; Lora Italic wordmark and daily message only; numbers never in a serif.
- Icons are lucide-react only; no emoji in UI chrome or mood display. User-authored message content is untouched.
- Existing data-testids, aria labels and roles keep working; a moved element keeps its testid.
- A component CSS file is deleted only after its screen renders from the kit.
- The mood-to-icon/colour map exists once and is shared (four copies disagree today).
- Layout relies on no chrome height beyond `--dock-clearance` and the 4rem top bar.
- Depends on `spec-bottom-dock-navigation` being merged first.

## Non-goals

- No new features: no photo filters or grouping, no new partner actions, no manual theme toggle, no navigation change beyond the dock spec.
- No data, schema, store or API change — presentational only (the Partner overflow is a layout fix).
- AdminPanel is not restyled (admin-only).

## Success signal

- Screenshot every screen at 390×844 in light and dark: each is recognisably its approved artboard, and a grep of `src/components/` finds no `#[0-9a-fA-F]{3,6}`, `coral-`, `from-*`/`to-*` gradients or `font-cursive`.

## Assumptions

- `CountdownTimer` (anniversary countdowns in DailyMessage) adopts the CAP-3 countdown card; it had no artboard.
- Surfaces listed in CAP-11 had no artboard and follow the kit.
- Photo placeholders on the artboard stand in for real thumbnails.
