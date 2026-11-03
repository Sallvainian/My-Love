/**
 * EventPages -- an event's own page under `/settings/dates/event/<id>` and its
 * four one-field pages (`…/name`, `…/date`, `…/note`, `…/icon`). Neither is in
 * `SUBPAGES`: the path carries an id, so `Settings` matches it in
 * `resolveSettingsPage` and titles the page with the event's name (`Event`
 * until the store holds it).
 *
 * An own event's page lists Name, Date, Note and Icon (each opens its field
 * page), then Remind me while the event is upcoming (today counts as upcoming,
 * as on the Dates list), then `Delete event` centered and danger, alone in its
 * own card. It asks first (`ConfirmDialog`); offline it refuses before the
 * dialog, with `offlineMessage('Events', 'delete')` in the page's Error box,
 * and a delete that fails shows its message there and re-enables the row. A
 * partner's event is read-only (Date, Note and Icon rows without chevrons, no
 * Delete, no footnote) and still has Remind me while upcoming. Past events
 * have no Remind me, since a reminder for a past date can never fire.
 *
 * Settings does not refresh events, so an event page whose event the store
 * does not hold loads them on mount and on each connectivity change, as the
 * Dates list does; one whose event is held asks nothing, since a load replaces
 * the list with the server's first page and would drop an event reached through
 * `Load more`. The store holds a paged window, so an event absent from it is
 * not the same as a deleted one: the page goes back to the Dates list, once per
 * mount, only after its own `loadEvents()` answered `success` and still found
 * no such event. Until then
 * (a reload before the answer) the page shows its title and nothing under the
 * bar; a `failure` or `stale` load never goes back. A delete and that fallback
 * share one once-only `leave()` (`useFallBackToDates`), since `removeEvent`
 * drops the event from the store before it resolves.
 *
 * The field pages are `OneFieldPage`s registered with `reloadsToParent`, and
 * write through `editEvent`; a partner's or unknown event gets no field.
 * The limits mirror the table's CHECK constraints: a name of 1 to 100 and a
 * note of at most 500 code points.
 *
 * @component
 */

import { Calendar, Check, Gem, Plane, type LucideIcon } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
import { MARK_KEYS } from '../../services/dateReminders';
import {
  isEventIcon,
  parseEventDate,
  type EventIcon,
  type EventUpdateInput,
} from '../../services/eventsService';
import type { EventWriteResult } from '../../stores/slices/eventsSlice';
import { useAppStore } from '../../stores/useAppStore';
import { formatDateISO } from '../../utils/dateUtils';
import { DIVIDER, GROUP_ROW, fieldClass } from '../shared/kitClasses';
import { getCalendarDaysDiff } from '../RelationshipTimers/eventCountdownHelpers';
import { ConfirmDialog } from './ConfirmDialog';
import { DatePage } from './DatePages';
import { useFallBackToDates } from './dateNavigation';
import { RemindMeGroup } from './RemindMe';
import { formatListDate } from './settingsFields';
import { OneFieldPage } from './stack/OneFieldPage';
import { ReadOnlyRow, SettingsGroup, SettingsRow } from './stack/SettingsRows';
import { ROW_BUTTON } from './SwitchRow';

/** The table's CHECK limits, counted in code points as the database does. */
export const LABEL_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 500;
// eslint-disable-next-line react-refresh/only-export-components -- shared with NewDatePages
export const codePoints = (value: string) => [...value].length;

// eslint-disable-next-line react-refresh/only-export-components -- shared with NewDatePages; the contract parser reads this top-level const
export const ICON_OPTIONS: ReadonlyArray<{ value: EventIcon; label: string; Icon: LucideIcon }> = [
  { value: 'calendar', label: 'Calendar', Icon: Calendar },
  { value: 'ring', label: 'Ring', Icon: Gem },
  { value: 'plane', label: 'Plane', Icon: Plane },
];

const iconLabel = (icon: EventIcon) =>
  ICON_OPTIONS.find((option) => option.value === icon)?.label ?? icon;

const FIELD_CLASS = `${fieldClass(false)} disabled:cursor-not-allowed disabled:opacity-60`;
const NOTE_FIELD_CLASS = `${fieldClass(false, true)} disabled:cursor-not-allowed disabled:opacity-60`;

export type EventField = 'name' | 'date' | 'note' | 'icon';

interface EventPageProps {
  eventId: string;
}

