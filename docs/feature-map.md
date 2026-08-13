# My Love — Feature Map

A feature-by-feature map of the app: what each part does, which files implement it, what state and backend it touches, and the non-obvious behaviour worth knowing before you change it.

**Organised the way the app is.** Top-level sections follow the six bottom-navigation tabs (`src/stores/slices/navigationSlice.ts:18`), then a cross-cutting section for the systems no single tab owns.

---

## At a glance

| | |
|---|---|
| Features documented | 39 |
| Source files mapped | 193 |
| Non-obvious behaviours recorded | 336 |
| `src/` files | 197 TS/TSX, 43233 lines |
| Zustand slices | 11 |
| Services / hooks | 10 / 14 |
| Supabase migrations | 26 |
| Edge functions | 1 (`upload-love-note-image`) |
| Tests | 27 unit, 28 E2E, 14 pgTAP, 4 API |

---

## How to read this

Each feature carries the same blocks:

- **What it does** — the user-visible behaviour, not the implementation.
- **Start here** — the one file to open first.
- **Source files** — everything that materially implements the feature, with line counts.
- **Store state** — which Zustand slice keys it owns, and whether they survive a reload.
- **Backend** — Supabase tables, RPCs, storage buckets, IndexedDB stores, realtime channels.
- **Tests** — what covers it today.
- **Watch out for** — the non-obvious parts. Every entry cites `file:line` and quotes the exact source text. This is the section worth reading before you touch anything.

Paths are repo-relative. Line numbers were correct at the commit noted at the bottom of this file; treat them as a starting point, not a permanent address.

---

## Index

**Home tab**

