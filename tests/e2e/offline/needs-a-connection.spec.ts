/**
 * E2E: needs-a-connection handling everywhere else (ticket 11, CAP-4, CAP-8).
 *
 * Offline, each write below is refused up front — before any request and any
 * change on screen — with "You are offline. <what> need(s) a connection to
 * <action>." where that control already reports errors. Every test loads the
 * screen online, goes offline, taps, then asserts the message, zero Supabase
 * requests from the tap, and unchanged data.
 *
 * Requests are counted from `page.on('request')`, armed after the device goes
 * offline and just before the tap, on the local Supabase origin under
 * `/rest/v1`, `/storage/v1`, `/auth/v1` or `/functions/v1`. An offline request
 * still fires the `request` event, so a leaked write shows up.
 *
 * Background reads still go out on some screens after the tap is armed — seen
 * in runs: other mount-time reads on Photos and Love Notes, and
 * `GET /rest/v1/partner_requests` (PartnerMoodView's pending-request effect) on
 * Partner. Tests on those screens narrow the count to writes (every method but
 * GET), and say so. The reads those writes would have made first are pinned by
 * unit tests. The partner lookup (`GET /rest/v1/users?select=partner_id`) no
 * longer goes out offline (DW-222), so those screens also assert that none does.
 *
 * Not covered here, by the spec's decision, and covered by unit tests instead
 * (tests/unit/stores/notesSlice.offlineQueue.test.ts and
 * notesSlice.localCopy.test.ts):
 * - the no-partner love-notes row: pool users are always linked, and the
 *   partner loads from the saved copy, so "no partner loaded" is unreachable;
 * - older notes offline: it needs a thread longer than one page.
 *
 * Test data: rows of THIS worker's pair (`resolveOwnPair`, keyed on
 * TEST_WORKER_INDEX), seeded through the service client and deleted by id at
 * teardown. Partner requests are faked in the browser only — no real
 * `partner_requests` row is ever seeded, linked or unlinked, and their writes
 * are also aborted, so a regressed guard cannot insert one.
 */
