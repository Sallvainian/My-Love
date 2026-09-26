/**
 * DW-123: browser-level proof that a mood reaches the partner live, over the
 * private `mood-updates:<uuid>` topic, driven by the app's own Realtime clients.
 *
 * The sibling of `tests/e2e/notes/love-notes-realtime.spec.ts`, which DW-90
 * produced for love notes and which this follows in shape. DW-90 was closed for
 * notes only; `src/api/moodSyncService.ts:267` runs the same composition --
 * private topic, `sendEphemeralBroadcast`, store, UI -- under the same policy
 * migration `20260912010000_private_couple_broadcast_policies.sql`, whose two
 * predicates each cover both topic prefixes. So the mood half of that
 * composition shipped with no browser-level coverage at all.
 *
 * `tests/api/couple-broadcast-authorization.spec.ts` already measures the mood
 * topic at the protocol level, with hand-built `createClient` identities, and
 * the unit tests measure the service. Neither runs what actually ships:
 * `MoodTracker` -> `moodSlice.addMoodEntry` -> `syncPendingMoods` ->
 * `broadcastMoodToPartner` -> the partner's `subscribeMoodUpdates` ->
 * `PartnerMoodView`. This spec is the only place where all of it runs in a
 * browser against the real policies.
 *
 * Why two contexts: a broadcast reaches whoever is joined at the moment it is
 * sent, and `broadcast: { self: false }` means the sender never receives its
 * own. The receiver has to be a second, separately authenticated browser.
 *
 * Why the console is the join signal: a broadcast has no replay, so a send made
 * before the receiver has joined is simply lost and this would flake rather
 * than fail. `PartnerMoodView.tsx:206` reports the status through
 * `logger.info`, which is unconditional (`src/utils/logger.ts:10-12`), so the
 * join is a real signal already present in the shipped code -- no app change,
 * and no sleep. Deliberately NOT the service-level line at
 * `moodSyncService.ts:691`: that one is `logger.debug`, which is stripped
 * outside development.
 *
 * Identities are this worker's own pooled pair, linked once by
 * `tests/support/auth/global-setup.ts:171`. Nothing here links, unlinks or
 * resets an account, and teardown deletes only the row carrying this test's own
 * uuid.
 */
import { randomUUID } from 'node:crypto';
import type { Page, Request } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import { closeContext } from '../../support/fixtures/cleanup';
import { resolveOwnPair } from '../../support/helpers/events';
import { partnerMoodListRead } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';

/**
 * The receiving page's own view reporting its join.
 *
 * Matches `logger.info('[PartnerMoodView] Realtime status changed:', status)` —
 * Playwright joins a console call's arguments with spaces, so the tag and the
 * status land in one `msg.text()`. Deliberately loose between the two: the
 * wording in the middle is the component's, not this test's premise.
 */
const SUBSCRIBED_LOG = /\[PartnerMoodView\].*SUBSCRIBED/;

/**
 * The broadcast REST endpoint's path prefix.
 *
 * Never matched on its own: `love-notes:` and `mood-updates:` sends share it,
 * so a love note landing mid-test would otherwise resolve the wait and hand the
 * 202 assertion an unrelated request. The full expected path below pins the
 * topic and the event as well.
 */
const BROADCAST_PATH = '/realtime/v1/api/broadcast/';

