/**
 * E2E: every photo viewable offline (spec-unified-data-storage story 10, CAP-5).
 *
 * 1. A gallery loaded online saves the whole list as the `photos` local copy,
 *    and the background fill caches every photo's image in the per-account
 *    image cache, so after a reload that gets no server answer, offline, every
 *    photo is listed and every image shows — in the grid and in the viewer.
 * 2. With storage refusal forced (the page refuses a third image-cache entry
 *    with a QuotaExceededError), the oldest photo's image is the one left out:
 *    offline the gallery still lists every photo, the newest two images show
 *    and the oldest shows the "not saved on this device" placeholder.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline. The reload runs online with the photos REST endpoint and Storage
 * aborted, so the session never gets a server answer or an image, and the
 * device then goes offline.
 *
 * Test data: photos of THIS worker's pair (`resolveOwnPair`, keyed on
 * TEST_WORKER_INDEX) — rows inserted and Storage objects uploaded through the
 * service client, all deleted by id / path at teardown. No partner is linked
 * or unlinked, no password reset, no shared row nulled.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
import { PHOTOS_LIST_READ } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import type { TypedSupabaseClient } from '../../support/factories';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const PHOTOS_REST = '**/rest/v1/photos*';
const STORAGE = '**/storage/v1/object/**';
const BUCKET = 'photos';

/** A 2x2 opaque PNG, so the browser can decode and lay out the cached image. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP479AARAwQCgAy7gb9EreIQQAAAABJRU5ErkJggg==',
  'base64'
);

interface SeededPhoto {
  id: string;
  path: string;
  caption: string;
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

/** Ids in the signed-in account's saved `photos` copy, or `null`. */
async function savedPhotoIds(page: Page): Promise<string[] | null> {
  return page.evaluate(async () => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return null;
    return new Promise<string[] | null>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        const get = db.transaction('local-copies').objectStore('local-copies').get([userId, 'photos']);
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

async function goOffline(page: Page, offline: boolean) {
  await page.context().setOffline(offline);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), offline ? 'offline' : 'online');
}

/**
 * Seed `count` photos, newest first: the first is the worker's partner's, the
 * rest the worker user's own, each a minute older than the one before.
 */
