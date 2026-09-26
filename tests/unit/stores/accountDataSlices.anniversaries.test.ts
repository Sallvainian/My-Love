/**
 * Anniversaries moved to Supabase — the store side: server-first writes, the
 * identity guard around every await, the settings-mirror refresh, and the
 * anniversaries local copy.
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

import type { ServerAnniversary } from '../../../src/services/anniversariesService';
import { readLocalCopy, refreshLocalCopies, writeLocalCopy } from '../../../src/services/localCopy';
import { ACCOUNT_OWNER_STORAGE_KEY } from '../../../src/stores/slices/authSlice';
import { ANNIVERSARIES_COPY_KIND } from '../../../src/stores/slices/settingsSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { Anniversary } from '../../../src/types';
import { deferred, offline, setAnniversaries, setOnline, type StoreState } from './accountDataFixtures';

let counter = 0;
let A = '';

function anniversaries(): Anniversary[] {
  return useAppStore.getState().settings!.relationship.anniversaries;
}

const ANNIVERSARY_DATE = '2024-02-14';

/** A settings-mirror row; `fields` adds a serverId, a description or another date. */
function anniversary(id: number, label: string, fields: Partial<Anniversary> = {}): Anniversary {
  return { id, date: ANNIVERSARY_DATE, label, ...fields };
}

/** A row as `anniversariesService` answers it. */
function serverAnniversary(
  serverId: string,
  label: string,
  fields: Partial<ServerAnniversary> = {}
): ServerAnniversary {
  return { serverId, date: ANNIVERSARY_DATE, label, ...fields };
}

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

