import type { Page } from '@playwright/test';
import type { AppState } from '../../../src/stores/types';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import { test, expect } from '../../support/merged-fixtures';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';

// These tests load the actual app with local Supabase auth. Source imports are
// read-only observation/navigation helpers; storage, auth and sync are not mocked.
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/stores/useAppStore.ts';
    const { useAppStore } = await import(modulePath);
    const state = useAppStore.getState() as AppState;
    return {
      userId: state.userId,
      sessionVersion: state.authSessionVersion,
      currentId: state.currentMessage?.id,
      currentFavorite: state.currentMessage?.isFavorite,
      favoriteIds: state.messageHistory.favoriteIds,
      pending: state.syncStatus.pendingMoods,
      moods: state.moods.map((row) => ({
        id: row.id,
        mood: row.mood,
        note: row.note,
        synced: row.synced,
        supabaseId: row.supabaseId,
      })),
    };
  });
}

async function navigate(page: Page, view: 'home' | 'mood' | 'settings') {
  await page.evaluate(async (nextView) => {
    const modulePath = '/src/stores/useAppStore.ts';
    const { useAppStore } = await import(modulePath);
    (useAppStore.getState() as AppState).setView(nextView);
  }, view);
}

async function localRows(page: Page, store: 'message-favorites' | 'moods') {
  return page.evaluate(async (storeName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('my-love-db');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const request = db.transaction(storeName).objectStore(storeName).getAll();
        request.onsuccess = () => resolve(JSON.parse(JSON.stringify(request.result)));
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, store);
}

async function signOut(page: Page) {
  await navigate(page, 'settings');
  await page.getByTestId('settings-sign-out').click();
  await expect(page.getByTestId('login-screen')).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).userId).toBeNull();
  expect((await snapshot(page)).favoriteIds).toEqual([]);
}

async function signIn(page: Page, email: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('app-container')).toBeVisible();
  await navigate(page, 'home');
  await expect(page.getByTestId('message-favorite-button')).toBeVisible();
}

