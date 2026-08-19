/**
 * A loader that resolves after the signed-in user changes must not write
 *
 * Sign Out sits in the bottom nav of the very screens that fire these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's chat, partner, photos and mood notes straight
 * back on screen for whoever signs in next.
 *
 * WHY THESE TESTS SWITCH IDENTITY DIRECTLY INSTEAD OF CALLING clearAuth
 *
 * `clearAuth` resets the same fields the guards protect, so a test that drives
 * the transition through it passes whether or not the guard exists — every
 * assertion is satisfied by the reset alone. That is not hypothetical: an
 * earlier version of this file did exactly that, and the entire suite of 1050
 * tests passed with five of the guards deleted.
 *
 * `useAppStore.setState({ userId: 'USER-C-ID' })` models the other real
 * transition — `onAuthStateChange` resolving to a different user while a load
 * raised on the previous one is still open — and nothing about it clears the
 * fields under test. Each test seeds USER-C's own data first, so a guard that
 * fails to discard is caught by C's data being overwritten, and a guard that
 * fails to release its loading flag is caught separately.
 *
 * THE LOADING FLAG IS HALF THE GUARD. It is raised BEFORE the await, so an early
 * return that only skips the write leaves it true forever. `PartnerMoodView`
 * gates both of its branches on `isLoadingPartner`, and `ScriptureOverview`
 * renders nothing but a spinner while `isCheckingSession` is true — so a stranded
 * flag is a permanently blank tab, not a cosmetic wobble.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const getPartner = vi.fn();
const getPendingRequests = vi.fn();
const searchUsers = vi.fn();
const fetchMoods = vi.fn();
const getAllForUser = vi.fn();
const getUnsyncedMoods = vi.fn();
const getPhotos = vi.fn();
const getEvents = vi.fn();
const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();
const getInteractionHistory = vi.fn();
const getUserSessions = vi.fn();
const getCoupleStats = vi.fn();
const getSession = vi.fn();
const createSession = vi.fn();
const loveNotesQuery = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: () => loveNotesQuery(),
    auth: {},
    channel: vi.fn(),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
  },
  getPartnerId: vi.fn(),
}));

vi.mock('../../../src/api/moodSyncService', () => ({
  moodSyncService: { fetchMoods: () => fetchMoods() },
}));

vi.mock('../../../src/api/partnerService', () => ({
  partnerService: {
    getPartner: () => getPartner(),
    getPendingRequests: () => getPendingRequests(),
    searchUsers: (query: string) => searchUsers(query),
  },
}));

vi.mock('../../../src/services/photoService', () => ({
  photoService: { getPhotos: () => getPhotos() },
}));

vi.mock('../../../src/services/eventsService', () => ({
  eventsService: {
    getEvents: () => getEvents(),
    createEvent: (input: unknown) => createEvent(input),
    updateEvent: (eventId: string, updates: unknown) => updateEvent(eventId, updates),
    deleteEvent: (eventId: string) => deleteEvent(eventId),
  },
}));

vi.mock('../../../src/api/interactionService', () => ({
  InteractionService: class {
    getInteractionHistory(userId: string, limit: number) {
      return getInteractionHistory(userId, limit);
    }
  },
}));

vi.mock('../../../src/services/moodService', () => ({
  moodService: {
    getAllForUser: (userId: string) => getAllForUser(userId),
    getUnsyncedMoods: (userId: string) => getUnsyncedMoods(userId),
  },
}));

vi.mock('../../../src/services/scriptureReadingService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    scriptureReadingService: {
      getUserSessions: (userId: string) => getUserSessions(userId),
      getCoupleStats: () => getCoupleStats(),
      getSession: (sessionId: string, onRefresh: (s: unknown) => void) =>
        getSession(sessionId, onRefresh),
      createSession: (mode: string, partnerId?: string) => createSession(mode, partnerId),
    },
  };
});

import { useAppStore } from '../../../src/stores/useAppStore';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

const PARTNER_A = { id: 'USER-B-ID', displayName: 'A-PARTNER-NAME', email: 'b@example.com' };
const PARTNER_C = { id: 'USER-D-ID', displayName: 'C-PARTNER-NAME', email: 'd@example.com' };

/** A promise this test resolves by hand, so the account switch can land mid-flight */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  let fail: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  // Nothing else attaches a handler until the loader does, and an unhandled
  // rejection between construction and that point fails the whole file.
  promise.catch(() => {});
  return { promise, settle, fail };
}

