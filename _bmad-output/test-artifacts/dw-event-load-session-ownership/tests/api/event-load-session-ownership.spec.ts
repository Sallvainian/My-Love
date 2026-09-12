/**
 * Supporting live API evidence for DW-54/55/56.
 *
 * This verifies that a new authentication session for the same account can read
 * current server data. Client load ownership is asserted by the browser/store
 * suite; a direct API test cannot observe authSessionVersion or stale callers.
 *
 * Sources: auth-js/src/GoTrueClient.ts signInWithPassword (password grant),
 * auth-js/src/GoTrueAdminApi.ts signOut (scoped logout), auth-js/src/lib/types.ts
 * RequiredClaims (sub/session_id), and src/types/database.types.ts events.Row.
 * No auth/events response schema exists in the project; assertions constrain
 * the identity, generated session, and event values this scenario is about.
 */
import type { JwtPayload, Session } from '@supabase/supabase-js';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';
import { getWorkerPairEmails } from '../support/auth/worker-pool';
import { resolveOwnPair } from '../support/helpers/events';
import { createSessionEventRow } from '../support/factories/event-load-session-ownership';
import { TEST_USER_PASSWORD } from '../support/test-credentials';
import type { Database } from '../../src/types/database.types';

type EventRow = Database['public']['Tables']['events']['Row'];
type SessionIdentity = Pick<JwtPayload, 'sub' | 'session_id'>;
type PasswordLoginResponse = Pick<Session, 'access_token' | 'user'>;

// Decode only the claims under test. Server acceptance of each token is checked
// by authenticated reads below; this helper makes no signature-validation claim.
function sessionIdentity(token: string): SessionIdentity {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Expected a JWT payload from the auth provider');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionIdentity;
}

test.describe('Same-account event reads after reauthentication', () => {
  test('[P1] DW-54-56-API-001 a new session reads current event data for the same account', async ({
    apiRequest,
    authToken,
    supabaseAdmin,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const pair = getWorkerPairEmails();
    if (!pair) throw new Error('Expected this worker to own an authentication pair');

    const beforeIdentity = sessionIdentity(authToken);
    const event = createSessionEventRow(userId);
    const changedLabel = `Updated ${event.label}`;
    const eventPath = `/rest/v1/events?id=eq.${event.id}`;
    const initialHeaders = { Authorization: `Bearer ${authToken}` };
    // Admin access is confined to modifying and cleaning this generated row.
    const adminHeaders = {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    };
    const createdSessionTokens: string[] = [];

    expect(beforeIdentity.sub).toBe(userId);
    // The server generates session_id; assert it exists before comparing lifetimes.
    expect(beforeIdentity.session_id).toEqual(expect.any(String));
    expect(beforeIdentity.session_id).not.toBe('');

    try {
      await log.step('Create one isolated event and establish the original session read');
      const inserted = await apiRequest<EventRow[]>({
        method: 'POST',
        path: '/rest/v1/events',
        headers: { ...initialHeaders, Prefer: 'return=representation' },
        body: event,
      });
      expect(inserted.status).toBe(201);
      expect(inserted.body).toHaveLength(1);
      expect(inserted.body[0]).toMatchObject({
        id: event.id, user_id: userId, label: event.label, event_date: event.event_date,
      });

      const beforeRead = await apiRequest<EventRow[]>({
        method: 'GET',
        path: `${eventPath}&select=*`,
        headers: initialHeaders,
      });
      expect(beforeRead.status).toBe(200);
      expect(beforeRead.body).toHaveLength(1);
      expect(beforeRead.body[0]).toMatchObject({ id: event.id, user_id: userId, label: event.label });

      await log.step('End only the original session and change the isolated server row');
      const signedOut = await apiRequest({
        method: 'POST',
        path: '/auth/v1/logout?scope=local',
        headers: initialHeaders,
        retryConfig: { maxRetries: 0 },
      });
      expect(signedOut.status).toBe(204);

      const changed = await apiRequest<EventRow[]>({
        method: 'PATCH',
        path: eventPath,
        headers: { ...adminHeaders, Prefer: 'return=representation' },
        body: { label: changedLabel },
      });
      expect(changed.status).toBe(200);
      expect(changed.body).toHaveLength(1);
      expect(changed.body[0]).toMatchObject({ id: event.id, user_id: userId, label: changedLabel });

      await log.step('Authenticate the same worker account in a new session');
      // playwright-utils deviation: reauthentication is the behavior under test; initial setup uses authToken.
      const signedIn = await apiRequest<PasswordLoginResponse>({
        method: 'POST',
        path: '/auth/v1/token?grant_type=password',
        body: {
          email: pair.user1Email,
          password: TEST_USER_PASSWORD,
          gotrue_meta_security: {},
        },
        retryConfig: { maxRetries: 0 },
      });
      expect(signedIn.status).toBe(200);
      createdSessionTokens.push(signedIn.body.access_token);
      expect(signedIn.body.user.id).toBe(userId);

      const afterIdentity = sessionIdentity(signedIn.body.access_token);
      expect(afterIdentity.sub).toBe(beforeIdentity.sub);
      expect(afterIdentity.session_id).toEqual(expect.any(String));
      expect(afterIdentity.session_id).not.toBe('');
      expect(afterIdentity.session_id).not.toBe(beforeIdentity.session_id);

      await log.step('Read the changed row using the new session credentials');
      const currentRead = await apiRequest<EventRow[]>({
        method: 'GET',
        path: `${eventPath}&select=*`,
        headers: { Authorization: `Bearer ${signedIn.body.access_token}` },
      });
      expect(currentRead.status).toBe(200);
      expect(currentRead.body).toHaveLength(1);
      expect(currentRead.body[0]).toMatchObject({
        id: event.id,
        user_id: userId,
        label: changedLabel,
        event_date: event.event_date,
      });
      expect(currentRead.body[0].label).not.toBe(beforeRead.body[0].label);
    } finally {
      // Both cleanups are awaited even when an assertion fails. No pair-wide
      // deletion or global logout can affect another worker's state.
      const cleanupResults = await Promise.allSettled([
        apiRequest({ method: 'DELETE', path: eventPath, headers: adminHeaders }),
        ...createdSessionTokens.map((token) => apiRequest({
          method: 'POST',
          path: '/auth/v1/logout?scope=local',
          headers: { Authorization: `Bearer ${token}` },
          retryConfig: { maxRetries: 0 },
        })),
      ]);
      for (const result of cleanupResults) {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') expect(result.value.status).toBe(204);
      }
    }
  });
});
