/**
 * E2E: Bottom dock navigation
 *
 * The dock and the Settings gear against the real app: every destination is on
 * screen without a tap, each is one tap away, and aria-current follows the view.
 * Plus the /settings deep link. Four of the five `settings` registration sites
 * are untypechecked (AGENTS.md:28) — the two App route ternaries, the render
 * chain and the gear itself — so a missed one still compiles, renders nothing
 * and resets to Home on reload. The reload case below is the only thing that
 * catches that.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';

const DOCK_DESTINATIONS = ['home', 'mood', 'notes', 'photos', 'partner'] as const;
const ALL_DESTINATIONS = [...DOCK_DESTINATIONS, 'settings'] as const;

const PATHS: Record<(typeof ALL_DESTINATIONS)[number], RegExp> = {
  home: /\/$/,
  mood: /\/mood$/,
  notes: /\/notes$/,
  photos: /\/photos$/,
  partner: /\/partner$/,
  settings: /\/settings$/,
};

test.describe('Bottom Dock', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  test('[P1] should show the dock and the gear without any tap', async ({ page }) => {
    await page.goto('/');

    const dock = page.getByTestId('nav-dock');
    await expect(dock).toBeVisible();
    for (const view of DOCK_DESTINATIONS) {
      await expect(dock.getByTestId(`nav-${view}`)).toBeVisible();
    }

    // Settings is the gear in the top bar, not a dock item.
    const gear = page.getByTestId('app-header').getByTestId('nav-settings');
    await expect(gear).toBeVisible();
    await expect(dock.getByTestId('nav-settings')).toHaveCount(0);

    await expect(page.getByTestId('nav-scripture')).toHaveCount(0);
    await expect(page.getByLabel('Scripture')).toHaveCount(0);
  });

  test('[P1] should reach each destination in one tap with aria-current following', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page');

    // Home last, so it is a real navigation rather than the starting state.
    for (const view of [...ALL_DESTINATIONS.slice(1), 'home'] as const) {
      await page.getByTestId(`nav-${view}`).click();

      await expect(page).toHaveURL(PATHS[view]);
      await expect(page.getByTestId(`nav-${view}`)).toHaveAttribute('aria-current', 'page');
      for (const other of ALL_DESTINATIONS.filter((v) => v !== view)) {
        await expect(page.getByTestId(`nav-${other}`)).not.toHaveAttribute('aria-current', 'page');
      }
      // The dock stays on every view, Love Notes included.
      await expect(page.getByTestId('nav-dock')).toBeVisible();
    }
  });

  test('[P1] should keep the Love Notes composer above the dock without scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/notes');

    const sendButton = page.getByLabel(/send message/i);
    await expect(page.getByLabel(/love note message input/i)).toBeVisible();
    await expect(sendButton).toBeVisible();

    const sendBox = await sendButton.boundingBox();
    const dockBox = await page.getByTestId('nav-dock').boundingBox();
    if (!sendBox || !dockBox) throw new Error('[dock.spec] expected composer and dock boxes');
    expect(sendBox.y + sendBox.height).toBeLessThanOrEqual(dockBox.y);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('[P1] should put the Photos Upload button in the page header, not floating', async ({
    page,
    interceptNetworkCall,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // The header Upload button renders only beside a non-empty grid, so photos are mocked
    // rather than left to whatever the pool account holds.
    const photosCall = interceptNetworkCall({
      url: '**/rest/v1/photos?**',
      method: 'GET',
      fulfillResponse: {
        status: 200,
        body: [
          {
            id: 'dock-photo-1',
            user_id: 'test-user',
            storage_path: 'photos/dock.jpg',
            thumbnail_path: 'photos/dock_thumb.jpg',
            filename: 'dock.jpg',
            mime_type: 'image/jpeg',
            width: 800,
            height: 600,
            file_size: 100000,
            caption: 'Dock photo',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      },
    });

    // Stub storage URLs so thumbnails resolve
    await page.route('**/storage/v1/object/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.from('fake-image'),
      })
    );

    await page.goto('/photos');
    await photosCall;

    // The testid is kept from the old floating FAB it replaced.
    const upload = page.getByTestId('photo-gallery-upload-fab');
    await expect(upload).toBeVisible();

    const position = await upload.evaluate((el) => getComputedStyle(el).position);
    expect(position).not.toBe('fixed');

    await upload.click();
    await expect(page.getByTestId('photo-upload-modal')).toBeVisible();
  });

  test('[P0] should reach Settings from the gear and survive a reload', async ({ page }) => {
    await page.goto('/');

    // WHEN: The gear is tapped
    await navigateTo(page, 'settings');

    // THEN: Settings renders and the URL is /settings
    await page.waitForURL('**/settings');
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await expect(page.getByTestId('settings-sign-out')).toBeVisible();

    // WHEN: The page is reloaded on that URL
    await page.reload();

    // THEN: Settings renders again rather than resetting to Home — the initial
    // route ternary is untypechecked, so only this catches a missed entry.
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId('nav-settings')).toHaveAttribute('aria-current', 'page');
  });

  test('[P0] should go back to the previous view from Settings', async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, 'mood');
    await page.waitForURL('**/mood');

    await navigateTo(page, 'settings');
    await page.waitForURL('**/settings');
    await expect(page.getByTestId('settings-view')).toBeVisible();

    // WHEN: Browser back
    await page.goBack();

    // THEN: The previous view is restored
    await page.waitForURL('**/mood');
    await expect(page.getByTestId('nav-mood')).toHaveAttribute('aria-current', 'page');
  });
});
