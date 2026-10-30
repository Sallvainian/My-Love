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
 * On the web this does nothing, and the updater plugin is never loaded.
 */
import { Capacitor } from '@capacitor/core';
import { logger } from '../utils/logger';

const DEFAULT_UPDATE_URL = 'https://my-love.sallvain.workers.dev/updates/latest.json';

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
    const bundle =
      existing ??
      (await CapacitorUpdater.download({
        version: latest.version,
        url: latest.url,
        checksum: latest.checksum,
      }));

    await CapacitorUpdater.next({ id: bundle.id });
    logger.info(`[NativeUpdates] Build ${latest.version} queued for the next launch`);
  } catch (error) {
    console.warn('[NativeUpdates] Update check failed:', error);
  }
}
