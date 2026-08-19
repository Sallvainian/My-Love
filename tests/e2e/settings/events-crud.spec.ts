/**
 * P0 E2E: Managing events from Settings
 *
 * Story 5 (dynamic events). The real round trip against the local stack, with
 * every row created through the UI rather than seeded — this is the only test
 * anywhere that exercises `addEvent` / `editEvent` / `removeEvent` from a
 * caller, and the only one that reaches Settings' own `loadEvents()` effect.
 *
 * - reach Settings through the tray, add an event, and see it in the list
 *   (CAP-1's write half, CAP-5)
 * - the same event is on Home afterwards, with no reload (CAP-1)
 * - edit its label and date, and see both change in the list
 * - delete it behind a confirmation, and land on the empty state that carries
 *   its own add control (CAP-10, Settings half)
 * - a rejected create keeps the form open and shows the message the write
 *   itself returned (CAP-7)
 *
 * User id resolution mirrors `tests/e2e/home/events.spec.ts`, which in turn
 * mirrors `tests/support/factories/index.ts`'s `resolveAppUserIdByEmail`, kept
 * self-contained here since that helper is not exported.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import type { TypedSupabaseClient } from '../../support/factories';
import { formatDateISO, formatDateLong } from '../../../src/utils/dateUtils';
import type { Locator, Page } from '@playwright/test';

/**
 * Labels are deliberately unlike any fixed testid on Home — `Wedding` slugifies
 * to `event-countdown-wedding`, which is a hardcoded card that must never be
 * shadowed by a row this spec creates.
 */
const ADDED_LABEL = 'Settings Trip E2E';
const EDITED_LABEL = 'Settings Voyage E2E';

async function resolveAppUserId(
  supabaseAdmin: TypedSupabaseClient,
  email: string
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (error || !data?.id) {
    throw new Error(`Could not resolve app user for ${email}: ${error?.message ?? 'not found'}`);
  }

  return data.id;
}

/** This worker's own pair, resolved to `public.users.id`s. Throws outside a worker. */
async function resolveOwnPair(
  supabaseAdmin: TypedSupabaseClient
): Promise<{ userId: string; partnerId: string }> {
  const pair = getWorkerPairEmails();
  if (!pair) {
    throw new Error('resolveOwnPair: no worker identity (TEST_WORKER_INDEX unset)');
  }

  const [userId, partnerId] = await Promise.all([
    resolveAppUserId(supabaseAdmin, pair.user1Email),
    resolveAppUserId(supabaseAdmin, pair.user2Email),
  ]);

  return { userId, partnerId };
}

/**
 * Remove every event owned by either half of this worker's pair.
 *
 * Rows here are created through the UI, so their ids are not known to the test
 * — deleting by `user_id` the way `clearPairEvents` does is the only handle
 * there is. Checked, because a silently-failed clear leaves stray rows that
 * break the next test's premise and fail it as "empty state not visible",
 * pointing at the wrong code.
 */
async function clearPairEvents(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  partnerId: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('events').delete().in('user_id', [userId, partnerId]);
  if (error) {
    throw new Error(`Failed to clear events for the worker pair: ${error.message}`);
  }
}

/** The list row carrying a given label. Row testids key on the event's uuid. */
function rowFor(page: Page, label: string) {
  return page.locator('[data-testid^="event-row-"]').filter({ hasText: label });
}

function futureDate(dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return formatDateISO(date);
}

/**
 * Assert a Home card is counting down to the date it was created with.
 *
 * The expectation and the rendered text are read inside ONE page.evaluate, so
 * both come from a single sample of the browser's own clock. Computing the
 * count in Node and comparing it to the DOM later is a one-day flake waiting
 * for local midnight to tick between the two reads — and the day-count is the
 * only thing on this card that carries the date at all.
 *
 * Polled because EventCountdown recomputes on its own one-second interval, so
 * the text can be up to a second behind the clock the expectation samples.
 */
