/**
 * P0 E2E: Partner Mood View
 *
 * Critical path: Users must see partner's mood and interact.
 * Covers partner mood display and poke/kiss interactions.
 *
 * Test IDs: 4.5-E2E-001, 4.5-E2E-002
 */
import { test, expect } from '../../support/merged-fixtures';
import { interceptNetworkCall as fulfillOn } from '@seontechnologies/playwright-utils/intercept-network-call';

const FAKE_PARTNER_ID = '00000000-0000-4000-8000-000000000123';

test.describe('Partner Mood View', () => {
  test('[P0] 4.5-E2E-001 should display partner mood view', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: User navigates to /partner
    // loadPartner queries /rest/v1/users (2x: own record then partner record)
    // loadPendingRequests queries /rest/v1/partner_requests
    //
    // Pinned to the `select=partner*` query rather than any /rest/v1/users hit:
    // App's display-name gate reads `select=display_name` from the same table at
    // app start, and the broader glob could resolve this wait on THAT before
    // loadPartner had run.
    const partnerCall = interceptNetworkCall({
      url: '**/rest/v1/users?select=partner*',
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

  test('[P0] 4.5-E2E-002 should display poke/kiss interaction buttons', async ({ page }) => {
    // GIVEN: User is on partner mood view with a connected partner.
    // loadPartner makes 2 sequential GET /rest/v1/users calls:
    //   1. select=partner_id,updated_at → current user's record
    //   2. select=id,email,display_name → partner's record
    // Mock both with the correct shapes. The fake partner id is uuid-shaped:
    // the couple-settings refresher reuses the partner_id answer to address
    // `couple_settings`, and a non-uuid id is a 400 there (RLS answers a
    // well-formed stranger's pair with no row).
    // Each stub is awaited after the load that hits it, bounded by a timeout.
    // Standalone, because the `interceptNetworkCall` fixture drops `timeout`.
    const partnerLink = fulfillOn({
      page,
      url: '**/rest/v1/users?select=partner_id*',
      fulfillResponse: {
        status: 200,
        body: { partner_id: FAKE_PARTNER_ID, updated_at: '2024-01-01T00:00:00Z' },
      },
      timeout: 15000,
    });

    const partnerProfile = fulfillOn({
      page,
      url: '**/rest/v1/users?select=id*',
      fulfillResponse: {
        status: 200,
        body: { id: FAKE_PARTNER_ID, email: 'partner@test.com', display_name: 'Test Partner' },
      },
      timeout: 15000,
    });

    const requests = fulfillOn({
      page,
      url: '**/rest/v1/partner_requests**',
      fulfillResponse: {
        status: 200,
        body: [],
      },
      timeout: 15000,
    });

    // Stub partner moods fetch
    const moods = fulfillOn({
      page,
      url: '**/rest/v1/moods**',
      fulfillResponse: {
        status: 200,
        body: [],
      },
      timeout: 15000,
    });

    await page.goto('/partner');
    await Promise.all([partnerLink, partnerProfile, requests, moods]);

    // WHEN: View loads with connected partner
    await expect(page.getByTestId('partner-mood-view')).toBeVisible();

    // THEN: Poke and kiss interaction tiles are visible without any click
    await expect(page.getByTestId('poke-button')).toBeVisible();
    await expect(page.getByTestId('kiss-button')).toBeVisible();
  });
});
