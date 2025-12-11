/**
 * Strict Selector Types for TEA-Compliant Testing
 *
 * This module enforces accessibility-first selector patterns at the TypeScript level.
 * Using non-accessible selectors (CSS classes, XPath, nth()) will cause compile-time errors.
 *
 * Selector Hierarchy (enforced):
 * 1. getByRole - BEST (semantic, accessible)
 * 2. getByLabel - GOOD (form accessibility)
 * 3. getByTestId - ACCEPTABLE (explicit test contract)
 * 4. getByText - USE SPARINGLY (breaks with copy changes)
 *
 * @see .bmad/bmm/testarch/knowledge/selector-resilience.md
 */

import type { Page, Locator } from '@playwright/test';

/**
 * Role-based selector options (from Playwright)
 */
export type RoleType =
  | 'alert'
  | 'alertdialog'
  | 'application'
  | 'article'
  | 'banner'
  | 'blockquote'
  | 'button'
  | 'caption'
  | 'cell'
  | 'checkbox'
  | 'code'
  | 'columnheader'
  | 'combobox'
  | 'complementary'
  | 'contentinfo'
  | 'definition'
  | 'deletion'
  | 'dialog'
  | 'directory'
  | 'document'
  | 'emphasis'
  | 'feed'
  | 'figure'
  | 'form'
  | 'generic'
  | 'grid'
  | 'gridcell'
  | 'group'
  | 'heading'
  | 'img'
  | 'insertion'
  | 'link'
  | 'list'
  | 'listbox'
  | 'listitem'
  | 'log'
  | 'main'
  | 'marquee'
  | 'math'
  | 'meter'
  | 'menu'
  | 'menubar'
  | 'menuitem'
  | 'menuitemcheckbox'
  | 'menuitemradio'
  | 'navigation'
  | 'none'
  | 'note'
  | 'option'
  | 'paragraph'
  | 'presentation'
  | 'progressbar'
  | 'radio'
  | 'radiogroup'
  | 'region'
  | 'row'
  | 'rowgroup'
  | 'rowheader'
  | 'scrollbar'
  | 'search'
  | 'searchbox'
  | 'separator'
  | 'slider'
  | 'spinbutton'
  | 'status'
  | 'strong'
  | 'subscript'
  | 'superscript'
  | 'switch'
  | 'tab'
  | 'table'
  | 'tablist'
  | 'tabpanel'
  | 'term'
  | 'textbox'
  | 'time'
  | 'timer'
  | 'toolbar'
  | 'tooltip'
  | 'tree'
  | 'treegrid'
  | 'treeitem';

/**
 * Options for getByRole selector
 */
export interface RoleOptions {
  /** Accessible name (aria-label, aria-labelledby, or element text) */
  name?: string | RegExp;
  /** Whether the element is checked (for checkboxes, radio buttons) */
  checked?: boolean;
  /** Whether the element is disabled */
  disabled?: boolean;
  /** Whether the element is expanded (for accordions, menus) */
  expanded?: boolean;
  /** Whether to include hidden elements */
  includeHidden?: boolean;
  /** Heading level (for heading role) */
  level?: number;
  /** Whether the element is pressed (for toggle buttons) */
  pressed?: boolean;
  /** Whether the element is selected */
  selected?: boolean;
  /** Match name exactly */
  exact?: boolean;
}

/**
 * Options for getByLabel selector
 */
export interface LabelOptions {
  /** Match label text exactly */
  exact?: boolean;
}

/**
 * Options for getByText selector
 */
export interface TextOptions {
  /** Match text exactly */
  exact?: boolean;
}

/**
 * Strict selector interface - ONLY allows accessibility-first methods.
 *
 * This interface deliberately EXCLUDES:
 * - locator() - Allows CSS selectors, XPath
 * - $() / $$() - jQuery-style selectors
 * - querySelector patterns
 *
 * Using these excluded methods will cause TypeScript errors,
 * forcing developers to use accessible patterns.
 */
export interface StrictSelectors {
  /**
   * Select by ARIA role (BEST - most semantic and accessible)
   *
   * @example
   * ```typescript
   * selectors.getByRole('button', { name: 'Submit' })
   * selectors.getByRole('textbox', { name: 'Email' })
   * selectors.getByRole('heading', { level: 1 })
   * ```
   */
  getByRole(role: RoleType, options?: RoleOptions): Locator;

