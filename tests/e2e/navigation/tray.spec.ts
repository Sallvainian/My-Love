/**
 * P0 E2E: Navigation Tray
 *
 * The tray's dismissal contract against the real app, plus the /settings deep
 * link. Four of the five `settings` registration sites are untypechecked
 * (AGENTS.md:25) — the two App route ternaries, the render chain and the tray
 * itself — so a missed one still compiles, renders nothing and resets to Home
 * on reload. The reload case below is the only thing that catches that.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo, openNavTray } from '../../support/helpers/navigation';

test.describe('Navigation Tray', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  test('[P0] should open on the hamburger and close on the panel control', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByTestId('nav-menu-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await openNavTray(page);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // The hamburger sits under the backdrop while the tray is open, which is
    // what aria-modal="true" promises, so the panel's own control is the
    // pointer route back out. Escape and the backdrop are the other two.
    await page.getByTestId('nav-tray-close').click();

    await expect(page.getByTestId('nav-tray')).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('[P0] should close on Escape', async ({ page }) => {
    await page.goto('/');
    await openNavTray(page);

    await page.keyboard.press('Escape');

    await expect(page.getByTestId('nav-tray')).toBeHidden();
    await expect(page.getByTestId('nav-menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  test('[P0] should close on an outside click', async ({ page }) => {
    await page.goto('/');
    await openNavTray(page);

    // Click the far edge of the backdrop: it spans the whole viewport, so its
    // own origin sits underneath the panel and would be intercepted.
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('[tray.spec] expected a sized viewport');
    await page.mouse.click(viewport.width - 10, Math.round(viewport.height / 2));

    await expect(page.getByTestId('nav-tray')).toBeHidden();
    await expect(page.getByTestId('nav-menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  test('[P0] should close when a destination is selected', async ({ page }) => {
    await page.goto('/');
    await openNavTray(page);

    await page.getByTestId('nav-mood').click();

    await expect(page.getByTestId('nav-tray')).toBeHidden();
    await page.waitForURL('**/mood');
  });

  test('[P0] should mark only the active destination with aria-current', async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, 'photos');
    await page.waitForURL('**/photos');

    await openNavTray(page);

    await expect(page.getByTestId('nav-photos')).toHaveAttribute('aria-current', 'page');
    for (const view of ['home', 'mood', 'notes', 'partner', 'scripture', 'settings']) {
      await expect(page.getByTestId(`nav-${view}`)).not.toHaveAttribute('aria-current', 'page');
    }
  });

  test('[P0] should reach Settings from the tray and survive a reload', async ({ page }) => {
    await page.goto('/');

    // WHEN: Settings is picked out of the tray
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

    // THEN: The previous view is restored; the tray is not involved
    await page.waitForURL('**/mood');
    await expect(page.getByTestId('nav-tray')).toBeHidden();
  });
});
