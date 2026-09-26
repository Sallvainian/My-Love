import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page, TestInfo } from '@playwright/test';
import { recurseUntil } from '../../support/helpers/recurse';
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
type Token = PersistenceEvidence['finalToken'];
type Method = 'put' | 'delete' | 'get';

/**
 * What one scenario's native trace must contain, pinned from observed runs.
 *
 * Every list is asserted whole before any loop walks it, so a trace that lost
 * its dispatches, actions or notifications fails on the count instead of
 * running the ordering checks zero times.
 */
type Expected = {
  /** Every persistence dispatch, in trace order, with its IndexedDB method. */
  dispatches: Array<[actor: string, method: Method]>;
  /** Transactions created in total: one per dispatch, plus the blocker's when there is one. */
  transactionsCreated: number;
  actionsStarted: string[];
  notifications: string[];
  /** The distinct `owner/version` labels any trace row carries, sorted. */
  tokenLabels: string[];
  /** Committed non-read writes, in commit order. */
  writes: Array<[actor: string, method: Method, token: Token]>;
  checkpoints: PersistenceEvidence['checkpoints'];
  finalToken: Token;
};

type OverlapExpected = Expected & {
  scenario: Exclude<PersistenceScenario, 'sequential'>;
  /** The action whose writes queue behind the blocker. */
  older: string;
  /** The notification that arrives while the older write is held. */
  newer: string;
};

const A1 = { owner: 'A', version: 'v1' } as const;
const A2 = { owner: 'A', version: 'v2' } as const;
const B1 = { owner: 'B', version: 'v1' } as const;

const sequential: Expected = {
  dispatches: [
    ['sign-in-A-listener', 'put'], ['sign-in-A', 'put'], ['after-sign-in', 'get'],
    ['sign-out-listener', 'delete'], ['sign-out', 'delete'], ['final', 'get'],
  ],
  transactionsCreated: 6,
  actionsStarted: ['sign-in-A', 'sign-out'],
  notifications: ['sign-in-A-listener', 'sign-out-listener'],
  tokenLabels: ['A/v1'],
  writes: [
    ['sign-in-A-listener', 'put', A1],
    ['sign-in-A', 'put', A1],
    ['sign-out-listener', 'delete', null],
    ['sign-out', 'delete', null],
  ],
  checkpoints: [
    { name: 'after-sign-in', token: A1 },
    { name: 'final', token: null },
  ],
  finalToken: null,
};

