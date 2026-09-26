/**
 * PartnerMoodView's request lists name the other person: their chosen name,
 * else their sign-in email. Both used to read "Unknown User" for every request
 * (see 20260926010000_my_pending_partner_requests.sql).
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerRequest } from '../../../api/partnerService';

vi.mock('../../../api/supabaseClient', () => ({ supabase: {} }));
vi.mock('../../../api/moodSyncService', () => ({
  moodSyncService: { subscribeMoodUpdates: vi.fn(async () => () => {}) },
}));
vi.mock('../../PokeKissInterface', () => ({ PokeKissInterface: () => null }));
vi.mock('../../../stores/useAppStore', () => ({ useAppStore: () => state }));

import { PartnerMoodView } from '../PartnerMoodView';

function request(overrides: Partial<PartnerRequest>): PartnerRequest {
  return {
    id: 'r',
    from_user_id: 'from',
    to_user_id: 'to',
    other_display_name: null,
    other_email: null,
    status: 'pending',
    created_at: '2026-09-26T10:00:00Z',
    ...overrides,
  };
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    partnerMoods: [],
    fetchPartnerMoods: vi.fn(async () => {}),
    syncStatus: { isOnline: true },
    partner: null,
    isLoadingPartner: false,
    partnerLoadError: false,
    sentRequests: [] as PartnerRequest[],
    receivedRequests: [] as PartnerRequest[],
    searchResult: null,
    isSearching: false,
    loadPartner: vi.fn(),
    loadPendingRequests: vi.fn(),
    searchUsers: vi.fn(),
    clearSearch: vi.fn(),
    sendPartnerRequest: vi.fn(),
    acceptPartnerRequest: vi.fn(),
    declinePartnerRequest: vi.fn(),
    ...overrides,
  };
}

let state = makeState();

describe('PartnerMoodView request lists', () => {
  beforeEach(() => {
    cleanup();
  });

  it('names the other person on each list, by chosen name or else by email', () => {
    state = makeState({
      sentRequests: [
        request({ id: 's1', other_display_name: 'Harper', other_email: 'harper@example.test' }),
        request({ id: 's2', other_email: 'unnamed@example.test' }),
      ],
      receivedRequests: [
        request({ id: 'r1', other_display_name: 'Jessie', other_email: 'jessie@example.test' }),
      ],
    });
    render(<PartnerMoodView />);

    const sent = within(screen.getByTestId('sent-requests-list'));
    expect(sent.getByText('Harper')).toBeInTheDocument();
    expect(sent.getByText('unnamed@example.test')).toBeInTheDocument();
    const received = within(screen.getByTestId('received-requests-list'));
    expect(received.getByText('Jessie')).toBeInTheDocument();
    expect(screen.queryByText('Unknown User')).not.toBeInTheDocument();
  });
});
