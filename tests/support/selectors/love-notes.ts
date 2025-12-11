/**
 * Love Notes Domain Selectors
 *
 * Pre-defined selectors for Love Notes feature testing.
 * All selectors follow accessibility-first hierarchy.
 *
 * Usage:
 * ```typescript
 * import { loveNotesSelectors } from '../support/selectors/love-notes';
 *
 * test('send message', async ({ page }) => {
 *   const $ = loveNotesSelectors(page);
 *   await $.messageInput.fill('Hello!');
 *   await $.sendButton.click();
 * });
 * ```
 *
 * @see docs/05-Epics-Stories/epic-2-love-notes.md
 */

import type { Page, Locator } from '@playwright/test';

/**
 * API endpoint patterns for network interception.
 * Use with page.route() for mocking.
 */
export const LOVE_NOTES_API = {
  /** Main love_notes table endpoint */
  messages: '**/rest/v1/love_notes**',
  /** Realtime subscription endpoint */
  realtime: '**/realtime/**',
  /** Storage bucket for images */
  storage: '**/storage/v1/**',
} as const;

/**
 * Love Notes selectors interface.
 * All selectors use accessibility-first patterns.
 */
export interface LoveNotesSelectors {
  // Navigation
  /** Navigation button to Love Notes section */
  navButton: Locator;

  // Message composition
  /** Message input textbox */
  messageInput: Locator;
  /** Send message button */
  sendButton: Locator;
  /** Character counter display */
  characterCounter: Locator;

  // Image attachments
  /** Attach image button */
  attachImageButton: Locator;
  /** Image preview container */
  imagePreview: Locator;
  /** Remove attached image button */
  removeImageButton: Locator;
  /** Hidden file input (use for setInputFiles) */
  fileInput: Locator;

  // Message list
  /** Message list container */
  messageList: Locator;
  /** Individual message items */
  messageItems: Locator;
  /** Loading indicator */
  loadingIndicator: Locator;
  /** Empty state (no messages) */
  emptyState: Locator;

  // Message states
  /** Sending indicator (optimistic update in progress) */
  sendingIndicator: Locator;
  /** Error alert (send failed) */
  errorIndicator: Locator;

  // Connection status
  /** Connection status indicator */
  connectionStatus: Locator;

  // Helper methods
  /** Get a specific message by content */
  getMessageByText: (text: string | RegExp) => Locator;
  /** Get user's own messages (right-aligned) */
  getUserMessages: () => Locator;
  /** Get partner's messages (left-aligned) */
  getPartnerMessages: () => Locator;
}

/**
 * Create Love Notes selectors for a page.
 *
 * @param page - Playwright Page object
 * @returns LoveNotesSelectors with all pre-defined locators
 *
 * @example
 * ```typescript
 * const $ = loveNotesSelectors(page);
 *
 * await $.messageInput.fill('I love you!');
 * await $.sendButton.click();
 * await expect($.getMessageByText('I love you!')).toBeVisible();
 * ```
 */
export function loveNotesSelectors(page: Page): LoveNotesSelectors {
  return {
    // Navigation - use testId as nav items may not have semantic roles
    navButton: page.getByTestId('nav-notes'),

    // Message composition - aria-label based (from MessageInput.tsx)
    messageInput: page.getByLabel('Love note message input'),
    sendButton: page.getByRole('button', { name: /send message/i }),
    characterCounter: page.getByText(/\/1000$/), // e.g., "950/1000"

    // Image attachments - aria-label based
    attachImageButton: page.getByRole('button', { name: /attach image/i }),
    imagePreview: page.getByTestId('image-preview'),
    removeImageButton: page.getByRole('button', { name: /remove|cancel|delete/i }),
    // File input is hidden, must use locator (exception to strict rule)
    fileInput: page.locator('input[type="file"][accept*="image"]'),

    // Message list
    messageList: page.getByTestId('message-list'),
    messageItems: page.getByTestId('message-item'),
    loadingIndicator: page.getByTestId('loading-indicator'),
    emptyState: page.getByText(/no messages|start a conversation|say something/i),

    // Message states
    sendingIndicator: page.getByText(/sending/i),
    errorIndicator: page.getByRole('alert'),

    // Connection status
    connectionStatus: page.getByTestId('connection-status'),

    // Helper methods
    getMessageByText: (text: string | RegExp): Locator => {
      return page.getByTestId('message-item').filter({ hasText: text });
    },

    getUserMessages: (): Locator => {
      return page.getByTestId('message-item').filter({
        has: page.locator('[data-sender="user"]'),
      });
    },

    getPartnerMessages: (): Locator => {
      return page.getByTestId('message-item').filter({
        has: page.locator('[data-sender="partner"]'),
      });
    },
  };
}

