/**
 * Leftover-row audit: does a full run leave pool-account rows behind?
 *
 * `globalSetup` counts, after provisioning and linking, how many rows each
 * worker-pool account owns in each seeded table, and hands that baseline to
 * `globalTeardown` through `ROW_AUDIT_BASELINE_ENV` (both run in the runner
 * process). Teardown recounts and fails the run when any count grew, so a spec
 * whose cleanup misses a row is caught instead of leaking silently.
 *
 * The audit only counts. It never writes, deletes or resets a row: other
 * workers' rows, and anything a person seeded by hand, stay as they are.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import type { TypedSupabaseClient } from '../factories';
import { getWorkerEmail, getWorkerPartnerEmail } from '../auth/worker-pool';

/** The env var `globalSetup` stores the baseline in, as JSON. */
export const ROW_AUDIT_BASELINE_ENV = 'E2E_ROW_AUDIT_BASELINE';

/**
 * Each audited table and the columns that make a row an account's. A row
 * between partners matches both accounts and so counts under both.
 */
export const AUDITED_TABLES = {
  love_notes: ['from_user_id', 'to_user_id'],
  moods: ['user_id'],
  events: ['user_id'],
  anniversaries: ['user_id'],
  photos: ['user_id'],
  interactions: ['from_user_id', 'to_user_id'],
  custom_messages: ['user_id'],
  message_favorites: ['user_id'],
  partner_requests: ['from_user_id', 'to_user_id'],
  love_note_removals: ['user_id'],
  couple_settings: ['user_a', 'user_b'],
} as const;

export type AuditedTable = keyof typeof AUDITED_TABLES;

export type PoolRole = 'worker' | 'partner';

/** Row counts keyed `table|slot|role`. */
export type RowCounts = Record<string, number>;

export type RowDiffEntry = {
  table: string;
  slot: number;
  role: string;
  before: number;
  after: number;
  /** True when the account owns more rows than at setup. */
  grew: boolean;
};

export function rowCountKey(table: string, slot: number, role: PoolRole): string {
  return `${table}|${slot}|${role}`;
}

/**
 * The `public.users.id` for an email. Retries because the profile row is
 * written by a trigger on the auth user, which can trail `createUser`.
 */
export async function getAppUserIdByEmail(
  admin: TypedSupabaseClient,
  email: string
): Promise<string> {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await admin.from('users').select('id').eq('email', email).single();
    if (!error && data?.id) return data.id;
    if (attempt === maxAttempts) {
      throw new Error(
        `Could not resolve app user for ${email} after ${maxAttempts} attempts: ${error?.message ?? 'not found'}`
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('unreachable');
}

type PoolAccount = { slot: number; role: PoolRole; email: string; userId: string };

/**
 * Count the rows each pool account owns in each audited table: slots
 * `0..poolSize-1`, worker and partner. Head-only exact counts, read with the
 * service-role client; each table's queries run concurrently.
 */
export async function countPoolRows(
  admin: TypedSupabaseClient,
  poolSize: number
): Promise<RowCounts> {
  const accounts: PoolAccount[] = await Promise.all(
    Array.from({ length: poolSize }, (_, slot) => [
      { slot, role: 'worker' as const, email: getWorkerEmail(slot) },
      { slot, role: 'partner' as const, email: getWorkerPartnerEmail(slot) },
    ])
      .flat()
      .map(async (account) => ({
        ...account,
        userId: await getAppUserIdByEmail(admin, account.email),
      }))
  );

  const counts: RowCounts = {};
  for (const [table, columns] of Object.entries(AUDITED_TABLES) as [
    AuditedTable,
    readonly string[],
  ][]) {
    await Promise.all(
      accounts.map(async ({ slot, role, email, userId }) => {
        const owned = columns.map((column) => `${column}.eq.${userId}`).join(',');
        const { count, error } = await admin
          .from(table)
          .select('*', { count: 'exact', head: true })
          .or(owned);
        if (error || count === null) {
          throw new Error(
            `[row-audit] Could not count ${table} rows for ${email}: ${error?.message ?? 'no count returned'}`
          );
        }
        counts[rowCountKey(table, slot, role)] = count;
      })
    );
  }
  return counts;
}

/**
 * Every key whose count changed, in key order. A key present on one side only
 * counts as 0 on the other.
 */
export function diffRowCounts(before: RowCounts, after: RowCounts): RowDiffEntry[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const entries: RowDiffEntry[] = [];
  for (const key of keys) {
    const was = before[key] ?? 0;
    const now = after[key] ?? 0;
    if (was === now) continue;
    const [table, slot, role] = key.split('|');
    entries.push({ table, slot: Number(slot), role, before: was, after: now, grew: now > was });
  }
  return entries;
}

/** One line per changed key, e.g. `moods slot 3 worker: 5 → 6 (+1)`. */
export function formatRowDiff(entries: RowDiffEntry[]): string[] {
  if (entries.length === 0) {
    return ['no leftover rows: every pool-account count matches setup'];
  }
  return entries.map(({ table, slot, role, before, after }) => {
    const delta = after - before;
    return `${table} slot ${slot} ${role}: ${before} → ${after} (${delta > 0 ? '+' : ''}${delta})`;
  });
}

export function serializeRowCounts(counts: RowCounts): string {
  return JSON.stringify(counts);
}

/** The baseline, or null when it is absent or not a map of counts. */
export function parseRowCounts(raw: string | undefined): RowCounts | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const values = Object.values(parsed);
  if (!values.every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0)) return null;
  return parsed as RowCounts;
}
