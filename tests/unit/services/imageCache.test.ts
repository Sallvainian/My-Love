/**
 * The per-account image cache (src/services/imageCache.ts).
 *
 * Runs against fake-indexeddb through the real `openMyLoveDB`, so the store,
 * its [userId, path] key and its by-user index are the ones dbSchema creates.
 *
 * happy-dom's Blob does not survive Node's structured clone (it comes back as a
 * plain object), where a browser's does. Node's own Blob does, so it stands in
 * for the global here, for the code under test as well as the test.
 */
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import {
  deleteAccountImages,
  deleteCachedImages,
  isQuotaError,
  readCachedImage,
  writeCachedImage,
} from '../../../src/services/imageCache';
import { readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';

const A = 'USER-A';
const B = 'USER-B';
const PATH = 'partner-id/1726000000-pic.jpg';
// DOMException's legacy numeric code for QuotaExceededError (DOMException.QUOTA_EXCEEDED_ERR),
// which src/services/imageCache.ts isQuotaError still accepts from older engines.
const LEGACY_QUOTA_EXCEEDED_ERR = 22;

async function clearStores(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('image-cache');
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

async function text(blob: Blob | null): Promise<string | null> {
  return blob ? blob.text() : null;
}

describe('imageCache', () => {
  beforeEach(async () => {
    vi.stubGlobal('Blob', NodeBlob);
    await clearStores();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await clearStores();
  });

  it('reads null when nothing is cached', async () => {
    expect(await readCachedImage(A, PATH)).toBeNull();
  });

  it('reads back the Blob that was written, replacing the previous one', async () => {
    await writeCachedImage(A, PATH, new Blob(['FIRST'], { type: 'image/jpeg' }));
    await writeCachedImage(A, PATH, new Blob(['SECOND'], { type: 'image/jpeg' }));

    const cached = await readCachedImage(A, PATH);
    expect(cached).toBeInstanceOf(Blob);
    expect(await text(cached)).toBe('SECOND');
  });

  it("keeps accounts apart: one account never reads another's image", async () => {
    await writeCachedImage(A, PATH, new Blob(['A-IMAGE']));

    expect(await readCachedImage(B, PATH)).toBeNull();
    expect(await readCachedImage(A, 'other/path.jpg')).toBeNull();
  });

  it("deletes every image of one account, keeping other accounts and the local copies", async () => {
    await writeCachedImage(A, PATH, new Blob(['A-1']));
    await writeCachedImage(A, 'a/second.jpg', new Blob(['A-2']));
    await writeCachedImage(B, PATH, new Blob(['B-1']));
    await writeLocalCopy(A, 'love-notes', ['A-COPY']);

    await deleteAccountImages(A);

    expect(await readCachedImage(A, PATH)).toBeNull();
    expect(await readCachedImage(A, 'a/second.jpg')).toBeNull();
    expect(await text(await readCachedImage(B, PATH))).toBe('B-1');
    // Copies are deleteAccountCopies' job; this touches the image store only.
    expect(await readLocalCopy(A, 'love-notes')).toEqual(['A-COPY']);
  });

  it('deleting an account with no images is a no-op', async () => {
    await writeCachedImage(B, PATH, new Blob(['B-1']));

    await expect(deleteAccountImages(A)).resolves.toBeUndefined();
    expect(await text(await readCachedImage(B, PATH))).toBe('B-1');
  });

  it('answers null, not a throw, when the stored row is not a Blob', async () => {
    const db = await openMyLoveDB();
    try {
      await db.put('image-cache', {
        userId: A,
        path: PATH,
        blob: 'NOT-A-BLOB' as unknown as Blob,
        savedAt: 1,
      });
    } finally {
      db.close();
    }

    expect(await readCachedImage(A, PATH)).toBeNull();
  });

  it('deletes only the listed images of one account', async () => {
    await writeCachedImage(A, PATH, new Blob(['A-1']));
    await writeCachedImage(A, 'a/second.jpg', new Blob(['A-2']));
    await writeCachedImage(A, 'a/third.jpg', new Blob(['A-3']));
    await writeCachedImage(B, PATH, new Blob(['B-1']));

    await deleteCachedImages(A, [PATH, 'a/third.jpg', 'a/never-cached.jpg']);

    expect(await readCachedImage(A, PATH)).toBeNull();
    expect(await readCachedImage(A, 'a/third.jpg')).toBeNull();
    expect(await text(await readCachedImage(A, 'a/second.jpg'))).toBe('A-2');
    expect(await text(await readCachedImage(B, PATH))).toBe('B-1');
  });

  it('deleting no paths is a no-op', async () => {
    await writeCachedImage(A, PATH, new Blob(['A-1']));
    await expect(deleteCachedImages(A, [])).resolves.toBeUndefined();
    expect(await text(await readCachedImage(A, PATH))).toBe('A-1');
  });
});

describe('isQuotaError', () => {
  it('recognises a QuotaExceededError', () => {
    expect(isQuotaError(new DOMException('full', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError({ name: 'Error', code: LEGACY_QUOTA_EXCEEDED_ERR })).toBe(true);
  });

  it('recognises a transaction aborted with one', () => {
    const quota = new DOMException('full', 'QuotaExceededError');
    const aborted = Object.assign(new DOMException('aborted', 'AbortError'), {
      target: { error: quota },
    });
    expect(isQuotaError(aborted)).toBe(true);
    expect(isQuotaError({ name: 'AbortError', error: quota })).toBe(true);
    expect(isQuotaError(new Error('wrapped', { cause: quota }))).toBe(true);
  });

  it('answers false for every other failure', () => {
    expect(isQuotaError(new DOMException('aborted', 'AbortError'))).toBe(false);
    expect(isQuotaError(new Error('Failed to fetch'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError('QuotaExceededError')).toBe(false);
  });
});
