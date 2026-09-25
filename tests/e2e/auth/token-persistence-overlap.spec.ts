import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../../support/merged-fixtures';
import type {
  PersistenceEvidence,
  PersistenceScenario,
  PersistenceTraceEntry,
} from '../../support/harnesses/auth-token-persistence';

test.use({ authSessionEnabled: false, trace: 'off', screenshot: 'off', video: 'off' });

const root = fileURLToPath(new URL('../../../', import.meta.url));
const version = (name: string): string => JSON.parse(
  readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')
).version;
const runtime = {
  node: process.version,
  playwright: version('@playwright/test'),
  idb: version('idb'),
  supabaseJs: version('@supabase/supabase-js'),
  authJs: version('@supabase/auth-js'),
  vite: version('vite'),
};
const scenarios: PersistenceScenario[] = [
  'sequential', 'local-actions', 'stale-clear', 'stale-overwrite', 'stale-resurrection', 'same-owner-refresh',
];

function entry(trace: PersistenceTraceEntry[], actor: string, phase: string) {
  const matches = trace.filter((row) => row.actor === actor && row.phase === phase);
  expect(matches, actor + ' / ' + phase).toHaveLength(1);
  return matches[0];
}

function assertNativeEvidence(evidence: PersistenceEvidence) {
  const { trace } = evidence;
  expect(evidence.errors).toEqual([]);
  expect(evidence.cleanup).toEqual({ drained: true, restored: true, databaseDeleted: true });
  expect(trace.map((row) => row.sequence)).toEqual(trace.map((_row, index) => index + 1));
  const dispatches = trace.filter((row) => row.phase === 'persistence-dispatched');
  for (const dispatch of dispatches) {
    const phases = [
      'persistence-dispatched', 'open-success', 'transaction-created',
      'request-dispatched', 'request-success', 'native-complete',
    ];
    const rows = phases.map((phase) => entry(trace, dispatch.actor, phase));
    expect(rows.map((row) => row.sequence)).toEqual(rows.map((row) => row.sequence).sort((a, b) => a - b));
    expect(new Set(rows.map((row) => row.operation)).size).toBe(1);
    expect(new Set(rows.slice(2).map((row) => row.transaction)).size).toBe(1);
    const closed = entry(trace, dispatch.actor, 'connection-closed');
    expect(closed.sequence).toBeGreaterThan(entry(trace, dispatch.actor, 'request-success').sequence);
    if (dispatch.method !== 'get') {
      expect(closed.sequence).toBeGreaterThan(entry(trace, dispatch.actor, 'native-complete').sequence);
    }
  }
  const creations = trace.filter((row) => row.phase === 'transaction-created');
  const commits = trace.filter((row) => row.phase === 'native-complete');
  expect(creations).toHaveLength(dispatches.length + (evidence.scenario === 'sequential' ? 0 : 1));
  // The characterization must not depend on inverted native transaction order.
  expect(commits.map((row) => row.transaction)).toEqual(creations.map((row) => row.transaction));
  for (const action of trace.filter((row) => row.phase === 'action-started')) {
    const callback = action.actor + '-listener';
    const commit = entry(trace, callback, 'native-complete');
    const notification = entry(trace, callback, 'notification-complete');
    const sdk = entry(trace, action.actor, 'sdk-response');
    expect(sdk.sequence).toBeGreaterThan(notification.sequence);
    // The listener is synchronous, so the SDK no longer waits on its commit.
    expect(sdk.sequence).toBeLessThan(commit.sequence);
    expect(entry(trace, action.actor, 'persistence-dispatched').sequence).toBeGreaterThan(sdk.sequence);
    expect(entry(trace, action.actor, 'action-complete').sequence)
      .toBeGreaterThan(entry(trace, action.actor, 'native-complete').sequence);
  }
  const notifications = trace.filter((row) => row.phase === 'notification-dispatched');
  for (const notification of notifications) {
    expect(entry(trace, notification.actor, 'identity-delivered').sequence)
      .toBeLessThan(entry(trace, notification.actor, 'persistence-dispatched').sequence);
    expect(entry(trace, notification.actor, 'notification-complete').sequence)
      .toBeLessThan(entry(trace, notification.actor, 'native-complete').sequence);
  }
  // Listener writes share one subscription queue: each dispatches only after
  // the previous one commits, so they commit in notification arrival order.
  const listenerCommits = trace.filter((row) => row.source === 'listener' && row.phase === 'native-complete');
  expect(listenerCommits.map((row) => row.actor)).toEqual(notifications.map((row) => row.actor));
  for (let index = 1; index < notifications.length; index += 1) {
    expect(entry(trace, notifications[index].actor, 'persistence-dispatched').sequence)
      .toBeGreaterThan(entry(trace, notifications[index - 1].actor, 'native-complete').sequence);
  }
  // An allowlist guards retained/attached JSON, including opaque version labels.
  for (const row of trace) {
    expect(Object.keys(row).every((key) => [
      'sequence', 'phase', 'actor', 'source', 'method', 'token', 'event', 'operation', 'transaction',
    ].includes(key))).toBe(true);
    if (row.token) {
      expect(Object.keys(row.token).sort()).toEqual(['owner', 'version']);
      expect(['A', 'B']).toContain(row.token.owner);
      expect(['v1', 'v2']).toContain(row.token.version);
    }
  }
}

