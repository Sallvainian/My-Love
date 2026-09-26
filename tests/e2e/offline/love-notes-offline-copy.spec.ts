/**
 * E2E: the love-notes thread on the shared local-copy mechanism
 * (spec-unified-data-storage story 8).
 *
 * 1. A thread loaded online is saved as the `love-notes` local copy, and each
 *    image shown is saved in the per-account image cache, so after a reload
 *    that gets no server answer, offline, both notes are listed — the image
 *    included — with no error banner.
 * 2. A note the partner wrote while this device was offline appears after the
 *    `online` event, without a reload: the kind's refresher re-reads the server.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline. The reload runs online with the thread's REST endpoint and
 * Storage aborted, so the session never gets a server answer or an image, and
 * the device then goes offline.
 *
 * Test data: notes from THIS worker's partner to its user (`resolveOwnPair`,
 * keyed on TEST_WORKER_INDEX) and one Storage object under the partner's
 * folder, all deleted by id / path at teardown. No partner is linked or
 * unlinked, no password reset, no shared row nulled.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
import { LOVE_NOTES_READ } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import type { TypedSupabaseClient } from '../../support/factories';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const NOTES_REST = '**/rest/v1/love_notes_visible*';
const STORAGE = '**/storage/v1/object/**';
const BUCKET = 'love-notes-images';

/** A 2x2 opaque PNG, so the browser can decode and lay out the cached image. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP479AARAwQCgAy7gb9EreIQQAAAABJRU5ErkJggg==',
  'base64'
);

/** Ids in the signed-in account's saved `love-notes` copy, or `null`. */
async function savedNoteIds(page: Page): Promise<string[] | null> {
  return page.evaluate(async () => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return null;
    return new Promise<string[] | null>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        const get = db
          .transaction('local-copies')
          .objectStore('local-copies')
          .get([userId, 'love-notes']);
        get.onsuccess = () => {
          db.close();
          const value = get.result?.value as { id: string }[] | undefined;
          resolve(value ? value.map((row) => row.id) : null);
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    });
  });
}

/** Whether the signed-in account's image cache holds a Blob for `path`. */
async function imageCached(page: Page, path: string): Promise<boolean> {
  return page.evaluate(async (wanted) => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return false;
    return new Promise<boolean>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve(false);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('image-cache')) {
          db.close();
          resolve(false);
          return;
        }
        const get = db.transaction('image-cache').objectStore('image-cache').get([userId, wanted]);
        get.onsuccess = () => {
          db.close();
          resolve(get.result?.blob instanceof Blob && get.result.blob.size > 0);
        };
        get.onerror = () => {
          db.close();
          resolve(false);
        };
      };
    });
  }, path);
}

async function goOffline(page: Page, offline: boolean) {
  await page.context().setOffline(offline);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), offline ? 'offline' : 'online');
}

/** A note from this worker's partner to its user. Returns its id. */
async function seedPartnerNote(
  supabaseAdmin: TypedSupabaseClient,
  content: string,
  imageUrl: string | null = null
): Promise<string> {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  const { data, error } = await supabaseAdmin
    .from('love_notes')
    .insert({ from_user_id: partnerId, to_user_id: userId, content, image_url: imageUrl })
    .select('id')
    .single();
  expect(error).toBeNull();
  return data!.id;
}

/** Upload a note image under the partner's folder. Returns its storage path. */
async function seedPartnerImage(supabaseAdmin: TypedSupabaseClient): Promise<string> {
  const { partnerId } = await resolveOwnPair(supabaseAdmin);
  const path = `${partnerId}/e2e-offline-${Date.now()}.png`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, PNG_BYTES, { contentType: 'image/png', upsert: true });
  expect(error).toBeNull();
  return path;
}

async function deleteNotes(supabaseAdmin: TypedSupabaseClient, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin.from('love_notes').delete().in('id', ids);
  expect.soft(error).toBeNull();
}

async function deleteImage(supabaseAdmin: TypedSupabaseClient, path: string | null) {
  if (!path) return;
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  expect.soft(error).toBeNull();
}