async function expectCardCountsDownTo(card: Locator, isoDate: string): Promise<void> {
  await expect
    .poll(
      () =>
        card.evaluate((element, iso) => {
          const [year, month, day] = iso.split('-').map(Number);
          const now = new Date();
          const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const target = new Date(year, month - 1, day);
          const days = Math.round((target.getTime() - todayMidnight.getTime()) / 86400000);
          const expected = `${days} ${days === 1 ? 'day' : 'days'}`;
          return (element.textContent ?? '').includes(expected);
        }, isoDate),
      { message: `Home card should be counting down to ${isoDate}` }
    )
    .toBe(true);
}

function longForm(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  // Local components, never `new Date(isoDate)` — the date-only string form is
  // parsed as UTC midnight and names the previous day west of UTC.
  return formatDateLong(new Date(year, month - 1, day));
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching the Home specs.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.afterEach(async ({ supabaseAdmin }) => {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  await clearPairEvents(supabaseAdmin, userId, partnerId);
});

test.describe('Managing events from Settings', () => {
  test('[P0] adds, shows on Home, edits, deletes, and lands on the empty state', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    // Self-healing against stray rows from a previously failed run, for either
    // half of the couple — the SELECT policy returns own + partner.
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const addedDate = futureDate(30);
    const editedDate = futureDate(45);

    await page.goto('/');
    await navigateTo(page, 'settings');
    await expect(page.getByTestId('settings-view')).toBeVisible();

    // The section loads from its own mount effect — Home was never the source.
    await expect(page.getByTestId('events-settings-empty')).toBeVisible();
    await expect(page.getByTestId('events-settings-empty-add')).toBeVisible();

    // ── Add ────────────────────────────────────────────────────────────────
    await page.getByTestId('events-settings-empty-add').click();
    await expect(page.getByTestId('events-form')).toBeVisible();

    await page.getByTestId('events-form-label').fill(ADDED_LABEL);
    await page.getByTestId('events-form-date').fill(addedDate);
    await page.getByTestId('events-form-description').fill('Booked and counting');
    // The radio itself is sr-only; the styled label is the control a pointer
    // user actually hits, and it carries its own testid for exactly this.
    await page.getByTestId('events-form-icon-option-plane').click();
    await expect(page.getByTestId('events-form-icon-plane')).toBeChecked();

    // Layer 1 — the write reached the server.
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/events') && response.request().method() === 'POST'
    );
    await page.getByTestId('events-form-submit').click();
    expect((await createResponse).status()).toBe(201);

    // Layer 2 and 3 — the store took it and the list shows it, with the form
    // closed behind it.
    await expect(page.getByTestId('events-form')).toHaveCount(0);
    const addedRow = rowFor(page, ADDED_LABEL);
    await expect(addedRow).toBeVisible();
    await expect(addedRow).toContainText(longForm(addedDate));
    await expect(addedRow).toContainText('Booked and counting');

    // ── Visible on Home ────────────────────────────────────────────────────
    await navigateTo(page, 'home');
    const card = page.getByTestId('event-countdown-settings-trip-e2e');
    await expect(card).toBeVisible();
    await expect(card.getByText(ADDED_LABEL)).toBeVisible();
    await expect(card.getByText('Booked and counting')).toBeVisible();
    // The date itself, as this component renders it: the calendar-day count
    // between local midnights. This is the whole date round trip — the
    // <input type="date"> string, the `date` column, and the local-midnight
    // rebuild — pinned to one number.
    await expectCardCountsDownTo(card, addedDate);

    // ── Edit ───────────────────────────────────────────────────────────────
    await navigateTo(page, 'settings');
    const rowToEdit = rowFor(page, ADDED_LABEL);
    await expect(rowToEdit).toBeVisible();
    await rowToEdit.locator('[data-testid^="event-edit-"]').click();

    await expect(page.getByTestId('events-form')).toBeVisible();
    // Pre-filled with the same calendar day the row shows — the off-by-one this
    // feature exists to avoid would surface right here.
    await expect(page.getByTestId('events-form-label')).toHaveValue(ADDED_LABEL);
    await expect(page.getByTestId('events-form-date')).toHaveValue(addedDate);

    await page.getByTestId('events-form-label').fill(EDITED_LABEL);
    await page.getByTestId('events-form-date').fill(editedDate);

    const updateResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/events') && response.request().method() === 'PATCH'
    );
    await page.getByTestId('events-form-submit').click();
    expect((await updateResponse).status()).toBe(200);

    await expect(page.getByTestId('events-form')).toHaveCount(0);
    const editedRow = rowFor(page, EDITED_LABEL);
    await expect(editedRow).toBeVisible();
    await expect(editedRow).toContainText(longForm(editedDate));
    await expect(rowFor(page, ADDED_LABEL)).toHaveCount(0);

    // Home follows the edit — both halves of it. The old card's testid is
    // derived from the old label, so its absence is what proves the card was
    // re-rendered rather than left behind.
    await navigateTo(page, 'home');
    const editedCard = page.getByTestId('event-countdown-settings-voyage-e2e');
    await expect(editedCard).toBeVisible();
    await expect(editedCard.getByText(EDITED_LABEL)).toBeVisible();
    await expectCardCountsDownTo(editedCard, editedDate);
    await expect(page.getByTestId('event-countdown-settings-trip-e2e')).toHaveCount(0);

    await navigateTo(page, 'settings');
    const rowToDelete = rowFor(page, EDITED_LABEL);
    await expect(rowToDelete).toBeVisible();

    // ── Delete ─────────────────────────────────────────────────────────────
    await rowToDelete.locator('[data-testid^="event-delete-"]').click();
    await expect(page.getByTestId('events-delete-confirmation')).toBeVisible();

    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/events') && response.request().method() === 'DELETE'
    );
    await page.getByTestId('events-delete-confirm').click();
    expect((await deleteResponse).status()).toBe(200);

    await expect(page.getByTestId('events-delete-confirmation')).toHaveCount(0);
    await expect(rowFor(page, EDITED_LABEL)).toHaveCount(0);

    // ── Empty state, carrying its own add control ──────────────────────────
    await expect(page.getByTestId('events-settings-empty')).toBeVisible();
    await expect(page.getByTestId('events-settings-empty-add')).toBeVisible();
  });

  test('[P0] loads the list on a direct reload of /settings, without visiting Home', async ({
    page,
    supabaseAdmin,
  }) => {
    // `events` is not persisted and App's only loadEvents() effect is gated on
    // Home, so without the section's own mount effect this list would be
    // permanently empty on a deep link. Seeded directly: the point is the read
    // path, not the write path.
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const seededDate = futureDate(20);
    const { error } = await supabaseAdmin.from('events').insert({
      user_id: userId,
      label: 'Settings Deeplink E2E',
      event_date: seededDate,
      description: 'Seeded for the deep link',
      icon: 'calendar',
    });
    if (error) {
      throw new Error(`Failed to seed the deep-link event: ${error.message}`);
    }

    await page.goto('/');
    await navigateTo(page, 'settings');
    await page.waitForURL('**/settings');

    // The reload is what removes Home from the picture entirely: the app boots
    // straight onto Settings and never renders the Home view.
    await page.reload();

    await expect(page.getByTestId('settings-view')).toBeVisible();
    const row = rowFor(page, 'Settings Deeplink E2E');
    await expect(row).toBeVisible();
    await expect(row).toContainText(longForm(seededDate));
    await expect(page.getByTestId('events-settings-empty')).toHaveCount(0);
  });

  test('[P0] lists a past event with its controls, where Home hides it', async ({
    page,
    supabaseAdmin,
  }) => {
    // Auto-hide is Home's rule alone: Settings is the only place a mistyped
    // year can be seen and corrected, so a past event must be listed AND
    // editable here.
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const pastDate = futureDate(-14);
    // A future event is seeded alongside it purely as a load witness: without
    // one, `toHaveCount(0)` on the past card runs before loadEvents can have
    // resolved and passes vacuously — it would still pass if Home rendered
    // every past event it was given.
    const futureWitnessDate = futureDate(9);
    const { error } = await supabaseAdmin.from('events').insert([
      {
        user_id: userId,
        label: 'Settings Bygone E2E',
        event_date: pastDate,
        description: null,
        icon: 'calendar',
      },
      {
        user_id: userId,
        label: 'Settings Witness E2E',
        event_date: futureWitnessDate,
        description: null,
        icon: 'calendar',
      },
    ]);
    if (error) {
      throw new Error(`Failed to seed the past event: ${error.message}`);
    }

    await page.goto('/');

    // The witness proves this load landed, so the absence below is a real
    // absence rather than an assertion that beat the fetch.
    await expect(page.getByTestId('event-countdown-settings-witness-e2e')).toBeVisible();
    await expect(page.getByTestId('event-countdown-settings-bygone-e2e')).toHaveCount(0);
    await expect(page.getByText('Settings Bygone E2E')).toHaveCount(0);

    await navigateTo(page, 'settings');
    const row = rowFor(page, 'Settings Bygone E2E');
    await expect(row).toBeVisible();
    await expect(row).toContainText(longForm(pastDate));
    await expect(row.locator('[data-testid^="event-edit-"]')).toBeVisible();
    await expect(row.locator('[data-testid^="event-delete-"]')).toBeVisible();
  });

  test("[P0] offers no Edit or Delete on a partner's event", async ({ page, supabaseAdmin }) => {
    // RLS filters a non-creator's write to zero rows, which the service turns
    // into "not yours to edit" — the row is read-only rather than a control
    // that can only ever fail.
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const { error } = await supabaseAdmin.from('events').insert({
      user_id: partnerId,
      label: 'Settings Partner E2E',
      event_date: futureDate(25),
      description: 'Theirs, not mine',
      icon: 'ring',
    });
    if (error) {
      throw new Error(`Failed to seed the partner event: ${error.message}`);
    }

    await page.goto('/');
    await navigateTo(page, 'settings');

    const row = rowFor(page, 'Settings Partner E2E');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Theirs, not mine');
    await expect(row.locator('[data-testid^="event-edit-"]')).toHaveCount(0);
    await expect(row.locator('[data-testid^="event-delete-"]')).toHaveCount(0);
  });
});

