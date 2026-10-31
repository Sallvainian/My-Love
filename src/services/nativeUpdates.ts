/**
 * Live updates for the native iOS shell (Capacitor), with no Capgo account.
 *
 * Every deploy publishes the built site as a zip next to `updates/latest.json`
 * (scripts/package-live-update.sh). On launch the shell compares that file's
 * version with the build it is running (`__BUILD_ID__`), downloads a newer
 * bundle, and queues it with `next()`, which swaps it in when the app is next
 * backgrounded or relaunched, never mid-use. A bundle that fails to start rolls
 * back to the last good one by itself.
 *
 * The check also publishes its progress (`getUpdateStatus`), which
 * UpdateToast shows: the download's percent, then a prompt whose Refresh
 * applies the queued build at once (`applyUpdate`) instead of waiting for the
 * next background.
 *
 * On the web this does nothing, and the updater plugin is never loaded.
 */
import { Capacitor } from '@capacitor/core';
import { logger } from '../utils/logger';

const DEFAULT_UPDATE_URL = 'https://my-love.sallvain.workers.dev/updates/latest.json';

/** What the update check is doing, for UpdateToast. */
export type UpdateStatus =
  | { state: 'idle' }
  /** `percent` is null until the plugin reports the first progress. */
  | { state: 'downloading'; percent: number | null }
  | { state: 'ready' };

const IDLE: UpdateStatus = { state: 'idle' };
let status: UpdateStatus = IDLE;
const listeners = new Set<() => void>();

function setStatus(next: UpdateStatus): void {
  status = next;
  listeners.forEach((listener) => listener());
}

/** For `useSyncExternalStore`: the current status, the same object until it changes. */
export function getUpdateStatus(): UpdateStatus {
  return status;
}

/** For `useSyncExternalStore`: calls `onChange` whenever the status changes. */
export function subscribeUpdateStatus(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * Restarts the app on the queued build now. `next()` already queued it, so the
 * plugin's reload swaps it in; nothing after this runs. A failed reload leaves
 * the build queued for the background swap.
 */
export async function applyUpdate(): Promise<void> {
  if (status.state !== 'ready') return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.reload();
  } catch (error) {
    console.warn('[NativeUpdates] Applying the update failed:', error);
  }
}

interface LatestBundle {
  version: string;
  url: string;
  checksum: string;
}

function isLatestBundle(value: unknown): value is LatestBundle {
  if (typeof value !== 'object' || value === null) return false;
  const { version, url, checksum } = value as Record<string, unknown>;
  return (
    typeof version === 'string' &&
    version !== '' &&
    typeof url === 'string' &&
    url !== '' &&
    typeof checksum === 'string' &&
    checksum !== ''
  );
}

/**
 * Confirms this bundle started, then fetches and queues a newer one if there
 * is one. Never throws: a failed check leaves the app on the build it has.
 */
export async function startNativeUpdates(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

    // First, before any request: without it the plugin treats this bundle as
    // broken after its timeout and rolls back.
    await CapacitorUpdater.notifyAppReady();

    const updateUrl = import.meta.env.VITE_LIVE_UPDATE_URL || DEFAULT_UPDATE_URL;
    const response = await fetch(updateUrl, { cache: 'no-store' });
    if (!response.ok) {
      console.warn(`[NativeUpdates] Update check answered HTTP ${response.status}`);
      return;
    }

    const latest: unknown = await response.json();
    if (!isLatestBundle(latest)) {
      console.warn('[NativeUpdates] latest.json is missing version, url or checksum');
      return;
    }
    if (latest.version === __BUILD_ID__) return;

    // An earlier launch may already have downloaded ('success') or queued
    // ('pending') this version; download it again only if neither.
    const { bundles } = await CapacitorUpdater.list();
    const existing = bundles.find(
      (bundle) =>
        bundle.version === latest.version &&
        (bundle.status === 'success' || bundle.status === 'pending')
    );
    let bundle = existing;
    if (!bundle) {
      setStatus({ state: 'downloading', percent: null });
      // Progress only feeds the toast: a listener that cannot attach leaves
      // the bar indeterminate and never stops the download.
      const progress = await CapacitorUpdater.addListener('updaterEvent', (event) => {
        if (event.type === 'download' && Number.isFinite(event.data.percent)) {
          setStatus({ state: 'downloading', percent: event.data.percent });
        }
      }).catch(() => null);
      try {
        bundle = await CapacitorUpdater.download({
          version: latest.version,
          url: latest.url,
          checksum: latest.checksum,
        });
      } finally {
        await progress?.remove().catch(() => undefined);
      }
    }

    await CapacitorUpdater.next({ id: bundle.id });
    setStatus({ state: 'ready' });
    logger.info(`[NativeUpdates] Build ${latest.version} queued for the next launch`);
  } catch (error) {
    setStatus(IDLE);
    console.warn('[NativeUpdates] Update check failed:', error);
  }
}
