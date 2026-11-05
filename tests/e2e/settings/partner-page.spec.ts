/**
 * E2E: Settings > Partner
 *
 * A linked pool account sees the partner's name on the top page's Partner row,
 * and the Partner page lists Name and Email as read-only rows. Pool couples are
 * linked without a partner request, so their real Linked since is unknown and
 * its row is hidden; a spec that wants the date fulfils the request read. An
 * account the server says is unlinked reads `Not linked`, and its page shows
 * the lead line and `Go to Partner`, which opens the Partner view.
 *
 * Bottom-dock form on a phone viewport, as `settings-stack.spec.ts` runs.
 */
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
import { LINKED_SINCE_READ, partnerRecordRead } from '../../support/helpers/reads';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

test.describe('Settings > Partner', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
  });

  test('[P1] should show the partner on the row and Name and Email, but no Linked since, for a linked pool couple', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // GIVEN: a linked account; the partner record read is armed before the
    // sign-in that starts it, so its answer names the partner.
    const { partnerId } = await resolveOwnPair(supabaseAdmin);
    const partnerRead = interceptNetworkCall({ method: 'GET', url: partnerRecordRead(partnerId) });
    await openSettingsFromHome(page, interceptNetworkCall);
    const record = (await partnerRead).responseJson as { email: string; display_name: string | null }[];
    const partnerEmail = record[0].email;
    const partnerName = (record[0].display_name ?? '').trim();
    expect(partnerName).not.toBe('');

    // THEN: the Partner group sits after Account and its row shows the name
    const row = page.getByTestId('settings-partner-row');
    await expect(page.getByRole('heading', { level: 2 }).nth(1)).toHaveText('Partner');
    await expect(row).toContainText(partnerName);

    // WHEN: the row is tapped
    await row.click();

    // THEN: one level in, with Name and Email as plain rows and no Linked since
    await expect(page).toHaveURL(/\/settings\/partner$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Partner' })).toBeVisible();
    await expect(page.getByTestId('settings-partner-name')).toContainText(partnerName);
    await expect(page.getByTestId('settings-partner-email')).toContainText(partnerEmail);
    await expect(page.getByTestId('settings-partner-linked-since')).toHaveCount(0);
    await expect(page.getByTestId('settings-partner-card').getByRole('button')).toHaveCount(0);

    // WHEN: back is tapped
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: the top page, one level up
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });

  test('[P1] should show Linked since as day, month and year when the accepted request is known', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: the accepted request read answers with a link date, installed
    // before the navigation that sends it
    // playwright-utils deviation: the route must be installed before the next navigation and answer every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route(LINKED_SINCE_READ, (route) =>
      route.fulfill({ json: { updated_at: '2022-02-03T12:00:00Z' } })
    );
    await openSettingsFromHome(page, interceptNetworkCall);

    // WHEN: the Partner page opens
    await page.getByTestId('settings-partner-row').click();

    // THEN: the row reads the local date as the mock does, day first with the
    // year (12:00 UTC is 3 Feb from UTC-12 to UTC+11, and 4 Feb east of that)
    await expect(page.getByTestId('settings-partner-linked-since')).toContainText('Linked since');
    await expect(page.getByTestId('settings-partner-linked-since')).toContainText(/[34] Feb 2022/);
  });

  test('[P1] should read Not linked and open the Partner view from Go to Partner when the server says unlinked', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: this browser only, the account's partner_id reads as unset; the
    // pool user stays linked in the database throughout.
    // playwright-utils deviation: the route must be installed before the next navigation and answer every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/users?select=partner_id*', (route) =>
      route.fulfill({ json: { partner_id: null, updated_at: '2026-01-01T00:00:00Z' } })
    );
    await openSettingsFromHome(page, interceptNetworkCall);

    // THEN: the row says so, once the answer has loaded
    const row = page.getByTestId('settings-partner-row');
    await expect(row).toContainText('Not linked');

    // WHEN: the row is tapped
    await row.click();

    // THEN: the lead line and Go to Partner, no linked rows
    await expect(page).toHaveURL(/\/settings\/partner$/);
    await expect(page.getByTestId('settings-partner-lead')).toHaveText(
      "You aren't linked with a partner yet."
    );
    await expect(page.getByTestId('settings-partner-name')).toHaveCount(0);

    // WHEN: Go to Partner is tapped
    await page.getByTestId('settings-go-to-partner').click();

    // THEN: the Partner view opens
    await expect.poll(() => new URL(page.url()).pathname).toBe('/partner');
    await expect(page.getByRole('heading', { level: 1, name: 'Connect with Your Partner' })).toBeVisible();
  });
});
