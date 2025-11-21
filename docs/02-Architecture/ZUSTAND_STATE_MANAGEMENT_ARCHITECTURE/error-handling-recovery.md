# Error Handling & Recovery

## Error Categories

| Category                | Handler                   | Recovery                         |
| ----------------------- | ------------------------- | -------------------------------- |
| **Hydration**           | `validateHydratedState()` | Clear localStorage, use defaults |
| **Validation**          | Zod schemas               | Throw ValidationError, revert UI |
| **Storage (IndexedDB)** | `try-catch` in actions    | Log error, set error state       |
| **Network (Supabase)**  | Slices catch + throw      | UI shows error notification      |
| **Initialization**      | Guards + try-catch        | Continue with defaults           |

## Hydration Failure Recovery

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

## Validation Failure Recovery

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

## IndexedDB Failure Recovery

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

## Initialization Guard: Double-Check

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
