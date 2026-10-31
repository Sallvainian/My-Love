/**
 * Every transition to signed out stops this device's pushes; nothing else does
 *
 * `discardAccountState` calls `stopDevicePushes()` (APNs unregister, badge
 * clear, token forgotten) beside `deleteAccountData` when an account leaves and
 * nobody takes its place: a sign-out, or a boot with no session whose owner
 * marker names an account. An in-place account switch or a fresh sign-in must
 * not call it — `startPushRegistration` is registering the same device for the
 * incoming account then, and an unregister would race it.
 *
 * Drives the composed store, as signOutClearsAccountState.test.ts does. The
 * on-disk deletes are stubbed to settle at once, so nothing this file starts
 * fire-and-forget is still running when it ends.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
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

import { useAppStore } from '../../../src/stores/useAppStore';
import { ACCOUNT_OWNER_STORAGE_KEY } from '../../../src/stores/slices/authSlice';
import { moodService } from '../../../src/services/moodService';
import { stopDevicePushes } from '../../../src/services/pushNotifications';

const stop = vi.mocked(stopDevicePushes);

describe('stopDevicePushes on transitions to signed out', () => {
  beforeEach(() => {
    vi.spyOn(moodService, 'deleteSyncedForUser').mockResolvedValue(0);
    stop.mockClear();
    stop.mockResolvedValue(undefined);
    localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
    useAppStore.setState({ userId: null, userEmail: null, isAuthenticated: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
  });

  it('sign-out (clearAuth) stops them once', () => {
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');
    expect(stop).not.toHaveBeenCalled();

    useAppStore.getState().clearAuth();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('the SIGNED_OUT event (setAuthUser(null)) stops them', () => {
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');

    useAppStore.getState().setAuthUser(null);

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('a no-session boot whose marker names an account stops them', () => {
    localStorage.setItem(ACCOUNT_OWNER_STORAGE_KEY, 'USER-A-ID');

    useAppStore.getState().clearAuth();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('a no-session boot with no marker, or a repeated sign-out, does not', () => {
    useAppStore.getState().clearAuth();
    expect(stop).not.toHaveBeenCalled();

    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');
    useAppStore.getState().clearAuth();
    useAppStore.getState().clearAuth();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('an in-place account switch does not', () => {
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');

    useAppStore.getState().setAuthUser('USER-C-ID', 'c@example.com');

    expect(stop).not.toHaveBeenCalled();
  });

  it('a fresh sign-in does not, even over a marker naming another account', () => {
    localStorage.setItem(ACCOUNT_OWNER_STORAGE_KEY, 'USER-B-ID');

    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');

    expect(stop).not.toHaveBeenCalled();
  });

  it('a rejection is logged and sign-out still completes', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('bridge gone');
    stop.mockRejectedValueOnce(failure);
    useAppStore.getState().setAuthUser('USER-A-ID', 'a@example.com');

    expect(() => useAppStore.getState().clearAuth()).not.toThrow();

    expect(useAppStore.getState().userId).toBeNull();
    await vi.waitFor(() =>
      expect(errorLog).toHaveBeenCalledWith("[AuthSlice] Failed to stop this device's pushes:", failure)
    );
  });
});
