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

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: (name: string) => (name === 'AppBadge' ? badge : environment),
}));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: push }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: local }));
vi.mock('../../api/supabaseClient', () => ({ supabase: { rpc } }));

async function freshModule() {
  vi.resetModules();
  return import('../pushNotifications');
}

describe('removePushRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    rpc.mockResolvedValue({ error: null });
    localStorage.setItem(TOKEN_KEY, 'device-token-1');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem(TOKEN_KEY);
    Reflect.deleteProperty(navigator, 'onLine');
  });

  it('deletes the caller\'s row for the stored token', async () => {
    const { removePushRegistration } = await freshModule();

    await removePushRegistration();

    expect(rpc).toHaveBeenCalledExactlyOnceWith('unregister_push_device', { p_token: 'device-token-1' });
  });

  it('sends nothing offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { removePushRegistration } = await freshModule();

    await removePushRegistration();

    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['in a browser', () => capacitor.isNativePlatform.mockReturnValue(false)],
    [
      'in a shell without the push plugin',
      () => capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'PushNotifications'),
    ],
    ['with no token stored', () => localStorage.removeItem(TOKEN_KEY)],
  ])('sends nothing and logs nothing %s', async (_case, arrange) => {
    arrange();
    const errorLog = vi.spyOn(console, 'error');
    const { removePushRegistration } = await freshModule();

    await removePushRegistration();

    expect(rpc).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('logs a refusal or a thrown call and resolves', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { removePushRegistration } = await freshModule();

    rpc.mockResolvedValueOnce({ error: { message: 'nope' } });
    await expect(removePushRegistration()).resolves.toBeUndefined();
    rpc.mockRejectedValueOnce(new Error('network'));
    await expect(removePushRegistration()).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });

  it('gives up after about 3 s so sign-out never hangs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockReturnValueOnce(new Promise(() => {}));
    const { removePushRegistration } = await freshModule();

    let settled = false;
    const done = removePushRegistration().then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(2_900);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await done;

    expect(settled).toBe(true);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('timed out'));
    errorLog.mockRestore();
  });
});

describe('removeAllPushRegistrations', () => {
  /** The RPC's builder: `setHeader` records the header and returns the call. */
  const setHeader = vi.fn();
  function answer(result: Promise<{ error: { message: string } | null }>) {
    rpc.mockImplementationOnce(() => {
      const call = Object.assign(result, { setHeader });
      setHeader.mockReturnValue(call);
      return call;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem(TOKEN_KEY);
  });

  it('deletes every row the account owns with the token it is given, and resolves true', async () => {
    localStorage.setItem(TOKEN_KEY, 'device-token-1');
    answer(Promise.resolve({ error: null }));
    const { removeAllPushRegistrations } = await freshModule();

    await expect(removeAllPushRegistrations('access-1')).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledExactlyOnceWith('unregister_all_push_devices');
    // The global sign-out has removed the session from the client (DW-412).
    expect(setHeader).toHaveBeenCalledExactlyOnceWith('Authorization', 'Bearer access-1');
  });

  it.each([
    ['in a browser', () => capacitor.isNativePlatform.mockReturnValue(false)],
    ['with no token stored', () => localStorage.removeItem(TOKEN_KEY)],
  ])('still calls the RPC %s', async (_case, arrange) => {
    arrange();
    answer(Promise.resolve({ error: null }));
    const { removeAllPushRegistrations } = await freshModule();

    await expect(removeAllPushRegistrations('access-1')).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledExactlyOnceWith('unregister_all_push_devices');
  });

  it('makes no call and resolves false with no access token', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { removeAllPushRegistrations } = await freshModule();

    await expect(removeAllPushRegistrations(undefined)).resolves.toBe(false);

    expect(rpc).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('[Push]'));
    errorLog.mockRestore();
  });

  it('logs a refusal and resolves false', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    answer(Promise.resolve({ error: { message: 'nope' } }));
    const { removeAllPushRegistrations } = await freshModule();

    await expect(removeAllPushRegistrations('access-1')).resolves.toBe(false);

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('[Push]'), 'nope');
    errorLog.mockRestore();
  });

  it('logs a thrown call and resolves false', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { removeAllPushRegistrations } = await freshModule();
    // Created after the import, so the RPC's catch attaches before a macrotask.
    answer(Promise.reject(new Error('network')));

    await expect(removeAllPushRegistrations('access-1')).resolves.toBe(false);

    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it('gives up after about 3 s and resolves false so sign-out never hangs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    answer(new Promise(() => {}));
    const { removeAllPushRegistrations } = await freshModule();

    let result: boolean | undefined;
    const done = removeAllPushRegistrations('access-1').then((value) => {
      result = value;
    });
    await vi.advanceTimersByTimeAsync(2_900);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    await done;

    expect(result).toBe(false);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('timed out'));
    errorLog.mockRestore();
  });
});

describe('stopDevicePushes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    localStorage.setItem(TOKEN_KEY, 'device-token-1');
  });

  afterEach(() => {
    localStorage.removeItem(TOKEN_KEY);
  });

  it('unregisters from APNs, empties Notification Center, clears the badge and forgets the token', async () => {
    const { stopDevicePushes } = await freshModule();

    await stopDevicePushes();

    expect(push.unregister).toHaveBeenCalledTimes(1);
    // Pushes and date reminders alike, so the next person cannot read them (DW-352).
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);
    expect(badge.clear).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    // The server row is actionService.signOut's job; this half makes no request.
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a story 3.1 shell, with no badge plugin, still unregisters', async () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'AppBadge');
    const { stopDevicePushes } = await freshModule();

    await stopDevicePushes();

    expect(push.unregister).toHaveBeenCalledTimes(1);
    expect(badge.clear).not.toHaveBeenCalled();
  });

  it('a shell with no local-notifications plugin skips the removal and still clears the badge', async () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'LocalNotifications');
    const { stopDevicePushes } = await freshModule();

    await stopDevicePushes();

    expect(local.removeAllDeliveredNotifications).not.toHaveBeenCalled();
    expect(push.unregister).toHaveBeenCalledTimes(1);
    expect(badge.clear).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('an older shell, with none of the plugins, makes no native call', async () => {
    capacitor.isPluginAvailable.mockReturnValue(false);
    const { stopDevicePushes } = await freshModule();

    await stopDevicePushes();

    expect(push.unregister).not.toHaveBeenCalled();
    expect(local.removeAllDeliveredNotifications).not.toHaveBeenCalled();
    expect(badge.clear).not.toHaveBeenCalled();
  });

  it('does nothing in a browser and logs nothing', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const errorLog = vi.spyOn(console, 'error');
    const { stopDevicePushes } = await freshModule();

    await stopDevicePushes();

    expect(push.unregister).not.toHaveBeenCalled();
    expect(local.removeAllDeliveredNotifications).not.toHaveBeenCalled();
    expect(badge.clear).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('a failing removal is logged once, and the badge and token still go', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    local.removeAllDeliveredNotifications.mockRejectedValueOnce(new Error('bridge gone'));
    const { stopDevicePushes } = await freshModule();

    await expect(stopDevicePushes()).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('delivered notifications'),
      expect.any(Error)
    );
    expect(badge.clear).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    errorLog.mockRestore();
  });

  it('a failing unregister still clears the badge, and nothing throws', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    push.unregister.mockRejectedValueOnce(new Error('bridge gone'));
    badge.clear.mockRejectedValueOnce(new Error('no badge'));
    const { stopDevicePushes } = await freshModule();

    await expect(stopDevicePushes()).resolves.toBeUndefined();

    expect(badge.clear).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    errorLog.mockRestore();
  });
});
