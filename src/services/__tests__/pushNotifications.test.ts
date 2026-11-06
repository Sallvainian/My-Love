import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  isPluginAvailable: vi.fn((_name: string) => true),
}));

const environment = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve({ environment: 'sandbox' as const })),
}));

const badge = vi.hoisted(() => ({
  clear: vi.fn(() => Promise.resolve()),
}));

const push = vi.hoisted(() => ({
  checkPermissions: vi.fn(() => Promise.resolve({ receive: 'prompt' })),
  requestPermissions: vi.fn(() => Promise.resolve({ receive: 'granted' })),
  register: vi.fn(() => Promise.resolve()),
  unregister: vi.fn(() => Promise.resolve()),
  addListener: vi.fn((_name: string, _handler: (payload: never) => void) =>
    Promise.resolve({ remove: vi.fn() })
  ),
}));

const local = vi.hoisted(() => ({
  removeAllDeliveredNotifications: vi.fn(() => Promise.resolve()),
}));

const rpc = vi.hoisted(() =>
  vi.fn((_name: string, _args?: unknown) => Promise.resolve({ error: null as { message: string } | null }))
);

const TOKEN_KEY = 'my-love-push-token';
const CLEAR_AFTER_RECORD_KEY = 'my-love-push-clear-after-record';

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: (name: string) => (name === 'AppBadge' ? badge : environment),
}));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: push }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: local }));
vi.mock('../../api/supabaseClient', () => ({ supabase: { rpc } }));

type Handler = (payload: unknown) => void;

/** The handler the module registered for `eventName`. */
function handlerFor(eventName: string): Handler {
  const call = push.addListener.mock.calls.find(([name]) => name === eventName);
  if (!call) throw new Error(`no ${eventName} listener`);
  return call[1] as Handler;
}

async function freshModule() {
  vi.resetModules();
  return import('../pushNotifications');
}

