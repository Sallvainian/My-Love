/**
 * NewDatePages -- how a new event or anniversary is added: the Kind chooser
 * the Dates list's `+` button opens, and the two Form pages it pushes,
 * `dates/new-event` and `dates/new-anniversary`. Both pages are in `SUBPAGES`
 * (`small` title, `leading: 'cancel'`, `reloadsToParent`), so a reload shows
 * the Dates list.
 *
 * `KindChooser` is the kit dialog with no visible title (its accessible name is
 * the `+` button's, `Add a date`): `Event` and `Anniversary` pills, then
 * `Cancel`. Escape, the scrim and Cancel close it with no navigation; a kind
 * closes it and asks the parent to push that kind's page.
 *
 * A Form page shows every field at once, the one exception to tap-to-edit,
 * since nothing exists yet: Cancel leads the bar and Add trails it. Add is the
 * only write. It is enabled when the trimmed Name is not empty, the Date passes
 * `parseEventDate`, no add is in flight, and (an event only) the trimmed Name is
 * at most `LABEL_MAX_LENGTH` and the trimmed Note at most
 * `DESCRIPTION_MAX_LENGTH` code points, the limits `EventPages` mirrors from the
 * table's CHECK constraints. A tap on Add:
 *
 * - offline: refuses before any request with `offlineMessage` in the Error
 *   box, keeping every field;
 * - online: writes once (a second tap while it runs is ignored). Success calls
 *   `goBack()` to the page that opened the form and never opens the new date;
 *   a failure shows its message in the Error box, keeps the fields and
 *   re-enables Add. The Error box clears on the next Add.
 *
 * An event add that answers `invalid-response` may have committed, and
 * `public.events` has no idempotency key to make a second add safe, so Add
 * stays disabled for the rest of that form's life with the message shown. An
 * anniversary add sends `useSubmitKey().keyFor(payload)` as its `clientKey`, so
 * a retry of the same payload resolves to the row the first attempt stored.
 *
 * `IconPicker` is the event form's three equal tiles; it is exported so the
 * Icon field page can use it later.
 *
 * @component
 */

import { CircleAlert } from 'lucide-react';
import { m as motion } from 'motion/react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactNode,
} from 'react';
import { isOnline } from '../../api/errorHandlers';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useSubmitKey } from '../../hooks/useSubmitKey';
import { offlineMessage } from '../../services/accountDataError';
import { parseEventDate, type EventIcon } from '../../services/eventsService';
import type { EventWriteResult } from '../../stores/slices/eventsSlice';
import { useAppStore } from '../../stores/useAppStore';
import {
  CARD,
  DIALOG_BACKDROP,
  DIALOG_PANEL,
  FAILURE_BOX,
  FIELD_LABEL,
  SECONDARY_BUTTON,
  fieldClass,
} from '../shared/kitClasses';
import {
  DESCRIPTION_MAX_LENGTH,
  ICON_OPTIONS,
  LABEL_MAX_LENGTH,
  codePoints,
} from './EventPages';
import { SettingsBarAction } from './stack/SettingsBarAction';
import { useSettingsPage } from './stack/settingsPageContext';

const FIELD_CLASS = `${fieldClass(false)} disabled:cursor-not-allowed disabled:opacity-60`;
const NOTE_FIELD_CLASS = `${fieldClass(false, true)} disabled:cursor-not-allowed disabled:opacity-60`;

export type NewDateKind = 'event' | 'anniversary';

interface KindChooserProps {
  /** The kind chosen; the parent closes the chooser and pushes that kind's page. */
  onChoose: (kind: NewDateKind) => void;
  onCancel: () => void;
}

/**
 * The Kind chooser: the kit dialog asking Event or Anniversary. Focus is
 * trapped and starts on Cancel; Escape or a tap on the scrim cancels. Like
 * `ConfirmDialog`, `onCancel` need not be stable, and it renders inside
 * `AnimatePresence` for the exit.
 */
export function KindChooser({ onChoose, onCancel }: KindChooserProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);
  const cancel = useCallback(() => onCancelRef.current(), []);

  useFocusTrap(panelRef, true, {
    onEscape: cancel,
    initialFocusRef: cancelButtonRef,
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) cancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={DIALOG_BACKDROP}
      onClick={handleBackdropClick}
      data-testid="settings-kind-chooser"
      role="dialog"
      aria-modal="true"
      aria-label="Add a date"
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChoose('event')}
            className={SECONDARY_BUTTON}
            data-testid="settings-kind-chooser-event"
          >
            Event
          </button>
          <button
            type="button"
            onClick={() => onChoose('anniversary')}
            className={SECONDARY_BUTTON}
            data-testid="settings-kind-chooser-anniversary"
          >
            Anniversary
          </button>
        </div>
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={cancel}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold text-muted transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="settings-kind-chooser-cancel"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

