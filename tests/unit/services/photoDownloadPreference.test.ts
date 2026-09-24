/**
 * photoDownloadPreference — the per-device "Download photos over mobile data"
 * choice (default off) and the connection reading the photo fill relies on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'my-love-photos-over-mobile-data';

async function freshModule() {
  vi.resetModules();
  return import('../../../src/services/photoDownloadPreference');
}

function setConnection(connection: object | undefined) {
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
}

beforeEach(() => {
  localStorage.removeItem(KEY);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  setConnection(undefined);
  localStorage.removeItem(KEY);
});

describe('the choice', () => {
  it('is off by default', async () => {
    const { getPhotosOverMobileData } = await freshModule();
    expect(getPhotosOverMobileData()).toBe(false);
  });

  it('reads the saved choice on a new page load', async () => {
    localStorage.setItem(KEY, 'true');
    const { getPhotosOverMobileData } = await freshModule();
    expect(getPhotosOverMobileData()).toBe(true);
  });

  it('saves the choice and tells subscribers until they unsubscribe', async () => {
    const { setPhotosOverMobileData, subscribePhotosOverMobileData } = await freshModule();
    const listener = vi.fn();
    const unsubscribe = subscribePhotosOverMobileData(listener);

    setPhotosOverMobileData(true);
    expect(localStorage.getItem(KEY)).toBe('true');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setPhotosOverMobileData(false);
    expect(localStorage.getItem(KEY)).toBe('false');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('holds the choice for this page load when storage is unavailable', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const { getPhotosOverMobileData, setPhotosOverMobileData } = await freshModule();

    expect(getPhotosOverMobileData()).toBe(false);
    setPhotosOverMobileData(true);
    expect(getPhotosOverMobileData()).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('the connection', () => {
  it('is metered on mobile data or with data saver, and unmetered otherwise', async () => {
    const { onMeteredConnection, canTellMobileData } = await freshModule();

    setConnection(undefined);
    expect([onMeteredConnection(), canTellMobileData()]).toEqual([false, false]);

    setConnection({ type: 'unknown' });
    expect([onMeteredConnection(), canTellMobileData()]).toEqual([false, false]);

    setConnection({ type: 'wifi' });
    expect([onMeteredConnection(), canTellMobileData()]).toEqual([false, true]);

    setConnection({ type: 'cellular' });
    expect([onMeteredConnection(), canTellMobileData()]).toEqual([true, true]);

    // Data saver with no type (desktop Chrome): held on every connection.
    setConnection({ saveData: true });
    expect([onMeteredConnection(), canTellMobileData()]).toEqual([true, true]);
  });
});
