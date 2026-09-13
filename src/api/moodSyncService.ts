/**
 * Mood Sync Service
 *
 * Handles synchronization of mood entries with Supabase backend.
 * Provides methods for uploading moods, subscribing to partner updates,
 * and batch syncing pending moods.
 *
 * Uses validated moodApi for all database operations to ensure data integrity.
 *
 * @module api/moodSyncService
 */

import { moodService } from '../services/moodService';
import { moodSyncFingerprint, moodSyncPayload } from '../services/moodSyncPayload';
import type { MoodEntry } from '../types';
import { logger } from '../utils/logger';
import { sendEphemeralBroadcast } from './ephemeralBroadcast';
import { handleNetworkError, isOnline } from './errorHandlers';
import { waitForSocketReady } from './realtimeSocket';
import { moodApi } from './moodApi';
import {
  getPartnerId,
  resolvePartnerIdForDelivery,
  resolveSignedInUserForDelivery,
  supabase,
} from './supabaseClient';
import { parseMoodBroadcast } from './validation/broadcastSchemas';
import type { MoodInsert, SupabaseMood } from './validation/supabaseSchemas';

/**
 * Supabase mood record type (using validated schema)
 */
export type SupabaseMoodRecord = SupabaseMood;

/**
 * One live consumer of a mood broadcast channel.
 *
 * A fresh object per subscribe call, so identity is unique even when two
 * consumers happen to pass the same callback reference — the set that tracks
 * them is what decides when the channel may be torn down.
 */
interface MoodSubscriber {
  onMood: (mood: SupabaseMoodRecord) => void;
  onStatus?: (status: string) => void;
}

/**
 * A broadcast channel plus every consumer currently attached to it.
 */
interface MoodChannelEntry {
  channel: ReturnType<typeof supabase.channel>;
  subscribers: Set<MoodSubscriber>;
  /**
   * Last status `subscribe()` reported. Replayed to consumers that attach after
   * the channel is already open — their callback would otherwise never fire.
   */
  lastStatus: string | null;
  /**
   * Whether `partnerId` can be trusted for the NEXT `SUBSCRIBED`.
   *
   * Raised only when `subscribeMoodUpdates` actually resolved a partner moments
   * before the join: refreshing that would null a fresh value and re-fetch it,
   * dropping every broadcast arriving during the round-trip. It stays false
   * when the join-time lookup answered null -- which `resolvePartnerIdForDelivery`
   * does for an exhausted retry as readily as for a genuine unlink -- so the
   * first `SUBSCRIBED` re-takes it rather than leaving the channel muted with
   * nothing to re-arm it. Lowered after every join, since a re-join may span a
   * relationship change.
   */
  snapshotFresh: boolean;
  /**
   * The account this topic belongs to: the signed-in user at the moment the
   * channel was opened. Compared against the live session on every
   * `SUBSCRIBED` so that a channel outliving its account stops dispatching.
   */
  ownerUserId: string;
  /**
   * Who is allowed to broadcast here, snapshotted at join and refreshed on
   * `SUBSCRIBED`.
   *
   * RLS on `realtime.messages` is evaluated at join and cached until the JWT
   * refreshes, so it cannot catch a relationship that ends mid-session — this
   * snapshot is what does. `null` drops every broadcast, which is the wanted
   * behaviour for an unlinked or signed-out account.
   */
  partnerId: string | null;
}

/**
 * Sync result summary
 */
interface SyncResult {
  synced: number;
  failed: number;
  /**
   * Records whose write succeeded but whose dirty flag was deliberately left
   * set because the user edited them mid-flight. Not a failure — the server
   * took the older value and the newer one is still queued locally.
   */
  deferred: number;
  errors: string[];
}

/**
 * Mood Sync Service Class
 *
 * Responsibilities:
 * - Upload individual mood entries to Supabase
 * - Batch sync pending moods from IndexedDB
 * - Subscribe to real-time partner mood updates
 * - Handle network errors and retry logic
 */
class MoodSyncService {
  /**
   * Live broadcast channels, keyed by topic.
   *
   * `supabase.channel(topic)` does not mint a new object per call. RealtimeClient
   * looks the topic up first and returns the channel already open under it, so
   * both consumers of this service — usePartnerMood on the Mood tab and
   * PartnerMoodView on the Partner tab — receive the *same* object, because both
   * build the identical topic from the signed-in user id. A per-call
   * `removeChannel` therefore closes the channel out from under whichever
   * consumer is still mounted, no matter whether the reference to it was held on
   * the instance or in a local.
   *
   * Consumers are tracked per topic instead, and the channel is removed only
   * when the last one detaches.
   */
  private moodChannels = new Map<string, MoodChannelEntry>();

