# Component Inventory

> Complete UI component catalog for My-Love project.

## Overview

| Metric | Count |
|--------|-------|
| Total Components | 54 |
| Feature Modules | 15 |
| Shared Components | 2 |
| Test Files | 4 |

## Component Tree

```
src/components/
├── AdminPanel/           # Message administration
├── CountdownTimer/       # Timer display
├── DailyMessage/         # Main message card
├── DisplayNameSetup/     # Onboarding name input
├── ErrorBoundary/        # Error handling
├── InteractionHistory/   # Poke/kiss history
├── LoginScreen/          # Authentication
├── love-notes/           # Chat messaging
├── MoodHistory/          # Calendar view
├── MoodTracker/          # Mood logging
├── Navigation/           # Bottom navigation
├── PartnerMoodView/      # Partner mood display
├── PhotoCarousel/        # Photo slider
├── PhotoDeleteConfirmation/
├── PhotoEditModal/       # Caption editing
├── PhotoGallery/         # Photo grid
├── photos/               # Photo upload
├── PhotoUpload/          # Upload UI
├── PokeKissInterface/    # Interactions
├── RelationshipTimers/   # Countdown timers
├── Settings/             # User settings
├── shared/               # Shared utilities
├── WelcomeButton/        # Welcome action
└── WelcomeSplash/        # Splash screen
```

## Feature Modules

### AdminPanel/ (6 components)

Message CRUD administration.

| Component | Purpose |
|-----------|---------|
| `AdminPanel.tsx` | Main admin container |
| `CreateMessageForm.tsx` | New message form |
| `EditMessageForm.tsx` | Edit message form |
| `DeleteConfirmDialog.tsx` | Delete confirmation |
| `MessageList.tsx` | Message list view |
| `MessageRow.tsx` | Individual message row |

### love-notes/ (5 components + tests)

Real-time chat messaging with partner.

| Component | Purpose |
|-----------|---------|
| `LoveNotes.tsx` | Main chat container |
| `MessageList.tsx` | Scrollable message list |
| `MessageInput.tsx` | Text/image input |
| `LoveNoteMessage.tsx` | Individual message bubble |
| `ImagePreview.tsx` | Image attachment preview |
| `FullScreenImageViewer.tsx` | Full-screen image modal |

**Tests:** `__tests__/` contains 4 test files.

### MoodTracker/ (6 components)

Emoji-based mood logging.

| Component | Purpose |
|-----------|---------|
| `MoodTracker.tsx` | Main tracker container |
| `MoodButton.tsx` | Emoji mood button |
| `PartnerMoodDisplay.tsx` | Partner's current mood |
| `MoodHistoryTimeline.tsx` | Timeline view |
| `MoodHistoryItem.tsx` | Timeline item |
| `NoMoodLoggedState.tsx` | Empty state |

### MoodHistory/ (3 components)

Calendar-based mood history.

| Component | Purpose |
|-----------|---------|
| `MoodHistoryCalendar.tsx` | Calendar container |
| `CalendarDay.tsx` | Day cell with mood |
| `MoodDetailModal.tsx` | Mood detail popup |

### PhotoGallery/ (4 components)

Photo grid with viewer.

| Component | Purpose |
|-----------|---------|
| `PhotoGallery.tsx` | Main gallery container |
| `PhotoGridItem.tsx` | Grid thumbnail |
| `PhotoViewer.tsx` | Full-screen viewer |
| `PhotoGridSkeleton.tsx` | Loading skeleton |

### PhotoCarousel/ (2 components)

Photo carousel slider.

| Component | Purpose |
|-----------|---------|
| `PhotoCarousel.tsx` | Carousel container |
| `PhotoCarouselControls.tsx` | Nav controls |

### RelationshipTimers/ (4 components)

Countdown timers for special dates.

| Component | Purpose |
|-----------|---------|
| `RelationshipTimers.tsx` | Main container |
| `TimeTogether.tsx` | Duration counter |
| `BirthdayCountdown.tsx` | Birthday timer |
| `EventCountdown.tsx` | Generic event timer |

### Settings/ (2 components)

User settings management.

