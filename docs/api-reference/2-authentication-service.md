# 2. Authentication Service

**Sources:**

- `src/api/authService.ts` -- Facade composing session + action services
- `src/api/auth/actionService.ts` -- Sign in, sign up, sign out, password reset, Google OAuth
- `src/api/auth/sessionService.ts` -- Session retrieval, user info, auth state change listener
- `src/api/auth/types.ts` -- Type definitions

## Architecture

The auth layer is split into two sub-services composed by a facade:

```
authService (facade)
  |-- sessionService  (read-only: session, user, auth status)
  |-- actionService   (mutations: sign in/up/out, password reset, OAuth)
```

The `authService` object re-exports all functions from both sub-services, providing a single import point. Individual sub-services can also be imported directly for narrower dependency surfaces.

## Types

```typescript
interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthResult {
  user: User | null; // Supabase User object
  session: Session | null; // Supabase Session object
  error: AuthError | null; // Supabase AuthError
}

interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
}
```

## Action Service Functions

### `signIn(credentials: AuthCredentials): Promise<AuthResult>`

Signs in with email/password via `supabase.auth.signInWithPassword()`.

**Side effects:**

- On success, stores the auth token in IndexedDB (`sw-auth` store) for Background Sync access via `storeAuthToken()`.

**Error handling:** Catches all errors; returns `{ user: null, session: null, error }`. Never throws.

---

### `signUp(credentials: AuthCredentials): Promise<AuthResult>`

Creates a new account via `supabase.auth.signUp()`.

**Error handling:** Same pattern as `signIn` -- returns error in result, never throws.

---

### `signOut(): Promise<void>`

Signs out via `supabase.auth.signOut()`.

**Side effects:**

- Clears the stored auth token from IndexedDB via `clearAuthToken()`.

**Error handling:** Throws on failure (unlike signIn/signUp which return errors).

---

### `resetPassword(email: string): Promise<AuthError | null>`

Sends a password reset email via `supabase.auth.resetPasswordForEmail()`.

**Redirect URL:** `${window.location.origin}${import.meta.env.BASE_URL}reset-password`

**Returns:** `null` on success, `AuthError` on failure.

---

### `signInWithGoogle(): Promise<AuthError | null>`

Initiates Google OAuth flow via `supabase.auth.signInWithOAuth()`.

**OAuth options:**

- `provider: 'google'`
- `redirectTo`: `${window.location.origin}${import.meta.env.BASE_URL}`
- `access_type: 'offline'` (enables refresh tokens)
- `prompt: 'consent'` (always shows consent screen)

**Returns:** `null` on success (redirect initiated), `AuthError` on failure.

## Session Service Functions

### `getSession(): Promise<Session | null>`

Retrieves the current session from Supabase auth. Returns `null` on error.

---

### `getUser(): Promise<User | null>`

Retrieves the current user via `supabase.auth.getUser()` (server-validated). Returns `null` on error.

---

### `getCurrentUserId(): Promise<string | null>`

Convenience wrapper: calls `getUser()` and returns `user.id`. Uses server-validated user data.

---

### `getCurrentUserIdOfflineSafe(): Promise<string | null>`

Convenience wrapper: calls `getSession()` and returns `session.user.id`. Uses locally-cached session data, so it works offline (unlike `getCurrentUserId` which calls the Supabase server).

---

### `getAuthStatus(): Promise<AuthStatus>`

Returns a composite object with `isAuthenticated`, `user`, and `session` fields.

---

### `onAuthStateChange(callback: (session: Session | null) => void): () => void`

Subscribes to Supabase auth state changes.

**Side effects on events:**

- `SIGNED_IN` / `TOKEN_REFRESHED`: Updates the stored auth token in IndexedDB via `storeAuthToken()`
- `SIGNED_OUT`: Clears the stored auth token via `clearAuthToken()`

**Returns:** An unsubscribe function that calls `subscription.unsubscribe()`.

## IndexedDB Integration

Auth tokens are persisted in the `sw-auth` IndexedDB store (key: `'current'`) to enable Background Sync in the service worker. The SW reads this token to authenticate Supabase REST API calls when the app is closed. Token structure:

```typescript
interface StoredAuthToken {
  id: 'current';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}
```