  /**
   * Topics whose channel is mid-leave, keyed to the promise that settles when
   * the server acks it.
   *
   * `removeChannel` does not deregister the channel — it only awaits
   * `channel.unsubscribe()` (RealtimeClient.js:213-219), which flips the state
   * to `leaving` and resolves on the server's ack; the client's registry entry
   * is dropped later, from the `_onClose` hook (RealtimeChannel.js:81-86).
   * Until that lands, `supabase.channel(topic)` still hands back the dying
   * object, and calling `.subscribe()` on it does nothing at all because the
   * whole join is gated on `state == closed` (RealtimeChannel.js:127).
   *
   * So the replacement subscriber would silently receive no broadcasts and no
   * status callback, for the life of the page. Waiting the leave out is what
   * makes reopening a topic work — which is exactly what happens every time the
   * user moves between the Mood tab and the Partner tab.
   */
  private closingMoodChannels = new Map<string, Promise<unknown>>();

  /**
   * Upload a single mood entry to Supabase
   *
   * Uses validated moodApi.create() to ensure data integrity.
   *
   * @param mood - MoodEntry to sync
   * @returns Validated Supabase mood record with server-generated ID and timestamps
   * @throws SupabaseServiceError on failure
   * @throws ApiValidationError if response validation fails
   *
   * @example
   * ```typescript
   * const mood: MoodEntry = {
   *   userId: getCurrentUserId(),
   *   mood: 'happy',
   *   note: 'Great day!',
   *   timestamp: new Date(),
   * };
   *
   * try {
   *   const syncedMood = await moodSyncService.syncMood(mood);
   *   console.log('Mood synced:', syncedMood.id);
   * } catch (error) {
   *   console.error('Sync failed:', error);
   * }
   * ```
   */
  async syncMood(mood: MoodEntry): Promise<SupabaseMoodRecord> {
    // Check network status
    if (!isOnline()) {
      throw handleNetworkError(new Error('Device is offline'), 'MoodSyncService.syncMood');
    }

    // Transform local mood to Supabase insert format via the shared projection,
    // so what is sent here and what markAsSynced compares against cannot drift.
    const moodInsert: MoodInsert = moodSyncPayload(mood, mood.userId);

    // Update in place when this local mood already has a server row, so editing
    // today's mood does not append a second "today" entry for the partner.
    // user_id/created_at are deliberately omitted so the original log time survives.
    let syncedMood: SupabaseMoodRecord;

    if (mood.supabaseId) {
      try {
        syncedMood = await moodApi.update(mood.supabaseId, {
          mood_type: moodInsert.mood_type,
          mood_types: moodInsert.mood_types,
          note: moodInsert.note,
        });
      } catch (error) {
        // PGRST116 = row not found (deleted server-side); fall back to insert
        if ((error as { code?: string }).code === 'PGRST116') {
          syncedMood = await moodApi.create(moodInsert);
        } else {
          throw error;
        }
      }
    } else {
      syncedMood = await moodApi.create(moodInsert);
    }

    // Broadcast to partner after successful sync (fire-and-forget).
    //
    // Plain `getPartnerId`, not the retrying delivery lookup: this is the SEND
    // side, and a failed lookup here costs one live update whose mood is
    // already persisted and arrives on the partner's next fetch. The retry
    // exists for the RECEIVE gate, where a null snapshot drops every later
    // broadcast too.
    const partnerId = await getPartnerId();
    if (partnerId) {
      this.broadcastMoodToPartner(syncedMood, partnerId).catch((err) => {
        console.error('[MoodSyncService] Background broadcast failed:', err);
      });
    }

    return syncedMood;
  }

