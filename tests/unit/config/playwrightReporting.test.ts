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

const BASE_REPORTERS = [
  ['html', { outputFolder: 'playwright-report' }],
  ['junit', { outputFile: 'test-results/junit.xml' }],
  ['list'],
  ['./tests/support/reporters/failure-summary-reporter.ts'],
];

/**
 * GitHub Actions run ids the e2e shard-count comment in
 * `.github/workflows/test.yml` cites as its evidence: the run whose timings
 * justify 2 shards, and the run behind the historical 381s figure. The comment
 * must keep both, so the choice stays checkable.
 */
const SHARD_MEASUREMENT_RUN_ID = '35056348791';
const HISTORICAL_BASELINE_RUN_ID = '32279178457';

describe('Playwright shard reporting', () => {
  it.each([
    [undefined, BASE_REPORTERS],
    ['0', BASE_REPORTERS],
    ['1', [...BASE_REPORTERS, ['blob']]],
  ])('enables blobs only with explicit opt-in %s', async (flag, expectedReporters) => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('E2E_BLOB_REPORT', flag);
    // The Playwright config is outside tsconfig.test's composite file list.
    // Load it through Vitest while keeping the infrastructure mocks in effect.
    const { default: config } = await vi.importActual<{ default: PlaywrightTestConfig }>(
      '../../../playwright.config.ts'
    );

    expect(config.reporter).toEqual(expectedReporters);
  });

  const readWorkflow = () => readFileSync('.github/workflows/test.yml', 'utf8');
  /** The body of one top-level job in test.yml, or '' when it is missing. */
  const workflowJob = (name: string) =>
    readWorkflow().split(`\n  ${name}:\n`)[1]?.split(/\n {2}[\w-]+:\n/)[0] ?? '';

  it('e2e-tests: each of the 2 shards writes a blob report and uploads it under its shard name', () => {
    const shards = workflowJob('e2e-tests');

    expect(shards).toContain('name: E2E (Shard ${{ matrix.shard }}/2)');
    expect(shards).toMatch(/shard: \[1, 2\]/);
    expect(shards).toMatch(
      /E2E_BLOB_REPORT: '1'\s+run: npx playwright test --project=chromium --shard=\$\{\{ matrix\.shard \}\}\/2/
    );
    expect(shards).toContain('name: e2e-blob-report-shard-${{ matrix.shard }}');
    expect(shards).toMatch(/path: blob-report\/\s+if-no-files-found: error\s+retention-days: 30/);
  });

  it('e2e-tests: the shard-count comment cites both measurement runs', () => {
    const shards = workflowJob('e2e-tests');

    expect(shards).toContain(SHARD_MEASUREMENT_RUN_ID);
    expect(shards).toContain(HISTORICAL_BASELINE_RUN_ID);
  });

  it('merge-reports: downloads every shard blob, requires both, and uploads the merged HTML report', () => {
    const merge = workflowJob('merge-reports');

    expect(merge).toMatch(/pattern: e2e-blob-report-shard-\*\s+path: all-blob-reports\/\s+merge-multiple: true/);
    expect(merge).toContain('run: npm ci');
    expect(merge).toContain('reports=(all-blob-reports/*.zip)');
    expect(merge).toContain('if (( ${#reports[@]} != 2 )); then');
    expect(merge).toMatch(/Expected 2 shard blob reports[\s\S]+exit 1/);
    expect(merge).toMatch(/^ {10}npx playwright merge-reports --reporter=html all-blob-reports\/\s*$/m);
    expect(merge).not.toContain('Merge skipped');
    expect(merge).toMatch(/path: playwright-report\/\s+if-no-files-found: error/);
  });

  it('burn-in: runs its own 3-shard matrix without blob reports', () => {
    const burnIn = workflowJob('burn-in');

    expect(burnIn).toMatch(/shard: \[1, 2, 3\]/);
    expect(burnIn).not.toContain('E2E_BLOB_REPORT');
  });

  it('test.yml no longer references the removed scripture specs', () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('\n  e2e-tests:\n');
    expect(workflow).not.toContain('scripture-reflection-2.2-errors');
    expect(workflow).not.toContain('scripture-stats');
  });

  it('pins CI workers to 2 and drops the scripture shard-block comment', async () => {
    vi.stubEnv('CI', 'true');
    const { default: config } = await vi.importActual<{ default: PlaywrightTestConfig }>(
      '../../../playwright.config.ts'
    );
    const source = readFileSync('playwright.config.ts', 'utf8');
    expect(source).not.toContain('scripture specs sort');
    expect(config.workers).toBe(2);
    expect(source).toContain('workers: process.env.CI ? 2');
  });
});
