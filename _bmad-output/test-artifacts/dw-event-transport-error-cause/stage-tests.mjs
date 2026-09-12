import { readFile, writeFile, mkdir, unlink, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bundle = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(bundle, '../../..');
const files = [
  'tests/api/event-transport-error-cause.spec.ts',
  'tests/e2e/settings/event-transport-error-cause.spec.ts',
  'tests/support/factories/event-transport-error.ts',
  'tests/support/helpers/event-transport-error.ts',
];
const mode = process.argv[2];
if (!['stage', 'clean'].includes(mode)) throw new Error('Usage: node stage-tests.mjs stage|clean');

// Check the entire set before mutating anything. Never overwrite existing tests
// or remove a staged file whose content someone has changed in the meantime.
const entries = await Promise.all(files.map(async (file) => {
  const source = await readFile(path.join(bundle, file), 'utf8');
  const target = path.join(root, file);
  const exists = await access(target).then(() => true, () => false);
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
