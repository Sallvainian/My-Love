/**
 * EventsSettings Component
 *
 * The couple's countdown events, managed from Settings: the full list (past
 * events included), an add/edit form modal, and a delete confirmation.
 *
 * Three decisions are worth reading before changing anything here.
 *
 * 1. **It loads its own events.** `loadEvents()`'s only other call site is the
 *    Home effect in `App.tsx`, gated on `currentView === 'home'`, and `events`
 *    is not persisted — so a `/settings` deep link or a reload on Settings
 *    would otherwise render a permanently empty list. Overlapping with Home's
 *    effect is safe: `eventsSlice` carries a monotonic `latestLoadId` so a
 *    superseded load abandons its own resolution.
 *
 * 2. **The list is unfiltered.** Home hides events whose date has passed; this
 *    list must not, because Settings is the only place a mistyped year can be
 *    seen and corrected. Filtering here would make a wrong-year event both
 *    invisible and uneditable.
 *
 *    Unfiltered is not unbounded. Initial reads cap each side of today at 50
 *    rows. Explicit history loading appends bounded pages from either side
 *    that still has more, including deep-past rows that need a date correction.
 *
 * 3. **Every async action reports its own outcome.** `eventsError` belongs to
 *    the active load only, while writes return `EventWriteResult` directly.
 *    The list likewise uses the settled `EventLoadResult`, so overlapping or
 *    stale calls cannot attribute another action's state to this invocation.
 *
 * Layout follows `AnniversarySettings` — and deliberately not its data or date
 * handling: it stores an ISO string and renders `new Date(string)`, which is
 * parsed as UTC midnight and shows the previous day west of UTC. Events hold a
 * real local-midnight `Date` built in the service layer, so display is
 * `formatDateLong(event.date)` and the edit form pre-fills with
 * `formatDateISO(event.date)`.
 */

