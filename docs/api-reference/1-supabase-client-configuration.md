# 1. Supabase Client Configuration

**Source:** `src/api/supabaseClient.ts`

## Overview

Provides a singleton, typed Supabase client instance used by all API services. The client is configured with environment variables and typed with the auto-generated `Database` generic from `src/types/database.types.ts`.

## Environment Variables

| Variable                                | Description              |
| --------------------------------------- | ------------------------ |
| `VITE_SUPABASE_URL`                     | Supabase project URL     |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon/public key |

Both variables are validated at module load time. If either is missing, the module throws an `Error` immediately, preventing the app from starting with a misconfigured backend.

## Client Instance

```typescript
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
```

### Configuration Options

| Option               | Value  | Purpose                                                               |
| -------------------- | ------ | --------------------------------------------------------------------- |
| `persistSession`     | `true` | Stores JWT in localStorage across page reloads                        |
| `autoRefreshToken`   | `true` | Automatically refreshes JWT before expiry                             |
| `detectSessionInUrl` | `true` | Detects OAuth callback tokens in URL hash (required for Google OAuth) |
| `eventsPerSecond`    | `10`   | Throttles Realtime events to 10/sec to prevent flooding               |

## Exported Functions

### `getPartnerId()`

```typescript
export const getPartnerId = async (): Promise<string | null>
```

Retrieves the current user's partner ID by querying the `users` table.

**Flow:**

1. Gets the current session via `supabase.auth.getSession()`
2. Extracts `currentUserId` from the session
3. Queries `users` table: `SELECT partner_id FROM users WHERE id = currentUserId`
4. Returns `partner_id` or `null`

**Supabase table:** `users` (column: `partner_id`)

**Error handling:** Returns `null` on any failure (unauthenticated, no user record, PGRST116 no rows, network error). Never throws.

---

### `getPartnerDisplayName()`

```typescript
export const getPartnerDisplayName = async (): Promise<string | null>
```

Fetches the partner's display name from the `users` table.

**Flow:**

1. Calls `getPartnerId()` to get the partner's UUID
2. If no partner ID, returns `null`
3. Queries `users` table: `SELECT display_name FROM users WHERE id = partnerId`
4. Returns `display_name` or `null`

**Supabase table:** `users` (column: `display_name`)

**Error handling:** Returns `null` on any failure. Never throws.

---

### `isSupabaseConfigured()`

```typescript
export const isSupabaseConfigured = (): boolean
```

Returns `true` if both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` environment variables are set. Synchronous check.

## Re-exports

```typescript
export type { Database } from '../types/database.types';
```

The `Database` type is re-exported for convenience so consumers can import it from the client module.
