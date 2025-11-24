# Initialization Sequence

## App Startup Flow

```
1. App Component Mounts (React)
   ↓
2. Zustand Store Created
   ├─ All slices composed
   └─ Core state initialized

3. Persist Middleware Hydration (Synchronous)
   ├─ getItem() from localStorage
   ├─ validateHydratedState()
   ├─ Return null if invalid (triggers defaults)
   ├─ onRehydrateStorage() deserializes Map
   └─ Set __isHydrated = true

4. useAppStore Hook Called (Components)
   └─ State available immediately (from hydration)

5. useEffect(() => { initializeApp() }, []) (Main Component)
   ├─ Check __isHydrated (should be true)
   ├─ storageService.init() → IndexedDB
   ├─ Load messages from IndexedDB
   ├─ Populate with defaults if empty
   ├─ updateCurrentMessage()
   ├─ Set isLoading = false
   └─ Remaining async operations (background):
      ├─ loadPhotos()
      ├─ loadMoods()
      ├─ fetchPartnerMoods()
      ├─ loadInteractionHistory()
      └─ subscribeToInteractions()
```

## Timing Details

**Synchronous (Blocks Render)**:

- Zustand store creation
- Persist hydration
- Initial render with hydrated state

**Asynchronous (After Render)**:

- IndexedDB init
- Message/photo/mood loading
- Partner/interaction fetching
- Realtime subscription

**Critical Order**:

1. Settings hydration (has initial state)
2. IndexedDB init (creates database)
3. loadMessages() (required for currentMessage)
4. updateCurrentMessage() (depends on messages)
5. UI rendered with initial state

## State During Initialization

| Phase                | settings | messages | isLoading |
| -------------------- | -------- | -------- | --------- |
| **Before Hydration** | default  | []       | false     |
| **After Hydration**  | saved    | []       | false     |
| **After IndexedDB**  | saved    | loaded   | false     |
| **Stable**           | saved    | loaded   | false     |

## Error During Initialization

```
initializeApp() errors
  ↓
Catch block: set error state
  ↓
Don't throw (allows app to continue)
  ↓
isLoading = false
  ↓
UI shows error notification
  ↓
App remains functional with defaults
```

---
