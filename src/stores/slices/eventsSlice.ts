/**
 * Events Slice
 *
 * Holds the couple's countdown events (own + partner's) and the CRUD actions
 * over them.
 *
 * Cross-slice dependencies:
 * - Reads `userId` from authSlice — for the creator of a new event, and for the
 *   identity guard every action needs around its await.
 * - Loads also capture `authSessionVersion`, so signing back in as the same
 *   account cannot revive a request from its previous session.
 *
 * Persistence:
 * - Supabase holds the truth. The device keeps one per-account local copy,
 *   kind `events` (`services/localCopy.ts`): the list the screens last showed,
 *   saved as plain strings (dates `YYYY-MM-DD`, read back with
 *   `parseEventDate`). Pagination cursors are never saved — they only mean
 *   something against a live server, and an online refresh resets them.
 * - `loadEvents` applies the saved copy first (only into an empty list, and
 *   only until this session has a server answer or a confirmed write), then
 *   replaces state and copy with the server's first page when online. Offline
 *   with a copy (or with this session's server data already shown) it succeeds
 *   without an error; offline with nothing it fails as before.
 * - The copy is filled only from a successful load or a confirmed add, edit or
 *   delete. A failed read keeps state and copy. Offline writes are refused.
 * - NOT persisted to localStorage: `partialize` in `useAppStore.ts` omits every
 *   key here. Sign-out deletes the outgoing account's copies
 *   (`deleteAccountCopies`), so a shared device never shows one couple's events
 *   to the next account. No realtime subscription: the kind's refresher runs on
 *   signed-in start and on reconnect.
 * - All account-scoped keys are reset by `signedOutState()` in authSlice.
 *
 * Errors: `eventsService` throws, so every action here has a real reason to
 * report. `eventsError` belongs only to the active load. Writes return their
 * own failure directly so a save/delete error cannot be mistaken for a load
 * error. `EventWriteResult` deliberately diverges from `PhotoUploadResult`:
 * event failures also carry a code because Settings must distinguish stale
 * rows from failures that can retry the same write.
 */

import { isOnline } from '../../api/errorHandlers';
import type {
  CoupleEvent,
  EventCreateInput,
  EventIcon,
  EventWriteErrorCode,
  EventUpdateInput,
  EventsPagination,
} from '../../services/eventsService';
import { eventsService, isEventIcon, parseEventDate } from '../../services/eventsService';
import { readLocalCopy, registerLocalCopy, writeLocalCopy } from '../../services/localCopy';
import { formatDateISO } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import type { AppStateCreator } from '../types';

/** Local-copy kind for the events list the screens last showed. */
export const EVENTS_COPY_KIND = 'events';

/** One saved event: plain, structured-cloneable strings only. */
interface SavedEvent {
  id: string;
  userId: string;
  label: string;
  /** `YYYY-MM-DD`; read back with `parseEventDate`, never `new Date(string)`. */
  date: string;
  /** ISO instant. */
  createdAt: string;
  createdAtRaw?: string;
  description: string | null;
  icon: EventIcon;
}

function toSavedEvent(event: CoupleEvent): SavedEvent {
  const saved: SavedEvent = {
    id: event.id,
    userId: event.userId,
    label: event.label,
    date: formatDateISO(event.date),
    createdAt: event.createdAt.toISOString(),
    description: event.description,
    icon: event.icon,
  };
  if (event.createdAtRaw !== undefined) saved.createdAtRaw = event.createdAtRaw;
  return saved;
}

function parseSavedEvent(value: unknown): CoupleEvent | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== 'string' ||
    typeof v.userId !== 'string' ||
    typeof v.label !== 'string' ||
    typeof v.date !== 'string' ||
    typeof v.createdAt !== 'string' ||
    (v.createdAtRaw !== undefined && typeof v.createdAtRaw !== 'string') ||
    (v.description !== null && typeof v.description !== 'string') ||
    typeof v.icon !== 'string' ||
    !isEventIcon(v.icon)
  ) {
    return null;
  }
  const date = parseEventDate(v.date);
  const createdAt = new Date(v.createdAt);
  if (!date || Number.isNaN(createdAt.getTime())) return null;
  const parsed: CoupleEvent = {
    id: v.id,
    userId: v.userId,
    label: v.label,
    date,
    createdAt,
    description: v.description,
    icon: v.icon,
  };
  if (typeof v.createdAtRaw === 'string') parsed.createdAtRaw = v.createdAtRaw;
  return parsed;
}

/**
 * A saved copy in a shape the screens can use. The copy is written only by this
 * slice, so one unreadable entry means the whole copy is suspect: ignored.
 */
