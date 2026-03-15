# 2. Authentication Service

**Sources:**
- `src/api/authService.ts` -- Facade re-exporting all auth functions
- `src/api/auth/sessionService.ts` -- Session/user queries, auth state listener
- `src/api/auth/actionService.ts` -- Sign in/up/out, password reset, Google OAuth
- `src/api/auth/types.ts` -- TypeScript interfaces

## Architecture

The auth layer is split into two focused modules composed by a facade:

- **sessionService** -- Read-only session queries (hot path, small import surface)
- **actionService** -- Mutation operations (sign in/out/up, OAuth, password reset)
- **authService** -- Facade that re-exports everything as a single object

## Types

```typescript
interface AuthCredentials { email: string; password: string; }
interface AuthResult { user: User | null; session: Session | null; error: AuthError | null; }
interface AuthStatus { isAuthenticated: boolean; user: User | null; session: Session | null; }
```

## Session Service (`sessionService`)

### `getSession(): Promise<Session | null>`
Calls `supabase.auth.getSession()`. Returns `null` on error.

### `getUser(): Promise<User | null>`
Calls `supabase.auth.getUser()`. Server-verified user. Returns `null` on error.

### `getCurrentUserId(): Promise<string | null>`
Shorthand: calls `getUser()`, returns `user.id`.

### `getCurrentUserIdOfflineSafe(): Promise<string | null>`
Uses `getSession()` instead of `getUser()` -- works offline (cached JWT). Returns `session.user.id`.

### `getAuthStatus(): Promise<AuthStatus>`
Returns `{ isAuthenticated, user, session }`.

### `onAuthStateChange(callback): () => void`
Subscribes to `supabase.auth.onAuthStateChange`. On `SIGNED_IN` / `TOKEN_REFRESHED`, stores auth token in IndexedDB (`sw-auth` store) for Background Sync. On `SIGNED_OUT`, clears the token. Returns unsubscribe function.

## Action Service (`actionService`)

### `signIn(credentials: AuthCredentials): Promise<AuthResult>`
Email/password sign-in via `supabase.auth.signInWithPassword()`. Stores auth token in IndexedDB on success.

### `signUp(credentials: AuthCredentials): Promise<AuthResult>`
Email/password sign-up via `supabase.auth.signUp()`.

### `signOut(): Promise<void>`
Calls `supabase.auth.signOut()`, clears IndexedDB auth token. Throws on failure.

### `resetPassword(email: string): Promise<AuthError | null>`
Sends password reset email. Redirect URL: `{origin}{BASE_URL}reset-password`.

### `signInWithGoogle(): Promise<AuthError | null>`
Initiates Google OAuth with `access_type: 'offline'` and `prompt: 'consent'`. Redirects to `{origin}{BASE_URL}`.

## Dependencies

- `src/api/supabaseClient`
- `src/sw-db` (`storeAuthToken`, `clearAuthToken`)
- `src/utils/logger`
