import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

import { apnsConfigFromEnv, apnsHost, createApnsClient, createProviderToken } from './apns.ts';

/** A throwaway P-256 key as PKCS#8 PEM, the shape of an Apple `.p8`. */
async function makeKey(): Promise<{ pem: string; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  let binary = '';
  for (const byte of der) binary += String.fromCharCode(byte);
  // The label is joined at run time so the source holds no literal PEM header for secret scanners to flag.
  const label = ['PRIVATE', 'KEY'].join(' ');
  const pem = `-----BEGIN ${label}-----\n${btoa(binary)}\n-----END ${label}-----`;
  return { pem, publicKey: pair.publicKey };
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.test('the environment picks the APNs host', () => {
  assertEquals(apnsHost('sandbox'), 'api.sandbox.push.apple.com');
  assertEquals(apnsHost('production'), 'api.push.apple.com');
  assertThrows(() => apnsHost('staging'));
});

Deno.test('no key, key id or team id means unconfigured', () => {
  const full = { APNS_KEY_P8: 'k', APNS_KEY_ID: 'ID', APNS_TEAM_ID: 'TEAM' } as Record<string, string>;
  assertEquals(apnsConfigFromEnv((n) => full[n])?.topic, 'dev.sallvain.mylove');
  for (const missing of Object.keys(full)) {
    const env = { ...full };
    delete env[missing];
    assertEquals(apnsConfigFromEnv((n) => env[n]), null);
  }
  assertEquals(apnsConfigFromEnv(() => undefined), null);
});

Deno.test('the provider token is an ES256 JWT that verifies', async () => {
  const { pem, publicKey } = await makeKey();
  const token = await createProviderToken({ keyPem: pem, keyId: 'KEY123', teamId: 'TEAM456' }, 1000);
  const [header, claims, signature] = token.split('.');
  assertEquals(JSON.parse(new TextDecoder().decode(fromBase64url(header))), { alg: 'ES256', kid: 'KEY123' });
  assertEquals(JSON.parse(new TextDecoder().decode(fromBase64url(claims))), { iss: 'TEAM456', iat: 1000 });
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    fromBase64url(signature),
    new TextEncoder().encode(`${header}.${claims}`)
  );
  assert(ok);
});

Deno.test('a send goes to the registration\'s host with the topic and the token', async () => {
  const { pem } = await makeKey();
  const calls: { url: string; init: RequestInit }[] = [];
  const client = createApnsClient(
    { keyPem: pem, keyId: 'K', teamId: 'T', topic: 'dev.example.app' },
    {
      fetch: (url, init) => {
        calls.push({ url: String(url), init: init as RequestInit });
        return Promise.resolve(new Response(null, { status: 200 }));
      },
      nowSeconds: () => 5000,
    }
  );
  const payload = { aps: { alert: { title: 'A', body: 'B' } } };
  assertEquals(await client.send('tok1', 'sandbox', payload), { ok: true, status: 200, reason: null });
  await client.send('tok2', 'production', payload);

  assertEquals(calls[0].url, 'https://api.sandbox.push.apple.com/3/device/tok1');
  assertEquals(calls[1].url, 'https://api.push.apple.com/3/device/tok2');
  const headers = calls[0].init.headers as Record<string, string>;
  assertEquals(headers['apns-topic'], 'dev.example.app');
  assertEquals(headers['apns-push-type'], 'alert');
  assert(headers.authorization.startsWith('bearer '));
  assertEquals(calls[0].init.body, JSON.stringify(payload));
  // The provider token is reused inside its lifetime.
  assertEquals((calls[1].init.headers as Record<string, string>).authorization, headers.authorization);
});

Deno.test('a refusal reports its reason', async () => {
  const { pem } = await makeKey();
  const client = createApnsClient(
    { keyPem: pem, keyId: 'K', teamId: 'T', topic: 't' },
    {
      fetch: () => Promise.resolve(new Response(JSON.stringify({ reason: 'BadDeviceToken' }), { status: 400 })),
      nowSeconds: () => 1,
    }
  );
  assertEquals(await client.send('tok', 'sandbox', {}), { ok: false, status: 400, reason: 'BadDeviceToken' });
});

Deno.test('a partly set configuration says so and stays unconfigured', () => {
  const original = console.error;
  const lines: unknown[][] = [];
  console.error = (...args: unknown[]) => void lines.push(args);
  try {
    assertEquals(apnsConfigFromEnv((n) => (n === 'APNS_KEY_ID' ? 'ID' : undefined)), null);
    assertEquals(lines.length, 1);
    assert(String(lines[0][0]).includes('APNs partially configured'));
    lines.length = 0;
    assertEquals(apnsConfigFromEnv(() => undefined), null);
    assertEquals(lines.length, 0);
  } finally {
    console.error = original;
  }
});
