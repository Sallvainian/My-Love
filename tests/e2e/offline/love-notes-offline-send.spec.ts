/**
 * E2E: love-note text saved offline and sent later
 * (spec-unified-data-storage story 9, CAP-3).
 *
 * Every text note goes into the per-account `note-queue` (IndexedDB) before it
 * is sent. Offline, three notes show at once as "Waiting to send"; they survive
 * a reload that gets no server answer; once the connection returns, the `online`
 * drain sends them, and the partner's view holds each exactly once, in order,
 * each carrying its composition time as `written_at`.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline. The reload runs online with every `love_notes*` REST call aborted
 * (the thread read and the insert), so the queue can neither be read from nor
 * sent to the server, and the device then goes offline again.
 *
 * Test data: three notes from THIS worker's user to its partner
 * (`resolveOwnPair`, keyed on TEST_WORKER_INDEX), found by a per-run content
 * stamp and deleted by id at teardown. No partner is linked or unlinked, no
 * password reset, no shared row nulled.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
import { partnerRecordRead } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import type { TypedSupabaseClient } from '../../support/factories';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

/** The thread read (`love_notes_visible`) and the insert (`love_notes`). */
const isNotesRest = (url: URL) => url.pathname.startsWith('/rest/v1/love_notes');

async function goOffline(page: Page, offline: boolean) {
  await page.context().setOffline(offline);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), offline ? 'offline' : 'online');
}

function noteBubble(page: Page, content: string) {
  return page.getByTestId('love-note-message').filter({ hasText: content });
}

/** The signed-in account's queued notes, oldest first. */
async function queuedRows(page: Page): Promise<{ content: string; createdAt: string }[]> {
  return page.evaluate(async () => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return [];
    return new Promise<{ content: string; createdAt: string }[]>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve([]);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('note-queue')) {
          db.close();
          resolve([]);
          return;
        }
        const get = db.transaction('note-queue').objectStore('note-queue').index('by-user').getAll(userId);
        get.onsuccess = () => {
          db.close();
          const rows = get.result as { content: string; createdAt: string }[];
          rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
          resolve(rows.map(({ content, createdAt }) => ({ content, createdAt })));
        };
        get.onerror = () => {
          db.close();
          resolve([]);
        };
      };
    });
  });
}

/** The signed-in account's queued note contents, oldest first. */
async function queuedContents(page: Page): Promise<string[]> {
  return (await queuedRows(page)).map((row) => row.content);
}

/** This worker's notes to its partner carrying `stamp`, oldest first. */
async function sentRows(
  supabaseAdmin: TypedSupabaseClient,
  stamp: string
): Promise<{ id: string; content: string; created_at: string; written_at: string | null }[]> {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  const { data, error } = await supabaseAdmin
    .from('love_notes')
    .select('id, content, created_at, written_at')
    .eq('from_user_id', userId)
    .eq('to_user_id', partnerId)
    .like('content', `%${stamp}%`)
    .order('created_at', { ascending: true });
  expect(error).toBeNull();
  return data ?? [];
}

