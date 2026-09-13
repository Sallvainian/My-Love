/**
 * Security finding F1: the Claude bot password was once committed as a literal
 * in supabase/migrations/20260316031209_create_claude_bot_config.sql. The
 * value now lives only in the age-encrypted fnox.toml entry CLAUDE_BOT_PASSWORD
 * and is applied by scripts/provision-claude-bot.mjs. This test scans every
 * committed SQL path (migrations, seed.sql and the pgTAP suite) so a password
 * value can never come back in any writing statement, whatever its quoting.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest runs with the project root as cwd; happy-dom rewrites import.meta.url
// to an http: URL, so the repo path is resolved from cwd instead.
const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const DB_TESTS_DIR = path.join(ROOT, 'supabase', 'tests', 'database');
const SEED_FILE = path.join(ROOT, 'supabase', 'seed.sql');

const WRITING_STATEMENT = /\b(insert|update|merge|copy)\b/i;

/**
 * Returns every INSERT/UPDATE/MERGE/COPY statement that mentions the
 * test_password key. Comments are stripped first so a prose mention of the key
 * does not trip the guard, and statements are split on ';' so the DELETE that
 * removes the row and the pgTAP SELECTs that count it stay allowed. Matching on
 * the statement rather than one literal shape covers dollar-quoting, E'' strings,
 * (value, key) column order and UPDATE ... SET value = ... WHERE key = ... alike.
 */
function writingStatementsNamingTestPassword(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => /test_password/i.test(statement) && WRITING_STATEMENT.test(statement));
}

function sqlFilesIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => path.join(dir, name));
}

const sqlFiles = [...sqlFilesIn(MIGRATIONS_DIR), ...sqlFilesIn(DB_TESTS_DIR), SEED_FILE];

describe('committed SQL never seeds the Claude bot password', () => {
  it('scans at least the migrations directory and seed.sql', () => {
    expect(sqlFiles.length).toBeGreaterThan(1);
  });

  it.each(sqlFiles.map((file) => [path.relative(ROOT, file), file]))(
    '%s has no writing statement that names test_password',
    (_label, file) => {
      const sql = readFileSync(file, 'utf8');
      expect(writingStatementsNamingTestPassword(sql)).toEqual([]);
    }
  );

  it('the guard catches every quoting and statement shape a seed could use', () => {
    const shapes = [
      "INSERT INTO claude_bot_config (key, value) VALUES ('test_password', 'x')",
      "insert into claude_bot_config (value, key) values ('x', 'test_password')",
      "INSERT INTO claude_bot_config (key, value) VALUES ($$test_password$$, $$x$$)",
      "INSERT INTO claude_bot_config (key, value) VALUES ('test_password', E'x')",
      "UPDATE claude_bot_config SET value = 'x' WHERE key = 'test_password'",
    ];
    for (const shape of shapes) {
      expect(writingStatementsNamingTestPassword(`${shape};`)).toHaveLength(1);
    }
    expect(
      writingStatementsNamingTestPassword(
        "-- seeds 'test_password' no more\nDELETE FROM claude_bot_config WHERE key = 'test_password';"
      )
    ).toEqual([]);
  });

  it('the original config migration seeds only the identifier keys', () => {
    const sql = readFileSync(
      path.join(MIGRATIONS_DIR, '20260316031209_create_claude_bot_config.sql'),
      'utf8'
    );
    const seededKeys = [...sql.matchAll(/\(\s*'([^']+)'\s*,\s*'[^']*'\s*\)/g)].map((m) => m[1]);
    expect(seededKeys).toEqual(['test_email', 'partner_email']);
  });
});
