---
name: My Love — Live update prompt
status: final
updated: 2026-11-04
description: The native iOS shell's live-update toasts, the confirm dialog that applies an update, and the header's Notifications bell with its drop-down list. Inherits My Love's style kit (src/index.css --kit-* tokens, src/components/shared/kitClasses.ts); no new palette.
colors:
  # Light values: :root in src/index.css. Dark values: its
  # prefers-color-scheme: dark block. Translucent values as 8-digit hex.
  card: '#FFFFFF'
  ink: '#1F2430'
  muted: '#646B78'
  accent: '#C8216B'
  fill: '#DB2777'
  tint: '#FCE7F3'
  danger: '#CF2121'
  dtint: '#FDECEC'
  good: '#15803D'
  line: '#9D174D17'
  glass: '#FFFFFFCC'
  card-dark: '#141925'
  ink-dark: '#F3F4F6'
  muted-dark: '#9AA3B2'
  accent-dark: '#F472B6'
  fill-dark: '#DB2777'
  tint-dark: '#F472B624'
  danger-dark: '#F87171'
  dtint-dark: '#F871711F'
  good-dark: '#4ADE80'
  line-dark: '#FFFFFF12'
  glass-dark: '#11151EC7'
typography:
  toast-text:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
  toast-percent:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    note: tabular numerals
  list-label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    letterSpacing: 0.08em
  entry-title:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
  entry-line:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  empty-line:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
  dialog-title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
  dialog-body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.45'
  pill:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
rounded:
  card: 20px
  tile: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  gutter: 16px
  toast-gap: 12px
  toast-max: 384px
  list-offset: 4px
  list-max: 320px
  hit: 44px
  dot: 10px
  dot-ring: 2px
  tile-size: 36px
components:
  update-toast:
    background: '{colors.card}'
    border: '{colors.line}'
    rounded: '{rounded.card}'
    shadow: --kit-shadow-float
    maxWidth: '{spacing.toast-max}'
    bottom: calc(var(--dock-top) + {spacing.toast-gap})
    sides: calc(var(--dock-left|right) + {spacing.gutter})
  update-toast-downloading:
    icon: lucide Download, 20px, '{colors.accent}'
    text: '{typography.toast-text}'
    textColor: '{colors.ink}'
    percent: '{typography.toast-percent}'
    percentColor: '{colors.muted}'
    track: '{colors.tint}'
    bar: '{colors.fill}'
    barHeight: 6px
  update-toast-ready:
    icon: lucide RefreshCw, 20px, '{colors.good}'
    text: '{typography.toast-text}'
    textColor: '{colors.ink}'
    minHeight: '{spacing.hit}'
  update-confirm-dialog:
    panel: DIALOG_PANEL (kit)
    title: '{typography.dialog-title}'
    body: '{typography.dialog-body}'
    bodyColor: '{colors.muted}'
    no: SECONDARY_BUTTON (tint, accent)
    yes: DESTRUCTIVE_BUTTON (dtint, danger)
  bell-button:
    icon: lucide Bell, 20px, '{colors.muted}'
    iconPressed: '{colors.ink}'
    size: '{spacing.hit}'
    rounded: '{rounded.full}'
  bell-dot:
    size: '{spacing.dot}'
    color: '{colors.fill}'
    ring: '{spacing.dot-ring} {colors.glass}'
    rounded: '{rounded.full}'
  notifications-list:
    background: '{colors.card}'
    border: '{colors.line}'
    rounded: '{rounded.card}'
    shadow: --kit-shadow-float
    width: min({spacing.list-max}, viewport minus both dock sides and two gutters)
    offset: '{spacing.list-offset} below the header'
    padding: '{spacing.2}'
  notification-entry:
    tile: '{spacing.tile-size}, {colors.tint}, {rounded.tile}'
    glyph: 18px, '{colors.accent}'
    title: '{typography.entry-title}'
    titleColor: '{colors.ink}'
    line: '{typography.entry-line}'
    lineColor: '{colors.muted}'
    minHeight: '{spacing.hit}'
    rounded: '{rounded.tile}'
---

# My Love — Live update prompt: Design Spine

> Paired with `EXPERIENCE.md`. Everything here is built from My Love's style kit and matches the Settings spine (`../ux-settings-page/DESIGN.md`). No new palette. Composition reference: [key screens](mockups/key-live-update.html). **This spine wins on any conflict with a mock.**

