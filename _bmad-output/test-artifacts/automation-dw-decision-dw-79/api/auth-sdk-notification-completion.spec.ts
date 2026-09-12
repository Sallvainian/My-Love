/**
 * DW-79 supporting SDK/API contract, with controlled HTTP responses.
 *
 * Installed GoTrueClient.signInWithPassword awaits _notifyAllSubscribers;
 * signOut awaits _removeSession, which awaits SIGNED_OUT subscribers.
 * This validates the causal edge preserved by the native browser harness.
 * It does not establish live server schedules, multi-tab order or IDB commits.
 * No production response schema exists here; the fixture follows installed
 * _sessionResponsePassword and assertions cover callback/action results only.
 */
import { setImmediate as nextEventLoopTurn } from 'node:timers/promises';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../../../tests/support/merged-fixtures';
import { createSdkActionProbe } from '../fixtures/auth-sdk-boundary';

test.use({ authSessionEnabled: false, trace: 'off', screenshot: 'off', video: 'off' });

test.describe('DW-79 actual SDK originating notification completion', () => {
  test('[P1] DW79-API-001 sign-in waits for its SIGNED_IN notification', async ({}, testInfo) => {
    const probe = await createSdkActionProbe('sign-in');
    try {
      await log.step('Run real SDK password sign-in against the controlled HTTP response');
      const action = probe.start();
      await probe.notificationEntered;
      // One event-loop turn drains ready SDK promise continuations. A fixed
      // number of Promise.resolve calls cannot establish this pending state.
      await nextEventLoopTurn();
      expect(probe.requests).toEqual([{
        method: 'POST', path: '/auth/v1/token?grant_type=password', credentialsMatch: true,
      }]);
      expect(probe.deliveredSessionMatches()).toBe(true);
      expect(probe.isSettled()).toBe(false);
      expect(probe.phases).toEqual(['http-response', 'notification-entered']);

      probe.releaseNotification();
      expect(await action).toEqual({ successful: true, sessionMatches: true });
      expect(probe.phases).toEqual([
        'http-response', 'notification-entered', 'notification-complete', 'action-complete',
      ]);
      await testInfo.attach('sdk-sign-in-phases', {
        body: JSON.stringify({ action: 'sign-in', phases: probe.phases }),
        contentType: 'application/json',
      });
    } finally {
      await probe.dispose();
    }
  });

  test('[P1] DW79-API-002 sign-out waits for its SIGNED_OUT notification', async ({}, testInfo) => {
    const probe = await createSdkActionProbe('sign-out');
    try {
      await log.step('Run real SDK sign-out after an isolated in-memory sign-in');
      const action = probe.start();
      await probe.notificationEntered;
      // This is an event-loop barrier with no elapsed-time delay, as above.
      await nextEventLoopTurn();
      expect(probe.requests).toEqual([{
        method: 'POST', path: '/auth/v1/logout?scope=global', authorizationMatches: true,
      }]);
      expect(probe.deliveredSessionMatches()).toBe(true);
      expect(probe.isSettled()).toBe(false);
      expect(probe.phases).toEqual(['http-response', 'notification-entered']);

      probe.releaseNotification();
      expect(await action).toEqual({ successful: true, sessionMatches: true });
      expect(probe.phases).toEqual([
        'http-response', 'notification-entered', 'notification-complete', 'action-complete',
      ]);
      await testInfo.attach('sdk-sign-out-phases', {
        body: JSON.stringify({ action: 'sign-out', phases: probe.phases }),
        contentType: 'application/json',
      });
    } finally {
      await probe.dispose();
    }
  });
});
