---
name: My Love — Settings
status: final
updated: 2026-11-02
description: The Settings page and its subpages for My Love, a PWA and iOS app for one couple. Inherits My Love's style kit (src/index.css --kit-* tokens, src/components/shared/kitClasses.ts); this file adds no new palette, only the Settings components built from the kit.
colors:
  # Light values: :root in src/index.css. Dark values: the
  # prefers-color-scheme: dark block. Translucent kit values are written as
  # 8-digit hex (#RRGGBBAA); the rgba source is named in the Colors section.
  page: '#FDF4F7'
  card: '#FFFFFF'
  card2: '#F6EEF2'
  ink: '#1F2430'
  muted: '#646B78'
  accent: '#C8216B'
  fill: '#DB2777'
  tint: '#FCE7F3'
  danger: '#CF2121'
  dtint: '#FDECEC'
  line: '#9D174D17'
  line-strong: '#987D90'
  glass: '#FFFFFFCC'
  field: '#FBF7F9'
  on-fill: '#FFFFFF'
  page-dark: '#0B0E14'
  card-dark: '#141925'
  card2-dark: '#1C2230'
  ink-dark: '#F3F4F6'
  muted-dark: '#9AA3B2'
  accent-dark: '#F472B6'
  fill-dark: '#DB2777'
  tint-dark: '#F472B624'
  danger-dark: '#F87171'
  dtint-dark: '#F871711F'
  line-dark: '#FFFFFF12'
  line-strong-dark: '#686E78'
  glass-dark: '#11151EC7'
  field-dark: '#0F131B'
  on-fill-dark: '#FFFFFF'
typography:
  large-title:
    fontFamily: Playfair Display
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.1'
  bar-title:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
  bar-action:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
  row-label:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
  row-value:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
  group-label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    letterSpacing: 0.08em
  footnote:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  lead:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.45'
  notice:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.45'
  field:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
  field-label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
  dialog-title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
  avatar-initial:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
rounded:
  tile: 12px
  control: 14px
  card: 20px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  card-gap: 6px
  gutter: 16px
  title-inset: 20px
  row-min: 48px
  tile-size: 36px
  hit-target: 44px
  bar-height: 64px
  content-max: 800px
components:
  settings-bar:
    background: '{colors.glass}'
    border-bottom: '1px {colors.line}'
    title: '{typography.bar-title}'
    large-title: '{typography.large-title}'
    height: '{spacing.bar-height}'
  bar-actions:
    back-arrow: '{colors.ink}'
    save: '{colors.accent}'
    save-type: '{typography.bar-action}'
    cancel: '{colors.ink}'
    add-button-background: '{colors.tint}'
    add-button-icon: '{colors.accent}'
    add-button-size: '{spacing.hit-target}'
  group-label:
    type: '{typography.group-label}'
    color: '{colors.muted}'
  grouped-card:
    background: '{colors.card}'
    border: '1px {colors.line}'
    radius: '{rounded.card}'
    padding: '{spacing.3}'
    gap: '{spacing.card-gap}'
    shadow: 'kit shadow-card'
  list-row:
    min-height: '{spacing.row-min}'
    gap: '{spacing.3}'
    tile-background: '{colors.tint}'
    tile-icon: '{colors.accent}'
    tile-size: '{spacing.tile-size}'
    tile-radius: '{rounded.tile}'
    label: '{typography.row-label}'
    label-color: '{colors.ink}'
    value: '{typography.row-value}'
    value-color: '{colors.muted}'
    chevron: '{colors.muted}'
  switch-row:
    track-on: '{colors.fill}'
    track-off: '{colors.line-strong}'
    thumb: '{colors.card}'
    track-size: '48px x 28px'
    radius: '{rounded.full}'
  read-only-row:
    label: '{typography.row-label}'
    value: '{typography.row-value}'
    value-color: '{colors.muted}'
  footnote:
    type: '{typography.footnote}'
    color: '{colors.muted}'
  danger-action-row:
    label-color: '{colors.danger}'
    tile-background: '{colors.dtint}'
    tile-icon: '{colors.danger}'
  profile-header:
    avatar-background: '{colors.fill}'
    avatar-initial: '{colors.on-fill}'
    avatar-size: '40px'
    name: '{typography.row-label}'
    email: '{typography.footnote}'
  lead-line:
    type: '{typography.lead}'
    color: '{colors.muted}'
  notice:
    background: '{colors.card2}'
    color: '{colors.ink}'
    type: '{typography.notice}'
    radius: '{rounded.control}'
  error-box:
    background: '{colors.dtint}'
    color: '{colors.danger}'
    radius: '{rounded.control}'
  one-field-edit-page:
    field-background: '{colors.field}'
    field-ring: '{colors.line-strong}'
    field-ring-focus: '{colors.accent}'
    field-radius: '{rounded.control}'
    field-type: '{typography.field}'
    field-height: '{spacing.row-min}'
  form-page:
    field-label: '{typography.field-label}'
    option-selected-background: '{colors.tint}'
    option-selected-ring: '{colors.accent}'
    option-ring: '{colors.line-strong}'
  kind-chooser:
    surface: '{colors.card}'
    radius: '{rounded.card}'
  confirmation-dialog:
    surface: '{colors.card}'
    radius: '{rounded.card}'
    title: '{typography.dialog-title}'
    shadow: 'kit shadow-float'
  version-line:
    type: '{typography.footnote}'
    color: '{colors.muted}'
