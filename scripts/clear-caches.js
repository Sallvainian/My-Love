/**
 * Clear Browser Caches Script
 *
 * Run this in the browser console (F12) to clear all cached data:
 * - Service Workers
 * - IndexedDB databases
 * - LocalStorage
 * - SessionStorage
 * - Cache Storage
 *
 * Usage: Copy and paste this entire script into the browser console
 */

(async function clearAllCaches() {
  console.log('🧹 Starting cache cleanup...\n');

  let cleared = [];
  let errors = [];

  // 1. Unregister all service workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        cleared.push(`✅ Service Worker: ${registration.scope}`);
      }
      if (registrations.length === 0) {
        cleared.push('✅ No service workers to unregister');
      }
    } catch (error) {
      errors.push(`❌ Service Worker cleanup failed: ${error.message}`);
    }
  }

  // 2. Delete all IndexedDB databases
  if ('indexedDB' in window) {
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
          cleared.push(`✅ IndexedDB: ${db.name}`);
        }
      }
      if (dbs.length === 0) {
        cleared.push('✅ No IndexedDB databases to delete');
      }
    } catch (error) {
      errors.push(`❌ IndexedDB cleanup failed: ${error.message}`);
    }
  }

  // 3. Clear LocalStorage
  try {
    const localStorageKeys = Object.keys(localStorage);
    localStorage.clear();
    cleared.push(`✅ LocalStorage: ${localStorageKeys.length} items cleared`);
  } catch (error) {
    errors.push(`❌ LocalStorage cleanup failed: ${error.message}`);
  }

  // 4. Clear SessionStorage
  try {
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorage.clear();
    cleared.push(`✅ SessionStorage: ${sessionStorageKeys.length} items cleared`);
  } catch (error) {
    errors.push(`❌ SessionStorage cleanup failed: ${error.message}`);
  }

  // 5. Delete all Cache Storage entries
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
        cleared.push(`✅ Cache Storage: ${name}`);
      }
      if (cacheNames.length === 0) {
        cleared.push('✅ No cache storage to delete');
      }
    } catch (error) {
      errors.push(`❌ Cache Storage cleanup failed: ${error.message}`);
    }
  }

  // Print results
  console.log('\n📋 CLEANUP REPORT:\n');
  console.log('Success:');
  cleared.forEach(msg => console.log(msg));

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(msg => console.error(msg));
  }

  console.log('\n🎉 Cache cleanup complete!');
  console.log('⚠️  IMPORTANT: Hard reload the page (Ctrl+Shift+R or Cmd+Shift+R) to ensure all changes take effect.');
})();
