/**
 * E2E: Settings as a stack of pages
 *
 * The page stack against the real app, bottom-dock form: Settings has its own
 * bar (no app header), a row pushes a page as exactly one history entry at its
 * URL, and the page survives a reload. The back arrow and the browser's back
 * each return one level, with focus on the row that opened the page. A page
 * opened by a fresh load goes up by replacing its entry instead of leaving the
 * app, and a page the device cannot show falls back to the top page.
 *
 * Photos is the first subpage and appears only where the browser reports its
 * connection type, which headless Chrome does not, so the specs that need it
 * define `navigator.connection` before the page loads. The column form needs
 * `env()` insets a desktop browser cannot emulate; the unit tests prove it.
 */
import { test, expect } from '../../support/merged-fixtures';
import type { Page } from '@playwright/test';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { goOffline } from '../../support/helpers/offline';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const PHOTOS_KEY = 'my-love-photos-over-mobile-data';

/** A phone that reports its connection type, as Chrome on Android does. */
async function reportConnectionType(page: Page, type: string | null) {
  await page.addInitScript((connectionType) => {
    Object.defineProperty(navigator, 'connection', {
      value: connectionType ? Object.assign(new EventTarget(), { type: connectionType }) : undefined,
      configurable: true,
    });
  }, type);
}

const historyLength = (page: Page) => page.evaluate(() => window.history.length);

