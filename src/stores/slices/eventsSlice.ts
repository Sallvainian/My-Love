/**
 * Events Slice
 *
 * Holds the couple's countdown events (own + partner's) and the CRUD actions
 * over them.
 *
 * Cross-slice dependencies:
 * - Reads `userId` from authSlice — for the creator of a new event, and for the
 *   identity guard every action needs around its await.
 *
 * Persistence:
 * - Supabase only. NOT persisted to localStorage and NOT mirrored to IndexedDB:
 *   `partialize` in `useAppStore.ts` deliberately omits every key here, so a
 *   shared device cannot rehydrate one couple's events into the next account's
 *   session. Freshness is reload-based; there is no realtime subscription.
 * - All three keys are reset by `signedOutState()` in authSlice.
 *
 * Errors: `eventsService` throws, so every action here has a real reason to
 * report. The write actions return that reason to their caller AND park it in
 * `eventsError`, mirroring `PhotoUploadResult` — a caller that awaited its own
 * write gets the message for THAT write rather than whatever the shared key
 * happens to hold by the time it reads.
 */

import type {
  CoupleEvent,
  EventCreateInput,
  EventUpdateInput,
} from '../../services/eventsService';
import { eventsService } from '../../services/eventsService';
import { logger } from '../../utils/logger';
import type { AppStateCreator } from '../types';

/**
 * Outcome of a write attempt. The failure message is returned directly rather
 * than read back off the store, so callers get the message for *their* write
 * and not whatever unrelated error `eventsError` happens to hold.
 */
export type EventWriteResult = { success: true } | { success: false; error: string };

/** What `addEvent` takes: the creator comes from the store, not the caller. */
export type NewEventInput = Omit<EventCreateInput, 'userId'>;

export interface EventsSlice {
  // State
  events: CoupleEvent[];
  /** Raised by `loadEvents` only — the writes are awaited by their own caller. */
  eventsIsLoading: boolean;
  eventsError: string | null;

  // Actions
  loadEvents: () => Promise<void>;
  addEvent: (input: NewEventInput) => Promise<EventWriteResult>;
  editEvent: (eventId: string, updates: EventUpdateInput) => Promise<EventWriteResult>;
  removeEvent: (eventId: string) => Promise<EventWriteResult>;
  clearEventsError: () => void;
}

/**
 * Soonest first, matching the `event_date` ascending read.
 *
 * A new copy rather than an in-place `sort()`: no slice may mutate a store array
 * (the same rule `signedOutState()` builds fresh arrays for).
 */
function sortByDate(events: CoupleEvent[]): CoupleEvent[] {
  return [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const createEventsSlice: AppStateCreator<EventsSlice> = (set, get, _api) => ({
  // Initial state
  events: [],
  eventsIsLoading: false,
  eventsError: null,

  // Actions

  /**
   * Load every event visible to this account (own + partner's), date-ordered.
   */
  loadEvents: async () => {
    // Whose data this is, captured before the await. Sign Out sits on the same
    // screen that fires this, and the request goes out with a still-valid token
    // — so it succeeds and its write lands after clearAuth, putting the previous
    // account's events back on screen for whoever signs in next.
    const requestedBy = get().userId;
    set({ eventsIsLoading: true, eventsError: null });

    try {
      const events = await eventsService.getEvents();
      // Touch nothing: the account transition itself went through
      // discardAccountState -> signedOutState(), which already reset every
      // events key, flag included. Writing the flag here instead would clear a
      // successor account's own live spinner mid-load.
      if (get().userId !== requestedBy) return;
      set({ events, eventsIsLoading: false });
    } catch (error) {
      const errorMsg = messageOf(error, 'Failed to load events');
      console.error('[EventsSlice] Error loading events:', error);
      // Touch nothing here either — same reasoning as the success branch.
      if (get().userId !== requestedBy) return;
      // The last-good list survives a failed refresh: events are Supabase-only
      // with no mirror to repopulate from, so blanking here would erase data
      // the user is looking at. Matches notesSlice and moodSlice.
      set({ eventsError: errorMsg, eventsIsLoading: false });
    }
  },

  /**
   * Create an event owned by the signed-in user, then insert it in date order.
   *
   * No retry: `public.events` carries no idempotency key to make one safe.
   */
  addEvent: async (input: NewEventInput) => {
    const requestedBy = get().userId;
    if (!requestedBy) {
      const errorMsg = 'You must be signed in to add an event';
      set({ eventsError: errorMsg });
      return { success: false, error: errorMsg };
    }

    set({ eventsError: null });

    try {
      const created = await eventsService.createEvent({ ...input, userId: requestedBy });
      // The new event belongs to the previous account; it must not appear in
      // this one's list. success reports the durable write only — this
      // session's state is deliberately untouched.
      if (get().userId !== requestedBy) return { success: true };
      set((state) => ({ events: sortByDate([created, ...state.events]) }));
      logger.debug('[EventsSlice] Added event:', created.id);
      return { success: true };
    } catch (error) {
      const errorMsg = messageOf(error, 'Failed to add event');
      console.error('[EventsSlice] Error adding event:', error);
      if (get().userId !== requestedBy) return { success: false, error: errorMsg };
      set({ eventsError: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Edit one of the user's own events. A rejected or zero-row write throws in
   * the service, so `events` is left exactly as it was.
   */
  editEvent: async (eventId: string, updates: EventUpdateInput) => {
    const requestedBy = get().userId;
    set({ eventsError: null });

    try {
      const updated = await eventsService.updateEvent(eventId, updates);
      // success reports the durable write only — the account changed, so this
      // session's state is deliberately untouched.
      if (get().userId !== requestedBy) return { success: true };
      // Re-sorted, not just replaced: an edit may move the date.
      set((state) => ({
        events: sortByDate(state.events.map((event) => (event.id === eventId ? updated : event))),
      }));
      logger.debug('[EventsSlice] Edited event:', eventId);
      return { success: true };
    } catch (error) {
      const errorMsg = messageOf(error, 'Failed to update event');
      console.error('[EventsSlice] Error updating event:', error);
      if (get().userId !== requestedBy) return { success: false, error: errorMsg };
      set({ eventsError: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Delete one of the user's own events.
   */
  removeEvent: async (eventId: string) => {
    const requestedBy = get().userId;
    set({ eventsError: null });

    try {
      await eventsService.deleteEvent(eventId);
      // success reports the durable write only — the account changed, so this
      // session's state is deliberately untouched.
      if (get().userId !== requestedBy) return { success: true };
      set((state) => ({ events: state.events.filter((event) => event.id !== eventId) }));
      logger.debug('[EventsSlice] Removed event:', eventId);
      return { success: true };
    } catch (error) {
      const errorMsg = messageOf(error, 'Failed to delete event');
      console.error('[EventsSlice] Error deleting event:', error);
      if (get().userId !== requestedBy) return { success: false, error: errorMsg };
      set({ eventsError: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Clear the last error so a dismissed banner does not come back.
   */
  clearEventsError: () => {
    set({ eventsError: null });
  },
});
