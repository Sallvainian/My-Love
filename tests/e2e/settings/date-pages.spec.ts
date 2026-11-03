/**
 * E2E: Settings > Dates > the couple dates' and birthdays' own pages
 *
 * A linked pool account opens the partner's birthday page from the Dates list:
 * the title carries the partner's name, the Date row is read-only, the Footnote
 * says whose it is to set, and on the web there is no Remind me. Your birthday's
 * Date row opens the birthday field. A reload on a page stays on it. With the
 * partner read faked unlinked, the Together since page falls back to the Dates
 * list. The save and Clear paths are driven in `couple-start-date.spec.ts` and
 * `birthdays-wedding.spec.ts`.
 *
 * Seeds nothing and writes nothing, so there is nothing to clean up; the unlinked
 * answer is a route on this browser only. Bottom-dock form on a phone viewport,
 * as `dates-list.spec.ts` runs.
 */
import { test, expect } from '../../support/merged-fixtures';
import { dayMonth } from '../../support/helpers/dates-list-format';
import { localDateFromIso, resolveOwnPair } from '../../support/helpers/events';
import { OWN_PROFILE_READ, partnerRecordRead } from '../../support/helpers/reads';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

/** A row the app read as an array of at most one (`maybeSingle`), or `undefined` for none. */
const firstRow = <T>(json: unknown): T | undefined =>
  (Array.isArray(json) ? json[0] : json) as T | undefined;

test.describe('Settings > Dates > date pages', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
  });

  test("[P1] should open the partner's birthday page with a read-only Date row", async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // GIVEN: a linked account, the partner record read armed before the sign-in that sends it
    const { partnerId } = await resolveOwnPair(supabaseAdmin);
    const partnerRead = interceptNetworkCall({ method: 'GET', url: partnerRecordRead(partnerId) });
    await openSettingsFromHome(page, interceptNetworkCall);
    const partner = firstRow<{ display_name: string | null; birthday: string | null }>(
      (await partnerRead).responseJson
    );
    const partnerName = (partner?.display_name ?? '').trim();
    expect(partnerName).not.toBe('');

    // WHEN: the partner's row on the Dates list is tapped
    await page.getByTestId('settings-dates-row').click();
    await page.getByTestId('settings-dates-birthday-partner').click();

    // THEN: the small-title page opens, titled with the partner's name
    await expect(page).toHaveURL(/\/settings\/dates\/partner-birthday$/);
    await expect(
      page.getByRole('heading', { level: 1, name: `${partnerName}'s birthday` })
    ).toBeVisible();

    // THEN: the Date row is read-only and shows the partner's birthday as the list does
    const row = page.getByTestId('settings-partner-birthday-date');
    const shown = partner?.birthday ? dayMonth(localDateFromIso(partner.birthday)) : 'Not set';
    await expect(row).toHaveText(new RegExp(`^Date${shown}$`));
    await expect(row.locator('button, svg')).toHaveCount(0);
    await expect(page.getByTestId('settings-date-row')).toHaveCount(0);

    // THEN: the Footnote says whose it is to set, and the website has no Remind me
    await expect(page.getByTestId('settings-partner-birthday-footnote')).toHaveText(
      `${partnerName} sets this in their Profile.`
    );
    await expect(page.getByTestId('settings-remind-me')).toHaveCount(0);

    // WHEN: back is tapped
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: the Dates list, one level up
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
  });

  test("[P1] should open the birthday field from Your birthday's Date row", async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: Settings open and the own profile read answered, which the Date row waits for
    const profileRead = interceptNetworkCall({ method: 'GET', url: OWN_PROFILE_READ });
    await openSettingsFromHome(page, interceptNetworkCall);
    expect((await profileRead).status).toBe(200);

    // WHEN: Dates, You, then the Date row are tapped
    await page.getByTestId('settings-dates-row').click();
    await page.getByTestId('settings-dates-birthday-self').click();
    await expect(page).toHaveURL(/\/settings\/dates\/birthday$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Your birthday' })).toBeVisible();
    await page.getByTestId('settings-date-row').click();

    // THEN: the one-field Date page opens on the birthday field
    await expect(page).toHaveURL(/\/settings\/dates\/birthday\/date$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Date' })).toBeVisible();
    await expect(page.getByTestId('settings-birthday-field')).toBeVisible();
    await expect(page.getByTestId('settings-birthday-field')).toHaveAttribute('type', 'date');
  });

  test('[P1] should stay on the Wedding page after a reload', async ({ page }) => {
    // GIVEN: the Wedding page opened by its address
    await page.goto('/settings/dates/wedding');
    await expect(page.getByRole('heading', { level: 1, name: 'Wedding' })).toBeVisible();

    // WHEN: the page reloads
    await page.reload();

    // THEN: it is still the Wedding page
    await expect(page.getByRole('heading', { level: 1, name: 'Wedding' })).toBeVisible();
    await expect(page).toHaveURL(/\/settings\/dates\/wedding$/);
  });

  test('[P1] should fall back to the Dates list from Together since when unlinked', async ({
    page,
  }) => {
    // GIVEN: this browser only, the partner_id read answers unset (the pool couple stays
    // linked in the database)
    // playwright-utils deviation: the route must be installed before the next navigation and
    // answer every match; interceptNetworkCall registers its route inside a test.step the
    // caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/users?select=partner_id*', (route) =>
      route.fulfill({ json: { partner_id: null, updated_at: '2026-01-01T00:00:00Z' } })
    );

    // WHEN: the Together since page is opened by its address
    await page.goto('/settings/dates/together-since');

    // THEN: the page is not there to show, and the Dates list is
    await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByTestId('settings-together-since-page')).toHaveCount(0);
  });
});
