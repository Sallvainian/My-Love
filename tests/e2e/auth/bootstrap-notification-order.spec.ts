/**
 * DW-81 browser integration: SDK delivery -> real sessionService -> App/store/UI.
 * The harness controls the local SDK promise/callback, not HTTP or GoTrue timing.
 * Unit coverage remains responsible for effect cleanup and remount permutations.
 */
import { log } from '@seontechnologies/playwright-utils';
import { createAuthBootstrapSession } from '../../support/factories/auth-bootstrap-notification-order';
import { test, expect } from '../../support/merged-fixtures';

test.describe('Auth bootstrap notification ownership in the browser', () => {
  // playwright-utils deviation: SDK ordering uses synthetic sessions in an isolated context; a cached live token would introduce unrelated notifications.
  test.use({ authSessionEnabled: false });

  for (const scenario of [
    { id: '001', staleKind: 'null' },
    { id: '002', staleKind: 'different-user' },
  ] as const) {
    test(`[P0] DW-81-E2E-${scenario.id} retains the notified user and event load after a stale ${scenario.staleKind} lookup`, async ({
      page,
      authBootstrap,
      recurse,
    }) => {
      const current = createAuthBootstrapSession();
      const stale = scenario.staleKind === 'null' ? null : createAuthBootstrapSession();
      await log.step('Mount with bootstrap pending, then deliver the newer SDK session');
      await authBootstrap.mount();
      await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
      await authBootstrap.notify('SIGNED_IN', current);
      const owned = await recurse(
        () => authBootstrap.snapshot(),
        (state) => state.calls.getEvents === 1 && state.calls.syncPendingMoods === 1,
        { timeout: 10000, interval: 50, log: 'Waiting for the listener-owned Home load' }
      );
      expect(owned.userId).toBe(current.user.id);
      expect(owned.eventsIsLoading).toBe(true);
      await authBootstrap.seedEvents([{ userId: current.user.id, label: 'Cached current trip' }]);

      await log.step('Release the stale bootstrap snapshot and observe the completed auth render');
      await authBootstrap.resolveLookup(stale);
      await expect(page.getByText('Loading...', { exact: true })).not.toBeVisible();
      await expect(page.getByTestId('app-container')).toBeVisible();
      await expect(page.getByTestId('login-screen')).not.toBeVisible();
      await expect(page.getByRole('heading', { name: 'Cached current trip', exact: true })).toBeVisible();
      const after = await authBootstrap.snapshot();
      expect(after).toMatchObject({
        userId: current.user.id,
        userEmail: current.user.email,
        isAuthenticated: true,
        authSessionVersion: owned.authSessionVersion,
        eventsIsLoading: true,
        eventsError: null,
        lookupSettled: true,
        notificationCount: 1,
        calls: { initializeApp: 1, syncPendingMoods: 1, getEvents: 1 },
      });
      expect(after.events.map((event) => event.label)).toEqual(['Cached current trip']);

      await log.step('Complete the original event request and observe its current-session card');
      await authBootstrap.resolveEvents([{ userId: current.user.id, label: 'Current trip' }]);
      const settled = await recurse(
        () => authBootstrap.snapshot(),
        (state) => !state.eventsIsLoading,
        { timeout: 10000, interval: 50, log: 'Waiting for the real event slice to settle' }
      );
      expect(settled.events).toEqual([expect.objectContaining({
        userId: current.user.id,
        label: 'Current trip',
      })]);
      expect(settled.calls.getEvents).toBe(1);
      expect(settled.calls.syncPendingMoods).toBe(1);
      await expect(page.getByRole('heading', { name: 'Current trip', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Cached current trip', exact: true })).not.toBeVisible();
      await expect(page.getByTestId('events-load-error')).not.toBeVisible();
    });
  }

  test('[P0] DW-81-E2E-003 keeps the first null notification signed out after stale authenticated bootstrap', async ({
    page,
    authBootstrap,
  }) => {
    await log.step('Deliver a first and only sign-out notification while bootstrap waits');
    await authBootstrap.mount();
    await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
    await authBootstrap.notify('SIGNED_OUT', null);
    const signedOut = await authBootstrap.snapshot();
    expect(signedOut.userId).toBeNull();

    await log.step('Release a stale signed-in session and verify Login owns the result');
    await authBootstrap.resolveLookup(createAuthBootstrapSession());
    await expect(page.getByText('Loading...', { exact: true })).not.toBeVisible();
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByTestId('app-container')).not.toBeVisible();
    expect(await authBootstrap.snapshot()).toMatchObject({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      authSessionVersion: signedOut.authSessionVersion,
      events: [],
      eventsIsLoading: false,
      notificationCount: 1,
      calls: { initializeApp: 0, syncPendingMoods: 0, getEvents: 0 },
    });
  });

  test('[P1] DW-81-E2E-004 preserves same-user email and display-name setup when notification beats the queued continuation', async ({
    page,
    authBootstrap,
    recurse,
  }) => {
    const original = createAuthBootstrapSession({ email: 'before@example.test' });
    const updated = createAuthBootstrapSession({
      userId: original.user.id,
      email: 'after@example.test',
      displayName: null,
    });
    await log.step('Seed the existing store identity and mount its pending initial lookup');
    await authBootstrap.mount({ initialIdentity: { userId: original.user.id, email: original.user.email } });
    await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
    const before = await authBootstrap.snapshot();

    await log.step('Resolve the old snapshot and synchronously deliver USER_UPDATED before continuation');
    await authBootstrap.resolveLookupThenNotify(original, 'USER_UPDATED', updated);
    await expect(page.getByText('Loading...', { exact: true })).not.toBeVisible();
    await expect(page.getByTestId('display-name-setup')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Display Name' })).toBeVisible();
    await expect(page.getByTestId('app-container')).not.toBeVisible();
    const after = await recurse(
      () => authBootstrap.snapshot(),
      (state) => state.calls.syncPendingMoods === 1,
      { timeout: 10000, interval: 50, log: 'Waiting for the notified session sync effect' }
    );
    expect(after).toMatchObject({
      userId: original.user.id,
      userEmail: 'after@example.test',
      isAuthenticated: true,
      authSessionVersion: before.authSessionVersion,
      calls: { initializeApp: 1, syncPendingMoods: 1, getEvents: 1 },
    });
    await authBootstrap.resolveEvents([]);
    await expect(page.getByTestId('display-name-setup')).toBeVisible();
  });

  test('[P1] DW-81-E2E-005 retains the listener session when the SDK bootstrap rejects', async ({
    page,
    authBootstrap,
    recurse,
  }) => {
    const current = createAuthBootstrapSession();
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await log.step('Deliver a newer session before the SDK lookup fails');
    await authBootstrap.mount();
    await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
    await authBootstrap.notify('SIGNED_IN', current);
    const owned = await recurse(
      () => authBootstrap.snapshot(),
      (state) => state.calls.getEvents === 1 && state.calls.syncPendingMoods === 1,
      { timeout: 10000, interval: 50, log: 'Waiting for the notified Home load' }
    );

    await log.step('Let real sessionService normalize the rejection to null');
    await authBootstrap.rejectLookup('Controlled bootstrap failure');
    await expect(page.getByText('Loading...', { exact: true })).not.toBeVisible();
    await expect(page.getByTestId('app-container')).toBeVisible();
    expect(errors.some((message) =>
      message.includes('[AuthService] Unexpected error getting session:') &&
      message.includes('Controlled bootstrap failure')
    )).toBe(true);
    expect(await authBootstrap.snapshot()).toMatchObject({
      userId: current.user.id,
      authSessionVersion: owned.authSessionVersion,
      calls: { initializeApp: 1, syncPendingMoods: 1, getEvents: 1 },
    });
    await authBootstrap.resolveEvents([]);
    await expect(page.getByTestId('events-empty-placeholder')).toBeVisible();
    await expect(page.getByTestId('login-screen')).not.toBeVisible();
  });

  test('[P1] DW-81-E2E-006 installs an authenticated bootstrap without a notification', async ({
    page,
    authBootstrap,
    recurse,
  }) => {
    const initial = createAuthBootstrapSession();
    await log.step('Mount without a notification and release the initial authenticated session');
    await authBootstrap.mount();
    await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
    const before = await authBootstrap.snapshot();
    await authBootstrap.resolveLookup(initial);
    await expect(page.getByText('Loading...', { exact: true })).not.toBeVisible();
    await expect(page.getByTestId('app-container')).toBeVisible();
    const after = await recurse(
      () => authBootstrap.snapshot(),
      (state) => state.calls.getEvents === 1 && state.calls.syncPendingMoods === 1,
      { timeout: 10000, interval: 50, log: 'Waiting for the accepted initial session load' }
    );
    expect(after).toMatchObject({
      userId: initial.user.id,
      userEmail: initial.user.email,
      isAuthenticated: true,
      authSessionVersion: before.authSessionVersion + 1,
      notificationCount: 0,
    });
    await authBootstrap.resolveEvents([]);
    await expect(page.getByTestId('events-empty-placeholder')).toBeVisible();
    await expect(page.getByTestId('login-screen')).not.toBeVisible();
  });

  test('[P1] DW-81-E2E-007 clears old store auth for null bootstrap without a notification', async ({
    page,
    authBootstrap,
  }) => {
    const previous = createAuthBootstrapSession();
    await log.step('Mount with a prior store identity and a pending initial lookup');
    await authBootstrap.mount({ initialIdentity: { userId: previous.user.id, email: previous.user.email } });
    await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
    await authBootstrap.seedEvents([{ userId: previous.user.id, label: 'Previous account trip' }]);
    const before = await authBootstrap.snapshot();
    expect(before.events).toHaveLength(1);

    await log.step('Accept the initial null session and show Login with cleared account state');
    await authBootstrap.resolveLookup(null);
    await expect(page.getByText('Loading...', { exact: true })).not.toBeVisible();
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await expect(page.getByTestId('app-container')).not.toBeVisible();
    expect(await authBootstrap.snapshot()).toMatchObject({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      authSessionVersion: before.authSessionVersion + 1,
      events: [],
      eventsIsLoading: false,
      notificationCount: 0,
      calls: { initializeApp: 0, syncPendingMoods: 0 },
    });
    await authBootstrap.resolveEvents([{ userId: previous.user.id, label: 'Late previous trip' }]);
    await expect(page.getByTestId('login-screen')).toBeVisible();
    expect((await authBootstrap.snapshot()).events).toEqual([]);
  });
});
