/**
 * P1 API: the photo list's keyset paging, against the real server
 *
 * `photoService.listAllPhotos` reads the whole album in pages ordered
 * `created_at desc, id desc`, each page keyed on the last row of the previous
 * one with a PostgREST `or` filter:
 *
 *   created_at.lt."<ts>",and(created_at.eq."<ts>",id.lt."<id>")
 *
 * `tests/unit/services/photoService.listAllPhotos.test.ts` pins that the
 * service BUILDS that filter, but its fake parses the filter itself, so it
 * cannot say whether PostgREST reads it the same way: the timestamp PostgREST
 * returns carries `.`, `:` and a `+00:00` offset, all of which a logic tree
 * can trip on. This file sends the same filter, through the same client, to
 * the running local PostgREST under a real user's JWT.
 *
 * The chain below mirrors `src/services/photoService.ts:listAllPhotos` rather
 * than importing it: `src/api/supabaseClient.ts` reads `import.meta.env`,
 * which has no value under the Playwright runner. The one deliberate addition
 * is a `storage_path` prefix filter, so only this spec's rows are paged and a
 * photo another spec gave this worker's account cannot shift the pages.
 *
 * ## Cleanup
 *
 * Only rows this spec inserts, found by their unique `storage_path` prefix, are
 * deleted, before and after each test. Both are this worker's own account.
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from '../support/merged-fixtures';
import type { Database } from '../../src/types/database.types';
import type { TypedSupabaseClient } from '../support/factories';
import { createCheckWritePayload } from '../support/factories/check-write-payloads';
import { resolveWorkerPairIds } from '../support/factories/events';

type PhotoInsert = Database['public']['Tables']['photos']['Insert'];

type PhotoRow = { id: string; created_at: string };

const PAGE_SIZE = 2;

/** The service's keyset filter, verbatim. */
function photosAfter(last: PhotoRow): string {
  const at = `"${last.created_at}"`;
  const id = `"${last.id}"`;
  return `created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`;
}

/** Page through this spec's rows exactly as `listAllPhotos` pages the album. */
async function readAllByKeyset(
  client: TypedSupabaseClient,
  prefix: string,
  afterPage: (page: number) => Promise<void> = async () => {}
): Promise<{ rows: PhotoRow[]; filters: string[] }> {
  const rows: PhotoRow[] = [];
  const filters: string[] = [];
  let last: PhotoRow | undefined;
  for (let page = 0; ; page++) {
    let query = client.from('photos').select('id, created_at').like('storage_path', `${prefix}%`);
    if (last) {
      filters.push(photosAfter(last));
      query = query.or(photosAfter(last));
    }
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) throw new Error(`page ${page} failed: ${error.message}`);

    const got = data ?? [];
    rows.push(...got);
    await afterPage(page);
    if (got.length < PAGE_SIZE) break;
    last = got[got.length - 1];
  }
  return { rows, filters };
}

/** The same rows in one unpaged read: the order the pages must reproduce. */
async function readAllAtOnce(client: TypedSupabaseClient, prefix: string): Promise<PhotoRow[]> {
  const { data, error } = await client
    .from('photos')
    .select('id, created_at')
    .like('storage_path', `${prefix}%`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw new Error(`unpaged read failed: ${error.message}`);
  return data ?? [];
}

// Ties (two at 02.5, three at 01 exactly), microseconds, and a whole second
// with no fraction: every shape PostgREST's timestamp output takes.
const CREATED_AT = [
  '2026-01-01T00:00:03.123456+00:00',
  '2026-01-01T00:00:02.5+00:00',
  '2026-01-01T00:00:02.5+00:00',
  '2026-01-01T00:00:01+00:00',
  '2026-01-01T00:00:01+00:00',
  '2026-01-01T00:00:01+00:00',
  '2026-01-01T00:00:00.000001+00:00',
];

test.describe('The photo list keyset paging', () => {
  let prefix: string;

  test.beforeEach(async ({ supabaseAdmin, supabaseAsUser }) => {
    const { userId, partnerId } = await resolveWorkerPairIds(supabaseAdmin);
    prefix = `${userId}/keyset-paging-`;
    await supabaseAdmin.from('photos').delete().like('storage_path', `${prefix}%`);

    const { error } = await supabaseAsUser.from('photos').insert(
      CREATED_AT.map(
        (createdAt) =>
          createCheckWritePayload('photos', userId, partnerId, {
            storage_path: `${prefix}${randomUUID()}.jpg`,
            filename: 'keyset.jpg',
            file_size: 1,
            created_at: createdAt,
          } satisfies Partial<PhotoInsert>) as PhotoInsert
      )
    );
    if (error) throw new Error(`seed failed: ${error.message}`);
  });

  test.afterEach(async ({ supabaseAdmin }) => {
    await supabaseAdmin.from('photos').delete().like('storage_path', `${prefix}%`);
  });

  test('[P1] pages through ties and real timestamps without skipping or repeating a row', async ({
    supabaseAsUser,
  }) => {
    const expected = await readAllAtOnce(supabaseAsUser, prefix);
    expect(expected).toHaveLength(CREATED_AT.length);
    // The premise the filter's quoting exists for: PostgREST answers with an
    // explicit offset and a variable-length fraction.
    expect(expected[0].created_at).toBe('2026-01-01T00:00:03.123456+00:00');
    expect(expected[3].created_at).toBe('2026-01-01T00:00:01+00:00');

    const { rows, filters } = await readAllByKeyset(supabaseAsUser, prefix);

    expect(rows.map((r) => r.id)).toEqual(expected.map((r) => r.id));
    // Page boundaries fell inside both ties (after rows 2 and 4).
    expect(filters).toHaveLength(3);
  });

  test('[P1] skips no row when one is deleted between two page reads', async ({
    supabaseAsUser,
  }) => {
    const expected = await readAllAtOnce(supabaseAsUser, prefix);

    const { rows } = await readAllByKeyset(supabaseAsUser, prefix, async (page) => {
      if (page !== 0) return;
      // The first page's newest row goes, as if deleted on another device.
      const { error } = await supabaseAsUser.from('photos').delete().eq('id', expected[0].id);
      if (error) throw new Error(`delete failed: ${error.message}`);
    });

    // Offset paging would start page two one row late and lose expected[2].
    expect(rows.map((r) => r.id)).toEqual(expected.map((r) => r.id));
  });
});