describe('anniversaries: server first, then the settings mirror', () => {
  const created = serverAnniversary('ann-1', 'First date');

  it('writes the server, then mirrors the row with its server id', async () => {
    server.createAnniversary.mockResolvedValue(created);

    await useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'First date' });

    expect(server.createAnniversary).toHaveBeenCalledWith(
      A,
      { date: '2024-02-14', label: 'First date' },
      expect.any(String)
    );
    expect(anniversaries()).toEqual([anniversary(1, 'First date', { serverId: 'ann-1' })]);
  });

  it('a retried add that resolves to an already mirrored row does not list it twice', async () => {
    setAnniversaries([anniversary(3, 'First date', { serverId: 'ann-1' })]);
    server.createAnniversary.mockResolvedValue(created);

    await useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'First date' }, 'submit-1');

    expect(server.createAnniversary).toHaveBeenCalledWith(A, { date: '2024-02-14', label: 'First date' }, 'submit-1');
    expect(anniversaries()).toEqual([anniversary(3, 'First date', { serverId: 'ann-1' })]);
  });

  it('offline: rejects with the reason and leaves the mirror as it was', async () => {
    setAnniversaries([anniversary(3, 'Kept', { date: '2020-01-01', serverId: 's' })]);
    server.createAnniversary.mockRejectedValue(offline());

    await expect(
      useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'First date' })
    ).rejects.toThrow(/offline/i);

    expect(anniversaries()).toEqual([anniversary(3, 'Kept', { date: '2020-01-01', serverId: 's' })]);
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
    setAnniversaries([anniversary(9, 'C only', { date: '2021-01-01' })]);
    pending.settle(created);
    await inFlight;

    expect(anniversaries()).toEqual([anniversary(9, 'C only', { date: '2021-01-01' })]);
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
    setAnniversaries([anniversary(4, 'Old', { serverId: 'ann-4' })]);
    server.updateAnniversary.mockResolvedValue(serverAnniversary('ann-4', 'New', { date: '2024-02-15' }));

    await useAppStore.getState().updateAnniversary(4, { date: '2024-02-15', label: 'New' });
    expect(server.updateAnniversary).toHaveBeenCalledWith('ann-4', { date: '2024-02-15', label: 'New' });
    expect(anniversaries()).toEqual([anniversary(4, 'New', { date: '2024-02-15', serverId: 'ann-4' })]);

    server.deleteAnniversary.mockResolvedValue(undefined);
    await useAppStore.getState().removeAnniversary(4);
    expect(server.deleteAnniversary).toHaveBeenCalledWith('ann-4');
    expect(anniversaries()).toEqual([]);
  });

  it('keeps the row when the delete fails', async () => {
    setAnniversaries([anniversary(4, 'Old', { serverId: 'ann-4' })]);
    server.deleteAnniversary.mockRejectedValue(offline());

    await expect(useAppStore.getState().removeAnniversary(4)).rejects.toThrow(/offline/i);
    expect(anniversaries()).toHaveLength(1);
  });

  it('a queued edit or delete that starts after an account switch sends nothing', async () => {
    setAnniversaries([anniversary(4, 'A row', { serverId: 'ann-a' })]);
    // Hold the queue with a refresh whose read has not come back yet.
    const read = deferred<ServerAnniversary[]>();
    server.fetchAnniversaries.mockReturnValue(read.promise);
    const refresh = useAppStore.getState().loadAnniversariesFromServer();
    await vi.waitFor(() => expect(server.fetchAnniversaries).toHaveBeenCalled());

    const edit = useAppStore.getState().updateAnniversary(4, { date: '2024-02-15', label: 'Edited' });
    const removal = useAppStore.getState().removeAnniversary(4);
    // C signs in; C's own row happens to carry the same device-local id.
    useAppStore.setState({ userId: 'USER-C' } as StoreState);
    setAnniversaries([anniversary(4, 'C row', { date: '2021-01-01', serverId: 'ann-c' })]);
    read.settle([]);
    await Promise.all([refresh, edit, removal]);

    expect(server.updateAnniversary).not.toHaveBeenCalled();
    expect(server.deleteAnniversary).not.toHaveBeenCalled();
    expect(anniversaries()).toEqual([anniversary(4, 'C row', { date: '2021-01-01', serverId: 'ann-c' })]);
  });

  it('refuses to edit or delete a row with no server id', async () => {
    setAnniversaries([anniversary(5, 'No server id')]);

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
      anniversary(7, 'Stale label', { serverId: 'ann-1' }),
      anniversary(8, 'No server id', { date: '2024-03-01' }),
    ]);
    server.fetchAnniversaries.mockResolvedValue([
      serverAnniversary('ann-1', 'Fresh label'),
      serverAnniversary('ann-2', 'From the other phone', { date: '2025-01-01', description: 'x' }),
    ]);

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(server.fetchAnniversaries).toHaveBeenCalledWith(A);
    expect(anniversaries()).toEqual([
      anniversary(7, 'Fresh label', { serverId: 'ann-1' }),
      anniversary(9, 'From the other phone', { date: '2025-01-01', description: 'x', serverId: 'ann-2' }),
    ]);
  });

  it('keeps the mirror when the read fails (offline display)', async () => {
    setAnniversaries([anniversary(1, 'Kept', { serverId: 'ann-1' })]);
    server.fetchAnniversaries.mockRejectedValue(offline());
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(anniversaries()).toEqual([anniversary(1, 'Kept', { serverId: 'ann-1' })]);
  });

  it('discards a read that lands after the account changed', async () => {
    const pending = deferred<ServerAnniversary[]>();
    server.fetchAnniversaries.mockReturnValue(pending.promise);

    const inFlight = useAppStore.getState().loadAnniversariesFromServer();
    useAppStore.setState({ userId: 'USER-C' } as StoreState);
    setAnniversaries([anniversary(1, 'C only', { date: '2021-01-01' })]);
    pending.settle([serverAnniversary('ann-a', 'A private')]);
    await inFlight;

    expect(anniversaries()).toEqual([anniversary(1, 'C only', { date: '2021-01-01' })]);
  });
});

