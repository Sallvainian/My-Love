import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertNoOwnTransactionControl } from '../../support/helpers/migration-replay';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');

/** The migrations the integration specs replay in a rollback (tests/integration/*-migration.spec.ts). */
const REPLAYED = [
  '20260912000000_remove_claude_bot_password_row.sql',
  '20261127000000_daily_nudge_per_question.sql',
  '20261127010000_three_daily_pushes.sql',
];

const check = (sql: string) => () => assertNoOwnTransactionControl('test.sql', sql);

describe('assertNoOwnTransactionControl', () => {
  it('refuses a top-level commit, begin, end or rollback, naming the line', () => {
    expect(check('create table t (id int);\ncommit;\n')).toThrow('manages its own transaction (2: commit;)');
    expect(check('begin;\nselect 1;\nend;\n')).toThrow('(1: begin;, 3: end;)');
    expect(check('ROLLBACK ;\n')).toThrow('1: rollback ;');
  });

  it('accepts a plpgsql body whose dollar-quote tag holds digits', () => {
    const sql = [
      'create function f() returns void language plpgsql as $fn1$',
      'begin',
      '  perform 1;',
      'end;',
      '$fn1$;',
    ].join('\n');
    expect(check(sql)).not.toThrow();
  });

  it('accepts the tags the migrations use today: $$, $function$ and $job$', () => {
    for (const tag of ['$$', '$function$', '$job$']) {
      const sql = `do ${tag}\nbegin\n  perform 1;\nend;\n${tag};\n`;
      expect(check(sql)).not.toThrow();
    }
  });

  it('does not let a $$ inside a line comment hide a real commit', () => {
    const sql = [
      '-- the function below is written with $$ quoting',
      'create table t (id int);',
      'commit;',
      'do $$ begin perform 1; end $$;',
    ].join('\n');
    expect(check(sql)).toThrow('(3: commit;)');
  });

  it('does not let a $$ inside a block comment or a string literal hide a real commit', () => {
    expect(check("/* costs $$ */\ncommit;\nselect '$$';\n")).toThrow('(2: commit;)');
    expect(check("select 'it''s $$';\ncommit;\ndo $$ begin end $$;\n")).toThrow('(2: commit;)');
  });

  it('flags a commit that follows a comment on its own line', () => {
    expect(check('/* done */ commit;\n')).toThrow('(1: commit;)');
  });

  it('ignores a commit inside a comment or a string literal', () => {
    expect(check("-- commit;\n/*\ncommit;\n*/\nselect '\ncommit;\n';\n")).not.toThrow();
  });

  it('does not read a positional parameter or an identifier holding $ as a quote', () => {
    const sql = [
      'prepare q as select $1, a$b$ from t;',
      'commit;',
    ].join('\n');
    expect(check(sql)).toThrow('(2: commit;)');
  });

  it('throws on a quote or comment that never closes rather than blanking the rest of the file', () => {
    expect(check('do $body$\nbegin\nend;\ncommit;\n')).toThrow('dollar-quoted body $body$ opened on line 1 never closes');
    expect(check("select 'x;\ncommit;\n")).toThrow('string literal opened on line 1 never closes');
    expect(check('/* a /* nested */ comment\ncommit;\n')).toThrow('block comment opened on line 1 never closes');
  });

  it('reads an E string backslash escape, so its quote does not close early', () => {
    expect(check("select E'it\\'s $$';\ncommit;\n")).toThrow('(2: commit;)');
  });

  it('accepts every migration the integration specs replay', () => {
    for (const migration of REPLAYED) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, migration), 'utf8');
      expect(() => assertNoOwnTransactionControl(migration, sql), migration).not.toThrow();
    }
  });

  it('gives every committed migration a verdict without throwing anything but its own refusal', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);
    // A refusal is a verdict; anything else (a quote the scanner never saw close) is not.
    const unreadable = files.flatMap((migration) => {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, migration), 'utf8');
      try {
        assertNoOwnTransactionControl(migration, sql);
        return [];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes('manages its own transaction') ? [] : [message];
      }
    });
    expect(unreadable).toEqual([]);
  });
});
