/**
 * Anniversaries, custom messages and favorites moved to Supabase — the store
 * side: server-first writes, the identity guard around every await, the
 * refresh that may only run after this device's upload flag is set, and the
 * favorite error that sign-out must clear.
 *
 * The server is faked per module; the IndexedDB mirror is real
 * (fake-indexeddb), so the refresh's effect on disk is read back, not assumed.
 * Each case signs in as a fresh user id, because the mirror is one shared
 * database for the whole file — exactly as it is on a shared device.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
  createAnniversary: vi.fn(),
  updateAnniversary: vi.fn(),
  deleteAnniversary: vi.fn(),
  fetchAnniversaries: vi.fn(),
  fetchCustomMessages: vi.fn(),
  updateCustomMessage: vi.fn(),
  fetchFavoriteKeys: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() },
  getPartnerId: vi.fn(),
}));

vi.mock('../../../src/services/anniversariesService', () => ({
  anniversariesService: {
    createAnniversary: server.createAnniversary,
    updateAnniversary: server.updateAnniversary,
    deleteAnniversary: server.deleteAnniversary,
    fetchAnniversaries: server.fetchAnniversaries,
  },
}));

vi.mock('../../../src/services/customMessagesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/customMessagesApi')>()),
  customMessagesApi: {
    fetchCustomMessages: server.fetchCustomMessages,
    updateCustomMessage: server.updateCustomMessage,
  },
}));

vi.mock('../../../src/services/messageFavoritesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/messageFavoritesApi')>()),
  messageFavoritesApi: {
    fetchFavoriteKeys: server.fetchFavoriteKeys,
    addFavorite: server.addFavorite,
    removeFavorite: server.removeFavorite,
  },
}));

import { openDB } from 'idb';
import { AccountDataError } from '../../../src/services/accountDataError';
import type { ServerAnniversary } from '../../../src/services/anniversariesService';
import { OWNER_STORAGE_KEY, VAULT_STORAGE_KEY } from '../../../src/services/anniversaryVault';
import { DB_NAME, type MyLoveDBSchema } from '../../../src/services/dbSchema';
import { localUploadFlagKey } from '../../../src/services/localDataUpload';
import { bundledMessageKey } from '../../../src/services/messageFavoritesApi';
import { storageService } from '../../../src/services/storage';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { AppState } from '../../../src/stores/types';
import type { Anniversary, Message } from '../../../src/types';

type StoreState = Partial<AppState>;

let counter = 0;
let A = '';

function deferred<T>() {
  let settle: (value: T) => void = () => {};
  let fail: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  promise.catch(() => {});
  return { promise, settle, fail };
}

function anniversaries(): Anniversary[] {
  return useAppStore.getState().settings!.relationship.anniversaries;
}

function setAnniversaries(list: Anniversary[]) {
  const settings = useAppStore.getState().settings!;
  useAppStore.setState({
    settings: { ...settings, relationship: { ...settings.relationship, anniversaries: list } },
  } as StoreState);
}

function markUploaded(userId: string) {
  localStorage.setItem(localUploadFlagKey(userId), 'done');
}

const offline = () => new AccountDataError('offline', 'You are offline. Anniversaries need a connection to save.');

beforeEach(() => {
  for (const fn of Object.values(server)) fn.mockReset();
  A = `user-${++counter}`;
  useAppStore.setState({ messages: [], currentMessage: null } as StoreState);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser(A);
  localStorage.removeItem(VAULT_STORAGE_KEY);
  localStorage.removeItem(OWNER_STORAGE_KEY);
  setAnniversaries([]);
});

describe('anniversaries: server first, then the settings mirror', () => {
  const created: ServerAnniversary = { serverId: 'ann-1', date: '2024-02-14', label: 'First date' };

  it('writes the server, then mirrors the row with its server id', async () => {
    server.createAnniversary.mockResolvedValue(created);

    await useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'First date' });

    expect(server.createAnniversary).toHaveBeenCalledWith(A, { date: '2024-02-14', label: 'First date' });
    expect(anniversaries()).toEqual([{ id: 1, date: '2024-02-14', label: 'First date', serverId: 'ann-1' }]);
  });

  it('offline: rejects with the reason and leaves the mirror as it was', async () => {
    setAnniversaries([{ id: 3, date: '2020-01-01', label: 'Kept', serverId: 's' }]);
    server.createAnniversary.mockRejectedValue(offline());

    await expect(
      useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'First date' })
    ).rejects.toThrow(/offline/i);

    expect(anniversaries()).toEqual([{ id: 3, date: '2020-01-01', label: 'Kept', serverId: 's' }]);
  });

  it('refuses invalid input before any request', async () => {
    await expect(useAppStore.getState().addAnniversary({ date: '2024-02-14', label: '' })).rejects.toThrow();
    expect(server.createAnniversary).not.toHaveBeenCalled();
  });

  it('does not mirror into another account that signed in mid-flight', async () => {
    const pending = deferred<ServerAnniversary>();
    server.createAnniversary.mockReturnValue(pending.promise);

    const inFlight = useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'First date' });
    useAppStore.setState({ userId: 'USER-C' } as StoreState);
    setAnniversaries([{ id: 9, date: '2021-01-01', label: 'C only' }]);
    pending.settle(created);
    await inFlight;

    expect(anniversaries()).toEqual([{ id: 9, date: '2021-01-01', label: 'C only' }]);
  });

  it('does not mirror into a later session of the SAME account', async () => {
    const pending = deferred<ServerAnniversary>();
    server.createAnniversary.mockReturnValue(pending.promise);

    const inFlight = useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'First date' });
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser(A);
    const before = anniversaries();
    pending.settle(created);
    await inFlight;

    expect(anniversaries()).toEqual(before);
  });

  it('edits and deletes by server id', async () => {
    setAnniversaries([{ id: 4, date: '2024-02-14', label: 'Old', serverId: 'ann-4' }]);
    server.updateAnniversary.mockResolvedValue({ serverId: 'ann-4', date: '2024-02-15', label: 'New' });

    await useAppStore.getState().updateAnniversary(4, { date: '2024-02-15', label: 'New' });
    expect(server.updateAnniversary).toHaveBeenCalledWith('ann-4', { date: '2024-02-15', label: 'New' });
    expect(anniversaries()).toEqual([{ id: 4, date: '2024-02-15', label: 'New', serverId: 'ann-4' }]);

    server.deleteAnniversary.mockResolvedValue(undefined);
    await useAppStore.getState().removeAnniversary(4);
    expect(server.deleteAnniversary).toHaveBeenCalledWith('ann-4');
    expect(anniversaries()).toEqual([]);
  });

  it('keeps the row when the delete fails', async () => {
    setAnniversaries([{ id: 4, date: '2024-02-14', label: 'Old', serverId: 'ann-4' }]);
    server.deleteAnniversary.mockRejectedValue(offline());

    await expect(useAppStore.getState().removeAnniversary(4)).rejects.toThrow(/offline/i);
    expect(anniversaries()).toHaveLength(1);
  });

  it('a queued edit or delete that starts after an account switch sends nothing', async () => {
    markUploaded(A);
    setAnniversaries([{ id: 4, date: '2024-02-14', label: 'A row', serverId: 'ann-a' }]);
    // Hold the queue with a refresh whose read has not come back yet.
    const read = deferred<ServerAnniversary[]>();
    server.fetchAnniversaries.mockReturnValue(read.promise);
    const refresh = useAppStore.getState().loadAnniversariesFromServer();
    await vi.waitFor(() => expect(server.fetchAnniversaries).toHaveBeenCalled());

    const edit = useAppStore.getState().updateAnniversary(4, { date: '2024-02-15', label: 'Edited' });
    const removal = useAppStore.getState().removeAnniversary(4);
    // C signs in; C's own row happens to carry the same device-local id.
    useAppStore.setState({ userId: 'USER-C' } as StoreState);
    setAnniversaries([{ id: 4, date: '2021-01-01', label: 'C row', serverId: 'ann-c' }]);
    read.settle([]);
    await Promise.all([refresh, edit, removal]);

    expect(server.updateAnniversary).not.toHaveBeenCalled();
    expect(server.deleteAnniversary).not.toHaveBeenCalled();
    expect(anniversaries()).toEqual([{ id: 4, date: '2021-01-01', label: 'C row', serverId: 'ann-c' }]);
  });

  it('refuses to edit or delete a row not yet uploaded', async () => {
    setAnniversaries([{ id: 5, date: '2024-02-14', label: 'Local only' }]);

    await expect(
      useAppStore.getState().updateAnniversary(5, { date: '2024-02-14', label: 'x' })
    ).rejects.toMatchObject({ code: 'not-synced' });
    await expect(useAppStore.getState().removeAnniversary(5)).rejects.toMatchObject({ code: 'not-synced' });
    expect(server.updateAnniversary).not.toHaveBeenCalled();
    expect(server.deleteAnniversary).not.toHaveBeenCalled();
    expect(anniversaries()).toHaveLength(1);
  });
});

describe('loadAnniversariesFromServer', () => {
  it('does nothing until this device’s upload flag is set', async () => {
    setAnniversaries([{ id: 1, date: '2024-02-14', label: 'Local only' }]);

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(server.fetchAnniversaries).not.toHaveBeenCalled();
    expect(anniversaries()).toEqual([{ id: 1, date: '2024-02-14', label: 'Local only' }]);
  });

  it('replaces the mirror, keeping the local id of a row it already had', async () => {
    markUploaded(A);
    setAnniversaries([
      { id: 7, date: '2024-02-14', label: 'Stale label', serverId: 'ann-1' },
      { id: 8, date: '2024-03-01', label: 'Uploaded as a duplicate' },
    ]);
    server.fetchAnniversaries.mockResolvedValue([
      { serverId: 'ann-1', date: '2024-02-14', label: 'Fresh label' },
      { serverId: 'ann-2', date: '2025-01-01', label: 'From the other phone', description: 'x' },
    ]);

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(server.fetchAnniversaries).toHaveBeenCalledWith(A);
    expect(anniversaries()).toEqual([
      { id: 7, date: '2024-02-14', label: 'Fresh label', serverId: 'ann-1' },
      { id: 9, date: '2025-01-01', label: 'From the other phone', description: 'x', serverId: 'ann-2' },
    ]);
  });

  it('keeps the mirror when the read fails (offline display)', async () => {
    markUploaded(A);
    setAnniversaries([{ id: 1, date: '2024-02-14', label: 'Kept', serverId: 'ann-1' }]);
    server.fetchAnniversaries.mockRejectedValue(offline());
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(anniversaries()).toEqual([{ id: 1, date: '2024-02-14', label: 'Kept', serverId: 'ann-1' }]);
  });

  it('discards a read that lands after the account changed', async () => {
    markUploaded(A);
    const pending = deferred<ServerAnniversary[]>();
    server.fetchAnniversaries.mockReturnValue(pending.promise);

    const inFlight = useAppStore.getState().loadAnniversariesFromServer();
    useAppStore.setState({ userId: 'USER-C' } as StoreState);
    setAnniversaries([{ id: 1, date: '2021-01-01', label: 'C only' }]);
    pending.settle([{ serverId: 'ann-a', date: '2024-02-14', label: 'A private' }]);
    await inFlight;

    expect(anniversaries()).toEqual([{ id: 1, date: '2021-01-01', label: 'C only' }]);
  });
});

describe('messages: favorites and the mirror refresh', () => {
  async function seed(rows: Array<Omit<Message, 'id'>>): Promise<number[]> {
    await storageService.init();
    const ids: number[] = [];
    for (const row of rows) ids.push(await storageService.addMessage(row));
    return ids;
  }

  async function diskRows(): Promise<Message[]> {
    const db = await openDB<MyLoveDBSchema>(DB_NAME);
    try {
      return await db.getAll('messages');
    } finally {
      db.close();
    }
  }

  async function diskFavorites(userId: string) {
    const db = await openDB<MyLoveDBSchema>(DB_NAME);
    try {
      return await db.getAllFromIndex('message-favorites', 'by-user', userId);
    } finally {
      db.close();
    }
  }

  const at = new Date('2026-01-01T00:00:00.000Z');

  async function putFavorite(messageId: number) {
    const db = await openDB<MyLoveDBSchema>(DB_NAME);
    try {
      await db.put('message-favorites', { messageId, userId: A });
    } finally {
      db.close();
    }
  }

  it('does not refresh before the upload flag is set', async () => {
    await useAppStore.getState().loadMessageDataFromServer();
    expect(server.fetchCustomMessages).not.toHaveBeenCalled();
    expect(server.fetchFavoriteKeys).not.toHaveBeenCalled();
  });

  it('replaces the owner’s mirror rows and bundled favorites, and nobody else’s', async () => {
    const bundledText = `DAILY-${A}`;
    const [bundledId, syncedId, , legacyId, otherId] = await seed([
      { text: bundledText, category: 'reason', isCustom: false, createdAt: at },
      { text: 'old text', category: 'custom', isCustom: true, userId: A, serverId: `srv-${A}`, createdAt: at },
      // Uploaded from this device: the server holds the same text under a new id.
      { text: 'From the other phone', category: 'custom', isCustom: true, userId: A, createdAt: at },
      { text: `legacy ${A}`, category: 'custom', isCustom: true, createdAt: at },
      { text: `other ${A}`, category: 'custom', isCustom: true, userId: `${A}-other`, createdAt: at },
    ]);
    markUploaded(A);
    server.fetchCustomMessages.mockResolvedValue([
      {
        serverId: `srv-${A}`, text: 'new text', category: 'memory', active: true, isFavorite: true,
        tags: [], createdAt: at, updatedAt: at,
      },
      {
        serverId: `srv2-${A}`, text: 'from the other phone', category: 'custom', active: false,
        isFavorite: false, tags: ['t'], createdAt: at, updatedAt: at,
      },
    ]);
    server.fetchFavoriteKeys.mockResolvedValue([await bundledMessageKey(bundledText)]);

    await useAppStore.getState().loadMessageDataFromServer();

    const mine = (await diskRows()).filter((row) => row.userId === A);
    expect(mine.map((row) => [row.serverId, row.text]).sort()).toEqual([
      [`srv-${A}`, 'new text'],
      [`srv2-${A}`, 'from the other phone'],
    ]);
    // The matched row kept its local id.
    expect(mine.find((row) => row.serverId === `srv-${A}`)?.id).toBe(syncedId);
    // Nobody's and somebody else's rows are untouched.
    expect((await diskRows()).map((row) => row.id)).toEqual(expect.arrayContaining([legacyId, otherId]));
    expect((await diskFavorites(A)).map((f) => f.messageId).sort()).toEqual([bundledId, syncedId].sort());
    // And the store now projects them.
    const favoriteIds = useAppStore.getState().messageHistory.favoriteIds;
    expect(favoriteIds).toEqual(expect.arrayContaining([bundledId, syncedId]));
  });

  it('keeps the mirror when the server read fails', async () => {
    await seed([{ text: 'keep me', category: 'custom', isCustom: true, userId: A, createdAt: at }]);
    markUploaded(A);
    server.fetchCustomMessages.mockRejectedValue(offline());
    server.fetchFavoriteKeys.mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().loadMessageDataFromServer();

    expect((await diskRows()).some((row) => row.userId === A && row.text === 'keep me')).toBe(true);
  });

  it('favorites a bundled message on the server by its text hash, then mirrors it', async () => {
    const bundledText = `FAV-${A}`;
    const [id] = await seed([{ text: bundledText, category: 'reason', isCustom: false, createdAt: at }]);
    server.addFavorite.mockResolvedValue(undefined);
    await useAppStore.getState().loadMessages();

    await useAppStore.getState().toggleFavorite(id);

    expect(server.addFavorite).toHaveBeenCalledWith(A, await bundledMessageKey(bundledText));
    expect((await diskFavorites(A)).map((f) => f.messageId)).toEqual([id]);
    expect(useAppStore.getState().messageHistory.favoriteIds).toContain(id);
    expect(useAppStore.getState().favoriteError).toBeNull();
  });

  it('favorites a custom message through its row’s is_favorite', async () => {
    const [id] = await seed([
      { text: 'mine', category: 'custom', isCustom: true, userId: A, serverId: `srv-${A}`, createdAt: at },
    ]);
    server.updateCustomMessage.mockResolvedValue({});

    await useAppStore.getState().toggleFavorite(id);

    expect(server.updateCustomMessage).toHaveBeenCalledWith(`srv-${A}`, { isFavorite: true });
    expect((await diskFavorites(A)).map((f) => f.messageId)).toEqual([id]);
  });

  it('a favorite tapped while the refresh is reading is not erased by that refresh', async () => {
    const [id] = await seed([{ text: `RACE-${A}`, category: 'reason', isCustom: false, createdAt: at }]);
    markUploaded(A);
    await useAppStore.getState().loadMessages();
    // The refresh's snapshot predates the tap, so it holds no favorite.
    const snapshot = deferred<string[]>();
    server.fetchCustomMessages.mockResolvedValue([]);
    server.fetchFavoriteKeys.mockReturnValue(snapshot.promise);
    server.addFavorite.mockResolvedValue(undefined);

    const refresh = useAppStore.getState().loadMessageDataFromServer();
    await vi.waitFor(() => expect(server.fetchFavoriteKeys).toHaveBeenCalled());
    const tap = useAppStore.getState().toggleFavorite(id);
    snapshot.settle([]);
    await Promise.all([refresh, tap]);

    expect((await diskFavorites(A)).map((f) => f.messageId)).toEqual([id]);
    expect(useAppStore.getState().messageHistory.favoriteIds).toContain(id);
  });

  it('un-favoriting a bundled message removes its text-hash key on the server', async () => {
    const bundledText = `OFF-BUNDLED-${A}`;
    const [id] = await seed([{ text: bundledText, category: 'reason', isCustom: false, createdAt: at }]);
    server.addFavorite.mockResolvedValue(undefined);
    server.removeFavorite.mockResolvedValue(undefined);

    await useAppStore.getState().toggleFavorite(id);
    await useAppStore.getState().toggleFavorite(id);

    expect(server.removeFavorite).toHaveBeenCalledWith(A, await bundledMessageKey(bundledText));
    expect(await diskFavorites(A)).toEqual([]);
  });

  it('un-favoriting a custom message clears is_favorite on its row', async () => {
    const [id] = await seed([
      { text: 'mine', category: 'custom', isCustom: true, userId: A, serverId: `srv-off-${A}`, createdAt: at },
    ]);
    server.updateCustomMessage.mockResolvedValue({});

    await useAppStore.getState().toggleFavorite(id);
    await useAppStore.getState().toggleFavorite(id);

    expect(server.updateCustomMessage).toHaveBeenLastCalledWith(`srv-off-${A}`, { isFavorite: false });
    expect(await diskFavorites(A)).toEqual([]);
  });

  it('the refresh drops local favorites the server no longer holds', async () => {
    const [bundledId, customId] = await seed([
      { text: `DROP-${A}`, category: 'reason', isCustom: false, createdAt: at },
      { text: 'custom fav', category: 'custom', isCustom: true, userId: A, serverId: `srv-drop-${A}`, createdAt: at },
    ]);
    await putFavorite(bundledId);
    await putFavorite(customId);
    markUploaded(A);
    server.fetchCustomMessages.mockResolvedValue([
      {
        serverId: `srv-drop-${A}`, text: 'custom fav', category: 'custom', active: true, isFavorite: false,
        tags: [], createdAt: at, updatedAt: at,
      },
    ]);
    server.fetchFavoriteKeys.mockResolvedValue([]);

    await useAppStore.getState().loadMessageDataFromServer();

    expect(await diskFavorites(A)).toEqual([]);
  });

  it('the refresh keeps an owned row the server never received, and drops its uploaded duplicate', async () => {
    const tooLong = 'x'.repeat(1001);
    const [invalidId, duplicateId, goneId] = await seed([
      // Skipped by the upload as invalid: the server never had it.
      { text: tooLong, category: 'custom', isCustom: true, userId: A, createdAt: at },
      // Uploaded (the server holds the same text): the server row replaces it.
      { text: '  Same Text  ', category: 'custom', isCustom: true, userId: A, createdAt: at },
      // A server row since deleted elsewhere.
      { text: 'gone', category: 'custom', isCustom: true, userId: A, serverId: `srv-gone-${A}`, createdAt: at },
    ]);
    await putFavorite(invalidId);
    markUploaded(A);
    server.fetchCustomMessages.mockResolvedValue([
      {
        serverId: `srv-same-${A}`, text: 'same text', category: 'custom', active: true, isFavorite: false,
        tags: [], createdAt: at, updatedAt: at,
      },
    ]);
    server.fetchFavoriteKeys.mockResolvedValue([]);

    await useAppStore.getState().loadMessageDataFromServer();

    const mine = (await diskRows()).filter((row) => row.userId === A);
    const ids = mine.map((row) => row.id);
    expect(ids).toContain(invalidId);
    expect(ids).not.toContain(duplicateId);
    expect(ids).not.toContain(goneId);
    // Kept and marked: the only row a local-only delete may remove.
    expect(mine.find((row) => row.id === invalidId)).toMatchObject({ text: tooLong, localOnly: true });
    expect(mine.filter((row) => row.localOnly).map((row) => row.id)).toEqual([invalidId]);
    expect(mine.some((row) => row.serverId === `srv-same-${A}`)).toBe(true);
    // Untouched means its favorite too.
    expect((await diskFavorites(A)).map((f) => f.messageId)).toEqual([invalidId]);
  });

  it('offline: shows the reason, changes nothing, and sign-out clears the message', async () => {
    const [id] = await seed([{ text: `OFF-${A}`, category: 'reason', isCustom: false, createdAt: at }]);
    server.addFavorite.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. Favorites need a connection to save.')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().toggleFavorite(id);

    expect(useAppStore.getState().favoriteError).toMatch(/offline/i);
    expect(await diskFavorites(A)).toEqual([]);
    expect(useAppStore.getState().messageHistory.favoriteIds).not.toContain(id);

    useAppStore.getState().clearAuth();
    expect(useAppStore.getState().favoriteError).toBeNull();
  });

  it('does not show one account’s favorite error to the next', async () => {
    const [id] = await seed([{ text: `SW-${A}`, category: 'reason', isCustom: false, createdAt: at }]);
    const pending = deferred<void>();
    server.addFavorite.mockReturnValue(pending.promise);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const inFlight = useAppStore.getState().toggleFavorite(id);
    await vi.waitFor(() => expect(server.addFavorite).toHaveBeenCalled());
    useAppStore.setState({ userId: 'USER-C' } as StoreState);
    pending.fail(offline());
    await inFlight;

    expect(useAppStore.getState().favoriteError).toBeNull();
  });
});