import type { Page, Request } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import {
  CUSTOM_MESSAGE_SAVE,
  INTERACTIONS_READ,
  LOVE_NOTES_READ,
  PHOTOS_LIST_READ,
  gateNameRead,
  partnerRecordRead,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import type { TypedSupabaseClient } from '../../support/factories';
import { createInteractionInsert } from '../../support/factories/interaction-record-ownership';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const offline = (sentence: string) => `You are offline. ${sentence}`;

/** A 2x2 opaque PNG: valid for the upload validators and decodable. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP479AARAwQCgAy7gb9EreIQQAAAABJRU5ErkJggg==',
  'base64'
);
const PNG_FILE = { name: 'offline.png', mimeType: 'image/png', buffer: PNG_BYTES };

const SUPABASE_PATHS = ['/rest/v1', '/storage/v1', '/auth/v1', '/functions/v1'];

async function goOffline(page: Page, isOffline: boolean) {
  await page.context().setOffline(isOffline);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), isOffline ? 'offline' : 'online');
}

/**
 * Record every request to the local Supabase API from now on. Arm it after
 * `goOffline(page, true)` and just before the tap. `writesOnly` skips GETs, for
 * screens where a background read is known to run (see the header);
 * `partnerLookups` records the partner lookups either way.
 */
function watchSupabaseRequests(page: Page, { writesOnly = false } = {}) {
  const supabase = new URL(process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321');
  const local = ['localhost', '127.0.0.1'];
  const seen: string[] = [];
  const partnerLookups: string[] = [];
  const listener = (request: Request) => {
    const url = new URL(request.url());
    const sameOrigin =
      url.host === supabase.host ||
      (url.port === supabase.port && local.includes(url.hostname) && local.includes(supabase.hostname));
    if (sameOrigin && url.pathname === '/rest/v1/users' && url.searchParams.get('select') === 'partner_id') {
      partnerLookups.push(`${request.method()} ${url.pathname}${url.search}`);
    }
    if (writesOnly && request.method() === 'GET') return;
    if (sameOrigin && SUPABASE_PATHS.some((path) => url.pathname.startsWith(path))) {
      seen.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  };
  page.on('request', listener);
  return {
    requests: seen,
    partnerLookups,
    stop: () => page.off('request', listener),
  };
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching photos-offline.spec.ts.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

async function pairPhotoIds(supabaseAdmin: TypedSupabaseClient): Promise<string[]> {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  const { data, error } = await supabaseAdmin
    .from('photos')
    .select('id')
    .in('user_id', [userId, partnerId]);
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.id).sort();
}

test.describe('Photos offline', () => {
  test('upload is refused before anything is sent', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const before = await pairPhotoIds(supabaseAdmin);

    try {
      const listRead = interceptNetworkCall({ method: 'GET', url: PHOTOS_LIST_READ });
      await page.goto('/photos');
      expect((await listRead).status).toBe(200);
      // The loading skeleton also carries `photo-gallery`; only these two are loaded.
      await expect(
        page.getByTestId('photo-gallery-grid').or(page.getByTestId('photo-gallery-empty-state'))
      ).toBeVisible();
      await page
        .getByTestId('photo-gallery-upload-fab')
        .or(page.getByTestId('photo-gallery-empty-upload-button'))
        .click();
      await page.getByTestId('photo-upload-file-input').setInputFiles(PNG_FILE);
      const upload = page.getByTestId('photo-upload-submit-button');
      await expect(upload).toBeEnabled();

      await goOffline(page, true);
      // Writes only: Photos has background reads (see the header).
      const watch = watchSupabaseRequests(page, { writesOnly: true });
      await upload.click();

      await expect(page.getByTestId('photo-upload-error')).toHaveText(
        offline('Photos need a connection to upload.')
      );
      watch.stop();
      expect(watch.requests).toEqual([]);
      expect(watch.partnerLookups).toEqual([]);
      expect(await pairPhotoIds(supabaseAdmin)).toEqual(before);
    } finally {
      await page.context().setOffline(false);
    }
  });

  test('delete is refused and the confirmation stays open', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const stamp = Date.now();
    const path = `${userId}/e2e-needs-connection-${stamp}.png`;
    const caption = `E2E needs-connection ${stamp}`;
    let photoId: string | null = null;

    try {
      const uploaded = await supabaseAdmin.storage
        .from('photos')
        .upload(path, PNG_BYTES, { contentType: 'image/png', upsert: true });
      expect(uploaded.error).toBeNull();
      const { data, error } = await supabaseAdmin
        .from('photos')
        .insert({
          user_id: userId,
          storage_path: path,
          filename: 'offline.png',
          caption,
          mime_type: 'image/png',
          file_size: PNG_BYTES.length,
          width: 2,
          height: 2,
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      photoId = data!.id;

      const listRead = interceptNetworkCall({ method: 'GET', url: PHOTOS_LIST_READ });
      await page.goto('/photos');
      const list = await listRead;
      expect(list.status).toBe(200);
      expect(list.responseJson).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: photoId })])
      );
      await expect(page.getByTestId('photo-gallery-grid')).toBeVisible();
      await page
        .getByTestId('photo-gallery-grid')
        .getByRole('button', { name: caption, exact: true })
        .click();
      const viewer = page.getByTestId('photo-viewer-overlay');
      await expect(viewer).toBeVisible();
      await viewer.getByLabel('Delete photo').click();
      const dialog = page.getByRole('dialog', { name: 'Delete Photo?' });
      await expect(dialog).toBeVisible();

      await goOffline(page, true);
      // Writes only: Photos has background reads (see the header).
      const watch = watchSupabaseRequests(page, { writesOnly: true });
      await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

      await expect(page.getByTestId('photo-viewer-delete-error')).toHaveText(
        offline('Photos need a connection to delete.')
      );
      watch.stop();
      expect(watch.requests).toEqual([]);
      expect(watch.partnerLookups).toEqual([]);
      await expect(dialog).toBeVisible();
      await expect(viewer.getByRole('img', { name: caption })).toBeVisible();
      const still = await supabaseAdmin.from('photos').select('id').eq('id', photoId);
      expect(still.data?.map((row) => row.id)).toEqual([photoId]);
    } finally {
      await page.context().setOffline(false);
      if (photoId) {
        const rows = await supabaseAdmin.from('photos').delete().eq('id', photoId);
        expect.soft(rows.error).toBeNull();
      }
      const objects = await supabaseAdmin.storage.from('photos').remove([path]);
      expect.soft(objects.error).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Display name
// ---------------------------------------------------------------------------

test.describe('Display name offline', () => {
  test('a name change is refused inline and the profile row is unchanged', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const readName = async () => {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('display_name')
        .eq('id', userId)
        .single();
      expect(error).toBeNull();
      return data?.display_name ?? null;
    };
    const original = await readName();
    expect(original, "premise: this worker's pool account has a name").toBeTruthy();

    try {
      await page.goto('/');
      // Settings' mount reads the name; the app's own gate read of the same
      // URL may answer first, with the same name.
      const nameRead = interceptNetworkCall({ method: 'GET', url: gateNameRead(userId) });
      await navigateTo(page, 'settings');
      expect((await nameRead).status).toBe(200);
      const nameRow = page.getByTestId('settings-display-name');
      await expect(nameRow).toBeVisible();
      // The saved name is the only text a finished read can show.
      await expect(nameRow).toHaveText(original!.trim());
      await page.getByTestId('settings-display-name-edit').click();
      await expect(page.getByTestId('display-name-setup')).toBeVisible();
      await page.getByLabel('Display Name').fill(`E2E ${Date.now().toString().slice(-8)}`);

      await goOffline(page, true);
      const watch = watchSupabaseRequests(page);
      await page.getByTestId('display-name-submit').click();

      await expect(page.getByTestId('display-name-error')).toHaveText(
        offline('Name changes need a connection to save.')
      );
      watch.stop();
      expect(watch.requests).toEqual([]);
      await expect(page.getByTestId('display-name-setup')).toBeVisible();
      expect(await readName()).toBe(original);
    } finally {
      await page.context().setOffline(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Partner requests (faked: the pool holds only linked pairs)
// ---------------------------------------------------------------------------

const FAKE_SENDER = '00000000-0000-4000-8000-0000000011a1';
const FAKE_TARGET = '00000000-0000-4000-8000-0000000011a2';
const FAKE_REQUEST = '00000000-0000-4000-8000-0000000011a3';

/** Rows of `partner_requests` involving this worker's user. */
async function ownRequestIds(supabaseAdmin: TypedSupabaseClient, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('partner_requests')
    .select('id')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.id).sort();
}

test.describe('Partner requests offline', () => {
  test('send, accept and decline are each refused before any request', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const requestsBefore = await ownRequestIds(supabaseAdmin, userId);

    // This browser only: an unlinked user with one pending incoming request.
    // The pool user stays linked in the database throughout.
    // playwright-utils deviation: the route must be installed before the next navigation and answer every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/users?select=partner_id*', (route) =>
      route.fulfill({ json: { partner_id: null, updated_at: '2026-01-01T00:00:00Z' } })
    );
    // playwright-utils deviation: the route must be installed before the next navigation, answer every read and abort every write; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/partner_requests**', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            json: [
              {
                id: FAKE_REQUEST,
                from_user_id: FAKE_SENDER,
                to_user_id: userId,
                status: 'pending',
                created_at: '2026-09-01T00:00:00Z',
                updated_at: '2026-09-01T00:00:00Z',
              },
            ],
          })
        : // A write here would be a regressed guard: never let it land.
          route.abort()
    );
    // The sender lookup behind the request list (`id=in.(…)`) and the search
    // results (`or=…`) share one select.
    // playwright-utils deviation: matches either of two query shapes with a URL predicate, which one method + URL glob cannot express, and must be installed before the next navigation; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route(
      (url) =>
        url.pathname === '/rest/v1/users' &&
        (url.searchParams.get('select') ?? '').replace(/\s/g, '') === 'id,email,display_name' &&
        (url.searchParams.has('or') || (url.searchParams.get('id') ?? '').startsWith('in.')),
      (route) => {
        const url = new URL(route.request().url());
        return route.fulfill({
          json: url.searchParams.has('or')
            ? [{ id: FAKE_TARGET, email: 'target@example.test', display_name: 'Offline Target' }]
            : [{ id: FAKE_SENDER, email: 'sender@example.test', display_name: 'Offline Sender' }],
        });
      }
    );
    // playwright-utils deviation: the route must be installed before the next navigation and abort every accept and decline call; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route(/\/rest\/v1\/rpc\/(accept|decline)_partner_request/, (route) => route.abort());

    try {
      await page.goto('/partner');
      await expect(page.getByTestId('partner-search-input')).toBeVisible();
      await expect(page.getByTestId(`accept-request-${FAKE_REQUEST}`)).toBeVisible();
      await page.getByTestId('partner-search-input').fill('offline');
      const send = page.getByTestId(`send-request-${FAKE_TARGET}`);
      await expect(send).toBeVisible();

      await goOffline(page, true);
      const error = page.getByTestId('partner-connection-error');

      for (const [control, verb] of [
        [send, 'send'],
        [page.getByTestId(`accept-request-${FAKE_REQUEST}`), 'accept'],
        [page.getByTestId(`decline-request-${FAKE_REQUEST}`), 'decline'],
      ] as const) {
        // Writes only: Partner has background reads (see the header).
        const watch = watchSupabaseRequests(page, { writesOnly: true });
        await control.click();
        await expect(error).toHaveText(offline(`Partner requests need a connection to ${verb}.`));
        watch.stop();
        expect(watch.requests, `${verb} sent a request`).toEqual([]);
      }

      // Nothing on screen changed: the result and the request are both still there.
      await expect(send).toBeVisible();
      await expect(page.getByTestId(`accept-request-${FAKE_REQUEST}`)).toBeVisible();
      expect(await ownRequestIds(supabaseAdmin, userId)).toEqual(requestsBefore);
    } finally {
      await page.context().setOffline(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Poke / kiss badge
// ---------------------------------------------------------------------------

test.describe('Poke and kiss badge offline', () => {
  for (const [type, subject] of [
    ['poke', 'A poke'],
    ['kiss', 'A kiss'],
  ] as const) {
    test(`a ${type} plays but is not marked seen, and the badge stays`, async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
    }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      let interactionId: string | null = null;

      try {
        const { data, error } = await supabaseAdmin
          .from('interactions')
          .insert(createInteractionInsert({ type, from_user_id: partnerId, to_user_id: userId }))
          .select('id')
          .single();
        expect(error).toBeNull();
        interactionId = data!.id;

        const historyRead = interceptNetworkCall({ method: 'GET', url: INTERACTIONS_READ });
        await page.goto('/partner');
        const history = await historyRead;
        expect(history.status).toBe(200);
        expect(history.responseJson).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: interactionId, viewed: false })])
        );
        const badge = page.getByTestId('notification-badge');
        await expect(badge).toBeVisible();

        await goOffline(page, true);
        // Writes only: the Partner screen's pending-request read can still go out.
        const watch = watchSupabaseRequests(page, { writesOnly: true });
        await badge.click();
        // The animation still plays offline; ending it asks to mark it seen.
        const animation = page.getByTestId(`${type}-animation`);
        await expect(animation).toBeVisible();
        await animation.click();

        await expect(page.getByTestId('toast-notification')).toHaveText(
          offline(`${subject} needs a connection to be marked as seen.`)
        );
        watch.stop();
        expect(watch.requests).toEqual([]);
        await expect(badge).toBeVisible();
        const row = await supabaseAdmin
          .from('interactions')
          .select('viewed')
          .eq('id', interactionId)
          .single();
        expect(row.data?.viewed).toBe(false);
      } finally {
        await page.context().setOffline(false);
        if (interactionId) {
          const { error } = await supabaseAdmin.from('interactions').delete().eq('id', interactionId);
          expect.soft(error).toBeNull();
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Love notes
// ---------------------------------------------------------------------------

const UPLOAD_FUNCTION = '**/functions/v1/upload-love-note-image';

function noteBubble(page: Page, content: string) {
  return page.getByTestId('love-note-message').filter({ hasText: content });
}

/** The page banner's alert, which holds `notesError`. */
function notesBanner(page: Page, text: string) {
  return page.getByRole('alert').filter({ hasText: text });
}

/**
 * Open Notes once the partner record and the thread have both been read, and
 * return the thread read so a caller can check a seeded note is in it.
 */
async function openNotesWithPartner(
  page: Page,
  supabaseAdmin: TypedSupabaseClient,
  interceptNetworkCall: InterceptNetworkCallFn
) {
  const { partnerId } = await resolveOwnPair(supabaseAdmin);
  const partnerRead = interceptNetworkCall({ method: 'GET', url: partnerRecordRead(partnerId) });
  const threadRead = interceptNetworkCall({ method: 'GET', url: LOVE_NOTES_READ });
  await page.goto('/notes');
  const [partner, thread] = await Promise.all([partnerRead, threadRead]);
  expect(partner.status).toBe(200);
  expect(thread.status).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: /love notes/i })).toBeVisible();
  await recurseUntil(
    () => page.evaluate(() => window.__APP_STORE__?.getState().partner?.id ?? null),
    (v) => {
      expect(v).toBe(partnerId);
    }
  );
  return thread;
}

async function attachPicture(page: Page) {
  await page.locator('input[type="file"][accept*="image/"]').setInputFiles(PNG_FILE);
  await expect(page.getByAltText('Selected image preview')).toBeVisible();
}

/** This worker's notes carrying `stamp`, from either side. */
async function stampedNoteIds(supabaseAdmin: TypedSupabaseClient, stamp: string) {
  const { data, error } = await supabaseAdmin
    .from('love_notes')
    .select('id')
    .like('content', `%${stamp}%`);
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.id);
}

test.describe('Love notes offline', () => {
  test('a picture note is refused with one message, and the composer keeps text and picture', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const text = `E2E-PIC-OFFLINE-${Date.now()}`;
    try {
      await openNotesWithPartner(page, supabaseAdmin, interceptNetworkCall);
      await goOffline(page, true);
      await attachPicture(page);
      const input = page.getByLabel('Love note message input');
      await input.fill(text);

      // Writes only: Love Notes has background reads (see the header).
      const watch = watchSupabaseRequests(page, { writesOnly: true });
      await page.getByLabel('Send message', { exact: true }).click();

      await expect(
        notesBanner(page, offline('Notes with a picture need a connection to send.'))
      ).toBeVisible();
      watch.stop();
      expect(watch.requests).toEqual([]);
      expect(watch.partnerLookups).toEqual([]);
      await expect(page.getByText('Failed to send. Try again.')).toHaveCount(0);
      await expect(input).toHaveValue(text);
      await expect(page.getByAltText('Selected image preview')).toBeVisible();
      await expect(noteBubble(page, text)).toHaveCount(0);
      expect(await stampedNoteIds(supabaseAdmin, text)).toEqual([]);
    } finally {
      await page.context().setOffline(false);
    }
  });

  test('Retry on a failed picture note is refused, and the note stays failed', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const text = `E2E-PIC-RETRY-${Date.now()}`;
    try {
      await openNotesWithPartner(page, supabaseAdmin, interceptNetworkCall);

      // GIVEN: a picture note that failed online — its upload never arrives.
      // playwright-utils deviation: the route must be installed before the send that calls the function and abort every upload attempt; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
      await page.route(UPLOAD_FUNCTION, (route) => route.abort());
      await attachPicture(page);
      await page.getByLabel('Love note message input').fill(text);
      await page.getByLabel('Send message', { exact: true }).click();
      const retry = noteBubble(page, text).getByLabel('Retry sending message');
      await expect(retry).toBeVisible();

      // WHEN: Retry is tapped offline.
      await goOffline(page, true);
      // Writes only: Love Notes has background reads (see the header).
      const watch = watchSupabaseRequests(page, { writesOnly: true });
      await retry.click();

      // THEN: the reason shows once, nothing is sent, and the note stays failed.
      await expect(
        notesBanner(page, offline('Notes with a picture need a connection to send.'))
      ).toBeVisible();
      watch.stop();
      expect(watch.requests).toEqual([]);
      expect(watch.partnerLookups).toEqual([]);
      await expect(retry).toBeVisible();
      expect(await stampedNoteIds(supabaseAdmin, text)).toEqual([]);
    } finally {
      await page.context().setOffline(false);
      await page.unroute(UPLOAD_FUNCTION);
    }
  });

  test('removing a note is refused in the dialog, and the note never leaves the list', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const content = `E2E-REMOVE-OFFLINE-${Date.now()}`;
    let noteId: string | null = null;

    try {
      const { data, error } = await supabaseAdmin
        .from('love_notes')
        .insert({ from_user_id: partnerId, to_user_id: userId, content, image_url: null })
        .select('id')
        .single();
      expect(error).toBeNull();
      noteId = data!.id;

      const thread = await openNotesWithPartner(page, supabaseAdmin, interceptNetworkCall);
      expect(thread.responseJson).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: noteId })])
      );
      const bubble = noteBubble(page, content);
      await expect(bubble).toBeVisible();

      await goOffline(page, true);
      await bubble.getByTestId('note-remove-button').click();
      const dialog = page.getByTestId('note-remove-confirmation');
      await expect(dialog).toBeVisible();

      // Writes only: Love Notes has background reads (see the header).
      const watch = watchSupabaseRequests(page, { writesOnly: true });
      await page.getByTestId('note-remove-confirm').click();

      await expect(dialog.getByRole('alert')).toHaveText(
        offline('Love notes need a connection to remove.')
      );
      watch.stop();
      expect(watch.requests).toEqual([]);
      expect(watch.partnerLookups).toEqual([]);
      await expect(dialog).toBeVisible();
      expect(
        await page.evaluate(
          (id) => window.__APP_STORE__?.getState().notes.some((note) => note.id === id) ?? false,
          noteId
        )
      ).toBe(true);
      const removals = await supabaseAdmin
        .from('love_note_removals')
        .select('note_id')
        .eq('note_id', noteId);
      expect(removals.error).toBeNull();
      expect(removals.data).toEqual([]);
    } finally {
      await page.context().setOffline(false);
      if (noteId) {
        const { error } = await supabaseAdmin.from('love_notes').delete().eq('id', noteId);
        expect.soft(error).toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Custom messages editor
// ---------------------------------------------------------------------------

test.describe('Custom messages editor offline', () => {
  test('shows the offline indicator, and create, edit, delete and import are refused', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const stamp = `E2E-CUSTOM-OFFLINE-${Date.now()}`;
    const saved = `${stamp} saved`;
    const refusal = offline('Custom messages need a connection to save.');
    const stampedTexts = async () => {
      const { data, error } = await supabaseAdmin
        .from('custom_messages')
        .select('text')
        .eq('user_id', userId)
        .like('text', `${stamp}%`);
      expect(error).toBeNull();
      return (data ?? []).map((row) => row.text).sort();
    };

    try {
      // GIVEN: one saved message, created online.
      await page.goto('/admin');
      await page.getByTestId('admin-create-button').click();
      await page.getByTestId('admin-create-form-text').fill(saved);
      const created = interceptNetworkCall({ method: 'POST', url: CUSTOM_MESSAGE_SAVE });
      await page.getByTestId('admin-create-form-save').click();
      expect((await created).status).toBe(201);
      const row = page.getByTestId('admin-message-row').filter({ hasText: saved });
      await expect(row).toBeVisible();
      await expect(page.getByTestId('network-status-indicator')).toHaveCount(0);

      // WHEN: the device goes offline, the editor says so.
      await goOffline(page, true);
      await expect(page.getByTestId('network-status-indicator')).toHaveAttribute(
        'data-status',
        'offline'
      );
      const watch = watchSupabaseRequests(page);

      // Create: the form error, and the typed text stays.
      await page.getByTestId('admin-create-button').click();
      await page.getByTestId('admin-create-form-text').fill(`${stamp} new`);
      await page.getByTestId('admin-create-form-save').click();
      await expect(page.getByTestId('admin-create-form-error')).toHaveText(refusal);
      await expect(page.getByTestId('admin-create-form-text')).toHaveValue(`${stamp} new`);
      await page.getByTestId('admin-create-form-cancel').click();

      // Edit: the form error.
      await row.getByTestId('message-row-edit-button').click();
      await page.getByTestId('admin-edit-form-text').fill(`${stamp} edited`);
      await page.getByTestId('admin-edit-form-save').click();
      await expect(page.getByTestId('admin-edit-form-error')).toHaveText(refusal);
      await page.getByTestId('admin-edit-form-cancel').click();

      // Delete: the dialog error.
      await row.getByTestId('message-row-delete-button').click();
      const dialog = page.getByTestId('admin-delete-dialog');
      await page.getByTestId('admin-delete-dialog-confirm').click();
      await expect(dialog.getByRole('alert')).toHaveText(refusal);
      await page.getByTestId('admin-delete-dialog-cancel').click();

      // Import: the alert names the connection, not the file.
      const alertShown = page.waitForEvent('dialog');
      await page.getByTestId('import-file-input').setInputFiles({
        name: 'messages.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            version: '1.0',
            exportDate: new Date().toISOString(),
            messageCount: 1,
            messages: [
              {
                text: `${stamp} imported`,
                category: 'custom',
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          })
        ),
      });
      const alert = await alertShown;
      expect(alert.message()).toBe(refusal);
      await alert.accept();

      // THEN: nothing went out, and only the saved message exists, unchanged.
      watch.stop();
      expect(watch.requests).toEqual([]);
      await expect(page.getByTestId('admin-message-row').filter({ hasText: stamp })).toHaveCount(1);
      await expect(row).toBeVisible();
      expect(await stampedTexts()).toEqual([saved]);
    } finally {
      await page.context().setOffline(false);
      const { error } = await supabaseAdmin
        .from('custom_messages')
        .delete()
        .eq('user_id', userId)
        .like('text', `${stamp}%`);
      expect.soft(error).toBeNull();
    }
  });
});
