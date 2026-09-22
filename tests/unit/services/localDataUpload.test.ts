/**
 * localDataUpload — the one-time, insert-only upload of a device's local data
 *
 * One case per row of the spec's I/O matrix (spec-move-local-data-to-supabase),
 * plus the bridge's forward-URL computation. The local side is the real
 * `storageService` over fake-indexeddb, so "local data untouched" is read back
 * from disk rather than inferred from a mock; the server side is three faked
 * API modules whose pure hash helpers stay real.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  fetchAnniversaries: vi.fn(),
  insertAnniversariesOnce: vi.fn(),
  fetchCustomMessages: vi.fn(),
  insertCustomMessagesOnce: vi.fn(),
  insertFavoritesOnce: vi.fn(),
  receiptInsert: vi.fn(),
}));

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: (table: string) => ({ insert: (row: unknown) => api.receiptInsert(table, row) }),
  },
}));

vi.mock('../../../src/services/anniversariesService', () => ({
  anniversariesService: {
    fetchAnniversaries: api.fetchAnniversaries,
    insertAnniversariesOnce: api.insertAnniversariesOnce,
  },
}));

vi.mock('../../../src/services/customMessagesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/customMessagesApi')>()),
  customMessagesApi: {
    fetchCustomMessages: api.fetchCustomMessages,
    insertCustomMessagesOnce: api.insertCustomMessagesOnce,
  },
}));

vi.mock('../../../src/services/messageFavoritesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/messageFavoritesApi')>()),
  messageFavoritesApi: { insertFavoritesOnce: api.insertFavoritesOnce },
}));

import { openDB } from 'idb';
import { AccountDataError } from '../../../src/services/accountDataError';
import { serializeAccountDataWrite } from '../../../src/services/accountDataQueue';
import { DB_NAME, type MyLoveDBSchema } from '../../../src/services/dbSchema';
import {
  forwardFromLegacyOrigin,
  hasCompletedLocalUpload,
  legacyBridgeUrl,
  localUploadFlagKey,
  syncAccountDataAfterSignIn,
  uploadLocalData,
} from '../../../src/services/localDataUpload';
import { bundledMessageKey, hashText } from '../../../src/services/messageFavoritesApi';
import { storageService } from '../../../src/services/storage';
import type { Anniversary } from '../../../src/types';

const ORIGIN = 'https://sallvainian.github.io';

function deferredVoid() {
  let settle: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}
const CREATED = new Date('2026-03-01T10:00:00.000Z');
let userCounter = 0;
let user = '';

/** A favorite as the old build left it: a mirror row only. */
async function putFavorite(messageId: number) {
  const db = await openDB<MyLoveDBSchema>(DB_NAME);
  try {
    await db.put('message-favorites', { messageId, userId: user });
  } finally {
    db.close();
  }
}

/** Seed this test's user: one bundled favorite, one favorited custom row, plus noise. */
async function seedLocal() {
  await storageService.init();
  const bundledText = `BUNDLED-${user}`;
  const bundledId = await storageService.addMessage({
    text: bundledText, category: 'reason', isCustom: false, createdAt: CREATED,
  });
  const customId = await storageService.addMessage({
    text: `  Custom for ${user}  `, category: 'memory', isCustom: true, userId: user,
    active: false, tags: ['t'], createdAt: CREATED, updatedAt: CREATED,
  });
  // Already a server row, created in-app: never re-uploaded.
  await storageService.addMessage({
    text: `Synced for ${user}`, category: 'custom', isCustom: true, userId: user,
    serverId: 'server-row', createdAt: CREATED,
  });
  // Nobody's (legacy) and somebody else's: never read.
  await storageService.addMessage({ text: `Legacy ${user}`, category: 'custom', isCustom: true, createdAt: CREATED });
  await storageService.addMessage({
    text: `Other ${user}`, category: 'custom', isCustom: true, userId: `${user}-other`, createdAt: CREATED,
  });
  await putFavorite(bundledId);
  await putFavorite(customId);
  return { bundledText, bundledId, customId };
}