interface IconPickerProps {
  value: EventIcon;
  onChange: (icon: EventIcon) => void;
  disabled?: boolean;
  /** The tiles' test ids are `<testIdPrefix>-<value>`. */
  testIdPrefix?: string;
}

/**
 * The event icon as three equal 48px tiles (Calendar, Ring, Plane): the
 * selected one a tint fill, accent label and 2px accent ring, the others a 1px
 * line-strong ring. The radios are sr-only and precede their label, so the
 * label can show the focus ring (`peer`) and carries the test id a tap goes to.
 */
export function IconPicker({
  value,
  onChange,
  disabled = false,
  testIdPrefix = 'settings-new-event-icon',
}: IconPickerProps) {
  const name = useId();
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Icon">
      {ICON_OPTIONS.map(({ value: option, label, Icon }) => (
        <div key={option} className="flex-1">
          <input
            id={`${name}-${option}`}
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            disabled={disabled}
            onChange={() => onChange(option)}
            className="peer sr-only"
          />
          <label
            htmlFor={`${name}-${option}`}
            data-testid={`${testIdPrefix}-${option}`}
            data-selected={value === option ? 'true' : 'false'}
            className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-3 text-sm font-semibold transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${
              value === option
                ? 'bg-tint text-accent ring-2 ring-accent'
                : 'text-muted ring-1 ring-line-strong'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </label>
        </div>
      ))}
    </div>
  );
}

interface FormShellProps {
  testId: string;
  /** Whether the fields alone allow an add (not the in-flight or latch state). */
  valid: boolean;
  saving: boolean;
  /** True once Add must stay off for the rest of the form's life. */
  latched: boolean;
  error: string | null;
  onAdd: () => void;
  children: ReactNode;
}

/** The Form page's frame: Add in the bar, the Error box, then one card holding the fields. */
function FormShell({ testId, valid, saving, latched, error, onAdd, children }: FormShellProps) {
  const canAdd = valid && !saving && !latched;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAdd();
  };

  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      <SettingsBarAction>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="min-h-11 rounded-full px-2 text-[17px] font-semibold text-accent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="settings-form-add"
        >
          Add
        </button>
      </SettingsBarAction>
      {error && (
        <div
          className={`${FAILURE_BOX} flex items-start gap-2`}
          role="alert"
          data-testid="settings-form-error"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      <form className={CARD} noValidate onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">{children}</div>
      </form>
    </div>
  );
}

/**
 * The state both forms share: the three fields, the saving flag and the Error
 * box text. The page owns the in-flight and mounted refs (`useMountedRef`).
 */
function useFormState() {
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return { label, setLabel, date, setDate, note, setNote, saving, setSaving, error, setError };
}

/**
 * False once the page is left, so a write that lands late does not set state
 * or navigate. Focuses the element `focusId` names (the Name field) on mount.
 */
function useMountedRef(focusId: string) {
  const mountedRef = useRef(false);
  useEffect(() => {
    // Re-armed on setup so StrictMode's cleanup/setup replay leaves the live page settled.
    mountedRef.current = true;
    document.getElementById(focusId)?.focus({ preventScroll: true });
    return () => {
      mountedRef.current = false;
    };
  }, [focusId]);
  return mountedRef;
}

interface FieldProps {
  id: string;
  label: string;
  children: ReactNode;
}

