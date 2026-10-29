/**
 * Global Teardown: leftover-row audit
 *
 * Recounts the rows each worker-pool account owns in each seeded table and
 * compares them with the baseline global-setup took after provisioning
 * (row-audit.ts). Every changed count is printed; the run fails when any grew,
 * because that is a row some spec created and never cleaned up. A count that
 * shrank is reported but does not fail.
 *
 * Read-only: nothing is written, deleted or reset here.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.types';
import { getAuthPoolSize } from './auth/worker-pool';
import {
  ROW_AUDIT_BASELINE_ENV,
  countPoolRows,
  diffRowCounts,
  formatRowDiff,
  parseRowCounts,
} from './helpers/row-audit';

export default async function globalTeardown(): Promise<void> {
  const before = parseRowCounts(process.env[ROW_AUDIT_BASELINE_ENV]);
  if (!before) {
    console.log(
      `[row-audit] skipped: no usable baseline in ${ROW_AUDIT_BASELINE_ENV} (global setup did not finish)`
    );
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      `[row-audit] Missing env vars: SUPABASE_URL=${url ? 'set' : 'unset'}, ` +
        `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey ? 'set' : 'unset'}.`
    );
  }

  const admin = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const after = await countPoolRows(admin, getAuthPoolSize());
  const diff = diffRowCounts(before, after);
  for (const line of formatRowDiff(diff)) console.log(`[row-audit] ${line}`);

  const grown = diff.filter((entry) => entry.grew);
  if (grown.length > 0) {
    throw new Error(
      `[row-audit] ${grown.length} pool-account row counts grew during the run; ` +
        'a spec left rows behind:\n' +
        formatRowDiff(grown).join('\n')
    );
  }
}
