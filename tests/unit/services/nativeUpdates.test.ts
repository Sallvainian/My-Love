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
  reload: vi.fn(),
  addListener: vi.fn(),
};
const removeListener = vi.fn();
/** The progress callback the last `addListener('updaterEvent', …)` registered. */
let emitUpdaterEvent: (event: { type: string; data: unknown }) => void = () => {};
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

/** Runs one check and returns the module, to read its status afterwards. */
async function runAndLoad() {
  const updates = await import('../../../src/services/nativeUpdates');
  await updates.startNativeUpdates();
  return updates;
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
  updater.reload.mockResolvedValue(undefined);
  removeListener.mockResolvedValue(undefined);
  updater.addListener.mockImplementation(
    async (_name: string, listener: typeof emitUpdaterEvent) => {
      emitUpdaterEvent = listener;
      return { remove: removeListener };
    }
  );
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

describe('update status', () => {
  it('reports the download progress, then ready once the build is queued', async () => {
    stubFetch(LATEST);
    const seen: unknown[] = [];
    updater.download.mockImplementation(async () => {
      emitUpdaterEvent({ type: 'download', data: { percent: 40, bundle: {} } });
      emitUpdaterEvent({ type: 'downloadComplete', data: { bundle: {} } });
      emitUpdaterEvent({ type: 'download', data: { percent: 100, bundle: {} } });
      return { id: 'dl-1', version: LATEST.version, status: 'success' };
    });
    const updates = await import('../../../src/services/nativeUpdates');
    updates.subscribeUpdateStatus(() => seen.push(updates.getUpdateStatus()));

    await updates.startNativeUpdates();

    expect(updater.addListener).toHaveBeenCalledWith('updaterEvent', expect.any(Function));
    expect(seen).toEqual([
      { state: 'downloading', percent: null },
      { state: 'downloading', percent: 40 },
      { state: 'downloading', percent: 100 },
      { state: 'ready' },
    ]);
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(removeListener.mock.invocationCallOrder[0]).toBeLessThan(
      updater.next.mock.invocationCallOrder[0]
    );
  });

  it('goes straight to ready for a copy an earlier launch downloaded', async () => {
    stubFetch(LATEST);
    updater.list.mockResolvedValue({
      bundles: [{ id: 'dl-0', version: LATEST.version, status: 'success' }],
    });
    const updates = await import('../../../src/services/nativeUpdates');
    const seen: unknown[] = [];
    updates.subscribeUpdateStatus(() => seen.push(updates.getUpdateStatus()));

    await updates.startNativeUpdates();

    expect(seen).toEqual([{ state: 'ready' }]);
    expect(updater.addListener).not.toHaveBeenCalled();
  });

  it('returns to idle and drops the listener when the download fails', async () => {
    stubFetch(LATEST);
    updater.download.mockRejectedValue(new Error('checksum mismatch'));

    const updates = await runAndLoad();

    expect(updates.getUpdateStatus()).toEqual({ state: 'idle' });
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('still downloads and queues when the progress listener cannot attach', async () => {
    stubFetch(LATEST);
    updater.addListener.mockRejectedValue(new Error('no such event'));

    const updates = await runAndLoad();

    expect(updater.next).toHaveBeenCalledWith({ id: 'dl-1' });
    expect(updates.getUpdateStatus()).toEqual({ state: 'ready' });
  });

  it('stays idle when the running build is the latest', async () => {
    stubFetch({ ...LATEST, version: 'test-build' });

    const updates = await runAndLoad();

    expect(updates.getUpdateStatus()).toEqual({ state: 'idle' });
  });

  it('stays idle on the web', async () => {
    isNativePlatform.mockReturnValue(false);
    stubFetch(LATEST);

    const updates = await runAndLoad();

    expect(updates.getUpdateStatus()).toEqual({ state: 'idle' });
  });
});

describe('applyUpdate', () => {
  it('reloads onto the queued build once it is ready', async () => {
    stubFetch(LATEST);
    const updates = await runAndLoad();

    await updates.applyUpdate();

    expect(updater.reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing while no build is ready', async () => {
    stubFetch({ ...LATEST, version: 'test-build' });
    const updates = await runAndLoad();

    await updates.applyUpdate();

    expect(updater.reload).not.toHaveBeenCalled();
  });

  it('never throws when the reload fails', async () => {
    stubFetch(LATEST);
    const updates = await runAndLoad();
    updater.reload.mockRejectedValue(new Error('reload failed'));

    await expect(updates.applyUpdate()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Applying the update failed'),
      expect.any(Error)
    );
  });
});
