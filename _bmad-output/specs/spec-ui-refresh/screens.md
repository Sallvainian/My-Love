# Screens — what changes where

Each section names its approved artboard in `mockups/` (open the `.dc.html` for exact spacing; ignore its `data-props`/`DCLogic` scaffolding) and the files it touches. Paths are under `src/components/` unless stated. Mock text such as `[Your name]`, `[photo]` and the sample messages is placeholder, not copy.

## Chrome — `mockups/*` top bar and dock
- `Navigation/AppNavigation.tsx` (from spec-bottom-dock-navigation): wordmark becomes heart + Lora Italic 19px (today `font-cursive text-[28px]`); bar and dock surfaces use `glass`, active dock pill `tint`/`accent`, inactive `muted`, gear active state `tint`.

## Home — `mockups/Home.dc.html`
- `RelationshipTimers/TimeTogether.tsx`, `BirthdayCountdown.tsx`, `EventCountdown.tsx`, `CountdownTimer/CountdownTimer.tsx`: one countdown card — icon tile, `muted` label ("[owner] turns N"), value in countdown type; Together is full width with `22h 11m 55s` small and `muted` at right; birthdays two-up on mobile (today stacked); wedding "Date TBD" in `muted`. Drop per-event coloured borders (amber/blue/green/purple/yellow) — colour lives only in the tile. Birthday-today state keeps a highlight via the tile, not a yellow card.
- `App.tsx` events slot: "Upcoming" section label with small secondary Add button; empty/error placeholders become kit cards.
- `WelcomeButton/WelcomeButton.tsx`: removed from Home (`DailyMessage.tsx:384` stops rendering it; delete the component once unused). Replay moves to Settings.
- `DailyMessage/DailyMessage.tsx`: kit card (drop `.card`/`.card-hover`, gradient overlay, decorative 💕💖 emoji); category chip is `tint` pill with lucide icon, no emoji label; message Lora Italic; favourite = tinted icon button, share = neutral icon button.

## Mood — `mockups/Mood.dc.html`
- `MoodTracker/MoodTracker.tsx`: page title "How are you feeling?" + date; underline tab bar → segmented control (keep it sticky at the existing offset); remove light-only `bg-gray-50`; submit is a primary pill.
- `MoodTracker/MoodButton.tsx`: tile 76px, radius 16px; selected = `tint` + 2px inset `accent`; drop framer-motion rgba backgrounds.
- `MoodTracker/PartnerMoodDisplay.tsx`: partner avatar + "is feeling" + violet chips with lucide mood icons (no emoji, no hex border `#F9A8D4`, no `slate-*`).
- `MoodHistory/*` (calendar, `CalendarDay`, `MoodDetailModal`), `MoodHistoryItem`, `MoodHistoryTimeline`: kit card/dialog, dark mode, shared mood map.

## Love Notes — `mockups/Notes.dc.html`
- `love-notes/LoveNotes.tsx`: delete the in-view header bar (back arrow + "Love Notes"); replace with partner row (avatar, name, online dot); page ground `page` (drop `bg-[#FFF5F5]`).
- `love-notes/LoveNoteMessage.tsx`: bubbles per kit (drop `#FF6B6B` / `#E9ECEF`).
- `love-notes/MessageInput.tsx`: image icon button + pill input + round `fill` send (drop `coral-500`); `ImagePreview.tsx` kit radius.
- `MessageList.tsx`: empty state and new-message pill on kit; no 💕.
- `NoteRemoveConfirmation.tsx`, `FullScreenImageViewer.tsx`: kit dialog / viewer chrome.

## Partner — `mockups/Partner.dc.html`
- `PartnerMoodView/PartnerMoodView.tsx`: fix horizontal overflow (header row must fit 390px); title = partner display name, subtitle green dot + "Connected", refresh = icon button; current-mood card; "Recent moods" list card; toast on kit.
- `PokeKissInterface/PokeKissInterface.tsx`: floating heart + gradient pills → three action tiles (Poke `Zap`, Kiss `Heart`, Fart `Wind`) under a "Send a little something" label with History link + count badge; full-screen animations may keep their motion but use lucide/kit colours, no emoji; error toast on kit.
- `InteractionHistory/InteractionHistory.tsx`: kit sheet; sent rows `tint`, received rows `ptint` (today pink/purple 2px borders).

## Photos — `mockups/Photos.dc.html` (toggle `hasPhotos`)
- `PhotoGallery/PhotoGallery.tsx`: page title + "N photos · shared with {partner}" + small Upload secondary button replacing the fixed FAB (testid moves to it); empty-state card only when `photos.length === 0` (current condition at `:239` stays); grid 3 columns, gap 6px.
- `PhotoGallery/PhotoGridItem.tsx`: radius 14px, uploader initial badge `fill` (you) / `partner` (today pink-600 / blue-600); `PhotoGridSkeleton.tsx` column count matches the grid (today 2/3/4 vs 3/4).
- `PhotoUpload/*`, `PhotoEditModal/*`, `PhotoDeleteConfirmation/*`, `PhotoGallery/PhotoViewer.tsx` (inline confirm), `PhotoCarousel/*`: one kit dialog pattern in both themes (edit/delete are always-dark today); carousel controls Edit/Delete/Close use kit icon buttons with `danger` only on Delete (today Close is red).

## Settings — `mockups/Settings.dc.html`
- `Settings/Settings.tsx` + delete `Settings/Settings.css`: title; section labels Account / Countdowns / About; grouped list cards with hairline dividers; display-name row opens the existing edit flow; About gains a "Replay welcome message" row that opens the existing `WelcomeSplash` (today reached only via `WelcomeButton` → `onShowWelcome`); Sign out = card row, `danger` text on `dtint` icon tile (today red gradient block).
- `Settings/EventsSettings.tsx`, `AnniversarySettings.tsx`: drop their inner duplicate h2 headings; list rows + `+` tinted icon buttons; editor/delete modals on the kit dialog; amber retry banner and blue/purple buttons → kit.

## Sign in — `mockups/SignIn.dc.html`
- `LoginScreen/LoginScreen.tsx` + delete `LoginScreen.css`: `page` ground (today indigo gradient), wordmark 34px, kit card, inputs, primary Sign in, neutral "Continue with Google", error/notice on kit.

## No artboard — follow the kit (CAP-11)
- `DisplayNameSetup/*` + delete its `.css`; `WelcomeSplash/*`; `ErrorBoundary`, `ViewErrorBoundary`; `SyncToast`; `NetworkStatusIndicator` (drop raw `#FF6B6B`/`#FCC419`/`#51CF66`).
- `index.css`: remove unused component classes (`.btn-primary`, `.btn-secondary`, `.input`, `.text-gradient`, `.floating-hearts`, `.glass`, `.bg-sunset/.bg-ocean/.bg-lavender/.bg-rose`) and `.card`/`.btn-icon` once DailyMessage stops using them; `tailwind.config.js` unused `sunset`/`ocean`/`lavender`/`coral` scales.
