import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import projectConfig from '../../../playwright.config';

const directory = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

// Reuse local Supabase env resolution, auth provisioning, and browser settings.
// Only discovery/output paths differ from the repository's regular test run.
export default defineConfig({
  ...projectConfig,
  testDir: directory,
  globalSetup: join(projectRoot, 'tests/support/auth/global-setup.ts'),
  forbidOnly: true,
  retries: 0,
  workers: 2,
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
    ...projectConfig.webServer,
    command: 'npx vite --mode test',
    cwd: projectRoot,
  },
});
