/**
 * DW-53 compatibility at the installed SDK-to-error-mapper boundary.
 *
 * Supabase JS / PostgREST JS 2.112.3 normalizes rejected fetch calls into a
 * status-0 PostgREST-shaped envelope before EventsService receives them.
 * These tests verify that envelope and the real mapper's diagnostics; they do
 * not exercise EventWriteError or claim raw fetch Error identity survives.
 * Public service identity coverage remains in eventsService.test.ts.
 *
 * Source: @supabase/postgrest-js/src/PostgrestBuilder.ts:315-453 and
 * src/api/errorHandlers.ts:55-93. No response schema describes this local SDK
 * failure; assertions cover the specific compatibility fields under test.
 */
import { createClient } from '@supabase/supabase-js';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';
import { createEventTransportFailure } from '../support/factories/event-transport-error';
import { handleSupabaseError, isPostgrestError } from '../../src/api/errorHandlers';
import type { Database } from '../../src/types/database.types';

const SYNTHETIC_URL = 'http://dw53.supabase.invalid';
// These identifiers are request-shape inputs only: the controlled fetch never
// contacts a server, authenticates an account, or creates rows.
const EVENT_ID = '00000000-0000-0000-0000-000000000053';
const USER_ID = '00000000-0000-0000-0000-000000000054';
const TRANSPORT_MESSAGE = 'DW53 API socket closed';

const scenarios = [
  { id: 'DW53-API-001', method: 'POST', operation: 'createEvent' },
  { id: 'DW53-API-002', method: 'PATCH', operation: 'updateEvent' },
  { id: 'DW53-API-003', method: 'DELETE', operation: 'deleteEvent' },
] as const;

test.describe('DW-53 SDK transport-error compatibility', () => {
  // This SDK probe owns its in-memory transport, so no auth session is needed.
  test.use({ authSessionEnabled: false });

  for (const { id, method, operation } of scenarios) {
    test(`[P2] ${id} ${method} retains stack diagnostics through SDK error mapping`, async () => {
      const original = createEventTransportFailure({
        message: TRANSPORT_MESSAGE,
        code: 'ECONNRESET',
      });
      const originalStack = original.stack;
      expect(originalStack).toEqual(expect.any(String));

      const calls: Array<{
        method: string | undefined;
        path: string;
        id: string | null;
        selection: string | null;
      }> = [];
      const client = createClient<Database>(SYNTHETIC_URL, 'synthetic-test-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: {
          // playwright-utils deviation: injected SDK fetch exercises normalization; apiRequest bypasses it.
          fetch: async (input, init) => {
            const url = new URL(String(input));
            calls.push({
              method: init?.method,
              path: url.pathname,
              id: url.searchParams.get('id'),
              selection: url.searchParams.get('select'),
            });
            throw original;
          },
        },
      });

      await log.step(`Reject the installed SDK's ${method} events request`);
      const query =
        method === 'POST'
          ? client
              .from('events')
              .insert({ user_id: USER_ID, label: 'DW53 SDK probe', event_date: '2030-01-01' })
              .select()
              .single()
          : method === 'PATCH'
            ? client.from('events').update({ label: 'DW53 edited' }).eq('id', EVENT_ID).select()
            : client.from('events').delete().eq('id', EVENT_ID).select();
      const result = await query;

      expect(calls).toEqual([
        {
          method,
          path: '/rest/v1/events',
          id: method === 'POST' ? null : `eq.${EVENT_ID}`,
          selection: '*',
        },
      ]);
      expect(result.status).toBe(0);
      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        message: `TypeError: ${TRANSPORT_MESSAGE}`,
        details: originalStack,
        hint: '',
        code: '',
      });
      expect(isPostgrestError(result.error)).toBe(true);
      if (!isPostgrestError(result.error)) {
        throw new Error('The SDK failure no longer reaches the production database-error mapper');
      }

      await log.step('Map the SDK envelope and preserve the existing text and stack diagnostics');
      const mapped = handleSupabaseError(result.error, `EventsService.${operation}`);

      expect(mapped).toMatchObject({
        name: 'SupabaseServiceError',
        message: `[EventsService.${operation}] Database error: TypeError: ${TRANSPORT_MESSAGE}`,
        code: '',
        details: originalStack,
        hint: '',
        isNetworkError: false,
      });
    });
  }
});