/**
 * Mock message factory for test data.
 *
 * @param overrides - Partial message fields to override
 * @returns Mock message object matching love_notes table schema
 */
export function createMockMessage(
  overrides: Partial<{
    id: string;
    content: string;
    sender_id: string;
    recipient_id: string;
    created_at: string;
    read_at: string | null;
    image_url: string | null;
  }> = {}
) {
  const timestamp = new Date().toISOString();
  return {
    id: overrides.id ?? `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    content: overrides.content ?? `Test message at ${timestamp}`,
    sender_id: overrides.sender_id ?? process.env.VITE_TEST_USER_ID ?? 'test-user-id',
    recipient_id: overrides.recipient_id ?? process.env.VITE_TEST_PARTNER_ID ?? 'test-partner-id',
    created_at: overrides.created_at ?? timestamp,
    read_at: overrides.read_at ?? null,
    image_url: overrides.image_url ?? null,
  };
}

/**
 * Create multiple mock messages for pagination/list tests.
 *
 * @param count - Number of messages to create
 * @param baseOptions - Base options applied to all messages
 * @returns Array of mock messages, newest first
 */
export function createMockMessages(
  count: number,
  baseOptions: Partial<{ sender_id: string; recipient_id: string }> = {}
) {
  const messages = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    messages.push(
      createMockMessage({
        ...baseOptions,
        content: `Test message ${i + 1} of ${count}`,
        created_at: new Date(baseTime - i * 60000).toISOString(), // 1 minute apart
      })
    );
  }

  return messages;
}

/**
 * Wait for Love Notes API to respond.
 * Use after navigation to ensure data is loaded.
 *
 * @param page - Playwright Page
 * @param options - Wait options
 */
export async function waitForMessagesLoaded(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  await page.waitForResponse(
    (resp) =>
      resp.url().includes('love_notes') &&
      resp.request().method() === 'GET' &&
      resp.status() >= 200 &&
      resp.status() < 400,
    { timeout }
  );
}

/**
 * Set up mock API responses before navigation.
 * MUST be called BEFORE navigating to Love Notes.
 *
 * @param page - Playwright Page
 * @param mockMessages - Messages to return from GET
 * @param options - Additional mock options
 */
export async function setupMockApi(
  page: Page,
  mockMessages: ReturnType<typeof createMockMessage>[],
  options: {
    /** Mock POST response (message send) */
    onPost?: (data: unknown) => unknown;
    /** Simulate POST error */
    postError?: { status: number; message: string };
    /** Delay POST response (ms) */
    postDelay?: number;
  } = {}
): Promise<void> {
  await page.route(LOVE_NOTES_API.messages, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMessages),
      });
    }

    if (method === 'POST') {
      if (options.postDelay) {
        await new Promise((resolve) => setTimeout(resolve, options.postDelay));
      }

      if (options.postError) {
        return route.fulfill({
          status: options.postError.status,
          contentType: 'application/json',
          body: JSON.stringify({ error: options.postError.message }),
        });
      }

      const postData = route.request().postDataJSON();
      const response = options.onPost
        ? options.onPost(postData)
        : {
            id: `new-${Date.now()}`,
            ...postData,
            created_at: new Date().toISOString(),
          };

      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }

    return route.continue();
  });
}
