import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PostgrestError } from '@supabase/supabase-js';

const backend = vi.hoisted(() => ({ error: null as unknown }));
vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
    rpc: async () => ({ error: backend.error }),
    from: () => ({
      insert: async () => ({ error: backend.error }),
      select: () => ({ eq: () => ({ single: async () => ({ data: { partner_id: null } }) }) }),
    }),
  },
}));
vi.mock('@/api/moodSyncService', () => ({ moodSyncService: {} }));
vi.mock('@/components/PokeKissInterface', () => ({ PokeKissInterface: () => null }));
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => state }));

import { partnerService } from '@/api/partnerService';
import { PartnerMoodView } from '@/components/PartnerMoodView/PartnerMoodView';

const state = {
  partnerMoods: [], partner: null, isLoadingPartner: false,
  syncStatus: { isOnline: true }, sentRequests: [], isSearching: false,
  searchResults: [{ id: 'target', email: 'target@example.com', displayName: 'Target' }],
  receivedRequests: [{ id: 'request', from_user_display_name: 'Sender', created_at: '2026-09-01' }],
  fetchPartnerMoods: vi.fn(), loadPartner: vi.fn(), loadPendingRequests: vi.fn(),
  searchUsers: vi.fn(), clearSearch: vi.fn(),
  sendPartnerRequest: (id: string) => partnerService.sendPartnerRequest(id),
  acceptPartnerRequest: (id: string) => partnerService.acceptPartnerRequest(id),
  declinePartnerRequest: (id: string) => partnerService.declinePartnerRequest(id),
};
const actions = [
  ['sendPartnerRequest', 'Send Request', 'send'],
  ['acceptPartnerRequest', 'Accept', 'accept'],
  ['declinePartnerRequest', 'Decline', 'decline'],
] as const;
const friendly = 'Some values are not allowed - check length and format limits';
const raw = { code: '23514', message: 'raw constraint with incidental duplicate unique words', details: 'diagnostics', hint: 'hint' };

describe('partner request CHECK presentation', () => {
  beforeEach(() => { cleanup(); backend.error = null; });

  it.each(actions)('%s keeps the original error object and diagnostics', async (method) => {
    for (const error of [{ ...raw }, new PostgrestError(raw)]) {
      backend.error = error;
      const prototype = Object.getPrototypeOf(error);
      const result = await partnerService[method]('target').catch((failure: unknown) => failure);
      expect(result).toBe(error);
      expect(Object.getPrototypeOf(result)).toBe(prototype);
      expect(result).toMatchObject({ ...raw, message: friendly });
    }
  });

  it.each(actions)('%s shows a plain backend CHECK error in the rendered caller', async (_method, button) => {
    backend.error = { ...raw };
    render(<PartnerMoodView />);
    fireEvent.click(screen.getByRole('button', { name: button }));
    await vi.waitFor(() => expect(screen.getByText(friendly)).toBeDefined());
    expect(screen.queryByText(/raw constraint/)).toBeNull();
  });

  it.each(actions)('%s retains plain non-CHECK caller fallback', async (_method, button, verb) => {
    backend.error = { ...raw, code: '23502', message: 'original database message' };
    render(<PartnerMoodView />);
    fireEvent.click(screen.getByRole('button', { name: button }));
    await vi.waitFor(() => expect(screen.getByText(`Failed to ${verb} partner request`)).toBeDefined());
    expect((backend.error as { message: string }).message).toBe('original database message');
  });

  it.each(actions)('%s retains Error instance presentation for non-CHECK errors', async (_method, button) => {
    backend.error = new Error('original error');
    render(<PartnerMoodView />);
    fireEvent.click(screen.getByRole('button', { name: button }));
    await vi.waitFor(() => expect(screen.getByText('original error')).toBeDefined());
  });

  it('retains duplicate request special handling', async () => {
    backend.error = { ...raw, code: '23505' };
    await expect(partnerService.sendPartnerRequest('target')).rejects.toThrow('You already have a pending request to this user');
  });
});
