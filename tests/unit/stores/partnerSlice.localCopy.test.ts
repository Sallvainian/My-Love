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

const A = 'USER-A-ID';
const B = 'USER-B-ID';

const SAVED = {
  id: 'P1',
  email: 'p@example.test',
  displayName: 'SAVED-NAME',
  connectedAt: null,
  birthday: null,
};
const FRESH = { ...SAVED, displayName: 'FRESH-NAME' };

function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
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
    await writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'linked', partner: SAVED });
    setOnline(false);

    await state().loadPartner();

    expect(state().partner).toEqual(SAVED);
    expect(state().isLoadingPartner).toBe(false);
    expect(state().partnerLoadError).toBe(false);
    expect(getPartner).not.toHaveBeenCalled();
  });

  it('online: renders the copy first, then replaces and saves the server result', async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'linked', partner: SAVED });
    const server = deferred<unknown>();
    getPartner.mockReturnValue(server.promise);

    const inFlight = state().loadPartner();
    await vi.waitFor(() => expect(getPartner).toHaveBeenCalled());
    // The copy is on screen while the server read is still open.
    expect(state().partner).toEqual(SAVED);
    expect(state().isLoadingPartner).toBe(false);

    server.settle({ status: 'linked', partner: FRESH });
    await inFlight;

    expect(state().partner).toEqual(FRESH);
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toEqual({ status: 'linked', partner: FRESH });
  });

  it('read fails with a copy: keeps the saved partner and leaves the copy untouched', async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'linked', partner: SAVED });
    getPartner.mockResolvedValue({ status: 'error', reason: 'network' });

    await state().loadPartner();

    expect(state().partner).toEqual(SAVED);
    expect(state().partnerLoadError).toBe(false);
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toEqual({ status: 'linked', partner: SAVED });
  });

  it('read fails with no copy: a load error, not "unlinked", and nothing saved', async () => {
    getPartner.mockResolvedValue({ status: 'error', reason: 'network' });

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

    server.settle({ status: 'linked', partner: FRESH });
    await inFlight;

    expect(state().partner).toBeNull();
    expect(state().isLoadingPartner).toBe(false);
    expect(await readLocalCopy(B, PARTNER_COPY_KIND)).toBeNull();
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toBeNull();
  });

  it("B never sees A's saved partner after A signs out", async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'linked', partner: SAVED });

    state().clearAuth();
    state().setAuthUser(B);
    setOnline(false);
    await state().loadPartner();

    expect(state().partner).toBeNull();
    expect(JSON.stringify(state())).not.toContain('SAVED-NAME');
    await vi.waitFor(async () => {
      expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toBeNull();
    });
  });

  it('reconnect: refreshLocalCopies refreshes the partner without a reload', async () => {
    await writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'linked', partner: SAVED });
    getPartner.mockResolvedValue({ status: 'linked', partner: FRESH });

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

    newer.settle({ status: 'linked', partner: FRESH });
    await second;
    older.settle({ status: 'unlinked' });
    await first;

    expect(state().partner).toEqual(FRESH);
    expect(state().isLoadingPartner).toBe(false);
    expect(await readLocalCopy(A, PARTNER_COPY_KIND)).toEqual({ status: 'linked', partner: FRESH });
  });

  // Story 4 matrix: "Old copy — lacks the new field".
  it('a copy saved before birthdays existed parses, with the birthday not set', async () => {
    const { birthday: _birthday, ...oldPartner } = SAVED;
    await writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'linked', partner: oldPartner });
    setOnline(false);

    await state().loadPartner();

    expect(state().partner).toEqual({ ...oldPartner, birthday: null });
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
      getPartner.mockResolvedValue({ status: 'linked', partner: FRESH });

      await state().loadPartner();

      await vi.waitFor(() => expect(refreshCouple).toHaveBeenCalledTimes(1));
    });

    it('does not refresh when the couple settings already name this partner', async () => {
      useAppStore.setState({
        coupleSettings: { status: 'linked', partnerId: FRESH.id, relationshipStart: null },
      } as unknown as Parameters<typeof useAppStore.setState>[0]);
      getPartner.mockResolvedValue({ status: 'linked', partner: FRESH });

      await state().loadPartner();

      expect(refreshCouple).not.toHaveBeenCalled();
    });

    it('does not refresh on a failed partner read', async () => {
      useAppStore.setState({ coupleSettings: { status: 'unlinked' } } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      getPartner.mockResolvedValue({ status: 'error', reason: 'network' });

      await state().loadPartner();

      expect(refreshCouple).not.toHaveBeenCalled();
    });
  });
});
