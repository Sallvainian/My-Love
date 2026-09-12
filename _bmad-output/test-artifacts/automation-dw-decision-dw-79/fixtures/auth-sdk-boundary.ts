import { createClient, type AuthChangeEvent } from '@supabase/supabase-js';
import { createAuthBootstrapSession } from '../../../../tests/support/factories/auth-bootstrap-notification-order';

type Action = 'sign-in' | 'sign-out';
type RequestEvidence = {
  method: string;
  path: string;
  credentialsMatch?: boolean;
  authorizationMatches?: boolean;
};
type ActionOutcome = { successful: boolean; sessionMatches: boolean };

function signal() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

/**
 * Real installed auth-js with an in-memory HTTP boundary. No server, worker
 * account, disk session, browser storage or native transaction participates.
 * Only fixed phase labels and boolean comparisons leave this helper.
 */
export async function createSdkActionProbe(action: Action) {
  const session = createAuthBootstrapSession({ userId: 'owner-A', email: 'dw79@example.test' });
  const credentials = { email: session.user.email!, password: 'dw79-synthetic-password' };
  const origin = 'http://dw79-auth.supabase.invalid';
  const phases: string[] = [];
  const requests: RequestEvidence[] = [];
  const entered = signal();
  const released = signal();
  let settled = false;
  let deliveredSessionMatches = false;
  let operation: Promise<ActionOutcome> | undefined;

  // playwright-utils deviation: injected SDK fetch keeps real Auth parsing and
  // callback completion; apiRequest would bypass the behavior under test.
  const controlledFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (url.origin !== origin || method !== 'POST') {
      throw new Error('Unexpected controlled Auth request');
    }
    if (url.pathname === '/auth/v1/token' && url.search === '?grant_type=password') {
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      const data = body as Record<string, unknown> | null;
      requests.push({ method, path: '/auth/v1/token?grant_type=password', credentialsMatch:
        data?.email === credentials.email && data?.password === credentials.password });
      phases.push('http-response');
      return new Response(JSON.stringify(session), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.pathname === '/auth/v1/logout' && url.search === '?scope=global') {
      const headers = new Headers(init?.headers);
      requests.push({ method, path: '/auth/v1/logout?scope=global', authorizationMatches:
        headers.get('Authorization') === 'Bearer ' + session.access_token });
      phases.push('http-response');
      return new Response(null, { status: 204 });
    }
    throw new Error('Unexpected controlled Auth endpoint');
  };
  const client = createClient(origin, 'dw79-synthetic-key', {
    auth: {
      persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
      storageKey: 'dw79-auth-' + crypto.randomUUID(),
    },
    global: { fetch: controlledFetch },
  });
  const initialization = await client.auth.initialize();
  if (initialization.error) {
    await client.auth.dispose();
    throw new Error('Controlled Auth initialization failed');
  }
  if (action === 'sign-out') {
    const seed = await client.auth.signInWithPassword(credentials);
    if (seed.error || seed.data.user?.id !== session.user.id || !seed.data.session) {
      await client.auth.dispose();
      throw new Error('Controlled sign-out precondition failed');
    }
    phases.length = 0;
    requests.length = 0;
  }
  const selectedEvent: AuthChangeEvent = action === 'sign-in' ? 'SIGNED_IN' : 'SIGNED_OUT';
  const { data: { subscription } } = client.auth.onAuthStateChange(async (event, delivered) => {
    if (event !== selectedEvent) return;
    deliveredSessionMatches = action === 'sign-in'
      ? delivered?.user.id === session.user.id && delivered.access_token === session.access_token
      : delivered === null;
    phases.push('notification-entered');
    entered.resolve();
    await released.promise;
    phases.push('notification-complete');
  });

  return {
    phases,
    requests,
    notificationEntered: entered.promise,
    isSettled: () => settled,
    deliveredSessionMatches: () => deliveredSessionMatches,
    releaseNotification: released.resolve,
    start() {
      if (operation) throw new Error('SDK action probe can only start once');
      const response = action === 'sign-in'
        ? client.auth.signInWithPassword(credentials).then((result) => ({
            successful: result.error === null,
            sessionMatches: result.data.user?.id === session.user.id &&
              result.data.session?.access_token === session.access_token,
          }))
        : client.auth.signOut().then(async (result) => {
            const current = await client.auth.getSession();
            return {
              successful: result.error === null,
              sessionMatches: current.error === null && current.data.session === null,
            };
          });
      operation = response.then((result) => {
        settled = true;
        phases.push('action-complete');
        return result;
      }, () => {
        settled = true;
        phases.push('action-rejected');
        throw new Error('Controlled SDK action rejected');
      });
      void operation.catch(() => {});
      return operation;
    },
    async dispose() {
      released.resolve();
      try {
        if (operation) await Promise.allSettled([operation]);
      } finally {
        subscription.unsubscribe();
        await client.auth.dispose();
      }
    },
  };
}
