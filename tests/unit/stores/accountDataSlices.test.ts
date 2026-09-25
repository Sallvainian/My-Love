/**
 * Anniversaries, custom messages and favorites moved to Supabase — the store
 * side: server-first writes, the identity guard around every await, the
 * mirror refresh, and the favorite error that sign-out must clear.
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

import { AccountDataError } from '../../../src/services/accountDataError';
import type { ServerAnniversary } from '../../../src/services/anniversariesService';
import type { MessageDataCopy } from '../../../src/services/customMessageService';
import { readLocalCopy, refreshLocalCopies, refreshLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { bundledMessageKey } from '../../../src/services/messageFavoritesApi';
import { storageService } from '../../../src/services/storage';
import { ACCOUNT_OWNER_STORAGE_KEY } from '../../../src/stores/slices/authSlice';
import { MESSAGE_DATA_COPY_KIND } from '../../../src/stores/slices/messagesSlice';
import { ANNIVERSARIES_COPY_KIND } from '../../../src/stores/slices/settingsSlice';
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

const offline = () => new AccountDataError('offline', 'You are offline. Anniversaries need a connection to save.');

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

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

describe('anniversaries: server first, then the settings mirror', () => {
  const created: ServerAnniversary = { serverId: 'ann-1', date: '2024-02-14', label: 'First date' };

  it('writes the server, then mirrors the row with its server id', async () => {
    server.createAnniversary.mockResolvedValue(created);

    await useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'First date' });

    expect(server.createAnniversary).toHaveBeenCalledWith(
      A,
      { date: '2024-02-14', label: 'First date' },
      expect.any(String)
    );
    expect(anniversaries()).toEqual([{ id: 1, date: '2024-02-14', label: 'First date', serverId: 'ann-1' }]);
  });

  it('a retried add that resolves to an already mirrored row does not list it twice', async () => {
    setAnniversaries([{ id: 3, date: '2024-02-14', label: 'First date', serverId: 'ann-1' }]);
    server.createAnniversary.mockResolvedValue(created);

    await useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'First date' }, 'submit-1');

    expect(server.createAnniversary).toHaveBeenCalledWith(A, { date: '2024-02-14', label: 'First date' }, 'submit-1');
    expect(anniversaries()).toEqual([{ id: 3, date: '2024-02-14', label: 'First date', serverId: 'ann-1' }]);
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

  it('refuses to edit or delete a row with no server id', async () => {
    setAnniversaries([{ id: 5, date: '2024-02-14', label: 'No server id' }]);

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
  it('replaces the mirror, keeping the local id of a row it already had', async () => {
    setAnniversaries([
      { id: 7, date: '2024-02-14', label: 'Stale label', serverId: 'ann-1' },
      { id: 8, date: '2024-03-01', label: 'No server id' },
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
    setAnniversaries([{ id: 1, date: '2024-02-14', label: 'Kept', serverId: 'ann-1' }]);
    server.fetchAnniversaries.mockRejectedValue(offline());
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(anniversaries()).toEqual([{ id: 1, date: '2024-02-14', label: 'Kept', serverId: 'ann-1' }]);
  });

  it('discards a read that lands after the account changed', async () => {
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

describe('anniversaries local copy', () => {
  const row = (serverId: string, label: string): ServerAnniversary => ({
    serverId,
    date: '2024-02-14',
    label,
  });

  it('shows the saved copy offline, without asking the server', async () => {
    await writeLocalCopy(A, ANNIVERSARIES_COPY_KIND, [
      { id: 2, date: '2024-02-14', label: 'Saved', serverId: 'ann-s' },
    ]);
    setOnline(false);

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(anniversaries()).toEqual([{ id: 2, date: '2024-02-14', label: 'Saved', serverId: 'ann-s' }]);
    expect(server.fetchAnniversaries).not.toHaveBeenCalled();
  });

  it('saves the server rows as the copy, and a later session starts from it', async () => {
    server.fetchAnniversaries.mockResolvedValue([row('ann-1', 'From server')]);

    await useAppStore.getState().loadAnniversariesFromServer();

    const saved = [{ id: 1, date: '2024-02-14', label: 'From server', serverId: 'ann-1' }];
    expect(anniversaries()).toEqual(saved);
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual(saved);

    // The same account in a new session, offline: the copy, not the blob.
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser(A);
    // clearAuth deleted A's copies as the outgoing account; save it again as
    // the refresh above did, then start the new session from it.
    await vi.waitFor(async () => expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toBeNull());
    await writeLocalCopy(A, ANNIVERSARIES_COPY_KIND, saved);
    expect(anniversaries()).toEqual([]);
    setOnline(false);
    await useAppStore.getState().loadAnniversariesFromServer();
    expect(anniversaries()).toEqual(saved);
  });

  it('a failed read leaves the shown list and the copy unchanged', async () => {
    const saved = [{ id: 1, date: '2024-02-14', label: 'Saved', serverId: 'ann-1' }];
    await writeLocalCopy(A, ANNIVERSARIES_COPY_KIND, saved);
    server.fetchAnniversaries.mockRejectedValue(new Error('500'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(anniversaries()).toEqual(saved);
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual(saved);
  });

  it('an empty server answer is shown and saved as []', async () => {
    await writeLocalCopy(A, ANNIVERSARIES_COPY_KIND, [
      { id: 1, date: '2024-02-14', label: 'Deleted elsewhere', serverId: 'ann-1' },
    ]);
    server.fetchAnniversaries.mockResolvedValue([]);

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(anniversaries()).toEqual([]);
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual([]);
  });

  it('a copy read that lands after a confirmed write does not replace it', async () => {
    // The copy read is held open; a confirmed add lands while it is pending;
    // then the read resolves with an older list. The newer rows must stay.
    const read = deferred<unknown>();
    copyRead.hook = () => read.promise;
    server.fetchAnniversaries.mockRejectedValue(new Error('500'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const refresh = useAppStore.getState().loadAnniversariesFromServer();
    server.createAnniversary.mockResolvedValue(row('ann-new', 'Added'));
    await useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'Added' });
    read.settle([{ id: 1, date: '2024-02-14', label: 'Old copy', serverId: 'ann-old' }]);
    await refresh;

    expect(anniversaries().map((a) => a.label)).toEqual(['Added']);
  });

  it('a copy read that lands after a server answer does not replace it', async () => {
    const read = deferred<unknown>();
    copyRead.hook = () => read.promise;
    const slowRefresh = useAppStore.getState().loadAnniversariesFromServer();
    // A second refresh, reading no copy, gets the server answer first.
    copyRead.hook = async () => null;
    server.fetchAnniversaries.mockResolvedValueOnce([row('ann-new', 'Server')]);
    await useAppStore.getState().loadAnniversariesFromServer();
    server.fetchAnniversaries.mockRejectedValue(new Error('500'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    read.settle([{ id: 1, date: '2024-02-14', label: 'Old copy', serverId: 'ann-old' }]);
    await slowRefresh;

    expect(anniversaries().map((a) => a.label)).toEqual(['Server']);
  });

  it('each confirmed write updates the copy', async () => {
    server.createAnniversary.mockResolvedValue(row('ann-1', 'Added'));
    await useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'Added' });
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual([
      { id: 1, date: '2024-02-14', label: 'Added', serverId: 'ann-1' },
    ]);

    server.updateAnniversary.mockResolvedValue(row('ann-1', 'Edited'));
    await useAppStore.getState().updateAnniversary(1, { date: '2024-02-14', label: 'Edited' });
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual([
      { id: 1, date: '2024-02-14', label: 'Edited', serverId: 'ann-1' },
    ]);

    server.deleteAnniversary.mockResolvedValue(undefined);
    await useAppStore.getState().removeAnniversary(1);
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual([]);
  });

  it('a failed write leaves the copy unchanged', async () => {
    const saved = [{ id: 1, date: '2024-02-14', label: 'Saved', serverId: 'ann-1' }];
    await writeLocalCopy(A, ANNIVERSARIES_COPY_KIND, saved);
    setAnniversaries(saved);
    server.deleteAnniversary.mockRejectedValue(offline());

    await expect(useAppStore.getState().removeAnniversary(1)).rejects.toThrow(/offline/i);

    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual(saved);
  });

  it('a read raised for one account is neither shown nor saved under the next', async () => {
    const pending = deferred<ServerAnniversary[]>();
    server.fetchAnniversaries.mockReturnValue(pending.promise);

    const inFlight = useAppStore.getState().loadAnniversariesFromServer();
    await vi.waitFor(() => expect(server.fetchAnniversaries).toHaveBeenCalled());
    useAppStore.getState().setAuthUser('USER-C');
    pending.settle([row('ann-a', 'A private')]);
    await inFlight;

    expect(anniversaries()).toEqual([]);
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toBeNull();
    expect(await readLocalCopy('USER-C', ANNIVERSARIES_COPY_KIND)).toBeNull();
  });

  it('refreshLocalCopies reaches the anniversaries (start and reconnect)', async () => {
    server.fetchAnniversaries.mockResolvedValue([row('ann-r', 'Added on the other phone')]);

    await refreshLocalCopies();

    expect(server.fetchAnniversaries).toHaveBeenCalledWith(A);
    expect(anniversaries().map((a) => a.label)).toEqual(['Added on the other phone']);
  });
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
        // No server id, and no server row of the same text.
        customRow(BASE, undefined, 'x'.repeat(1001), { isFavorite: true }),
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

  it('offline: shows the reason, changes nothing, and sign-out clears the message', async () => {
    const [id] = await seedBundled([`OFF-${A}`]);
    server.addFavorite.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. Favorites need a connection to save.')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().toggleFavorite(id);

    expect(useAppStore.getState().favoriteError).toMatch(/offline/i);
    expect(await copyOf(A)).toBeNull();
    expect(useAppStore.getState().messageHistory.favoriteIds).not.toContain(id);

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
      const file = {
        version: '1.0',
        exportDate: '2026-09-12T00:00:00.000Z',
        messageCount: 3,
        messages: ['mine already', 'Theirs', 'Theirs'].map((text) => ({
          text, category: 'custom', active: true, tags: [],
          createdAt: '2026-08-03T06:00:00.000Z', updatedAt: '2026-08-03T06:00:00.000Z',
          userId: `${A}-other`,
        })),
      };

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
      const file = {
        version: '1.0',
        exportDate: '2026-09-12T00:00:00.000Z',
        messageCount: 2,
        messages: ['First import', 'Second import'].map((text) => ({
          text, category: 'custom', active: true, tags: [],
          createdAt: '2026-08-03T06:00:00.000Z', updatedAt: '2026-08-03T06:00:00.000Z',
        })),
      };

      await useAppStore.getState().importCustomMessages(new File([JSON.stringify(file)], 'backup.json'));

      const keys = server.createCustomMessage.mock.calls.map((call) => call[2] as string);
      expect(keys).toHaveLength(2);
      expect(new Set(keys).size).toBe(2);
      expect(keys.some((key) => /^i:/.test(key))).toBe(false);
    });
  });
});
