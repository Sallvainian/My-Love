/**
 * Navigation Helpers
 *
 * Every destination is one tap away now: Home, Mood, Love Notes, Photos and
 * Partner sit in the bottom dock and Settings is the gear in the app header, all
 * carrying `nav-${view}`. The helper survives the tray's removal because its
 * call sites are spread across many specs; routing them through here means the
 * next navigation change costs one file rather than every spec.
 */
import type { Page } from '@playwright/test';

/** Every navigation destination, matching ViewType in navigationSlice.ts. */
export type NavDestination =
  | 'home'
  | 'mood'
  | 'notes'
  | 'partner'
  | 'photos'
  | 'settings';

/**
 * Navigate to a destination by clicking its dock item, or the gear for
 * Settings. The dock is always on screen, so there is nothing to open first.
 * The gear is not: Settings has its own bar while it is open and no app header,
 * so `navigateTo(page, 'settings')` works only from another view.
 */
export async function navigateTo(page: Page, view: NavDestination): Promise<void> {
  await page.getByTestId(`nav-${view}`).click();
}
