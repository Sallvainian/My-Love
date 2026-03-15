/**
 * P0 E2E: Partner Mood View
 *
 * Critical path: Users must see partner's mood and interact.
 * Covers partner mood display and poke/kiss interactions.
 *
 * Test IDs: 4.5-E2E-001, 4.5-E2E-002
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Partner Mood View', () => {
  test('[P0] 4.5-E2E-001 should display partner mood view', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: User navigates to /partner
    // loadPartner queries /rest/v1/users (2x: own record then partner record)
    // loadPendingRequests queries /rest/v1/partner_requests
    const partnerCall = interceptNetworkCall({
      url: '**/rest/v1/users**',
    });
    const requestsCall = interceptNetworkCall({
      url: '**/rest/v1/partner_requests**',
    });

    await page.goto('/partner');

    // WHEN: View loads (network-first: wait for both queries to complete)
    await Promise.all([partnerCall, requestsCall]);

    // THEN: Partner mood view container is visible
    await expect(page.getByTestId('partner-mood-view')).toBeVisible();
  });

  test('[P0] 4.5-E2E-002 should display poke/kiss interaction buttons', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: User is on partner mood view with a connected partner.
    // loadPartner makes 2 sequential GET /rest/v1/users calls:
    //   1. select=partner_id,updated_at → current user's record
    //   2. select=id,email,display_name → partner's record
    // Mock both with the correct shapes. Await to avoid race conditions.
    await interceptNetworkCall({
      url: '**/rest/v1/users?select=partner_id*',
      fulfillResponse: {
        status: 200,
        body: { partner_id: 'partner-123', updated_at: '2024-01-01T00:00:00Z' },
      },
    });

    await interceptNetworkCall({
      url: '**/rest/v1/users?select=id*',
      fulfillResponse: {
        status: 200,
        body: { id: 'partner-123', email: 'partner@test.com', display_name: 'Test Partner' },
      },
    });

    await interceptNetworkCall({
      url: '**/rest/v1/partner_requests**',
      fulfillResponse: {
        status: 200,
        body: [],
      },
    });

    // Stub partner moods fetch
    await interceptNetworkCall({
      url: '**/rest/v1/moods**',
      fulfillResponse: {
        status: 200,
        body: [],
      },
    });

    await page.goto('/partner');

    // WHEN: View loads with connected partner
    await expect(page.getByTestId('partner-mood-view')).toBeVisible();

    // THEN: Poke and kiss interaction buttons are visible
    await expect(page.getByTestId('fab-main-button')).toBeVisible();

    // Click the FAB to expand interaction options
    await page.getByTestId('fab-main-button').click();
    await expect(page.getByTestId('poke-button')).toBeVisible();
    await expect(page.getByTestId('kiss-button')).toBeVisible();
  });
});
