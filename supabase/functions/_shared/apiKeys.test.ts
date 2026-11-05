import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

import { apiKeyFromEnv } from './apiKeys.ts';

// Fake key values are assembled at run time so the source holds no literal that
// looks like a key to secret scanners (as apns.test.ts does for its PEM header).
const fake = (...parts: string[]): string => parts.join('_');
const NEW_SECRET = fake('sb', 'secret', 'new');
const NEW_PUBLISHABLE = fake('sb', 'publishable', 'new');
const LEGACY_SECRET = fake('legacy', 'service');
const LEGACY_PUBLISHABLE = fake('legacy', 'anon');

function envOf(values: Record<string, string>): (name: string) => string | undefined {
  return (name) => values[name];
}

/** Runs `fn` with console.warn captured, and returns what it logged. */
function captureWarnings(fn: () => void): string[] {
  const original = console.warn;
  const logged: string[] = [];
  console.warn = (message: string) => logged.push(message);
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return logged;
}

Deno.test('the default secret key is used when the runtime injects SUPABASE_SECRET_KEYS', () => {
  const warnings = captureWarnings(() => {
    const result = apiKeyFromEnv(
      'secret',
      envOf({
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: NEW_SECRET }),
        SUPABASE_SERVICE_ROLE_KEY: LEGACY_SECRET,
      })
    );
    assertEquals(result, { key: NEW_SECRET, source: 'new' });
  });
  assertEquals(warnings, []);
});

Deno.test('the default publishable key is used when the runtime injects SUPABASE_PUBLISHABLE_KEYS', () => {
  const warnings = captureWarnings(() => {
    const result = apiKeyFromEnv(
      'publishable',
      envOf({
        SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: NEW_PUBLISHABLE }),
        SUPABASE_ANON_KEY: LEGACY_PUBLISHABLE,
      })
    );
    assertEquals(result, { key: NEW_PUBLISHABLE, source: 'new' });
  });
  assertEquals(warnings, []);
});

Deno.test('each kind falls back to its own legacy key, with a warning, when its dictionary is absent', () => {
  const env = envOf({ SUPABASE_SERVICE_ROLE_KEY: LEGACY_SECRET, SUPABASE_ANON_KEY: LEGACY_PUBLISHABLE });
  const warnings = captureWarnings(() => {
    assertEquals(apiKeyFromEnv('secret', env), { key: LEGACY_SECRET, source: 'legacy' });
    assertEquals(apiKeyFromEnv('publishable', env), { key: LEGACY_PUBLISHABLE, source: 'legacy' });
  });
  assertEquals(warnings, [
    'SUPABASE_SECRET_KEYS is not set; falling back to the legacy SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_PUBLISHABLE_KEYS is not set; falling back to the legacy SUPABASE_ANON_KEY',
  ]);
});

Deno.test('a dictionary without a default key falls back, with a warning', () => {
  const warnings = captureWarnings(() => {
    const result = apiKeyFromEnv(
      'secret',
      envOf({
        SUPABASE_SECRET_KEYS: JSON.stringify({ other: fake('sb', 'secret', 'other') }),
        SUPABASE_SERVICE_ROLE_KEY: LEGACY_SECRET,
      })
    );
    assertEquals(result.source, 'legacy');
  });
  assertEquals(warnings, ['SUPABASE_SECRET_KEYS has no default key; falling back to the legacy SUPABASE_SERVICE_ROLE_KEY']);
});

Deno.test('a value that is not JSON falls back, with a warning', () => {
  const warnings = captureWarnings(() => {
    const result = apiKeyFromEnv(
      'secret',
      envOf({ SUPABASE_SECRET_KEYS: fake('sb', 'secret', 'bare'), SUPABASE_SERVICE_ROLE_KEY: LEGACY_SECRET })
    );
    assertEquals(result.source, 'legacy');
  });
  assertEquals(warnings, ['SUPABASE_SECRET_KEYS is not JSON; falling back to the legacy SUPABASE_SERVICE_ROLE_KEY']);
});

Deno.test('no key at all throws', () => {
  captureWarnings(() => {
    assertThrows(() => apiKeyFromEnv('secret', envOf({})), Error, 'No secret key');
    assertThrows(() => apiKeyFromEnv('publishable', envOf({})), Error, 'No publishable key');
  });
});
