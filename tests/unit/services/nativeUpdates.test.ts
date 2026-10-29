/**
 * nativeUpdates — the native shell's self-hosted live updates: confirm the
 * running bundle, then download and queue a newer one from latest.json.
 * __BUILD_ID__ is 'test-build' (vitest.config.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isNativePlatform = vi.fn();
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform } }));

const updater = {
  notifyAppReady: vi.fn(),
  list: vi.fn(),
  download: vi.fn(),
  next: vi.fn(),
};
const loadUpdater = vi.fn(() => ({ CapacitorUpdater: updater }));
vi.mock('@capgo/capacitor-updater', () => loadUpdater());

const LATEST = {
  version: 'new-build',
  url: 'https://example.invalid/updates/bundle-new-build.zip',
  checksum: 'abc123',
};

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function run() {
  const { startNativeUpdates } = await import('../../../src/services/nativeUpdates');
  await startNativeUpdates();
}

beforeEach(() => {
  // A fresh module graph per test, so the updater factory runs again and
  // loadUpdater's count says whether this test loaded it (CI shuffles order).
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  isNativePlatform.mockReturnValue(true);
  updater.notifyAppReady.mockResolvedValue({ bundle: { id: 'builtin' } });
  updater.list.mockResolvedValue({ bundles: [] });
  updater.download.mockResolvedValue({ id: 'dl-1', version: LATEST.version, status: 'success' });
  updater.next.mockResolvedValue({ id: 'dl-1' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('startNativeUpdates', () => {
  it('does nothing on the web and never loads the updater', async () => {
    isNativePlatform.mockReturnValue(false);
    const fetchMock = stubFetch(LATEST);

    await run();

    expect(loadUpdater).not.toHaveBeenCalled();
    expect(updater.notifyAppReady).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('confirms the running bundle before checking for an update', async () => {
    const fetchMock = stubFetch(LATEST);

    await run();

    expect(updater.notifyAppReady).toHaveBeenCalledTimes(1);
    expect(updater.notifyAppReady.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0]
    );
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/updates\/latest\.json$/), {
      cache: 'no-store',
    });
  });

  it('downloads nothing when latest.json names the running build', async () => {
    stubFetch({ ...LATEST, version: 'test-build' });

    await run();

    expect(updater.download).not.toHaveBeenCalled();
    expect(updater.next).not.toHaveBeenCalled();
  });

  it('downloads a newer build with its checksum and queues it for the next launch', async () => {
    stubFetch(LATEST);

    await run();

    expect(updater.download).toHaveBeenCalledWith(LATEST);
    expect(updater.next).toHaveBeenCalledWith({ id: 'dl-1' });
  });

  it('queues an already-downloaded copy instead of downloading it again', async () => {
    stubFetch(LATEST);
    updater.list.mockResolvedValue({
      bundles: [{ id: 'dl-0', version: LATEST.version, status: 'success' }],
    });

    await run();

    expect(updater.download).not.toHaveBeenCalled();
    expect(updater.next).toHaveBeenCalledWith({ id: 'dl-0' });
  });

  it('downloads again when the earlier copy of that version failed', async () => {
    stubFetch(LATEST);
    updater.list.mockResolvedValue({
      bundles: [{ id: 'dl-0', version: LATEST.version, status: 'error' }],
    });

    await run();

    expect(updater.download).toHaveBeenCalledWith(LATEST);
    expect(updater.next).toHaveBeenCalledWith({ id: 'dl-1' });
  });

  it('ignores a latest.json without a checksum', async () => {
    stubFetch({ version: LATEST.version, url: LATEST.url });

    await run();

    expect(updater.download).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('checksum'));
  });

  it('stays on the current build when the check answers an HTTP error', async () => {
    stubFetch({}, 503);

    await expect(run()).resolves.toBeUndefined();

    expect(updater.download).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('503'));
  });

  it('never throws when the network or the download fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Load failed')));
    await expect(run()).resolves.toBeUndefined();

    stubFetch(LATEST);
    updater.download.mockRejectedValue(new Error('checksum mismatch'));
    await expect(run()).resolves.toBeUndefined();

    expect(updater.next).not.toHaveBeenCalled();
  });
});
