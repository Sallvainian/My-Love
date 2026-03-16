# Auth Slice

**File:** `src/stores/slices/authSlice.ts`
**Interface:** `AuthSlice`

## Purpose

Single source of truth for authenticated user identity across all slices. Populated by `onAuthStateChange` in App.tsx. All other slices read `userId` synchronously via `get().userId` instead of making async auth calls.

## State

| Field             | Type             | Default | Persisted | Description                             |
| ----------------- | ---------------- | ------- | --------- | --------------------------------------- |
| `userId`          | `string \| null` | `null`  | No        | Logged-in user's Supabase auth ID       |
| `userEmail`       | `string \| null` | `null`  | No        | User's email for display purposes       |
| `isAuthenticated` | `boolean`        | `false` | No        | Whether the user is currently logged in |

## Actions

| Action        | Signature                                                  | Description                               |
| ------------- | ---------------------------------------------------------- | ----------------------------------------- |
| `setAuthUser` | `(userId: string \| null, email?: string \| null) => void` | Sets user identity from auth state change |
| `clearAuth`   | `() => void`                                               | Clears all auth state on sign-out         |

## Usage Pattern

App.tsx populates auth state on startup and auth state changes:

```typescript
// In onAuthStateChange callback:
const { setAuthUser, clearAuth } = useAppStore.getState();
if (session?.user) {
  setAuthUser(session.user.id, session.user.email);
} else {
  clearAuth();
}
```

All slices that need the current user ID read it synchronously:

```typescript
const userId = get().userId;
if (!userId) throw new Error('User not authenticated');
```

## Cross-Slice Dependencies

- **No dependencies on other slices** -- this is a foundational slice
- **Read by:** MoodSlice (`addMoodEntry`, `updateMoodEntry`), InteractionsSlice (`sendPoke`, `sendKiss`, `loadInteractionHistory`), NotesSlice (`fetchNotes`, `sendNote`), ScriptureSlice (`loadSession`, `selectRole`, `onBroadcastReceived`), PhotosSlice (`uploadPhoto`)

## Notes

- Not persisted -- derived from Supabase session on each app load
- Replaces the previous pattern of calling `supabase.auth.getUser()` in each slice action
- Spread second in `useAppStore.ts` (after AppSlice) since other slices depend on it
