/**
 * Service worker background sync — duplicate-mood spec coverage (Goal A)
 *
 * The service worker is the writer the main thread's `isSyncing` guard cannot
 * see, so it must mirror moodSyncService.syncMood: PATCH a record that already
 * has a server row, upsert everything else.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MoodEntry } from '@/types';
import { FakeMoodsBackend } from '../api/fakeMoodsBackend';

vi.mock('workbox-cacheable-response', () => ({ CacheableResponsePlugin: class {} }));
vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }));
vi.mock('workbox-expiration', () => ({ ExpirationPlugin: class {} }));
vi.mock('workbox-precaching', () => ({
  cleanupOutdatedCaches: vi.fn(),
  precacheAndRoute: vi.fn(),
}));
vi.mock('workbox-routing', () => ({ NavigationRoute: class {}, registerRoute: vi.fn() }));
vi.mock('workbox-strategies', () => ({ CacheFirst: class {}, NetworkFirst: class {} }));

vi.mock('@/sw-db', () => ({
  getAuthToken: vi.fn(),
  getPendingMoods: vi.fn(),
  markMoodSynced: vi.fn(),
}));

import { moodSyncFingerprint } from '@/services/moodSyncPayload';
import { getAuthToken, getPendingMoods, markMoodSynced } from '@/sw-db';

const mockedGetAuthToken = vi.mocked(getAuthToken);
const mockedGetPendingMoods = vi.mocked(getPendingMoods);
const mockedMarkMoodSynced = vi.mocked(markMoodSynced);

const MOODS_URL = 'https://xojempkrugifnaveqtqc.supabase.co/rest/v1/moods';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const LOG_TIME = '2026-01-26T23:52:29.297Z';
const SERVER_ROW_ID = '00000000-0000-4000-8000-0000000000aa';

const globalScope = globalThis as unknown as Record<string, unknown>;
const fetchMock = vi.fn();

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function fetchCall(index: number): FetchCall {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return {
    url,
    method: init.method as string,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string),
  };
}

function pendingMood(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: 1,
    userId: USER_ID,
    mood: 'happy',
    moods: ['happy'],
    note: 'a note',
    date: '2026-01-26',
    timestamp: new Date(LOG_TIME),
    synced: false,
    ...overrides,
  };
}

/**
 * Dispatch the Background Sync event sw.ts listens for and await its work.
 *
 * `swallow: false` surfaces the rejection instead of absorbing it — the browser
 * treats a rejected `waitUntil` as "retry this tag", so whether the work
 * rejects is itself behaviour worth asserting.
 */
async function fireBackgroundSync({ swallow = true }: { swallow?: boolean } = {}): Promise<void> {
  const event = new Event('sync') as Event & {
    tag: string;
    waitUntil: (promise: Promise<unknown>) => void;
  };
  Object.defineProperty(event, 'tag', { value: 'sync-pending-moods', configurable: true });

  let work: Promise<unknown> = Promise.resolve();
  event.waitUntil = (promise) => {
    work = promise;
  };

  self.dispatchEvent(event);
  if (swallow) {
    await work.catch(() => undefined);
    return;
  }
  await work;
}