const overlapping: OverlapExpected[] = [
  {
    scenario: 'local-actions',
    dispatches: [
      ['seed-A', 'put'], ['before-overlap', 'get'], ['sign-out-listener', 'delete'], ['sign-out', 'delete'],
      ['sign-in-B', 'put'], ['sign-in-B-listener', 'put'], ['final', 'get'],
    ],
    transactionsCreated: 8,
    actionsStarted: ['sign-out', 'sign-in-B'],
    notifications: ['seed-A', 'sign-out-listener', 'sign-in-B-listener'],
    tokenLabels: ['A/v1', 'B/v1'],
    writes: [
      ['seed-A', 'put', A1],
      ['sign-out-listener', 'delete', null],
      ['sign-out', 'delete', null],
      ['sign-in-B', 'put', B1],
      ['sign-in-B-listener', 'put', B1],
    ],
    checkpoints: [
      { name: 'before-overlap', token: A1 },
      { name: 'final', token: B1 },
    ],
    finalToken: B1,
    older: 'sign-out',
    newer: 'sign-in-B-listener',
  },
  {
    scenario: 'stale-clear',
    dispatches: [
      ['seed-A', 'put'], ['before-overlap', 'get'], ['sign-out-listener', 'delete'], ['sign-out', 'delete'],
      ['independent-B', 'put'], ['final', 'get'],
    ],
    transactionsCreated: 7,
    actionsStarted: ['sign-out'],
    notifications: ['seed-A', 'sign-out-listener', 'independent-B'],
    tokenLabels: ['A/v1', 'B/v1'],
    writes: [
      ['seed-A', 'put', A1],
      ['sign-out-listener', 'delete', null],
      ['sign-out', 'delete', null],
      ['independent-B', 'put', B1],
    ],
    checkpoints: [
      { name: 'before-overlap', token: A1 },
      { name: 'final', token: B1 },
    ],
    finalToken: B1,
    older: 'sign-out',
    newer: 'independent-B',
  },
  {
    scenario: 'stale-overwrite',
    dispatches: [['sign-in-A-listener', 'put'], ['sign-in-A', 'put'], ['independent-B', 'put'], ['final', 'get']],
    transactionsCreated: 5,
    actionsStarted: ['sign-in-A'],
    notifications: ['sign-in-A-listener', 'independent-B'],
    tokenLabels: ['A/v1', 'B/v1'],
    writes: [
      ['sign-in-A-listener', 'put', A1],
      ['sign-in-A', 'put', A1],
      ['independent-B', 'put', B1],
    ],
    checkpoints: [{ name: 'final', token: B1 }],
    finalToken: B1,
    older: 'sign-in-A',
    newer: 'independent-B',
  },
  {
    scenario: 'stale-resurrection',
    dispatches: [
      ['sign-in-A-listener', 'put'], ['sign-in-A', 'put'], ['independent-sign-out', 'delete'], ['final', 'get'],
    ],
    transactionsCreated: 5,
    actionsStarted: ['sign-in-A'],
    notifications: ['sign-in-A-listener', 'independent-sign-out'],
    tokenLabels: ['A/v1'],
    writes: [
      ['sign-in-A-listener', 'put', A1],
      ['sign-in-A', 'put', A1],
      ['independent-sign-out', 'delete', null],
    ],
    checkpoints: [{ name: 'final', token: null }],
    finalToken: null,
    older: 'sign-in-A',
    newer: 'independent-sign-out',
  },
  {
    scenario: 'same-owner-refresh',
    dispatches: [['sign-in-A-listener', 'put'], ['sign-in-A', 'put'], ['refresh-A-v2', 'put'], ['final', 'get']],
    transactionsCreated: 5,
    actionsStarted: ['sign-in-A'],
    notifications: ['sign-in-A-listener', 'refresh-A-v2'],
    tokenLabels: ['A/v1', 'A/v2'],
    writes: [
      ['sign-in-A-listener', 'put', A1],
      ['sign-in-A', 'put', A1],
      ['refresh-A-v2', 'put', A2],
    ],
    checkpoints: [{ name: 'final', token: A2 }],
    finalToken: A2,
    older: 'sign-in-A',
    newer: 'refresh-A-v2',
  },
];

function entry(trace: PersistenceTraceEntry[], actor: string, phase: string) {
  const matches = trace.filter((row) => row.actor === actor && row.phase === phase);
  expect(matches, actor + ' / ' + phase).toHaveLength(1);
  return matches[0];
}

