/**
 * Birthdays and the wedding date on the local copy — the store's cases from
 * story 4's I/O matrix (spec-unified-data-storage).
 *
 * Drives the composed `useAppStore` against fake-indexeddb, with only the
 * partner lookup and the two services mocked, so the copies that are read and
 * written are the real `local-copies` rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const lookupPartnerId = vi.fn();
const fetchCoupleSettings = vi.fn();
const saveWeddingDate = vi.fn();
const fetchOwnProfile = vi.fn();
const saveBirthday = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: () => lookupPartnerId(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/services/coupleSettingsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/coupleSettingsService')>()),
  coupleSettingsService: {
    fetchCoupleSettings: (...args: unknown[]) => fetchCoupleSettings(...args),
    saveStartDate: vi.fn(),
    saveWeddingDate: (...args: unknown[]) => saveWeddingDate(...args),
  },
}));

vi.mock('../../../src/services/profileService', () => ({
  profileService: {
    fetchOwnProfile: () => fetchOwnProfile(),
    saveBirthday: (birthday: string) => saveBirthday(birthday),
  },
}));

import { AccountDataError } from '../../../src/services/accountDataError';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import {
  COUPLE_SETTINGS_COPY_KIND,
  PROFILE_COPY_KIND,
} from '../../../src/stores/slices/settingsSlice';
import { useAppStore } from '../../../src/stores/useAppStore';

const A = 'USER-A-ID';
const B = 'USER-B-ID';
const P = 'PARTNER-ID';

const START = '2025-10-04T22:00:00.000Z';
const SAVED_PROFILE = { displayName: 'SAVED-NAME', birthday: '1990-01-02' };
const SERVER_PROFILE = { displayName: 'SERVER-NAME', birthday: '1991-03-04' };
const SAVED_COUPLE = {
  status: 'linked',
  partnerId: P,
  relationshipStart: START,
  weddingDate: '2027-06-19',
} as const;

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

describe('own profile (display name and birthday) on the local copy', () => {
  // Matrix: "Offline start — Copies saved".
  it('offline start: shows the saved profile with no server read', async () => {
    await writeLocalCopy(A, PROFILE_COPY_KIND, SAVED_PROFILE);
    setOnline(false);

    await state().loadOwnProfile();

    expect(state().ownProfile).toEqual(SAVED_PROFILE);
    expect(fetchOwnProfile).not.toHaveBeenCalled();
  });

  // Matrix: "Partner sets birthday" — seen after start/reconnect.
  it('online: replaces state and copy with the server row', async () => {
    await writeLocalCopy(A, PROFILE_COPY_KIND, SAVED_PROFILE);
    fetchOwnProfile.mockResolvedValue(SERVER_PROFILE);

    await state().loadOwnProfile();

    expect(state().ownProfile).toEqual(SERVER_PROFILE);
    expect(await readLocalCopy(A, PROFILE_COPY_KIND)).toEqual(SERVER_PROFILE);
  });

  it('a failed server read keeps what is shown and the copy', async () => {
    await writeLocalCopy(A, PROFILE_COPY_KIND, SAVED_PROFILE);
    fetchOwnProfile.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().loadOwnProfile();

    expect(state().ownProfile).toEqual(SAVED_PROFILE);
    expect(await readLocalCopy(A, PROFILE_COPY_KIND)).toEqual(SAVED_PROFILE);
  });

  it('a saved copy with no birthday field reads it as not set', async () => {
    await writeLocalCopy(A, PROFILE_COPY_KIND, { displayName: 'SAVED-NAME' });
    setOnline(false);

    await state().loadOwnProfile();

    expect(state().ownProfile).toEqual({ displayName: 'SAVED-NAME', birthday: null });
  });

  // Matrix: "Partner sets birthday" — the saving side.
  it('a confirmed birthday save updates state and the copy', async () => {
    const saved = { displayName: 'SERVER-NAME', birthday: '2000-05-20' };
    saveBirthday.mockResolvedValue(saved);

    await state().setBirthday('2000-05-20');

    expect(saveBirthday).toHaveBeenCalledWith('2000-05-20');
    expect(state().ownProfile).toEqual(saved);
    expect(await readLocalCopy(A, PROFILE_COPY_KIND)).toEqual(saved);
  });

  it('a failed birthday save throws and leaves state and copy unchanged', async () => {
    await writeLocalCopy(A, PROFILE_COPY_KIND, SAVED_PROFILE);
    useAppStore.setState({ ownProfile: SAVED_PROFILE });
    saveBirthday.mockRejectedValue(new AccountDataError('transport', 'save failed'));

    await expect(state().setBirthday('2000-05-20')).rejects.toThrow('save failed');

    expect(state().ownProfile).toEqual(SAVED_PROFILE);
    expect(await readLocalCopy(A, PROFILE_COPY_KIND)).toEqual(SAVED_PROFILE);
  });

  // Matrix: "Offline edit".
  it('an offline birthday edit is refused up front with AccountDataError("offline")', async () => {
    await writeLocalCopy(A, PROFILE_COPY_KIND, SAVED_PROFILE);
    useAppStore.setState({ ownProfile: SAVED_PROFILE });
    setOnline(false);

    const attempt = state().setBirthday('2000-05-20');
    await expect(attempt).rejects.toMatchObject({ code: 'offline' });
    await expect(attempt).rejects.toThrow(/need a connection/);

    expect(saveBirthday).not.toHaveBeenCalled();
    expect(state().ownProfile).toEqual(SAVED_PROFILE);
    expect(await readLocalCopy(A, PROFILE_COPY_KIND)).toEqual(SAVED_PROFILE);
  });

  // Matrix: "Sign-out — A out, B in".
  it("sign-out: A's profile copy is deleted and B never sees A's values", async () => {
    fetchOwnProfile.mockResolvedValue(SERVER_PROFILE);
    await state().loadOwnProfile();
    expect(state().ownProfile).toEqual(SERVER_PROFILE);

    state().clearAuth();
    expect(state().ownProfile).toBeNull();
    state().setAuthUser(B);
    await vi.waitFor(async () => expect(await readLocalCopy(A, PROFILE_COPY_KIND)).toBeNull());

    setOnline(false);
    await state().loadOwnProfile();
    expect(state().ownProfile).toBeNull();
  });

  it('a load that lands after sign-out writes neither state nor copy', async () => {
    let settle: (value: unknown) => void = () => {};
    fetchOwnProfile.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );

    const inFlight = state().loadOwnProfile();
    await vi.waitFor(() => expect(fetchOwnProfile).toHaveBeenCalled());
    state().clearAuth();
    state().setAuthUser(B);
    settle(SERVER_PROFILE);
    await inFlight;

    expect(state().ownProfile).toBeNull();
    expect(await readLocalCopy(A, PROFILE_COPY_KIND)).toBeNull();
    expect(await readLocalCopy(B, PROFILE_COPY_KIND)).toBeNull();
  });

  it('a save that lands after sign-out writes neither state nor copy', async () => {
    let settle: (value: unknown) => void = () => {};
    saveBirthday.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );

    const inFlight = state().setBirthday('2000-05-20');
    await vi.waitFor(() => expect(saveBirthday).toHaveBeenCalled());
    state().clearAuth();
    state().setAuthUser(B);
    settle({ displayName: 'A-NAME', birthday: '2000-05-20' });
    await inFlight;

    expect(state().ownProfile).toBeNull();
    expect(await readLocalCopy(A, PROFILE_COPY_KIND)).toBeNull();
    expect(await readLocalCopy(B, PROFILE_COPY_KIND)).toBeNull();
  });
});

describe('wedding date on the couple-settings copy', () => {
  // Matrix: "Old copy — lacks the new field".
  it('a copy saved before the wedding date existed parses, with it not set', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, {
      status: 'linked',
      partnerId: P,
      relationshipStart: START,
    });
    setOnline(false);

    await state().loadCoupleSettings();

    expect(state().coupleSettings).toEqual({
      status: 'linked',
      partnerId: P,
      relationshipStart: START,
      weddingDate: null,
    });
  });

  // Matrix: "Offline start".
  it('offline start: shows the saved wedding date', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED_COUPLE);
    setOnline(false);

    await state().loadCoupleSettings();

    expect(state().coupleSettings).toEqual(SAVED_COUPLE);
  });

  // Matrix: "Wedding set/cleared" — the other phone after start/reconnect.
  it('online: the server wedding date replaces the copy', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED_COUPLE);
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    fetchCoupleSettings.mockResolvedValue({ relationshipStart: START, weddingDate: null });

    await state().loadCoupleSettings();

    const expected = { ...SAVED_COUPLE, weddingDate: null };
    expect(state().coupleSettings).toEqual(expected);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(expected);
  });

  it.each([
    ['sets', '2027-06-19'],
    ['clears', null],
  ])('a confirmed save %s the wedding date in state and copy', async (_label, value) => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED_COUPLE);
    useAppStore.setState({ coupleSettings: SAVED_COUPLE });
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    saveWeddingDate.mockResolvedValue({ relationshipStart: START, weddingDate: value });

    await state().setWeddingDate(value);

    const expected = { ...SAVED_COUPLE, weddingDate: value };
    expect(saveWeddingDate).toHaveBeenCalledWith(A, P, value);
    expect(state().coupleSettings).toEqual(expected);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(expected);
  });

  it('a failed wedding save throws and leaves state and copy unchanged', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED_COUPLE);
    useAppStore.setState({ coupleSettings: SAVED_COUPLE });
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: P });
    saveWeddingDate.mockRejectedValue(new AccountDataError('transport', 'save failed'));

    await expect(state().setWeddingDate(null)).rejects.toThrow('save failed');

    expect(state().coupleSettings).toEqual(SAVED_COUPLE);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(SAVED_COUPLE);
  });

  // Matrix: "Offline edit".
  it('an offline wedding edit is refused up front and changes nothing', async () => {
    await writeLocalCopy(A, COUPLE_SETTINGS_COPY_KIND, SAVED_COUPLE);
    useAppStore.setState({ coupleSettings: SAVED_COUPLE });
    setOnline(false);

    await expect(state().setWeddingDate(null)).rejects.toMatchObject({ code: 'offline' });

    expect(lookupPartnerId).not.toHaveBeenCalled();
    expect(saveWeddingDate).not.toHaveBeenCalled();
    expect(state().coupleSettings).toEqual(SAVED_COUPLE);
    expect(await readLocalCopy(A, COUPLE_SETTINGS_COPY_KIND)).toEqual(SAVED_COUPLE);
  });

  it('an edit with no partner, or a failed lookup, is refused and sends nothing', async () => {
    lookupPartnerId.mockResolvedValueOnce({ status: 'unlinked' });
    await expect(state().setWeddingDate('2027-06-19')).rejects.toThrow(/Link a partner/);
    lookupPartnerId.mockResolvedValueOnce({ status: 'error', reason: 'network' });
    await expect(state().setWeddingDate('2027-06-19')).rejects.toBeInstanceOf(AccountDataError);
    expect(saveWeddingDate).not.toHaveBeenCalled();
  });
});
