import path from 'node:path';
import { defineConfig } from '@playwright/test';
import base from '../../../playwright.config';

// Run only the in-memory SDK boundary tests without provisioning Supabase.
// The existing merged fixtures still launch Chromium for network monitoring.
const projectRoot = path.resolve(import.meta.dirname, '../../..');

export default defineConfig({
  ...base,
  globalSetup: undefined,
  webServer: [],
  testDir: path.join(projectRoot, 'tests/api'),
  testMatch: 'empty-database-error-fallback.spec.ts',
  projects: [{ name: 'api' }],
  retries: 0,
  workers: 2,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(import.meta.dirname, 'validation/sdk-results.json') }],
  ],
  outputDir: path.join(projectRoot, 'test-results/dw39-sdk'),
});