function noteBubble(page: Page, content: string) {
  return page.getByTestId('love-note-message').filter({ hasText: content });
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching interactions-offline-copy.spec.ts.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.describe('Love notes from the local copy', () => {
  test('[P1] a thread loaded online is listed offline after a reload, image included', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const stamp = Date.now();
    const textContent = `E2E offline text ${stamp}`;
    const imageContent = `E2E offline image ${stamp}`;
    const noteIds: string[] = [];
    let imagePath: string | null = null;

    try {
      imagePath = await seedPartnerImage(supabaseAdmin);
      noteIds.push(await seedPartnerNote(supabaseAdmin, textContent));
      noteIds.push(await seedPartnerNote(supabaseAdmin, imageContent, imagePath));
      const path = imagePath;

      // GIVEN: the thread loads online; showing the image caches it.
      const threadRead = interceptNetworkCall({ method: 'GET', url: LOVE_NOTES_READ });
      await page.goto('/notes');
      const thread = await threadRead;
      expect(thread.status).toBe(200);
      expect(thread.responseJson).toEqual(
        expect.arrayContaining(noteIds.map((id) => expect.objectContaining({ id })))
      );
      await expect(noteBubble(page, textContent)).toBeVisible();
      await expect(noteBubble(page, imageContent).locator('img')).toBeVisible();
      await recurseUntil(
        async () => {
          const ids = (await savedNoteIds(page)) ?? [];
          return noteIds.every((id) => ids.includes(id));
        },
        (v) => {
          expect(v).toBe(true);
        }
      );
      await recurseUntil(() => imageCached(page, path), (v) => { expect(v).toBe(true); });

      // WHEN: the app reloads with neither the thread nor Storage answering,
      // and the device goes offline.
      let abortedReads = 0;
      // playwright-utils deviation: the route must be installed before the next navigation and count and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
      await page.route(NOTES_REST, (route) => {
        abortedReads += 1;
        return route.abort();
      });
      await page.route(STORAGE, (route) => route.abort());
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: /love notes/i })).toBeVisible();
      // The start read really hit the aborted route, so nothing after this
      // point can have come from the server.
      await recurseUntil(async () => abortedReads, (v) => { expect(v).toBeGreaterThan(0); });
      await goOffline(page, true);

      // THEN: both saved notes are listed, the image decoded from the cache…
      await expect(noteBubble(page, textContent)).toBeVisible();
      const image = noteBubble(page, imageContent).locator('img');
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute('src', /^blob:/);
      await recurseUntil(
        () => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        (v) => {
          expect(v).toBe(true);
        }
      );
      await expect(noteBubble(page, imageContent).getByText('Failed to load image')).toHaveCount(0);
      // …and no error banner covers the saved thread.
      await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
    } finally {
      await page.context().setOffline(false);
      await page.unroute(NOTES_REST);
      await page.unroute(STORAGE);
      await deleteNotes(supabaseAdmin, noteIds);
      await deleteImage(supabaseAdmin, imagePath);
    }
  });

  test('[P1] a note written while offline appears after reconnect without a reload', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const content = `E2E reconnect note ${Date.now()}`;
    let noteId: string | null = null;

    try {
      // GIVEN: signed in on the Notes screen, thread loaded, then offline.
      const threadRead = interceptNetworkCall({ method: 'GET', url: LOVE_NOTES_READ });
      await page.goto('/notes');
      expect((await threadRead).status).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: /love notes/i })).toBeVisible();
      await recurseUntil(() => savedNoteIds(page), (v) => { expect(v).not.toBeNull(); });
      await goOffline(page, true);

      // WHEN: the partner writes while this device is offline, then it reconnects.
      noteId = await seedPartnerNote(supabaseAdmin, content);
      const id = noteId;
      const refreshRead = interceptNetworkCall({ method: 'GET', url: LOVE_NOTES_READ });
      await goOffline(page, false);
      // The reconnect itself re-reads the server (the kind's refresher), and
      // that read carries the note — the seed sends no broadcast, so this does
      // not rest on Realtime.
      const response = await refreshRead;
      expect(response.status).toBe(200);
      const rows = response.responseJson as { id: string }[];
      expect(rows.map((row) => row.id)).toContain(id);

      // THEN: the note is in state, the copy and the thread.
      await recurseUntil(
        () =>
          page.evaluate(
            (wanted) => window.__APP_STORE__?.getState().notes.some((n) => n.id === wanted) ?? false,
            id
          ),
        (v) => {
          expect(v).toBe(true);
        }
      );
      await recurseUntil(
        async () => (await savedNoteIds(page))?.includes(id) ?? false,
        (v) => {
          expect(v).toBe(true);
        }
      );
      await expect(noteBubble(page, content)).toBeVisible();
    } finally {
      await page.context().setOffline(false);
      await deleteNotes(supabaseAdmin, noteId ? [noteId] : []);
    }
  });
});
