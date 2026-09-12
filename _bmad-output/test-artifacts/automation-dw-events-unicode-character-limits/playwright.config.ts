import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import projectConfig from '../../../playwright.config';

const directory = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const baseURL = 'http://127.0.0.1:5183';

// The existing auth provider uses BASE_URL for localStorage's origin.
process.env.BASE_URL = baseURL;
if (!process.env.SUPABASE_URL ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.SUPABASE_URL).hostname)) {
  throw new Error('DW-83 automation requires local Supabase. Run supabase start first.');
}

// Reuse local key resolution, worker auth, diagnostics and project settings.
// Discover this artifact package explicitly without moving tests into tests/.
export default defineConfig({
  ...projectConfig,
  testDir: directory,
  globalSetup: join(projectRoot, 'tests/support/auth/global-setup.ts'),
  forbidOnly: true,
  retries: 0,
  workers: 2,
  use: { ...projectConfig.use, baseURL },
  outputDir: join(directory, 'test-results'),
  reporter: [
    ['list'],
    ['json', { outputFile: join(directory, 'evidence/results.json') }],
  ],
  projects: projectConfig.projects!
    .filter((project) => project.name === 'api' || project.name === 'chromium')
    .map((project) => ({
      ...project,
      testDir: join(directory, project.name === 'api' ? 'api' : 'e2e'),
    })),
  webServer: {
    command: 'npx vite --mode test --host 127.0.0.1 --port 5183 --strictPort',
    cwd: projectRoot,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
