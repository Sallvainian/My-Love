/**
 * The shared per-account local copy (src/services/localCopy.ts).
 *
 * Runs against fake-indexeddb through the real `openMyLoveDB`, so the store,
 * its [userId, kind] key and its by-user index are the ones dbSchema creates.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import {
  deleteAccountCopies,
  readLocalCopy,
  refreshLocalCopies,
  refreshLocalCopy,
  registerLocalCopy,
  writeLocalCopy,
} from '../../../src/services/localCopy';

const A = 'USER-A';
const B = 'USER-B';

const unregisters: Array<() => void> = [];
function register(kind: string, refresh: () => Promise<void>): void {
  unregisters.push(registerLocalCopy(kind, refresh));
}

async function clearStores(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('local-copies');
    await db.clear('moods');
  } finally {
    db.close();
  }
}

describe('localCopy', () => {
  beforeEach(async () => {
    await clearStores();
  });

  afterEach(async () => {
    for (const unregister of unregisters.splice(0)) unregister();
    vi.restoreAllMocks();
    await clearStores();
  });

  describe('storage', () => {
    it('reads null when nothing is saved', async () => {
      expect(await readLocalCopy(A, 'partner')).toBeNull();
    });

    it('reads back what was written, replacing the previous value', async () => {
      await writeLocalCopy(A, 'partner', { status: 'unlinked' });
      await writeLocalCopy(A, 'partner', { status: 'linked', partner: { id: 'P' } });

      expect(await readLocalCopy(A, 'partner')).toEqual({
        status: 'linked',
        partner: { id: 'P' },
      });
    });

    it("keeps accounts apart: one account never reads another's copy", async () => {
      await writeLocalCopy(A, 'partner', { name: 'A-PARTNER' });

      expect(await readLocalCopy(B, 'partner')).toBeNull();
      expect(await readLocalCopy(A, 'other-kind')).toBeNull();
    });

    it("deletes every kind of one account, keeping other accounts and moods", async () => {
      await writeLocalCopy(A, 'partner', 'A-PARTNER');
      await writeLocalCopy(A, 'photos', 'A-PHOTOS');
      await writeLocalCopy(B, 'partner', 'B-PARTNER');
      const db = await openMyLoveDB();
      const moodId = await db.add('moods', {
        userId: A,
        mood: 'happy',
        date: '2026-09-01',
        timestamp: new Date('2026-09-01T00:00:00.000Z'),
        synced: false,
      } as never);
      db.close();

      await deleteAccountCopies(A);

      expect(await readLocalCopy(A, 'partner')).toBeNull();
      expect(await readLocalCopy(A, 'photos')).toBeNull();
      expect(await readLocalCopy(B, 'partner')).toBe('B-PARTNER');
      const after = await openMyLoveDB();
      try {
        // A's unsynced mood is a queued write and must survive sign-out.
        expect(await after.get('moods', moodId)).toMatchObject({ userId: A, synced: false });
      } finally {
        after.close();
      }
    });

    it('deleting an account with no copies is a no-op', async () => {
      await writeLocalCopy(B, 'partner', 'B-PARTNER');

      await expect(deleteAccountCopies(A)).resolves.toBeUndefined();
      expect(await readLocalCopy(B, 'partner')).toBe('B-PARTNER');
    });
  });

  describe('refresh', () => {
    it('refreshLocalCopies runs every registered kind', async () => {
      const partner = vi.fn(async () => {});
      const photos = vi.fn(async () => {});
      register('partner', partner);
      register('photos', photos);

      await refreshLocalCopies();

      expect(partner).toHaveBeenCalledTimes(1);
      expect(photos).toHaveBeenCalledTimes(1);
    });

    it("isolates one kind's failure from the others", async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const rejects = vi.fn(async () => {
        throw new Error('KIND-FAILED');
      });
      const throwsSync = vi.fn((): Promise<void> => {
        throw new Error('KIND-THREW');
      });
      const healthy = vi.fn(async () => {});
      register('a-rejects', rejects);
      register('b-throws', throwsSync);
      register('c-healthy', healthy);

      await expect(refreshLocalCopies()).resolves.toBeUndefined();

      expect(rejects).toHaveBeenCalled();
      expect(throwsSync).toHaveBeenCalled();
      expect(healthy).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(2);
    });

    it('refreshLocalCopy runs only the named kind, and ignores an unknown one', async () => {
      const partner = vi.fn(async () => {});
      const photos = vi.fn(async () => {});
      register('partner', partner);
      register('photos', photos);

      await refreshLocalCopy('partner');
      await refreshLocalCopy('never-registered');

      expect(partner).toHaveBeenCalledTimes(1);
      expect(photos).not.toHaveBeenCalled();
    });

    it('refreshLocalCopy contains a failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      register('partner', async () => {
        throw new Error('KIND-FAILED');
      });

      await expect(refreshLocalCopy('partner')).resolves.toBeUndefined();
    });

    it('registering a kind again replaces its refresher; unregister removes it', async () => {
      const first = vi.fn(async () => {});
      const second = vi.fn(async () => {});
      const unregisterFirst = registerLocalCopy('partner', first);
      register('partner', second);

      // The stale unregister must not remove the replacement.
      unregisterFirst();
      await refreshLocalCopies();
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);

      for (const unregister of unregisters.splice(0)) unregister();
      await refreshLocalCopies();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });
});