function parseSavedEvents(value: unknown): CoupleEvent[] | null {
  if (!Array.isArray(value)) return null;
  const events: CoupleEvent[] = [];
  for (const item of value) {
    const parsed = parseSavedEvent(item);
    if (!parsed) return null;
    events.push(parsed);
  }
  return events;
}

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
  eventsPagination: EventsPagination | null;
  eventsIsLoadingMore: boolean;
  eventsHistoryError: string | null;

  // Actions
  loadEvents: () => Promise<EventLoadResult>;
  loadMoreEvents: () => Promise<EventLoadResult>;
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
  return [...events].sort((a, b) => {
    const dateOrder = a.date.getTime() - b.date.getTime();
    const instantOrder = a.createdAt.getTime() - b.createdAt.getTime();
    if (dateOrder || instantOrder) return dateOrder || instantOrder;
    // Postgres timestamps can differ within a JS millisecond. Pad the fraction
    // to compare those remaining digits before the deterministic ID tiebreak.
    const fraction = (event: CoupleEvent) =>
      ((event.createdAtRaw ?? event.createdAt.toISOString()).match(/\.(\d+)/)?.[1] ?? '')
        .padEnd(6, '0');
    const left = fraction(a);
    const right = fraction(b);
    return left < right ? -1 : left > right ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
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
  requestedInSession: number;
  mutationSequenceAtStart: number;
};

type CompletedMutation = { requestedInSession: number } & (
  | { sequence: number; requestedBy: string; kind: 'upsert'; event: CoupleEvent }
  | { sequence: number; requestedBy: string; kind: 'delete'; eventId: string }
);

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
  /**
   * The auth lifetime whose events already came from the server or a confirmed
   * write. The saved copy is applied only before that, so a copy read landing
   * late never replaces a newer answer. Per slice instance, like the counters.
   */
  let eventsFreshFor: { userId: string; authSessionVersion: number } | null = null;
  const isFresh = (userId: string, authSessionVersion: number) =>
    eventsFreshFor?.userId === userId && eventsFreshFor.authSessionVersion === authSessionVersion;

  /**
   * After a server answer or confirmed write for `userId` in
   * `authSessionVersion` has been set into state: mark the session fresh and
   * save the shown list as the copy, under the captured `userId`. Re-checks the
   * identity first; a failed save is logged and changes no result.
   */
  const saveEventsCopy = async (userId: string, authSessionVersion: number) => {
    if (get().userId !== userId || get().authSessionVersion !== authSessionVersion) return;
    eventsFreshFor = { userId, authSessionVersion };
    try {
      await writeLocalCopy(userId, EVENTS_COPY_KIND, get().events.map(toSavedEvent));
    } catch (error) {
      console.error('[EventsSlice] Failed to save the events copy:', error);
    }
  };

  // The kind's refresher for signed-in start, reconnect and on-demand refreshes.
  // Re-registering (a second store in tests) replaces it.
  registerLocalCopy(EVENTS_COPY_KIND, async () => {
    // Home and Settings load on their own at start and on `online`; a second load here would only be superseded.
    const view = get().currentView;
    if (view === 'home' || view === 'settings') return;
    await get().loadEvents();
  });

  const pruneCompletedMutations = () => {
    completedMutations = completedMutations.filter((mutation) =>
      Array.from(activeLoads.values()).some(
        (load) =>
          load.requestedBy === mutation.requestedBy &&
          load.requestedInSession === mutation.requestedInSession &&
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
        mutation.requestedInSession !== load.requestedInSession ||
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

  const loadPage = async (append: boolean): Promise<EventLoadResult> => {
    const {
      userId: requestedBy,
      authSessionVersion: requestedInSession,
      eventsPagination,
      eventsIsLoading,
      eventsIsLoadingMore,
    } = get();
    if (!requestedBy) return { status: 'stale' };
    if (append) {
      // A refresh owns the traversal until it settles; repeated activation
      // cannot issue duplicate requests against the same cursors.
      if (eventsIsLoading || eventsIsLoadingMore || !eventsPagination) return { status: 'stale' };
      if (!eventsPagination.upcoming.hasMore && !eventsPagination.past.hasMore) {
        return { status: 'success' };
      }
    }
    const loadId = ++latestLoadId;
    activeLoads.clear();
    const activeLoad: ActiveLoad = {
      requestedBy,
      requestedInSession,
      mutationSequenceAtStart: latestMutationSequence,
    };
    activeLoads.set(loadId, activeLoad);
    pruneCompletedMutations();
    set(
      append
        ? { eventsIsLoadingMore: true, eventsHistoryError: null }
        : { eventsIsLoading: true, eventsIsLoadingMore: false, eventsError: null, eventsHistoryError: null }
    );
    const ownsLoad = () =>
      get().userId === requestedBy &&
      get().authSessionVersion === requestedInSession &&
      loadId === latestLoadId;

    try {
      // The server request goes out at once, alongside the copy read below, so
      // the copy adds no latency and load sequencing is unchanged. Offline the
      // service rejects before any request.
      const pageRequest = eventsService.getEventsPage(append ? eventsPagination : undefined);
      // Marked handled now: it may reject while the copy read is in flight, and
      // is awaited (or deliberately dropped) below.
      Promise.resolve(pageRequest).catch(() => {});

      if (!append && !isFresh(requestedBy, requestedInSession)) {
        // 1. The saved copy, at once — online or offline. Skipped once this
        // session has a server answer or a confirmed write, and never laid over
        // a list already on screen.
        // readLocalCopy answers null on failure; a malformed copy parses to null.
        const saved = parseSavedEvents(await readLocalCopy<unknown>(requestedBy, EVENTS_COPY_KIND));
        if (!ownsLoad()) return { status: 'stale' };
        if (saved) {
          // A write confirmed during the read is newer than the copy.
          if (!isFresh(requestedBy, requestedInSession) && get().events.length === 0) {
            set({ events: sortByDate(saved) });
          }
          // 2. Offline there is nothing to ask: the saved list stands, without
          // an error. Offline with no copy falls through and fails as before.
          if (!isOnline()) {
            set({ eventsIsLoading: false, eventsIsLoadingMore: false });
            return { status: 'success' };
          }
        }
      } else if (!append && !isOnline()) {
        // This session's server answer is already on screen: it stands.
        set({ eventsIsLoading: false, eventsIsLoadingMore: false });
        return { status: 'success' };
      }

      const page = await pageRequest;
      if (!ownsLoad()) return { status: 'stale' };
      const merged = append
        ? Array.from(new Map([...get().events, ...page.events].map((event) => [event.id, event])).values())
        : page.events;
      const reconciled = replayCompletedMutations(merged, activeLoad);
      set({
        events: reconciled,
        eventsPagination: page.pagination,
        eventsIsLoading: false,
        eventsIsLoadingMore: false,
      });
      await saveEventsCopy(requestedBy, requestedInSession);
      return { status: 'success' };
    } catch (error) {
      const errorMsg = messageOf(error, 'Failed to load events');
      console.error('[EventsSlice] Error loading events:', error);
      if (!ownsLoad()) return { status: 'stale' };
      // Keep the last-good rows AND cursors so retry reads the same page.
      set(
        append
          ? { eventsHistoryError: errorMsg, eventsIsLoadingMore: false }
          : { eventsError: errorMsg, eventsIsLoading: false }
      );
      return { status: 'failure', error: errorMsg };
    } finally {
      unregisterLoad(loadId);
    }
  };

  return {
  // Initial state — reset together by signedOutState().
  events: [],
  eventsIsLoading: false,
  eventsError: null,
  eventsPagination: null,
  eventsIsLoadingMore: false,
  eventsHistoryError: null,

  // A refresh resets the traversal to the nearest windows only after success.
  loadEvents: () => loadPage(false),
  loadMoreEvents: () => loadPage(true),

  /**
   * Create an event owned by the signed-in user, then insert it in date order.
   *
   * No retry: `public.events` carries no idempotency key to make one safe.
   */
  addEvent: async (input: NewEventInput) => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) {
      const errorMsg = 'You must be signed in to add an event';
      return { success: false, code: 'auth', error: errorMsg };
    }

    try {
      const created = await eventsService.createEvent({ ...input, userId: requestedBy });
      // The new event belongs to the previous account; it must not appear in
      // this one's list. success reports the durable write only — this
      // session's state is deliberately untouched.
      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) {
        return { success: true };
      }
      recordMutation({ requestedBy, requestedInSession, kind: 'upsert', event: created });
      set((state) => ({ events: sortByDate(upsertEvent(state.events, created)) }));
      await saveEventsCopy(requestedBy, requestedInSession);
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
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) {
      const errorMsg = 'You must be signed in to edit an event';
      return { success: false, code: 'auth', error: errorMsg };
    }

    try {
      const updated = await eventsService.updateEvent(eventId, updates);
      // success reports the durable write only — the account changed, so this
      // session's state is deliberately untouched.
      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) {
        return { success: true };
      }
      recordMutation({ requestedBy, requestedInSession, kind: 'upsert', event: updated });
      // Re-sorted, not just replaced: an edit may move the date.
      set((state) => ({
        events: sortByDate(upsertEvent(state.events, updated)),
      }));
      await saveEventsCopy(requestedBy, requestedInSession);
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
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) {
      const errorMsg = 'You must be signed in to delete an event';
      return { success: false, code: 'auth', error: errorMsg };
    }

    try {
      await eventsService.deleteEvent(eventId);
      // success reports the durable write only — the account changed, so this
      // session's state is deliberately untouched.
      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) {
        return { success: true };
      }
      recordMutation({ requestedBy, requestedInSession, kind: 'delete', eventId });
      set((state) => ({ events: state.events.filter((event) => event.id !== eventId) }));
      await saveEventsCopy(requestedBy, requestedInSession);
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
