# Data Flow

## Component to Store to Service

```
React Component
    |
    | useAppStore(selector)  -- Subscribe to state
    | useAppStore.getState() -- Read state imperatively
    |
    v
Zustand Store (useAppStore)
    |
    | Slice actions call service layer
    |
    +---> storageService (IndexedDB)       -- Messages
    +---> customMessageService (IndexedDB) -- Custom messages
    +---> moodService (IndexedDB)          -- Mood entries
    +---> moodSyncService (Supabase)       -- Mood cloud sync
    +---> photoService (Supabase Storage)  -- Photo uploads
    +---> interactionService (Supabase)    -- Poke/kiss interactions
    +---> partnerService (Supabase)        -- Partner connections
    +---> supabase client (Supabase)       -- Love notes, scripture sessions
    +---> scriptureReadingService (Supabase) -- Scripture reading sessions
```

## Initialization Flow

```
App Mount
    |
    v
Zustand persist middleware
    |-- Read localStorage('my-love-storage')
    |-- Pre-hydration validation (validateHydratedState)
    |-- Deserialize Map (Array -> Map for shownMessages)
    |-- Set __isHydrated = true
    |
    v
Settings.initializeApp()
    |-- Verify __isHydrated === true
    |-- Initialize IndexedDB (storageService.init())
    |-- Load or seed default messages
    |-- Call updateCurrentMessage() (message rotation)
    |-- Set isLoading = false
```

## Optimistic Update Pattern

Used consistently in Notes, Interactions, Photos, and Mood slices:

```
User Action (e.g., send note)
    |
    v
1. Validate input (rate limit, auth, etc.)
2. Create optimistic state (temp ID, sending: true)
3. Update store immediately (user sees instant feedback)
4. Send to server (Supabase) in background
    |
    +-- Success: Replace optimistic state with server response
    +-- Failure: Mark as error (sending: false, error: true)
                 Allow retry with cached data
```

---
