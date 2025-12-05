/**
 * Network Mocking Helpers for E2E Tests
 *
 * Provides functions to mock Supabase API responses for deterministic testing.
 * Use these helpers to test empty states, error handling, and edge cases
 * without depending on actual database content.
 */

import { Page } from '@playwright/test';

/**
 * Mock the love_notes API to return an empty array.
 * Use this for testing the "no messages" empty state.
 */
export async function mockEmptyLoveNotes(page: Page): Promise<void> {
  await page.route('**/rest/v1/love_notes*', (route) =>
    route.fulfill({ json: [] })
  );
}

/**
 * Mock the mood_entries API to return an empty array.
 * Use this for testing the mood history empty state.
 */
export async function mockEmptyMoodHistory(page: Page): Promise<void> {
  await page.route('**/rest/v1/mood_entries*', (route) =>
    route.fulfill({ json: [] })
  );
}

/**
 * Mock the photos API to return an empty array.
 * Use this for testing the photo gallery empty state.
 */
export async function mockEmptyPhotos(page: Page): Promise<void> {
  await page.route('**/rest/v1/photos*', (route) =>
    route.fulfill({ json: [] })
  );
}

/**
 * Mock a Supabase API endpoint to return a server error (500).
 * Use this for testing error handling and retry logic.
 */
export async function mockSupabaseError(
  page: Page,
  endpoint: string,
  statusCode = 500
): Promise<void> {
  await page.route(`**/rest/v1/${endpoint}*`, (route) =>
    route.fulfill({ status: statusCode })
  );
}

/**
 * Mock love_notes to return a specific set of messages.
 * Useful for testing specific UI states with controlled data.
 */
export async function mockLoveNotesWithData(
  page: Page,
  messages: Array<{
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    status?: 'sent' | 'delivered' | 'read';
  }>
): Promise<void> {
  await page.route('**/rest/v1/love_notes*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(messages),
    });
  });
}

/**
 * Mock mood_entries to return a specific set of entries.
 * Useful for testing timeline rendering with controlled data.
 */
export async function mockMoodHistoryWithData(
  page: Page,
  entries: Array<{
    id: string;
    mood_level: number;
    mood_label: string;
    notes?: string;
    created_at: string;
  }>
): Promise<void> {
  await page.route('**/rest/v1/mood_entries*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(entries),
    });
  });
}

/**
 * Clear all route mocks.
 * Call this in afterEach if you need to restore real network behavior.
 */
export async function clearAllMocks(page: Page): Promise<void> {
  await page.unrouteAll();
}
