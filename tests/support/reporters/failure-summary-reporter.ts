import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

interface FailureEntry {
  titlePath: string;
  location: string;
  errorMessage: string;
  failingAction: string | null;
  networkErrors: string[];
  attachmentPaths: { name: string; path: string }[];
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[(\d+)m/g, '');
}

function findFailingStep(steps: TestStep[]): TestStep | null {
  for (const step of steps) {
    const deeper = findFailingStep(step.steps);
    if (deeper) return deeper;
    if (step.error) return step;
  }
  return null;
}

function formatFailingAction(step: TestStep): string {
  const loc = step.location
    ? ` at \`${path.basename(step.location.file)}:${step.location.line}\``
    : '';
  return `\`${step.title}\`${loc}`;
}

function parseNetworkErrors(attachments: TestResult['attachments']): string[] {
  const errors: string[] = [];
  for (const att of attachments) {
    if (att.name !== 'network-errors.json') continue;
    try {
      let data: { method?: string; url?: string; status?: number }[];
      if (att.body) {
        data = JSON.parse(att.body.toString('utf-8'));
      } else if (att.path) {
        data = JSON.parse(fs.readFileSync(att.path, 'utf-8'));
      } else {
        continue;
      }
      for (const entry of data) {
        const urlPath = entry.url ? new URL(entry.url).pathname : '?';
        errors.push(`${entry.method ?? '?'} ${urlPath} → ${entry.status ?? '?'}`);
      }
    } catch {
      // Skip malformed network error attachments
    }
  }
  return errors;
}

class FailureSummaryReporter implements Reporter {
  private failures: FailureEntry[] = [];
  private totalTests = 0;

  onBegin(_config: FullConfig, suite: Suite) {
    this.totalTests = suite.allTests().length;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'passed' || result.status === 'skipped') return;

    // Build title path like: [chromium] › file.spec.ts:75:5 › Describe › test name
    const parts = test.titlePath();
    const loc = test.location;
    const filePart = loc
      ? `${path.relative(process.cwd(), loc.file)}:${loc.line}:${loc.column}`
      : (parts[1] ?? 'unknown');

    // titlePath() returns ['', project, file, ...describes, testTitle]
    // We want: [project] › file:line:col › ...describes › testTitle
    // Skip parts[0] (empty root) and parts[2] (file name, already in filePart)
    const project = parts[1] ?? 'unknown';
    const describes = parts.slice(3);
    const titlePath = `[${project}] › ${filePart} › ${describes.join(' › ')}`;

    // Error message
    const errorMessage = result.errors
      .map((e) => stripAnsi(e.message ?? e.stack ?? 'Unknown error'))
      .join('\n---\n')
      .trim();

    // Failing action
    const failStep = findFailingStep(result.steps);
    const failingAction = failStep ? formatFailingAction(failStep) : null;

    // Network errors from monitor fixture
    const networkErrors = parseNetworkErrors(result.attachments);

    // Attachment paths (traces, screenshots)
    const attachmentPaths = result.attachments
      .filter((a) => a.path && a.name !== 'network-errors.json')
      .map((a) => ({ name: a.name, path: path.relative(process.cwd(), a.path!) }));

    this.failures.push({
      titlePath,
      location: loc ? `${path.relative(process.cwd(), loc.file)}:${loc.line}` : 'unknown',
      errorMessage,
      failingAction,
      networkErrors,
      attachmentPaths,
    });
  }

  onEnd(_result: FullResult) {
    const outPath = path.resolve('failures-ai.md');

    if (this.failures.length === 0) {
      // Clean up stale file from previous runs
      try {
        fs.unlinkSync(outPath);
      } catch {
        // File didn't exist
      }
      return;
    }

    let md = `# Playwright Failures\n\n`;
    md += `**${this.failures.length} failed** out of ${this.totalTests} tests\n\n`;

    for (let i = 0; i < this.failures.length; i++) {
      const f = this.failures[i];
      md += `---\n\n`;
      md += `## ${i + 1}. ${f.titlePath}\n\n`;

      md += `**Error:**\n\n`;
      md += '```text\n';
      md += f.errorMessage + '\n';
      md += '```\n\n';

      // Context for AI section
      const contextLines: string[] = [];

      if (f.failingAction) {
        contextLines.push(`- Failing action: ${f.failingAction}`);
      }

      for (const ne of f.networkErrors) {
        contextLines.push(`- Network error: ${ne}`);
      }

      for (const att of f.attachmentPaths) {
        contextLines.push(`- ${att.name}: \`${att.path}\``);
      }

      if (contextLines.length > 0) {
        md += `**Context for AI:**\n\n`;
        md += contextLines.join('\n') + '\n\n';
      }
    }

    fs.writeFileSync(outPath, md, 'utf-8');
  }
}

export default FailureSummaryReporter;
