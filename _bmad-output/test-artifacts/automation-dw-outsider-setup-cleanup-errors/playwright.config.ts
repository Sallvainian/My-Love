import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));

// These artifact tests exercise Node SDK/reporting boundaries, with no app server.
export default defineConfig({
  testDir: directory,
  testMatch: /(?:api|e2e)-outsider-.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 60_000,
  outputDir: join(directory, 'test-results'),
  reporter: [
    ['list'],
    ['json', { outputFile: join(directory, 'run-results.json') }],
  ],
});