test.describe(
  'A rejected save keeps the form open',
  // Without this the network monitor fails the test on the 500 it was told to
  // inject.
  { annotation: [{ type: 'skipNetworkMonitoring' }] },
  () => {
    test('[P0] shows the message the write returned and leaves the list untouched', async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
    }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);

      await page.goto('/');
      await navigateTo(page, 'settings');
      await expect(page.getByTestId('events-settings-empty')).toBeVisible();

      // Registered before the form is even opened, so the route is in place
      // long before the create leaves the page. A PostgREST-shaped body is what
      // makes the surfaced message deterministic: eventsService routes it
      // through handleSupabaseError, which prefixes "Database error: ".
      const rejectedCreate = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/events*',
        fulfillResponse: {
          status: 500,
          body: {
            message: 'Injected create failure',
            details: '',
            hint: '',
            code: 'XX000',
          },
        },
      });

      await page.getByTestId('events-settings-empty-add').click();
      await page.getByTestId('events-form-label').fill('Settings Rejected E2E');
      await page.getByTestId('events-form-date').fill(futureDate(10));
      await page.getByTestId('events-form-submit').click();

      await rejectedCreate;

      // The form stays open, carrying the message from THIS write.
      await expect(page.getByTestId('events-form')).toBeVisible();
      await expect(page.getByTestId('events-form-error')).toContainText(
        'Injected create failure'
      );
      // Nothing was added to the list behind it.
      await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(0);
      // And Save is usable again, so a retry is possible without reopening.
      await expect(page.getByTestId('events-form-submit')).toBeEnabled();
    });
  }
);
