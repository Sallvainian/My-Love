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

const rpc = vi.hoisted(() =>
  vi.fn((_name: string, _args?: unknown) => Promise.resolve({ error: null as { message: string } | null }))
);

const TOKEN_KEY = 'my-love-push-token';

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: (name: string) => (name === 'AppBadge' ? badge : environment),
}));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: push }));
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

    await vi.waitFor(() => expect(errorLog).toHaveBeenCalled());
    errorLog.mockRestore();
  });

  it('never throws into sign-in when the plugin fails', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    push.checkPermissions.mockRejectedValue(new Error('boom'));
    const { startPushRegistration } = await freshModule();

    await expect(startPushRegistration()).resolves.toBe('unavailable');
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });
});

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

  it('unregisters from APNs, clears the badge and forgets the token', async () => {
    const { stopDevicePushes } = await freshModule();

    await stopDevicePushes();

    expect(push.unregister).toHaveBeenCalledTimes(1);
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

  it('an older shell, with neither plugin, makes no native call', async () => {
    capacitor.isPluginAvailable.mockReturnValue(false);
    const { stopDevicePushes } = await freshModule();

    await stopDevicePushes();

    expect(push.unregister).not.toHaveBeenCalled();
    expect(badge.clear).not.toHaveBeenCalled();
  });

  it('does nothing in a browser and logs nothing', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const errorLog = vi.spyOn(console, 'error');
    const { stopDevicePushes } = await freshModule();

    await stopDevicePushes();

    expect(push.unregister).not.toHaveBeenCalled();
    expect(badge.clear).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
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

describe('clearAppBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
  });

  it('clears the icon badge in the shell', async () => {
    const { clearAppBadge } = await freshModule();

    await clearAppBadge();

    expect(badge.clear).toHaveBeenCalledTimes(1);
  });

  it('does nothing in a browser, and logs nothing', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const errorLog = vi.spyOn(console, 'error');
    const { clearAppBadge } = await freshModule();

    await clearAppBadge();

    expect(badge.clear).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('makes no badge call in a shell without the AppBadge plugin', async () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'AppBadge');
    const { clearAppBadge } = await freshModule();

    await clearAppBadge();

    expect(badge.clear).not.toHaveBeenCalled();
  });

  it('logs a failing plugin and resolves', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    badge.clear.mockRejectedValueOnce(new Error('no badge'));
    const { clearAppBadge } = await freshModule();

    await expect(clearAppBadge()).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});

