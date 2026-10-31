/**
 * APNs client: ES256 provider token, host chosen by the registration's
 * environment. Uses only WebCrypto and fetch, so it runs in the Edge runtime
 * and under `deno test` with no remote module.
 *
 * The environment is read from the device's registration, never from this
 * sender's own signing: an Xcode development install gets a sandbox token that
 * the production host rejects, and the reverse.
 */

export type ApnsEnvironment = 'sandbox' | 'production';

export const APNS_HOSTS: Record<ApnsEnvironment, string> = {
  sandbox: 'api.sandbox.push.apple.com',
  production: 'api.push.apple.com',
};

export const DEFAULT_APNS_TOPIC = 'dev.sallvain.mylove';

/** Apple accepts a provider token for up to an hour; refresh well inside it. */
const TOKEN_TTL_SECONDS = 50 * 60;

export interface ApnsConfig {
  /** The `.p8` signing key, PEM text. */
  keyPem: string;
  keyId: string;
  teamId: string;
  /** The app's bundle id. */
  topic: string;
}

export function apnsHost(environment: string): string {
  if (environment === 'sandbox' || environment === 'production') {
    return APNS_HOSTS[environment];
  }
  throw new Error(`Unknown APNs environment: ${environment}`);
}

/**
 * The APNs settings from the environment, or null when any of the key,
 * key id or team id is missing: the sender then records the request it would
 * have sent instead of sending it.
 */
export function apnsConfigFromEnv(get: (name: string) => string | undefined): ApnsConfig | null {
  const keyPem = get('APNS_KEY_P8')?.trim();
  const keyId = get('APNS_KEY_ID')?.trim();
  const teamId = get('APNS_TEAM_ID')?.trim();
  if (!keyPem || !keyId || !teamId) {
    if (keyPem || keyId || teamId) {
      console.error(
        'APNs partially configured: set all of APNS_KEY_P8, APNS_KEY_ID and APNS_TEAM_ID; recording requests only'
      );
    }
    return null;
  }
  return { keyPem, keyId, teamId, topic: get('APNS_TOPIC')?.trim() || DEFAULT_APNS_TOPIC };
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlText(text: string): string {
  return base64url(new TextEncoder().encode(text));
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const base64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);
  return der;
}

/** `header.claims.signature`, signed ES256 (WebCrypto returns raw r||s, as JWS wants). */
export async function createProviderToken(
  config: Pick<ApnsConfig, 'keyPem' | 'keyId' | 'teamId'>,
  issuedAtSeconds: number
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(config.keyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const header = base64urlText(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const claims = base64urlText(JSON.stringify({ iss: config.teamId, iat: issuedAtSeconds }));
  const signingInput = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

export interface ApnsResult {
  ok: boolean;
  status: number;
  /** APNs' `reason` on a refusal, e.g. `BadDeviceToken`. */
  reason: string | null;
}

export interface ApnsClient {
  send(token: string, environment: string, payload: unknown): Promise<ApnsResult>;
}

export function createApnsClient(
  config: ApnsConfig,
  deps: { fetch: typeof fetch; nowSeconds: () => number } = {
    fetch: (...args) => fetch(...args),
    nowSeconds: () => Math.floor(Date.now() / 1000),
  }
): ApnsClient {
  let cached: { token: string; issuedAt: number } | null = null;

  async function providerToken(): Promise<string> {
    const now = deps.nowSeconds();
    if (!cached || now - cached.issuedAt >= TOKEN_TTL_SECONDS) {
      cached = { token: await createProviderToken(config, now), issuedAt: now };
    }
    return cached.token;
  }

  return {
    async send(token, environment, payload) {
      const host = apnsHost(environment);
      const response = await deps.fetch(`https://${host}/3/device/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${await providerToken()}`,
          'apns-topic': config.topic,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        await response.body?.cancel();
        return { ok: true, status: response.status, reason: null };
      }
      let reason: string | null = null;
      try {
        const parsed = (await response.json()) as { reason?: unknown };
        reason = typeof parsed.reason === 'string' ? parsed.reason : null;
      } catch {
        // An empty or non-JSON refusal carries no reason.
      }
      return { ok: false, status: response.status, reason };
    },
  };
}
