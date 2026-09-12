/**
 * DW-49: committed saves with unreadable representations reconcile through GET.
 * Run with the sibling artifact Playwright config; worker-owned fixtures clean
 * every event this browser creates. No production error/store action is mocked.
 */
import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { recurse } from '@seontechnologies/playwright-utils/recurse';
import { test, expect } from '../../../../tests/support/merged-fixtures';
import type { EventsRefreshControl } from '../../../../tests/support/fixtures/events-refresh-control';
import { eventDateFrom } from '../../../../tests/support/factories/events';
import type { Database } from '../../../../src/types/database.types';
import {
  installRetryableSave,
  installUncertainSave,
  makeSaveInput,
} from '../fixtures/uncertain-events';

type EventRow = Database['public']['Tables']['events']['Row'];
type EventInsert = Database['public']['Tables']['events']['Insert'];
type ReadEvents = () => Promise<{ status: number; body: EventRow[] }>;

const expectedHttpFailure = { annotation: [{ type: 'skipNetworkMonitoring' }] };
const uncertainty = "This event may already have been saved. We couldn't read the response.";

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const state = window.__APP_STORE__!.getState();
    return {
      rows: state.events.map(({ id, label }) => ({ id, label }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      loading: state.eventsIsLoading,
      error: state.eventsError,
    };
  });
}

async function settledSnapshot(page: Page) {
  return recurse(
    () => snapshot(page),
    (state) => !state.loading,
    { timeout: 15000, interval: 50, log: 'Wait for authoritative events state' }
  );
}

async function openSettings(page: Page, control: EventsRefreshControl) {
  await page.goto('/settings');
  // Both windows run twice during the real React StrictMode mount.
  await control.waitForIdle();
  await page.getByTestId('settings-view').waitFor({ state: 'visible' });
  await settledSnapshot(page);
}

async function fillEvent(page: Page, input: EventInsert) {
  await page.getByTestId('events-form-label').fill(input.label);
  await page.getByTestId('events-form-date').fill(input.event_date);
  await page.getByTestId('events-form-description').fill(input.description ?? '');
  // The radio is visually hidden; its explicit label is the clickable control.
  await page.getByTestId(`events-form-icon-option-${input.icon ?? 'calendar'}`).click();
}

async function attemptResubmission(page: Page, input: EventInsert, anchor: Date) {
  await fillEvent(page, {
    ...input,
    label: `${input.label} edited after failure`,
    event_date: eventDateFrom(anchor, 35),
    description: 'These edits must never reach a second write from this form.',
    icon: 'ring',
  });
  await page.getByTestId('events-form-label').press('Enter');
  await page.getByTestId('events-form-label').evaluate((inputElement) => {
    const form = (inputElement as HTMLInputElement).form;
    if (!form) throw new Error('The event input has no native form');
    form.requestSubmit();
    form.requestSubmit();
  });
}

async function committedSnapshot(readEvents: ReadEvents, savedId: string) {
  const server = await readEvents();
  return {
    status: server.status,
    count: server.body.length,
    matchingRows: server.body.filter(({ id }) => id === savedId),
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lastWelcomeView', String(Date.now())));
});

