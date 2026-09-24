/**
 * Couple settings (the shared relationship start) on the local copy — one case
 * per row of story 3's I/O matrix that the store owns.
 *
 * Drives the composed `useAppStore` against fake-indexeddb, with only the
 * partner lookup and the couple-settings service mocked, so the copy that is
 * read and written is the real `local-copies` row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const lookupPartnerId = vi.fn();
const fetchCoupleSettings = vi.fn();
const saveStartDate = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: () => lookupPartnerId(),
}));

const partner = vi.hoisted(() => ({
  acceptPartnerRequest: vi.fn(),
  getPartner: vi.fn(),
  getPendingRequests: vi.fn(),
}));
vi.mock('../../../src/api/partnerService', () => ({ partnerService: partner }));

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

vi.mock('../../../src/services/coupleSettingsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/coupleSettingsService')>()),
  coupleSettingsService: {
    fetchCoupleSettings: (...args: unknown[]) => fetchCoupleSettings(...args),
    saveStartDate: (...args: unknown[]) => saveStartDate(...args),
  },
}));

import { AccountDataError } from '../../../src/services/accountDataError';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { COUPLE_SETTINGS_COPY_KIND } from '../../../src/stores/slices/settingsSlice';
import { useAppStore } from '../../../src/stores/useAppStore';

const A = 'USER-A-ID';
const B = 'USER-B-ID';
const P = 'PARTNER-ID';

const SAVED_START = '2025-10-04T22:00:00.000Z';
const SERVER_START = '2025-10-19T13:30:00.000Z';

const SAVED = { status: 'linked', partnerId: P, relationshipStart: SAVED_START, weddingDate: null } as const;

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

describe('couple settings on the local copy', () => {
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
    copyRead.hook = null;
    setOnline(true);
    vi.restoreAllMocks();
    await clearCopies();
  });

  // Matrix: "Offline start — Copy saved".
  it('offline start: shows the saved date with no partner lookup or fetch', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED);
    setOnline(false);

    await state().loadCoupleSettings();

    expect(state().coupleSettings).toEqual(SAVED);
    expect(lookupPartnerId).not.toHaveBeenCalled();
    expect(fetchCoupleSettings).not.toHaveBeenCalled();
  });

  // Matrix: "Partner edits" — the other phone sees it after start/reconnect.
  it('online: replaces the copy with the server date and saves it', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED);
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    fetchCoupleSettings.mockResolvedValue({ relationshipStart: SERVER_START, weddingDate: null });

    await state().loadCoupleSettings();

    const expected = { status: 'linked', partnerId: P, relationshipStart: SERVER_START, weddingDate: null };
    expect(fetchCoupleSettings).toHaveBeenCalledWith(A, P);
    expect(state().coupleSettings).toEqual(expected);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(expected);
  });

  // Matrix: "Not set yet — Linked, no row".
  it('linked with no row: a linked state with no start date, saved as such', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    fetchCoupleSettings.mockResolvedValue({ relationshipStart: null, weddingDate: null });

    await state().loadCoupleSettings();

    const expected = { status: 'linked', partnerId: P, relationshipStart: null, weddingDate: null };
    expect(state().coupleSettings).toEqual(expected);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(expected);
  });

  // Matrix: "Unlinked — No partner".
  it('unlinked: says so, saves it, and never fetches', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'unlinked' });

    await state().loadCoupleSettings();

    expect(state().coupleSettings).toEqual({ status: 'unlinked' });
    expect(fetchCoupleSettings).not.toHaveBeenCalled();
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual({ status: 'unlinked' });
  });

  // Matrix: "Lookup fails — Partner lookup error".
  it('a failed partner lookup keeps the shown copy and is never read as unlinked', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED);
    lookupPartnerId.mockResolvedValue({ status: 'error', reason: 'network' });

    await state().loadCoupleSettings();

    expect(state().coupleSettings).toEqual(SAVED);
    expect(fetchCoupleSettings).not.toHaveBeenCalled();
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(SAVED);
    expect(console.error).toHaveBeenCalled();
  });

  // Matrix: "Lookup fails — … or read fails".
  it('a failed server read keeps the shown copy and leaves it untouched', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED);
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    fetchCoupleSettings.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().loadCoupleSettings();

    expect(state().coupleSettings).toEqual(SAVED);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(SAVED);
  });

  it('ignores a malformed saved copy rather than showing it', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, { status: 'linked', relationshipStart: 7 });
    setOnline(false);

    await state().loadCoupleSettings();

    expect(state().coupleSettings).toBeNull();
  });

  // Matrix: "Partner edits — B saves a new date online".
  it('a confirmed save updates state and the copy', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    saveStartDate.mockResolvedValue({ relationshipStart: SERVER_START, weddingDate: null });

    await state().setRelationshipStart(SERVER_START);

    const expected = { status: 'linked', partnerId: P, relationshipStart: SERVER_START, weddingDate: null };
    expect(saveStartDate).toHaveBeenCalledWith(A, P, SERVER_START);
    expect(state().coupleSettings).toEqual(expected);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(expected);
  });

  // Matrix: "Partner edits — Save error … value unchanged".
  it('a failed save throws and leaves state and copy unchanged', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED);
    useAppStore.setState({ coupleSettings: SAVED });
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    saveStartDate.mockRejectedValue(new AccountDataError('transport', 'save failed'));

    await expect(state().setRelationshipStart(SERVER_START)).rejects.toThrow('save failed');

    expect(state().coupleSettings).toEqual(SAVED);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(SAVED);
  });

  // Matrix: "Offline edit".
  it('an offline edit is refused up front with AccountDataError("offline")', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED);
    useAppStore.setState({ coupleSettings: SAVED });
    setOnline(false);

    const attempt = state().setRelationshipStart(SERVER_START);
    await expect(attempt).rejects.toBeInstanceOf(AccountDataError);
    await expect(attempt).rejects.toMatchObject({ code: 'offline' });
    await expect(attempt).rejects.toThrow(/need a connection/);

    expect(lookupPartnerId).not.toHaveBeenCalled();
    expect(saveStartDate).not.toHaveBeenCalled();
    expect(state().coupleSettings).toEqual(SAVED);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(SAVED);
  });

  it('an edit with no partner is refused and sends nothing', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'unlinked' });

    await expect(state().setRelationshipStart(SERVER_START)).rejects.toThrow(/Link a partner/);
    expect(saveStartDate).not.toHaveBeenCalled();
  });

  it('an edit whose partner lookup fails is refused, not saved as unlinked', async () => {
    useAppStore.setState({ coupleSettings: SAVED });
    lookupPartnerId.mockResolvedValue({ status: 'error', reason: 'network' });

    await expect(state().setRelationshipStart(SERVER_START)).rejects.toBeInstanceOf(
      AccountDataError
    );
    expect(saveStartDate).not.toHaveBeenCalled();
    expect(state().coupleSettings).toEqual(SAVED);
  });

  // Matrix: "Sign-out — A out, B in".
  it("sign-out: A's copy is deleted and B never sees A's date", async () => {
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    fetchCoupleSettings.mockResolvedValue({ relationshipStart: SERVER_START, weddingDate: null });
    await state().loadCoupleSettings();
    expect(state().coupleSettings).not.toBeNull();

    state().clearAuth();
    expect(state().coupleSettings).toBeNull();
    state().setAuthUser(B);
    await vi.waitFor(async () =>
      expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toBeNull()
    );

    setOnline(false);
    await state().loadCoupleSettings();
    expect(state().coupleSettings).toBeNull();
  });

  it('a load that lands after sign-out writes neither state nor copy', async () => {
    let settle: (value: unknown) => void = () => {};
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    fetchCoupleSettings.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );

    const inFlight = state().loadCoupleSettings();
    await vi.waitFor(() => expect(fetchCoupleSettings).toHaveBeenCalled());
    state().clearAuth();
    state().setAuthUser(B);
    settle({ relationshipStart: SERVER_START, weddingDate: null });
    await inFlight;

    expect(state().coupleSettings).toBeNull();
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toBeNull();
    expect(await readLocalCopy(B, COUPLE_SETTINGS_COPY_KIND)).toBeNull();
  });

  // The late-copy-read freshness guard (same shape as the anniversaries cases
  // in accountDataSlices.test.ts).
  it('a copy read that lands after a confirmed save does not replace it', async () => {
    const read = deferred<unknown>();
    copyRead.hook = () => read.promise;
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    fetchCoupleSettings.mockRejectedValue(new AccountDataError('transport', '500'));

    const refresh = state().loadCoupleSettings();
    saveStartDate.mockResolvedValue({ relationshipStart: SERVER_START, weddingDate: null });
    await state().setRelationshipStart(SERVER_START);
    read.settle(SAVED);
    await refresh;

    expect(state().coupleSettings).toEqual({
      status: 'linked',
      partnerId: P,
      relationshipStart: SERVER_START,
      weddingDate: null,
    });
  });

  it('a copy read that lands after a server answer does not replace it', async () => {
    const read = deferred<unknown>();
    copyRead.hook = () => read.promise;
    const slowRefresh = state().loadCoupleSettings();
    // A second refresh, reading no copy, gets the server answer first.
    copyRead.hook = async () => null;
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    fetchCoupleSettings.mockResolvedValueOnce({ relationshipStart: SERVER_START, weddingDate: null });
    await state().loadCoupleSettings();
    fetchCoupleSettings.mockRejectedValue(new AccountDataError('transport', '500'));
    read.settle(SAVED);
    await slowRefresh;

    expect(state().coupleSettings).toEqual({
      status: 'linked',
      partnerId: P,
      relationshipStart: SERVER_START,
      weddingDate: null,
    });
  });

  // Accepting a link refreshes the couple copy, which still said "unlinked".
  it('accepting a partner request replaces an unlinked copy with the couple row', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, { status: 'unlinked' });
    useAppStore.setState({ coupleSettings: { status: 'unlinked' } });
    partner.acceptPartnerRequest.mockResolvedValue(undefined);
    partner.getPartner.mockResolvedValue({
      status: 'linked',
      partner: { id: P, email: 'p@example.test', displayName: 'P', connectedAt: null, birthday: null },
    });
    partner.getPendingRequests.mockResolvedValue({ sent: [], received: [] });
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    fetchCoupleSettings.mockResolvedValue({ relationshipStart: SERVER_START, weddingDate: null });

    await state().acceptPartnerRequest('request-1');

    const expected = { status: 'linked', partnerId: P, relationshipStart: SERVER_START, weddingDate: null };
    expect(partner.acceptPartnerRequest).toHaveBeenCalledWith('request-1');
    expect(state().coupleSettings).toEqual(expected);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(expected);
  });
});

// `canNavigateBack` reads `coupleSettings` through the messages slice.
describe('message history limit from the couple start', () => {
  function atIndex(currentIndex: number) {
    useAppStore.setState({
      messageHistory: { ...state().messageHistory, currentIndex, maxHistoryDays: 30 },
    });
  }

  afterEach(() => {
    useAppStore.setState({ coupleSettings: null });
    atIndex(0);
  });

  it('stops at the start: five days in, index 5 cannot go further back', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 - 60_000).toISOString();
    useAppStore.setState({
      coupleSettings: { status: 'linked', partnerId: P, relationshipStart: fiveDaysAgo, weddingDate: null },
    });
    atIndex(5);
    expect(state().canNavigateBack()).toBe(false);
    atIndex(4);
    expect(state().canNavigateBack()).toBe(true);
  });

  it.each([
    ['unlinked', { status: 'unlinked' } as const],
    ['not known yet', null],
  ])('without a start (%s) the configured cap applies', (_label, coupleSettings) => {
    useAppStore.setState({ coupleSettings });
    atIndex(29);
    expect(state().canNavigateBack()).toBe(true);
    atIndex(30);
    expect(state().canNavigateBack()).toBe(false);
  });
});