for (const scenario of scenarios) {
  test('characterizes native auth token persistence: ' + scenario, async ({ page, browser, baseURL }, testInfo) => {
    if (!baseURL) throw new Error('Missing harness origin');
    let externalRequests = 0;
    let pageErrors = 0;
    const origin = new URL(baseURL).origin;
    page.on('pageerror', () => { pageErrors += 1; });
    // No synthetic token may reach a server, including if an SDK implementation
    // changes. Count unexpected attempts without retaining headers or URLs.
    await page.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        externalRequests += 1;
        await route.abort();
      } else await route.continue();
    });
    await page.goto(baseURL + '/tests/support/harnesses/auth-token-persistence.html');
    await expect.poll(() => page.evaluate(() => !!window.__authTokenPersistence)).toBe(true);
    const evidence = await page.evaluate((name) => window.__authTokenPersistence!.run(name), scenario);
    const document = {
      formatVersion: 1,
      runtime: { ...runtime, chromium: browser.version() },
      externalRequests,
      pageErrors,
      ...evidence,
    };
    const json = JSON.stringify(document, null, 2) + '\n';
    await testInfo.attach(scenario + '-native-trace', { body: json, contentType: 'application/json' });
    assertNativeEvidence(evidence);
    expect(externalRequests).toBe(0);
    expect(pageErrors).toBe(0);
    expect(await page.evaluate(() => window.__authTokenPersistence === undefined)).toBe(true);

    const { trace } = evidence;
    const writes = trace.filter((row) => row.phase === 'native-complete' && row.source !== 'blocker' && row.method !== 'get');
    if (scenario === 'sequential') {
      expect(writes.map((row) => [row.actor, row.method, row.token])).toEqual([
        ['sign-in-A-listener', 'put', { owner: 'A', version: 'v1' }],
        ['sign-in-A', 'put', { owner: 'A', version: 'v1' }],
        ['sign-out-listener', 'delete', null],
        ['sign-out', 'delete', null],
      ]);
      expect(evidence.checkpoints).toEqual([
        { name: 'after-sign-in', token: { owner: 'A', version: 'v1' } },
        { name: 'final', token: null },
      ]);
    } else {
      const older = scenario === 'local-actions' || scenario === 'stale-clear' ? 'sign-out' : 'sign-in-A';
      const newer = scenario === 'local-actions' ? 'sign-in-B-listener'
        : scenario === 'same-owner-refresh' ? 'refresh-A-v2'
          : scenario === 'stale-resurrection' ? 'independent-sign-out' : 'independent-B';
      const blocker = entry(trace, 'blocker', 'transaction-created');
      const release = entry(trace, 'blocker', 'blocker-released');
      // Both older writes queue behind the blocker; the SDK returned without them.
      for (const actor of [older + '-listener', older]) {
        expect(entry(trace, actor, 'transaction-created').sequence).toBeGreaterThan(blocker.sequence);
        expect(entry(trace, actor, 'transaction-created').sequence).toBeLessThan(release.sequence);
        expect(entry(trace, actor, 'native-complete').sequence)
          .toBeGreaterThan(entry(trace, 'blocker', 'native-complete').sequence);
      }
      expect(entry(trace, older, 'sdk-response').sequence).toBeLessThan(release.sequence);
      // The newer notification reaches the app while the older write is held,
      // but its own write waits in the queue until that older write commits.
      expect(entry(trace, newer, 'identity-delivered').sequence).toBeLessThan(release.sequence);
      expect(entry(trace, newer, 'persistence-dispatched').sequence)
        .toBeGreaterThan(entry(trace, older + '-listener', 'native-complete').sequence);
      const expectedActors = scenario === 'local-actions'
        ? ['seed-A', 'sign-out-listener', 'sign-out', 'sign-in-B', newer]
        : scenario === 'stale-clear' ? ['seed-A', 'sign-out-listener', 'sign-out', newer]
          : ['sign-in-A-listener', 'sign-in-A', newer];
      expect(writes.map((row) => row.actor)).toEqual(expectedActors);
      // The newest auth event now owns the stored token in every schedule.
      expect(evidence.finalToken).toEqual(scenario === 'same-owner-refresh'
        ? { owner: 'A', version: 'v2' }
        : scenario === 'stale-resurrection' ? null : { owner: 'B', version: 'v1' });
      expect(entry(trace, newer, 'native-complete').token).toEqual(evidence.finalToken);
    }
    // Ordinary E2E runs attach JSON only. The isolated config opts into retaining
    // passing evidence alongside this bundle's report, with no shared output file.
    const evidenceDirectory = testInfo.config.metadata.dw79EvidenceDirectory;
    if (typeof evidenceDirectory === 'string') {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(join(evidenceDirectory, scenario + '.json'), json);
    }
  });
}