| Component | Purpose |
|-----------|---------|
| `Settings.tsx` | Main settings panel |
| `AnniversarySettings.tsx` | Date settings |

### Navigation/ (1 component)

Bottom tab navigation.

| Component | Purpose |
|-----------|---------|
| `BottomNavigation.tsx` | 5-tab bottom nav |

**Tabs:** Home, Love Notes, Mood, Photos, Settings

### shared/ (2 components)

Cross-feature utilities.

| Component | Purpose |
|-----------|---------|
| `NetworkStatusIndicator.tsx` | Online/offline badge |
| `SyncToast.tsx` | Sync notification toast |

### Single-Component Modules

| Module | Component | Purpose |
|--------|-----------|---------|
| `CountdownTimer/` | `CountdownTimer.tsx` | Time countdown display |
| `DailyMessage/` | `DailyMessage.tsx` | Main message card |
| `DisplayNameSetup/` | `DisplayNameSetup.tsx` | Name onboarding |
| `ErrorBoundary/` | `ErrorBoundary.tsx` | Error boundary (class) |
| `InteractionHistory/` | `InteractionHistory.tsx` | Interaction list |
| `LoginScreen/` | `LoginScreen.tsx` | Auth UI |
| `PartnerMoodView/` | `PartnerMoodView.tsx` | Partner mood |
| `PhotoDeleteConfirmation/` | `PhotoDeleteConfirmation.tsx` | Delete dialog |
| `PhotoEditModal/` | `PhotoEditModal.tsx` | Caption editor |
| `PhotoUpload/` | `PhotoUpload.tsx` | Upload UI |
| `photos/` | `PhotoUploader.tsx` | Upload component |
| `PokeKissInterface/` | `PokeKissInterface.tsx` | Interaction buttons |
| `WelcomeButton/` | `WelcomeButton.tsx` | Welcome CTA |
| `WelcomeSplash/` | `WelcomeSplash.tsx` | Splash screen |

## Component Patterns

### Functional Components (Standard)

All components are functional with hooks.

```typescript
export const MoodTracker: React.FC = () => {
  const moods = useAppStore(state => state.moods);
  // ...
};
```

### Class Component (Exception)

Only `ErrorBoundary` is a class component (React limitation).

```typescript
export class ErrorBoundary extends React.Component {
  static getDerivedStateFromError(error: Error) {
    // ...
  }
}
```

### State Access

```typescript
// Selector pattern
const { notes, sendNote } = useAppStore(state => ({
  notes: state.notes,
  sendNote: state.sendNote,
}));
```

### Lazy Loading

Route-level code splitting:

```typescript
const PhotoGallery = lazy(() => import('./components/PhotoGallery/PhotoGallery'));
const MoodTracker = lazy(() => import('./components/MoodTracker/MoodTracker'));
```

### Animation

Framer Motion for animations:

```typescript
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>
  {content}
</motion.div>
```

### Styling

Tailwind CSS utility classes:

```typescript
<button className="bg-sunset-500 hover:bg-sunset-600 px-4 py-2 rounded-lg">
  Send
</button>
```

## Custom Hooks Used

| Hook | Used By |
|------|---------|
| `useAuth` | LoginScreen |
| `useLoveNotes` | love-notes components |
| `useMoodHistory` | MoodHistory components |
| `usePartnerMood` | MoodTracker, PartnerMoodView |
| `usePhotos` | PhotoGallery, PhotoUpload |
| `useRealtimeMessages` | love-notes |
| `useNetworkStatus` | shared components |
| `useVibration` | PokeKissInterface |
| `useImageCompression` | PhotoUpload, love-notes |

## Testing Strategy

- **Location:** Colocated in `__tests__/` subdirectories
- **Framework:** Vitest + Testing Library
- **Environment:** happy-dom with fake-indexeddb

```typescript
// Example test
import { render, screen } from '@testing-library/react';
import { LoveNoteMessage } from '../LoveNoteMessage';

test('renders message content', () => {
  render(<LoveNoteMessage note={mockNote} />);
  expect(screen.getByText(mockNote.content)).toBeInTheDocument();
});
```