---

# My Love — Settings: Design Spine

> Paired with `EXPERIENCE.md`. Settings inherits My Love's style kit; nothing here is a new palette. Composition references: [key screens v2](mockups/key-settings-v2.html) (current) and [key screens v1](mockups/key-settings-v1.html) (collapsed bar, permission-off and one-field edit frames). Structural reference: the owner's TikTok screenshots in `imports/tiktok/`. **This spine wins on any conflict with a mock or import.**

## Brand & Style

My Love is a private app for one couple: daily messages, moods, photos, love notes and the dates that matter to the two of them. It is warm, rose-tinted and personal, and it should still feel like a finished production app rather than a hobby page. The Settings rework exists because the old page failed that second test: long, disorganized, editors always open, fields spilling past card edges, and labels and copy that read like engineering ("Pushes", a sentence about Wi-Fi on every row).

TikTok's structure is borrowed (see `EXPERIENCE.md` → Inspiration & Anti-patterns); its black-and-gray look is rejected. Every surface stays on My Love's kit, light and dark, switching with the OS theme.

**Voice.** Plain, short, warm, never technical. Labels name things the way the two people would ("Dates", "Partner", "Notify me about"), never the way the code does. A value on the right says the state in one or two words ("On", "Some", "Wi-Fi only", "Not linked", "Not set"). Footnotes are one short sentence. The version line keeps its sign-off, "made for the two of you". No exclamation marks, no emoji, no engineering nouns. Exact strings live in `EXPERIENCE.md` → Voice and Tone.

## Colors

Settings uses the kit as it is. Light values are the `:root` block of `src/index.css`; dark values are its `prefers-color-scheme: dark` block. Components use the kit utilities (`bg-card`, `text-muted`), which resolve to the `--kit-*` variables, so no component carries a `dark:` variant.

