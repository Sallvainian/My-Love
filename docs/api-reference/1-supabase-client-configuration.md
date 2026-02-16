# 1. Supabase Client Configuration

**Source:** `src/api/supabaseClient.ts`

## Overview

The Supabase client is a **singleton** instance typed against the auto-generated `Database` schema from `src/types/database.types.ts`. It is imported by every API module and provides access to Auth, Postgres, Storage, and Realtime.

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon/public key | Yes |

The module throws immediately at import time if either variable is missing, logging which are present/absent.

## Client Configuration

```typescript
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,        // Sessions survive page reload (localStorage)
      autoRefreshToken: true,      // JWT auto-refresh before expiry
      detectSessionInUrl: true,    // OAuth callback detection (Google)
    },
    realtime: {
      params: {
        eventsPerSecond: 10,       // Throttle to 10 realtime events/second
      },
    },
  }
);
```

## Exported Members

### `supabase`

```typescript
export const supabase: SupabaseClient<Database>
```

The singleton client instance. All API modules import this for database queries, auth operations, storage uploads, and realtime subscriptions.

### `getPartnerId()`

```typescript
export const getPartnerId = async (): Promise<string | null>
```

Queries the `users` table for the current user's `partner_id` column.

**Flow:**
1. Get current session via `supabase.auth.getSession()`
2. Extract `user.id` from session
3. Query `users` table: `SELECT partner_id WHERE id = currentUserId`
4. Return `partner_id` or `null`

**Error handling:**
- Returns `null` if not authenticated
- Returns `null` if no users table record (`PGRST116`)
- Returns `null` on any query error (graceful degradation)

### `getPartnerDisplayName()`

```typescript
export const getPartnerDisplayName = async (): Promise<string | null>
```

Fetches the partner's `display_name` from the `users` table.

**Flow:**
1. Call `getPartnerId()` to get partner UUID
2. Query `users` table: `SELECT display_name WHERE id = partnerId`
3. Return `display_name` or `null`

**Error handling:** Returns `null` on any failure.

### `isSupabaseConfigured()`

```typescript
export const isSupabaseConfigured = (): boolean
```

Returns `true` if both `supabaseUrl` and `supabaseAnonKey` are truthy. Synchronous check.

### `Database` type

```typescript
export type { Database } from '../types/database.types';
```

Re-exported for convenience. The `Database` type is auto-generated from the Supabase schema using `supabase gen types typescript --local`.
