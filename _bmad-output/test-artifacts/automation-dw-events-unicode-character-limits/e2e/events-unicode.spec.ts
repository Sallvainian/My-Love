/** Unicode character limits through the real Settings form and local PostgREST. */
import type { Page, Request, TestType } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../../../tests/support/merged-fixtures';
import { eventDateFrom } from '../../../../tests/support/factories/events';
import {
  EventRowSchema, EventRowsSchema, mixedUnicodeEvent, padForForm, unicodeCases,
  type EventRow,
} from '../support/unicode-events';

type TestFixtures = typeof test extends TestType<infer T, infer W> ? T & W : never;
type Recurse = TestFixtures['recurse'];
type EventText = { label: string; description: string };
type BrowserTools = { page: Page; interceptNetworkCall: InterceptNetworkCallFn; recurse: Recurse };
const EVENTS_URL = '**/rest/v1/events*';

async function openSettings({ page, interceptNetworkCall, recurse }: BrowserTools) {
  const read = interceptNetworkCall({ method: 'GET', url: EVENTS_URL });
  await page.goto('/settings');
  expect((await read).status).toBe(200);
  await recurse(
    () => page.evaluate(() => {
      const state = window.__APP_STORE__!.getState();
      return !state.eventsIsLoading && state.eventsPagination !== null;
    }),
    (ready) => ready,
    { timeout: 15000, interval: 50, log: 'Wait for the initial events snapshot' }
  );
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await expect(page.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'false');
}

async function fillText(page: Page, text: EventText) {
  await page.getByTestId('events-form-label').fill(padForForm(text.label));
  await page.getByTestId('events-form-description').fill(padForForm(text.description));
  // Browser-entered values must retain every code point before trimming on submit.
  await expect(page.getByTestId('events-form-label')).toHaveValue(padForForm(text.label));
  await expect(page.getByTestId('events-form-description')).toHaveValue(padForForm(text.description));
}

async function expectStoreAndRow(page: Page, recurse: Recurse, row: EventRow) {
  const saved = await recurse(
    () => page.evaluate((id) => {
      const event = window.__APP_STORE__!.getState().events.find((item) => item.id === id);
      return event ? { id: event.id, label: event.label, description: event.description } : null;
    }, row.id),
    (event) => event?.label === row.label && event.description === row.description,
    { timeout: 15000, interval: 50, log: 'Wait for the saved Unicode text in Zustand' }
  );
  expect(saved).toEqual({ id: row.id, label: row.label, description: row.description });
  await expect(page.getByTestId(`event-label-${row.id}`)).toHaveText(row.label);
  await expect(page.getByTestId(`event-description-${row.id}`)).toHaveText(row.description!);
}

async function submitEvent(
  { page, interceptNetworkCall, recurse }: BrowserTools,
  method: 'POST' | 'PATCH',
  expected: EventText & { userId: string; date: string; id?: string }
): Promise<EventRow> {
  const write = interceptNetworkCall({ method, url: EVENTS_URL });
  await page.getByTestId('events-form-submit').click();
  const result = await write;
  expect(result.status).toBe(method === 'POST' ? 201 : 200);
  const rows = method === 'POST'
    ? [EventRowSchema.parse(result.responseJson)]
    : EventRowsSchema.parse(result.responseJson);
  expect(rows).toHaveLength(1);
  const row = rows[0]!;
  const textPayload = {
    label: expected.label, description: expected.description,
    event_date: expected.date, icon: 'calendar',
  };
  expect(result.requestJson).toEqual(method === 'POST'
    ? { user_id: expected.userId, ...textPayload }
    : { ...textPayload, updated_at: expect.any(String) });
  expect(row).toMatchObject({ user_id: expected.userId, ...textPayload });
  if (method === 'PATCH') {
    expect(row.id).toBe(expected.id);
    expect(result.request).not.toBeNull();
    expect(new URL(result.request!.url()).searchParams.get('id')).toBe(`eq.${expected.id}`);
  }
  // Required order: server response, Zustand settlement, rendered row.
  await expectStoreAndRow(page, recurse, row);
  await expect(page.getByTestId('events-form')).toHaveCount(0);
  return row;
}

