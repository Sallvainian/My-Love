# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: failure-probe.spec.ts >> [P1] DW71 intentional dual-failure reporting probe
- Location: ../../../probe/failure-probe.spec.ts:11:1

# Error details

```
AggregateError: Failed to set up and clean up outsider account eb8d8cd7-b131-4dd3-83d5-174236a21d22. Setup: Error: DW71 setup failed for rejected-object. Cleanup: {"reason":"DW71 cleanup failed for rejected-object"}
```

```
Error: DW71 setup failed for rejected-object
```

# Test source

```ts
  1  | import { AuthError } from '@supabase/supabase-js';
  2  | import { test } from '../../../../tests/support/merged-fixtures';
  3  | import type { TypedSupabaseClient } from '../../../../tests/support/factories';
  4  | import { createOutsiderClient } from '../../../../tests/support/helpers/rls-security';
  5  | import { nodeOnlyFixtures } from '../support-node-only';
  6  | 
  7  | test.use(nodeOnlyFixtures);
  8  | 
  9  | // Only the dedicated child config discovers this intentional failure probe.
  10 | // Its nonzero exit and both real reporter outputs are asserted by the outer suite.
  11 | test('[P1] DW71 intentional dual-failure reporting probe', async () => {
  12 |   const kind = process.env.DW71_PROBE_KIND;
  13 |   const userId = process.env.DW71_PROBE_USER_ID!;
  14 |   const setupMessage = process.env.DW71_PROBE_SETUP_MESSAGE!;
  15 |   const cleanupMessage = process.env.DW71_PROBE_CLEANUP_MESSAGE!;
  16 |   if (!['returned-error', 'rejected-string', 'rejected-object'].includes(kind ?? '') ||
  17 |       !userId || !setupMessage || !cleanupMessage) {
  18 |     throw new Error('DW71 reporting probe requires its parent fixture');
  19 |   }
  20 |   // Controlled SDK boundaries force setup failure before client construction.
  21 |   const admin = {
  22 |     auth: {
  23 |       admin: {
  24 |         createUser: async () => ({ data: { user: { id: userId } }, error: null }),
> 25 |         getUserById: async () => { throw new Error(setupMessage); },
     |                                          ^ Error: DW71 setup failed for rejected-object
  26 |         deleteUser: async () => {
  27 |           if (kind === 'returned-error') {
  28 |             return { data: { user: null }, error: new AuthError(cleanupMessage, 403) };
  29 |           }
  30 |           throw kind === 'rejected-string' ? cleanupMessage : { reason: cleanupMessage };
  31 |         },
  32 |       },
  33 |     },
  34 |   } as unknown as TypedSupabaseClient;
  35 |   await createOutsiderClient(admin, 'dw71-report');
  36 | });
  37 | 
```