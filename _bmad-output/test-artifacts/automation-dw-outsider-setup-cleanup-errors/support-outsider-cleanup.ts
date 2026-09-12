import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from '../../../tests/support/factories';
import type { Database } from '../../../src/types/database.types';

type AuthScenario = {
  admin: TypedSupabaseClient;
  userId: string;
  requests: { method: string; path: string }[];
  setupMessage: string;
  cleanupMessage: string;
};

/** Real SDK, synthetic Auth responses; no account is created outside this server. */
export async function withAuthServer<T>(
  outcome: 'denied' | 'success',
  run: (scenario: AuthScenario) => Promise<T>
): Promise<T> {
  const userId = randomUUID();
  const user = {
    id: userId,
    email: `dw71-${userId}@test.example.com`,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-09-12T00:00:00Z',
  };
  const requests: AuthScenario['requests'] = [];
  const setupMessage = 'DW71 password authentication denied';
  const cleanupMessage = 'DW71 account deletion denied';
  // playwright-utils deviation: a loopback server intercepts Node SDK traffic;
  // browser interception and apiRequest would bypass the SDK behavior under test.
  const server = createServer((request, response) => {
    const method = request.method ?? '';
    const path = request.url ?? '';
    requests.push({ method, path });
    request.resume();
    response.setHeader('Content-Type', 'application/json');
    const send = (status: number, body: object) => {
      response.writeHead(status);
      response.end(JSON.stringify(body));
    };
    if (method === 'POST' && path === '/auth/v1/admin/users') {
      send(200, user);
    } else if (method === 'GET' && path === `/auth/v1/admin/users/${userId}`) {
      send(200, user);
    } else if (method === 'POST' && path === '/auth/v1/token?grant_type=password') {
      send(400, { msg: setupMessage, error_code: 'invalid_credentials' });
    } else if (method === 'DELETE' && path === `/auth/v1/admin/users/${userId}`) {
      if (outcome === 'denied') {
        send(403, { msg: cleanupMessage, error_code: 'not_admin' });
      } else {
        send(200, user);
      }
    } else {
      send(404, { msg: `Unexpected Auth request: ${method} ${path}` });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    process.env.SUPABASE_URL = url;
    process.env.SUPABASE_ANON_KEY = 'dw71-synthetic-anon-key';
    const admin = createClient<Database>(url, 'dw71-synthetic-admin-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return await run({ admin, userId, requests, setupMessage, cleanupMessage });
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
}
