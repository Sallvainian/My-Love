/**
 * Auth Slice
 *
 * Single source of truth for authenticated user identity across all slices.
 * Populated by onAuthStateChange in App.tsx — readable synchronously via get().userId.
 *
 * Cross-slice dependencies:
 * - All slices read userId from this slice instead of making async auth calls
 *
 * Persistence:
 * - NOT persisted (derived from Supabase session on each app load)
 */

import type { AppState, AppStateCreator } from '../types';
import { revokePreviewUrlsFromNotes } from './notesSlice';

/**
 * Every field that belongs to one account and must not outlive its session.
 *
 * The store is a single flat object shared by all slices, and it survives
 * sign-out: signing out unmounts the React tree but nothing recreates the
 * store, which is exactly what makes an in-place account switch work. So
 * anything left here is still on screen for the next person to sign in on the
 * same device.
 *
 * Clearing a subset is worse than clearing none, because absence is itself a
 * render condition. Clearing `partner` alone flipped PartnerMoodView into its
 * `!partner` branch, which paints `sentRequests`, `receivedRequests` and
 * `searchResults` — so closing one disclosure opened another in the same
 * component. Every account-scoped field goes, together.
 *
 * The re-fetch that would normally correct stale data cannot be relied on: the
 * loaders are gated on connectivity, and offline there is no correction at all.
 *
 * ADDING STATE? If it is derived from the signed-in user or their partner, add
 * it here. `signOutClearsAccountState.test.ts` asserts that every key in this
 * object is reset, so DELETING or renaming one fails there.
 *
 * Loading flags and write locks belong here too, even though they disclose
 * nothing. A stranded flag is a dead screen for the next account: the partner
 * tab renders neither branch while `isLoadingPartner` is true, and a held
 * `isSyncing` makes every Next tap in a reading session a no-op.
 *
 * It cannot catch a field that was never added — no test can know about state
 * nobody declared. That gap is real; the compensating control is that a loader
 * writing account data after an await needs an identity guard anyway, and those
 * are covered by `loaderIdentityGuards.test.ts`.
 *
 * A FUNCTION, not a constant, for two reasons: `syncStatus.isOnline` is device
 * state rather than account state and has to be read at sign-out rather than at
 * module load, and building fresh arrays each time removes the standing
 * requirement that no slice ever mutate a store array in place.
 */
export function signedOutState() {
  return {
    // moodSlice
    moods: [],
    partnerMoods: [],
    syncStatus: {
      pendingMoods: 0,
      // Whose moods are pending is account state; whether the device has a
      // network is not, so it is carried across rather than reset.
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      lastSyncAt: undefined,
      isSyncing: false,
    },

    // partnerSlice — identity, pending requests and search hits all name real people
    partner: null,
    isLoadingPartner: false,
    sentRequests: [],
    receivedRequests: [],
    isLoadingRequests: false,
    searchResults: [],
    isSearching: false,

    // notesSlice — the love-notes chat is the largest private disclosure here
    notes: [],
    notesIsLoading: false,
    notesError: null,
    notesHasMore: true,
    sentMessageTimestamps: [],
    notesPendingRemoval: [],

    // photosSlice
    photos: [],
    selectedPhotoId: null,
    isUploading: false,
    uploadProgress: 0,
    storageWarning: null,

    // interactionsSlice
    interactions: [],
    unviewedCount: 0,
    isSubscribed: false,

    // scriptureReadingSlice
    session: null,
    scriptureLoading: false,
    // Write locks, not spinners: advanceStep, saveAndExit, saveSession,
    // retryFailedWrite and endSession all early-return while isSyncing is true,
    // and lockIn does the same on isPendingLockIn. A sign-out landing mid-write
    // leaves the lock held — createSession does not clear it — so the next
    // account starts a reading session with every Next tap silently dropped.
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
  } satisfies Partial<AppState>;
}

export interface AuthSlice {
  /** Logged-in user's auth ID — null when signed out */
  userId: string | null;
  /** User's email for display purposes */
  userEmail: string | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;

  /** Set authenticated user (called from onAuthStateChange in App.tsx) */
  setAuthUser: (userId: string | null, email?: string | null) => void;
  /** Clear auth state on sign-out */
  clearAuth: () => void;
}

export const createAuthSlice: AppStateCreator<AuthSlice> = (set, get, _api) => ({
  userId: null,
  userEmail: null,
  isAuthenticated: false,

  setAuthUser: (userId, email) => {
    // An account switch that never passes through a null session -- signing in
    // over a live one -- reaches here without clearAuth ever running, and would
    // otherwise carry the previous account's data into the new one. Route it
    // through signedOutState() rather than listing fields here, so this stays
    // correct as slices grow: that helper is the single place account state is
    // cleared. A repeat call for the SAME user (TOKEN_REFRESHED,
    // INITIAL_SESSION, USER_UPDATED) must not reset anything.
    const previous = get().userId;
    const switchedAccount = previous !== null && userId !== null && previous !== userId;

    set({
      ...(switchedAccount ? signedOutState() : {}),
      userId,
      userEmail: email ?? null,
      isAuthenticated: !!userId,
    });
  },

  clearAuth: () => {
    // Release the object URLs first. Every other writer of `notes` goes through
    // this helper; assigning `[]` directly would strand them, because the
    // unmount cleanup that would otherwise revoke reads the live array and
    // clearAuth has already emptied it by the time React unmounts.
    revokePreviewUrlsFromNotes(get().notes);

    // Everything account-scoped goes at once. Nothing is lost that is not
    // re-derivable: these are read caches of Supabase and IndexedDB, and
    // unsynced local entries stay in IndexedDB for their owner to pick up.
    set({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      ...signedOutState(),
    });
  },
});
