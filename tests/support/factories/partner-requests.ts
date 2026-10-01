import { randomUUID } from 'node:crypto';
import type { Database } from '../../../src/types/database.types';

type PendingPartnerRequest =
  Database['public']['Functions']['get_my_pending_partner_requests']['Returns'][number];

/**
 * A complete `get_my_pending_partner_requests` row as the RPC returns it, for
 * answering the partner screen's request read in the browser. Between two
 * fresh ids unless overridden; a spec sets the side that must be its own user.
 */
export function createPartnerRequestRow(
  overrides: Partial<PendingPartnerRequest> = {}
): PendingPartnerRequest {
  return {
    id: randomUUID(),
    from_user_id: randomUUID(),
    to_user_id: randomUUID(),
    created_at: '2026-09-01T00:00:00.000Z',
    other_display_name: 'Request Sender',
    other_email: 'sender@example.test',
    ...overrides,
  };
}
