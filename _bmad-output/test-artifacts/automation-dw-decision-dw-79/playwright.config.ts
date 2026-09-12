import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import nativeConfig from '../dw-79-token-persistence/playwright.verify.config';

const directory = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

// Reuse the native runner's environment bootstrap and dedicated Vite origin.
// All tests own synthetic state, so no worker-account provisioning is needed.
export default defineConfig({
  ...nativeConfig,
  globalSetup: undefined,
  testDir: directory,
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  forbidOnly: true,
  // Do not overwrite the original bundle's retained evidence during repeats.
  metadata: {},
  outputDir: join(projectRoot, 'test-results/dw79-tea-automate'),
  reporter: [
    ['list'],
    ['json', { outputFile: join(directory, 'evidence/results.json') }],
  ],
  projects: [
    { name: 'api', testDir: join(directory, 'api') },
    { name: 'chromium', testDir: join(directory, 'e2e') },
    {
      name: 'baseline',
      testDir: join(projectRoot, 'tests/e2e/auth'),
      testMatch: 'token-persistence-overlap.spec.ts',
    },
  ],
});
