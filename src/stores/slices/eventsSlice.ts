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
 * report. `eventsError` belongs only to the active load. Writes return their
 * own failure directly so a save/delete error cannot be mistaken for a load
 * error. `EventWriteResult` deliberately diverges from `PhotoUploadResult`:
 * event failures also carry a code because Settings must distinguish stale
 * rows from failures that can retry the same write.
 */

import type {
  CoupleEvent,
  EventCreateInput,
  EventWriteErrorCode,
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
export type EventWriteResult =
  | { success: true }
  | { success: false; code: EventWriteErrorCode | 'auth'; error: string };

/** Outcome owned by one `loadEvents` invocation. */
export type EventLoadResult =
  | { status: 'success' }
  | { status: 'failure'; error: string }
  | { status: 'stale' };

/** What `addEvent` takes: the creator comes from the store, not the caller. */
export type NewEventInput = Omit<EventCreateInput, 'userId'>;

export interface EventsSlice {
  // State
  events: CoupleEvent[];
  /** Raised by `loadEvents` only — the writes are awaited by their own caller. */
  eventsIsLoading: boolean;
  eventsError: string | null;

  // Actions
  loadEvents: () => Promise<EventLoadResult>;
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
  // The created_at tiebreak mirrors getEvents' server order, so same-day cards
  // hold one position across an add, an edit, and a reload.
  return [...events].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
  );
}