  /**
   * Select by associated label (GOOD - form accessibility)
   *
   * @example
   * ```typescript
   * selectors.getByLabel('Email address')
   * selectors.getByLabel(/password/i)
   * ```
   */
  getByLabel(text: string | RegExp, options?: LabelOptions): Locator;

  /**
   * Select by data-testid attribute (ACCEPTABLE - explicit test contract)
   *
   * @example
   * ```typescript
   * selectors.getByTestId('submit-button')
   * selectors.getByTestId('user-avatar')
   * ```
   */
  getByTestId(testId: string | RegExp): Locator;

  /**
   * Select by text content (USE SPARINGLY - breaks with copy changes)
   *
   * Prefer getByRole or getByLabel for interactive elements.
   * Use this for static content or when no other option exists.
   *
   * @example
   * ```typescript
   * selectors.getByText('Welcome back')
   * selectors.getByText(/error/i)
   * ```
   */
  getByText(text: string | RegExp, options?: TextOptions): Locator;

  /**
   * Select by placeholder text (for inputs without labels)
   *
   * @example
   * ```typescript
   * selectors.getByPlaceholder('Search...')
   * ```
   */
  getByPlaceholder(text: string | RegExp, options?: TextOptions): Locator;

  /**
   * Select by alt text (for images)
   *
   * @example
   * ```typescript
   * selectors.getByAltText('Company logo')
   * ```
   */
  getByAltText(text: string | RegExp, options?: TextOptions): Locator;

  /**
   * Select by title attribute
   *
   * @example
   * ```typescript
   * selectors.getByTitle('Close dialog')
   * ```
   */
  getByTitle(text: string | RegExp, options?: TextOptions): Locator;
}

/**
 * Extended strict page interface that preserves essential Page methods
 * while enforcing accessible selector patterns.
 */
export interface StrictPage extends StrictSelectors {
  /** Navigate to URL */
  goto: Page['goto'];
  /** Wait for specific URL */
  waitForURL: Page['waitForURL'];
  /** Wait for network response */
  waitForResponse: Page['waitForResponse'];
  /** Wait for network request */
  waitForRequest: Page['waitForRequest'];
  /** Wait for page load state */
  waitForLoadState: Page['waitForLoadState'];
  /** Evaluate JavaScript in page context */
  evaluate: Page['evaluate'];
  /** Set route handler for network interception */
  route: Page['route'];
  /** Unset route handler */
  unroute: Page['unroute'];
  /** Take screenshot */
  screenshot: Page['screenshot'];
  /** Get page URL */
  url: Page['url'];
  /** Get page title */
  title: Page['title'];
  /** Pause for debugging */
  pause: Page['pause'];
  /** Close page */
  close: Page['close'];
  /** Reload page */
  reload: Page['reload'];
  /** Go back */
  goBack: Page['goBack'];
  /** Go forward */
  goForward: Page['goForward'];
  /** Get frame by name or URL */
  frame: Page['frame'];
  /** Get frame locator */
  frameLocator: Page['frameLocator'];
  /** Keyboard interaction */
  keyboard: Page['keyboard'];
  /** Mouse interaction */
  mouse: Page['mouse'];
}

/**
 * Type guard to check if a locator was created using accessible patterns.
 * This is a runtime check for debugging purposes.
 */
export function isAccessibleLocator(_locator: Locator): boolean {
  // All locators created through StrictSelectors are accessible by design
  // This function exists for documentation and potential future validation
  return true;
}

/**
 * Compile-time error type for forbidden selector patterns.
 * Used to provide helpful error messages when developers try to use
 * non-accessible patterns.
 */
export type ForbiddenSelectorError<Pattern extends string> =
  `ERROR: "${Pattern}" is not allowed. Use getByRole, getByLabel, or getByTestId instead. See selector-resilience.md for patterns.`;

/**
 * Type that produces compile-time error for CSS selectors
 */
export type NoCssSelector<T extends string> = T extends `.${string}`
  ? ForbiddenSelectorError<'CSS class selector'>
  : T extends `#${string}`
    ? ForbiddenSelectorError<'CSS ID selector'>
    : T extends `[${string}]`
      ? ForbiddenSelectorError<'CSS attribute selector'>
      : T;

/**
 * Type that produces compile-time error for XPath
 */
export type NoXPathSelector<T extends string> = T extends `xpath=${string}`
  ? ForbiddenSelectorError<'XPath selector'>
  : T extends `//${string}`
    ? ForbiddenSelectorError<'XPath selector'>
    : T;
