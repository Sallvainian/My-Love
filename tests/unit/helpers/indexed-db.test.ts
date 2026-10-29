/**
 * `readStore` (tests/support/helpers/indexed-db.ts) is the one IndexedDB reader
 * nine e2e specs share, so its guards get their own test here, against
 * `fake-indexeddb` (loaded by tests/setup.ts). The fake `Page` runs the
 * evaluated function in this process, where `indexedDB` is the fake.
 */
import { Blob as NodeBlob } from 'node:buffer';
import type { Page } from '@playwright/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStore } from '../../support/helpers/indexed-db';

const DB = 'indexed-db-helper-test';

/** A `Page` whose `evaluate(fn, arg)` is `fn(arg)`. */
const page = {
  evaluate: (fn: (arg: unknown) => unknown, arg: unknown) => Promise.resolve(fn(arg)),
} as unknown as Page;

async function databaseNames(): Promise<Array<string | undefined>> {
  return (await indexedDB.databases()).map(({ name }) => name);
}

/** Create `DB` with a `rows` store (indexed `by-user`) holding `rows`. */
function seed(rows: Array<Record<string, unknown>>): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore('rows', { keyPath: 'id' });
      store.createIndex('by-user', 'userId');
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('rows', 'readwrite');
      for (const row of rows) tx.objectStore('rows').put(row);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await deleteDatabase();
});

describe('readStore', () => {
  it('answers null for a database the app has not created, and creates none', async () => {
    expect(await readStore(page, 'rows', { op: 'getAll' }, DB)).toBeNull();
    expect(await readStore(page, 'rows', { op: 'count' }, DB)).toBeNull();
    expect(await databaseNames()).not.toContain(DB);
  });

  it('answers null for a store or index the database does not have', async () => {
    await seed([{ id: 'a', userId: 'USER-A' }]);

    expect(await readStore(page, 'missing', { op: 'getAll' }, DB)).toBeNull();
    expect(
      await readStore(page, 'rows', { op: 'getAll', index: 'by-missing', key: 'x' }, DB)
    ).toBeNull();
  });

  /** Make every `indexedDB.open` fire `fire` on its request instead of opening. */
  function stubOpen(fire: (request: IDBOpenDBRequest) => void) {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      const error = new DOMException('open failed', 'UnknownError');
      const request = { error } as IDBOpenDBRequest;
      queueMicrotask(() => fire(request));
      return request;
    });
  }

  it('answers null when the open is blocked', async () => {
    await seed([{ id: 'a', userId: 'USER-A' }]);
    stubOpen((request) =>
      request.onblocked?.call(request, new Event('blocked') as IDBVersionChangeEvent)
    );

    expect(await readStore(page, 'rows', { op: 'getAll' }, DB)).toBeNull();
  });

  it('rejects with the IndexedDB error when the open fails', async () => {
    await seed([{ id: 'a', userId: 'USER-A' }]);
    stubOpen((request) => request.onerror?.call(request, new Event('error')));

    await expect(readStore(page, 'rows', { op: 'getAll' }, DB)).rejects.toThrow('open failed');
  });

  it('rejects with the IndexedDB error when the read request fails', async () => {
    await seed([{ id: 'a', userId: 'USER-A' }]);
    const failed = new DOMException('read failed', 'UnknownError');
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(() => {
      const request = { error: failed } as IDBRequest;
      queueMicrotask(() => request.onerror?.call(request, new Event('error')));
      return request;
    });

    await expect(readStore(page, 'rows', { op: 'getAll' }, DB)).rejects.toBe(failed);
  });

  it('answers getAll, an index getAll, get and count with the rows', async () => {
    const a1 = { id: 'a1', userId: 'USER-A' };
    const a2 = { id: 'a2', userId: 'USER-A' };
    const b1 = { id: 'b1', userId: 'USER-B' };
    await seed([a1, a2, b1]);

    expect(await readStore(page, 'rows', { op: 'getAll' }, DB)).toEqual([a1, a2, b1]);
    expect(
      await readStore(page, 'rows', { op: 'getAll', index: 'by-user', key: 'USER-A' }, DB)
    ).toEqual([a1, a2]);
    expect(await readStore(page, 'rows', { op: 'get', key: 'b1' }, DB)).toEqual(b1);
    expect(await readStore(page, 'rows', { op: 'get', key: 'none' }, DB)).toBeNull();
    expect(await readStore(page, 'rows', { op: 'count' }, DB)).toBe(3);
  });

  it('answers count 0 for an empty store, not null', async () => {
    await seed([]);

    expect(await readStore(page, 'rows', { op: 'count' }, DB)).toBe(0);
    expect(await readStore(page, 'rows', { op: 'getAll' }, DB)).toEqual([]);
  });

  it('clones a Date to its ISO string and a Blob to its size', async () => {
    // happy-dom's Blob does not survive the fake's structured clone; Node's
    // does, as a browser's survives a real one. Stubbed globally so the
    // reader's `instanceof Blob` sees the same class.
    vi.stubGlobal('Blob', NodeBlob);
    const at = new Date('2026-09-01T10:00:00.000Z');
    await seed([{ id: 'a', userId: 'USER-A', createdAt: at, blob: new NodeBlob(['four']) }]);

    expect(await readStore(page, 'rows', { op: 'get', key: 'a' }, DB)).toEqual({
      id: 'a',
      userId: 'USER-A',
      createdAt: '2026-09-01T10:00:00.000Z',
      blob: { blobSize: 4 },
    });
  });
});
