/**
 * Accepting a partner request tells the sender the link exists.
 *
 * The sender's Partner tab re-reads its partner only on mount, a signed-in
 * start or a reconnect, so without a message it showed "Connect with Your
 * Partner" until a reload. The accepting device announces the link on the
 * sender's mood topic (PARTNER_LINKED_EVENT in moodSyncService) and re-arms its
 * own mood channel, whose partner snapshot was taken while unlinked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const acceptPartnerRequest = vi.fn();
const announcePartnerLinked = vi.fn();
const refreshPartnerSnapshots = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(async () => ({ status: 'unlinked' })),
}));

vi.mock('../../../src/api/partnerService', () => ({
  partnerService: {
    acceptPartnerRequest: (id: string) => acceptPartnerRequest(id),
    getPartner: vi.fn(async () => ({ status: 'unlinked' })),
    getPendingRequests: vi.fn(async () => ({ sent: [], received: [] })),
  },
}));

vi.mock('../../../src/api/moodSyncService', () => ({
  moodSyncService: {
    announcePartnerLinked: (id: string) => announcePartnerLinked(id),
    refreshPartnerSnapshots: () => refreshPartnerSnapshots(),
  },
}));

import type { PartnerRequest } from '../../../src/api/partnerService';
import { useAppStore } from '../../../src/stores/useAppStore';

const ME = 'USER-ME';
const SENDER = 'USER-SENDER';

const received: PartnerRequest = {
  id: 'request-1',
  from_user_id: SENDER,
  to_user_id: ME,
  other_display_name: 'Sender',
  other_email: 'sender@example.test',
  status: 'pending',
  created_at: '2026-09-26T10:00:00Z',
};

describe('acceptPartnerRequest announces the link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    announcePartnerLinked.mockResolvedValue(undefined);
    refreshPartnerSnapshots.mockResolvedValue(undefined);
    useAppStore.getState().setAuthUser(ME);
    useAppStore.setState({ receivedRequests: [received] });
  });

  it('tells the sender and re-arms this device once the accept succeeds', async () => {
    acceptPartnerRequest.mockResolvedValue(undefined);

    await useAppStore.getState().acceptPartnerRequest('request-1');

    expect(acceptPartnerRequest).toHaveBeenCalledWith('request-1');
    expect(announcePartnerLinked).toHaveBeenCalledExactlyOnceWith(SENDER);
    expect(refreshPartnerSnapshots).toHaveBeenCalledTimes(1);
  });

  it('announces nothing when the accept is refused', async () => {
    acceptPartnerRequest.mockRejectedValue(new Error('One or both users already have a partner'));

    await expect(useAppStore.getState().acceptPartnerRequest('request-1')).rejects.toThrow();

    expect(announcePartnerLinked).not.toHaveBeenCalled();
    expect(refreshPartnerSnapshots).not.toHaveBeenCalled();
  });

  it('a failed announcement does not fail the accept', async () => {
    acceptPartnerRequest.mockResolvedValue(undefined);
    announcePartnerLinked.mockRejectedValue(new Error('Unauthorized'));

    await expect(useAppStore.getState().acceptPartnerRequest('request-1')).resolves.toBeUndefined();
  });
});
