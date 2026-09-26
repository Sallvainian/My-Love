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
 * `public.interactions` is in the `supabase_realtime` publication since
 * 20260926020000, so an INSERT is delivered; live delivery between two
 * browsers is covered end to end by tests/e2e/partner/partner-connect.spec.ts.
 * This file measures the network join that produces the `SUBSCRIBED` status.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';
import { resolveOwnPair } from '../support/helpers/events';

test.describe('Interactions Realtime API', () => {
  test('[P1] joins the receiving worker user channel and reports SUBSCRIBED', async ({
    recurse,
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
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
    cleanup.defer('remove the interactions channel', async () => {
      expect(await supabaseAsUser.removeChannel(channel)).toBe('ok');
    });

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
  });
});
