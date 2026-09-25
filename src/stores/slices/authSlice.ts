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

import { deleteAccountImages } from '../../services/imageCache';
import { deleteAccountCopies } from '../../services/localCopy';
import type { AppState, AppStateCreator } from '../types';
import { revokePreviewUrlsFromNotes } from './notesSlice';

/**
 * localStorage key naming the account whose saved data is on this device.
 *
 * `userId` is not persisted, so a boot with no recoverable session (expired or
 * revoked refresh token, sign-out-everywhere from another device) reaches
 * `clearAuth` with `userId` never set. This marker is how that path still
 * knows whose local copies and cached images to delete. It holds only an id —
 * never the data itself.
 */
export const ACCOUNT_OWNER_STORAGE_KEY = 'my-love-account-owner';

function setAccountOwner(userId: string | null): void {
  try {
    if (userId === null) localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
    else localStorage.setItem(ACCOUNT_OWNER_STORAGE_KEY, userId);
  } catch (error) {
    console.error('[AuthSlice] Failed to record the device account owner:', error);
  }
}

function getAccountOwner(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Delete one account's saved data from this device: its local copies
 * (anniversaries, partner, couple settings, custom messages and favorites, …)
 * and its cached images.
 * Nothing else — unsynced `moods` rows and any other queued write stay for
 * their owner to send on the next sign-in. The server keeps everything, so the
 * next signed-in refresh brings it back.
 *
 * Fire-and-forget: sign-out must not wait on IndexedDB, and a failed delete is
 * logged rather than blocking it. Loaders and writes re-check identity before
 * saving a copy, so a refresh or write the outgoing account already started
 * cannot re-create its copy afterwards.
 */
function deleteAccountData(userId: string): void {
  deleteAccountCopies(userId).catch((error: unknown) => {
    console.error('[AuthSlice] Failed to delete the outgoing account\'s local copies:', error);
  });
  deleteAccountImages(userId).catch((error: unknown) => {
    console.error('[AuthSlice] Failed to delete the outgoing account\'s cached images:', error);
  });
}

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
 * tab renders neither branch while `isLoadingPartner` is true.
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
    partnerLoadError: false,
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

    // messagesSlice — a custom message is one account's private writing, and
    // the AdminPanel lists `customMessages` directly. `customMessagesLoaded` is
    // the flag AdminPanel's effect gates its reload on, so leaving it true
    // strands the previous account's list on screen with nothing to refresh it.
    //
    // `messages` is NOT reset here, because it is not wholly account state: it
    // also holds the shared daily rows, and nothing reloads them after an
    // in-place account switch (`initializeApp` is guarded to run once per page
    // load), so emptying it would leave the next account with a blank Home and
    // no rotation pool at all. `discardAccountState` strips its custom rows
    // instead — see the comment there.
    customMessages: [],
    customMessagesLoaded: false,
    // Names why THIS account's favorite write failed; stale for the next one.
    favoriteError: null,

    // photosSlice — the couple's album; its `photos` local copy and cached
    // images are per-account (deleted for the outgoing account by
    // `deleteAccountData`). The loaded flag and load error go too: a stranded
    // `photosLoaded` would show the next account an empty album instead of its
    // skeleton.
    photos: [],
    photosLoaded: false,
    photosLoadError: null,
    storageWarning: null,

    // interactionsSlice — the partner snapshot names the previous couple, and
    // a stale one would let the next account accept that couple's traffic
    interactions: [],
    unviewedCount: 0,
    isSubscribed: false,
    interactionPartnerId: null,

    // eventsSlice — a couple's countdown dates are theirs, and nothing else
    // clears them from memory: events are deliberately absent from
    // `partialize`, their `events` local copy is per-account (deleted for the
    // outgoing account by `deleteAccountCopies`), and the server read that
    // would correct them needs a connection. The loading flag goes too, on the
    // same rule as the others.
    events: [],
    eventsIsLoading: false,
    eventsError: null,
    eventsPagination: null,
    eventsIsLoadingMore: false,
    eventsHistoryError: null,

    // settingsSlice — the couple's shared start date names this couple's
    // relationship; the incoming account's refresher reads its own copy.
    coupleSettings: null,
    // The outgoing account's own name and birthday.
    ownProfile: null,
  } satisfies Partial<AppState>;
}

export interface AuthSlice {
  /** Logged-in user's auth ID — null when signed out */
  userId: string | null;
  /** User's email for display purposes */
  userEmail: string | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Runtime ownership for one auth lifetime; stable across same-user refreshes. */
  authSessionVersion: number;

  /** Set authenticated user (called from onAuthStateChange in App.tsx) */
  setAuthUser: (userId: string | null, email?: string | null) => void;
  /** Clear auth state on sign-out */
  clearAuth: () => void;
}

