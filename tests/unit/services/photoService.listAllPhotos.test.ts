/**
 * photoService.listAllPhotos / downloadPhoto (spec-unified-data-storage story 10).
 *
 * `listAllPhotos` pages the server 500 rows at a time until a short page and
 * returns every row, newest first, unsigned. A failed page rejects the whole
 * read: the store replaces its list and copy with the answer, so a partial
 * list would look like photos deleted on the server (and a failure must never
 * look like an empty album, DW-179).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown[] | null; error: { message: string } | null };

const backend = vi.hoisted(() => ({
  pages: [] as Result[],
  ranges: [] as Array<[number, number]>,
  orders: [] as Array<[string, { ascending: boolean }]>,
  download: { data: null as Blob | null, error: null as { message: string } | null },
  downloads: [] as string[],
  session: { access_token: 'token' } as object | null,
}));

vi.mock('@/api/supabaseClient', () => {
  const query = {
    select: () => query,
    order: (column: string, options: { ascending: boolean }) => {
      backend.orders.push([column, options]);
      return query;
    },
    range: async (from: number, to: number) => {
      backend.ranges.push([from, to]);
      return backend.pages.shift() ?? { data: [], error: null };
    },
  };
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: backend.session } }) },
      from: () => query,
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

function rows(count: number, from = 0) {
  return Array.from({ length: count }, (_, i) => ({ id: `photo-${from + i}` }));
}

beforeEach(() => {
  backend.pages = [];
  backend.ranges = [];
  backend.orders = [];
  backend.download = { data: null, error: null };
  backend.downloads = [];
  backend.session = { access_token: 'token' };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('photoService.listAllPhotos', () => {
  it('pages 500 rows at a time until a short page and returns every row', async () => {
    backend.pages = [
      { data: rows(500), error: null },
      { data: rows(500, 500), error: null },
      { data: rows(3, 1000), error: null },
    ];

    const all = await photoService.listAllPhotos();

    expect(all).toHaveLength(1003);
    expect(all[0]).toEqual({ id: 'photo-0' });
    expect(all[1002]).toEqual({ id: 'photo-1002' });
    expect(backend.ranges).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
  });

  it('orders newest created_at first, ties by id', async () => {
    backend.pages = [{ data: rows(1), error: null }];
    await photoService.listAllPhotos();
    expect(backend.orders).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
  });

  it('asks for one more page after an exactly full one, and stops on the empty page', async () => {
    backend.pages = [
      { data: rows(500), error: null },
      { data: [], error: null },
    ];
    await expect(photoService.listAllPhotos()).resolves.toHaveLength(500);
    expect(backend.ranges).toHaveLength(2);
  });

  it('resolves [] for a genuinely empty album', async () => {
    await expect(photoService.listAllPhotos()).resolves.toEqual([]);
  });

  it('rejects with no session, without asking the server as anon', async () => {
    backend.session = null;
    await expect(photoService.listAllPhotos()).rejects.toThrow('Not authenticated');
    expect(backend.ranges).toEqual([]);
  });

  it('rejects when any page fails, never answering a partial list', async () => {
    backend.pages = [
      { data: rows(500), error: null },
      { data: null, error: { message: 'network down' } },
    ];
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