/** Replace by id or append, removing any duplicate copies already present. */
function upsertEvent(events: CoupleEvent[], upserted: CoupleEvent): CoupleEvent[] {
  return [...events.filter((event) => event.id !== upserted.id), upserted];
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const EVENT_WRITE_ERROR_CODES = {
  offline: true,
  validation: true,
  'not-found': true,
  'invalid-response': true,
  transport: true,
} satisfies Record<EventWriteErrorCode, true>;

function isEventWriteErrorCode(value: unknown): value is EventWriteErrorCode {
  return typeof value === 'string' && Object.hasOwn(EVENT_WRITE_ERROR_CODES, value);
}

function writeFailureOf(
  error: unknown,
  fallback: string
): Extract<EventWriteResult, { success: false }> {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    isEventWriteErrorCode(error.code)
      ? error.code
      : 'transport';

  return {
    success: false,
    code,
    error: messageOf(error, fallback),
  };
}

type ActiveLoad = {
  requestedBy: string;
  mutationSequenceAtStart: number;
};

type CompletedMutation =
  | { sequence: number; requestedBy: string; kind: 'upsert'; event: CoupleEvent }
  | { sequence: number; requestedBy: string; kind: 'delete'; eventId: string };

export const createEventsSlice: AppStateCreator<EventsSlice> = (set, get, _api) => {
  /**
   * The app has one store, but keeping these counters and registries inside the
   * slice instance also prevents independent test stores from sharing replay
   * state. None of this state is persisted or exposed through Zustand.
   */
  let latestLoadId = 0;
  let latestMutationSequence = 0;
  const activeLoads = new Map<number, ActiveLoad>();
  let completedMutations: CompletedMutation[] = [];

  const pruneCompletedMutations = () => {
    completedMutations = completedMutations.filter((mutation) =>
      Array.from(activeLoads.values()).some(
        (load) =>
          load.requestedBy === mutation.requestedBy &&
          mutation.sequence > load.mutationSequenceAtStart
      )
    );
  };

  const unregisterLoad = (loadId: number) => {
    activeLoads.delete(loadId);
    pruneCompletedMutations();
  };

  const recordMutation = (
    mutation:
      | Omit<Extract<CompletedMutation, { kind: 'upsert' }>, 'sequence'>
      | Omit<Extract<CompletedMutation, { kind: 'delete' }>, 'sequence'>
  ) => {
    completedMutations.push({ ...mutation, sequence: ++latestMutationSequence });
    pruneCompletedMutations();
  };

  const replayCompletedMutations = (events: CoupleEvent[], load: ActiveLoad): CoupleEvent[] => {
    let reconciled = events;

    for (const mutation of completedMutations) {
      if (
        mutation.requestedBy !== load.requestedBy ||
        mutation.sequence <= load.mutationSequenceAtStart
      ) {
        continue;
      }

      reconciled =
        mutation.kind === 'upsert'
          ? upsertEvent(reconciled, mutation.event)
          : reconciled.filter((event) => event.id !== mutation.eventId);
    }

    return sortByDate(reconciled);
  };

  return {
  // Initial state
  events: [],
  eventsIsLoading: false,
  eventsError: null,

  // Actions

  /**
   * Load the events visible to this account (own + partner's), date-ordered.
   *
   * Not every event: `getEvents()` is called bare, so it reads its default
   * bounded window — up to 50 rows on each side of today. Past roughly 50 past
   * events the oldest ones stop arriving, which matters to `EventsSettings`,
   * the one screen that lists past events so a mistyped date stays editable.
   * There is no "load more"; see `eventsService.getEvents` for what the cap
   * drops and why the window is anchored at today.
   */
  loadEvents: async () => {
    // Whose data this is, captured before the await. Sign Out sits on the same
    // screen that fires this, and the request goes out with a still-valid token
    // — so it succeeds and its write lands after clearAuth, putting the previous
    // account's events back on screen for whoever signs in next.
    const requestedBy = get().userId;
    // Bail before raising the flag: the null -> signed-in transition is the
    // one auth path that never passes through signedOutState() (authSlice
    // resets only on an account switch or a sign-out), so a load captured at
    // null that resolved after sign-in would leave eventsIsLoading stranded
    // true with nothing due to clear it.
    if (!requestedBy) return { status: 'stale' };
    const loadId = ++latestLoadId;
    // This load supersedes every older invocation; none of them may apply, so
    // they cannot need retained mutation records either.
    activeLoads.clear();
    const activeLoad: ActiveLoad = {
      requestedBy,
      mutationSequenceAtStart: latestMutationSequence,
    };
    activeLoads.set(loadId, activeLoad);
    pruneCompletedMutations();
    set({ eventsIsLoading: true, eventsError: null });

    try {
      const events = await eventsService.getEvents();
      // Touch nothing: the account transition itself went through
      // discardAccountState -> signedOutState(), which already reset every
      // events key, flag included. Writing the flag here instead would clear a
      // successor account's own live spinner mid-load. The early null bail is
      // what makes this sound: with a non-null requestedBy, every mismatch
      // crossed a sign-out or an account switch, and both run that reset.
      if (get().userId !== requestedBy) return { status: 'stale' };
      // A newer same-user load owns the flag and the list now.
      if (loadId !== latestLoadId) return { status: 'stale' };
      const reconciled = replayCompletedMutations(events, activeLoad);
      set({ events: reconciled, eventsIsLoading: false });
      return { status: 'success' };
    } catch (error) {
      const errorMsg = messageOf(error, 'Failed to load events');
      console.error('[EventsSlice] Error loading events:', error);
      // Touch nothing here either — same reasoning as the success branch.
      if (get().userId !== requestedBy) return { status: 'stale' };
      // A newer same-user load owns the flag now; parking this stale failure
      // would slap an error banner over a refresh that may yet succeed.
      if (loadId !== latestLoadId) return { status: 'stale' };
      // The last-good list survives a failed refresh: events are Supabase-only
      // with no mirror to repopulate from, so blanking here would erase data
      // the user is looking at. Matches notesSlice and moodSlice.
      set({ eventsError: errorMsg, eventsIsLoading: false });
      return { status: 'failure', error: errorMsg };
    } finally {
      unregisterLoad(loadId);
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
      return { success: false, code: 'auth', error: errorMsg };
    }

    try {
      const created = await eventsService.createEvent({ ...input, userId: requestedBy });
      recordMutation({ requestedBy, kind: 'upsert', event: created });
      // The new event belongs to the previous account; it must not appear in
      // this one's list. success reports the durable write only — this
      // session's state is deliberately untouched.
      if (get().userId !== requestedBy) return { success: true };
      set((state) => ({ events: sortByDate(upsertEvent(state.events, created)) }));
      logger.debug('[EventsSlice] Added event:', created.id);
      return { success: true };
    } catch (error) {
      const failure = writeFailureOf(error, 'Failed to add event');
      console.error('[EventsSlice] Error adding event:', error);
      return failure;
    }
  },

  /**
   * Edit one of the user's own events. A rejected or zero-row write throws in
   * the service, so `events` is left exactly as it was.
   */
  editEvent: async (eventId: string, updates: EventUpdateInput) => {
    const requestedBy = get().userId;
    if (!requestedBy) {
      const errorMsg = 'You must be signed in to edit an event';
      return { success: false, code: 'auth', error: errorMsg };
    }

    try {
      const updated = await eventsService.updateEvent(eventId, updates);
      recordMutation({ requestedBy, kind: 'upsert', event: updated });
      // success reports the durable write only — the account changed, so this
      // session's state is deliberately untouched.
      if (get().userId !== requestedBy) return { success: true };
      // Re-sorted, not just replaced: an edit may move the date.
      set((state) => ({
        events: sortByDate(upsertEvent(state.events, updated)),
      }));
      logger.debug('[EventsSlice] Edited event:', eventId);
      return { success: true };
    } catch (error) {
      const failure = writeFailureOf(error, 'Failed to update event');
      console.error('[EventsSlice] Error updating event:', error);
      return failure;
    }
  },

  /**
   * Delete one of the user's own events.
   */
  removeEvent: async (eventId: string) => {
    const requestedBy = get().userId;
    if (!requestedBy) {
      const errorMsg = 'You must be signed in to delete an event';
      return { success: false, code: 'auth', error: errorMsg };
    }

    try {
      await eventsService.deleteEvent(eventId);
      recordMutation({ requestedBy, kind: 'delete', eventId });
      // success reports the durable write only — the account changed, so this
      // session's state is deliberately untouched.
      if (get().userId !== requestedBy) return { success: true };
      set((state) => ({ events: state.events.filter((event) => event.id !== eventId) }));
      logger.debug('[EventsSlice] Removed event:', eventId);
      return { success: true };
    } catch (error) {
      const failure = writeFailureOf(error, 'Failed to delete event');
      console.error('[EventsSlice] Error deleting event:', error);
      return failure;
    }
  },

  /**
   * Clear the last error so a dismissed banner does not come back.
   */
  clearEventsError: () => {
    set({ eventsError: null });
  },
  };
};