async function reloadAndOpenEdit(tools: BrowserTools, row: EventRow) {
  const { page, interceptNetworkCall, recurse } = tools;
  const read = interceptNetworkCall({ method: 'GET', url: EVENTS_URL });
  await page.reload();
  expect((await read).status).toBe(200);
  await expectStoreAndRow(page, recurse, row);
  await page.getByTestId(`event-edit-${row.id}`).click();
  await expect(page.getByTestId('events-form-label')).toHaveValue(row.label);
  await expect(page.getByTestId('events-form-description')).toHaveValue(row.description!);
}

function observeEventWrites(page: Page) {
  const methods: string[] = [];
  const listener = (request: Request) => {
    if (new URL(request.url()).pathname === '/rest/v1/events' &&
      ['POST', 'PATCH', 'DELETE'].includes(request.method())) methods.push(request.method());
  };
  // playwright-utils deviation: its single-call interceptor cannot count zero writes across a validation boundary without a timeout; the corrected save is the positive control.
  page.on('request', listener);
  return { methods, stop: () => page.off('request', listener) };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lastWelcomeView', Date.now().toString()));
});

test.describe('Unicode event character limits', () => {
  for (const [index, initial] of unicodeCases.entries()) {
    const edited = unicodeCases.find((candidate) => candidate.key !== initial.key)!;
    test(`[P1] DW83-E2E-00${index + 1} add ${initial.key} then edit ${edited.key} at both limits`, async ({
      page, coupleEvents, interceptNetworkCall, recurse,
    }) => {
      const tools = { page, interceptNetworkCall, recurse };
      const date = eventDateFrom(coupleEvents.anchor, 30);
      await log.step('Given an empty event list and padded Unicode text at both limits');
      await openSettings(tools);
      await expect(page.getByTestId('events-settings-empty')).toBeVisible();
      await page.getByTestId('events-settings-add').click();
      await fillText(page, initial.atLimit);
      await page.getByTestId('events-form-date').fill(date);

      await log.step('When Add persists the exact trimmed text, then reload restores its edit values');
      const created = await submitEvent(tools, 'POST', {
        ...initial.atLimit, userId: coupleEvents.userId, date,
      });
      await reloadAndOpenEdit(tools, created);

      await log.step('When Edit uses the other Unicode form, then another reload preserves every code point');
      await fillText(page, edited.atLimit);
      const updated = await submitEvent(tools, 'PATCH', {
        ...edited.atLimit, userId: coupleEvents.userId, date, id: created.id,
      });
      await reloadAndOpenEdit(tools, updated);
      await page.getByTestId('events-form-cancel').click();
    });
  }

  for (const mode of ['add', 'edit'] as const) {
    for (const [fieldIndex, field] of (['label', 'description'] as const).entries()) {
      const sample = unicodeCases.find((candidate) => candidate.key === (mode === 'add' ? 'emoji' : 'decomposed'))!;
      const caseId = (mode === 'add' ? 3 : 5) + fieldIndex;
      test(`[P1] DW83-E2E-00${caseId} ${mode} rejects ${sample.key} ${field} above its limit and saves a correction`, async ({
        page, coupleEvents, authToken, apiRequest, interceptNetworkCall, recurse,
      }) => {
        const tools = { page, interceptNetworkCall, recurse };
        const date = eventDateFrom(coupleEvents.anchor, 30);
        const original = { label: 'Unicode original event', description: 'Original description' };
        const seeded = mode === 'edit'
          ? (await coupleEvents.seed([{ ...original, dayOffset: 30 }]))[0]!
          : null;
        const readPersisted = () => apiRequest<EventRow[]>({
          method: 'GET', baseUrl: process.env.SUPABASE_URL,
          path: `/rest/v1/events?select=*&user_id=eq.${coupleEvents.userId}`,
          headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
        }).validateSchema<EventRow[]>(EventRowsSchema);
        const baseline = await readPersisted();
        expect(baseline.status).toBe(200);
        expect(baseline.body).toHaveLength(mode === 'edit' ? 1 : 0);

        await log.step(`Given a ${mode} form with a ${field} exactly one code point over its limit`);
        await openSettings(tools);
        if (seeded) await page.getByTestId(`event-edit-${seeded.id}`).click();
        else await page.getByTestId('events-settings-add').click();
        await fillText(page, { ...sample.atLimit, [field]: sample.overLimit[field] });
        await page.getByTestId('events-form-date').fill(date);
        const observed = observeEventWrites(page);
        try {
          await log.step('When submitted, then the field error appears without a write or persisted change');
          await page.getByTestId('events-form-submit').click();
          const error = page.getByTestId(`events-form-${field}-error`);
          const input = page.getByTestId(`events-form-${field}`);
          await expect(error).toHaveText(field === 'label'
            ? 'Label must be 100 characters or fewer'
            : 'Description must be 500 characters or fewer');
          await expect(input).toHaveAttribute('aria-invalid', 'true');
          await expect(input).toHaveAttribute('aria-describedby', `events-form-${field}-error`);
          await expect(input).toHaveValue(padForForm(sample.overLimit[field]));
          await expect(page.getByTestId('events-form')).toBeVisible();
          await expect(page.getByTestId('events-form-submit')).toBeEnabled();
          const unchanged = await readPersisted();
          expect(unchanged.status).toBe(200);
          expect(unchanged.body).toEqual(baseline.body);
          const stored = await page.evaluate(() => window.__APP_STORE__!.getState().events.map((event) => ({
            id: event.id, label: event.label, description: event.description,
          })));
          expect(stored).toEqual(seeded ? [{ id: seeded.id, ...original }] : []);
          expect(observed.methods).toEqual([]);

          await log.step('When corrected to the limit, then the error clears and one real save succeeds');
          await input.fill(padForForm(sample.atLimit[field]));
          await expect(input).toHaveValue(padForForm(sample.atLimit[field]));
          await expect(error).toHaveCount(0);
          await expect(input).toHaveAttribute('aria-invalid', 'false');
          await expect(input).not.toHaveAttribute('aria-describedby', `events-form-${field}-error`);
          expect(observed.methods).toEqual([]);
          const method = mode === 'add' ? 'POST' : 'PATCH';
          const saved = await submitEvent(tools, method, {
            ...sample.atLimit, date, userId: coupleEvents.userId, id: seeded?.id,
          });
          expect(observed.methods).toEqual([method]);
          const persisted = await readPersisted();
          expect(persisted.status).toBe(200);
          expect(persisted.body).toEqual([saved]);
        } finally {
          observed.stop();
        }
      });
    }
  }

  test('[P2] DW83-E2E-007 mixed ASCII, emoji, combining marks and ZWJ survive Add and reload', async ({
    page, coupleEvents, interceptNetworkCall, recurse,
  }) => {
    const tools = { page, interceptNetworkCall, recurse };
    await log.step('Given mixed Unicode strings at both character limits');
    await openSettings(tools);
    await page.getByTestId('events-settings-add').click();
    await fillText(page, mixedUnicodeEvent);
    const date = eventDateFrom(coupleEvents.anchor, 30);
    await page.getByTestId('events-form-date').fill(date);
    await log.step('When Add completes, then reload and edit prefill preserve the exact text');
    const created = await submitEvent(tools, 'POST', {
      ...mixedUnicodeEvent, userId: coupleEvents.userId, date,
    });
    await reloadAndOpenEdit(tools, created);
    await page.getByTestId('events-form-cancel').click();
  });
});
