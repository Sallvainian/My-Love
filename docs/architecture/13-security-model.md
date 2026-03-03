# Security Model

> Last updated: 2026-03-03

## Authentication

- **Methods**: Email/password + Google OAuth via Supabase Auth
- **Session**: Persisted in localStorage by Supabase client, auto-refreshed before JWT expiry
- **Users**: Exactly 2 users per deployment, linked via `partner_id` in the `users` table
- **Auth guards** (Epic 4): Store slice actions validate auth via `getCurrentUserIdOfflineSafe()` before any Supabase operation
- **Sentry context**: User UUID set on auth success (`setSentryUser`), cleared on sign-out (`clearSentryUser`). No email or IP sent to Sentry.

## Row-Level Security (RLS)

All Supabase tables have RLS enabled. Policies use `auth.uid()` wrapped in a `SELECT` subquery for performance:

```sql
-- Example: Users can only read their own moods or their partner's moods
CREATE POLICY "Users can read own and partner moods"
ON moods FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (
    SELECT partner_id FROM users WHERE id = (SELECT auth.uid())
  )
);
```

## Input Sanitization

### Love Notes (XSS Prevention)

All user-generated love note content is sanitized via DOMPurify before display:

```typescript
// src/utils/messageValidation.ts
export function sanitizeMessageContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Preserve text content
  });
}
```

### Interaction Validation

UUID format and interaction type validation occurs before any Supabase call:

```typescript
// src/utils/interactionValidation.ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateInteraction(partnerId: string | null, type: string) {
  const partnerValidation = validatePartnerId(partnerId);
  if (!partnerValidation.isValid) return partnerValidation;
  if (!isValidInteractionType(type)) {
    return { isValid: false, error: `Invalid interaction type: ${type}` };
  }
  return { isValid: true };
}
```

## Schema Validation at Boundaries

Zod v4 schemas validate data at every service boundary, preventing data corruption:

- **Before IndexedDB writes**: `MoodEntrySchema.parse()`, `CreateMessageInputSchema.parse()`
- **Before Supabase RPCs**: `SupabaseSessionSchema.parse()`, `SupabaseReflectionSchema.parse()`
- **Before state updates**: `SettingsSchema.parse()` in `setSettings()` and `updateSettings()`
- **During import**: `CustomMessagesExportSchema.parse()` validates import file structure
- **API responses**: `SupabaseMoodSchema.parse()`, `MoodArraySchema.parse()` validate all Supabase query results

## Environment Variable Security

Secrets are managed by **fnox** with the **age** encryption provider:

- `fnox.toml` contains age-encrypted secret ciphertext, committed safely to git
- Age keys stored at `~/.age/key.txt` on each machine (Mac, WSL) -- never committed
- `fnox exec -- npm run dev` decrypts secrets and injects them as environment variables
- No `.env`, `.env.keys`, or external key management services needed
- E2E tests use plain-text `.env.test` with local Supabase credentials only
- Environment variables are validated at module load time in `supabaseClient.ts`

### Secrets Inventory

| Secret | Source | Purpose |
|--------|--------|---------|
| `VITE_SUPABASE_URL` | `fnox.toml` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | `fnox.toml` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | `fnox.toml` | Supabase service role key |
| `SENTRY_AUTH_TOKEN` | `fnox.toml` | Sentry auth token for source map upload |
| `SENTRY_ORG` | `fnox.toml` | Sentry organization slug |
| `SENTRY_PROJECT` | `fnox.toml` | Sentry project slug |
| `VITE_SENTRY_DSN` | `fnox.toml` | Sentry DSN for error tracking |
| `SUPABASE_PAT` | `fnox.toml` | Supabase Personal Access Token |

## Sentry PII Protection (Epic 4)

Sentry is configured to strip PII before events reach the server:

```typescript
// src/config/sentry.ts
beforeSend(event) {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }
  return event;
}
```

Only UUIDs are sent as user identifiers. Partner ID is set as a tag, not a user field.

## Service Worker Auth Token Management

Auth tokens for background sync are stored in IndexedDB (not localStorage, which is inaccessible to service workers). The `sw-auth` object store holds the current auth token:

```typescript
// src/sw-db.ts
export interface StoredAuthToken {
  id: 'current';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}
```

The token is refreshed whenever the main app's auth state changes via the `onAuthStateChange` listener in `sessionService.ts`. Token expiry is checked with a 5-minute buffer before background sync attempts. The `sw-db.ts` file duplicates the `upgradeDb()` migration logic from `dbSchema.ts` since the service worker runs in a separate execution context.

## Rate Limiting

Love notes have client-side rate limiting configured in `src/config/images.ts`:

```typescript
export const NOTES_CONFIG = {
  RATE_LIMIT_MAX_MESSAGES: 10,
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
};
```

## Related Documentation

- [Authentication Flow](./07-authentication-flow.md)
- [Validation Layer](./14-validation-layer.md)
- [API Layer](./08-api-layer.md)
- [Error Handling](./17-error-handling.md)
