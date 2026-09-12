/**
 * Controlled browser integration journeys for event load session ownership.
 * Real UI consumers, eventsService, Zustand actions and auth transitions run;
 * only the two event GET responses are held. No successor load may invalidate
 * the old invocation before its same-account/session guard is exercised.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';
import { navigateTo } from '../../support/helpers/navigation';
import { createEventLoadSessionControl } from '../../support/helpers/event-load-session-ownership';
import { createSessionEventRow } from '../../support/factories/event-load-session-ownership';

const views = ['home', 'settings'] as const;
const oldOutcomes = [
  { name: 'success', status: 200 as const },
  { name: 'failure', status: 400 as const },
];

const resetEvents = {
  events: [],
  eventsIsLoading: false,
  eventsError: null,
};

test.describe('Event load session ownership — controlled browser integration', () => {
  for (const view of views) {
    // Settings mounts under StrictMode; Home's existing App effect updates once.
    const expectedMountLoads = view === 'settings' ? 2 : 1;
    for (const oldOutcome of oldOutcomes) {
      test(
        `[P1] ${view} ignores previous-session ${oldOutcome.name} before a new load and renders fresh events`,
        {
          annotation: oldOutcome.status === 400
            ? [{
                type: 'skipNetworkMonitoring',
                description: 'The old events GET deliberately returns nonretryable 400 after reauthentication.',
              }]
            : [],
        },
        async ({ page, interceptNetworkCall, recurse }) => {
          const control = await createEventLoadSessionControl({ page, interceptNetworkCall });
          try {
            await log.step('Start authenticated on Mood and observe the real load action');
            await page.goto('/mood');
            await expect(page.getByTestId('mood-tracker')).toBeVisible();
            await control.install();
            const initial = await control.snapshot();
            if (!initial.userId) throw new Error('The authenticated worker must have a userId');
            const pair = getWorkerPairEmails();
            if (!pair) throw new Error('A worker-owned account is required');
            expect(initial.invocations).toBe(0);

            const oldRow = createSessionEventRow(initial.userId, {
              label: `Previous ${view} ${oldOutcome.name} session`,
            });
            const oldLoads = await Promise.all(Array.from({ length: expectedMountLoads }, () =>
              control.holdNext({ status: oldOutcome.status, rows: [oldRow] })
            ));
            await navigateTo(page, view);
            await Promise.all(oldLoads.map((load) => load.waitForRequests()));
            await recurse(
              () => control.snapshot(),
              (state) => {
                expect(state.invocations).toBe(expectedMountLoads);
                expect(state.eventsIsLoading).toBe(true);
                expect(state.results).toEqual([]);
                return true;
              },
              { timeout: 10000, log: 'Both old event windows are held in the original auth session' }
            );

            await log.step('End the real auth session on Mood without starting another event load');
            await navigateTo(page, 'mood');
            await expect(page.getByTestId('mood-tracker')).toBeVisible();
            const logoutCall = interceptNetworkCall({
              method: 'POST',
              url: '**/auth/v1/logout**',
            });
            // Test control: invoking the real service here avoids visiting
            // Settings, whose mount would start a successor load and mask the bug.
            await page.evaluate(async () => {
              const modulePath = '/src/api/authService.ts';
              const { authService } = await import(/* @vite-ignore */ modulePath);
              await authService.signOut();
            });
            expect((await logoutCall).status).toBe(204);
            await expect(page.getByTestId('login-screen')).toBeVisible();
            const signedOut = await recurse(
              () => control.snapshot(),
              (state) => {
                expect(state.userId).toBeNull();
                expect(state.authSessionVersion).toBeGreaterThan(initial.authSessionVersion);
                expect(state.invocations).toBe(expectedMountLoads);
                expect(state).toMatchObject(resetEvents);
                return true;
              },
              { timeout: 10000, log: 'Sign-out resets event state before the old GET settles' }
            );

            await log.step('Sign in as the same worker account while the old event windows remain held');
            const loginCall = interceptNetworkCall({
              method: 'POST',
              url: '**/auth/v1/token?grant_type=password',
            });
            // playwright-utils deviation: this second login is the auth-lifetime transition under test; the initial session uses the configured auth fixture.
            await page.getByRole('textbox', { name: 'Email' }).fill(pair.user1Email);
            await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
            await page.getByTestId('submit-button').click();
            expect((await loginCall).status).toBe(200);
            await expect(page.getByTestId('mood-tracker')).toBeVisible();
            const signedIn = await recurse(
              () => control.snapshot(),
              (state) => {
                expect(state.userId).toBe(initial.userId);
                expect(state.authSessionVersion).toBeGreaterThan(signedOut.authSessionVersion);
                expect(state.invocations).toBe(expectedMountLoads);
                expect(state.results).toEqual([]);
                expect(state).toMatchObject(resetEvents);
                return true;
              },
              { timeout: 10000, log: 'Same user now owns a different auth lifetime with no successor event load' }
            );

            await log.step('Deliver the old response before any successor load can hide the session guard');
            const oldResponses = await Promise.all(oldLoads.map((load) => load.release()));
            for (const response of oldResponses) {
              expect(response).toEqual({ upcomingStatus: oldOutcome.status, pastStatus: 200 });
            }
            const oldResults = oldLoads.map(({ invocation }) => ({ invocation, status: 'stale' }));
            const stale = await recurse(
              () => control.snapshot(),
              (state) => {
                expect([...state.results].sort((a, b) => a.invocation - b.invocation)).toEqual(oldResults);
                return true;
              },
              { timeout: 10000, log: 'The original production load promise settles as stale' }
            );
            expect(stale.invocations).toBe(expectedMountLoads);
            expect(stale.userId).toBe(initial.userId);
            expect(stale.authSessionVersion).toBe(signedIn.authSessionVersion);
            expect(stale).toMatchObject(resetEvents);

            await log.step(`Open ${view} and complete a new-session event load`);
            const currentRow = createSessionEventRow(initial.userId, {
              label: `Current ${view} ${oldOutcome.name} session`,
            });
            const currentLoads = await Promise.all(Array.from({ length: expectedMountLoads }, (_, index) =>
              control.holdNext({
                status: 200,
                rows: [index === expectedMountLoads - 1 ? currentRow : createSessionEventRow(initial.userId!, {
                  label: 'Superseded StrictMode event load',
                })],
              })
            ));
            await navigateTo(page, view);
            await Promise.all(currentLoads.map((load) => load.waitForRequests()));
            expect((await control.snapshot()).eventsIsLoading).toBe(true);
            const currentResponses = await Promise.all(currentLoads.map((load) => load.release()));
            for (const response of currentResponses) {
              expect(response).toEqual({ upcomingStatus: 200, pastStatus: 200 });
            }
            const current = await recurse(
              () => control.snapshot(),
              (state) => {
                expect([...state.results].sort((a, b) => a.invocation - b.invocation)).toEqual([
                  ...oldResults,
                  ...currentLoads.map(({ invocation }, index) => ({
                    invocation, status: index === expectedMountLoads - 1 ? 'success' : 'stale',
                  })),
                ]);
                expect(state.events).toEqual([{ id: currentRow.id, label: currentRow.label }]);
                expect(state.eventsIsLoading).toBe(false);
                expect(state.eventsError).toBeNull();
                return true;
              },
              { timeout: 10000, log: 'The current GET completes and only its event reaches Zustand' }
            );
            expect(current.invocations).toBe(expectedMountLoads * 2);
            expect(current.authSessionVersion).toBe(signedIn.authSessionVersion);
            if (view === 'home') {
              await expect(page.getByTestId(
                `event-countdown-${currentRow.label.toLowerCase().replace(/\s+/g, '-')}`
              )).toBeVisible();
              await expect(page.getByTestId('events-load-error')).toHaveCount(0);
            } else {
              await expect(page.getByTestId(`event-row-${currentRow.id}`)).toBeVisible();
              await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
            }
            await expect(page.getByText(oldRow.label, { exact: true })).toHaveCount(0);
          } finally {
            await control.dispose();
          }
        }
      );
    }
  }

  test('[P2] a real same-user token refresh preserves the active Home load and its ownership', async ({
    page,
    interceptNetworkCall,
    recurse,
  }) => {
    const control = await createEventLoadSessionControl({ page, interceptNetworkCall });
    try {
      await page.goto('/mood');
      await expect(page.getByTestId('mood-tracker')).toBeVisible();
      await control.install();
      const initial = await control.snapshot();
      if (!initial.userId) throw new Error('The authenticated worker must have a userId');
      expect(initial.invocations).toBe(0);
      const row = createSessionEventRow(initial.userId, { label: 'Same session refreshed token' });
      const load = await control.holdNext({ status: 200, rows: [row] });
      await navigateTo(page, 'home');
      await load.waitForRequests();

      await log.step('Refresh the actual auth token while both Home event windows remain held');
      const refreshCall = interceptNetworkCall({
        method: 'POST',
        url: '**/auth/v1/token?grant_type=refresh_token',
      });
      const refreshedUser = await page.evaluate(async () => {
        const modulePath = '/src/api/supabaseClient.ts';
        const { supabase } = await import(/* @vite-ignore */ modulePath);
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        return data.user?.id ?? null;
      });
      expect((await refreshCall).status).toBe(200);
      expect(refreshedUser).toBe(initial.userId);
      const refreshing = await control.snapshot();
      expect(refreshing.userId).toBe(initial.userId);
      expect(refreshing.authSessionVersion).toBe(initial.authSessionVersion);
      expect(refreshing.invocations).toBe(1);
      expect(refreshing.results).toEqual([]);
      expect(refreshing.eventsIsLoading).toBe(true);

      await log.step('Release the original event load and verify it still owns the UI result');
      expect(await load.release()).toEqual({ upcomingStatus: 200, pastStatus: 200 });
      const completed = await recurse(
        () => control.snapshot(),
        (state) => {
          expect(state.results).toEqual([{ invocation: load.invocation, status: 'success' }]);
          expect(state.events).toEqual([{ id: row.id, label: row.label }]);
          expect(state.eventsIsLoading).toBe(false);
          expect(state.eventsError).toBeNull();
          return true;
        },
        { timeout: 10000, log: 'A token refresh does not invalidate or supersede the original load' }
      );
      expect(completed.invocations).toBe(1);
      expect(completed.authSessionVersion).toBe(initial.authSessionVersion);
      await expect(page.getByTestId('event-countdown-same-session-refreshed-token')).toBeVisible();
      await expect(page.getByTestId('events-load-error')).toHaveCount(0);
    } finally {
      await control.dispose();
    }
  });
});
