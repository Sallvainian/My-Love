/**
 * DW-39 API boundary: controlled HTTP failures parsed by the installed SDK.
 *
 * These tests join SDK parsing to the production classifier and converter.
 * They do not call EventsService or prove what a live PostgREST server sends.
 * The 84 direct unit cases retain ownership of the full message/code matrix.
 * No response schema covers malformed errors; assertions cover the fields under test.
 */
import { createClient } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';
import {
  createDatabaseErrorEnvelope,
  type DatabaseErrorEnvelope,
} from '../support/factories/database-error-envelope';
import { handleSupabaseError, isPostgrestError } from '../../src/api/errorHandlers';
import type { Database } from '../../src/types/database.types';

/** Each invocation owns its client and in-memory response; no account or row is created. */
async function parseRejectedInsert(envelope: DatabaseErrorEnvelope): Promise<PostgrestError> {
  const calls: Array<{ url: string; method: string | undefined }> = [];
  const client = createClient<Database>('http://dw39.supabase.invalid', 'synthetic-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // playwright-utils deviation: SDK fetch injection exercises its parser; apiRequest bypasses that boundary.
      fetch: async (input, init) => {
        calls.push({ url: String(input), method: init?.method });
        return new Response(JSON.stringify(envelope), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });

  await log.step('Parse the controlled events INSERT rejection through the installed SDK');
  const result = await client
    .from('events')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000039',
      label: 'DW39 SDK probe',
      event_date: '2030-01-01',
    })
    .select()
    .single();

  expect(calls).toEqual([
    { url: 'http://dw39.supabase.invalid/rest/v1/events?select=*', method: 'POST' },
  ]);
  expect(result.status).toBe(400);
  expect(result.data).toBeNull();
  expect(result.error).toEqual(envelope);
  expect(isPostgrestError(result.error)).toBe(true);
  if (!isPostgrestError(result.error)) {
    throw new Error('The SDK rejection no longer reaches the database-error converter');
  }
  return result.error;
}

test.describe('DW-39 empty database error fallback through SDK parsing', () => {
  // The transport is entirely in memory, so no real authentication is needed.
  test.use({ authSessionEnabled: false });

  test('[P1] DW39-API-001 a null message produces a contextual database fallback', async () => {
    const error = await parseRejectedInsert(
      createDatabaseErrorEnvelope({
        message: null,
        details: 'Original diagnostic details',
        hint: 'Original diagnostic hint',
      })
    );

    const mapped = handleSupabaseError(error, 'EventsService.createEvent');

    expect(mapped.message).toBe(
      '[EventsService.createEvent] Database error: An unknown database error occurred'
    );
    expect(mapped).toMatchObject({
      name: 'SupabaseServiceError',
      code: 'XX000',
      details: 'Original diagnostic details',
      hint: 'Original diagnostic hint',
      isNetworkError: false,
    });
  });

  test('[P1] DW39-API-002 Unicode whitespace uses the fallback and retains null diagnostics', async () => {
    const error = await parseRejectedInsert(
      createDatabaseErrorEnvelope({ message: '\u00a0\u2003\t\n' })
    );

    const mapped = handleSupabaseError(error);

    expect(mapped.message).toBe('Database error: An unknown database error occurred');
    expect(mapped).toMatchObject({
      name: 'SupabaseServiceError',
      code: 'XX000',
      details: null,
      hint: null,
      isNetworkError: false,
    });
  });

  test('[P2] DW39-API-003 CHECK mapping takes precedence over an empty SDK message', async () => {
    const error = await parseRejectedInsert(
      createDatabaseErrorEnvelope({ code: '23514', message: '' })
    );

    const mapped = handleSupabaseError(error, 'EventsService.createEvent');

    expect(mapped.message).toBe(
      '[EventsService.createEvent] Some values are not allowed - check length and format limits'
    );
    expect(mapped.code).toBe('23514');
    expect(mapped.isNetworkError).toBe(false);
  });

  test('[P2] DW39-API-004 meaningful message whitespace survives SDK parsing and conversion', async () => {
    const error = await parseRejectedInsert(
      createDatabaseErrorEnvelope({ message: '  Injected create failure \n' })
    );

    const mapped = handleSupabaseError(error, 'EventsService.createEvent');

    expect(mapped.message).toBe(
      '[EventsService.createEvent] Database error:   Injected create failure \n'
    );
    expect(mapped.code).toBe('XX000');
    expect(mapped.isNetworkError).toBe(false);
  });

  test('[P2] DW39-API-005 a numeric SDK message retains compatibility without throwing', async () => {
    const error = await parseRejectedInsert(createDatabaseErrorEnvelope({ message: 42 }));

    const mapped = handleSupabaseError(error, 'EventsService.createEvent');

    expect(mapped.message).toBe('[EventsService.createEvent] Database error: 42');
    expect(mapped.code).toBe('XX000');
    expect(mapped.isNetworkError).toBe(false);
  });
});
