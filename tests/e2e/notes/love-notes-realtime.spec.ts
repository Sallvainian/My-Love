/**
 * DW-90: browser-level proof that a love note reaches the partner live, over the
 * private `love-notes:<uuid>` topic, driven by the app's own Realtime clients.
 *
 * `tests/api/couple-broadcast-authorization.spec.ts` measures the policies with
 * hand-built `createClient` identities; the mocked unit tests measure the hook.
 * Neither runs the composition that actually ships — `useLoveNotes` →
 * `useRealtimeMessages`' private join → `notesSlice.sendNote`'s
 * `sendEphemeralBroadcast` → `addNote` → `LoveNoteMessage`. This spec is the only
 * place where all of it runs in a browser against the real policies.
 *
 * Why two contexts rather than one: a broadcast is delivered to whoever is
 * joined at the moment it is sent, and the sender never receives its own. The
 * receiver therefore has to be a second, separately authenticated browser.
 *
 * Why the console is the join signal: a broadcast has no replay, so a send made
 * before the receiver's join is simply lost and the test would flake rather than
 * fail. `useRealtimeMessages.ts:250` reports the status through `logger.info`,
 * which is unconditional (`src/utils/logger.ts:10-12`), so the join is a real
 * signal already present in the shipped code — no app change, and no sleep.
 *
 * Identities are this worker's own pooled pair, linked once by
 * `tests/support/auth/global-setup.ts:151`. Nothing here links, unlinks or resets
 * an account, and teardown deletes only rows carrying this test's own uuid.
 *
 * playwright-utils deviation: the library has no two-context helper, so the
 * receiving context is opened with `browser.newContext` following the shape of
 * `tests/support/fixtures/together-mode.ts:134`.
 */
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';

/**
 * The receiving page's own hook reporting its join.
 *
 * Matches `logger.info('[useRealtimeMessages] Subscription status:', status, …)`
 * — Playwright joins a console call's arguments with spaces, so the tag and the
 * status land in one `msg.text()`. Deliberately loose between the two: the
 * message between them is the hook's wording, not this test's premise.
 */
const SUBSCRIBED_LOG = /\[useRealtimeMessages\].*SUBSCRIBED/;

/**
 * The base of `httpSend`'s REST endpoint, as far as the path is shared by every
 * topic. The per-send remainder is built from this in the test body.
 *
 * `transformers.js:224-238` derives this base from the socket URL, but
 * `RealtimeChannel.js:454-458` then appends
 * `/${encodeURIComponent(topic)}/events/${encodeURIComponent(event)}` and a
 * `private=true` query, and the socket URL already carries `apikey`,
 * `eventsPerSecond` and `vsn`. So the real request is a much longer URL than the
 * base and matching the base as a suffix never fires — measured against
 * @supabase/realtime-js 2.116.0 on 2026-09-14. This constant is therefore never
 * matched on its own: `love-notes:` and `mood-updates:` sends share it, and a
 * mood sync landing mid-test would otherwise resolve the wait and hand the 202
 * assertion an unrelated request.
 *
 * 202 is the endpoint's only success status (`RealtimeChannel.js:465-466`).
 */
const BROADCAST_PATH = '/realtime/v1/api/broadcast/';

