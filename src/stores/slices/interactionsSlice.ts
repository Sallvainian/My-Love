/**
 * Interactions Slice
 *
 * Manages all poke/kiss interaction state and actions including:
 * - Sending poke/kiss to partner
 * - Receiving real-time interaction notifications
 * - Marking interactions as viewed
 * - Interaction history retrieval
 *
 * Recipient derivation (F4/CAP-4):
 * - `sendPoke`/`sendKiss` take no recipient. The service derives it from the
 *   authenticated relationship and the database refuses anything else, so no
 *   caller-supplied UUID reaches the insert.
 * - `interactionPartnerId` is the partner snapshot taken when a subscription
 *   opens and refreshed on SUBSCRIBED. `addIncomingInteraction` rejects any row
 *   that is not addressed to the signed-in user and sent by that partner,
 *   before the feed or the badge move. It is account state, cleared by
 *   `signedOutState()` rather than by a subscription teardown.
 *
 * Cross-slice dependencies:
 * - authSlice.userId: sends, unviewed filtering, history loading,
 *   subscriptions and identity guards
 * - authSlice.authSessionVersion: captured at subscription creation and
 *   checked for incoming records to enforce session ownership; the status
 *   callback checks only user identity and subscription activity. authSlice
 *   advances the version on sign-out or identity change and retains it on
 *   same-user refresh
 *
 * Persistence:
 * - Supabase holds the truth. The device keeps one per-account local copy,
 *   kind `interactions` (`services/localCopy.ts`): the list the screens last
 *   showed, saved as plain data (`createdAt` an ISO string) and read back
 *   through a shape guard; a copy that fails the guard is ignored whole.
 * - `loadInteractionHistory` applies the saved copy first (only into an empty
 *   list, and only until this session has a server answer or a confirmed
 *   change), then replaces state and copy with the server's list. A failed
 *   read changes nothing; an empty answer is saved as `[]`. The badge count is
 *   recomputed from the list whenever the list comes from the copy or server.
 * - It is also the kind's refresher, so the history loads on signed-in start
 *   and on reconnect, not only when the history sheet opens.
 * - Every confirmed change to the list — an accepted Realtime row, a confirmed
 *   send, a server-confirmed mark-as-viewed — rewrites the copy from the whole
 *   current list. Sending still needs a connection; nothing queues.
 * - NOT persisted to localStorage. Sign-out deletes the outgoing account's
 *   copies (`deleteAccountCopies`) and `signedOutState()` resets the state.
 */

import {
  InteractionService,
  type InteractionSubscriptionStatus,
} from '../../api/interactionService';
import type { Interaction, SupabaseInteractionRecord } from '../../types';
import { readLocalCopy, registerLocalCopy, writeLocalCopy } from '../../services/localCopy';
import { validateIncomingInteraction } from '../../utils/interactionValidation';
import { logger } from '../../utils/logger';
import type { AppStateCreator } from '../types';

// Initialize interaction service singleton
const interactionService = new InteractionService();

/** Local-copy kind for the poke/kiss list the screens last showed. */
export const INTERACTIONS_COPY_KIND = 'interactions';

/** How many rows the history load (and so the refresher) asks for. */
const HISTORY_LIMIT = 100;

/** One saved interaction: plain, structured-cloneable data only. */
interface SavedInteraction {
  id: string;
  type: 'poke' | 'kiss';
  fromUserId: string;
  toUserId: string;
  viewed: boolean;
  /** ISO instant. */
  createdAt: string;
}

function toSavedInteraction(interaction: Interaction): SavedInteraction {
  return {
    id: interaction.id,
    type: interaction.type,
    fromUserId: interaction.fromUserId,
    toUserId: interaction.toUserId,
    viewed: interaction.viewed,
    createdAt: interaction.createdAt.toISOString(),
  };
}

