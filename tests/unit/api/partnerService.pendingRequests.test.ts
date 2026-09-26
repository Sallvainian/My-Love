/**
 * `partnerService.getPendingRequests`: the Partner tab's two request lists.
 *
 * The users SELECT policy hides every unlinked account from the caller, and a
 * pending request is always between two unlinked people, so the old direct
 * `users` read never found the other side and both lists said "Unknown User".
 * The service now reads `get_my_pending_partner_requests`
 * (20260926010000_my_pending_partner_requests.sql), which names the other
 * person. This pins the call, the split into sent and received, and that a
 * failure is the empty lists it always was.
 *
 * The real `supabaseClient` and `partnerService` run against a stubbed
 * supabase-js client, the harness of partnerService.sendRequest.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = '11111111-1111-4111-8111-111111111111';
const RECIPIENT = '22222222-2222-4222-8222-222222222222';
const SENDER = '33333333-3333-4333-8333-333333333333';

type Row = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  created_at: string;
  other_display_name: string | null;
  other_email: string | null;
};

let rpcAnswer: { data: Row[] | null; error: { code: string; message: string } | null };
let requests: Array<{ kind: string; name?: string }>;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => {
        requests.push({ kind: 'getUser' });
        return { data: { user: { id: ME } }, error: null };
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: async (name: string) => {
      requests.push({ kind: 'rpc', name });
      return rpcAnswer;
    },
    from: (table: string) => {
      requests.push({ kind: 'from', name: table });
      throw new Error(`unexpected table read: ${table}`);
    },
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
    realtime: { setAuth: async () => {} },
  }),
}));

async function load() {
  const { partnerService } = await import('@/api/partnerService');
  return partnerService.getPendingRequests();
}

describe('partnerService.getPendingRequests', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requests = [];
    rpcAnswer = {
      data: [
        {
          id: 'received',
          from_user_id: SENDER,
          to_user_id: ME,
          created_at: '2026-09-26T10:00:00Z',
          other_display_name: 'Jessie',
          other_email: 'jessie@example.test',
        },
        {
          id: 'sent',
          from_user_id: ME,
          to_user_id: RECIPIENT,
          created_at: '2026-09-26T09:00:00Z',
          other_display_name: null,
          other_email: 'harper@example.test',
        },
      ],
      error: null,
    };
  });

  it('reads the RPC and no table', async () => {
    await load();

    expect(requests).toEqual([{ kind: 'getUser' }, { kind: 'rpc', name: 'get_my_pending_partner_requests' }]);
  });

  it('splits the rows into sent and received, each naming the other person', async () => {
    const { sent, received } = await load();

    expect(received).toEqual([
      {
        id: 'received',
        from_user_id: SENDER,
        to_user_id: ME,
        other_display_name: 'Jessie',
        other_email: 'jessie@example.test',
        status: 'pending',
        created_at: '2026-09-26T10:00:00Z',
      },
    ]);
    expect(sent).toEqual([
      {
        id: 'sent',
        from_user_id: ME,
        to_user_id: RECIPIENT,
        other_display_name: null,
        other_email: 'harper@example.test',
        status: 'pending',
        created_at: '2026-09-26T09:00:00Z',
      },
    ]);
  });

  it('answers empty lists when the RPC fails, as before', async () => {
    rpcAnswer = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };

    expect(await load()).toEqual({ sent: [], received: [] });
  });
});
