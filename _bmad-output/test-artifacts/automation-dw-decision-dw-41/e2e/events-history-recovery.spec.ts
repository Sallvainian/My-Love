/**
 * DW-41 continuation recovery and mutation replay through the Settings UI.
 * Existing history-pagination journeys cover deep-date edits, ties, and focus.
 * No events response schema exists; setup PATCH assertions cover tested fields.
 */
import { log } from '@seontechnologies/playwright-utils';
import type { Page } from '@playwright/test';
import type { Database } from '../../../../src/types/database.types';
import { test, expect } from '../../../../tests/support/merged-fixtures';
import { eventDateFrom } from '../../../../tests/support/factories/events';
import { createEventsPagingControl } from '../fixtures/events-paging-control';
import { buildHistory } from '../fixtures/history-data';

type EventRow = Database['public']['Tables']['events']['Row'];
let pagingControl: Awaited<ReturnType<typeof createEventsPagingControl>>;

function readPagingState(page: Page) {
  return page.evaluate(() => {
    const state = window.__APP_STORE__!.getState();
    return {
      events: state.events.map(({ id, label }) => ({ id, label })),
      pagination: state.eventsPagination,
      loading: state.eventsIsLoading,
      loadingMore: state.eventsIsLoadingMore,
      error: state.eventsError,
      historyError: state.eventsHistoryError,
    };
  });
}

test.beforeEach(async ({ page, interceptNetworkCall }) => {
  await page.addInitScript(() => localStorage.setItem('lastWelcomeView', String(Date.now())));
  pagingControl = await createEventsPagingControl(page, interceptNetworkCall);
});

test.afterEach(async () => {
  await pagingControl.dispose();
});