- **Page (`#FDF4F7` / `#0B0E14`)**: the ground under every Settings page.
- **Card (`#FFFFFF` / `#141925`)**: every grouped card and dialog.
- **Card2 (`#F6EEF2` / `#1C2230`)**: the Notice surface only (the iOS permission-off notice).
- **Ink (`#1F2430` / `#F3F4F6`)**: row labels, titles, the back arrow, Cancel.
- **Muted (`#646B78` / `#9AA3B2`)**: right-hand values, chevrons, group labels, footnotes, the version line, the lead line.
- **Accent (`#C8216B` / `#F472B6`)**: icon glyphs inside tiles, the Save and Add bar actions, the glyph on the `+` button, focus rings, a selected icon option. It is the only color that says "you can act here" beyond the row itself.
- **Fill (`#DB2777` both)**: a switch's track when on, and the initial avatar.
- **Tint (`#FCE7F3` / `rgba(244,114,182,0.14)`)**: the icon tile behind a row's glyph, the `+` button, a selected icon option.
- **Danger (`#CF2121` / `#F87171`) and Dtint (`#FDECEC` / `rgba(248,113,113,0.12)`)**: the Danger action rows (Log out, Log out of all devices, Delete event, Delete anniversary, the wedding's Clear), the Error box, and the destructive button in the Confirmation dialog. Never used for a value or a state label.
- **Line (`rgba(157,23,77,0.09)` / `rgba(255,255,255,0.07)`)**: card borders, the hairline divider between rows, the collapsed bar's bottom edge.
- **Line-strong (`#987D90` / `#686E78`)**: a switch's track when off, a field's ring, an unselected icon option's ring. Opaque, unlike line.
- **Glass (`rgba(255,255,255,0.8)` / `rgba(17,21,30,0.78)`)**: the collapsed Settings bar, with a 16px backdrop blur, the same glass as the app header and dock.
- **Field (`#FBF7F9` / `#0F131B`)**: the input surface on the One-field edit page and the Form page.

**Contrast targets** (from the kit's own measurements in `src/index.css`): accent on tint 4.60:1, muted on card2 4.71:1 and on page 4.97:1, danger on dtint 4.72:1, white on fill 4.60:1, line-strong at least 3:1 on field and card. Every dark-mode pairing passes the same targets at the values listed. Any new pairing in Settings must clear 4.5:1 for text and 3:1 for a control's boundary.

The kit's partner violet and good green are not used in Settings.

## Typography

Inter for everything except the large title, which is Playfair Display, the serif the app already uses for every view title (Settings' current `h1` is `font-serif text-[30px] leading-[1.1] font-semibold`). Lora, the wordmark font, does not appear in Settings, because Settings' own bar replaces the app header that carries the wordmark.

| Role | Token | Use |
|---|---|---|
| Large title | `{typography.large-title}` | Top of every list page: Settings, Dates, Notifications, Profile, Partner. |
| Bar title | `{typography.bar-title}` | The small centered title, both in the collapsed bar and on single-item pages. |
| Bar action | `{typography.bar-action}` | Save and Add in the accent color; Cancel uses the same size in ink at weight 400. |
| Row label | `{typography.row-label}` | Every row's label. |
| Row value | `{typography.row-value}` | The right-hand value, muted. One line, no wrap; when space runs out, the label truncates and the value stays whole. |
| Group label | `{typography.group-label}` | Uppercase, tracked, muted, above a card. |
| Footnote | `{typography.footnote}` | One sentence under a card. Also the email in the Profile header and the version line. |
| Lead | `{typography.lead}` | The one line on the not-linked Partner page. |
| Notice | `{typography.notice}` | The permission-off notice. |
| Field / Field label | `{typography.field}` / `{typography.field-label}` | Inputs. Field text is 16px and never smaller: iOS zooms the page when a smaller field is focused. |
| Dialog title | `{typography.dialog-title}` | The Confirmation dialog's question. |

## Layout & Spacing

The scale is Tailwind's 4px scale; Settings uses `{spacing.1}` to `{spacing.5}` plus named tokens.

- **Page.** One column, `{spacing.gutter}` (16px) side gutter, cards centered and at most `{spacing.content-max}` wide (today's `max-w-200`). The unfolded iPhone Duo gets the same single column; there is no two-pane layout.
- **Rhythm.** `{spacing.4}` between sections; `{spacing.2}` between a Group label and its card; `{spacing.2}` between a card and its Footnote.
- **Cards.** `{spacing.3}` padding, `{spacing.card-gap}` between rows, a hairline divider between rows that runs to the card edge (its negative margin cancels the card's padding).
- **Rows.** At least `{spacing.row-min}` tall, `{spacing.3}` between tile, label, value and chevron.
- **Title.** The large title sits `{spacing.title-inset}` from the screen edge, aligned with the group labels (16px gutter plus the label's 4px inset).
- **Bar.** `{spacing.bar-height}` tall below the status bar (`env(safe-area-inset-top)`), three columns: leading action, centered title, trailing action.
- **Dock space.** Settings never measures the dock. Its scroll content reserves `--dock-clearance` at the bottom and pads its sides by `--dock-left` / `--dock-right`, as `<main>` does, and the bar pads its sides by the same variables. In the bottom-dock form the clearance is the dock's height plus the home-indicator band; in the Duo column form the bottom clearance shrinks to the home-indicator band, and the side next to the column is padded by the column's width (84pt), so cards and the bar end at the column's edge ([v2 frame 2](mockups/key-settings-v2.html)). A hard-coded height or side offset puts content under the dock.

## Elevation & Depth

Depth is the kit's: tonal layering plus two shadows.

- **Grouped cards** carry `--kit-shadow-card` (a soft rose-tinted shadow in light mode, none in dark mode, where the card's tone separates it from the page).
- **The collapsed Settings bar** is glass with a backdrop blur and a hairline bottom edge, no shadow; content scrolls under it.
- **The Confirmation dialog and the Kind chooser** carry `--kit-shadow-float` over a 50% black scrim.
- **Nothing else is raised.** Rows, the Notice and the Error box are flat.

## Shapes

- `{rounded.card}` (20px): grouped cards and dialogs.
- `{rounded.control}` (14px): fields, the Notice, the Error box, icon options, a row's focus ring.
- `{rounded.tile}` (12px): the 36px icon tile on a row.
- `{rounded.full}`: switch tracks and thumbs, the 44px `+` button and back-arrow hit area, the initial avatar, and the kit's dialog and action buttons (pills).

Pills are limited to switches, round icon buttons, the `+` button and the dialog and action buttons. Cards, rows, fields and notices use the radius tokens above. Nothing in Settings is square-cornered.

## Components

Values for each component are in the `components` token block; the bullets give anatomy, state appearance and what the tokens do not capture.

- **Settings bar.** Replaces the app header on Settings and every subpage. Three states. *Large title*: a 52px row holding only the leading action, then the page name in the large-title type below it, on the page ground ([v2 frame 1](mockups/key-settings-v2.html)). *Collapsed*: once the large title scrolls away, a glass bar with the name centered and a hairline bottom edge ([v1 frame 2](mockups/key-settings-v1.html)). *Small title*: single-item pages (a date's page, a One-field edit page, the Form page) start and stay in the collapsed look.
- **Bar actions.** Back arrow: a 24px chevron-left in ink inside a 44px round hit area, leading. Save: text, accent, trailing; shown at 50% opacity while disabled. Add: same as Save, on the Form page. Cancel: text, ink, weight 400, leading, on the Form page. The `+` button: a 44px round tint button with a 20px accent "+", trailing, on the Dates list (today's `ADD_BUTTON`).
- **Group label.** Today's `SECTION_LABEL`, 4px inset, above its card. The last card on the top page has no label.
- **Grouped card.** Today's `CARD`, with a hairline `DIVIDER` between rows.
- **List row.** The top page's and every list page's row. Left to right: optional icon tile with an accent glyph, label in ink, value in muted, 18px muted chevron. Top page, Dates list and Notifications rows have tiles; Profile, Partner and date-page field rows do not. Top-page icons (all lucide): person, two people, calendar-heart, bell, image, rotate-ccw, log-out, monitor-smartphone; the Notifications switch icons are today's PushSettings icons. A row with no value shows only the chevron ([v2 frame 1](mockups/key-settings-v2.html), Dates). The `Load more` row that ends the Dates list's Past group is a List row with its label only: no tile, no value, no chevron. An Icon field row shows the event's glyph in accent in place of a text value ([v1 frame 4](mockups/key-settings-v1.html)). Pressed state: the kit's hover/press opacity; focus: 2px accent ring at `{rounded.control}`.
- **Switch row.** Today's `SwitchRow` without its helper line: optional tile, label, and the 48x28 track with a 20px thumb that travels 24px; track fill when on, line-strong when off. Disabled: 60% opacity.
- **Read-only row.** A List row with no chevron and no pressed state: label in ink, value in muted ([v2 frames 4, 6, 7](mockups/key-settings-v2.html)).
- **Footnote.** One sentence, muted, 4px inset, under the card it explains.
- **Danger action row.** Two variants. *Leading*: dtint tile with a danger glyph and a danger label, no chevron, left-aligned; used for Log out and Log out of all devices in the unlabeled last card ([v2 frame 1](mockups/key-settings-v2.html)). *Centered*: danger label centered, no tile, alone in its own card at the bottom of a date's page; used for Delete event ([v1 frame 4](mockups/key-settings-v1.html)), Delete anniversary and the wedding date's Clear. While its action runs, the leading variant's glyph becomes a spinning loader, as today.
- **Profile header.** The round avatar with the name's first letter, then the name above the email, on the page ground above the card ([v2 frame 3](mockups/key-settings-v2.html)).
- **Lead line.** One sentence, muted, on the page ground above a card ([v2 frame 5](mockups/key-settings-v2.html)).
- **Notice.** Today's `NOTICE`, 12px padding, above the groups ([v1 frame 6](mockups/key-settings-v1.html)).
- **Error box.** Today's `FAILURE_BOX`, danger text at 14px, with today's leading alert-circle icon.
- **One-field edit page.** Small-title bar with back arrow, the field's name centered and Save trailing; below it one Grouped card holding one kit field (`fieldClass`) and nothing else ([v1 frame 7](mockups/key-settings-v1.html)). A date field is the native date input with `scheme-light-dark`. A note field is the kit's multiline field. The icon field is the three-option picker used on the Form page.
- **Form page.** Small-title bar with Cancel leading, "New event" or "New anniversary" centered and Add trailing; one Grouped card with 16px between fields, each field under a `FIELD_LABEL`. The event form's Icon field is three equal option tiles (Calendar, Ring, Plane), each 48px tall with a 16px glyph and its name; the selected one has a tint fill, an accent label and a 2px accent ring, the others a 1px line-strong ring ([v2 frame 8](mockups/key-settings-v2.html)).
- **Kind chooser.** The question asked by the Dates list's `+` button, offering Event or Anniversary. Drawn as the kit dialog (card surface, `{rounded.card}`, shadow-float, scrim) with two secondary pill buttons and a Cancel button; no mock exists.
- **Confirmation dialog.** Today's kit dialog (`DIALOG_PANEL`, max 24rem wide): the question in `{typography.dialog-title}`, then Cancel (secondary pill, tint) and the destructive action (destructive pill, dtint and danger) side by side.
- **Version line.** Centered, muted, 4px under the last card on the top page ([v2 frame 1](mockups/key-settings-v2.html)).

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use kit tokens through the kit utilities; let the OS theme switch them | Add a palette, a `dark:` variant, or TikTok's black-and-gray |
| One line per row: label left, value and chevron right | Put a helper sentence, a field or an open editor on a list page |
| A Footnote under the card when a row needs explaining | Repeat the same sentence on every row |
| Danger color only on actions that end a session, delete or clear | Color a value, a state or a partner's item red or violet |
| Show read-only rows with no chevron and no pressed state | Gray out a read-only row or lower its opacity to say it is read-only |
| Reserve `--dock-clearance` and pad by `--dock-left` / `--dock-right` | Hard-code a bottom offset or a side inset for the dock |
| 16px text in every field | A field under 16px (iOS zooms and leaves the page zoomed) |
| Large title on list pages, small centered title on single-item pages | Mix both on one page, or show the app header's wordmark on Settings |
