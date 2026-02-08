# State Management

## Zustand Store Architecture

The root store (`useAppStore`) composes 10 slices using Zustand's slice pattern. Each slice is a pure function that receives `(set, get, api)` and returns its state shape and actions.

```
useAppStore (persist middleware -> localStorage)
  |
  +-- appSlice           Loading states, error state, hydration flag
  +-- navigationSlice    currentView, setView (with history.pushState)
  +-- messagesSlice      Daily messages CRUD, rotation, favorites
  +-- moodSlice          Mood tracking, pending sync queue, Supabase sync
  +-- interactionsSlice  Partner interaction counts (poke, kiss, fart)
  +-- photosSlice        Photo gallery state, selection, carousel
  +-- notesSlice         Love notes messaging state
  +-- partnerSlice       Partner mood realtime state
  +-- settingsSlice      User preferences, theme, relationship dates
  +-- scriptureReadingSlice  Scripture session state, phase management
```

**Type composition** (`stores/types.ts`):
```typescript
interface AppState extends
  AppSlice,
  MessagesSlice,
  PhotosSlice,
  SettingsSlice,
  NavigationSlice,
  MoodSlice,
  InteractionsSlice,
  PartnerSlice,
  NotesSlice,
  ScriptureSlice {}
```

**Hydration flow:**
1. Zustand persist reads from localStorage
2. Custom `getItem` validates JSON structure before hydration
3. `onRehydrateStorage` deserializes `shownMessages` (Array -> Map)
4. If validation fails, corrupted state is cleared and defaults are used
5. `__isHydrated` flag is set after successful hydration

## Custom Hooks

Hooks bridge the gap between Zustand store state and component-specific derived state:

| Hook | Purpose | Data Source |
|---|---|---|
| `useAuth` | Authentication state and actions | `authService` |
| `useAutoSave` | Debounced form auto-save | Component state |
| `useImageCompression` | Image compression pipeline | `imageCompressionService` |
| `useLoveNotes` | Love notes with realtime updates | Zustand + `realtimeService` |
| `useMoodHistory` | Calendar-grouped mood history | Zustand + `moodApi` |
| `useMotionConfig` | Reduced motion preferences | `prefers-reduced-motion` media query |
| `useNetworkStatus` | Online/offline status | `navigator.onLine` + events |
| `usePartnerMood` | Partner mood realtime subscription | `realtimeService` |
| `usePhotos` | Photo gallery operations | Zustand + `photoService` |
| `useRealtimeMessages` | Love notes realtime channel | `supabase.channel()` |
| `useVibration` | Haptic feedback | Vibration API |

---
