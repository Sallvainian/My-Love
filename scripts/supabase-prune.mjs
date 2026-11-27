#!/usr/bin/env node
/**
 * npm run supabase:prune — clean up this repo's local Supabase stacks.
 *
 * With the stack backend ([experimental] stack in supabase/config.toml) every
 * worktree and branch gets its own local Supabase, and nothing stops one when
 * its worktree is deleted or its branch is switched away from. For each of this
 * repo's default (unnamed) stacks:
 *   - its folder is gone (a removed worktree) or its branch no longer exists
 *     -> destroy it, deleting its database (nothing can use it again);
 *   - its folder now has another branch checked out -> stop it, keeping its
 *     data for when that branch is checked out again;
 *   - otherwise it is the stack a checkout is using -> leave it alone.
 * Stacks started with --stack <name> are never touched.
 *
 * Runs from `npm run supabase:up` and from Claude Code's SessionEnd hook
 * (.claude/settings.json). --quiet prints only what it changed. It never fails
 * the caller: with the stack backend off or the CLI missing it does nothing.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const quiet = process.argv.includes('--quiet');
const run = (cmd, args, cwd = repo) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
const tryRun = (cmd, args, cwd) => {
  try {
    return run(cmd, args, cwd).trim();
  } catch {
    return null;
  }
};

// The main checkout's folder: worktrees, loop runs and Orca workspaces all
// share its git directory, and a removed worktree's path started here or
// carries the repo's name.
const mainRepo = dirname(resolve(repo, tryRun('git', ['rev-parse', '--git-common-dir']) ?? '.git'));
const projectId = (root) =>
  /^project_id\s*=\s*"([^"]*)"/m.exec(readFileSync(join(root, 'supabase/config.toml'), 'utf-8'))?.[1];
const ours = (root) =>
  existsSync(join(root, 'supabase/config.toml'))
    ? projectId(root) === projectId(repo)
    : root === mainRepo || root.startsWith(mainRepo + '/') || /my-love/i.test(root);

let stacks;
try {
  stacks = JSON.parse(run('supabase', ['stack', 'list', '--output-format', 'json'])).stacks ?? [];
} catch {
  process.exit(0);
}

for (const s of stacks) {
  if (s.name !== 'default' || !s.project_root || !ours(s.project_root)) continue;
  const root = s.project_root;
  const branch = s.branch_context;
  const short = s.id.slice(0, 12);
  let action = null;
  let why = '';
  if (!existsSync(root)) {
    action = 'destroy';
    why = 'its folder is gone';
  } else if (branch) {
    const current = tryRun('git', ['symbolic-ref', '-q', 'HEAD'], root);
    if (current !== branch) {
      const exists = tryRun('git', ['show-ref', '--verify', branch], root) !== null;
      action = exists ? 'stop' : 'destroy';
      why = exists ? `${branch.replace('refs/heads/', '')} is not checked out there` : `${branch.replace('refs/heads/', '')} no longer exists`;
    }
  }
  if (!action) {
    if (!quiet) console.log(`keep     ${short}  ${root}`);
    continue;
  }
  const args = action === 'destroy' ? ['stack', 'destroy', '--stack', s.id, '--yes'] : ['stack', 'stop', '--stack', s.id];
  const ok = tryRun('supabase', args) !== null;
  console.log(`${ok ? action.padEnd(8) : 'FAILED  '} ${short}  ${root}  (${why})`);
}
