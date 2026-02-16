# 1. Supabase Client Configuration

**Module:** `src/api/supabaseClient.ts`

## Client Initialization

The Supabase client is a singleton typed against the generated `Database` schema. It reads configuration from environment variables and throws immediately if they are missing.

| Environment Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon (publishable) key |

**Client Options:**

```typescript
{
  auth: {
    persistSession: true,        // Sessions survive page reload
    autoRefreshToken: true,      // JWT auto-refresh before expiry
    detectSessionInUrl: true,    // OAuth callback detection
  },
  realtime: {
    params: {
      eventsPerSecond: 10,       // Throttle realtime events
    },
  },
}
```

## Exported Functions

### `supabase`

```typescript
export const supabase: SupabaseClient<Database>
```

Singleton client instance. Used by all API modules for database, auth, storage, and realtime operations.

---

### `getPartnerId()`

```typescript
export const getPartnerId = async (): Promise<string | null>
```

- **Purpose:** Query the `users` table for the current user's `partner_id`.
- **Returns:** Partner UUID, or `null` if not authenticated / not connected.
- **Error handling:** Returns `null` on any failure. Handles `PGRST116` (no rows) gracefully.

---

### `getPartnerDisplayName()`

```typescript
export const getPartnerDisplayName = async (): Promise<string | null>
```

- **Purpose:** Fetch the partner's `display_name` from the `users` table.
- **Returns:** Display name string, or `null` if no partner or lookup fails.
- **Depends on:** `getPartnerId()` internally.

---

### `isSupabaseConfigured()`

```typescript
export const isSupabaseConfigured = (): boolean
```

- **Purpose:** Verify both environment variables are present.
- **Returns:** `true` if URL and anon key are set.

---
