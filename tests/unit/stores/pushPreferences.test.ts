/**
 * Push switches in the store (story 3.7): `loadPushPreferences` and
 * `setPushPreference` on the composed `useAppStore`, with only the Supabase
 * client's module and the preferences service mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchPushPreferences = vi.fn();
const savePushPreference = vi.fn();

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

import { AccountDataError } from '../../../src/services/accountDataError';
import { ALL_PUSH_PREFERENCES_ON } from '../../../src/services/pushPreferencesService';
import { useAppStore } from '../../../src/stores/useAppStore';

const A = 'USER-A-ID';
const B = 'USER-B-ID';

const NOTES_OFF = { ...ALL_PUSH_PREFERENCES_ON, loveNotes: false };

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

function state() {
  return useAppStore.getState();
}

/** A promise settled by the test, for holding a request in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  state().clearAuth();
  state().setAuthUser(A);
});

afterEach(() => {
  setOnline(true);
  vi.restoreAllMocks();
});

describe('loadPushPreferences', () => {
  it('stores the account row the service read', async () => {
    fetchPushPreferences.mockResolvedValue(NOTES_OFF);

    await state().loadPushPreferences();

    expect(fetchPushPreferences).toHaveBeenCalledWith(A);
    expect(state().pushPreferences).toEqual(NOTES_OFF);
    expect(state().pushPreferencesLoadFailed).toBe(false);
  });

  it('does nothing offline', async () => {
    setOnline(false);

    await state().loadPushPreferences();

    expect(fetchPushPreferences).not.toHaveBeenCalled();
    expect(state().pushPreferences).toBeNull();
    expect(state().pushPreferencesLoadFailed).toBe(false);
  });

  it('does nothing signed out', async () => {
    state().clearAuth();

    await state().loadPushPreferences();

    expect(fetchPushPreferences).not.toHaveBeenCalled();
  });

  it('never throws: a failed read sets the failed flag and logs', async () => {
    fetchPushPreferences.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().loadPushPreferences()).resolves.toBeUndefined();

    expect(state().pushPreferences).toBeNull();
    expect(state().pushPreferencesLoadFailed).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });

  it('a later successful read clears the failed flag', async () => {
    fetchPushPreferences.mockRejectedValueOnce(new Error('boom'));
    await state().loadPushPreferences();
    expect(state().pushPreferencesLoadFailed).toBe(true);

    fetchPushPreferences.mockResolvedValueOnce(ALL_PUSH_PREFERENCES_ON);
    await state().loadPushPreferences();

    expect(state().pushPreferencesLoadFailed).toBe(false);
    expect(state().pushPreferences).toEqual(ALL_PUSH_PREFERENCES_ON);
  });

  it('a failed reload after a successful load clears the switches, so none shows stale', async () => {
    fetchPushPreferences.mockResolvedValueOnce(NOTES_OFF);
    await state().loadPushPreferences();
    expect(state().pushPreferences).toEqual(NOTES_OFF);

    fetchPushPreferences.mockRejectedValueOnce(new Error('boom'));
    await state().loadPushPreferences();

    expect(state().pushPreferences).toBeNull();
    expect(state().pushPreferencesLoadFailed).toBe(true);
  });

  it('a failed reload that lands after sign-out leaves the next account untouched', async () => {
    fetchPushPreferences.mockResolvedValueOnce(NOTES_OFF);
    await state().loadPushPreferences();
    const read = deferred<never>();
    fetchPushPreferences.mockReturnValueOnce(read.promise);

    const pending = state().loadPushPreferences();
    state().clearAuth();
    state().setAuthUser(B);
    useAppStore.setState({ pushPreferences: ALL_PUSH_PREFERENCES_ON });
    read.reject(new Error('boom'));
    await pending;

    expect(state().pushPreferences).toEqual(ALL_PUSH_PREFERENCES_ON);
    expect(state().pushPreferencesLoadFailed).toBe(false);
  });

  it('drops a read that lands after sign-out', async () => {
    const read = deferred<typeof NOTES_OFF>();
    fetchPushPreferences.mockReturnValue(read.promise);

    const pending = state().loadPushPreferences();
    state().clearAuth();
    read.resolve(NOTES_OFF);
    await pending;

    expect(state().pushPreferences).toBeNull();
  });

  it('drops a read that lands after the same account signed out and in again', async () => {
    const read = deferred<typeof NOTES_OFF>();
    fetchPushPreferences.mockReturnValue(read.promise);

    const pending = state().loadPushPreferences();
    state().clearAuth();
    state().setAuthUser(A);
    read.resolve(NOTES_OFF);
    await pending;

    expect(state().pushPreferences).toBeNull();
  });

  it('drops a failure that lands after sign-out without flagging the next account', async () => {
    const read = deferred<never>();
    fetchPushPreferences.mockReturnValue(read.promise);

    const pending = state().loadPushPreferences();
    state().clearAuth();
    state().setAuthUser(B);
    read.reject(new Error('boom'));
    await pending;

    expect(state().pushPreferencesLoadFailed).toBe(false);
  });
});

describe('setPushPreference', () => {
  it('saves one switch server first, then stores the row it returns', async () => {
    savePushPreference.mockResolvedValue(NOTES_OFF);

    await state().setPushPreference('loveNotes', false);

    expect(savePushPreference).toHaveBeenCalledWith(A, 'loveNotes', false);
    expect(state().pushPreferences).toEqual(NOTES_OFF);
  });

  it('is refused offline before any request, and changes nothing', async () => {
    useAppStore.setState({ pushPreferences: ALL_PUSH_PREFERENCES_ON });
    setOnline(false);

    await expect(state().setPushPreference('loveNotes', false)).rejects.toMatchObject({
      code: 'offline',
      message: 'You are offline. Push settings need a connection to save.',
    });

    expect(savePushPreference).not.toHaveBeenCalled();
    expect(state().pushPreferences).toEqual(ALL_PUSH_PREFERENCES_ON);
  });

  it('a failed save throws and keeps the old state', async () => {
    useAppStore.setState({ pushPreferences: ALL_PUSH_PREFERENCES_ON });
    savePushPreference.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().setPushPreference('moods', false)).rejects.toThrow('boom');

    expect(state().pushPreferences).toEqual(ALL_PUSH_PREFERENCES_ON);
  });

  it('throws when signed out', async () => {
    state().clearAuth();

    await expect(state().setPushPreference('moods', false)).rejects.toThrow(/signed in/);
    expect(savePushPreference).not.toHaveBeenCalled();
  });

  it("a save that lands after sign-out does not reach the next account's state", async () => {
    const write = deferred<typeof NOTES_OFF>();
    savePushPreference.mockReturnValue(write.promise);

    const pending = state().setPushPreference('loveNotes', false);
    state().clearAuth();
    state().setAuthUser(B);
    write.resolve(NOTES_OFF);
    await pending;

    expect(state().pushPreferences).toBeNull();
  });

  it('two quick switches are saved in order and the last row wins', async () => {
    const first = deferred<typeof NOTES_OFF>();
    savePushPreference.mockReturnValueOnce(first.promise);
    savePushPreference.mockResolvedValueOnce({ ...NOTES_OFF, moods: false });

    const a = state().setPushPreference('loveNotes', false);
    const b = state().setPushPreference('moods', false);
    await Promise.resolve();
    expect(savePushPreference).toHaveBeenCalledTimes(1);

    first.resolve(NOTES_OFF);
    await Promise.all([a, b]);

    expect(savePushPreference.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ['loveNotes', false],
      ['moods', false],
    ]);
    expect(state().pushPreferences).toEqual({ ...NOTES_OFF, moods: false });
  });
});