describe('startPushRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    push.checkPermissions.mockResolvedValue({ receive: 'prompt' });
    push.requestPermissions.mockResolvedValue({ receive: 'granted' });
    rpc.mockResolvedValue({ error: null });
  });

  it('does nothing in a browser', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const { startPushRegistration } = await freshModule();

    expect(await startPushRegistration()).toBe('unavailable');
    expect(push.checkPermissions).not.toHaveBeenCalled();
    expect(push.register).not.toHaveBeenCalled();
  });

  it('does nothing in a shell built before the push plugin', async () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'PushNotifications');
    const { startPushRegistration } = await freshModule();

    expect(await startPushRegistration()).toBe('unavailable');
    expect(push.checkPermissions).not.toHaveBeenCalled();
  });

  it('does nothing in a shell with the plugin but not the environment reader', async () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'PushEnvironment');
    const { startPushRegistration } = await freshModule();

    expect(await startPushRegistration()).toBe('unavailable');
    expect(push.register).not.toHaveBeenCalled();
  });

  it('asks permission when iOS has not asked, then registers', async () => {
    const { startPushRegistration } = await freshModule();

    expect(await startPushRegistration()).toBe('registering');
    expect(push.requestPermissions).toHaveBeenCalledTimes(1);
    expect(push.register).toHaveBeenCalledTimes(1);
  });

  it('does not ask again once permission is granted', async () => {
    push.checkPermissions.mockResolvedValue({ receive: 'granted' });
    const { startPushRegistration } = await freshModule();

    expect(await startPushRegistration()).toBe('registering');
    expect(push.requestPermissions).not.toHaveBeenCalled();
    expect(push.register).toHaveBeenCalledTimes(1);
  });

  it('leaves a person who declined alone', async () => {
    push.checkPermissions.mockResolvedValue({ receive: 'denied' });
    const { startPushRegistration } = await freshModule();

    expect(await startPushRegistration()).toBe('denied');
    expect(push.requestPermissions).not.toHaveBeenCalled();
    expect(push.register).not.toHaveBeenCalled();
  });

  it('treats a refusal at the alert as declined', async () => {
    push.requestPermissions.mockResolvedValue({ receive: 'denied' });
    const { startPushRegistration } = await freshModule();

    expect(await startPushRegistration()).toBe('denied');
    expect(push.register).not.toHaveBeenCalled();
  });

  it('listens once however often it starts', async () => {
    const { startPushRegistration } = await freshModule();

    await startPushRegistration();
    await startPushRegistration();

    expect(push.addListener).toHaveBeenCalledTimes(4); // registration, registrationError, pushNotificationReceived, pushNotificationActionPerformed, once
    expect(push.register).toHaveBeenCalledTimes(2);
  });

  it('retries listener setup after it failed once', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    push.addListener.mockRejectedValueOnce(new Error('bridge not ready'));
    const { startPushRegistration } = await freshModule();

    expect(await startPushRegistration()).toBe('unavailable');
    expect(await startPushRegistration()).toBe('registering');
    expect(push.register).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it('records the token with the build environment', async () => {
    environment.get.mockResolvedValueOnce({ environment: 'production' as never });
    const { startPushRegistration } = await freshModule();
    await startPushRegistration();

    handlerFor('registration')({ value: 'abc123' });

    await vi.waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('register_push_device', {
        p_token: 'abc123',
        p_environment: 'production',
      })
    );
    // Remembered for sign-out, which removes this device's row by it.
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc123');
    localStorage.removeItem(TOKEN_KEY);
  });

  it('logs and carries on when the server refuses the device', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ error: { message: 'nope' } });
    const { startPushRegistration } = await freshModule();
    await startPushRegistration();

    handlerFor('registration')({ value: 'abc123' });

    await vi.waitFor(() =>
      expect(errorLog).toHaveBeenCalledWith('[Push] Could not record the device:', 'nope')
    );
    errorLog.mockRestore();
  });

  it('never throws into sign-in when the plugin fails', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    push.checkPermissions.mockRejectedValue(new Error('boom'));
    const { startPushRegistration } = await freshModule();

    await expect(startPushRegistration()).resolves.toBe('unavailable');
    expect(errorLog).toHaveBeenCalledWith(
      '[Push] Registration did not start:',
      expect.objectContaining({ message: 'boom' })
    );
    errorLog.mockRestore();
  });
});