test.describe('Love notes realtime delivery', () => {
  // Every wait below is bounded on its own so that the wait which fails is the
  // one the report names. Their sequential worst case is 30s join (which
  // contains the partner goto) + 30s networkidle + 30s sender goto + 15s input
  // + 30s broadcast + 15s delivery = 150s, so `playwright.config.ts:119`'s 60s
  // default would expire first and replace the real failure with a generic
  // test-timeout message. Raised to contain them, not because the test is slow:
  // it completes in under 3s, and this bound is only ever reached on a hang.
  test.describe.configure({ timeout: 180_000 });

  test(
    '[P1] DW-90-E2E-001 delivers a sent note to the partner over the private couple topic',
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
      // identity's storage-state file to the path read below. The assertion
      // proves only that the fixture ran and produced a token — a failed sign-in
      // already throws inside `manageAuthToken`, and a missing token throws at
      // `tests/support/fixtures/auth.ts:68`, so neither reaches here. It is kept
      // so the dependency is an explicit, checked precondition rather than a
      // destructured name a later edit could drop as unused.
      expect(partnerAuthToken).not.toBe('');

      // The uuid is the whole teardown filter and the whole delivery assertion:
      // no other row in the table can carry it, on any worker, from any run.
      const noteText = `DW-90 realtime note ${randomUUID()}`;
      // Resolved once, up front, from `TEST_WORKER_INDEX` — the same pair the
      // two contexts below sign in as. Used to name the topic the broadcast has
      // to be addressed to, and to bound the teardown delete.
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      // The exact path this send must take: `<base>/<encoded topic>/events/<event>`.
      // Built from the pair resolved above, so it names THIS worker's partner's
      // private topic and nothing else.
      const expectedBroadcastPath = `${BROADCAST_PATH}${encodeURIComponent(
        `love-notes:${partnerId}`
      )}/events/new_message`;
      let partnerContext: BrowserContext | undefined;
      // Whether a `love_notes` row exists for teardown to find. Raised only once
      // the broadcast request has been observed, which `notesSlice.ts:565` reaches
      // solely after `insertNoteOnce` returned a row — so this is true exactly
      // when a row was committed. Without it, every failure before the send would
      // add a misleading second failure from the row-count check below.
      let noteRowCommitted = false;

      try {
        await log.step('Park the partner on /notes until its own hook reports SUBSCRIBED');
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
        await partnerPage.goto('/notes');
        try {
          await subscribed;
        } catch (cause) {
          // Playwright's own message is `waitForEvent: Timeout 30000ms exceeded`,
          // which names neither the hook nor which of the two pages was waiting.
          // Sending anyway is not an option: a broadcast has no replay, so the
          // note would be lost and the run would read as a delivery failure.
          throw new Error(
            "The partner page's useRealtimeMessages never reported SUBSCRIBED within 30s of " +
              'landing on /notes, so the receiver was never joined and no send could be measured.',
            { cause }
          );
        }
        await partnerPage.waitForLoadState('networkidle');

        // This page is not touched again until the assertion: no reload, no
        // second goto, no refetch. `useLoveNotes.ts:126-130` is the only other
        // read of notes there and it has already run, so anything that appears
        // from here on can only have arrived over the broadcast.

        await log.step('Send a unique note from the sender through the real UI');
        await page.goto('/notes');
        const messageInput = page.getByLabel(/love note message input/i);
        await expect(messageInput).toBeVisible();
        await messageInput.fill(noteText);

        const broadcast = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(expectedBroadcastPath),
          // Explicit, and deliberately NOT the 15s `actionTimeout` this would
          // otherwise inherit: that is exactly `BROADCAST_TIMEOUT_MS`
          // (`src/api/ephemeralBroadcast.ts:77`), so a slow send would expire
          // both bounds in the same instant and this wait would report a missing
          // response while the app's own abort — the actual diagnosis — never
          // surfaced. 30s leaves the app's bound to fire first and be seen.
          { timeout: 30_000 }
        );
        await page.getByLabel(/send message/i).click();

        await log.step('The private INSERT policy admits the app own client send');
        // Asserted before the UI: a send the policy refused answers non-202 and
        // `notesSlice.ts:567-571` swallows it as non-fatal, so checking the
        // partner's screen first would report a rejected broadcast as a missing
        // element and point at the wrong layer.
        const broadcastResponse = await broadcast;
        noteRowCommitted = true;
        expect(broadcastResponse.status()).toBe(202);
        // Re-asserted rather than left to the predicate, so that loosening the
        // predicate later cannot silently widen what the 202 is taken to prove.
        // Compared against the raw URL: `decodeURIComponent` throws a URIError on
        // any stray percent sequence in a query value, which would replace a real
        // result with a decoding failure.
        expect(broadcastResponse.url()).toContain(expectedBroadcastPath);
        // `private=true` is what makes this an authorization result rather than
        // merely a delivery one. Without it Realtime does not evaluate
        // `couple_broadcast_partner_can_send` at all, and the 202 would say
        // nothing about the policy this spec exists to exercise
        // (`RealtimeChannel.js:456-458`).
        expect(new URL(broadcastResponse.url()).searchParams.get('private')).toBe('true');

        await log.step('The note reaches the partner live, with no reload and no re-navigation');
        await expect(partnerPage.getByTestId('love-note-message').getByText(noteText)).toBeVisible();
      } finally {
        // Same idiom as `together-mode.ts:165`: a close that rejects must not
        // become the failure the report shows instead of the real one.
        await partnerContext?.close().catch(() => {});

        // Keyed on this test's own uuid AND on this worker's own pair, so a
        // mis-resolved identity deletes nothing rather than another worker's
        // rows. Partner linkage, passwords and every other shared row are
        // untouched.
        const { data: deleted, error } = await supabaseAdmin
          .from('love_notes')
          .delete()
          .eq('content', noteText)
          .in('from_user_id', [userId, partnerId])
          .select('id');

        // Soft, and deliberately so. A hard assertion here throws out of a
        // `finally` and replaces whatever the test was already failing on — the
        // one failure worth reading — with a teardown message. Soft records the
        // leak, still fails the run, and leaves the original error standing.
        expect
          .soft(error, 'Teardown must delete the note row this test created')
          .toBeNull();

        // The row count, not just the absence of an error. A delete whose filter
        // matches nothing — the shape a mis-resolved `userId`/`partnerId` would
        // produce — also answers `error: null`, so without this the leak the
        // filter exists to prevent would pass silently. Checked only once a row
        // is known to exist, so a failure before the send does not add a second,
        // false teardown failure on top of the real one.
        if (noteRowCommitted) {
          expect
            .soft(deleted ?? [], 'Teardown must delete exactly the one row this test created')
            .toHaveLength(1);
        }
      }
    }
  );
});
