/**
 * The partner profile on the shared local copy — the proving consumer of
 * src/services/localCopy.ts, one case per row of the story's I/O matrix.
 *
 * Drives the composed `useAppStore` against fake-indexeddb, with only the
 * server read (`partnerService.getPartner`) mocked, so the copy that is read
 * and written is the real `local-copies` row.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import 'fake-indexeddb/auto';

const getPartner = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

vi.mock('../../../src/api/partnerService', () => ({
  partnerService: { getPartner: () => getPartner() },
}));

import { openMyLoveDB } from '../../../src/services/dbSchema';
import {
  readLocalCopy,
  refreshLocalCopies,
  registerLocalCopy,
  writeLocalCopy,
} from '../../../src/services/localCopy';
import { PARTNER_COPY_KIND } from '../../../src/stores/slices/partnerSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import { serialized } from './serializedState';
import { setOnline } from './navigatorFixtures';

const A = 'USER-A-ID';
const B = 'USER-B-ID';

const SAVED = {
  id: 'P1',
  email: 'p@example.test',
  displayName: 'SAVED-NAME',
  linkedSince: null,
  birthday: null,
};
const FRESH = { ...SAVED, displayName: 'FRESH-NAME' };

/** The partner envelope for a linked account: the copy's value and getPartner's answer. */
const linked = <P>(partner: P) => ({ status: 'linked' as const, partner });
/** The envelope getPartner answers when the read fails. */
const READ_FAILED = { status: 'error' as const, reason: 'network' };

function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