describe('startPushRenewalOnForeground', () => {
  const HOUR = 60 * 60 * 1000;
  let visibility: DocumentVisibilityState = 'visible';
  let online = true;

  function returnToForeground() {
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    push.checkPermissions.mockResolvedValue({ receive: 'granted' });
    rpc.mockResolvedValue({ error: null });
    visibility = 'visible';
    online = true;
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    localStorage.setItem(TOKEN_KEY, 'stored-token');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLEAR_AFTER_RECORD_KEY);
  });

  it('re-records the stored token on a foreground return 12 hours after the start', async () => {
    const { startPushRenewalOnForeground } = await freshModule();
    const stop = startPushRenewalOnForeground();

    vi.setSystemTime(Date.now() + 12 * HOUR);
    returnToForeground();

    await vi.waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('register_push_device', {
        p_token: 'stored-token',
        p_environment: 'sandbox',
      })
    );
    stop();
  });

  it('renews at most once every 12 hours', async () => {
    const { startPushRenewalOnForeground } = await freshModule();
    const stop = startPushRenewalOnForeground();

    returnToForeground();
    vi.setSystemTime(Date.now() + 11 * HOUR);
    returnToForeground();
    await Promise.resolve();
    expect(rpc).not.toHaveBeenCalled();

    vi.setSystemTime(Date.now() + 1 * HOUR);
    returnToForeground();
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    vi.setSystemTime(Date.now() + 1 * HOUR);
    returnToForeground();
    await Promise.resolve();
    expect(rpc).toHaveBeenCalledTimes(1);
    stop();
  });

  it('after an account switch, re-records on every return until a record succeeds, then clears (DW-413)', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await freshModule();
    await mod.clearDeliveredNotifications({ untilReregistered: true });
    const stop = mod.startPushRenewalOnForeground();
    rpc.mockResolvedValueOnce({ error: { message: 'nope' } });

    // No 12-hour wait: the outgoing account's pushes still reach the device.
    returnToForeground();
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(errorLog).toHaveBeenCalledWith('[Push] Could not record the device:', 'nope')
    );
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);

    returnToForeground();
    await vi.waitFor(() => expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(2));
    expect(rpc).toHaveBeenCalledTimes(2);

    // Recorded for the incoming account: back to once every 12 hours. A renewal
    // that goes ahead asks for the permission before its first await.
    const permissionChecks = push.checkPermissions.mock.calls.length;
    returnToForeground();
    expect(push.checkPermissions).toHaveBeenCalledTimes(permissionChecks);
    expect(rpc).toHaveBeenCalledTimes(2);
    stop();
    errorLog.mockRestore();
  });

  it('does nothing offline, when hidden, without a token or without permission', async () => {
    const { startPushRenewalOnForeground } = await freshModule();
    const stop = startPushRenewalOnForeground();
    vi.setSystemTime(Date.now() + 13 * HOUR);

    online = false;
    returnToForeground();
    online = true;
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    localStorage.removeItem(TOKEN_KEY);
    returnToForeground();
    await Promise.resolve();
    expect(rpc).not.toHaveBeenCalled();

    localStorage.setItem(TOKEN_KEY, 'stored-token');
    push.checkPermissions.mockResolvedValue({ receive: 'denied' });
    returnToForeground();
    await vi.waitFor(() => expect(push.checkPermissions).toHaveBeenCalled());
    await Promise.resolve();
    expect(rpc).not.toHaveBeenCalled();
    stop();
  });

  it('stops listening once stopped', async () => {
    const { startPushRenewalOnForeground } = await freshModule();
    startPushRenewalOnForeground()();
    vi.setSystemTime(Date.now() + 13 * HOUR);

    returnToForeground();
    await Promise.resolve();
    expect(push.checkPermissions).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('is a no-op in a browser', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const { startPushRenewalOnForeground } = await freshModule();
    const stop = startPushRenewalOnForeground();
    vi.setSystemTime(Date.now() + 13 * HOUR);

    returnToForeground();
    await Promise.resolve();
    expect(push.checkPermissions).not.toHaveBeenCalled();
    stop();
  });
});

describe('hasNativePush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
  });

  it('is true in the native shell with both push plugins', async () => {
    const { hasNativePush } = await freshModule();

    expect(hasNativePush()).toBe(true);
  });

  it('is false in a browser, even when the plugins report themselves available', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const { hasNativePush } = await freshModule();

    expect(hasNativePush()).toBe(false);
  });

  it.each(['PushNotifications', 'PushEnvironment'])('is false when %s is missing', async (missing) => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== missing);
    const { hasNativePush } = await freshModule();

    expect(hasNativePush()).toBe(false);
  });
});

describe('getPushPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
  });

  it.each([
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['prompt', 'prompt'],
    ['prompt-with-rationale', 'prompt'],
  ])('maps iOS %s to %s without asking for permission', async (receive, expected) => {
    push.checkPermissions.mockResolvedValue({ receive });
    const { getPushPermission } = await freshModule();

    expect(await getPushPermission()).toBe(expected);
    expect(push.requestPermissions).not.toHaveBeenCalled();
  });

  it('is unavailable without the native push plugins, and does not read the permission', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const { getPushPermission } = await freshModule();

    expect(await getPushPermission()).toBe('unavailable');
    expect(push.checkPermissions).not.toHaveBeenCalled();
  });

  it('never throws: a failing plugin answers unavailable', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    push.checkPermissions.mockRejectedValue(new Error('bridge gone'));
    const { getPushPermission } = await freshModule();

    await expect(getPushPermission()).resolves.toBe('unavailable');
    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});
