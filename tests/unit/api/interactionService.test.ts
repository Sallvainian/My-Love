/**
 * interactionService — the failure surface
 *
 * Every message this service can throw is under test here, and the assertions
 * are pinned with `toBe` rather than a substring match for one reason: the
 * regression being guarded is an *extra sentence*. `handleNetworkError`
 * (`src/api/errorHandlers.ts:95`) closes with "Your changes will be synced when
 * you're back online", which is true for its mood callers and false here —
 * interactions are Supabase-only, with no offline queue, no IndexedDB mirror
 * and no retry. A substring assertion would still pass with that promise
 * re-attached, so it would not catch the thing it exists to catch.
 *
 * The Supabase client is faked per file — `tests/setup.ts` installs no Supabase
 * mock — over `FakeInteractionsBackend`, so the chained PostgREST builder is
 * exercised rather than asserted on. Same idiom as
 * `tests/unit/services/eventsService.test.ts` and `./moodApi.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  FakeInteractionsBackend,
  RLS_DENIED,
  type FakePostgrestError,
} from './fakeInteractionsBackend';

const USER_ID = 'USER-A-ID';
const PARTNER_ID = 'USER-B-ID';
const STRANGER_ID = 'USER-C-ID';

/** The sentence that must never come back for interactions. */
const SYNC_PROMISE = "will be synced when you're back online";

const backend = new FakeInteractionsBackend();

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    from: (table: string) => backend.client().from(table),
  },
}));

import { InteractionService } from '@/api/interactionService';
import { isPostgrestError } from '@/api/errorHandlers';

const interactionService = new InteractionService();

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

/** The rejection reason, so its message can be compared whole. */
async function rejection(promise: Promise<unknown>): Promise<Error | null> {
  return promise.then(
    () => null,
    (error: Error) => error
  );
}