async function deleteNotes(supabaseAdmin: TypedSupabaseClient, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin.from('love_notes').delete().in('id', ids);
  expect.soft(error).toBeNull();
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching love-notes-offline-copy.spec.ts.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.describe('Love-note text sent offline', () => {
  test('[P1] three notes sent offline survive a reload and reach the partner once each, in order', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const stamp = `E2E-QUEUE-${Date.now()}`;
    const contents = [`${stamp} one`, `${stamp} two`, `${stamp} three`];
    let routed = false;
    // Resolved before the `try`, so the teardown below reuses it rather than
    // resolving again where a throw would skip the delete.
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);

    try {
      // GIVEN: signed in on the Notes screen with the partner loaded, then offline.
      const partnerRead = interceptNetworkCall({ method: 'GET', url: partnerRecordRead(partnerId) });
      await page.goto('/notes');
      expect((await partnerRead).status).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: /love notes/i })).toBeVisible();
      await recurseUntil(
        () => page.evaluate(() => window.__APP_STORE__?.getState().partner?.id ?? null),
        (v) => {
          expect(v).toBe(partnerId);
        }
      );
      await goOffline(page, true);

      // WHEN: three notes are sent offline.
      const input = page.getByLabel('Love note message input');
      for (const content of contents) {
        await input.fill(content);
        await page.getByLabel('Send message', { exact: true }).click();
        await expect(input).toHaveValue('');
      }

      // THEN (1): all three show at once, in order, waiting to send.
      for (const content of contents) {
        await expect(noteBubble(page, content)).toContainText('Waiting to send');
      }
      await recurseUntil(
        () => page.getByTestId('love-note-message').filter({ hasText: stamp }).allTextContents(),
        (shownOrder) => {
          expect(shownOrder.map((text) => contents.findIndex((c) => text.includes(c)))).toEqual([0, 1, 2]);
        }
      );
      await recurseUntil(
        () => queuedContents(page),
        (queued) => {
          expect(queued).toEqual(contents);
        }
      );
      const composedAt = (await queuedRows(page)).map((row) => row.createdAt);

      // WHEN: the app reloads with no love-notes server answer, then goes offline.
      let abortedCalls = 0;
      // playwright-utils deviation: the route must be installed before the next navigation and count and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
      await page.route(isNotesRest, (route) => {
        abortedCalls += 1;
        return route.abort();
      });
      routed = true;
      await page.context().setOffline(false);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: /love notes/i })).toBeVisible();
      await recurseUntil(async () => abortedCalls, (v) => { expect(v).toBeGreaterThan(0); });
      await goOffline(page, true);

      // THEN (2): the notes still show pending, from the queue.
      for (const content of contents) {
        await expect(noteBubble(page, content)).toContainText('Waiting to send');
      }
      await recurseUntil(
        () => queuedContents(page),
        (queued) => {
          expect(queued).toEqual(contents);
        }
      );
      expect(await sentRows(supabaseAdmin, stamp)).toEqual([]);

      // WHEN: the connection returns.
      await page.unroute(isNotesRest);
      routed = false;
      await goOffline(page, false);

      // THEN (3): the partner's view holds exactly the three notes, in order,
      // and the sender's thread shows them confirmed without a reload.
      await recurseUntil(
        async () => (await sentRows(supabaseAdmin, stamp)).length,
        (v) => {
          expect(v).toBe(3);
        },
        { timeout: 15000 }
      );
      const rows = await sentRows(supabaseAdmin, stamp);
      expect(rows.map((row) => row.content)).toEqual(contents);
      // Each carries when it was written; created_at is the later delivery.
      expect(rows.map((row) => row.written_at && Date.parse(row.written_at))).toEqual(
        composedAt.map((at) => Date.parse(at))
      );
      for (const row of rows) {
        expect(Date.parse(row.created_at)).toBeGreaterThan(Date.parse(row.written_at!));
      }
      await recurseUntil(() => queuedContents(page), (v) => { expect(v).toEqual([]); });
      await recurseUntil(
        () =>
          page.evaluate(
            (ids) => {
              const notes = window.__APP_STORE__?.getState().notes ?? [];
              return ids.every((id) => notes.some((n) => n.id === id && !n.queued && !n.sending));
            },
            rows.map((row) => row.id)
          ),
        (v) => {
          expect(v).toBe(true);
        }
      );
      for (const content of contents) {
        await expect(noteBubble(page, content)).not.toContainText('Waiting to send');
      }
    } finally {
      // Guarded, so neither can skip the delete below or replace the test's error.
      if (routed) await page.unroute(isNotesRest).catch(() => {});
      await page.context().setOffline(false).catch(() => {});
      // TEARDOWN (4): delete exactly the rows this run sent. The ids are read
      // here with a soft check rather than through `sentRows`, whose hard
      // assertion would throw out of this `finally` and replace the test's own
      // error.
      const { data: sent, error: sentError } = await supabaseAdmin
        .from('love_notes')
        .select('id')
        .eq('from_user_id', userId)
        .eq('to_user_id', partnerId)
        .like('content', `%${stamp}%`);
      expect.soft(sentError, 'Teardown must find the notes this test sent').toBeNull();
      await deleteNotes(
        supabaseAdmin,
        (sent ?? []).map((row) => row.id)
      );
    }
  });
});