  /**
   * Broadcast a mood update to partner's channel
   *
   * Uses the Supabase Broadcast API (client-to-client messaging) over a
   * PRIVATE topic, so it is authorized: the INSERT policy
   * `couple_broadcast_partner_can_send` on `realtime.messages` admits a send
   * only to the caller's current partner's topic. The send goes over the REST
   * broadcast endpoint and never joins a channel, so an unlinked or signed-out
   * caller is rejected by that request — `httpSend` answers 403 and rejects
   * with `Unauthorized`. Called after a successful mood sync.
   *
   * @param mood - The synced mood record from Supabase
   * @param partnerId - Partner's user ID to broadcast to
   * @returns void - Fire-and-forget, errors are logged but not thrown
   */
  private async broadcastMoodToPartner(mood: SupabaseMoodRecord, partnerId: string): Promise<void> {
    try {
      if (!isOnline()) {
        logger.debug('[MoodSyncService] Skipping broadcast - device is offline');
        return;
      }

      // Queued per topic rather than opened inline. syncPendingMoods loops over
      // every unsynced mood and fires this without awaiting it (see the call in
      // syncMoodWithRetry), so two moods in one pass used to race for the same
      // `mood-updates:<partnerId>` channel -- and because supabase.channel()
      // hands back the object the first send is still using, the second one's
      // subscribe callback never fired and the partner never got that mood.
      await sendEphemeralBroadcast(`mood-updates:${partnerId}`, 'new_mood', {
        id: mood.id,
        user_id: mood.user_id,
        mood_type: mood.mood_type,
        mood_types: mood.mood_types,
        note: mood.note,
        created_at: mood.created_at,
      });

      logger.debug('[MoodSyncService] Broadcast sent to partner:', mood.id);
    } catch (error) {
      // Fire-and-forget: log error but don't throw
      console.error('[MoodSyncService] Failed to broadcast mood to partner:', error);
    }
  }

