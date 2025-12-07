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

/**
 * Mock image upload edge function to return success.
 * Use this for testing image upload flows without hitting real storage.
 */
export async function mockImageUploadSuccess(page: Page): Promise<void> {
  // Mock the edge function for image upload
  await page.route('**/functions/v1/upload-love-note-image*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        storagePath: `test-user/${Date.now()}-test.jpg`,
        size: 50000,
        mimeType: 'image/jpeg',
      }),
    });
  });

  // Mock POST to love_notes (insert with image)
  await page.route('**/rest/v1/love_notes*', (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = request.postDataJSON() || {};
      } catch {
        // Ignore parse errors
      }
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: `mock-${Date.now()}`,
            from_user_id: body?.from_user_id || 'test-user',
            to_user_id: body?.to_user_id || 'partner-user',
            content: body?.content || '',
            image_url: body?.image_url || null,
            created_at: new Date().toISOString(),
          },
        ]),
      });
    } else {
      // For GET requests, return empty array or pass through
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  });
}

/**
 * Mock image upload to fail for testing error handling.
 */
export async function mockImageUploadFailure(page: Page): Promise<void> {
  await page.route('**/functions/v1/upload-love-note-image*', (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'Upload failed',
      }),
    });
  });
}

/**
 * Mock partner configuration for tests that require a partner.
 * Mocks the users table to return a partner_id and user_profiles for partner info.
 */
export async function mockPartnerConfigured(page: Page): Promise<void> {
  const mockUserId = 'test-user-id';
  const mockPartnerId = 'mock-partner-id';

  // Mock users table to return user with partner_id
  await page.route('**/rest/v1/users*', (route) => {
    const url = route.request().url();
    // For single user lookup
    if (url.includes('select=') && url.includes('eq.id')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockUserId,
          partner_id: mockPartnerId,
          updated_at: new Date().toISOString(),
        }),
      });
    } else {
      route.continue();
    }
  });

  // Mock user_profiles for partner info
  await page.route('**/rest/v1/user_profiles*', (route) => {
    const url = route.request().url();
    if (url.includes(mockPartnerId)) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockPartnerId,
          display_name: 'Test Partner',
          avatar_url: null,
        }),
      });
    } else {
      route.continue();
    }
  });
}

/**
 * Complete mock setup for image upload tests.
 * Combines partner config + image upload + love_notes mocking.
 * Call this before navigating to ensure all routes are set up.
 */
export async function mockImageUploadTestEnvironment(page: Page): Promise<void> {
  const mockUserId = 'test-user-id';
  const mockPartnerId = 'mock-partner-id';

  // Mock users table to return user with partner_id
  await page.route('**/rest/v1/users*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: mockUserId,
        partner_id: mockPartnerId,
        updated_at: new Date().toISOString(),
      }),
    });
  });

  // Mock user_profiles for partner info
  await page.route('**/rest/v1/user_profiles*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: mockPartnerId,
        display_name: 'Test Partner',
        avatar_url: null,
      }),
    });
  });

  // Mock the edge function for image upload
  await page.route('**/functions/v1/upload-love-note-image*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        storagePath: `${mockUserId}/${Date.now()}-test.jpg`,
        size: 50000,
        mimeType: 'image/jpeg',
      }),
    });
  });

  // Mock love_notes API
  await page.route('**/rest/v1/love_notes*', (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = request.postDataJSON() || {};
      } catch {
        // Ignore parse errors
      }
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: `mock-${Date.now()}`,
            from_user_id: mockUserId,
            to_user_id: mockPartnerId,
            content: body?.content || '',
            image_url: body?.image_url || null,
            created_at: new Date().toISOString(),
          },
        ]),
      });
    } else {
      // For GET requests, return empty array
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  });
}
