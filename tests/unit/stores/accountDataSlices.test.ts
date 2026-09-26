/**
 * Custom messages and favorites moved to Supabase — the store side:
 * server-first writes, the identity guard around every await, the mirror
 * refresh, and the favorite error that sign-out must clear.
 *
 * The server is faked per module; the local copies are real (fake-indexeddb),
 * so the refresh's effect on disk is read back, not assumed. Each case signs
 * in as a fresh user id, because the copies share one database for the whole
 * file — exactly as they do on a shared device.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
  createAnniversary: vi.fn(),
  updateAnniversary: vi.fn(),
  deleteAnniversary: vi.fn(),
  fetchAnniversaries: vi.fn(),
  fetchCustomMessages: vi.fn(),
  createCustomMessage: vi.fn(),
  updateCustomMessage: vi.fn(),
  deleteCustomMessage: vi.fn(),
  fetchFavoriteKeys: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() },
  getPartnerId: vi.fn(),
}));

/**
 * When set, `readLocalCopy` answers through this instead of IndexedDB, so a
 * case can hold the copy read open while something newer lands.
 */
const copyRead = vi.hoisted(() => ({ hook: null as null | (() => Promise<unknown>) }));
vi.mock('../../../src/services/localCopy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/localCopy')>();
  return {
    ...actual,
    readLocalCopy: (userId: string, kind: string) =>
      copyRead.hook ? copyRead.hook() : actual.readLocalCopy(userId, kind),
  };
});

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
    createCustomMessage: server.createCustomMessage,
    updateCustomMessage: server.updateCustomMessage,
    deleteCustomMessage: server.deleteCustomMessage,
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

