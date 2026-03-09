#!/usr/bin/env node
/**
 * Playwright Failure Summarizer — AI-friendly Markdown output
 *
 * Reads Playwright --reporter=json output, extracts failed tests,
 * groups by root cause pattern, and outputs structured Markdown
 * optimized for LLM consumption.
 *
 * Creates a dated results folder (test-results-MM-DD-YY/) with per-test
 * subfolders containing traces, error context, and screenshots.
 *
 * Usage:
 *   npx playwright test --reporter=json > playwright-results.json
 *   node scripts/pw-failures.mjs playwright-results.json
 *
 * npm script (pipes directly):
 *   npm run test:failures
 */
import fs from 'node:fs';
import path from 'node:path';

// ─── Helpers ──────────────────────────────────────────────────────────

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Find the actual Playwright JSON object — skip banner noise like
  // dotenvx's `{ override: true }` by looking for `{"config"` which
  // is always the first key in Playwright's JSON reporter output.
  const jsonStart = raw.indexOf('{"config"');
  if (jsonStart !== -1) return JSON.parse(raw.slice(jsonStart));

  // Fallback: try the first `{` on its own line
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith('{')) {
      try {
        return JSON.parse(lines.slice(i).join('\n'));
      } catch {
        continue;
      }
    }
  }
  throw new Error('No JSON object found in input');
}

