import { test, expect } from '../../../tests/support/merged-fixtures';
import { log } from '@seontechnologies/playwright-utils';
import { runReporterProbe } from './support-reporter-probe';
import { nodeOnlyFixtures } from './support-node-only';

// These journeys exercise the actual Playwright runner and repository reporter.
// The helper runs in Node, so product navigation and authenticated users add no coverage.
test.use(nodeOnlyFixtures);
test.setTimeout(60_000);

const cleanupFailures = [
  { kind: 'returned-error', label: 'returned AuthError' },
  { kind: 'rejected-string', label: 'rejected string' },
  { kind: 'rejected-object', label: 'rejected object' },
] as const;

test.describe('Outsider setup and cleanup diagnostics through Playwright reporting', () => {
  for (const failure of cleanupFailures) {
    test(`[P1] preserves both failures in JSON and Markdown for ${failure.label}`, async (
      {},
      testInfo
    ) => {
      await log.step(`Run an isolated failing helper with ${failure.label} cleanup`);
      const probe = await runReporterProbe(failure.kind, testInfo.outputPath('probe'));

      // The child deliberately fails once; this outer test verifies its real reporters.
      expect(probe.exitCode, probe.stderr || probe.stdout).toBe(1);
      expect(probe.report.stats).toMatchObject({
        expected: 0,
        unexpected: 1,
        skipped: 0,
        flaky: 0,
      });

      await log.step('Verify the same aggregate failure contains both diagnostics');
      const aggregate = probe.errors.find(({ message }) =>
        message?.includes('Failed to set up and clean up outsider account')
      );
      expect(aggregate, 'JSON report must retain the outsider aggregate failure').toBeDefined();
      expect(aggregate?.message).toContain('Setup:');
      expect(aggregate?.message).toContain('Cleanup:');
      expect(probe.markdown).toContain('**1 failed** out of 1 tests');

      for (const detail of [probe.userId, probe.setupMessage, probe.cleanupMessage]) {
        expect(detail, 'The fixture must provide a nonempty expected diagnostic').not.toBe('');
        expect(aggregate?.message).toContain(detail);
        expect(probe.markdown).toContain(detail);
      }
    });
  }
});
