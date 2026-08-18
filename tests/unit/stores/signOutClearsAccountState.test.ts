/**
 * Sign-out must not leave one account's data visible to the next
 *
 * `clearAuth` is the only thing that runs on sign-out that touches store state.
 * Signing out unmounts the React tree but nothing recreates the Zustand store —
 * that is precisely what makes an in-place account switch work — so anything it
 * does not clear is still on screen for the next person to sign in.
 *
 * This drives the COMPOSED `useAppStore`, not one slice in isolation. An earlier
 * version of this file built its store from `createAuthSlice` alone, which made
 * its store-wide sweep structurally incapable of failing: `getState()` could
 * only ever contain keys the test itself had seeded, so a leak in notesSlice or
 * partnerSlice was invisible to the very assertion written to catch it.
 *
 * Clearing a SUBSET is worse than clearing nothing, because absence is itself a
 * render condition: clearing `partner` alone flips PartnerMoodView into its
 * `!partner` branch, which paints `sentRequests`, `receivedRequests` and
 * `searchResults`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

import { useAppStore } from '../../../src/stores/useAppStore';
import { signedOutState } from '../../../src/stores/slices/authSlice';

const EXPECTED_RESET: Record<string, unknown> = {
  moods: [],
  partnerMoods: [],
  syncStatus: {
    pendingMoods: 0,
    // Device state, not account state — carried across rather than reset.
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSyncAt: undefined,
    isSyncing: false,
  },
  partner: null,
  isLoadingPartner: false,
  sentRequests: [],
  receivedRequests: [],
  isLoadingRequests: false,
  searchResults: [],
  isSearching: false,
  notes: [],
  notesIsLoading: false,
  notesError: null,
  notesHasMore: true,
  sentMessageTimestamps: [],
  notesPendingRemoval: [],
  photos: [],
  selectedPhotoId: null,
  isUploading: false,
  uploadProgress: 0,
  storageWarning: null,
  interactions: [],
  unviewedCount: 0,
  isSubscribed: false,
  session: null,
  scriptureLoading: false,
  isSyncing: false,
  isPendingLockIn: false,
  isPendingReflection: false,
  activeSession: null,
  isCheckingSession: false,
  coupleStats: null,
  isStatsLoading: false,
  myRole: null,
  partnerJoined: false,
  myReady: false,
  partnerReady: false,
  partnerLocked: false,
  partnerDisconnected: false,
  partnerDisconnectedAt: null,
  countdownStartedAt: null,
  pendingRetry: null,
  scriptureError: null,
  isInitialized: false,
  events: [],
  eventsIsLoading: false,
  eventsError: null,
};

/** Identifiers that must not survive a sign-out */
const SECRETS = {
  ownNote: 'MY-OWN-PRIVATE-NOTE',
  partnerNote: 'PARTNERS-PRIVATE-NOTE',
  partnerName: 'PARTNER-DISPLAY-NAME',
  chatMessage: 'THE-LOVE-NOTES-CHAT-BODY',
  requestedEmail: 'PENDING-REQUEST-EMAIL',
  searchHitName: 'SEARCH-RESULT-DISPLAY-NAME',
  photoCaption: 'PHOTO-CAPTION-TEXT',
  reflection: 'SCRIPTURE-REFLECTION-TEXT',
  userId: 'USER-A-ID',
};

function moodEntry(userId: string, note: string) {
  return {
    id: 1,
    userId,
    mood: 'sad' as const,
    moods: ['sad' as const],
    note,
    date: '2026-08-03',
    timestamp: new Date('2026-08-03T06:00:00.000Z'),
    synced: true,
  };
}