async function clearCopies(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

function state() {
  return useAppStore.getState();
}

describe('partner profile on the local copy', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setOnline(true);
    useAppStore.setState({ messages: [], currentMessage: null } as unknown as Parameters<
      typeof useAppStore.setState
    >[0]);
    state().clearAuth();
    state().setAuthUser(A);
    // After the identity setup: clearAuth's copy deletion is fire-and-forget.
    await clearCopies();
  });

  afterEach(async () => {
    setOnline(true);
    vi.restoreAllMocks();
    await clearCopies();
  });

  it('offline with a saved copy: shows the saved partner at once, with no fetch', async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, linked(SAVED));
    setOnline(false);

    await state().loadPartner();

    expect(state().partner).toEqual(SAVED);
    expect(state().isLoadingPartner).toBe(false);
    expect(state().partnerLoadError).toBe(false);
    expect(getPartner).not.toHaveBeenCalled();
  });

  it('online: renders the copy first, then replaces and saves the server result', async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, linked(SAVED));
    const server = deferred<unknown>();
    getPartner.mockReturnValue(server.promise);

    const inFlight = state().loadPartner();
    await vi.waitFor(() => expect(getPartner).toHaveBeenCalled());
    // The copy is on screen while the server read is still open.
    expect(state().partner).toEqual(SAVED);
    expect(state().isLoadingPartner).toBe(false);

    server.settle(linked(FRESH));
    await inFlight;

    expect(state().partner).toEqual(FRESH);
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toEqual(linked(FRESH));
  });

  it('read fails with a copy: keeps the saved partner and leaves the copy untouched', async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, linked(SAVED));
    getPartner.mockResolvedValue(READ_FAILED);

    await state().loadPartner();

    expect(state().partner).toEqual(SAVED);
    expect(state().partnerLoadError).toBe(false);
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toEqual(linked(SAVED));
  });

  it('read fails with no copy: a load error, not "unlinked", and nothing saved', async () => {
    getPartner.mockResolvedValue(READ_FAILED);

    await state().loadPartner();

    expect(state().partner).toBeNull();
    expect(state().partnerLoadError).toBe(true);
    expect(state().isLoadingPartner).toBe(false);
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toBeNull();
  });

  it('a thrown read is handled like a failed one', async () => {
    getPartner.mockRejectedValue(new Error('boom'));

    await state().loadPartner();

    expect(state().partnerLoadError).toBe(true);
    expect(state().isLoadingPartner).toBe(false);
  });

  it('offline with no copy: a load error, not "unlinked"', async () => {
    setOnline(false);

    await state().loadPartner();

    expect(state().partner).toBeNull();
    expect(state().partnerLoadError).toBe(true);
    expect(getPartner).not.toHaveBeenCalled();
  });

  it('truly unlinked: saves "unlinked" as the copy and clears the load error', async () => {
    useAppStore.setState({ partnerLoadError: true });
    getPartner.mockResolvedValue({ status: 'unlinked' });

    await state().loadPartner();

    expect(state().partner).toBeNull();
    expect(state().partnerLoadError).toBe(false);
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toEqual({ status: 'unlinked' });
  });

  it('a saved "unlinked" copy is shown as unlinked offline', async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'unlinked' });
    setOnline(false);

    await state().loadPartner();

    expect(state().partner).toBeNull();
    expect(state().partnerLoadError).toBe(false);
  });

  it("account switch mid-load: A's result is neither shown nor saved under B", async () => {
    const server = deferred<unknown>();
    getPartner.mockReturnValue(server.promise);

    const inFlight = state().loadPartner();
    await vi.waitFor(() => expect(getPartner).toHaveBeenCalled());
    state().setAuthUser(B);

    server.settle(linked(FRESH));
    await inFlight;

    expect(state().partner).toBeNull();
    expect(state().isLoadingPartner).toBe(false);
    expect(await readLocalCopy(B, PARTNER_COPY_KIND)).toBeNull();
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toBeNull();
  });

  it("B never sees A's saved partner after A signs out", async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, linked(SAVED));

    state().clearAuth();
    state().setAuthUser(B);
    setOnline(false);
    await state().loadPartner();

    expect(state().partner).toBeNull();
    expect(serialized(state())).not.toContain('SAVED-NAME');
    await vi.waitFor(async () => {
      expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toBeNull();
    });
  });

  it('reconnect: refreshLocalCopies refreshes the partner without a reload', async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, linked(SAVED));
    getPartner.mockResolvedValue(linked(FRESH));

    await refreshLocalCopies();

    expect(getPartner).toHaveBeenCalledTimes(1);
    expect(state().partner).toEqual(FRESH);
  });

  it("an older call's answer landing last does not overwrite a newer one", async () => {
    // e.g. the mount load's pre-accept "unlinked" arriving after
    // acceptPartnerRequest's post-accept "linked".
    const older = deferred<unknown>();
    const newer = deferred<unknown>();
    getPartner.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const first = state().loadPartner();
    await vi.waitFor(() => expect(getPartner).toHaveBeenCalledTimes(1));
    const second = state().loadPartner();
    await vi.waitFor(() => expect(getPartner).toHaveBeenCalledTimes(2));

    newer.settle(linked(FRESH));
    await second;
    older.settle({ status: 'unlinked' });
    await first;

    expect(state().partner).toEqual(FRESH);
    expect(state().isLoadingPartner).toBe(false);
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toEqual(linked(FRESH));
  });

  // Story 4 matrix: "Old copy — lacks the new field".
  it('a copy saved before birthdays existed parses, with the birthday not set', async () => {
    const { birthday: _birthday, ...oldPartner } = SAVED;
    await writeLocalCopy(A, PARTNER_COPY_KIND, linked(oldPartner));
    setOnline(false);

    await state().loadPartner();

    expect(state().partner).toEqual({ ...oldPartner, birthday: null });
  });

  it('a copy saved with the profile date as connectedAt parses with linkedSince null', async () => {
    // Before the link date came from the accepted request, `connectedAt` held
    // the profile row's updated_at, which any edit changes.
    const { linkedSince: _linkedSince, ...oldPartner } = SAVED;
    await writeLocalCopy(A, PARTNER_COPY_KIND, linked({ ...oldPartner, connectedAt: '2026-01-01T00:00:00Z' }));
    setOnline(false);

    await state().loadPartner();

    expect(state().partner).toEqual({ ...oldPartner, linkedSince: null });
    expect(state().partner).not.toHaveProperty('connectedAt');
  });

  describe('partnerKnown', () => {
    it('starts false', () => {
      expect(state().partnerKnown).toBe(false);
    });

    it('is true once a saved linked copy is applied', async () => {
      await writeLocalCopy(A, PARTNER_COPY_KIND, linked(SAVED));
      setOnline(false);

      await state().loadPartner();

      expect(state().partnerKnown).toBe(true);
    });

    it('is true once a saved unlinked copy is applied', async () => {
      await writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'unlinked' });
      setOnline(false);

      await state().loadPartner();

      expect(state().partnerKnown).toBe(true);
    });

    it('is true after the server answers linked', async () => {
      getPartner.mockResolvedValue(linked(FRESH));

      await state().loadPartner();

      expect(state().partnerKnown).toBe(true);
    });

    it('is true after the server answers unlinked', async () => {
      getPartner.mockResolvedValue({ status: 'unlinked' });

      await state().loadPartner();

      expect(state().partner).toBeNull();
      expect(state().partnerKnown).toBe(true);
    });

    it('stays false when the read fails with nothing saved', async () => {
      getPartner.mockResolvedValue(READ_FAILED);

      await state().loadPartner();

      expect(state().partnerLoadError).toBe(true);
      expect(state().partnerKnown).toBe(false);
    });

    it('stays false offline with nothing saved', async () => {
      setOnline(false);

      await state().loadPartner();

      expect(state().partnerLoadError).toBe(true);
      expect(state().partnerKnown).toBe(false);
    });

    it('is false again after sign-out', async () => {
      getPartner.mockResolvedValue(linked(FRESH));
      await state().loadPartner();
      expect(state().partnerKnown).toBe(true);

      state().clearAuth();

      expect(state().partnerKnown).toBe(false);
    });
  });

  it('a saved copy never replaces a partner already on screen', async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'unlinked' });
    useAppStore.setState({ partner: FRESH });
    setOnline(false);

    await state().loadPartner();

    expect(state().partner).toEqual(FRESH);
    expect(state().partnerLoadError).toBe(false);
  });

  describe('a new link seen by loadPartner refreshes the couple settings', () => {
    // The partner who SENT the request learns of the link only through
    // loadPartner; without this their couple settings stay "unlinked".
    let refreshCouple: Mock<() => Promise<void>>;
    let unregister: () => void;

    beforeEach(() => {
      refreshCouple = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      unregister = registerLocalCopy('couple-settings', refreshCouple);
    });

    afterEach(() => {
      unregister();
    });

    it('refreshes when the server shows a partner the couple settings do not know', async () => {
      useAppStore.setState({ coupleSettings: { status: 'unlinked' } } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      getPartner.mockResolvedValue(linked(FRESH));

      await state().loadPartner();

      await vi.waitFor(() => expect(refreshCouple).toHaveBeenCalledTimes(1));
    });

    it('does not refresh when the couple settings already name this partner', async () => {
      useAppStore.setState({
        coupleSettings: { status: 'linked', partnerId: FRESH.id, relationshipStart: null },
      } as unknown as Parameters<typeof useAppStore.setState>[0]);
      getPartner.mockResolvedValue(linked(FRESH));

      await state().loadPartner();

      expect(refreshCouple).not.toHaveBeenCalled();
    });

    it('does not refresh on a failed partner read', async () => {
      useAppStore.setState({ coupleSettings: { status: 'unlinked' } } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      getPartner.mockResolvedValue(READ_FAILED);

      await state().loadPartner();

      expect(refreshCouple).not.toHaveBeenCalled();
    });
  });

  // DW-501: the spinner is for "nothing has answered", not for "no partner".
  describe('the loading flag', () => {
    it('is raised by the first load, while nothing has answered', async () => {
      const server = deferred<unknown>();
      getPartner.mockReturnValue(server.promise);

      const inFlight = state().loadPartner();
      expect(state().isLoadingPartner).toBe(true);

      server.settle({ status: 'unlinked' });
      await inFlight;
      expect(state().isLoadingPartner).toBe(false);
      expect(state().partnerKnown).toBe(true);
    });

    it('is not raised by a reload over a confirmed unlinked answer', async () => {
      getPartner.mockResolvedValue({ status: 'unlinked' });
      await state().loadPartner();
      expect(state().partnerKnown).toBe(true);

      const server = deferred<unknown>();
      getPartner.mockReturnValue(server.promise);
      const seen: boolean[] = [];
      const stop = useAppStore.subscribe((next) => seen.push(next.isLoadingPartner));

      const inFlight = state().loadPartner();
      await vi.waitFor(() => expect(getPartner).toHaveBeenCalledTimes(2));
      // The saved copy has been read and the server read is open.
      expect(state().isLoadingPartner).toBe(false);

      server.settle({ status: 'unlinked' });
      await inFlight;
      stop();

      expect(seen).not.toContain(true);
      expect(state().partner).toBeNull();
      expect(state().partnerKnown).toBe(true);
    });

    it('is not raised by a reload whose read fails over a confirmed unlinked answer', async () => {
      getPartner.mockResolvedValue({ status: 'unlinked' });
      await state().loadPartner();

      getPartner.mockResolvedValue(READ_FAILED);
      const seen: boolean[] = [];
      const stop = useAppStore.subscribe((next) => seen.push(next.isLoadingPartner));
      await state().loadPartner();
      stop();

      expect(seen).not.toContain(true);
      // The saved "unlinked" copy is still the answer, so no load error either.
      expect(state().partnerLoadError).toBe(false);
    });

    it('is raised by a retry over a load error', async () => {
      // A failed read with nothing saved and nothing known: the load error is
      // what the screen shows now.
      getPartner.mockResolvedValue(READ_FAILED);
      await state().loadPartner();
      expect(state().partnerKnown).toBe(false);
      expect(state().partnerLoadError).toBe(true);

      // Retry: the error card is hidden until an answer lands.
      const server = deferred<unknown>();
      getPartner.mockReturnValue(server.promise);
      const inFlight = state().loadPartner();
      expect(state().isLoadingPartner).toBe(true);

      server.settle({ status: 'unlinked' });
      await inFlight;
      expect(state().isLoadingPartner).toBe(false);
      expect(state().partnerLoadError).toBe(false);
    });

    it('is raised again for the next account after a sign-out', async () => {
      getPartner.mockResolvedValue({ status: 'unlinked' });
      await state().loadPartner();
      expect(state().partnerKnown).toBe(true);

      state().clearAuth();
      state().setAuthUser(B);
      expect(state().partnerKnown).toBe(false);

      const server = deferred<unknown>();
      getPartner.mockReturnValue(server.promise);
      const inFlight = state().loadPartner();
      expect(state().isLoadingPartner).toBe(true);

      server.settle({ status: 'unlinked' });
      await inFlight;
      expect(state().isLoadingPartner).toBe(false);
    });
  });

  // DW-552: a confirmed "unlinked" answer in memory is still the answer when
  // a later reload finds no saved copy (a failed IndexedDB read answers null,
  // or the earlier copy write failed) and cannot ask the server either.
  describe('a failed reload over a confirmed unlinked answer with no saved copy', () => {
    beforeEach(async () => {
      getPartner.mockResolvedValue({ status: 'unlinked' });
      await state().loadPartner();
      expect(state().partnerKnown).toBe(true);
      await clearCopies();
    });

    it('a failed server read keeps the unlinked answer, with no load error', async () => {
      getPartner.mockResolvedValue(READ_FAILED);
      const seen: boolean[] = [];
      const stop = useAppStore.subscribe((next) => seen.push(next.isLoadingPartner));

      await state().loadPartner();
      stop();

      expect(getPartner).toHaveBeenCalledTimes(2);
      expect(seen).not.toContain(true);
      expect(state().partner).toBeNull();
      expect(state().partnerKnown).toBe(true);
      expect(state().partnerLoadError).toBe(false);
      expect(state().isLoadingPartner).toBe(false);
      expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toBeNull();
    });

    it('offline keeps the unlinked answer, with no load error', async () => {
      setOnline(false);

      await state().loadPartner();

      expect(getPartner).toHaveBeenCalledTimes(1);
      expect(state().partner).toBeNull();
      expect(state().partnerKnown).toBe(true);
      expect(state().partnerLoadError).toBe(false);
      expect(state().isLoadingPartner).toBe(false);
    });
  });

  // DW-567: the spinner's condition and the component tests rely on this pair
  // never being held, so the load error alone never needs its own clause.
  it('never holds a load error over a known answer, on any load path', async () => {
    const both: string[] = [];
    const stop = useAppStore.subscribe((next) => {
      if (next.partnerKnown && next.partnerLoadError) both.push(JSON.stringify(next.partner));
    });

    getPartner.mockResolvedValue(READ_FAILED);
    await state().loadPartner();
    expect(state().partnerLoadError).toBe(true);
    getPartner.mockResolvedValue({ status: 'unlinked' });
    await state().loadPartner();
    getPartner.mockResolvedValue(READ_FAILED);
    await state().loadPartner();
    await clearCopies();
    await state().loadPartner();
    setOnline(false);
    await state().loadPartner();
    setOnline(true);
    getPartner.mockResolvedValue(linked(FRESH));
    await state().loadPartner();
    await clearCopies();
    getPartner.mockResolvedValue(READ_FAILED);
    await state().loadPartner();
    stop();

    expect(state().partnerKnown).toBe(true);
    expect(both).toEqual([]);
  });
});
