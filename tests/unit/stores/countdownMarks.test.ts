/**
 * Remind me in the store (story 4.2; on by default since 2026-11-05):
 * `remindersOff` lists the dates switched off. `loadCountdownMarks` (the
 * `reminders-off` local-copy refresher) and `setCountdownMark(key, on)` on the
 * composed `useAppStore`, with real local copies in fake-indexeddb, the
 * Supabase client's module and the marks service mocked, and the Capacitor
 * plugin reported present. The sign-out cancel is stubbed (its own cases are in
 * `signOutCancelsDateReminders.test.ts`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchRemindersOff = vi.hoisted(() => vi.fn());
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
    fetchRemindersOff: (...args: unknown[]) => fetchRemindersOff(...args),
    setRemindMe: (...args: unknown[]) => setCountdownMarkRequest(...args),
  },
}));

import { Capacitor } from '@capacitor/core';
import { AccountDataError, offlineMessage } from '../../../src/services/accountDataError';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { readLocalCopy, refreshLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { REMINDERS_OFF_COPY_KIND } from '../../../src/stores/slices/datesSlice';
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

const savedCopy = (userId: string = A) => readLocalCopy<unknown>(userId, REMINDERS_OFF_COPY_KIND);

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
    await writeLocalCopy(A, REMINDERS_OFF_COPY_KIND, ['wedding']);
    const request = deferred<string[]>();
    fetchRemindersOff.mockReturnValue(request.promise);

    const run = state().loadCountdownMarks();
    await vi.waitFor(() => expect(state().remindersOff).toEqual(['wedding']));
    expect(fetchRemindersOff).toHaveBeenCalledWith(A);

    request.settle(['own-birthday', 'event:e1']);
    await run;

    expect(state().remindersOff).toEqual(['own-birthday', 'event:e1']);
    expect(await savedCopy()).toEqual(['own-birthday', 'event:e1']);
  });

  it('saves an empty server answer as a loaded "none off"', async () => {
    await writeLocalCopy(A, REMINDERS_OFF_COPY_KIND, ['wedding']);
    fetchRemindersOff.mockResolvedValue([]);

    await state().loadCountdownMarks();

    expect(state().remindersOff).toEqual([]);
    expect(await savedCopy()).toEqual([]);
  });

  it('shows the saved copy offline and asks the server for nothing', async () => {
    await writeLocalCopy(A, REMINDERS_OFF_COPY_KIND, ['wedding']);
    setOnline(false);

    await state().loadCountdownMarks();

    expect(state().remindersOff).toEqual(['wedding']);
    expect(fetchRemindersOff).not.toHaveBeenCalled();
  });

  it('keeps state and copy when the read fails, and logs it', async () => {
    await writeLocalCopy(A, REMINDERS_OFF_COPY_KIND, ['wedding']);
    const failure = new AccountDataError('transport', 'boom');
    fetchRemindersOff.mockRejectedValue(failure);

    await expect(state().loadCountdownMarks()).resolves.toBeUndefined();

    expect(state().remindersOff).toEqual(['wedding']);
    expect(await savedCopy()).toEqual(['wedding']);
    expect(console.error).toHaveBeenCalledWith(
      '[Settings] Failed to load the Remind me switches from the server:',
      failure
    );
  });

  it('writes no copy when the first read fails: state stays "not loaded"', async () => {
    fetchRemindersOff.mockRejectedValue(new Error('boom'));

    await state().loadCountdownMarks();

    expect(state().remindersOff).toBeNull();
    expect(await savedCopy()).toBeNull();
  });

  it('does not show a malformed saved copy', async () => {
    await writeLocalCopy(A, REMINDERS_OFF_COPY_KIND, ['wedding', 7]);
    setOnline(false);

    await state().loadCountdownMarks();

    expect(state().remindersOff).toBeNull();
  });

  it('is the refresher of the reminders-off kind', async () => {
    fetchRemindersOff.mockResolvedValue(['wedding']);

    await refreshLocalCopy(REMINDERS_OFF_COPY_KIND);

    expect(state().remindersOff).toEqual(['wedding']);
  });

  it.each([
    ['on the web', () => vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)],
    [
      'in a shell without the plugin',
      () => vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(false),
    ],
  ])('does nothing %s: no request, no state, no copy write', async (_name, arrange) => {
    await writeLocalCopy(A, REMINDERS_OFF_COPY_KIND, ['wedding']);
    arrange();

    await state().loadCountdownMarks();
    await refreshLocalCopy(REMINDERS_OFF_COPY_KIND);

    expect(fetchRemindersOff).not.toHaveBeenCalled();
    expect(state().remindersOff).toBeNull();
    expect(await savedCopy()).toEqual(['wedding']);
  });

  it('does nothing signed out', async () => {
    state().clearAuth();

    await state().loadCountdownMarks();

    expect(fetchRemindersOff).not.toHaveBeenCalled();
  });

  it("writes nothing for the old account when the account changes during the read", async () => {
    const request = deferred<string[]>();
    fetchRemindersOff.mockReturnValue(request.promise);

    const run = state().loadCountdownMarks();
    await vi.waitFor(() => expect(fetchRemindersOff).toHaveBeenCalledTimes(1));
    state().setAuthUser(B);
    request.settle(['wedding']);
    await run;

    expect(state().remindersOff).toBeNull();
    expect(await savedCopy(A)).toBeNull();
    expect(await savedCopy(B)).toBeNull();
  });

  it('writes nothing when the same account signs in again during the read', async () => {
    const request = deferred<string[]>();
    fetchRemindersOff.mockReturnValue(request.promise);

    const run = state().loadCountdownMarks();
    await vi.waitFor(() => expect(fetchRemindersOff).toHaveBeenCalledTimes(1));
    useAppStore.setState({ authSessionVersion: state().authSessionVersion + 1 });
    request.settle(['wedding']);
    await run;

    expect(state().remindersOff).toBeNull();
    expect(await savedCopy()).toBeNull();
  });
});

describe('setCountdownMark', () => {
  beforeEach(async () => {
    fetchRemindersOff.mockResolvedValue(['wedding']);
    await state().loadCountdownMarks();
    vi.clearAllMocks();
    setCountdownMarkRequest.mockResolvedValue(undefined);
  });

  it('switches a date off: the server first, then state, then the copy', async () => {
    const request = deferred<void>();
    setCountdownMarkRequest.mockReturnValue(request.promise);

    const write = state().setCountdownMark('own-birthday', false);
    await vi.waitFor(() => expect(setCountdownMarkRequest).toHaveBeenCalledWith(A, 'own-birthday', false));
    // Nothing changed locally while the request is in flight.
    expect(state().remindersOff).toEqual(['wedding']);
    expect(await savedCopy()).toEqual(['wedding']);

    request.settle();
    await write;

    expect(state().remindersOff).toEqual(['wedding', 'own-birthday']);
    expect(await savedCopy()).toEqual(['wedding', 'own-birthday']);
  });

  it('switches a date back on', async () => {
    await state().setCountdownMark('wedding', true);

    expect(setCountdownMarkRequest).toHaveBeenCalledWith(A, 'wedding', true);
    expect(state().remindersOff).toEqual([]);
    expect(await savedCopy()).toEqual([]);
  });

  it('switching an off date off again leaves one entry', async () => {
    await state().setCountdownMark('wedding', false);

    expect(state().remindersOff).toEqual(['wedding']);
  });

  it('is refused offline with the offline message, before any request', async () => {
    setOnline(false);

    await expect(state().setCountdownMark('own-birthday', false)).rejects.toMatchObject({
      code: 'offline',
      message: offlineMessage('Reminders'),
    });

    expect(setCountdownMarkRequest).not.toHaveBeenCalled();
    expect(state().remindersOff).toEqual(['wedding']);
    expect(await savedCopy()).toEqual(['wedding']);
  });

  it('keeps state and copy when the server write fails', async () => {
    setCountdownMarkRequest.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().setCountdownMark('own-birthday', false)).rejects.toThrow('boom');

    expect(state().remindersOff).toEqual(['wedding']);
    expect(await savedCopy()).toEqual(['wedding']);
  });

  it('is refused while the switches are not loaded, before any request', async () => {
    useAppStore.setState({ remindersOff: null });

    await expect(state().setCountdownMark('own-birthday', false)).rejects.toThrow(/not loaded/);

    expect(setCountdownMarkRequest).not.toHaveBeenCalled();
  });

  it('writes neither state nor copy when the account changes during the write', async () => {
    const request = deferred<void>();
    setCountdownMarkRequest.mockReturnValue(request.promise);

    const write = state().setCountdownMark('own-birthday', false);
    await vi.waitFor(() => expect(setCountdownMarkRequest).toHaveBeenCalledTimes(1));
    state().setAuthUser(B);
    request.settle();
    await write;

    // The switch signs A out (state reset, A's copies deleted); the late write adds nothing.
    expect(state().remindersOff).toBeNull();
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
    fetchRemindersOff.mockResolvedValue(['wedding']);
    await state().loadCountdownMarks();
    expect(await savedCopy()).toEqual(['wedding']);

    state().clearAuth();

    expect(state().remindersOff).toBeNull();
    await vi.waitFor(async () => expect(await savedCopy()).toBeNull());
  });
});
