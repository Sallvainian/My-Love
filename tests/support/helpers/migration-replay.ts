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

/** Pipe `stdin` to psql in the local database container; callers read the exit code. */
export function runPsql(stdin: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
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

/** A character that continues an identifier, so a `$` after it is part of the name (`a$b`). */
const IDENT_CONT = /[A-Za-z0-9_$\u0080-\uffff]/;
/** A dollar-quote tag: `$`, an optional identifier with no `$` in it, `$` (Postgres, 4.1.2.4). */
const DOLLAR_TAG = /^\$(?:[A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*)?\$/;

/**
 * `sql` with every comment, string literal, quoted identifier and dollar-quoted
 * body blanked to spaces, newlines kept, so a line number still names the line
 * of the file. It reads the text the way Postgres's lexer does: `--` to the end
 * of the line, `/* *\/` nested, `''` inside a string, a backslash escape inside
 * an `E'...'` string, `""` inside a quoted identifier, and a dollar-quote tag
 * that may hold digits after its first character (`$fn1$`). A `$` that ends an
 * identifier (`a$b`) or starts a positional parameter (`$1`) opens nothing.
 *
 * Text that opens and never closes throws rather than blanking to the end of
 * the file, where it would hide a real `commit;`.
 */
function blankQuotedAndComments(migration: string, sql: string): string {
  const out: string[] = [];
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) out.push(sql[k] === '\n' ? '\n' : ' ');
  };
  const unclosed = (what: string, at: number): never => {
    const line = sql.slice(0, at).split('\n').length;
    throw new Error(`${migration}: the ${what} opened on line ${line} never closes, so its transaction control cannot be read`);
  };
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const previous = i > 0 ? sql[i - 1] : '';
    if (ch === '-' && sql[i + 1] === '-') {
      const newline = sql.indexOf('\n', i);
      const end = newline === -1 ? sql.length : newline;
      blank(i, end);
      i = end;
    } else if (ch === '/' && sql[i + 1] === '*') {
      let depth = 1;
      let j = i + 2;
      while (depth > 0) {
        if (j >= sql.length) unclosed('block comment', i);
        if (sql[j] === '/' && sql[j + 1] === '*') {
          depth++;
          j += 2;
        } else if (sql[j] === '*' && sql[j + 1] === '/') {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      blank(i, j);
      i = j;
    } else if (ch === "'" || ch === '"') {
      // `E'...'` (a lone E, not the end of a longer name) takes backslash escapes.
      const escapes =
        ch === "'" && (previous === 'E' || previous === 'e') && !IDENT_CONT.test(i > 1 ? sql[i - 2] : '');
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) unclosed(ch === "'" ? 'string literal' : 'quoted identifier', i);
        if (escapes && sql[j] === '\\') {
          j += 2;
        } else if (sql[j] === ch && sql[j + 1] === ch) {
          j += 2;
        } else if (sql[j] === ch) {
          j++;
          break;
        } else {
          j++;
        }
      }
      blank(i, j);
      i = j;
    } else if (ch === '$' && !IDENT_CONT.test(previous) && DOLLAR_TAG.test(sql.slice(i, i + 64))) {
      const tag = DOLLAR_TAG.exec(sql.slice(i, i + 64))![0];
      const close = sql.indexOf(tag, i + tag.length);
      if (close === -1) unclosed(`dollar-quoted body ${tag}`, i);
      const end = close + tag.length;
      blank(i, end);
      i = end;
    } else {
      out.push(ch);
      i++;
    }
  }
  return out.join('');
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
 * Most of the migrations in this repo are written that way, so this is a trap
 * waiting for the next caller rather than a hypothetical. Failing here is the
 * point: a replay that cannot be rolled back should say so, not do it anyway.
 * A plpgsql body (`$$ ... $$`, `$fn1$ ... $fn1$`) is skipped: its `end;` is the block's own;
 * so are comments and literals (see {@link blankQuotedAndComments}).
 */
export function assertNoOwnTransactionControl(migration: string, sql: string): void {
  // A dollar-quoted body (a function or a DO block) is not transaction control at this
  // level: its `begin` ... `end;` is plpgsql's block. Comments and literals are not
  // either, and a `$$` inside one opens nothing, so all of them are blanked.
  const outside = blankQuotedAndComments(migration, sql);
  const offenders = outside
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
