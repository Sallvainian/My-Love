/**
 * Real local-Supabase proof for the private couple broadcast topics (F2/F3).
 *
 * `love-notes:<uuid>` and `mood-updates:<uuid>` were public Realtime topics:
 * anyone holding the project's anon key could join a stranger's topic and both
 * read their traffic and publish forged messages onto it. The fix is two RLS
 * policies on `realtime.messages`
 * (20260912010000_private_couple_broadcast_policies.sql) plus `private: true`
 * on every client that opens one of these topics.
 *
 * Policies are evaluated at JOIN and cached until the JWT refreshes, so what
 * has to be measured here is the join itself — a websocket outcome no unit test
 * or pgTAP file can produce. `supabase/tests/database/23_couple_broadcast_policies.sql`
 * asserts the policy set exists and is shaped correctly; this file asserts what
 * the server actually does with it.
 *
 * Senders use the REST broadcast endpoint (`httpSend`), receivers a private
 * websocket join — the shape the app itself now has, and not a convenience. A
 * sender holds INSERT on the partner's topic and deliberately not SELECT, and a
 * private websocket JOIN with no SELECT is refused:
 *
 *   error_code=Unauthorized [error] Unauthorized: You do not have permissions
 *   to read from this Channel topic: love-notes:<uuid>
 *
 * (realtime v2.124.4, supabase_realtime_My-Love, 2026-09-12). The REST endpoint
 * evaluates the same INSERT policy without requiring a join. Note also that the
 * SDK's `send()` falls back to that endpoint when the channel is not joined but
 * swallows the denial and resolves 'ok'; `httpSend` rejects. Both halves are
 * asserted below. That pins that `send()` hides the denial from its caller —
 * the reason the app sends with `httpSend` — but this file cannot catch the
 * app switching back to `send()`, because it drives the SDK directly.
 *
 * Every client here is SESSION-based — signed in, then `realtime.setAuth()`
 * with no argument — because that is what the app does. Handing `setAuth` an
 * explicit token instead puts realtime-js into manual-token mode, where it
 * stops re-installing the token on a reconnect and a re-join of a private topic
 * is then refused. That is a property of the harness, not of these policies,
 * and building the clients the app's way is what keeps this file measuring the
 * policies.
 *
 * Identities:
 * - victim   — this worker's user1, subscribed to its own topics
 * - partner  — this worker's user2, pre-linked by global-setup
 * - outsider — a throwaway account from createOutsiderClient, linked to nobody
 * - anon     — a bare anon-key client with no session
 *
 * No worker account is linked, unlinked or reset anywhere in this file; those
 * rows are shared with every other worker.
 *
 * Sentinel assumption. Non-delivery is proved with a sentinel: a message that
 * must arrive, sent only after the forbidden call has returned. That proof
 * rests on Realtime delivering to one subscriber in the order the server
 * accepted the messages, across senders and across the REST and websocket
 * paths. It holds on the single-node local stack this file runs against; it is
 * not a guarantee Realtime makes in general, so on a multi-node deployment a
 * leak could land after its sentinel and go unseen here.
 *
 * playwright-utils deviation: the library has no Supabase Realtime/WebSocket
 * subscription utility, so the channels below are opened with the SDK directly,
 * following tests/api/interaction-realtime.spec.ts.
 */
import { log } from '@seontechnologies/playwright-utils';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '../support/merged-fixtures';
import { resolveOwnPair } from '../support/helpers/events';
import {
  createOutsiderClient,
  createUserClient,
  deleteOutsider,
} from '../support/helpers/rls-security';
import type { TypedSupabaseClient } from '../support/factories';

/** A terminal subscribe status — anything the server will not move on from. */
const TERMINAL_FAILURES = ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'];

function envPair(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required; use Supabase Local.');
  }
  return { url, anonKey };
}

