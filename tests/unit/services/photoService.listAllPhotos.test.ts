/**
 * photoService.listAllPhotos / downloadPhoto (spec-unified-data-storage story 10).
 *
 * `listAllPhotos` pages the server 500 rows at a time until a short page and
 * returns every row, newest first, unsigned. Each page is keyed on the last
 * row of the previous one, so a delete or insert between two page reads
 * neither skips nor repeats a photo. A failed page rejects the whole
 * read: the store replaces its list and copy with the answer, so a partial
 * list would look like photos deleted on the server (and a failure must never
 * look like an empty album, DW-179).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; created_at: string };
type Failure = { message: string };

/**
 * A tiny in-memory `photos` table behind the client's query builder. It keeps
 * rows sorted the way the service orders them, and answers `.or()` keyset
 * cursors and `.range()` offsets alike, so a test can change the table between
 * two page reads and see what the service's paging makes of it.
 */
const backend = vi.hoisted(() => ({
  table: [] as Array<{ id: string; created_at: string }>,
  /** Runs after each page is answered, with its 0-based number. */
  afterPage: (() => {}) as (page: number) => void,
  failPage: null as null | { page: number; error: { message: string } },
  requests: [] as Array<{
    or: string | null;
    orders: Array<[string, { ascending: boolean }]>;
    limit: number | null;
    range: [number, number] | null;
  }>,
  download: { data: null as Blob | null, error: null as { message: string } | null },
  downloads: [] as string[],
  session: { access_token: 'token' } as object | null,
}));

vi.mock('@/api/supabaseClient', () => {
  const CURSOR =
    /^created_at\.lt\."([^"]+)",and\(created_at\.eq\."([^"]+)",id\.lt\."([^"]+)"\)$/;

  function newest(a: Row, b: Row) {
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  }

  function execute(request: (typeof backend.requests)[number]) {
    const page = backend.requests.length - 1;
    if (backend.failPage?.page === page) return { data: null, error: backend.failPage.error };
    let rows = [...backend.table].sort(newest);
    if (request.or !== null) {
      const cursor = CURSOR.exec(request.or);
      if (!cursor || cursor[1] !== cursor[2]) throw new Error(`unexpected or(): ${request.or}`);
      const [, at, , id] = cursor;
      rows = rows.filter((r) => r.created_at < at || (r.created_at === at && r.id < id));
    }
    if (request.range) rows = rows.slice(request.range[0], request.range[1] + 1);
    if (request.limit !== null) rows = rows.slice(0, request.limit);
    const data = rows.map((r) => ({ ...r }));
    backend.afterPage(page);
    return { data, error: null as Failure | null };
  }

  function query() {
    const request = {
      or: null as string | null,
      orders: [] as Array<[string, { ascending: boolean }]>,
      limit: null as number | null,
      range: null as [number, number] | null,
    };
    const builder = {
      select: () => builder,
      or: (filter: string) => {
        request.or = filter;
        return builder;
      },
      order: (column: string, options: { ascending: boolean }) => {
        request.orders.push([column, options]);
        return builder;
      },
      limit: (count: number) => {
        request.limit = count;
        return builder;
      },
      range: (from: number, to: number) => {
        request.range = [from, to];
        return builder;
      },
      then: (
        resolve: (value: { data: Row[] | null; error: Failure | null }) => unknown,
        reject: (reason: unknown) => unknown
      ) => {
        backend.requests.push(request);
        try {
          return Promise.resolve(resolve(execute(request)));
        } catch (error) {
          return Promise.resolve(reject(error));
        }
      },
    };
    return builder;
  }

  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: backend.session } }) },
      from: () => query(),
      storage: {
        from: () => ({
          download: async (path: string) => {
            backend.downloads.push(path);
            return backend.download;
          },
        }),
      },
    },
  };
});

import { photoService } from '@/services/photoService';

/**
 * `count` rows, newest first, in the timestamp format PostgREST returns
 * (`+00:00`, trailing fractional zeros dropped). Rows share `created_at` in
 * pairs (1-2, 3-4, ... 499-500, ...), so a tie straddles each page boundary
 * and only `id` orders it.
 */
