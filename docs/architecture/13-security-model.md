# Security Model

## Authentication

- **Method**: Email/password via Supabase Auth
- **Session**: Persisted in localStorage, auto-refreshed before JWT expiry
- **Users**: Exactly 2 users per deployment, linked via `partner_id` in the `users` table

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

## Environment Variable Security

- Secrets are encrypted with **fnox** using the age encryption provider and committed to git in `fnox.toml`
- Age private keys (`~/.age/key.txt`) are never committed to the repository
- E2E tests use plain-text `.env.test` with local Supabase credentials only
- Environment variables are validated at module load time in `supabaseClient.ts`
- In CI, GitHub Secrets are injected directly as environment variables

## Service Worker Auth Token Management

Auth tokens for background sync are stored in IndexedDB (not localStorage, which is inaccessible to service workers). The `sw-auth` object store uses a string key path `id` with no auto-increment:

```typescript
// src/sw-db.ts
export async function storeAuthToken(token: string): Promise<void> {
  const db = await openMyLoveDB();
  await db.put('sw-auth', { id: 'current', token, timestamp: Date.now() });
}

export async function getAuthToken(): Promise<string | null> {
  const db = await openMyLoveDB();
  const record = await db.get('sw-auth', 'current');
  return record?.token ?? null;
}

export async function clearAuthToken(): Promise<void> {
  const db = await openMyLoveDB();
  await db.delete('sw-auth', 'current');
}
```

The token is refreshed whenever the main app's auth state changes via the `onAuthStateChange` listener. The `sw-db.ts` file duplicates the `upgradeDb()` migration logic from `dbSchema.ts` since the service worker runs in a separate execution context and cannot import the app's service layer.

## Rate Limiting

Love notes have client-side rate limiting (10 messages per minute) implemented in `NotesSlice`:

```typescript
// Tracks recent message timestamps
if (recentCount >= 10) {
  throw new Error('Rate limit exceeded: max 10 messages per minute');
}
```

## Related Documentation

- [Authentication Flow](./07-authentication-flow.md)
- [Validation Layer](./14-validation-layer.md)
- [API Layer](./08-api-layer.md)