function safeReadFile(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function safeCopyFile(src, dest) {
  try {
    fs.cpSync(src, dest, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function normalizeNewlines(s) {
  return (s ?? '').replace(/\r\n/g, '\n');
}

/** Strip ANSI escape codes (colors, bold, etc.) */
function stripAnsi(s) {
  return (s ?? '').replace(/\x1b\[[0-9;]*m/g, '').replace(/\[(\d+)m/g, '');
}

function pickLastResult(test) {
  const results = test?.results ?? [];
  return results.length ? results[results.length - 1] : null;
}

function isFailureStatus(status) {
  return status === 'failed' || status === 'timedOut' || status === 'interrupted';
}

function formatLocation(file, line) {
  if (!file) return 'unknown';
  return `${file}:${line ?? '?'}`;
}

function mdEscape(s) {
  return (s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escape content for use inside a fenced code block (prevent nested fence breaks) */
function escapeCodeBlock(s) {
  return (s ?? '').replace(/```/g, '~~~');
}

/** Slugify a string for use as a folder name */
function slugify(s, maxLen = 80) {
  return (s ?? 'unknown')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

/** Format date as MM-DD-YY */
function formatDateStamp() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}-${dd}-${yy}`;
}

// ─── Extractors ───────────────────────────────────────────────────────

/** Extract TEA test ID like [4.1-API-001] or [4.1-E2E-001] from title */
function extractTestId(title) {
  const match = title?.match(/\[(\d+\.\d+-\w+-\d+)\]/);
  return match ? match[1] : null;
}

/** Extract priority like [P0], [P1] from title */
function extractPriority(title) {
  const match = title?.match(/\[(P\d)\]/);
  return match ? match[1] : null;
}

/** Extract API path from error message or stack (e.g. /rest/v1/rpc/scripture_submit_reflection) */
function extractApiPath(errors) {
  for (const e of errors) {
    const text = stripAnsi((e?.message ?? '') + (e?.stack ?? ''));
    const match = text.match(/\/rest\/v1\/[^\s'"`)]+/);
    if (match) return match[0];
  }
  return null;
}

/** Extract a short error signature for grouping */
function extractErrorSignature(errors) {
  if (!errors.length) return 'unknown error';
  const msg = stripAnsi(normalizeNewlines(errors[0]?.message ?? ''));

  // Object.is equality pattern
  const objIs = msg.match(/Expected:\s*(.+)\s*\nReceived:\s*(.+)/);
  if (objIs) return `Expected: ${objIs[1].trim()}, Received: ${objIs[2].trim()}`;

  // ZodError
  if (msg.includes('ZodError')) return 'ZodError: schema validation failed';

  // Timeout
  const timeout = msg.match(/Timeout \d+ms exceeded/);
  if (timeout) return timeout[0];

  // First meaningful line, truncated at a word boundary
  const firstLine = msg.split('\n').find((l) => l.trim().length > 0) ?? 'unknown';
  const trimmed = firstLine.trim();
  if (trimmed.length <= 100) return trimmed;
  return trimmed.slice(0, 100).replace(/\s+\S*$/, '') + '…';
}

// ─── Step timeline ────────────────────────────────────────────────────

/**
 * Flatten nested test steps into a timeline with indent depth.
 * Returns: [{ depth, title, category, duration, failed, location }]
 */
function flattenSteps(steps, depth = 0) {
  const out = [];
  for (const s of steps ?? []) {
    out.push({
      depth,
      title: s.title ?? '',
      category: s.category ?? '',
      duration: s.duration ?? 0,
      failed: s.error != null,
      location: s.location ? `${s.location.file}:${s.location.line}` : null,
    });
    out.push(...flattenSteps(s.steps, depth + 1));
  }
  return out;
}

/** Format step timeline as indented text block */
function formatStepTimeline(steps) {
  if (!steps?.length) return '';
  const flat = flattenSteps(steps);
  if (!flat.length) return '';

  let block = '**Action timeline** (last attempt)\n\n```\n';
  for (const s of flat) {
    const indent = '  '.repeat(s.depth);
    const marker = s.failed ? 'FAIL' : ' ok ';
    const dur = s.duration > 0 ? ` (${s.duration}ms)` : '';
    const cat = s.category ? `[${s.category}]` : '';
    block += `${marker} ${indent}${s.title}${dur} ${cat}\n`;
  }
  block += '```\n\n';
  return block;
}

// ─── Retry history ────────────────────────────────────────────────────

/** Format retry history showing all attempts, not just the last */
function formatRetryHistory(allResults) {
  if (!allResults || allResults.length <= 1) return '';
  let block = '**Retry history**\n\n';
  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    const status = r.status ?? 'unknown';
    const dur = r.duration ?? 0;
    const errMsg = stripAnsi(normalizeNewlines(r.errors?.[0]?.message ?? ''))
      .split('\n')[0]
      ?.trim();
    block += `- Attempt ${i + 1}: **${status}** (${dur}ms)`;
    if (errMsg && status !== 'passed') block += ` — ${errMsg.slice(0, 120)}`;
    block += '\n';
  }
  block += '\n';
  return block;
}

// ─── Context and attachments ──────────────────────────────────────────

function findContextForAI(attachments) {
  if (!Array.isArray(attachments)) return null;

  const candidates = attachments.filter((a) => {
    const n = (a?.name ?? '').toLowerCase();
    const p = (a?.path ?? '').toLowerCase();
    return (
      n.includes('error-context') ||
      n.includes('context for ai') ||
      p.endsWith('error-context.md') ||
      p.endsWith('error_context.md')
    );
  });

  for (const a of candidates) {
    if (a?.path && fs.existsSync(a.path)) {
      const content = safeReadFile(a.path);
      if (content) return { attachment: a, content: normalizeNewlines(content) };
    }
  }
  return null;
}

// ─── Collector ────────────────────────────────────────────────────────

/**
 * Walk the Playwright JSON report structure.
 *
 * Structure: report.suites[] → suite.suites[] (nested) → suite.specs[]
 * Each spec has: title, file, line, column, tests[]
 * Each test has: projectName, expectedStatus, results[]
 * Title and location live on the SPEC, not the test.
 */
function collectFailedTests(report) {
  const failed = [];

  function walkSuite(suite, breadcrumb = []) {
    const nextCrumb = suite?.title ? [...breadcrumb, suite.title] : breadcrumb;

    for (const spec of suite?.specs ?? []) {
      for (const test of spec?.tests ?? []) {
        const last = pickLastResult(test);
        if (!last || !isFailureStatus(last.status)) continue;

        const errors = last.errors ?? (last.error ? [last.error] : []);
        const titlePath = [...nextCrumb, spec.title].filter(Boolean);
        const fullTitle = titlePath.join(' › ');

        failed.push({
          project: test.projectName ?? 'unknown',
          title: spec.title ?? 'unknown',
          titlePath,
          fullTitle,
          file: spec.file ?? null,
          line: spec.line ?? null,
          expectedStatus: test.expectedStatus,
          status: last.status,
          duration: last.duration,
          retry: last.retry,
          startTime: last.startTime ?? null,
          workerIndex: last.workerIndex ?? null,
          errors,
          attachments: last.attachments ?? [],
          steps: last.steps ?? [],
          stdout: last.stdout ?? [],
          stderr: last.stderr ?? [],
          allResults: test.results ?? [],
          // Extracted fields
          testId: extractTestId(fullTitle),
          priority: extractPriority(fullTitle),
          apiPath: extractApiPath(errors),
          errorSignature: extractErrorSignature(errors),
        });
      }
    }

    for (const child of suite?.suites ?? []) walkSuite(child, nextCrumb);
  }

  for (const s of report?.suites ?? []) walkSuite(s, []);
  return failed;
}

// ─── Grouping ─────────────────────────────────────────────────────────

function groupBySignature(failed) {
  const groups = new Map();
  for (const f of failed) {
    const key = f.errorSignature;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

function summarizeByProject(failed) {
  const counts = new Map();
  for (const f of failed) counts.set(f.project, (counts.get(f.project) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// ─── Formatters ───────────────────────────────────────────────────────

/** Format error message + stack with ANSI codes stripped */
function formatError(errors) {
  if (!errors.length) return '';
  const msg = stripAnsi(normalizeNewlines(errors[0]?.message ?? ''));
  const stack = stripAnsi(normalizeNewlines(errors[0]?.stack ?? ''));
  let block = '```text\n';
  block += msg.trim() + '\n';
  if (stack.trim()) block += '\n' + stack.trim() + '\n';
  block += '```\n\n';
  return block;
}

/** Format context-for-AI section, escaping nested fences */
function formatContext(attachments) {
  const ctx = findContextForAI(attachments);
  if (!ctx?.content) return '';
  let block = `**Context for AI** (from \`${ctx.attachment.path}\`)\n\n`;
  block += '```\n' + escapeCodeBlock(ctx.content.trim()) + '\n```\n\n';
  return block;
}

/** Format stdout/stderr if present */
function formatStdio(stdout, stderr) {
  let block = '';
  const outLines = (stdout ?? [])
    .map((s) => (typeof s === 'string' ? s : ''))
    .join('')
    .trim();
  const errLines = (stderr ?? [])
    .map((s) => (typeof s === 'string' ? s : ''))
    .join('')
    .trim();

  if (outLines) {
    block += '**stdout**\n\n```\n' + escapeCodeBlock(stripAnsi(outLines)) + '\n```\n\n';
  }
  if (errLines) {
    block += '**stderr**\n\n```\n' + escapeCodeBlock(stripAnsi(errLines)) + '\n```\n\n';
  }
  return block;
}

/** Find the failing step (deepest step with an error) */
function findFailingStep(steps) {
  for (const s of steps ?? []) {
    const deeper = findFailingStep(s.steps);
    if (deeper) return deeper;
    if (s.error != null) return s;
  }
  return null;
}

/** Format the failing step as a concise summary */
function formatFailingAction(steps) {
  const step = findFailingStep(steps);
  if (!step) return '';
  const loc = step.location ? ` at \`${step.location.file}:${step.location.line}\`` : '';
  return `- Failing action: **${mdEscape(step.title)}**${loc}\n`;
}

// ─── Artifact folder ──────────────────────────────────────────────────

/**
 * Create dated results folder with per-test subfolders containing
 * traces, error context, and screenshots.
 */
function createArtifactFolder(failed) {
  if (!failed.length) return null;

  const stamp = formatDateStamp();
  const parentDir = path.resolve('_bmad-output', 'pw-test-results');
  fs.mkdirSync(parentDir, { recursive: true });
  const folderName = stamp;
  const folderPath = path.join(parentDir, folderName);

  // If folder already exists with today's date, append a counter
  let finalPath = folderPath;
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    finalPath = `${folderPath}-${counter++}`;
  }
  fs.mkdirSync(finalPath, { recursive: true });

  for (const f of failed) {
    // Build subfolder name: testId or slugified title
    const testLabel = f.testId ?? slugify(f.title);
    const subName = `${testLabel}--${f.project}`;
    const subPath = path.join(finalPath, subName);
    fs.mkdirSync(subPath, { recursive: true });

    // Copy attachments (screenshots, error-context, traces)
    for (const att of f.attachments ?? []) {
      if (!att?.path) continue;
      const src = att.path;
      const destName = att.name ? slugify(att.name, 60) + path.extname(src) : path.basename(src);
      if (fs.existsSync(src)) {
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
          safeCopyFile(src, path.join(subPath, path.basename(src)));
        } else {
          safeCopyFile(src, path.join(subPath, destName));
        }
      }
    }

    // Also copy from the test-results/ directory if we can find a matching folder
    // Playwright stores artifacts at test-results/<truncated-test-name>/
    // We look for trace.zip specifically
    for (const att of f.attachments ?? []) {
      if (!att?.path) continue;
      const attDir = path.dirname(att.path);
      // Copy trace.zip if it exists in the same directory
      const traceZip = path.join(attDir, 'trace.zip');
      if (fs.existsSync(traceZip) && !fs.existsSync(path.join(subPath, 'trace.zip'))) {
        safeCopyFile(traceZip, path.join(subPath, 'trace.zip'));
      }
    }

    // Write a per-test summary markdown
    let summary = `# ${mdEscape(f.fullTitle)}\n\n`;
    summary += `- Project: **${mdEscape(f.project)}**\n`;
    summary += `- Location: \`${mdEscape(formatLocation(f.file, f.line))}\`\n`;
    summary += `- Status: **${mdEscape(f.status)}**\n`;
    if (f.priority) summary += `- Priority: **${f.priority}**\n`;
    if (f.testId) summary += `- Test ID: **${f.testId}**\n`;
    if (f.apiPath) summary += `- API Path: \`${mdEscape(f.apiPath)}\`\n`;
    summary += `- Duration: \`${f.duration}ms\`\n`;
    if (f.workerIndex != null) summary += `- Worker: \`${f.workerIndex}\`\n`;
    if (f.retry > 0) summary += `- Retry: \`${f.retry}\`\n`;
    summary += formatFailingAction(f.steps);
    summary += '\n';
    summary += formatError(f.errors);
    summary += formatRetryHistory(f.allResults);
    summary += formatStepTimeline(f.steps);
    summary += formatStdio(f.stdout, f.stderr);
    summary += formatContext(f.attachments);

    fs.writeFileSync(path.join(subPath, 'failure-summary.md'), summary, 'utf8');
  }

  return path.basename(finalPath);
}

// ─── Main ─────────────────────────────────────────────────────────────

function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: node scripts/pw-failures.mjs <playwright-results.json>');
    process.exit(1);
  }

  const report = readJson(jsonPath);
  const failed = collectFailedTests(report);

  let out = '';
  out += `# Playwright Failures\n\n`;
  out += `- **Failed**: ${failed.length} test(s)\n`;

  const config = report?.config;
  if (config?.configFile) out += `- Config: \`${mdEscape(config.configFile)}\`\n`;
  if (config?.workers != null) out += `- Workers: \`${config.workers}\`\n`;
  out += `\n`;

  if (failed.length === 0) {
    out += `All tests passed.\n`;
    process.stdout.write(out);
    writeOutputFile(out);
    return;
  }

  // Create dated artifact folder
  const artifactFolder = createArtifactFolder(failed);
  if (artifactFolder) {
    out += `- Artifacts: \`${artifactFolder}/\`\n\n`;
  }

  // By project
  const byProject = summarizeByProject(failed);
  if (byProject.length) {
    out += `## By project\n\n`;
    for (const [proj, n] of byProject) out += `- **${mdEscape(proj)}**: ${n}\n`;
    out += `\n`;
  }

  // Root cause groups
  const groups = groupBySignature(failed);
  out += `## Root cause groups\n\n`;
  out += `| # | Error pattern | Count | Projects | Files |\n`;
  out += `|---|---------------|-------|----------|-------|\n`;
  groups.forEach(([sig, tests], idx) => {
    const projects = [...new Set(tests.map((t) => t.project))].join(', ');
    const files = [...new Set(tests.map((t) => t.file ?? '?').map((f) => f.split('/').pop()))].join(
      ', '
    );
    out += `| ${idx + 1} | ${mdEscape(sig)} | ${tests.length} | ${projects} | ${files} |\n`;
  });
  out += `\n`;

  // Detailed failures, grouped
  out += `## Details\n\n`;

  groups.forEach(([sig, tests], groupIdx) => {
    if (tests.length > 1) {
      // Deduplicated group
      out += `### Group ${groupIdx + 1}: ${mdEscape(sig)} (${tests.length} tests)\n\n`;

      // Show the error once
      out += formatError(tests[0].errors);

      // List affected tests
      out += `| Priority | Test ID | Title | Location | Failing Action |\n`;
      out += `|----------|---------|-------|----------|----------------|\n`;
      for (const f of tests) {
        const loc = formatLocation(f.file, f.line);
        const failStep = findFailingStep(f.steps);
        const failAction = failStep ? mdEscape(failStep.title).slice(0, 60) : '-';
        out += `| ${f.priority ?? '-'} | ${f.testId ?? '-'} | ${mdEscape(f.title)} | \`${mdEscape(loc)}\` | ${failAction} |\n`;
      }
      out += `\n`;

      // Show step timeline from first test
      out += formatStepTimeline(tests[0].steps);

      // Show retry history from first test
      out += formatRetryHistory(tests[0].allResults);

      // Show context for AI from first test that has it
      for (const f of tests) {
        const ctx = formatContext(f.attachments);
        if (ctx) {
          out += ctx;
          break;
        }
      }
    } else {
      // Single failure — full detail
      const f = tests[0];
      const titlePath = (f.titlePath?.length ? f.titlePath : [f.title]).join(' › ');
      out += `### ${groupIdx + 1}) ${mdEscape(titlePath)}\n\n`;
      out += `- Project: **${mdEscape(f.project)}**\n`;
      out += `- Location: \`${mdEscape(formatLocation(f.file, f.line))}\`\n`;
      out += `- Status: **${mdEscape(f.status)}**\n`;
      if (f.priority) out += `- Priority: **${f.priority}**\n`;
      if (f.testId) out += `- Test ID: **${f.testId}**\n`;
      if (f.apiPath) out += `- API Path: \`${mdEscape(f.apiPath)}\`\n`;
      out += `- Duration: \`${f.duration}ms\`\n`;
      if (f.workerIndex != null) out += `- Worker: \`${f.workerIndex}\`\n`;
      out += formatFailingAction(f.steps);
      out += `\n`;

      out += formatError(f.errors);
      out += formatRetryHistory(f.allResults);
      out += formatStepTimeline(f.steps);
      out += formatStdio(f.stdout, f.stderr);

      const atts = f.attachments?.filter((a) => a?.path) ?? [];
      if (atts.length) {
        out += `**Attachments**\n\n`;
        for (const a of atts) out += `- ${a.name ?? 'attachment'}: \`${a.path}\`\n`;
        out += `\n`;
      }

      out += formatContext(f.attachments);
    }
  });

  process.stdout.write(out);
  writeOutputFile(out);
}

function writeOutputFile(out) {
  const resolvedOut = path.resolve('failures-ai.md');
  fs.writeFileSync(resolvedOut, out, 'utf8');
  process.stderr.write(`Written to ${resolvedOut}\n`);
}

main();
