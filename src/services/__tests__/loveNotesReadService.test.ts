import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  isPluginAvailable: vi.fn((_name: string) => true),
}));

const badge = vi.hoisted(() => ({
  clear: vi.fn(() => Promise.resolve()),
}));

const rpc = vi.hoisted(() =>
  vi.fn((_name: string) => Promise.resolve({ data: null, error: null as { message: string } | null }))
);

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: () => badge,
}));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }));
vi.mock('../../api/supabaseClient', () => ({ supabase: { rpc } }));

import { markLoveNotesRead } from '../loveNotesReadService';

describe('markLoveNotesRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    rpc.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'onLine');
  });

  it('clears the badge and writes the marker', async () => {
    await markLoveNotesRead();

    expect(badge.clear).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('mark_love_notes_read');
  });

  it('writes the marker on the web too, with no badge call', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);

    await markLoveNotesRead();

    expect(badge.clear).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('makes no badge call in a shell without AppBadge, and still writes the marker', async () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'AppBadge');

    await markLoveNotesRead();

    expect(badge.clear).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('offline clears the badge and sends no request', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await markLoveNotesRead();

    expect(badge.clear).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('logs a refusal and resolves', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Authentication required' } });

    await expect(markLoveNotesRead()).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it('logs a thrown request and resolves', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockRejectedValueOnce(new Error('network'));

    await expect(markLoveNotesRead()).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it('a failing badge plugin does not stop the marker', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    badge.clear.mockRejectedValueOnce(new Error('no badge'));

    await markLoveNotesRead();

    expect(rpc).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});
