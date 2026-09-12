/**
 * Real local-Supabase proof for the interactions Realtime join/status path.
 *
 * Provider scrutiny evidence:
 * - Subscription: src/api/interactionService.ts:237-266
 * - Topic: incoming-interactions:<receiver public.users.id>
 * - Protocol: postgres_changes INSERT on public.interactions
 * - Filter: to_user_id=eq.<receiver public.users.id>
 * - Current wire types: src/types/database.types.ts:88-127
 * - Auth/RLS: the receiving user's JWT can join its filtered channel
 *
 * Local Supabase has no tables in the `supabase_realtime` publication, so a
 * Postgres INSERT cannot be used as a delivery probe without mutating shared,
 * parallel test infrastructure. Exact record forwarding remains covered by
 * the service and real-slice tests; this file measures the network join that
 * produces the changed `SUBSCRIBED` status.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';
import { resolveOwnPair } from '../support/helpers/events';

test.describe('Interactions Realtime API', () => {
  test('[P1] joins the receiving worker user channel and reports SUBSCRIBED', async ({
    recurse,
    supabaseAdmin,
    supabaseAsUser,
  }) => {
    const { userId: receiverId } = await resolveOwnPair(supabaseAdmin);
    const statuses: string[] = [];

    // playwright-utils deviation: the library has no Supabase Realtime/WebSocket subscription utility.
    const channel = supabaseAsUser
      .channel(`incoming-interactions:${receiverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interactions',
          filter: `to_user_id=eq.${receiverId}`,
        },
        () => {}
      )
      .subscribe((status) => statuses.push(status));

    let testFailure: unknown;
    try {
      await log.step('Wait until the receiving worker user is subscribed');
      const subscribedStatus = await recurse(
        async () => statuses.find((status) => status === 'SUBSCRIBED') ?? null,
        (status) => status === 'SUBSCRIBED',
        {
          timeout: 15000,
          interval: 100,
          log: 'Waiting for the interactions Realtime channel to subscribe',
        }
      );

      expect(subscribedStatus).toBe('SUBSCRIBED');
      expect(statuses).not.toContain('CHANNEL_ERROR');
      expect(statuses).not.toContain('TIMED_OUT');
    } catch (error) {
      testFailure = error;
    }

    const removalStatus = await supabaseAsUser.removeChannel(channel);
    expect(removalStatus).toBe('ok');
    if (testFailure !== undefined) throw testFailure;
  });
});