test.describe('DW-41 Settings history recovery', () => {
  test(
    '[P1] DW-41-E2E-001 a failed window keeps both cursors and retry appends each tail once',
    { annotation: [{ type: 'skipNetworkMonitoring', description: 'One history GET intentionally returns HTTP 400.' }] },
    async ({ page, coupleEvents, interceptNetworkCall, recurse }) => {
      await log.step('Load the first fifty rows from each side of today');
      const seeded = await coupleEvents.seed(buildHistory({ past: 51, upcoming: 51 }));
      const pastTail = seeded[50];
      const upcomingTail = seeded[101];
      const expectedFirstIds = seeded.filter((row) => row.id !== pastTail.id && row.id !== upcomingTail.id)
        .map((row) => row.id).sort();
      const initialCall = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
      await page.goto('/settings');
      expect((await initialCall).status).toBe(200);
      await pagingControl.waitForIdle();
      const before = await recurse(
        () => readPagingState(page),
        (state) => !state.loading && !state.loadingMore && state.events.length === 100,
        { timeout: 15000, interval: 50, log: 'Waiting for the initial Settings window' }
      );
      expect(before.events.map((row) => row.id).sort()).toEqual(expectedFirstIds);
      expect(before.pagination).toMatchObject({ upcoming: { hasMore: true }, past: { hasMore: true } });
      await expect(page.getByTestId(/^event-row-/)).toHaveCount(100);

      await log.step('Let the upcoming window succeed while its past counterpart fails');
      const failedPage = pagingControl.holdNextContinuation({ upcoming: 'success', past: 'failure' });
      await page.getByRole('button', { name: 'Load more history', exact: true }).click();
      const failedCaptures = await failedPage.waitForCaptured();
      expect(failedCaptures).toHaveLength(2);
      expect(failedCaptures).toEqual(expect.arrayContaining([
        expect.objectContaining({ window: 'upcoming', status: 200, rowIds: [upcomingTail.id] }),
        expect.objectContaining({ window: 'past', status: 400 }),
      ]));
      failedPage.release();
      const failedReplies = await failedPage.waitForCompleted();
      expect(failedReplies.map((reply) => reply.status).sort()).toEqual([200, 400]);
      const failed = await recurse(
        () => readPagingState(page),
        (state) => !state.loadingMore && state.historyError !== null,
        { timeout: 15000, interval: 50, log: 'Waiting for the failed continuation to settle' }
      );
      expect(failed.events).toEqual(before.events);
      expect(failed.pagination).toEqual(before.pagination);
      expect(failed.error).toBeNull();
      await expect(page.getByTestId('events-settings-history-error')).toContainText('Your loaded events are still here');
      await expect(page.getByTestId(`event-row-${upcomingTail.id}`)).toHaveCount(0);
      await expect(page.getByTestId(`event-row-${pastTail.id}`)).toHaveCount(0);
      await expect(page.getByTestId(/^event-row-/)).toHaveCount(100);

      await log.step('Retry the identical cursors and append both missing tails once');
      const retryPage = pagingControl.holdNextContinuation({ upcoming: 'success', past: 'success' });
      await page.getByRole('button', { name: 'Retry loading history', exact: true }).click();
      const retryCaptures = await retryPage.waitForCaptured();
      expect(retryCaptures.map((reply) => reply.url).sort())
        .toEqual(failedCaptures.map((reply) => reply.url).sort());
      expect(retryCaptures.flatMap((reply) => reply.rowIds).sort())
        .toEqual([pastTail.id, upcomingTail.id].sort());
      retryPage.release();
      expect((await retryPage.waitForCompleted()).map((reply) => reply.status)).toEqual([200, 200]);
      const recovered = await recurse(
        () => readPagingState(page),
        (state) => !state.loadingMore && state.events.length === 102,
        { timeout: 15000, interval: 50, log: 'Waiting for both recovered tails in the store' }
      );
      expect(recovered.events.map((row) => row.id).sort()).toEqual(seeded.map((row) => row.id).sort());
      expect(new Set(recovered.events.map((row) => row.id)).size).toBe(102);
      expect(recovered.pagination).toMatchObject({ upcoming: { hasMore: false }, past: { hasMore: false } });
      expect(recovered.historyError).toBeNull();
      await expect(page.getByTestId(/^event-row-/)).toHaveCount(102);
      await expect(page.getByTestId(`event-row-${pastTail.id}`)).toHaveCount(1);
      await expect(page.getByTestId(`event-row-${upcomingTail.id}`)).toHaveCount(1);
      await expect(page.getByTestId('events-settings-history-error')).toHaveCount(0);
      await expect(page.getByTestId('events-settings-load-more')).toHaveCount(0);
    }
  );

  test('[P1] DW-41-E2E-002 a completed edit survives an older real continuation snapshot', async ({
    page, coupleEvents, apiRequest, authToken, interceptNetworkCall, recurse,
  }) => {
    await log.step('Keep an editable row visible while another device moves it into deeper history');
    const seeded = await coupleEvents.seed(buildHistory({ past: 52 }));
    const target = seeded[0];
    const initialCall = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
    await page.goto('/settings');
    expect((await initialCall).status).toBe(200);
    await pagingControl.waitForIdle();
    const initial = await recurse(
      () => readPagingState(page),
      (state) => !state.loading && state.events.length === 50,
      { timeout: 15000, interval: 50, log: 'Waiting for editable initial history' }
    );
    expect(initial.events.map((row) => row.id)).toContain(target.id);
    const deeperDate = eventDateFrom(coupleEvents.anchor, -100);
    const moved = await apiRequest<EventRow[]>({
      method: 'PATCH',
      baseUrl: process.env.SUPABASE_URL,
      path: `/rest/v1/events?id=eq.${target.id}&select=*`,
      headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' },
      body: { event_date: deeperDate },
    });
    expect(moved.status).toBe(200);
    expect(moved.body).toEqual([expect.objectContaining({ id: target.id, label: target.label, event_date: deeperDate })]);

    const heldPage = pagingControl.holdNextContinuation({ past: 'success' });
    await page.getByRole('button', { name: 'Load more history', exact: true }).click();
    const captured = await heldPage.waitForCaptured();
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ window: 'past', status: 200 });
    expect(captured[0].rowIds).toContain(target.id);

    await log.step('Save the visible row before the captured continuation reaches the store');
    await page.getByRole('button', { name: `Edit ${target.label}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Event', exact: true });
    await expect(dialog.getByLabel('Date', { exact: false })).toHaveValue(target.eventDate);
    const updatedLabel = 'Edited while history was loading';
    await dialog.getByLabel('Label', { exact: false }).fill(updatedLabel);
    const editCall = interceptNetworkCall({ method: 'PATCH', url: '**/rest/v1/events*' });
    await dialog.getByRole('button', { name: 'Update', exact: true }).click();
    const editReply = await editCall;
    expect(editReply.status).toBe(200);
    expect(editReply.responseJson).toEqual([
      expect.objectContaining({ id: target.id, label: updatedLabel, event_date: target.eventDate }),
    ]);
    const edited = await recurse(
      () => readPagingState(page),
      (state) => state.events.find((row) => row.id === target.id)?.label === updatedLabel,
      { timeout: 15000, interval: 50, log: 'Waiting for the completed edit in the store' }
    );
    expect(edited.loadingMore).toBe(true);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId(`event-label-${target.id}`)).toHaveText(updatedLabel);

    await log.step('Release the older snapshot and retain the completed edit exactly once');
    heldPage.release();
    expect((await heldPage.waitForCompleted()).map((reply) => reply.status)).toEqual([200]);
    const settled = await recurse(
      () => readPagingState(page),
      (state) => !state.loadingMore && state.events.length === 52,
      { timeout: 15000, interval: 50, log: 'Waiting for the held history page to reconcile' }
    );
    expect(settled.events.filter((row) => row.id === target.id)).toEqual([{ id: target.id, label: updatedLabel }]);
    expect(settled.events.map((row) => row.id).sort()).toEqual(seeded.map((row) => row.id).sort());
    await expect(page.getByTestId(/^event-row-/)).toHaveCount(52);
    await expect(page.getByTestId(`event-label-${target.id}`)).toHaveText(updatedLabel);
    await expect(page.getByRole('heading', { name: target.label, exact: true })).toHaveCount(0);
    await expect(page.getByTestId('events-settings-load-more')).toHaveCount(0);
    await page.getByRole('button', { name: `Edit ${updatedLabel}`, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Edit Event', exact: true })
      .getByLabel('Date', { exact: false })).toHaveValue(target.eventDate);
  });

  test('[P1] DW-41-E2E-003 a completed deletion is not resurrected by an older real continuation snapshot', async ({
    page, coupleEvents, apiRequest, authToken, interceptNetworkCall, recurse,
  }) => {
    await log.step('Keep a deletable row visible while another device moves it beyond the current cursor');
    const seeded = await coupleEvents.seed(buildHistory({ past: 52 }));
    const target = seeded[0];
    const initialCall = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
    await page.goto('/settings');
    expect((await initialCall).status).toBe(200);
    await pagingControl.waitForIdle();
    const initial = await recurse(
      () => readPagingState(page),
      (state) => !state.loading && state.events.length === 50,
      { timeout: 15000, interval: 50, log: 'Waiting for deletable initial history' }
    );
    expect(initial.events.map((row) => row.id)).toContain(target.id);
    const deeperDate = eventDateFrom(coupleEvents.anchor, -100);
    const moved = await apiRequest<EventRow[]>({
      method: 'PATCH',
      baseUrl: process.env.SUPABASE_URL,
      path: `/rest/v1/events?id=eq.${target.id}&select=*`,
      headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' },
      body: { event_date: deeperDate },
    });
    expect(moved.status).toBe(200);
    expect(moved.body).toEqual([expect.objectContaining({ id: target.id, label: target.label, event_date: deeperDate })]);

    const heldPage = pagingControl.holdNextContinuation({ past: 'success' });
    await page.getByRole('button', { name: 'Load more history', exact: true }).click();
    const captured = await heldPage.waitForCaptured();
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ window: 'past', status: 200 });
    expect(captured[0].rowIds).toContain(target.id);

    await log.step('Delete the visible row before the captured continuation reaches the store');
    await page.getByRole('button', { name: `Delete ${target.label}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this event?', exact: true });
    const deleteCall = interceptNetworkCall({ method: 'DELETE', url: '**/rest/v1/events*' });
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    const deleteReply = await deleteCall;
    expect(deleteReply.status).toBe(200);
    expect(deleteReply.responseJson).toEqual([expect.objectContaining({ id: target.id })]);
    const deleted = await recurse(
      () => readPagingState(page),
      (state) => !state.events.some((row) => row.id === target.id),
      { timeout: 15000, interval: 50, log: 'Waiting for the completed deletion in the store' }
    );
    expect(deleted.loadingMore).toBe(true);
    expect(deleted.events).toHaveLength(49);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId(`event-row-${target.id}`)).toHaveCount(0);

    await log.step('Release the older snapshot and keep the deleted row absent');
    heldPage.release();
    expect((await heldPage.waitForCompleted()).map((reply) => reply.status)).toEqual([200]);
    const settled = await recurse(
      () => readPagingState(page),
      (state) => !state.loadingMore,
      { timeout: 15000, interval: 50, log: 'Waiting for history to settle after deletion' }
    );
    expect(settled.events.map((row) => row.id).sort())
      .toEqual(seeded.filter((row) => row.id !== target.id).map((row) => row.id).sort());
    expect(settled.events).toHaveLength(51);
    expect(settled.historyError).toBeNull();
    await expect(page.getByTestId(/^event-row-/)).toHaveCount(51);
    await expect(page.getByTestId(`event-row-${target.id}`)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: target.label, exact: true })).toHaveCount(0);
    await expect(page.getByTestId('events-settings-load-more')).toHaveCount(0);
  });
});