describe('onForegroundPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    push.checkPermissions.mockResolvedValue({ receive: 'granted' });
  });

  it('calls every handler for a push that arrives in front', async () => {
    const { onForegroundPush, startPushRegistration } = await freshModule();
    const first = vi.fn();
    const second = vi.fn();
    onForegroundPush(first);
    onForegroundPush(second);
    await startPushRegistration();

    handlerFor('pushNotificationReceived')({ title: 'Casey' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops calling a handler once it is removed', async () => {
    const { onForegroundPush, startPushRegistration } = await freshModule();
    const handler = vi.fn();
    const stop = onForegroundPush(handler);
    await startPushRegistration();

    stop();
    handlerFor('pushNotificationReceived')({});

    expect(handler).not.toHaveBeenCalled();
  });

  it('a throwing handler does not stop the others', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { onForegroundPush, startPushRegistration } = await freshModule();
    const after = vi.fn();
    onForegroundPush(() => {
      throw new Error('boom');
    });
    onForegroundPush(after);
    await startPushRegistration();

    handlerFor('pushNotificationReceived')({});

    expect(after).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});

describe('viewForPush', () => {
  const thread = (id: string) => ({ aps: { 'thread-id': id } });

  it('maps every kind to its view', async () => {
    const { viewForPush } = await freshModule();
    const cases: [string, string][] = [
      ['love_note', 'notes'],
      ['mood', 'partner'],
      ['interaction', 'partner'],
      ['partner_request', 'partner'],
      ['partner_accept', 'partner'],
      ['photo', 'photos'],
      ['date', 'home'],
    ];
    for (const [kind, view] of cases) {
      expect(viewForPush({ kind, aps: thread('partner-activity').aps }), kind).toBe(view);
    }
  });

  it('lets a known kind win over the thread id', async () => {
    const { viewForPush } = await freshModule();

    expect(viewForPush({ kind: 'mood', ...thread('love-notes') })).toBe('partner');
  });

  it('opens Love Notes for an old payload with no kind and thread love-notes', async () => {
    const { viewForPush } = await freshModule();

    expect(viewForPush(thread('love-notes'))).toBe('notes');
  });

  it('navigates nowhere for an old payload on another thread', async () => {
    const { viewForPush } = await freshModule();

    expect(viewForPush(thread('partner-activity'))).toBeNull();
  });

  it('navigates nowhere for junk, and never throws', async () => {
    const { viewForPush } = await freshModule();
    const junk: unknown[] = [
      undefined,
      null,
      'love_note',
      42,
      [],
      {},
      { kind: 'x' },
      { kind: 42 },
      { kind: 'toString' },
      { kind: '__proto__' },
      { aps: null },
      { aps: 'love-notes' },
      { aps: { 'thread-id': 7 } },
    ];
    for (const data of junk) expect(viewForPush(data), JSON.stringify(data)).toBeNull();
  });
});

describe('onPushTap', () => {
  const tap = (kind: string, actionId = 'tap') => ({
    actionId,
    notification: { data: { kind, aps: { 'thread-id': 'partner-activity' } } },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    push.checkPermissions.mockResolvedValue({ receive: 'granted' });
  });

  it('adds no listener until registration starts', async () => {
    const { onPushTap } = await freshModule();
    onPushTap(vi.fn());

    expect(push.addListener).not.toHaveBeenCalled();
  });

  it('hands a tapped push\'s view to every handler', async () => {
    const { onPushTap, startPushRegistration } = await freshModule();
    const first = vi.fn();
    const second = vi.fn();
    onPushTap(first);
    onPushTap(second);
    await startPushRegistration();

    handlerFor('pushNotificationActionPerformed')(tap('love_note'));

    expect(first).toHaveBeenCalledExactlyOnceWith('notes');
    expect(second).toHaveBeenCalledExactlyOnceWith('notes');
  });

  it('ignores a dismiss and any other action', async () => {
    const { onPushTap, startPushRegistration } = await freshModule();
    const handler = vi.fn();
    onPushTap(handler);
    await startPushRegistration();

    handlerFor('pushNotificationActionPerformed')(tap('love_note', 'dismiss'));
    handlerFor('pushNotificationActionPerformed')(tap('love_note', 'reply'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('navigates nowhere for a tap it cannot route, and never throws', async () => {
    const { onPushTap, startPushRegistration } = await freshModule();
    const handler = vi.fn();
    onPushTap(handler);
    await startPushRegistration();
    const listener = handlerFor('pushNotificationActionPerformed');

    expect(() => {
      listener({ actionId: 'tap', notification: { data: { kind: 'x' } } });
      listener({ actionId: 'tap', notification: {} });
      listener({ actionId: 'tap' });
      listener(undefined);
    }).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps a tap that arrives before anyone subscribes, and delivers it once', async () => {
    const { onPushTap, startPushRegistration } = await freshModule();
    await startPushRegistration();

    handlerFor('pushNotificationActionPerformed')(tap('photo'));
    const handler = vi.fn();
    const stop = onPushTap(handler);

    expect(handler).toHaveBeenCalledExactlyOnceWith('photos');

    stop();
    const later = vi.fn();
    onPushTap(later);
    expect(later).not.toHaveBeenCalled();
  });

  it('keeps only the latest tap while nobody is subscribed', async () => {
    const { onPushTap, startPushRegistration } = await freshModule();
    await startPushRegistration();

    handlerFor('pushNotificationActionPerformed')(tap('photo'));
    handlerFor('pushNotificationActionPerformed')(tap('love_note'));
    handlerFor('pushNotificationActionPerformed')(tap('x'));
    const handler = vi.fn();
    onPushTap(handler);

    expect(handler).toHaveBeenCalledExactlyOnceWith('notes');
  });

  it('keeps nothing for a tap a handler already received', async () => {
    const { onPushTap, startPushRegistration } = await freshModule();
    await startPushRegistration();
    const stop = onPushTap(vi.fn());

    handlerFor('pushNotificationActionPerformed')(tap('mood'));
    stop();
    const handler = vi.fn();
    onPushTap(handler);

    expect(handler).not.toHaveBeenCalled();
  });

  it('stops calling a handler once it is removed', async () => {
    const { onPushTap, startPushRegistration } = await freshModule();
    const handler = vi.fn();
    const stop = onPushTap(handler);
    await startPushRegistration();

    stop();
    handlerFor('pushNotificationActionPerformed')(tap('mood'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('a throwing handler is logged and does not stop the others', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { onPushTap, startPushRegistration } = await freshModule();
    const after = vi.fn();
    onPushTap(() => {
      throw new Error('boom');
    });
    onPushTap(after);
    await startPushRegistration();

    expect(() => handlerFor('pushNotificationActionPerformed')(tap('mood'))).not.toThrow();

    expect(after).toHaveBeenCalledExactlyOnceWith('partner');
    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it('a handler that throws on a kept tap is logged, not rethrown', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { onPushTap, startPushRegistration } = await freshModule();
    await startPushRegistration();
    handlerFor('pushNotificationActionPerformed')(tap('mood'));

    expect(() =>
      onPushTap(() => {
        throw new Error('boom');
      })
    ).not.toThrow();
    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});
