/**
 * photoService.getPhotos -- a failed read must not look like an empty album.
 *
 * It used to answer [] for every failure, so the gallery's "load more" read a
 * dead network as the last page ("You've reached the end of your memories")
 * and its load-error card and retry row could never render (DW-179).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  result: { data: [] as unknown[] | null, error: null as { message: string } | null },
}));

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: backend.user } }) },
    from: () => ({
      select: () => ({
        order: () => ({
          range: async () => backend.result,
        }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: `https://example.test/${path}` })),
          error: null,
        }),
      }),
    },
  },
}));

import { photoService } from '@/services/photoService';

beforeEach(() => {
  backend.user = { id: 'user-1' };
  backend.result = { data: [], error: null };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('photoService.getPhotos', () => {
  it('rejects when the query fails', async () => {
    backend.result = { data: null, error: { message: 'network down' } };
    await expect(photoService.getPhotos(20, 20)).rejects.toThrow();
  });

  it('rejects when there is no signed-in user', async () => {
    backend.user = null;
    await expect(photoService.getPhotos()).rejects.toThrow('Not authenticated');
  });

  it('still resolves [] for a genuinely empty page', async () => {
    await expect(photoService.getPhotos(20, 40)).resolves.toEqual([]);
  });
});
