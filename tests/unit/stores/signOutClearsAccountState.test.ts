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
import { SIGNED_OUT_STATE } from '../../../src/stores/slices/authSlice';

const EXPECTED_RESET: Record<string, unknown> = {
  moods: [],
  partnerMoods: [],
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
  photos: [],
  selectedPhotoId: null,
  isUploading: false,
  uploadProgress: 0,
  storageWarning: null,
  interactions: [],
  unviewedCount: 0,
  isSubscribed: false,
  session: null,
  activeSession: null,
  coupleStats: null,
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
    // Iterating SIGNED_OUT_STATE itself is circular — deleting a field removes
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

  it('SIGNED_OUT_STATE and this test agree on which fields exist', () => {
    // Catches drift in the other direction: a field ADDED to the source without
    // being added here would otherwise go unasserted forever.
    expect(Object.keys(SIGNED_OUT_STATE).sort()).toEqual(Object.keys(EXPECTED_RESET).sort());
  });
});
