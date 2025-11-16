/**
 * LocalStorage Quota Monitoring Utility
 *
 * Proactive monitoring for LocalStorage usage to prevent quota exceeded errors
 * before they occur in production. Logs warnings when approaching limits.
 *
 * Priority: HIGH - Addresses Epic 2 technical debt item
 * Owner: Winston (Architect)
 */

export interface StorageQuotaInfo {
  used: number;
  total: number;
  available: number;
  usagePercentage: number;
  warningLevel: 'safe' | 'warning' | 'critical';
}

/**
 * Estimate LocalStorage usage in bytes
 *
 * Calculates approximate storage size by serializing all LocalStorage data.
 * Note: This is an estimate as actual browser storage accounting may differ.
 */
export function getLocalStorageUsage(): number {
  let totalBytes = 0;

  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        // Each character in JavaScript is 2 bytes (UTF-16)
        // Key + value + overhead for storage
        totalBytes += (key.length + value.length) * 2;
      }
    }
  }

  return totalBytes;
}

/**
 * Get comprehensive storage quota information
 *
 * Returns usage statistics and warning levels based on consumption.
 * Most browsers have a 5-10 MB LocalStorage limit per origin.
 */
export function getStorageQuotaInfo(): StorageQuotaInfo {
  const used = getLocalStorageUsage();

  // Conservative estimate: 5MB limit (typical browser minimum)
  // Browsers may provide more, but we plan for the worst case
  const total = 5 * 1024 * 1024; // 5 MB in bytes
  const available = total - used;
  const usagePercentage = (used / total) * 100;

  let warningLevel: 'safe' | 'warning' | 'critical';
  if (usagePercentage < 70) {
    warningLevel = 'safe';
  } else if (usagePercentage < 85) {
    warningLevel = 'warning';
  } else {
    warningLevel = 'critical';
  }

  return {
    used,
    total,
    available,
    usagePercentage: Math.round(usagePercentage * 10) / 10, // Round to 1 decimal
    warningLevel,
  };
}

/**
 * Log storage quota status to console (development mode only)
 *
 * Provides developer feedback about LocalStorage consumption.
 * Should be called periodically or after significant state changes.
 */
export function logStorageQuota(): void {
  if (import.meta.env.DEV) {
    const quota = getStorageQuotaInfo();

    const usedMB = (quota.used / (1024 * 1024)).toFixed(2);
    const totalMB = (quota.total / (1024 * 1024)).toFixed(2);
    const availableMB = (quota.available / (1024 * 1024)).toFixed(2);

    const emoji =
      quota.warningLevel === 'safe' ? '✅' : quota.warningLevel === 'warning' ? '⚠️' : '🚨';

    const style =
      quota.warningLevel === 'safe'
        ? 'color: green'
        : quota.warningLevel === 'warning'
          ? 'color: orange; font-weight: bold'
          : 'color: red; font-weight: bold';

    console.log(
      `%c${emoji} LocalStorage Quota: ${quota.usagePercentage}% used (${usedMB}MB / ${totalMB}MB) - ${availableMB}MB available`,
      style
    );

    if (quota.warningLevel === 'warning') {
      console.warn(
        `⚠️ LocalStorage approaching limit (${quota.usagePercentage}%). Consider optimization:\n` +
          `  - Review persisted state partializer in store configuration\n` +
          `  - Move large data (photos, messages) to IndexedDB\n` +
          `  - Implement data cleanup for old/unused entries`
      );
    } else if (quota.warningLevel === 'critical') {
      console.error(
        `🚨 LocalStorage CRITICAL (${quota.usagePercentage}%)! Quota exceeded error imminent!\n` +
          `  ACTION REQUIRED:\n` +
          `  1. Immediately review persisted state size\n` +
          `  2. Migrate large data to IndexedDB\n` +
          `  3. Clear unnecessary cached data\n` +
          `  Current usage: ${usedMB}MB of ${totalMB}MB`
      );
    }
  }
}

/**
 * Check if there's enough space to store data of given size
 *
 * @param estimatedBytes - Estimated size of data to store
 * @param safetyMargin - Safety margin as percentage (default: 10%)
 * @returns true if storage has sufficient space
 */
export function hasStorageSpace(estimatedBytes: number, safetyMargin: number = 0.1): boolean {
  const quota = getStorageQuotaInfo();
  const requiredSpace = estimatedBytes * (1 + safetyMargin);
  return quota.available >= requiredSpace;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