/**
 * The PostgREST builder is chainable and thenable — every method returns itself,
 * and awaiting it produces the query result.
 */
function loveNotesBuilder(result: Promise<{ data: unknown; error: unknown }>) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'or', 'order', 'limit', 'lt', 'eq', 'upsert']) {
    builder[method] = () => builder;
  }
  builder.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    result.then(onFulfilled, onRejected);
  return builder;
}

function note(id: string, content: string) {
  return {
    id,
    from_user_id: A,
    to_user_id: 'USER-B-ID',
    content,
    created_at: `2026-08-03T06:00:0${id.length}.000Z`,
  };
}

/** Hand the store to USER-C mid-flight, seeding whatever C already had on screen. */
function switchToUserC(cOwnState: Record<string, unknown> = {}): void {
  useAppStore.setState({
    userId: C,
    isAuthenticated: true,
    ...cOwnState,
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
}

describe('loader identity guards', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAppStore.getState().clearAuth();
    useAppStore.setState({ userId: A, isAuthenticated: true, error: null });

    const { getPartnerId } = await import('../../../src/api/supabaseClient');
    vi.mocked(getPartnerId).mockResolvedValue('USER-B-ID');
    getUnsyncedMoods.mockResolvedValue([]);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  // ==========================================================================
  // notesSlice — the largest private disclosure in the app
  // ==========================================================================

  describe('fetchNotes', () => {
    it('discards the conversation when the account changed mid-flight', async () => {
      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchNotes();
      switchToUserC({ notes: [note('c1', 'C-OWN-CHAT-BODY')] });

      pending.settle({ data: [note('a1', 'A-PRIVATE-CHAT-BODY')], error: null });
      await inFlight;

      expect(useAppStore.getState().notes).toEqual([note('c1', 'C-OWN-CHAT-BODY')]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CHAT-BODY');
    });

    it('still releases the spinner when it discards', async () => {
      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchNotes();
      expect(useAppStore.getState().notesIsLoading).toBe(true);

      switchToUserC();
      pending.settle({ data: [note('a1', 'A-PRIVATE-CHAT-BODY')], error: null });
      await inFlight;

      expect(useAppStore.getState().notesIsLoading).toBe(false);
    });
  });

  describe('fetchOlderNotes', () => {
    it('restores neither the fetched page nor the messages that were on screen', async () => {
      // This one is worse than the plain case: `notes` is destructured before
      // both awaits, so an unguarded write puts the WHOLE pre-switch
      // conversation back, not just the page it went to fetch.
      useAppStore.setState({
        notes: [note('a1', 'A-ONSCREEN-CHAT-BODY')],
        notesHasMore: true,
        notesIsLoading: false,
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchOlderNotes();
      switchToUserC({ notes: [note('c1', 'C-OWN-CHAT-BODY')] });

      pending.settle({ data: [note('a0', 'A-OLDER-CHAT-BODY')], error: null });
      await inFlight;

      expect(useAppStore.getState().notes).toEqual([note('c1', 'C-OWN-CHAT-BODY')]);
      const remaining = JSON.stringify(useAppStore.getState());
      expect(remaining, 'the fetched page came back').not.toContain('A-OLDER-CHAT-BODY');
      expect(remaining, 'the pre-switch conversation came back').not.toContain(
        'A-ONSCREEN-CHAT-BODY'
      );
    });

    it('still releases the spinner when it discards', async () => {
      useAppStore.setState({
        notes: [note('a1', 'A-ONSCREEN-CHAT-BODY')],
        notesHasMore: true,
        notesIsLoading: false,
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchOlderNotes();
      expect(useAppStore.getState().notesIsLoading).toBe(true);

      switchToUserC();
      pending.settle({ data: [], error: null });
      await inFlight;

      expect(useAppStore.getState().notesIsLoading).toBe(false);
    });

    it('keeps a note that arrived over realtime while the page was in flight', async () => {
      // The merge re-reads `notes` instead of reusing the pre-await capture.
      useAppStore.setState({
        notes: [note('a1', 'FIRST')],
        notesHasMore: true,
        notesIsLoading: false,
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchOlderNotes();
      // Same account throughout — a realtime message simply lands mid-fetch.
      useAppStore.setState({
        notes: [note('a1', 'FIRST'), note('a2', 'ARRIVED-MID-FETCH')],
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      pending.settle({ data: [note('a0', 'OLDER')], error: null });
      await inFlight;

      expect(useAppStore.getState().notes.map((n) => n.content)).toEqual([
        'OLDER',
        'FIRST',
        'ARRIVED-MID-FETCH',
      ]);
    });
  });

  // ==========================================================================
  // moodSlice
  // ==========================================================================

  describe('removeNote', () => {
    it('still releases the spinner when it discards', async () => {
      // A single-note window with more history behind it. Removing the only
      // loaded note empties the window, which is the branch that raises the
      // spinner before the await so the refill does not flash an empty state.
      useAppStore.setState({
        notes: [note('a1', 'A-ONSCREEN-CHAT-BODY')],
        notesHasMore: true,
        notesIsLoading: false,
        notesPendingRemoval: [],
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().removeNote('a1');
      expect(useAppStore.getState().notesIsLoading).toBe(true);

      // setAuthUser switches accounts without passing through signedOutState(),
      // so nothing else will clear this flag — and with notes emptied,
      // MessageList renders its spinner branch and nothing else.
      switchToUserC();
      pending.settle({ data: null, error: null });
      await inFlight;

      expect(useAppStore.getState().notesIsLoading).toBe(false);
    });
  });

  describe('loadMoods', () => {
    it("discards this user's own mood notes when the account changed", async () => {
      const pending = deferred<unknown[]>();
      getAllForUser.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadMoods();
      switchToUserC({ moods: [] });

      pending.settle([
        {
          id: 1,
          userId: A,
          mood: 'sad',
          moods: ['sad'],
          note: 'A-OWN-MOOD-NOTE',
          date: '2026-08-03',
          timestamp: new Date('2026-08-03T06:00:00.000Z'),
          synced: true,
        },
      ]);
      await inFlight;

      expect(useAppStore.getState().moods).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-OWN-MOOD-NOTE');
    });
  });

  describe('fetchPartnerMoods', () => {
    it('discards the partner mood notes when the account changed', async () => {
      const { getPartnerId } = await import('../../../src/api/supabaseClient');
      vi.mocked(getPartnerId).mockResolvedValue('USER-B-ID');

      const pending = deferred<unknown[]>();
      fetchMoods.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().fetchPartnerMoods();
      switchToUserC({ partnerMoods: [] });

      pending.settle([
        {
          id: 'm1',
          user_id: 'USER-B-ID',
          mood_type: 'sad',
          mood_types: ['sad'],
          note: 'PARTNERS-PRIVATE-NOTE',
          created_at: '2026-08-03T06:00:00.000Z',
        },
      ]);
      await inFlight;

      expect(useAppStore.getState().partnerMoods).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('PARTNERS-PRIVATE-NOTE');
    });
  });

  // ==========================================================================
  // photosSlice
  // ==========================================================================

  describe('loadPhotos', () => {
    it('discards the gallery when the account changed', async () => {
      const pending = deferred<unknown[]>();
      getPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      switchToUserC({ photos: [{ id: 'c-photo', caption: 'C-OWN-CAPTION' }] });

      pending.settle([{ id: 'a-photo', caption: 'A-PHOTO-CAPTION' }]);
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([{ id: 'c-photo', caption: 'C-OWN-CAPTION' }]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PHOTO-CAPTION');
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      // The catch path writes `error` — an app-wide banner — and blanks `photos`.
      const pending = deferred<unknown[]>();
      getPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      switchToUserC({ photos: [{ id: 'c-photo', caption: 'C-OWN-CAPTION' }], error: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photos).toEqual([{ id: 'c-photo', caption: 'C-OWN-CAPTION' }]);
    });
  });

  // ==========================================================================
  // interactionsSlice
  // ==========================================================================

  describe('loadInteractionHistory', () => {
    it('discards interactions and the unviewed badge when the account changed', async () => {
      const pending = deferred<unknown[]>();
      getInteractionHistory.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadInteractionHistory();
      switchToUserC({ interactions: [], unviewedCount: 0 });

      pending.settle([
        {
          id: 'int-1',
          fromUserId: 'USER-B-ID',
          toUserId: A,
          type: 'poke',
          message: 'A-INTERACTION-MESSAGE',
          viewed: false,
          createdAt: new Date('2026-08-03T06:00:00.000Z'),
        },
      ]);
      await inFlight;

      expect(useAppStore.getState().interactions).toEqual([]);
      expect(useAppStore.getState().unviewedCount).toBe(0);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-INTERACTION-MESSAGE');
    });
  });

  // ==========================================================================
  // partnerSlice
  // ==========================================================================

  describe('loadPartner', () => {
    it('discards the partner when the account changed', async () => {
      const pending = deferred<typeof PARTNER_A>();
      getPartner.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPartner();
      switchToUserC({ partner: PARTNER_C });

      pending.settle(PARTNER_A);
      await inFlight;

      expect(useAppStore.getState().partner).toEqual(PARTNER_C);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PARTNER-NAME');
    });

    it('still releases the spinner when it discards', async () => {
      const pending = deferred<typeof PARTNER_A>();
      getPartner.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPartner();
      expect(useAppStore.getState().isLoadingPartner).toBe(true);

      switchToUserC();
      expect(useAppStore.getState().isLoadingPartner).toBe(true);

      pending.settle(PARTNER_A);
      await inFlight;

      // Stuck true renders neither branch of the partner tab and wedges
      // ScriptureOverview on 'loading'.
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
    });

    it("does not blank the new account's partner when the old request fails", async () => {
      // The catch path writes `partner: null` unconditionally without its guard,
      // which erases a partner the new account had already loaded.
      const pending = deferred<typeof PARTNER_A>();
      getPartner.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPartner();
      switchToUserC({ partner: PARTNER_C });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().partner).toEqual(PARTNER_C);
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
    });
  });

  describe('loadPendingRequests', () => {
    it('discards third-party requests when the account changed', async () => {
      const pending = deferred<{ sent: unknown[]; received: unknown[] }>();
      getPendingRequests.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPendingRequests();
      switchToUserC({ sentRequests: [], receivedRequests: [] });

      pending.settle({
        sent: [{ id: 'req-1', toEmail: 'THIRD-PARTY-EMAIL' }],
        received: [],
      });
      await inFlight;

      expect(useAppStore.getState().sentRequests).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('THIRD-PARTY-EMAIL');
    });

    it('still releases the spinner when it discards', async () => {
      const pending = deferred<{ sent: unknown[]; received: unknown[] }>();
      getPendingRequests.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPendingRequests();
      expect(useAppStore.getState().isLoadingRequests).toBe(true);

      switchToUserC();
      pending.settle({ sent: [], received: [] });
      await inFlight;

      expect(useAppStore.getState().isLoadingRequests).toBe(false);
    });

    it("does not blank the new account's requests when the old request fails", async () => {
      const pending = deferred<{ sent: unknown[]; received: unknown[] }>();
      getPendingRequests.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPendingRequests();
      switchToUserC({ sentRequests: [{ id: 'c-req', toEmail: 'C-OWN-PENDING-EMAIL' }] });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().sentRequests).toEqual([
        { id: 'c-req', toEmail: 'C-OWN-PENDING-EMAIL' },
      ]);
      expect(useAppStore.getState().isLoadingRequests).toBe(false);
    });
  });

  describe('searchUsers', () => {
    it('discards search hits — they name third parties — when the account changed', async () => {
      const pending = deferred<unknown[]>();
      searchUsers.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().searchUsers('alex');
      switchToUserC({ searchResults: [] });

      pending.settle([{ id: 'USER-E-ID', displayName: 'SEARCH-HIT-DISPLAY-NAME' }]);
      await inFlight;

      expect(useAppStore.getState().searchResults).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('SEARCH-HIT-DISPLAY-NAME');
    });

    it('still releases isSearching when it discards', async () => {
      const pending = deferred<unknown[]>();
      searchUsers.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().searchUsers('alex');
      expect(useAppStore.getState().isSearching).toBe(true);

      switchToUserC();
      pending.settle([]);
      await inFlight;

      // Stuck true suppresses both the results branch and the no-results branch
      // of PartnerMoodView's connect UI.
      expect(useAppStore.getState().isSearching).toBe(false);
    });

    it("does not clear the new account's search results when the old search fails", async () => {
      const pending = deferred<unknown[]>();
      searchUsers.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().searchUsers('alex');
      switchToUserC({ searchResults: [{ id: 'USER-F-ID', displayName: 'C-OWN-SEARCH-HIT' }] });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().searchResults).toEqual([
        { id: 'USER-F-ID', displayName: 'C-OWN-SEARCH-HIT' },
      ]);
      expect(useAppStore.getState().isSearching).toBe(false);
    });
  });

  // ==========================================================================
  // scriptureReadingSlice — three loaders fire from ScriptureOverview's mount
  // effect, and Sign Out is in the bottom nav of that same screen
  // ==========================================================================

  describe('checkForActiveSession', () => {
    it("does not restore the previous account's unfinished session", async () => {
      const pending = deferred<unknown[]>();
      getUserSessions.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().checkForActiveSession();
      switchToUserC({ activeSession: null });

      pending.settle([
        {
          id: 'A-SESSION-ID',
          status: 'in_progress',
          mode: 'solo',
          startedAt: new Date('2026-08-03T06:00:00.000Z'),
        },
      ]);
      await inFlight;

      expect(useAppStore.getState().activeSession).toBeNull();
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-SESSION-ID');
    });

    it('still releases isCheckingSession when it discards', async () => {
      const pending = deferred<unknown[]>();
      getUserSessions.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().checkForActiveSession();
      expect(useAppStore.getState().isCheckingSession).toBe(true);

      switchToUserC();
      pending.settle([]);
      await inFlight;

      // ScriptureOverview renders its checking branch while this is true and
      // suppresses the mode picker, so a stranded flag is a blank tab.
      expect(useAppStore.getState().isCheckingSession).toBe(false);
    });
  });

  describe('loadCoupleStats', () => {
    it("does not restore the previous pairing's aggregate stats", async () => {
      const pending = deferred<unknown>();
      getCoupleStats.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadCoupleStats();
      switchToUserC({ coupleStats: null });

      pending.settle({ totalSessions: 42, currentStreak: 7, label: 'A-COUPLE-STATS' });
      await inFlight;

      expect(useAppStore.getState().coupleStats).toBeNull();
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-COUPLE-STATS');
    });

    it('still releases isStatsLoading when it discards', async () => {
      const pending = deferred<unknown>();
      getCoupleStats.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadCoupleStats();
      expect(useAppStore.getState().isStatsLoading).toBe(true);

      switchToUserC();
      pending.settle(null);
      await inFlight;

      expect(useAppStore.getState().isStatsLoading).toBe(false);
    });
  });

  describe('loadSession', () => {
    // Not always a user tap: ReadingContainer re-fires this when a partner
    // reconnects, and useScriptureBroadcast re-fires it on channel recovery, so
    // it can be in flight with nobody touching the screen.
    const A_SESSION = {
      id: 'A-SESSION-ID',
      mode: 'solo',
      currentPhase: 'reflection',
      currentStepIndex: 4,
      status: 'in_progress',
      version: 1,
      startedAt: new Date('2026-08-03T06:00:00.000Z'),
      reflection: 'A-REFLECTION-TEXT',
    };

    it("does not restore the previous account's session", async () => {
      const pending = deferred<unknown>();
      getSession.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadSession('A-SESSION-ID');
      switchToUserC({ session: null });

      pending.settle(A_SESSION);
      await inFlight;

      expect(useAppStore.getState().session).toBeNull();
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-REFLECTION-TEXT');
    });

    it('still releases scriptureLoading when it discards', async () => {
      const pending = deferred<unknown>();
      getSession.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadSession('A-SESSION-ID');
      expect(useAppStore.getState().scriptureLoading).toBe(true);

      switchToUserC();
      pending.settle(A_SESSION);
      await inFlight;

      // Stuck true disables the mode cards on ScriptureOverview and makes
      // loadSession itself a no-op forever after (it early-returns on the flag).
      expect(useAppStore.getState().scriptureLoading).toBe(false);
    });

    it('stops the realtime refresh callback writing once the account changes', async () => {
      // The callback is handed to a live subscription, so it outlives the call
      // and can fire at any point afterwards.
      let onRefresh: ((session: unknown) => void) | undefined;
      getSession.mockImplementation((_id: string, cb: (session: unknown) => void) => {
        onRefresh = cb;
        return Promise.resolve(A_SESSION);
      });

      await useAppStore.getState().loadSession('A-SESSION-ID');
      expect(useAppStore.getState().session).toMatchObject({ id: 'A-SESSION-ID' });

      switchToUserC({ session: null });
      onRefresh?.({ ...A_SESSION, reflection: 'A-REFLECTION-PUSHED-AFTER-SWITCH' });

      expect(useAppStore.getState().session).toBeNull();
      expect(JSON.stringify(useAppStore.getState())).not.toContain(
        'A-REFLECTION-PUSHED-AFTER-SWITCH'
      );
    });
  });

  describe('createSession', () => {
    it("does not hand the new account a session it is not a participant in", async () => {
      const pending = deferred<unknown>();
      createSession.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().createSession('solo');
      switchToUserC({ session: null });

      pending.settle({
        id: 'A-CREATED-SESSION-ID',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 0,
        status: 'in_progress',
        version: 1,
        startedAt: new Date('2026-08-03T06:00:00.000Z'),
      });
      await inFlight;

      expect(useAppStore.getState().session).toBeNull();
      expect(useAppStore.getState().scriptureLoading).toBe(false);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-CREATED-SESSION-ID');
    });
  });

  describe('updateSyncStatus', () => {
    it("does not badge the new account with the previous one's pending count", async () => {
      const pending = deferred<unknown[]>();
      getUnsyncedMoods.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().updateSyncStatus();
      switchToUserC();

      pending.settle([{ id: 1 }, { id: 2 }, { id: 3 }]);
      await inFlight;

      expect(useAppStore.getState().syncStatus.pendingMoods).toBe(0);
    });
  });

  // ==========================================================================
  // eventsSlice
  // ==========================================================================

  describe('loadEvents', () => {
    it('discards the couple’s events when the account changed', async () => {
      const pending = deferred<unknown[]>();
      getEvents.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadEvents();
      switchToUserC({ events: [{ id: 'c-event', label: 'C-OWN-EVENT-LABEL' }] });

      pending.settle([{ id: 'a-event', label: 'A-PRIVATE-EVENT-LABEL' }]);
      await inFlight;

      expect(useAppStore.getState().events).toEqual([{ id: 'c-event', label: 'C-OWN-EVENT-LABEL' }]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-EVENT-LABEL');
    });

    it('leaves a successor account’s live spinner alone when it discards', async () => {
      // The real account transition resets eventsIsLoading via signedOutState()
      // (pinned by signOutClearsAccountState.test.ts), so the guard has nothing
      // to release. C is seeded mid-load: a stale resolution that wrote the
      // flag would clear C's own live spinner and flash an empty list while
      // C's request is still open.
      const pending = deferred<unknown[]>();
      getEvents.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadEvents();
      expect(useAppStore.getState().eventsIsLoading).toBe(true);

      switchToUserC({
        events: [{ id: 'c-event', label: 'C-OWN-EVENT-LABEL' }],
        eventsError: null,
        eventsIsLoading: true,
      });
      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().eventsIsLoading).toBe(true);
      // The error must not land on the account that did not make the request,
      // and C's own list must stay intact.
      expect(useAppStore.getState().eventsError).toBeNull();
      expect(useAppStore.getState().events).toEqual([{ id: 'c-event', label: 'C-OWN-EVENT-LABEL' }]);
    });
  });

  // The three write actions set() after their await too, so each carries the
  // same guard. Without these describes, deleting any one of the three guards
  // leaves the whole suite green — the failure this file's header records.

  describe('addEvent', () => {
    it('does not drop the previous account\'s new event into this one\'s list', async () => {
      const pending = deferred<unknown>();
      createEvent.mockReturnValue(pending.promise);

      // C's row is a COMPLETE CoupleEvent on purpose. `sortByDate` reads
      // `.date.getTime()`, so a `{ id, label }` stub throws inside the set()
      // updater — which the catch swallows, making this test pass with the
      // guard deleted. Verified: with a stub it does not discriminate.
      const cOwnEvent = {
        id: 'c-event',
        userId: C,
        label: 'C-OWN-EVENT-LABEL',
        date: new Date(2026, 11, 25),
        description: null,
        icon: 'calendar',
      };

      const inFlight = useAppStore.getState().addEvent({
        label: 'A-PRIVATE-EVENT-LABEL',
        eventDate: '2026-10-31',
      });
      switchToUserC({ events: [cOwnEvent] });

      pending.settle({
        id: 'a-event',
        userId: A,
        label: 'A-PRIVATE-EVENT-LABEL',
        date: new Date(2026, 9, 31),
        description: null,
        icon: 'calendar',
      });
      await inFlight;

      expect(useAppStore.getState().events).toEqual([cOwnEvent]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-EVENT-LABEL');
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      const pending = deferred<unknown>();
      createEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().addEvent({
        label: 'x',
        eventDate: '2026-10-31',
      });
      switchToUserC({ events: [], eventsError: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().eventsError).toBeNull();
    });
  });

  describe('editEvent', () => {
    it('does not apply the previous account\'s edit to this one\'s list', async () => {
      const pending = deferred<unknown>();
      updateEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().editEvent('a-event', { label: 'renamed' });
      switchToUserC({ events: [{ id: 'a-event', label: 'C-OWN-EVENT-LABEL' }] });

      pending.settle({
        id: 'a-event',
        userId: A,
        label: 'A-PRIVATE-EVENT-LABEL',
        date: new Date(2026, 9, 31),
        description: null,
        icon: 'calendar',
      });
      await inFlight;

      // Same id in both accounts: without the guard the map() would overwrite
      // C's row with A's, which is the leak in its most direct form.
      expect(useAppStore.getState().events).toEqual([
        { id: 'a-event', label: 'C-OWN-EVENT-LABEL' },
      ]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-EVENT-LABEL');
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      const pending = deferred<unknown>();
      updateEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().editEvent('a-event', { label: 'x' });
      switchToUserC({ events: [], eventsError: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().eventsError).toBeNull();
    });
  });

  describe('removeEvent', () => {
    it('does not delete this account\'s event because the previous one asked', async () => {
      const pending = deferred<unknown>();
      deleteEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().removeEvent('shared-id');
      switchToUserC({ events: [{ id: 'shared-id', label: 'C-OWN-EVENT-LABEL' }] });

      pending.settle(undefined);
      await inFlight;

      // The filter is by id alone, so an unguarded write would take C's row out
      // of C's list on A's behalf.
      expect(useAppStore.getState().events).toEqual([
        { id: 'shared-id', label: 'C-OWN-EVENT-LABEL' },
      ]);
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      const pending = deferred<unknown>();
      deleteEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().removeEvent('a-event');
      switchToUserC({ events: [], eventsError: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().eventsError).toBeNull();
    });
  });

  // ==========================================================================
  // The ordinary path the guards wrap
  // ==========================================================================

  describe('when the identity has not changed', () => {
    it('loadPartner writes normally', async () => {
      getPartner.mockResolvedValue(PARTNER_A);

      await useAppStore.getState().loadPartner();

      expect(useAppStore.getState().partner).toEqual(PARTNER_A);
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
    });

    it('fetchNotes writes normally', async () => {
      loveNotesQuery.mockReturnValue(
        loveNotesBuilder(Promise.resolve({ data: [note('a1', 'A-CHAT')], error: null }))
      );

      await useAppStore.getState().fetchNotes();

      expect(useAppStore.getState().notes).toEqual([note('a1', 'A-CHAT')]);
      expect(useAppStore.getState().notesIsLoading).toBe(false);
    });

    it('loadCoupleStats writes normally', async () => {
      getCoupleStats.mockResolvedValue({ totalSessions: 3 });

      await useAppStore.getState().loadCoupleStats();

      expect(useAppStore.getState().coupleStats).toEqual({ totalSessions: 3 });
      expect(useAppStore.getState().isStatsLoading).toBe(false);
    });

    it('loadEvents writes normally', async () => {
      getEvents.mockResolvedValue([{ id: 'a-event', label: 'A-EVENT' }]);

      await useAppStore.getState().loadEvents();

      expect(useAppStore.getState().events).toEqual([{ id: 'a-event', label: 'A-EVENT' }]);
      expect(useAppStore.getState().eventsIsLoading).toBe(false);
    });

    it('checkForActiveSession writes normally', async () => {
      getUserSessions.mockResolvedValue([
        {
          id: 'A-SESSION-ID',
          status: 'in_progress',
          mode: 'solo',
          startedAt: new Date('2026-08-03T06:00:00.000Z'),
        },
      ]);

      await useAppStore.getState().checkForActiveSession();

      expect(useAppStore.getState().activeSession).toMatchObject({ id: 'A-SESSION-ID' });
      expect(useAppStore.getState().isCheckingSession).toBe(false);
    });
  });
});
