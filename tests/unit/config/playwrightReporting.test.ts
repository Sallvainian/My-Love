import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlaywrightTestConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Inspect configuration without running local infrastructure probes or tests.
vi.mock('child_process', () => {
  const execSync = () => { throw new Error('Infrastructure probes disabled in config test'); };
  return { execSync, default: { execSync } };
});
vi.mock('@playwright/test', () => ({
  defineConfig: (config: unknown) => config,
  devices: { 'Desktop Chrome': {} },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Playwright shard reporting', () => {
  it.each([undefined, '0', '1'])('enables blobs only with explicit opt-in %s', async (flag) => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('E2E_BLOB_REPORT', flag);
    // The Playwright config is outside tsconfig.test's composite file list.
    // Load it through Vitest while keeping the infrastructure mocks in effect.
    const { default: config } = await vi.importActual<{ default: PlaywrightTestConfig }>(
      '../../../playwright.config.ts'
    );

    expect(config.reporter).toEqual([
      ['html', { outputFolder: 'playwright-report' }],
      ['junit', { outputFile: 'test-results/junit.xml' }],
      ['list'],
      ['./tests/support/reporters/failure-summary-reporter.ts'],
      ...(flag === '1' ? [['blob']] : []),
    ]);
  });

  it('connects shard blob production and upload to the matching merge inputs', () => {
    const workflow = readFileSync('.github/workflows/test.yml', 'utf8');
    const job = (name: string) => workflow.split(`\n  ${name}:\n`)[1]?.split(/\n {2}[\w-]+:\n/)[0] ?? '';
    const shards = job('e2e-tests');
    const merge = job('merge-reports');

    expect(shards).toMatch(/E2E_BLOB_REPORT: '1'\s+run: npx playwright test --project=chromium --shard=/);
    expect(shards).toContain('name: e2e-blob-report-shard-${{ matrix.shard }}');
    expect(shards).toMatch(/path: blob-report\/\s+if-no-files-found: error\s+retention-days: 30/);
    expect(merge).toMatch(/pattern: e2e-blob-report-shard-\*\s+path: all-blob-reports\/\s+merge-multiple: true/);
    expect(merge).toContain('run: npm ci');
    expect(merge).toContain('reports=(all-blob-reports/*.zip)');
    expect(merge).toContain('if (( ${#reports[@]} != 4 )); then');
    expect(merge).toMatch(/Expected 4 shard blob reports[\s\S]+exit 1/);
    expect(merge).toMatch(/^ {10}npx playwright merge-reports --reporter=html all-blob-reports\/\s*$/m);
    expect(merge).not.toContain('Merge skipped');
    expect(merge).toMatch(/path: playwright-report\/\s+if-no-files-found: error/);
    expect(job('burn-in')).not.toContain('E2E_BLOB_REPORT');
  });
});