function parseSavedInteraction(value: unknown): Interaction | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== 'string' ||
    (v.type !== 'poke' && v.type !== 'kiss') ||
    typeof v.fromUserId !== 'string' ||
    typeof v.toUserId !== 'string' ||
    typeof v.viewed !== 'boolean' ||
    typeof v.createdAt !== 'string'
  ) {
    return null;
  }
  const createdAt = new Date(v.createdAt);
  if (Number.isNaN(createdAt.getTime())) return null;
  return {
    id: v.id,
    type: v.type,
    fromUserId: v.fromUserId,
    toUserId: v.toUserId,
    viewed: v.viewed,
    createdAt,
  };
}

/**
 * A saved copy in a shape the screens can use. The copy is written only by this
 * slice, so one unreadable entry means the whole copy is suspect: ignored.
 */
function parseSavedInteractions(value: unknown): Interaction[] | null {
  if (!Array.isArray(value)) return null;
  const interactions: Interaction[] = [];
  for (const item of value) {
    const parsed = parseSavedInteraction(item);
    if (!parsed) return null;
    interactions.push(parsed);
  }
  return interactions;
}

/** The badge: received and unviewed only — outgoing rows are never notifications. */
function countUnviewed(interactions: Interaction[], userId: string): number {
  return interactions.filter((i) => !i.viewed && i.toUserId === userId).length;
}

export interface InteractionsSlice {
  // State
  interactions: Interaction[];
  unviewedCount: number;
  isSubscribed: boolean;
  /** The signed-in account's partner, resolved when a subscription opens; null when unlinked or not yet resolved */
  interactionPartnerId: string | null;

  // Actions
  sendPoke: () => Promise<SupabaseInteractionRecord>;
  sendKiss: () => Promise<SupabaseInteractionRecord>;
  markInteractionViewed: (id: string) => Promise<void>;
  getUnviewedInteractions: () => Interaction[];
  getInteractionHistory: (days?: number) => Interaction[];
  loadInteractionHistory: (limit?: number) => Promise<void>;
  subscribeToInteractions: (
    onStatusChange: (status: InteractionSubscriptionStatus) => void
  ) => Promise<() => void>;
  addIncomingInteraction: (interaction: SupabaseInteractionRecord) => void;
}

/**
 * Convert Supabase interaction record to local Interaction interface
 */
function toLocalInteraction(record: SupabaseInteractionRecord): Interaction {
  return {
    id: record.id,
    type: record.type as 'poke' | 'kiss',
    fromUserId: record.from_user_id,
    toUserId: record.to_user_id,
    viewed: record.viewed ?? false,
    createdAt: new Date(record.created_at ?? new Date()),
  };
}

