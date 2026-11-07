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

describe('clearDeliveredNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    localStorage.setItem(TOKEN_KEY, 'device-token-1');
  });

  afterEach(() => {
    localStorage.removeItem(TOKEN_KEY);
  });

  it('empties Notification Center and clears the badge, keeping the APNs registration and token', async () => {
    const { clearDeliveredNotifications } = await freshModule();

    await clearDeliveredNotifications();

    // An account switch (DW-408): an unregister would race startPushRegistration.
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);
    expect(badge.clear).toHaveBeenCalledTimes(1);
    expect(push.unregister).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('device-token-1');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a shell with no local-notifications plugin skips the removal and still clears the badge', async () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'LocalNotifications');
    const { clearDeliveredNotifications } = await freshModule();

    await clearDeliveredNotifications();

    expect(local.removeAllDeliveredNotifications).not.toHaveBeenCalled();
    expect(badge.clear).toHaveBeenCalledTimes(1);
  });

  it('does nothing in a browser and logs nothing', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const errorLog = vi.spyOn(console, 'error');
    const { clearDeliveredNotifications } = await freshModule();

    await clearDeliveredNotifications();

    expect(local.removeAllDeliveredNotifications).not.toHaveBeenCalled();
    expect(badge.clear).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('a failing removal is logged once, the badge still clears, and nothing throws', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    local.removeAllDeliveredNotifications.mockRejectedValueOnce(new Error('bridge gone'));
    const { clearDeliveredNotifications } = await freshModule();

    await expect(clearDeliveredNotifications()).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('delivered notifications'),
      expect.any(Error)
    );
    expect(badge.clear).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});

