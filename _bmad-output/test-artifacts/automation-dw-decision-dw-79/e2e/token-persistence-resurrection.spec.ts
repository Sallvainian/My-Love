import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../../../tests/support/merged-fixtures';
import { runNativeTokenPersistence } from '../fixtures/native-token-persistence';

// These are synthetic SDK notifications, so an authenticated starting state
// would invalidate the isolated persistence experiment. Raw recording stays off.
test.use({ authSessionEnabled: false, trace: 'off', screenshot: 'off', video: 'off' });

test('[P0] DW79-E2E-006 late sign-in persistence resurrects A after independent sign-out', async (
  { page, baseURL, browser }, testInfo
) => {
  await log.step('Run real auth services and native IndexedDB with a newer sign-out notification');
  // Characterizes current behavior. The SDK boundary preserves its originating
  // callback-before-response edge; this does not prove live cross-tab delivery,
  // SDK lock behavior, or frequency in production. No coordination fix is applied.
  const result = await runNativeTokenPersistence(page, baseURL, 'stale-resurrection');
  const { evidence, verification, externalRequests, pageErrors } = result;
  const { trace } = evidence;
  const matches = (actor: string, phase: string) => trace.filter(
    (row) => row.actor === actor && row.phase === phase
  );
  const sequence = (actor: string, phase: string) => matches(actor, phase)[0].sequence;

  expect(evidence.scenario).toBe('stale-resurrection');
  expect(evidence.errors).toEqual([]);
  expect(evidence.cleanup).toEqual({ drained: true, restored: true, databaseDeleted: true });
  expect(verification).toEqual({
    nativeReferencesRestored: { open: true, transaction: true, close: true, put: true, delete: true, get: true },
    harnessRemoved: true,
    remainingDatabases: 0,
    localStorageEntries: 0,
  });
  expect(externalRequests).toBe(0);
  expect(pageErrors).toBe(0);
  expect(trace.map((row) => row.sequence)).toEqual(trace.map((_row, index) => index + 1));

  const dispatches = trace.filter((row) => row.phase === 'persistence-dispatched');
  expect(dispatches.map((row) => [row.actor, row.source, row.method, row.token])).toEqual([
    ['sign-in-A-listener', 'listener', 'put', { owner: 'A', version: 'v1' }],
    ['independent-sign-out', 'listener', 'delete', null],
    ['sign-in-A', 'action', 'put', { owner: 'A', version: 'v1' }],
    ['final', 'read', 'get', null],
  ]);
  const nativePhases = [
    'persistence-dispatched', 'open-success', 'transaction-created',
    'request-dispatched', 'request-success', 'native-complete',
  ];
  for (const dispatch of dispatches) {
    const chains = nativePhases.map((phase) => matches(dispatch.actor, phase));
    expect(chains.map((rows) => rows.length), dispatch.actor).toEqual([1, 1, 1, 1, 1, 1]);
    const rows = chains.flat();
    const positions = rows.map((row) => row.sequence);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(new Set(rows.map((row) => row.operation)).size).toBe(1);
    expect(new Set(rows.slice(2).map((row) => row.transaction)).size).toBe(1);
    expect(matches(dispatch.actor, 'connection-closed')).toHaveLength(1);
    expect(sequence(dispatch.actor, 'connection-closed')).toBeGreaterThan(sequence(dispatch.actor, 'request-success'));
  }

  const creations = trace.filter((row) => row.phase === 'transaction-created');
  const commits = trace.filter((row) => row.phase === 'native-complete');
  expect(creations.map((row) => row.actor)).toEqual([
    'blocker', 'sign-in-A-listener', 'independent-sign-out', 'sign-in-A', 'final',
  ]);
  expect(new Set(creations.map((row) => row.transaction)).size).toBe(5);
  expect(commits.map((row) => row.transaction)).toEqual(creations.map((row) => row.transaction));
  expect(matches('blocker', 'blocker-released')).toHaveLength(1);
  for (const actor of ['sign-in-A-listener', 'independent-sign-out']) {
    expect(sequence(actor, 'transaction-created')).toBeGreaterThan(sequence('blocker', 'transaction-created'));
    expect(sequence(actor, 'transaction-created')).toBeLessThan(sequence('blocker', 'blocker-released'));
    expect(sequence(actor, 'native-complete')).toBeGreaterThan(sequence('blocker', 'native-complete'));
  }

  const notificationPhases = ['notification-dispatched', 'identity-delivered', 'notification-complete'];
  for (const actor of ['sign-in-A-listener', 'independent-sign-out']) {
    expect(notificationPhases.map((phase) => matches(actor, phase).length)).toEqual([1, 1, 1]);
    expect(sequence(actor, 'identity-delivered')).toBeGreaterThan(sequence(actor, 'notification-dispatched'));
    expect(sequence(actor, 'identity-delivered')).toBeLessThan(sequence(actor, 'persistence-dispatched'));
    expect(sequence(actor, 'notification-complete')).toBeGreaterThan(sequence(actor, 'native-complete'));
    expect(sequence(actor, 'connection-closed')).toBeGreaterThan(sequence(actor, 'native-complete'));
  }
  expect(matches('independent-sign-out', 'identity-delivered')[0]).toMatchObject({
    source: 'listener', event: 'SIGNED_OUT', method: 'delete', token: null,
  });
  expect(sequence('independent-sign-out', 'notification-dispatched'))
    .toBeGreaterThan(sequence('sign-in-A-listener', 'transaction-created'));
  const actionPhases = ['action-started', 'sdk-called', 'sdk-response', 'action-complete'];
  expect(actionPhases.map((phase) => matches('sign-in-A', phase).length)).toEqual([1, 1, 1, 1]);
  expect(sequence('sign-in-A', 'sdk-called')).toBeGreaterThan(sequence('sign-in-A', 'action-started'));
  expect(sequence('sign-in-A-listener', 'notification-dispatched')).toBeGreaterThan(sequence('sign-in-A', 'sdk-called'));
  expect(sequence('sign-in-A', 'sdk-response')).toBeGreaterThan(sequence('sign-in-A-listener', 'notification-complete'));
  expect(sequence('independent-sign-out', 'transaction-created')).toBeLessThan(sequence('sign-in-A', 'sdk-response'));
  expect(sequence('sign-in-A', 'persistence-dispatched')).toBeGreaterThan(sequence('sign-in-A', 'sdk-response'));
  expect(sequence('sign-in-A', 'native-complete')).toBeGreaterThan(sequence('independent-sign-out', 'native-complete'));
  expect(sequence('sign-in-A', 'connection-closed')).toBeGreaterThan(sequence('sign-in-A', 'native-complete'));
  expect(sequence('sign-in-A', 'action-complete')).toBeGreaterThan(sequence('sign-in-A', 'native-complete'));
  expect(sequence('final', 'persistence-dispatched')).toBeGreaterThan(sequence('sign-in-A', 'action-complete'));
  expect(sequence('final', 'persistence-dispatched')).toBeGreaterThan(sequence('independent-sign-out', 'notification-complete'));
  expect(matches('final', 'storage-observed')).toHaveLength(1);
  expect(sequence('final', 'storage-observed')).toBeGreaterThan(sequence('final', 'native-complete'));

  await log.step('Assert committed deletion followed by stale token resurrection');
  expect(commits.filter((row) => row.method === 'put' || row.method === 'delete')
    .map((row) => [row.actor, row.method, row.token])).toEqual([
      ['sign-in-A-listener', 'put', { owner: 'A', version: 'v1' }],
      ['independent-sign-out', 'delete', null],
      ['sign-in-A', 'put', { owner: 'A', version: 'v1' }],
    ]);
  expect(evidence.finalToken).toEqual({ owner: 'A', version: 'v1' });
  expect(evidence.checkpoints).toEqual([{ name: 'final', token: { owner: 'A', version: 'v1' } }]);

  // Validate the retained shape before attachment: no SDK sessions, IDs, tokens,
  // headers, request URLs, or error payloads belong in this artifact.
  expect(Object.keys(evidence).sort()).toEqual([
    'checkpoints', 'cleanup', 'errors', 'finalToken', 'scenario', 'trace',
  ]);
  const allowedPhases = [
    ...nativePhases, ...notificationPhases, ...actionPhases,
    'connection-closed', 'blocker-released', 'storage-observed',
  ];
  for (const row of trace) {
    expect(Object.keys(row).every((key) => [
      'sequence', 'phase', 'actor', 'source', 'method', 'token', 'event', 'operation', 'transaction',
    ].includes(key))).toBe(true);
    expect(allowedPhases).toContain(row.phase);
    expect(['blocker', 'sign-in-A-listener', 'independent-sign-out', 'sign-in-A', 'final']).toContain(row.actor);
    expect(['listener', 'action', 'read', 'blocker']).toContain(row.source);
    expect(['put', 'delete', 'get', 'hold']).toContain(row.method);
    expect([undefined, 'SIGNED_IN', 'SIGNED_OUT']).toContain(row.event);
  }
  for (const token of trace.map((row) => row.token).filter((token) => token !== null)) {
    expect(token).toEqual({ owner: 'A', version: 'v1' });
  }
  await testInfo.attach('stale-resurrection-native-trace', {
    body: JSON.stringify({
      formatVersion: 1,
      testId: 'DW79-E2E-006',
      runtime: { browser: browser.browserType().name(), browserVersion: browser.version() },
      ...result,
    }, null, 2) + '\n',
    contentType: 'application/json',
  });
});
