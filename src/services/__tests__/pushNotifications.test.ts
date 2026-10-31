import { beforeEach, describe, expect, it, vi } from 'vitest';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  isPluginAvailable: vi.fn((_name: string) => true),
}));

const environment = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve({ environment: 'sandbox' as const })),
}));

const push = vi.hoisted(() => ({
  checkPermissions: vi.fn(() => Promise.resolve({ receive: 'prompt' })),
  requestPermissions: vi.fn(() => Promise.resolve({ receive: 'granted' })),
  register: vi.fn(() => Promise.resolve()),
  addListener: vi.fn((_name: string, _handler: (payload: never) => void) =>
    Promise.resolve({ remove: vi.fn() })
  ),
}));

const rpc = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null as { message: string } | null })));

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: () => environment,
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

    expect(push.addListener).toHaveBeenCalledTimes(2); // registration + registrationError, once
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