test.describe('Settings page stack', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
  });

  test('[P0] should push Photos as one history entry, save an offline choice and show it on the row after back', async ({
    page,
    interceptNetworkCall,
  }) => {
    await reportConnectionType(page, 'wifi');
    await openSettingsFromHome(page, interceptNetworkCall);

    // THEN: Settings has its own bar in place of the app header, with a back
    // arrow because the gear opened it.
    await expect(page.getByTestId('app-header')).toHaveCount(0);
    await expect(page.getByTestId('settings-bar')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    const row = page.getByRole('button', { name: 'Photos, Wi-Fi only' });
    await expect(row).toBeVisible();
    const before = await historyLength(page);

    // WHEN: the Photos row is tapped
    await row.click();

    // THEN: one new entry at /settings/photos, the page's one h1 focused
    await expect(page).toHaveURL(/\/settings\/photos$/);
    expect(await historyLength(page)).toBe(before + 1);
    const title = page.getByRole('heading', { level: 1, name: 'Photos' });
    await expect(title).toBeFocused();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('radio', { name: 'Wi-Fi only' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Any connection' })).not.toBeChecked();

    // WHEN: the choice is made with no connection
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await goOffline(page, true);
    // The offline banner shows once, under Settings' own bar: the bar holds the
    // status bar's inset, which the banner has none of.
    await expect(page.getByTestId('network-status-banner')).toHaveCount(1);
    await expect(
      page.getByTestId('settings-bar').locator('xpath=following-sibling::*[1]')
    ).toHaveAttribute('data-testid', 'network-status-indicator');
    // The radio is visually hidden; a person taps its label.
    await page.getByTestId('settings-photos-any').click();

    // THEN: it is saved on the device and nothing is sent
    await expect(page.getByRole('radio', { name: 'Any connection' })).toBeChecked();
    expect(await page.evaluate((key) => localStorage.getItem(key), PHOTOS_KEY)).toBe('true');
    expect(requests.filter((url) => url.includes('/rest/v1/') || url.includes('/auth/v1/'))).toEqual(
      []
    );

    // WHEN: the back arrow is tapped
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: the top page, the row holds the new value and has focus, and the
    // history did not grow: back keeps the forward entry
    await expect(page).toHaveURL(/\/settings$/);
    expect(await historyLength(page)).toBe(before + 1);
    const updated = page.getByRole('button', { name: 'Photos, Any connection' });
    await expect(updated).toBeVisible();
    await expect(updated).toBeFocused();
    await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toHaveCount(0);
  });

  test('[P1] should keep the bar stuck to the top and collapse it once the large title scrolls under it', async ({
    page,
    interceptNetworkCall,
  }) => {
    // A short phone: the top page holds only its rows now (the Countdowns
    // section that made it taller is gone), so at 844px tall it no longer
    // scrolls at all.
    await page.setViewportSize({ width: 390, height: 480 });
    await openSettingsFromHome(page, interceptNetworkCall);
    const bar = page.getByTestId('settings-bar');
    await expect(bar).toHaveAttribute('data-collapsed', 'false');

    // WHEN: the page scrolls well past the title
    await page.evaluate(() => window.scrollTo(0, 300));

    // THEN: the bar is collapsed and still at the top of the screen
    await expect(bar).toHaveAttribute('data-collapsed', 'true');
    const box = await bar.boundingBox();
    expect(box?.y).toBeLessThanOrEqual(1);

    // WHEN: the page scrolls back to the top
    await page.evaluate(() => window.scrollTo(0, 0));

    // THEN: the bar is transparent over the large title again
    await expect(bar).toHaveAttribute('data-collapsed', 'false');
  });

  test('[P1] should slide a pushed page in from the right, and fade it under Reduce Motion', async ({
    page,
    interceptNetworkCall,
  }) => {
    await reportConnectionType(page, 'wifi');
    await openSettingsFromHome(page, interceptNetworkCall);
    // The page container: the one child of the view, replaced on every push.
    const container = page.getByTestId('settings-view').locator('> div');
    const animationName = () => container.evaluate((el) => getComputedStyle(el).animationName);
    const transform = () => container.evaluate((el) => getComputedStyle(el).transform);

    // WHEN: Photos is pushed
    await page.getByRole('button', { name: 'Photos, Wi-Fi only' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();

    // THEN: it slides in, and ends with no transform (a lingering one would trap fixed dialogs)
    expect(await animationName()).toBe('settings-push');
    await expect.poll(transform).toBe('none');

    // WHEN: the back arrow returns to the top page
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

    // THEN: it drifts back in, and ends with no transform either -- the top
    // page's own dialogs (Sign out of all devices, the name form) are fixed
    expect(await animationName()).toBe('settings-pop');
    await expect.poll(transform).toBe('none');

    // WHEN: the person asks for Reduce Motion and pushes again
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Photos, Wi-Fi only' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();

    // THEN: it fades instead of sliding
    expect(await animationName()).toBe('settings-fade');
    await expect.poll(transform).toBe('none');
  });

  test('[P0] should stay on Photos across a reload and go back one level from there', async ({
    page,
    interceptNetworkCall,
  }) => {
    await reportConnectionType(page, 'wifi');
    await openSettingsFromHome(page, interceptNetworkCall);
    await page.getByRole('button', { name: 'Photos, Wi-Fi only' }).click();
    await expect(page).toHaveURL(/\/settings\/photos$/);

    // WHEN: the page reloads
    await page.reload();

    // THEN: Photos again, and its arrow still goes up one level rather than out
    await expect(page).toHaveURL(/\/settings\/photos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Photos' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });

  test('[P0] should return one level with the browser back, and Photos again with browser forward', async ({
    page,
    interceptNetworkCall,
  }) => {
    await reportConnectionType(page, 'wifi');
    await openSettingsFromHome(page, interceptNetworkCall);
    await page.getByRole('button', { name: 'Photos, Wi-Fi only' }).click();
    await expect(page).toHaveURL(/\/settings\/photos$/);

    // WHEN: the browser goes back
    await page.goBack();

    // THEN: the top page, focus on the Photos row
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Photos, Wi-Fi only' })).toBeFocused();

    // WHEN: the browser goes forward
    await page.goForward();

    // THEN: Photos again
    await expect(page).toHaveURL(/\/settings\/photos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
  });

  test('[P1] should go back to Home, not Photos, on browser back after leaving through the dock', async ({
    page,
    interceptNetworkCall,
  }) => {
    await reportConnectionType(page, 'wifi');
    await openSettingsFromHome(page, interceptNetworkCall);
    await page.getByRole('button', { name: 'Photos, Wi-Fi only' }).click();
    await expect(page).toHaveURL(/\/settings\/photos$/);

    // WHEN: a dock view is opened and the browser goes back
    await page.getByTestId('nav-mood').click();
    await expect(page).toHaveURL(/\/mood$/);
    await page.goBack();

    // THEN: Home, the bottom of the history: a dock view sits on Home alone
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByTestId('settings-view')).toHaveCount(0);
  });

  test('[P0] should replace the entry with /settings, not leave the app, when a fresh load at Photos goes back', async ({
    page,
  }) => {
    await reportConnectionType(page, 'wifi');

    // GIVEN: Photos opened by a fresh load, so history holds no entry of the app's
    await page.goto('/settings/photos');
    await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
    const before = await historyLength(page);

    // WHEN: the back arrow is tapped
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: the top page at /settings in the same entry, and no arrow above it
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    expect(await historyLength(page)).toBe(before);
    await expect(page.getByTestId('settings-bar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  });

  test('[P1] should return to the view that opened Settings with the top page\'s back arrow', async ({
    page,
    interceptNetworkCall,
  }) => {
    await openSettingsFromHome(page, interceptNetworkCall);
    const before = await historyLength(page);

    // WHEN: the top page's back arrow is tapped
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: Home again, with its app header, and the history did not grow
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByTestId('settings-view')).toHaveCount(0);
    expect(await historyLength(page)).toBe(before);
  });

  test('[P1] should show the top page, rewriting the URL, for a page that does not exist', async ({
    page,
  }) => {
    await reportConnectionType(page, 'wifi');

    await page.goto('/settings/xyz');

    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('[P1] should have no Photos row or page where the connection type is not reported', async ({
    page,
  }) => {
    await reportConnectionType(page, null);

    // WHEN: Photos is opened by URL on a device that cannot tell
    await page.goto('/settings/photos');

    // THEN: the top page at /settings, with no Photos row (and no empty Preferences group)
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId('settings-photos-row')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Preferences' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup')).toHaveCount(0);
  });
});