async function seedPhotos(
  supabaseAdmin: TypedSupabaseClient,
  count: number,
  label: string
): Promise<SeededPhoto[]> {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  const stamp = Date.now();
  const seeded: SeededPhoto[] = [];
  for (let i = 0; i < count; i++) {
    const owner = i === 0 ? partnerId : userId;
    const path = `${owner}/e2e-offline-${label}-${stamp}-${i}.png`;
    const upload = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, PNG_BYTES, { contentType: 'image/png', upsert: true });
    expect(upload.error).toBeNull();
    const caption = `E2E offline ${label} ${stamp} #${i}`;
    const { data, error } = await supabaseAdmin
      .from('photos')
      .insert({
        user_id: owner,
        storage_path: path,
        filename: `offline-${i}.png`,
        caption,
        mime_type: 'image/png',
        file_size: PNG_BYTES.length,
        width: 2,
        height: 2,
        created_at: new Date(stamp - i * 60_000).toISOString(),
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    seeded.push({ id: data!.id, path, caption });
  }
  return seeded;
}

/** The test's premise: the pair's album holds exactly the seeded photos. */
async function expectAlbumIsSeeded(supabaseAdmin: TypedSupabaseClient, seeded: SeededPhoto[]) {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  const { data, error } = await supabaseAdmin
    .from('photos')
    .select('id')
    .in('user_id', [userId, partnerId]);
  expect(error).toBeNull();
  expect(
    (data ?? []).map((row) => row.id).sort(),
    "the worker pair's album holds photos this spec did not seed"
  ).toEqual(seeded.map((photo) => photo.id).sort());
}

async function deletePhotos(supabaseAdmin: TypedSupabaseClient, seeded: SeededPhoto[]) {
  if (seeded.length === 0) return;
  const rows = await supabaseAdmin
    .from('photos')
    .delete()
    .in(
      'id',
      seeded.map((photo) => photo.id)
    );
  expect.soft(rows.error).toBeNull();
  const objects = await supabaseAdmin.storage.from(BUCKET).remove(seeded.map((photo) => photo.path));
  expect.soft(objects.error).toBeNull();
}

function tile(page: Page, caption: string) {
  return page.getByTestId('photo-gallery-grid').getByRole('button', { name: caption, exact: true });
}

async function expectTileShowsImage(page: Page, caption: string) {
  const image = tile(page, caption).getByTestId('photo-grid-item-image');
  await expect(image).toHaveAttribute('src', /^blob:/);
  await recurseUntil(
    () => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    (v) => {
      expect(v).toBe(true);
    }
  );
  await expect(tile(page, caption).getByTestId('photo-grid-item-not-saved')).toHaveCount(0);
}

/**
 * Reload with neither the photo list nor Storage answering, then go offline.
 * Returns once the start read has really hit the aborted route.
 */
async function reloadWithoutServerThenGoOffline(page: Page) {
  let abortedReads = 0;
  // playwright-utils deviation: the route must be installed before the next navigation and count and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
  await page.route(PHOTOS_REST, (route) => {
    abortedReads += 1;
    return route.abort();
  });
  await page.route(STORAGE, (route) => route.abort());
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
  await recurseUntil(async () => abortedReads, (v) => { expect(v).toBeGreaterThan(0); });
  await goOffline(page, true);
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching love-notes-offline-copy.spec.ts.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

/**
 * Cap the `image-cache` store at `capacity` distinct entries: a put of a new
 * entry past the cap throws a QuotaExceededError, and a delete frees a slot.
 * Everything the script uses is declared inside it, because addInitScript
 * serialises only the function.
 */
async function installImageCacheQuota(page: Page, capacity: number) {
  await page.addInitScript((cap) => {
    const held = new Set<string>();
    const reserve = (id: string) => {
      if (held.has(id)) return;
      if (held.size >= cap) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      held.add(id);
    };
    const proto = IDBObjectStore.prototype;
    const put = proto.put;
    const remove = proto.delete;
    proto.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'image-cache') {
        const row = value as { userId: string; path: string };
        reserve(JSON.stringify([row.userId, row.path]));
      }
      return put.call(this, value, key);
    };
    proto.delete = function (this: IDBObjectStore, query: IDBValidKey | IDBKeyRange) {
      if (this.name === 'image-cache' && Array.isArray(query)) held.delete(JSON.stringify(query));
      return remove.call(this, query);
    };
  }, capacity);
}