test.describe('DW-49 uncertain event saves', () => {
  for (const mode of ['create', 'update'] as const) {
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const id = mode === 'create' ? 'DW49-E2E-001' : 'DW49-E2E-002';
    test(`[P1] ${id} committed ${mode} blocks resubmission and reconciles by refresh`, async ({
      page, coupleEvents, eventsRefreshControl, apiRequest, authToken,
    }) => {
      const seeded = await coupleEvents.seed(mode === 'update' ? [
        { label: 'DW49 original edit target', dayOffset: 14 },
        { label: 'DW49 unrelated survivor', dayOffset: -7 },
      ] : []);
      const input = makeSaveInput(coupleEvents.userId, coupleEvents.anchor, {
        label: `DW49 ${mode} committed`, description: 'Entered before the uncertain save', icon: 'plane',
      });
      const readEvents = () => apiRequest<EventRow[]>({
        method: 'GET', baseUrl: process.env.SUPABASE_URL,
        path: `/rest/v1/events?user_id=eq.${coupleEvents.userId}&select=*`,
        headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
      });
      const save = await installUncertainSave(page, method);
      try {
        await log.step(`Commit a real ${mode}, then corrupt only its returned date`);
        await page.clock.setFixedTime(coupleEvents.anchor);
        await openSettings(page, eventsRefreshControl);
        const before = await settledSnapshot(page);
        if (mode === 'update') {
          await page.getByTestId(`event-edit-${seeded[0].id}`).click();
        } else {
          await page.getByTestId('events-settings-empty-add').click();
        }
        await fillEvent(page, input);
        await page.getByTestId('events-form-submit').click();
        const committed = await save.waitForCompleted();
        expect(committed.status).toBe(mode === 'create' ? 201 : 200);
        expect(committed.row).toMatchObject(input);
        const expectedCount = mode === 'create' ? 1 : seeded.length;
        // Verify all committed fields; the write counter also detects identical replays.
        expect(await committedSnapshot(readEvents, committed.row.id)).toEqual({
          status: 200, count: expectedCount, matchingRows: [committed.row],
        });
        expect(await settledSnapshot(page)).toEqual(before);
        await expect(page.getByTestId('events-form-error')).toContainText(uncertainty);
        await expect(page.getByTestId('events-form')).toBeVisible();
        await expect(page.getByTestId('events-form-label')).toHaveValue(input.label);
        await expect(page.getByTestId('events-form-date')).toHaveValue(input.event_date);
        await expect(page.getByTestId('events-form-description')).toHaveValue(input.description ?? '');
        await expect(page.getByRole('radio', { name: 'Plane', exact: true })).toBeChecked();
        await expect(page.getByRole('button', { name: 'Refresh events', exact: true })).toBeFocused();
        await expect(page.getByTestId('events-form-submit')).toHaveCount(0);
        await expect(page.getByTestId('events-form-cancel')).toBeEnabled();
        await expect(page.getByRole('button', { name: 'Close form', exact: true })).toBeEnabled();

        await log.step('Edit every field and attempt native Enter and direct form submission');
        await attemptResubmission(page, input, coupleEvents.anchor);
        await expect(page.getByTestId('events-form-error')).toContainText(uncertainty);
        await expect(page.getByTestId('events-form-submit')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Refresh events', exact: true })).toBeEnabled();
        expect(save.writes()).toBe(1);
        await eventsRefreshControl.waitForIdle();
        const refresh = eventsRefreshControl.holdNextLoad('success');
        await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
        await refresh.waitForPending();
        await expect(page.getByTestId('events-form')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeFocused();
        expect(save.writes()).toBe(1);
        refresh.release();
        expect(await refresh.waitForCompleted()).toEqual([200, 200]);
        const state = await settledSnapshot(page);
        expect(state.error).toBeNull();
        expect(state.rows).toHaveLength(expectedCount);
        expect(state.rows).toContainEqual({ id: committed.row.id, label: input.label });
        await expect(page.getByTestId(`event-label-${committed.row.id}`)).toHaveText(input.label);
        await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeFocused();
        // Verify all committed fields; the write counter also detects identical replays.
        expect(await committedSnapshot(readEvents, committed.row.id)).toEqual({
          status: 200, count: expectedCount, matchingRows: [committed.row],
        });
        expect(save.writes()).toBe(1);
      } finally {
        await save.dispose();
      }
    });
  }

  for (const mode of ['create', 'update'] as const) {
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const id = mode === 'create' ? 'DW49-E2E-003' : 'DW49-E2E-004';
    test(`[P1] ${id} failed ${mode} reconciliation preserves the list and Retry only reads`,
      expectedHttpFailure, async ({
        page, coupleEvents, eventsRefreshControl, apiRequest, authToken,
      }) => {
        const seeded = await coupleEvents.seed(mode === 'update' ? [
          { label: 'DW49 prior edit snapshot', dayOffset: 14 },
          { label: 'DW49 retained history', dayOffset: -10 },
        ] : []);
        const input = makeSaveInput(coupleEvents.userId, coupleEvents.anchor, {
          label: `DW49 ${mode} recovered by Retry`, description: 'Recover by reading only', icon: 'plane',
        });
        const readEvents = () => apiRequest<EventRow[]>({
          method: 'GET', baseUrl: process.env.SUPABASE_URL,
          path: `/rest/v1/events?user_id=eq.${coupleEvents.userId}&select=*`,
          headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
        });
        const save = await installUncertainSave(page, method);
        try {
          await log.step('Establish an uncertain server commit with the original list still loaded');
          await page.clock.setFixedTime(coupleEvents.anchor);
          await openSettings(page, eventsRefreshControl);
          const before = await settledSnapshot(page);
          if (mode === 'update') {
            await page.getByTestId(`event-edit-${seeded[0].id}`).click();
          } else {
            await page.getByTestId('events-settings-empty-add').click();
          }
          await fillEvent(page, input);
          await page.getByTestId('events-form-submit').click();
          const committed = await save.waitForCompleted();
          expect(committed.status).toBe(mode === 'create' ? 201 : 200);
          expect(committed.row).toMatchObject(input);
          const expectedCount = mode === 'create' ? 1 : seeded.length;
          // Verify all committed fields; the write counter also detects identical replays.
          expect(await committedSnapshot(readEvents, committed.row.id)).toEqual({
            status: 200, count: expectedCount, matchingRows: [committed.row],
          });
          expect(await settledSnapshot(page)).toEqual(before);
          await expect(page.getByTestId('events-form-error')).toContainText(uncertainty);
          await expect(page.getByTestId('events-form')).toBeVisible();
          await expect(page.getByTestId('events-form-label')).toHaveValue(input.label);
          await expect(page.getByTestId('events-form-date')).toHaveValue(input.event_date);
          await expect(page.getByTestId('events-form-description')).toHaveValue(input.description ?? '');
          await expect(page.getByRole('radio', { name: 'Plane', exact: true })).toBeChecked();
          await expect(page.getByRole('button', { name: 'Refresh events', exact: true })).toBeFocused();
          await expect(page.getByTestId('events-form-submit')).toHaveCount(0);
          await expect(page.getByTestId('events-form-cancel')).toBeEnabled();
          await expect(page.getByRole('button', { name: 'Close form', exact: true })).toBeEnabled();

          await log.step('Fail both refresh windows after closing the failed form');
          await eventsRefreshControl.waitForIdle();
          const failure = eventsRefreshControl.holdNextLoad('failure');
          await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
          await failure.waitForPending();
          await expect(page.getByTestId('events-form')).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeFocused();
          failure.release();
          expect(await failure.waitForCompleted()).toEqual([400, 400]);
          const failed = await settledSnapshot(page);
          expect(failed.rows).toEqual(before.rows);
          expect(failed.error).toContain('TEA forced events refresh failure');
          await expect(page.getByTestId('events-settings-load-error')).toBeVisible();
          await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
          await expect(page.getByTestId('events-form')).toHaveCount(0);
          for (const original of seeded) {
            await expect(page.getByTestId(`event-label-${original.id}`)).toHaveText(original.label);
          }
          expect(save.writes()).toBe(1);

          await log.step('Recover through the list Retry without replaying the committed write');
          await eventsRefreshControl.waitForIdle();
          const recovery = eventsRefreshControl.holdNextLoad('success');
          await page.getByRole('button', { name: 'Retry', exact: true }).click();
          await recovery.waitForPending();
          expect(save.writes()).toBe(1);
          recovery.release();
          expect(await recovery.waitForCompleted()).toEqual([200, 200]);
          const recovered = await settledSnapshot(page);
          expect(recovered.error).toBeNull();
          expect(recovered.rows).toHaveLength(expectedCount);
          expect(recovered.rows).toContainEqual({ id: committed.row.id, label: input.label });
          await expect(page.getByTestId(`event-label-${committed.row.id}`)).toHaveText(input.label);
          await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
          await expect(page.getByTestId('events-form')).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeFocused();
          // Verify all committed fields; the write counter also detects identical replays.
          expect(await committedSnapshot(readEvents, committed.row.id)).toEqual({
            status: 200, count: expectedCount, matchingRows: [committed.row],
          });
          expect(save.writes()).toBe(1);
        } finally {
          await save.dispose();
        }
      });
  }

  test('[P2] DW49-E2E-005 a committed create outside bounded history stays absent without replay', async ({
    page, coupleEvents, eventsRefreshControl, apiRequest, authToken,
  }) => {
    const history = await coupleEvents.seed(Array.from({ length: 51 }, (_, index) => ({
      label: `DW49 nearest history ${index + 1}`, dayOffset: -(index + 1),
    })));
    const input = makeSaveInput(coupleEvents.userId, coupleEvents.anchor, {
      label: 'DW49 uncertain deep history',
      event_date: eventDateFrom(coupleEvents.anchor, -1000),
      description: 'The initial past window cannot contain this committed event.',
      icon: 'plane',
    });
    const readEvents = () => apiRequest<EventRow[]>({
      method: 'GET', baseUrl: process.env.SUPABASE_URL,
      path: `/rest/v1/events?user_id=eq.${coupleEvents.userId}&select=*`,
      headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
    });
    const save = await installUncertainSave(page, 'POST');
    try {
      await log.step('Create a real event older than all fifty initially loaded history rows');
      await page.clock.setFixedTime(coupleEvents.anchor);
      await openSettings(page, eventsRefreshControl);
      const before = await settledSnapshot(page);
      expect(history).toHaveLength(51);
      expect(before.rows).toHaveLength(50);
      await page.getByRole('button', { name: 'Add event', exact: true }).click();
      await fillEvent(page, input);
      await page.getByTestId('events-form-submit').click();
      const committed = await save.waitForCompleted();
      expect(committed.status).toBe(201);
      expect(committed.row).toMatchObject(input);
      // Verify all committed fields; the write counter also detects identical replays.
      expect(await committedSnapshot(readEvents, committed.row.id)).toEqual({
        status: 200, count: 52, matchingRows: [committed.row],
      });
      expect(await settledSnapshot(page)).toEqual(before);
      await expect(page.getByTestId('events-form-error')).toContainText(uncertainty);
      await expect(page.getByTestId('events-form')).toBeVisible();
      await expect(page.getByTestId('events-form-label')).toHaveValue(input.label);
      await expect(page.getByTestId('events-form-date')).toHaveValue(input.event_date);
      await expect(page.getByTestId('events-form-description')).toHaveValue(input.description ?? '');
      await expect(page.getByRole('radio', { name: 'Plane', exact: true })).toBeChecked();
      await expect(page.getByRole('button', { name: 'Refresh events', exact: true })).toBeFocused();
      await expect(page.getByTestId('events-form-submit')).toHaveCount(0);
      await expect(page.getByTestId('events-form-cancel')).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Close form', exact: true })).toBeEnabled();

      await log.step('Refresh the bounded list; absence must not trigger another create');
      await eventsRefreshControl.waitForIdle();
      const refresh = eventsRefreshControl.holdNextLoad('success');
      await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
      await refresh.waitForPending();
      await expect(page.getByTestId('events-form')).toHaveCount(0);
      refresh.release();
      expect(await refresh.waitForCompleted()).toEqual([200, 200]);
      const refreshed = await settledSnapshot(page);
      expect(refreshed).toEqual(before);
      await expect(page.getByTestId(`event-row-${committed.row.id}`)).toHaveCount(0);
      await expect(page.getByTestId('events-settings-history-notice')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Load more history', exact: true })).toBeEnabled();
      await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeFocused();
      // Verify all committed fields; the write counter also detects identical replays.
      expect(await committedSnapshot(readEvents, committed.row.id)).toEqual({
        status: 200, count: 52, matchingRows: [committed.row],
      });
      expect(save.writes()).toBe(1);
    } finally {
      await save.dispose();
    }
  });

  test('[P2] DW49-E2E-006 an ordinary transport failure keeps deliberate create retry available',
    expectedHttpFailure, async ({
      page, coupleEvents, eventsRefreshControl, apiRequest, authToken,
    }) => {
      const input = makeSaveInput(coupleEvents.userId, coupleEvents.anchor, {
        label: 'DW49 deliberate transport retry', description: 'The same entered fields are retried.', icon: 'plane',
      });
      const readEvents = () => apiRequest<EventRow[]>({
        method: 'GET', baseUrl: process.env.SUPABASE_URL,
        path: `/rest/v1/events?user_id=eq.${coupleEvents.userId}&select=*`,
        headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
      });
      const save = await installRetryableSave(page);
      try {
        await log.step('Return one terminal transport error before any server create is sent');
        await page.clock.setFixedTime(coupleEvents.anchor);
        await openSettings(page, eventsRefreshControl);
        await page.getByTestId('events-settings-empty-add').click();
        await fillEvent(page, input);
        await page.getByTestId('events-form-submit').click();
        expect((await save.waitForCompleted(1)).status).toBe(400);
        const rejected = await readEvents();
        expect(rejected.status).toBe(200);
        expect(rejected.body).toEqual([]);
        expect((await settledSnapshot(page)).rows).toEqual([]);
        await expect(page.getByTestId('events-form-error')).toContainText('TEA deliberate transport failure');
        await expect(page.getByTestId('events-form-error')).not.toContainText(uncertainty);
        await expect(page.getByTestId('events-form-refresh')).toHaveCount(0);
        await expect(page.getByTestId('events-form-submit')).toBeEnabled();
        await expect(page.getByTestId('events-form-submit')).toBeFocused();
        await expect(page.getByTestId('events-form-label')).toHaveValue(input.label);
        await expect(page.getByTestId('events-form-date')).toHaveValue(input.event_date);
        await expect(page.getByTestId('events-form-description')).toHaveValue(input.description ?? '');
        await expect(page.getByRole('radio', { name: 'Plane', exact: true })).toBeChecked();
        expect(save.writes()).toBe(1);

        await log.step('Deliberately retry once and observe the real server, store and UI success');
        await page.getByTestId('events-form-submit').click();
        const committed = await save.waitForCompleted(2);
        expect(committed.status).toBe(201);
        expect(committed.row).toMatchObject(input);
        expect(committed.row).toBeDefined();
        const saved = committed.row!;
        // Verify all committed fields; the write counter also detects identical replays.
        expect(await committedSnapshot(readEvents, saved.id)).toEqual({
          status: 200, count: 1, matchingRows: [saved],
        });
        const expectedRows = [{ id: saved.id, label: input.label }];
        const state = await recurse(
          () => snapshot(page),
          (current) => current.rows.length === 1 && current.rows[0].id === saved.id,
          { timeout: 15000, interval: 50, log: 'Wait for the deliberate save in Zustand' }
        );
        expect(state.rows).toEqual(expectedRows);
        expect(state.error).toBeNull();
        await expect(page.getByTestId('events-form')).toHaveCount(0);
        await expect(page.getByTestId(`event-label-${saved.id}`)).toHaveText(input.label);
        expect(save.writes()).toBe(2);
      } finally {
        await save.dispose();
      }
    });
});
