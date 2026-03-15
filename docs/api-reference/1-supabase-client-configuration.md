# 1. Supabase Client Configuration

**Source:** `src/api/supabaseClient.ts`

## Purpose

Singleton Supabase client instance configured with typed `Database` generics, environment variable validation, and partner lookup helpers.

## Environment Variables

| Variable                                | Required | Description              |
| --------------------------------------- | -------- | ------------------------ |
| `VITE_SUPABASE_URL`                     | Yes      | Supabase project URL     |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes      | Supabase anon/public key |

Missing variables throw an `Error` at module load time with diagnostic output.

## Client Configuration

```typescript
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // OAuth callback detection
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);
```

## Exported Functions

### `supabase`

- **Type:** `SupabaseClient<Database>`
- Default export. Singleton instance used by all API modules.

### `getPartnerId(): Promise<string | null>`

Queries the `users` table for the current user's `partner_id`. Returns `null` if unauthenticated, no user record exists (`PGRST116`), or no partner is linked.

### `getPartnerDisplayName(): Promise<string | null>`

Fetches the partner's `display_name` from the `users` table. Calls `getPartnerId()` internally.

### `isSupabaseConfigured(): boolean`

Returns `true` if both env vars are set. Synchronous check.

## Re-exports

- `Database` type from `src/types/database.types.ts`

## Dependencies

- `@supabase/supabase-js` (`createClient`, `SupabaseClient`)
- `src/types/database.types` (generated types)
- `src/utils/logger`
