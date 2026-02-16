# Authentication Flow

## Overview

My-Love uses **Supabase Auth** with two sign-in methods: email/password and Google OAuth. Authentication state is managed at the `App.tsx` level via local React state, not inside the Zustand store. A post-login display name setup step handles new OAuth users who lack a `display_name` in their `user_metadata`.

## Sign-In Methods

| Method | Function | Module |
|---|---|---|
| Email/Password | `signIn(credentials)` | `src/api/auth/actionService.ts` |
| Google OAuth | `signInWithGoogle()` | `src/api/auth/actionService.ts` |
| Sign Up | `signUp(credentials)` | `src/api/auth/actionService.ts` |
| Password Reset | `resetPassword(email)` | `src/api/auth/actionService.ts` |
| Sign Out | `signOut()` | `src/api/auth/actionService.ts` |

### Email/Password Sign-In

```typescript
export const signIn = async (credentials: AuthCredentials): Promise<AuthResult> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (data.session) {
    await storeAuthToken({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0,
      userId: data.user?.id ?? '',
    });
  }

  return { user: data.user, session: data.session, error: null };
};
```

On successful sign-in, the auth token is stored in IndexedDB (`sw-auth` store) so the Service Worker can use it for Background Sync when the app window is closed.

### Google OAuth

```typescript
export const signInWithGoogle = async (): Promise<AuthError | null> => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  return error;
};
```

The OAuth flow redirects to Google and back to the app's base URL. After redirect, Supabase handles session creation automatically.

## Session Management

### Session Service (`src/api/auth/sessionService.ts`)

| Function | Purpose |
|---|---|
| `getSession()` | Get current Supabase session from client cache |
| `getUser()` | Validate session server-side via `auth.getUser()` |
| `getCurrentUserId()` | Server-validated user ID |
| `getCurrentUserIdOfflineSafe()` | Session-based user ID (works offline) |
| `getAuthStatus()` | Combined auth check returning `{ isAuthenticated, user, session }` |
| `onAuthStateChange(callback)` | Subscribe to auth events with automatic token storage |

### Offline-Safe vs Server-Validated

Two user ID retrieval strategies exist:

```typescript
// Server-validated (requires network)
export const getCurrentUserId = async (): Promise<string | null> => {
  const user = await getUser(); // calls supabase.auth.getUser()
  return user?.id ?? null;
};

// Offline-safe (uses cached session)
export const getCurrentUserIdOfflineSafe = async (): Promise<string | null> => {
  const session = await getSession(); // calls supabase.auth.getSession()
  return session?.user?.id ?? null;
};
```

The mood slice uses `getCurrentUserIdOfflineSafe` for write operations that may happen offline.

## Auth State Change Listener

The `onAuthStateChange` function subscribes to Supabase auth events and keeps the IndexedDB auth token in sync:

```typescript
export const onAuthStateChange = (callback: (session: Session | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
      await storeAuthToken({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at ?? 0,
        userId: session.user?.id ?? '',
      });
    }

    if (event === 'SIGNED_OUT') {
      await clearAuthToken();
    }

    callback(session);
  });

  return () => subscription.unsubscribe();
};
```

This ensures the Service Worker always has a fresh token for Background Sync.

## App-Level Auth Flow (`App.tsx`)

The `App` component manages authentication through a sequence of gates:

```
1. authLoading === true         -> Loading spinner ("Loading...")
2. session === null             -> LoginScreen
3. needsDisplayName === true    -> DisplayNameSetup
4. isLoading === true           -> Data loading spinner ("Loading your data...")
5. showSplash === true          -> WelcomeSplash
6. showAdmin === true           -> AdminPanel
7. default                      -> Main app (home view, navigation, etc.)
```

### Display Name Check

After OAuth sign-up, the user may not have a `display_name`:

```typescript
if (newSession?.user) {
  const hasDisplayName = newSession.user.user_metadata?.display_name;
  setNeedsDisplayName(!hasDisplayName);
}
```

The `DisplayNameSetup` modal blocks the app until the user provides a display name.

### Initialization Guard

App initialization only runs once per session establishment:

```typescript
useEffect(() => {
  if (!hasInitialized.current && session) {
    hasInitialized.current = true;
    initializeApp();
    // ...migration and storage tasks
  }
}, [session]);
```

The `useRef` prevents double initialization in React StrictMode.

## `useAuth` Hook (`src/hooks/useAuth.ts`)

A standalone hook for components that need auth state:

```typescript
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, isLoading, error };
}
```

## Token Storage for Background Sync

Auth tokens are stored in IndexedDB (`sw-auth` store) so the Service Worker can authenticate REST API calls:

```typescript
// sw-db.ts
interface AuthTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}
```

The Service Worker checks token expiry before syncing:

```typescript
const now = Math.floor(Date.now() / 1000);
if (authToken.expiresAt && authToken.expiresAt < now + 300) {
  // Token expired - skip sync, let app refresh token on next open
  return;
}
```

## Sign Out

Sign-out clears both the Supabase session and the IndexedDB auth token:

```typescript
export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  await clearAuthToken();
};
```

The `App.tsx` wraps sign-out with a loading guard (`isSigningOut`) to prevent double-clicks.
