/**
 * Replay one committed migration file against the local database inside a
 * transaction that is always rolled back.
 *
 * Why this exists: `supabase db reset` and `supabase test db` only ever apply a
 * migration to a database built from the current migration set, so a forward
 * migration written to clean up state that an *earlier* version of the schema
 * left behind (DW-85: 20260912000000_remove_claude_bot_password_row.sql) is
 * never exercised against the state it was written for. This helper seeds that
 * state, applies the file byte for byte, reads the result, and rolls back, so
 * the live table is untouched and no other worker or pgTAP run can observe the
 * seeded rows.
 *
 * Mechanism: `docker exec -i supabase_db_My-Love psql` with the script on
 * stdin. The container name follows playwright.config.ts:55, which already
 * shells to `docker inspect supabase_auth_My-Love`; both derive from
 * `project_id = "My-Love"` in supabase/config.toml:5. Inside the container
 * `psql -U postgres` authenticates over the local socket, which is how the
 * Supabase CLI's own `db` commands reach it. Measured 2026-09-12: the script
 * `BEGIN; INSERT; SELECT count; <migration>; SELECT count; ROLLBACK;` printed
 * `BEGIN / INSERT 0 1 / 1 / DELETE 1 / 0 / ROLLBACK` and exited 0.
 *
 * Output: psql runs with `-At` (unaligned, tuples only), so every SELECT prints
 * one line per row with no header, and every other statement prints its
 * command tag (`INSERT 0 1`, `DELETE 1`). `-v ON_ERROR_STOP=1` makes any SQL
 * error abort with exit 3, so a failing statement can never be read as a
 * passing one. Because `-At` prints no dividers, callers assert on the exact
 * line sequence rather than parsing.
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const SUPABASE_DB_CONTAINER = 'supabase_db_My-Love';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');

export interface MigrationReplayOptions {
  /** Migration file name inside supabase/migrations, e.g. `20260912000000_remove_claude_bot_password_row.sql`. */
  migration: string;
  /** Statements run inside the transaction BEFORE the migration (seed the pre-migration state). */
  before?: string[];
  /** Statements run inside the transaction AFTER the migration (read the result). */
  after?: string[];
  /** How many times the migration is applied inside the one transaction (default 1). */
  times?: number;
}

export interface MigrationReplayResult {
  /** Every stdout line psql printed, in order, including command tags. */
  lines: string[];
  /** The exact script that was piped to psql, for the report. */
  script: string;
}

class PsqlError extends Error {
  constructor(what: string, code: number | null, stderr: string) {
    super(`${what} (exit ${code ?? 'signal'}): ${stderr.trim() || '<no stderr>'}`);
    this.name = 'PsqlError';
  }
}

function runPsql(stdin: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      ['exec', '-i', SUPABASE_DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

/**
 * Confirm the instrument before trusting a reading from it: a missing Docker
 * binary, a stopped stack or a renamed container must surface as "could not
 * measure", never as a migration that silently did nothing.
 */
export async function assertLocalDatabaseReachable(): Promise<void> {
  const probe = await runPsql('SELECT 1;\n');
  if (probe.code !== 0 || probe.stdout.trim() !== '1') {
    throw new PsqlError(
      `Cannot reach ${SUPABASE_DB_CONTAINER} through docker exec; start the local stack with \`supabase start\``,
      probe.code,
      probe.stderr
    );
  }
}

/**
 * Refuse a migration that opens or closes its own transaction.
 *
 * The isolation this helper promises is the outer `BEGIN` / `ROLLBACK` it wraps
 * the file in. A migration carrying its own `commit;` ends that transaction
 * from the inside: everything up to it is committed for real against the local
 * stack, and the trailing `ROLLBACK` then has no transaction to undo and
 * degrades to a warning on stderr. Nothing in the result distinguishes that
 * from a clean replay, so the run reads as isolated while having written to a
 * database other test workers share.
 *
 * 25 of the migrations in this repo are written that way, so this is a trap
 * waiting for the next caller rather than a hypothetical. Failing here is the
 * point: a replay that cannot be rolled back should say so, not do it anyway.
 */
function assertNoOwnTransactionControl(migration: string, sql: string): void {
  const offenders = sql
    .split('\n')
    .map((line, index) => ({ line: line.trim().toLowerCase(), number: index + 1 }))
    // Statement-leading only: `commit;` inside a function body or a string
    // literal is not transaction control at this level.
    .filter(({ line }) => /^(begin|commit|end|rollback)\s*;/.test(line));

  if (offenders.length === 0) return;

  const where = offenders.map(({ line, number }) => `${number}: ${line}`).join(', ');
  throw new Error(
    `${migration} manages its own transaction (${where}), so it cannot be replayed inside a ` +
      `rollback: its own commit would end this helper's transaction and persist the replay. ` +
      `Replay a migration without transaction control, or assert against a disposable database.`
  );
}

export async function replayMigrationInRollback(options: MigrationReplayOptions): Promise<MigrationReplayResult> {
  const { migration, before = [], after = [], times = 1 } = options;
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(migration)) {
    throw new Error(`Not a migration file name: ${migration}`);
  }
  const migrationSql = await readFile(path.join(MIGRATIONS_DIR, migration), 'utf8');
  assertNoOwnTransactionControl(migration, migrationSql);

  await assertLocalDatabaseReachable();

  const script = [
    'BEGIN;',
    ...before,
    ...Array.from({ length: times }, () => migrationSql.trim()),
    ...after,
    'ROLLBACK;',
    '',
  ].join('\n');

  const result = await runPsql(script);
  if (result.code !== 0) {
    throw new PsqlError(`psql rejected the replay of ${migration}`, result.code, result.stderr);
  }
  return {
    lines: result.stdout.split('\n').filter((line) => line.length > 0),
    script,
  };
}
