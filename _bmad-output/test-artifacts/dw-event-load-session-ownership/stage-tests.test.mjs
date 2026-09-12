import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, symlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const bundle = path.dirname(fileURLToPath(import.meta.url));
const files = [
  'tests/api/event-load-session-ownership.spec.ts',
  'tests/e2e/events/event-load-session-ownership.spec.ts',
  'tests/support/factories/event-load-session-ownership.ts',
  'tests/support/helpers/event-load-session-ownership.ts',
];

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'pr270-staging-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifact = path.join(root, '_bmad-output/test-artifacts/dw-event-load-session-ownership');
  await mkdir(artifact, { recursive: true });
  const script = path.join(artifact, 'stage-tests.mjs');
  await copyFile(path.join(bundle, 'stage-tests.mjs'), script);
  for (const file of files) {
    await mkdir(path.dirname(path.join(artifact, file)), { recursive: true });
    await writeFile(path.join(artifact, file), `fixture: ${file}\n`);
  }
  return {
    root,
    source: (file) => path.join(artifact, file),
    target: (file) => path.join(root, file),
    run: (mode) => spawnSync(process.execPath, [script, mode], { cwd: root, encoding: 'utf8', timeout: 5000 }),
  };
}

test('stage and clean round trip, including repeated cleanup', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run('stage').status, 0);
  for (const file of files) assert.equal(await readFile(f.target(file), 'utf8'), `fixture: ${file}\n`);
  assert.equal(f.run('clean').status, 0);
  for (const file of files) await assert.rejects(readFile(f.target(file)), { code: 'ENOENT' });
  assert.equal(f.run('clean').status, 0);
});

test('an existing later target blocks every stage write', async (t) => {
  const f = await fixture(t);
  const existing = f.target(files.at(-1));
  await mkdir(path.dirname(existing), { recursive: true });
  await writeFile(existing, 'user content');
  const result = f.run('stage');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to overwrite/);
  assert.equal(await readFile(existing, 'utf8'), 'user content');
  for (const file of files.slice(0, -1)) await assert.rejects(readFile(f.target(file)), { code: 'ENOENT' });
});

test('a modified later target blocks every cleanup deletion', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run('stage').status, 0);
  await writeFile(f.target(files.at(-1)), 'user edit');
  const result = f.run('clean');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to remove modified/);
  for (const file of files.slice(0, -1)) assert.equal(await readFile(f.target(file), 'utf8'), `fixture: ${file}\n`);
  assert.equal(await readFile(f.target(files.at(-1)), 'utf8'), 'user edit');
});

test('a nonregular later target is refused without reading or partial staging', async (t) => {
  const f = await fixture(t);
  await mkdir(f.target(files.at(-1)), { recursive: true });
  const result = f.run('stage');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to overwrite/);
  for (const file of files.slice(0, -1)) await assert.rejects(readFile(f.target(file)), { code: 'ENOENT' });
});

test('a dangling symlink blocks staging before any earlier write', async (t) => {
  const f = await fixture(t);
  const target = f.target(files.at(-1));
  await mkdir(path.dirname(target), { recursive: true });
  await symlink(path.join(f.root, 'missing'), target);
  const result = f.run('stage');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to overwrite/);
  assert.equal((await lstat(target)).isSymbolicLink(), true);
  for (const file of files.slice(0, -1)) await assert.rejects(readFile(f.target(file)), { code: 'ENOENT' });
});

test('cleanup removes an unchanged empty artifact', async (t) => {
  const f = await fixture(t);
  await writeFile(f.source(files.at(-1)), '');
  assert.equal(f.run('stage').status, 0);
  assert.equal(f.run('clean').status, 0);
  for (const file of files) await assert.rejects(readFile(f.target(file)), { code: 'ENOENT' });
});

test('an artifact truncated to empty blocks all cleanup', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run('stage').status, 0);
  await writeFile(f.target(files.at(-1)), '');
  const result = f.run('clean');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to remove modified/);
  for (const file of files.slice(0, -1)) assert.equal(await readFile(f.target(file), 'utf8'), `fixture: ${file}\n`);
  assert.equal(await readFile(f.target(files.at(-1)), 'utf8'), '');
});

test('cleanup tolerates a missing target among matching staged files', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run('stage').status, 0);
  await rm(f.target(files[1]));
  assert.equal(f.run('clean').status, 0);
  for (const file of files) await assert.rejects(readFile(f.target(file)), { code: 'ENOENT' });
});

for (const mode of ['stage', 'clean']) {
  test(`an ENOTDIR preflight error prevents every ${mode} mutation`, async (t) => {
    const f = await fixture(t);
    if (mode === 'clean') {
      assert.equal(f.run('stage').status, 0);
      await rm(path.join(f.root, 'tests/support'), { recursive: true });
    } else {
      await mkdir(path.join(f.root, 'tests'), { recursive: true });
    }
    await writeFile(path.join(f.root, 'tests/support'), 'not a directory');
    const result = f.run(mode);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ENOTDIR/);
    for (const file of files.slice(0, 2)) {
      if (mode === 'clean') assert.equal(await readFile(f.target(file), 'utf8'), `fixture: ${file}\n`);
      else await assert.rejects(readFile(f.target(file)), { code: 'ENOENT' });
    }
    assert.equal(await readFile(path.join(f.root, 'tests/support'), 'utf8'), 'not a directory');
  });
}