function seed(count: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    const pair = Math.floor((i + 1) / 2);
    const second = String(59 - (pair % 60)).padStart(2, '0');
    const minute = String(59 - Math.floor(pair / 60)).padStart(2, '0');
    rows.push({
      id: `photo-${String(9999 - i).padStart(4, '0')}`,
      created_at: `2026-09-24T10:${minute}:${second}.12345+00:00`,
    });
  }
  backend.table = [...rows];
  return rows;
}

const ids = (rows: Row[]) => rows.map((r) => r.id);

beforeEach(() => {
  backend.table = [];
  backend.afterPage = () => {};
  backend.failPage = null;
  backend.requests = [];
  backend.download = { data: null, error: null };
  backend.downloads = [];
  backend.session = { access_token: 'token' };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('photoService.listAllPhotos', () => {
  it('pages 500 rows at a time until a short page and returns every row', async () => {
    const rows = seed(1003);

    const all = await photoService.listAllPhotos();

    expect(ids(all)).toEqual(ids(rows));
    expect(backend.requests.map((r) => r.limit)).toEqual([500, 500, 500]);
  });

  it('orders newest created_at first, ties by id', async () => {
    seed(1);
    await photoService.listAllPhotos();
    expect(backend.requests[0].orders).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
  });

  it('keys each page on the last row of the previous one, with quoted values', async () => {
    const rows = seed(1003);

    await photoService.listAllPhotos();

    expect(backend.requests.map((r) => r.range)).toEqual([null, null, null]);
    expect(backend.requests[0].or).toBeNull();
    for (const [page, lastRow] of [
      [1, rows[499]],
      [2, rows[999]],
    ] as const) {
      expect(backend.requests[page].or).toBe(
        `created_at.lt."${lastRow.created_at}",` +
          `and(created_at.eq."${lastRow.created_at}",id.lt."${lastRow.id}")`
      );
    }
  });

  it('skips no photo when a photo is deleted between two page reads', async () => {
    const rows = seed(1003);
    const deleted = rows[10];
    backend.afterPage = (page) => {
      if (page === 0) backend.table = backend.table.filter((r) => r.id !== deleted.id);
    };

    const all = await photoService.listAllPhotos();

    // The deleted photo was read before its delete; every other row is here,
    // once, in order. Offset paging lost rows[500] here.
    expect(ids(all)).toEqual(ids(rows));
  });

  it('repeats no photo when a photo is added between two page reads', async () => {
    const rows = seed(1003);
    backend.afterPage = (page) => {
      if (page === 0) {
        backend.table.push({ id: 'photo-new', created_at: '2026-09-24T11:00:00+00:00' });
      }
    };

    const all = await photoService.listAllPhotos();

    // The new photo is newer than every page after the first, so this read
    // misses it (the next refresh has it); no row appears twice.
    expect(new Set(ids(all)).size).toBe(all.length);
    expect(ids(all)).toEqual(ids(rows));
  });

  it('asks for one more page after an exactly full one, and stops on the empty page', async () => {
    seed(500);
    await expect(photoService.listAllPhotos()).resolves.toHaveLength(500);
    expect(backend.requests).toHaveLength(2);
  });

  it('resolves [] for a genuinely empty album', async () => {
    await expect(photoService.listAllPhotos()).resolves.toEqual([]);
  });

  it('rejects with no session, without asking the server as anon', async () => {
    backend.session = null;
    await expect(photoService.listAllPhotos()).rejects.toThrow('Not authenticated');
    expect(backend.requests).toEqual([]);
  });

  it('rejects when any page fails, never answering a partial list', async () => {
    seed(1003);
    backend.failPage = { page: 1, error: { message: 'network down' } };
    await expect(photoService.listAllPhotos()).rejects.toThrow('network down');
  });
});

describe('photoService.downloadPhoto', () => {
  it('downloads the image Blob by storage path', async () => {
    const blob = new Blob(['IMAGE']);
    backend.download = { data: blob, error: null };
    await expect(photoService.downloadPhoto('owner/photo.jpg')).resolves.toBe(blob);
    expect(backend.downloads).toEqual(['owner/photo.jpg']);
  });

  it('throws when the download fails', async () => {
    backend.download = { data: null, error: { message: 'Failed to fetch' } };
    await expect(photoService.downloadPhoto('owner/photo.jpg')).rejects.toThrow('Failed to fetch');
  });
});
