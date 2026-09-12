/**
 * DW-81 supporting API contract: authenticated bootstrap identities.
 *
 * Local evidence:
 * - src/api/auth/sessionService.ts consumes User.id, email and user_metadata.
 * - Installed @supabase/auth-js/src/GoTrueClient.ts:_getUser issues GET /user
 *   with the supplied JWT; src/lib/types.ts:User defines the returned fields.
 * - 20251203000001_create_base_schema.sql:14 makes public.users.id reference
 *   auth.users.id, so the worker's read-only identity lookup is authoritative.
 *
 * No endpoint changed in DW-81. This live identity contract complements the
 * controlled browser tests; HTTP responses alone cannot prove callback order.
 */
import { log } from '@seontechnologies/playwright-utils';
import { z } from 'zod';
import { getWorkerPairEmails } from '../support/auth/worker-pool';
import { resolveWorkerPairIds } from '../support/factories/events';
import { test, expect } from '../support/merged-fixtures';

// No production response schema exists for /auth/v1/user. This local minimum
// schema validates the identity and metadata fields consumed during bootstrap.
const BootstrapIdentitySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  aud: z.literal('authenticated'),
  app_metadata: z.record(z.string(), z.unknown()),
  user_metadata: z.object({ display_name: z.string().optional() }).passthrough(),
});
type BootstrapIdentity = z.infer<typeof BootstrapIdentitySchema>;

test.describe('Auth bootstrap identity contract', () => {
  test('[P1] DW-81-API-001 resolves each worker token to its own identity and metadata', async ({
    apiRequest,
    authToken,
    partnerAuthToken,
    supabaseAdmin,
  }) => {
    // Given the existing worker pair, resolved without changing either account.
    const emails = getWorkerPairEmails();
    if (!emails) throw new Error('Auth identity contract requires TEST_WORKER_INDEX');
    const { userId, partnerId } = await resolveWorkerPairIds(supabaseAdmin);
    expect(userId).not.toBe(partnerId);

    // When each token independently asks Auth for its current user.
    await log.step('Read the current user for both existing worker tokens');
    const [ownResponse, partnerResponse] = await Promise.all(
      [authToken, partnerAuthToken].map((token) =>
        apiRequest<BootstrapIdentity>({
          method: 'GET',
          path: '/auth/v1/user',
          headers: { Authorization: 'Bearer ' + token },
        }).validateSchema<BootstrapIdentity>(BootstrapIdentitySchema)
      )
    );

    // Then the response identities match the independently resolved accounts.
    expect(ownResponse.status).toBe(200);
    expect(partnerResponse.status).toBe(200);
    expect(ownResponse.body).toMatchObject({ id: userId, email: emails.user1Email });
    expect(partnerResponse.body).toMatchObject({ id: partnerId, email: emails.user2Email });
  });
});
