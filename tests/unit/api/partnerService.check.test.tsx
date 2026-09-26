import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostgrestError } from '@supabase/supabase-js';

const backend = vi.hoisted(() => ({ error: null as unknown, requests: [] as string[] }));
vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: async () => {
        backend.requests.push('getUser');
        return { data: { user: { id: 'user' } } };
      },
    },
    rpc: async (name: string) => {
      backend.requests.push(name);
      return { error: backend.error };
    },
    from: () => ({
      insert: async () => {
        backend.requests.push('insert');
        return { error: backend.error };
      },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { partner_id: null }, error: null }) }) }),
    }),
  },
  sessionMismatch: async () => null,
}));
vi.mock('@/api/moodSyncService', () => ({ moodSyncService: {} }));
vi.mock('@/components/PokeKissInterface', () => ({ PokeKissInterface: () => null }));
vi.mock('@/stores/useAppStore', () => ({ useAppStore: () => state }));

import { partnerService } from '@/api/partnerService';
import { PartnerMoodView } from '@/components/PartnerMoodView/PartnerMoodView';

const state = {
  partnerMoods: [], partner: null, isLoadingPartner: false,
  syncStatus: { isOnline: true }, sentRequests: [], isSearching: false,
  searchResult: { status: 'found', user: { id: 'target', email: 'target@example.com', displayName: 'Target' } },
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

/**
 * Click an action's button in the rendered view. Send Request exists only under
 * an answered search for the address in the box, so that one searches first.
 */
async function clickAction(user: ReturnType<typeof userEvent.setup>, button: string) {
  if (button === 'Send Request') {
    await user.type(screen.getByLabelText("Your partner's email"), 'target@example.com');
    await user.click(screen.getByRole('button', { name: 'Find' }));
  }
  await user.click(screen.getByRole('button', { name: button }));
}
const raw = { code: '23514', message: 'raw constraint with incidental duplicate unique words', details: 'diagnostics', hint: 'hint' };

describe('partner request CHECK presentation', () => {
  beforeEach(() => { cleanup(); backend.error = null; });

  it.each(actions)('%s logs an independent raw CHECK diagnostic before mapping its message', async (method) => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const error of [{ ...raw }, new PostgrestError(raw), { ...raw, details: null, hint: null }]) {
      logError.mockClear();
      const originalDiagnostics = { code: error.code, message: error.message, details: error.details, hint: error.hint };
      backend.error = error;
      const result = await partnerService[method]('target').catch((failure: unknown) => failure);
      expect(result).toBe(error);
      expect(error.message).toBe(friendly);
      expect(logError).toHaveBeenCalledTimes(2);
      expect(logError).toHaveBeenNthCalledWith(1, `[Supabase] PartnerService.${method}:`, originalDiagnostics);
      expect(logError.mock.calls[0]?.[1]).not.toBe(error);
      expect(logError.mock.calls[1]?.[0]).toMatch(/^\[PartnerService\] Error (sending|accepting|declining) partner request:$/);
      expect(logError.mock.calls[1]?.[1]).toBe(error);
    }
  });

  it.each(actions)('%s leaves non-CHECK diagnostics unchanged', async (method) => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = { ...raw, code: '23502', message: 'original database message' };
    backend.error = error;
    const result = await partnerService[method]('target').catch((failure: unknown) => failure);
    expect(result).toBe(error);
    expect(error.message).toBe('original database message');
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0]?.[1]).toBe(error);
    expect(logError.mock.calls[0]?.[0]).not.toContain('[Supabase]');
  });

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
    const user = userEvent.setup();
    render(<PartnerMoodView />);
    await clickAction(user, button);
    await vi.waitFor(() => expect(screen.getByText(friendly)).toBeDefined());
    expect(screen.queryByText(/raw constraint/)).toBeNull();
  });

  it.each(actions)('%s retains plain non-CHECK caller fallback', async (_method, button, verb) => {
    backend.error = { ...raw, code: '23502', message: 'original database message' };
    const user = userEvent.setup();
    render(<PartnerMoodView />);
    await clickAction(user, button);
    await vi.waitFor(() => expect(screen.getByText(`Failed to ${verb} partner request`)).toBeDefined());
    expect((backend.error as { message: string }).message).toBe('original database message');
  });

  it.each(actions)('%s retains Error instance presentation for non-CHECK errors', async (_method, button) => {
    backend.error = new Error('original error');
    const user = userEvent.setup();
    render(<PartnerMoodView />);
    await clickAction(user, button);
    await vi.waitFor(() => expect(screen.getByText('original error')).toBeDefined());
  });

  it('retains duplicate request special handling', async () => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.error = { ...raw, code: '23505' };
    await expect(partnerService.sendPartnerRequest('target')).rejects.toThrow('You already have a pending request to this user');
    expect(logError).toHaveBeenCalledExactlyOnceWith(
      '[PartnerService] Error sending partner request:',
      expect.objectContaining({ message: 'You already have a pending request to this user' })
    );
    expect(backend.error).toEqual({ ...raw, code: '23505' });
  });
});

describe('partner requests offline (ticket 11)', () => {
  beforeEach(() => {
    cleanup();
    backend.error = null;
    backend.requests = [];
  });

  it.each(actions)(
    '%s is refused before any request, with the offline reason in the rendered caller',
    async (_method, button, verb) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const user = userEvent.setup();
      render(<PartnerMoodView />);

      await clickAction(user, button);

      await vi.waitFor(() =>
        expect(screen.getByTestId('partner-connection-error')).toHaveTextContent(
          `You are offline. Partner requests need a connection to ${verb}.`
        )
      );
      expect(backend.requests).toEqual([]);
    }
  );

  it.each([
    ['sendPartnerRequest', ['getUser', 'insert']],
    ['acceptPartnerRequest', ['accept_partner_request']],
    ['declinePartnerRequest', ['decline_partner_request']],
  ] as const)('%s goes out as before once online', async (method, expectedRequests) => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await partnerService[method]('target');
    expect(backend.requests).toEqual(expectedRequests);
  });
});

// DW-292: the server, not the client, refuses linking someone who already has
// a partner -- accept_partner_request raises this P0001. PostgREST hands it
// back as a plain object, which the caller would otherwise show as the bare
// "Failed to accept partner request".
describe('accepting a request when one of the pair already has a partner', () => {
  const refusal = { code: 'P0001', message: 'One or both users already have a partner', details: null, hint: null };
  const explained = 'This request can no longer be accepted: one of you already has a partner.';

  beforeEach(() => {
    cleanup();
    backend.error = null;
  });

  it('rejects with the explanation as an Error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.error = { ...refusal };
    const result = await partnerService.acceptPartnerRequest('request').catch((failure: unknown) => failure);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe(explained);
  });

  it('shows the explanation in the rendered caller', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.error = { ...refusal };
    const user = userEvent.setup();
    render(<PartnerMoodView />);
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await vi.waitFor(() => expect(screen.getByTestId('partner-connection-error')).toHaveTextContent(explained));
  });
});
