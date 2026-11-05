/**
 * The Supabase API key an Edge Function builds its client with.
 *
 * Supabase is retiring the legacy `anon` and `service_role` keys (deprecated
 * "by the end of 2026", https://supabase.com/docs/guides/api/api-keys). The
 * hosted runtime injects the project's new keys as `SUPABASE_PUBLISHABLE_KEYS`
 * and `SUPABASE_SECRET_KEYS`, each a JSON dictionary keyed by key name
 * (https://supabase.com/docs/guides/functions/secrets); this reads the
 * `default` entry. The local CLI (2.122.0) injects neither, only the legacy
 * `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, so those stay as the
 * fallback. The fallback logs a warning, so a hosted deploy still on a legacy
 * key shows in the function's logs before anyone disables the legacy keys
 * (DW-460).
 *
 * Underscore folders hold shared code and are not deployed as functions.
 */

export type ApiKeyKind = 'publishable' | 'secret';

export type ApiKey = { key: string; source: 'new' | 'legacy' };

const NEW_VARIABLE: Record<ApiKeyKind, string> = {
  publishable: 'SUPABASE_PUBLISHABLE_KEYS',
  secret: 'SUPABASE_SECRET_KEYS',
};

const LEGACY_VARIABLE: Record<ApiKeyKind, string> = {
  publishable: 'SUPABASE_ANON_KEY',
  secret: 'SUPABASE_SERVICE_ROLE_KEY',
};

export function apiKeyFromEnv(kind: ApiKeyKind, get: (name: string) => string | undefined): ApiKey {
  const name = NEW_VARIABLE[kind];
  const legacyName = LEGACY_VARIABLE[kind];
  const keys = get(name)?.trim();
  if (keys) {
    try {
      const parsed: unknown = JSON.parse(keys);
      const key = (parsed as Record<string, unknown> | null)?.default;
      if (typeof key === 'string' && key.trim()) return { key: key.trim(), source: 'new' };
      console.warn(`${name} has no default key; falling back to the legacy ${legacyName}`);
    } catch {
      console.warn(`${name} is not JSON; falling back to the legacy ${legacyName}`);
    }
  } else {
    console.warn(`${name} is not set; falling back to the legacy ${legacyName}`);
  }

  const legacy = get(legacyName)?.trim();
  if (!legacy) throw new Error(`No ${kind} key: set ${name} or ${legacyName}`);
  return { key: legacy, source: 'legacy' };
}
