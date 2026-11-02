/**
 * The push switches' local copy (story 4.3): kind `push-preferences`, holding
 * the whole row, written by `loadPushPreferences` and `setPushPreference` and
 * read by the date reminders' re-plan. Real local copies in fake-indexeddb, the
 * Supabase client's module and the preferences service mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchPushPreferences = vi.hoisted(() => vi.fn());
const savePushPreference = vi.hoisted(() => vi.fn());

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/services/pushPreferencesService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/pushPreferencesService')>()),
  pushPreferencesService: {
    fetchPushPreferences: (...args: unknown[]) => fetchPushPreferences(...args),
    savePushPreference: (...args: unknown[]) => savePushPreference(...args),
  },
}));

import { Capacitor } from '@capacitor/core';
import { AccountDataError } from '../../../src/services/accountDataError';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { readLocalCopy, refreshLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { ALL_PUSH_PREFERENCES_ON } from '../../../src/services/pushPreferencesService';
import {
  PUSH_PREFERENCES_COPY_KIND,
  readSavedPushPreferences,
} from '../../../src/stores/slices/settingsSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import { deferred, setOnline } from './accountDataFixtures';

const A = 'USER-A-ID';
const B = 'USER-B-ID';

const REMINDERS_OFF = { ...ALL_PUSH_PREFERENCES_ON, dateReminders: false };

function state() {
  return useAppStore.getState();
}

async function clearCopies(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

const savedCopy = (userId: string = A) => readLocalCopy<unknown>(userId, PUSH_PREFERENCES_COPY_KIND);

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  state().clearAuth();
  state().setAuthUser(A);
  // After the identity setup: clearAuth's copy deletion is fire-and-forget.
  await clearCopies();
});

afterEach(async () => {
  // Lets the sign-out deletes a test started finish before the file can end.
  await new Promise((resolve) => setTimeout(resolve, 20));
  vi.restoreAllMocks();
  await clearCopies();
});

describe('loadPushPreferences writes the copy', () => {
  it('saves the whole row the server answered', async () => {
    fetchPushPreferences.mockResolvedValue(REMINDERS_OFF);

    await state().loadPushPreferences();

    expect(await savedCopy()).toEqual(REMINDERS_OFF);
    expect(await readSavedPushPreferences(A)).toEqual(REMINDERS_OFF);
  });

  it('saves "all on" for an account with no row', async () => {
    fetchPushPreferences.mockResolvedValue({ ...ALL_PUSH_PREFERENCES_ON });

    await state().loadPushPreferences();

    expect(await readSavedPushPreferences(A)).toEqual(ALL_PUSH_PREFERENCES_ON);
  });

  it('keeps the copy when a later read fails, and clears nothing', async () => {
    await writeLocalCopy(A, PUSH_PREFERENCES_COPY_KIND, REMINDERS_OFF);
    fetchPushPreferences.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().loadPushPreferences();

    expect(state().pushPreferencesLoadFailed).toBe(true);
    expect(await savedCopy()).toEqual(REMINDERS_OFF);
  });

  it('writes no copy when the first read fails', async () => {
    fetchPushPreferences.mockRejectedValue(new Error('boom'));

    await state().loadPushPreferences();

    expect(await savedCopy()).toBeNull();
  });

  it('writes nothing offline: the copy stays as it was', async () => {
    await writeLocalCopy(A, PUSH_PREFERENCES_COPY_KIND, REMINDERS_OFF);
    setOnline(false);

    await state().loadPushPreferences();

    expect(fetchPushPreferences).not.toHaveBeenCalled();
    expect(await savedCopy()).toEqual(REMINDERS_OFF);
  });

  it('drops a read that lands after sign-out: no copy for either account', async () => {
    const read = deferred<typeof REMINDERS_OFF>();
    fetchPushPreferences.mockReturnValue(read.promise);

    const pending = state().loadPushPreferences();
    state().clearAuth();
    state().setAuthUser(B);
    read.settle(REMINDERS_OFF);
    await pending;

    expect(await savedCopy(A)).toBeNull();
    expect(await savedCopy(B)).toBeNull();
  });

  it('drops a read that lands after the same account signed out and in again', async () => {
    const read = deferred<typeof REMINDERS_OFF>();
    fetchPushPreferences.mockReturnValue(read.promise);

    const pending = state().loadPushPreferences();
    state().clearAuth();
    state().setAuthUser(A);
    read.settle(REMINDERS_OFF);
    await pending;

    expect(await savedCopy(A)).toBeNull();
  });
});

describe('setPushPreference writes the copy', () => {
  it('saves the row read back from the write', async () => {
    await writeLocalCopy(A, PUSH_PREFERENCES_COPY_KIND, ALL_PUSH_PREFERENCES_ON);
    savePushPreference.mockResolvedValue(REMINDERS_OFF);

    await state().setPushPreference('dateReminders', false);

    expect(savePushPreference).toHaveBeenCalledWith(A, 'dateReminders', false);
    expect(await savedCopy()).toEqual(REMINDERS_OFF);
    expect(state().pushPreferences).toEqual(REMINDERS_OFF);
  });

  it('keeps the copy when the save fails', async () => {
    await writeLocalCopy(A, PUSH_PREFERENCES_COPY_KIND, ALL_PUSH_PREFERENCES_ON);
    savePushPreference.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().setPushPreference('dateReminders', false)).rejects.toThrow('boom');

    expect(await savedCopy()).toEqual(ALL_PUSH_PREFERENCES_ON);
  });

  it('is refused offline and leaves the copy alone', async () => {
    await writeLocalCopy(A, PUSH_PREFERENCES_COPY_KIND, ALL_PUSH_PREFERENCES_ON);
    setOnline(false);

    await expect(state().setPushPreference('dateReminders', false)).rejects.toMatchObject({
      code: 'offline',
    });

    expect(savePushPreference).not.toHaveBeenCalled();
    expect(await savedCopy()).toEqual(ALL_PUSH_PREFERENCES_ON);
  });

  it("a save that lands after sign-out does not write the next account's copy", async () => {
    const write = deferred<typeof REMINDERS_OFF>();
    savePushPreference.mockReturnValue(write.promise);

    const pending = state().setPushPreference('dateReminders', false);
    state().clearAuth();
    state().setAuthUser(B);
    write.settle(REMINDERS_OFF);
    await pending;

    expect(await savedCopy(A)).toBeNull();
    expect(await savedCopy(B)).toBeNull();
  });
});

describe('readSavedPushPreferences', () => {
  it('returns null for an absent copy', async () => {
    expect(await readSavedPushPreferences(A)).toBeNull();
  });

  it.each([
    ['a string', 'on'],
    ['a list', [true, true]],
    ['a row missing the date reminders switch', { ...ALL_PUSH_PREFERENCES_ON, dateReminders: undefined }],
    ['a row with a non-boolean switch', { ...ALL_PUSH_PREFERENCES_ON, moods: 'yes' }],
    ['a row from before story 4.3', { loveNotes: true, moods: true, photos: true, pokesAndKisses: true, dates: true, partnerRequests: true }],
  ])('returns null for %s', async (_name, value) => {
    await writeLocalCopy(A, PUSH_PREFERENCES_COPY_KIND, value);

    expect(await readSavedPushPreferences(A)).toBeNull();
  });

  it('does not read another account\'s copy', async () => {
    await writeLocalCopy(B, PUSH_PREFERENCES_COPY_KIND, REMINDERS_OFF);

    expect(await readSavedPushPreferences(A)).toBeNull();
  });
});

describe('the push-preferences refresher', () => {
  it('reads the server in a shell with the local-notifications plugin', async () => {
    fetchPushPreferences.mockResolvedValue(REMINDERS_OFF);

    await refreshLocalCopy(PUSH_PREFERENCES_COPY_KIND);

    expect(fetchPushPreferences).toHaveBeenCalledWith(A);
    expect(await savedCopy()).toEqual(REMINDERS_OFF);
  });

  it.each([
    ['on the web', () => vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)],
    [
      'in a shell without the plugin',
      () => vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(false),
    ],
  ])('makes no read and writes no copy %s', async (_name, arrange) => {
    arrange();
    fetchPushPreferences.mockResolvedValue(REMINDERS_OFF);

    await refreshLocalCopy(PUSH_PREFERENCES_COPY_KIND);

    expect(fetchPushPreferences).not.toHaveBeenCalled();
    expect(await savedCopy()).toBeNull();
  });
});

describe('sign-out', () => {
  it('deletes the outgoing account\'s copy through deleteAccountData', async () => {
    await writeLocalCopy(A, PUSH_PREFERENCES_COPY_KIND, REMINDERS_OFF);
    await writeLocalCopy(B, PUSH_PREFERENCES_COPY_KIND, ALL_PUSH_PREFERENCES_ON);

    state().clearAuth();

    await vi.waitFor(async () => expect(await savedCopy(A)).toBeNull());
    expect(await savedCopy(B)).toEqual(ALL_PUSH_PREFERENCES_ON);
  });
});