import { VALIDATION_LIMITS } from '../../../src/config/performance';
import { AccountDataError } from '../../../src/services/accountDataError';
import type { MessageDataCopy } from '../../../src/services/customMessageService';
import { readLocalCopy, refreshLocalCopies, refreshLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { bundledMessageKey } from '../../../src/services/messageFavoritesApi';
import { storageService } from '../../../src/services/storage';
import { ACCOUNT_OWNER_STORAGE_KEY } from '../../../src/stores/slices/authSlice';
import { CustomMessagesImportError, MESSAGE_DATA_COPY_KIND } from '../../../src/stores/slices/messagesSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { Message } from '../../../src/types';
import { deferred, offline, setAnniversaries, setOnline, type StoreState } from './accountDataFixtures';

let counter = 0;
let A = '';

beforeEach(() => {
  for (const fn of Object.values(server)) fn.mockReset();
  copyRead.hook = null;
  A = `user-${++counter}`;
  useAppStore.setState({ messages: [], currentMessage: null } as StoreState);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser(A);
  localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
  setAnniversaries([]);
  setOnline(true);
});

describe('messages: favorites, custom messages and the message-data copy', () => {
  const at = new Date('2026-01-01T00:00:00.000Z');

  /** Bundled rows, straight into the shared `messages` store. */
  async function seedBundled(texts: string[]): Promise<number[]> {
    await storageService.init();
    const ids: number[] = [];
    for (const text of texts) {
      ids.push(await storageService.addMessage({ text, category: 'reason', isCustom: false, createdAt: at }));
    }
    return ids;
  }

  async function copyOf(userId: string): Promise<MessageDataCopy | null> {
    return readLocalCopy<MessageDataCopy>(userId, MESSAGE_DATA_COPY_KIND);
  }

  function customRow(id: number, serverId: string | undefined, text: string, extra: Partial<Message> = {}): Message {
    return {
      id,
      text,
      category: 'custom',
      isCustom: true,
      userId: A,
      ...(serverId ? { serverId } : {}),
      active: true,
      isFavorite: false,
      createdAt: at,
      tags: [],
      ...extra,
    };
  }

  async function putCopy(userId: string, value: Partial<MessageDataCopy>) {
    await writeLocalCopy<MessageDataCopy>(userId, MESSAGE_DATA_COPY_KIND, {
      custom: [],
      bundledFavoriteIds: [],
      nextCustomId: 1,
      ...value,
    });
  }

  function serverRow(serverId: string, text: string, extra: Record<string, unknown> = {}) {
    return {
      serverId, text, category: 'custom', active: true, isFavorite: false,
      tags: [], createdAt: at, updatedAt: at, ...extra,
    };
  }

  // Custom ids sit far above the bundled rows this shared database collects.
  const BASE = 100_000;

  /** A custom-messages backup file; `extra` adds fields to every message. */
  function exportFile(texts: string[], extra: Record<string, unknown> = {}) {
    return {
      version: '1.0',
      exportDate: '2026-09-12T00:00:00.000Z',
      messageCount: texts.length,
      messages: texts.map((text) => ({
        text, category: 'custom', active: true, tags: [],
        createdAt: '2026-08-03T06:00:00.000Z', updatedAt: '2026-08-03T06:00:00.000Z',
        ...extra,
      })),
    };
  }

  it('replaces the owner’s copy with the server’s rows and favorites, and nobody else’s', async () => {
    const bundledText = `DAILY-${A}`;
    const [bundledId] = await seedBundled([bundledText]);
    await putCopy(A, {
      custom: [
        customRow(BASE, `srv-${A}`, 'old text'),
        // Owned but with no server id: not in the account, so the refresh drops it.
        customRow(BASE + 1, undefined, 'never synced'),
      ],
      nextCustomId: BASE + 2,
    });
    const other = `${A}-other`;
    await putCopy(other, { custom: [customRow(7, 'srv-other', 'OTHER-PRIVATE')], nextCustomId: 8 });
    server.fetchCustomMessages.mockResolvedValue([
      serverRow(`srv-${A}`, 'new text', { category: 'memory', isFavorite: true }),
      serverRow(`srv2-${A}`, 'from the other phone', { active: false, tags: ['t'] }),
    ]);
    server.fetchFavoriteKeys.mockResolvedValue([await bundledMessageKey(bundledText)]);

    await useAppStore.getState().loadMessageDataFromServer();

    const copy = await copyOf(A);
    // The matched row kept its local id; the new one took the next id, never
    // the freed BASE + 1.
    expect(copy?.custom.map((row) => [row.id, row.serverId, row.text, row.isFavorite])).toEqual([
      [BASE, `srv-${A}`, 'new text', true],
      [BASE + 2, `srv2-${A}`, 'from the other phone', false],
    ]);
    expect(copy?.bundledFavoriteIds).toEqual([bundledId]);
    expect(copy?.nextCustomId).toBe(BASE + 3);
    // Another account's copy is untouched.
    expect((await copyOf(other))?.custom.map((row) => row.text)).toEqual(['OTHER-PRIVATE']);
    // And the store now shows them.
    const state = useAppStore.getState();
    expect(state.messageHistory.favoriteIds).toEqual(expect.arrayContaining([bundledId, BASE]));
    expect(state.messages.filter((m) => m.isCustom).map((m) => m.text)).toEqual([
      'new text',
      'from the other phone',
    ]);
  });

  it('keeps the copy when the server read fails', async () => {
    await seedBundled([`KEEP-${A}`]);
    await putCopy(A, { custom: [customRow(BASE, `srv-${A}`, 'keep me')], nextCustomId: BASE + 1 });
    server.fetchCustomMessages.mockRejectedValue(offline());
    server.fetchFavoriteKeys.mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().loadMessageDataFromServer();

    expect((await copyOf(A))?.custom.map((row) => row.text)).toEqual(['keep me']);
    expect(useAppStore.getState().messages.some((m) => m.text === 'keep me')).toBe(true);
  });

  it('offline start: shows the saved custom messages and favorites without asking the server', async () => {
    const [bundledId] = await seedBundled([`OFFLINE-${A}`]);
    await putCopy(A, {
      custom: [customRow(BASE, `srv-${A}`, 'saved custom', { isFavorite: true })],
      bundledFavoriteIds: [bundledId],
      nextCustomId: BASE + 1,
    });
    setOnline(false);

    await useAppStore.getState().loadMessageDataFromServer();
    await useAppStore.getState().loadCustomMessages();

    expect(server.fetchCustomMessages).not.toHaveBeenCalled();
    const state = useAppStore.getState();
    expect(state.messages.find((m) => m.id === BASE)).toMatchObject({ text: 'saved custom', isFavorite: true });
    expect(state.messages.find((m) => m.id === bundledId)?.isFavorite).toBe(true);
    expect(state.customMessages.map((m) => m.text)).toEqual(['saved custom']);
  });

  it('favorites a bundled message on the server by its text hash, then saves it in the copy', async () => {
    const bundledText = `FAV-${A}`;
    const [id] = await seedBundled([bundledText]);
    server.addFavorite.mockResolvedValue(undefined);
    await useAppStore.getState().loadMessages();

    await useAppStore.getState().toggleFavorite(id);

    expect(server.addFavorite).toHaveBeenCalledWith(A, await bundledMessageKey(bundledText));
    expect((await copyOf(A))?.bundledFavoriteIds).toEqual([id]);
    expect(useAppStore.getState().messageHistory.favoriteIds).toContain(id);
    expect(useAppStore.getState().favoriteError).toBeNull();
  });

  it('favorites a custom message through its row’s is_favorite', async () => {
    await putCopy(A, { custom: [customRow(BASE, `srv-${A}`, 'mine')], nextCustomId: BASE + 1 });
    server.updateCustomMessage.mockResolvedValue({});

    await useAppStore.getState().toggleFavorite(BASE);

    expect(server.updateCustomMessage).toHaveBeenCalledWith(`srv-${A}`, { isFavorite: true });
    expect((await copyOf(A))?.custom[0]).toMatchObject({ id: BASE, isFavorite: true });
  });

  it('a favorite tapped while the refresh is reading is not erased by that refresh', async () => {
    const [id] = await seedBundled([`RACE-${A}`]);
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

    expect((await copyOf(A))?.bundledFavoriteIds).toEqual([id]);
    expect(useAppStore.getState().messageHistory.favoriteIds).toContain(id);
  });

  it('un-favoriting a bundled message removes its text-hash key on the server', async () => {
    const bundledText = `OFF-BUNDLED-${A}`;
    const [id] = await seedBundled([bundledText]);
    server.addFavorite.mockResolvedValue(undefined);
    server.removeFavorite.mockResolvedValue(undefined);

    await useAppStore.getState().toggleFavorite(id);
    await useAppStore.getState().toggleFavorite(id);

    expect(server.removeFavorite).toHaveBeenCalledWith(A, await bundledMessageKey(bundledText));
    expect((await copyOf(A))?.bundledFavoriteIds).toEqual([]);
  });

  it('un-favoriting a custom message clears is_favorite on its row', async () => {
    await putCopy(A, { custom: [customRow(BASE, `srv-off-${A}`, 'mine')], nextCustomId: BASE + 1 });
    server.updateCustomMessage.mockResolvedValue({});

    await useAppStore.getState().toggleFavorite(BASE);
    await useAppStore.getState().toggleFavorite(BASE);

    expect(server.updateCustomMessage).toHaveBeenLastCalledWith(`srv-off-${A}`, { isFavorite: false });
    expect((await copyOf(A))?.custom[0].isFavorite).toBe(false);
  });

  it('the refresh drops local favorites the server no longer holds', async () => {
    const [bundledId] = await seedBundled([`DROP-${A}`]);
    await putCopy(A, {
      custom: [customRow(BASE, `srv-drop-${A}`, 'custom fav', { isFavorite: true })],
      bundledFavoriteIds: [bundledId],
      nextCustomId: BASE + 1,
    });
    server.fetchCustomMessages.mockResolvedValue([serverRow(`srv-drop-${A}`, 'custom fav')]);
    server.fetchFavoriteKeys.mockResolvedValue([]);

    await useAppStore.getState().loadMessageDataFromServer();

    const copy = await copyOf(A);
    expect(copy?.bundledFavoriteIds).toEqual([]);
    expect(copy?.custom[0]).toMatchObject({ id: BASE, isFavorite: false });
  });

  it('the refresh drops every owned row the server does not hold', async () => {
    await seedBundled([`GONE-${A}`]);
    await putCopy(A, {
      custom: [
        // No server id, and no server row of the same text; one character over
        // the custom-message limit, so it could never have been saved anyway.
        customRow(BASE, undefined, 'x'.repeat(VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH + 1), {
          isFavorite: true,
        }),
        // No server id; the server holds the same text under its own id.
        customRow(BASE + 1, undefined, '  Same Text  '),
        // A server row since deleted elsewhere.
        customRow(BASE + 2, `srv-gone-${A}`, 'gone'),
      ],
      nextCustomId: BASE + 3,
    });
    server.fetchCustomMessages.mockResolvedValue([serverRow(`srv-same-${A}`, 'same text')]);
    server.fetchFavoriteKeys.mockResolvedValue([]);

    await useAppStore.getState().loadMessageDataFromServer();

    const copy = await copyOf(A);
    expect(copy?.custom.map((row) => [row.id, row.serverId])).toEqual([[BASE + 3, `srv-same-${A}`]]);
  });

  /** Favorites a bundled message while the server refuses it as offline; returns its id. */
  async function failFavoriteOffline() {
    const [id] = await seedBundled([`OFF-${A}`]);
    server.addFavorite.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. Favorites need a connection to save.')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().toggleFavorite(id);
    return id;
  }

  it('offline: shows the reason and changes nothing', async () => {
    const id = await failFavoriteOffline();

    expect(useAppStore.getState().favoriteError).toMatch(/offline/i);
    expect(await copyOf(A)).toBeNull();
    expect(useAppStore.getState().messageHistory.favoriteIds).not.toContain(id);
  });

  it('offline: sign-out clears the favorite error', async () => {
    await failFavoriteOffline();
    expect(useAppStore.getState().favoriteError).toMatch(/offline/i);

    useAppStore.getState().clearAuth();
    expect(useAppStore.getState().favoriteError).toBeNull();
  });

  it('does not show one account’s favorite error to the next', async () => {
    const [id] = await seedBundled([`SW-${A}`]);
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

  it('a favorite confirmed after an account switch is not saved into either copy', async () => {
    const [id] = await seedBundled([`SWITCH-${A}`]);
    const pending = deferred<void>();
    server.addFavorite.mockReturnValue(pending.promise);

    const inFlight = useAppStore.getState().toggleFavorite(id);
    await vi.waitFor(() => expect(server.addFavorite).toHaveBeenCalled());
    const outgoing = A;
    useAppStore.getState().setAuthUser(`${A}-next`);
    pending.settle();
    await inFlight;

    expect(await copyOf(outgoing)).toBeNull();
    expect(await copyOf(`${A}-next`)).toBeNull();
    expect(useAppStore.getState().messageHistory.favoriteIds).not.toContain(id);
  });

  it('two favorite taps in a row commit on, then off', async () => {
    const bundledText = `TWICE-${A}`;
    const [id] = await seedBundled([bundledText]);
    await useAppStore.getState().loadMessages();
    server.addFavorite.mockResolvedValue(undefined);
    server.removeFavorite.mockResolvedValue(undefined);

    const first = useAppStore.getState().toggleFavorite(id);
    const second = useAppStore.getState().toggleFavorite(id);
    await Promise.all([first, second]);

    const key = await bundledMessageKey(bundledText);
    expect(server.addFavorite).toHaveBeenCalledWith(A, key);
    expect(server.removeFavorite).toHaveBeenCalledWith(A, key);
    expect(server.addFavorite.mock.invocationCallOrder[0]).toBeLessThan(
      server.removeFavorite.mock.invocationCallOrder[0]
    );
    expect((await copyOf(A))?.bundledFavoriteIds).toEqual([]);
    expect(useAppStore.getState().messageHistory.favoriteIds).not.toContain(id);
  });

  it('an unreadable copy is rebuilt from what this session shows, never from nothing', async () => {
    const [favoritedId, tappedId] = await seedBundled([`SHOWN-FAV-${A}`, `SHOWN-TAP-${A}`]);
    await putCopy(A, {
      custom: [customRow(BASE, `srv-shown-${A}`, 'shown custom')],
      bundledFavoriteIds: [favoritedId],
      nextCustomId: BASE + 1,
    });
    await useAppStore.getState().loadMessages();
    server.addFavorite.mockResolvedValue(undefined);

    // (a) A favorite saved while the copy cannot be read keeps what is shown.
    copyRead.hook = async () => null;
    await useAppStore.getState().toggleFavorite(tappedId);
    copyRead.hook = null;

    let copy = await copyOf(A);
    expect(copy?.custom.map((row) => [row.id, row.serverId])).toEqual([[BASE, `srv-shown-${A}`]]);
    expect([...(copy?.bundledFavoriteIds ?? [])].sort()).toEqual([favoritedId, tappedId].sort());

    // (b) A refresh over an unreadable copy keeps the shown row's local id.
    // One readable refresh first marks the session fresh, so the second one
    // goes straight to the server instead of re-showing the (unreadable) copy.
    server.fetchCustomMessages.mockResolvedValue([serverRow(`srv-shown-${A}`, 'shown custom')]);
    server.fetchFavoriteKeys.mockResolvedValue([]);
    await useAppStore.getState().loadMessageDataFromServer();
    copyRead.hook = async () => null;
    await useAppStore.getState().loadMessageDataFromServer();
    copyRead.hook = null;

    copy = await copyOf(A);
    expect(copy?.custom.map((row) => [row.id, row.serverId])).toEqual([[BASE, `srv-shown-${A}`]]);
  });

  it('the refresher no-ops until the bundled rows are seeded', async () => {
    useAppStore.setState({ messages: [] } as StoreState);

    await refreshLocalCopy(MESSAGE_DATA_COPY_KIND);

    expect(server.fetchCustomMessages).not.toHaveBeenCalled();
    expect(server.fetchFavoriteKeys).not.toHaveBeenCalled();
  });

  it('once seeded, refreshLocalCopies brings in a favorite added on another device', async () => {
    const bundledText = `RECONNECT-${A}`;
    const [id] = await seedBundled([bundledText]);
    await useAppStore.getState().loadMessages();
    server.fetchCustomMessages.mockResolvedValue([]);
    server.fetchFavoriteKeys.mockResolvedValue([await bundledMessageKey(bundledText)]);

    await refreshLocalCopies();

    expect(server.fetchFavoriteKeys).toHaveBeenCalledWith(A);
    expect((await copyOf(A))?.bundledFavoriteIds).toEqual([id]);
    expect(useAppStore.getState().messageHistory.favoriteIds).toContain(id);
  });

  it('a refresh that lands after sign-out does not put the copy back', async () => {
    const [id] = await seedBundled([`LATE-${A}`]);
    await useAppStore.getState().loadMessages();
    const keys = deferred<string[]>();
    server.fetchCustomMessages.mockResolvedValue([
      serverRow(`srv-late-${A}`, 'late custom', { isFavorite: true }),
    ]);
    server.fetchFavoriteKeys.mockReturnValue(keys.promise);

    const refresh = useAppStore.getState().loadMessageDataFromServer();
    await vi.waitFor(() => expect(server.fetchFavoriteKeys).toHaveBeenCalled());
    useAppStore.getState().clearAuth();
    keys.settle([await bundledMessageKey(`LATE-${A}`)]);
    await refresh;

    expect(await copyOf(A)).toBeNull();
    expect(useAppStore.getState().messages.some((m) => m.isCustom)).toBe(false);
    expect(useAppStore.getState().messages.some((m) => m.id === id)).toBe(true);
  });

  it('sign-out: the next account sees none of the outgoing account’s rows or favorites', async () => {
    const [bundledId] = await seedBundled([`SIGNOUT-${A}`]);
    await putCopy(A, {
      custom: [customRow(BASE, `srv-${A}`, 'A-PRIVATE', { isFavorite: true })],
      bundledFavoriteIds: [bundledId],
      nextCustomId: BASE + 1,
    });
    await useAppStore.getState().loadMessages();
    await useAppStore.getState().loadCustomMessages();
    expect(useAppStore.getState().messages.some((m) => m.text === 'A-PRIVATE')).toBe(true);
    const outgoing = A;

    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser(`${A}-B`);
    await vi.waitFor(async () => expect(await copyOf(outgoing)).toBeNull());
    await useAppStore.getState().loadMessages();
    await useAppStore.getState().loadCustomMessages();

    const state = useAppStore.getState();
    expect(state.messages.some((m) => m.isCustom)).toBe(false);
    expect(state.messages.find((m) => m.id === bundledId)?.isFavorite).toBe(false);
    expect(state.messageHistory.favoriteIds).toEqual([]);
    expect(state.customMessages).toEqual([]);
  });

  describe('custom-message writes', () => {
    beforeEach(() => {
      let serial = 0;
      server.createCustomMessage.mockImplementation(async (_userId: string, fields: Record<string, unknown>) =>
        serverRow(`srv-new-${A}-${++serial}`, fields.text as string, fields)
      );
      server.deleteCustomMessage.mockResolvedValue(undefined);
    });

    it('creates on the server, then saves the row under an id above every bundled id', async () => {
      const [bundledId] = await seedBundled([`CREATE-${A}`]);

      await useAppStore.getState().createCustomMessage({ text: 'brand new', category: 'custom' }, 'key-1');

      expect(server.createCustomMessage).toHaveBeenCalledWith(
        A, expect.objectContaining({ text: 'brand new' }), 'key-1'
      );
      const copy = await copyOf(A);
      expect(copy?.custom).toHaveLength(1);
      expect(copy?.custom[0].id).toBeGreaterThan(bundledId);
      expect(copy?.nextCustomId).toBe(copy!.custom[0].id + 1);
      const state = useAppStore.getState();
      expect(state.customMessages.map((m) => m.text)).toEqual(['brand new']);
      expect(state.messages.at(-1)).toMatchObject({ text: 'brand new', isCustom: true });
    });

    it('never hands a deleted row’s id to a new one', async () => {
      await seedBundled([`REUSE-${A}`]);

      await useAppStore.getState().createCustomMessage({ text: 'first', category: 'custom' });
      const firstId = (await copyOf(A))!.custom[0].id;
      await useAppStore.getState().deleteCustomMessage(firstId);
      await useAppStore.getState().createCustomMessage({ text: 'second', category: 'custom' });

      const copy = await copyOf(A);
      expect(copy?.custom.map((row) => row.text)).toEqual(['second']);
      expect(copy!.custom[0].id).toBeGreaterThan(firstId);
      expect(server.deleteCustomMessage).toHaveBeenCalledWith(`srv-new-${A}-1`);
    });

    it('a retried create that resolves to a row already in the copy does not add it twice', async () => {
      await seedBundled([`RETRY-${A}`]);
      await putCopy(A, { custom: [customRow(BASE, 'srv-retried', 'retried')], nextCustomId: BASE + 1 });
      server.createCustomMessage.mockResolvedValueOnce(serverRow('srv-retried', 'retried'));

      await useAppStore.getState().createCustomMessage({ text: 'retried', category: 'custom' }, 'submit-1');

      expect((await copyOf(A))?.custom.map((row) => row.id)).toEqual([BASE]);
    });

    it('offline: a create throws and leaves the copy unchanged', async () => {
      await seedBundled([`OFFCREATE-${A}`]);
      await putCopy(A, { custom: [customRow(BASE, `srv-${A}`, 'kept')], nextCustomId: BASE + 1 });
      server.createCustomMessage.mockRejectedValue(offline());
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        useAppStore.getState().createCustomMessage({ text: 'x', category: 'custom' })
      ).rejects.toMatchObject({ code: 'offline' });

      expect(await copyOf(A)).toEqual({
        custom: [customRow(BASE, `srv-${A}`, 'kept')],
        bundledFavoriteIds: [],
        nextCustomId: BASE + 1,
      });
    });

    it('edits by server id and saves the confirmed row under its local id', async () => {
      await seedBundled([`EDIT-${A}`]);
      await putCopy(A, { custom: [customRow(BASE, `srv-${A}`, 'before')], nextCustomId: BASE + 1 });
      server.updateCustomMessage.mockResolvedValue(serverRow(`srv-${A}`, 'after', { active: false }));

      await useAppStore.getState().updateCustomMessage({ id: BASE, text: 'after', active: false });

      expect(server.updateCustomMessage).toHaveBeenCalledWith(`srv-${A}`, { text: 'after', active: false });
      expect((await copyOf(A))?.custom[0]).toMatchObject({ id: BASE, text: 'after', active: false });
    });

    it('refuses to edit or delete a row that is not in this account’s copy', async () => {
      await seedBundled([`CROSS-${A}`]);
      const other = `${A}-other`;
      await putCopy(other, { custom: [customRow(BASE, 'srv-other', 'OTHER')], nextCustomId: BASE + 1 });
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        useAppStore.getState().updateCustomMessage({ id: BASE, text: 'hijack' })
      ).rejects.toThrow(/not found for this user/);
      await useAppStore.getState().deleteCustomMessage(BASE);

      expect(server.updateCustomMessage).not.toHaveBeenCalled();
      expect(server.deleteCustomMessage).not.toHaveBeenCalled();
      expect((await copyOf(other))?.custom.map((row) => row.text)).toEqual(['OTHER']);
    });

    it('refuses to edit or delete a row with no server id, without calling the server', async () => {
      await seedBundled([`UNSYNCED-${A}`]);
      await putCopy(A, { custom: [customRow(BASE, undefined, 'local only')], nextCustomId: BASE + 1 });
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        useAppStore.getState().updateCustomMessage({ id: BASE, text: 'x' })
      ).rejects.toMatchObject({ code: 'not-synced' });
      await expect(useAppStore.getState().deleteCustomMessage(BASE)).rejects.toMatchObject({
        code: 'not-synced',
      });
      expect((await copyOf(A))?.custom.map((row) => row.id)).toEqual([BASE]);
    });

    it('import skips duplicates of the importer’s own rows only, and export holds only them', async () => {
      await seedBundled([`IMPORT-${A}`]);
      await putCopy(A, { custom: [customRow(BASE, `srv-${A}`, 'Mine Already')], nextCustomId: BASE + 1 });
      await putCopy(`${A}-other`, { custom: [customRow(BASE, 'srv-other', 'Theirs')], nextCustomId: BASE + 1 });
      const file = exportFile(['mine already', 'Theirs', 'Theirs'], { userId: `${A}-other` });

      const result = await useAppStore
        .getState()
        .importCustomMessages(new File([JSON.stringify(file)], 'backup.json'));

      expect(result).toEqual({ imported: 1, skipped: 2 });
      expect((await copyOf(A))?.custom.map((row) => [row.text, row.userId])).toEqual([
        ['Mine Already', A],
        ['Theirs', A],
      ]);
      // Only the one new row reached the server.
      expect(server.createCustomMessage).toHaveBeenCalledTimes(1);
    });

    it('gives each imported row its own key, never one derived from the text', async () => {
      // A text-derived key would belong to a message edited since its import,
      // so a re-import would get the edited row back and store nothing.
      await seedBundled([`IMPORT-KEYS-${A}`]);
      const file = exportFile(['First import', 'Second import']);

      await useAppStore.getState().importCustomMessages(new File([JSON.stringify(file)], 'backup.json'));

      const keys = server.createCustomMessage.mock.calls.map((call) => call[2] as string);
      expect(keys).toHaveLength(2);
      expect(new Set(keys).size).toBe(2);
      expect(keys.some((key) => /^i:/.test(key))).toBe(false);
    });

    it('an import that stops partway shows the saved rows now and says how many were imported', async () => {
      await seedBundled([`IMPORT-PARTIAL-${A}`]);
      const file = exportFile(['Saved first', 'Stopped here', 'Never tried']);
      const stop = offline();
      server.createCustomMessage
        .mockImplementationOnce(async (_userId: string, fields: Record<string, unknown>) =>
          serverRow(`srv-partial-${A}`, fields.text as string, fields)
        )
        .mockRejectedValueOnce(stop);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const failure = await useAppStore
        .getState()
        .importCustomMessages(new File([JSON.stringify(file)], 'backup.json'))
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(CustomMessagesImportError);
      expect(failure).toMatchObject({ imported: 1, total: 3, cause: stop });
      expect(server.createCustomMessage).toHaveBeenCalledTimes(2);
      // Reloaded now, not at the next refresh.
      expect(useAppStore.getState().customMessages.map((m) => m.text)).toEqual(['Saved first']);
    });

    it('an import that saves nothing rethrows the original error', async () => {
      await seedBundled([`IMPORT-NONE-${A}`]);
      const file = exportFile(['Only one']);
      const stop = offline();
      server.createCustomMessage.mockRejectedValueOnce(stop);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        useAppStore.getState().importCustomMessages(new File([JSON.stringify(file)], 'backup.json'))
      ).rejects.toBe(stop);
    });
  });
});