export function EventPage({ eventId }: EventPageProps) {
  const userId = useAppStore((s) => s.userId);
  const authSessionVersion = useAppStore((s) => s.authSessionVersion);
  const online = useAppStore((s) => s.syncStatus.isOnline);
  const event = useAppStore((s) => s.events.find((candidate) => candidate.id === eventId));
  const loadEvents = useAppStore((s) => s.loadEvents);
  const removeEvent = useAppStore((s) => s.removeEvent);

  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** This page's own `loadEvents()` answered `success`: only then is an absent event really absent. */
  const [answered, setAnswered] = useState(false);
  const deletingRef = useRef(false);
  /** False once the page is left, so a late answer or delete does not set state or navigate. */
  const mounted = useRef(false);

  useEffect(() => {
    // Re-armed on setup so StrictMode's cleanup/setup replay leaves the live page settled.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Events are not refreshed while Settings is open, so a page that does not
  // hold its event asks, as the Dates list does; either connectivity change
  // re-asks. A held event is not asked about: a load replaces the store's list
  // with the server's first page, which would drop an event reached through
  // `Load more` (or moved past that window by an edit) and bounce the page.
  // Held is read through a ref, not listed as a dependency, so a delete (which
  // removes the event) does not trigger a load.
  const held = useRef(false);
  useEffect(() => {
    held.current = event !== undefined;
  });
  useEffect(() => {
    if (!userId) return;
    if (held.current) return;
    void loadEvents().then((result) => {
      if (mounted.current && result.status === 'success') setAnswered(true);
    });
  }, [userId, authSessionVersion, online, loadEvents, eventId]);

  const leave = useFallBackToDates(answered && event === undefined);

  // Stable: the dialog's focus trap re-runs on a new Escape handler.
  const cancelDelete = useCallback(() => setConfirming(false), []);

  if (!event) return null;

  const now = new Date();
  const own = event.userId === userId;
  const upcoming = getCalendarDaysDiff(event.date, now) >= 0;
  const target = (field: EventField) => `dates/event/${event.id}/${field}`;

  const requestDelete = () => {
    setError(null);
    // Refused before the dialog: the person is never asked to confirm what cannot go through.
    if (!isOnline()) {
      setError(offlineMessage('Events', 'delete'));
      return;
    }
    setConfirming(true);
  };

  const confirmDelete = async () => {
    setConfirming(false);
    if (deletingRef.current) return;
    if (!isOnline()) {
      setError(offlineMessage('Events', 'delete'));
      return;
    }
    deletingRef.current = true;
    setDeleting(true);
    let result: EventWriteResult;
    try {
      result = await removeEvent(event.id);
    } catch (caught) {
      console.error('[EventPage] Could not delete the event:', caught);
      result = {
        success: false,
        code: 'transport',
        error: caught instanceof Error ? caught.message : 'Could not delete the event.',
      };
    }
    deletingRef.current = false;
    if (!mounted.current) return;
    setDeleting(false);
    if (result.success) leave();
    else setError(result.error);
  };

  return (
    <DatePage testId="settings-event-page" error={error}>
      {own ? (
        <SettingsGroup>
          <SettingsRow
            key="name"
            label="Name"
            value={event.label}
            truncateValue
            target={target('name')}
            testId="settings-event-name"
          />
          <SettingsRow
            key="date"
            label="Date"
            value={formatListDate(event.date, now)}
            target={target('date')}
            testId="settings-event-date"
          />
          <SettingsRow
            key="note"
            label="Note"
            value={event.description ?? ''}
            truncateValue
            target={target('note')}
            testId="settings-event-note"
          />
          <SettingsRow
            key="icon"
            label="Icon"
            value={iconLabel(event.icon)}
            target={target('icon')}
            testId="settings-event-icon"
          />
        </SettingsGroup>
      ) : (
        <SettingsGroup>
          <ReadOnlyRow
            key="date"
            label="Date"
            value={formatListDate(event.date, now)}
            testId="settings-event-date-readonly"
          />
          <ReadOnlyRow
            key="note"
            label="Note"
            value={event.description ?? ''}
            testId="settings-event-note-readonly"
          />
          <ReadOnlyRow
            key="icon"
            label="Icon"
            value={iconLabel(event.icon)}
            testId="settings-event-icon-readonly"
          />
        </SettingsGroup>
      )}

      {upcoming && <RemindMeGroup markKey={MARK_KEYS.event(event.id)} onError={setError} />}

      {own && (
        <SettingsGroup>
          <button
            key="delete"
            type="button"
            onClick={requestDelete}
            disabled={deleting}
            className={`${ROW_BUTTON} justify-center text-[15px] font-medium text-danger
              disabled:cursor-not-allowed disabled:opacity-60`}
            data-testid="settings-event-delete"
          >
            Delete event
          </button>
        </SettingsGroup>
      )}

      {/* Outside every card, like the other dialogs, so no card can clip it. */}
      <AnimatePresence>
        {confirming && (
          <ConfirmDialog
            question="Delete this event?"
            confirmLabel="Delete"
            onCancel={cancelDelete}
            onConfirm={() => void confirmDelete()}
            testId="settings-event-delete-confirmation"
          />
        )}
      </AnimatePresence>
    </DatePage>
  );
}

/** Writes one field; a refusal or failure throws, for `OneFieldPage`'s Error box. */
async function writeEvent(
  editEvent: (eventId: string, updates: EventUpdateInput) => Promise<EventWriteResult>,
  eventId: string,
  updates: EventUpdateInput
): Promise<void> {
  const result = await editEvent(eventId, updates);
  if (!result.success) throw new Error(result.error);
}

interface EventFieldPageProps extends EventPageProps {
  field: EventField;
}

export function EventFieldPage({ eventId, field }: EventFieldPageProps) {
  const userId = useAppStore((s) => s.userId);
  const event = useAppStore((s) => s.events.find((candidate) => candidate.id === eventId));
  const editEvent = useAppStore((s) => s.editEvent);

  // A partner's or unknown event has no field to edit.
  if (!event || event.userId !== userId) return null;

  const offlineRefusal = offlineMessage('Events');

  switch (field) {
    case 'name':
      return (
        <OneFieldPage
          label="Name"
          saved={event.label}
          isValid={(value) => value !== '' && codePoints(value) <= LABEL_MAX_LENGTH}
          save={(value) => writeEvent(editEvent, event.id, { label: value })}
          offlineRefusal={offlineRefusal}
          testId="settings-event-name-page"
          renderField={({ id, value, onChange, disabled }) => (
            <input
              id={id}
              type="text"
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              className={FIELD_CLASS}
              data-testid="settings-event-name-field"
            />
          )}
        />
      );
    case 'date':
      return (
        <OneFieldPage
          label="Date"
          saved={formatDateISO(event.date)}
          isValid={(value) => parseEventDate(value) !== null}
          save={(value) => writeEvent(editEvent, event.id, { eventDate: value })}
          offlineRefusal={offlineRefusal}
          testId="settings-event-date-page"
          renderField={({ id, value, onChange, disabled }) => (
            <input
              id={id}
              type="date"
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              className={FIELD_CLASS}
              data-testid="settings-event-date-field"
            />
          )}
        />
      );
    case 'note':
      return (
        <OneFieldPage
          label="Note"
          saved={event.description ?? ''}
          isValid={(value) => codePoints(value) <= DESCRIPTION_MAX_LENGTH}
          save={(value) =>
            writeEvent(editEvent, event.id, { description: value === '' ? null : value })
          }
          offlineRefusal={offlineRefusal}
          testId="settings-event-note-page"
          renderField={({ id, value, onChange, disabled }) => (
            <textarea
              id={id}
              rows={4}
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              className={NOTE_FIELD_CLASS}
              data-testid="settings-event-note-field"
            />
          )}
        />
      );
    case 'icon':
      return (
        <OneFieldPage
          label="Icon"
          saved={event.icon}
          isValid={isEventIcon}
          save={(value) => writeEvent(editEvent, event.id, { icon: value as EventIcon })}
          offlineRefusal={offlineRefusal}
          testId="settings-event-icon-page"
          renderField={({ id, value, onChange, disabled }) => (
            <div
              id={id}
              tabIndex={-1}
              role="radiogroup"
              aria-label="Icon"
              className="flex flex-col gap-1.5 focus:outline-hidden"
              data-testid="settings-event-icon-options"
            >
              {ICON_OPTIONS.map(({ value: option, label, Icon }, index) => (
                <div key={option} className="contents">
                  {index > 0 && <div className={DIVIDER} aria-hidden="true" />}
                  <label
                    className={`${GROUP_ROW} cursor-pointer rounded-[14px] has-focus-visible:ring-2 has-focus-visible:ring-accent`}
                    data-testid={`settings-event-icon-${option}`}
                  >
                    <input
                      type="radio"
                      name="settings-event-icon"
                      className="sr-only"
                      checked={value === option}
                      disabled={disabled}
                      onChange={() => onChange(option)}
                    />
                    <Icon className="h-4.5 w-4.5 shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                      {label}
                    </span>
                    {value === option && (
                      <Check className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    )}
                  </label>
                </div>
              ))}
            </div>
          )}
        />
      );
  }
}
