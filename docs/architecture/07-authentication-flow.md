# Authentication Flow

## Overview

Authentication is handled by Supabase Auth with email/password and Google OAuth. The app expects exactly two users linked via the `partner_id` column in the `users` table. Partner detection is automatic once both users exist.

## Auth Architecture

### Client Setup

The Supabase client (`src/api/supabaseClient.ts`) is configured with:

```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Session stored in localStorage
    autoRefreshToken: true, // JWT auto-refresh before expiry
    detectSessionInUrl: true, // OAuth callback detection
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

| File                | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `sessionService.ts` | Session management, offline-safe user ID retrieval |
| `actionService.ts`  | Sign-in, sign-up, sign-out, Google OAuth actions   |
| `types.ts`          | Auth-related type definitions                      |

#### Offline-Safe Authentication

`getCurrentUserIdOfflineSafe()` from `sessionService.ts` retrieves the user ID from the cached Supabase session without making a network request. This is used by the mood tracking system to create entries while offline:

```typescript
export async function getCurrentUserIdOfflineSafe(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
```

### Service Worker Auth

The service worker needs auth tokens for background sync. The `sw-db.ts` file provides:

- `storeAuthToken(token)` -- Writes JWT to the `sw-auth` IndexedDB store
- `getAuthToken()` -- Reads JWT for Supabase REST API calls during background sync
- `clearAuthToken()` -- Removes JWT on sign-out

The main app stores the auth token to IndexedDB whenever the session changes (on `SIGNED_IN` and `TOKEN_REFRESHED` events), keeping the service worker's copy up to date. The token is cleared on `SIGNED_OUT`.

## Sentry User Context (Epic 4 Hardening)

On successful authentication, `setSentryUser(userId, partnerId)` sets the Sentry user context with the UUID and partner ID tag. On sign-out, `clearSentryUser()` removes the context. No PII (email, IP) is sent to Sentry -- the `beforeSend` hook strips these fields:

```typescript
// src/config/sentry.ts
setSentryUser(userId: string, partnerId?: string | null): void {
  Sentry.setUser({ id: userId });
  if (partnerId) Sentry.setTag('partner_id', partnerId);
}

clearSentryUser(): void {
  Sentry.setUser(null);
}
```

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
User enters email + password (or taps "Sign in with Google")
    |
    v
supabase.auth.signInWithPassword() or supabase.auth.signInWithOAuth({ provider: 'google' })
    |
    v
onAuthStateChange fires with SIGNED_IN event
    |
    v
storeAuthToken() saves JWT to IndexedDB (for SW background sync)
    |
    v
setSentryUser(userId, partnerId)  // Set Sentry context (UUID only, no PII)
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
const { data } = await supabase.from('users').select('partner_id').eq('id', currentUserId).single();
return data?.partner_id ?? null;
```

The `getPartnerDisplayName()` function fetches the partner's `display_name` from the same table using the partner ID.

## Row-Level Security

All Supabase tables have RLS enabled. Policies reference `auth.uid()` to restrict access to the authenticated user's own data and their partner's shared data (where applicable).

## Auth Guards (Epic 4 Hardening)

Every store slice action that calls Supabase validates authentication first via `getCurrentUserIdOfflineSafe()`. This prevents unauthenticated API calls from hitting Supabase RLS policies and returning confusing errors. See [Architecture Patterns - Pattern 9](./03-architecture-patterns.md#pattern-9-auth-guards-epic-4-hardening) for details.

## Related Documentation

- [Architecture Patterns](./03-architecture-patterns.md)
- [Security Model](./13-security-model.md)
- [Offline Strategy](./12-offline-strategy.md)
- [Error Handling](./17-error-handling.md)
