import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import baseConfig from '../../../playwright.config';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const browserUrl = 'http://127.0.0.1:5187';

/**
 * Local verification against the existing worker pool. The normal global setup
 * resets passwords and partner links, which are shared with other worktrees.
 * Importing the base config retains its local Supabase environment bootstrap.
 */
export default defineConfig({
  ...baseConfig,
  globalSetup: undefined,
  testDir: resolve(projectRoot, 'tests'),
  retries: 0,
  workers: 2,
  use: { ...baseConfig.use, baseURL: browserUrl },
  projects: baseConfig.projects?.map((project) => ({
    ...project,
    testDir: resolve(projectRoot, project.testDir ?? 'tests'),
  })),
  webServer: {
    command: 'npx vite --mode test --host 127.0.0.1 --port 5187 --strictPort',
    cwd: projectRoot,
    url: browserUrl,
    reuseExistingServer: false,
    timeout: 120000,
  },
  reporter: [
    ['list'],
    ['json', { outputFile: resolve(projectRoot, 'test-results/dw-auth-bootstrap-notification-order/playwright-results.json') }],
  ],
  outputDir: resolve(projectRoot, 'test-results/dw-auth-bootstrap-notification-order/artifacts'),
});
