import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import type { Database } from '../../../src/types/database.types';
import { createCheckErrorPathData } from '../../support/factories/check-error-path-data';

test.describe('DW-38 CHECK error presentation', () => {
  test(
    '[P1] DW38-E2E-001 note send and retry show CHECK text, then successful retry clears it',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, authToken, interceptNetworkCall, recurse }) => {
      expect(authToken).not.toBe('');
      const { friendlyCheck, checkError, noteId, createdAt, content } = createCheckErrorPathData();
      const load = interceptNetworkCall({
        method: 'GET',
        url: '**/rest/v1/love_notes_visible**',
        fulfillResponse: { status: 200, body: [] },
      });
      const firstSend = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/love_notes?**',
        fulfillResponse: { status: 400, body: checkError },
      });
      await page.goto('/notes');
      await load;
      await log.step('Send a message that receives a CHECK failure');
      await page.getByLabel('Love note message input').fill(content);
      await page.getByLabel('Send message', { exact: true }).click();
      const first = await firstSend;
      expect(first.status).toBe(400);
      const payload = first.requestJson as Database['public']['Tables']['love_notes']['Insert'];
      expect(payload.idempotency_key).toEqual(expect.any(String));
      await recurse(
        () => page.evaluate(() => window.__APP_STORE__?.getState().notesError),
        (error) => error === friendlyCheck,
        { timeout: 10000 }
      );
      const bubble = page.getByTestId('love-note-message').filter({ hasText: content });
      await expect(bubble).toHaveCount(1);
      await expect(page.getByText(friendlyCheck, { exact: true })).toBeVisible();
      await expect(page.getByText(checkError.message, { exact: true })).toHaveCount(0);

      await log.step('Retry receives the same CHECK and keeps the retry action');
      const failedRetry = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/love_notes?**',
        fulfillResponse: { status: 400, body: checkError },
      });
      await bubble.getByRole('button', { name: 'Retry sending message' }).click();
      const retried = await failedRetry;
      expect(retried.status).toBe(400);
      expect(retried.requestJson).toEqual(payload);
      await recurse(
        () => page.evaluate((key) => {
          const note = window.__APP_STORE__?.getState().notes.find((entry) => entry.tempId === key);
          return !!note?.error && !note.sending;
        }, payload.idempotency_key),
        (failed) => failed,
        { timeout: 10000 }
      );
      await expect(bubble.getByRole('button', { name: 'Retry sending message' })).toBeVisible();
      await expect(page.getByText(friendlyCheck, { exact: true })).toBeVisible();

      await log.step('Successful retry replaces the optimistic row and dismisses the CHECK banner');
      // maybeSingle on POST accepts the one-row representation array from PostgREST.
      // All writes are fulfilled locally; nothing is inserted or deleted in the shared database.
      const successfulRetry = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/love_notes?**',
        fulfillResponse: {
          status: 201,
          body: [{ ...payload, id: noteId, created_at: createdAt }],
        },
      });
      await bubble.getByRole('button', { name: 'Retry sending message' }).click();
      const recovered = await successfulRetry;
      expect(recovered.status).toBe(201);
      expect(recovered.requestJson).toEqual(payload);
      await recurse(
        () => page.evaluate((id) => {
          const state = window.__APP_STORE__?.getState();
          const note = state?.notes.find((entry) => entry.id === id);
          return !!note && !note.error && !note.sending && state?.notesError === null;
        }, noteId),
        (settled) => settled,
        { timeout: 10000 }
      );
      await expect(bubble).toHaveCount(1);
      await expect(bubble).toBeVisible();
      await expect(bubble.getByRole('button', { name: 'Retry sending message' })).toHaveCount(0);
      await expect(page.getByText(friendlyCheck, { exact: true })).toHaveCount(0);
    }
  );

  test(
    '[P1] DW38-E2E-send partner send presents a plain JSON CHECK error',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, authToken, interceptNetworkCall }) => {
      const data = createCheckErrorPathData();
      const { friendlyCheck, checkError, targetId } = data;
      const userId = tokenUserId(authToken);
      const { partnerRead, profiles, requests } = interceptPartnerReads(interceptNetworkCall, data, []);
      const write = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/partner_requests',
        fulfillResponse: { status: 400, body: checkError },
      });
      await page.goto('/partner');
      await Promise.all([partnerRead, requests]);
      await log.step('Attempt to send a partner request');
      await page.getByLabel('Search by email or display name').fill('DW38');
      await profiles;
      await page.getByRole('button', { name: 'Send Request', exact: true }).click();
      const response = await write;
      expect(response.status).toBe(400);
      expect(response.responseJson).toEqual(checkError);
      expect(response.requestJson).toEqual({ from_user_id: userId, to_user_id: targetId, status: 'pending' });
      await expectPlainCheckBanner(page, friendlyCheck);
      await expect(page.getByRole('button', { name: 'Send Request', exact: true })).toBeVisible();
    }
  );

  const incomingActions = [
    {
      action: 'accept',
      writeUrl: '**/rest/v1/rpc/accept_partner_request',
      button: 'Accept',
    },
    {
      action: 'decline',
      writeUrl: '**/rest/v1/rpc/decline_partner_request',
      button: 'Decline',
    },
  ] as const;

  for (const { action, writeUrl, button } of incomingActions) {
    test(
      `[P1] DW38-E2E-${action} partner ${action} presents a plain JSON CHECK error`,
      { annotation: [{ type: 'skipNetworkMonitoring' }] },
      async ({ page, authToken, interceptNetworkCall }) => {
        const data = createCheckErrorPathData();
        const { friendlyCheck, checkError, targetId, requestId, createdAt } = data;
        const userId = tokenUserId(authToken);
        const { partnerRead, profiles, requests } = interceptPartnerReads(interceptNetworkCall, data, [
          { id: requestId, from_user_id: targetId, to_user_id: userId, status: 'pending', created_at: createdAt },
        ]);
        const write = interceptNetworkCall({
          method: 'POST',
          url: writeUrl,
          fulfillResponse: { status: 400, body: checkError },
        });
        await page.goto('/partner');
        await Promise.all([partnerRead, requests]);
        await log.step(`Attempt to ${action} a partner request`);
        await profiles;
        await page.getByRole('button', { name: button, exact: true }).click();
        const response = await write;
        expect(response.status).toBe(400);
        expect(response.responseJson).toEqual(checkError);
        expect(response.requestJson).toEqual({ p_request_id: requestId });
        await expectPlainCheckBanner(page, friendlyCheck);
        // The incoming request stays actionable: both controls remain.
        await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Decline', exact: true })).toBeVisible();
      }
    );
  }
});

