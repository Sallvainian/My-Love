/**
 * P0 E2E: Love Notes
 *
 * Critical path: Users must be able to send and view love notes.
 * Covers message display and send functionality.
 *
 * Test IDs: 4.2-E2E-001, 4.2-E2E-002, 4.2-E2E-003
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Love Notes', () => {
  test('[P0] 4.2-E2E-001 should display love notes view', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: User navigates to /notes
    const notesCall = interceptNetworkCall({
      url: '**/rest/v1/love_notes**',
    });

    await page.goto('/notes');

    // WHEN: View loads
    await notesCall;

    // THEN: Love notes interface is visible
    await expect(page.getByRole('heading', { name: /love notes/i })).toBeVisible();
    await expect(page.getByTestId('virtualized-list')).toBeVisible();
  });

  test('[P0] 4.2-E2E-002 should display message input field', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: User is on love notes view
    const notesCall = interceptNetworkCall({
      url: '**/rest/v1/love_notes**',
    });

    await page.goto('/notes');
    await notesCall;

    // WHEN: View loads
    // THEN: Message input field and send button are visible
    await expect(page.getByLabel(/love note message input/i)).toBeVisible();
    await expect(page.getByLabel(/send message/i)).toBeVisible();
  });

  test('[P0] 4.2-E2E-003 should send a text message', async ({ page, interceptNetworkCall }) => {
    // GIVEN: User is on love notes with input field
    const notesCall = interceptNetworkCall({
      url: '**/rest/v1/love_notes**',
    });

    await page.goto('/notes');
    await notesCall;

    // WHEN: User types a message and clicks send
    const uniqueMessage = `E2E test note ${Date.now()}`;
    const messageInput = page.getByLabel(/love note message input/i);
    await messageInput.fill(uniqueMessage);

    // Use waitForResponse instead of interceptNetworkCall for the POST
    // since the message uses optimistic UI update
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/rest/v1/love_notes') && resp.request().method() === 'POST'
    );

    await page.getByLabel(/send message/i).click();

    // THEN: Message appears in the message list (optimistic update)
    await expect(page.getByTestId('love-note-message').getByText(uniqueMessage)).toBeVisible();

    // The POST call should complete successfully
    const response = await responsePromise;
    expect(response.status()).toBeLessThan(400);
  });
});
