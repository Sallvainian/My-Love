import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));

// The parent uses a separate cwd for each child to isolate failures-ai.md.
export default defineConfig({
  testDir: directory,
  testMatch: 'failure-probe.spec.ts',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 15_000,
  outputDir: resolve('child-results'),
  reporter: [
    ['json', { outputFile: resolve('child-report.json') }],
    [resolve(directory, '../../../../tests/support/reporters/failure-summary-reporter.ts')],
  ],
});