describe('interactionService', () => {
  beforeEach(() => {
    backend.reset();
    setOnline(true);
    // The catch tails log through logSupabaseError; the thrown error is what
    // is under test, not the noise.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setOnline(true);
  });

  describe('fake fidelity — the boundary these tests assume', () => {
    // Without these, the zero-row tests below assert against whatever the fake
    // happens to return rather than against what PostgREST returns, which is
    // the exact defect this file's fake was corrected for.
    it('coerces a zero-row single() to PGRST116 rather than to a null row', async () => {
      backend.insertMatchesNoRow = true;

      const { data, error } = await backend
        .client()
        .from('interactions')
        .insert({ type: 'poke' })
        .select()
        .single();

      expect(data).toBeNull();
      expect(error).toMatchObject({ code: 'PGRST116' });
    });

    it('produces a zero-row error that errorHandlers recognises as PostgREST', async () => {
      // `isPostgrestError` keys on `details` being present. An envelope missing
      // it routes down the network branch instead, and the PGRST116 test below
      // would then pass for the wrong reason.
      backend.insertMatchesNoRow = true;

      const { error } = await backend
        .client()
        .from('interactions')
        .insert({ type: 'poke' })
        .select()
        .single();

      expect(isPostgrestError(error)).toBe(true);
    });

    it('refuses an .or() operator it does not model instead of matching everything', () => {
      expect(() => backend.client().from('interactions').select().or('viewed.is.false')).toThrow(
        'does not model .or() operator "is"'
      );
    });
  });

  describe('sendPoke / sendKiss — the happy path', () => {
    it('returns the inserted record', async () => {
      const poke = await interactionService.sendPoke(PARTNER_ID, USER_ID);

      expect(poke.type).toBe('poke');
      expect(poke.from_user_id).toBe(USER_ID);
      expect(poke.to_user_id).toBe(PARTNER_ID);
      expect(poke.viewed).toBe(false);
      expect(backend.rows).toHaveLength(1);
    });

    it('sends the requested interaction type', async () => {
      const kiss = await interactionService.sendKiss(PARTNER_ID, USER_ID);

      expect(kiss.type).toBe('kiss');
      expect(backend.payloads[0]).toMatchObject({ type: 'kiss' });
    });
  });

  describe('offline', () => {
    it('refuses a poke before issuing a request, and says it was not sent', async () => {
      setOnline(false);

      const failure = await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(failure?.message).toBe('You are offline. A poke needs a connection to send.');
      expect(backend.fromCalls).toBe(0);
    });

    it('names the interaction type it refused', async () => {
      setOnline(false);

      const failure = await rejection(interactionService.sendKiss(PARTNER_ID, USER_ID));

      expect(failure?.message).toBe('You are offline. A kiss needs a connection to send.');
    });

    it('does not promise a sync — interactions have no queue to sync from', async () => {
      setOnline(false);

      const failure = await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(failure?.message).not.toContain(SYNC_PROMISE);
    });
  });

  describe('an insert that creates no row', () => {
    // Two client outcomes, not one. `.single()` sets
    // `Accept: application/vnd.pgrst.object+json`, so a zero-row insert comes
    // back as PGRST116 — that is the reachable path. `{ data: null, error: null }`
    // needs a 2xx with an empty body, which `Prefer: return=representation`
    // makes rare. Both are modelled; both are asserted.

    it('reports no rows found when PostgREST refuses to coerce the empty result', async () => {
      backend.insertMatchesNoRow = true;

      const failure = await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(failure?.message).toBe('[InteractionService.sendInteraction] No rows found');
    });

    it('promises no sync on the PostgREST no-row path either', async () => {
      backend.insertMatchesNoRow = true;

      const failure = await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(failure?.message).not.toContain(SYNC_PROMISE);
    });

    it('reports the interaction as not sent when the body comes back empty', async () => {
      // Defensive branch, kept deliberately: it is the only assertion on
      // InteractionWriteError's second construction site, and its message is
      // the better of the two. Pinned whole because routing it through the
      // catch tail's network builder would produce
      // "[InteractionService.sendInteraction] Network error: ..." for
      // something that was never a network problem.
      backend.insertReturnsEmptyBody = true;

      const failure = await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(failure?.message).toBe('The poke was not sent');
      expect(failure?.message).not.toContain(SYNC_PROMISE);
    });

    it('is re-thrown ahead of logSupabaseError, so it is not logged as a Supabase failure', async () => {
      // The re-throw sits above logSupabaseError in the catch tail. Reordering
      // it would restore both the double-log and the network dressing, and
      // nothing else in this file would notice.
      backend.insertReturnsEmptyBody = true;

      await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(console.error).not.toHaveBeenCalled();
    });

    it('logs, by contrast, when the failure really was mid-flight', async () => {
      backend.nextError = new TypeError('fetch failed');

      await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('a failure mid-flight', () => {
    it('tells the truth about a dropped send', async () => {
      // A dropped socket rejects with a plain TypeError, not a PostgREST error.
      backend.nextError = new TypeError('fetch failed');

      const failure = await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(failure?.message).toBe(
        '[InteractionService.sendInteraction] Network error: fetch failed. Check your internet connection.'
      );
    });

    it('tells the truth about a dropped history read', async () => {
      backend.nextError = new TypeError('fetch failed');

      const failure = await rejection(interactionService.getInteractionHistory(USER_ID));

      expect(failure?.message).toBe(
        '[InteractionService.getInteractionHistory] Network error: fetch failed. Check your internet connection.'
      );
    });

    it('tells the truth about a dropped unviewed read', async () => {
      backend.nextError = new TypeError('fetch failed');

      const failure = await rejection(interactionService.getUnviewedInteractions(USER_ID));

      expect(failure?.message).toBe(
        '[InteractionService.getUnviewedInteractions] Network error: fetch failed. Check your internet connection.'
      );
    });

    it('tells the truth about a dropped mark-as-viewed', async () => {
      backend.nextError = new TypeError('fetch failed');

      const failure = await rejection(interactionService.markAsViewed('interaction-1'));

      expect(failure?.message).toBe(
        '[InteractionService.markAsViewed] Network error: fetch failed. Check your internet connection.'
      );
    });

    it('says the failure was unknown when the rejection is not an Error', async () => {
      // `networkFailure`'s `error instanceof Error` ternary has a second arm
      // that nothing else reaches. A rejection that is not an Error — a bare
      // string from a fetch polyfill, an aborted request — takes it, and the
      // message must still describe what happened without inventing a detail.
      backend.nextError = 'socket hang up, unwrapped';

      const failure = await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(failure?.message).toBe(
        '[InteractionService.sendInteraction] Network error: Unknown network error. Check your internet connection.'
      );
    });

    it('promises no sync on any of them', async () => {
      backend.nextError = new TypeError('fetch failed');

      const failures = [
        await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID)),
        await rejection(interactionService.getInteractionHistory(USER_ID)),
        await rejection(interactionService.getUnviewedInteractions(USER_ID)),
        await rejection(interactionService.markAsViewed('interaction-1')),
      ];

      for (const failure of failures) {
        expect(failure?.message).not.toContain(SYNC_PROMISE);
      }
    });
  });

  describe('a PostgREST rejection', () => {
    // One per method: the change edited all four catch tails, and the
    // `isPostgrestError` branch in two of them had no test at all.
    const denied: FakePostgrestError = RLS_DENIED;

    it('still maps a send through handleSupabaseError, unchanged', async () => {
      backend.nextError = denied;

      const failure = await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));

      expect(failure?.message).toBe(
        '[InteractionService.sendInteraction] Permission denied - check Row Level Security policies'
      );
    });

    it('maps a history read the same way', async () => {
      backend.nextError = denied;

      const failure = await rejection(interactionService.getInteractionHistory(USER_ID));

      expect(failure?.message).toBe(
        '[InteractionService.getInteractionHistory] Permission denied - check Row Level Security policies'
      );
    });

    it('maps an unviewed read the same way', async () => {
      backend.nextError = denied;

      const failure = await rejection(interactionService.getUnviewedInteractions(USER_ID));

      expect(failure?.message).toBe(
        '[InteractionService.getUnviewedInteractions] Permission denied - check Row Level Security policies'
      );
    });

    it('maps a mark-as-viewed the same way', async () => {
      backend.nextError = denied;

      const failure = await rejection(interactionService.markAsViewed('interaction-1'));

      expect(failure?.message).toBe(
        '[InteractionService.markAsViewed] Permission denied - check Row Level Security policies'
      );
    });
  });

  describe('getInteractionHistory — what the read actually returns', () => {
    beforeEach(() => {
      // Seeded oldest-first on purpose: insertion order is the reverse of the
      // expected order, so 'returns the newest first' fails if .order() is ever
      // dropped from the read. Seeded newest-first it passed either way.
      backend.seed({
        id: 'sent-to-me',
        from_user_id: PARTNER_ID,
        to_user_id: USER_ID,
        created_at: '2026-08-18T02:00:00.000Z',
      });
      backend.seed({
        id: 'sent-by-me',
        from_user_id: USER_ID,
        to_user_id: PARTNER_ID,
        created_at: '2026-08-18T03:00:00.000Z',
      });
      backend.seed({
        id: 'between-strangers',
        from_user_id: STRANGER_ID,
        to_user_id: PARTNER_ID,
        created_at: '2026-08-18T01:00:00.000Z',
      });
    });

    it('returns interactions in both directions and nobody else’s', async () => {
      const history = await interactionService.getInteractionHistory(USER_ID);

      expect(history.map((entry) => entry.id)).toEqual(['sent-by-me', 'sent-to-me']);
    });

    it('returns the newest first', async () => {
      const history = await interactionService.getInteractionHistory(USER_ID);

      expect(history[0].createdAt.getTime()).toBeGreaterThan(history[1].createdAt.getTime());
    });

    it('honours the offset and limit window', async () => {
      const secondPage = await interactionService.getInteractionHistory(USER_ID, 1, 1);

      expect(secondPage.map((entry) => entry.id)).toEqual(['sent-to-me']);
    });

    it('maps a record onto the local Interaction shape', async () => {
      const [newest] = await interactionService.getInteractionHistory(USER_ID);

      expect(newest).toEqual({
        id: 'sent-by-me',
        type: 'poke',
        fromUserId: USER_ID,
        toUserId: PARTNER_ID,
        viewed: false,
        createdAt: new Date('2026-08-18T03:00:00.000Z'),
      });
    });

    it('reads a null viewed column as not viewed', async () => {
      backend.reset();
      backend.seed({ id: 'never-set', from_user_id: USER_ID, to_user_id: PARTNER_ID, viewed: null });

      const [entry] = await interactionService.getInteractionHistory(USER_ID);

      expect(entry.viewed).toBe(false);
    });

    it('reads a null created_at as now rather than as the epoch', async () => {
      // `new Date(record.created_at ?? new Date())`. Drop the fallback and
      // `new Date(null)` yields 1970-01-01, which sorts and renders as a real
      // timestamp — the silent kind of wrong. Asserting "after the row was
      // seeded" keeps this deterministic without freezing the clock.
      const beforeRead = Date.now();
      backend.reset();
      backend.seed({ id: 'no-timestamp', from_user_id: USER_ID, to_user_id: PARTNER_ID, created_at: null });

      const [entry] = await interactionService.getInteractionHistory(USER_ID);

      expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(beforeRead);
    });
  });

  describe('getUnviewedInteractions — what the read actually returns', () => {
    it('returns only unviewed interactions addressed to this user', async () => {
      backend.seed({ id: 'unviewed-to-me', from_user_id: PARTNER_ID, to_user_id: USER_ID });
      backend.seed({
        id: 'already-viewed',
        from_user_id: PARTNER_ID,
        to_user_id: USER_ID,
        viewed: true,
      });
      backend.seed({ id: 'unviewed-to-partner', from_user_id: USER_ID, to_user_id: PARTNER_ID });

      const unviewed = await interactionService.getUnviewedInteractions(USER_ID);

      expect(unviewed.map((entry) => entry.id)).toEqual(['unviewed-to-me']);
    });

    it('maps a record onto the local Interaction shape', async () => {
      backend.seed({
        id: 'unviewed-to-me',
        type: 'kiss',
        from_user_id: PARTNER_ID,
        to_user_id: USER_ID,
        created_at: '2026-08-18T04:00:00.000Z',
      });

      const [entry] = await interactionService.getUnviewedInteractions(USER_ID);

      expect(entry).toEqual({
        id: 'unviewed-to-me',
        type: 'kiss',
        fromUserId: PARTNER_ID,
        toUserId: USER_ID,
        viewed: false,
        createdAt: new Date('2026-08-18T04:00:00.000Z'),
      });
    });

    it('reads a null created_at the same way the history read does', async () => {
      // The mapping is duplicated between the two reads rather than shared, so
      // the fallback needs asserting in both places or one copy can drift.
      //
      // Only `created_at` is exercised here: this read filters on
      // `.eq('viewed', false)`, and in Postgres `NULL = false` is NULL rather
      // than true, so a null-viewed row can never reach the mapping. Its
      // `?? false` is defensive and stays uncovered on purpose.
      const beforeRead = Date.now();
      backend.seed({
        id: 'no-timestamp',
        from_user_id: PARTNER_ID,
        to_user_id: USER_ID,
        created_at: null,
      });

      const [entry] = await interactionService.getUnviewedInteractions(USER_ID);

      expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(beforeRead);
    });
  });

  describe('markAsViewed — what the write actually does', () => {
    it('sets viewed on the named interaction and leaves the others alone', async () => {
      backend.seed({ id: 'target', from_user_id: PARTNER_ID, to_user_id: USER_ID });
      backend.seed({ id: 'bystander', from_user_id: PARTNER_ID, to_user_id: USER_ID });

      await interactionService.markAsViewed('target');

      expect(backend.rows.map((row) => [row.id, row.viewed])).toEqual([
        ['target', true],
        ['bystander', false],
      ]);
    });
  });
});
