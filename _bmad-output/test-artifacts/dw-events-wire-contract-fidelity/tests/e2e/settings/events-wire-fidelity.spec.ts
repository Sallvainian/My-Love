import { randomUUID } from 'node:crypto';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import { createEventsWireFidelityData } from '../../support/factories/events-wire-fidelity';
import { localDateFromIso } from '../../support/helpers/events';
import { formatDateLong } from '../../../src/utils/dateUtils';

// Supplementary compatibility evidence; strict schema and anonymous denial belong to the API suite.
test('[P2] DW.WIRE-E2E-001 same-label couple rows retain identity and controls after reload', async ({
  page,
  coupleEvents,
  interceptNetworkCall,
  recurse,
}) => {
  const data = createEventsWireFidelityData(coupleEvents.anchor, randomUUID());
  // Separate calls: the shared batch seeder deliberately rejects duplicate labels in one call.
  const [own] = await coupleEvents.seed([data.own]);
  const [partner] = await coupleEvents.seed([data.partner]);
  const rows = [
    { id: own.id, ownerId: coupleEvents.userId, eventDate: data.dates[0], isOwn: true },
    { id: partner.id, ownerId: coupleEvents.partnerId, eventDate: data.dates[1], isOwn: false },
  ];
  expect(own.id).not.toBe(partner.id);

  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });

  for (const phase of ['cold load', 'reload'] as const) {
    await log.step(`Verify same-label rows after Settings ${phase}`);
    // Match the upcoming window: the concurrent past window legitimately returns no rows.
    const read = interceptNetworkCall({
      method: 'GET',
      url: '**/rest/v1/events*event_date=gte.*',
    });
    if (phase === 'cold load') await page.goto('/settings');
    else await page.reload();

    const { status, responseJson } = await read;
    expect(status).toBe(200);
    expect(responseJson).toEqual(
      rows.map((row) =>
        expect.objectContaining({
          id: row.id,
          user_id: row.ownerId,
          label: data.label,
          event_date: row.eventDate,
          description: null,
          icon: 'calendar',
        })
      )
    );

    // Network completion precedes store application; include identities and defaults in the wait.
    await recurse(
      () =>
        page.evaluate(() => {
          const state = window.__APP_STORE__?.getState();
          if (!state) return null;
          return {
            userId: state.userId,
            view: state.currentView,
            loading: state.eventsIsLoading,
            error: state.eventsError,
            rows: state.events.map((event) => ({
              id: event.id,
              userId: event.userId,
              label: event.label,
              date: [event.date.getFullYear(), event.date.getMonth() + 1, event.date.getDate()],
              description: event.description,
              icon: event.icon,
            })),
          };
        }),
      (snapshot) => {
        expect(snapshot).toEqual({
          userId: coupleEvents.userId,
          view: 'settings',
          loading: false,
          error: null,
          rows: rows.map((row) => ({
            id: row.id,
            userId: row.ownerId,
            label: data.label,
            date: row.eventDate.split('-').map(Number),
            description: null,
            icon: 'calendar',
          })),
        });
        return true;
      },
      { timeout: 15_000, interval: 250 }
    );

    await expect(page.getByTestId('settings-view')).toBeVisible();
    await expect(page.getByTestId(/^event-row-/)).toHaveCount(2);
    for (const row of rows) {
      await expect(page.getByTestId(`event-row-${row.id}`)).toBeVisible();
      await expect(page.getByTestId(`event-label-${row.id}`)).toHaveText(data.label);
      await expect(page.getByTestId(`event-date-${row.id}`)).toHaveText(
        formatDateLong(localDateFromIso(row.eventDate))
      );
      await expect(page.getByTestId(`event-description-${row.id}`)).toHaveCount(0);
    }
    await expect(page.getByTestId(`event-edit-${own.id}`)).toBeVisible();
    await expect(page.getByTestId(`event-delete-${own.id}`)).toBeVisible();
    await expect(page.getByTestId(`event-partner-note-${own.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`event-edit-${partner.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`event-delete-${partner.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`event-partner-note-${partner.id}`)).toHaveText(
      'Added by your partner'
    );
  }
});
