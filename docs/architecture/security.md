# Security

## Security Layers

| Layer | Mechanism | Implementation |
|---|---|---|
| **Authentication** | Supabase Auth | Email/password + Google OAuth |
| **Authorization** | Row Level Security (RLS) | All tables enforce partner-pair access |
| **Transport** | HTTPS | Supabase enforces TLS |
| **Token Storage** | IndexedDB | `sw-auth` store for Background Sync tokens |
| **Input Validation** | Zod schemas | Runtime validation at service boundaries |
| **Content Security** | DOMPurify | HTML sanitization for user content |

## Row Level Security (RLS)

All Supabase tables enforce RLS restricting access to authenticated partner pairs. Users can only read and write data that belongs to them or their connected partner.

Tables with RLS:

| Table | Policy Summary |
|---|---|
| `moods` | User can CRUD own moods |
| `photos` | User can CRUD own photos |
| `love_notes` | User can read/write messages to/from their partner |
| `interactions` | User can read interactions sent to them, create interactions to partner |
| `partner_requests` | User can read requests involving them, create requests |
| `profiles` | User can read all profiles (for search), update own profile |
| `scripture_sessions` | User can access sessions they participate in |
| `scripture_reflections` | User can access reflections for their sessions |
| `scripture_bookmarks` | User can access bookmarks for their sessions |
| `scripture_messages` | User can access messages for their sessions |

## Authentication Token Handling

### Browser (Supabase Client)

Supabase JS client manages tokens automatically via `localStorage` (keys prefixed with `sb-`). Token refresh happens transparently on API calls.

### Service Worker (IndexedDB)

The SW cannot access the Supabase JS client, so tokens are stored explicitly:

```typescript
interface AuthTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}
```

Token is updated on:
- `SIGNED_IN` event
- `TOKEN_REFRESHED` event

Token is cleared on:
- `SIGNED_OUT` event
- Explicit sign-out via `signOut()`

The SW checks token expiry with a 5-minute buffer before making API calls:

```typescript
const now = Math.floor(Date.now() / 1000);
if (authToken.expiresAt && authToken.expiresAt < now + 300) {
  return; // Skip sync until app refreshes token
}
```

## Input Validation

Zod schemas validate data at service boundaries before writes:

| Schema | Validates | Location |
|---|---|---|
| `MessageSchema` | Message content, category | IndexedDB writes |
| `MoodEntrySchema` | Mood type, date format, note length | IndexedDB writes |
| `PhotoSchema` | MIME type, dimensions, blob validity | Before upload |
| `SettingsSchema` | Theme name, date formats, partner name | Before localStorage write |
| `SupabaseSessionSchema` | Scripture session RPC responses | After Supabase reads |
| `SupabaseReflectionSchema` | Scripture reflection data | After Supabase reads |

### Validation Limits (from `src/config/performance.ts`)

| Limit | Value |
|---|---|
| Message text max length | 1000 characters |
| Photo caption max length | 500 characters |
| Mood note max length | 200 characters |

## Rate Limiting

Love Notes has client-side rate limiting:

```typescript
const { PAGE_SIZE: NOTES_PAGE_SIZE, RATE_LIMIT_MAX_MESSAGES, RATE_LIMIT_WINDOW_MS } = NOTES_CONFIG;
// 10 messages per 60 seconds
```

The `checkRateLimit` action filters timestamps within the window and throws if the limit is exceeded.

## Content Sanitization

The app uses `dompurify` (listed in dependencies) for sanitizing user-generated content before rendering. This prevents XSS attacks from malicious content in love notes or mood notes.

## Partner ID Resolution

The `getPartnerId()` function in `supabaseClient.ts` resolves the connected partner's user ID. All cross-user operations (notes, interactions, mood sharing) require a valid partner ID before proceeding.

## UUID Validation

The `interactionValidation.ts` utility validates UUIDs before sending interactions:

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}
```

## Environment Variables

Sensitive configuration is loaded via environment variables (not committed to the repository):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon/public key |

These are embedded at build time by Vite's `import.meta.env` mechanism. The `@dotenvx/dotenvx` package provides encrypted `.env` file support for CI/CD.

## E2E Testing Store Access

For testing purposes, the store is exposed on `window.__APP_STORE__`:

```typescript
if (typeof window !== 'undefined') {
  window.__APP_STORE__ = useAppStore;
}
```

This is available in all environments. In a production context, it allows E2E tests (Playwright) to inspect and manipulate state directly.