/** A signed-in client with its session's JWT on the Realtime socket. */
async function signedInClient(
  supabaseAdmin: TypedSupabaseClient,
  userId: string
): Promise<SupabaseClient> {
  const client = (await createUserClient(supabaseAdmin, userId)) as unknown as SupabaseClient;
  await client.realtime.setAuth();
  return client;
}

/** A bare anon client: no session, no token beyond the publishable key. */
function anonClient(): SupabaseClient {
  const { url, anonKey } = envPair();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * A love-note `new_message` broadcast body, `{ message: { id, content } }`.
 *
 * `content` is left off entirely when not given, rather than sent as
 * `undefined`, so the body on the wire and the exact `toEqual` lists of what a
 * subscriber received both keep the shape they are written with.
 */
function notePayload(id: string, content?: string): { message: { id: string; content?: string } } {
  return { message: content === undefined ? { id } : { id, content } };
}

interface Subscription {
  channel: RealtimeChannel;
  statuses: string[];
  received: Array<Record<string, unknown>>;
}

/**
 * Open one topic and start collecting statuses and payloads from it.
 *
 * `ack: true` makes a websocket `send()` on the returned channel wait for the
 * server's reply, so a later sentinel is known to have been sent after it.
 */
function join(
  client: SupabaseClient,
  topic: string,
  event: string,
  options: { private: boolean; ack?: boolean }
): Subscription {
  const statuses: string[] = [];
  const received: Array<Record<string, unknown>> = [];

  const channel = client
    .channel(topic, {
      config: { broadcast: { self: false, ack: options.ack ?? false }, private: options.private },
    })
    .on('broadcast', { event }, (message) => {
      received.push(message.payload as Record<string, unknown>);
    })
    .subscribe((status) => statuses.push(status));

  return { channel, statuses, received };
}

type Poll = (
  fn: () => Promise<unknown>,
  predicate: (value: never) => boolean,
  opts: { timeout: number; interval: number; log: string }
) => Promise<unknown>;

/** The first terminal status this channel reported, or null if it has none yet. */
function settledStatus(sub: Subscription): string | null {
  return sub.statuses.find((s) => s === 'SUBSCRIBED' || TERMINAL_FAILURES.includes(s)) ?? null;
}

/**
 * Wait until the channel reports a terminal status, then assert which one.
 *
 * Settling on the FIRST terminal status rather than polling for SUBSCRIBED
 * alone is what turns a clean denial into a legible assertion instead of a 15s
 * timeout whose message says nothing about why.
 */
async function waitForStatus(
  recurse: Poll,
  sub: Subscription,
  what: string,
  expected: 'subscribed' | 'denied'
): Promise<void> {
  const status = await recurse(async () => settledStatus(sub), (s: never) => s !== null, {
    timeout: 20000,
    interval: 100,
    log: `Waiting for ${what} to settle`,
  });

  const detail = `${what} statuses: ${sub.statuses.join(' | ')}`;
  if (expected === 'subscribed') {
    expect(status, detail).toBe('SUBSCRIBED');
  } else {
    expect(status, detail).not.toBe('SUBSCRIBED');
    expect(sub.statuses, detail).not.toContain('SUBSCRIBED');
  }
}

test.describe('Couple broadcast authorization', () => {
  test('[P0] partner delivery works on both private topics, and survives a reconnect', async ({
    recurse,
    supabaseAdmin,
    cleanup,
  }) => {
    const { userId: victimId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const victim = await signedInClient(supabaseAdmin, victimId);
    cleanup.defer('remove the victim channels', () => victim.removeAllChannels());
    const partner = await signedInClient(supabaseAdmin, partnerId);
    cleanup.defer('remove the partner channels', () => partner.removeAllChannels());
    const poll = recurse as unknown as Poll;

    const notes = join(victim, `love-notes:${victimId}`, 'new_message', { private: true });
    const moods = join(victim, `mood-updates:${victimId}`, 'new_mood', { private: true });

    // The sender's channels exist only to carry a REST call; they are never
    // joined, which is the whole point of the INSERT-only grant.
    const senderNotes = partner.channel(`love-notes:${victimId}`, { config: { private: true } });
    const senderMoods = partner.channel(`mood-updates:${victimId}`, { config: { private: true } });

    await log.step('The recipient joins its own two topics privately');
    await waitForStatus(poll, notes, 'victim love-notes', 'subscribed');
    await waitForStatus(poll, moods, 'victim mood-updates', 'subscribed');

    await log.step('The partner sends to both topics over the private REST endpoint');
    expect(
      await senderNotes.httpSend('new_message', notePayload('note-1', 'hi'))
    ).toEqual({ success: true });
    expect(await senderMoods.httpSend('new_mood', { id: 'mood-1', mood_type: 'happy' })).toEqual({
      success: true,
    });

    await log.step('Both arrive at the recipient');
    await poll(
      async () => notes.received.length + moods.received.length,
      (total: never) => (total as unknown as number) >= 2,
      { timeout: 15000, interval: 100, log: 'Waiting for both broadcasts to arrive' }
    );
    expect(notes.received).toHaveLength(1);
    expect(moods.received).toHaveLength(1);

    await log.step('Delivery resumes after the recipient reconnects');
    expect(await victim.removeChannel(notes.channel)).toBe('ok');

    // `removeChannel` resolves on the leave ack; the registry entry is dropped
    // later still, from the `_onClose` hook. Reopening before that is handed
    // the dying object, whose `subscribe()` is a silent no-op because the join
    // is gated on state 'closed' — the exact hazard src/api/realtimeSocket.ts
    // documents, and the reason this reconnect is worth a test at all.
    const deregistered = await poll(
      async () =>
        victim.getChannels().some((c) => c.topic === `realtime:love-notes:${victimId}`)
          ? null
          : 'deregistered',
      (state: never) => state === 'deregistered',
      { timeout: 15000, interval: 100, log: 'Waiting for the old channel to deregister' }
    );
    expect(deregistered).toBe('deregistered');

    const rejoined = join(victim, `love-notes:${victimId}`, 'new_message', { private: true });
    await waitForStatus(poll, rejoined, 'victim love-notes after reconnect', 'subscribed');

    expect(
      await senderNotes.httpSend('new_message', notePayload('note-2', 'again'))
    ).toEqual({ success: true });

    await poll(
      async () => rejoined.received.length,
      (n: never) => (n as unknown as number) >= 1,
      { timeout: 15000, interval: 100, log: 'Waiting for delivery after the reconnect' }
    );
    expect(rejoined.received).toHaveLength(1);
  });

  test('[P0] an authenticated non-partner cannot join either victim topic', async ({
    recurse,
    supabaseAdmin,
    cleanup,
  }) => {
    const { userId: victimId } = await resolveOwnPair(supabaseAdmin);
    const outsider = await createOutsiderClient(supabaseAdmin, 'broadcast-outsider');
    cleanup.defer('delete the outsider account', () => deleteOutsider(outsider));
    const client = outsider.client as unknown as SupabaseClient;
    cleanup.defer('remove the outsider channels', () => client.removeAllChannels());
    const poll = recurse as unknown as Poll;

    await client.realtime.setAuth();

    const notes = join(client, `love-notes:${victimId}`, 'new_message', { private: true });
    const moods = join(client, `mood-updates:${victimId}`, 'new_mood', { private: true });

    await log.step('Both joins are refused: the topic segment is not the outsider');
    await waitForStatus(poll, notes, 'outsider love-notes join', 'denied');
    await waitForStatus(poll, moods, 'outsider mood-updates join', 'denied');
  });

  test('[P0] a non-partner send never reaches the victim, and legitimate delivery still works', async ({
    recurse,
    supabaseAdmin,
    cleanup,
  }) => {
    const { userId: victimId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const victim = await signedInClient(supabaseAdmin, victimId);
    cleanup.defer('remove the victim channels', () => victim.removeAllChannels());
    const partner = await signedInClient(supabaseAdmin, partnerId);
    cleanup.defer('remove the partner channels', () => partner.removeAllChannels());
    const outsider = await createOutsiderClient(supabaseAdmin, 'broadcast-forger');
    cleanup.defer('delete the forger account', () => deleteOutsider(outsider));
    const forger = outsider.client as unknown as SupabaseClient;
    cleanup.defer('remove the forger channels', () => forger.removeAllChannels());
    const poll = recurse as unknown as Poll;

    const notes = join(victim, `love-notes:${victimId}`, 'new_message', { private: true });

    await waitForStatus(poll, notes, 'victim love-notes', 'subscribed');
    await forger.realtime.setAuth();

    await log.step('The forger is denied at the REST endpoint the app sends over');
    const forged = forger.channel(`love-notes:${victimId}`, { config: { private: true } });
    await expect(
      forged.httpSend('new_message', notePayload('forged-1', 'forged'))
    ).rejects.toThrow(/Unauthorized/);

    // The SDK's `send()` reaches the same endpoint but reports 'ok' whatever
    // the endpoint answered: pinned here, so the denial it hides is measured
    // rather than logged. Nothing must be delivered by that path either —
    // this is why the app uses httpSend.
    const legacyResult = await forged.send({
      type: 'broadcast',
      event: 'new_message',
      payload: notePayload('forged-2', 'forged'),
    });
    expect(legacyResult, 'the SDK send() no longer reports ok on a denied forge').toBe('ok');
    await forger.removeChannel(forged);

    // Both forged calls have returned, so the partner's note below is a
    // sentinel: a forged note, had one been delivered, would have landed
    // first and made the exact list below fail -- given in-order delivery
    // (see "Sentinel assumption" in the header).
    await log.step('Only the partner note that follows the forgeries reaches the victim');
    const senderNotes = partner.channel(`love-notes:${victimId}`, { config: { private: true } });
    expect(
      await senderNotes.httpSend('new_message', notePayload('real-1', 'real'))
    ).toEqual({ success: true });

    await poll(
      async () => notes.received.length,
      (n: never) => (n as unknown as number) >= 1,
      { timeout: 15000, interval: 100, log: 'Waiting for the legitimate note' }
    );
    expect(notes.received, 'the victim received a forged note').toEqual([
      notePayload('real-1', 'real'),
    ]);
  });

  test('[P0] an anonymous client cannot join either victim topic privately', async ({
    recurse,
    supabaseAdmin,
    cleanup,
  }) => {
    const { userId: victimId } = await resolveOwnPair(supabaseAdmin);
    const anon = anonClient();
    cleanup.defer('remove the anon channels', () => anon.removeAllChannels());
    const poll = recurse as unknown as Poll;

    const notes = join(anon, `love-notes:${victimId}`, 'new_message', { private: true });
    const moods = join(anon, `mood-updates:${victimId}`, 'new_mood', { private: true });

    // The policies are `to authenticated`, so anon gets a row-level denial
    // rather than a "permission denied for function get_my_partner_id".
    await waitForStatus(poll, notes, 'anon love-notes join', 'denied');
    await waitForStatus(poll, moods, 'anon mood-updates join', 'denied');
  });

  test('[P1] a PUBLIC join to a victim topic receives nothing that was sent privately', async ({
    recurse,
    supabaseAdmin,
    apiRequest,
    cleanup,
  }) => {
    // The measured answer to the rollout question. This stack has Realtime's
    // "Allow public access to channels" at its default — Enabled — so a bare
    // anon client still REACHES SUBSCRIBED on a non-private join to
    // `love-notes:<victim>`: no policy check runs for a public join at all.
    //
    // What it does not get is the traffic. Private and public are separate
    // delivery paths, so a broadcast sent privately never reaches a public
    // subscriber. That is what closes CAP-2/CAP-3 without flipping the hosted
    // setting, which src/api/interactionService.ts still depends on being
    // Enabled for its public postgres_changes channel.
    const { userId: victimId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const victim = await signedInClient(supabaseAdmin, victimId);
    cleanup.defer('remove the victim channels', () => victim.removeAllChannels());
    const partner = await signedInClient(supabaseAdmin, partnerId);
    cleanup.defer('remove the partner channels', () => partner.removeAllChannels());
    const anon = anonClient();
    cleanup.defer('remove the eavesdropper channels', () => anon.removeAllChannels());
    const anonSender = anonClient();
    cleanup.defer('remove the anon sender channels', () => anonSender.removeAllChannels());
    const poll = recurse as unknown as Poll;
    const { url, anonKey } = envPair();

    const eavesdrop = join(anon, `love-notes:${victimId}`, 'new_message', {
      private: false,
      ack: true,
    });
    const listener = join(victim, `love-notes:${victimId}`, 'new_message', { private: true });
    const sender = partner.channel(`love-notes:${victimId}`, { config: { private: true } });

    await log.step('The public join is not itself refused on this stack');
    await poll(async () => settledStatus(eavesdrop), (s: never) => s !== null, {
      timeout: 20000,
      interval: 100,
      log: 'Waiting for the public join to settle',
    });
    // Asserted, not merely logged: rollout.md and the story's Operational
    // Evidence both record this as measured, so a change in it has to fail a
    // test rather than pass with a different log line.
    expect(
      settledStatus(eavesdrop),
      'the public join to a victim topic no longer reaches SUBSCRIBED'
    ).toBe('SUBSCRIBED');

    await waitForStatus(poll, listener, 'victim private love-notes', 'subscribed');

    await log.step('Reading: a privately-sent broadcast does not reach the public subscriber');
    expect(
      await sender.httpSend('new_message', notePayload('private-1', 'private'))
    ).toEqual({ success: true });

    await poll(
      async () => listener.received.length,
      (n: never) => (n as unknown as number) >= 1,
      { timeout: 15000, interval: 100, log: 'Waiting for the private delivery' }
    );
    // The private send has been delivered, so a PUBLIC sentinel sent now is
    // what bounds a leak: had private-1 reached the public subscriber, it
    // would sit ahead of the sentinel in the exact list below, given in-order
    // delivery (see "Sentinel assumption" in the header). It comes from a
    // second anon client because `channel()` hands the partner back its
    // existing private channel for the same topic.
    const publicSender = anonSender.channel(`love-notes:${victimId}`, {
      config: { private: false },
    });
    expect(
      await publicSender.httpSend('new_message', notePayload('public-sentinel', 'sentinel'))
    ).toEqual({ success: true });
    await poll(
      async () => eavesdrop.received.length,
      (n: never) => (n as unknown as number) >= 1,
      { timeout: 15000, interval: 100, log: 'Waiting for the public sentinel' }
    );
    expect(eavesdrop.received, 'a public subscriber received a private broadcast').toEqual([
      notePayload('public-sentinel', 'sentinel'),
    ]);

    // The other half of CAP-2/CAP-3, and the one that matters more: not just
    // that a stranger cannot READ the couple's traffic, but that a stranger
    // cannot INJECT into it. Both public paths are exercised — the websocket
    // send on the public channel it did manage to join, and a raw POST to the
    // REST broadcast endpoint with nothing but the publishable key.
    await log.step('Writing: neither public path can inject into the private subscriber');
    const publicSend = await eavesdrop.channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: notePayload('injected-ws', 'injected'),
    });
    expect(publicSend, 'the anon public websocket send no longer reports ok').toBe('ok');

    // The bulk REST route, with nothing but the publishable key. Both headers
    // are required: without `Authorization` the route answers 500 before it
    // ever looks at the body, which would make this prove nothing.
    // No retry: a retried 5xx could send the injection twice.
    const restResponse = await apiRequest({
      method: 'POST',
      baseUrl: url,
      path: '/realtime/v1/api/broadcast',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        messages: [
          {
            topic: `love-notes:${victimId}`,
            event: 'new_message',
            payload: notePayload('injected-rest', 'injected'),
            private: true,
          },
        ],
      },
      retryConfig: { maxRetries: 0 },
    });
    // 202, not the 500 a missing header gives: the route accepted the body,
    // so the non-delivery below is measured against a message it took.
    expect(restResponse.status, 'the anon REST broadcast was not accepted').toBe(202);

    // Both injections have been answered by the server (the websocket send
    // is acked), so a private sentinel from the partner now bounds them: an
    // injected message would arrive ahead of it, given in-order delivery
    // (see "Sentinel assumption" in the header).
    expect(
      await sender.httpSend('new_message', notePayload('private-sentinel', 'sentinel'))
    ).toEqual({ success: true });
    await poll(
      async () => listener.received.length,
      (n: never) => (n as unknown as number) >= 2,
      { timeout: 15000, interval: 100, log: 'Waiting for the private sentinel' }
    );
    // Both public paths report success — 'ok' and 202 — and neither is
    // delivered. What stops the injection is the private subscriber's
    // separate delivery path, not the sender being told "no", which is
    // exactly why this has to be asserted on the RECEIVER.
    expect(listener.received, 'a public sender injected into a private subscriber').toEqual([
      notePayload('private-1', 'private'),
      notePayload('private-sentinel', 'sentinel'),
    ]);
  });

  test('[P0] a PARTNERED non-partner is denied on a third party\'s topic', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    // Both other send-denial cases use an account linked to nobody, so
    // `public.get_my_partner_id()` returns NULL and only the "unpartnered =>
    // denied" branch is exercised. The INSERT predicate's actual content is
    // that the topic segment must be YOUR partner — so the sender here has a
    // partner, just not the victim.
    //
    // Both accounts are throwaways created and linked here. A worker-pool
    // account is never linked or unlinked: those rows are shared.
    const { userId: victimId } = await resolveOwnPair(supabaseAdmin);
    const outsiderA = await createOutsiderClient(supabaseAdmin, 'broadcast-linked-a');
    cleanup.defer('delete throwaway account A', () => deleteOutsider(outsiderA));
    const outsiderB = await createOutsiderClient(supabaseAdmin, 'broadcast-linked-b');
    cleanup.defer('delete throwaway account B', () => deleteOutsider(outsiderB));

    const { error: linkError } = await supabaseAdmin
      .from('users')
      .upsert([
        { id: outsiderA.userId, partner_id: outsiderB.userId },
        { id: outsiderB.userId, partner_id: outsiderA.userId },
      ]);
    expect(linkError, `failed to link the throwaway pair: ${linkError?.message}`).toBeNull();

    const sender = outsiderA.client as unknown as SupabaseClient;
    cleanup.defer('remove the sender channels', () => sender.removeAllChannels());
    await sender.realtime.setAuth();

    // Premise: this account really is partnered, so a NULL partner cannot be
    // what denies it below.
    const { data: partnerId, error: rpcError } = await sender.rpc('get_my_partner_id');
    expect(rpcError, `get_my_partner_id failed: ${rpcError?.message}`).toBeNull();
    expect(partnerId, 'the sender is not actually partnered').toBe(outsiderB.userId);

    await log.step('Sending to its OWN partner is allowed');
    const own = sender.channel(`love-notes:${outsiderB.userId}`, { config: { private: true } });
    expect(await own.httpSend('new_message', notePayload('ok-1'))).toEqual({
      success: true,
    });
    await sender.removeChannel(own);

    await log.step("Sending to a third party's topic is not");
    const stranger = sender.channel(`love-notes:${victimId}`, { config: { private: true } });
    await expect(
      stranger.httpSend('new_message', notePayload('forged-3'))
    ).rejects.toThrow(/Unauthorized/);
    await sender.removeChannel(stranger);

    const strangerMood = sender.channel(`mood-updates:${victimId}`, {
      config: { private: true },
    });
    await expect(
      strangerMood.httpSend('new_mood', { id: 'forged-mood', mood_type: 'happy' })
    ).rejects.toThrow(/Unauthorized/);
    await sender.removeChannel(strangerMood);
  });
});
