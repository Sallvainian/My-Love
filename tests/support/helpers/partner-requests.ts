/**
 * Partner requests between throwaway accounts (`throwaway-account.ts`): one
 * sent as the sender itself, and one accepted through the receiver's Partner
 * tab, whose accept announces the link on the sender's channel
 * (`partner_linked`). Never for the worker pool, whose pairs a spec must not
 * link or unlink (AGENTS.md).
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import type { Page } from '@playwright/test';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { expect } from '../merged-fixtures';
import { SECOND_CONTEXT_READ_TIMEOUT } from './reads';
import type { Throwaway } from './throwaway-account';

const REQUEST_ACCEPT = '**/rest/v1/rpc/accept_partner_request';

/** A pending request from `from` to `to`, sent as `from` itself; returns its id. */
export async function seedRequest(from: Throwaway, to: Throwaway): Promise<string> {
  const { error: sendError } = await from.client
    .from('partner_requests')
    .insert({ from_user_id: from.userId, to_user_id: to.userId, status: 'pending' });
  if (sendError) throw new Error(`Failed to send the seed request: ${sendError.message}`);

  const { data: request, error: readError } = await to.client
    .from('partner_requests')
    .select('id')
    .eq('from_user_id', from.userId)
    .eq('to_user_id', to.userId)
    .single();
  if (readError || !request) throw new Error(`Seed request not visible: ${readError?.message}`);
  return request.id;
}

/** B accepts `requestId` from its Partner tab, and the accept RPC succeeds. */
export async function acceptFromPartnerTab(bPage: Page, requestId: string): Promise<void> {
  const accept = bPage.getByTestId(`accept-request-${requestId}`);
  await expect(accept).toBeVisible();
  const accepted = observeOn({
    page: bPage,
    method: 'POST',
    url: REQUEST_ACCEPT,
    timeout: SECOND_CONTEXT_READ_TIMEOUT,
  });
  await accept.click();
  const acceptResponse = await accepted;
  expect(acceptResponse.status).toBeGreaterThanOrEqual(200);
  expect(acceptResponse.status).toBeLessThan(300);
}
