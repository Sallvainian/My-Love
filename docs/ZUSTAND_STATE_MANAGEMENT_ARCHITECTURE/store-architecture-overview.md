# Store Architecture Overview

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    useAppStore (Zustand)                │
│                                                          │
│  Persisted to LocalStorage + IndexedDB                  │
│  Middleware: persist, createJSONStorage                 │
│  Validation: validateHydratedState(), Zod Schema        │
└─────────────────────────────────────────────────────────┘
        ▲                       ▲                    ▲
        │                       │                    │
   ┌────────────┐  ┌────────────────────┐  ┌────────────────┐
   │ 7 Slices   │  │ Core Shared State  │  │ Hydration Flag │
   │ (Composed) │  │                    │  │                │
   └────────────┘  └────────────────────┘  └────────────────┘
        │                       │                    │
   ┌────┴────────────────────────────────────────────────┐
   │                                                     │
   ▼       ▼      ▼      ▼      ▼      ▼      ▼         │
┌────┐┌───┐┌────┐┌───┐┌────┐┌────┐┌───┐  isLoading    │
│Set ││Msg│Photo│Mood│Part│Intr│Nav │  error          │
│Sli│Sli│Sli  │Sli │Sli │Sli │Sli │  __isHydrated   │
└────┘└───┘└────┘└───┘└────┘└────┘└───┘               │
                                                       │
   Storage Layer                                       │
   ├─ LocalStorage (my-love-storage)                  │
   │  ├─ settings                                      │
   │  ├─ isOnboarded                                   │
   │  ├─ messageHistory (serialized)                   │
   │  └─ moods                                         │
   │                                                   │
   └─ IndexedDB (my-love-db)                          │
      ├─ messages                                      │
      ├─ customMessages                                │
      ├─ photos + blobs                                │
      ├─ moods (full entries)                          │
      └─ interactions (ephemeral)                      │
                                                       │
   Backend (Supabase)                                  │
   ├─ User authentication                              │
   ├─ Partner connections                              │
   ├─ Mood sync                                        │
   ├─ Interactions (Realtime)                          │
   └─ Relationships metadata                           │
```

## AppState Interface

```typescript
export interface AppState
  extends MessagesSlice, // Messages, history, custom messages
    PhotosSlice, // Photo gallery, storage
    SettingsSlice, // Settings, onboarding, app init
    NavigationSlice, // View routing
    MoodSlice, // Mood entries, sync status
    InteractionsSlice, // Poke/kiss interactions
    PartnerSlice {
  // Partner info, requests
  // Shared/Core state
  isLoading: boolean; // App initialization loading
  error: string | null; // Global error state
  __isHydrated?: boolean; // Hydration flag (internal)
}
```

---
