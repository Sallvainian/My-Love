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
 * (`resolveOwnPair`, keyed on TEST_PARALLEL_INDEX), found by a per-run content
 * stamp and deleted by that stamp at teardown. No partner is linked or unlinked, no
 * password reset, no shared row nulled.
 */
import type { Page, Request } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { goOffline } from '../../support/helpers/offline';
import { resolveOwnPair } from '../../support/helpers/events';
import { partnerRecordRead } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import type { TypedSupabaseClient } from '../../support/factories';
import type { Cleanup } from '../../support/fixtures/cleanup';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

/** The thread read (`love_notes_visible`) and the insert (`love_notes`). */
const isNotesRest = (url: URL) => url.pathname.startsWith('/rest/v1/love_notes');

/** A note's send: the POST upsert into `love_notes`. */
const isNoteSend = (request: Request) =>
  request.method() === 'POST' && new URL(request.url()).pathname === '/rest/v1/love_notes';

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

/** Delete this worker's notes to its partner carrying `stamp`. */
async function deleteStampedNotes(
  supabaseAdmin: TypedSupabaseClient,
  pair: { userId: string; partnerId: string },
  stamp: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('love_notes')
    .delete()
    .eq('from_user_id', pair.userId)
    .eq('to_user_id', pair.partnerId)
    .like('content', `%${stamp}%`);
  if (error) throw error;
}

/**
 * The run's notes, and the teardown that deletes them. Registered before any
 * note is composed: every note send the page starts is tracked with the
 * document that started it, so the deferred delete can first stop the queue
 * and wait for the sends still in flight.
 */
function prepareRun(
  page: Page,
  supabaseAdmin: TypedSupabaseClient,
  cleanup: Cleanup,
  pair: { userId: string; partnerId: string }
) {
  const stamp = `E2E-QUEUE-${Date.now()}`;
  const contents = [`${stamp} one`, `${stamp} two`, `${stamp} three`];
  // Every note send the page has started and not yet seen answered or
  // failed, with the document that started it. A send its document took
  // with it on the reload below can be left with neither event: it was held
  // by that phase's abort route, so it never reached the server.
  let documentsLoaded = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) documentsLoaded += 1;
  });
  const unsettledSends = new Map<Request, number>();
  // playwright-utils deviation: teardown must know when every note send has settled; interceptNetworkCall's observe mode latches onto the first matching request only.
  page.on('request', (request) => {
    if (isNoteSend(request)) unsettledSends.set(request, documentsLoaded);
  });
  // playwright-utils deviation: settles each note send that answers, against the map above.
  page.on('requestfinished', (request) => unsettledSends.delete(request));
  // playwright-utils deviation: settles each note send that fails, too; interceptNetworkCall's observe mode throws on a request that gets no response.
  page.on('requestfailed', (request) => unsettledSends.delete(request));
  cleanup.defer('delete the notes this run sent', async () => {
    // Stop the producer first: the queue's drain retry (`scheduleDrainRetry`
    // in notesSlice.ts) can still send a note after a delete. Every later
    // love_notes call is refused before it leaves the browser, and every
    // send the current document already started is waited for: PostgREST
    // answers a write only once it has committed, so after that nothing from
    // this run can still land. Guarded: on a closed page `route` throws,
    // which would skip the delete.
    if (!page.isClosed()) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      // playwright-utils deviation: must refuse every love_notes call from here on, and be in place before the wait below; interceptNetworkCall registers its route inside a test.step the caller cannot await.
      await page.route(isNotesRest, (route) => route.abort());
      await recurseUntil(
        async () => [...unsettledSends.values()].filter((doc) => doc === documentsLoaded).length,
        (v) => {
          expect(v, "every note send the page's document started has settled").toBe(0);
        }
      );
    }
    // The context, not just the page, so a failure's page snapshot is this
    // page (see `closeContext`).
    await page.context().close();
    await deleteStampedNotes(supabaseAdmin, pair, stamp);
    expect(await sentRows(supabaseAdmin, stamp), 'no note from this run may remain').toEqual([]);
  });
  return { stamp, contents };
}

/**
 * Signed in on the Notes screen with the partner loaded, go offline and send
 * `contents`, then wait until the queue holds all of them. Returns each note's
 * composition time, oldest first.
 */
async function sendOffline(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  partnerId: string,
  contents: string[]
): Promise<string[]> {
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

  const input = page.getByLabel('Love note message input');
  for (const content of contents) {
    await input.fill(content);
    await page.getByLabel('Send message', { exact: true }).click();
    await expect(input).toHaveValue('');
  }
  await recurseUntil(
    () => queuedContents(page),
    (queued) => {
      expect(queued).toEqual(contents);
    }
  );
  return (await queuedRows(page)).map((row) => row.createdAt);
}

/**
 * Reload with every `love_notes*` REST call aborted, so the queue can be
 * neither read from nor sent to the server, then go offline again. The abort
 * route stays in place; returns once it has refused at least one call.
 */
async function reloadWithoutNotesServer(page: Page) {
  let abortedCalls = 0;
  // playwright-utils deviation: the route must be installed before the next navigation and count and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
  await page.route(isNotesRest, (route) => {
    abortedCalls += 1;
    return route.abort();
  });
  await page.context().setOffline(false);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /love notes/i })).toBeVisible();
  await recurseUntil(async () => abortedCalls, (v) => { expect(v).toBeGreaterThan(0); });
  await goOffline(page, true);
}

test.beforeEach(async ({ page }) => {
  await dismissWelcomeSplash(page);
});

test.describe('Love-note text sent offline', () => {
  test('[P1] notes sent offline show at once as waiting to send, in order, and are queued', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const pair = await resolveOwnPair(supabaseAdmin);
    const { partnerId } = pair;
    const { stamp, contents } = prepareRun(page, supabaseAdmin, cleanup, pair);

    await sendOffline(page, interceptNetworkCall, partnerId, contents);

    for (const content of contents) {
      await expect(noteBubble(page, content)).toContainText('Waiting to send');
    }
    await recurseUntil(
      () => page.getByTestId('love-note-message').filter({ hasText: stamp }).allTextContents(),
      (shownOrder) => {
        expect(shownOrder.map((text) => contents.findIndex((c) => text.includes(c)))).toEqual([0, 1, 2]);
      }
    );
    expect(await queuedContents(page)).toEqual(contents);
  });

  test('[P1] queued notes survive a reload that gets no server answer', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const pair = await resolveOwnPair(supabaseAdmin);
    const { partnerId } = pair;
    const { stamp, contents } = prepareRun(page, supabaseAdmin, cleanup, pair);
    await sendOffline(page, interceptNetworkCall, partnerId, contents);

    await reloadWithoutNotesServer(page);

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
  });

  test('[P1] after a reload, queued notes reach the partner once each, in order, when the connection returns', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const pair = await resolveOwnPair(supabaseAdmin);
    const { partnerId } = pair;
    const { stamp, contents } = prepareRun(page, supabaseAdmin, cleanup, pair);
    const composedAt = await sendOffline(page, interceptNetworkCall, partnerId, contents);
    await reloadWithoutNotesServer(page);

    // WHEN: the connection returns.
    await page.unroute(isNotesRest);
    await goOffline(page, false);

    // THEN: the partner's view holds exactly the three notes, in order, and
    // the sender's thread shows them confirmed without a reload.
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
  });
});