import { AnimatePresence, m as motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  Check,
  Edit2,
  Gem,
  Loader2,
  Plane,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { AppState } from '../../stores/types';
import { useAppStore } from '../../stores/useAppStore';
import { formatDateISO, formatDateLong } from '../../utils/dateUtils';
import {
  ADD_BUTTON,
  DELETE_BUTTON,
  DESTRUCTIVE_BUTTON,
  DIALOG_BACKDROP,
  DIALOG_CLOSE,
  DIALOG_PANEL,
  DIALOG_TITLE,
  DIVIDER,
  EDIT_BUTTON,
  FAILURE_BOX,
  FIELD_ERROR,
  FIELD_LABEL,
  GROUP_ROW,
  GROUP_SUBTITLE,
  GROUP_TILE,
  GROUP_TITLE,
  ITEM_LABEL,
  ITEM_META,
  ITEM_ROW,
  NOTICE,
  PRIMARY_BUTTON,
  REQUIRED_MARK,
  SECONDARY_BUTTON,
  SMALL_SECONDARY,
  fieldClass,
} from '../shared/kitClasses';

/**
 * Event shapes are read off the composed store type rather than imported from
 * the module under `src/services/` that defines them: the UI reaches events
 * only through `useAppStore`, and naming that module here — even as a type-only
 * import — would make the boundary unreadable from a grep.
 */
type CoupleEvent = AppState['events'][number];
type EventIcon = CoupleEvent['icon'];
type NewEventInput = Parameters<AppState['addEvent']>[0];
type EventUpdateInput = Parameters<AppState['editEvent']>[1];
type EventWriteResult = Awaited<ReturnType<AppState['addEvent']>>;
type EventWriteFailure = Extract<EventWriteResult, { success: false }>;
type EventLoadResult = Awaited<ReturnType<AppState['loadEvents']>>;
type EventLoadOwner = { userId: string; authSessionVersion: number };

function ownsCurrentSession(owner: EventLoadOwner): boolean {
  // Async callbacks can run before React cleans up the old session's effects.
  // eslint-disable-next-line no-restricted-properties
  const state = useAppStore.getState();
  return state.userId === owner.userId && state.authSessionVersion === owner.authSessionVersion;
}

/**
 * Mirrors of the CHECK constraints in
 * `20260818000002_create_events_table.sql:19,21,22`. Without them an
 * over-length label reaches the user as raw Postgres constraint text, and a
 * blank label is admitted server-side entirely — `char_length('') = 0` passes
 * the column's `<= 100` check.
 */
const LABEL_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ICON_OPTIONS: ReadonlyArray<{ value: EventIcon; label: string; Icon: typeof Gem }> = [
  { value: 'calendar', label: 'Calendar', Icon: Calendar },
  { value: 'ring', label: 'Ring', Icon: Gem },
  { value: 'plane', label: 'Plane', Icon: Plane },
];

const ICON_VALUES: readonly EventIcon[] = ICON_OPTIONS.map((option) => option.value);

/**
 * Ids for the field-error paragraphs, so each input can point its
 * aria-describedby at its own message. Constants rather than inline strings
 * because the id and the reference have to stay in step; only one form is ever
 * mounted at a time, so fixed ids cannot collide.
 */
const LABEL_ERROR_ID = 'events-form-label-error';
const DATE_ERROR_ID = 'events-form-date-error';
const DESCRIPTION_ERROR_ID = 'events-form-description-error';
const ICON_ERROR_ID = 'events-form-icon-error';

/** What the list area shows right now. */
type ListSlot = 'loading' | 'list' | 'empty' | 'error';

export function EventsSettings() {
  const {
    events,
    eventsIsLoading,
    eventsIsLoadingMore,
    eventsPagination,
    eventsHistoryError,
    syncStatus,
    userId,
    authSessionVersion,
    loadEvents,
    loadMoreEvents,
    addEvent,
    editEvent,
    removeEvent,
    clearEventsError,
  } = useAppStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // The row itself, not its id: `removeEvent` drops it from `events` before the
  // dialog's own onClose runs, and a lookup would unmount the dialog underneath
  // the code that still has to record the delete succeeded.
  const [deletingEvent, setDeletingEvent] = useState<CoupleEvent | null>(null);
  // True only when the form was opened from the empty state, whose Add button
  // does not survive the add it triggers. Every other opener does survive, and
  // useFocusTrap already restores those — handing the form a fallback
  // unconditionally would steal focus back from a row's Edit button.
  const [formNeedsFallback, setFormNeedsFallback] = useState(false);
  const [loadSettlement, setLoadSettlement] = useState<
    (EventLoadOwner & { failed: boolean }) | null
  >(null);
  const [retryingForSession, setRetryingForSession] = useState<number | null>(null);
  const isRetrying = retryingForSession === authSessionVersion;
  const [retryFocusRequest, setRetryFocusRequest] = useState(0);
  const [loadingHistoryForSession, setLoadingHistoryForSession] = useState<number | null>(null);
  const isLoadingHistory = loadingHistoryForSession === authSessionVersion;
  const [historyFocusRequest, setHistoryFocusRequest] = useState(0);

  // The header Add button: the one control that outlives a delete, an
  // add-from-empty, and a stale-row refresh, so it is where focus goes when the
  // opener does not survive.
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyInFlightRef = useRef<EventLoadOwner | null>(null);
  const historyFocusOwnerRef = useRef<EventLoadOwner | null>(null);
  const retryInFlightRef = useRef<EventLoadOwner | null>(null);
  const retryFocusTargetRef = useRef<{
    target: 'retry' | 'add';
    owner: EventLoadOwner;
  } | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    // Re-arm on setup so StrictMode's cleanup/setup replay leaves the live
    // component able to settle loads. Shared store requests continue on unmount.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const recordLoadOutcome = useCallback((owner: EventLoadOwner, result: EventLoadResult) => {
    if (!isMountedRef.current || result.status === 'stale' || !ownsCurrentSession(owner)) return;
    setLoadSettlement({ ...owner, failed: result.status === 'failure' });
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    void loadEvents().then((result) => {
      if (cancelled) return;
      recordLoadOutcome({ userId, authSessionVersion }, result);
    });

    return () => {
      cancelled = true;
    };
    // Re-running on either connectivity transition matches Home: the offline
    // direction fails back into the same settled notice, while reconnecting
    // gives a mounted Settings screen a recovery path without navigation.
  }, [userId, authSessionVersion, syncStatus.isOnline, loadEvents, recordLoadOutcome]);

  const editingEvent = editingId ? events.find((event) => event.id === editingId) : undefined;

  const handleAdd = () => {
    setFormNeedsFallback(false);
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleAddFromEmptyState = () => {
    setFormNeedsFallback(true);
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleEdit = (event: CoupleEvent) => {
    setFormNeedsFallback(false);
    setEditingId(event.id);
    setIsFormOpen(true);
  };

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormNeedsFallback(false);
  }, []);

  const handleDeleteClose = useCallback(() => {
    setDeletingEvent(null);
  }, []);

  const refreshEvents = useCallback(async () => {
    if (!userId) return null;
    const owner = { userId, authSessionVersion };
    if (!ownsCurrentSession(owner)) return null;
    const result = await loadEvents();
    recordLoadOutcome(owner, result);
    return result;
  }, [loadEvents, recordLoadOutcome, userId, authSessionVersion]);

  const handleRetry = useCallback(async () => {
    // The slice raises this flag synchronously before its request. Guarding the
    // handler with a local in-flight ref as well as disabling the control closes
    // both pointer and keyboard duplicate-activation paths.
    if (
      eventsIsLoading ||
      retryInFlightRef.current?.authSessionVersion === authSessionVersion ||
      !userId
    ) {
      return;
    }

    const owner = { userId, authSessionVersion };
    if (!ownsCurrentSession(owner)) return;
    retryInFlightRef.current = owner;
    setRetryingForSession(authSessionVersion);
    clearEventsError();

    const result = await refreshEvents().finally(() => {
      // A prior-session retry neither holds nor releases the current lock.
      if (
        !isMountedRef.current ||
        retryInFlightRef.current !== owner ||
        !ownsCurrentSession(owner)
      ) {
        return;
      }
      retryInFlightRef.current = null;
      setRetryingForSession(null);
    });

    if (
      !isMountedRef.current ||
      !result ||
      result.status === 'stale' ||
      !ownsCurrentSession(owner)
    ) {
      return;
    }

    // An empty failed load removes Retry while its loading slot is mounted.
    // Restore focus only after the settled render: back to Retry on failure,
    // or to the always-mounted Add control once recovery succeeds.
    retryFocusTargetRef.current = {
      target: result.status === 'failure' ? 'retry' : 'add',
      owner,
    };
    setRetryFocusRequest((request) => request + 1);
  }, [clearEventsError, eventsIsLoading, refreshEvents, userId, authSessionVersion]);

  useEffect(() => {
    if (retryFocusRequest === 0 || isRetrying) return;

    const focusRequest = retryFocusTargetRef.current;
    retryFocusTargetRef.current = null;
    if (!focusRequest || !ownsCurrentSession(focusRequest.owner)) return;

    const target =
      focusRequest.target === 'retry'
        ? (retryButtonRef.current ?? addButtonRef.current)
        : addButtonRef.current;
    if (target?.isConnected) target.focus();
  }, [isRetrying, retryFocusRequest]);

  const hasMoreHistory = Boolean(
    eventsPagination?.upcoming.hasMore || eventsPagination?.past.hasMore
  );

  useEffect(() => {
    if (!eventsIsLoading || !historyInFlightRef.current) return;
    // A full refresh supersedes paging in the store. Release our matching
    // local lock now, even if the abandoned page request never settles.
    historyInFlightRef.current = null;
    historyFocusOwnerRef.current = null;
    setLoadingHistoryForSession(null);
  }, [eventsIsLoading]);

  const handleLoadMore = useCallback(async () => {
    if (
      !userId ||
      !hasMoreHistory ||
      eventsIsLoading ||
      eventsIsLoadingMore ||
      historyInFlightRef.current?.authSessionVersion === authSessionVersion
    ) {
      return;
    }

    const owner = { userId, authSessionVersion };
    if (!ownsCurrentSession(owner)) return;
    const ownedFocus = document.activeElement === historyButtonRef.current;
    historyInFlightRef.current = owner;
    setLoadingHistoryForSession(authSessionVersion);

    const result = await loadMoreEvents();
    if (
      !isMountedRef.current ||
      historyInFlightRef.current !== owner ||
      !ownsCurrentSession(owner)
    ) {
      return;
    }

    // Keep the control mounted until this point, even if the final page has
    // exhausted both windows. Chromium blurs a disabled button to body, so
    // retain its pre-request focus ownership. Any other focused control,
    // including a form opened during the request, keeps its own focus.
    const restoreFocus = ownedFocus && (
      document.activeElement === historyButtonRef.current || document.activeElement === document.body
    );
    historyInFlightRef.current = null;
    setLoadingHistoryForSession(null);
    if (result.status === 'stale' || !restoreFocus) return;
    historyFocusOwnerRef.current = owner;
    setHistoryFocusRequest((request) => request + 1);
  }, [userId, hasMoreHistory, eventsIsLoading, eventsIsLoadingMore, authSessionVersion, loadMoreEvents]);

  useEffect(() => {
    if (historyFocusRequest === 0 || isLoadingHistory) return;
    const owner = historyFocusOwnerRef.current;
    historyFocusOwnerRef.current = null;
    if (!owner || !ownsCurrentSession(owner)) return;
    const target = historyButtonRef.current ?? addButtonRef.current;
    if (target?.isConnected) target.focus();
  }, [historyFocusRequest, isLoadingHistory]);

  const handleFormRefresh = useCallback(() => {
    handleFormClose();
    void refreshEvents();
  }, [handleFormClose, refreshEvents]);

  const handleDeleteRefresh = useCallback(() => {
    handleDeleteClose();
    void refreshEvents();
  }, [handleDeleteClose, refreshEvents]);

  const handleSave = useCallback(
    (input: NewEventInput): Promise<EventWriteResult> => {
      if (editingId) {
        const updates: EventUpdateInput = {
          label: input.label,
          eventDate: input.eventDate,
          description: input.description ?? null,
          icon: input.icon,
        };
        return editEvent(editingId, updates);
      }
      return addEvent(input);
    },
    [addEvent, editEvent, editingId]
  );

  const handleConfirmDelete = useCallback(
    (eventId: string): Promise<EventWriteResult> => removeEvent(eventId),
    [removeEvent]
  );

  const firstLoadSettled =
    loadSettlement !== null &&
    loadSettlement.userId === userId &&
    loadSettlement.authSessionVersion === authSessionVersion;
  const loadFailed = firstLoadSettled && loadSettlement.failed;

  // A failed refresh never blanks a list already on screen, so a non-empty
  // `events` outranks every other state — including the error banner, which
  // still renders above it.
  const slot: ListSlot =
    events.length > 0
      ? 'list'
      : !firstLoadSettled || eventsIsLoading
        ? 'loading'
        : loadFailed
          ? 'error'
          : 'empty';

  // A stale list is still worth showing, but it must say so — otherwise a
  // failed refresh is indistinguishable from "nothing changed".
  const showLoadErrorBanner = firstLoadSettled && loadFailed && slot === 'list';
  const retryIsActive = eventsIsLoading || isRetrying;
  const historyIsActive = eventsIsLoading || eventsIsLoadingMore || isLoadingHistory;

  // One notice, one testid, mounted in whichever of the two positions applies.
  const loadErrorNotice = (
    <div
      className={NOTICE}
      data-testid="events-settings-load-error"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink">
          We couldn&apos;t load your events. Check your connection and try again.
        </p>
        <button
          ref={retryButtonRef}
          type="button"
          onClick={() => void handleRetry()}
          disabled={retryIsActive}
          data-testid="events-settings-retry"
          className={SMALL_SECONDARY}
        >
          {retryIsActive && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {retryIsActive ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5" data-testid="events-settings">
      {/* Group header. The h3 sits under Settings' "Countdowns" h2, so the
          outline reads h1 Settings → h2 Countdowns → h3 Events → h4 rows. */}
      <div className={GROUP_ROW}>
        <span className={GROUP_TILE} aria-hidden="true">
          <Calendar className="h-[17px] w-[17px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className={GROUP_TITLE}>Events</h3>
          {/* Constant rather than the partner's name: the store's `partner`
              is loaded only by the Partner view and not persisted, so a name
              here would depend on which screen was opened first. */}
          <p className={GROUP_SUBTITLE} data-testid="events-subtitle">
            Shared with your partner
          </p>
        </div>

        {/* Icon-only, so the aria-label is the button's whole accessible
            name. Always mounted: it is the focus fallback for every opener
            that does not survive its own action. */}
        <button
          ref={addButtonRef}
          type="button"
          onClick={handleAdd}
          data-testid="events-settings-add"
          aria-label="Add event"
          className={ADD_BUTTON}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Above a list that survived a failed refresh; the `error` slot below
          renders the same notice as the list area's own content when there is
          no list to sit above. Exactly one of the two is ever mounted. */}
      {showLoadErrorBanner && loadErrorNotice}

      {/* Event list */}
      <div
        className="flex flex-col gap-1.5"
        data-testid="events-settings-load-region"
        aria-busy={eventsIsLoading || eventsIsLoadingMore || isLoadingHistory}
      >
        {slot === 'error' && loadErrorNotice}

        {slot === 'loading' && (
          <>
            <div className={DIVIDER} aria-hidden="true" />
            <div
              className="flex min-h-12 items-center justify-center gap-2 text-[13px] text-muted"
              data-testid="events-settings-loading"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading events…</span>
            </div>
          </>
        )}

        {slot === 'empty' && (
          <div className="flex flex-col gap-1.5" data-testid="events-settings-empty">
            <div className={DIVIDER} aria-hidden="true" />
            {/* Wraps so the pill drops under the copy when a phone width
                cannot hold both on one line. */}
            <div className={`${ITEM_ROW} flex-wrap`}>
              <p className="min-w-48 flex-1 text-[13px] text-muted">
                {hasMoreHistory
                  ? 'No events to display in this part of your history.'
                  : 'No events yet. Add one you are both counting down to.'}
              </p>
              <button
                type="button"
                onClick={handleAddFromEmptyState}
                data-testid="events-settings-empty-add"
                className={SMALL_SECONDARY}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {hasMoreHistory ? 'Add an event' : 'Add your first event'}
              </button>
            </div>
          </div>
        )}

        {slot === 'list' && (
          <div className="flex flex-col gap-1.5" data-testid="events-settings-list">
            <AnimatePresence>
              {events.map((event) => {
                const isOwn = event.userId === userId;

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    data-testid={`event-row-${event.id}`}
                    className="flex flex-col gap-1.5"
                  >
                    <div className={DIVIDER} aria-hidden="true" />
                    <div className={ITEM_ROW}>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <h4 className={ITEM_LABEL} data-testid={`event-label-${event.id}`}>
                          {event.label}
                        </h4>
                        <p className={ITEM_META} data-testid={`event-date-${event.id}`}>
                          {formatDateLong(event.date)}
                        </p>
                        {event.description && (
                          <p
                            className={ITEM_META}
                            data-testid={`event-description-${event.id}`}
                          >
                            {event.description}
                          </p>
                        )}
                        {!isOwn && (
                          <p
                            className="text-[13px] text-partner"
                            data-testid={`event-partner-note-${event.id}`}
                          >
                            Added by your partner
                          </p>
                        )}
                      </div>

                      {/* Own rows only. RLS filters a non-creator's UPDATE and
                          DELETE to zero rows, which the service turns into
                          "not yours to edit" — a control that can only ever
                          produce that message is worse than no control. */}
                      {isOwn && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(event)}
                            data-testid={`event-edit-${event.id}`}
                            className={EDIT_BUTTON}
                            aria-label={`Edit ${event.label}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingEvent(event)}
                            data-testid={`event-delete-${event.id}`}
                            className={DELETE_BUTTON}
                            aria-label={`Delete ${event.label}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {(hasMoreHistory || isLoadingHistory) && (
          <div className={`${NOTICE} flex flex-col items-start gap-3`}>
            {hasMoreHistory && (
              <p
                id="events-settings-history-notice"
                data-testid="events-settings-history-notice"
                className="text-sm text-ink"
              >
                More events are available. Load more history to find older dates or later upcoming
                events. After a refresh or reload, saved events outside this list may need to be
                loaded again.
              </p>
            )}
            {eventsHistoryError && (
              <p
                id="events-settings-history-error"
                data-testid="events-settings-history-error"
                role="status"
                aria-live="polite"
                className="text-sm text-ink"
              >
                We couldn&apos;t load more history. Your loaded events are still here. Check your
                connection and try again.
              </p>
            )}
            <button
              ref={historyButtonRef}
              type="button"
              onClick={() => void handleLoadMore()}
              disabled={historyIsActive}
              data-testid="events-settings-load-more"
              aria-describedby={[
                hasMoreHistory ? 'events-settings-history-notice' : '',
                eventsHistoryError ? 'events-settings-history-error' : '',
              ].filter(Boolean).join(' ') || undefined}
              className={SMALL_SECONDARY}
            >
              {historyIsActive && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {historyIsActive
                ? 'Loading history…'
                : eventsHistoryError
                  ? 'Retry loading history'
                  : 'Load more history'}
            </button>
          </div>
        )}
      </div>

      <p
        className="sr-only"
        data-testid="events-settings-history-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {eventsIsLoading
          ? ''
          : eventsIsLoadingMore || isLoadingHistory
            ? 'Loading history…'
            : eventsPagination && !eventsHistoryError && !loadFailed
              ? `${events.length} ${events.length === 1 ? 'event' : 'events'} loaded. ${hasMoreHistory ? 'More history is available.' : 'No more history to load.'}`
              : ''}
      </p>

      {/* Add / Edit form modal */}
      <AnimatePresence>
        {isFormOpen && (
          <EventForm
            key={editingId ?? 'new'}
            event={editingEvent}
            fallbackFocusRef={formNeedsFallback ? addButtonRef : undefined}
            refreshFocusRef={addButtonRef}
            onClose={handleFormClose}
            onRefresh={handleFormRefresh}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deletingEvent && (
          <EventDeleteConfirmation
            key={deletingEvent.id}
            event={deletingEvent}
            fallbackFocusRef={addButtonRef}
            onClose={handleDeleteClose}
            onConfirmDelete={handleConfirmDelete}
            onRefresh={handleDeleteRefresh}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface EventFormProps {
  /** Absent for an add. */
  event?: CoupleEvent;
  onClose: () => void;
  onRefresh: () => void;
  onSave: (input: NewEventInput) => Promise<EventWriteResult>;
  /** Only supplied when the opener will not survive a successful save. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  /** Always survives a refresh that may remove the stale row and its opener. */
  refreshFocusRef: RefObject<HTMLElement | null>;
}

function EventForm({
  event,
  onClose,
  onRefresh,
  onSave,
  fallbackFocusRef,
  refreshFocusRef,
}: EventFormProps) {
  // The fields and save target survive a refresh that drops this paged row.
  // Keep the form's mode with those initial values until its key changes too.
  const [isEditing] = useState(Boolean(event));
  const [label, setLabel] = useState(event?.label ?? '');
  // formatDateISO, never toISOString().split('T')[0]: the latter is UTC-based
  // and pre-fills the previous day for anyone west of UTC.
  const [date, setDate] = useState(event ? formatDateISO(event.date) : '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [icon, setIcon] = useState<EventIcon>(event?.icon ?? 'calendar');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveFailure, setSaveFailure] = useState<EventWriteFailure | null>(null);
  const isSaveUncertain = saveFailure?.code === 'invalid-response';
  const [isSaving, setIsSaving] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const isSaveUncertainRef = useRef(false);
  const isSavingRef = useRef(false);
  const saveSucceededRef = useRef(false);
  const refreshRequestedRef = useRef(false);

  const titleId = 'events-form-title';

  // useFocusTrap lists onEscape in its deps and re-focuses initialFocusRef on
  // every run, so an unstable handler drags focus back to the label field on
  // every render of the app around this form. Latest-ref plus an empty-dep
  // useCallback keeps the identity fixed — the shape NoteRemoveConfirmation
  // established.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleEscape = useCallback(() => {
    // Suppressed mid-write so a stray key cannot orphan a save.
    if (isSavingRef.current) return;
    onCloseRef.current();
  }, []);

  useFocusTrap(panelRef, true, {
    onEscape: handleEscape,
    initialFocusRef: labelInputRef,
  });

  // Declared AFTER the trap call so its cleanup runs second: the hook's own
  // restore may still fire at an opener React has not finished removing, and
  // this is what overwrites that with a target known to survive.
  useEffect(() => {
    return () => {
      if (refreshRequestedRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const refreshFallback = refreshFocusRef.current;
        if (refreshFallback?.isConnected) {
          refreshFallback.focus();
        }
        return;
      }

      if (!saveSucceededRef.current) return;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const fallback = fallbackFocusRef?.current;
      if (fallback?.isConnected) {
        fallback.focus();
      }
    };
  }, [fallbackFocusRef, refreshFocusRef]);

  // Hand focus to the enabled primary action after a failure: Save for a
  // retryable write, Refresh events for a stale row or an uncertain save. Doing
  // it inside the await would focus a still-disabled button, which the DOM ignores.
  useEffect(() => {
    if (saveFailure && !isSaving) {
      submitButtonRef.current?.focus();
    }
  }, [saveFailure, isSaving]);

  /**
   * Drop one field's error the moment the user edits it.
   *
   * setErrors otherwise runs only on submit, so a corrected 101-character label
   * kept its red border, its aria-invalid and its message until the user
   * resubmitted — telling a screen-reader user the field is still invalid while
   * they are fixing it.
   */
  const clearFieldError = useCallback((field: string) => {
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A write with an unreadable response may have committed. Keep this form
    // refresh-only even after field edits or a submission that bypasses its button.
    // The ref latches before React renders the failure and replaces the action.
    if (isSaveUncertainRef.current) return;

    const trimmedLabel = label.trim();
    const trimmedDescription = description.trim();
    const nextErrors: Record<string, string> = {};

    // PostgreSQL char_length counts code points: spread keeps supplementary
    // emoji whole while counting combining marks separately.
    if (!trimmedLabel) {
      nextErrors.label = 'Label is required';
    } else if ([...trimmedLabel].length > LABEL_MAX_LENGTH) {
      nextErrors.label = `Label must be ${LABEL_MAX_LENGTH} characters or fewer`;
    }

    if (!date) {
      nextErrors.date = 'Date is required';
    } else if (!ISO_DATE_PATTERN.test(date)) {
      nextErrors.date = 'Date must be in YYYY-MM-DD format';
    }

    if ([...trimmedDescription].length > DESCRIPTION_MAX_LENGTH) {
      nextErrors.description = `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer`;
    }

    if (!ICON_VALUES.includes(icon)) {
      nextErrors.icon = 'Choose an icon';
    }

    setErrors(nextErrors);
    setSaveFailure(null);

    // Nothing is requested until the client-side mirror of the CHECK
    // constraints passes.
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    isSavingRef.current = true;
    // `public.events` has no unique constraint and no idempotency key, so the
    // disabled Save button is the only double-submit guard available. A browser
    // moves focus to <body> when the focused element becomes disabled, so move
    // it onto the panel first, while the move can still land.
    panelRef.current?.focus();

    try {
      const result = await onSave({
        label: trimmedLabel,
        // The <input type="date"> value, verbatim.
        eventDate: date,
        description: trimmedDescription || null,
        icon,
      });

      if (!result.success) {
        if (result.code === 'invalid-response') {
          isSaveUncertainRef.current = true;
        }
        // The message for THIS write, off its own returned result — not off the
        // load-only `eventsError` key, which a background load owns.
        setSaveFailure(result);
        setIsSaving(false);
        isSavingRef.current = false;
        return;
      }

      saveSucceededRef.current = true;
      onClose();
    } catch (err) {
      // The slice catches everything and returns EventWriteResult, so this is
      // belt-and-braces: without it an unexpected throw would leave Save
      // disabled forever with no explanation on screen.
      console.error('[EventsSettings] Unexpected save failure:', err);
      setSaveFailure({
        success: false,
        code: 'transport',
        error: err instanceof Error && err.message ? err.message : 'Failed to save the event.',
      });
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  };

  const handleRefresh = () => {
    if (refreshRequestedRef.current) return;
    // Set before closing: the cleanup runs as the dialog unmounts and must beat
    // the focus trap's attempt to restore the stale row's opener.
    refreshRequestedRef.current = true;
    onRefresh();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={DIALOG_BACKDROP}
      onClick={handleBackdropClick}
      data-testid="events-form"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`${DIALOG_PANEL} max-w-md`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 id={titleId} className={DIALOG_TITLE}>
            {isEditing ? 'Edit Event' : 'Add Event'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            data-testid="events-form-close"
            className={DIALOG_CLOSE}
            aria-label="Close form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Label */}
          <div>
            <label
              htmlFor="events-form-label"
              className={FIELD_LABEL}
            >
              Label <span className={REQUIRED_MARK}>*</span>
            </label>
            <input
              ref={labelInputRef}
              id="events-form-label"
              data-testid="events-form-label"
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                clearFieldError('label');
              }}
              aria-invalid={Boolean(errors.label)}
              // Paired with the id below: aria-invalid alone tells a screen
              // reader the field is wrong without ever saying why.
              aria-describedby={errors.label ? LABEL_ERROR_ID : undefined}
              className={fieldClass(Boolean(errors.label))}
              placeholder="e.g., Gracie visits"
            />
            {errors.label && (
              <p
                id={LABEL_ERROR_ID}
                className={FIELD_ERROR}
                data-testid="events-form-label-error"
                role="alert"
              >
                {errors.label}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label
              htmlFor="events-form-date"
              className={FIELD_LABEL}
            >
              Date <span className={REQUIRED_MARK}>*</span>
            </label>
            <input
              id="events-form-date"
              data-testid="events-form-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                clearFieldError('date');
              }}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? DATE_ERROR_ID : undefined}
              className={fieldClass(Boolean(errors.date))}
            />
            {errors.date && (
              <p
                id={DATE_ERROR_ID}
                className={FIELD_ERROR}
                data-testid="events-form-date-error"
                role="alert"
              >
                {errors.date}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="events-form-description"
              className={FIELD_LABEL}
            >
              Description (optional)
            </label>
            <textarea
              id="events-form-description"
              data-testid="events-form-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearFieldError('description');
              }}
              rows={3}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? DESCRIPTION_ERROR_ID : undefined}
              className={fieldClass(Boolean(errors.description), true)}
              placeholder="Add a note about this event..."
            />
            {errors.description && (
              <p
                id={DESCRIPTION_ERROR_ID}
                className={FIELD_ERROR}
                data-testid="events-form-description-error"
                role="alert"
              >
                {errors.description}
              </p>
            )}
          </div>

          {/* Icon.

              The radio is sr-only and the styled <label> is what a sighted user
              sees and clicks, which costs two things a plain checked-only style
              does not give back:

              - a keyboard user tabbing through the group needs the focus ring
                to move, and the radio itself is invisible. `peer` on the input
                plus `peer-focus-visible:` on the label — which is why the input
                is a PRECEDING SIBLING of the label rather than its child, since
                `peer-*` only reaches forward.
              - a pointer user's interactive element is the label, so the label
                carries its own data-testid rather than leaving a test to reach
                for a `label[for=...]` CSS selector. */}
          <fieldset>
            <legend className={FIELD_LABEL}>
              Icon
            </legend>
            <div className="flex gap-2">
              {ICON_OPTIONS.map(({ value, label: iconLabel, Icon }) => (
                <div key={value} className="flex-1">
                  <input
                    id={`events-form-icon-${value}`}
                    data-testid={`events-form-icon-${value}`}
                    type="radio"
                    name="events-form-icon"
                    value={value}
                    checked={icon === value}
                    onChange={() => {
                      setIcon(value);
                      clearFieldError('icon');
                    }}
                    aria-describedby={errors.icon ? ICON_ERROR_ID : undefined}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={`events-form-icon-${value}`}
                    data-testid={`events-form-icon-option-${value}`}
                    className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-3 text-sm font-semibold transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent ${
                      icon === value
                        ? 'bg-tint text-accent ring-2 ring-accent'
                        : 'text-muted ring-1 ring-line-strong peer-focus-visible:ring-2 peer-focus-visible:ring-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {iconLabel}
                  </label>
                </div>
              ))}
            </div>
            {errors.icon && (
              <p
                id={ICON_ERROR_ID}
                className={FIELD_ERROR}
                data-testid="events-form-icon-error"
                role="alert"
              >
                {errors.icon}
              </p>
            )}
          </fieldset>

          {saveFailure && (
            <p
              className={FAILURE_BOX}
              data-testid="events-form-error"
              role="alert"
            >
              {isSaveUncertain
                ? "This event may already have been saved. We couldn't read the response. Refresh events to check the latest list before making another change."
                : saveFailure.error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              data-testid="events-form-cancel"
              className={SECONDARY_BUTTON}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            {saveFailure?.code === 'not-found' || isSaveUncertain ? (
              <button
                ref={submitButtonRef}
                type="button"
                onClick={handleRefresh}
                data-testid="events-form-refresh"
                className={PRIMARY_BUTTON}
              >
                <Calendar className="h-4 w-4" />
                Refresh events
              </button>
            ) : (
              <button
                ref={submitButtonRef}
                type="submit"
                disabled={isSaving}
                data-testid="events-form-submit"
                className={PRIMARY_BUTTON}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Add'}
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

interface EventDeleteConfirmationProps {
  event: CoupleEvent;
  onClose: () => void;
  onConfirmDelete: (eventId: string) => Promise<EventWriteResult>;
  onRefresh: () => void;
  /**
   * Where focus goes after a delete or refresh may remove the opener's row.
   * useFocusTrap records that it skips the restore when the opener is no longer
   * connected, which after a successful delete is always the case.
   */
  fallbackFocusRef: RefObject<HTMLElement | null>;
}

function EventDeleteConfirmation({
  event,
  onClose,
  onConfirmDelete,
  onRefresh,
  fallbackFocusRef,
}: EventDeleteConfirmationProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [failure, setFailure] = useState<EventWriteFailure | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isDeletingRef = useRef(false);
  const deleteSucceededRef = useRef(false);
  const refreshRequestedRef = useRef(false);

  const titleId = 'events-delete-title';

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleEscape = useCallback(() => {
    if (isDeletingRef.current) return;
    onCloseRef.current();
  }, []);

  // Cancel takes initial focus because this action cannot be undone.
  useFocusTrap(panelRef, true, {
    onEscape: handleEscape,
    initialFocusRef: cancelButtonRef,
  });

  // Declared after the trap call so its cleanup runs second — see the same note
  // in EventForm. A successful delete and a refresh both choose the surviving
  // header control; opener connectivity is not a sound signal at cleanup time.
  useEffect(() => {
    return () => {
      if (!deleteSucceededRef.current && !refreshRequestedRef.current) return;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const fallback = fallbackFocusRef.current;
      if (fallback?.isConnected) {
        fallback.focus();
      }
    };
  }, [fallbackFocusRef]);

  useEffect(() => {
    if (failure && !isDeleting) {
      cancelButtonRef.current?.focus();
    }
  }, [failure, isDeleting]);

  const handleDelete = async () => {
    setIsDeleting(true);
    isDeletingRef.current = true;
    setFailure(null);
    // The button about to be disabled currently holds focus; move it onto the
    // panel while that move can still land, or the browser parks focus on
    // <body>, outside the element the trap's keydown listener is bound to.
    panelRef.current?.focus();

    try {
      const result = await onConfirmDelete(event.id);

      if (!result.success) {
        setFailure(result);
        setIsDeleting(false);
        isDeletingRef.current = false;
        return;
      }

      deleteSucceededRef.current = true;
      onClose();
    } catch (err) {
      console.error('[EventsSettings] Unexpected delete failure:', err);
      setFailure({
        success: false,
        code: 'transport',
        error: err instanceof Error && err.message ? err.message : 'Failed to delete the event.',
      });
      setIsDeleting(false);
      isDeletingRef.current = false;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  };

  const handleRefresh = () => {
    if (refreshRequestedRef.current) return;
    refreshRequestedRef.current = true;
    onRefresh();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={DIALOG_BACKDROP}
      onClick={handleBackdropClick}
      data-testid="events-delete-confirmation"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`${DIALOG_PANEL} max-w-sm`}
      >
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-dtint text-danger">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 id={titleId} className={DIALOG_TITLE}>
            Delete this event?
          </h3>
        </div>

        <p className="mb-2 text-[15px] break-words text-ink">
          <span className="font-semibold">{event.label}</span> will
          be removed for both of you.
        </p>
        <p className="mb-5 text-sm text-muted">You cannot undo this.</p>

        {failure && (
          <p
            className={`${FAILURE_BOX} mb-4`}
            data-testid="events-delete-error"
            role="alert"
          >
            {failure.error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="events-delete-cancel"
            className={SECONDARY_BUTTON}
          >
            Cancel
          </button>
          {failure?.code === 'not-found' ? (
            <button
              type="button"
              onClick={handleRefresh}
              data-testid="events-delete-refresh"
              className={PRIMARY_BUTTON}
            >
              <Calendar className="h-4 w-4" />
              Refresh events
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              data-testid="events-delete-confirm"
              className={DESTRUCTIVE_BUTTON}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
