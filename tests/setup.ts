/**
 * Vitest global setup file
 * Configures test environment with IndexedDB polyfill and other global settings
 */

// Polyfill IndexedDB for testing
import 'fake-indexeddb/auto';

// Reset IndexedDB between tests
import { afterEach, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

beforeEach(() => {
  // Reset the indexedDB instance to a fresh state
  // @ts-expect-error - fake-indexeddb polyfills global indexedDB
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  // Clean up any remaining databases
  // @ts-expect-error - fake-indexeddb polyfills global indexedDB
  const databases = globalThis.indexedDB.databases?.();
  if (databases) {
    databases.then((dbs: Array<{ name: string }>) => {
      dbs.forEach((db) => {
        // @ts-expect-error - fake-indexeddb polyfills global indexedDB
        globalThis.indexedDB.deleteDatabase(db.name);
      });
    });
  }
});