/**
 * Put the incoming account's own custom messages back into the rotation pool.
 *
 * `discardAccountState` strips the outgoing account's custom rows from
 * `messages`, and nothing else refills them: `initializeApp` is guarded by a
 * module-level flag AND an App-level ref, both of which survive sign-out, so it
 * runs once per page load; `loadMessages()` is otherwise reached only from the
 * custom-message mutators. Without this, an account that signs in over another
 * rotates through the bundled daily messages alone until they happen to edit a
 * custom message or reload the page — which is the very pool the ownership work
 * exists to get right.
 *
 * Fire-and-forget, because `setAuthUser` is called synchronously from
 * `onAuthStateChange` and must not become async. `loadMessages` carries the
 * usual `{ userId, authSessionVersion }` capture-and-recheck and captures AFTER
 * the new identity is in the store, so a reload raised for one account cannot
 * write under the next; the recompute that follows re-checks the same pair.
 *
 * `updateCurrentMessage()` is what actually repaints Home: `discardAccountState`
 * nulls a custom `currentMessage`, and nothing else recomputes it in-session.
 *
 * Skipped when `messages` is empty, which is the cold-boot case — the array is
 * not persisted, so it is empty until `initializeApp` seeds it. Firing there
 * would race that seed with a read of a still-empty store. It also keeps this
 * inert for callers that compose a partial store without messagesSlice.
 */
function reloadRotationPool(get: () => AppState): void {
  if ((get().messages?.length ?? 0) === 0) return;

  const { userId, authSessionVersion } = get();
  void get()
    .loadMessages()
    .then(() => {
      if (get().userId !== userId || get().authSessionVersion !== authSessionVersion) return;
      get().updateCurrentMessage();
    })
    // `loadMessages` swallows its own errors, but `updateCurrentMessage` runs
    // inside the callback above and nothing is awaiting this chain — a throw
    // there would surface as an unhandled rejection on the auth path, with no
    // caller to report it.
    .catch((error) => {
      console.error('[AuthSlice] Failed to reload the rotation pool:', error);
    });
}

/**
 * The one way account state is discarded.
 *
 * Revoking and resetting are a pair, not two steps a caller may pick from.
 * `signedOutState()` empties `notes`, and the unmount cleanup that would
 * otherwise release their blob URLs reads the live array — so a writer that
 * takes the reset without the revoke strands every preview URL on a failed image
 * send for the lifetime of the document. That is not hypothetical: `clearAuth`
 * carried the rule in a comment, `setAuthUser` later reused `signedOutState()`
 * alone, and the comment did not stop it. Both callers now go through here, so
 * the two cannot come apart again.
 */