test.describe('Photos offline', () => {
  test('[P1] after one online session every photo is listed and every image shows offline', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    let seeded: SeededPhoto[] = [];

    try {
      seeded = await seedPhotos(supabaseAdmin, 3, 'all');
      await expectAlbumIsSeeded(supabaseAdmin, seeded);

      // GIVEN: the gallery loads online; the list is saved and the fill caches
      // every image.
      const listRead = interceptNetworkCall({ method: 'GET', url: PHOTOS_LIST_READ });
      await page.goto('/photos');
      const list = await listRead;
      expect(list.status).toBe(200);
      expect(list.responseJson).toEqual(
        expect.arrayContaining(seeded.map((photo) => expect.objectContaining({ id: photo.id })))
      );
      for (const photo of seeded) {
        await expect(tile(page, photo.caption)).toBeVisible();
      }
      await recurseUntil(
        async () => {
          const ids = (await savedPhotoIds(page)) ?? [];
          return seeded.every((photo) => ids.includes(photo.id));
        },
        (v) => {
          expect(v).toBe(true);
        }
      );
      for (const photo of seeded) {
        await recurseUntil(() => imageCached(page, photo.path), (v) => { expect(v).toBe(true); });
      }

      // WHEN: the app reloads with no server answer, and the device goes offline.
      await reloadWithoutServerThenGoOffline(page);

      // THEN: every photo is listed and every image decodes from the cache…
      for (const photo of seeded) {
        await expect(tile(page, photo.caption)).toBeVisible();
        await expectTileShowsImage(page, photo.caption);
      }

      // …and in the viewer too.
      await tile(page, seeded[1].caption).click();
      const viewer = page.getByTestId('photo-viewer-overlay');
      await expect(viewer).toBeVisible();
      const viewed = viewer.getByRole('img', { name: seeded[1].caption });
      await expect(viewed).toHaveAttribute('src', /^blob:/);
      await recurseUntil(
        () => viewed.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        (v) => {
          expect(v).toBe(true);
        }
      );
      await expect(viewer.getByTestId('photo-viewer-not-saved')).toHaveCount(0);
      await expect(viewer.getByText('Failed to load photo')).toHaveCount(0);
    } finally {
      await page.context().setOffline(false);
      await page.unroute(PHOTOS_REST);
      await page.unroute(STORAGE);
      await deletePhotos(supabaseAdmin, seeded);
    }
  });

  test('[P1] with storage refused, the oldest image is left out and shows a placeholder offline', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // Refuse a third distinct image-cache entry, as a full browser would: the
    // write throws a QuotaExceededError. Deletes free a slot.
    await installImageCacheQuota(page, 2);

    let seeded: SeededPhoto[] = [];

    try {
      seeded = await seedPhotos(supabaseAdmin, 3, 'refused');
      await expectAlbumIsSeeded(supabaseAdmin, seeded);
      const [newest, middle, oldest] = seeded;

      // Every attempt on the oldest image — the tile's and the fill's — is
      // downloaded and then refused.
      let oldestDownloads = 0;
      page.on('response', (response) => {
        if (response.url().includes(oldest.path) && response.ok()) oldestDownloads += 1;
      });

      // GIVEN: the gallery loads online while storage holds only two images.
      const listRead = interceptNetworkCall({ method: 'GET', url: PHOTOS_LIST_READ });
      await page.goto('/photos');
      const list = await listRead;
      expect(list.status).toBe(200);
      expect(list.responseJson).toEqual(
        expect.arrayContaining(seeded.map((photo) => expect.objectContaining({ id: photo.id })))
      );
      for (const photo of seeded) {
        await expect(tile(page, photo.caption)).toBeVisible();
      }
      await recurseUntil(async () => oldestDownloads, (v) => {
        expect(v).toBeGreaterThanOrEqual(2);
      });
      // The newest two are kept; the oldest could not be cached.
      await recurseUntil(
        async () => [
          await imageCached(page, newest.path),
          await imageCached(page, middle.path),
          await imageCached(page, oldest.path),
        ],
        (v) => {
          expect(v).toEqual([true, true, false]);
        }
      );
      // Online, the oldest image still shows (downloaded, just not kept).
      await expectTileShowsImage(page, oldest.caption);

      // WHEN: the app reloads with no server answer, and the device goes offline.
      await reloadWithoutServerThenGoOffline(page);

      // THEN: every photo is still listed; the newest two show, the oldest is a
      // placeholder.
      await expectTileShowsImage(page, newest.caption);
      await expectTileShowsImage(page, middle.caption);
      await expect(tile(page, oldest.caption)).toBeVisible();
      await expect(tile(page, oldest.caption).getByTestId('photo-grid-item-not-saved')).toBeVisible();
      await expect(page.getByTestId('photo-grid-item')).toHaveCount(3);

      await tile(page, oldest.caption).click();
      await expect(
        page.getByTestId('photo-viewer-overlay').getByTestId('photo-viewer-not-saved')
      ).toBeVisible();
    } finally {
      await page.context().setOffline(false);
      await page.unroute(PHOTOS_REST);
      await page.unroute(STORAGE);
      await deletePhotos(supabaseAdmin, seeded);
    }
  });
});
