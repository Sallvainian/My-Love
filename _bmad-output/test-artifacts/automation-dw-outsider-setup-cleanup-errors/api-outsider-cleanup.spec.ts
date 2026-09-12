import { AuthApiError } from '@supabase/supabase-js';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../../tests/support/merged-fixtures';
import { createOutsiderClient } from '../../../tests/support/helpers/rls-security';
import { withAuthServer } from './support-outsider-cleanup';
import { nodeOnlyFixtures } from './support-node-only';

// playwright-utils deviation: Node SDK traffic has no page; disable the browser monitor's page dependency.
test.use(nodeOnlyFixtures);

const intentionalAuthFailure = {
  annotation: [{ type: 'skipNetworkMonitoring', description: 'Loopback Auth faults are the inputs under test.' }],
};

test.describe('DW-71 outsider cleanup across the Supabase Auth HTTP boundary', () => {
  test('[P1] DW71-API-001 preserves setup and returned deletion errors from the real SDK', intentionalAuthFailure, async () => {
    await log.step('Reject password sign-in and account deletion at an isolated Auth server');
    await withAuthServer('denied', async ({ admin, userId, requests, setupMessage, cleanupMessage }) => {
      // playwright-utils deviation: invoke the SDK under test; apiRequest/authToken would bypass Auth error conversion.
      const failure = await createOutsiderClient(admin, 'dw71-api-denied').catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(AggregateError);
      const aggregate = failure as AggregateError;
      expect(aggregate.errors).toHaveLength(2);
      const [setupFailure, cleanupFailure] = aggregate.errors;
      expect(setupFailure).toBeInstanceOf(Error);
      expect(setupFailure).not.toBeInstanceOf(AggregateError);
      expect(setupFailure.message).toBe(`Failed to sign in as ${userId}: ${setupMessage}`);
      expect(cleanupFailure).toBeInstanceOf(AuthApiError);
      expect(cleanupFailure).toMatchObject({
        status: 403,
        code: 'not_admin',
        message: cleanupMessage,
      });
      expect(aggregate.cause).toBe(cleanupFailure);
      expect(aggregate.message).toContain(userId);
      expect(aggregate.message).toContain(`Setup: Error: ${setupFailure.message}`);
      expect(aggregate.message).toContain(`Cleanup: AuthApiError: ${cleanupMessage}`);
      expect(requests).toEqual([
        { method: 'POST', path: '/auth/v1/admin/users' },
        { method: 'GET', path: `/auth/v1/admin/users/${userId}` },
        { method: 'POST', path: '/auth/v1/token?grant_type=password' },
        { method: 'DELETE', path: `/auth/v1/admin/users/${userId}` },
      ]);
    });
  });

  test('[P1] DW71-API-002 returns only the setup error after the SDK confirms deletion', intentionalAuthFailure, async () => {
    await log.step('Reject password sign-in, then successfully delete the created outsider');
    await withAuthServer('success', async ({ admin, userId, requests, setupMessage, cleanupMessage }) => {
      // playwright-utils deviation: invoke the SDK under test; apiRequest/authToken would bypass Auth error conversion.
      const failure = await createOutsiderClient(admin, 'dw71-api-success').catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(AggregateError);
      expect(failure).toHaveProperty('message', `Failed to sign in as ${userId}: ${setupMessage}`);
      expect(failure).not.toHaveProperty('errors');
      expect(failure).not.toHaveProperty('cause');
      expect((failure as Error).message).not.toContain(cleanupMessage);
      expect(requests).toEqual([
        { method: 'POST', path: '/auth/v1/admin/users' },
        { method: 'GET', path: `/auth/v1/admin/users/${userId}` },
        { method: 'POST', path: '/auth/v1/token?grant_type=password' },
        { method: 'DELETE', path: `/auth/v1/admin/users/${userId}` },
      ]);
    });
  });
});
