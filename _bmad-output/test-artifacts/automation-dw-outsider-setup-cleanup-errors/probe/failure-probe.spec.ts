import { AuthError } from '@supabase/supabase-js';
import { test } from '../../../../tests/support/merged-fixtures';
import type { TypedSupabaseClient } from '../../../../tests/support/factories';
import { createOutsiderClient } from '../../../../tests/support/helpers/rls-security';
import { nodeOnlyFixtures } from '../support-node-only';

test.use(nodeOnlyFixtures);

// Only the dedicated child config discovers this intentional failure probe.
// Its nonzero exit and both real reporter outputs are asserted by the outer suite.
test('[P1] DW71 intentional dual-failure reporting probe', async () => {
  const kind = process.env.DW71_PROBE_KIND;
  const userId = process.env.DW71_PROBE_USER_ID!;
  const setupMessage = process.env.DW71_PROBE_SETUP_MESSAGE!;
  const cleanupMessage = process.env.DW71_PROBE_CLEANUP_MESSAGE!;
  if (!['returned-error', 'rejected-string', 'rejected-object'].includes(kind ?? '') ||
      !userId || !setupMessage || !cleanupMessage) {
    throw new Error('DW71 reporting probe requires its parent fixture');
  }
  // Controlled SDK boundaries force setup failure before client construction.
  const admin = {
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: userId } }, error: null }),
        getUserById: async () => { throw new Error(setupMessage); },
        deleteUser: async () => {
          if (kind === 'returned-error') {
            return { data: { user: null }, error: new AuthError(cleanupMessage, 403) };
          }
          throw kind === 'rejected-string' ? cleanupMessage : { reason: cleanupMessage };
        },
      },
    },
  } as unknown as TypedSupabaseClient;
  await createOutsiderClient(admin, 'dw71-report');
});