## Brand & Style

My Love is a private app for one couple, warm and rose-tinted, and it should feel like a finished production app. An update is housekeeping, so the flow stays quiet. A toast says what is happening in a few words and leaves by itself, and the bell's dot is the only lasting sign. Nothing flashes, nothing is red until the person is about to restart, and nothing uses engineering words ("bundle", "build", a build id or a version number).

**Voice.** The same as Settings: plain, short, warm, never technical, no exclamation marks, no emoji. Exact strings are in `EXPERIENCE.md` → Voice and Tone.

## Colors

The kit is used as it is. Components use the kit utilities (`bg-card`, `text-muted`), so none carries a `dark:` variant.

- **Card (`#FFFFFF` / `#141925`)**: the toast, the drop-down list and the dialog panel.
- **Ink (`#1F2430` / `#F3F4F6`)**: the toast text, an entry's title, the dialog title, the bell while pressed.
- **Muted (`#646B78` / `#9AA3B2`)**: the bell at rest (as the gear is), the percent, an entry's line, the empty line, the dialog body.
- **Accent (`#C8216B` / `#F472B6`)**: the download glyph and an entry's glyph.
- **Fill (`#DB2777` both)**: the progress bar and the bell's dot.
- **Tint (`#FCE7F3` / `rgba(244,114,182,0.14)`)**: the progress track, an entry's icon tile, the No button.
- **Good (`#15803D` / `#4ADE80`)**: the ready toast's glyph only. The toast already shipped with it, and it is the one place in this flow that says "done".
- **Danger (`#CF2121` / `#F87171`) on Dtint (`#FDECEC` / `rgba(248,113,113,0.12)`)**: the Yes button, because a restart can lose what the person was doing. Never used elsewhere in this flow.
- **Line (`rgba(157,23,77,0.09)` / `rgba(255,255,255,0.07)`)**: the toast's and the list's border.
- **Glass (`rgba(255,255,255,0.8)` / `rgba(17,21,30,0.78)`)**: the header the bell sits in, and the dot's ring, which cuts the dot out of the bell glyph.

**Contrast.** Two figures are the kit's own: accent on tint 4.60:1 and danger on dtint 4.72:1. The rest were measured for this spine (WCAG, light / dark):

| Pairing | Light | Dark |
|---|---|---|
| Muted on card | 5.36:1 | 6.91:1 |
| Good on card | 5.02:1 | 10.08:1 |
| Fill dot on the header glass, taken as opaque | 4.60:1 | 3.97:1 |

The dot is a status mark, not text, and needs 3:1.

## Typography

All Inter, sized as the kit's existing toast, row and dialog text already are.

| Role | Token | Use |
|---|---|---|
| Toast text | `{typography.toast-text}` | "Downloading update…", "Update ready — tap to restart" |
| Toast percent | `{typography.toast-percent}` | The download percent, tabular so it doesn't jitter |
| List label | `{typography.list-label}` | "NOTIFICATIONS", uppercase and muted, at the top of the drop-down, like a Settings group label |
| Entry title | `{typography.entry-title}` | "Update now" |
| Entry line | `{typography.entry-line}` | The muted sentence under an entry's title |
| Empty line | `{typography.empty-line}` | "No notifications", muted, centred |
| Dialog title / body | `{typography.dialog-title}` / `{typography.dialog-body}` | "Update now?" / "You may lose what you're doing." |
| Pill | `{typography.pill}` | No and Yes |

## Layout & Spacing