describe('anniversaries local copy', () => {
  it('shows the saved copy offline, without asking the server', async () => {
    await writeLocalCopy(A, ANNIVERSARIES_COPY_KIND, [anniversary(2, 'Saved', { serverId: 'ann-s' })]);
    setOnline(false);

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(anniversaries()).toEqual([anniversary(2, 'Saved', { serverId: 'ann-s' })]);
    expect(server.fetchAnniversaries).not.toHaveBeenCalled();
  });

  it('saves the server rows as the copy, and a later session starts from it', async () => {
    server.fetchAnniversaries.mockResolvedValue([serverAnniversary('ann-1', 'From server')]);

    await useAppStore.getState().loadAnniversariesFromServer();

    const saved = [anniversary(1, 'From server', { serverId: 'ann-1' })];
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
    const saved = [anniversary(1, 'Saved', { serverId: 'ann-1' })];
    await writeLocalCopy(A, ANNIVERSARIES_COPY_KIND, saved);
    server.fetchAnniversaries.mockRejectedValue(new Error('500'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await useAppStore.getState().loadAnniversariesFromServer();

    expect(anniversaries()).toEqual(saved);
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual(saved);
  });

  it('an empty server answer is shown and saved as []', async () => {
    await writeLocalCopy(A, ANNIVERSARIES_COPY_KIND, [
      anniversary(1, 'Deleted elsewhere', { serverId: 'ann-1' }),
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
    server.createAnniversary.mockResolvedValue(serverAnniversary('ann-new', 'Added'));
    await useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'Added' });
    read.settle([anniversary(1, 'Old copy', { serverId: 'ann-old' })]);
    await refresh;

    expect(anniversaries().map((a) => a.label)).toEqual(['Added']);
  });

  it('a copy read that lands after a server answer does not replace it', async () => {
    const read = deferred<unknown>();
    copyRead.hook = () => read.promise;
    const slowRefresh = useAppStore.getState().loadAnniversariesFromServer();
    // A second refresh, reading no copy, gets the server answer first.
    copyRead.hook = async () => null;
    server.fetchAnniversaries.mockResolvedValueOnce([serverAnniversary('ann-new', 'Server')]);
    await useAppStore.getState().loadAnniversariesFromServer();
    server.fetchAnniversaries.mockRejectedValue(new Error('500'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    read.settle([anniversary(1, 'Old copy', { serverId: 'ann-old' })]);
    await slowRefresh;

    expect(anniversaries().map((a) => a.label)).toEqual(['Server']);
  });

  it('each confirmed write updates the copy', async () => {
    server.createAnniversary.mockResolvedValue(serverAnniversary('ann-1', 'Added'));
    await useAppStore.getState().addAnniversary({ date: '2024-02-14', label: 'Added' });
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual([
      anniversary(1, 'Added', { serverId: 'ann-1' }),
    ]);

    server.updateAnniversary.mockResolvedValue(serverAnniversary('ann-1', 'Edited'));
    await useAppStore.getState().updateAnniversary(1, { date: '2024-02-14', label: 'Edited' });
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual([
      anniversary(1, 'Edited', { serverId: 'ann-1' }),
    ]);

    server.deleteAnniversary.mockResolvedValue(undefined);
    await useAppStore.getState().removeAnniversary(1);
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toEqual([]);
  });

  it('a failed write leaves the copy unchanged', async () => {
    const saved = [anniversary(1, 'Saved', { serverId: 'ann-1' })];
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
    pending.settle([serverAnniversary('ann-a', 'A private')]);
    await inFlight;

    expect(anniversaries()).toEqual([]);
    expect(await readLocalCopy(A, ANNIVERSARIES_COPY_KIND)).toBeNull();
    expect(await readLocalCopy('USER-C', ANNIVERSARIES_COPY_KIND)).toBeNull();
  });

  it('refreshLocalCopies reaches the anniversaries (start and reconnect)', async () => {
    server.fetchAnniversaries.mockResolvedValue([serverAnniversary('ann-r', 'Added on the other phone')]);

    await refreshLocalCopies();

    expect(server.fetchAnniversaries).toHaveBeenCalledWith(A);
    expect(anniversaries().map((a) => a.label)).toEqual(['Added on the other phone']);
  });
});
