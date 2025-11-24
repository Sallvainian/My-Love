# Zustand State Management Architecture

**Project**: My-Love  
**Last Updated**: 2025-11-16  
**Documentation Type**: Formal Software Architecture  
**Store Pattern**: Modular Slice Composition

---

## Executive Summary

The My-Love application uses **Zustand** for global state management with a **modular slice-based architecture**. The store composes 7 independent slices plus core shared state, totaling approximately 3,000 lines of state logic. This document provides exhaustive specification of the store's architecture, state shapes, actions, and cross-slice dependencies.

### Key Characteristics

- **Composition Pattern**: Spread operator-based slice composition via `StateCreator`
- **Persistence**: Hybrid LocalStorage + IndexedDB strategy
- **Middleware**: Persist middleware with custom validation and serialization
- **Validation**: Zod schema validation for settings
- **Async Actions**: Support for CRUD operations with IndexedDB/Supabase integration
- **Real-time**: Supabase Realtime subscriptions (Interactions, Mood sync)

---

## Table of Contents

1. [Store Architecture Overview](#store-architecture-overview)
2. [Composition Pattern](#composition-pattern)
3. [Persistence Strategy](#persistence-strategy)
4. [Core Shared State](#core-shared-state)
5. [Slice Specifications](#slice-specifications)
6. [Cross-Slice Dependencies](#cross-slice-dependencies)
7. [Performance Optimizations](#performance-optimizations)
8. [Error Handling & Recovery](#error-handling--recovery)
9. [Initialization Sequence](#initialization-sequence)

---

## Store Architecture Overview

### High-Level Architecture Diagram

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

### AppState Interface

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

## Composition Pattern

### Store Creation

The store uses Zustand's `create<T>()` API with slice composition via spread operator:

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      // 1. Compose all 7 slices
      ...createMessagesSlice(set as any, get as any, api as any),
      ...createPhotosSlice(set as any, get as any, api as any),
      ...createSettingsSlice(set as any, get as any, api as any),
      ...createNavigationSlice(set as any, get as any, api as any),
      ...createMoodSlice(set as any, get as any, api as any),
      ...createInteractionsSlice(set as any, get as any, api as any),
      ...createPartnerSlice(set as any, get as any, api as any),

      // 2. Define core state
      isLoading: false,
      error: null,
      __isHydrated: false,
    }),
    {
      // 3. Configure persist middleware
      name: 'my-love-storage',
      version: 0,
      storage: createJSONStorage(...),
      partialize: (state) => ({ ... }),
      onRehydrateStorage: () => (state, error) => { ... },
    }
  )
);
```

### StateCreator Pattern

Each slice follows this pattern:

```typescript
export const createXyzSlice: StateCreator<
  XyzSlice & { otherSlice?: OtherType }, // Full state shape
  [], // Middleware
  [], // Nested middleware
  XyzSlice // Return type
> = (set, get) => ({
  // State
  state1: initialValue,
  state2: initialValue,

  // Actions
  action1: () => {
    set({ state1: newValue });
  },
  action2: () => {
    const state = get(); /* ... */
  },
});
```

### Type Safety Note

The composition uses `as any` casts to avoid TypeScript circular reference issues. While pragmatic for monolithic stores, this trades some type safety for simplicity. The AppState interface maintains full type correctness for consumers.

---

## Persistence Strategy

### Storage Configuration

| Data                | Storage           | Strategy                        | Serialization      |
| ------------------- | ----------------- | ------------------------------- | ------------------ |
| **settings**        | LocalStorage      | Persisted (Zod validated)       | JSON               |
| **isOnboarded**     | LocalStorage      | Persisted                       | Boolean            |
| **messageHistory**  | LocalStorage      | Persisted with special handling | JSON (Map → Array) |
| **moods**           | LocalStorage      | Persisted                       | JSON               |
| **messages**        | IndexedDB         | Loaded on init                  | Blob (photos)      |
| **photos**          | IndexedDB         | Loaded on init                  | Blob (image data)  |
| **customMessages**  | IndexedDB         | Loaded on demand                | JSON               |
| **interactions**    | Supabase Realtime | Ephemeral (fetched fresh)       | -                  |
| **partner**         | Supabase          | Loaded on mount                 | -                  |
| **other transient** | Memory only       | Runtime state                   | -                  |

### LocalStorage Persistence Configuration

```typescript
partialize: (state) => ({
  // Critical user data
  settings: state.settings,
  isOnboarded: state.isOnboarded,

  // Message history (serialized Map → Array)
  messageHistory: {
    ...state.messageHistory,
    shownMessages:
      state.messageHistory?.shownMessages instanceof Map
        ? Array.from(state.messageHistory.shownMessages.entries())
        : [],
  },

  // Mood entries
  moods: state.moods,

  // NOT persisted (IndexedDB):
  // - messages (loaded from IndexedDB)
  // - customMessages (loaded on demand)
  // - photos (loaded from IndexedDB)
  //
  // NOT persisted (transient):
  // - currentMessage (computed from messages + history)
  // - interactions (fetched fresh from Supabase)
  // - partner (loaded from Supabase)
  // - isLoading, error (runtime UI state)
});
```

### Serialization & Deserialization

#### MessageHistory Map Serialization

The `messageHistory.shownMessages` Map (date → message ID mapping) requires custom serialization:

**Serialization (State → JSON)**:

```typescript
// Before storage: Map([["2025-11-16", 42], ["2025-11-15", 41]])
// After storage: [["2025-11-16", 42], ["2025-11-15", 41]]
shownMessages instanceof Map ? Array.from(state.messageHistory.shownMessages.entries()) : [];
```

**Deserialization (JSON → State)**:

```typescript
// After loading: [["2025-11-16", 42], ["2025-11-15", 41]]
// Before use: Map([["2025-11-16", 42], ["2025-11-15", 41]])
onRehydrateStorage: () => (state, error) => {
  if (state?.messageHistory) {
    const shownMessagesArray = state.messageHistory.shownMessages as any;

    if (!shownMessagesArray) {
      state.messageHistory.shownMessages = new Map();
    } else if (Array.isArray(shownMessagesArray)) {
      // Validate array structure: [[key, value], ...]
      const isValidArray = shownMessagesArray.every(
        (item) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
      );

      if (isValidArray) {
        state.messageHistory.shownMessages = new Map(shownMessagesArray);
      } else {
        state.messageHistory.shownMessages = new Map();
      }
    }
  }
};
```

### Pre-Hydration Validation

The custom storage implementation validates state before Zustand hydrates:

```typescript
storage: createJSONStorage(() => ({
  getItem: (name) => {
    const str = localStorage.getItem(name);
    if (!str) return null;

    try {
      const data = JSON.parse(str);

      // Validate structure BEFORE Zustand sees it
      const validation = validateHydratedState(data.state);
      if (!validation.isValid) {
        console.error('[Storage] Pre-hydration validation failed');
        localStorage.removeItem(name);
        return null; // Force Zustand to use defaults
      }

      return str; // Valid - let Zustand hydrate
    } catch (parseError) {
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
}));
```

### Validation Logic

The `validateHydratedState()` function performs two-phase validation:

1. **Pre-hydration** (in `getItem`): Parse and structural validation
2. **Post-hydration** (in `onRehydrateStorage`): Type validation and recovery

```typescript
function validateHydratedState(state: Partial<AppState> | undefined): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!state) {
    errors.push('State is undefined');
    return { isValid: false, errors };
  }

  // Validate only CRITICAL fields
  if (state.messageHistory) {
    // Check shownMessages is array OR Map
    if (
      state.messageHistory.shownMessages !== undefined &&
      !Array.isArray(state.messageHistory.shownMessages) &&
      !(state.messageHistory.shownMessages instanceof Map)
    ) {
      errors.push('shownMessages is not an array or Map instance');
    }

    // Check currentIndex is number
    if (
      state.messageHistory.currentIndex !== undefined &&
      typeof state.messageHistory.currentIndex !== 'number'
    ) {
      errors.push('currentIndex is not a number');
    }
  }

  // Only fail on CRITICAL errors (data integrity issues)
  // Missing fields are OK - they'll use defaults
  const hasCriticalErrors = errors.some(
    (err) => err.includes('not an array or Map instance') || err.includes('not a number')
  );

  return { isValid: !hasCriticalErrors, errors };
}
```

### Hydration Recovery

On hydration failure, the store:

1. Logs detailed error messages
2. Clears corrupted localStorage
3. Falls back to initial state defaults
4. Continues with empty/default values for missing data

```typescript
onRehydrateStorage: () => (state, error) => {
  if (error) {
    console.error('[Zustand Persist] Failed to rehydrate:', error);
    try {
      localStorage.removeItem('my-love-storage');
      console.warn('[Zustand Persist] Corrupted state cleared');
    } catch (clearError) {
      console.error('[Zustand Persist] Failed to clear corrupted state');
    }
    return; // App continues with defaults
  }

  // Post-hydration recovery logic
  if (state?.messageHistory) {
    // Deserialize Map from Array
    // Handle null/undefined gracefully
  }

  // Set hydration flag
  if (state) {
    state.__isHydrated = true;
  }
};
```

---

## Core Shared State

### isLoading: boolean

**Purpose**: Global loading indicator during app initialization

**Initial Value**: `false`

**Updated By**:

- `initializeApp()` (Settings Slice)
  - Set to `true` when initialization starts
  - Set to `false` when IndexedDB is ready
  - Set to `false` on error

**Usage**: Loading spinners, disabled UI during initialization

### error: string | null

**Purpose**: Global error messages for unrecoverable failures

**Initial Value**: `null`

**Updated By**:

- `initializeApp()` (Settings Slice)
  - Hydration failures
  - IndexedDB initialization errors
- Network/Supabase errors propagated from slices

**Usage**: Error notifications, recovery UI

### \_\_isHydrated: boolean (Internal)

**Purpose**: Internal flag tracking Zustand persist hydration completion

**Initial Value**: `false` (set to `true` in `onRehydrateStorage`)

**Details**:

- Set by persist middleware after loading from localStorage
- Used by `initializeApp()` to verify state loading completed
- Not exposed to components (name starts with `__`)
- Checked synchronously during initialization

**Critical for**: Preventing race conditions between persist hydration and IndexedDB init

---

## Slice Specifications

---

## SETTINGS SLICE

### File

`src/stores/slices/settingsSlice.ts`

### Purpose

Manages app settings, user preferences, onboarding state, and app initialization orchestration.

### State Interface

```typescript
export interface SettingsSlice {
  // State
  settings: Settings | null;
  isOnboarded: boolean;

  // Actions
  initializeApp: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setOnboarded: (onboarded: boolean) => void;
  addAnniversary: (anniversary: Omit<Anniversary, 'id'>) => void;
  removeAnniversary: (id: number) => void;
  setTheme: (theme: ThemeName) => void;
}
```

### State Shape

```typescript
{
  settings: {
    themeName: 'sunset' | 'ocean' | 'forest' | 'rose' | 'lavender',
    notificationTime: '09:00',  // HH:MM format
    relationship: {
      startDate: Date,          // Relationship start date
      partnerName: string,      // Partner's name
      anniversaries: [
        {
          id: number,           // Auto-generated ID
          name: string,
          date: string,         // YYYY-MM-DD
          notifyBefore: number, // Days
        }
      ]
    },
    customization: {
      accentColor: string,      // Hex color
      fontFamily: string,       // CSS font family
    },
    notifications: {
      enabled: boolean,
      time: string,             // HH:MM
    }
  },
  isOnboarded: true | false,    // Persisted to LocalStorage
}
```

### Initial State

```typescript
settings: {
  themeName: 'sunset' as ThemeName,
  notificationTime: '09:00',
  relationship: {
    startDate: APP_CONFIG.defaultStartDate,
    partnerName: APP_CONFIG.defaultPartnerName,
    anniversaries: [],
  },
  customization: {
    accentColor: '#ff6b9d',
    fontFamily: 'system-ui',
  },
  notifications: {
    enabled: true,
    time: '09:00',
  },
},
isOnboarded: true,
```

### Actions

#### initializeApp()

**Type**: Async action  
**Called By**: App.tsx on mount  
**Returns**: Promise<void>

**Sequence**:

1. Guard: Check if already initializing/initialized (StrictMode protection)
2. Check Zustand persist hydration status (`__isHydrated`)
3. Initialize IndexedDB via `storageService.init()`
4. Load all messages from IndexedDB
5. If no messages exist, populate with defaults
6. Call `updateCurrentMessage()` to compute today's message
7. Set `isLoading = false`

**Error Handling**:

- Logs hydration failure → clears localStorage → continues with defaults
- IndexedDB errors → logged → sets `error` state

**Guards**:

```typescript
let isInitializing = false; // Module-level (prevents concurrent init)
let isInitialized = false; // Module-level (prevents re-init)
```

#### setSettings(settings)

**Type**: Sync action  
**Validation**: Zod SettingsSchema validation

**Process**:

1. Validate settings against SettingsSchema
2. If valid: set to state
3. If invalid: log Zod error → throw ValidationError

**Persistence**: Triggers LocalStorage write

#### updateSettings(updates)

**Type**: Sync action  
**Validation**: Zod SettingsSchema validation

**Process**:

1. Merge updates into current settings
2. Validate merged object
3. If valid: set to state
4. If invalid: throw ValidationError

**Use Case**: Partial updates (e.g., just theme)

#### setOnboarded(onboarded)

**Type**: Sync action  
**Sets**: `isOnboarded` boolean  
**Persistence**: Triggers LocalStorage write

#### addAnniversary(anniversary)

**Type**: Sync action  
**Input**: `Omit<Anniversary, 'id'>`

**Process**:

1. Generate new ID = max(existing IDs) + 1
2. Create Anniversary object with ID
3. Append to settings.relationship.anniversaries
4. Update state

**Immutable Pattern**: Shallow copy of settings object

#### removeAnniversary(id)

**Type**: Sync action  
**Filters**: Out anniversary with matching ID  
**Immutable**: Creates new array and settings object

### Validation

Uses **Zod** for runtime validation:

```typescript
const validated = SettingsSchema.parse(settings);
if (!validated) throw error;
```

Validates:

- Theme name valid enum
- Notification time format (HH:MM)
- Anniversary data structure
- Relationship metadata

### Persistence

- **What**: `settings` + `isOnboarded`
- **Where**: LocalStorage (my-love-storage)
- **When**: Automatic on each update
- **How**: JSON serialization

### Dependencies

**Cross-Slice**:

- Calls `updateCurrentMessage()` on Messages slice after loading messages
- Coordinates with Messages slice initialization

**External**:

- `storageService` (IndexedDB initialization)
- `defaultMessages` (message population)
- `SettingsSchema` (Zod validation)

---

## MESSAGES SLICE

### File

`src/stores/slices/messagesSlice.ts`

### Purpose

Manages message lifecycle: loading, CRUD, history tracking, daily message rotation, and custom message management via IndexedDB.

### State Interface

```typescript
export interface MessagesSlice {
  // State
  messages: Message[];
  messageHistory: MessageHistory;
  currentMessage: Message | null;
  currentDayOffset: number; // @deprecated
  customMessages: CustomMessage[];
  customMessagesLoaded: boolean;

  // Actions
  loadMessages: () => Promise<void>;
  addMessage: (text: string, category: string) => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;
  navigateToPreviousMessage: () => void;
  navigateToNextMessage: () => void;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;
  loadCustomMessages: () => Promise<void>;
  createCustomMessage: (input: CreateMessageInput) => Promise<void>;
  updateCustomMessage: (input: UpdateMessageInput) => Promise<void>;
  deleteCustomMessage: (id: number) => Promise<void>;
  getCustomMessages: (filter?: MessageFilter) => CustomMessage[];
  exportCustomMessages: () => Promise<void>;
  importCustomMessages: (file: File) => Promise<{ imported: number; skipped: number }>;
}
```

### State Shape

```typescript
{
  messages: [
    {
      id: number,
      text: string,
      category: 'love' | 'inspiration' | 'fun' | 'intimate',
      isFavorite: boolean,
      isCustom: boolean,
      active?: boolean,         // For custom messages (Story 3.5)
      createdAt: Date,
      tags?: string[],          // For custom messages
    }
  ],

  messageHistory: {
    currentIndex: number,        // 0 = today, 1 = yesterday, etc.
    shownMessages: Map<string, number>,  // "YYYY-MM-DD" → messageId
    maxHistoryDays: 30,
    favoriteIds: number[],       // Legacy field
    lastShownDate: string,       // @deprecated
    lastMessageId: number,       // @deprecated
    viewedIds: number[],         // @deprecated
  },

  currentMessage: {
    id: number,
    text: string,
    category: string,
    // ... same as messages[n]
  } | null,

  currentDayOffset: number,      // @deprecated (use messageHistory.currentIndex)

  customMessages: [
    {
      id: number,
      text: string,
      category: string,
      isCustom: true,
      active: boolean,
      createdAt: ISO8601,        // String, not Date
      updatedAt?: ISO8601,
      tags?: string[],
    }
  ],

  customMessagesLoaded: boolean, // Flag for async loading state
}
```

### Initial State

```typescript
messages: [],
messageHistory: {
  currentIndex: 0,
  shownMessages: new Map(),
  maxHistoryDays: 30,
  favoriteIds: [],
  lastShownDate: '',
  lastMessageId: 0,
  viewedIds: [],
},
currentMessage: null,
currentDayOffset: 0,
customMessages: [],
customMessagesLoaded: false,
```

### Actions

#### loadMessages()

**Type**: Async  
**Source**: IndexedDB (storageService)  
**Persistence**: IndexedDB

**Process**:

1. Fetch all messages from IndexedDB
2. Update `messages` state
3. Log count

**Error Handling**: Logged (graceful degradation)

#### addMessage(text, category)

**Type**: Async  
**Destination**: IndexedDB  
**Persistence**: IndexedDB

**Process**:

1. Create Message object with:
   - `isCustom: true`
   - `createdAt: new Date()`
   - `isFavorite: false`
2. Save to IndexedDB (returns ID)
3. Update messages state optimistically
4. Log success

#### toggleFavorite(messageId)

**Type**: Async  
**Updates**:

- IndexedDB: `isFavorite` flag
- State: `messages[n].isFavorite`
- State: `messageHistory.favoriteIds` array

**Process**:

1. Call `storageService.toggleFavorite(messageId)`
2. Toggle boolean in messages array
3. Update favoriteIds array
4. Call `updateCurrentMessage()` if current message changed

#### updateCurrentMessage()

**Type**: Sync (internally async)  
**Critical**: Computes today's message and caches in messageHistory

**Algorithm**:

1. Filter rotation pool (exclude inactive custom messages)
2. Get today's date (YYYY-MM-DD format)
3. Check if message already cached in `shownMessages.get(todayString)`
4. If not cached:
   - Compute message using `getDailyMessage()` rotation algorithm
   - Cache in `shownMessages.set(dateString, messageId)`
   - Reset `currentIndex = 0` (today)
5. Load message object and set as `currentMessage`

**Rotation Algorithm**: `getDailyMessage(rotationPool, date)`

- Uses date-based hash to deterministically select message
- Different message each day
- Same message if same date on different year
- Depends on available messages count

**Story 3.3 Fix**: Always reset to today (`currentIndex = 0`) on app init, even if message is cached

#### navigateToPreviousMessage()

**Type**: Sync  
**Direction**: Back in time (index 0 → 1 → 2)  
**Constraint**: Limited to `maxHistoryDays` (30 days)

**Process**:

1. Validate can navigate back: `canNavigateBack()` check
2. Increment `currentIndex` (0 → 1 = today → yesterday)
3. Calculate target date: `today - currentIndex days`
4. Check cache: `shownMessages.get(dateString)`
5. If not cached: compute via rotation algorithm + cache
6. Update `currentMessage`

**Caching**: Caches both current and target dates

#### navigateToNextMessage()

**Type**: Sync  
**Direction**: Forward in time (index 1 → 0)  
**Constraint**: Cannot navigate past today (index 0)

**Process**:

1. Validate can navigate forward: `currentIndex > 0` check
2. Decrement `currentIndex` (1 → 0 = yesterday → today)
3. Calculate target date
4. Load from cache: `shownMessages.get(dateString)`
5. Update `currentMessage`

#### canNavigateBack()

**Type**: Sync query  
**Returns**: boolean

**Logic**:

```typescript
const availableDays = getAvailableHistoryDays(messageHistory, settings);
return messageHistory.currentIndex < availableDays;
```

Compares current index against:

- `maxHistoryDays` (30)
- Or limited by relationship start date

#### canNavigateForward()

**Type**: Sync query  
**Returns**: boolean

**Logic**:

```typescript
return messageHistory.currentIndex > 0; // Not at today
```

#### loadCustomMessages()

**Type**: Async  
**Source**: IndexedDB (customMessageService)  
**Persistence**: IndexedDB

**Process**:

1. Fetch custom messages from customMessageService
2. Convert Date objects to ISO8601 strings
3. Update `customMessages` state
4. Set `customMessagesLoaded = true`

**Story 3.5**: Moved from LocalStorage to IndexedDB

#### createCustomMessage(input)

**Type**: Async  
**Input**: `CreateMessageInput { text, category, tags?, active? }`  
**Destination**: IndexedDB

**Process**:

1. Save via `customMessageService.create(input)`
2. Optimistic UI update: add to `customMessages`
3. Reload all messages (updates rotation pool)
4. Log success

#### updateCustomMessage(input)

**Type**: Async  
**Input**: `UpdateMessageInput { id, text?, category?, active?, tags? }`  
**Destination**: IndexedDB

**Process**:

1. Update via `customMessageService.updateMessage(input)`
2. Optimistic UI update: merge into matching custom message
3. Reload all messages (updates rotation pool)
4. Log success

#### deleteCustomMessage(id)

**Type**: Async  
**Destination**: IndexedDB

**Process**:

1. Delete via `customMessageService.delete(id)`
2. Optimistic UI update: filter out from `customMessages`
3. Reload all messages (updates rotation pool)
4. Log success

#### getCustomMessages(filter?)

**Type**: Sync query  
**Returns**: `CustomMessage[]`

**Filtering**:

- By `category`
- By `active` status
- By `searchTerm` (case-insensitive substring)
- By `tags` (includes match)

#### exportCustomMessages()

**Type**: Async  
**Output**: JSON file download

**Process**:

1. Get export data via `customMessageService.exportMessages()`
2. Generate filename: `my-love-custom-messages-YYYY-MM-DD.json`
3. Create blob and trigger browser download
4. Log success

#### importCustomMessages(file)

**Type**: Async  
**Input**: File (JSON)  
**Returns**: `{ imported: number; skipped: number }`

**Process**:

1. Read file content
2. Parse JSON
3. Import via `customMessageService.importMessages(data)`
4. Reload custom messages and main messages
5. Return import summary

### Message Rotation Pool

**Story 3.5 Enhancement**:

```typescript
const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);
```

Includes:

- All default messages (always active)
- Custom messages with `active !== false`

Excludes:

- Custom messages with `active = false`

This allows disabling custom messages without deletion.

### Persistence

| Data           | Storage      | Persisted?            | Loading Time                |
| -------------- | ------------ | --------------------- | --------------------------- |
| messages       | IndexedDB    | No (loaded on init)   | On `initializeApp()`        |
| messageHistory | LocalStorage | Yes (serialized)      | Automatic                   |
| currentMessage | Memory       | No (computed)         | On `updateCurrentMessage()` |
| customMessages | IndexedDB    | No (loaded on demand) | On `loadCustomMessages()`   |

### Dependencies

**Cross-Slice**:

- **Settings**: Uses `settings.relationship.startDate` for history limit
- **Settings**: Called by `initializeApp()` to load initial messages

**External**:

- `storageService` (IndexedDB CRUD)
- `customMessageService` (custom message ops)
- `getDailyMessage()` (rotation algorithm)
- `getAvailableHistoryDays()` (history limit calculation)

---

## PHOTOS SLICE

### File

`src/stores/slices/photosSlice.ts`

### Purpose

Manages photo gallery: upload, compression, storage quota monitoring, CRUD, and carousel state.

### State Interface

```typescript
export interface PhotosSlice {
  // State
  photos: Photo[];
  isLoadingPhotos: boolean;
  photoError: string | null;
  storageWarning: string | null;
  selectedPhotoId: number | null;

  // Actions
  loadPhotos: () => Promise<void>;
  uploadPhoto: (input: PhotoUploadInput) => Promise<Photo>;
  getPhotoById: (photoId: number) => Photo | null;
  getStorageUsage: () => Promise<{ used: number; quota: number; percentUsed: number }>;
  clearStorageWarning: () => void;
  updatePhoto: (photoId: number, updates: { caption?: string; tags: string[] }) => Promise<void>;
  deletePhoto: (photoId: number) => Promise<void>;
  selectPhoto: (photoId: number) => void;
  clearPhotoSelection: () => void;
}
```

### State Shape

```typescript
{
  photos: [
    {
      id: number,
      imageBlob: Blob,              // Compressed image
      caption?: string,
      tags: string[],
      uploadDate: Date,
      originalSize: number,         // Bytes
      compressedSize: number,       // Bytes
      width: number,                // Pixels
      height: number,               // Pixels
      mimeType: 'image/jpeg',
    }
  ],

  isLoadingPhotos: boolean,         // Upload/load in progress
  photoError: string | null,        // Error message
  storageWarning: string | null,    // "Storage 85% full..."
  selectedPhotoId: number | null,   // Current carousel photo
}
```

### Initial State

```typescript
photos: [],
isLoadingPhotos: false,
photoError: null,
storageWarning: null,
selectedPhotoId: null,
```

### Actions

#### loadPhotos()

**Type**: Async  
**Source**: IndexedDB (photoStorageService)  
**Persistence**: IndexedDB (photos not persisted to LocalStorage)

**Process**:

1. Set `isLoadingPhotos = true`
2. Fetch all photos from IndexedDB
3. Update `photos` state
4. Set `isLoadingPhotos = false`

**Error Handling**: Logs error → clears state → falls back to empty array

#### uploadPhoto(input)

**Type**: Async  
**Input**: `PhotoUploadInput { file: File, caption?: string, tags?: string }`  
**Returns**: `Photo` (with generated ID)

**Process**:

1. **Validation**:
   - Validate file (mime type, size)
   - Log warnings if file is large
2. **Tag Processing**:
   - Split by comma
   - Trim whitespace
   - Remove duplicates (case-insensitive)
   - Limit to 10 tags
   - Limit each tag to 50 chars
3. **Caption Processing**:
   - Limit to 500 chars
4. **Compression**:
   - Call `imageCompressionService.compressImage(file)`
   - Returns: blob, width, height, originalSize, compressedSize
5. **Quota Check**:
   - Estimate remaining quota via `photoStorageService.estimateQuotaRemaining()`
   - If ≥ 80% full: warn (set `storageWarning`)
   - If ≥ 95% full: reject with "Storage full" error
6. **Save to IndexedDB**:
   - Create Photo object with compressed blob
   - Save via `photoStorageService.create(photo)`
7. **Optimistic UI Update**:
   - Add photo to beginning of `photos` array (newest first)
   - Set `isLoadingPhotos = false`

**Error Handling**: Logs error → sets `photoError` → re-throws for UI

#### getPhotoById(photoId)

**Type**: Sync query  
**Returns**: `Photo | null`

**Logic**:

```typescript
return get().photos.find((p) => p.id === photoId) || null;
```

#### getStorageUsage()

**Type**: Async query  
**Returns**: `{ used: number; quota: number; percentUsed: number }`

**Process**:

1. Call `photoStorageService.estimateQuotaRemaining()`
2. Return quota info object

**Error Handling**: Returns conservative defaults (0 used, 50MB quota, 0%)

#### clearStorageWarning()

**Type**: Sync  
**Sets**: `storageWarning = null`

**Use Case**: User dismisses warning notification

#### updatePhoto(photoId, updates)

**Type**: Async  
**Input**: `{ caption?: string; tags: string[] }`

**Process**:

1. Update in IndexedDB via `photoStorageService.update()`
2. Optimistic UI update: merge fields into matching photo
3. Log success

#### deletePhoto(photoId)

**Type**: Async  
**Constraints**: Special logic if photo is selected in carousel

**Process**:

1. Get current photo index before deletion
2. Delete from IndexedDB
3. Optimistic UI update: filter out photo
4. If deleted photo was selected:
   - If no photos left: clear selection
   - Else if not last photo: navigate to same index (next photo)
   - Else if was last photo: navigate to new last photo

**AC-4.4.7**: Smart navigation after delete

#### selectPhoto(photoId)

**Type**: Sync  
**Sets**: `selectedPhotoId = photoId`

**Use Case**: Open carousel at specific photo

#### clearPhotoSelection()

**Type**: Sync  
**Sets**: `selectedPhotoId = null`

**Use Case**: Close carousel

### Storage Quota Management

**Thresholds**:

- < 80%: Normal operation
- 80-95%: Warning displayed
- ≥ 95%: Reject uploads

**AC-4.1.9**: Show UI notification at 80% full

**Limits**:

- Default quota: 50MB
- Storage type: IndexedDB (persists across sessions)

### Persistence

- **What**: NOT persisted to LocalStorage
- **Where**: IndexedDB only
- **When**: Photos loaded on demand via `loadPhotos()`
- **Blobs**: Stored as Blob objects in IndexedDB

### Dependencies

**Cross-Slice**: None (self-contained)

**External**:

- `photoStorageService` (IndexedDB CRUD)
- `imageCompressionService` (compression algorithm)

---

## MOOD SLICE

### File

`src/stores/slices/moodSlice.ts`

### Purpose

Manages mood tracking: daily mood entries, sync status, partner mood visibility, and Supabase backend integration.

### State Interface

```typescript
export interface MoodSlice {
  // State
  moods: MoodEntry[];
  partnerMoods: MoodEntry[];
  syncStatus: {
    pendingMoods: number;
    isOnline: boolean;
    lastSyncAt?: Date;
    isSyncing: boolean;
  };

  // Actions
  addMoodEntry: (moods: MoodEntry['mood'][], note?: string) => Promise<void>;
  getMoodForDate: (date: string) => MoodEntry | undefined;
  updateMoodEntry: (date: string, moods: MoodEntry['mood'][], note?: string) => Promise<void>;
  loadMoods: () => Promise<void>;
  updateSyncStatus: () => Promise<void>;
  syncPendingMoods: () => Promise<{ synced: number; failed: number }>;
  fetchPartnerMoods: (limit?: number) => Promise<void>;
  getPartnerMoodForDate: (date: string) => MoodEntry | undefined;
}
```

### State Shape

```typescript
{
  moods: [
    {
      id?: number,              // IndexedDB ID
      userId: string,           // Auth user ID
      mood: string[],           // Multiple emotions: ['happy', 'excited']
      note?: string,            // User note
      date: string,             // YYYY-MM-DD
      timestamp: Date,          // Full timestamp
      synced: boolean,          // Synced to Supabase?
      supabaseId?: string,      // Supabase record ID
    }
  ],

  partnerMoods: [
    {
      // Same structure as moods
      // Fetched from Supabase, read-only
    }
  ],

  syncStatus: {
    pendingMoods: number,       // Count of unsynced entries
    isOnline: boolean,          // navigator.onLine
    lastSyncAt?: Date,          // Timestamp of last sync
    isSyncing: boolean,         // Sync in progress?
  }
}
```

### Initial State

```typescript
moods: [],
partnerMoods: [],
syncStatus: {
  pendingMoods: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastSyncAt: undefined,
  isSyncing: false,
},
```

### Actions

#### addMoodEntry(moods, note?)

**Type**: Async  
**Input**: `{ moods: string[], note?: string }`  
**Persistence**: IndexedDB (auto-sync to Supabase)

**Process**:

1. Get authenticated user ID via `authService.getCurrentUserId()`
2. Check if mood already exists for today
3. If exists: call `updateMoodEntry()` instead
4. Create new entry via `moodService.create(userId, moods, note)`
5. Optimistic UI update: add to `moods` array
6. Update sync status
7. Log success

**Error Handling**: Throws (allows UI error feedback)

#### getMoodForDate(date)

**Type**: Sync query  
**Returns**: `MoodEntry | undefined`

**Logic**:

```typescript
return get().moods.find((m) => m.date === date);
```

#### updateMoodEntry(date, moods, note?)

**Type**: Async  
**Persistence**: IndexedDB (auto-sync to Supabase)

**Process**:

1. Find existing mood by date
2. If not found: throw error
3. Update via `moodService.updateMood(id, moods, note)`
4. Update state: replace matching entry
5. Update sync status
6. Log success

#### loadMoods()

**Type**: Async  
**Source**: IndexedDB (moodService)  
**Persistence**: IndexedDB

**Process**:

1. Fetch all moods from moodService
2. Update `moods` state
3. Update sync status
4. Log count

**Error Handling**: Logged (graceful degradation)

#### updateSyncStatus()

**Type**: Async  
**Purpose**: Refresh sync status indicators

**Process**:

1. Get unsynced moods count from `moodService.getUnsyncedMoods()`
2. Check online status: `navigator.onLine`
3. Update `syncStatus` object

**Error Handling**: Logged (graceful degradation)

#### syncPendingMoods()

**Type**: Async  
**Purpose**: Sync all pending moods to Supabase  
**Returns**: `{ synced: number; failed: number }`  
**Story 6.4**: Background sync with retry logic

**Process**:

1. Set `isSyncing = true`
2. Call `moodSyncService.syncPendingMoods()`
3. Returns sync result (synced count, failed count)
4. Update sync status: refresh pending count
5. Update `lastSyncAt` timestamp
6. Set `isSyncing = false`

**Error Handling**:

- Catches errors
- Sets `isSyncing = false` even on error
- Re-throws for UI feedback

#### fetchPartnerMoods(limit?)

**Type**: Async  
**Input**: `limit = 30` (days)  
**Purpose**: Fetch partner's moods from Supabase  
**Story 6.4**: Task 3 - Partner mood visibility

**Process**:

1. Check network status: `navigator.onLine`
2. Get partner ID from environment config
3. Fetch partner moods via `moodSyncService.fetchMoods(partnerId, limit)`
4. Transform Supabase records to MoodEntry format:
   - Extract `date` from `created_at` ISO string
   - Set `synced = true` (always synced from Supabase)
5. Update `partnerMoods` state

**Error Handling**: Logged (graceful degradation - partner moods optional)

#### getPartnerMoodForDate(date)

**Type**: Sync query  
**Returns**: `MoodEntry | undefined`

**Logic**:

```typescript
return get().partnerMoods.find((m) => m.date === date);
```

### Mood Entry Schema

Validated by `moodService` on creation/update:

```typescript
{
  mood: string[],     // Multiple emotions
  note?: string,      // Optional user note
  date: string,       // YYYY-MM-DD
  userId: string,     // Auth user ID
  synced: boolean,    // LocalStorage + Supabase flag
}
```

### Sync Strategy

**Local → IndexedDB → Supabase**:

1. User creates/updates mood entry in UI
2. Saved to IndexedDB via `moodService` (synced flag = false)
3. App tracks pending moods count
4. Background: `syncPendingMoods()` uploads to Supabase
5. On success: synced flag = true, `lastSyncAt` updated

**Offline Support**:

- User can create moods offline
- Pending count shown in UI
- Sync on next online + connection event

**Partner Visibility**:

- Partner moods fetched separately from Supabase
- Read-only in local state
- Different from own pending moods

### Persistence

| Data         | Storage      | Persisted?       | Loaded When              |
| ------------ | ------------ | ---------------- | ------------------------ |
| moods        | IndexedDB    | Yes (auto)       | On `loadMoods()`         |
| moods        | LocalStorage | Yes (serialized) | On app init              |
| syncStatus   | Memory       | No               | Runtime only             |
| partnerMoods | Memory       | No               | On `fetchPartnerMoods()` |

### Dependencies

**Cross-Slice**: None (self-contained)

**External**:

- `moodService` (IndexedDB CRUD)
- `moodSyncService` (Supabase sync)
- `authService` (user authentication)
- `getPartnerId()` (partner ID from config)

---

## PARTNER SLICE

### File

`src/stores/slices/partnerSlice.ts`

### Purpose

Manages partner relationships: partner info, connection requests (sent/received), user search, and request operations.

### State Interface

```typescript
export interface PartnerSlice {
  // State
  partner: PartnerInfo | null;
  isLoadingPartner: boolean;
  sentRequests: PartnerRequest[];
  receivedRequests: PartnerRequest[];
  isLoadingRequests: boolean;
  searchResults: UserSearchResult[];
  isSearching: boolean;

  // Actions
  loadPartner: () => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  clearSearch: () => void;
  sendPartnerRequest: (toUserId: string) => Promise<void>;
  acceptPartnerRequest: (requestId: string) => Promise<void>;
  declinePartnerRequest: (requestId: string) => Promise<void>;
  hasPartner: () => boolean;
}
```

### State Shape

```typescript
{
  partner: {
    id: string,                // User ID
    email: string,
    displayName: string,       // Partner's name
    partnerId: string,         // Link to this user
    connectedAt: Date,
  } | null,

  isLoadingPartner: boolean,

  sentRequests: [
    {
      id: string,              // Request ID
      fromUserId: string,      // Current user
      toUserId: string,        // Target user
      status: 'pending' | 'accepted' | 'declined',
      createdAt: Date,
    }
  ],

  receivedRequests: [
    {
      // Same structure as sentRequests
    }
  ],

  isLoadingRequests: boolean,

  searchResults: [
    {
      id: string,              // User ID
      email: string,
      displayName: string,
      alreadyConnected?: boolean,
      requestPending?: boolean,
    }
  ],

  isSearching: boolean,
}
```

### Initial State

```typescript
partner: null,
isLoadingPartner: false,
sentRequests: [],
receivedRequests: [],
isLoadingRequests: false,
searchResults: [],
isSearching: false,
```

### Actions

#### loadPartner()

**Type**: Async  
**Source**: Supabase (partnerService)  
**Persistence**: NOT persisted (fresh load on mount)

**Process**:

1. Set `isLoadingPartner = true`
2. Fetch partner info via `partnerService.getPartner()`
3. Update `partner` state
4. Set `isLoadingPartner = false`

**Error Handling**: Logged → sets `partner = null` → continues

#### loadPendingRequests()

**Type**: Async  
**Source**: Supabase (partnerService)  
**Persistence**: NOT persisted (fresh load on mount)

**Process**:

1. Set `isLoadingRequests = true`
2. Fetch requests via `partnerService.getPendingRequests()`
3. Returns: `{ sent: [], received: [] }`
4. Update `sentRequests` + `receivedRequests`
5. Set `isLoadingRequests = false`

**Error Handling**: Logged → clears arrays → continues

#### searchUsers(query)

**Type**: Async  
**Input**: Query string (min 2 chars)  
**Output**: Populates `searchResults`

**Process**:

1. Validate query length ≥ 2
2. If invalid: clear results + return
3. Set `isSearching = true`
4. Search via `partnerService.searchUsers(query)`
5. Update `searchResults` state
6. Set `isSearching = false`

**Error Handling**: Logged → clears results → continues

#### clearSearch()

**Type**: Sync  
**Sets**: `searchResults = []`, `isSearching = false`

**Use Case**: User cancels search

#### sendPartnerRequest(toUserId)

**Type**: Async  
**Input**: Target user ID  
**Persistence**: Supabase

**Process**:

1. Send request via `partnerService.sendPartnerRequest(toUserId)`
2. Reload pending requests (shows new request in sentRequests)
3. Clear search results
4. Log success

**Error Handling**: Throws (allows UI error feedback)

#### acceptPartnerRequest(requestId)

**Type**: Async  
**Input**: Request ID  
**Persistence**: Supabase

**Process**:

1. Accept via `partnerService.acceptPartnerRequest(requestId)`
2. Reload partner info (should now show partner)
3. Reload pending requests (remove from receivedRequests)
4. Log success

**Error Handling**: Throws (allows UI error feedback)

#### declinePartnerRequest(requestId)

**Type**: Async  
**Input**: Request ID  
**Persistence**: Supabase

**Process**:

1. Decline via `partnerService.declinePartnerRequest(requestId)`
2. Reload pending requests (remove from receivedRequests)
3. Log success

**Error Handling**: Throws (allows UI error feedback)

#### hasPartner()

**Type**: Sync query  
**Returns**: boolean

**Logic**:

```typescript
return get().partner !== null;
```

### Persistence

- **What**: NOT persisted to LocalStorage
- **Where**: Supabase only
- **When**: Loaded fresh on app mount
- **Why**: Dynamic relational data

### Dependencies

**Cross-Slice**: None (self-contained)

**External**:

- `partnerService` (Supabase API)

---

## INTERACTIONS SLICE

### File

`src/stores/slices/interactionsSlice.ts`

### Purpose

Manages ephemeral poke/kiss interactions: sending, receiving, history, and Realtime subscription management via Supabase.

### State Interface

```typescript
export interface InteractionsSlice {
  // State
  interactions: Interaction[];
  unviewedCount: number;
  isSubscribed: boolean;

  // Actions
  sendPoke: (partnerId: string) => Promise<SupabaseInteractionRecord>;
  sendKiss: (partnerId: string) => Promise<SupabaseInteractionRecord>;
  markInteractionViewed: (id: string) => Promise<void>;
  getUnviewedInteractions: () => Interaction[];
  getInteractionHistory: (days?: number) => Interaction[];
  loadInteractionHistory: (limit?: number) => Promise<void>;
  subscribeToInteractions: () => Promise<() => void>;
  addIncomingInteraction: (record: SupabaseInteractionRecord) => void;
}
```

### State Shape

```typescript
{
  interactions: [
    {
      id: string,               // Supabase ID
      type: 'poke' | 'kiss',
      fromUserId: string,       // Sender
      toUserId: string,         // Receiver
      viewed: boolean,
      createdAt: Date,
    }
  ],

  unviewedCount: number,        // Unviewed received interactions
  isSubscribed: boolean,        // Realtime subscription active?
}
```

### Initial State

```typescript
interactions: [],
unviewedCount: 0,
isSubscribed: false,
```

### Actions

#### sendPoke(partnerId)

**Type**: Async  
**Input**: Partner user ID  
**Returns**: `SupabaseInteractionRecord`  
**Persistence**: Supabase

**Process**:

1. Validate interaction: `validateInteraction(partnerId, 'poke')`
2. Send via `interactionService.sendPoke(partnerId)`
3. Convert to local format: `toLocalInteraction()`
4. Optimistic UI update: add to beginning of interactions
5. Log success

**Error Handling**: Validation fails → throws error; Network → throws error

#### sendKiss(partnerId)

**Type**: Async  
**Input**: Partner user ID  
**Returns**: `SupabaseInteractionRecord`  
**Persistence**: Supabase

**Process**: Same as `sendPoke()`, different type

#### markInteractionViewed(id)

**Type**: Async  
**Input**: Interaction ID  
**Persistence**: Supabase (updates viewed flag)

**Process**:

1. Call `interactionService.markAsViewed(id)`
2. Update local interaction: `viewed = true`
3. Decrement `unviewedCount`
4. Log success

**Error Handling**: Throws (allows UI error feedback)

#### getUnviewedInteractions()

**Type**: Sync query  
**Returns**: `Interaction[]`

**Logic**:

```typescript
return get().interactions.filter((i) => !i.viewed);
```

**Note**: Filters for unviewed (doesn't filter by receiver)

#### getInteractionHistory(days?)

**Type**: Sync query  
**Input**: `days = 7` (default)  
**Returns**: `Interaction[]` (sorted newest first)

**Logic**:

```typescript
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - days);

return get()
  .interactions.filter((i) => i.createdAt >= cutoffDate)
  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
```

#### loadInteractionHistory(limit?)

**Type**: Async  
**Input**: `limit = 100` (max records)  
**Source**: Supabase (interactionService)  
**Persistence**: NOT persisted (fresh load)

**Process**:

1. Fetch history via `interactionService.getInteractionHistory(limit)`
2. Update `interactions` state
3. Calculate `unviewedCount` (all unviewed)
4. Update state
5. Log counts

**Error Handling**: Logged (graceful degradation)

#### subscribeToInteractions()

**Type**: Async  
**Returns**: Unsubscribe function  
**Purpose**: Real-time subscription via Supabase Realtime  
**Persistence**: Ephemeral (connection-based)

**Process**:

1. Get current user ID via `authService.getCurrentUserId()`
2. Subscribe via `interactionService.subscribeInteractions(callback)`
3. Callback: `addIncomingInteraction(record)`
4. Set `isSubscribed = true`
5. Return enhanced unsubscribe function that sets `isSubscribed = false`

**Error Handling**: Throws if user not authenticated

**Usage**:

```typescript
const unsubscribe = await subscribeToInteractions();
// Later: unsubscribe();
```

#### addIncomingInteraction(record)

**Type**: Sync  
**Input**: `SupabaseInteractionRecord` (from Realtime)  
**Purpose**: Handle incoming Realtime interaction event

**Process**:

1. Check if interaction already in state (prevent duplicates)
2. Convert to local format: `toLocalInteraction(record)`
3. Add to beginning of interactions
4. If not viewed: increment `unviewedCount`
5. Log addition

**Duplicate Prevention**: Checks `interactions.some((i) => i.id === record.id)`

### Conversion Function

```typescript
function toLocalInteraction(record: SupabaseInteractionRecord): Interaction {
  return {
    id: record.id,
    type: record.type as 'poke' | 'kiss',
    fromUserId: record.from_user_id,
    toUserId: record.to_user_id,
    viewed: record.viewed ?? false,
    createdAt: new Date(record.created_at ?? new Date()),
  };
}
```

### Validation

Input validation before sending:

```typescript
const validation = validateInteraction(partnerId, 'poke');
if (!validation.isValid) {
  throw new Error(validation.error || INTERACTION_ERRORS.INVALID_TYPE);
}
```

### Persistence

- **What**: NOT persisted to LocalStorage/IndexedDB
- **Where**: Supabase only
- **When**: Fetched fresh on init + Realtime updates
- **Why**: Ephemeral messaging (no historical persistence needed)

### Real-time Architecture

**Flow**:

1. `subscribeToInteractions()` establishes Realtime subscription
2. Supabase Realtime fires events on `interactions` table changes
3. Callback: `addIncomingInteraction(record)`
4. State updated with new interaction
5. UI re-renders automatically (Zustand subscription)

**Unsubscribe**: Closes connection + updates state

### Dependencies

**Cross-Slice**: None (self-contained)

**External**:

- `InteractionService` (Supabase CRUD + Realtime)
- `authService` (user authentication)
- `validateInteraction()` (input validation)

---

## NAVIGATION SLICE

### File

`src/stores/slices/navigationSlice.ts`

### Purpose

Manages view routing: tab/page switching with browser history integration.

### State Interface

```typescript
export type ViewType = 'home' | 'photos' | 'mood' | 'partner';

export interface NavigationSlice {
  // State
  currentView: ViewType;

  // Actions
  setView: (view: ViewType, skipHistory?: boolean) => void;
  navigateHome: () => void;
  navigatePhotos: () => void;
  navigateMood: () => void;
  navigatePartner: () => void;
}
```

### State Shape

```typescript
{
  currentView: 'home' | 'photos' | 'mood' | 'partner',
}
```

### Initial State

```typescript
currentView: 'home',
```

### Actions

#### setView(view, skipHistory?)

**Type**: Sync  
**Input**: ViewType, optional skipHistory flag  
**Purpose**: Change current view with optional history update

**Process**:

1. Update `currentView` state
2. If `!skipHistory`:
   - Map ViewType to URL path
   - Call `window.history.pushState({ view }, '', path)`
   - Log navigation
3. UI re-renders automatically

**View → URL Mapping**:

```typescript
{
  home: '/',
  photos: '/photos',
  mood: '/mood',
  partner: '/partner',
}
```

**skipHistory Use Case**:

- Called during `popstate` event handler
- Prevents duplicate history entries
- URL already updated by browser back button

#### navigateHome()

**Type**: Sync  
**Convenience**: `setView('home')`

#### navigatePhotos()

**Type**: Sync  
**Convenience**: `setView('photos')`

#### navigateMood()

**Type**: Sync  
**Convenience**: `setView('mood')`

#### navigatePartner()

**Type**: Sync  
**Convenience**: `setView('partner')`

### Browser History Integration

**Problem**: Zustand state and browser history can get out of sync

**Solution**:

1. Store route in both Zustand state + URL
2. On browser back/forward:
   - Listen to `popstate` event
   - Extract view from `event.state`
   - Call `setView(view, skipHistory=true)` to sync state
   - URL is already updated by browser

**Implementation** (in component, not in slice):

```typescript
useEffect(() => {
  const handlePopstate = (event: PopStateEvent) => {
    const view = event.state?.view || 'home';
    useAppStore.setState({ currentView: view }); // Skip history to prevent duplicate
  };

  window.addEventListener('popstate', handlePopstate);
  return () => window.removeEventListener('popstate', handlePopstate);
}, []);
```

### Persistence

- **What**: NOT persisted to LocalStorage
- **Where**: Browser URL (location.pathname)
- **When**: On app mount, read URL to restore view
- **How**: Component-level logic reads `window.location.pathname`

### Dependencies

**Cross-Slice**: None (self-contained)

**External**: Browser History API

---

## Cross-Slice Dependencies

### Dependency Graph

```
Settings Slice
  ├─ Calls: Messages.updateCurrentMessage()
  └─ Uses: Messages.messages (after init)

Messages Slice
  ├─ Reads: Settings.settings.relationship.startDate
  └─ No outgoing slice calls

Photos Slice
  └─ No dependencies

Mood Slice
  └─ No dependencies

Partner Slice
  └─ No dependencies

Interactions Slice
  └─ No dependencies

Navigation Slice
  └─ No dependencies
```

### Critical Dependencies

#### Settings → Messages

**Where**: `initializeApp()`

```typescript
// Settings Slice
initializeApp: async () => {
  // ...
  // Load messages from IndexedDB
  await storageService.getAllMessages();

  // Update current message to compute today's message
  if (state.updateCurrentMessage) {
    state.updateCurrentMessage(); // Calls Messages.updateCurrentMessage()
  }
};
```

**Why**: Messages need to be loaded before computing today's message

#### Messages → Settings

**Where**: `navigateToPreviousMessage()`, `updateCurrentMessage()`

```typescript
// Messages Slice
updateCurrentMessage: () => {
  const { messages, messageHistory, settings } = get();

  if (!settings || messages.length === 0) return;

  const availableDays = getAvailableHistoryDays(messageHistory, settings);
  // Uses settings.relationship.startDate to limit history
};
```

**Why**: History limit depends on relationship start date

### No Circular Dependencies

All dependencies are **unidirectional**:

- Settings → Messages (downward)
- Messages ← Settings (reads, no callback)

This prevents circular dependency issues.

### Optional Dependencies

Slices check if cross-slice methods exist before calling:

```typescript
// In Settings Slice
if (state.updateCurrentMessage) {
  state.updateCurrentMessage(); // Safe if method missing
}
```

This allows testing slices in isolation.

---

## Performance Optimizations

### 1. Memoization & Selectors

**Problem**: Zustand causes re-renders on ANY state change

**Solution**: Use selectors in components

```typescript
// Bad: Re-renders on every state change
const { messages, currentMessage } = useAppStore();

// Good: Re-renders only on messages/currentMessage change
const messages = useAppStore((state) => state.messages);
const currentMessage = useAppStore((state) => state.currentMessage);
```

### 2. Partialize Middleware

**Problem**: Persisting entire state wastes storage space

**Solution**: Selective persistence via `partialize`

```typescript
partialize: (state) => ({
  // Only persist critical data
  settings: state.settings,
  isOnboarded: state.isOnboarded,
  messageHistory: { ... },
  moods: state.moods,

  // NOT persisted:
  // - Large blobs (photos)
  // - Computed values (currentMessage)
  // - Transient state (interactions)
})
```

**Benefits**:

- LocalStorage: ~5-10KB (fits in size limit)
- IndexedDB: Unlimited (stores large data)
- Faster hydration (less to parse)

### 3. Async Load-on-Demand

**Problem**: Loading everything on init = slow startup

**Solution**: Lazy-load data as needed

```typescript
// On app init:
// - Load settings, messages (required)
// - Don't load photos, custom messages

// On demand:
// - loadPhotos() when Photos component mounts
// - loadCustomMessages() when Admin panel opens

// Background:
// - loadMoods() after init completes
// - fetchPartnerMoods() when Partner view shown
```

### 4. Map vs Array for Message History

**Problem**: Array lookup O(n), duplicate dates possible

**Solution**: Use Map for date → message ID

```typescript
// Before (Array):
// [{ date: "2025-11-16", id: 42 }, ...]
// Lookup: array.find((x) => x.date === date)  // O(n)

// After (Map):
// Map([["2025-11-16", 42], ...])
// Lookup: map.get(date)  // O(1)
```

**Trade-off**: Serialization complexity (Array ↔ Map conversion)

### 5. Filtering Rotation Pool

**Problem**: Including disabled custom messages = no change in daily rotation

**Solution**: Filter before rotation algorithm

```typescript
const rotationPool = messages.filter((m) => !m.isCustom || m.active !== false);
// Only includes:
// - Default messages (always)
// - Active custom messages
// Excludes:
// - Inactive custom messages (active = false)
```

### 6. Optimistic UI Updates

**Problem**: Network latency feels slow

**Solution**: Update state immediately, sync in background

```typescript
// In uploadPhoto()
1. Validate file
2. Compress image
3. Set loading state
4. Create Photo object
5. Save to IndexedDB (async)
6. Update state immediately (OPTIMISTIC)
7. If error: revert state
```

### 7. Batch Operations

**Problem**: Multiple state updates = multiple re-renders

**Solution**: Single `set()` call with multiple fields

```typescript
// Bad: 3 re-renders
set({ messages: [...] });
set({ messageHistory: {...} });
set({ currentMessage: msg });

// Good: 1 re-render
set({
  messages: [...],
  messageHistory: {...},
  currentMessage: msg,
});
```

### 8. Validation Caching

**Problem**: Validating same settings repeatedly

**Solution**: Validate on load, trust thereafter

```typescript
// Persist middleware validates ONCE on load
const validation = validateHydratedState(data.state);

// Consumer trusts state is valid after hydration
// (Unless user/API provides new data)
```

---

## Error Handling & Recovery

### Error Categories

| Category                | Handler                   | Recovery                         |
| ----------------------- | ------------------------- | -------------------------------- |
| **Hydration**           | `validateHydratedState()` | Clear localStorage, use defaults |
| **Validation**          | Zod schemas               | Throw ValidationError, revert UI |
| **Storage (IndexedDB)** | `try-catch` in actions    | Log error, set error state       |
| **Network (Supabase)**  | Slices catch + throw      | UI shows error notification      |
| **Initialization**      | Guards + try-catch        | Continue with defaults           |

### Hydration Failure Recovery

```
User loads app
  ↓
Persist middleware: getItem()
  ↓
validateHydratedState() → FAIL
  ↓
Clear localStorage
  ↓
Return null to Zustand
  ↓
Zustand uses initial state (all defaults)
  ↓
App continues with functional fallbacks
```

### Validation Failure Recovery

```
setSettings(invalidData)
  ↓
SettingsSchema.parse() → FAIL (Zod throws)
  ↓
Catch in setSettings()
  ↓
Log createValidationError()
  ↓
Re-throw ValidationError
  ↓
Component catches + shows error toast
  ↓
State unchanged (previous valid settings remain)
```

### IndexedDB Failure Recovery

```
uploadPhoto(file)
  ↓
photoStorageService.create() → FAIL
  ↓
Catch in uploadPhoto()
  ↓
Set photoError state
  ↓
Log error
  ↓
Re-throw for UI
  ↓
Component shows error
  ↓
State unchanged (photo not added)
```

### Initialization Guard: Double-Check

```typescript
// Module level (prevents concurrent/duplicate init)
let isInitializing = false;
let isInitialized = false;

initializeApp: async () => {
  if (isInitializing) {
    console.log('Skipping - already initializing');
    return; // StrictMode protection
  }
  if (isInitialized) {
    console.log('Skipping - already initialized');
    return; // Prevent re-initialization
  }

  isInitializing = true;
  try {
    // ... initialization logic
  } finally {
    isInitializing = false;
  }
};
```

**Why**: React StrictMode renders components twice in dev mode

---

## Initialization Sequence

### App Startup Flow

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

### Timing Details

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

### State During Initialization

| Phase                | settings | messages | isLoading |
| -------------------- | -------- | -------- | --------- |
| **Before Hydration** | default  | []       | false     |
| **After Hydration**  | saved    | []       | false     |
| **After IndexedDB**  | saved    | loaded   | false     |
| **Stable**           | saved    | loaded   | false     |

### Error During Initialization

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

## Summary Statistics

### Store Complexity

| Metric                       | Value                        |
| ---------------------------- | ---------------------------- |
| **Total Slices**             | 7                            |
| **Actions (Total)**          | ~65                          |
| **State Fields**             | ~40+                         |
| **Persistence Types**        | 2 (LocalStorage + IndexedDB) |
| **External Services**        | 10+                          |
| **Cross-Slice Dependencies** | 1 (Settings → Messages)      |

### Slice Breakdown

| Slice        | Actions | State Fields | Async  |
| ------------ | ------- | ------------ | ------ |
| Settings     | 7       | 2            | 1      |
| Messages     | 16      | 6            | 8      |
| Photos       | 8       | 5            | 4      |
| Mood         | 7       | 3            | 6      |
| Partner      | 8       | 6            | 5      |
| Interactions | 8       | 3            | 5      |
| Navigation   | 5       | 1            | 0      |
| **Total**    | **59**  | **26**       | **29** |

### Persistence Breakdown

| Data           | Size     | Storage                  | Schema Version |
| -------------- | -------- | ------------------------ | -------------- |
| settings       | 1-2KB    | LocalStorage             | v0             |
| messageHistory | 1-5KB    | LocalStorage             | v0             |
| moods          | 1-10KB   | LocalStorage + IndexedDB | v0             |
| messages       | Variable | IndexedDB                | Auto-increment |
| customMessages | Variable | IndexedDB                | Auto-increment |
| photos         | Variable | IndexedDB (Blobs)        | Auto-increment |
| interactions   | 0        | Ephemeral                | -              |

---

## Conclusion

The My-Love Zustand state management architecture demonstrates:

1. **Modularity**: 7 independent slices with single responsibilities
2. **Hybrid Persistence**: LocalStorage for small, fast data; IndexedDB for large data
3. **Async Support**: Rich support for IndexedDB + Supabase operations
4. **Error Recovery**: Graceful degradation with clear error logs
5. **Real-time Integration**: Supabase Realtime subscriptions for interactions
6. **Performance**: Selective persistence, lazy loading, optimistic updates
7. **Type Safety**: Full TypeScript support with interfaces and validation
8. **Offline Resilience**: Pending state tracking, background sync

The store is production-ready with comprehensive error handling, validation, and recovery mechanisms suitable for a multi-feature progressive web application.
