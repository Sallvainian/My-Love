import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import artifactConfig from '../playwright.config';

const artifactDir = fileURLToPath(new URL('../', import.meta.url));
const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export default defineConfig({
  ...artifactConfig,
  workers: 1,
  grep: /DW83-E2E-001/,
  projects: artifactConfig.projects!.filter((project) => project.name === 'chromium'),
  outputDir: join(artifactDir, 'test-results/utf16-probe'),
  reporter: [
    ['list'],
    ['json', { outputFile: join(artifactDir, 'evidence/utf16-probe-results.json') }],
  ],
  webServer: {
    command: 'npx vite --config _bmad-output/test-artifacts/automation-dw-events-unicode-character-limits/probe/vite.config.ts --mode test --host 127.0.0.1 --port 5183 --strictPort',
    cwd: projectRoot,
    url: 'http://127.0.0.1:5183',
    reuseExistingServer: false,
    timeout: 120000,
    stdout: 'pipe',
  },
});
