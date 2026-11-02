/**
 * Every deletion of an account's data cancels the shell's date reminders
 *
 * `deleteAccountData` calls `cancelDateReminders()` beside the local-copy,
 * image and mood deletes: a sign-out, a boot with no session whose owner marker
 * names an account, an in-place account switch and a fresh sign-in over another
 * account's leftover marker. A fresh sign-in with nothing left over does not.
 *
 * Drives the composed store, as signOutStopsDevicePushes.test.ts does. The
 * on-disk deletes are stubbed to settle at once, so nothing this file starts
 * fire-and-forget is still running when it ends.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../src/services/dateReminders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/dateReminders')>();
  return { ...actual, cancelDateReminders: vi.fn(() => Promise.resolve()) };
});
vi.mock('../../../src/services/pushNotifications', () => ({
  stopDevicePushes: vi.fn(() => Promise.resolve()),
  startPushRegistration: vi.fn(() => Promise.resolve('unavailable')),
}));
vi.mock('../../../src/services/localCopy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/localCopy')>();
  return { ...actual, deleteAccountCopies: vi.fn(() => Promise.resolve()) };
});
vi.mock('../../../src/services/imageCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/imageCache')>();
  return { ...actual, deleteAccountImages: vi.fn(() => Promise.resolve()) };
});

import { cancelDateReminders } from '../../../src/services/dateReminders';
import { moodService } from '../../../src/services/moodService';
import { ACCOUNT_OWNER_STORAGE_KEY } from '../../../src/stores/slices/authSlice';
import { useAppStore } from '../../../src/stores/useAppStore';

const cancel = vi.mocked(cancelDateReminders);

describe('cancelDateReminders when an account leaves the device', () => {
  beforeEach(() => {
    vi.spyOn(moodService, 'deleteSyncedForUser').mockResolvedValue(0);
    cancel.mockClear();
    cancel.mockResolvedValue(undefined);
    localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
    useAppStore.setState({ userId: null, userEmail: null, isAuthenticated: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
  });

  it('sign-out (clearAuth) cancels once', () => {
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');
    expect(cancel).not.toHaveBeenCalled();

    useAppStore.getState().clearAuth();

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('the SIGNED_OUT event (setAuthUser(null)) cancels', () => {
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');

    useAppStore.getState().setAuthUser(null);

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('a no-session boot whose marker names an account cancels', () => {
    localStorage.setItem(ACCOUNT_OWNER_STORAGE_KEY, 'USER-A-ID');

    useAppStore.getState().clearAuth();

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('an in-place account switch cancels the outgoing account\'s reminders', () => {
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');

    useAppStore.getState().setAuthUser('USER-C-ID', 'c@example.com');

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('a fresh sign-in over a marker naming another account cancels that account\'s leftover', () => {
    localStorage.setItem(ACCOUNT_OWNER_STORAGE_KEY, 'USER-B-ID');

    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('a fresh sign-in with no leftover, a repeated sign-in and a no-marker boot do not', () => {
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');

    expect(cancel).not.toHaveBeenCalled();
  });

  it('a rejection is logged and sign-out still completes', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('bridge gone');
    cancel.mockRejectedValueOnce(failure);
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');

    expect(() => useAppStore.getState().clearAuth()).not.toThrow();

    expect(useAppStore.getState().userId).toBeNull();
    await vi.waitFor(() =>
      expect(errorLog).toHaveBeenCalledWith(
        "[AuthSlice] Failed to cancel the outgoing account's date reminders:",
        failure
      )
    );
  });
});