export const createInteractionsSlice: AppStateCreator<InteractionsSlice> = (set, get, _api) => {
  /**
   * The auth lifetime whose list already came from the server or a confirmed
   * change. The saved copy is applied only before that, so a copy read landing
   * late never replaces a newer answer. Per slice instance.
   */
  let interactionsFreshFor: { userId: string; authSessionVersion: number } | null = null;
  const isFresh = (userId: string, authSessionVersion: number) =>
    interactionsFreshFor?.userId === userId &&
    interactionsFreshFor.authSessionVersion === authSessionVersion;
  const ownsSession = (userId: string, authSessionVersion: number) =>
    get().userId === userId && get().authSessionVersion === authSessionVersion;

  /**
   * After a server answer or confirmed change for `userId` in
   * `authSessionVersion` has been set into state: mark the session fresh and
   * save the whole shown list as the copy, under the captured `userId`.
   * Re-checks the identity first; a failed save is logged and changes nothing.
   */
  const saveInteractionsCopy = async (userId: string, authSessionVersion: number) => {
    if (!ownsSession(userId, authSessionVersion)) return;
    interactionsFreshFor = { userId, authSessionVersion };
    try {
      await writeLocalCopy(
        userId,
        INTERACTIONS_COPY_KIND,
        get().interactions.map(toSavedInteraction)
      );
    } catch (error) {
      console.error('[InteractionsSlice] Failed to save the interactions copy:', error);
    }
  };

  // The kind's refresher for signed-in start, reconnect and on-demand refreshes.
  // Re-registering (a second store in tests) replaces it.
  registerLocalCopy(INTERACTIONS_COPY_KIND, async () => {
    if (!get().userId) return;
    await get().loadInteractionHistory(HISTORY_LIMIT);
  });

  return {
    // Initial state
    interactions: [],
    unviewedCount: 0,
    isSubscribed: false,
    interactionPartnerId: null,

    // Actions
    sendPoke: async () => {
      const { userId: currentUserId, authSessionVersion: sentInSession } = get();
      if (!currentUserId) {
        throw new Error('Cannot send poke: User not authenticated');
      }

      try {
        // Send poke via InteractionService — the recipient is derived there from
        // the authenticated relationship, never passed in from the UI.
        const pokeRecord = await interactionService.sendPoke(currentUserId);

        // Sign Out sits on the same screen, and the send now waits on two round
        // trips (the partner lookup and the insert). A poke that resolves after
        // the switch belongs to the previous account: report it truthfully to its
        // own caller, but never push it into the next account's feed.
        if (!ownsSession(currentUserId, sentInSession)) return pokeRecord;

        // Add to local state immediately (optimistic UI)
        const localInteraction = toLocalInteraction(pokeRecord);
        set((state) => ({
          interactions: [localInteraction, ...state.interactions],
        }));
        await saveInteractionsCopy(currentUserId, sentInSession);

        logger.debug('[InteractionsSlice] Poke sent:', pokeRecord.id);

        return pokeRecord;
      } catch (error) {
        console.error('[InteractionsSlice] Error sending poke:', error);
        throw error; // Re-throw to allow UI to show error feedback
      }
    },

    sendKiss: async () => {
      const { userId: currentUserId, authSessionVersion: sentInSession } = get();
      if (!currentUserId) {
        throw new Error('Cannot send kiss: User not authenticated');
      }

      try {
        // Send kiss via InteractionService — recipient derived, see sendPoke.
        const kissRecord = await interactionService.sendKiss(currentUserId);

        // See sendPoke: a kiss that resolves after an account switch is still the
        // true outcome for its caller, but not state for the new account.
        if (!ownsSession(currentUserId, sentInSession)) return kissRecord;

        // Add to local state immediately (optimistic UI)
        const localInteraction = toLocalInteraction(kissRecord);
        set((state) => ({
          interactions: [localInteraction, ...state.interactions],
        }));
        await saveInteractionsCopy(currentUserId, sentInSession);

        logger.debug('[InteractionsSlice] Kiss sent:', kissRecord.id);

        return kissRecord;
      } catch (error) {
        console.error('[InteractionsSlice] Error sending kiss:', error);
        throw error; // Re-throw to allow UI to show error feedback
      }
    },

    markInteractionViewed: async (id) => {
      const { userId: currentUserId, authSessionVersion: markedInSession } = get();
      try {
        // Mark as viewed via InteractionService. Server first: `viewed` is never
        // flipped locally without the server's confirmation.
        await interactionService.markAsViewed(id);

        // A confirmation landing after an account switch belongs to the previous
        // account's list, not the one on screen now.
        if (!currentUserId || !ownsSession(currentUserId, markedInSession)) return;

        // Update local state
        set((state) => {
          const interactions = state.interactions.map((interaction) =>
            interaction.id === id ? { ...interaction, viewed: true } : interaction
          );
          return { interactions, unviewedCount: countUnviewed(interactions, currentUserId) };
        });
        await saveInteractionsCopy(currentUserId, markedInSession);

        logger.debug('[InteractionsSlice] Interaction marked as viewed:', id);
      } catch (error) {
        console.error('[InteractionsSlice] Error marking interaction as viewed:', error);
        throw error;
      }
    },

    getUnviewedInteractions: () => {
      const { interactions, userId } = get();
      return interactions.filter(
        (interaction) => !interaction.viewed && interaction.toUserId === userId
      );
    },

    getInteractionHistory: (days = 7) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return get()
        .interactions.filter((interaction) => interaction.createdAt >= cutoffDate)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    loadInteractionHistory: async (limit = HISTORY_LIMIT) => {
      const { userId: currentUserId, authSessionVersion: requestedInSession } = get();
      if (!currentUserId) {
        throw new Error('Cannot load interaction history: User not authenticated');
      }

      try {
        // The server request goes out at once, alongside the copy read below, so
        // the copy adds no latency. It is marked handled now: it may reject while
        // the copy read is in flight, and is awaited below.
        const historyRequest = interactionService.getInteractionHistory(currentUserId, limit);
        Promise.resolve(historyRequest).catch(() => {});

        if (!isFresh(currentUserId, requestedInSession)) {
          // 1. The saved copy, at once — online or offline. Skipped once this
          // session has a server answer or a confirmed change, and never laid
          // over a list already on screen. readLocalCopy answers null on
          // failure; a malformed copy parses to null and is ignored whole.
          const raw = await readLocalCopy<unknown>(currentUserId, INTERACTIONS_COPY_KIND);
          // Identity guard: Sign Out sits on the same screen that fires this.
          if (!ownsSession(currentUserId, requestedInSession)) return;
          const saved = parseSavedInteractions(raw);
          if (raw !== null && raw !== undefined && !saved) {
            console.error('[InteractionsSlice] Ignoring a malformed interactions copy');
          }
          if (
            saved &&
            !isFresh(currentUserId, requestedInSession) &&
            get().interactions.length === 0
          ) {
            set({ interactions: saved, unviewedCount: countUnviewed(saved, currentUserId) });
          }
        }

        // 2. The server's list replaces state and copy. Fetched Interaction[]
        // (already converted by the service).
        const interactions = await historyRequest;

        // Identity guard: the request goes out with a still-valid token, so it
        // can succeed after clearAuth — or after a same-account re-login — and
        // must not put the previous session's data back.
        if (!ownsSession(currentUserId, requestedInSession)) return;

        const unviewedCount = countUnviewed(interactions, currentUserId);
        set({ interactions, unviewedCount });
        await saveInteractionsCopy(currentUserId, requestedInSession);

        logger.debug(
          '[InteractionsSlice] Loaded interaction history:',
          interactions.length,
          'interactions,',
          unviewedCount,
          'unviewed'
        );
      } catch (error) {
        // A failed read changes nothing: state and copy stay as they were.
        console.error('[InteractionsSlice] Error loading interaction history:', error);
      }
    },

    subscribeToInteractions: async (onStatusChange) => {
      try {
        const { userId: currentUserId, authSessionVersion: subscribedInSession } = get();
        if (!currentUserId) {
          throw new Error('Cannot subscribe: User not authenticated');
        }

        // Partner snapshot, taken before the first record can arrive.
        // addIncomingInteraction is synchronous and runs inside a Realtime
        // callback, so it cannot await a lookup per row.
        const lookupAtSubscribe = await interactionService.resolvePartnerLookup();
        if (get().userId !== currentUserId || get().authSessionVersion !== subscribedInSession) {
          throw new Error('Cannot subscribe: account changed during partner lookup');
        }
        // Only a CONCLUSIVE lookup may overwrite the snapshot, for the same reason
        // as the re-resolve below: teardown leaves the snapshot in place, so a
        // remount whose `users` read fails would blank a value the previous mount
        // resolved correctly, and every record after it is refused.
        if (lookupAtSubscribe.status !== 'error') {
          set({
            interactionPartnerId:
              lookupAtSubscribe.status === 'linked' ? lookupAtSubscribe.partnerId : null,
          });
        }

        // Subscribe to incoming interactions
        let active = true;
        const unsubscribe = await interactionService.subscribeInteractions(
          currentUserId,
          (record) => {
            // Queued records can outlive teardown or a new sign-in by the same user.
            if (
              !active ||
              get().userId !== currentUserId ||
              get().authSessionVersion !== subscribedInSession
            ) return;

            // Add incoming interaction to state
            get().addIncomingInteraction(record);
          },
          (status) => {
            if (!active || get().userId !== currentUserId) return;
            set({ isSubscribed: status === 'SUBSCRIBED' });
            if (status === 'SUBSCRIBED') {
              // A reconnect re-fires SUBSCRIBED, which is the one moment the
              // relationship can have changed under a live subscription.
              void interactionService.resolvePartnerLookup().then((lookup) => {
                if (
                  !active ||
                  get().userId !== currentUserId ||
                  get().authSessionVersion !== subscribedInSession
                ) return;
                // An INCONCLUSIVE read leaves the existing snapshot alone. This is
                // the one write that can clobber a working value: `SUBSCRIBED`
                // fires once more on a healthy socket, so a failure-null here
                // silently drops every poke and kiss for the rest of the page
                // view while `isSubscribed` stays true and the UI looks fine.
                //
                // A genuine unlink is conclusive and still nulls it, which is the
                // whole point of re-resolving on a re-join.
                if (lookup.status === 'error') {
                  logger.debug(
                    '[InteractionsSlice] Partner re-resolve was inconclusive; keeping the previous snapshot'
                  );
                  return;
                }
                set({
                  interactionPartnerId: lookup.status === 'linked' ? lookup.partnerId : null,
                });
              });
            }
            onStatusChange(status);
          }
        );

        logger.debug('[InteractionsSlice] Interaction subscription created');

        // Return enhanced unsubscribe function that also updates state
        return () => {
          if (!active) return;
          active = false;
          unsubscribe();
          // The snapshot is NOT cleared here. It belongs to the account, not to
          // one subscription: under StrictMode the first effect's teardown runs
          // after a second subscription has already taken its own snapshot, and
          // clearing here would blank the live one and refuse every real record.
          // signedOutState() clears it when the account changes, and each
          // subscribe overwrites it.
          set({ isSubscribed: false });
          logger.debug('[InteractionsSlice] Unsubscribed from interactions');
        };
      } catch (error) {
        console.error('[InteractionsSlice] Error subscribing to interactions:', error);
        throw error;
      }
    },

    addIncomingInteraction: (record) => {
      // CAP-4: a row that is not addressed to this account and sent by its
      // current partner never reaches the feed or the badge. Checked before the
      // duplicate lookup so a rejected row cannot even consume an id.
      const { userId: currentUserId, interactionPartnerId } = get();
      const validation = validateIncomingInteraction(record, {
        currentUserId,
        partnerId: interactionPartnerId,
      });
      if (!validation.isValid) {
        logger.debug('[InteractionsSlice] Rejecting incoming interaction:', {
          id: record.id,
          reason: validation.error,
        });
        return;
      }

      // Convert to local format
      const localInteraction = toLocalInteraction(record);

      // Only add if it's not already in the list (prevent duplicates)
      const exists = get().interactions.some((i) => i.id === record.id);
      if (exists) {
        logger.debug('[InteractionsSlice] Ignoring duplicate interaction:', record.id);
        return;
      }

      // Add to state
      set((state) => ({
        interactions: [localInteraction, ...state.interactions],
        unviewedCount: !localInteraction.viewed ? state.unviewedCount + 1 : state.unviewedCount,
      }));

      // Rewrite the copy from the whole list. Validation above established that
      // `currentUserId` is signed in; the session is captured now, synchronously.
      if (currentUserId) void saveInteractionsCopy(currentUserId, get().authSessionVersion);

      logger.debug('[InteractionsSlice] Incoming interaction added:', {
        id: record.id,
        type: record.type,
        from: record.from_user_id,
      });
    },
  };
};