describe('clearDeliveredNotifications after an account switch (DW-413)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    push.checkPermissions.mockResolvedValue({ receive: 'granted' });
    rpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLEAR_AFTER_RECORD_KEY);
  });

  /** Registers, then has APNs answer with `token`, and waits for its record. */
  async function recordToken(
    mod: Awaited<ReturnType<typeof freshModule>>,
    token: string,
    records: number
  ) {
    await mod.startPushRegistration();
    handlerFor('registration')({ value: token });
    await vi.waitFor(() =>
      expect(rpc.mock.calls.filter(([name]) => name === 'register_push_device')).toHaveLength(
        records
      )
    );
  }

  it('clears once more when this device is recorded for the incoming account, and only once', async () => {
    const mod = await freshModule();

    await mod.clearDeliveredNotifications({ untilReregistered: true });
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);

    await recordToken(mod, 'abc123', 1);
    // The outgoing account's pushes could reach the device until this record.
    await vi.waitFor(() => expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(2));
    expect(badge.clear).toHaveBeenCalledTimes(2);

    // A later record (the 12-hour renewal, the next start) clears nothing.
    handlerFor('registration')({ value: 'abc123' });
    await vi.waitFor(() =>
      expect(rpc.mock.calls.filter(([name]) => name === 'register_push_device')).toHaveLength(2)
    );
    // A record that clears does so as soon as its RPC answers.
    await rpc.mock.results[1].value;
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(2);
  });

  it('keeps waiting through a refused record and clears on the next one that succeeds', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ error: { message: 'nope' } });
    const mod = await freshModule();

    await mod.clearDeliveredNotifications({ untilReregistered: true });
    await recordToken(mod, 'abc123', 1);
    await vi.waitFor(() =>
      expect(errorLog).toHaveBeenCalledWith('[Push] Could not record the device:', 'nope')
    );
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);

    handlerFor('registration')({ value: 'abc123' });
    await vi.waitFor(() => expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(2));
    errorLog.mockRestore();
  });

  it.each([
    [
      'a plain clear',
      (mod: Awaited<ReturnType<typeof freshModule>>) => mod.clearDeliveredNotifications(),
    ],
    ['a sign-out', (mod: Awaited<ReturnType<typeof freshModule>>) => mod.stopDevicePushes()],
  ])('clears nothing after the next record when %s came last', async (_case, last) => {
    const mod = await freshModule();

    await mod.clearDeliveredNotifications({ untilReregistered: true });
    await last(mod);
    const clearsBefore = local.removeAllDeliveredNotifications.mock.calls.length;

    await recordToken(mod, 'abc123', 1);
    await rpc.mock.results[0].value;
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(clearsBefore);
  });

  it('still clears on the first record after a restart that followed a refused one', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ error: { message: 'nope' } });
    const before = await freshModule();
    await before.clearDeliveredNotifications({ untilReregistered: true });
    await recordToken(before, 'abc123', 1);
    await vi.waitFor(() =>
      expect(errorLog).toHaveBeenCalledWith('[Push] Could not record the device:', 'nope')
    );
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);

    // The app restarts: module state is gone, the saved flag is not.
    push.addListener.mockClear();
    const after = await freshModule();
    await recordToken(after, 'abc123', 2);
    await vi.waitFor(() => expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(2));
    expect(localStorage.getItem(CLEAR_AFTER_RECORD_KEY)).toBeNull();
    errorLog.mockRestore();
  });

  it('saves the switch before its first await, ahead of any record it starts', async () => {
    const mod = await freshModule();

    const done = mod.clearDeliveredNotifications({ untilReregistered: true });
    // Synchronously: App.tsx's registration effect runs only after the switch.
    expect(localStorage.getItem(CLEAR_AFTER_RECORD_KEY)).not.toBeNull();
    await done;
  });

  it("a record started under one switch does not take a later switch's clear", async () => {
    let answer: (value: { error: null }) => void = () => {};
    const mod = await freshModule();
    await mod.clearDeliveredNotifications({ untilReregistered: true });

    // A to B: B's record is still in flight when B switches to C.
    rpc.mockReturnValueOnce(
      new Promise<{ error: null }>((resolve) => {
        answer = resolve;
      })
    );
    await mod.startPushRegistration();
    handlerFor('registration')({ value: 'abc123' });
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    await mod.clearDeliveredNotifications({ untilReregistered: true });
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(2);

    // B's record moved the row to B, now the outgoing account: no clear.
    answer({ error: null });
    await rpc.mock.results[0].value;
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(CLEAR_AFTER_RECORD_KEY)).not.toBeNull();

    // C's own record clears.
    handlerFor('registration')({ value: 'abc123' });
    await vi.waitFor(() => expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(3));
    expect(localStorage.getItem(CLEAR_AFTER_RECORD_KEY)).toBeNull();
  });

  it('a record the outgoing account sent before the switch does not take its clear', async () => {
    let answer: (value: { error: null }) => void = () => {};
    rpc.mockReturnValueOnce(
      new Promise<{ error: null }>((resolve) => {
        answer = resolve;
      })
    );
    const mod = await freshModule();
    await mod.startPushRegistration();
    handlerFor('registration')({ value: 'abc123' });
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));

    await mod.clearDeliveredNotifications({ untilReregistered: true });
    answer({ error: null });
    await rpc.mock.results[0].value;
    expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CLEAR_AFTER_RECORD_KEY)).not.toBeNull();

    // The incoming account's own record clears.
    handlerFor('registration')({ value: 'abc123' });
    await vi.waitFor(() => expect(local.removeAllDeliveredNotifications).toHaveBeenCalledTimes(2));
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
      ['mood', 'daily'],
      ['interaction', 'partner'],
      ['partner_request', 'partner'],
      ['partner_accept', 'partner'],
      ['photo', 'photos'],
      ['event', 'home'],
      ['anniversary', 'home'],
    ];
    for (const [kind, view] of cases) {
      expect(viewForPush({ kind, aps: thread('partner-activity').aps }), kind).toBe(view);
    }
  });

  it('navigates nowhere for a date push from an older sender', async () => {
    const { viewForPush } = await freshModule();

    expect(viewForPush({ kind: 'date', ...thread('partner-activity') })).toBeNull();
  });

  it('lets a known kind win over the thread id', async () => {
    const { viewForPush } = await freshModule();

    expect(viewForPush({ kind: 'mood', ...thread('love-notes') })).toBe('daily');
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

    expect(after).toHaveBeenCalledExactlyOnceWith('daily');
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
