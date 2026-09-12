import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import projectConfig from '../../../playwright.config';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

// Import the existing local Supabase environment bootstrap, then explicitly
// disable account provisioning. No worker token or shared account is required.
export default defineConfig({
  ...projectConfig,
  globalSetup: undefined,
  testDir: fileURLToPath(new URL('../../../tests/e2e/auth', import.meta.url)),
  testMatch: 'token-persistence-overlap.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: fileURLToPath(new URL('../../../test-results/dw-79-token-persistence', import.meta.url)),
  reporter: [['list']],
  metadata: { dw79EvidenceDirectory: fileURLToPath(new URL('./evidence', import.meta.url)) },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5189',
    // Retain the explicit sanitized JSON, never raw browser/network recordings.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'npx vite --mode test --host 127.0.0.1 --port 5189 --strictPort',
    cwd: projectRoot,
    url: 'http://127.0.0.1:5189/tests/support/harnesses/auth-token-persistence.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
