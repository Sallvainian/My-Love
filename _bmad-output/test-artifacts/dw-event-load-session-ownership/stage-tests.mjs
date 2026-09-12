import { access, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bundle = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(bundle, '../../..');
const mode = process.argv[2];
if (!['stage', 'clean'].includes(mode)) {
  throw new Error('Usage: node stage-tests.mjs stage|clean');
}

async function filesUnder(directory) {
  const entries = await readdir(path.join(bundle, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(relative));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(relative);
    else throw new Error(`Unexpected artifact under tests: ${relative}`);
  }
  return files;
}

const files = await filesUnder('tests');
if (files.length === 0) throw new Error('No generated tests to stage');

// Validate the entire set before changing any target. Existing tests and edits
// made after staging are never overwritten or silently removed.
const entries = await Promise.all(files.map(async (file) => {
  const source = await readFile(path.join(bundle, file), 'utf8');
  const target = path.join(root, file);
  const exists = await access(target).then(() => true, (error) => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
  if (mode === 'stage' && exists) throw new Error(`Refusing to overwrite ${file}`);
  if (mode === 'clean' && exists && await readFile(target, 'utf8') !== source) {
    throw new Error(`Refusing to remove modified ${file}`);
  }
  return { source, target, exists };
}));

for (const { source, target, exists } of entries) {
  if (mode === 'stage') {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source, { flag: 'wx' });
  } else if (exists) {
    await unlink(target);
  }
}

process.stdout.write(`${mode}: ${files.length} generated paths\n`);