describe('service worker mood background sync', () => {
  describe('cross-context lock', () => {
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'locks');
    });

    it('[a tab is already syncing] performs no write at all', async () => {
      // The worker cannot see the app's `syncStatus.isSyncing` flag. Without
      // the lock it writes the same records a tab is mid-way through writing,
      // and both then clear the dirty flag over each other's edit.
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
          request: async (
            _name: string,
            _options: { ifAvailable?: boolean },
            callback: (lock: null) => Promise<unknown>
          ) => callback(null),
        },
      });
      mockedGetPendingMoods.mockResolvedValue([pendingMood()]);

      await fireBackgroundSync();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockedMarkMoodSynced).not.toHaveBeenCalled();
    });

    it('[a tab is already syncing] rejects so Background Sync re-fires the tag', async () => {
      // Background Sync only re-queues a tag when its waitUntil promise
      // rejects. Resolving on a skip would retire the registration on a batch
      // that did nothing, spending the offline path's one retry guarantee.
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
          request: async (
            _name: string,
            _options: { ifAvailable?: boolean },
            callback: (lock: null) => Promise<unknown>
          ) => callback(null),
        },
      });
      mockedGetPendingMoods.mockResolvedValue([pendingMood()]);

      await expect(fireBackgroundSync({ swallow: false })).rejects.toThrow(/lock held/);
    });
  });

  describe('deferred outcome', () => {
    it('[a tab edited the record mid-flight] is not counted as a success', async () => {
      mockedGetPendingMoods.mockResolvedValue([pendingMood({ supabaseId: SERVER_ROW_ID })]);
      fetchMock.mockResolvedValue(jsonResponse(200, [{ id: SERVER_ROW_ID }]));
      mockedMarkMoodSynced.mockResolvedValue('deferred');

      // Nothing landed cleanly, so this must reject: unlike the main thread the
      // worker has no second pass, and the newer value would otherwise sit
      // unsynced until an unrelated trigger fired.
      await expect(fireBackgroundSync({ swallow: false })).rejects.toThrow(/1 deferred/);

      // The write did land — the record is pending a newer value, not unwritten.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  beforeAll(async () => {
    globalScope.skipWaiting = vi.fn();
    globalScope.clients = { matchAll: vi.fn(async () => []) };
    globalScope.fetch = fetchMock;
    await import('@/sw');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthToken.mockResolvedValue({
      id: 'current',
      userId: USER_ID,
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    mockedMarkMoodSynced.mockResolvedValue('cleared');
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('[A: SW syncs an edited record] PATCHes the existing row and never POSTs', async () => {
    mockedGetPendingMoods.mockResolvedValue([pendingMood({ supabaseId: SERVER_ROW_ID })]);
    fetchMock.mockResolvedValue(jsonResponse(200, [{ id: SERVER_ROW_ID }]));

    await fireBackgroundSync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchCall(0);
    expect(call.method).toBe('PATCH');
    expect(call.url).toBe(`${MOODS_URL}?id=eq.${SERVER_ROW_ID}`);
    // created_at is the row's identity, user_id its owner — neither may move.
    expect(call.body).toEqual({
      mood_type: 'happy',
      mood_types: ['happy'],
      note: 'a note',
    });
    expect(mockedMarkMoodSynced).toHaveBeenCalledWith(1, SERVER_ROW_ID, moodSyncFingerprint(pendingMood()));
  });

  it('[A: SW syncs an edited record] falls back to the upsert on a 404', async () => {
    mockedGetPendingMoods.mockResolvedValue([pendingMood({ supabaseId: SERVER_ROW_ID })]);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { message: 'not found' }))
      .mockResolvedValueOnce(jsonResponse(201, [{ id: 'recreated-row' }]));

    await fireBackgroundSync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallback = fetchCall(1);
    expect(fallback.method).toBe('POST');
    expect(fallback.url).toBe(`${MOODS_URL}?on_conflict=user_id,created_at`);
    expect(fallback.headers.Prefer).toBe('resolution=merge-duplicates,return=representation');
    expect(mockedMarkMoodSynced).toHaveBeenCalledWith(1, 'recreated-row', moodSyncFingerprint(pendingMood()));
  });

  it('[A: SW syncs an edited record] falls back to the upsert when the PATCH matches no row', async () => {
    mockedGetPendingMoods.mockResolvedValue([pendingMood({ supabaseId: SERVER_ROW_ID })]);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(201, [{ id: 'recreated-row' }]));

    await fireBackgroundSync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchCall(1).method).toBe('POST');
    expect(fetchCall(1).url).toBe(`${MOODS_URL}?on_conflict=user_id,created_at`);
    expect(mockedMarkMoodSynced).toHaveBeenCalledWith(1, 'recreated-row', moodSyncFingerprint(pendingMood()));
  });

  it('[A: two writers race] a never-synced mood is upserted on user_id,created_at', async () => {
    mockedGetPendingMoods.mockResolvedValue([pendingMood()]);
    fetchMock.mockResolvedValue(jsonResponse(201, [{ id: SERVER_ROW_ID }]));

    await fireBackgroundSync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchCall(0);
    expect(call.method).toBe('POST');
    expect(call.url).toBe(`${MOODS_URL}?on_conflict=user_id,created_at`);
    expect(call.headers.Prefer).toBe('resolution=merge-duplicates,return=representation');
    // The idempotency key: client-supplied, reproduced identically on every resend.
    expect(call.body).toMatchObject({ user_id: USER_ID, created_at: LOG_TIME });
    expect(mockedMarkMoodSynced).toHaveBeenCalledWith(1, SERVER_ROW_ID, moodSyncFingerprint(pendingMood()));
  });

  // The tests above assert request SHAPE against canned responses, which cannot
  // show a request resolving to a row that is already there — the mock hands
  // back a fresh id no matter what is stored. These drive the worker against a
  // real table so the main thread and the worker share one store, which is the
  // only way "both writers fire, exactly one row" is actually verified rather
  // than inferred from two separately-mocked halves.
  describe('against a shared table', () => {
    let backend: FakeMoodsBackend;

    beforeEach(() => {
      backend = new FakeMoodsBackend();
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        const parsed = new URL(url);
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        const query = backend.client().from('moods');

        if (init.method === 'PATCH') {
          const id = (parsed.searchParams.get('id') ?? '').replace('eq.', '');
          const { data } = await query.update(body).eq('id', id);
          return jsonResponse(200, data);
        }

        const onConflict = parsed.searchParams.get('on_conflict');
        const { data, error } = onConflict
          ? await query.upsert(body, { onConflict })
          : await query.insert(body);
        if (error) {
          return jsonResponse(409, error);
        }
        return jsonResponse(201, data);
      });
    });

    it('[A: two writers race] adopts the row the main thread already wrote', async () => {
      // The main thread committed this row and the worker never learned its id.
      const existing = backend.seed({
        user_id: USER_ID,
        created_at: LOG_TIME,
        note: 'a note',
        mood_type: 'happy',
        mood_types: ['happy'],
      });
      mockedGetPendingMoods.mockResolvedValue([pendingMood()]);

      await fireBackgroundSync();

      expect(backend.rows).toHaveLength(1);
      // The pre-existing id, not a freshly minted one — this is what stops the
      // local record from being re-synced as a second row later.
      expect(mockedMarkMoodSynced).toHaveBeenCalledWith(1, existing.id, moodSyncFingerprint(pendingMood()));
    });

    it('[A: SW syncs an edited record] edits in place without adding a row', async () => {
      const existing = backend.seed({
        user_id: USER_ID,
        created_at: LOG_TIME,
        note: 'original',
        mood_type: 'happy',
        mood_types: ['happy'],
      });
      mockedGetPendingMoods.mockResolvedValue([
        pendingMood({ supabaseId: existing.id, note: 'edited', mood: 'sad', moods: ['sad'] }),
      ]);

      await fireBackgroundSync();

      expect(backend.rows).toHaveLength(1);
      expect(backend.rows[0].note).toBe('edited');
      expect(backend.rows[0].mood_type).toBe('sad');
      // created_at is the row's identity and must survive the edit.
      expect(backend.rows[0].created_at).toBe(LOG_TIME);
      expect(mockedMarkMoodSynced).toHaveBeenCalledWith(1, existing.id, moodSyncFingerprint(pendingMood({ note: 'edited', mood: 'sad', moods: ['sad'] })));
    });
  });
});
