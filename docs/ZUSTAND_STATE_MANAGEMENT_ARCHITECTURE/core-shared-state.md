# Core Shared State

## isLoading: boolean

**Purpose**: Global loading indicator during app initialization

**Initial Value**: `false`

**Updated By**:

- `initializeApp()` (Settings Slice)
  - Set to `true` when initialization starts
  - Set to `false` when IndexedDB is ready
  - Set to `false` on error

**Usage**: Loading spinners, disabled UI during initialization

## error: string | null

**Purpose**: Global error messages for unrecoverable failures

**Initial Value**: `null`

**Updated By**:

- `initializeApp()` (Settings Slice)
  - Hydration failures
  - IndexedDB initialization errors
- Network/Supabase errors propagated from slices

**Usage**: Error notifications, recovery UI

## \_\_isHydrated: boolean (Internal)

**Purpose**: Internal flag tracking Zustand persist hydration completion

**Initial Value**: `false` (set to `true` in `onRehydrateStorage`)

**Details**:

- Set by persist middleware after loading from localStorage
- Used by `initializeApp()` to verify state loading completed
- Not exposed to components (name starts with `__`)
- Checked synchronously during initialization

**Critical for**: Preventing race conditions between persist hydration and IndexedDB init

---