test.describe('Partner mood realtime delivery', () => {
  // Every wait below is bounded on its own so that the wait which fails is the
  // one the report names. Their sequential worst case runs well past
  // `playwright.config.ts:119`'s 60s default, which would otherwise expire
  // first and replace the real failure with a generic test-timeout message.
  test.describe.configure({ timeout: 180_000 });

  test(
    '[P1] DW-123-E2E-001 delivers a logged mood to the partner over the private couple topic',
    async ({
      page,
      browser,
      baseURL,
      supabaseAdmin,
      authOptions,
      partnerUserIdentifier,
      partnerAuthToken,
      cleanup,
    }) => {
      // Depended on for its side effect: `partnerAuthToken` is what calls
      // `provider.manageAuthToken` for `worker-N-partner`, which writes that
      // identity's storage-state file to the path read below. Kept as an
      // explicit, checked precondition rather than a destructured name a later
      // edit could drop as unused.
      expect(partnerAuthToken).not.toBe('');

      // The uuid rides the note, which is the only free-text field a mood has.
      // It is the whole teardown filter and the whole delivery assertion: no
      // other row can carry it, on any worker, from any run.
      const moodNote = `DW-123 realtime mood ${randomUUID()}`;
      // Resolved once, up front, from `TEST_WORKER_INDEX` — the same pair the
      // two contexts below sign in as.
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      // The sender's own display name, read before the send: the toast names
      // the partner from it (CAP-10), never from a hard-coded name, and it
      // auto-hides five seconds after arrival.
      const { data: senderRow, error: senderError } = await supabaseAdmin
        .from('users')
        .select('display_name')
        .eq('id', userId)
        .single();
      expect(senderError).toBeNull();
      const senderName = senderRow?.display_name?.trim() ?? '';
      expect(senderName, 'The sender needs a display name for the toast to show').not.toBe('');
      // The exact path this send must take. The sender addresses its PARTNER's
      // topic (`moodSyncService.ts:267`) while the receiver joins its OWN
      // (`:605`) — the same value seen from the two ends of the pair.
      const expectedBroadcastPath = `${BROADCAST_PATH}${encodeURIComponent(
        `mood-updates:${partnerId}`
      )}/events/new_mood`;
      // Whether a `moods` row exists for teardown to find. Raised once the
      // broadcast has been observed, which only happens after the sync wrote
      // the row. Without it, a failure before the send would add a misleading
      // second failure from the row check below.
      let moodRowCommitted = false;
      cleanup.defer('delete the mood row this test created', async () => {
        // The sender's page first: its mood sync could otherwise write the row
        // after the delete. Its context, not just the page, so a failure's
        // page snapshot is the sender's (see `closeContext`).
        await page.context().close();

        // Keyed on this test's own uuid AND on this worker's own pair, so a
        // mis-resolved identity deletes nothing rather than another worker's
        // rows. Partner linkage, passwords and every other shared row are
        // untouched.
        const { data: deleted, error } = await supabaseAdmin
          .from('moods')
          .delete()
          .eq('note', moodNote)
          .in('user_id', [userId, partnerId])
          .select('id');
        if (error) throw error;

        // Exactly one, and guarded by `moodRowCommitted` so a failure before
        // the send cannot add a false teardown failure on top of the real one.
        //
        // Worth saying why one is right, because the schema suggests otherwise:
        // `moods` is unique on `(user_id, created_at)`
        // (`20260726000000_moods_unique_user_created_at.sql:72`) and
        // `moodSlice.ts:71` writes through `saveForDate`, which reads as "a
        // second run the same day updates the existing row". It does not, on
        // this path. `saveForDate` looks for that row through IndexedDB's
        // `by-user-date` index, and a Playwright context starts with an empty
        // IndexedDB -- storage state carries cookies and localStorage only. So
        // no local row is found, the sync takes `moodApi.create`, and that
        // upserts on a `created_at` stamped per save at millisecond precision.
        // Every run inserts its own row, and this deletes exactly that one.
        if (moodRowCommitted) {
          expect
            .soft(deleted ?? [], 'Teardown must not match rows outside this pair')
            .toHaveLength(1);
        }
      });

      await log.step('Park the partner on /partner until its own view reports SUBSCRIBED');
      const partnerContext = await browser.newContext({
        storageState: getStorageStatePath({
          ...authOptions,
          userIdentifier: partnerUserIdentifier,
        }),
        // Explicit: the storage state is scoped to this origin, and a context
        // built without it resolves relative gotos against nothing.
        baseURL,
      });
      cleanup.defer('close the partner context', () => closeContext(partnerContext));
      const partnerPage: Page = await partnerContext.newPage();

      // The receiver's reads of the sender's moods, tracked from before its
      // goto: the view's mount read and the start refresh both send one, and
      // a read still in flight at the send could land the mood without the
      // broadcast. The receiver's partner is this test's sender.
      const senderMoodsRead = partnerMoodListRead(userId);
      const isSenderMoodsRead = (request: Request) => {
        if (request.method() !== 'GET') return false;
        const url = new URL(request.url());
        return (
          url.pathname.endsWith('/rest/v1/moods') &&
          url.searchParams.get('user_id') === `eq.${userId}`
        );
      };
      let senderMoodReadsInFlight = 0;
      partnerPage.on('request', (request) => {
        if (isSenderMoodsRead(request)) senderMoodReadsInFlight += 1;
      });
      const settleSenderMoodsRead = (request: Request) => {
        if (isSenderMoodsRead(request)) senderMoodReadsInFlight -= 1;
      };
      partnerPage.on('requestfinished', settleSenderMoodsRead);
      partnerPage.on('requestfailed', settleSenderMoodsRead);
      // A page in a second context: the fixture is bound to `page`.
      const moodListRead = interceptNetworkCall({
        page: partnerPage,
        method: 'GET',
        url: senderMoodsRead,
        timeout: 30_000,
      });

      // Registered BEFORE the navigation that causes the log. Registering it
      // after would race the join and could miss it entirely, which would read
      // as "the partner never subscribed" on a perfectly healthy run.
      const subscribed = partnerPage.waitForEvent('console', {
        predicate: (message) => SUBSCRIBED_LOG.test(message.text()),
        timeout: 30_000,
      });
      await partnerPage.goto('/partner');
      try {
        await subscribed;
      } catch (cause) {
        throw new Error(
          "The partner page's PartnerMoodView never reported SUBSCRIBED within 30s of " +
            'landing on /partner, so the receiver was never joined and no send could be measured.',
          { cause }
        );
      }
      expect((await moodListRead).status).toBe(200);

      // This page is not touched again until the assertions: no reload, no
      // second goto, no manual refresh. Its refresh button
      // (`PartnerMoodView.tsx:579`) is deliberately never clicked, so anything
      // that appears from here on can only have arrived over the broadcast.

      await log.step('Log a mood with a unique note from the sender, through the real UI');
      await page.goto('/mood');
      await expect(page.getByTestId('mood-tracker')).toBeVisible();
      await page.getByRole('button', { name: /happy/i }).click();
      // The note field is collapsed by default (`MoodTracker.tsx:549-557`),
      // so the toggle has to be opened before the marker can be typed.
      await page.getByTestId('mood-add-note-toggle').click();
      await page.getByTestId('mood-note-input').fill(moodNote);

      // The standalone form: the fixture drops `timeout`.
      const broadcast = interceptNetworkCall({
        page,
        method: 'POST',
        url: `**${expectedBroadcastPath}?*`,
        // Bounds only the wait for the POST to be sent: the utility then awaits
        // `request.response()` with no bound of its own. A send the app aborts
        // at `BROADCAST_TIMEOUT_MS` (15s, `src/api/ephemeralBroadcast.ts:77`)
        // therefore fails here as "No response received for the request", and
        // only a send that never starts runs into these 30s.
        timeout: 30_000,
      });
      // Checked here, after the whole sender setup, so the receiver's start-up
      // reads — including the one its mood sync sends only once its own sync
      // has finished — have had that time to start and settle.
      await recurseUntil(
        async () => senderMoodReadsInFlight,
        (v) => {
          expect(v, "none of the receiver's reads of the sender's moods is in flight").toBe(0);
        }
      );
      await expect(partnerPage.getByTestId('partner-mood-refresh-button')).toHaveAttribute(
        'aria-busy',
        'false'
      );
      await page.getByTestId('mood-submit-button').click();

      await log.step('The private INSERT policy admits the app own client send');
      const { status: broadcastStatus, request: broadcastRequest } = await broadcast;
      moodRowCommitted = true;
      // Asserted before the UI: the broadcast is fire-and-forget and
      // `moodSyncService.ts:232` swallows its rejection, so checking the
      // partner's screen first would report a refused send as a missing
      // element and point at the wrong layer.
      expect(broadcastStatus).toBe(202);
      const broadcastUrl = broadcastRequest!.url();
      expect(broadcastUrl).toContain(expectedBroadcastPath);
      expect(new URL(broadcastUrl).searchParams.get('private')).toBe('true');

      await log.step('The mood reaches the partner live, with no reload and no refresh');
      // The toast first, while it is still on screen: it auto-hides five
      // seconds after arrival (`PartnerMoodView.tsx:194-196`), and it is the
      // immediate live signal rather than anything a refetch could produce.
      await expect(partnerPage.getByTestId('partner-mood-notification')).toContainText(moodNote);
      await expect(partnerPage.getByTestId('partner-mood-notification')).toContainText(
        `${senderName} just logged a mood`
      );

      // Then the durable half. The broadcast handler also refetches
      // (`PartnerMoodView.tsx:200`), so the mood has to survive into the
      // rendered list rather than only flashing past in a toast.
      await expect(
        partnerPage.getByTestId('partner-mood-card').filter({ hasText: moodNote })
      ).toBeVisible();
    }
  );
});
