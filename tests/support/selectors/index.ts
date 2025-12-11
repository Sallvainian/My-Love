/**
 * Strict Selector Factory
 *
 * Creates type-safe selector interfaces that enforce accessibility-first patterns.
 * Using CSS selectors, XPath, or nth() will cause TypeScript compile-time errors.
 *
 * @example
 * ```typescript
 * import { createSelectors } from '../support/selectors';
 *
 * test('example', async ({ page }) => {
 *   const $ = createSelectors(page);
 *
 *   // These work:
 *   await $.getByRole('button', { name: 'Submit' }).click();
 *   await $.getByLabel('Email').fill('test@example.com');
 *   await $.getByTestId('user-avatar').click();
 *
 *   // These cause TypeScript errors:
 *   // $.locator('.btn-primary')  // ERROR: locator not available
 *   // $.locator('#submit')       // ERROR: locator not available
 * });
 * ```
 *
 * @see .bmad/bmm/testarch/knowledge/selector-resilience.md
 */

import type { Page, Locator } from '@playwright/test';
import type { StrictPage, StrictSelectors, RoleType, RoleOptions, LabelOptions, TextOptions } from './types';

/**
 * Create a strict selector interface from a Playwright Page.
 *
 * The returned object only exposes accessibility-first selector methods,
 * making it impossible to use CSS selectors or XPath at compile time.
 *
 * @param page - Playwright Page object
 * @returns StrictPage interface with only accessible selector methods
 *
 * @example
 * ```typescript
 * const $ = createSelectors(page);
 * await $.getByRole('button', { name: 'Submit' }).click();
 * ```
 */
export function createSelectors(page: Page): StrictPage {
  return {
    // Accessible selector methods (ALLOWED)
    getByRole: (role: RoleType, options?: RoleOptions): Locator => page.getByRole(role, options),
    getByLabel: (text: string | RegExp, options?: LabelOptions): Locator => page.getByLabel(text, options),
    getByTestId: (testId: string | RegExp): Locator => page.getByTestId(testId),
    getByText: (text: string | RegExp, options?: TextOptions): Locator => page.getByText(text, options),
    getByPlaceholder: (text: string | RegExp, options?: TextOptions): Locator => page.getByPlaceholder(text, options),
    getByAltText: (text: string | RegExp, options?: TextOptions): Locator => page.getByAltText(text, options),
    getByTitle: (text: string | RegExp, options?: TextOptions): Locator => page.getByTitle(text, options),

    // Essential page methods (preserved)
    goto: page.goto.bind(page),
    waitForURL: page.waitForURL.bind(page),
    waitForResponse: page.waitForResponse.bind(page),
    waitForRequest: page.waitForRequest.bind(page),
    waitForLoadState: page.waitForLoadState.bind(page),
    evaluate: page.evaluate.bind(page),
    route: page.route.bind(page),
    unroute: page.unroute.bind(page),
    screenshot: page.screenshot.bind(page),
    url: page.url.bind(page),
    title: page.title.bind(page),
    pause: page.pause.bind(page),
    close: page.close.bind(page),
    reload: page.reload.bind(page),
    goBack: page.goBack.bind(page),
    goForward: page.goForward.bind(page),
    frame: page.frame.bind(page),
    frameLocator: page.frameLocator.bind(page),
    keyboard: page.keyboard,
    mouse: page.mouse,
  };
}

/**
 * Create selectors scoped to a specific locator (container).
 *
 * Useful for narrowing scope to prevent selector ambiguity when
 * multiple similar elements exist on the page.
 *
 * @param locator - Parent locator to scope selectors within
 * @returns StrictSelectors interface scoped to the container
 *
 * @example
 * ```typescript
 * const $ = createSelectors(page);
 * const form = $.getByTestId('login-form');
 * const formSelectors = createScopedSelectors(form);
 *
 * await formSelectors.getByLabel('Email').fill('test@example.com');
 * await formSelectors.getByRole('button', { name: 'Submit' }).click();
 * ```
 */
export function createScopedSelectors(locator: Locator): StrictSelectors {
  return {
    getByRole: (role: RoleType, options?: RoleOptions): Locator => locator.getByRole(role, options),
    getByLabel: (text: string | RegExp, options?: LabelOptions): Locator => locator.getByLabel(text, options),
    getByTestId: (testId: string | RegExp): Locator => locator.getByTestId(testId),
    getByText: (text: string | RegExp, options?: TextOptions): Locator => locator.getByText(text, options),
    getByPlaceholder: (text: string | RegExp, options?: TextOptions): Locator => locator.getByPlaceholder(text, options),
    getByAltText: (text: string | RegExp, options?: TextOptions): Locator => locator.getByAltText(text, options),
    getByTitle: (text: string | RegExp, options?: TextOptions): Locator => locator.getByTitle(text, options),
  };
}

/**
 * Helper to assert locator is visible with standard timeout.
 * Provides consistent timeout handling across tests.
 *
 * @param locator - Locator to check
 * @param timeout - Timeout in ms (default: 10000)
 */
export async function assertVisible(locator: Locator, timeout = 10000): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout });
}

/**
 * Helper to assert locator is hidden with standard timeout.
 *
 * @param locator - Locator to check
 * @param timeout - Timeout in ms (default: 10000)
 */
export async function assertHidden(locator: Locator, timeout = 10000): Promise<void> {
  await locator.waitFor({ state: 'hidden', timeout });
}

/**
 * Helper to filter locators by text content (safer than nth()).
 *
 * Use this instead of nth() to select specific items from a list.
 * Content-based selection is more resilient to reordering.
 *
 * @param locator - Base locator (e.g., list items)
 * @param text - Text to filter by
 * @returns Filtered locator
 *
 * @example
 * ```typescript
 * const $ = createSelectors(page);
 * const products = $.getByTestId('product-card');
 * const laptop = filterByText(products, 'MacBook Pro');
 * await laptop.click();
 * ```
 */
export function filterByText(locator: Locator, text: string | RegExp): Locator {
  return locator.filter({ hasText: text });
}

/**
 * Helper to filter locators by child element presence.
 *
 * @param locator - Base locator
 * @param childLocator - Child locator to filter by
 * @returns Filtered locator containing the child
 *
 * @example
 * ```typescript
 * const $ = createSelectors(page);
 * const rows = $.getByTestId('table-row');
 * const activeRows = filterByChild(rows, $.getByTestId('status-active'));
 * ```
 */
export function filterByChild(locator: Locator, childLocator: Locator): Locator {
  return locator.filter({ has: childLocator });
}

// Re-export types for convenience
export type { StrictPage, StrictSelectors, RoleType, RoleOptions, LabelOptions, TextOptions } from './types';
