/**
 * dbSchema Unit Tests — blocked upgrade
 *
 * Tests for the blocked-upgrade reload prompt and for closing a live handle
 * when a later version bumps the schema.
 * Uses fake-indexeddb to simulate IndexedDB in Node.js environment.
 *
 * @see src/services/dbSchema.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { DB_NAME, DB_VERSION, openMyLoveDB } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import { storeAuthToken } from '../../../src/sw-db';
import { deleteDatabase, withinTimeout } from './dbSchemaFixtures';

describe('dbSchema', () => {
  const openDbs: Array<{ close: () => void }> = [];

  /** Open db and track for automatic cleanup */
  async function openTestDb<T = MyLoveDBSchema>(
    ...args: Parameters<typeof openDB<MyLoveDBSchema>>
  ) {
    const db = await openDB<MyLoveDBSchema>(...args);
    openDbs.push(db);
    return db;
  }

  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(() => {
    // Close all db handles opened during the test
    for (const db of openDbs) {
      db.close();
    }
    openDbs.length = 0;
    vi.restoreAllMocks();
    // The prompt tests stub `confirm` and `location`; a `location` stub left in
    // place makes the next `supabaseClient` import throw `Invalid URL`.
    vi.unstubAllGlobals();
    for (const dialog of screen.queryAllByRole('dialog')) dialog.remove();
  });

  describe('blocked upgrade prompt', () => {
    const RELOAD_MESSAGE =
      'A database update is waiting. You must reload this page to finish the update.';
    let user: UserEvent;

    beforeEach(() => {
      user = userEvent.setup();
    });

    async function holdLowerVersion(): Promise<{ close: () => void }> {
      const holder = await openDB(DB_NAME, 9, {
        upgrade(database) {
          database.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        },
      });
      openDbs.push(holder);
      return holder;
    }

    function getBlockedDialog(): HTMLElement | null {
      return screen.queryByRole('dialog', { name: RELOAD_MESSAGE });
    }

    async function waitForBlockedDialog(): Promise<HTMLElement> {
      return screen.findByRole('dialog', { name: RELOAD_MESSAGE });
    }

    async function clickDialogButton(dialog: HTMLElement, name: 'Reload' | 'Not now'): Promise<void> {
      await user.click(within(dialog).getByRole('button', { name }));
    }

    it('shows a reload confirm and rejects the open when dismissed', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      vi.stubGlobal('confirm', confirm);

      const opening = openMyLoveDB();
      const dialog = await waitForBlockedDialog();
      expect(confirm).not.toHaveBeenCalled();

      // Attach the rejection check before the click: the dismiss rejects the
      // open mid-click, and an unobserved rejection fails the run.
      const rejected = expect(opening).rejects.toThrow(/blocked/);
      await clickDialogButton(dialog, 'Not now');

      await rejected;
      expect(getBlockedDialog()).toBeNull();
    });

    it('shows a reload confirm and reloads when accepted', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      vi.stubGlobal('confirm', confirm);
      const reload = vi.fn();
      vi.stubGlobal('location', { reload });

      const opening = openMyLoveDB();
      const dialog = await waitForBlockedDialog();
      expect(confirm).not.toHaveBeenCalled();

      await clickDialogButton(dialog, 'Reload');
      expect(reload).toHaveBeenCalledTimes(1);

      // Reload is mocked, so the tab stays; close the holder so the pending
      // open can finish instead of spinning the fake-indexeddb wait loop.
      for (const db of openDbs) db.close();
      openDbs.length = 0;
      const upgraded = await opening;
      openDbs.push(upgraded);
    });

    it('prompts once for concurrent opens and rejects them all on dismiss', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      vi.stubGlobal('confirm', confirm);

      const openings = [openMyLoveDB(), openMyLoveDB(), openMyLoveDB()];
      const dialog = await waitForBlockedDialog();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(confirm).not.toHaveBeenCalled();

      // Observe the openings before the click: the dismiss rejects them
      // mid-click, and an unobserved rejection fails the run.
      const settled = Promise.allSettled(openings);
      await clickDialogButton(dialog, 'Not now');

      const results = await settled;
      expect(results.map((result) => result.status)).toEqual([
        'rejected',
        'rejected',
        'rejected',
      ]);
      for (const result of results) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(String(result.reason)).toMatch(/blocked/);
        }
      }
      expect(getBlockedDialog()).toBeNull();
    });

    it('reloads once when concurrent opens accept the blocked confirm', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      vi.stubGlobal('confirm', confirm);
      const reload = vi.fn();
      vi.stubGlobal('location', { reload });

      const openings = [openMyLoveDB(), openMyLoveDB(), openMyLoveDB()];
      const dialog = await waitForBlockedDialog();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(confirm).not.toHaveBeenCalled();

      await clickDialogButton(dialog, 'Reload');
      expect(reload).toHaveBeenCalledTimes(1);

      for (const db of openDbs) db.close();
      openDbs.length = 0;
      const upgraded = await Promise.all(openings);
      for (const db of upgraded) openDbs.push(db);
    });

    it('shows a reload confirm when page-side storeAuthToken is blocked', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      vi.stubGlobal('confirm', confirm);

      const storing = storeAuthToken({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: 0,
        userId: 'user-a',
      });
      const dialog = await waitForBlockedDialog();
      expect(confirm).not.toHaveBeenCalled();

      // Attach the rejection check before the click, as above.
      const rejected = expect(storing).rejects.toThrow(/blocked/);
      await clickDialogButton(dialog, 'Not now');

      await rejected;
      expect(getBlockedDialog()).toBeNull();
    });
  });

  describe('live handle close on next bump', () => {
    it('lets a higher-version open fulfill without a reload confirm', async () => {
      const holder = await openMyLoveDB();
      openDbs.push(holder);
      const confirm = vi.fn().mockReturnValue(false);
      vi.stubGlobal('confirm', confirm);

      const next = await withinTimeout(openDB(DB_NAME, DB_VERSION + 1), 'open DB_VERSION+1');
      openDbs.push(next);

      expect(confirm).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('does not treat a closed service wrapper as already initialized', async () => {
      const { moodService } = await import('../../../src/services/moodService');
      const { storageService } = await import('../../../src/services/storage');

      type Handle = { db: { close: () => void } | null };
      const holders: Array<{ service: { init: () => Promise<void> }; handle: Handle }> = [
        { service: moodService, handle: moodService as unknown as Handle },
        { service: storageService, handle: storageService as unknown as Handle },
      ];

      for (const { handle } of holders) {
        handle.db?.close();
        handle.db = null;
      }

      for (const { service, handle } of holders) {
        await service.init();
        expect(handle.db).not.toBeNull();
        openDbs.push({ close: () => handle.db?.close() });
      }

      const confirm = vi.fn().mockReturnValue(false);
      vi.stubGlobal('confirm', confirm);

      const next = await withinTimeout(
        openDB(DB_NAME, DB_VERSION + 1),
        'open DB_VERSION+1 with live service handles'
      );
      openDbs.push(next);
      expect(confirm).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();

      for (const { service, handle } of holders) {
        expect(handle.db).toBeNull();
        await expect(service.init()).rejects.toThrow(/lower version|VersionError/i);
      }
    });
  });
});
