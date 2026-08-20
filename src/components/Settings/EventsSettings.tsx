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
 *    Unfiltered is not unbounded. `eventsService.getEvents` reads a capped
 *    window on each side of today (50 by default), so past roughly 50 past
 *    events the OLDEST ones stop arriving — and a year typed wrong into the
 *    deep past is exactly such a row. This screen has no "load more" control to
 *    reach them; adding one means giving `loadEvents` a limit/offset it does
 *    not take today.
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
  const { events, eventsIsLoading, userId, loadEvents, addEvent, editEvent, removeEvent } =
    useAppStore();

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [settledForUserId, setSettledForUserId] = useState<string | null>(null);

  // The header Add button: the one control that outlives a delete, an
  // add-from-empty, and a stale-row refresh, so it is where focus goes when the
  // opener does not survive.
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const recordLoadOutcome = useCallback((requestedBy: string, result: EventLoadResult) => {
    if (result.status === 'stale') return;
    // eslint-disable-next-line no-restricted-properties
    const state = useAppStore.getState();
    if (state.userId !== requestedBy) return;

    setLoadFailed(result.status === 'failure');
    setSettledForUserId(requestedBy);
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    void loadEvents().then((result) => {
      if (cancelled) return;
      recordLoadOutcome(userId, result);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, loadEvents, recordLoadOutcome]);

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
    if (!userId) return;
    const result = await loadEvents();
    recordLoadOutcome(userId, result);
  }, [loadEvents, recordLoadOutcome, userId]);

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

  const firstLoadSettled = settledForUserId !== null && settledForUserId === userId;

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

  // One notice, one testid, mounted in whichever of the two positions applies.
  const loadErrorNotice = (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/30"
      data-testid="events-settings-load-error"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-amber-800 dark:text-amber-300">
        We couldn&apos;t load your events. Check your connection and reload the page.
      </p>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="events-settings">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {/* Not "Events": Settings.tsx already renders that as this section's
              title bar, and two sibling h2s with identical text is one heading
              too many for a screen reader walking the page. AnniversarySettings
              solves it the same way, with "Anniversary Countdowns" under
              "Anniversary". */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Event Countdowns
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Countdowns you and your partner both see. Past events stay here so a wrong date can be
            fixed.
          </p>
        </div>

        {/* aria-label rather than the visible span alone: below `sm` the span is
            display:none, so the accessible name would be empty on the phone
            this app is mostly used on. */}
        <button
          ref={addButtonRef}
          type="button"
          onClick={handleAdd}
          data-testid="events-settings-add"
          aria-label="Add event"
          className="flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-white shadow-md transition-colors duration-200 hover:bg-pink-600 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Add Event</span>
        </button>
      </div>

      {/* Above a list that survived a failed refresh; the `error` slot below
          renders the same notice as the list area's own content when there is
          no list to sit above. Exactly one of the two is ever mounted. */}
      {showLoadErrorBanner && loadErrorNotice}

      {/* Event list */}
      <div
        className="space-y-3"
        data-testid="events-settings-load-region"
        aria-busy={eventsIsLoading}
      >
        {slot === 'error' && loadErrorNotice}

        {slot === 'loading' && (
          <div
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-50 py-12 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
            data-testid="events-settings-loading"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading events…</span>
          </div>
        )}

        {slot === 'empty' && (
          <div
            className="rounded-lg bg-gray-50 py-12 text-center dark:bg-gray-800/50"
            data-testid="events-settings-empty"
          >
            <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">
              No events yet. Add one you are both counting down to.
            </p>
            <button
              type="button"
              onClick={handleAddFromEmptyState}
              data-testid="events-settings-empty-add"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-white shadow-md transition-colors duration-200 hover:bg-pink-600 hover:shadow-lg"
            >
              <Plus className="h-4 w-4" />
              Add your first event
            </button>
          </div>
        )}

        {slot === 'list' && (
          <div data-testid="events-settings-list">
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
                    className="mb-3 rounded-lg border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3
                          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                          data-testid={`event-label-${event.id}`}
                        >
                          {event.label}
                        </h3>
                        <p
                          className="mt-1 text-sm text-gray-600 dark:text-gray-400"
                          data-testid={`event-date-${event.id}`}
                        >
                          {formatDateLong(event.date)}
                        </p>
                        {event.description && (
                          <p
                            className="mt-2 text-sm text-gray-500 dark:text-gray-500"
                            data-testid={`event-description-${event.id}`}
                          >
                            {event.description}
                          </p>
                        )}
                        {!isOwn && (
                          <p
                            className="mt-2 text-xs text-gray-400 dark:text-gray-500"
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(event)}
                            data-testid={`event-edit-${event.id}`}
                            className="rounded-lg p-2 text-purple-600 transition-colors duration-200 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30"
                            aria-label={`Edit ${event.label}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingEvent(event)}
                            data-testid={`event-delete-${event.id}`}
                            className="rounded-lg p-2 text-red-600 transition-colors duration-200 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
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
      </div>

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
  const [label, setLabel] = useState(event?.label ?? '');
  // formatDateISO, never toISOString().split('T')[0]: the latter is UTC-based
  // and pre-fills the previous day for anyone west of UTC.
  const [date, setDate] = useState(event ? formatDateISO(event.date) : '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [icon, setIcon] = useState<EventIcon>(event?.icon ?? 'calendar');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveFailure, setSaveFailure] = useState<EventWriteFailure | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const isSavingRef = useRef(false);
  const saveSucceededRef = useRef(false);
  const refreshRequestedRef = useRef(false);

  const isEditing = Boolean(event);
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
  // retryable write, Refresh events for a stale row. Doing it inside the await
  // would focus a still-disabled button, which the DOM ignores.
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

    const trimmedLabel = label.trim();
    const trimmedDescription = description.trim();
    const nextErrors: Record<string, string> = {};

    if (!trimmedLabel) {
      nextErrors.label = 'Label is required';
    } else if (trimmedLabel.length > LABEL_MAX_LENGTH) {
      nextErrors.label = `Label must be ${LABEL_MAX_LENGTH} characters or fewer`;
    }

    if (!date) {
      nextErrors.date = 'Date is required';
    } else if (!ISO_DATE_PATTERN.test(date)) {
      nextErrors.date = 'Date must be in YYYY-MM-DD format';
    }

    if (trimmedDescription.length > DESCRIPTION_MAX_LENGTH) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
        className="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-2xl outline-none dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id={titleId} className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Event' : 'Add Event'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            data-testid="events-form-close"
            className="rounded-lg p-2 text-gray-600 transition-colors duration-200 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
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
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Label <span className="text-red-500">*</span>
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
              className={`w-full rounded-lg border bg-white px-3 py-2 dark:bg-gray-900 ${errors.label ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} text-gray-900 placeholder-gray-500 focus:ring-2 focus:outline-none dark:text-gray-100 ${errors.label ? 'focus:ring-red-500' : 'focus:ring-pink-500'}`}
              placeholder="e.g., Gracie visits"
            />
            {errors.label && (
              <p
                id={LABEL_ERROR_ID}
                className="mt-1 text-sm text-red-600 dark:text-red-400"
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
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Date <span className="text-red-500">*</span>
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
              className={`w-full rounded-lg border bg-white px-3 py-2 dark:bg-gray-900 ${errors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} text-gray-900 focus:ring-2 focus:outline-none dark:text-gray-100 ${errors.date ? 'focus:ring-red-500' : 'focus:ring-pink-500'}`}
            />
            {errors.date && (
              <p
                id={DATE_ERROR_ID}
                className="mt-1 text-sm text-red-600 dark:text-red-400"
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
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
              className={`w-full resize-none rounded-lg border bg-white px-3 py-2 dark:bg-gray-900 ${errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-pink-500 focus:outline-none dark:text-gray-100`}
              placeholder="Add a note about this event..."
            />
            {errors.description && (
              <p
                id={DESCRIPTION_ERROR_ID}
                className="mt-1 text-sm text-red-600 dark:text-red-400"
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
            <legend className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2 ${
                      icon === value
                        ? 'border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                        : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300'
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
                className="mt-1 text-sm text-red-600 dark:text-red-400"
                data-testid="events-form-icon-error"
                role="alert"
              >
                {errors.icon}
              </p>
            )}
          </fieldset>

          {saveFailure && (
            <p
              className="rounded-lg border border-red-300 bg-red-100 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400"
              data-testid="events-form-error"
              role="alert"
            >
              {saveFailure.error}
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              data-testid="events-form-cancel"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-gray-900 transition-colors duration-200 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            {saveFailure?.code === 'not-found' ? (
              <button
                ref={submitButtonRef}
                type="button"
                onClick={handleRefresh}
                data-testid="events-form-refresh"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-white transition-colors duration-200 hover:bg-pink-600"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-white transition-colors duration-200 hover:bg-pink-600 disabled:opacity-50"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl outline-none dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Delete this event?
          </h3>
        </div>

        <p className="mb-2 text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-100">{event.label}</span> will
          be removed for both of you.
        </p>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">You cannot undo this.</p>

        {failure && (
          <p
            className="mb-4 rounded-lg border border-red-300 bg-red-100 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400"
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
            className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-900 transition-colors duration-200 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          {failure?.code === 'not-found' ? (
            <button
              type="button"
              onClick={handleRefresh}
              data-testid="events-delete-refresh"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors duration-200 hover:bg-blue-600"
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
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-white transition-colors duration-200 hover:bg-red-600 disabled:opacity-50"
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
