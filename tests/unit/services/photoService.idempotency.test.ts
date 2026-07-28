/**
 * photoService.uploadPhoto — a retried upload must not duplicate the photo
 *
 * Vector: the storage upload and the photos insert both succeed server-side but
 * the response is lost. The UI shows Retry; the retry used to mint a fresh
 * crypto.randomUUID() storage path, so the same picture landed in the shared
 * gallery twice, both copies counting against the 1GB quota.
 *
 * No test file referenced photoService before this one -- `uploadPhoto` had
 * zero hits anywhere in the suite, and the two photo E2E specs only open the
 * modal and accept a file, never driving handleRetry.
 *
 * The fake models the real constraint: photos.storage_path is UNIQUE, so a
 * stable path is what makes the retry resolve instead of duplicating. No
 * migration was needed for this fix.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface PhotoRow {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  caption: string | null;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
}

const USER_ID = '00000000-0000-4000-8000-0000000000c0';

const backend = {
  rows: [] as PhotoRow[],
  objects: new Map<string, { size: number }>(),
  seq: 0,
  reset() {
    this.rows = [];
    this.objects = new Map();
    this.seq = 0;
  },
};

function photosQuery() {
  const filters: Array<{ column: string; value: unknown }> = [];
  let pending: PhotoRow | null = null;

  const api = {
    upsert(values: Omit<PhotoRow, 'id'>, options?: { ignoreDuplicates?: boolean }) {
      const clash = backend.rows.find((r) => r.storage_path === values.storage_path);
      if (clash) {
        if (!options?.ignoreDuplicates) throw new Error('expected ignoreDuplicates');
        pending = null; // ON CONFLICT DO NOTHING
      } else {
        pending = { ...values, id: `photo-${++backend.seq}` };
        backend.rows.push(pending);
      }
      return api;
    },
    select: () => api,
    eq(column: string, value: unknown) {
      filters.push({ column, value });
      return api;
    },
    async maybeSingle() {
      return { data: pending, error: null };
    },
    async single() {
      const match = backend.rows.find((r) =>
        filters.every((f) => (r as unknown as Record<string, unknown>)[f.column] === f.value)
      );
      if (!match) return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
      return { data: match, error: null };
    },
  };
  return api;
}

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
    from: (table: string) => {
      if (table !== 'photos') throw new Error(`unmodelled table ${table}`);
      return photosQuery();
    },
    storage: {
      from: () => ({
        async upload(path: string, file: Blob, options?: { upsert?: boolean }) {
          if (backend.objects.has(path) && !options?.upsert) {
            return { error: { message: 'The resource already exists', statusCode: '409' } };
          }
          backend.objects.set(path, { size: file.size });
          return { error: null };
        },
        async remove(paths: string[]) {
          paths.forEach((p) => backend.objects.delete(p));
          return { error: null };
        },
        async list() {
          return { data: [], error: null };
        },
      }),
    },
  },
}));

import { photoService } from '@/services/photoService';
import type { PhotoUploadInput } from '@/services/photoService';

function uploadInput(overrides: Partial<PhotoUploadInput> = {}): PhotoUploadInput {
  return {
    file: new Blob(['x'.repeat(1024)], { type: 'image/jpeg' }),
    filename: 'sunset.jpg',
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
    ...overrides,
  };
}

describe('photoService upload idempotency', () => {
  beforeEach(() => {
    backend.reset();
    // Quota check runs before every upload and hits storage.list()
    vi.spyOn(photoService, 'checkStorageQuota').mockResolvedValue({
      used: 0,
      quota: 1_073_741_824,
      percent: 0,
      warning: 'none',
    });
  });

  it('a retry under the same key resolves to the first upload', async () => {
    const key = 'upload-key-1';

    const first = await photoService.uploadPhoto(uploadInput({ idempotencyKey: key }));
    // The response was lost, so the user taps Retry and the whole upload reruns.
    const retried = await photoService.uploadPhoto(uploadInput({ idempotencyKey: key }));

    expect(backend.rows).toHaveLength(1);
    expect(backend.objects.size).toBe(1);
    expect(retried?.id).toBe(first?.id);
  });

  it('does not delete the stored object when resolving a duplicate', async () => {
    // The rollback path removes the storage object on insert failure. A
    // conflict is not a failure -- deleting here would strand the surviving
    // row pointing at a file that no longer exists.
    const key = 'upload-key-2';
    await photoService.uploadPhoto(uploadInput({ idempotencyKey: key }));
    const path = backend.rows[0].storage_path;

    await photoService.uploadPhoto(uploadInput({ idempotencyKey: key }));

    expect(backend.objects.has(path)).toBe(true);
  });

  it('two genuinely different uploads both land', async () => {
    await photoService.uploadPhoto(uploadInput({ idempotencyKey: 'a' }));
    await photoService.uploadPhoto(uploadInput({ idempotencyKey: 'b' }));

    expect(backend.rows).toHaveLength(2);
    expect(backend.objects.size).toBe(2);
  });

  it('still works for a caller that supplies no key', async () => {
    // Absent a key each call is its own upload, which is the old behaviour and
    // must not start colliding.
    await photoService.uploadPhoto(uploadInput());
    await photoService.uploadPhoto(uploadInput());

    expect(backend.rows).toHaveLength(2);
  });
});