  /**
   * Sync pending moods from IndexedDB to Supabase
   *
   * Fetches all unsynced moods from local IndexedDB and uploads them to Supabase
   * with automatic retry logic (exponential backoff: 1s, 2s, 4s, max 3 retries).
   *
   * Features:
   * - Batch sync of all pending moods
   * - Retry logic with exponential backoff (1s, 2s, 4s)
   * - Network status check before attempting sync
   * - Marks successfully synced moods in IndexedDB
   * - Returns detailed sync summary with error information
   *
   * @returns Summary of sync operation (synced count, failed count, errors)
   *
   * @example
   * ```typescript
   * const result = await moodSyncService.syncPendingMoods();
   * console.log(`Synced ${result.synced} moods, ${result.failed} failed`);
   * if (result.errors.length > 0) {
   *   console.error('Sync errors:', result.errors);
   * }
   * ```
   */
  async syncPendingMoods(): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      failed: 0,
      deferred: 0,
      errors: [],
    };

    try {
      // Check network status first
      if (!isOnline()) {
        const error = 'Device is offline - cannot sync moods';
        result.errors.push(error);
        logger.debug('[MoodSyncService] ' + error);
        return result;
      }

      // Scope the read to the signed-in user.
      //
      // The moods store keeps every account that has signed in on this device.
      // Reading it unscoped did not mislabel anything -- each row is uploaded
      // under its own owner (`moodSyncPayload(mood, mood.userId)`) -- but after
      // an account switch it meant repeatedly POSTing the other account's rows
      // under this JWT, where RLS rejects every one and syncMoodWithRetry spends
      // its full 1s/2s/4s backoff before counting it into `failed`. The pending
      // badge reads through the scoped moodSlice path, so the user saw "nothing
      // pending" while sync reported failures forever.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      if (!currentUserId) {
        const error = 'Not authenticated - cannot sync moods';
        result.errors.push(error);
        logger.debug('[MoodSyncService] ' + error);
        return result;
      }

      // Fetch this user's unsynced moods from IndexedDB
      const unsyncedMoods = await moodService.getUnsyncedMoods(currentUserId);

      if (unsyncedMoods.length === 0) {
        logger.debug('[MoodSyncService] No pending moods to sync');
        return result;
      }

      logger.debug(`[MoodSyncService] Starting sync for ${unsyncedMoods.length} pending moods`);

      // Sync each mood with retry logic
      for (const mood of unsyncedMoods) {
        try {
          // Fingerprint BEFORE the write. syncMoodWithRetry can spend ~7s in
          // backoff, and the record we compare against afterwards is whatever
          // the user left behind in that window — not this snapshot.
          const sentFingerprint = moodSyncFingerprint(mood);

          const syncedMood = await this.syncMoodWithRetry(mood);

          // On success: record the outcome against the local record
          if (mood.id) {
            const outcome = await moodService.markAsSynced(
              mood.id,
              syncedMood.id,
              sentFingerprint
            );

            if (outcome === 'deferred') {
              result.deferred++;
              logger.debug(
                `[MoodSyncService] Mood ${mood.id} was edited mid-sync - re-queued for the next pass`
              );
            } else if (outcome === 'missing') {
              logger.debug(`[MoodSyncService] Mood ${mood.id} was deleted during its sync`);
            } else {
              result.synced++;
              logger.debug(
                `[MoodSyncService] Synced mood ${mood.id} → Supabase ID: ${syncedMood.id}`
              );
            }
          }
        } catch (error) {
          // On failure: Log error and continue with next mood
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Mood ${mood.id || 'unknown'}: ${errorMessage}`);

          logger.info(`[MoodSyncService] Failed to sync mood ${mood.id}:`, error);
        }
      }

      logger.debug(
        `[MoodSyncService] Sync complete: ${result.synced} synced, ${result.failed} failed, ${result.deferred} deferred`
      );

      return result;
    } catch (error) {
      // Catch-all for unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Unexpected error during sync: ${errorMessage}`);
      logger.info('[MoodSyncService] Unexpected error in syncPendingMoods:', error);
      return result;
    }
  }

  /**
   * Sync a single mood with exponential backoff retry logic
   *
   * Retry strategy:
   * - Attempt 1: Immediate
   * - Attempt 2: 1 second delay
   * - Attempt 3: 2 seconds delay
   * - Attempt 4: 4 seconds delay
   * - Max: 3 retries (4 total attempts)
   *
   * @param mood - MoodEntry to sync
   * @returns Validated Supabase mood record
   * @throws Error if all retry attempts fail
   * @private
   */
  private async syncMoodWithRetry(mood: MoodEntry): Promise<SupabaseMoodRecord> {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s in milliseconds
    let lastError: Error;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Check network status before each attempt
        if (!isOnline()) {
          throw handleNetworkError(
            new Error('Device is offline'),
            'MoodSyncService.syncMoodWithRetry'
          );
        }

        // Attempt sync
        const syncedMood = await this.syncMood(mood);
        return syncedMood; // Success!
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this was the last retry, throw the error
        if (attempt === MAX_RETRIES) {
          logger.debug(
            `[MoodSyncService] All ${MAX_RETRIES + 1} sync attempts failed for mood ${mood.id}`
          );
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        const delay = RETRY_DELAYS[attempt];
        logger.debug(
          `[MoodSyncService] Sync attempt ${attempt + 1} failed for mood ${mood.id}, retrying in ${delay}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError!;
  }

  /**
   * Re-resolve who this channel is allowed to hear from
   *
   * Called on every `SUBSCRIBED`, which includes a reconnect: a channel can
   * outlive both the relationship it was opened for and the account that
   * opened it.
   *
   * The account check comes first. If the device is now signed in as someone
   * else — or signed out — the topic belongs to a user this session no longer
   * is, so nothing arriving on it can be authorized. A null snapshot is the
   * drop: `parseMoodBroadcast` rejects every payload without a partner id.
   */
  private async refreshChannelIdentity(entry: MoodChannelEntry): Promise<void> {
    // Cleared BEFORE the first await, not after the last. Two round-trips pass
    // between here and the new value, and a broadcast arriving in that window
    // would otherwise be authorized against the snapshot being replaced — the
    // ex-partner, which is exactly who this refresh exists to stop.
    entry.partnerId = null;

    if (!(await this.verifyChannelOwner(entry))) return;

    // Retried on a transient failure; a genuine unlink still resolves null on
    // the first attempt. Without the retry this refresh turned one failed
    // `users` read into a permanently muted channel.
    entry.partnerId = await resolvePartnerIdForDelivery();
  }

  /**
   * Confirm the channel still belongs to the account that opened it, muting it
   * if not. Returns whether the owner still holds it.
   *
   * Split out of `refreshChannelIdentity` so the FIRST `SUBSCRIBED` can run
   * this half alone. The account check is a local session read and is worth
   * making on every join; the partner re-fetch is a `users` round-trip that, on
   * a first join, would only discard the snapshot `subscribeMoodUpdates`
   * resolved moments earlier and drop every mood arriving while it is in
   * flight.
   */
  private async verifyChannelOwner(entry: MoodChannelEntry): Promise<boolean> {
    const session = await resolveSignedInUserForDelivery();

    if (session.status === 'error') {
      // Inconclusive, after the retries inside that lookup. Declining to mute
      // is not the same as declining to act: on the first-join path the
      // snapshot stands untouched, and on the refresh path `entry.partnerId` is
      // already null from the clear above and the caller re-resolves it
      // immediately. Either way the channel is not left muted with nothing to
      // re-arm it, which is what muting here would mean -- a healthy socket
      // emits no further SUBSCRIBED.
      //
      // A failed read is not an account change. A real one is conclusive --
      // signing out clears the session locally, so `getSession` answers
      // `signed-out` rather than erroring -- and is still caught below, as is
      // the next SUBSCRIBED's check. The join also remains authorized by RLS
      // for `ownerUserId` either way, so not muting here widens nothing.
      logger.debug(
        '[MoodSyncService] Session read was inconclusive; not treating it as an account change'
      );
      return true;
    }

    const signedInUserId = session.status === 'signed-in' ? session.userId : null;

    if (signedInUserId !== entry.ownerUserId) {
      logger.debug(
        '[MoodSyncService] Signed-in account changed under a mood channel; dropping its broadcasts'
      );
      // Mute explicitly: on the first-join path nothing has cleared it, and
      // this entry's snapshot belongs to an account that is no longer here.
      entry.partnerId = null;
      return false;
    }

    return true;
  }

  /**
   * Subscribe to real-time partner mood updates via Broadcast API
   *
   * Listens for broadcast events on the current user's mood-updates channel.
   * Partner sends broadcasts to this channel when they log new moods.
   *
   * NOTE: This uses Broadcast API instead of postgres_changes because
   * RLS policies on moods table prevent postgres_changes from working
   * (complex subquery for partner lookup cannot be evaluated by Realtime).
   *
   * @param callback - Function called with new mood record
   * @param onStatusChange - Optional callback for connection status changes
   * @returns Promise that resolves to unsubscribe function to stop listening
   *
   * @example
   * ```typescript
   * const unsubscribe = await moodSyncService.subscribeMoodUpdates(
   *   (mood) => {
   *     console.log('Partner logged mood:', mood.mood_type);
   *   },
   *   (status) => {
   *     console.log('Connection status:', status);
   *   }
   * );
   *
   * // Later, when component unmounts:
   * unsubscribe();
   * ```
   */
  async subscribeMoodUpdates(
    callback: (mood: SupabaseMoodRecord) => void,
    onStatusChange?: (status: string) => void
  ): Promise<() => void> {
    // Get current user ID - we subscribe to OUR OWN channel
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      console.error('[MoodSyncService] Cannot subscribe: User not authenticated');
      return () => {};
    }

    // Each user subscribes to their OWN channel; partner broadcasts TO this
    // channel. The topic is derived from the signed-in user, so every consumer
    // on this device resolves to the same one.
    const topic = `mood-updates:${currentUserId}`;
    logger.debug(`[MoodSyncService] Subscribing to ${topic}`);

    // Both awaits sit here, ahead of the channel bookkeeping, on purpose: the
    // block that creates the entry below must stay free of awaits or two
    // concurrent subscribers can both miss and both open a channel.
    //
    // The partner snapshot is what every incoming broadcast is checked against.
    const partnerIdAtJoin = await resolvePartnerIdForDelivery();
    // Private channels are authorized against the caller's JWT, which Realtime
    // reads from the socket's access token. Without this the join carries the
    // anon key and the SELECT policy denies it.
    await supabase.realtime.setAuth();

    const subscriber: MoodSubscriber = { onMood: callback, onStatus: onStatusChange };

    let entry = this.moodChannels.get(topic);

    if (!entry) {
      // A leave for this topic may still be in flight. Opening the replacement
      // now would just retrieve the dying channel and join nothing.
      const closing = this.closingMoodChannels.get(topic);
      if (closing) {
        logger.debug(`[MoodSyncService] Waiting for the previous ${topic} channel to close`);
        await closing;
        // Another subscriber may have opened the replacement while we waited.
        entry = this.moodChannels.get(topic);
      }

      // Closing that channel may have been what removed the LAST channel in the
      // app, which tears the socket down for ~100ms. Subscribing inside that
      // window silently never joins -- see realtimeSocket.
      if (!entry) {
        await waitForSocketReady();
        entry = this.moodChannels.get(topic);
      }
    }

    if (!entry) {
      const subscribers = new Set<MoodSubscriber>();

      // Built before `subscribe()` so the status callback can close over THIS
      // entry instead of looking the topic up. A terminal CLOSED from a channel
      // that has since been replaced under the same topic would otherwise be
      // written onto its REPLACEMENT, and then replayed by the block below to
      // the next consumer that attaches — pinning a live channel's connection
      // indicator to disconnected. `channel` is filled in immediately after and
      // is never read by the callback.
      const newEntry: MoodChannelEntry = {
        channel: undefined as unknown as MoodChannelEntry['channel'],
        subscribers,
        lastStatus: null,
        snapshotFresh: partnerIdAtJoin !== null,
        ownerUserId: currentUserId,
        partnerId: partnerIdAtJoin,
      };

      const channel = supabase
        .channel(topic, {
          config: {
            broadcast: { self: false }, // Don't receive own broadcasts
            // Authorized by the SELECT policy `couple_broadcast_recipient_can_receive`
            // on `realtime.messages`: receive only on your own topic. Public
            // joins to this topic used to let anyone holding the anon key read
            // and forge a couple's moods.
            private: true,
          },
        })
        .on('broadcast', { event: 'new_mood' }, (payload) => {
          logger.debug('[MoodSyncService] Received partner mood broadcast:', payload);

          // The identity check lives HERE rather than in each consumer.
          // usePartnerMood already filtered on the sender, but PartnerMoodView
          // raised a toast for any broadcast at all — so a malformed or
          // non-partner payload has to be dropped where both of them share it.
          const mood = parseMoodBroadcast(payload?.payload, { partnerId: newEntry.partnerId });
          if (!mood) {
            logger.debug('[MoodSyncService] Dropped an unauthorized or malformed mood broadcast');
            return;
          }

          // Snapshot first: a consumer may unsubscribe from inside its own
          // handler, and that mutates the set being iterated.
          Array.from(subscribers).forEach((s) => s.onMood(mood));
        })
        .subscribe((status) => {
          logger.debug('[MoodSyncService] Broadcast subscription status:', status);

          newEntry.lastStatus = status;

          // Only a RE-join re-takes the snapshot: Realtime re-evaluates RLS
          // here, and the relationship may have changed since the channel was
          // first opened. The FIRST SUBSCRIBED already holds `partnerIdAtJoin`,
          // assigned before this callback could fire, so refreshing it there
          // would discard a fresh value and drop every mood arriving during the
          // replacement round-trip.
          if (status === 'SUBSCRIBED') {
            // Caught, not merely voided: a failed lookup leaves the snapshot
            // null, which drops broadcasts until the next SUBSCRIBED — the safe
            // direction — and must not surface as an unhandled rejection.
            const settled = newEntry.snapshotFresh
              ? // The snapshot was resolved moments ago, so only the account
                // half runs. Skipping that too would let a channel opened
                // microseconds before an account switch keep dispatching the
                // previous couple's moods.
                this.verifyChannelOwner(newEntry).then(() => undefined)
              : this.refreshChannelIdentity(newEntry);

            void settled.catch((error) => {
              logger.debug('[MoodSyncService] Mood channel identity refresh failed:', error);
            });

            newEntry.snapshotFresh = false;
          }

          Array.from(subscribers).forEach((s) => s.onStatus?.(status));
        });

      newEntry.channel = channel;
      entry = newEntry;
      // Nothing is awaited between the LAST read of `entry` above and this
      // insert, so two concurrent subscribers cannot both miss and both open a
      // channel. The earlier awaits are why that re-read exists: whoever
      // resumes first creates the entry synchronously, and the other then finds
      // it rather than opening a second one.
      this.moodChannels.set(topic, entry);
    }

    // The lookup above ran for every caller, so use it for every caller. A
    // consumer attaching to an already-open channel would otherwise pay for a
    // `users` round-trip nobody reads — and, worse, an entry whose snapshot was
    // nulled by a failed refresh or a vanished session would never recover, and
    // would silently drop every partner mood for the life of the page.
    //
    // Only a SUCCESSFUL lookup may overwrite it, though. The retry in
    // `resolvePartnerIdForDelivery` narrows how often a null here is a failure
    // rather than a genuine unlink, but it does not remove the case: a lookup
    // that fails on every attempt still resolves null. So an unguarded write
    // would still let a late subscriber mute a channel that is working for
    // everyone already attached — permanently, because refreshChannelIdentity
    // runs only on SUBSCRIBED and a healthy socket emits no further one.
    // Writing null here never restores delivery; it can only remove it. A
    // genuine unlink is still covered without this write:
    // couple_broadcast_partner_can_send stops an ex-partner from broadcasting
    // at all.
    if (partnerIdAtJoin) {
      entry.partnerId = partnerIdAtJoin;
    }

    entry.subscribers.add(subscriber);

    // A consumer that attaches to an already-open channel missed the
    // `subscribe()` callback, so replay the last status it reported. Without
    // this its connection indicator sits on its initial value for the lifetime
    // of the channel.
    if (onStatusChange && entry.lastStatus !== null) {
      onStatusChange(entry.lastStatus);
    }

    // Return unsubscribe function
    //
    // `detached` makes a second call a no-op rather than dropping a subscriber
    // some later call registered, matching interactionService.subscribeInteractions.
    // usePartnerMood can invoke this twice: once from its own `!isMounted`
    // branch and again from the effect cleanup.
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;

      const live = this.moodChannels.get(topic);
      if (!live) return;

      live.subscribers.delete(subscriber);

      if (live.subscribers.size > 0) {
        logger.debug(
          `[MoodSyncService] Released a mood subscriber; ${live.subscribers.size} still attached`
        );
        return;
      }

      this.moodChannels.delete(topic);

      // Record the leave so the next subscriber for this topic waits it out
      // instead of being handed the channel that is still going away. The
      // catch is what makes that wait safe to await: a leave can resolve
      // 'error' (RealtimeChannel.js:382), and a rejection here must not
      // propagate into an unrelated subscribe call.
      const leaving = supabase.removeChannel(live.channel).catch((err) => {
        logger.debug('[MoodSyncService] Mood channel leave failed:', err);
      });
      this.closingMoodChannels.set(topic, leaving);
      void leaving.finally(() => {
        // Only clear our own entry — a later teardown may already have
        // replaced it.
        if (this.closingMoodChannels.get(topic) === leaving) {
          this.closingMoodChannels.delete(topic);
        }
      });

      logger.debug('[MoodSyncService] Unsubscribed from mood broadcasts');
    };
  }

  /**
   * Fetch recent moods for a user (current user or partner)
   *
   * Uses validated moodApi.fetchByUser() to ensure data integrity.
   *
   * @param userId - User ID to fetch moods for
   * @param limit - Maximum number of moods to fetch (default: 50)
   * @returns Validated array of mood records, sorted by created_at descending
   * @throws ApiValidationError if response validation fails
   *
   * @example
   * ```typescript
   * const moods = await moodSyncService.fetchMoods(partnerId, 10);
   * console.log('Partner last 10 moods:', moods);
   * ```
   */
  async fetchMoods(userId: string, limit: number = 50): Promise<SupabaseMoodRecord[]> {
    // Use validated moodApi.fetchByUser() for query with automatic validation
    return await moodApi.fetchByUser(userId, limit);
  }

  /**
   * Fetch the most recent mood for a specific user (typically partner)
   *
   * Used for displaying partner's current emotional state.
   *
   * @param userId - User ID to fetch mood for (partner ID)
   * @returns Latest mood record or null if user has no moods logged
   * @throws ApiValidationError if response validation fails
   *
   * @example
   * ```typescript
   * const latestMood = await moodSyncService.getLatestPartnerMood(partnerId);
   * if (latestMood) {
   *   console.log('Partner is feeling:', latestMood.mood_type);
   * }
   * ```
   */
  async getLatestPartnerMood(userId: string): Promise<SupabaseMoodRecord | null> {
    try {
      const moods = await this.fetchMoods(userId, 1);
      return moods.length > 0 ? moods[0] : null;
    } catch (error) {
      console.error('[MoodSyncService] Failed to fetch latest partner mood:', error);
      return null; // Graceful degradation for read operations
    }
  }
}

/**
 * Singleton instance of MoodSyncService
 * Use this instance throughout the app for mood synchronization
 */
export const moodSyncService = new MoodSyncService();
