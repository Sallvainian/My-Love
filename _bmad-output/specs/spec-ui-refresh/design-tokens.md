# Design tokens and components

Values are the approved style kit (`mockups/StyleKit.dc.html`); every artboard in `mockups/` uses exactly these. Define them once in `src/index.css` and expose them as Tailwind utilities (e.g. `bg-card`, `text-ink`, `text-muted`, `bg-tint`, `border-line`), with dark values under `@media (prefers-color-scheme: dark)`.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| page | `#fdf4f7` | `#0b0e14` | body/page ground (replaces the pink gradient, `index.css:15`) |
| card | `#ffffff` | `#141925` | every card, sheet, dialog |
| card2 | `#f6eef2` | `#1c2230` | raised/secondary fill: segmented track, neutral icon buttons, photo placeholders |
| ink | `#1f2430` | `#f3f4f6` | primary text |
| muted | `#6b7280` | `#9aa3b2` | supporting text, inactive icons |
| accent | `#db2777` | `#f472b6` | pink text/icons on surfaces |
| fill | `#db2777` | `#db2777` | pink button/bubble fill; white text on it |
| tint | `#fce7f3` | `rgba(244,114,182,.14)` | pink tinted backgrounds (icon tiles, secondary buttons, active dock item) |
| partner | `#7c3aed` | `#a78bfa` | partner identity text/icons/avatars |
| ptint | `#f1eafe` | `rgba(167,139,250,.16)` | partner tinted backgrounds |
| good | `#15803d` | `#4ade80` | online / connected dot |
| danger | `#dc2626` | `#f87171` | destructive text/icons only |
| dtint | `#fdecec` | `rgba(248,113,113,.12)` | destructive tinted background |
| line | `rgba(157,23,77,.09)` | `rgba(255,255,255,.07)` | 1px hairlines and card edges |
| glass | `rgba(255,255,255,.8)` | `rgba(17,21,30,.78)` | top bar and dock, with 16px backdrop blur |
| field | `#fbf7f9` | `#0f131b` | input backgrounds |

Card shadow: light `0 1px 2px rgba(157,23,77,.05), 0 8px 24px rgba(157,23,77,.06)`; dark none. Floating (dock): light `0 10px 30px rgba(157,23,77,.16)`, dark `0 10px 30px rgba(0,0,0,.5)`.

## Type

| Role | Spec |
|---|---|
| Wordmark | pink filled lucide `Heart` 14px + "My Love" Lora Italic 600 19px `ink`; Sign in uses 34px |
| Page title | Playfair Display 600 30px, line-height 1.1, `ink`; optional 14px `muted` subtitle |
| Section label | Inter 600 12px uppercase, letter-spacing .08em, `muted` |
| Body | Inter 15px `ink`; supporting 13–14px `muted` |
| Countdown value | Inter 700 22px, tabular numerals |
| Daily message | Lora Italic 500 21px, line-height 1.45 |

Google Fonts import (`index.css:1`) gains Lora `ital,wght@1,500;1,600` and drops Dancing Script.

## Components

- **Card:** `card` bg, 1px `line` border, radius 20px, padding 12–20px, card shadow. No coloured or 2px borders anywhere.
- **Icon tile:** 36–40px square, radius 12px, `tint` bg + `accent` icon (partner: `ptint` + `partner`).
- **Primary button:** pill, 48px, `fill` bg, white 600 15px.
- **Secondary button:** pill, 36px (small) or 48px, `tint` bg, `accent` text.
- **Icon button:** 44px circle; `card2` bg + `muted` icon, or `tint` + `accent`, or transparent.
- **Chip:** 34px pill, icon + 600 14px label; you = `tint`/`accent`, partner = `ptint`/`partner`.
- **Segmented control:** `card2` pill track, 4px padding; active segment `card` bg + `ink` + small shadow; others `muted`.
- **Input:** 48px, radius 14px, `field` bg, inset 1px `line`, 15px text; label above, 600 13px.
- **Bubbles:** radius 20px with 6px tail corner; own = `fill` + white; partner = `card` + inset `line`.
- **Dialog/sheet:** `card` surface, radius 20px (bottom sheet 20px top corners), `ink` title in Inter 600 18px, actions are kit buttons; destructive action uses `danger` text on `dtint`, never a red gradient.
- **Badge (count):** 20px pill, `fill` bg, white 11px bold.
