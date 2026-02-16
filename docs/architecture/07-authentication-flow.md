# Authentication Flow

## Overview

Authentication is handled by Supabase Auth with email/password credentials. The app expects exactly two users linked via the `partner_id` column in the `users` table. Partner detection is automatic once both users exist.

## Auth Architecture

### Client Setup

The Supabase client (`src/api/supabaseClient.ts`) is configured with:

```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // Session stored in localStorage
    autoRefreshToken: true,     // JWT auto-refresh before expiry
    detectSessionInUrl: true,   // OAuth callback detection
  },
});
```

### Auth Hook (`src/hooks/useAuth.ts`)

The `useAuth` hook provides the authentication state to `App.tsx`:

```typescript
const { user, loading } = useAuth();
```

It performs two operations:
1. **Initial check**: Calls `supabase.auth.getUser()` on mount to verify the current session.
2. **Listener**: Subscribes to `supabase.auth.onAuthStateChange()` for session changes (sign-in, sign-out, token refresh).

The hook returns the authenticated `User` object or `null` if not signed in.

### Auth Services

Authentication logic is split across three files in `src/api/auth/`:

| File | Purpose |
|------|---------|
| `sessionService.ts` | Session management, offline-safe user ID retrieval |
| `actionService.ts` | Sign-in, sign-up, sign-out actions |
| `types.ts` | Auth-related type definitions |

#### Offline-Safe Authentication

`getCurrentUserIdOfflineSafe()` from `sessionService.ts` retrieves the user ID from the cached Supabase session without making a network request. This is used by the mood tracking system to create entries while offline:

```typescript
export async function getCurrentUserIdOfflineSafe(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
```

### Service Worker Auth

The service worker needs auth tokens for background sync. The `sw-db.ts` file provides:

- `storeAuthToken(token)` -- Writes JWT to the `sw-auth` IndexedDB store
- `getAuthToken()` -- Reads JWT for Supabase REST API calls during background sync
- `clearAuthToken()` -- Removes JWT on sign-out

The main app stores the auth token to IndexedDB whenever the session changes, keeping the service worker's copy up to date.

## Login Flow

```
App.tsx renders
    |
    v
useAuth() -> supabase.auth.getUser()
    |
    v
user === null? -> Render <LoginScreen />
    |
    v
User enters email + password
    |
    v
supabase.auth.signInWithPassword({ email, password })
    |
    v
onAuthStateChange fires with SIGNED_IN event
    |
    v
useAuth updates user state
    |
    v
App.tsx checks user.display_name
    |
    v
No display name? -> Render <DisplayNameSetup />
    |
    v
Has display name? -> Render main app + call initializeApp()
```

## Partner Detection

The `getPartnerId()` function in `supabaseClient.ts` queries the `users` table for the current user's `partner_id`:

```typescript
const { data } = await supabase
  .from('users')
  .select('partner_id')
  .eq('id', currentUserId)
  .single();
return data?.partner_id ?? null;
```

The `getPartnerDisplayName()` function fetches the partner's `display_name` from the same table using the partner ID.

## Row-Level Security

All Supabase tables have RLS enabled. Policies reference `auth.uid()` to restrict access to the authenticated user's own data and their partner's shared data (where applicable).

## Related Documentation

- [Architecture Patterns](./03-architecture-patterns.md)
- [Security Model](./13-security-model.md)
- [Offline Strategy](./12-offline-strategy.md)
