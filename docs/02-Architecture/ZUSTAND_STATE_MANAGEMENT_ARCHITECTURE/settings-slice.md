# SETTINGS SLICE

## File

`src/stores/slices/settingsSlice.ts`

## Purpose

Manages app settings, user preferences, onboarding state, and app initialization orchestration.

## State Interface

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

## State Shape

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

## Initial State

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

## Actions

### initializeApp()

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

### setSettings(settings)

**Type**: Sync action  
**Validation**: Zod SettingsSchema validation

**Process**:

1. Validate settings against SettingsSchema
2. If valid: set to state
3. If invalid: log Zod error → throw ValidationError

**Persistence**: Triggers LocalStorage write

### updateSettings(updates)

**Type**: Sync action  
**Validation**: Zod SettingsSchema validation

**Process**:

1. Merge updates into current settings
2. Validate merged object
3. If valid: set to state
4. If invalid: throw ValidationError

**Use Case**: Partial updates (e.g., just theme)

### setOnboarded(onboarded)

**Type**: Sync action  
**Sets**: `isOnboarded` boolean  
**Persistence**: Triggers LocalStorage write

### addAnniversary(anniversary)

**Type**: Sync action  
**Input**: `Omit<Anniversary, 'id'>`

**Process**:

1. Generate new ID = max(existing IDs) + 1
2. Create Anniversary object with ID
3. Append to settings.relationship.anniversaries
4. Update state

**Immutable Pattern**: Shallow copy of settings object

### removeAnniversary(id)

**Type**: Sync action  
**Filters**: Out anniversary with matching ID  
**Immutable**: Creates new array and settings object

## Validation

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

## Persistence

- **What**: `settings` + `isOnboarded`
- **Where**: LocalStorage (my-love-storage)
- **When**: Automatic on each update
- **How**: JSON serialization

## Dependencies

**Cross-Slice**:

- Calls `updateCurrentMessage()` on Messages slice after loading messages
- Coordinates with Messages slice initialization

**External**:

- `storageService` (IndexedDB initialization)
- `defaultMessages` (message population)
- `SettingsSchema` (Zod validation)

---