function Field({ id, label, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function NewEventPage() {
  const { goBack } = useSettingsPage();
  const addEvent = useAppStore((s) => s.addEvent);
  const form = useFormState();
  const { label, date, note, saving, setError, setSaving } = form;
  const nameId = useId();
  const mountedRef = useMountedRef(nameId);
  /** A ref beside `saving`: a second tap in the same tick sees the old state. */
  const inFlightRef = useRef(false);
  const [icon, setIcon] = useState<EventIcon>('calendar');
  const [latched, setLatched] = useState(false);
  const dateId = useId();
  const noteId = useId();

  const trimmedLabel = label.trim();
  const trimmedNote = note.trim();
  const valid =
    trimmedLabel !== '' &&
    codePoints(trimmedLabel) <= LABEL_MAX_LENGTH &&
    parseEventDate(date) !== null &&
    codePoints(trimmedNote) <= DESCRIPTION_MAX_LENGTH;

  const add = async () => {
    if (!valid || saving || latched || inFlightRef.current) return;
    setError(null);
    if (!isOnline()) {
      setError(offlineMessage('Events'));
      return;
    }
    inFlightRef.current = true;
    setSaving(true);
    let result: EventWriteResult;
    try {
      result = await addEvent({
        label: trimmedLabel,
        eventDate: date,
        description: trimmedNote || null,
        icon,
      });
    } catch (caught) {
      // The slice returns its failures, so this is belt and braces: without it
      // an unexpected throw would leave Add disabled with nothing on screen.
      console.error('[NewEventPage] Could not add the event:', caught);
      result = {
        success: false,
        code: 'transport',
        error: caught instanceof Error && caught.message ? caught.message : 'Failed to add the event.',
      };
    }
    inFlightRef.current = false;
    if (!mountedRef.current) return;
    if (result.success) {
      // Add stays off from here: the page is about to be left.
      goBack();
      return;
    }
    // The response was unreadable, so the event may have been stored; a second
    // add could duplicate it, and the table has no key to resolve that.
    if (result.code === 'invalid-response') setLatched(true);
    setError(result.error);
    setSaving(false);
  };

  return (
    <FormShell
      testId="settings-new-event-page"
      valid={valid}
      saving={saving}
      latched={latched}
      error={form.error}
      onAdd={() => void add()}
    >
      <Field id={nameId} label="Name">
        <input
          id={nameId}
          type="text"
          value={label}
          disabled={saving}
          placeholder="e.g., Weekend trip"
          onChange={(e) => form.setLabel(e.target.value)}
          className={FIELD_CLASS}
          data-testid="settings-new-event-name-field"
        />
      </Field>
      <Field id={dateId} label="Date">
        <input
          id={dateId}
          type="date"
          value={date}
          disabled={saving}
          onChange={(e) => form.setDate(e.target.value)}
          className={FIELD_CLASS}
          data-testid="settings-new-event-date-field"
        />
      </Field>
      <Field id={noteId} label="Note">
        <textarea
          id={noteId}
          rows={3}
          value={note}
          disabled={saving}
          placeholder="Add a note about this event..."
          onChange={(e) => form.setNote(e.target.value)}
          className={NOTE_FIELD_CLASS}
          data-testid="settings-new-event-note-field"
        />
      </Field>
      <div>
        <span className={FIELD_LABEL}>Icon</span>
        <IconPicker value={icon} onChange={setIcon} disabled={saving} />
      </div>
    </FormShell>
  );
}

export function NewAnniversaryPage() {
  const { goBack } = useSettingsPage();
  const addAnniversary = useAppStore((s) => s.addAnniversary);
  const form = useFormState();
  const { label, date, note, saving, setError, setSaving } = form;
  const nameId = useId();
  const mountedRef = useMountedRef(nameId);
  /** A ref beside `saving`: a second tap in the same tick sees the old state. */
  const inFlightRef = useRef(false);
  const { keyFor, reset } = useSubmitKey();
  const dateId = useId();
  const noteId = useId();

  const trimmedLabel = label.trim();
  const trimmedNote = note.trim();
  const valid = trimmedLabel !== '' && parseEventDate(date) !== null;

  const add = async () => {
    if (!valid || saving || inFlightRef.current) return;
    setError(null);
    if (!isOnline()) {
      setError(offlineMessage('Anniversaries'));
      return;
    }
    inFlightRef.current = true;
    setSaving(true);
    const payload = {
      label: trimmedLabel,
      date,
      description: trimmedNote || undefined,
    };
    try {
      // A retry of the same payload reuses its key, so a first attempt whose
      // answer was lost resolves to the row it stored instead of a second one.
      await addAnniversary(payload, keyFor(payload));
      reset();
      inFlightRef.current = false;
      // Add stays off from here: the page is about to be left.
      if (mountedRef.current) goBack();
    } catch (caught) {
      console.error('[NewAnniversaryPage] Could not add the anniversary:', caught);
      inFlightRef.current = false;
      if (!mountedRef.current) return;
      setError(
        caught instanceof Error && caught.message ? caught.message : 'Failed to add the anniversary.'
      );
      setSaving(false);
    }
  };

  return (
    <FormShell
      testId="settings-new-anniversary-page"
      valid={valid}
      saving={saving}
      latched={false}
      error={form.error}
      onAdd={() => void add()}
    >
      <Field id={nameId} label="Name">
        <input
          id={nameId}
          type="text"
          value={label}
          disabled={saving}
          placeholder="e.g., First Date Anniversary"
          onChange={(e) => form.setLabel(e.target.value)}
          className={FIELD_CLASS}
          data-testid="settings-new-anniversary-name-field"
        />
      </Field>
      <Field id={dateId} label="Date">
        <input
          id={dateId}
          type="date"
          value={date}
          disabled={saving}
          onChange={(e) => form.setDate(e.target.value)}
          className={FIELD_CLASS}
          data-testid="settings-new-anniversary-date-field"
        />
      </Field>
      <Field id={noteId} label="Note">
        <textarea
          id={noteId}
          rows={3}
          value={note}
          disabled={saving}
          placeholder="Add a note about this anniversary..."
          onChange={(e) => form.setNote(e.target.value)}
          className={NOTE_FIELD_CLASS}
          data-testid="settings-new-anniversary-note-field"
        />
      </Field>
    </FormShell>
  );
}
