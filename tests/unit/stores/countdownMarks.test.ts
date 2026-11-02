/**
 * Countdown marks in the store (story 4.2): `loadCountdownMarks` (the
 * `countdown-marks` local-copy refresher) and `setCountdownMark` on the
 * composed `useAppStore`, with real local copies in fake-indexeddb, the
 * Supabase client's module and the marks service mocked, and the Capacitor
 * plugin reported present. The sign-out cancel is stubbed (its own cases are in
 * `signOutCancelsDateReminders.test.ts`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchCountdownMarks = vi.hoisted(() => vi.fn());
const setCountdownMarkRequest = vi.hoisted(() => vi.fn());
const cancelSpy = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }));
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));
vi.mock('../../../src/services/dateReminders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/dateReminders')>()),
  cancelDateReminders: cancelSpy,
}));
vi.mock('../../../src/services/countdownMarksService', () => ({
  countdownMarksService: {
    fetchCountdownMarks: (...args: unknown[]) => fetchCountdownMarks(...args),
    setCountdownMark: (...args: unknown[]) => setCountdownMarkRequest(...args),
  },
}));

import { Capacitor } from '@capacitor/core';
import { AccountDataError, offlineMessage } from '../../../src/services/accountDataError';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { readLocalCopy, refreshLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { COUNTDOWN_MARKS_COPY_KIND } from '../../../src/stores/slices/settingsSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import { deferred, setOnline } from './accountDataFixtures';

const A = 'USER-A-ID';
const B = 'USER-B-ID';

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

const savedCopy = (userId: string = A) => readLocalCopy<unknown>(userId, COUNTDOWN_MARKS_COPY_KIND);

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  cancelSpy.mockResolvedValue(undefined);
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

describe('loadCountdownMarks', () => {
  it('shows the saved copy at once, then replaces state and copy with the server rows', async () => {
    await writeLocalCopy(A, COUNTDOWN_MARKS_COPY_KIND, ['wedding']);
    const request = deferred<string[]>();
    fetchCountdownMarks.mockReturnValue(request.promise);

    const run = state().loadCountdownMarks();
    await vi.waitFor(() => expect(state().countdownMarks).toEqual(['wedding']));
    expect(fetchCountdownMarks).toHaveBeenCalledWith(A);

    request.settle(['own-birthday', 'event:e1']);
    await run;

    expect(state().countdownMarks).toEqual(['own-birthday', 'event:e1']);
    expect(await savedCopy()).toEqual(['own-birthday', 'event:e1']);
  });

  it('saves an empty server answer as a loaded "no marks"', async () => {
    await writeLocalCopy(A, COUNTDOWN_MARKS_COPY_KIND, ['wedding']);
    fetchCountdownMarks.mockResolvedValue([]);

    await state().loadCountdownMarks();

    expect(state().countdownMarks).toEqual([]);
    expect(await savedCopy()).toEqual([]);
  });

  it('shows the saved copy offline and asks the server for nothing', async () => {
    await writeLocalCopy(A, COUNTDOWN_MARKS_COPY_KIND, ['wedding']);
    setOnline(false);

    await state().loadCountdownMarks();

    expect(state().countdownMarks).toEqual(['wedding']);
    expect(fetchCountdownMarks).not.toHaveBeenCalled();
  });

  it('keeps state and copy when the read fails, and logs it', async () => {
    await writeLocalCopy(A, COUNTDOWN_MARKS_COPY_KIND, ['wedding']);
    fetchCountdownMarks.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().loadCountdownMarks()).resolves.toBeUndefined();

    expect(state().countdownMarks).toEqual(['wedding']);
    expect(await savedCopy()).toEqual(['wedding']);
    expect(console.error).toHaveBeenCalled();
  });

  it('writes no copy when the first read fails: state stays "not loaded"', async () => {
    fetchCountdownMarks.mockRejectedValue(new Error('boom'));

    await state().loadCountdownMarks();

    expect(state().countdownMarks).toBeNull();
    expect(await savedCopy()).toBeNull();
  });

  it('does not show a malformed saved copy', async () => {
    await writeLocalCopy(A, COUNTDOWN_MARKS_COPY_KIND, ['wedding', 7]);
    setOnline(false);

    await state().loadCountdownMarks();

    expect(state().countdownMarks).toBeNull();
  });

  it('is the refresher of the countdown-marks kind', async () => {
    fetchCountdownMarks.mockResolvedValue(['wedding']);

    await refreshLocalCopy(COUNTDOWN_MARKS_COPY_KIND);

    expect(state().countdownMarks).toEqual(['wedding']);
  });

  it.each([
    ['on the web', () => vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)],
    [
      'in a shell without the plugin',
      () => vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(false),
    ],
  ])('does nothing %s: no request, no state, no copy write', async (_name, arrange) => {
    await writeLocalCopy(A, COUNTDOWN_MARKS_COPY_KIND, ['wedding']);
    arrange();

    await state().loadCountdownMarks();
    await refreshLocalCopy(COUNTDOWN_MARKS_COPY_KIND);

    expect(fetchCountdownMarks).not.toHaveBeenCalled();
    expect(state().countdownMarks).toBeNull();
    expect(await savedCopy()).toEqual(['wedding']);
  });

  it('does nothing signed out', async () => {
    state().clearAuth();

    await state().loadCountdownMarks();

    expect(fetchCountdownMarks).not.toHaveBeenCalled();
  });

  it("writes nothing for the old account when the account changes during the read", async () => {
    const request = deferred<string[]>();
    fetchCountdownMarks.mockReturnValue(request.promise);

    const run = state().loadCountdownMarks();
    await vi.waitFor(() => expect(fetchCountdownMarks).toHaveBeenCalledTimes(1));
    state().setAuthUser(B);
    request.settle(['wedding']);
    await run;

    expect(state().countdownMarks).toBeNull();
    expect(await savedCopy(A)).toBeNull();
    expect(await savedCopy(B)).toBeNull();
  });

  it('writes nothing when the same account signs in again during the read', async () => {
    const request = deferred<string[]>();
    fetchCountdownMarks.mockReturnValue(request.promise);

    const run = state().loadCountdownMarks();
    await vi.waitFor(() => expect(fetchCountdownMarks).toHaveBeenCalledTimes(1));
    useAppStore.setState({ authSessionVersion: state().authSessionVersion + 1 });
    request.settle(['wedding']);
    await run;

    expect(state().countdownMarks).toBeNull();
    expect(await savedCopy()).toBeNull();
  });
});

describe('setCountdownMark', () => {
  beforeEach(async () => {
    fetchCountdownMarks.mockResolvedValue(['wedding']);
    await state().loadCountdownMarks();
    vi.clearAllMocks();
    setCountdownMarkRequest.mockResolvedValue(undefined);
  });

  it('marks: the server first, then state, then the copy', async () => {
    const request = deferred<void>();
    setCountdownMarkRequest.mockReturnValue(request.promise);

    const write = state().setCountdownMark('own-birthday', true);
    await vi.waitFor(() => expect(setCountdownMarkRequest).toHaveBeenCalledWith(A, 'own-birthday', true));
    // Nothing changed locally while the request is in flight.
    expect(state().countdownMarks).toEqual(['wedding']);
    expect(await savedCopy()).toEqual(['wedding']);

    request.settle();
    await write;

    expect(state().countdownMarks).toEqual(['wedding', 'own-birthday']);
    expect(await savedCopy()).toEqual(['wedding', 'own-birthday']);
  });

  it('unmarks', async () => {
    await state().setCountdownMark('wedding', false);

    expect(setCountdownMarkRequest).toHaveBeenCalledWith(A, 'wedding', false);
    expect(state().countdownMarks).toEqual([]);
    expect(await savedCopy()).toEqual([]);
  });

  it('marking a marked date again leaves one entry', async () => {
    await state().setCountdownMark('wedding', true);

    expect(state().countdownMarks).toEqual(['wedding']);
  });

  it('is refused offline with the offline message, before any request', async () => {
    setOnline(false);

    await expect(state().setCountdownMark('own-birthday', true)).rejects.toMatchObject({
      code: 'offline',
      message: offlineMessage('Reminders'),
    });

    expect(setCountdownMarkRequest).not.toHaveBeenCalled();
    expect(state().countdownMarks).toEqual(['wedding']);
    expect(await savedCopy()).toEqual(['wedding']);
  });

  it('keeps state and copy when the server write fails', async () => {
    setCountdownMarkRequest.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().setCountdownMark('own-birthday', true)).rejects.toThrow('boom');

    expect(state().countdownMarks).toEqual(['wedding']);
    expect(await savedCopy()).toEqual(['wedding']);
  });

  it('is refused while the marks are not loaded, before any request', async () => {
    useAppStore.setState({ countdownMarks: null });

    await expect(state().setCountdownMark('own-birthday', true)).rejects.toThrow(/not loaded/);

    expect(setCountdownMarkRequest).not.toHaveBeenCalled();
  });

  it('writes neither state nor copy when the account changes during the write', async () => {
    const request = deferred<void>();
    setCountdownMarkRequest.mockReturnValue(request.promise);

    const write = state().setCountdownMark('own-birthday', true);
    await vi.waitFor(() => expect(setCountdownMarkRequest).toHaveBeenCalledTimes(1));
    state().setAuthUser(B);
    request.settle();
    await write;

    // The switch signs A out (state reset, A's copies deleted); the late write adds nothing.
    expect(state().countdownMarks).toBeNull();
    await vi.waitFor(async () => expect(await savedCopy(A)).toBeNull());
    expect(await savedCopy(B)).toBeNull();
  });

  it('rejects when signed out', async () => {
    state().clearAuth();

    await expect(state().setCountdownMark('wedding', true)).rejects.toThrow(/signed in/);
    expect(setCountdownMarkRequest).not.toHaveBeenCalled();
  });
});

describe('sign-out', () => {
  it('resets the state to "not loaded" and deletes the account copy', async () => {
    fetchCountdownMarks.mockResolvedValue(['wedding']);
    await state().loadCountdownMarks();
    expect(await savedCopy()).toEqual(['wedding']);

    state().clearAuth();

    expect(state().countdownMarks).toBeNull();
    await vi.waitFor(async () => expect(await savedCopy()).toBeNull());
  });
});