const anniversaries: Anniversary[] = [
  { id: 1, date: '2024-02-14', label: 'First date', description: 'dinner' },
  { id: 2, date: '2025-06-01', label: 'Already synced', serverId: 'server-ann' },
];

async function localSnapshot() {
  return {
    messages: await storageService.getAllMessages(user),
  };
}

beforeEach(() => {
  user = `user-${++userCounter}`;
  for (const fn of Object.values(api)) fn.mockReset();
  api.fetchAnniversaries.mockResolvedValue([]);
  api.fetchCustomMessages.mockResolvedValue([]);
  api.insertAnniversariesOnce.mockResolvedValue(undefined);
  api.insertCustomMessagesOnce.mockResolvedValue(undefined);
  api.insertFavoritesOnce.mockResolvedValue(undefined);
  api.receiptInsert.mockResolvedValue({ error: null });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploadLocalData', () => {
  it('first sign-in: inserts everything under deterministic keys, writes a receipt, then sets the flag', async () => {
    const { bundledText } = await seedLocal();

    const result = await uploadLocalData(user, anniversaries, ORIGIN);

    expect(result).toEqual({ status: 'uploaded', counts: { anniversaries: 1, customMessages: 1, favorites: 2 } });
    expect(api.insertAnniversariesOnce).toHaveBeenCalledWith([
      {
        user_id: user,
        event_date: '2024-02-14',
        label: 'First date',
        description: 'dinner',
        client_key: `a:2024-02-14:${await hashText('First date')}`,
      },
    ]);
    expect(api.insertCustomMessagesOnce).toHaveBeenCalledWith([
      {
        user_id: user,
        text: `Custom for ${user}`,
        category: 'memory',
        active: false,
        is_favorite: true,
        tags: ['t'],
        client_key: `c:${CREATED.getTime()}:${await hashText(`  Custom for ${user}  `)}`,
        created_at: CREATED.toISOString(),
        updated_at: CREATED.toISOString(),
      },
    ]);
    expect(api.insertFavoritesOnce).toHaveBeenCalledWith(user, [await bundledMessageKey(bundledText)]);
    // Counts and origin only — no content in the receipt.
    expect(api.receiptInsert).toHaveBeenCalledWith('local_data_uploads', {
      user_id: user,
      origin: ORIGIN,
      anniversaries_count: 1,
      custom_messages_count: 1,
      favorites_count: 2,
    });
    expect(hasCompletedLocalUpload(user)).toBe(true);
  });

  it('re-run after a reload mid-upload: the same keys again, and items now on the server are skipped', async () => {
    await seedLocal();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Run 1 inserts, then dies before its receipt — the SW reload window.
    api.receiptInsert.mockRejectedValueOnce(new Error('page unloaded'));
    expect((await uploadLocalData(user, anniversaries, ORIGIN)).status).toBe('failed');
    expect(hasCompletedLocalUpload(user)).toBe(false);
    const firstAnniversaries = api.insertAnniversariesOnce.mock.calls[0][0];
    const firstCustom = api.insertCustomMessagesOnce.mock.calls[0][0];

    // Run 2 before the server answers with the rows: identical keys, so the
    // server's ON CONFLICT DO NOTHING collapses them.
    api.receiptInsert.mockRejectedValueOnce(new Error('page unloaded'));
    await uploadLocalData(user, anniversaries, ORIGIN);
    expect(api.insertAnniversariesOnce.mock.calls[1][0]).toEqual(firstAnniversaries);
    expect(api.insertCustomMessagesOnce.mock.calls[1][0]).toEqual(firstCustom);

    // Run 3 sees them stored and inserts nothing new, then completes.
    api.fetchAnniversaries.mockResolvedValue([{ serverId: 's1', date: '2024-02-14', label: 'First date' }]);
    api.fetchCustomMessages.mockResolvedValue([{ text: `Custom for ${user}` }]);
    expect((await uploadLocalData(user, anniversaries, ORIGIN)).status).toBe('uploaded');
    expect(api.insertAnniversariesOnce.mock.calls[2][0]).toEqual([]);
    expect(api.insertCustomMessagesOnce.mock.calls[2][0]).toEqual([]);
    expect(hasCompletedLocalUpload(user)).toBe(true);
  });

  it('skips a local item the server already holds (same text, same date+label), touching no server row', async () => {
    await seedLocal();
    api.fetchAnniversaries.mockResolvedValue([
      { serverId: 'other-device', date: '2024-02-14', label: 'First date', description: 'different' },
    ]);
    api.fetchCustomMessages.mockResolvedValue([{ text: `CUSTOM FOR ${user.toUpperCase()}` }]);

    const result = await uploadLocalData(user, anniversaries, ORIGIN);

    expect(result.status).toBe('uploaded');
    expect(api.insertAnniversariesOnce).toHaveBeenCalledWith([]);
    expect(api.insertCustomMessagesOnce).toHaveBeenCalledWith([]);
  });

  it('a failure part-way leaves the flag unset and the local data untouched', async () => {
    await seedLocal();
    const before = await localSnapshot();
    api.insertCustomMessagesOnce.mockRejectedValue(
      new AccountDataError('offline', 'You are offline.')
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await uploadLocalData(user, anniversaries, ORIGIN);

    expect(result.status).toBe('failed');
    expect(log).toHaveBeenCalled();
    expect(hasCompletedLocalUpload(user)).toBe(false);
    expect(api.insertFavoritesOnce).not.toHaveBeenCalled();
    expect(api.receiptInsert).not.toHaveBeenCalled();
    expect(await localSnapshot()).toEqual(before);
  });

  it('offline: fails without a request and without setting the flag', async () => {
    await seedLocal();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    api.fetchAnniversaries.mockRejectedValue(new AccountDataError('offline', 'You are offline.'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await uploadLocalData(user, anniversaries, ORIGIN)).status).toBe('failed');
    expect(hasCompletedLocalUpload(user)).toBe(false);
  });

  it('a failed local read stops the upload: no request, no receipt, no flag', async () => {
    await seedLocal();
    const holder = storageService as unknown as { db: { transaction: (...args: unknown[]) => unknown } };
    const transaction = vi.spyOn(holder.db, 'transaction').mockImplementationOnce(() => {
      throw new DOMException('The database connection is closing.', 'InvalidStateError');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await uploadLocalData(user, anniversaries, ORIGIN);
    transaction.mockRestore();

    expect(result.status).toBe('failed');
    expect(hasCompletedLocalUpload(user)).toBe(false);
    expect(api.fetchAnniversaries).not.toHaveBeenCalled();
    expect(api.insertFavoritesOnce).not.toHaveBeenCalled();
    expect(api.receiptInsert).not.toHaveBeenCalled();
  });

  it('the receipt counts only what the server now holds, not rows skipped as invalid', async () => {
    await seedLocal();
    await storageService.addMessage({
      text: 'x'.repeat(1001), category: 'custom', isCustom: true, userId: user, createdAt: CREATED,
    });
    const withInvalid: Anniversary[] = [
      ...anniversaries,
      { id: 3, date: '2026-02-30', label: 'Not a real day' },
    ];

    const result = await uploadLocalData(user, withInvalid, ORIGIN);

    expect(result).toEqual({ status: 'uploaded', counts: { anniversaries: 1, customMessages: 1, favorites: 2 } });
    expect(api.receiptInsert).toHaveBeenCalledWith('local_data_uploads', expect.objectContaining({
      anniversaries_count: 1,
      custom_messages_count: 1,
      favorites_count: 2,
    }));
  });

  it('counts an item the server already held, but not a custom favorite it left untouched', async () => {
    await seedLocal();
    api.fetchAnniversaries.mockResolvedValue([{ serverId: 's', date: '2024-02-14', label: 'First date' }]);
    api.fetchCustomMessages.mockResolvedValue([{ text: `custom for ${user}` }]);

    const result = await uploadLocalData(user, anniversaries, ORIGIN);

    // Both still held by the server; the duplicate custom row kept its own flag.
    expect(result).toEqual({ status: 'uploaded', counts: { anniversaries: 1, customMessages: 1, favorites: 1 } });
  });

  it('holds the account-data queue, so a favorite toggled mid-upload waits for it', async () => {
    await seedLocal();
    const favorites = deferredVoid();
    api.insertFavoritesOnce.mockReturnValue(favorites.promise);

    const upload = uploadLocalData(user, anniversaries, ORIGIN);
    await vi.waitFor(() => expect(api.insertFavoritesOnce).toHaveBeenCalled());
    const toggle = vi.fn(async () => {});
    const queued = serializeAccountDataWrite(toggle);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(toggle).not.toHaveBeenCalled();

    favorites.settle();
    await upload;
    await queued;
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('flag already set: no upload at all', async () => {
    localStorage.setItem(localUploadFlagKey(user), 'done');

    expect(await uploadLocalData(user, anniversaries, ORIGIN)).toEqual({ status: 'already-uploaded' });
    expect(api.fetchAnniversaries).not.toHaveBeenCalled();
    expect(api.insertFavoritesOnce).not.toHaveBeenCalled();
    expect(api.receiptInsert).not.toHaveBeenCalled();
  });

  it('shares one run between concurrent callers', async () => {
    await seedLocal();

    const [first, second] = await Promise.all([
      uploadLocalData(user, anniversaries, ORIGIN),
      uploadLocalData(user, anniversaries, ORIGIN),
    ]);

    expect(first).toBe(second);
    expect(api.receiptInsert).toHaveBeenCalledTimes(1);
  });

  it('a user with nothing local still gets a zero receipt and the flag', async () => {
    expect(await uploadLocalData(user, [], ORIGIN)).toEqual({
      status: 'uploaded',
      counts: { anniversaries: 0, customMessages: 0, favorites: 0 },
    });
    expect(api.fetchAnniversaries).not.toHaveBeenCalled();
    expect(hasCompletedLocalUpload(user)).toBe(true);
  });
});

describe('legacyBridgeUrl', () => {
  const target = 'https://my-love.sallvain.workers.dev';
  const at = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

  it.each([
    ['/My-Love/', '', '', `${target}/`],
    ['/My-Love', '', '', `${target}/`],
    ['/My-Love/photos', '?x=1', '#top', `${target}/photos?x=1#top`],
    ['/My-Love/admin', '', '', `${target}/admin`],
    ['/elsewhere', '', '', `${target}/elsewhere`],
    ['/My-Loveless', '', '', `${target}/My-Loveless`],
  ])('%s%s%s → %s', (pathname, search, hash, expected) => {
    expect(legacyBridgeUrl(target, at(pathname, search, hash), '/My-Love/')).toBe(expected);
  });

  it('tolerates a trailing slash on the target and a root base', () => {
    expect(legacyBridgeUrl(`${target}/`, at('/notes'), '/')).toBe(`${target}/notes`);
  });
});

describe('forwardFromLegacyOrigin', () => {
  const target = 'https://my-love.sallvain.workers.dev';

  function stubLocation(replace: (url: string) => void) {
    vi.stubGlobal('location', { pathname: '/My-Love/mood', search: '', hash: '', replace });
    return () => vi.unstubAllGlobals();
  }

  it('does nothing when this is not the bridge build', () => {
    localStorage.setItem(localUploadFlagKey(user), 'done');
    const replace = vi.fn();
    const restore = stubLocation(replace);
    try {
      expect(forwardFromLegacyOrigin(user, undefined)).toBe(false);
      expect(replace).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('never forwards before this user’s flag is set', () => {
    const replace = vi.fn();
    const restore = stubLocation(replace);
    try {
      expect(forwardFromLegacyOrigin(user, target)).toBe(false);
      expect(replace).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('replaces the location once the flag is set', () => {
    localStorage.setItem(localUploadFlagKey(user), 'done');
    const replace = vi.fn();
    const restore = stubLocation(replace);
    try {
      expect(forwardFromLegacyOrigin(user, target)).toBe(true);
      expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/my-love\.sallvain\.workers\.dev\//));
    } finally {
      restore();
    }
  });

  it('stays put, app working, when the navigation throws', () => {
    localStorage.setItem(localUploadFlagKey(user), 'done');
    const restore = stubLocation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(forwardFromLegacyOrigin(user, target)).toBe(false);
    } finally {
      restore();
    }
  });
});

/**
 * The post-sign-in sequence App.tsx runs whenever a signed-in user appears —
 * including the bridge's "no session" row: the login screen shows, the user
 * signs in, and only then does this run, uploading before it forwards.
 */
describe('syncAccountDataAfterSignIn', () => {
  const target = 'https://my-love.sallvain.workers.dev';
  let replace: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    replace = vi.fn();
    vi.stubGlobal('location', { pathname: '/My-Love/photos', search: '?a=1', hash: '#h', replace });
    // The bridge is built with --base=/My-Love/.
    vi.stubEnv('BASE_URL', '/My-Love/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('bridge build: uploads, then forwards — and does not refresh', async () => {
    await seedLocal();
    const refresh = vi.fn(async () => {});

    const outcome = await syncAccountDataAfterSignIn(user, anniversaries, {
      isStillCurrent: () => true,
      refresh,
      bridgeTarget: target,
    });

    expect(outcome).toBe('forwarded');
    // Upload first: the receipt and the flag exist before the navigation.
    expect(api.receiptInsert).toHaveBeenCalledTimes(1);
    expect(api.receiptInsert.mock.invocationCallOrder[0]).toBeLessThan(
      replace.mock.invocationCallOrder[0]
    );
    expect(hasCompletedLocalUpload(user)).toBe(true);
    expect(replace).toHaveBeenCalledWith(`${target}/photos?a=1#h`);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('bridge build, flag already set (second open of the old icon): forwards without uploading', async () => {
    localStorage.setItem(localUploadFlagKey(user), 'done');
    const refresh = vi.fn(async () => {});

    expect(
      await syncAccountDataAfterSignIn(user, anniversaries, { isStillCurrent: () => true, refresh, bridgeTarget: target })
    ).toBe('forwarded');
    expect(api.receiptInsert).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('a failed upload neither forwards nor refreshes', async () => {
    await seedLocal();
    api.insertAnniversariesOnce.mockRejectedValue(new AccountDataError('transport', '503'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refresh = vi.fn(async () => {});

    const outcome = await syncAccountDataAfterSignIn(user, anniversaries, {
      isStillCurrent: () => true,
      refresh,
      bridgeTarget: target,
    });

    expect(outcome).toBe('failed');
    expect(hasCompletedLocalUpload(user)).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('an account change during the upload neither forwards nor refreshes', async () => {
    await seedLocal();
    let current = true;
    api.receiptInsert.mockImplementation(async () => {
      current = false; // another account signs in while the upload finishes
      return { error: null };
    });
    const refresh = vi.fn(async () => {});

    const outcome = await syncAccountDataAfterSignIn(user, anniversaries, {
      isStillCurrent: () => current,
      refresh,
      bridgeTarget: target,
    });

    expect(outcome).toBe('stale');
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('without a bridge target: uploads, then refreshes the mirrors, and never navigates', async () => {
    await seedLocal();
    const refresh = vi.fn(async () => {});

    const outcome = await syncAccountDataAfterSignIn(user, anniversaries, {
      isStillCurrent: () => true,
      refresh,
      bridgeTarget: undefined,
    });

    expect(outcome).toBe('refreshed');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(api.receiptInsert.mock.invocationCallOrder[0]).toBeLessThan(
      refresh.mock.invocationCallOrder[0]
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('a forward that cannot start falls through to the refresh, keeping the app working', async () => {
    localStorage.setItem(localUploadFlagKey(user), 'done');
    replace.mockImplementation(() => {
      throw new Error('navigation blocked');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refresh = vi.fn(async () => {});

    expect(
      await syncAccountDataAfterSignIn(user, anniversaries, { isStillCurrent: () => true, refresh, bridgeTarget: target })
    ).toBe('refreshed');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
