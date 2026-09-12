import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { interceptNetworkCall } from '@seontechnologies/playwright-utils/intercept-network-call';
import { recurse } from '@seontechnologies/playwright-utils/recurse';
import type { Database } from '../../../../src/types/database.types';
import { eventDateFrom } from '../../../../tests/support/factories/events';

type EventInsert = Database['public']['Tables']['events']['Insert'];
type EventRow = Database['public']['Tables']['events']['Row'];
type SaveResponse = { status: number; row?: EventRow };
type SaveMethod = 'POST' | 'PATCH';

export function makeSaveInput(
  userId: string,
  anchor: Date,
  overrides: Partial<EventInsert> = {}
): EventInsert {
  return {
    user_id: userId,
    label: `DW49 ${faker.string.uuid()}`,
    event_date: eventDateFrom(anchor, 21),
    description: 'Saved event for reconciliation',
    icon: 'calendar',
    ...overrides,
  };
}

/**
 * A project-specific response control: forward a real write, alter only the
 * returned date, and distinguish request arrival from browser completion.
 * Ordinary one-shot stubs cannot prove that an uncertain save committed.
 * The page/context owns route teardown; dispose deactivates this handler and
 * drains operations without removing the shared eventsRefreshControl routes.
 */
async function installSaveControl(page: Page, method: SaveMethod, kind: 'uncertain' | 'transport') {
  const completed = new Map<number, SaveResponse>();
  const operations: Promise<void>[] = [];
  const errors: unknown[] = [];
  let writeCount = 0;
  let selectedCount = 0;
  let active = true;
  const checkErrors = () => {
    if (errors.length) throw new AggregateError(errors, 'DW49 save response control failed');
  };

  const firstArrival = interceptNetworkCall({
    page,
    url: '**/rest/v1/events*',
    // No utility method filter: its nonmatching branch uses route.continue,
    // which would bypass the older GET gate. Explicit fallback preserves it.
    handler: async (route, request) => {
      if (!active || !['POST', 'PATCH'].includes(request.method())) {
        await route.fallback();
        return;
      }
      writeCount += 1;
      if (request.method() !== method) {
        await route.fallback();
        return;
      }
      const attempt = ++selectedCount;
      const operation = (async () => {
        try {
          let result: SaveResponse;
          if (kind === 'transport' && attempt === 1) {
            result = { status: 400 };
            await route.fulfill({
              status: 400,
              contentType: 'application/json',
              json: {
                code: 'TEA_TRANSPORT_FAILURE',
                message: 'TEA deliberate transport failure',
                details: null,
                hint: null,
              },
            });
          } else {
            const response = await route.fetch({ maxRetries: 0 });
            try {
              const status = response.status();
              if (status !== (method === 'POST' ? 201 : 200)) {
                throw new Error(`Expected a committed ${method}, received HTTP ${status}`);
              }
              // playwright-utils deviation: parse route.fetch's real vendor JSON
              // so the commit is preserved while only its response is corrupted.
              const body: EventRow | EventRow[] = await response.json();
              if (method === 'POST' ? Array.isArray(body) : !Array.isArray(body) || body.length !== 1) {
                throw new Error(`Unexpected ${method} events representation`);
              }
              const row = Array.isArray(body) ? body[0] : body;
              if (!row?.id || !row.event_date) throw new Error('Committed event representation missing');
              result = { status, row };
              const delivered = kind === 'uncertain' && attempt === 1
                ? { ...row, event_date: 'not-a-calendar-date' }
                : row;
              await route.fulfill({ response, json: method === 'POST' ? delivered : [delivered] });
            } finally {
              await response.dispose();
            }
          }
          const browserResponse = await request.response();
          if (!browserResponse) throw new Error('Events write has no browser response');
          const failure = await browserResponse.finished();
          if (failure) throw failure;
          completed.set(attempt, result);
        } catch (error) {
          errors.push(error);
        }
      })();
      operations.push(operation);
      await operation;
    },
  });
  void firstArrival.catch((error: unknown) => errors.push(error));

  return {
    writes: () => { checkErrors(); return writeCount; },
    waitForCompleted: async (attempt: number): Promise<SaveResponse> => {
      const result = await recurse(
        async () => { checkErrors(); return completed.get(attempt); },
        (response) => response !== undefined,
        { timeout: 15000, interval: 50, log: `Waiting for events write ${attempt} completion` }
      );
      await firstArrival;
      if (!result) throw new Error('Completed events response missing');
      return result;
    },
    dispose: async () => {
      active = false;
      await Promise.allSettled(operations);
      checkErrors();
    },
  };
}

export async function installUncertainSave(page: Page, method: SaveMethod) {
  const control = await installSaveControl(page, method, 'uncertain');
  return {
    ...control,
    waitForCompleted: async (): Promise<{ status: number; row: EventRow }> => {
      const result = await control.waitForCompleted(1);
      if (!result.row) throw new Error('Uncertain save did not commit an event');
      return { status: result.status, row: result.row };
    },
  };
}

export function installRetryableSave(page: Page) {
  return installSaveControl(page, 'POST', 'transport');
}
