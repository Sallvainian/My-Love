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
 * it here. `signOutClearsAccountState.test.ts` seeds the composed store and
 * fails on any identifier that survives, so an omission shows up there.
 */
const SIGNED_OUT_STATE = {
  // moodSlice
  moods: [],
  partnerMoods: [],

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
} satisfies Partial<AppState>;

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

export const createAuthSlice: AppStateCreator<AuthSlice> = (set) => ({
  userId: null,
  userEmail: null,
  isAuthenticated: false,

  setAuthUser: (userId, email) => {
    set({
      userId,
      userEmail: email ?? null,
      isAuthenticated: !!userId,
    });
  },

  clearAuth: () => {
    // Everything account-scoped goes at once. Nothing is lost that is not
    // re-derivable: these are read caches of Supabase and IndexedDB, and
    // unsynced local entries stay in IndexedDB for their owner to pick up.
    set({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      ...SIGNED_OUT_STATE,
    });
  },
});