function discardAccountState(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  identity: Pick<AuthSlice, 'userId' | 'userEmail' | 'isAuthenticated'>
): void {
  revokePreviewUrlsFromNotes(get().notes);

  // Everything account-scoped goes at once. Nothing is lost that is not
  // re-derivable: these are read caches of Supabase and IndexedDB, and unsynced
  // local entries stay in IndexedDB for their owner to pick up.
  //
  // `settings` survives as a whole — it is the device-persisted blob —
  // except relationship.anniversaries inside it, which is
  // couple data rendered on Home. It is reset to `[]`: the account's saved copy
  // is its local copy (kind `anniversaries`), which the incoming account's
  // refresher reads for itself. This cannot live in signedOutState(), which has
  // no access to the current object it must otherwise preserve.
  const settings = get().settings;
  // A no-session boot (expired or revoked refresh token, sign-out-everywhere
  // from the partner's device) reaches here with userId never populated —
  // authSlice is not persisted. The owner marker recorded at the last sign-in
  // is what tells that path whose data to delete.
  const outgoingUserId = get().userId ?? getAccountOwner();
  setAccountOwner(identity.userId);

  // The outgoing account's saved data goes too, so the next account on this
  // device can never read it: its local copies (custom messages and favorites
  // among them) and cached images. Unsynced `moods` rows stay for their owner
  // (deleteAccountData).
  if (outgoingUserId && outgoingUserId !== identity.userId) {
    deleteAccountData(outgoingUserId);
  }

  // `messages` is the daily-rotation pool: the shared bundled messages PLUS
  // whichever custom rows the outgoing account owned. Only the second half is
  // account state, so it is stripped rather than the whole array being emptied.
  //
  // Emptying it would be safe but not correct: nothing reloads the daily rows
  // after an in-place switch — `initializeApp` is guarded by a module flag and
  // an App-level ref, both of which survive sign-out — so the next account
  // would land on a Home screen with `currentMessage` null and every rotation
  // call logging "No active messages available". Like `settings`, this needs
  // the CURRENT object and so cannot live in `signedOutState()`.
  //
  // Defensive `?? []`, on the same rule as the `settings` guard above: callers
  // that compose a partial store (component tests building authSlice alone)
  // reach here with the key absent, and sign-out must not throw for them.
  const sharedMessages = (get().messages ?? [])
    .filter((message) => !message.isCustom)
    .map((message) => ({ ...message, isFavorite: false }));

  // `currentMessage` is a COPY of a row, not a reference into the array, so
  // stripping `messages` does not touch it — and DailyMessage renders
  // `currentMessage.text` straight onto Home. A custom one is the outgoing
  // account's own writing and goes with the rest. `reloadRotationPool` is what
  // paints a new one, on the sign-in side of the transition.
  const outgoing = get().currentMessage;
  const currentMessage = outgoing && !outgoing.isCustom ? { ...outgoing, isFavorite: false } : null;

  // `messageHistory.shownMessages` maps a date to the id of the message shown
  // that day. It is persisted, and neither `signedOutState()` nor the strip
  // above touches it — so if the outgoing account's custom row won today's
  // rotation, today's entry now points at an id that is no longer in the pool.
  // Dropping the dangling entries keeps the persisted map honest: the incoming
  // account never inherits a date pointing at a row it cannot see.
  //
  // This is no longer the only thing standing between that and a broken Home
  // screen. `updateCurrentMessage` now treats a cached id that is absent from
  // `messages` as a miss and recomputes (`messagesSlice.ts`), which also covers
  // the case this prune cannot reach: a no-session boot, where the pool below
  // is empty and nothing is stripped. Both are wanted — this one keeps the
  // stored map clean, that one fails safe when it could not be.
  // Keyed on the ids actually STRIPPED, not on the complement of the surviving
  // pool. `messages` is not persisted, so a no-session boot reaches here with
  // an empty array — App.tsx calls clearAuth() the moment getSession() comes
  // back empty, long before initializeApp has seeded anything, and that path is
  // gated on a session so it never seeds at all. Against an empty pool a
  // "keep only ids still in the pool" filter drops EVERY entry in the persisted
  // 30-day map, including the shared daily rows this prune exists to protect.
  const history = get().messageHistory;
  const strippedIds = new Set(
    (get().messages ?? []).filter((message) => message.isCustom).map((message) => message.id)
  );
  const shownMessages =
    history?.shownMessages instanceof Map
      ? new Map(Array.from(history.shownMessages).filter(([, id]) => !strippedIds.has(id)))
      : history?.shownMessages;

  set({
    ...identity,
    ...signedOutState(),
    messages: sharedMessages,
    currentMessage,
    ...(history ? { messageHistory: { ...history, shownMessages, favoriteIds: [] } } : null),
    // Advance with the reset, even for a repeated sign-out. A later sign-in
    // by the same user must never reclaim ownership of an earlier request.
    authSessionVersion: get().authSessionVersion + 1,
    ...(settings
      ? {
          settings: {
            ...settings,
            relationship: { ...settings.relationship, anniversaries: [] },
          },
        }
      : null),
  } as Partial<AppState>);
}

export const createAuthSlice: AppStateCreator<AuthSlice> = (set, get, _api) => ({
  userId: null,
  userEmail: null,
  isAuthenticated: false,
  authSessionVersion: 0,

  setAuthUser: (userId, email) => {
    if (userId === null) {
      get().clearAuth();
      return;
    }

    // An account switch that never passes through a null session -- signing in
    // over a live one -- reaches here without clearAuth ever running, and would
    // otherwise carry the previous account's data into the new one. Route it
    // through signedOutState() rather than listing fields here, so this stays
    // correct as slices grow: that helper is the single place account state is
    // cleared. A repeat call for the SAME user (TOKEN_REFRESHED,
    // INITIAL_SESSION, USER_UPDATED) must not reset anything.
    const previous = get().userId;
    const switchedAccount = previous !== null && previous !== userId;
    const identity = {
      userId,
      userEmail: email ?? null,
      isAuthenticated: !!userId,
      authSessionVersion: get().authSessionVersion + (previous !== userId ? 1 : 0),
    };

    if (switchedAccount) {
      discardAccountState(get, set, identity);
      // After the strip, not before: `loadMessages` has to capture the NEW
      // identity, and it reads the store to do so.
      reloadRotationPool(get);
      return;
    }

    // A fresh sign-in (previous === null, including a plain boot's
    // INITIAL_SESSION) records this user as the device's account owner. If the
    // marker still names someone else, that account's session ended without
    // this device seeing it, and its saved data is deleted now. Repeat calls
    // for the same user (previous === userId) skip this.
    if (previous === null) {
      const leftover = getAccountOwner();
      setAccountOwner(userId);
      if (leftover && leftover !== userId) deleteAccountData(leftover);
    }

    set(identity);

    // Sign out, then sign in as someone else, is TWO calls: clearAuth strips
    // the custom rows, and this one arrives with `previous === null` — so it
    // never reaches the switched-account branch above and needs the reload just
    // as much. Gated on the id actually changing, because TOKEN_REFRESHED,
    // INITIAL_SESSION and USER_UPDATED all land here for the same user and must
    // not re-read IndexedDB on every token refresh.
    if (previous !== userId) reloadRotationPool(get);
  },

  clearAuth: () => {
    discardAccountState(get, set, { userId: null, userEmail: null, isAuthenticated: false });
  },
});
