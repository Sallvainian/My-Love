// Regenerates src/types/database.types.ts from the local Supabase database.
//
// The Supabase CLI prints its TypeScript unformatted and tells you to run
// oxfmt on it. With the settings in db-types.oxfmtrc.json (no semicolons,
// 80 columns) oxfmt gives the layout older CLIs produced themselves, so a
// regeneration changes only the lines the schema changed.
//
// The output goes through stdin because .prettierignore, which oxfmt also
// reads, excludes the real path; the stdin file name only picks the parser.
// Each step's exit status is checked, so a failed generation never truncates
// the committed file. CI's Database Tests job runs this and fails when the
// committed file differs, so generate with the CLI version pinned in
// .github/actions/setup-supabase/action.yml.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const TARGET = 'src/types/database.types.ts';
const shell = process.platform === 'win32';

function run(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`${command} ${args.join(' ')} exited with ${result.status}`);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const generated = run('supabase', ['gen', 'types', 'typescript', '--local']);
const formatted = run(
  'npx',
  [
    '--no-install',
    'oxfmt',
    '-c',
    'scripts/db-types.oxfmtrc.json',
    '--stdin-filepath=src/types/generated-database-types.ts',
  ],
  generated
);
writeFileSync(TARGET, formatted);
console.error(`Wrote ${TARGET}`);
