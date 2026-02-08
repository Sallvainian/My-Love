import { createGzip } from 'node:zlib';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

const ROOT = process.cwd();
const DIST_ASSETS = join(ROOT, 'dist', 'assets');
const OUTPUT_FILE = join(ROOT, 'docs', 'performance', 'bundle-report.md');
const BUILD_LOG_FILE = join(ROOT, 'docs', 'performance', 'perf-build.log');

const TARGET_PREFIXES = ['index-', 'vendor-supabase-', 'vendor-animation-', 'vendor-state-'];

const toKb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;
const timestamp = new Date().toISOString();

async function gzipSize(filePath) {
  let size = 0;
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      size += chunk.length;
      callback();
    },
  });

  await pipeline(createReadStream(filePath), createGzip(), sink);
  return size;
}

if (!existsSync(DIST_ASSETS)) {
  console.error('Missing dist/assets. Run `npm run perf:build` first.');
  process.exit(1);
}

const files = readdirSync(DIST_ASSETS);
const rows = [];
const cssRows = [];

for (const file of files) {
  if (file.endsWith('.js')) {
    const prefix = TARGET_PREFIXES.find((candidate) => file.startsWith(candidate));
    if (!prefix) {
      continue;
    }

    const absolutePath = join(DIST_ASSETS, file);
    const rawBytes = statSync(absolutePath).size;
    const gzipBytes = await gzipSize(absolutePath);

    rows.push({
      chunkGroup: prefix.slice(0, -1),
      file,
      rawBytes,
      gzipBytes,
    });
    continue;
  }

  if (file.endsWith('.css')) {
    const absolutePath = join(DIST_ASSETS, file);
    const rawBytes = statSync(absolutePath).size;
    const gzipBytes = await gzipSize(absolutePath);
    cssRows.push({ file, rawBytes, gzipBytes });
  }
}

rows.sort((a, b) => b.rawBytes - a.rawBytes);
cssRows.sort((a, b) => b.rawBytes - a.rawBytes);

const totals = rows.reduce(
  (acc, row) => {
    acc.raw += row.rawBytes;
    acc.gzip += row.gzipBytes;
    return acc;
  },
  { raw: 0, gzip: 0 }
);

const cssTotals = cssRows.reduce(
  (acc, row) => {
    acc.raw += row.rawBytes;
    acc.gzip += row.gzipBytes;
    return acc;
  },
  { raw: 0, gzip: 0 }
);

const warningLines = existsSync(BUILD_LOG_FILE)
  ? readFileSync(BUILD_LOG_FILE, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /\bwarning\b/i.test(line))
  : [];

const uniqueWarnings = [...new Set(warningLines)];

const markdown = `# Bundle Report

Generated: ${timestamp}

## Target Chunks

| Chunk Group | File | Raw Size | Gzip Size |
| --- | --- | ---: | ---: |
${rows.map((row) => `| ${row.chunkGroup} | ${row.file} | ${toKb(row.rawBytes)} | ${toKb(row.gzipBytes)} |`).join('\n')}

## Totals

- Raw: ${toKb(totals.raw)}
- Gzip: ${toKb(totals.gzip)}

## CSS Chunks

| File | Raw Size | Gzip Size |
| --- | ---: | ---: |
${cssRows.length > 0 ? cssRows.map((row) => `| ${row.file} | ${toKb(row.rawBytes)} | ${toKb(row.gzipBytes)} |`).join('\n') : '| _none_ | 0 KB | 0 KB |'}

## CSS Totals

- Raw: ${toKb(cssTotals.raw)}
- Gzip: ${toKb(cssTotals.gzip)}

## Build Warnings

- Warning count: ${uniqueWarnings.length}
${uniqueWarnings.length > 0 ? uniqueWarnings.map((line) => `- ${line}`).join('\n') : '- none'}
`;

mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
writeFileSync(OUTPUT_FILE, markdown, 'utf8');

console.log(`Wrote ${OUTPUT_FILE}`);
