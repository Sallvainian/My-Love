/**
 * DW-123: browser-level proof that a mood reaches the partner live, over the
 * private `mood-updates:<uuid>` topic, driven by the app's own Realtime clients.
 *
 * The sibling of `tests/e2e/notes/love-notes-realtime.spec.ts`, which DW-90
 * produced for love notes and which this follows in shape. DW-90 was closed for
 * notes only; `src/api/moodSyncService.ts:257` runs the same composition --
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
 * `moodSyncService.ts:681`: that one is `logger.debug`, which is stripped
 * outside development.
 *
 * Identities are this worker's own pooled pair, linked once by
 * `tests/support/auth/global-setup.ts:151`. Nothing here links, unlinks or
 * resets an account, and teardown deletes only the row carrying this test's own
 * uuid.
 */
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';

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
      // The exact path this send must take. The sender addresses its PARTNER's
      // topic (`moodSyncService.ts:257`) while the receiver joins its OWN
      // (`:595`) — the same value seen from the two ends of the pair.
      const expectedBroadcastPath = `${BROADCAST_PATH}${encodeURIComponent(
        `mood-updates:${partnerId}`
      )}/events/new_mood`;
      let partnerContext: BrowserContext | undefined;
      // Whether a `moods` row exists for teardown to find. Raised once the
      // broadcast has been observed, which only happens after the sync wrote
      // the row. Without it, a failure before the send would add a misleading
      // second failure from the row check below.
      let moodRowCommitted = false;

      try {
        await log.step('Park the partner on /partner until its own view reports SUBSCRIBED');
        partnerContext = await browser.newContext({
          storageState: getStorageStatePath({
            ...authOptions,
            userIdentifier: partnerUserIdentifier,
          }),
          // Explicit: the storage state is scoped to this origin, and a context
          // built without it resolves relative gotos against nothing.
          baseURL,
        });
        const partnerPage: Page = await partnerContext.newPage();

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
        await partnerPage.waitForLoadState('networkidle');

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

        const broadcast = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(expectedBroadcastPath),
          // Explicit, and deliberately NOT the 15s `actionTimeout` this would
          // otherwise inherit: that is exactly `BROADCAST_TIMEOUT_MS`
          // (`src/api/ephemeralBroadcast.ts:77`), so a slow send would expire
          // both bounds in the same instant and the report would not say which.
          { timeout: 30_000 }
        );
        await page.getByTestId('mood-submit-button').click();

        await log.step('The private INSERT policy admits the app own client send');
        const broadcastResponse = await broadcast;
        moodRowCommitted = true;
        // Asserted before the UI: the broadcast is fire-and-forget and
        // `moodSyncService.ts:222` swallows its rejection, so checking the
        // partner's screen first would report a refused send as a missing
        // element and point at the wrong layer.
        expect(broadcastResponse.status()).toBe(202);
        expect(broadcastResponse.url()).toContain(expectedBroadcastPath);
        expect(new URL(broadcastResponse.url()).searchParams.get('private')).toBe('true');

        await log.step('The mood reaches the partner live, with no reload and no refresh');
        // The toast first, while it is still on screen: it auto-hides five
        // seconds after arrival (`PartnerMoodView.tsx:194-196`), and it is the
        // immediate live signal rather than anything a refetch could produce.
        await expect(partnerPage.getByTestId('partner-mood-notification')).toContainText(moodNote);

        // Then the durable half. The broadcast handler also refetches
        // (`PartnerMoodView.tsx:200`), so the mood has to survive into the
        // rendered list rather than only flashing past in a toast.
        await expect(
          partnerPage.getByTestId('partner-mood-card').filter({ hasText: moodNote })
        ).toBeVisible();
      } finally {
        // Same idiom as `together-mode.ts:165`: a close that rejects must not
        // become the failure the report shows instead of the real one.
        await partnerContext?.close().catch(() => {});

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

        // Soft, and deliberately so. A hard assertion here throws out of a
        // `finally` and replaces whatever the test was already failing on — the
        // one failure worth reading — with a teardown message.
        expect.soft(error, 'Teardown must delete the mood row this test created').toBeNull();

        // At most one row, never exactly one. Unlike `love_notes`, `moods` is
        // unique on `(user_id, created_at)`
        // (`20260726000000_moods_unique_user_created_at.sql:72`) and
        // `moodSlice.ts:70` writes through `saveForDate`, so a second run on the
        // same day UPDATES the existing row rather than inserting beside it.
        // The marker still identifies it, but the count that proves a
        // mis-resolved identity in the notes spec cannot transfer: the row it
        // would be counting may predate this test.
        if (moodRowCommitted) {
          expect
            .soft(deleted ?? [], 'Teardown must not match rows outside this pair')
            .toHaveLength(1);
        }
      }
    }
  );
});
