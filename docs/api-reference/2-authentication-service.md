# 2. Authentication Service

**Sources:**
- `src/api/authService.ts` (facade)
- `src/api/auth/actionService.ts` (sign-in, sign-up, sign-out, reset, OAuth)
- `src/api/auth/sessionService.ts` (session queries, state listener)
- `src/api/auth/types.ts` (interfaces)

## Architecture

The auth layer uses a **facade pattern**. The top-level `authService` object composes both `actionService` and `sessionService`, presenting a unified API while allowing hot paths to import only the narrow surface they need.

```
authService (facade)
  ├── actionService: signIn, signUp, signOut, resetPassword, signInWithGoogle
  └── sessionService: getSession, getUser, getCurrentUserId, getCurrentUserIdOfflineSafe,
                      getAuthStatus, onAuthStateChange
```

## Types

**Source:** `src/api/auth/types.ts`

```typescript
interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthResult {
  user: User | null;       // @supabase/supabase-js User
  session: Session | null; // @supabase/supabase-js Session
  error: AuthError | null; // @supabase/supabase-js AuthError
}

interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
}
```

## Action Service Methods

### `signIn(credentials: AuthCredentials): Promise<AuthResult>`

Signs in with email and password via `supabase.auth.signInWithPassword()`.

**Side effect:** On success, stores the auth token in IndexedDB (`sw-auth` store) for Background Sync service worker access using `storeAuthToken()` from `sw-db.ts`. The stored token includes `accessToken`, `refreshToken`, `expiresAt`, and `userId`.

### `signUp(credentials: AuthCredentials): Promise<AuthResult>`

Registers a new user via `supabase.auth.signUp()`. Does not store tokens (user must sign in after email confirmation).

### `signOut(): Promise<void>`

Signs out via `supabase.auth.signOut()`.

**Side effect:** Clears the auth token from IndexedDB using `clearAuthToken()` from `sw-db.ts`.

**Throws:** Re-throws if `supabase.auth.signOut()` fails.

### `resetPassword(email: string): Promise<AuthError | null>`

Sends a password reset email via `supabase.auth.resetPasswordForEmail()`.

**Redirect URL:** `${window.location.origin}${import.meta.env.BASE_URL}reset-password`

**Returns:** `null` on success, `AuthError` on failure.

### `signInWithGoogle(): Promise<AuthError | null>`

Initiates Google OAuth flow via `supabase.auth.signInWithOAuth()`.

**Configuration:**
```typescript
{
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    queryParams: {
      access_type: 'offline',  // Request refresh token
      prompt: 'consent',       // Always show consent screen
    },
  },
}
```

**Returns:** `null` on success (redirects to Google), `AuthError` on failure.

## Session Service Methods

### `getSession(): Promise<Session | null>`

Retrieves the current session from `supabase.auth.getSession()`. Returns `null` if no session or on error.

### `getUser(): Promise<User | null>`

Retrieves the current user via `supabase.auth.getUser()`. This makes a **server call** to validate the JWT, unlike `getSession()` which reads the local cache.

### `getCurrentUserId(): Promise<string | null>`

Convenience method. Calls `getUser()` and returns `user.id`. Server-validated.

### `getCurrentUserIdOfflineSafe(): Promise<string | null>`

Returns the user ID from the **cached session** (no network call). Calls `getSession()` and returns `session.user.id`. Use this when offline operation is needed.

### `getAuthStatus(): Promise<AuthStatus>`

Returns the full auth status object:

```typescript
{
  isAuthenticated: boolean,  // true if session exists
  user: User | null,
  session: Session | null,
}
```

### `onAuthStateChange(callback: (session: Session | null) => void): () => void`

Subscribes to auth state changes via `supabase.auth.onAuthStateChange()`.

**Side effects on events:**
- `SIGNED_IN` or `TOKEN_REFRESHED`: Stores/updates auth token in IndexedDB
- `SIGNED_OUT`: Clears auth token from IndexedDB

**Returns:** Unsubscribe function. Call it on component unmount to prevent memory leaks.

## Unified authService Object

```typescript
export const authService = {
  signIn, signUp, signOut,
  getSession, getUser,
  getCurrentUserId, getCurrentUserIdOfflineSafe,
  getAuthStatus, onAuthStateChange,
  resetPassword, signInWithGoogle,
};
```

All methods are also available as individual named exports for tree-shaking.
