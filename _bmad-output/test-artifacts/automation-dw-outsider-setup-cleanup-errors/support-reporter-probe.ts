import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter';

type ProbeKind = 'returned-error' | 'rejected-string' | 'rejected-object';

function reportErrors(suites: JSONReportSuite[]): { message?: string }[] {
  return suites.flatMap((suite) => [
    ...suite.specs.flatMap((spec) =>
      spec.tests.flatMap((test) => test.results.flatMap((result) => result.errors))
    ),
    ...reportErrors(suite.suites ?? []),
  ]);
}

export async function runReporterProbe(kind: ProbeKind, outputDirectory: string) {
  const userId = randomUUID();
  const setupMessage = `DW71 setup failed for ${kind}`;
  const cleanupMessage = `DW71 cleanup failed for ${kind}`;
  const directory = dirname(fileURLToPath(import.meta.url));
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
  await mkdir(outputDirectory, { recursive: true });
  const execution = await new Promise<{ exitCode: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      execFile(process.execPath, [cli, 'test', '--config', join(directory, 'probe/playwright.config.ts')], {
        cwd: outputDirectory,
        timeout: 45_000,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          ...process.env,
          DW71_PROBE_KIND: kind,
          DW71_PROBE_USER_ID: userId,
          DW71_PROBE_SETUP_MESSAGE: setupMessage,
          DW71_PROBE_CLEANUP_MESSAGE: cleanupMessage,
          FORCE_COLOR: '0',
        },
      }, (error, stdout, stderr) => {
        if (error && (error.killed || typeof error.code !== 'number')) {
          reject(error);
        } else {
          resolve({ exitCode: typeof error?.code === 'number' ? error.code : 0, stdout, stderr });
        }
      });
    }
  );
  const report: JSONReport = JSON.parse(await readFile(join(outputDirectory, 'child-report.json'), 'utf8'));
  const markdown = await readFile(join(outputDirectory, 'failures-ai.md'), 'utf8');
  return { ...execution, report, errors: reportErrors(report.suites), markdown, userId, setupMessage, cleanupMessage };
}