- [Daily Love Message](#daily-love-message) — `src/components/DailyMessage/DailyMessage.tsx`
- [Relationship Timers (Time Together, Birthdays, Visits)](#relationship-timers-time-together-birthdays-visits) — `src/App.tsx`
- [Anniversary Countdown Timer](#anniversary-countdown-timer) — `src/components/CountdownTimer/CountdownTimer.tsx`
- [Welcome Splash & Re-view Button](#welcome-splash-re-view-button) — `src/App.tsx`

**Mood tab**

- [Mood Entry & Offline Sync](#mood-entry-offline-sync) — `src/components/MoodTracker/MoodTracker.tsx`
- [Mood History — Calendar and Timeline views](#mood-history-calendar-and-timeline-views) — `src/components/MoodHistory/MoodHistoryCalendar.tsx`
- [Partner Mood Display & Realtime Sync](#partner-mood-display-realtime-sync) — `src/components/MoodTracker/PartnerMoodDisplay.tsx`

**Partner tab**

- [Partner Linking (search, request, accept/decline)](#partner-linking-search-request-acceptdecline) — `src/components/PartnerMoodView/PartnerMoodView.tsx`
- [Poke / Kiss / Fart Interactions](#poke-kiss-fart-interactions) — `src/components/PokeKissInterface/PokeKissInterface.tsx`
- [Partner Mood Viewing](#partner-mood-viewing) — `src/components/PartnerMoodView/PartnerMoodView.tsx`

**Love Notes tab**

- [Love Notes Chat](#love-notes-chat) — `src/components/love-notes/LoveNotes.tsx`
- [Love Note Image Attachments](#love-note-image-attachments) — `src/services/loveNoteImageService.ts`

**Photos tab**

- [Photo Gallery Grid & Full-Screen Viewer](#photo-gallery-grid-full-screen-viewer) — 
- [Photo Upload](#photo-upload) — 
- [Photo Carousel with Caption/Tag Edit and Delete Confirmation](#photo-carousel-with-captiontag-edit-and-delete-confirmation) — 

**Scripture tab**

- [Scripture Reading Overview & Session Entry/Resume](#scripture-reading-overview-session-entryresume) — `src/components/scripture-reading/containers/ScriptureOverview.tsx`
- [Couple Stats Dashboard ("Your Journey")](#couple-stats-dashboard-your-journey) — `src/components/scripture-reading/overview/StatsSection.tsx`
- [Solo Reading Flow — 17 Steps, Bookmarks, Save & Resume](#solo-reading-flow-17-steps-bookmarks-save-resume) — `src/components/scripture-reading/containers/SoloReadingFlow.tsx`
- [End-of-Session Reflection Summary & Daily Prayer Report](#end-of-session-reflection-summary-daily-prayer-report) — `src/components/scripture-reading/hooks/useReportPhase.ts`
- [Together Mode: Lobby, Role Selection & Countdown](#together-mode-lobby-role-selection-countdown) — `src/components/scripture-reading/containers/LobbyContainer.tsx`
- [Together Mode: Synchronized Reading & Lock-In](#together-mode-synchronized-reading-lock-in) — `src/components/scripture-reading/containers/ReadingContainer.tsx`
- [Together Mode: Disconnection Detection, Overlay & Reconnection](#together-mode-disconnection-detection-overlay-reconnection) — `src/hooks/useScripturePresence.ts`

**Cross-cutting infrastructure**

- [Admin Panel — Custom Message Management](#admin-panel-custom-message-management) — `src/services/customMessageService.ts`
- [Haptic Feedback](#haptic-feedback) — `src/hooks/useVibration.ts`
- [Sign-In, Session Handling & Auth Gate](#sign-in-session-handling-auth-gate) — `src/App.tsx`
- [Display Name Onboarding](#display-name-onboarding) — `src/App.tsx`
- [App Shell, View Routing & Error Boundaries](#app-shell-view-routing-error-boundaries) — `src/App.tsx`
- [Global Zustand Store Composition & LocalStorage Persistence](#global-zustand-store-composition-localstorage-persistence) — `src/stores/useAppStore.ts`
- [Theming](#theming) — `src/utils/themes.ts`
- [Reduced-Motion Configuration](#reduced-motion-configuration) — `src/hooks/useMotionConfig.ts`
- [Settings Screen & Anniversary Management](#settings-screen-anniversary-management) — `src/components/Settings/Settings.tsx`
- [Offline Mood Queue & Background Sync](#offline-mood-queue-background-sync) — `src/sw.ts`
- [PWA Install & Offline App Shell (Service Worker caching)](#pwa-install-offline-app-shell-service-worker-caching) — `vite.config.ts`
- [Local Data Layer: IndexedDB schema, versioning & migrations](#local-data-layer-indexeddb-schema-versioning-migrations) — `src/services/dbSchema.ts`
- [Supabase Data Layer (client, API services, error handling)](#supabase-data-layer-client-api-services-error-handling) — `src/api/supabaseClient.ts`
- [Zod Runtime Validation Layer](#zod-runtime-validation-layer) — `src/validation/schemas.ts`
- [Observability (logger, performance monitoring)](#observability-logger-performance-monitoring) — `src/utils/logger.ts`
- [Database Schema, Migrations & pgTAP Suite](#database-schema-migrations-pgtap-suite) — `supabase/migrations/20251203000001_create_base_schema.sql`
- [Shared Types, App Constants & Date Utilities](#shared-types-app-constants-date-utilities) — `src/types/index.ts`

---

# Home tab

_The landing view. Renders eagerly (not lazy-loaded) so it works offline on a cold start._

## Daily Love Message

On the home tab the user sees one love message per day, drawn deterministically from a 365-message seed pool (plus any active custom messages) stored in IndexedDB. They can swipe left/right or press ArrowLeft/ArrowRight to walk back through up to 30 previous days and forward again to today, tap the heart to favorite it (which fires a floating-heart animation), and tap share to use the Web Share API or fall back to clipboard copy. Which message a given date gets is a pure function of the date string hash, so both partners on the same day see the same message without any server round-trip.

**Start here:** `src/components/DailyMessage/DailyMessage.tsx:16`

```ts
export function DailyMessage({ onShowWelcome }: DailyMessageProps) {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/DailyMessage/DailyMessage.tsx` | 374 | The card UI: swipe/keyboard navigation, favorite + share buttons, floating hearts, loading/error/retry states, and the anniversary CountdownTimer + WelcomeButton mount points. |
| `src/stores/slices/messagesSlice.ts` | 527 | Owns messages/messageHistory/currentMessage; implements updateCurrentMessage, navigateToPrevious/NextMessage, canNavigateBack/Forward, toggleFavorite, and the custom-message CRUD actions. |
| `src/utils/messageRotation.ts` | 165 | hashDateString + getDailyMessage (date-hash modulo pool length) and getAvailableHistoryDays; also holds five @deprecated legacy rotation helpers. |
| `src/utils/dateUtils.ts` | 184 | formatDateISO builds the local YYYY-MM-DD key used both as the hash input and as the shownMessages cache key. |
| `src/data/defaultMessages.ts` | 1677 | 365 seed messages across five categories (reason/memory/affirmation/future/custom), exported as defaultMessages plus messagesByCategory. |
| `src/data/defaultMessagesLoader.ts` | 12 | Dynamic import wrapper so the 1677-line seed dataset stays out of the eager startup bundle. |
| `src/stores/slices/settingsSlice.ts` | 258 | initializeApp seeds IndexedDB from defaultMessages on first run, loads messages into state, then calls updateCurrentMessage() once. |
| `src/services/storage.ts` | 337 | IndexedDB accessor used by the slice: getAllMessages, addMessage(s), toggleFavorite (flips Message.isFavorite in the DB). |
| `src/services/dbSchema.ts` | 280 | Declares the 'messages' object store (autoIncrement id, by-category and by-date indexes) in DB 'my-love-db' v5. |
| `src/stores/useAppStore.ts` | 287 | Persist middleware: serializes messageHistory.shownMessages Map to an entries array on write and rebuilds/validates it on rehydrate. |
| `src/utils/deterministicRandom.ts` | 41 | Seeded FNV-1a + xorshift generator used for the floating-heart X positions so renders stay pure. |
| `src/App.tsx` | 610 | Renders DailyMessage inline (not lazy) inside the currentView === 'home' branch so home keeps working offline. |
| `src/constants/animations.ts` | 25 | ANIMATION_TIMING and ANIMATION_VALUES, shared with CountdownTimer. The only file in src/constants/. |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/messagesSlice.ts` | `messages`, `messageHistory`, `currentMessage`, `currentDayOffset`, `customMessages`, `customMessagesLoaded` | partial — only messageHistory is in partialize (with shownMessages Map flattened to an entries array); messages/currentMessage/customMessages are not persisted and come from IndexedDB or are recomputed |
| `src/stores/slices/settingsSlice.ts` | `settings.relationship.startDate` | yes — settings is persisted to localStorage key 'my-love-storage'; read by getAvailableHistoryDays to cap back-navigation |

### Backend

| | |
|---|---|
| IndexedDB stores | `messages` |
| Realtime | none — the daily message path makes no Supabase calls at all; grep for '.from(' / '.rpc(' / 'supabase' in messagesSlice.ts, customMessageService.ts, messageRotation.ts and countdownService.ts returns nothing |

### Tests

- `tests/unit/utils/messageRotation.test.ts` — unit

### Watch out for

**1. Rotation indexes by ARRAY POSITION, not by message id. Change the pool size (add/delete a custom message, or flip one inactive) and every uncached date maps to a different message. Only the shownMessages cache keeps already-seen days stable — a cache miss after a pool change silently rewrites history.**

`src/utils/messageRotation.ts:35`

```ts
  const messageIndex = hash % allMessages.length;
```

**2. The id is picked from the FILTERED rotationPool but resolved against the UNFILTERED messages array. So a cached date whose message was later deactivated (active: false) still renders that deactivated message — the filter only gates new selections, never cached ones.**

`src/stores/slices/messagesSlice.ts:142`

```ts
    const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);
```

**3. messages.find returns Message | undefined, and Zustand's Partial<T> set accepts undefined, so a missing id silently sets currentMessage to undefined instead of null. DailyMessage then shows the pulsing spinner and, 10s later, the red 'Failed to load message' screen with no logged cause.**

`src/stores/slices/messagesSlice.ts:192`

```ts
    set({ currentMessage });
```

**4. navigateToNextMessage does NOT recompute on cache miss (unlike navigateToPreviousMessage, which calls getDailyMessage at line 241). If shownMessages has no entry for the target date, currentMessage is set to null and the card collapses into the loading state — recoverable only by reload.**

`src/stores/slices/messagesSlice.ts:304`

```ts
      currentMessage: targetMessage || null,
```

**5. Favorites have two sources of truth that are never reconciled: the heart icon reads messageHistory.favoriteIds (localStorage), while toggleFavorite persists the flip to IndexedDB Message.isFavorite via storageService. loadMessages never rebuilds favoriteIds from isFavorite, so clearing one store without the other leaves the icon and the DB permanently out of sync — and the next toggle then flips the DB the wrong way, because the add/remove branch is decided by the stale isFavorite value.**

`src/components/DailyMessage/DailyMessage.tsx:59`

```ts
  const isFavorited = currentMessage && messageHistory.favoriteIds.includes(currentMessage.id);
```

**6. That branch reads state.messages BEFORE the map on line 114 is applied (same set() callback, so it sees pre-toggle state) — correct today, but any refactor that reorders these two fields inverts the favoriteIds bookkeeping.**

`src/stores/slices/messagesSlice.ts:119`

```ts
          favoriteIds: state.messages.find((m) => m.id === messageId)?.isFavorite
```

**7. updateCurrentMessage() is called exactly once per app boot (here) plus once inside toggleFavorite. There is no midnight timer and no visibilitychange listener, so a PWA session left open across midnight keeps showing yesterday's message until the user reloads.**

`src/stores/slices/settingsSlice.ts:148`

```ts
      get().updateCurrentMessage();
```

**8. History depth is capped by settings.relationship.startDate, not by the hardcoded RELATIONSHIP_DATES.datingStart the home timers use. If startDate is in the future, daysSinceStart is negative, the min is negative, and canNavigateBack() is false forever — back-swipe silently does nothing.**

`src/utils/messageRotation.ts:63`

```ts
  return Math.min(messageHistory.maxHistoryDays || 30, daysSinceStart, 30);
```

**9. shownMessages is a Map, which JSON.stringify would flatten to {}. The persist layer hand-serializes it to entries here and rebuilds it in onRehydrateStorage (useAppStore.ts:184). Any code that writes messageHistory without going through partialize, or reads it straight out of localStorage, will get an array where it expects a Map.**

`src/stores/useAppStore.ts:129`

```ts
              ? Array.from(state.messageHistory.shownMessages.entries())
```

**10. Seed messages carry category: 'custom' but settingsSlice.ts:132 stamps them isCustom: false. The rotation filter keys on isCustom, so these 73 'custom'-category seeds are always in the pool and can never be deactivated from the AdminPanel — the two 'custom' concepts are unrelated.**

`src/data/defaultMessages.ts:1641`

```ts
    category: 'custom',
```

**11. viewportWidth is read once during render and is a useMemo dep, but nothing subscribes to resize — the comment 'once per viewport width' (line 37) is aspirational. Heart positions freeze at whatever width existed when the component first rendered.**

`src/components/DailyMessage/DailyMessage.tsx:34`

```ts
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
```

**12. Despite the name, this hook has nothing to do with daily messages — it subscribes to the Love Notes broadcast channel and calls addNote(). Its only consumer is useLoveNotes.ts:141. src/utils/messageValidation.ts is likewise Love Notes validation (Story 2.2), not daily-message validation.**

`src/hooks/useRealtimeMessages.ts:68`

```ts
      .channel(`love-notes:${userId}`)
```

**13. currentDayOffset is still written by both navigate actions (lines 253 and 303) despite being deprecated in favour of messageHistory.currentIndex — it is not persisted, so it desyncs from currentIndex on every reload.**

`src/stores/slices/messagesSlice.ts:34`

```ts
  currentDayOffset: number; // @deprecated Story 3.3: Use messageHistory.currentIndex instead
```

**14. No live test touches the daily message UI: grep for 'daily-message|message-card|message-favorite-button' across tests/ (excluding tests/e2e-archive) returns zero hits, and tests/e2e-archive/home-view.spec.ts is skipped stubs outside every playwright project testDir. Coverage is unit-only via messageRotation.test.ts.**

`src/components/DailyMessage/DailyMessage.tsx:180`

```ts
    <div className="relative mx-auto w-full max-w-2xl px-4 py-8" data-testid="daily-message">
```

---

## Relationship Timers (Time Together, Birthdays, Visits)

The top of the home tab shows a live count-up of time since the relationship started (years/days plus a ticking HH:MM:SS), then a two-column grid: birthday countdowns for Frank and Gracie on the left with the age they'll turn, and a Wedding card plus planned-visit cards on the right. All four card types re-render once per second. Every date comes from a hardcoded config module, not from user settings or the database.

**Start here:** `src/App.tsx:531`

```ts
            <TimeTogether />
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/config/relationshipDates.ts` | 124 | Hardcoded RELATIONSHIP_DATES (datingStart, two birthdays, wedding: null, two visits) plus getNextBirthday, getUpcomingAge and calculateTimeDifference. |
| `src/components/RelationshipTimers/TimeTogether.tsx` | 92 | Count-up card from RELATIONSHIP_DATES.datingStart, 1s setInterval, pluralized years/days and zero-padded HH:MM:SS. |
| `src/components/RelationshipTimers/BirthdayCountdown.tsx` | 134 | Per-person birthday countdown with 'Turning N', 1s setInterval, and a yellow 'Happy Birthday!' state when today matches the birthday month/day. |
| `src/components/RelationshipTimers/EventCountdown.tsx` | 177 | Generic event card (ring/plane/calendar icon variants); renders an XX:XX:XX placeholder when date is null, 'Today! 🎉', 'Event passed', or a calendar-day countdown. |
| `src/components/RelationshipTimers/index.ts` | 7 | Barrel re-exporting the three timer components for App.tsx. |
| `src/App.tsx` | 610 | Lays out the timers: TimeTogether full-width, then a two-column grid of the two BirthdayCountdowns and Wedding + mapped visit EventCountdowns. |

### Backend

| | |
|---|---|
| Realtime | none — every value is computed client-side from the hardcoded RELATIONSHIP_DATES module; no store, no network |

### Tests

_None found for this feature._

### Watch out for

**1. Years are computed with a flat 365-day divisor and days as the remainder, so every leap year the split drifts by a day: on the second anniversary the card reads '1 day' extra rather than '0 days'. TimeTogether, BirthdayCountdown and EventCountdown all inherit this.**

`src/config/relationshipDates.ts:112`

```ts
  const years = Math.floor(totalDays / 365);
```

**2. Naive ISO string with no timezone suffix, so it is parsed in the VIEWER's local timezone — the same 'time together' reading differs by hours between partners in different timezones. It is also constructed once at module import, but that is harmless since only its fixed value is read.**

`src/config/relationshipDates.ts:27`

```ts
  datingStart: new Date('2025-10-18T18:00:00'),
```

**3. Visit dates are literals baked into the source; there is no UI anywhere to edit them. Once a date passes, its card renders the 'Event passed' branch (EventCountdown.tsx:158) permanently until someone edits this file and redeploys.**

`src/config/relationshipDates.ts:52`

```ts
      date: new Date(2025, 10, 26), // November 26, 2025 (month is 0-indexed)
```

**4. BirthdayCountdown reconstructs days from the 365-based split, so its day count is elapsed-24h-periods. EventCountdown deliberately does NOT do this — it uses midnight-to-midnight calendar days (EventCountdown.tsx:64-68). Two cards on the same screen can therefore disagree by one day for the same target date.**

`src/components/RelationshipTimers/BirthdayCountdown.tsx:65`

```ts
  const totalDays = timeDiff.years * 365 + timeDiff.days;
```

**5. 'Today' is decided by month/day only, ignoring birthYear and any year rollover, while the countdown beside it uses getNextBirthday which has already rolled to next year (relationshipDates.ts:75 uses <=). On the birthday itself the card therefore shows the celebration state while the underlying timeDiff points ~365 days out.**

`src/components/RelationshipTimers/BirthdayCountdown.tsx:32`

```ts
  const isToday = today.getMonth() === birthday.month - 1 && today.getDate() === birthday.day;
```

**6. Three separate 1s intervals run continuously on the home tab (one per timer component, times four mounted cards) with no visibilitychange pause — six re-renders/second while the tab is backgrounded. Contrast CountdownTimer.tsx:107 which uses 60000ms explicitly 'for battery optimization'.**

`src/components/RelationshipTimers/TimeTogether.tsx:33`

```ts
    const interval = setInterval(updateTime, 1000);
```

**7. computeBirthdayCountdownState is called three separate times in the three lazy useState initializers (lines 43, 46, 49), each constructing its own new Date(). The three pieces of initial state can therefore straddle a second boundary — harmless here, but it means the initializers are not a single atomic snapshot the way updateCountdown is.**

`src/components/RelationshipTimers/BirthdayCountdown.tsx:43`

```ts
    () => computeBirthdayCountdownState(birthday).timeDiff
```

**8. No test coverage: grep for 'time-together|birthday-countdown|event-countdown' across tests/ (excluding tests/e2e-archive) returns zero hits, so none of the leap-year or calendar-day edge cases above are guarded.**

`src/components/RelationshipTimers/TimeTogether.tsx:45`

```ts
      data-testid="time-together"
```

---

## Anniversary Countdown Timer

A settings-driven countdown block that renders under the daily message card, showing the next up-to-3 upcoming anniversaries with a days/hours/minutes breakdown and a sparkle-shower celebration animation when one lands. It reads settings.relationship.anniversaries rather than the hardcoded RELATIONSHIP_DATES the other home timers use — and because that array defaults to empty and the only editor UI is unrouted, it is currently unreachable in the shipped app.

**Start here:** `src/components/CountdownTimer/CountdownTimer.tsx:40`

```ts
export function CountdownTimer({
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/CountdownTimer/CountdownTimer.tsx` | 275 | CountdownTimer list + CountdownCard + CelebrationAnimation; 60s tick interval, celebration debouncing via refs, 3s celebration auto-clear. |
| `src/utils/countdownService.ts` | 152 | calculateTimeRemaining, getUpcomingAnniversaries, getNextAnniversaryDate (leap-year/month-overflow handling), shouldTriggerCelebration, formatCountdownDisplay. |
| `src/components/DailyMessage/DailyMessage.tsx` | 374 | Conditionally mounts <CountdownTimer anniversaries={...} maxDisplay={3} /> only when settings.relationship.anniversaries is non-empty. |
| `src/stores/slices/settingsSlice.ts` | 258 | Defines settings.relationship.anniversaries (defaults to []) and the addAnniversary / removeAnniversary actions. |
| `src/components/Settings/AnniversarySettings.tsx` | 399 | The add/remove anniversary form — the only caller of addAnniversary/removeAnniversary. |
| `src/components/Settings/Settings.tsx` | 172 | Mounts AnniversarySettings; nothing imports this file. |
| `src/utils/deterministicRandom.ts` | 41 | Seeds the celebration sparkles' X positions so the animation is render-pure. |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/settingsSlice.ts` | `settings.relationship.anniversaries` | yes — part of the persisted settings object in localStorage 'my-love-storage' |

### Backend

| | |
|---|---|
| Realtime | none |

### Tests

_None found for this feature._

### Watch out for

**1. This whole feature is dead code in the shipped app. anniversaries defaults to [] (settingsSlice.ts:61), the gate below requires a non-empty array, and the only UI that can populate it (Settings.tsx → AnniversarySettings) is imported by nothing — `grep -rn "components/Settings" src/ tests/` returns zero hits.**

`src/components/DailyMessage/DailyMessage.tsx:359`

```ts
      {settings?.relationship.anniversaries && settings.relationship.anniversaries.length > 0 && (
```

**2. nextDate is built at LOCAL MIDNIGHT of the anniversary day, then rolled forward when it is <= today. So from 00:00:01 on the anniversary itself the countdown already points at next year, and shouldTriggerCelebration (which needs days=hours=minutes=0) is only true during the final minute BEFORE midnight — i.e. at 23:59 on the preceding day, never on the day itself.**

`src/utils/countdownService.ts:93`

```ts
  if (nextDate <= today) {
```

**3. Combined with the gotcha above, the celebration window is one minute wide while the poll interval is also one minute — updateCelebration can step straight over it and the sparkles/'Today is X!' state never fires at all.**

`src/components/CountdownTimer/CountdownTimer.tsx:107`

```ts
    }, 60000); // 1 minute interval for battery optimization
```

**4. buildCountdowns takes a _tick argument it never reads; tick exists purely to bust the useMemo on line 74 so the displayed numbers refresh. Removing the unused parameter or the tick dep silently freezes every countdown at its mount-time value.**

`src/components/CountdownTimer/CountdownTimer.tsx:57`

```ts
    (_tick: number): AnniversaryWithCountdown[] => {
```

**5. activeCelebrationRef gates on anniversary.id so a celebration fires once per id — but the 3s auto-clear timer resets celebratingId without resetting the ref, so it only re-arms when a DIFFERENT anniversary celebrates or when the celebrating one drops out of the upcoming list.**

`src/components/CountdownTimer/CountdownTimer.tsx:80`

```ts
      if (activeCelebrationRef.current !== celebrating.anniversary.id) {
```

**6. Month-overflow guard: for e.g. '2000-02-30' the Date rolls into March, is detected, and is clamped to the last day of the target month via day 0 of the following month. Same trick is repeated at line 98 for the next-year branch — both must be edited together.**

`src/utils/countdownService.ts:89`

```ts
    nextDate = new Date(today.getFullYear(), month, 0);
```

**7. getUpcomingAnniversaries filters on nextDate > now and slices to `count`, but CountdownTimer then recomputes getNextAnniversaryDate independently per render (line 59). The filter list and the displayed countdowns are computed from two different `new Date()` reads, so an anniversary can survive the filter and then render a fully-elapsed countdown.**

`src/utils/countdownService.ts:65`

```ts
    .filter(({ nextDate }) => nextDate > now)
```

---

## Welcome Splash & Re-view Button

On first load, and on any load where 60 minutes have elapsed since the last dismissal, the app renders a full-screen splash with raining hearts and a personal caption instead of the main shell. Tapping Continue stores the current timestamp and drops the user into the app. A floating heart FAB in the bottom-right of the home tab lets the user pull the splash back up at any time.

**Start here:** `src/App.tsx:494`

```ts
  if (showSplash) {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/WelcomeSplash/WelcomeSplash.tsx` | 120 | The splash screen: 15 randomized raining-heart emoji, animated heading, caption, and the Continue button. |
| `src/components/WelcomeButton/WelcomeButton.tsx` | 68 | Fixed bottom-right FAB with a desktop-only hover tooltip and a looping pulse ring; calls onShowWelcome. |
| `src/components/DailyMessage/DailyMessage.tsx` | 374 | Renders WelcomeButton, but only when the optional onShowWelcome prop is supplied. |
| `src/App.tsx` | 610 | Owns the 60-minute timer (WELCOME_DISPLAY_INTERVAL / 'lastWelcomeView'), the showSplash state, handleContinue and showWelcomeManually; lazy-loads WelcomeSplash behind Suspense. |

### Backend

| | |
|---|---|
| Realtime | none — state lives entirely in the localStorage key 'lastWelcomeView' (App.tsx:66), outside the Zustand persist store |

### Tests

- `tests/e2e/home/welcome-splash.spec.ts` — e2e

### Watch out for

**1. The manual FAB path deliberately does NOT write lastWelcomeView, so re-viewing the splash never resets the 60-minute clock — the splash can reappear automatically moments after the user closed a manual view. Only handleContinue (App.tsx:477) touches the key.**

`src/App.tsx:481`

```ts
  // Handle manual trigger from button (does NOT reset timer)
```

**2. shouldShowWelcome is passed as a lazy initializer, so localStorage is read exactly once per App mount. A tab left open for hours never re-evaluates the interval; the splash only reappears on reload.**

`src/App.tsx:109`

```ts
  const [showSplash, setShowSplash] = useState(shouldShowWelcome);
```

**3. When showSplash is true, App returns the splash EARLY (line 494) before the nav shell, BottomNavigation and NetworkStatusIndicator render — so the splash preempts whatever view the user had navigated to, and there is no way past it except the Continue button.**

`src/App.tsx:498`

```ts
          <WelcomeSplash onContinue={handleContinue} />
```

**4. This is the one place in the feature area that still uses Math.random instead of generateDeterministicNumbers (compare DailyMessage.tsx:39 and CountdownTimer.tsx:241). It is wrapped in useMemo so it survives re-renders, but the splash rains a different heart layout on every mount, which makes it non-snapshotable.**

`src/components/WelcomeSplash/WelcomeSplash.tsx:15`

```ts
    x: Math.random() * 100, // Random horizontal position (0-100%)
```

**5. WelcomeSplash is lazy() + Suspense while DailyMessage is imported eagerly — so on a cold first visit the user waits on a chunk fetch for the splash before reaching the already-loaded home view. Offline-first cold start therefore hits the splash chunk before anything else.**

`src/App.tsx:47`

```ts
const WelcomeSplash = lazy(() =>
```

---

# Mood tab

_Mood logging and history, plus an inline view of the partner's latest mood._

## Mood Entry & Offline Sync

On the 'Log Mood' tab the user picks any number of the 12 moods (6 positive / 6 challenging), optionally adds a note capped at 200 characters, and taps Log Mood. The entry is written to IndexedDB first (offline-safe), pushed into the Zustand store optimistically, then immediately pushed to Supabase if online; if offline it is queued and a Background Sync registration retries later, with a visible pending-count and a manual Retry button. Logging again on the same calendar day edits the existing entry rather than creating a second one, and the form pre-populates with today's saved moods so the button reads 'Update Mood'.

**Start here:** `src/components/MoodTracker/MoodTracker.tsx:77`

```ts
export function MoodTracker() {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/MoodTracker/MoodTracker.tsx` | 568 | Tab shell for the whole mood view plus the 'Log Mood' form: mood grid, note field, submit, sync indicator, offline retry |
| `src/components/MoodTracker/MoodButton.tsx` | 45 | Single animated toggle button for one mood type; aria-pressed reflects selection |
| `src/stores/slices/moodSlice.ts` | 346 | Zustand slice: addMoodEntry / updateMoodEntry / loadMoods / updateSyncStatus / syncPendingMoods and the moods + syncStatus state |
| `src/services/moodService.ts` | 256 | IndexedDB CRUD for moods (create, updateMood, getMoodForDate, getMoodsInRange, getUnsyncedMoods, markAsSynced) with Zod validation |
| `src/services/dbSchema.ts` | — | Declares the IndexedDB 'moods' object store and its unique by-date index (DB v3) |
| `src/api/moodSyncService.ts` | 451 | Uploads unsynced IndexedDB moods to Supabase with exponential-backoff retry and broadcasts the result to the partner |
| `src/api/moodApi.ts` | 478 | Zod-validated Supabase wrapper for the moods table (create/fetchByUser/fetchByDateRange/update/delete/getMoodHistory) |
| `src/validation/schemas.ts` | — | MoodEntrySchema — client-side validation of date, mood, moods[] and the 200-char note limit |
| `src/api/validation/supabaseSchemas.ts` | — | SupabaseMoodSchema / MoodInsertSchema — validates rows coming back from the moods table, mood_types nullable for legacy rows |
| `src/utils/dateUtils.ts` | 184 | formatDateISO — local-timezone YYYY-MM-DD used as the one-mood-per-day key |
| `src/types/index.ts` | — | MoodType union (12 values) and the MoodEntry interface stored in IndexedDB |
| `src/App.tsx` | — | Lazy-loads and mounts MoodTracker when currentView === 'mood' |
| `supabase/migrations/20251203000001_create_base_schema.sql` | — | Creates the moods table (mood_type, mood_types[], note, created_at) and its RLS policies |
| `supabase/migrations/20251206024345_remote_schema.sql` | — | Converts mood_type/mood_types to text with CHECK constraints, raises the note limit to 500, replaces the SELECT policy |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/moodSlice.ts` | `moods`, `partnerMoods`, `syncStatus` | partial — only `moods` is written to localStorage via the persist partialize; partnerMoods and syncStatus are runtime-only |
| `src/stores/slices/authSlice.ts` | `userId` | no — read by addMoodEntry to stamp the entry's userId |

### Backend

| | |
|---|---|
| Supabase tables | `moods`, `users` |
| IndexedDB stores | `moods` |
| Realtime | Supabase Broadcast only (no postgres_changes). After a successful insert the sender opens an ephemeral channel `mood-updates:<partnerId>` and sends a `new_mood` event; each client subscribes to its own `mood-updates:<ownUserId>` with broadcast self:false. moodSyncService.ts:318-320 states RLS makes postgres_changes unusable here. |

### Tests

- `tests/unit/stores/moodSlice.test.ts` — unit
- `tests/unit/services/moodService.test.ts` — unit
- `tests/e2e/mood/mood-tracker.spec.ts` — e2e

### Watch out for

**1. Stale header comment. The slice is NOT self-contained — addMoodEntry reads authSlice state via `const userId = get().userId;` (moodSlice.ts:63) and throws 'User not authenticated' if it is null. If the auth slice has not been populated by onAuthStateChange yet, mood logging fails outright.**

`src/stores/slices/moodSlice.ts:10`

```ts
 * - None (self-contained)
```

**2. Stale/incorrect. syncStatus is NOT persisted; the whole `moods` array IS (useAppStore.ts:132 `moods: state.moods,`). Consequence: MoodEntry.timestamp is a Date that JSON-serializes to a string, so on first paint after reload the store holds string timestamps until loadMoods() overwrites the array from IndexedDB. MoodDetailModal defends against this with `const moodDate = new Date(mood.timestamp);` (MoodDetailModal.tsx:94).**

`src/stores/slices/moodSlice.ts:14`

```ts
 * - LocalStorage: sync status cached for offline indicator
```

**3. One-mood-per-day is enforced by a UNIQUE IndexedDB index, not just by app logic. The only guard in the slice is `if (existingMood && existingMood.id)` (moodSlice.ts:72) against the in-memory `moods` array — so if addMoodEntry runs before loadMoods() has populated the store (or after a store reset), moodService.create hits a ConstraintError from IndexedDB instead of taking the update path.**

`src/services/dbSchema.ts:252`

```ts
    moodsStore.createIndex('by-date', 'date', { unique: true });
```

**4. Sync to Supabase is INSERT-only — there is no update path and the moods table has no unique constraint (no UNIQUE on moods exists in either migration). Editing today's mood sets `synced: false` (moodService.ts:133), so the next sync inserts a SECOND Supabase row for the same day and markAsSynced overwrites the local supabaseId. Net effect: the IndexedDB-backed Calendar shows one entry per day while the Supabase-backed Timeline shows one row per save.**

`src/api/moodSyncService.ts:93`

```ts
    const syncedMood = await moodApi.create(moodInsert);
```

**5. The broadcast payload carries mood_types, but the receiver rebuilds the record without it — subscribeMoodUpdates constructs `{ id, user_id, mood_type, note, created_at, updated_at }` only (moodSyncService.ts:373-374 go straight from mood_type to note). So a live partner update renders just the primary mood emoji; the full multi-mood set only appears after a refetch, because PartnerMoodDisplay falls back to `[partnerMood.mood_type]` when mood_types is absent.**

`src/api/moodSyncService.ts:139`

```ts
                  mood_types: mood.mood_types,
```

**6. The singleton stores exactly ONE channel. subscribeMoodUpdates assigns `this.realtimeChannel = supabase.channel(...)` (line 360) and the returned unsubscribe closure reads `this.realtimeChannel` (line 390) rather than a captured local. Two concurrent subscribers (e.g. MoodTracker's PartnerMoodDisplay plus PartnerMoodView) leak the first channel and the first unsubscribe tears down the second subscriber's channel.**

`src/api/moodSyncService.ts:46`

```ts
  private realtimeChannel: RealtimeChannel | null = null;
```

**7. The prefill effect has no else branch and never clears selectedMoods/note/isEditing. If the app is left open across local midnight, yesterday's selections stay in the form and the button still reads 'Update Mood', but addMoodEntry recomputes `const today = formatDateISO(new Date());` (moodSlice.ts:69) and creates a brand-new entry for the new date. Deps are `[getMoodForDate, moods]` (line 154) — nothing re-runs on a date change.**

`src/components/MoodTracker/MoodTracker.tsx:140`

```ts
    if (existingMood) {
```

**8. This documents the fixed date-boundary bug: formatDateISO now builds the key from getFullYear/getMonth/getDate (local wall clock), so a mood logged at 11 PM EST lands on the correct local day. Every mood date key flows through this one function — moodService.create (line 65), moodSlice.addMoodEntry (line 69), and MoodTracker's prefill (line 137) — and calendarHelpers.formatDateKey (calendarHelpers.ts:112) is an independent byte-for-byte duplicate of the same logic used for calendar lookups.**

`src/utils/dateUtils.ts:122`

```ts
 * `toISOString().split('T')[0]` which is UTC-based — at 11 PM EST
```

**9. Client and database disagree on the note limit. The client caps at 200 in three places (this schema, MoodInsertSchema, and `maxLength={200}` on the textarea), but the live DB constraint is 500: supabase/migrations/20251206024345_remote_schema.sql:117 `alter table "public"."moods" add constraint "moods_note_check" CHECK ((char_length(note) <= 500)) not valid;`. Rows written by anything other than this client can exceed what the UI expects.**

`src/validation/schemas.ts:124`

```ts
  note: z.string().max(200, 'Note cannot exceed 200 characters').optional().or(z.literal('')),
```

**10. getUnsyncedMoods reads the entire moods store into memory and filters in JS — there is no index on `synced` (dbSchema.ts declares only `'by-date': string` for the moods store). updateSyncStatus() calls this on every add, update, and sync cycle, so the cost grows linearly with total mood history.**

`src/services/moodService.ts:218`

```ts
      const unsynced = allMoods.filter((mood) => !mood.synced);
```

---

## Mood History — Calendar and Timeline views

Two separate history surfaces sit behind their own tabs in the mood view. 'Calendar' renders a month grid where days with moods are colour-coded by their primary mood and tapping one opens a detail modal with all selected moods, the formatted date/time and the note; arrows (or left/right arrow keys) move between months with year rollover. 'Timeline' renders a virtualized, infinitely-scrolling reverse-chronological list grouped under Today / Yesterday / date headers, with long notes truncated at 100 chars and a Show more toggle. The two views read from completely different data sources: the calendar queries IndexedDB, the timeline pages through Supabase.

**Start here:** `src/components/MoodHistory/MoodHistoryCalendar.tsx:39`

```ts
export function MoodHistoryCalendar() {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/MoodHistory/MoodHistoryCalendar.tsx` | 332 | Month grid, month navigation, per-month IndexedDB query, modal wiring, keyboard nav |
| `src/components/MoodHistory/CalendarDay.tsx` | 146 | Memoized single day cell; colour + icon come from the FIRST mood in the moods array |
| `src/components/MoodHistory/MoodDetailModal.tsx` | 207 | Bottom-sheet modal with focus trap and ESC handling showing all moods, date, time and note |
| `src/components/MoodHistory/index.ts` | 6 | Barrel — exports only MoodHistoryCalendar |
| `src/components/MoodTracker/MoodHistoryTimeline.tsx` | 226 | react-window virtualized list with useInfiniteLoader; flattens date groups into header + mood rows and computes variable row heights |
| `src/components/MoodTracker/MoodHistoryItem.tsx` | 99 | One timeline row: emoji set, comma-joined labels, relative timestamp, expand/collapse note |
| `src/hooks/useMoodHistory.ts` | 101 | Paginates Supabase mood history 50 rows at a time and tracks hasMore/offset/error |
| `src/utils/moodGrouping.ts` | 75 | groupMoodsByDate — buckets Supabase rows by created_at and labels them Today / Yesterday / 'Nov 15' |
| `src/utils/calendarHelpers.ts` | 238 | Pure calendar math: generateCalendarDays, formatDateKey, getMonthBoundaries, formatModalDate/Time, getMonthName, month navigation with year rollover |
| `src/utils/moodEmojis.ts` | 47 | MoodType to emoji map used by the timeline rows |
| `src/services/moodService.ts` | 256 | getMoodsInRange backs the calendar via the by-date IndexedDB index |
| `src/api/moodApi.ts` | 478 | getMoodHistory(userId, offset, limit) backs the timeline via a Supabase range query |
| `src/utils/dateUtils.ts` | 184 | getRelativeTime for timeline row timestamps |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/moodSlice.ts` | `moods` | partial — the Calendar deliberately does NOT read this; it queries moodService directly |

### Backend

| | |
|---|---|
| Supabase tables | `moods` |
| IndexedDB stores | `moods` |
| Realtime | none — neither history view subscribes; both are pull-only and refresh on mount / scroll |

### Tests

- `tests/e2e/mood/mood-tracker.spec.ts` — e2e
- `tests/unit/utils/moodGrouping.test.ts` — unit
- `tests/unit/services/moodService.test.ts` — unit

### Watch out for

**1. The Calendar bypasses the Zustand store entirely and reads IndexedDB directly into its own local `moods`/`moodMap` state. Nothing in the store can push an update into it — it only refreshes because AnimatePresence unmounts/remounts the tab and the mount effect refires (`loadMoodsForMonth(currentYear, currentMonth)` at line 94). Logging a mood while the Calendar tab is already mounted will not update the grid.**

`src/components/MoodHistory/MoodHistoryCalendar.tsx:68`

```ts
      const fetchedMoods = await moodService.getMoodsInRange(startOfMonth, endOfMonth);
```

**2. The 300 ms month-nav debounce collapses rapid clicks into a single month step. Each handler clears the pending timer and schedules a new one that computes `navigateToNextMonth(currentYear, currentMonth)` (line 125) from the state captured at click time — which has not advanced yet. Five fast clicks on 'next' therefore move exactly one month, not five.**

`src/components/MoodHistory/MoodHistoryCalendar.tsx:107`

```ts
    navDebounceRef.current = setTimeout(() => {
```

**3. Arrow-key month navigation is bound at the window level with no target check (it only bails when the detail modal is open). Any left/right arrow press anywhere on the page while the Calendar tab is mounted changes the month — including arrow keys pressed inside a text field elsewhere in the view.**

`src/components/MoodHistory/MoodHistoryCalendar.tsx:166`

```ts
    window.addEventListener('keydown', handleKeyDown);
```

**4. The Timeline groups by the Supabase `created_at` TIMESTAMPTZ rendered in the viewer's local timezone, while the Calendar keys off MoodEntry.date (a local YYYY-MM-DD string computed at write time). The two views can therefore place the same mood on different days if the device timezone changed between logging and viewing. Note also that `new Date('')` yields an Invalid Date whose toDateString() is 'Invalid Date' — a null created_at silently produces one bogus group.**

`src/utils/moodGrouping.ts:35`

```ts
    const date = new Date(mood.created_at || '');
```

**5. Today/Yesterday labels are computed from a fixed 86 400 000 ms day against `now` (current wall-clock time) versus `date` (midnight of the group). Across a DST transition the 23- or 25-hour day makes this off by one, so a group can be labelled 'Today' when it is yesterday or vice versa.**

`src/utils/moodGrouping.ts:66`

```ts
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
```

**6. `isPartnerView` is declared in MoodHistoryItemProps and passed down by the timeline (MoodHistoryTimeline.tsx:202 `<MoodHistoryItem mood={item.mood} isPartnerView={isPartnerView} />`) but is never destructured or used. Partner rows render identically to own rows; the prop is dead.**

`src/components/MoodTracker/MoodHistoryItem.tsx:35`

```ts
export function MoodHistoryItem({ mood }: MoodHistoryItemProps) {
```

**7. hasMore is inferred from a full page, so when the total is an exact multiple of 50 the hook believes there is more and fires one extra empty request before settling. Also note the initial-load effect depends only on `[userId]` — nothing re-runs it when a new mood is logged, so a freshly saved mood does not appear in the Timeline until the tab is remounted.**

`src/hooks/useMoodHistory.ts:61`

```ts
        setHasMore(data.length === PAGE_SIZE);
```

**8. A multi-mood day is rendered with only the FIRST mood's background colour and icon; the remaining moods are invisible on the grid and appear only in the detail modal. 'First' means selection order at log time, not any severity or priority ordering.**

`src/components/MoodHistory/CalendarDay.tsx:79`

```ts
  const primaryMood = allMoods.length > 0 ? allMoods[0] : undefined;
```

**9. getMonthBoundaries returns Date objects with a time component, but moodService.getMoodsInRange immediately reduces them to YYYY-MM-DD strings for `IDBKeyRange.bound(startString, endString)` (moodService.ts:195). The times are decorative — the range is a lexicographic string comparison over the by-date index, not a timestamp comparison.**

`src/utils/calendarHelpers.ts:137`

```ts
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day at 23:59:59.999
```

**10. The 'P0' unit test for mood grouping asserts nothing — both cases are stubs with a TODO. The same is true of tests/unit/utils/dateFormat.test.ts:15, the supposed coverage for the midnight/DST edge cases. Date-boundary behaviour across this feature is effectively untested.**

`tests/unit/utils/moodGrouping.test.ts:15`

```ts
    expect(true).toBe(true); // Placeholder
```

---

## Partner Mood Display & Realtime Sync

At the top of the 'Log Mood' tab the user sees their partner's most recent mood: the emoji (or emojis) for every mood they selected, the comma-joined labels, a relative timestamp, an optional note, and a 'Just now' badge if it was logged in the last five minutes. The card animates when a live update arrives. The initial value is a one-row Supabase fetch; live updates arrive over a Supabase Broadcast channel because RLS makes postgres_changes unusable for the partner lookup. Empty, loading and error states are all handled explicitly.

**Start here:** `src/components/MoodTracker/PartnerMoodDisplay.tsx:55`

```ts
export function PartnerMoodDisplay({ partnerId }: PartnerMoodDisplayProps) {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/MoodTracker/PartnerMoodDisplay.tsx` | 171 | Renders the partner mood card, the 'Just now' badge and the update pulse animation |
| `src/components/MoodTracker/NoMoodLoggedState.tsx` | 25 | Friendly empty state when the partner has never logged a mood |
| `src/hooks/usePartnerMood.ts` | 127 | Loads the latest partner mood and subscribes to broadcast updates; tracks connecting/connected/disconnected |
| `src/api/moodSyncService.ts` | 451 | getLatestPartnerMood, fetchMoods, subscribeMoodUpdates and broadcastMoodToPartner |
| `src/api/supabaseClient.ts` | — | getPartnerId — resolves the session user's partner_id from the users table |
| `src/utils/moodEmojis.ts` | 47 | MoodType to emoji map used for the partner card |
| `src/utils/dateUtils.ts` | 184 | getRelativeTime and isJustNow (5-minute threshold) for the timestamp and badge |
| `src/stores/slices/moodSlice.ts` | 346 | fetchPartnerMoods / partnerMoods / getPartnerMoodForDate — a parallel partner-mood path the mood view does not use |
| `src/components/MoodTracker/MoodTracker.tsx` | 568 | Resolves partnerId once on mount and conditionally renders the card |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/moodSlice.ts` | `partnerMoods`, `syncStatus` | no — partnerMoods is populated by fetchPartnerMoods but only consumed by the 'partner' nav view, not by this card |

### Backend

| | |
|---|---|
| Supabase tables | `moods`, `users` |
| Realtime | Broadcast. Each client subscribes to `mood-updates:<ownUserId>` with `broadcast: { self: false }` and listens for the `new_mood` event; after a successful insert the sender opens an ephemeral channel to `mood-updates:<partnerId>` and sends, then removes the channel. Chosen over postgres_changes because the partner RLS subquery cannot be evaluated by Realtime. |

### Tests

- `tests/unit/stores/moodSlice.test.ts` — unit
- `tests/e2e/partner/partner-mood.spec.ts` — e2e

### Watch out for

**1. Two independent partner-mood pipelines exist and they do not share state. This card goes PartnerMoodDisplay -> usePartnerMood -> moodSyncService.getLatestPartnerMood (one row, direct Supabase). The store's partnerMoods array (moodSlice.fetchPartnerMoods, 30 rows) is consumed only by src/components/PartnerMoodView/PartnerMoodView.tsx. Refreshing one does not refresh the other.**

`src/components/MoodTracker/MoodTracker.tsx:343`

```ts
            {partnerId && <PartnerMoodDisplay partnerId={partnerId} />}
```

**2. Partner mood dates are re-derived on the reader's device: the Supabase created_at timestamp is converted to the VIEWER's local YYYY-MM-DD, not the partner's. A partner in a different timezone can appear on a different calendar day than the one they logged on. There is no per-user timezone stored anywhere.**

`src/stores/slices/moodSlice.ts:320`

```ts
          date: formatDateISO(new Date(createdAt)), // Extract local YYYY-MM-DD
```

**3. syncPendingMoods does double duty: after pushing local moods it reloads from IndexedDB and then fires an unawaited `fetchPartnerMoods(30)` to 'mimic realtime updates'. So partner data refreshes as a side effect of the current user logging a mood — but only into the store's partnerMoods, which the mood-view card never reads.**

`src/stores/slices/moodSlice.ts:227`

```ts
      await get().loadMoods();
```

**4. getPartnerMoodForDate has no consumer in src/ — grep finds it only at moodSlice.ts:45 (interface), moodSlice.ts:343 (implementation) and in tests/unit/stores/moodSlice.test.ts. It is tested dead code, easy to mistake for the calendar's partner lookup.**

`src/stores/slices/moodSlice.ts:343`

```ts
  getPartnerMoodForDate: (date) => {
```

**5. getLatestPartnerMood swallows all errors and returns null (moodSyncService.ts:442 returns null for graceful degradation), so a network or RLS failure cannot reach the hook's catch block. The result is that PartnerMoodDisplay renders NoMoodLoggedState ('No mood logged yet') for a failed fetch — the error branch is only reachable if the hook itself throws, which this path never does.**

`src/hooks/usePartnerMood.ts:65`

```ts
        const mood = await moodSyncService.getLatestPartnerMood(partnerId);
```

**6. The initial fetch and the subscription are launched concurrently and unordered. A broadcast that lands before loadPartnerMood resolves is overwritten by the older fetched row, because both call setPartnerMood with no timestamp comparison. The window is small but real when the partner logs a mood exactly as the tab opens.**

`src/hooks/usePartnerMood.ts:115`

```ts
    subscribeToPartnerMoodUpdates();
```

**7. partnerId is resolved once on mount with an empty dep array and cached in component state; getPartnerId does a fresh Supabase session + users-table query every call. If the user pairs with a partner while the mood view is open, the card stays hidden until the view is remounted. The same effect uses a `mounted` flag to avoid setting state after unmount.**

`src/components/MoodTracker/MoodTracker.tsx:118`

```ts
  useEffect(() => {
```

**8. The 'partner just updated' pulse is deliberately deferred through queueMicrotask to avoid a synchronous cascading render, and it is suppressed on first load by the `prevMoodIdRef.current !== undefined` check. Removing either guard reintroduces an animation on every mount, not just on real updates.**

`src/components/MoodTracker/PartnerMoodDisplay.tsx:70`

```ts
      queueMicrotask(() => setJustUpdated(true));
```

---

# Partner tab

_Partner linking, the partner's mood feed, and poke/kiss/fart interactions._

## Partner Linking (search, request, accept/decline)

From the Partner tab, a user with no partner sees a search box that finds other users by email or display name (min 2 chars, 300ms debounce), sends a connection request, and sees their own pending sent requests. The recipient sees received requests with Accept/Decline buttons. Accepting calls a SECURITY DEFINER Postgres function that writes partner_id on both user rows and auto-declines every other pending request for both people. Once linked, the same view flips to the partner mood screen.

**Start here:** `src/components/PartnerMoodView/PartnerMoodView.tsx:74`

```ts
export function PartnerMoodView() {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/PartnerMoodView/PartnerMoodView.tsx` | 674 | Renders the whole partner tab: search box, sent/received request lists, and (once linked) the partner mood list |
| `src/stores/slices/partnerSlice.ts` | 141 | Zustand slice holding partner, sentRequests, receivedRequests, searchResults and the load/search/send/accept/decline actions |
| `src/api/partnerService.ts` | 340 | Supabase calls: getPartner, searchUsers, sendPartnerRequest, getPendingRequests, and the accept/decline RPC wrappers |
| `src/api/supabaseClient.ts` | 158 | getPartnerId() / getPartnerDisplayName() helpers that every other feature uses to resolve the linked partner |
| `src/components/DisplayNameSetup/DisplayNameSetup.tsx` | 199 | Post-OAuth modal that sets the display name other users search on |
| `src/components/DisplayNameSetup/DisplayNameSetup.css` | 220 | Styles for the display-name modal (plain CSS, not Tailwind, unlike the rest of the feature) |
| `src/components/DisplayNameSetup/index.ts` | 1 | Barrel export |
| `src/components/PartnerMoodView/index.ts` | 1 | Barrel export |
| `supabase/migrations/20251203000001_create_base_schema.sql` | — | Creates users.partner_id, partner_requests table and the first accept_partner_request function |
| `supabase/migrations/20251206024345_remote_schema.sql` | — | Current accept_partner_request / decline_partner_request definitions, sync_user_profile trigger, and the live RLS policies |
| `supabase/migrations/20251206200000_fix_users_update_privilege_escalation.sql` | — | Replaces users_update_self with users_update_self_safe so partner_id cannot be self-assigned |
| `src/App.tsx` | 610 | Routes currentView === 'partner' to PartnerMoodView and gates DisplayNameSetup on missing user_metadata.display_name |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/partnerSlice.ts` | `partner`, `isLoadingPartner`, `sentRequests`, `receivedRequests`, `isLoadingRequests`, `searchResults`, `isSearching` | no — partialize in src/stores/useAppStore.ts:119 only persists settings, isOnboarded, messageHistory and moods |

### Backend

| | |
|---|---|
| Supabase tables | `users`, `partner_requests` |
| RPCs | `accept_partner_request`, `decline_partner_request` |
| Realtime | none — partner linking has no subscription; the view only reloads partner/requests on mount and on online-status change |

### Tests

- `tests/e2e/partner/partner-mood.spec.ts` — e2e

### Watch out for

**1. partner_id is deliberately not client-writable. The users_update_self_safe RLS policy has a WITH CHECK that re-reads the caller's current partner_id and requires it to be unchanged, so any client-side attempt to set partner_id (including a `.upsert` that includes the column) silently fails. Linking MUST go through the accept_partner_request SECURITY DEFINER RPC.**

`supabase/migrations/20251206200000_fix_users_update_privilege_escalation.sql:33`

```ts
      (partner_id IS NOT DISTINCT FROM (SELECT partner_id FROM public.users WHERE id = auth.uid()))
```

**2. Accepting one request nukes every other pending request touching either user, in both directions. If you had two people asking you out, accepting one silently declines the other — the UI never mentions this.**

`supabase/migrations/20251206024345_remote_schema.sql:217`

```ts
    UPDATE partner_requests
```

**3. DisplayNameSetup writes the name to auth user_metadata (supabase.auth.updateUser), then upserts public.users with ONLY id + updated_at — it never sends display_name. The name reaches public.users solely through the sync_user_profile DB trigger, which fires on UPDATE of auth.users too. Remove that trigger and partner search by display name silently stops finding anyone.**

`src/components/DisplayNameSetup/DisplayNameSetup.tsx:74`

```ts
      const { error: upsertError } = await supabase.from('users').upsert(
```

**4. The trigger that makes the above work is named on_auth_user_created but fires on INSERT **OR UPDATE** — the name is misleading and hides that it is the display-name sync path, not just signup bootstrapping.**

`supabase/migrations/20251206024345_remote_schema.sql:369`

```ts
CREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();
```

**5. searchUsers interpolates the raw lowercased query straight into a PostgREST `.or()` filter string. Characters meaningful to PostgREST filter syntax (comma, parentheses, dot) are not escaped, so a query containing them changes the filter's structure rather than being matched literally.**

`src/api/partnerService.ts:122`

```ts
        .or(`email.ilike.%${searchLower}%,display_name.ilike.%${searchLower}%`)
```

**6. PartnerSlice.hasPartner() is a synchronous store selector reading local state, while PartnerService.hasPartner() is async and hits the network. Same name, different semantics — the store version returns false until loadPartner() has resolved.**

`src/stores/slices/partnerSlice.ts:138`

```ts
  hasPartner: () => {
```

**7. Every partnerService method swallows failures and returns an empty/null result instead of throwing (getPartner returns null, searchUsers returns [], getPendingRequests returns {sent:[],received:[]}). A network outage is indistinguishable from "you have no partner", and the UI then renders the connect-a-partner screen.**

`src/api/partnerService.ts:91`

```ts
      console.error('[PartnerService] Error in getPartner:', error);
```

---

## Poke / Kiss / Fart Interactions

A heart FAB on the partner tab expands into History, Poke, Kiss and Fart buttons. Poke and Kiss insert a row into the Supabase interactions table addressed to the partner; the recipient's app picks it up over a postgres_changes realtime subscription and shows a pulsing count badge on the FAB. Tapping the badge plays a full-screen emoji animation and then marks the interaction viewed. Each action has a client-side 30-minute cooldown, and a History modal lists the last 7 days of sent/received interactions.

**Start here:** `src/components/PokeKissInterface/PokeKissInterface.tsx:62`

```ts
export function PokeKissInterface({ expandDirection = 'up' }: PokeKissInterfaceProps) {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/PokeKissInterface/PokeKissInterface.tsx` | 581 | The FAB, cooldown timers, toasts, notification badge, realtime subscription lifecycle, and the three Framer Motion animation overlays |
| `src/components/InteractionHistory/InteractionHistory.tsx` | 205 | Modal listing the last 7 days of interactions with sent/received direction, relative timestamps and a New badge |
| `src/stores/slices/interactionsSlice.ts` | 253 | Zustand slice: sendPoke/sendKiss, markInteractionViewed, unviewedCount bookkeeping, subscribe wiring, dedupe of incoming records |
| `src/api/interactionService.ts` | 346 | Supabase layer: insert interaction, postgres_changes subscription, history/unviewed queries, mark-as-viewed update |
| `src/utils/interactionValidation.ts` | 121 | UUID + interaction-type validation and the INTERACTION_ERRORS message map used before any insert |
| `src/components/PokeKissInterface/index.ts` | 1 | Barrel export |
| `src/components/InteractionHistory/index.ts` | 1 | Barrel export |
| `src/api/supabaseClient.ts` | 158 | getPartnerId() — resolves the recipient before each send |
| `supabase/migrations/20251203000001_create_base_schema.sql` | — | Creates the interactions table and its three RLS policies |
| `supabase/migrations/20251206024345_remote_schema.sql` | — | Live interactions RLS policies, the poke/kiss CHECK constraint, and the to_user_id/viewed index |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/interactionsSlice.ts` | `interactions`, `unviewedCount`, `isSubscribed` | no — not in the partialize list at src/stores/useAppStore.ts:119; state is rebuilt per session |
| `src/stores/slices/authSlice.ts` | `userId` | no — read (not owned) by interactionsSlice via get().userId for every send/load/subscribe |

### Backend

| | |
|---|---|
| Supabase tables | `interactions` |
| Realtime | postgres_changes INSERT on public.interactions, channel 'incoming-interactions', filter to_user_id=eq.<currentUserId> |

### Tests

- `tests/unit/utils/interactionValidation.test.ts` — unit
- `tests/e2e/partner/partner-mood.spec.ts` — e2e

### Watch out for

**1. The Fart button is theatre. handleFart only writes a localStorage cooldown and plays a local animation — it never calls the store or Supabase, and there is no 'fart' value in the interactions type CHECK constraint. The partner never receives anything.**

`src/components/PokeKissInterface/PokeKissInterface.tsx:231`

```ts
      localStorage.setItem(RATE_LIMIT_KEYS.fart, Date.now().toString());
```

**2. unviewedCount is inflated by your OWN outgoing pokes. loadInteractionHistory counts every row with viewed === false, but the underlying query returns rows where you are sender OR recipient, and sends are inserted with viewed: false. So opening the History modal bumps the badge by the number of pokes you sent that the partner hasn't opened yet.**

`src/stores/slices/interactionsSlice.ts:181`

```ts
      const unviewedCount = interactions.filter((i) => !i.viewed).length;
```

**3. Same root cause on the read side: getUnviewedInteractions filters only on !viewed, never on toUserId === userId. Tapping the badge can therefore replay an animation for an interaction you sent yourself.**

`src/stores/slices/interactionsSlice.ts:154`

```ts
    return interactions.filter((interaction) => !interaction.viewed);
```

**4. When that happens, markInteractionViewed flips the row locally but the UPDATE hits zero rows on the server — the RLS policy only lets the RECIPIENT mark an interaction viewed, and a 0-row PostgREST update returns no error. Local and server state silently diverge until the next reload.**

`supabase/migrations/20251206024345_remote_schema.sql:321`

```ts
using ((( SELECT auth.uid() AS uid) = to_user_id));
```

**5. The slice's own header comment is stale. Nothing loads interactions at app init — grep for loadInteractionHistory finds exactly three references (the interface, the implementation, and the InteractionHistory modal's effect). On a fresh page load the badge reads 0 no matter how many unviewed pokes are waiting, until either a realtime INSERT arrives or the user opens the History modal.**

`src/stores/slices/interactionsSlice.ts:15`

```ts
 * - Fetched from Supabase on app init and via Realtime updates
```

**6. The 'optimistic UI' comment is wrong and there is no rollback path: the local push happens only after `await interactionService.sendPoke(...)` has already resolved. If you ever make it genuinely optimistic you must add the rollback the comment implies exists.**

`src/stores/slices/interactionsSlice.ts:84`

```ts
      // Add to local state immediately (optimistic UI)
```

**7. The subscription setup has an unmount race. The cleanup checks subscriptionRef.current, but if the component unmounts while subscribeToInteractions() is still awaiting, cleanup sees null and does nothing — then the resolved promise assigns the unsubscribe fn to a ref nobody will ever call, leaking the Realtime channel.**

`src/components/PokeKissInterface/PokeKissInterface.tsx:131`

```ts
        subscriptionRef.current = unsubscribe;
```

**8. InteractionService keeps a single this.realtimeChannel and always uses the literal channel name 'incoming-interactions'. A second subscribe overwrites the field, so the first channel can never be removed — mounting PokeKissInterface twice leaks. The double-ref guard in the component is what prevents this in practice.**

`src/api/interactionService.ts:183`

```ts
      .channel('incoming-interactions')
```

**9. Interactions use postgres_changes, unlike moods which deliberately use Broadcast because RLS defeats postgres_changes. postgres_changes also requires the table to be in the supabase_realtime publication — grep -rc 'supabase_realtime' across all 26 files in supabase/migrations returns zero matches, so nothing in this repo adds interactions to it. Delivery depends on out-of-band dashboard configuration.**

`src/api/interactionService.ts:190`

```ts
          filter: `to_user_id=eq.${userId}`,
```

**10. The 30-minute cooldown is purely cosmetic client state in localStorage, keyed per action. Clearing site data, using a different browser, or a direct insert bypasses it entirely — there is no server-side rate limit on the interactions table.**

`src/components/PokeKissInterface/PokeKissInterface.tsx:44`

```ts
  const lastTime = localStorage.getItem(RATE_LIMIT_KEYS[type]);
```

**11. The notification badge is a clickable div nested inside the FAB's <motion.button>, so it must stopPropagation to avoid also toggling the menu. It is also hidden whenever the menu is expanded (`unviewedCount > 0 && !isExpanded`), meaning the only way to view a pending interaction is to collapse the menu first.**

`src/components/PokeKissInterface/PokeKissInterface.tsx:410`

```ts
                e.stopPropagation();
```

**12. Sends resolve the recipient with a fresh async getPartnerId() network call on every button press rather than reading partnerSlice.partner from the store — so a poke can fail with 'Partner not configured' even while the partner's name is rendered on screen.**

`src/components/PokeKissInterface/PokeKissInterface.tsx:159`

```ts
    const partnerId = await getPartnerId();
```

**13. The history modal calls loadInteractionHistory(100) which replaces the whole interactions array, then filters to 7 days in render. Interactions older than 7 days are fetched and held in memory but never displayed; the footer count reflects the filtered list, not the fetched one.**

`src/components/InteractionHistory/InteractionHistory.tsx:55`

```ts
  const interactions = getInteractionHistory(7);
```

**14. validateInteraction's UUID regex only accepts versions 1-5 with RFC-4122 variant bits. A UUIDv7 or a non-conforming test fixture id is rejected client-side with 'Invalid partner ID format' before any request is made, despite the comment above it claiming the pattern is permissive.**

`src/utils/interactionValidation.ts:21`

```ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

---

## Partner Mood Viewing

Once a partner is linked, the partner tab shows their recent moods as cards (icon, labels, relative date, note) with a manual Refresh button and a live Wifi/connected indicator. New moods arrive over a Supabase Broadcast channel and pop a toast, then trigger a re-fetch of the list. A separate usePartnerMood hook powers the single latest-mood widget embedded in the Mood tab.

**Start here:** `src/components/PartnerMoodView/PartnerMoodView.tsx:141`

```ts
  useEffect(() => {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/PartnerMoodView/PartnerMoodView.tsx` | 674 | Mood list, MoodCard, refresh button, realtime toast and connection-status pill |
| `src/hooks/usePartnerMood.ts` | 127 | Hook returning {partnerMood, isLoading, connectionStatus, error} — loads latest partner mood and subscribes to broadcasts |
| `src/api/moodSyncService.ts` | 451 | getLatestPartnerMood and subscribeMoodUpdates — the Broadcast channel implementation both consumers share |
| `src/components/MoodTracker/PartnerMoodDisplay.tsx` | 171 | The other consumer of usePartnerMood, rendered inside the Mood tab |
| `src/config/constants.ts` | 39 | Exports PARTNER_NAME, used verbatim in the realtime mood toast |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/moodSlice.ts` | `partnerMoods`, `fetchPartnerMoods`, `syncStatus` | partial — moods is persisted via partialize (src/stores/useAppStore.ts:132); partnerMoods and syncStatus are not |
| `src/stores/slices/partnerSlice.ts` | `partner`, `isLoadingPartner` | no |

### Backend

| | |
|---|---|
| Supabase tables | `moods`, `users` |
| Realtime | Supabase Broadcast on channel `mood-updates:<userId>` with event 'new_mood' — explicitly NOT postgres_changes |

### Tests

- `src/hooks/__tests__/usePartnerMood.test.ts` — unit
- `tests/e2e/partner/partner-mood.spec.ts` — e2e

### Watch out for

**1. Mood realtime uses Broadcast rather than postgres_changes on purpose: the moods SELECT policy uses a partner-lookup subquery that Realtime cannot evaluate. Sender-side code must explicitly broadcast to the partner's channel — writing a mood row alone will NOT notify anyone.**

`src/api/moodSyncService.ts:318`

```ts
   * NOTE: This uses Broadcast API instead of postgres_changes because
```

**2. Because the channel is per-recipient rather than per-sender, usePartnerMood has to discard non-partner broadcasts in JS. Anyone who can write to your mood-updates channel can push a mood the UI will render, as long as they set user_id to your partner's id.**

`src/hooks/usePartnerMood.ts:84`

```ts
            if (newMood.user_id === partnerId) {
```

**3. PartnerMoodView's realtime subscription effect does not depend on `partner`, so it opens a mood-updates channel even for users with no partner connected — and it does not re-subscribe when a partner is added, only when online status or fetchPartnerMoods changes identity.**

`src/components/PartnerMoodView/PartnerMoodView.tsx:218`

```ts
  }, [syncStatus.isOnline, fetchPartnerMoods]); // Re-subscribe if online status changes
```

**4. The realtime toast announces the mood using the hardcoded PARTNER_NAME config constant, not partner.displayName — so the toast and the page heading two lines away can show different names for the same person.**

`src/components/PartnerMoodView/PartnerMoodView.tsx:321`

```ts
                  {PARTNER_NAME} just logged a mood: {notification.mood}
```

**5. The toast handler guards the MOOD_CONFIG lookup with ?., but MoodCard does not — an unrecognised mood string (e.g. a new mood type shipped by the partner's newer client) throws on primaryConfig.icon and takes the card list down.**

`src/components/PartnerMoodView/PartnerMoodView.tsx:633`

```ts
  const primaryConfig = MOOD_CONFIG[allMoods[0]];
```

**6. Each realtime mood triggers a full fetchPartnerMoods(30) re-fetch on top of the pushed payload, so a partner logging several moods in a row causes a burst of redundant network round-trips.**

`src/components/PartnerMoodView/PartnerMoodView.tsx:182`

```ts
          fetchPartnerMoods(30).catch((err) => {
```

**7. usePartnerMood resets state directly inside the effect body when partnerId goes falsy, with an explicit eslint suppression — this is the documented exception to the repo's set-state-in-effect rule, not an oversight to 'fix'.**

`src/hooks/usePartnerMood.ts:49`

```ts
      // eslint-disable-next-line react-hooks/set-state-in-effect -- state reset when partnerId clears
```

**8. The two effects above the subscription encode a fixed ordering that a previous version got wrong: handleRefresh is declared before the effect that calls it, and syncStatus.isOnline is in the deps so reconnecting with the same partner re-fetches. The inline comments are the change rationale — don't 'simplify' either back.**

`src/components/PartnerMoodView/PartnerMoodView.tsx:111`

```ts
  const handleRefresh = useCallback(async () => {
```

---

# Love Notes tab

_Realtime one-on-one chat with image attachments._

## Love Notes Chat

A one-on-one chat between the user and their linked partner. The user types a note (max 1000 chars, Enter to send, Shift+Enter for newline, Escape to clear), it appears instantly as an optimistic bubble, then is inserted into the `love_notes` table and pushed to the partner via a Supabase Broadcast channel. The list is virtualized with react-window and pages backwards 50 messages at a time as the user scrolls up, showing a "beginning of your love story" marker once all history is loaded. Failed sends stay in the list with a "Tap to retry" affordance; a client-side rate limit caps sending at 10 messages per minute. There are no read receipts anywhere in the schema or client.

**Start here:** `src/components/love-notes/LoveNotes.tsx:35`

```ts
export function LoveNotes(): ReactElement {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/love-notes/LoveNotes.tsx` | 126 | Page container: header, error banner, wires MessageList + MessageInput; fetches own and partner display names |
| `src/components/love-notes/MessageList.tsx` | 409 | react-window v2 virtualized list with variable row heights, infinite-loader pagination, auto-scroll-to-bottom and "New message" indicator |
| `src/components/love-notes/MessageInput.tsx` | 286 | Textarea + send button + image picker; character counter, keyboard shortcuts, haptics, validation/sanitization before calling sendNote |
| `src/components/love-notes/LoveNoteMessage.tsx` | 319 | Single chat bubble: own/partner styling, timestamps, DOMPurify sanitization, sending/error states, retry button, image rendering |
| `src/components/love-notes/index.ts` | 11 | Barrel export (LoveNoteMessage, LoveNotes, MessageList — note MessageInput is not re-exported) |
| `src/stores/slices/notesSlice.ts` | 608 | All chat state and actions: fetchNotes, fetchOlderNotes, addNote (dedup), sendNote (optimistic + broadcast), retryFailedMessage, rate limiting, blob-URL cleanup |
| `src/hooks/useLoveNotes.ts` | 155 | Component-facing hook: selects notes state, memoizes actions, auto-fetches on mount, mounts the realtime subscription, revokes preview URLs on unmount |
| `src/hooks/useRealtimeMessages.ts` | 147 | Supabase Broadcast subscription on `love-notes:{userId}`; exponential-backoff resubscribe, vibration on receipt |
| `src/utils/messageValidation.ts` | 70 | validateMessageContent (non-empty, <=1000) and sanitizeMessageContent (DOMPurify strips all tags) |
| `src/config/images.ts` | 72 | NOTES_CONFIG: PAGE_SIZE 50, RATE_LIMIT_MAX_MESSAGES 10, RATE_LIMIT_WINDOW_MS 60000 |
| `src/types/models.ts` | 44 | LoveNote interface — server columns plus client-only optimistic fields (sending, error, tempId, imageUploading, imageBlob, imagePreviewUrl) |
| `src/App.tsx` | — | Lazy-loads and renders LoveNotes when currentView === 'notes' |
| `src/stores/slices/navigationSlice.ts` | — | Declares the 'notes' ViewType and maps it to the /notes route |
| `supabase/migrations/20251203000001_create_base_schema.sql` | — | Creates the love_notes table (id, from_user_id, to_user_id, content, created_at), its index and RLS policies |
| `supabase/migrations/20251206024345_remote_schema.sql` | — | Rewrites love_notes constraints, indexes and RLS policies to match the deployed remote schema |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/notesSlice.ts` | `notes`, `notesIsLoading`, `notesError`, `notesHasMore`, `sentMessageTimestamps` | no — useAppStore's persist partialize only stores settings, isOnboarded, messageHistory and moods; none of the notes keys appear in it |

### Backend

| | |
|---|---|
| Supabase tables | `love_notes` |
| Realtime | Broadcast only (no postgres_changes). Receiver subscribes to channel `love-notes:{userId}` for event `new_message`; the sender publishes to `love-notes:{partnerId}` after a successful insert. |

### Tests

- `src/components/love-notes/__tests__/MessageInput.test.tsx` — unit
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` — unit
- `src/hooks/__tests__/useRealtimeMessages.test.ts` — unit
- `tests/unit/utils/messageValidation.test.ts` — unit
- `tests/e2e/notes/love-notes.spec.ts` — e2e

### Watch out for

**1. `useLoveNotes()` is called by BOTH LoveNotes.tsx and its child MessageInput.tsx, and the hook defaults to autoFetch=true. Opening the notes tab therefore fires fetchNotes() twice and opens two separate realtime channels on the same `love-notes:{userId}` topic. Duplicate inbound messages are absorbed by addNote's id dedup, but the double fetch and double subscribe are real. Any new component that calls useLoveNotes() adds another pair.**

`src/components/love-notes/MessageInput.tsx:48`

```ts
  const { sendNote } = useLoveNotes();
```

**2. Same hook call in the parent — LoveNotes.tsx also calls useLoveNotes() with the default autoFetch, which is the other half of the double-mount above.**

`src/components/love-notes/LoveNotes.tsx:37`

```ts
    useLoveNotes();
```

**3. Image-only messages send an empty string as content, but the live DB CHECK constraint requires char_length(content) >= 1. An attachment sent with no caption is rejected by Postgres and surfaces as a generic "Failed to send" bubble.**

`src/components/love-notes/MessageInput.tsx:131`

```ts
      const sanitizedContent = hasContent ? sanitizeMessageContent(content) : '';
```

**4. The constraint that rejects the empty-caption insert above. The original base-schema constraint only capped length at 1000; this migration re-added it with a >= 1 floor and no later migration relaxes it.**

`supabase/migrations/20251206024345_remote_schema.sql:113`

```ts
alter table "public"."love_notes" add constraint "love_notes_content_check" CHECK (((char_length(content) <= 1000) AND (char_length(content) >= 1))) not valid;
```

**5. sendNote swallows the insert error and returns instead of throwing — only errors whose message contains 'Rate limit' propagate to the caller. MessageInput's try/catch therefore almost never fires, so on a failed send the textarea is still cleared and the selected image is dropped; the only signal is the red retry bubble in the list.**

`src/stores/slices/notesSlice.ts:448`

```ts
      if (errorMessage.includes('Rate limit')) {
```

**6. Realtime delivery is entirely sender-driven fan-out: the sender opens the partner's channel, broadcasts, then removes the channel. There is no server-side trigger and no postgres_changes listener, so if the broadcast fails the recipient sees nothing until they remount the view and refetch.**

`src/stores/slices/notesSlice.ts:413`

```ts
        const channel = supabase.channel(`love-notes:${partnerId}`);
```

**7. Broadcast failure is caught and only warned — the row is already committed, so the DB and the partner's UI silently diverge.**

`src/stores/slices/notesSlice.ts:441`

```ts
        console.warn('[NotesSlice] Broadcast failed (non-fatal):', broadcastError);
```

**8. Receiver channel topic is keyed on the receiving user's id, which must match the `love-notes:{partnerId}` topic the sender publishes to. If partner linkage is stale on either side (getPartnerId returns a different id than the recipient's auth uid), messages are broadcast into a topic nobody listens on and are lost silently.**

`src/hooks/useRealtimeMessages.ts:68`

```ts
      .channel(`love-notes:${userId}`)
```

**9. The backoff retry re-subscribes the same channel object with no status callback, unlike the initial subscribe at line 75 which passes one. The retryCountRef reset and the next backoff schedule both live inside that original callback.**

`src/hooks/useRealtimeMessages.ts:116`

```ts
              channelRef.current.subscribe();
```

**10. fetchNotes revokes every blob: preview URL in the current notes array BEFORE it starts fetching. An optimistic image message that is still uploading when a refetch fires loses its preview URL and renders a broken image, and fetchNotes then replaces the whole array, dropping in-flight and failed messages entirely.**

`src/stores/slices/notesSlice.ts:84`

```ts
      revokePreviewUrlsFromNotes(existingNotes);
```

**11. hasMore is inferred from a full page — if the conversation happens to contain exactly 50 (or a multiple of 50) messages, hasMore stays true, the "beginning of conversation" marker never appears, and the infinite loader keeps issuing one empty query.**

`src/stores/slices/notesSlice.ts:122`

```ts
        notesHasMore: (data?.length || 0) === limit,
```

**12. During a pagination fetch, row 0 renders a loading spinner INSTEAD of notes[0] — the oldest loaded message disappears from view while older ones load. getRowHeight has no matching branch, so the spinner is laid out using the hidden message's computed height.**

`src/components/love-notes/MessageList.tsx:77`

```ts
  if (index === 0 && isLoading && notes.length > 0) {
```

**13. Row heights are guessed from content length in three fixed buckets, so any message over 200 characters gets exactly 100px of text space regardless of actual wrap. Long notes are visually clipped by the virtualized row.**

`src/components/love-notes/MessageList.tsx:177`

```ts
      textHeight = 100; // Long text
```

**14. The infinite loader is configured with a rowCount one larger than the <List rowCount={totalRowCount}> it drives whenever hasMore is true. The extra phantom row is what triggers loadMoreRows near the top edge.**

`src/components/love-notes/MessageList.tsx:239`

```ts
    rowCount: totalRowCount + (hasMore ? 1 : 0),
```

**15. The initial scroll-to-bottom is deliberately deferred into requestAnimationFrame — the comment above it records that calling scrollToRow synchronously leaves the chat pinned to the top when re-entering the tab, because react-window has not measured rows yet. Do not 'simplify' this back into a direct call.**

`src/components/love-notes/MessageList.tsx:287`

```ts
          listRef.current.scrollToRow({ align: 'end', index: totalRowCount - 1 });
```

**16. The retry button passes `message.tempId || message.id`, but retryFailedMessage only matches notes by tempId. A server-persisted note that somehow carries error=true (no tempId) would pass its uuid and hit the 'Message not found' throw.**

`src/components/love-notes/LoveNoteMessage.tsx:297`

```ts
            onClick={() => onRetry?.(message.tempId || message.id)}
```

**17. addNote dedups only by server id. Optimistic notes are keyed by tempId, so an inbound broadcast of a message the local user sent would be added as a second bubble — this is avoided only because the sender broadcasts to the partner's topic, never their own.**

`src/stores/slices/notesSlice.ts:211`

```ts
  addNote: (note) => {
```

**18. The rate-limit clock lives in in-memory Zustand state that is not persisted, so a page reload resets the 10-per-minute client cap. Timestamps are also recorded at optimistic-add time, meaning sends that later fail still consume budget.**

`src/hooks/useLoveNotes.ts:141`

```ts
  useRealtimeMessages({ enabled: autoFetch });
```

---

## Love Note Image Attachments

Users can attach a JPEG/PNG/WebP image to a love note. The file is validated and previewed inline before sending, compressed client-side with the Canvas API (max 2048px, JPEG q0.8, EXIF stripped), uploaded through a Supabase Edge Function that re-validates it by magic bytes and rate-limits, and stored in the private `love-notes-images` bucket under `{user_id}/{timestamp}-{uuid}.jpg`. Received images are fetched as 1-hour signed URLs through a module-level LRU cache with request de-duplication, render inline in the bubble, and open in a full-screen modal viewer on tap. Failed sends cache the compressed blob so retry skips re-compression.

**Start here:** `src/services/loveNoteImageService.ts:184`

```ts
export async function uploadCompressedBlob(blob: Blob, _userId: string): Promise<UploadResult> {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/services/loveNoteImageService.ts` | 309 | Edge-Function upload calls, signed-URL generation with expiry/LRU cache and in-flight dedup, delete helper |
| `src/services/imageCompressionService.ts` | 203 | Canvas-based resize/JPEG compression, file validation (MIME + 25MB cap), compressed-size estimate |
| `src/components/love-notes/ImagePreview.tsx` | 133 | Pre-send thumbnail with original→estimated size, remove button, compressing overlay |
| `src/components/love-notes/FullScreenImageViewer.tsx` | 128 | Modal overlay: dark backdrop, Escape/X/backdrop close, focus management, body-scroll lock |
| `src/components/love-notes/LoveNoteMessage.tsx` | 319 | Resolves preview vs signed URL, loading/error placeholders, onError force-refresh retry, opens the full-screen viewer |
| `src/components/love-notes/MessageInput.tsx` | 286 | Hidden file input + attach button, client validation, holds the selected File until send |
| `src/stores/slices/notesSlice.ts` | 608 | sendNote/retryFailedMessage orchestrate compress → upload → insert image_url, and manage imageBlob/imagePreviewUrl lifecycle |
| `src/config/images.ts` | 72 | IMAGE_COMPRESSION, IMAGE_VALIDATION and IMAGE_STORAGE constants (bucket name, 3600s signed URL, 5-min refresh buffer, 100-entry cache) |
| `supabase/functions/upload-love-note-image/index.ts` | 270 | Edge Function: JWT auth, 5MB cap, magic-byte MIME sniffing, in-memory per-user rate limit, uploads to the bucket and returns the storage path |
| `supabase/migrations/20251205000001_add_love_notes_images.sql` | — | Adds love_notes.image_url, creates the private love-notes-images bucket and the four storage RLS policies (own read/write/delete + partner read) |
| `supabase/migrations/20251205000002_add_mime_validation.sql` | — | Replaces the upload policy with one that also checks the file extension is jpg/jpeg/png/webp |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/notesSlice.ts` | `notes` | no — image state lives on LoveNote entries as client-only fields (imageUploading, imageBlob, imagePreviewUrl) and is never written to localStorage |

### Backend

| | |
|---|---|
| Supabase tables | `love_notes` |
| Storage buckets | `love-notes-images` |
| Realtime | none directly — the image path rides the same `new_message` broadcast as the parent chat feature, carrying only the storage path in image_url |

### Tests

- `src/services/__tests__/loveNoteImageService.test.ts` — unit
- `src/components/love-notes/__tests__/ImagePreview.test.tsx` — unit
- `src/components/love-notes/__tests__/FullScreenImageViewer.test.tsx` — unit
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` — unit
- `src/components/love-notes/__tests__/MessageInput.test.tsx` — unit

### Watch out for

**1. When Canvas compression throws, the service silently falls back to returning the ORIGINAL File as the blob. Client validation allows up to 25MB, but the Edge Function hard-rejects anything over 5MB with a 413 — so a compression failure on a large photo turns into an opaque upload failure rather than a degraded-but-working upload.**

`src/services/imageCompressionService.ts:117`

```ts
        blob: file,
```

**2. The Edge Function's 5MB ceiling that the compression fallback above collides with. Note the mismatch is one-directional: the client's own cap is 25MB raw.**

`supabase/functions/upload-love-note-image/index.ts:19`

```ts
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB (compressed images)
```

**3. Server-side upload rate limiting is a per-isolate in-memory Map, so it resets on every cold start and is not shared across concurrently running instances. It is a speed bump, not an enforceable quota.**

`supabase/functions/upload-love-note-image/index.ts:28`

```ts
const rateLimitStore = new Map<string, number[]>();
```

**4. If the image upload succeeds but the subsequent love_notes insert fails, sendNote discards the returned storagePath and keeps only imageBlob. retryFailedMessage then uploads the blob a second time, leaving the first object orphaned in the bucket with nothing referencing it (deleteLoveNoteImage is never called from app code).**

`src/stores/slices/notesSlice.ts:349`

```ts
          const uploadResult = await uploadCompressedBlob(imageBlob, userId);
```

**5. The signed-URL cache is a module-level Map with no exported reset. It survives sign-out and user switching for the lifetime of the JS context, and entries can outlive the session that minted them.**

`src/services/loveNoteImageService.ts:39`

```ts
const signedUrlCache = new Map<string, CachedUrl>();
```

**6. cleanCache() is only invoked when the cache is already over MAX_CACHE_SIZE. Below 100 entries, expired URLs are never evicted — they are merely skipped by isCacheValid, so stale entries accumulate until the size threshold is crossed.**

`src/services/loveNoteImageService.ts:277`

```ts
      if (signedUrlCache.size > MAX_CACHE_SIZE) {
```

**7. FullScreenImageViewer's effect cleanup unconditionally resets document.body.style.overflow and refocuses previousFocusRef, regardless of whether the modal was open. Because LoveNoteMessage renders one viewer per bubble and MessageList virtualizes rows, scrolling can unmount an offscreen bubble whose viewer cleanup then clears the body-scroll lock (and steals focus) while another viewer is still open.**

`src/components/love-notes/FullScreenImageViewer.tsx:62`

```ts
      document.body.style.overflow = '';
```

**8. Inline images use loading="lazy" inside a react-window virtualized container. Rows are unmounted/remounted as the user scrolls, so each remount re-triggers the signed-URL effect; correctness relies on the module-level cache and pendingRequests dedup rather than on component-level memoization.**

`src/components/love-notes/LoveNoteMessage.tsx:264`

```ts
                    loading="lazy"
```

**9. uploadLoveNoteImage (and deleteLoveNoteImage) are exported and fully tested but have no production callers — notesSlice imports only uploadCompressedBlob. The compress-then-upload path that actually runs is spread across notesSlice, not this function; changing uploadLoveNoteImage changes nothing users see.**

`src/services/loveNoteImageService.ts:120`

```ts
export async function uploadLoveNoteImage(file: File, _userId: string): Promise<UploadResult> {
```

**10. The file picker offers only JPEG/PNG/WebP and client validation rejects GIF, but the Edge Function's allow-list includes image/gif and the client's own 415 error text tells the user "JPEG, PNG, WebP, or GIF" — an unreachable suggestion given the picker's accept attribute.**

`src/components/love-notes/MessageInput.tsx:34`

```ts
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
```

**11. The storage path is generated server-side from the JWT's user id, not from the userId argument the client passes (both upload helpers name it `_userId` and ignore it). The storage RLS policies key on that first path segment, so the client cannot choose the folder — passing a different userId has no effect.**

`src/services/loveNoteImageService.ts:184`

```ts
export async function uploadCompressedBlob(blob: Blob, _userId: string): Promise<UploadResult> {
```

---

# Photos tab

_Shared photo gallery: upload, browse, edit captions/tags, delete._

## Photo Gallery Grid & Full-Screen Viewer

The 'photos' nav tab shows a responsive 3-column (4 on md+) grid of the couple's photos, newest first, mixing the user's own photos and their partner's (each tagged with a "You"/"Partner" badge). Photos load 20 at a time via an IntersectionObserver infinite scroll, with a skeleton shimmer grid on first load, an empty state with an upload CTA, and an error state with a Try Again button. Tapping a thumbnail opens PhotoViewer: a black full-screen modal with prev/next buttons, arrow-key and swipe navigation, double-tap 1x/2x zoom with pan, swipe-down-to-close, neighbour preloading, a caption/date/ownership footer, and a Delete button shown only on your own photos. Images are private in Supabase Storage and rendered through per-request signed URLs.

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/PhotoGallery/PhotoGallery.tsx` | 323 | Grid container: paginated fetch, infinite-scroll observer, empty/error/skeleton states, upload FAB, owns the selected-photo state that opens PhotoViewer |
| `src/components/PhotoGallery/PhotoGridItem.tsx` | 120 | One square thumbnail: per-item IntersectionObserver lazy load, blur placeholder, owner badge, hover caption overlay, keyboard-activatable |
| `src/components/PhotoGallery/PhotoGridSkeleton.tsx` | 45 | Shimmering 9-cell skeleton grid rendered while the first page is in flight |
| `src/components/PhotoGallery/PhotoViewer.tsx` | 536 | Full-screen viewer: framer-motion drag/zoom/pan, keyboard nav, focus trap, preloading, live-region announcements, inline delete confirmation |
| `src/services/photoService.ts` | 524 | All Supabase access for photos: signed-URL minting, paginated list, upload, delete, single-photo fetch, caption update, quota calculation |
| `src/stores/slices/photosSlice.ts` | 225 | Zustand slice holding photos/selection/upload state and the load/delete/update actions |
| `src/hooks/usePhotos.ts` | 146 | Hook wrapper over the slice with auto-load-on-mount; used only by the unused PhotoUploader |
| `supabase/migrations/20251203190800_create_photos_table.sql` | 162 | Creates the photos table, its indexes, table RLS (select own / select partner / insert own / delete own), the private 'photos' bucket, and storage RLS |
| `src/App.tsx` | 610 | Lazy-loads and mounts PhotoGallery for currentView === 'photos', plus PhotoUpload and PhotoCarousel as siblings |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/photosSlice.ts` | `photos`, `selectedPhotoId`, `isUploading`, `uploadProgress`, `error`, `storageWarning` | no — partialize in src/stores/useAppStore.ts persists only settings, isOnboarded, messageHistory and moods |

### Backend

| | |
|---|---|
| Supabase tables | `photos` |
| Storage buckets | `photos` |
| IndexedDB stores | `photos` |
| Realtime | none — no channel()/subscribe in photoService, photosSlice or any photo component; partner photos only appear on a refetch |

### Tests

- `tests/e2e/photos/photo-gallery.spec.ts` — e2e

### Watch out for

**1. The grid renders from a component-local `photos` array, not from the store. The only sync back from the store is this one-directional length comparison, so it refetches when the store GROWS (upload) but never when it shrinks. Deleting from PhotoViewer removes the photo from `state.photos` in the slice yet leaves the local array untouched, so the deleted thumbnail stays on screen until remount.**

`src/components/PhotoGallery/PhotoGallery.tsx:106`

```ts
    if (storePhotos.length > photos.length) {
```

**2. Mounting the gallery fires two independent list queries: photoService.getPhotos(20, 0) on line 67 for the grid, then the slice's loadPhotos() which calls getPhotos() with its default limit of 50. That is 2 REST round-trips plus up to 70 individual createSignedUrl calls (getSignedUrls fans out one request per path) before anything is interactive.**

`src/components/PhotoGallery/PhotoGallery.tsx:79`

```ts
        await loadPhotos();
```

**3. Signed URLs are minted once at fetch time with a 1-hour life and there is no refresh path anywhere in photoService or photosSlice — the URL-refresh machinery in src/config/images.ts (URL_REFRESH_BUFFER_MS) belongs to the separate love-notes-images bucket. On a session left open past an hour, thumbnails and the viewer silently fail to load until the list is refetched.**

`src/services/photoService.ts:76`

```ts
const SIGNED_URL_EXPIRY = 3600;
```

**4. The surrounding try/catch (and its RLS-error branch) is unreachable: photosSlice.deletePhoto catches every failure internally and only calls set({ error: errorMsg }), so it never rejects. The viewer already advanced the index optimistically on line 302, and a failed delete produces no visible feedback here.**

`src/components/PhotoGallery/PhotoViewer.tsx:308`

```ts
      await deletePhoto(photoToDelete.id);
```

**5. Delete order is storage-first, DB-second, and a storage failure is logged then ignored. If the object delete fails but the row delete succeeds, the file is orphaned in the bucket forever — nothing tracks it, and it still counts against the real Supabase storage bill even though checkStorageQuota (which sums file_size from the photos table) will no longer see it.**

`src/services/photoService.ts:417`

```ts
        // Continue to delete metadata even if storage delete fails
```

**6. "Quota" is a client-side fiction: it is a hardcoded 1GB compared against SUM(file_size) of the current user's rows in the photos table only. Partner photos and love-note image attachments are not counted, and the number has no connection to the project's actual storage usage.**

`src/services/photoService.ts:79`

```ts
const STORAGE_QUOTA = 1024 * 1024 * 1024; // 1GB free tier
```

**7. The IndexedDB `photos` object store (declared at dbSchema.ts:121, recreated destructively on the v1→v2 upgrade) is vestigial for this feature — nothing in photoService, photosSlice or any PhotoGallery component reads or writes it. The IndexedDB `Photo` type (src/types/index.ts:33, with imageBlob and tags[]) is a different shape from SupabasePhoto and only survives because PhotoEditModal/PhotoDeleteConfirmation still accept both.**

`src/services/dbSchema.ts:225`

```ts
  // Left destructive deliberately. Photos are Supabase-first — IndexedDB is a
```

**8. canNavigateNext/canNavigatePrev are computed from the `photos` prop, which is PhotoGallery's local array that delete never mutates. So after deleting, photos.length is unchanged, the index math lands back on the just-deleted photo, and its now-dead signed URL triggers the "Failed to load photo" error state.**

`src/components/PhotoGallery/PhotoViewer.tsx:302`

```ts
        const nextIndex = canNavigateNext ? currentIndex : currentIndex - 1;
```

---

## Photo Upload

A modal opened from the gallery FAB or the empty-state button walks the user through select → preview → uploading → success. It accepts JPEG/PNG/WebP, shows a blob-URL preview with the original size and an estimated compressed size, offers an optional 500-character caption and a comma-separated tags field, then writes the file to the private `photos` Supabase Storage bucket under `{user_id}/{uuid}.{ext}` and inserts a metadata row. A storage-quota banner appears above 80% and uploads are refused above 95%. On success the modal shows a checkmark and auto-closes after 3 seconds.

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/PhotoUpload/PhotoUpload.tsx` | 456 | THE live upload modal: file picker, validation, preview, caption/tags form, step machine, quota banner |
| `src/components/photos/PhotoUploader.tsx` | 482 | A second, fuller uploader (compression, progress bar, retry toasts) that is not imported anywhere — dead code |
| `src/services/imageCompressionService.ts` | 203 | Canvas-based resize to 2048px / JPEG q0.8 with EXIF stripping, plus validateImageFile and estimateCompressedSize — reached only via love-notes and the dead PhotoUploader |
| `src/config/images.ts` | 72 | IMAGE_COMPRESSION / IMAGE_VALIDATION constants consumed by imageCompressionService; IMAGE_STORAGE in the same file targets the love-notes-images bucket, not photos |
| `src/services/photoService.ts` | 524 | uploadPhoto: quota pre-check, storage put with upsert:false, metadata insert, and storage rollback if the insert fails |
| `src/stores/slices/photosSlice.ts` | 225 | uploadPhoto action: sets isUploading/uploadProgress, second quota pre-check, optimistic prepend of the new photo, post-upload quota warning |
| `src/hooks/usePhotos.ts` | 146 | Exposes upload state/actions; only consumer is the unused PhotoUploader |
| `supabase/migrations/20251203190800_create_photos_table.sql` | 162 | Defines the insert RLS policy, the folder-prefix storage policy, and the bucket's 10MB file_size_limit |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/photosSlice.ts` | `isUploading`, `uploadProgress`, `error`, `storageWarning`, `photos` | no — transient runtime state, excluded from the persist partialize |

### Backend

| | |
|---|---|
| Supabase tables | `photos` |
| Storage buckets | `photos` |
| Realtime | none |

### Tests

- `tests/e2e/photos/photo-upload.spec.ts` — e2e

### Watch out for

**1. The shipped upload path never compresses. PhotoUpload builds its input straight from the raw File and only reads naturalWidth/naturalHeight for metadata; imageCompressionService is imported by notesSlice, MessageInput, ImagePreview, loveNoteImageService and the dead PhotoUploader — never by PhotoUpload. The preview's "Will compress to ~X KB" label (line 271) is therefore a lie for every gallery upload.**

`src/components/PhotoUpload/PhotoUpload.tsx:77`

```ts
        file: selectedFile,
```

**2. Three different size ceilings disagree. The live modal allows 50MB, imageCompressionService.validateImageFile rejects above 25MB (IMAGE_VALIDATION.MAX_FILE_SIZE_BYTES), and the bucket itself caps at 10MB. Since nothing compresses, any file between 10MB and 50MB passes client validation and is rejected by Storage.**

`src/components/PhotoUpload/PhotoUpload.tsx:44`

```ts
    const maxSize = 50 * 1024 * 1024; // 50MB
```

**3. The hard server-side limit for the photos bucket is 10MB, set inside a DO block whose header comment warns the SQL bucket insert "may not work in all Supabase environments" — meaning on a project where the bucket was created by hand, this limit may not exist at all and the environments diverge.**

`supabase/migrations/20251203190800_create_photos_table.sql:86`

```ts
  VALUES ('photos', 'photos', false, 10485760)  -- 10MB limit
```

**4. uploadPhoto swallows every failure — quota exceeded (line 298), a 10MB storage rejection, an RLS denial — and returns null. photosSlice then throws its own generic message, so the user's toast never contains the actual cause.**

`src/services/photoService.ts:373`

```ts
      return null;
```

**5. This is the string every upload failure collapses into, because photoService.uploadPhoto returns null rather than rethrowing. The slice's own quota pre-check on line 69 is the only path that produces a specific message, and it duplicates the identical check already inside the service.**

`src/stores/slices/photosSlice.ts:89`

```ts
        throw new Error('Upload failed - no photo returned');
```

**6. The tags field is fully wired for entry, parsing, chip rendering and validation (max 10, 50 chars each) and gates the submit button via isFormValid — but the upload payload built at line 76 has no tags field, and the photos table has no tags column. Everything the user types here is silently discarded on submit.**

`src/components/PhotoUpload/PhotoUpload.tsx:22`

```ts
  const [tags, setTags] = useState('');
```

**7. 482 lines of the better uploader — real compression, a 0-100% progress bar bound to uploadProgress, storage-warning auto-dismiss, retry toasts, `capture="environment"` for the mobile camera, object-URL cleanup — and it is imported by nothing. It is also the only reason usePhotos and the slice's uploadProgress plumbing exist; the shipped PhotoUpload uses none of them.**

`src/components/photos/PhotoUploader.tsx:45`

```ts
export function PhotoUploader({
```

**8. When Canvas compression throws, the fallback returns the original file with width and height of 0. The photos table declares width/height as INTEGER NOT NULL with no positivity check, so a fallback upload persists a row claiming 0x0 dimensions.**

`src/services/imageCompressionService.ts:118`

```ts
        width: 0, // Unknown dimensions
```

**9. The stored filename extension and the object's contentType both come from the caller-supplied mimeType, which PhotoUpload copies verbatim from File.type — a browser guess derived from the OS extension. Nothing sniffs the actual bytes, so a mislabelled file is stored under a mismatched extension and content type.**

`src/services/photoService.ts:305`

```ts
      const fileExt = input.mimeType.split('/')[1]; // jpeg, png, webp
```

**10. `error` is not namespaced. appSlice.ts:21 initialises the same top-level `error` key for global app errors and exposes setError, so photo upload errors and app-init errors overwrite each other in the one flat store, and clearError() from the photos hook wipes the global one too.**

`src/hooks/usePhotos.ts:86`

```ts
  const error = useAppStore((state) => state.error);
```

---

## Photo Carousel with Caption/Tag Edit and Delete Confirmation

A second, older lightbox: a spring-animated carousel with a top control bar (counter, Edit, Delete, Close), 50px swipe thresholds, arrow-key/Escape handling, an Edit modal for caption plus comma-separated tags with client and server-side validation, and a separate red Delete confirmation dialog. It is mounted globally in App but is not reachable through the UI, because it renders off the store's selectedPhotoId which nothing outside the carousel ever sets — the gallery opens PhotoViewer from local component state instead.

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/PhotoCarousel/PhotoCarousel.tsx` | 225 | Lightbox driven by store selectedPhotoId; wires swipe/keyboard nav and hosts the edit and delete modals |
| `src/components/PhotoCarousel/PhotoCarouselControls.tsx` | 79 | Fixed top bar with photo counter and Edit/Delete/Close buttons |
| `src/components/PhotoEditModal/PhotoEditModal.tsx` | 324 | z-60 modal: caption textarea with counter, tags input, dedupe/truncate on save, field-level server error mapping via isValidationError |
| `src/components/PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx` | 133 | z-70 confirm dialog with deleting spinner and inline failure message |
| `src/stores/slices/photosSlice.ts` | 225 | Owns selectedPhotoId, selectPhoto, clearPhotoSelection and updatePhoto (caption-only merge) |
| `src/services/photoService.ts` | 524 | updatePhoto strips everything except caption before issuing the UPDATE |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/photosSlice.ts` | `selectedPhotoId`, `photos`, `error` | no |

### Backend

| | |
|---|---|
| Supabase tables | `photos` |
| Storage buckets | `photos` |
| Realtime | none |

### Tests

_None found for this feature._

### Watch out for

**1. Mounted on every render but permanently invisible: it returns null unless the store's selectedPhotoId is non-null, and the only callers of selectPhoto in the entire src tree are PhotoCarousel's own next/prev handlers (lines 50 and 58). The gallery instead uses its own useState selectedPhotoId and renders PhotoViewer. Consequence: the Edit-caption flow and the styled delete confirmation have no entry point in the shipped app.**

`src/App.tsx:604`

```ts
        <PhotoCarousel />
```

**2. There is no UPDATE policy on the photos table anywhere in supabase/migrations — the migration defines only SELECT (own), SELECT (partner), INSERT and DELETE (`grep -rn "ON photos FOR" supabase/migrations/` returns 4 hits, none of them UPDATE; `grep -c "FOR UPDATE"` returns 0). With RLS enabled this UPDATE matches zero rows rather than erroring, so photoService.updatePhoto returns true and the slice's `if (!persisted)` guard cannot detect the silent no-op.**

`src/services/photoService.ts:504`

```ts
        .update(allowedUpdates)
```

**3. PhotoEditModal always sends { caption, tags } and does the full dedupe/10-tag/50-char work on the tags, but photoService.updatePhoto whitelists caption alone and the photos table has no tags column. photosSlice.updatePhoto documents this deliberately (lines 178-186) and merges only caption back into local state, so tag edits vanish with no error.**

`src/components/PhotoCarousel/PhotoCarousel.tsx:211`

```ts
          onSave={(id, updates) => updatePhoto(String(id), updates)}
```

**4. The modal is dual-typed (`Photo | PhotoWithUrls`) to serve both the IndexedDB shape and the Supabase shape, so it probes for fields at runtime with `in`. For a Supabase photo the tags branch never fires, meaning the tags box always starts empty and hasChanges() reports a change the moment anything is typed into a field that cannot be saved.**

`src/components/PhotoEditModal/PhotoEditModal.tsx:35`

```ts
  const [tagsInput, setTagsInput] = useState('tags' in photo ? photo.tags.join(', ') : '');
```

**5. The dialog's error path is unreachable for Supabase photos: onConfirmDelete resolves to photosSlice.deletePhoto, which catches everything and only sets store error, so it never rejects. A failed delete closes the dialog exactly like a successful one.**

`src/components/PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx:41`

```ts
      await onConfirmDelete(photo.id);
```

**6. The carousel's window-level keydown listener stays attached while its child modals are open and is suppressed only by this manual flag check — there is no focus trap here (unlike PhotoViewer, which uses useFocusTrap). Any future modal opened from the carousel without setting one of these two booleans will have Escape/arrow keys hijacked by the carousel underneath.**

`src/components/PhotoCarousel/PhotoCarousel.tsx:85`

```ts
      if (isEditModalOpen || isDeleteConfirmOpen) {
```

---

# Scripture tab

_The largest feature area: a 17-step guided scripture reading, solo or synchronized with a partner in realtime._

## Scripture Reading Overview & Session Entry/Resume

The landing screen for the 'scripture' nav tab. Shows partner link status, a Start button that reveals Solo/Together mode cards, and — if an unfinished solo session exists on the server — a "Continue where you left off? (Step N of 17)" prompt with Continue / Start fresh. Creating or resuming a session flips this same component into a router that renders SoloReadingFlow, ReadingContainer or LobbyContainer based on (mode, phase). Also blocks Start and mode selection while offline and surfaces session errors.

**Start here:** `src/components/scripture-reading/containers/ScriptureOverview.tsx:144`

```ts
export function ScriptureOverview() {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | 521 | Container: partner status, Start → mode reveal, resume/start-fresh prompt, offline + error banners, and the (mode, phase) router that swaps in the reading containers |
| `src/stores/slices/scriptureReadingSlice.ts` | 1013 | Owns createSession / loadSession / checkForActiveSession / abandonSession / clearActiveSession / exitSession and the session + activeSession state |
| `src/services/scriptureReadingService.ts` | 962 | scripture_create_session RPC, cache-first getSession/getUserSessions over IndexedDB, write-through updateSession |
| `src/services/dbSchema.ts` | 280 | ScriptureSession/phase/status types and the four scripture IndexedDB object stores + indexes |
| `src/components/scripture-reading/constants.ts` | 10 | Shared Lavender Dreams theme tokens and the FOCUS_RING focus-visible classes |
| `src/components/scripture-reading/index.ts` | 21 | Barrel export for the feature (ScriptureOverview is the only entry App.tsx imports) |
| `src/App.tsx` | 610 | Lazily imports ScriptureOverview and mounts it when currentView === 'scripture' |
| `src/validation/schemas.ts` | 269 | Zod schemas (SupabaseSessionSchema etc.) that every server row is parsed through before caching |
| `src/services/BaseIndexedDBService.ts` | 307 | Base class the scripture service extends for the scripture-sessions store |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/scriptureReadingSlice.ts` | `session`, `activeSession`, `isCheckingSession`, `scriptureLoading`, `scriptureError`, `isInitialized`, `pendingRetry` | no — useAppStore's partialize (src/stores/useAppStore.ts:119-141) lists only settings, isOnboarded, messageHistory and moods; no scripture key is persisted to localStorage |
| `src/stores/slices/partnerSlice.ts` | `partner`, `isLoadingPartner`, `loadPartner` | no |

### Backend

| | |
|---|---|
| Supabase tables | `scripture_sessions` |
| RPCs | `scripture_create_session` |
| IndexedDB stores | `scripture-sessions` |
| Realtime | none on the solo path — useScriptureBroadcast is passed null unless broadcastSession?.mode === 'together' (ScriptureOverview.tsx:151-153) |

### Tests

- `src/components/scripture-reading/__tests__/ScriptureOverview.test.tsx` — unit
- `tests/unit/stores/scriptureReadingSlice.test.ts` — unit
- `tests/unit/services/scriptureReadingService.crud.test.ts` — unit
- `tests/unit/services/scriptureReadingService.cache.test.ts` — unit
- `tests/unit/services/scriptureReadingService.service.test.ts` — unit
- `tests/e2e/scripture/scripture-overview.spec.ts` — e2e
- `tests/e2e/scripture/scripture-session.spec.ts` — e2e
- `tests/e2e/scripture/scripture-seeding.spec.ts` — e2e
- `tests/e2e/scripture/scripture-rls-security.spec.ts` — e2e
- `supabase/tests/database/03_scripture_rpcs.sql` — db

### Watch out for

**1. A `?fresh=true` URL query param is a production-shipping test backdoor: it short-circuits the resume check so the "Continue where you left off?" prompt never appears, leaving the abandoned server session untouched.**

`src/components/scripture-reading/containers/ScriptureOverview.tsx:204`

```ts
    return new URLSearchParams(window.location.search).get('fresh') === 'true';
```

**2. loadSession hands the service a callback that blind-writes a background-fetched session into the store. getSession returns the IndexedDB copy immediately and fires the server refresh fire-and-forget, so a slow refresh can land AFTER the user has optimistically advanced a step and silently rewind currentStepIndex. There is no version or ordering check on this path.**

`src/stores/slices/scriptureReadingSlice.ts:240`

```ts
        set({ session: refreshed })
```

**3. The other half of the same race: the cached session is returned synchronously while the network refresh runs detached. Any caller of getSession gets stale-then-fresh with no way to await or cancel the second write.**

`src/services/scriptureReadingService.ts:225`

```ts
      void this.refreshSessionFromServer(sessionId, onRefresh);
```

**4. The resume prompt only ever offers solo sessions. An interrupted together-mode session is invisible on the overview — there is no resume path for it here.**

`src/stores/slices/scriptureReadingSlice.ts:303`

```ts
        .filter((s) => s.status === 'in_progress' && s.mode === 'solo')
```

**5. Stale comment: it claims offline users still see stats from Zustand persist, but coupleStats is not in the store's partialize list (src/stores/useAppStore.ts:119-141), so nothing is rehydrated — an offline reload shows the em-dash zero-state, not cached numbers.**

`src/components/scripture-reading/containers/ScriptureOverview.tsx:217`

```ts
  // Skip RPC call when offline — show cached stats from Zustand persist
```

**6. SoloReadingFlow is a misnomer at the routing layer: this branch (and the together-mode branch at lines 303-311) renders it for ANY session in reflection/report/complete, including together-mode ones. Changes to the 'solo' flow affect together-mode post-reading screens too.**

`src/components/scripture-reading/containers/ScriptureOverview.tsx:296`

```ts
  if (session && (session.status === 'complete' || session.currentPhase === 'reflection')) {
```

**7. loadSession self-guards on the shared scriptureLoading flag, which createSession also sets. A resume tap fired while a create is in flight is silently dropped with no error and no UI feedback.**

`src/stores/slices/scriptureReadingSlice.ts:223`

```ts
    if (get().scriptureLoading) return;
```

**8. exitSession/saveAndExit/abandonSession all funnel through resetSessionState, which deliberately carries coupleStats, isStatsLoading and isInitialized across the reset. Adding a new cross-session field to the slice requires editing this line or it will be wiped on every exit.**

`src/stores/slices/scriptureReadingSlice.ts:193`

```ts
  return { ...initialScriptureState, coupleStats, isStatsLoading, isInitialized };
```

---

## Couple Stats Dashboard ("Your Journey")

A five-card stats strip at the top of the scripture overview showing couple-aggregate numbers: Sessions Completed, Steps Completed, Last Completed (relative date), Average Rating and Bookmarks Saved. Values come from a single SECURITY DEFINER RPC. While loading it renders five skeleton cards; when every metric is empty it renders em dashes plus a "Begin your first reading" nudge instead of zeros.

**Start here:** `src/components/scripture-reading/overview/StatsSection.tsx:66`

```ts
export function StatsSection({ stats, isLoading }: StatsSectionProps): ReactElement {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/scripture-reading/overview/StatsSection.tsx` | 163 | Presentational: skeleton state, zero-state em-dash substitution, five StatCards with per-state aria-labels |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | 521 | Mounts StatsSection and triggers loadCoupleStats once partner loading settles and the device is online |
| `src/stores/slices/scriptureReadingSlice.ts` | 1013 | loadCoupleStats action; owns coupleStats + isStatsLoading (both preserved across session resets) |
| `src/services/scriptureReadingService.ts` | 962 | getCoupleStats — calls the scripture_get_couple_stats RPC and Zod-validates the payload; returns null on any failure |
| `src/api/validation/supabaseSchemas.ts` | 295 | CoupleStatsSchema (line 271) and the inferred CoupleStats type (line 295) — the single source of truth for the shape |
| `src/utils/dateUtils.ts` | 184 | formatRelativeDate, used for the "Last Completed" card value |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/scriptureReadingSlice.ts` | `coupleStats`, `isStatsLoading` | no — despite the in-code comment claiming otherwise, neither key appears in useAppStore's partialize |

### Backend

| | |
|---|---|
| RPCs | `scripture_get_couple_stats` |
| Realtime | none |

### Tests

- `src/components/scripture-reading/__tests__/StatsSection.test.tsx` — unit
- `tests/unit/stores/scriptureReadingSlice.stats.test.ts` — unit
- `tests/unit/services/scriptureReadingService.stats.test.ts` — unit
- `tests/e2e/scripture/scripture-stats.spec.ts` — e2e
- `supabase/tests/database/09_scripture_couple_stats.sql` — db

### Watch out for

**1. getCoupleStats swallows both RPC errors and Zod validation failures and returns null, and loadCoupleStats then leaves coupleStats untouched. A schema drift between the RPC and CoupleStatsSchema shows up only as a console.warn and a silently stale/zero-state dashboard.**

`src/services/scriptureReadingService.ts:583`

```ts
        console.warn('[ScriptureService] Failed to fetch couple stats:', error.message);
```

**2. Zero-state is all-or-nothing: every one of the five metrics must be empty for the em dashes to appear. A couple with one bookmark but zero completed sessions sees literal "0" in four cards instead of the friendly dash treatment.**

`src/components/scripture-reading/overview/StatsSection.tsx:18`

```ts
    stats.totalSessions === 0 &&
```

**3. Non-obvious ordering dependency: the stats fetch is gated on isLoadingPartner going false, not on anything stats-related. If partner loading never resolves, the stats RPC is never fired and the skeleton persists.**

`src/components/scripture-reading/containers/ScriptureOverview.tsx:219`

```ts
    if (!isLoadingPartner && isOnline) {
```

**4. The skeleton only shows on a genuinely cold load (`isLoading && !stats`). A refetch over existing data renders the old numbers with no busy indicator at all.**

`src/components/scripture-reading/overview/StatsSection.tsx:67`

```ts
  const showSkeleton = isLoading && !stats;
```

---

## Solo Reading Flow — 17 Steps, Bookmarks, Save & Resume

The step-by-step reading experience: 17 hard-coded NKJV verses grouped into 6 section themes, each with a verse screen and a toggleable response-prayer screen. Users bookmark verses with an amber flag, tap Next Verse to advance (last step reads "Complete Reading"), and can exit via a focus-trapped "Save your progress?" dialog. Progress is written to the server optimistically with a retry banner on failure, auto-saved on tab-hide/unload, and resumable from the overview.

**Start here:** `src/components/scripture-reading/containers/SoloReadingFlow.tsx:23`

```ts
export function SoloReadingFlow() {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/scripture-reading/containers/SoloReadingFlow.tsx` | 127 | Thin phase switch — picks reflection / report / reading view from the composed hook state and derives isLastStep + isNextDisabled |
| `src/components/scripture-reading/containers/ReadingPhaseView.tsx` | 411 | All reading-phase markup: progress header, verse/response slide+crossfade animations, bookmark flag, offline/sync/error/retry banners, exit confirm dialog |
| `src/components/scripture-reading/hooks/useSoloReadingFlow.ts` | 157 | Orchestrator: pulls the scripture + partner slices with useShallow, owns the shared aria-live announcement with a 1s auto-clear, composes the four sub-hooks |
| `src/components/scripture-reading/hooks/useReadingNavigation.ts` | 109 | subView (verse\|response), slide direction, and the announce+focus effects on step and sub-view change |
| `src/components/scripture-reading/hooks/useSessionPersistence.ts` | 135 | Wires useAutoSave, loads+optimistically toggles bookmarks with a 300ms debounced server write, auto-retries the pending write on offline→online |
| `src/components/scripture-reading/hooks/useReadingDialogs.ts` | 52 | Exit-confirm dialog state, focus save/restore, useFocusTrap with Escape handling |
| `src/components/scripture-reading/reading/BookmarkFlag.tsx` | 45 | Presentational amber bookmark toggle (48x48 target, aria-pressed); debounce lives in the hook, not here |
| `src/hooks/useAutoSave.ts` | 47 | Fire-and-forget saveSession on visibilitychange→hidden and beforeunload, only while status === 'in_progress' |
| `src/data/scriptureSteps.ts` | 183 | MAX_STEPS = 17 plus the frozen SCRIPTURE_STEPS array (verseReference, verseText, responseText, sectionTheme) |
| `src/stores/slices/scriptureReadingSlice.ts` | 1013 | advanceStep (optimistic + pendingRetry), saveSession, saveAndExit, retryFailedWrite, isSyncing/scriptureError/pendingRetry state |
| `src/services/scriptureReadingService.ts` | 962 | updateSession write-through, toggleBookmark/addBookmark/getBookmarksBySession with IndexedDB cache + corruption recovery |
| `src/components/scripture-reading/motionFeatures.ts` | 3 | Lazily imported Framer Motion feature bundle for the LazyMotion strict wrappers |
| `src/hooks/useFocusTrap.ts` | 68 | Focus trap + Escape handler used by the exit-confirm dialog |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/scriptureReadingSlice.ts` | `session`, `isSyncing`, `scriptureError`, `pendingRetry` | no — progress lives on the server (scripture_sessions) and in IndexedDB, never in localStorage |

### Backend

| | |
|---|---|
| Supabase tables | `scripture_sessions`, `scripture_bookmarks` |
| IndexedDB stores | `scripture-sessions`, `scripture-bookmarks` |
| Realtime | none |

### Tests

- `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` — unit
- `src/components/scripture-reading/__tests__/BookmarkFlag.test.tsx` — unit
- `tests/unit/hooks/useAutoSave.test.ts` — unit
- `tests/unit/data/scriptureSteps.test.ts` — unit
- `tests/unit/stores/scriptureReadingSlice.test.ts` — unit
- `tests/e2e/scripture/scripture-solo-reading.spec.ts` — e2e
- `tests/e2e/scripture/scripture-session.spec.ts` — e2e
- `tests/e2e/scripture/scripture-accessibility.spec.ts` — e2e

### Watch out for

**1. There is no 18th step. Tapping "Complete Reading" on step 17 flips currentPhase to 'reflection' and CLAMPS currentStepIndex back to 16 rather than incrementing — so a resumed session never carries an out-of-range index, and any code reading currentStepIndex to detect completion will be wrong.**

`src/stores/slices/scriptureReadingSlice.ts:337`

```ts
        currentStepIndex: MAX_STEPS - 1,
```

**2. advanceStep is optimistic with NO rollback: the local session is advanced before the network call, and a failure only records a pendingRetry. The user stays on the new verse while the server still believes they are on the old one; only the retry banner hints at the divergence.**

`src/stores/slices/scriptureReadingSlice.ts:378`

```ts
      set({ session: updatedSession, isSyncing: true });
```

**3. subView is never reset when the step changes. Tapping "Next Verse" from the response screen lands the user on the NEXT verse's response prayer, skipping its verse screen entirely — setSubView is only called by handleViewResponse and handleBackToVerse.**

`src/components/scripture-reading/hooks/useReadingNavigation.ts:46`

```ts
    setSubView('response');
```

**4. One shared debounce timer serves every step's bookmark. Toggling step 3 and then step 4 within 300ms clears the first timeout, so step 3's server write never fires while its optimistic checkmark stays on screen — a silent local/server divergence.**

`src/components/scripture-reading/hooks/useSessionPersistence.ts:103`

```ts
      clearTimeout(bookmarkDebounceRef.current);
```

**5. Same timer is cleared on unmount, so a bookmark tapped within 300ms of exiting the reading flow is never persisted at all.**

`src/components/scripture-reading/hooks/useSessionPersistence.ts:45`

```ts
      if (bookmarkDebounceRef.current) clearTimeout(bookmarkDebounceRef.current);
```

**6. Every bookmark is written with shareWithPartner hard-coded false; sharing is only ever applied later, in bulk, by updateSessionBookmarkSharing during reflection submit. Reading share_with_partner mid-session always yields false.**

`src/components/scripture-reading/hooks/useSessionPersistence.ts:109`

```ts
          await scriptureReadingService.toggleBookmark(sessionId, stepIndex, userId, false);
```

**7. The failure path 'reverts' by flipping whatever the current value is, not by restoring the captured pre-toggle value. If the user toggles the same step again during the 300ms window, this compounding flip leaves the UI in the wrong state.**

`src/components/scripture-reading/hooks/useSessionPersistence.ts:117`

```ts
          setBookmarkedSteps((prev) => {
```

**8. Bookmarks are fetched exactly once per session id — the effect deps are only [sessionId, sessionUserId]. Bookmarks created on another device mid-session never appear, and a failed write is never reconciled against the server.**

`src/components/scripture-reading/hooks/useSessionPersistence.ts:81`

```ts
  }, [sessionId, sessionUserId]);
```

**9. beforeunload calls an async saveSession without awaiting (impossible in that event anyway) — this is best-effort only. The authoritative save is the visibilitychange→hidden handler; treat unload-time persistence as unreliable.**

`src/hooks/useAutoSave.ts:34`

```ts
      void saveSession();
```

**10. saveSession/saveAndExit deliberately write only currentStepIndex + currentPhase. Status transitions ('complete', 'abandoned') are owned by separate code paths, so calling saveSession will never finish or abandon a session no matter what session.status holds locally.**

`src/stores/slices/scriptureReadingSlice.ts:445`

```ts
  // by dedicated actions (markSessionComplete, abandonSession).
```

**11. Auto-retry on reconnect fires from an effect that watches pendingRetry, and retryFailedWrite increments attempts, producing a new pendingRetry object — so a still-offline flap can chain retries up to maxAttempts without any user action.**

`src/components/scripture-reading/hooks/useSessionPersistence.ts:62`

```ts
      void retryFailedWrite();
```

---

## End-of-Session Reflection Summary & Daily Prayer Report

After the 17th verse the session moves to a reflection screen: pick which bookmarked verses stood out, rate the session 1-5, optionally leave a 200-char note, and choose whether to share bookmarks with your partner. Linked users then compose a 300-char message (or skip), which marks the session complete and opens the Daily Prayer Report — per-verse ratings, standout-verse chips, both partners' messages, and a "Waiting for X's reflections" state. Unlinked users get a simple "Session complete" screen instead.

**Start here:** `src/components/scripture-reading/hooks/useReportPhase.ts:45`

```ts
export function useReportPhase({
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/scripture-reading/hooks/useReportPhase.ts` | 508 | The whole post-reading state machine: sub-phase selection, reflection submit, markSessionComplete with retry, report data assembly, completion/report error handling, a11y announcements |
| `src/components/scripture-reading/containers/ReportPhaseView.tsx` | 258 | Renders the four report sub-phases: complete-unlinked, completion-error, compose, report |
| `src/components/scripture-reading/reflection/ReflectionSummary.tsx` | 318 | Standout-verse chips, share-bookmarks checkbox, arrow-key 1-5 rating radiogroup, auto-grow note, quiet validation |
| `src/components/scripture-reading/reflection/MessageCompose.tsx` | 139 | Partner message textarea (300 chars, counter at 250), Send + no-guilt "Skip for now" |
| `src/components/scripture-reading/reflection/DailyPrayerReport.tsx` | 221 | Read-only report: per-step rating circles, own + shared partner bookmark flags, standout chips, message reveal, waiting state, Return to Overview |
| `src/components/scripture-reading/containers/SoloReadingFlow.tsx` | 127 | Builds bookmarkedVerses from the persistence hook's Set and routes to ReflectionSummary or ReportPhaseView |
| `src/services/scriptureReadingService.ts` | 962 | addReflection RPC, addMessage insert, updateSessionBookmarkSharing bulk update, getSessionReportData (cache-bypassing parallel fetch) |
| `src/stores/slices/scriptureReadingSlice.ts` | 1013 | updatePhase (local-only phase mutation) and exitSession, both called by the report hook |
| `src/data/scriptureSteps.ts` | 183 | MAX_STEPS doubles as the session-level reflection sentinel index; SCRIPTURE_STEPS drives the report's per-verse rows |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/scriptureReadingSlice.ts` | `session`, `isSyncing` | no — all report sub-phase state (reportSubPhase, reportData, completionError, reportLoadError) is component-local useState in useReportPhase, so a reload mid-report re-derives it from session.currentPhase/status |
| `src/stores/slices/partnerSlice.ts` | `partner`, `isLoadingPartner` | no — but they decide linked vs unlinked branching, see gotchas |

### Backend

| | |
|---|---|
| Supabase tables | `scripture_sessions`, `scripture_reflections`, `scripture_bookmarks`, `scripture_messages` |
| RPCs | `scripture_submit_reflection` |
| IndexedDB stores | `scripture-reflections`, `scripture-bookmarks`, `scripture-messages`, `scripture-sessions` |
| Realtime | none — the report polls nothing; partner data refreshes only via the manual Retry button (handleRetryReportLoad) |

### Tests

- `src/components/scripture-reading/__tests__/ReflectionSummary.test.tsx` — unit
- `src/components/scripture-reading/__tests__/MessageCompose.test.tsx` — unit
- `src/components/scripture-reading/__tests__/DailyPrayerReport.test.tsx` — unit
- `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` — unit
- `tests/e2e/scripture/scripture-reflection-2.2.spec.ts` — e2e
- `tests/e2e/scripture/scripture-reflection-2.2-errors.spec.ts` — e2e
- `tests/e2e/scripture/scripture-reflection-2.3.spec.ts` — e2e
- `supabase/tests/database/03_scripture_rpcs.sql` — db

### Watch out for

**1. The session-level reflection is stored at stepIndex = MAX_STEPS (17), one past the last real verse (0-16). That sentinel is how the report later distinguishes the summary reflection from per-step ratings — writing a real reflection at index 17 would corrupt the report.**

`src/components/scripture-reading/hooks/useReportPhase.ts:100`

```ts
            MAX_STEPS,
```

**2. The reflection `notes` column holds JSON, not prose: the user's typed note is nested under userNote alongside standoutVerses. Anything reading notes as plain text (exports, admin views) gets a JSON blob.**

`src/components/scripture-reading/hooks/useReportPhase.ts:94`

```ts
          const jsonNotes = JSON.stringify({
```

**3. Asymmetric error handling on the same parse: a corrupt OWN reflection is swallowed silently (standout verses just vanish from the report), while the identical failure on the partner's reflection is reported as CACHE_CORRUPTED at line 376-381.**

`src/components/scripture-reading/hooks/useReportPhase.ts:350`

```ts
            // Invalid JSON in notes — proceed without standout verses
```

**4. A failed partner message is deliberately non-blocking — completion proceeds anyway — and messageSendFailed is set but never surfaced: useSoloReadingFlow does not re-export it (see its return object, lines 100-156), so nothing in the UI ever tells the user their message was lost.**

`src/components/scripture-reading/hooks/useReportPhase.ts:194`

```ts
            logger.info('Message write failed, proceeding with session completion', error);
```

**5. Dead state: messageSendFailed is returned from this hook but consumed nowhere. Removing it is safe; wiring it into ReportPhaseView is the actual fix for the silent-message-loss gap above.**

`src/components/scripture-reading/hooks/useReportPhase.ts:491`

```ts
    messageSendFailed,
```

**6. markSessionComplete swallows failures and returns a boolean after exactly two attempts with a 500ms gap (line 163). Callers must branch on the return value; treating it as a throwing async function will silently skip the completion-error screen.**

`src/components/scripture-reading/hooks/useReportPhase.ts:148`

```ts
    for (let attempt = 0; attempt < 2; attempt += 1) {
```

**7. markSessionComplete is mirrored into a ref inside an effect, not during render, specifically so StrictMode's double render and concurrent rendering can't tear the value. Do not 'simplify' this into a render-phase assignment.**

`src/components/scripture-reading/hooks/useReportPhase.ts:177`

```ts
    markSessionCompleteRef.current = markSessionComplete;
```

**8. The report-data effect depends on the whole `session` object, not on session.id. Because every slice set() produces a fresh session object, updatePhase('complete') alone re-triggers a full three-table refetch of the report.**

`src/components/scripture-reading/hooks/useReportPhase.ts:414`

```ts
  }, [reportSubPhase, session, reportReloadKey]);
```

**9. Linked-vs-unlinked branching hinges on partner resolution: while !hasPartner && isLoadingPartner the effect bails out entirely, so a partner slice that never settles leaves the user stuck on whatever sub-phase the lazy initializer guessed at first render (lines 54-59).**

`src/components/scripture-reading/hooks/useReportPhase.ts:276`

```ts
    const isWaitingForPartnerResolution = !hasPartner && isLoadingPartner;
```

**10. Bookmark sharing is applied as a bulk UPDATE over all of the user's bookmarks in the session at submit time, and its failure is caught separately so the reflection still saves. Per-bookmark sharing granularity does not exist.**

`src/components/scripture-reading/hooks/useReportPhase.ts:106`

```ts
            await scriptureReadingService.updateSessionBookmarkSharing(
```

**11. getSessionReportData deliberately bypasses the cache-first readers and hits the server for all three tables in parallel — it is the only path that can see the partner's rows, so never swap it for getReflectionsBySession/getBookmarksBySession.**

`src/services/scriptureReadingService.ts:939`

```ts
    const [reflections, bookmarks, messages] = await Promise.all([
```

**12. Solo sessions produce no per-step reflections at all: addReflection is called from exactly one place (line 98, with the MAX_STEPS sentinel). Since userRatings filters to stepIndex < MAX_STEPS, the report's "Your Reflections" rating circles are always empty for a solo-only session.**

`src/components/scripture-reading/hooks/useReportPhase.ts:330`

```ts
          (r) => r.userId === session.userId && r.stepIndex < MAX_STEPS && r.rating != null
```

**13. Continue is never HTML-disabled for incomplete input — only aria-disabled. Clicking it deliberately falls through to setShowValidation(true) so screen-reader users hear why, which means click handlers here must not assume the button is unreachable when incomplete.**

`src/components/scripture-reading/reflection/ReflectionSummary.tsx:115`

```ts
      setShowValidation(true);
```

**14. updatePhase only mutates the in-memory session; it does not write to Supabase. Every caller must pair it with an explicit updateSession call (as lines 119-122 do) or the phase change is lost on reload.**

`src/stores/slices/scriptureReadingSlice.ts:275`

```ts
  updatePhase: (phase) => {
```

---

## Together Mode: Lobby, Role Selection & Countdown

After picking "Together" on the Scripture overview, both partners land in a shared lobby. Each picks a role (Reader or Responder), sees the other's join + ready status live, and taps "I'm Ready". When both are ready the server stamps a countdown start time and both clients run a 3-2-1 countdown derived from that server timestamp, then drop into the synchronized reading view. A "Continue solo" escape hatch converts the session to solo mode and evicts the partner.

**Start here:** `src/components/scripture-reading/containers/LobbyContainer.tsx:25`

```ts
export function LobbyContainer(): ReactElement {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/scripture-reading/containers/LobbyContainer.tsx` | 256 | Three-phase lobby UI: role selection (no myRole), waiting/ready toggle, and countdown; reads all lobby state from the Zustand slice. |
| `src/components/scripture-reading/session/Countdown.tsx` | 108 | 3-2-1 digit derived from (Date.now() - startedAt) polled at 250ms, so clock skew self-corrects; calls onComplete at 0. |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | 521 | Routes (mode, phase) to Lobby/Reading/Solo containers and is where useScriptureBroadcast is mounted so the channel survives lobby→countdown→reading. |
| `src/hooks/useScriptureBroadcast.ts` | 272 | Subscribes to private broadcast channel scripture-session:{id}; dispatches partner_joined / state_updated / session_converted / lock_in_status_changed into slice actions and wires the outbound broadcast fn. |
| `src/stores/slices/scriptureReadingSlice.ts` | 1013 | selectRole, toggleReady, convertToSolo, applySessionConverted, onPartnerJoined, onBroadcastReceived — optimistic writes plus client-side re-broadcast of each RPC snapshot. |
| `src/services/scriptureReadingService.ts` | 962 | createSession RPC wrapper and cache-first getSession used by loadSession; maps snake_case rows to ScriptureSession with userId = user1_id. |
| `supabase/migrations/20260220000001_scripture_lobby_and_roles.sql` | 367 | Adds lobby columns and the realtime.messages RLS policies gating scripture-session:% send/receive to session members. |
| `supabase/migrations/20260301000200_remove_server_side_broadcasts.sql` | 579 | Current definitions of scripture_select_role / scripture_toggle_ready / scripture_convert_to_solo; strips all server-side realtime.send() so clients broadcast instead. |
| `supabase/migrations/20260221211137_scripture_lobby_phase_guards.sql` | 296 | Phase guards on lobby RPCs (ready toggling only allowed while current_phase = 'lobby'). |
| `src/components/scripture-reading/constants.ts` | 10 | scriptureTheme + FOCUS_RING shared by every scripture container. |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/scriptureReadingSlice.ts` | `session`, `myRole`, `partnerJoined`, `myReady`, `partnerReady`, `countdownStartedAt`, `scriptureLoading`, `scriptureError` | no — partialize in src/stores/useAppStore.ts (lines 119-141) persists only settings, isOnboarded, messageHistory and moods; no scripture keys survive a reload |

### Backend

| | |
|---|---|
| Supabase tables | `scripture_sessions` |
| RPCs | `scripture_create_session`, `scripture_select_role`, `scripture_toggle_ready`, `scripture_convert_to_solo` |
| IndexedDB stores | `scripture-sessions` |
| Realtime | Supabase Broadcast only, channel `scripture-session:{sessionId}` with { broadcast: { self: false }, private: true }. Events: partner_joined, state_updated, session_converted, lock_in_status_changed. The Supabase Presence API is NOT used anywhere — the 'presence' channel is a second Broadcast channel. |

### Tests

- `tests/unit/stores/scriptureReadingSlice.lobby.test.ts` — unit
- `src/components/scripture-reading/__tests__/LobbyContainer.test.tsx` — unit
- `src/components/scripture-reading/__tests__/Countdown.test.tsx` — unit
- `tests/unit/hooks/useScriptureBroadcast.test.ts` — unit
- `tests/e2e/scripture/scripture-lobby-4.1.spec.ts` — e2e
- `tests/e2e/scripture/scripture-lobby-4.1-p2.spec.ts` — e2e
- `supabase/tests/database/10_scripture_lobby.sql` — db
- `supabase/tests/database/13_scripture_create_session_together_semantics.sql` — db

### Watch out for

**1. The countdown phase is gated on countdownStartedAt, NOT on session.currentPhase. ScriptureOverview routes both 'lobby' and 'countdown' phases to LobbyContainer, so whichever client has the timestamp renders the countdown regardless of what its local session.currentPhase says. countdownStartedAt is never cleared except by convertToSolo/reset, so it must not be repopulated after reading starts.**

`src/components/scripture-reading/containers/LobbyContainer.tsx:73`

```ts
  if (countdownStartedAt !== null) {
```

**2. Countdown completion advances the phase LOCALLY ONLY. The slice's updatePhase (scriptureReadingSlice.ts:275 `  updatePhase: (phase) => {`) mutates state.session and issues no RPC and no broadcast, so each client transitions to reading independently off its own timer.**

`src/components/scripture-reading/containers/LobbyContainer.tsx:68`

```ts
      updatePhase('reading');
```

**3. Consequence of the previous gotcha: the DB row stays current_phase='countdown' after the countdown finishes. scripture_lock_in therefore has to accept 'countdown' as a valid phase and flips the row to 'reading' itself on the first lock-in — without bumping version. Any new RPC that guards on current_phase='reading' will spuriously reject the first action of a session.**

`supabase/migrations/20260313000001_fix_lock_in_last_step.sql:42`

```ts
  -- lock-in arrives (the countdown->reading transition is client-side only).
```

**4. Dead code. `grep -rn "onCountdownStarted\|onPartnerReady" src/ tests/` shows both actions are referenced only by their own type declarations, their definitions, and unit tests — no hook or component ever calls them. Countdown start and partner-ready both actually arrive through onBroadcastReceived's state_updated snapshot. Do not 'fix' a lobby bug by wiring the broadcast to these.**

`src/stores/slices/scriptureReadingSlice.ts:743`

```ts
  onCountdownStarted: (startTs) => {
```

**5. partnerJoined is back-derived from the scripture_select_role RPC snapshot, not only from the partner_joined broadcast. This exists because User B can subscribe after User A already broadcast partner_joined and would otherwise never see the partner as present. Same reconciliation happens again in onBroadcastReceived (line 791).**

`src/stores/slices/scriptureReadingSlice.ts:618`

```ts
        ...(partnerRole != null ? { partnerJoined: true } : {}),
```

**6. The server broadcasts NOTHING. Every together-mode state change reaches the partner only because the calling client re-broadcasts the RPC's returned JSONB snapshot via channel.send(). If the client's WebSocket send fails or the component unmounted before the RPC resolved, the partner is permanently out of sync until it re-runs loadSession.**

`supabase/migrations/20260301000200_remove_server_side_broadcasts.sql:4`

```ts
-- Purpose: Remove PERFORM realtime.send() calls from all scripture RPCs.
```

**7. The outbound broadcast function is a MODULE-level singleton, deliberately outside Zustand (comment at line 45 cites serialization). useScriptureBroadcast's cleanup sets it to null (useScriptureBroadcast.ts:255 `      setBroadcastFn?.(null);`), so any in-flight RPC that resolves after unmount silently drops its `broadcastFnRef?.(...)` call with optional chaining and no error.**

`src/stores/slices/scriptureReadingSlice.ts:48`

```ts
let broadcastFnRef: ((event: string, payload: unknown) => void) | null = null;
```

**8. The session broadcast channel is mounted at the ScriptureOverview level — not in LobbyContainer (see LobbyContainer.tsx:58) — precisely so it is not torn down when the router swaps LobbyContainer for ReadingContainer. Moving useScriptureBroadcast into a child container silently breaks reconnection across the lobby→reading transition.**

`src/components/scripture-reading/containers/ScriptureOverview.tsx:152`

```ts
    broadcastSession?.mode === 'together' ? (broadcastSession?.id ?? null) : null
```

**9. partner_joined is re-broadcast on EVERY successful SUBSCRIBED, not just the first join. That is the mechanism that clears the peer's disconnection overlay after a reconnect (onPartnerJoined resets partnerDisconnected/partnerDisconnectedAt, slice lines 732-733), so treating it as a one-shot join event and de-duplicating it would break reconnection recovery.**

`src/hooks/useScriptureBroadcast.ts:187`

```ts
              event: 'partner_joined',
```

---

## Together Mode: Synchronized Reading & Lock-In

The shared 17-step reading view. Each partner sees an alternating Reader/Responder badge, can flip between the Verse and Response tabs, and sees a live "partner is reading the verse/response" indicator fed by a second broadcast channel. Neither partner can advance alone: both must tap "Ready for next verse" (lock in), and only when the scripture_lock_in RPC observes both locks does the step advance for both. Lock-in is undoable while waiting, and a version mismatch shows a "Session updated" toast and refetches.

**Start here:** `src/components/scripture-reading/containers/ReadingContainer.tsx:35`

```ts
export function ReadingContainer(): ReactElement | null {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/scripture-reading/containers/ReadingContainer.tsx` | 443 | Together-mode reading orchestrator: role badge, verse/response tabs, lock-in area, presence hook wiring, disconnection overlay mount, and three toasts (session updated / reconnected / error). |
| `src/components/scripture-reading/session/LockInButton.tsx` | 132 | Presentational lock-in button with four states: unlocked, locked+waiting+undo, partner-locked indicator, and the two disconnected variants. |
| `src/components/scripture-reading/reading/PartnerPosition.tsx` | 51 | Renders 'partner is reading the verse/response' from PartnerPresenceInfo; when view is null it still emits a hidden data-presence-connected sentinel for tests. |
| `src/components/scripture-reading/reading/RoleIndicator.tsx` | 29 | Pill badge — 'You read this' vs 'Partner reads this'. |
| `src/components/scripture-reading/reading/BookmarkFlag.tsx` | 45 | Bookmark toggle rendered next to the verse reference. |
| `src/hooks/useScripturePresence.ts` | 257 | Second broadcast channel scripture-presence:{id}: 10s heartbeats of {user_id, step_index, view, ts}, 20s stale TTL, returns purely local PartnerPresenceInfo. |
| `src/hooks/useScriptureBroadcast.ts` | 272 | Delivers lock_in_status_changed and state_updated (triggered_by 'lock_in') and resolves which lock field is the partner's from currentUserId vs session.userId. |
| `src/stores/slices/scriptureReadingSlice.ts` | 1013 | lockIn / undoLockIn / onPartnerLockInChanged / onBroadcastReceived — optimistic isPendingLockIn with rollback, 409 detection, and both_locked local advance. |
| `supabase/migrations/20260313000001_fix_lock_in_last_step.sql` | 164 | Current scripture_lock_in definition: FOR UPDATE row lock, phase/step/version guards, idempotent UPSERT into scripture_step_states, advance-or-reflection, returns broadcast hints. |
| `supabase/migrations/20260222000001_scripture_lock_in.sql` | 329 | Original lock-in migration; also creates the realtime.messages RLS policies for the scripture-presence:% topic. |
| `src/data/scriptureSteps.ts` | — | MAX_STEPS and the SCRIPTURE_STEPS content array indexed by currentStepIndex. |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/scriptureReadingSlice.ts` | `session`, `myRole`, `isPendingLockIn`, `partnerLocked`, `isSyncing`, `scriptureError` | no — absent from the partialize whitelist in src/stores/useAppStore.ts |

### Backend

| | |
|---|---|
| Supabase tables | `scripture_sessions`, `scripture_step_states` |
| RPCs | `scripture_lock_in`, `scripture_undo_lock_in` |
| IndexedDB stores | `scripture-sessions` |
| Realtime | Two separate private Broadcast channels: `scripture-session:{sessionId}` (lock_in_status_changed, state_updated) and `scripture-presence:{sessionId}` (presence_update heartbeats). Both use { broadcast: { self: false }, private: true }; both are gated by realtime.messages RLS policies keyed on split_part(topic, ':', 2)::uuid. |

### Tests

- `tests/unit/stores/scriptureReadingSlice.lockin.test.ts` — unit
- `src/components/scripture-reading/__tests__/ReadingContainer.test.tsx` — unit
- `src/components/scripture-reading/__tests__/LockInButton.test.tsx` — unit
- `src/components/scripture-reading/__tests__/PartnerPosition.test.tsx` — unit
- `src/components/scripture-reading/__tests__/RoleIndicator.test.tsx` — unit
- `tests/unit/hooks/useScripturePresence.test.ts` — unit
- `tests/e2e/scripture/scripture-reading-4.2.spec.ts` — e2e
- `supabase/tests/database/11_scripture_lockin.sql` — db

### Watch out for

**1. Roles alternate every step and the alternation is computed client-side with a boolean-equality XOR — nothing about the current step's role is stored server-side. myRole is the role chosen in the lobby (step 0's role); the displayed role for step N is myRole flipped on odd N. Changing MAX_STEPS parity or seeding a session mid-step will silently swap who reads.**

`src/components/scripture-reading/containers/ReadingContainer.tsx:184`

```ts
      : (myRole === 'reader') === ((session?.currentStepIndex ?? 0) % 2 === 0)
```

**2. Both channels are created with broadcast.self = false, so the client that completes the pair MUST apply the step advance to its own state from the RPC return value (lines 863-872) and separately broadcast state_updated to the partner. Two different code paths produce the same visible advance; a bug fixed in only one of them appears to affect only one partner.**

`src/stores/slices/scriptureReadingSlice.ts:860`

```ts
        // so this client won't receive its own broadcast).
```

**3. onBroadcastReceived drops any snapshot whose version is less than OR EQUAL to the local version. Because the acting client updates its own version from the RPC return before broadcasting, a client that has already applied a change ignores the echo — but it also means an out-of-order or replayed broadcast is discarded entirely rather than reconciled, and the only recovery is loadSession.**

`src/stores/slices/scriptureReadingSlice.ts:758`

```ts
    if (session && payload.version <= session.version) return;
```

**4. Optimistic-concurrency detection is STRING PREFIX MATCHING on the Postgres error text. The RPC raises it literally (supabase/migrations/20260313000001_fix_lock_in_last_step.sql:63 `    RAISE EXCEPTION '409: version mismatch';`). Reword that RAISE and the client stops rolling back + refetching, falling through to the generic error toast instead.**

`src/stores/slices/scriptureReadingSlice.ts:846`

```ts
        if (typeof error.message === 'string' && error.message.startsWith('409:')) {
```

**5. The last step index is hardcoded as 16 in SQL while the client uses MAX_STEPS from src/data/scriptureSteps.ts — two independent sources of truth. On step 16 the RPC moves current_phase to 'reflection' and leaves status='in_progress' (the whole point of this migration), so ScriptureOverview's status==='complete' route no longer catches together-mode sessions; the explicit mode==='together' && phase in (reflection|report|complete) branch at ScriptureOverview.tsx:303-311 exists for that.**

`supabase/migrations/20260313000001_fix_lock_in_last_step.sql:97`

```ts
    IF p_step_index < 16 THEN
```

**6. Together-mode bookmarks are component-local React state and are NEVER persisted. The solo flow persists through useSessionPersistence (optimistic toggle + 300ms debounce into scripture_bookmarks); ReadingContainer does not use that hook at all, so a bookmark flagged in together mode is lost on unmount and never appears in the reflection/report phase.**

`src/components/scripture-reading/containers/ReadingContainer.tsx:76`

```ts
  const [bookmarkedSteps, setBookmarkedSteps] = useState<Set<number>>(new Set());
```

**7. React StrictMode double-mount guard. It means the effect is a no-op whenever a channel object already exists, so every reconnection path MUST null channelRef before bumping retryCount — the CHANNEL_ERROR branch does this at line 186. Adding a reconnect path that forgets to null the ref produces a permanently dead channel with no error.**

`src/hooks/useScripturePresence.ts:95`

```ts
    if (channelRef.current !== null) return;
```

**8. If supabase.auth.getUser() resolves with no user, userIdRef stays '' and every heartbeat becomes a silent no-op — the channel subscribes, isChannelSubscribed flips true, the UI looks healthy, and the partner sees you go stale after 20s. There is no logging on this path.**

`src/hooks/useScripturePresence.ts:75`

```ts
    if (!channel || !userId) return;
```

---

## Together Mode: Disconnection Detection, Overlay & Reconnection

While reading together, each client heartbeats its position every 10 seconds on the presence channel. If nothing arrives from the partner for 20 seconds, an overlay appears: for the first 30 seconds it says "Partner reconnecting...", after which it offers "Keep Waiting" or "End Session" (with a confirm step). The lock-in button degrades to a disabled "Holding your place". When the partner's heartbeat returns, the overlay clears, a green "Reconnected" toast shows for 2s, and the session is re-fetched to resync. THERE IS A KNOWN OPEN BUG HERE — see the first gotcha.

**Start here:** `src/hooks/useScripturePresence.ts:43`

```ts
export function useScripturePresence(
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/hooks/useScripturePresence.ts` | 257 | Owns disconnection detection: 10s heartbeat interval, 20s stale timer that flips isPartnerConnected to false, and CHANNEL_ERROR-only re-subscribe via retryCount. |
| `src/components/scripture-reading/session/DisconnectionOverlay.tsx` | 133 | Two-phase modal driven by Date.now() - disconnectedAt with a 30s threshold; Phase A pulse, Phase B Keep Waiting / End Session + confirm. |
| `src/components/scripture-reading/containers/ReadingContainer.tsx` | 443 | Translates the hook's local isPartnerConnected transitions into slice partnerDisconnected, mounts the overlay, fires loadSession + Reconnected toast on recovery, and implements handleKeepWaiting. |
| `src/components/scripture-reading/session/LockInButton.tsx` | 132 | Disconnected variants: 'Holding your place' (disabled) when unlocked, and 'Waiting for X... / Reconnecting...' with undo still available when locked. |
| `src/stores/slices/scriptureReadingSlice.ts` | 1013 | partnerDisconnected / partnerDisconnectedAt state, setPartnerDisconnected timestamping, onPartnerJoined clearing them, and endSession. |
| `src/hooks/useScriptureBroadcast.ts` | 272 | Bounded re-subscribe on CHANNEL_ERROR/CLOSED, resync via loadSession on re-SUBSCRIBED, partner_joined re-broadcast to clear the peer's overlay, and setPartnerDisconnected(true) on auth failure. |
| `src/services/scriptureReadingService.ts` | 962 | getSession's cache-first read that backs the reconnect resync (returns IndexedDB copy, then refreshes in background via the onRefresh callback). |
| `supabase/migrations/20260222000001_scripture_lock_in.sql` | 329 | Creates the realtime.messages SELECT/INSERT policies for topic LIKE 'scripture-presence:%' scoped to session members (lines 300-327). |
| `supabase/migrations/20260228000001_scripture_end_session.sql` | 102 | scripture_end_session RPC invoked from the overlay's End Session button. |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/scriptureReadingSlice.ts` | `partnerDisconnected`, `partnerDisconnectedAt`, `partnerJoined`, `isSyncing` | no — not in the partialize whitelist (src/stores/useAppStore.ts lines 119-141); PartnerPresenceInfo itself is local React state and never enters Zustand or IndexedDB at all |

### Backend

| | |
|---|---|
| Supabase tables | `scripture_sessions` |
| RPCs | `scripture_end_session` |
| IndexedDB stores | `scripture-sessions` |
| Realtime | Presence is home-rolled on a private Broadcast channel `scripture-presence:{sessionId}` (event presence_update, 10s heartbeat, 20s stale TTL) — the Supabase Presence API (channel.track/presenceState) is NOT used. Recovery signals also arrive on `scripture-session:{sessionId}` via partner_joined. |

### Tests

- `tests/unit/hooks/useScripturePresence.reconnect.test.ts` — unit
- `tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts` — unit
- `tests/unit/stores/scriptureReadingSlice.reconnect.test.ts` — unit
- `src/components/scripture-reading/__tests__/DisconnectionOverlay.test.tsx` — unit
- `tests/e2e/scripture/scripture-reconnect-4.3.spec.ts` — e2e
- `supabase/tests/database/12_scripture_end_session.sql` — db

### Watch out for

**1. KNOWN OPEN BUG — THE FIX NEVER LANDED. The handoff at _bmad-output/handoff-documents/handoff-2026-03-21-scripture-presence-reconnection.md specifies two layers (detect WebSocket→REST degradation after each heartbeat; add a verify/grace period before showing the overlay). Neither exists in main: the send() result is discarded with `void`, there is no transport/socket check, and no grace state. Verification run this session — `grep -rc "httpSend" src/` matched 0 files, `grep -rni "verifying|gracePeriod"` in src/ returned no matches, and `git rev-list --count main..fix/scripture-presence-reconnection` = 0 (the branch has no commits ahead of main). Live symptom: when supabase-js silently falls back to REST for send(), heartbeats stop reaching the partner while the channel still reports 'subscribed', so BOTH partners flip to partnerDisconnected after 20s and neither recovers (degradation is permanent, not transient).**

`src/hooks/useScripturePresence.ts:78`

```ts
    void channel.send({
```

**2. Presence starts OPTIMISTICALLY connected, and ReadingContainer seeds its edge detector from that same optimistic value (ReadingContainer.tsx:97 `  const prevConnectedRef = useRef(partnerPresence.isPartnerConnected);`). So the very first 20s stale timeout is interpreted as a true→false *transition* and raises the full disconnection overlay even for a partner who never connected in the first place — 'never joined' and 'dropped out' are indistinguishable to the UI.**

`src/hooks/useScripturePresence.ts:54`

```ts
    isPartnerConnected: true,
```

**3. The presence channel reconnects on CHANNEL_ERROR only. `grep -c CLOSED src/hooks/useScripturePresence.ts` = 0 whereas the same grep on useScriptureBroadcast.ts = 2 — the session channel handles both CHANNEL_ERROR and CLOSED. A cleanly closed presence socket therefore never re-subscribes, and since setRetryCount here is unbounded (no equivalent of MAX_BROADCAST_RETRIES), a persistently failing presence channel loops re-subscribes forever.**

`src/hooks/useScripturePresence.ts:163`

```ts
          } else if (status === 'CHANNEL_ERROR') {
```

**4. The heartbeat interval is assigned without clearing any existing one, unlike the stale timer directly below it which is guarded by `if (staleTimerRef.current) clearTimeout(...)` at line 155. If the SUBSCRIBED callback fires a second time on the same channel (supabase-js rejoin), the previous interval is orphaned and keeps sending — and unmount cleanup can only clear the latest ref.**

`src/hooks/useScripturePresence.ts:150`

```ts
            intervalRef.current = setInterval(() => {
```

**5. retryCount only ever increments (lines 213 and 231) and is never reset when a re-subscribe succeeds — only hasErroredRef is cleared on SUBSCRIBED. After five cumulative CHANNEL_ERROR/CLOSED events across the component's whole lifetime, the session channel stops attempting reconnection permanently, and there is no user-visible signal that it has given up.**

`src/hooks/useScriptureBroadcast.ts:46`

```ts
const MAX_BROADCAST_RETRIES = 5;
```

**6. 'Keep Waiting' works by calling setPartnerDisconnected(TRUE) while already disconnected. That is not a no-op: the slice re-stamps the timestamp (scriptureReadingSlice.ts:970 `      set({ partnerDisconnected: true, partnerDisconnectedAt: Date.now() });`), which resets the overlay's 30s elapsed counter back to Phase A. Making setPartnerDisconnected(true) idempotent would silently break the Keep Waiting button.**

`src/components/scripture-reading/containers/ReadingContainer.tsx:130`

```ts
      setPartnerDisconnected(true);
```

**7. The effect keyed on disconnectedAt also tears down the End-Session confirmation dialog. Combined with the previous gotcha, tapping Keep Waiting while the confirm dialog is open both restarts the countdown and dismisses the confirmation — intentional, but it means the confirm state cannot survive any re-stamp of partnerDisconnectedAt.**

`src/components/scripture-reading/session/DisconnectionOverlay.tsx:41`

```ts
    setIsConfirmingEndSession(false);
```

**8. The reconnect resync (ReadingContainer.tsx:110 `        void loadSession(session.id);`) goes through getSession, which is cache-first: it returns the IndexedDB copy immediately and only fires a background refresh whose result reaches Zustand through the onRefresh callback wired in loadSession. So immediately after reconnecting, the returning partner can render the PRE-disconnect step index for one round trip before snapping to the canonical state.**

`src/services/scriptureReadingService.ts:222`

```ts
    const cached = await this.get(sessionId);
```

**9. An auth/setAuth failure on the SESSION channel marks the PARTNER as disconnected, even though the partner may be perfectly healthy and the presence channel still receiving heartbeats. This is the one place partnerDisconnected is set from outside the presence path, and the overlay it raises is indistinguishable from a real partner drop.**

`src/hooks/useScriptureBroadcast.ts:245`

```ts
        setPartnerDisconnected(true);
```

**10. useScripturePresence is mounted ONLY by ReadingContainer (verified: no other non-test file imports it except PartnerPosition, which imports the type only). There is no presence, no heartbeat and no disconnection detection during the lobby or countdown phases — a partner who closes the tab in the lobby leaves the other stuck on 'Waiting for X...' indefinitely with no overlay.**

`src/components/scripture-reading/containers/ReadingContainer.tsx:90`

```ts
  const partnerPresence = useScripturePresence(
```

---

# Cross-cutting infrastructure

_Systems no single tab owns. Change these and every feature above feels it._

## Admin Panel — Custom Message Management

Behind a /admin URL path the user gets a CRUD panel over their own custom love messages: create with category and tags, edit, toggle active/inactive, delete, and export/import the whole set as a JSON file with duplicate detection. Active custom messages join the default 365 in the daily rotation pool; inactive ones are filtered out of new selections. Everything is stored in the same IndexedDB 'messages' store as the seeds, distinguished by isCustom: true.

**Start here:** `src/services/customMessageService.ts:31`

```ts
class CustomMessageService extends BaseIndexedDBService<Message, MyLoveDBSchema, 'messages'> {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/services/customMessageService.ts` | 300 | IndexedDB CRUD over the 'messages' store with Zod validation at the boundary; getActiveCustomMessages, exportMessages, importMessages with duplicate detection. |
| `src/stores/slices/messagesSlice.ts` | 527 | loadCustomMessages / createCustomMessage / updateCustomMessage / deleteCustomMessage / getCustomMessages / exportCustomMessages / importCustomMessages — the store-level wrappers plus the browser download trigger. |
| `src/components/AdminPanel/AdminPanel.tsx` | 192 | The panel shell: tabs, filters, and export/import wiring. |
| `src/components/AdminPanel/CreateMessageForm.tsx` | 240 | New-message form calling createCustomMessage. |
| `src/components/AdminPanel/EditMessageForm.tsx` | 262 | Edit form calling updateCustomMessage (including the active toggle that gates rotation). |
| `src/components/AdminPanel/MessageList.tsx` | 157 | Filtered list of custom messages. |
| `src/components/AdminPanel/MessageRow.tsx` | 106 | Single row with edit/delete affordances. |
| `src/components/AdminPanel/DeleteConfirmDialog.tsx` | 97 | Delete confirmation modal calling deleteCustomMessage. |
| `src/services/dbSchema.ts` | 280 | 'messages' store definition (keyPath id, autoIncrement, by-category and by-date indexes) shared with the daily-message seeds. |
| `src/App.tsx` | 610 | Detects '/admin' in the pathname on mount and short-circuits into the lazy AdminPanel, bypassing the nav shell entirely. |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/messagesSlice.ts` | `customMessages`, `customMessagesLoaded`, `messages` | no — explicitly excluded from partialize (useAppStore.ts:133-135); rehydrated from IndexedDB via loadCustomMessages/loadMessages |

### Backend

| | |
|---|---|
| IndexedDB stores | `messages` |
| Realtime | none — purely local IndexedDB; custom messages never sync to Supabase, so each partner's custom messages are device-local |

### Tests

_None found for this feature._

### Watch out for

**1. The admin route short-circuits with an early return BEFORE the navigation listeners are registered, so entering /admin and leaving it via handleAdminExit (which only pushState's the path away) leaves the app without popstate routing until a reload.**

`src/App.tsx:147`

```ts
      return; // Don't set up navigation listeners for admin panel
```

**2. Custom messages share the 'messages' object store with the 365 seeds and are separated only by the isCustom flag — getAll({ isCustom: true }) filters in memory after a full db.getAll(), so every admin list render deserializes all 365+ rows.**

`src/services/customMessageService.ts:150`

```ts
        messages = messages.filter((m) => m.isCustom === filter.isCustom);
```

**3. The store calls these 'optimistic UI updates', but the await already resolved before set() runs — there is no rollback path anywhere in the slice because there is nothing to roll back. The real risk is the opposite: a failure in the subsequent loadMessages() leaves customMessages updated while the rotation pool in `messages` is stale.**

`src/stores/slices/messagesSlice.ts:367`

```ts
      // Update state (optimistic UI update)
```

**4. Deactivating a message removes it from the rotation pool, which changes the pool LENGTH, which changes hash % length for every date that is not already in the shownMessages cache — so toggling one message inactive silently reshuffles all future days' messages.**

`src/services/customMessageService.ts:111`

```ts
        ...(validated.active !== undefined && { active: validated.active }),
```

**5. Import dedupes on trimmed-lowercased text against existing CUSTOM messages only (getAll({ isCustom: true }) at line 255) — an imported message whose text duplicates one of the 365 seeds is inserted anyway and the pool then contains it twice.**

`src/services/customMessageService.ts:256`

```ts
      const existingTexts = new Set(existingMessages.map((m) => m.text.trim().toLowerCase()));
```

**6. getAll() swallows every failure and returns [] rather than throwing, so an IndexedDB outage renders as 'you have no custom messages' in the admin panel instead of an error — and loadCustomMessages still sets customMessagesLoaded: true.**

`src/services/customMessageService.ts:181`

```ts
      return []; // Graceful fallback: return empty array
```

**7. exportMessages is the only method that does NOT rethrow — it returns an empty export envelope on failure, so a failed export downloads a valid-looking JSON file containing zero messages.**

`src/services/customMessageService.ts:227`

```ts
        version: '1.0',
```

**8. The no-onExit fallback assigns to window.location.pathname, which triggers a full page reload and re-runs the whole auth/init boot sequence. Only the App-supplied onExit (src/App.tsx:490) does the soft history.pushState version, so any other mount site gets the hard reload.**

`src/components/AdminPanel/AdminPanel.tsx:35`

```ts
      window.location.pathname = window.location.pathname.replace('/admin', '');
```

**9. Import and export report their results through native blocking alert() calls (lines 45, 60-62, 65) rather than the SyncToast/error-banner patterns used elsewhere in the app. These block the event loop and are invisible to the app's error-boundary handling.**

`src/components/AdminPanel/AdminPanel.tsx:45`

```ts
      alert('Failed to export messages. Please try again.');
```

**10. The edit modal's React key embeds updatedAt, so saving a message remounts EditMessageForm with fresh internal form state instead of updating it in place. Removing this composite key would leave the form showing pre-save values.**

`src/components/AdminPanel/AdminPanel.tsx:168`

```ts
            key={`${editingMessage.id}-${editingMessage.updatedAt ?? editingMessage.createdAt}`}
```

**11. The mount effect fires loadCustomMessages() only when customMessagesLoaded is false, and that flag is set to true even on the failure path (src/stores/slices/messagesSlice.ts:346 sets customMessages: [], customMessagesLoaded: true). A failed load therefore renders an empty list permanently — re-opening the admin panel will not retry.**

`src/components/AdminPanel/AdminPanel.tsx:25`

```ts
    if (!customMessagesLoaded) {
```

---

## Haptic Feedback

Two parallel abstractions over the Vibration API give the app tactile confirmation. src/utils/haptics.ts exports fixed-pattern helpers used by MoodTracker (50ms on save, [100,50,100] on error); src/hooks/useVibration.ts is a React hook returning a raw vibrate(pattern) plus an isSupported flag, used by the love-notes message input. Both feature-detect navigator.vibrate and no-op silently everywhere it is missing (all of iOS Safari, and happy-dom in unit tests).

**Start here:** `src/hooks/useVibration.ts:64`

```ts
export function useVibration(): UseVibrationReturn {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/utils/haptics.ts` | 67 | Fixed-pattern helpers: triggerMoodSaveHaptic, triggerErrorHaptic, triggerSelectionHaptic, isVibrationSupported |
| `src/hooks/useVibration.ts` | 102 | React hook wrapper with memoized support detection and try/catch around navigator.vibrate |
| `src/components/MoodTracker/MoodTracker.tsx` | 568 | Consumer of the haptics.ts helpers on mood save success and failure |
| `src/components/love-notes/MessageInput.tsx` | 286 | Consumer of useVibration — vibrate(30) on select, vibrate(50) on send, vibrate([100,50,100]) on error |

### Backend

| | |
|---|---|
| Realtime | none |

### Tests

- `src/utils/__tests__/haptics.test.ts` — unit
- `src/components/love-notes/__tests__/MessageInput.test.tsx` — unit

### Watch out for

**1. Two competing abstractions for the same API with no shared source of truth for the patterns. haptics.ts hardcodes 15ms for selection while MessageInput passes 30ms through the hook for the same gesture — the 'standard patterns' documented in the useVibration header are convention only, nothing enforces them.**

`src/utils/haptics.ts:63`

```ts
export function triggerSelectionHaptic(): void {
```

**2. triggerSelectionHaptic has zero production callers — grepping src and tests for it, excluding its own definition file and its test file, returns 0 lines. It is exercised only by src/utils/__tests__/haptics.test.ts, so coverage numbers make it look live.**

`src/utils/__tests__/haptics.test.ts:117`

```ts
  describe('triggerSelectionHaptic', () => {
```

**3. Only the hook wraps navigator.vibrate in try/catch; the haptics.ts helpers call it bare after a support check. A browser that exposes vibrate but throws (some vibrate calls require a prior user gesture) will propagate the exception out of triggerMoodSaveHaptic into MoodTracker's save path.**

`src/utils/haptics.ts:34`

```ts
    navigator.vibrate(50); // 50ms pulse for success confirmation
```

**4. isSupported is memoized with an empty dep array, so support is resolved once at first render and never re-evaluated. Tests that stub navigator.vibrate after mount will see the stale value — the plain helpers in haptics.ts re-check every call instead.**

`src/hooks/useVibration.ts:75`

```ts
  }, []);
```

---

## Sign-In, Session Handling & Auth Gate

Users sign in with email/password or "Continue with Google" on a full-screen LoginScreen; there is no self-serve sign-up (the link only shows a "contact admin" message). Once a Supabase session exists, App.tsx renders the whole app; signing out from the bottom-nav logout button returns to the login screen. The session is mirrored into the Zustand authSlice (userId/userEmail/isAuthenticated) so every other slice can read the current user synchronously, and the access/refresh tokens are copied into an IndexedDB 'sw-auth' store so the service worker can sync moods while the app is closed.

**Start here:** `src/App.tsx:192`

```ts
  // Story 6.7: Check authentication status on mount
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/App.tsx` | 610 | Owns the auth gate: getSession() on mount, onAuthStateChange subscription, session/authLoading/isSigningOut local state, and the early returns that render LoginScreen vs the app |
| `src/components/LoginScreen/LoginScreen.tsx` | 300 | Email/password form + Google OAuth button, client-side email/password validation, Supabase error-message mapping |
| `src/components/LoginScreen/LoginScreen.css` | 366 | Styling for the login screen |
| `src/components/LoginScreen/index.ts` | 1 | Barrel re-exporting LoginScreen |
| `src/api/auth/actionService.ts` | 139 | Mutating auth calls: signIn, signUp, signOut, resetPassword, signInWithGoogle; writes/clears the SW auth token in IndexedDB |
| `src/api/auth/sessionService.ts` | 93 | Read-only auth calls: getSession, getUser, getCurrentUserId(+OfflineSafe), getAuthStatus, and the onAuthStateChange wrapper that persists tokens before invoking the app callback |
| `src/api/auth/types.ts` | 18 | AuthCredentials / AuthResult / AuthStatus interfaces |
| `src/api/authService.ts` | 32 | Facade object composing sessionService + actionService; only Settings.tsx and LoveNotes.tsx still consume it |
| `src/api/supabaseClient.ts` | 158 | Singleton Supabase client (persistSession, autoRefreshToken, detectSessionInUrl) plus getPartnerId() / getPartnerDisplayName() helpers that query the users table |
| `src/stores/slices/authSlice.ts` | 50 | Zustand slice holding userId/userEmail/isAuthenticated with setAuthUser/clearAuth; not persisted |
| `src/hooks/useAuth.ts` | 46 | Thin selector hook returning {user,isLoading,error} derived from the store |
| `src/stores/useAppStore.ts` | 287 | Composes authSlice into the store (line 70) and defines the localStorage partialize set that auth state is deliberately excluded from |
| `src/sw-db.ts` | 173 | storeAuthToken / getAuthToken / clearAuthToken against the IndexedDB 'sw-auth' object store used by Background Sync |
| `src/components/Navigation/BottomNavigation.tsx` | 119 | Renders the data-testid="nav-logout" button wired to App.handleSignOut via onSignOut/signOutDisabled props |
| `src/components/Settings/Settings.tsx` | 172 | Second (currently unreferenced) sign-out surface using the authService facade |
| `supabase/migrations/20251203000001_create_base_schema.sql` | 249 | Creates public.users (PK references auth.users) and the initial self/partner RLS policies |
| `supabase/migrations/20251206124803_fix_users_rls_policy.sql` | 25 | Replaces the read-all users SELECT policy with a self-or-partner scoped one |
| `supabase/migrations/20251206200000_fix_users_update_privilege_escalation.sql` | 41 | Blocks partner_id self-assignment in the users UPDATE policy (privilege-escalation fix) |
| `supabase/migrations/20260205000001_fix_users_rls_recursion.sql` | 57 | Adds SECURITY DEFINER get_my_partner_id() and rewrites both users policies to break 42P17 RLS recursion |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/authSlice.ts` | `userId`, `userEmail`, `isAuthenticated`, `setAuthUser`, `clearAuth` | no — partialize in src/stores/useAppStore.ts (lines 119-141) persists only settings, isOnboarded, messageHistory and moods; auth state is rebuilt from the Supabase session on every load |

### Backend

| | |
|---|---|
| Supabase tables | `users` |
| IndexedDB stores | `sw-auth` |
| Realtime | none directly — but supabase.realtime.setAuth() in src/hooks/useScriptureBroadcast.ts depends on a live session, and it deliberately re-fetches the user via supabase.auth.getUser() rather than trusting the store |

### Tests

- `src/api/auth/__tests__/authServices.test.ts` — unit
- `tests/e2e/auth/login.spec.ts` — e2e
- `tests/e2e/auth/logout.spec.ts` — e2e
- `tests/e2e/auth/google-oauth.spec.ts` — e2e
- `tests/support/auth/supabase-auth-provider.ts` — e2e
- `tests/support/fixtures/auth.ts` — e2e

### Watch out for

**1. The "single source of truth" claim holds for the Zustand slices (moodSlice, notesSlice, photosSlice, interactionsSlice, scriptureReadingSlice all read get().userId) but NOT for the service layer: photoService, partnerService, loveNoteImageService and moodSyncService still make their own async supabase.auth.getUser()/getSession() calls. Changing how identity is stored requires touching both paths.**

`src/stores/slices/authSlice.ts:5`

```ts
 * Populated by onAuthStateChange in App.tsx — readable synchronously via get().userId.
```

**2. Concrete example of the bypass above — supabase.auth.getUser() is a network round-trip to /auth/v1/user, so this fails offline whereas the store's userId would not. There are 6 such calls in photoService.ts alone (lines 163, 230, 290, 387, 446, 486).**

`src/services/photoService.ts:163`

```ts
      const { data: currentUser } = await supabase.auth.getUser();
```

**3. The wrapper swallows Supabase's `event` argument and forwards only the session. App.tsx therefore cannot distinguish INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED, and re-runs its full side-effect block (including the display-name check) on every one of them.**

`src/api/auth/sessionService.ts:60`

```ts
export const onAuthStateChange = (callback: (session: Session | null) => void): (() => void) => {
```

**4. Consequence of the dropped event type: any auth event with a session re-evaluates user_metadata.display_name. An account whose metadata lacks display_name gets pushed into the blocking setup modal on every token refresh, mid-session — not just at first sign-in. Note also that checkAuth() (the getSession() path, lines 196-221) never calls setNeedsDisplayName, so the two auth entry points do not agree.**

`src/App.tsx:237`

```ts
          setNeedsDisplayName(!hasDisplayName);
```

**5. The listener awaits an IndexedDB open/put/close cycle BEFORE calling the app's callback on every sign-in and every token refresh, so React auth state lags the Supabase event by an IDB round-trip. Failures are caught and logged only, meaning the service worker can silently hold a stale token while the UI looks signed in.**

`src/api/auth/sessionService.ts:64`

```ts
    if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
```

**6. hasInitialized is a useRef that is set true once and never reset. Sign-out followed by sign-in as a different user in the same tab will NOT re-run initializeApp(), so IndexedDB/store data loaded for the previous user is reused until a full page reload.**

`src/App.tsx:266`

```ts
    if (!hasInitialized.current && session) {
```

**7. The persisted localStorage blob ('my-love-storage') is device-scoped, not user-scoped, and clearAuth() only resets userId/userEmail/isAuthenticated. Nothing clears persisted moods/settings on sign-out, so a second user signing in on the same device inherits the first user's cached moods until the store is manually cleared.**

`src/stores/useAppStore.ts:132`

```ts
        moods: state.moods,
```

**8. Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY throws at module evaluation time, not on first use. Because nearly every service imports this module, an unset env var takes down the entire bundle with a blank page rather than a handled config error.**

`src/api/supabaseClient.ts:30`

```ts
  throw new Error(
```

**9. getPartnerId() collapses three different situations — not authenticated, no users row (PGRST116), and a genuine query error — into the same `null` return. Callers cannot tell "not partnered" from "lookup failed", which matters because partner-scoped RLS silently returns empty result sets rather than errors.**

`src/api/supabaseClient.ts:102`

```ts
        console.warn('[Supabase] User has no users table record yet');
```

**10. useAuth's isLoading is a hardcoded false and error a hardcoded null; the real auth-loading flag is App.tsx's local `authLoading` useState and is never exposed. Any component branching on useAuth().isLoading will treat "session not yet resolved" as "signed out".**

`src/hooks/useAuth.ts:43`

```ts
    isLoading: false,
```

**11. resetPassword() points at a /reset-password route that does not exist — App.tsx's route matcher (lines 151-163) only handles /photos, /mood, /partner, /notes, /scripture and falls through to 'home'. resetPassword and signUp are also not called from any component or hook; they are reachable only through the authService facade.**

`src/api/auth/actionService.ts:97`

```ts
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`,
```

**12. There is no self-serve registration path in the UI even though actionService.signUp() exists — the "Contact Admin" button just writes into the error banner. Accounts must be provisioned out-of-band (or via Google OAuth, which auto-creates the auth.users row).**

`src/components/LoginScreen/LoginScreen.tsx:288`

```ts
                  'Sign-up functionality coming soon. Please contact your administrator for account creation.'
```

**13. This is `useState`, not `useEffect` — the initializer fires the authService.getUser() promise during render rather than after commit. The component is also unreferenced: grepping src/ and tests/ for `components/Settings`, `{ Settings }` or `<Settings` returns no importer outside its own directory, so this second sign-out surface is dead code.**

`src/components/Settings/Settings.tsx:26`

```ts
  useState(() => {
```

**14. Documented exception to the store-as-source-of-truth rule: private Realtime channels need supabase.realtime.setAuth() plus a freshly validated token, so this hook must not use the cached store userId. Copying the store-based pattern here breaks private-channel subscription.**

`src/hooks/useScriptureBroadcast.ts:158`

```ts
        // Use supabase.auth.getUser() instead of get().userId because the Realtime
```

**15. OAuth completion depends on the client parsing the redirect URL on load. signInWithGoogle redirects to `${origin}${BASE_URL}` (actionService.ts:119), which under the GitHub Pages base path is /My-Love/ — changing the Vite base or the Supabase redirect allowlist silently breaks the OAuth return leg with no error surfaced in the UI.**

`src/api/supabaseClient.ts:62`

```ts
      detectSessionInUrl: true, // Enable OAuth callback detection
```

**16. The users SELECT/UPDATE policies previously referenced public.users inside their own USING/WITH CHECK clauses and raised Postgres 42P17 on every query. Any new policy on public.users must route partner lookups through this SECURITY DEFINER helper instead of an inline subquery, or the recursion returns.**

`supabase/migrations/20260205000001_fix_users_rls_recursion.sql:13`

```ts
CREATE OR REPLACE FUNCTION public.get_my_partner_id()
```

**17. RLS assumption every client write must respect: an UPDATE to public.users that includes partner_id is rejected unless the value is unchanged. partner_id can only be set by the SECURITY DEFINER accept_partner_request() function — sending it in a client upsert payload will fail the WITH CHECK.**

`supabase/migrations/20251206200000_fix_users_update_privilege_escalation.sql:33`

```ts
      (partner_id IS NOT DISTINCT FROM (SELECT partner_id FROM public.users WHERE id = auth.uid()))
```

---

## Display Name Onboarding

After a successful Google OAuth sign-up, users whose Supabase user_metadata has no display_name are shown a blocking full-screen modal asking "What would you like to be called?". Entering a 3-30 character name writes it to auth user_metadata via supabase.auth.updateUser and upserts a public.users row, after which the app renders normally. The modal replaces the entire app UI — it is not dismissible and there is no skip.

**Start here:** `src/App.tsx:443`

```ts
  if (needsDisplayName) {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/DisplayNameSetup/DisplayNameSetup.tsx` | 199 | The modal: 3-30 char validation, supabase.auth.updateUser({data:{display_name}}), then an idempotent users upsert; calls onComplete() on success |
| `src/components/DisplayNameSetup/DisplayNameSetup.css` | 220 | Overlay/modal styling |
| `src/components/DisplayNameSetup/index.ts` | 1 | Barrel re-exporting DisplayNameSetup |
| `src/App.tsx` | 610 | Decides when the modal shows (needsDisplayName state set from user_metadata inside the onAuthStateChange callback) and re-fetches the session in onComplete |
| `src/api/auth/sessionService.ts` | 93 | getUser() used by the modal to obtain the user id before upserting |
| `supabase/migrations/20251206024345_remote_schema.sql` | 371 | Defines sync_user_profile() and the on_auth_user_created trigger that actually propagates display_name from auth.users into public.users |

### Backend

| | |
|---|---|
| Supabase tables | `users` |
| Realtime | none |

### Tests

- `tests/e2e/auth/display-name-setup.spec.ts` — e2e

### Watch out for

**1. This upsert sends only { id, updated_at } — it never writes display_name to public.users. The name reaches the table purely as a side effect of the auth.users UPDATE performed by supabase.auth.updateUser() a few lines earlier.**

`src/components/DisplayNameSetup/DisplayNameSetup.tsx:74`

```ts
      const { error: upsertError } = await supabase.from('users').upsert(
```

**2. The real writer of public.users.display_name. It fires on UPDATE as well as INSERT, and its ON CONFLICT branch overwrites display_name with COALESCE(raw_user_meta_data->>'display_name', email, 'Unknown') (line 164) — so any auth.users update whose metadata lacks display_name will silently reset the profile name to the email address.**

`supabase/migrations/20251206024345_remote_schema.sql:369`

```ts
CREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();
```

**3. An RLS/permission failure on the users upsert is logged and swallowed, and onComplete() still runs. The user proceeds into the app believing setup succeeded even if the profile row was never touched.**

`src/components/DisplayNameSetup/DisplayNameSetup.tsx:87`

```ts
        // Don't throw - this is not critical, user_metadata update is what matters
```

**4. onComplete clears needsDisplayName first and then refreshes the session asynchronously. supabase.auth.updateUser also emits its own auth event, so the onAuthStateChange callback re-runs setNeedsDisplayName from the (now updated) metadata — two independent paths race to settle the same flag, and neither awaits the other.**

`src/App.tsx:451`

```ts
            getSession().then((refreshedSession) => {
```

**5. Validation is trim-aware (3-30 chars after trimming) but the input's own minLength={3}/maxLength={30} attributes count untrimmed characters, so browser-native constraint validation and the JS check disagree on whitespace-padded input.**

`src/components/DisplayNameSetup/DisplayNameSetup.tsx:48`

```ts
    if (!validateDisplayName(displayName.trim())) {
```

**6. Both P0 specs for this flow are unconditionally skipped — the header comment (lines 7-13) explains that network interception cannot fake it because the Supabase client owns auth state, and a test user without display_name has never been provisioned. This feature has zero executing test coverage.**

`tests/e2e/auth/display-name-setup.spec.ts:22`

```ts
    test.skip();
```

---

## App Shell, View Routing & Error Boundaries

The single-page shell that decides what the user sees: an auth gate (loading → LoginScreen → DisplayNameSetup → app), a 60-minute welcome splash gate, an /admin escape hatch, and then a six-tab app driven by a bottom navigation bar. Tapping a tab switches the rendered view and pushes a matching URL (/, /photos, /mood, /partner, /notes, /scripture); deep links and browser back/forward work via a popstate listener. Home is rendered inline (works offline); every other view is React.lazy + Suspense and wrapped in a ViewErrorBoundary so a failed chunk shows an inline 'Can't load this page offline' card while the nav bar stays usable. The shell also owns the offline banner, the sync-completion toast, and the periodic mood-sync timer.

**Start here:** `src/App.tsx:68`

```ts
function App() {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/App.tsx` | 610 | Root shell: auth gating, splash gating, admin gating, initial route detection, popstate listener, view switch, theme effect, network/sync effects |
| `src/main.tsx` | 47 | React root: PWA service-worker register (prod) / unregister-all (dev), StrictMode + LazyMotion wrappers |
| `src/components/Navigation/BottomNavigation.tsx` | 119 | Fixed bottom tab bar: Home/Mood/Notes/Partner/Photos/Scripture buttons plus a Logout button |
| `src/stores/slices/navigationSlice.ts` | 85 | currentView state, setView (with history pushState), and per-view convenience navigate* actions |
| `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx` | 152 | Per-view error boundary: inline fallback, offline/chunk-error detection, auto-reset on viewName change, console logging tagged with the view |
| `src/components/ViewErrorBoundary/index.ts` | 1 | Barrel re-export of ViewErrorBoundary |
| `src/components/ErrorBoundary/ErrorBoundary.tsx` | 94 | Full-screen error boundary with validation-error detection and a 'Clear Storage & Reload' button |
| `src/components/shared/NetworkStatusIndicator.tsx` | 151 | Offline/connecting banner rendered at the top of the authenticated shell |
| `src/components/shared/SyncToast.tsx` | 149 | Toast shown after a service-worker background sync reports success/fail counts |
| `src/components/shared/index.ts` | 12 | Barrel for the shared shell widgets |
| `src/config/relationshipDates.ts` | 124 | Static dates the inline home view renders (birthdays, wedding, visits) |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/navigationSlice.ts` | `currentView` | no — restored from the URL on mount (see file header comment) |
| `src/stores/slices/appSlice.ts` | `isLoading`, `error`, `__isHydrated` | no — runtime only |
| `src/stores/slices/moodSlice.ts` | `syncStatus` | no — App reads syncStatus.isOnline and calls updateSyncStatus/syncPendingMoods |

### Backend

| | |
|---|---|
| Realtime | none — grep for '.from(' and '.rpc(' in src/App.tsx, navigationSlice.ts and appSlice.ts returns no matches |

### Tests

- `tests/e2e/navigation/routing.spec.ts` — e2e
- `tests/e2e/home/routing.spec.ts` — e2e
- `tests/e2e/home/error-boundary.spec.ts` — e2e
- `tests/e2e/home/welcome-splash.spec.ts` — e2e
- `src/components/Navigation/__tests__/BottomNavigation.test.tsx` — unit

### Watch out for

**1. If the initial pathname contains '/admin', the routing effect returns BEFORE window.addEventListener('popstate', ...) runs. The effect's dep array is [setView] (src/App.tsx:190), so it never re-runs when showAdmin flips to false. Result: after clicking 'Exit Admin' the browser back/forward buttons no longer change the view for the rest of the session — the URL changes but currentView is frozen.**

`src/App.tsx:147`

```ts
      return; // Don't set up navigation listeners for admin panel
```

**2. Admin detection is substring-based and mount-only. Any path containing '/admin' (e.g. /My-Love/admin, /administration) opens the admin panel, and because setView(initialView, true) is skipped in that branch, currentView stays at its default 'home' regardless of URL.**

`src/App.tsx:145`

```ts
    if (window.location.pathname.includes('/admin')) {
```

**3. setView pushes a history entry unconditionally — there is no `if (get().currentView === view) return` guard. Tapping the same tab N times stacks N identical history entries, so the user must press Back N times before the view actually changes. Callers that want silent navigation must pass skipHistory=true themselves.**

`src/stores/slices/navigationSlice.ts:56`

```ts
      window.history.pushState({ view }, '', fullPath);
```

**4. ViewErrorBoundary only wraps the currentView !== 'home' branch. The authenticated shell's main return (src/App.tsx:516) is NOT inside an <ErrorBoundary> — the four <ErrorBoundary> usages are only around LoginScreen (430), DisplayNameSetup (445), WelcomeSplash (496) and AdminPanel (507). A render throw in the inline home view, BottomNavigation, PhotoUpload or PhotoCarousel unmounts the whole tree to a blank page.**

`src/App.tsx:568`

```ts
          <ViewErrorBoundary viewName={currentView} onNavigateHome={() => setView('home')}>
```

**5. App subscribes to the ENTIRE store with no selector or shallow comparator, so every set() in any of the 11 slices (mood sync ticks, realtime note inserts, presence updates) re-renders App and its whole child tree. Only 5 of 21 useAppStore call sites in src use a selector.**

`src/App.tsx:78`

```ts
  } = useAppStore();
```

**6. 'safe-area-bottom' is not defined anywhere — grep across src/, tailwind.config.js and index.html finds this single occurrence. src/index.css defines '.safe-bottom' (line 137) and '.safe-top' (line 133) instead, so the nav bar gets no env(safe-area-inset-bottom) padding on notched iOS devices.**

`src/components/Navigation/BottomNavigation.tsx:19`

```ts
      className="safe-area-bottom fixed right-0 bottom-0 left-0 z-40 border-t border-gray-200 bg-white"
```

**7. syncStatus.isOnline is in the dep array of the effect that owns the 5-minute setInterval, so every online/offline flip tears down and recreates the interval AND re-fires the immediate 'Part 1' sync at the top of the effect. Flapping connectivity therefore triggers repeated syncPendingMoods() calls, not one every 5 minutes.**

`src/App.tsx:375`

```ts
  }, [syncPendingMoods, syncStatus.isOnline, session]);
```

**8. The service worker is only registered in production; in dev the else-branch actively unregisters every existing registration. Anything routed through the SW — background sync, the BACKGROUND_SYNC_COMPLETED message that drives SyncToast (src/App.tsx:389) — is dead code during `npm run dev` and in unit tests.**

`src/main.tsx:13`

```ts
if (import.meta.env.PROD) {
```

**9. This spec does not test any error boundary. Diffing it against tests/e2e/home/routing.spec.ts shows the two files are identical except for this describe title — both just assert the bottom nav stays visible. No E2E or unit test anywhere exercises ErrorBoundary or ViewErrorBoundary's fallback UI (grep -rl 'ErrorBoundary' over test files matches only ScriptureOverview.test.tsx).**

`tests/e2e/home/error-boundary.spec.ts:10`

```ts
test.describe('Error Boundary', () => {
```

**10. The localStorage→IndexedDB custom-message migration is deliberately deferred off the first paint via requestIdleCallback (setTimeout(...,100) fallback). It runs after initializeApp() has already populated the store, so a component that reads customMessages immediately after mount can observe pre-migration data.**

`src/App.tsx:299`

```ts
        requestIdleCallback(() => runMigration(), { timeout: 2000 });
```

---

## Global Zustand Store Composition & LocalStorage Persistence

One Zustand store built by spreading 11 slice creators inside a persist() wrapper, typed through a single AppState interface. Only a hand-picked subset (settings, isOnboarded, messageHistory, moods) is written to LocalStorage under 'my-love-storage'; bulk data lives in IndexedDB. The persistence layer is defensive to the point of being destructive: a custom storage adapter validates the JSON before Zustand ever sees it and deletes the key on failure, and onRehydrateStorage re-hydrates the messageHistory Map from its serialized array form and stamps a __isHydrated flag that app initialization refuses to proceed without.

**Start here:** `src/stores/useAppStore.ts:64`

```ts
export const useAppStore = create<AppState>()(
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/stores/useAppStore.ts` | 287 | Store creation, slice composition order, pre-hydration validator, custom storage adapter, partialize, onRehydrateStorage, window.__APP_STORE__ test hook |
| `src/stores/types.ts` | 67 | AppSlice interface (defined here to break a circular import), AppMiddleware tuple, composed AppState, AppStateCreator helper |
| `src/stores/slices/appSlice.ts` | 28 | Core runtime state: isLoading, error, __isHydrated and their setters |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/appSlice.ts` | `isLoading`, `error`, `__isHydrated` | no |
| `src/stores/useAppStore.ts` | `settings`, `isOnboarded`, `messageHistory`, `moods` | yes — these four are the entire partialize output |

### Backend

| | |
|---|---|
| Realtime | none |

### Tests

- `tests/unit/stores/settingsSlice.initializeApp.test.ts` — unit

### Watch out for

**1. The custom storage adapter's getItem is destructive: a read that fails validateHydratedState (or JSON.parse) DELETES the persisted key before returning null. A single bad write silently wipes the user's saved settings, mood cache and message history — there is no quarantine copy and no way to inspect what was lost.**

`src/stores/useAppStore.ts:102`

```ts
              localStorage.removeItem(name);
```

**2. version is pinned at 0 and no `migrate` function is supplied. Any future change to the persisted shape will rehydrate old objects as-is; the only safety net is validateHydratedState, which merely checks that themeName and relationship are truthy (src/stores/useAppStore.ts:31-32) and treats every missing field as 'OK - they'll use defaults' (line 56).**

`src/stores/useAppStore.ts:84`

```ts
      version: 0, // State schema version (matches test fixtures)
```

**3. initializeApp treats __isHydrated === false as fatal: it sets an error, calls localStorage.removeItem('my-love-storage') (line 107) and returns without touching IndexedDB. Because __isHydrated is only ever set by direct property assignment inside onRehydrateStorage (src/stores/useAppStore.ts:270), any test or environment that constructs the slice outside the persist wrapper must stub __isHydrated: true or app init silently no-ops.**

`src/stores/slices/settingsSlice.ts:96`

```ts
      const isHydrated = get().__isHydrated;
```

**4. Set by mutating the raw state object, not via the setHydrated action — the surrounding comment explains that actions do not exist on the object handed to onRehydrateStorage. Anything that recreates the store without going through persist's rehydrate path leaves __isHydrated at its appSlice default of false.**

`src/stores/useAppStore.ts:270`

```ts
          state.__isHydrated = true;
```

**5. partialize always emits a messageHistory object even when state.messageHistory is undefined — spreading undefined yields {} and shownMessages falls back to []. The persisted blob then has a truthy messageHistory with no currentIndex/maxHistoryDays/favoriteIds, so onRehydrateStorage's 'messageHistory is null - creating default structure' branch (line 216) never fires and the missing fields stay missing.**

`src/stores/useAppStore.ts:125`

```ts
        messageHistory: {
```

**6. The whole moods array is mirrored into LocalStorage despite the comment two lines above claiming only 'small, critical state' is persisted (line 120). Mood history grows without bound and shares the ~5 MB LocalStorage budget with settings and message history.**

`src/stores/useAppStore.ts:132`

```ts
        moods: state.moods,
```

**7. The full store is attached to window.__APP_STORE__ in every mode except 'production'. Any preview/staging build that does not set MODE=production ships a live, writable handle to the entire application state.**

`src/stores/useAppStore.ts:285`

```ts
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'production') {
```

**8. This tuple is hand-maintained and must mirror the actual middleware stack in useAppStore.ts. Adding devtools or immer without editing this line makes every slice's set/get signature silently wrong at the type level.**

`src/stores/types.ts:44`

```ts
type AppMiddleware = [['zustand/persist', unknown]];
```

**9. Slice spread order is load-bearing: later spreads overwrite earlier keys of the same name. AppSlice and AuthSlice are deliberately first so the rest can call get().setLoading/get().setError without existence guards.**

`src/stores/useAppStore.ts:67`

```ts
      // AppSlice FIRST - owns core state (isLoading, error, __isHydrated)
```

---

## Theming

Four hand-authored themes (Sunset Romance, Ocean Breeze, Lavender Dreams, Rose Garden) that each define five colours plus a background and card gradient. Applying a theme writes seven CSS custom properties onto <html> and sets an inline gradient on <body>. The active theme name lives in settings.themeName, is persisted to LocalStorage, and is re-applied by an effect in App whenever settings changes.

**Start here:** `src/utils/themes.ts:70`

```ts
export function applyTheme(themeName: ThemeName): void {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/utils/themes.ts` | 85 | Theme table and applyTheme(): sets --color-* / --gradient-* custom properties and the body background |
| `src/stores/slices/settingsSlice.ts` | 258 | Owns settings.themeName and the setTheme action |
| `src/index.css` | 181 | Tailwind v4 entry: base body gradient, .card/.btn-*/.input component classes, .bg-sunset/.bg-ocean/.bg-lavender/.bg-rose utilities, keyframes |
| `src/App.tsx` | 610 | Effect that calls applyTheme(settings.themeName) when settings changes |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/settingsSlice.ts` | `settings.themeName` | yes — settings is in partialize |

### Backend

| | |
|---|---|
| Realtime | none |

### Tests

_None found for this feature._

### Watch out for

**1. applyTheme writes an inline style on <body>, which beats the Tailwind base rule at src/index.css:15 ('@apply min-h-screen bg-linear-to-br from-pink-50 via-rose-50 to-pink-100 font-sans'). That pink gradient is only ever visible for the frames before the first applyTheme call — editing it has no lasting effect.**

`src/utils/themes.ts:84`

```ts
  document.body.style.background = theme.gradients.background;
```

**2. Unvalidated table lookup. Rehydration bypasses SettingsSchema (only setSettings/updateSettings parse), and the pre-hydration validator merely checks that themeName is truthy (src/stores/useAppStore.ts:31), so a persisted themeName outside the four keys returns undefined and applyTheme throws on theme.colors.primary at line 75.**

`src/utils/themes.ts:67`

```ts
  return themes[themeName];
```

**3. setTheme writes settings directly with no SettingsSchema.parse, unlike setSettings (line 168) and updateSettings (line 189) which both validate and throw a friendly ValidationError. Theme changes are the one settings mutation path with no schema gate.**

`src/stores/slices/settingsSlice.ts:244`

```ts
  setTheme: (theme) => {
```

**4. The theme effect depends on the whole settings object, not settings.themeName, so any unrelated settings mutation (adding an anniversary, changing notification time) re-runs applyTheme and rewrites all seven CSS variables. It also runs post-mount, so the app paints with the index.css pink gradient first and then swaps — a visible flash on non-sunset themes.**

`src/App.tsx:312`

```ts
  }, [settings]);
```

**5. Fonts are pulled from a remote Google Fonts stylesheet at CSS parse time. This is a blocking third-party request that the service worker cannot precache, so an offline cold start renders in fallback system fonts.**

`src/index.css:1`

```ts
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
```

---

## Reduced-Motion Configuration

A single hook wraps Framer Motion's useReducedMotion and returns named transition presets (crossfade, slide, spring, fadeIn, modeReveal) that collapse to { duration: 0 } when the user prefers reduced motion. Components consume the preset instead of writing transition objects inline.

**Start here:** `src/hooks/useMotionConfig.ts:10`

```ts
export function useMotionConfig() {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/hooks/useMotionConfig.ts` | 23 | Wraps useReducedMotion and exposes five named transition presets plus a shouldReduceMotion boolean |
| `src/main.tsx` | 47 | Wraps the app in <LazyMotion features={domAnimation}> so `m` components can load animation features lazily |

### Backend

| | |
|---|---|
| Realtime | none |

### Tests

- `src/hooks/__tests__/useMotionConfig.test.ts` — unit

### Watch out for

**1. Adoption is partial: grep for 'useMotionConfig' across src finds production imports only in src/components/scripture-reading/containers/ReadingContainer.tsx (line 23). Every other animated surface — SyncToast, AdminPanel, love-notes, PhotoViewer — hardcodes its transitions, and grep for 'prefers-reduced-motion' across src returns zero matches, so there is no CSS-level fallback either.**

`src/hooks/useMotionConfig.ts:11`

```ts
  const shouldReduceMotion = useReducedMotion();
```

**2. The LazyMotion wrapper only pays off for components that import `m`. The codebase mixes both styles — src/components/shared/SyncToast.tsx:10 and src/components/AdminPanel/AdminPanel.tsx:1 use `m as motion`, while src/components/love-notes/LoveNotes.tsx:19 and src/components/PhotoGallery/PhotoViewer.tsx:2 import the full `motion` — so the full feature bundle is pulled in anyway. Several scripture containers also nest their own <LazyMotion> inside this one (e.g. src/components/scripture-reading/containers/SoloReadingFlow.tsx:13).**

`src/main.tsx:43`

```ts
    <LazyMotion features={domAnimation}>
```

---

## Settings Screen & Anniversary Management

A Settings screen showing the signed-in email, a Sign Out button, an Anniversary CRUD section, and an About block. Anniversaries are add/edit/delete-able through a validated form and are stored inside settings.relationship.anniversaries, which the home view's countdown widgets read. Note that the Settings screen itself has no route or nav entry in the current build — only the store actions behind it are reachable.

**Start here:** `src/components/Settings/Settings.tsx:20`

```ts
export const Settings: React.FC = () => {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/components/Settings/Settings.tsx` | 172 | Settings shell: account/email display, sign-out with spinner + error banner, mounts AnniversarySettings, About block |
| `src/components/Settings/AnniversarySettings.tsx` | 399 | Anniversary list plus add/edit/delete UI with field-level validation errors |
| `src/components/Settings/Settings.css` | 255 | Hand-written CSS for the settings screen (the only component in this area not styled with Tailwind utilities) |
| `src/stores/slices/settingsSlice.ts` | 258 | settings/isOnboarded state, initializeApp, schema-validated setSettings/updateSettings, addAnniversary/removeAnniversary, setTheme |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/settingsSlice.ts` | `settings`, `isOnboarded` | yes — both are in partialize |

### Backend

| | |
|---|---|
| IndexedDB stores | `messages` |
| Realtime | none |

### Tests

- `tests/unit/stores/settingsSlice.initializeApp.test.ts` — unit

### Watch out for

**1. The Settings screen is unreachable. grep -rn 'AnniversarySettings|components/Settings' over src and tests returns only this import, the component's own definition, and its single JSX usage at Settings.tsx:154 — nothing outside src/components/Settings/ imports Settings, there is no 'settings' entry in ViewType (src/stores/slices/navigationSlice.ts:18), and BottomNavigation has no settings tab. Anniversaries can only be changed programmatically.**

`src/components/Settings/Settings.tsx:17`

```ts
import { AnniversarySettings } from './AnniversarySettings';
```

**2. useState is being abused as a mount effect — the initializer fires an async authService.getUser() during render and the returned state is discarded. React invokes state initializers twice under StrictMode in development, so this issues two getUser() calls; a real useEffect would not.**

`src/components/Settings/Settings.tsx:26`

```ts
  useState(() => {
```

**3. Anniversary ids are derived from the current max, so deleting the highest-id entry and adding a new one reuses the freed id. Anything keyed on anniversary id across a delete/add cycle (React keys, the editingId/deleteConfirmId state in AnniversarySettings.tsx:23-24) can bind to the wrong record.**

`src/stores/slices/settingsSlice.ts:213`

```ts
      const newId = Math.max(0, ...settings.relationship.anniversaries.map((a) => a.id)) + 1;
```

**4. isInitializing/isInitialized are MODULE-level `let`s (lines 49-50), not store state. Once initializeApp succeeds, isInitialized stays true for the lifetime of the JS module, so signing out and signing in as a different user never re-runs initialization — App.tsx guards with a useRef too (src/App.tsx:266). Unit tests must vi.resetModules() between cases (tests/unit/stores/settingsSlice.initializeApp.test.ts:33) or the second test silently short-circuits.**

`src/stores/slices/settingsSlice.ts:258`

```ts
export { isInitialized, isInitializing };
```

**5. Seeding the default message set is a two-round-trip operation: addMessages() is followed by a second getAllMessages() (line 138) purely to pick up the IndexedDB autoIncrement ids, because the objects passed in deliberately omit an explicit id.**

`src/stores/slices/settingsSlice.ts:126`

```ts
      if (storedMessages.length === 0) {
```

---

## Offline Mood Queue & Background Sync

A mood logged while offline is written straight to IndexedDB with `synced: false`, the app shows an offline banner plus an inline "Changes will sync when reconnected" notice, and a Background Sync tag (`sync-pending-moods`) is registered. When connectivity returns the service worker wakes up — even with the app closed — reads the pending moods and the stored Supabase access token out of IndexedDB, POSTs them to the Supabase REST endpoint, marks them synced, and messages any open tab so a sync-result toast appears. While the app is open there are two additional sync paths: an immediate sync on mood create/update and a 5-minute interval, plus one on the browser `online` event.

**Start here:** `src/sw.ts:111`

```ts
self.addEventListener('sync', ((event: SyncEvent) => {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/sw.ts` | 261 | Service worker: 'sync' event handler, transforms local moods and POSTs them to Supabase REST, notifies clients |
| `src/sw-db.ts` | 173 | SW-context IndexedDB helpers — getPendingMoods, markMoodSynced, storeAuthToken, getAuthToken, clearAuthToken |
| `src/utils/backgroundSync.ts` | 121 | Window-side helpers: registerBackgroundSync(tag), setupServiceWorkerListener, support probes |
| `src/hooks/useNetworkStatus.ts` | 114 | React hook returning {isOnline, isConnecting} from navigator.onLine + online/offline events with a 1.5s debounce |
| `src/utils/offlineErrorHandler.ts` | 213 | OfflineError class, isOnline/isOffline probes, offline message constants, withOfflineCheck/safeOfflineOperation wrappers |
| `src/components/shared/NetworkStatusIndicator.tsx` | 151 | Offline/connecting/online banner driven by useNetworkStatus |
| `src/components/shared/SyncToast.tsx` | 149 | Toast showing successCount/failCount after a background sync completes |
| `src/components/MoodTracker/MoodTracker.tsx` | 568 | Calls registerBackgroundSync('sync-pending-moods') and shows OFFLINE_ERROR_MESSAGE when the save happened offline |
| `src/App.tsx` | 610 | Wires online/offline auto-sync, immediate-on-mount sync, 5-minute periodic sync, and the SW BACKGROUND_SYNC_COMPLETED message listener |
| `src/stores/slices/moodSlice.ts` | 346 | addMoodEntry/updateMoodEntry optimistic state, updateSyncStatus, syncPendingMoods action |
| `src/api/moodSyncService.ts` | 451 | In-app sync path: getUnsyncedMoods → insert via moodApi → markAsSynced, with 3-retry exponential backoff and partner broadcast |
| `src/services/moodService.ts` | 256 | IndexedDB CRUD for moods incl. getUnsyncedMoods() and markAsSynced() |
| `src/api/auth/sessionService.ts` | 93 | onAuthStateChange writes the SW auth token on SIGNED_IN/TOKEN_REFRESHED and clears it on SIGNED_OUT |
| `src/api/auth/actionService.ts` | 139 | storeAuthToken after sign-in, clearAuthToken after sign-out |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/slices/moodSlice.ts` | `moods`, `partnerMoods`, `syncStatus` | partial — only `moods` is in the persist partializer (src/stores/useAppStore.ts:132); syncStatus and partnerMoods are runtime-only |

### Backend

| | |
|---|---|
| Supabase tables | `moods` |
| IndexedDB stores | `moods`, `sw-auth` |
| Realtime | The service-worker path uses none (plain REST fetch). The in-app path fire-and-forget broadcasts to channel `mood-updates:${partnerId}` in src/api/moodSyncService.ts:124. |

### Tests

- `src/utils/__tests__/backgroundSync.test.ts` — unit
- `src/hooks/__tests__/useNetworkStatus.test.ts` — unit
- `tests/unit/utils/offlineErrorHandler.test.ts` — unit
- `tests/unit/services/moodService.test.ts` — unit
- `tests/e2e/offline/network-status.spec.ts` — e2e

### Watch out for

**1. The SW only re-throws (which is what makes the browser retry the sync) when EVERY mood failed. A partial failure (1 of 3 synced) resolves the sync event successfully, so the Background Sync API considers the tag done and the 2 failures sit in IndexedDB until something else triggers a sync — app reopen, the `online` event, or the 5-minute interval.**

`src/sw.ts:249`

```ts
    if (successCount === 0 && failCount > 0) {
```

**2. If the stored token is within 5 minutes of expiry the SW returns without throwing, so no retry is scheduled. Same for a missing token at line 167. Background sync therefore silently no-ops after the user has been away long enough for the token to age out — the queue only drains when the app is opened and Supabase fires TOKEN_REFRESHED, which rewrites the token via src/api/auth/sessionService.ts:64.**

`src/sw.ts:174`

```ts
    if (authToken.expiresAt && authToken.expiresAt < now + 300) {
```

**3. This is a plain INSERT (no upsert / on-conflict), and the in-app path also inserts (src/api/moodApi.ts:78). Both select work by the same `!mood.synced` predicate (src/sw-db.ts:87 and moodService.getUnsyncedMoods), and there is no unique constraint on moods beyond the primary key in supabase/migrations. If the SW sync and an in-app sync overlap, the same local mood can be written to Supabase twice; there is no conflict resolution anywhere in the path.**

`src/sw.ts:195`

```ts
        const response = await fetch(`${SUPABASE_URL}/rest/v1/moods`, {
```

**4. Editing today's mood flips it back to unsynced but does NOT clear `supabaseId`, and the sync path always INSERTs. So a mood edit creates a second Supabase row and moodSyncService.markAsSynced (src/api/moodSyncService.ts:223) overwrites the local supabaseId with the new row's id — the original row is orphaned server-side. Edit N times, get N+1 rows.**

`src/services/moodService.ts:133`

```ts
        synced: false, // Mark as unsynced after update
```

**5. The in-app sync path assumes `timestamp` is a real Date. The SW path defends against a string (src/sw.ts:135 `mood.timestamp instanceof Date`). That asymmetry matters because `moods` is also persisted to localStorage (src/stores/useAppStore.ts:132) with no Date revival in onRehydrateStorage, so rehydrated store moods carry ISO strings; only moods read back out of IndexedDB (structured clone) still have Date objects.**

`src/api/moodSyncService.ts:89`

```ts
      created_at: mood.timestamp.toISOString(),
```

**6. useNetworkStatus deliberately holds isOnline=false for CONNECTING_DEBOUNCE_MS (1500ms) after the browser fires `online`. App.tsx registers its OWN window 'online' handler (src/App.tsx:316) that fires immediately and does not use this hook, so during that 1.5s window the sync engine already thinks it is online while the banner still says Connecting. Two different notions of online coexist.**

`src/hooks/useNetworkStatus.ts:71`

```ts
    connectingTimeoutRef.current = setTimeout(() => {
```

**7. `isOnline` is in the effect's dependency array, so every status flip tears down and re-adds the window online/offline listeners and re-runs the mount-time navigator.onLine reconciliation. Adding side effects to this effect will make them run on every network transition, not once.**

`src/hooks/useNetworkStatus.ts:111`

```ts
  }, [handleOnline, handleOffline, clearConnectingTimeout, isOnline]);
```

**8. The 'hybrid sync' effect depends on syncStatus.isOnline and session, so the 'Part 1: immediate sync on mount' block re-executes and the 5-minute setInterval is cleared and restarted on every online/offline flip or session object change — the interval rarely actually reaches 5 minutes in a flaky-network session.**

`src/App.tsx:375`

```ts
  }, [syncPendingMoods, syncStatus.isOnline, session]);
```

**9. Stale header comment. Mood writes ARE queued: moodService.create writes to IndexedDB with synced:false and MoodTracker registers a background sync tag (src/components/MoodTracker/MoodTracker.tsx:211). Also, of this module's exports only `isOffline` and `OFFLINE_ERROR_MESSAGE` have production callers (both in MoodTracker.tsx); OfflineError, withOfflineCheck, safeOfflineOperation and createOfflineErrorHandler are referenced solely by tests/unit/utils/offlineErrorHandler.test.ts.**

`src/utils/offlineErrorHandler.ts:12`

```ts
 * - No offline queue for writes - fail immediately with retry option
```

**10. App.tsx imports only the support probe and then hand-rolls its own BACKGROUND_SYNC_COMPLETED listener inline (App.tsx:388-407) because it needs successCount/failCount for the toast. backgroundSync.setupServiceWorkerListener has no production caller at all — editing it changes nothing in the app, only the tests in src/utils/__tests__/backgroundSync.test.ts.**

`src/App.tsx:19`

```ts
import { isServiceWorkerSupported } from './utils/backgroundSync';
```

**11. Every exported helper opens its own connection and closes it in `finally`. Inside the SW sync loop that means one full openDB/close cycle per mood (markMoodSynced is called per iteration at src/sw.ts:227), on top of separate opens for getPendingMoods and getAuthToken. There is no shared handle and no transaction spanning read-then-write, so the read-modify-write in markMoodSynced is not atomic against a concurrent write from the app tab.**

`src/sw-db.ts:119`

```ts
    db.close();
```

---

## PWA Install & Offline App Shell (Service Worker caching)

The app installs as a standalone PWA (manifest name "My Love - Daily Reminders", pink theme, portrait) and keeps working with no network. Vite-plugin-pwa runs in injectManifest mode, so src/sw.ts is the real service worker: it precaches JS/CSS/images/fonts, serves navigations NetworkFirst with a 3-second timeout, and serves images/fonts and Google Fonts CacheFirst with expiration. New deploys auto-activate and reload the page without prompting.

**Start here:** `vite.config.ts:35`

```ts
    VitePWA({
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `vite.config.ts` | 102 | VitePWA config: strategies injectManifest, srcDir/filename pointing at src/sw.ts, precache glob patterns, web app manifest |
| `src/sw.ts` | 261 | The service worker itself: precacheAndRoute, cleanupOutdatedCaches, NavigationRoute+NetworkFirst, CacheFirst for static assets and Google Fonts |
| `src/sw-types.d.ts` | 82 | Ambient types for the SW global scope, SyncEvent, SyncManager and workbox-precaching |
| `src/main.tsx` | 47 | Registers the SW via virtual:pwa-register in PROD only; unregisters all SWs in dev |

### Backend

| | |
|---|---|
| Realtime | none |

### Tests

_None found for this feature._

### Watch out for

**1. Misleading comment: index.html is explicitly excluded from the precache (vite.config.ts:48 globIgnores '**/*.html'). The offline fallback actually comes from the NetworkFirst runtime cache named 'navigation-cache' (src/sw.ts:63-66), which is only populated after at least one successful online navigation. A user whose very first post-install navigation happens offline has no HTML to fall back to.**

`src/sw.ts:62`

```ts
// Falls back to precached version only when offline
```

**2. devOptions.enabled is false AND src/main.tsx:31 actively unregisters every service worker in non-PROD. Nothing SW-related — precaching, offline navigation, background sync — is reachable via `npm run dev`. You must run a production build and `npm run preview` to exercise any of it.**

`vite.config.ts:51`

```ts
        enabled: false,
```

**3. The SW is a Vite-built bundle, so VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY are inlined as string literals into the shipped sw.js at build time. The SW never receives them from the page, which means a build without those env vars produces a service worker that fetches `undefined/rest/v1/moods` — and it will still be installed and cached.**

`src/sw.ts:53`

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
```

**4. Combined with `self.skipWaiting()` at module scope in src/sw.ts:49 and clientsClaim() at :50, any new deploy activates immediately and force-reloads the open tab with no user prompt. Unsaved in-page state (a half-typed mood note, an in-progress scripture session) is lost on deploy.**

`src/main.tsx:21`

```ts
        updateSW(true); // true = reload after update
```

**5. That `export {}` turns the .d.ts into a module, so the top-level `interface SyncEvent` / `ExtendableEvent` / `ServiceWorkerGlobalScope` declarations in this file are module-scoped and never augment the global webworker lib — only the `declare global` block (lines 63-80) applies. That is why src/sw.ts has to re-declare SyncEvent at line 30 and PrecacheEntry at line 37 despite the comment at sw.ts:36 claiming PrecacheEntry lives here.**

`src/sw-types.d.ts:82`

```ts
export {};
```

---

## Local Data Layer: IndexedDB schema, versioning & migrations

All offline data lives in one IndexedDB database, `my-love-db`, currently at version 5 with eight object stores: messages, photos, moods, sw-auth, and four scripture stores. A single centralized `upgradeDb()` in dbSchema.ts applies cumulative migrations v1→v5. BaseIndexedDBService gives every service the same init guard and CRUD, with read operations degrading to null/[] and write operations throwing. A one-time migration lifts custom messages out of localStorage into IndexedDB on first authenticated render, and a quota monitor logs localStorage usage afterwards.

**Start here:** `src/services/dbSchema.ts:200`

```ts
export function upgradeDb(
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/services/dbSchema.ts` | 280 | Canonical MyLoveDBSchema typing, DB_NAME/DB_VERSION/STORE_NAMES constants, and the centralized upgradeDb() covering v1-v5 |
| `src/services/BaseIndexedDBService.ts` | 307 | Abstract base: init() concurrency guard, add/get/getAll/update/delete/clear, cursor-based getPage, error policy |
| `src/services/storage.ts` | 337 | StorageService singleton for photos + messages; the only service with its own hand-written upgrade callback |
| `src/services/moodService.ts` | 256 | Extends BaseIndexedDBService for the moods store; opens the DB via upgradeDb |
| `src/services/customMessageService.ts` | 300 | Extends BaseIndexedDBService for the messages store; opens the DB via upgradeDb |
| `src/services/scriptureReadingService.ts` | 962 | Owns the four v5 scripture stores; opens the DB via upgradeDb |
| `src/sw-db.ts` | 173 | Service-worker-side DB opener with its own duplicated inline upgrade callback |
| `src/services/migrationService.ts` | 149 | One-time localStorage 'my-love-custom-messages' → IndexedDB migration with Zod validation and duplicate detection |
| `src/utils/storageMonitor.ts` | 111 | Estimates localStorage usage against a hardcoded 5MB budget and logs warning/critical thresholds |
| `src/App.tsx` | 610 | Runs the localStorage migration and logStorageQuota() in a requestIdleCallback after first authenticated render |
| `src/stores/slices/settingsSlice.ts` | 258 | initializeApp() calls storageService.init() and seeds default messages — the first IndexedDB open in the app lifecycle |
| `src/stores/useAppStore.ts` | 287 | Zustand persist partializer and onRehydrateStorage recovery for the localStorage half of persistence |

### Store state

| Slice | Keys | Persisted |
|---|---|---|
| `src/stores/useAppStore.ts` | `settings`, `isOnboarded`, `messageHistory`, `moods` | yes — these four are the entire localStorage partializer (useAppStore.ts:119-141); messageHistory.shownMessages is Map↔Array serialized |

### Backend

| | |
|---|---|
| IndexedDB stores | `messages`, `photos`, `moods`, `sw-auth`, `scripture-sessions`, `scripture-reflections`, `scripture-bookmarks`, `scripture-messages` |
| Realtime | none |

### Tests

- `tests/unit/services/dbSchema.test.ts` — unit
- `tests/unit/services/dbSchema.indexes.test.ts` — unit
- `tests/unit/services/moodService.test.ts` — unit
- `tests/unit/services/scriptureReadingService.cache.test.ts` — unit
- `tests/unit/services/scriptureReadingService.crud.test.ts` — unit

### Watch out for

**1. StorageService is the ONE service that never calls upgradeDb — it opens at the shared DB_VERSION (=5, storage.ts:37) with a hand-written callback whose moods branch is gated `oldVersion >= 2` and whose sw-auth branch is gated `oldVersion >= 3` (storage.ts:80), and which has no scripture branch at all. On a fresh install (oldVersion 0) those branches never fire, so if StorageService wins the race to create the DB — and settingsSlice.ts:120 calls storageService.init() during app init — the database is created at v5 with only `messages` and `photos`. Every subsequent openDB(DB_NAME, 5) then sees a matching version and skips upgrade entirely, so moods / sw-auth / scripture stores are missing permanently.**

`src/services/storage.ts:72`

```ts
          if (oldVersion < 3 && oldVersion >= 2) {
```

**2. The service worker duplicates the upgrade logic and stops at v4, yet opens at the imported DB_VERSION (=5, sw-db.ts:25). Same failure mode from the SW side: if a background sync runs before the app has ever opened the DB, the database is created at v5 with only messages/photos/moods/sw-auth and the four scripture stores are never created. This inline copy must be kept in lockstep with dbSchema.upgradeDb by hand — nothing enforces it.**

`src/sw-db.ts:68`

```ts
      if (oldVersion < 4) {
```

**3. Read operations swallow every error and return [] / null. A missing object store from either version-skew bug above therefore surfaces to the user as 'you have no moods' rather than as a failure, and only shows up as a console.error. Write operations do throw, so the symptom pattern is: reads look empty and quiet, the first save blows up.**

`src/services/BaseIndexedDBService.ts:166`

```ts
      return []; // Graceful fallback: return empty array
```

**4. The v1→v2 photos migration is destructive by design (see the rationale comment at dbSchema.ts:218-229): the store is dropped and recreated, so any cached rows are lost. Accepted because photos are Supabase-first and the cache refills, but it means you cannot add a data-preserving photo migration here — upgrade callbacks cannot await async work, which is exactly why the preserving path was removed.**

`src/services/dbSchema.ts:233`

```ts
      db.deleteObjectStore('photos');
```

**5. The moods `by-date` index is UNIQUE, so a second row with the same YYYY-MM-DD string throws a ConstraintError from db.add. moodService.create() does not check for an existing row — the guard lives one layer up in the store (src/stores/slices/moodSlice.ts:70 routes to updateMoodEntry when a mood for today already exists), and that guard reads `get().moods`, i.e. the Zustand array, not IndexedDB. If the store array is stale or empty, create() hits the unique index instead.**

`src/services/dbSchema.ts:252`

```ts
    moodsStore.createIndex('by-date', 'date', { unique: true });
```

**6. The localStorage source key is deleted as soon as at least one message migrated — even when other messages hit non-Zod errors and were pushed into result.errors (line 124). Those messages are then gone with no source left to retry from, and the function still returns to a caller (src/App.tsx:285) that only console.errors the failures.**

`src/services/migrationService.ts:129`

```ts
    if (result.migratedCount > 0 || result.skippedCount === customMessages.length) {
```

**7. The 'development mode only' claim is wrong — logStorageQuota() has no import.meta.env.DEV guard, so the console.warn at 70% and console.error at 85% fire in production too. It also only measures localStorage against a hardcoded 5MB (storageMonitor.ts:55) via string-length arithmetic; it never calls navigator.storage.estimate() and reports nothing about IndexedDB, which is where photos and scripture data actually live.**

`src/utils/storageMonitor.ts:78`

```ts
 * Log storage quota status to console (development mode only)
```

**8. The whole moods array is persisted to localStorage on top of being the source of truth in IndexedDB — two copies that can diverge. onRehydrateStorage revives the messageHistory Map but has no Date revival, so rehydrated mood `timestamp` values come back as ISO strings while the IndexedDB copies are Date objects. src/stores/slices/moodSlice.ts:14 also still claims 'LocalStorage: sync status cached for offline indicator', but syncStatus is not in the partializer.**

`src/stores/useAppStore.ts:132`

```ts
        moods: state.moods,
```

**9. init() clears initPromise in a finally, so a rejected _doInit leaves this.db null and initPromise null — the next call retries from scratch rather than staying permanently poisoned. But there is no re-entrancy protection once this.db is set: nothing detects a connection killed by a `versionchange` event, so if another tab upgrades the DB, this instance keeps a closed handle and every later operation fails through the swallow-on-read / throw-on-write policy.**

`src/services/BaseIndexedDBService.ts:66`

```ts
      this.initPromise = null;
```

---

## Supabase Data Layer (client, API services, error handling)

Everything under src/api/ that talks to Supabase: a singleton typed client, auth (email/password, Google OAuth, password reset, session listening), the validated mood CRUD wrapper, poke/kiss interactions, partner search/request/accept flows, and a shared error-transformation module. Users never see this directly, but every feature's network call, offline check, and "could not save" message originates here. Auth state changes also mirror the access/refresh token into IndexedDB so the service worker's Background Sync can act while the app is closed.

**Start here:** `src/api/supabaseClient.ts:55`

```ts
export const supabase: SupabaseClient<Database> = createClient<Database>(
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/api/supabaseClient.ts` | 158 | Singleton typed Supabase client plus getPartnerId / getPartnerDisplayName / isSupabaseConfigured helpers; throws at module load if env vars are missing |
| `src/api/errorHandlers.ts` | 155 | isOnline, PostgrestError→SupabaseServiceError mapping, network-error wrapping, type guards, and logSupabaseError |
| `src/api/moodApi.ts` | 478 | Validated mood CRUD (create/fetchByUser/fetchByDateRange/fetchById/update/delete/getMoodHistory); every response is Zod-parsed before return |
| `src/api/moodSyncService.ts` | 451 | IndexedDB→Supabase mood sync with exponential-backoff retry, partner Broadcast send/receive, latest-partner-mood fetch |
| `src/api/interactionService.ts` | 346 | Sends poke/kiss rows, subscribes to postgres_changes INSERTs filtered to the current user, history + unviewed queries, markAsViewed |
| `src/api/partnerService.ts` | 340 | User search, send/accept/decline partner requests (RPC-backed), getPartner, getPendingRequests enrichment |
| `src/api/authService.ts` | 32 | Facade object re-exporting the session and action service functions as authService.* |
| `src/api/auth/actionService.ts` | 139 | signIn/signUp/signOut/resetPassword/signInWithGoogle; stores or clears the SW auth token on sign-in/out |
| `src/api/auth/sessionService.ts` | 93 | getSession/getUser/getCurrentUserId/getCurrentUserIdOfflineSafe/getAuthStatus/onAuthStateChange with token mirroring |
| `src/api/auth/types.ts` | 18 | AuthCredentials / AuthResult / AuthStatus interfaces |

### Backend

| | |
|---|---|
| Supabase tables | `moods`, `interactions`, `users`, `partner_requests` |
| RPCs | `accept_partner_request`, `decline_partner_request` |
| IndexedDB stores | `sw-auth` |
| Realtime | Two mechanisms. moodSyncService uses Broadcast: it sends to `mood-updates:${partnerId}` on an ephemeral channel after each sync and subscribes to `mood-updates:${currentUserId}` with `broadcast: { self: false }`. interactionService uses postgres_changes INSERT on the interactions table, channel 'incoming-interactions', filtered `to_user_id=eq.${userId}`. |

### Tests

- `src/api/auth/__tests__/authServices.test.ts` — unit
- `tests/unit/services/moodService.test.ts` — unit
- `tests/unit/stores/moodSlice.test.ts` — unit
- `tests/integration/example-rpc.spec.ts` — e2e

### Watch out for

**1. supabaseClient.ts throws during module evaluation when either env var is missing. Because virtually every service imports something from src/api, a missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY is not a runtime error at call time — it is a hard white-screen at import time, before any error boundary mounts.**

`src/api/supabaseClient.ts:26`

```ts
if (!supabaseUrl || !supabaseAnonKey) {
```

**2. SupabaseServiceError is declared but never exported. Every service JSDoc says `@throws {SupabaseServiceError}`, yet callers cannot import the class and so cannot `instanceof`-narrow it — they can only read `.message` or duck-type `.isNetworkError`.**

`src/api/errorHandlers.ts:16`

```ts
class SupabaseServiceError extends Error {
```

**3. Ordering constraint in logSupabaseError: SupabaseServiceError also carries code/message/details, so isPostgrestError's duck-typing returns true for it. The SupabaseServiceError branch must stay first or network errors get logged as Postgrest errors and isNetworkError is dropped from the log.**

`src/api/errorHandlers.ts:136`

```ts
  // Check SupabaseServiceError FIRST (more specific - has isNetworkError)
```

**4. ApiValidationError is likewise not exported from moodApi.ts, so the documented `@throws {ApiValidationError}` on all seven methods is unusable for type narrowing outside this file.**

`src/api/moodApi.ts:30`

```ts
class ApiValidationError extends Error {
```

**5. The sender broadcasts mood_types, but the receiver's reconstruction of SupabaseMoodRecord omits it entirely (only id/user_id/mood_type/note/created_at/updated_at are copied). A partner who logs three moods is rendered live as a single mood until a refetch through moodApi returns the full row. The broadcast payload is also never Zod-validated — it is read straight off payload.payload.**

`src/api/moodSyncService.ts:376`

```ts
          updated_at: payload.payload.created_at, // Use created_at as fallback
```

**6. Every syncMood does an extra round trip to users.partner_id via getPartnerId before broadcasting. Under syncPendingMoods this repeats once per queued mood — N pending moods means N inserts plus N partner lookups plus N ephemeral channel subscribe/send/remove cycles.**

`src/api/moodSyncService.ts:96`

```ts
    const partnerId = await getPartnerId();
```

**7. The retry loop is unconditional — it does not distinguish transient failures from permanent ones. An ApiValidationError or an RLS 42501 is retried 4 times with 1s+2s+4s of sleeps before it surfaces, and each retry re-enters syncMood, so it re-runs the partner lookup too.**

`src/api/moodSyncService.ts:274`

```ts
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
```

**8. Both realtime services are singletons holding a single `realtimeChannel` field, and interactionService uses a fixed channel name. Calling subscribeInteractions (or subscribeMoodUpdates) twice without invoking the first returned unsubscribe overwrites the reference and orphans the first channel — it stays subscribed and its callback keeps firing, but nothing can remove it.**

`src/api/interactionService.ts:183`

```ts
      .channel('incoming-interactions')
```

**9. searchUsers interpolates the raw user query straight into a PostgREST `.or()` filter string. A comma, parenthesis, or dot in the search box is parsed as filter syntax, not as literal text — it silently changes or breaks the query rather than matching those characters.**

`src/api/partnerService.ts:122`

```ts
        .or(`email.ilike.%${searchLower}%,display_name.ilike.%${searchLower}%`)
```

---

## Zod Runtime Validation Layer

Two parallel Zod schema modules guard the app's boundaries. src/validation/schemas.ts validates user input and local writes (messages, photos, moods, settings, exports) plus the scripture-session row shapes; src/api/validation/supabaseSchemas.ts validates what comes back from Supabase before it is handed to the UI. src/validation/errorMessages.ts converts a ZodError into a human sentence or a per-field Map so forms can show inline errors. Users experience this as "Message cannot be empty" / "Note cannot exceed 200 characters" instead of a raw stack trace.

**Start here:** `src/validation/schemas.ts:26`

```ts
export const CreateMessageInputSchema = z.object({
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/validation/schemas.ts` | 269 | Input-side schemas: CreateMessageInput, UpdateMessageInput, PhotoUploadInput, MoodEntry, Settings, CustomMessagesExport, plus the four scripture Supabase row schemas |
| `src/api/validation/supabaseSchemas.ts` | 295 | Response-side schemas for users/moods/interactions rows, insert/update shapes, array wrappers, and the scripture_get_couple_stats JSONB shape |
| `src/validation/errorMessages.ts` | 199 | ZodError → user-facing string / field Map, ValidationError class, createValidationError + isValidationError + isZodError guards |
| `src/config/performance.ts` | 23 | VALIDATION_LIMITS constants consumed by the message schemas, and LOG_TRUNCATE_LENGTH used by migration/custom-message logging |
| `src/stores/slices/settingsSlice.ts` | — | Consumer: parses settings through SettingsSchema and rethrows via createValidationError |
| `src/services/moodService.ts` | — | Consumer: validates mood entries with MoodEntrySchema before the IndexedDB write |
| `src/services/customMessageService.ts` | — | Consumer: validates create/update message input and import payloads |
| `src/services/migrationService.ts` | — | Consumer: re-validates legacy messages with CreateMessageInputSchema during migration |
| `src/services/scriptureReadingService.ts` | — | Consumer: parses RPC responses with the scripture schemas and CoupleStatsSchema |

### Backend

| | |
|---|---|
| Supabase tables | `moods`, `users`, `interactions`, `scripture_sessions`, `scripture_reflections`, `scripture_bookmarks`, `scripture_messages` |
| RPCs | `scripture_get_couple_stats` |
| Realtime | none — broadcast payloads bypass these schemas entirely |

### Tests

- `tests/unit/validation/schemas.test.ts` — unit
- `tests/unit/services/scriptureReadingService.stats.test.ts` — unit
- `tests/api/scripture-reflection-2.2.spec.ts` — e2e
- `tests/api/scripture-reflection-2.3.spec.ts` — e2e
- `tests/api/scripture-reflection-rpc.spec.ts` — e2e

### Watch out for

**1. Both modules export a symbol named SupabaseMessageSchema, and they describe different things: src/validation/schemas.ts's version is the scripture_messages chat row, while src/api/validation/supabaseSchemas.ts's version is a placeholder for a `messages` table that does not exist. Importing the wrong one type-checks and fails only at parse time.**

`src/validation/schemas.ts:257`

```ts
export const SupabaseMessageSchema = z.object({
```

**2. The colliding twin. Same exported name, different module, different shape.**

`src/api/validation/supabaseSchemas.ts:205`

```ts
export const SupabaseMessageSchema = z.object({
```

**3. Stale comment: the photos table does exist — supabase/migrations/20251203190800_create_photos_table.sql created it and src/types/database.types.ts declares `photos` at line 204. SupabasePhotoSchema is nonetheless dead code; the photo feature validates through src/validation/schemas.ts instead.**

`src/api/validation/supabaseSchemas.ts:223`

```ts
 * Note: Photos table not yet implemented in Supabase
```

**4. IsoDateStringSchema's regex accepts 2024-02-30; the refine is what rejects it, by round-tripping through Date and requiring the ISO output to start with the input. That also means the check runs in UTC — it validates the literal string, not the user's local calendar day.**

`src/validation/schemas.ts:112`

```ts
    return dateObj.toISOString().startsWith(date);
```

**5. NOTE_MAX_LENGTH (and CAPTION_MAX_LENGTH, PARTNER_NAME_MAX_LENGTH) are declared but referenced nowhere outside this file — grep finds no consumer. The real mood-note ceiling is a hardcoded 200 in MoodEntrySchema and MoodInsertSchema, so raising this constant changes nothing. Only MESSAGE_TEXT_MAX_LENGTH and LOG_TRUNCATE_LENGTH are actually wired up.**

`src/config/performance.ts:15`

```ts
  NOTE_MAX_LENGTH: 1000,
```

**6. ValidationError is not exported — only createValidationError and the isValidationError guard are. Components must use the guard; `catch (e) { if (e instanceof ValidationError) }` is impossible outside this module.**

`src/validation/errorMessages.ts:14`

```ts
class ValidationError extends Error {
```

**7. TimestampSchema deliberately does not use z.iso.datetime(). It hand-rolls a regex that makes the timezone suffix optional, because PostgREST can return a bare `2025-01-15T10:30:00` with no offset. Tightening this to a standard ISO validator will start rejecting live rows.**

`src/api/validation/supabaseSchemas.ts:37`

```ts
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/;
```

**8. Every import in both modules is from 'zod/v4', not 'zod'. Mixing a plain `import { z } from 'zod'` into these files produces two distinct ZodError classes, and `error instanceof ZodError` / isZodError silently returns false.**

`src/validation/schemas.ts:1`

```ts
import { z } from 'zod/v4';
```

---

## Observability (logger, performance monitoring)

A 13-line logger with exactly two levels and a scroll-frame PerformanceObserver used by the mood history timeline. That is the whole of it — there is no error-reporting service, so nothing leaves the device. Nothing here is user-facing; it only determines what shows up in the console.

**Start here:** `src/utils/logger.ts:4`

```ts
export const logger = {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/utils/logger.ts` | 13 | The whole logger: debug() is DEV-only, info() always logs. There is no warn or error method |
| `src/utils/performanceMonitoring.ts` | 46 | measureScrollPerformance — PerformanceObserver on 'measure' entries, warns above 16.67ms |
| `src/components/MoodTracker/MoodHistoryTimeline.tsx` | — | Only consumer of measureScrollPerformance |
| `eslint.config.js` | — | Enforces the logger contract: no-console error with warn/error allowed, disabled for src/sw.ts, src/sw-db.ts and test files |

### Backend

| | |
|---|---|
| Realtime | none |

### Tests

_None found for this feature._

### Watch out for

**1. logger.info is NOT dev-gated — it calls console.info unconditionally, in production too. Only logger.debug checks import.meta.env.DEV. Anything routed through info() ships to end users' consoles, including interactionService's realtime subscription-status logs and moodSyncService's per-mood failure logs.**

`src/utils/logger.ts:9`

```ts
  /** Always logs — operational events (sync completed, subscribed, etc.) */
```

**2. The logger has no warn or error method by design — ESLint's no-console allows console.warn and console.error, so the codebase deliberately mixes logger.debug/info with raw console.warn/console.error. Adding logger.error would not be picked up by the existing call sites.**

`eslint.config.js:63`

```ts
      'no-console': ['error', { allow: ['warn', 'error'] }],
```

**3. There is no error-reporting service at all. Nothing captures a production exception beyond `console.error` in the two error boundaries, so a crash that only a user hits leaves no trace you can read. Reproducing locally is the only diagnostic path.**

`src/components/ErrorBoundary/ErrorBoundary.tsx`

```ts
    console.error('[ErrorBoundary]:', error, errorInfo);
```

**4. measureScrollPerformance observes entryTypes: ['measure'] globally — it fires for every performance.measure() anywhere in the app, not just mood-timeline scrolling, and the console.warn is unconditional (not DEV-gated) even though the surrounding logger.debug is. The caller is responsible for disconnect(); the function returns the observer and registers no cleanup itself.**

`src/utils/performanceMonitoring.ts:38`

```ts
          console.warn('[Performance] Frame drop detected:', entry.duration, 'ms');
```

---

## Database Schema, Migrations & pgTAP Suite

26 SQL migrations under supabase/migrations/ define the whole backend: users/partner_requests, moods, interactions, love_notes, photos, and the seven scripture tables, plus 14 SECURITY DEFINER RPCs. 14 pgTAP files under supabase/tests/database/ assert schema shape, RLS policies, and RPC semantics, run via `npm run test:db`. src/types/database.types.ts is generated from this schema and must be regenerated, never hand-edited.

**Start here:** `supabase/migrations/20251203000001_create_base_schema.sql:58`

```ts
CREATE TYPE mood_type AS ENUM (
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/types/database.types.ts` | 731 | GENERATED by `supabase gen types typescript --local` — never hand-edit; declares 12 public tables and 14 RPC signatures |
| `supabase/migrations/20251203000001_create_base_schema.sql` | — | Original schema: users, moods (originally a mood_type ENUM), interactions, love_notes |
| `supabase/migrations/20251206024345_remote_schema.sql` | — | Converted mood_type/mood_types from ENUM to text + CHECK constraints and dropped the enum type |
| `supabase/migrations/20260315044923_fix_avg_rating_precision.sql` | — | Rounds scripture_get_couple_stats avgRating to 1 decimal to match the JS toFixed(1) display (issue #137) |
| `supabase/migrations/20260316031209_create_claude_bot_config.sql` | — | claude_bot_config table — RLS on with no policies, i.e. deny-all to anon/authenticated |
| `supabase/migrations/20260725170000_grant_api_roles_on_public.sql` | — | Most recent migration: explicit GRANTs to anon/authenticated/service_role so the schema stops depending on Postgres default privileges |
| `supabase/tests/database/02_rls_policies.sql` | 194 | pgTAP RLS policy assertions |
| `supabase/tests/database/09_scripture_couple_stats.sql` | 362 | Largest pgTAP file — couple-stats RPC semantics |
| `supabase/tests/database/00_helpers.sql` | 96 | Shared pgTAP fixtures/helpers loaded by the other suites |
| `supabase/functions/upload-love-note-image/index.ts` | — | The repo's only Edge Function |

### Backend

| | |
|---|---|
| Supabase tables | `claude_bot_config`, `interactions`, `love_notes`, `moods`, `partner_requests`, `photos`, `scripture_bookmarks`, `scripture_messages`, `scripture_reflections`, `scripture_sessions`, `scripture_step_states`, `users` |
| RPCs | `accept_partner_request`, `decline_partner_request`, `get_my_partner_id`, `is_scripture_session_member`, `scripture_convert_to_solo`, `scripture_create_session`, `scripture_end_session`, `scripture_get_couple_stats`, `scripture_lock_in`, `scripture_seed_test_data`, `scripture_select_role`, `scripture_submit_reflection`, `scripture_toggle_ready`, `scripture_undo_lock_in` |
| Realtime | postgres_changes on public.interactions (INSERT) is the only table-level realtime consumer; migration 20260301000200_remove_server_side_broadcasts.sql removed server-side broadcast triggers. |

### Tests

- `supabase/tests/database/00_helpers.sql` — db
- `supabase/tests/database/01_schema.sql` — db
- `supabase/tests/database/02_rls_policies.sql` — db
- `supabase/tests/database/03_scripture_rpcs.sql` — db
- `supabase/tests/database/04_reflection_upsert.sql` — db
- `supabase/tests/database/05_bookmarks.sql` — db
- `supabase/tests/database/06_session_reflection.sql` — db
- `supabase/tests/database/07_messages.sql` — db
- `supabase/tests/database/08_session_completion.sql` — db
- `supabase/tests/database/09_scripture_couple_stats.sql` — db
- `supabase/tests/database/10_scripture_lobby.sql` — db
- `supabase/tests/database/11_scripture_lockin.sql` — db
- `supabase/tests/database/12_scripture_end_session.sql` — db
- `supabase/tests/database/13_scripture_create_session_together_semantics.sql` — db
- `tests/api/scripture-lobby-4.1.spec.ts` — e2e

### Watch out for

**1. Counts are from commands: `ls supabase/migrations | wc -l` = 26, `ls supabase/tests/database | wc -l` = 14. The newest migration exists because migrations run as `postgres`, which since Supabase CLI 2.109.1 inherits a default ACL granting only Dxtm — so every table this repo creates landed with no SELECT/INSERT/UPDATE/DELETE for the API roles and PostgREST answered 42501 even for service_role (grants are checked before RLS; BYPASSRLS does not bypass a missing grant). CI pins CLI 2.77.1, so this only bites a local stack on a newer CLI.**

`supabase/migrations/20260725170000_grant_api_roles_on_public.sql:35`

```ts
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
```

**2. The generated type for moods.mood_type is plain `string`, not a union — because migration 20251206024345_remote_schema.sql replaced the Postgres ENUM with text + a CHECK constraint. TypeScript therefore provides zero compile-time protection against an invalid mood; the Zod MoodTypeSchema in supabaseSchemas.ts is the only client-side enum enforcement, and the DB CHECK is the only server-side one.**

`src/types/database.types.ts:128`

```ts
          mood_type: string
```

**3. The CHECK constraint that replaced the enum was added `not valid` then validated in a second statement. Any future mood value must be added in three places to stay consistent: this constraint, MoodTypeSchema in src/api/validation/supabaseSchemas.ts, and MoodTypeSchema in src/validation/schemas.ts.**

`supabase/migrations/20251206024345_remote_schema.sql:97`

```ts
alter table "public"."moods" add constraint "moods_mood_type_check" CHECK ((mood_type = ANY (ARRAY['loved'::text, 'happy'::text, 'content'::text, 'excited'::text, 'thoughtful'::text, 'grateful'::text, 'sad'::text, 'anxious'::text, 'frustrated'::text, 'angry'::text, 'lonely'::text, 'tired'::text]))) not valid;
```

**4. avgRating rounding lives in SQL, not JS: the RPC rounds to 1 decimal specifically so it matches the client's toFixed(1). CoupleStatsSchema's `z.number().min(0).max(5)` would also reject anything outside 0–5, so changing the SQL rounding or aggregate risks a client-side parse failure rather than a display glitch.**

`supabase/migrations/20260315044923_fix_avg_rating_precision.sql:8`

```ts
-- Replace function to change round(v_avg_rating, 2) → round(v_avg_rating, 1)
```

---

## Shared Types, App Constants & Date Utilities

The hand-written domain vocabulary (Message, Photo, MoodEntry, Settings, MessageHistory, Theme, LoveNote) plus the hardcoded relationship config and every date-formatting helper in the app. Users see this as "2h ago", "Yesterday", "Monday", "November 30, 2025 at 2:45 PM", the partner's name, and the relationship day counter.

**Start here:** `src/types/index.ts:21`

```ts
export interface Message {
```

### Source files

| File | Lines | Role |
|---|---:|---|
| `src/types/index.ts` | 183 | Core hand-written domain types: ThemeName, MessageCategory, MoodType, Message, Photo, Compression*, Anniversary, MoodEntry, Settings, MessageHistory, CustomMessage*, MessageFilter, CustomMessagesExport, Theme |
| `src/types/models.ts` | 43 | LoveNote (with client-only optimistic fields) and MessageValidationResult |
| `src/types/database.types.ts` | 731 | Generated Supabase schema types — separate from the hand-written ones above |
| `src/config/constants.ts` | 39 | APP_CONFIG: hardcoded defaultPartnerName 'Gracie', defaultStartDate '2025-10-18', isPreConfigured; PARTNER_NAME re-export |
| `src/utils/dateUtils.ts` | 184 | getRelativeTime, isJustNow, formatMessageTimestamp, formatFullTimestamp, formatDateISO, formatDateLong, formatRelativeDate + private Intl formatters |

### Backend

| | |
|---|---|
| Realtime | none |

### Tests

- `src/utils/__tests__/dateUtils.test.ts` — unit
- `tests/unit/utils/dateFormat.test.ts` — unit
- `tests/unit/utils/messageRotation.test.ts` — unit

### Watch out for

**1. formatDateISO deliberately uses local getFullYear/getMonth/getDate instead of toISOString().split('T')[0]. The comment records why: the UTC version returned tomorrow's date at 11 PM EST, which surfaced the wrong daily message. Its output is persisted as localStorage cache keys in messageHistory.shownMessages, so switching back would both break the daily message and orphan every cached key.**

`src/utils/dateUtils.ts:129`

```ts
export function formatDateISO(date: Date): string {
```

**2. formatRelativeDate uses calendar-day boundaries via getDaysSince (both dates floored to local midnight), not wall-clock deltas — unlike getRelativeTime a few lines above, which is pure millisecond arithmetic. The two helpers can disagree about the same timestamp: 30 minutes before midnight, getRelativeTime says '30m ago' while formatRelativeDate says 'yesterday' once the clock rolls over.**

`src/utils/dateUtils.ts:159`

```ts
  const days = getDaysSince(date);
```

**3. The month/year branches divide by fixed 30- and 365-day windows, so 'N months ago' drifts from real calendar months — 59 days renders as '1 month ago'.**

`src/utils/dateUtils.ts:164`

```ts
    const months = Math.floor(days / 30);
```

**4. MessageHistory.shownMessages is a JS Map. Maps do not survive JSON.stringify — anything persisting this object (localStorage, Zustand persist) needs an explicit replacer/reviver or the field silently serialises to `{}`.**

`src/types/index.ts:109`

```ts
  shownMessages: Map<string, number>; // Date (YYYY-MM-DD) → Message ID mapping
```

**5. src/types/index.ts is not purely a type file — it re-exports runtime-adjacent types from ../api/interactionService, so importing from '@/types' pulls the interaction service module into the graph (and transitively supabaseClient, which throws on missing env vars at import time).**

`src/types/index.ts:83`

```ts
export type {
```

**6. APP_CONFIG.defaultPartnerName is a build-time hardcoded literal, but the app also resolves a per-user partner name at runtime via getPartnerDisplayName() from the users table. Two sources of truth for the same string; the constant is the fallback, not the answer.**

`src/config/constants.ts:21`

```ts
  defaultPartnerName: 'Gracie',
```

**7. MoodEntry's `userId` comment is stale — it says the value is hardcoded from constants.ts, but constants.ts exports no user id and moodSyncService reads mood.userId straight into the Supabase insert's user_id, which RLS matches against auth.uid().**

`src/types/index.ts:71`

```ts
  userId: string; // Hardcoded for single-user (from constants.ts)
```

---

# Appendix A — Test coverage by area

Counted from the test tree, not from the feature entries above.

| Area | E2E specs | Unit tests |
|---|---:|---:|
| auth | 4 | |
| home | 3 | |
| mood | 1 | |
| navigation | 1 | |
| notes | 1 | |
| offline | 1 | |
| partner | 1 | |
| photos | 2 | |
| scripture | 14 | |

Unit tests live in `tests/unit/` split by layer (`data/`, `hooks/`, `services/`, `stores/`, `utils/`, `validation/`) plus co-located `src/**/__tests__/` suites.

**The distribution is uneven.** Scripture Reading holds 14 of the 28 E2E specs and most of `tests/unit/`. By contrast `tests/unit/stores/` contains suites for only three slices — mood, scripture, and settings. There is no `photosSlice`, `notesSlice`, `interactionsSlice`, `messagesSlice`, `partnerSlice`, `authSlice`, `navigationSlice`, or `appSlice` unit test.

---

# Appendix B — Supabase migrations

26 migrations, oldest first:

```
20251203000001_create_base_schema.sql
20251203190800_create_photos_table.sql
20251205000001_add_love_notes_images.sql
20251205000002_add_mime_validation.sql
20251206024345_remote_schema.sql
20251206124803_fix_users_rls_policy.sql
20251206200000_fix_users_update_privilege_escalation.sql
20260128000001_scripture_reading.sql
20260130000001_scripture_rpcs.sql
20260204000001_unlinked_preset.sql
20260205000001_fix_users_rls_recursion.sql
20260206000001_enable_pgtap.sql
20260217150353_scripture_couple_stats.sql
20260217184551_optimize_couple_stats_rpc.sql
20260220000001_scripture_lobby_and_roles.sql
20260221000001_fix_function_search_paths.sql
20260221211137_scripture_lobby_phase_guards.sql
20260222000001_scripture_lock_in.sql
20260228000001_scripture_end_session.sql
20260301000100_fix_scripture_create_session_together_lobby.sql
20260301000200_remove_server_side_broadcasts.sql
20260309000001_at_reflection_preset.sql
20260313000001_fix_lock_in_last_step.sql
20260315044923_fix_avg_rating_precision.sql
20260316031209_create_claude_bot_config.sql
20260725170000_grant_api_roles_on_public.sql
```

pgTAP suites live in `supabase/tests/database/` (14 files), run via `npm run test:db`.

---

# How this document was produced

Generated 2026-07-25 against `main` at commit `95ec4a64`.

Eleven agents each mapped one feature area by reading the implementation directly — not the existing `docs/` tree, which can lag the code. Every `file:line` quotation was then independently re-verified by separate auditors that opened each file and compared the stored text against the real line.

| Audit result | |
|---|---|
| Citations checked | 373 |
| Verified correct | 371 |
| Corrected before publication | 2 |
| Reported paths that did not exist | 0 |
| `src/` coverage | 164 of 166 non-test files; the 2 gaps were closed by hand |

The two corrections were a line number off by one (`src/components/scripture-reading/overview/StatsSection.tsx`, 17 → 18) and a mistyped comment (`src/stores/useAppStore.ts:84`). Both were re-checked against the source before this file was written.

**This document is hand-maintained.** It is not regenerated by `bmad-document-project`, so nothing will refresh it automatically when the code moves.

