# 2. Authentication API

**Module:** `src/api/authService.ts`
**Singleton export:** `authService`

All methods are exported individually and also as properties of the `authService` singleton object.

## Types

```typescript
interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
}
```

## Methods

### `signIn(credentials)`

```typescript
async signIn(credentials: AuthCredentials): Promise<AuthResult>
```

- **Purpose:** Authenticate with email/password via `supabase.auth.signInWithPassword`.
- **Side effects:** On success, stores auth token in IndexedDB for Background Sync access (`storeAuthToken`).
- **Error handling:** Returns `{ user: null, session: null, error }` on failure; never throws.

---

### `signUp(credentials)`

```typescript
async signUp(credentials: AuthCredentials): Promise<AuthResult>
```

- **Purpose:** Register a new user via `supabase.auth.signUp`.
- **Error handling:** Same pattern as `signIn` -- returns error in result, never throws.

---

### `signOut()`

```typescript
async signOut(): Promise<void>
```

- **Purpose:** End the session via `supabase.auth.signOut`.
- **Side effects:** Clears auth token from IndexedDB (`clearAuthToken`).
- **Error handling:** Throws on failure (callers must catch).

---

### `getSession()`

```typescript
async getSession(): Promise<Session | null>
```

- **Purpose:** Read the cached session from local storage. Works offline.
- **Returns:** Session object or `null`.

---

### `getUser()`

```typescript
async getUser(): Promise<User | null>
```

- **Purpose:** Network-validated user lookup via `supabase.auth.getUser`.
- **Returns:** User object or `null`.

---

### `getCurrentUserId()`

```typescript
async getCurrentUserId(): Promise<string | null>
```

- **Purpose:** Convenience wrapper. Returns `user.id` from `getUser()`.
- **Use case:** Database operations requiring server-validated identity.

---

### `getCurrentUserIdOfflineSafe()`

```typescript
async getCurrentUserIdOfflineSafe(): Promise<string | null>
```

- **Purpose:** Uses cached session (no network call). Safe for offline IndexedDB writes.
- **Returns:** User ID from session, or `null`.

---

### `getAuthStatus()`

```typescript
async getAuthStatus(): Promise<AuthStatus>
```

- **Purpose:** Composite check returning `isAuthenticated`, `user`, and `session`.

---

### `onAuthStateChange(callback)`

```typescript
onAuthStateChange(callback: (session: Session | null) => void): () => void
```

- **Purpose:** Subscribe to Supabase auth events (`SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`).
- **Side effects:** Automatically stores/clears auth token in IndexedDB on state transitions.
- **Returns:** Unsubscribe function.

---

### `resetPassword(email)`

```typescript
async resetPassword(email: string): Promise<AuthError | null>
```

- **Purpose:** Send password reset email via `supabase.auth.resetPasswordForEmail`.
- **Redirect:** `{origin}{BASE_URL}reset-password`.
- **Returns:** `AuthError` on failure, `null` on success.

---

### `signInWithGoogle()`

```typescript
async signInWithGoogle(): Promise<AuthError | null>
```

- **Purpose:** Initiate Google OAuth flow via `supabase.auth.signInWithOAuth`.
- **Parameters sent to Google:** `access_type: 'offline'`, `prompt: 'consent'`.
- **Redirect:** `{origin}{BASE_URL}`.
- **Returns:** `AuthError` on failure, `null` if redirect initiated.

---