- **Toasts.** Fixed at the bottom of the screen and centred, at most `{spacing.toast-max}` wide. The bottom edge sits `{spacing.toast-gap}` above `--dock-top`, the dock's top edge. In the column form `--dock-top` is the home-indicator band, so the toast sits just above it. The sides pad by `--dock-left` / `--dock-right` plus `{spacing.gutter}`, so in column poses the toast stays clear of the capsule. It never measures the dock and never hard-codes an offset. On Love Notes the toast's bottom edge sits `{spacing.toast-gap}` above the composer's top edge instead, and follows that edge as the composer grows, so it never covers the typing box. The two toasts take the same spot, and the ready toast replaces the download toast in place.
- **Bell.** The header's first slot, the 44px space at the top-left that is empty today. The header keeps its three slots in every pose: the bell at the left, the wordmark centred, and the gear or (in column poses) the gear-sized spacer at the right.
- **Drop-down.** Anchored to the bell: its left edge lines up with the header's 12px inset (plus `--dock-left` in a left-column pose), and its top sits `{spacing.list-offset}` below the header's bottom edge. Width is `{spacing.list-max}`, narrowed to fit between the dock sides and two gutters. Its maximum height ends `{spacing.toast-gap}` above `--dock-top`, and past that it scrolls. Inside: `{spacing.2}` padding, the list label inset 8px, then the entries with `{spacing.1}` between them.
- **Entry.** At least `{spacing.hit}` tall, `{spacing.3}` between tile and text, title above line.
- **Dialog.** The kit dialog (`DIALOG_BACKDROP`, `DIALOG_PANEL`, max 24rem wide). Title, then the body `{spacing.2}` under it, then No and Yes side by side `{spacing.4}` under that, No on the left.

## Elevation & Depth

- **Toast and drop-down**: card surface, line border, `--kit-shadow-float`, no scrim. Both float over the page.
- **Dialog**: `--kit-shadow-float` over the kit's 50% black scrim, like every other confirm in the app.
- **Order, front to back**: dialog, drop-down, toast, then the header and dock (z-40). The toast keeps today's z-100, above the dock. The drop-down sits above the header it hangs from. When the dialog opens, the toast and the drop-down are already gone (see `EXPERIENCE.md`).

## Shapes

`{rounded.card}` (20px) for the toast, the drop-down and the dialog panel. `{rounded.tile}` (12px) for an entry's icon tile and an entry's pressed highlight. `{rounded.full}` for the bell's hit area, the dot, the progress track and bar, and the pills.

## Components

- **Update toast, downloading** ([key screens, frame 1](mockups/key-live-update.html)). Download glyph, "Downloading update…" in ink, the percent in muted at the right, and under them a 6px tint track with a fill bar. Before the first percent arrives, a third-width bar slides across the track (the shipped indeterminate state) and no percent shows. It has no close X.
- **Update toast, ready** (frame 2). The good RefreshCw glyph, then "Update ready — tap to restart" in ink, on one 44px-high line. The whole toast is the tap target. It has no button and no X.
- **Bell button** (every frame). The lucide Bell at 20px in muted inside a 44px round hit area, sized and coloured exactly like the gear. It turns ink when pressed or while its drop-down is open, and never gets a background.
- **Bell dot.** A 10px fill circle at the glyph's top-right corner, inside the 44px hit area, with a 2px glass ring. It shows while an update waits.
- **Notifications drop-down** (frame 3). The kit card with the line border and float shadow, the "NOTIFICATIONS" list label, then the entries. Empty (frame 4): the list label, then "No notifications" centred in muted, in a 44px-high row.
- **Notification entry.** A 36px tint tile holding the accent RefreshCw glyph at 18px, then the title in ink at 15/600 and one muted line under it at 13/400. Pressed: the kit's tint highlight at `{rounded.tile}` behind the whole entry. No chevron, no time stamp, no unread mark.
- **Update confirm dialog** (frame 5). The kit dialog: "Update now?" as the title, "You may lose what you're doing." as the muted body, then No (`SECONDARY_BUTTON`) and Yes (`DESTRUCTIVE_BUTTON`). While Yes is restarting the app, both pills sit at the kit's disabled 50% opacity.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Put the toast `{spacing.toast-gap}` above `--dock-top` (above the composer on Love Notes) and pad its sides by `--dock-left` / `--dock-right` | Hard-code a bottom offset, cover the Love Notes typing box, or put the toast at the top over the header (the shipped placement) |
| Make the bell match the gear: size, colour, hit area | Fill the bell, tint its background, or give it a count |
| Show waiting with the dot alone | Add a number badge to the bell, or a dot to an entry |
| Use danger only on Yes | Colour the toast, the entry or the dot red |
| Use the kit card and float shadow for the drop-down | Add a scrim behind the drop-down, or slide it in as a full-height sheet |
| Use plain words: "update", "restart", "a new version" | Use "bundle", "build", a build id or a version number in any string |
