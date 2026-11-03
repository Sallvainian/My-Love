---
title: Reconcile — TikTok Settings reference
status: draft
updated: 2026-11-02
input: imports/tiktok/IMG_0113.jpg – IMG_0116.jpg
---

# Reconcile: TikTok Settings reference

The owner supplied four screenshots of TikTok's "Settings and privacy" as a **structural** reference. The memlog records the brief: take its structure, not its dark look, and keep My Love's kit colours. This file lists what each screenshot contributed and where it landed in the spines. It then lists what the spines left out, so the owner can confirm each omission.

## What it contributed

| Screenshot | Idea | Landed in |
|---|---|---|
| [IMG_0113](imports/tiktok/IMG_0113.jpg) | Large, left-aligned page title under a back arrow | DESIGN.md → Components → Settings bar (large-title state); EXPERIENCE.md → Interaction Primitives → back arrow rule |
| IMG_0113 | Short, plainly named groups (Activity, Account) as small labels above rounded cards | DESIGN.md → Group label, Grouped card; EXPERIENCE.md → IA (Account, Partner, Preferences, About) |
| IMG_0113 | One-line rows: icon, label, chevron, nothing else | DESIGN.md → List row; EXPERIENCE.md → IA (no switches, fields or descriptions on the top page) |
| IMG_0113 | One row carries a right-hand value | EXPERIENCE.md → IA → Top page rows (a value rule per row) |
| [IMG_0114](imports/tiktok/IMG_0114.jpg) | Collapsed state: small centred title with the back arrow, content scrolling under it | DESIGN.md → Settings bar (collapsed state); EXPERIENCE.md → Interaction Primitives → collapsing title |
| IMG_0114 | Right-hand values that state the current setting in a word or two (Off, Followers, Only you, On) | EXPERIENCE.md → Top page rows (`On` / `Off` / `Some`, `Wi-Fi only` / `Any connection`, partner's name / `Not linked`); Voice and Tone |
| IMG_0114 | A Notifications row that opens its own page | EXPERIENCE.md → IA → Notifications (iOS app only) |
| [IMG_0115](imports/tiktok/IMG_0115.jpg) | A Preferences group | EXPERIENCE.md → IA → Preferences (Notifications, Photos) |
| IMG_0115 | A Cache & Cellular group for data-use choices | Folded into the Photos row under Preferences (`Wi-Fi only` / `Any connection`), shown only where the connection type is readable |
| [IMG_0116](imports/tiktok/IMG_0116.jpg) | Log out in the last card | EXPERIENCE.md → IA → unlabeled last card (`Log out`, then `Log out of all devices`) |
| IMG_0116 | The version line centred under the last card | DESIGN.md → Version line; EXPERIENCE.md → IA |
| IMG_0116 | The words "Log out" | EXPERIENCE.md → Voice and Tone: "Log out" replaces "Sign out" everywhere, including the login-screen notice |
| All four | Every row opens its own page | EXPERIENCE.md → Interaction Primitives → tap a row to edit; the one-field page also follows TikTok's Account page, which the memlog cites alongside iOS Settings |

## Deliberately not taken (decided)

- **The dark look.** Black ground, grey cards, white text. Rejected by the owner; every surface stays on the kit, light and dark (DESIGN.md → Brand & Style).

## Left out without a decision: owner to confirm

These ideas from the screenshots appear in neither spine. None was discussed in the run. Each line says what the spines do instead.

1. **"Switch account" row** (IMG_0116, Login group). It would let a person move between accounts without typing a password. The spines offer only `Log out` and `Log out of all devices`. My Love has one account per person, so the likely answer is "not needed", but it was never asked.
2. **A labelled "Login" group** (IMG_0116). TikTok names its log-out card. My Love's last card has no label, as decided from mock v1.
3. **A grouped "Support & About" section** (IMG_0116: Help Center, Privacy Center, Terms and Policies). My Love's About group holds only `Replay welcome message`. There are no help, privacy or terms pages, and the version line moves out of About (today it sits in the About card) to under the last card.
4. **Plain, uncoloured Log out** (IMG_0116). TikTok's Log out is ordinary white text. The spines keep today's danger colour and tinted tile for both log-out rows.
5. **Bare glyph icons with no tile** (all four). TikTok's icons are small monochrome glyphs. The spines keep the kit's tinted 36px icon tile on top-page rows, from today's Settings.
6. **Build number in the version line** (IMG_0116: `v47.5.0 (4750380)`). The spines keep `Version <app version> · made for the two of you`.
7. **A value that is a call to action** (IMG_0113: `Review 31 orders`). Every value in the spines is a state, never a prompt or a count. The Dates row shows nothing on its right.
8. **Storage controls** (IMG_0115–0116: Offline videos, Free up space, Data Saver). My Love caches photos and note images per account, and the spines add no page to see or clear that cache. Only the Photos download choice is kept.
9. **Display, Language and Accessibility rows** (IMG_0115). My Love follows the OS theme and language and has no in-app setting for them. The spines add none.
10. **A combined title** ("Settings and privacy"). The spines keep `Settings`.
11. **Solid collapsed bar.** TikTok's collapsed bar is opaque. The spines use the kit's glass bar with blur, matching the app header and dock.
12. **Visible scroll indicator** (IMG_0114–0116). The iOS app hides every scroll bar (`data-native`), so none appears in the shell. The website keeps its scroll bars, as today.

Groups with no counterpart in a two-person app (Visibility, Interactions, Family Pairing, Ads, Your orders, Share profile) were dropped as not applicable and are not listed one by one.