/** The signed-in worker's user id, read from its access token's `sub`. */
function tokenUserId(authToken: string): string {
  const { sub } = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64url').toString()) as { sub: string };
  expect(sub).toEqual(expect.any(String));
  return sub;
}

/**
 * Fakes only this browser's partner-screen reads; never unlinks worker-pool
 * users. `pendingRequests` is what the partner_requests read returns.
 */
function interceptPartnerReads(
  interceptNetworkCall: InterceptNetworkCallFn,
  { targetId, createdAt, email }: ReturnType<typeof createCheckErrorPathData>,
  pendingRequests: Array<Record<string, string>>
) {
  const partnerRead = interceptNetworkCall({
    method: 'GET',
    url: '**/rest/v1/users?select=partner_id*',
    fulfillResponse: { status: 200, body: { partner_id: null, updated_at: createdAt } },
  });
  const profiles = interceptNetworkCall({
    method: 'GET',
    url: '**/rest/v1/users?select=id*',
    fulfillResponse: {
      status: 200,
      body: [{ id: targetId, email, display_name: 'DW38 Partner' }],
    },
  });
  const requests = interceptNetworkCall({
    method: 'GET',
    url: '**/rest/v1/partner_requests?**',
    fulfillResponse: { status: 200, body: pendingRequests },
  });
  return { partnerRead, profiles, requests };
}

/** The rejected store action rethrows unchanged; this banner is component-local state. */
async function expectPlainCheckBanner(page: Page, friendlyCheck: string) {
  const banner = page.getByTestId('partner-connection-error');
  await expect(banner).toHaveText(friendlyCheck);
  await expect(banner).not.toContainText('dw38_unique_length_check');
  await expect(banner).not.toContainText('new row');
}