/** Fill every account-scoped corner of the store the way a live session would */
function seedSignedInSession(): void {
  useAppStore.setState({
    userId: SECRETS.userId,
    userEmail: 'a@example.com',
    isAuthenticated: true,

    moods: [moodEntry(SECRETS.userId, SECRETS.ownNote)],
    partnerMoods: [moodEntry('USER-B-ID', SECRETS.partnerNote)],

    partner: {
      id: 'USER-B-ID',
      displayName: SECRETS.partnerName,
      email: 'b@example.com',
    },
    sentRequests: [{ id: 'req-1', toEmail: SECRETS.requestedEmail }],
    receivedRequests: [{ id: 'req-2', fromEmail: SECRETS.requestedEmail }],
    searchResults: [{ id: 'USER-C-ID', displayName: SECRETS.searchHitName }],

    notes: [
      {
        id: 'note-1',
        from_user_id: SECRETS.userId,
        to_user_id: 'USER-B-ID',
        content: SECRETS.chatMessage,
        created_at: '2026-08-03T06:00:00.000Z',
      },
    ],
    sentMessageTimestamps: [1],
    // Which messages the previous account removed is theirs, not the next
    // signer-in's — and left behind it would filter their notes by stale ids.
    notesPendingRemoval: ['note-1'],

    photos: [{ id: 'photo-1', caption: SECRETS.photoCaption }],
    selectedPhotoId: 'photo-1',

    interactions: [{ id: 'int-1', from_user_id: 'USER-B-ID', type: 'poke' }],
    unviewedCount: 3,

    activeSession: { id: 'sess-1', userId: SECRETS.userId, notes: SECRETS.reflection },
    myRole: 'host',
    partnerJoined: true,
    // Seeding shapes loosely on purpose: the point is what SURVIVES, not that
    // each fixture satisfies its full production type.
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
}

describe('clearAuth on sign-out', () => {
  beforeEach(() => {
    seedSignedInSession();
  });

  it('clears the identity', () => {
    useAppStore.getState().clearAuth();

    expect(useAppStore.getState().userId).toBeNull();
    expect(useAppStore.getState().userEmail).toBeNull();
    expect(useAppStore.getState().isAuthenticated).toBe(false);
  });

  it('clears both mood arrays', () => {
    useAppStore.getState().clearAuth();

    expect(useAppStore.getState().moods).toEqual([]);
    // The partner's entries carry the partner's free-text notes, so they are
    // exactly as private as the user's own.
    expect(useAppStore.getState().partnerMoods).toEqual([]);
  });

  it('clears the partner identity and everything the !partner branch renders', () => {
    useAppStore.getState().clearAuth();

    const state = useAppStore.getState();
    expect(state.partner).toBeNull();
    // Clearing `partner` alone is what makes these reachable — PartnerMoodView
    // renders its search-and-request UI precisely when `partner` is null.
    expect(state.sentRequests).toEqual([]);
    expect(state.receivedRequests).toEqual([]);
    expect(state.searchResults).toEqual([]);
  });

  it('clears the love-notes chat', () => {
    useAppStore.getState().clearAuth();

    // The largest private disclosure in the app, and it has the same property
    // that justified clearing partnerMoods: the empty-state placeholder only
    // shows while the array is EMPTY, so a stale chat is never masked.
    expect(useAppStore.getState().notes).toEqual([]);
  });

  it('clears photos, interactions and the scripture session', () => {
    useAppStore.getState().clearAuth();

    const state = useAppStore.getState();
    expect(state.photos).toEqual([]);
    expect(state.selectedPhotoId).toBeNull();
    expect(state.interactions).toEqual([]);
    expect(state.unviewedCount).toBe(0);
    expect(state.activeSession).toBeNull();
  });

  it('leaves no trace of the seeded identifiers anywhere in the store', () => {
    useAppStore.getState().clearAuth();

    const remaining = JSON.stringify(useAppStore.getState());
    for (const [label, secret] of Object.entries(SECRETS)) {
      expect(remaining, `${label} survived sign-out`).not.toContain(secret);
    }
  });

  it('resets every field the reset is supposed to cover', () => {
    // Deliberately duplicated from the source rather than derived from it.
    // Iterating signedOutState() itself is circular — deleting a field removes
    // its own assertion, which is why the first attempt at this test still let
    // 24 of 36 deletions through. An independent list is the whole point.
    const distinguishable = (resetValue: unknown): unknown => {
      if (Array.isArray(resetValue)) return ['NOT-RESET'];
      if (typeof resetValue === 'boolean') return !resetValue;
      if (typeof resetValue === 'number') return resetValue + 99;
      return 'NOT-RESET';
    };

    const dirty: Record<string, unknown> = {};
    for (const [key, resetValue] of Object.entries(EXPECTED_RESET)) {
      dirty[key] = distinguishable(resetValue);
    }
    useAppStore.setState(dirty as unknown as Parameters<typeof useAppStore.setState>[0]);

    useAppStore.getState().clearAuth();

    const after = useAppStore.getState() as unknown as Record<string, unknown>;
    for (const [key, resetValue] of Object.entries(EXPECTED_RESET)) {
      expect(after[key], `${key} was not reset by clearAuth`).toEqual(resetValue);
    }
  });

  it("drops the previous account's pending count but keeps the device's network state", () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    useAppStore.setState({
      syncStatus: {
        pendingMoods: 7,
        isOnline: false,
        lastSyncAt: new Date('2026-08-03T06:00:00.000Z'),
        isSyncing: true,
      },
    } as unknown as Parameters<typeof useAppStore.setState>[0]);

    useAppStore.getState().clearAuth();

    const { syncStatus } = useAppStore.getState();
    // Whose moods are pending, and when they last synced, belong to the account.
    expect(syncStatus.pendingMoods).toBe(0);
    expect(syncStatus.lastSyncAt).toBeUndefined();
    expect(syncStatus.isSyncing).toBe(false);
    // Whether the device has a network does not — resetting it to true would
    // put the badge on "Online" while the phone is in a tunnel.
    expect(syncStatus.isOnline).toBe(false);

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('releases the scripture write lock so the next account is not wedged', () => {
    // `isSyncing` is a lock, not a spinner: advanceStep, saveAndExit,
    // saveSession, retryFailedWrite and endSession all early-return while it is
    // held, and `createSession` does not clear it. Sign out with a scripture
    // write in flight (a hung fetch has no timeout) and the next account starts
    // a reading session in which every Next tap is silently dropped.
    useAppStore.setState({
      isSyncing: true,
      isPendingLockIn: true,
    } as unknown as Parameters<typeof useAppStore.setState>[0]);

    useAppStore.getState().clearAuth();

    expect(useAppStore.getState().isSyncing).toBe(false);
    expect(useAppStore.getState().isPendingLockIn).toBe(false);
  });

  it('revokes the preview URLs of the notes it is about to drop', () => {
    // A failed image send keeps its blob URL on the note. Every other writer of
    // `notes` revokes through the shared helper, and the unmount cleanup that
    // would otherwise catch these reads the live array — which clearAuth has
    // already emptied by the time React unmounts. Assigning `[]` without
    // revoking first pins the compressed image in memory for the lifetime of
    // the document, and nothing later can reach the URL to free it.
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    useAppStore.setState({
      notes: [
        {
          id: 'note-failed',
          from_user_id: SECRETS.userId,
          to_user_id: 'USER-B-ID',
          content: SECRETS.chatMessage,
          created_at: '2026-08-03T06:00:00.000Z',
          imagePreviewUrl: 'blob:http://localhost/ORPHANED-BLOB',
        },
      ],
    } as unknown as Parameters<typeof useAppStore.setState>[0]);

    useAppStore.getState().clearAuth();

    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/ORPHANED-BLOB');
    expect(useAppStore.getState().notes).toEqual([]);
    revoke.mockRestore();
  });

  it('an account switch that never signs out also clears the previous account', () => {
    // clearAuth is not the only way the store changes hands. onAuthStateChange
    // routes every session-bearing event to setAuthUser (App.tsx:233), which
    // used to set only userId/userEmail/isAuthenticated -- so a sign-in over a
    // live session would have carried the previous couple's chat into the new
    // account on a shared device.
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    seedSignedInSession();
    useAppStore.setState({
      notes: [
        {
          id: 'note-failed',
          from_user_id: SECRETS.userId,
          to_user_id: 'USER-B-ID',
          content: SECRETS.chatMessage,
          created_at: '2026-08-03T06:00:00.000Z',
          imagePreviewUrl: 'blob:http://localhost/SWITCH-ORPHANED-BLOB',
        },
      ],
    } as unknown as Parameters<typeof useAppStore.setState>[0]);
    expect(useAppStore.getState().notes.length).toBeGreaterThan(0);

    useAppStore.getState().setAuthUser('USER-B-ID', 'b@example.com');

    // Resetting without revoking first strands the blob URL: the array it lives
    // in is gone, so nothing can reach it afterwards. clearAuth has always done
    // this; the switch path has to as well.
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/SWITCH-ORPHANED-BLOB');
    revoke.mockRestore();

    expect(useAppStore.getState().userId).toBe('USER-B-ID');
    expect(useAppStore.getState().notes).toEqual([]);
    expect(useAppStore.getState().moods).toEqual([]);
    expect(useAppStore.getState().photos).toEqual([]);
    expect(useAppStore.getState().partner).toBeNull();
    expect(useAppStore.getState().notesPendingRemoval).toEqual([]);
    expect(JSON.stringify(useAppStore.getState())).not.toContain(SECRETS.chatMessage);
  });

  it('a repeat event for the SAME user leaves the session alone', () => {
    // TOKEN_REFRESHED, INITIAL_SESSION and USER_UPDATED all arrive here with the
    // same user. Resetting on those would wipe the screen mid-session.
    seedSignedInSession();
    const before = useAppStore.getState().notes;

    useAppStore.getState().setAuthUser(SECRETS.userId, 'a@example.com');

    expect(useAppStore.getState().notes).toBe(before);
    expect(useAppStore.getState().userId).toBe(SECRETS.userId);
  });

  it('signedOutState() and this test agree on which fields exist', () => {
    // Catches drift in the other direction: a field ADDED to the source without
    // being added here would otherwise go unasserted forever.
    expect(Object.keys(signedOutState()).sort()).toEqual(Object.keys(EXPECTED_RESET).sort());
  });
});