test.describe('Account data through the real browser and local services', () => {
  test.setTimeout(90_000);

  test('[P1] favorites survive reload and stay separate across A/B/A and same-account re-login', async ({ page, supabaseAdmin }) => {
    const pair = getWorkerPairEmails();
    if (!pair) throw new Error('This test requires its worker-owned account pair');
    // Favorites are server rows now and outlive a run: start this worker
    // pair's own favorites empty, or a re-run opens on "Remove from favorites".
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('users').select('id').in('email', [pair.user1Email, pair.user2Email]);
    expect(accountsError).toBeNull();
    expect(accounts).toHaveLength(2);
    const cleared = await supabaseAdmin.from('message_favorites').delete()
      .in('user_id', (accounts ?? []).map((account) => account.id));
    expect(cleared.error).toBeNull();
    await page.goto('/');
    const favorite = page.getByTestId('message-favorite-button');
    await expect(favorite).toHaveAccessibleName('Add to favorites');
    const original = await snapshot(page);
    expect(original.userId).toBeTruthy();
    expect(original.currentId).toBeTruthy();

    await favorite.click();
    await expect.poll(() => localRows(page, 'message-favorites')).toContainEqual({
      messageId: original.currentId,
      userId: original.userId,
    });
    await expect.poll(async () => (await snapshot(page)).favoriteIds).toContain(original.currentId);
    await expect(favorite).toHaveAccessibleName('Remove from favorites');

    await page.reload();
    await expect(favorite).toHaveAccessibleName('Remove from favorites');
    expect((await snapshot(page)).currentFavorite).toBe(true);
    await signOut(page);
    await signIn(page, pair.user2Email);
    await expect.poll(async () => (await snapshot(page)).userId).not.toBe(original.userId);
    await expect.poll(async () => (await snapshot(page)).currentId).toBe(original.currentId);
    await expect(favorite).toHaveAccessibleName('Add to favorites');
    expect((await snapshot(page)).favoriteIds).toEqual([]);

    // B can add and remove the same daily favorite without changing A's row.
    await favorite.click();
    await expect(favorite).toHaveAccessibleName('Remove from favorites');
    await favorite.click();
    await expect(favorite).toHaveAccessibleName('Add to favorites');
    expect(await localRows(page, 'message-favorites')).toEqual([{
      messageId: original.currentId,
      userId: original.userId,
    }]);

    await signOut(page);
    await signIn(page, pair.user1Email);
    await expect(favorite).toHaveAccessibleName('Remove from favorites');
    const beforeRelogin = await snapshot(page);
    await signOut(page);
    await signIn(page, pair.user1Email);
    await expect(favorite).toHaveAccessibleName('Remove from favorites');
    const afterRelogin = await snapshot(page);
    expect(afterRelogin.userId).toBe(original.userId);
    expect(afterRelogin.sessionVersion).toBeGreaterThan(beforeRelogin.sessionVersion);
    expect(afterRelogin.favoriteIds).toEqual([original.currentId]);
  });

  test('[P1] repairs an invalid local mood through the form, preserving its row and syncing the result', async ({ page, supabaseAdmin }) => {
    await page.goto('/');
    await expect(page.getByTestId('daily-message')).toBeVisible();
    const seeded = await page.evaluate(async () => {
      const storePath = '/src/stores/useAppStore.ts';
      const datePath = '/src/utils/dateUtils.ts';
      const { useAppStore } = await import(storePath);
      const { formatDateISO } = await import(datePath);
      const owner = (useAppStore.getState() as AppState).userId;
      if (!owner) throw new Error('Expected a real signed-in worker account');
      const now = new Date();
      const row = {
        userId: owner,
        date: formatDateISO(now),
        timestamp: now,
        mood: 'retired-mood',
        moods: ['retired-mood', null],
        note: 'Retained local note for mood repair',
        synced: false,
      };
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('my-love-db');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const tx = db.transaction('moods', 'readwrite');
        const request = tx.objectStore('moods').add(row);
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
        return { id: Number(request.result), owner, timestamp: now.toISOString(), note: row.note };
      } finally {
        db.close();
      }
    });

    try {
      await navigate(page, 'mood');
      await expect(page.getByTestId('mood-tracker')).toBeVisible();
      await expect.poll(async () => (await snapshot(page)).pending).toBe(1);
      expect((await snapshot(page)).moods).toEqual([]);
      expect(await localRows(page, 'moods')).toContainEqual(expect.objectContaining({
        id: seeded.id,
        mood: 'retired-mood',
        note: seeded.note,
        synced: false,
      }));
      await expect(page.getByTestId('mood-submit-button')).toBeDisabled();

      const savedResponse = page.waitForResponse((response) => {
        const request = response.request();
        if (!response.url().includes('/rest/v1/moods') || request.method() !== 'POST') return false;
        const body = request.postDataJSON();
        return body.user_id === seeded.owner && body.created_at === seeded.timestamp;
      });
      await page.getByTestId('mood-button-happy').click();
      await page.getByTestId('mood-submit-button').click();
      const response = await savedResponse;
      expect(response.ok()).toBe(true);
      const body = await response.json();
      expect(body).toEqual(expect.objectContaining({
        user_id: seeded.owner,
        mood_type: 'happy',
        mood_types: ['happy'],
        note: seeded.note,
      }));
      const serverId = body.id as string;
      await expect.poll(async () => (await snapshot(page)).moods).toContainEqual({
        id: seeded.id,
        mood: 'happy',
        note: seeded.note,
        synced: true,
        supabaseId: serverId,
      });
      await expect.poll(() => localRows(page, 'moods')).toEqual([expect.objectContaining({
        id: seeded.id,
        userId: seeded.owner,
        timestamp: seeded.timestamp,
        moods: ['happy'],
        note: seeded.note,
        synced: true,
        supabaseId: serverId,
      })]);
      await expect(page.getByTestId('mood-success-toast')).toBeVisible();
      await expect(page.getByTestId('mood-note-input')).toHaveValue(seeded.note);
      await expect.poll(async () => (await snapshot(page)).pending).toBe(0);
      const persisted = await supabaseAdmin.from('moods').select('mood_type,mood_types,note').eq('id', serverId).single();
      expect(persisted.error).toBeNull();
      expect(persisted.data).toEqual({ mood_type: 'happy', mood_types: ['happy'], note: seeded.note });
    } finally {
      // Stop this page's retries before deleting only the row this test created.
      await page.close();
      const cleanup = await supabaseAdmin.from('moods').delete()
        .eq('user_id', seeded.owner).eq('created_at', seeded.timestamp);
      expect(cleanup.error).toBeNull();
    }
  });
});