function assertNativeEvidence(evidence: PersistenceEvidence, expected: Expected) {
  const { trace } = evidence;
  expect(evidence.errors).toEqual([]);
  expect(evidence.cleanup).toEqual({ drained: true, restored: true, databaseDeleted: true });
  expect(trace.map((row) => row.sequence)).toEqual(trace.map((_row, index) => index + 1));
  const dispatches = trace.filter((row) => row.phase === 'persistence-dispatched');
  expect(dispatches.map((row) => [row.actor, row.method])).toEqual(expected.dispatches);
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
  }
  // A write's connection closes only after it commits. A read's may close
  // first: `db.get` does not await `tx.done` (src/sw-db.ts), so reads are left
  // out of this check by the pinned dispatch list, not by a runtime branch.
  const writeDispatches = dispatches.filter((row) => row.method !== 'get');
  expect(writeDispatches).toHaveLength(expected.dispatches.filter(([, method]) => method !== 'get').length);
  for (const dispatch of writeDispatches) {
    expect(entry(trace, dispatch.actor, 'connection-closed').sequence)
      .toBeGreaterThan(entry(trace, dispatch.actor, 'native-complete').sequence);
  }
  const creations = trace.filter((row) => row.phase === 'transaction-created');
  const commits = trace.filter((row) => row.phase === 'native-complete');
  expect(creations).toHaveLength(expected.transactionsCreated);
  // The characterization must not depend on inverted native transaction order.
  expect(commits.map((row) => row.transaction)).toEqual(creations.map((row) => row.transaction));
  const actions = trace.filter((row) => row.phase === 'action-started');
  expect(actions.map((row) => row.actor)).toEqual(expected.actionsStarted);
  for (const action of actions) {
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
  expect(notifications.map((row) => row.actor)).toEqual(expected.notifications);
  for (const notification of notifications) {
    expect(entry(trace, notification.actor, 'identity-delivered').sequence)
      .toBeLessThan(entry(trace, notification.actor, 'persistence-dispatched').sequence);
    expect(entry(trace, notification.actor, 'notification-complete').sequence)
      .toBeLessThan(entry(trace, notification.actor, 'native-complete').sequence);
  }
  // Listener writes share one subscription queue: each dispatches only after
  // the previous one commits, so they commit in notification arrival order.
  const listenerCommits = trace.filter((row) => row.source === 'listener' && row.phase === 'native-complete');
  expect(listenerCommits.map((row) => row.actor)).toEqual(expected.notifications);
  for (let index = 1; index < notifications.length; index += 1) {
    expect(entry(trace, notifications[index].actor, 'persistence-dispatched').sequence)
      .toBeGreaterThan(entry(trace, notifications[index - 1].actor, 'native-complete').sequence);
  }
  // An allowlist guards retained/attached JSON, including opaque version labels.
  for (const row of trace) {
    expect(Object.keys(row).every((key) => [
      'sequence', 'phase', 'actor', 'source', 'method', 'token', 'event', 'operation', 'transaction',
    ].includes(key))).toBe(true);
  }
  const tokenRows = trace.flatMap((row) => (row.token ? [row.token] : []));
  expect([...new Set(tokenRows.map((token) => token.owner + '/' + token.version))].sort())
    .toEqual(expected.tokenLabels);
  for (const token of tokenRows) {
    expect(Object.keys(token).sort()).toEqual(['owner', 'version']);
  }
  const writes = trace.filter((row) => row.phase === 'native-complete' && row.source !== 'blocker' && row.method !== 'get');
  expect(writes.map((row) => [row.actor, row.method, row.token])).toEqual(expected.writes);
  expect(evidence.checkpoints).toEqual(expected.checkpoints);
  expect(evidence.finalToken).toEqual(expected.finalToken);
}

/**
 * Runs one scenario in the harness page, attaches its trace, and checks what
 * every scenario shares. Returns the evidence for the scenario's own checks.
 */
async function runScenario(
  { page, browser, baseURL }: { page: Page; browser: Browser; baseURL: string | undefined },
  testInfo: TestInfo,
  scenario: PersistenceScenario,
  expected: Expected
): Promise<PersistenceEvidence> {
  if (!baseURL) throw new Error('Missing harness origin');
  let externalRequests = 0;
  let pageErrors = 0;
  const origin = new URL(baseURL).origin;
  page.on('pageerror', () => { pageErrors += 1; });
  // No synthetic token may reach a server, including if an SDK implementation
  // changes. Count unexpected attempts without retaining headers or URLs.
  // playwright-utils deviation: the route must be installed before the next navigation and count every request the page makes; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== origin) {
      externalRequests += 1;
      await route.abort();
    } else await route.continue();
  });
  await page.goto(baseURL + '/tests/support/harnesses/auth-token-persistence.html');
  await recurseUntil(
    () => page.evaluate(() => !!window.__authTokenPersistence),
    (v) => {
      expect(v).toBe(true);
    }
  );
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
  expect(evidence.scenario).toBe(scenario);
  assertNativeEvidence(evidence, expected);
  expect(externalRequests).toBe(0);
  expect(pageErrors).toBe(0);
  expect(await page.evaluate(() => window.__authTokenPersistence === undefined)).toBe(true);

  // Ordinary E2E runs attach JSON only. The isolated config opts into retaining
  // passing evidence alongside this bundle's report, with no shared output file.
  const evidenceDirectory = testInfo.config.metadata.dw79EvidenceDirectory;
  if (typeof evidenceDirectory === 'string') {
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(join(evidenceDirectory, scenario + '.json'), json);
  }
  return evidence;
}

test('characterizes native auth token persistence: sequential', async ({ page, browser, baseURL }, testInfo) => {
  await runScenario({ page, browser, baseURL }, testInfo, 'sequential', sequential);
});

for (const expected of overlapping) {
  const { scenario, older, newer } = expected;
  test('characterizes native auth token persistence: ' + scenario, async ({ page, browser, baseURL }, testInfo) => {
    const { trace } = await runScenario({ page, browser, baseURL }, testInfo, scenario, expected);

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
    // The newest auth event now owns the stored token in every schedule.
    expect(entry(trace, newer, 'native-complete').token).toEqual(expected.finalToken);
  });
}
