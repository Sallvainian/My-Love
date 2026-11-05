/**
 * AnniversaryPages -- an anniversary's own page under
 * `/settings/dates/anniversary/<key>` and its three one-field pages (`…/name`,
 * `…/date`, `…/note`). Neither is in `SUBPAGES`: the path carries a key, so
 * `Settings` matches it in `resolveSettingsPage` and titles the page with the
 * anniversary's label (`Anniversary` until the store holds it). The key is the
 * anniversary's `serverId`, or its device-local id while it has none, as the
 * Dates list builds it.
 *
 * The page lists Name, Date and Note (each opens its field page; an
 * anniversary has no icon), then Remind me while the anniversary has a
 * `serverId` (an anniversary recurs, so there is no past one), then
 * `Delete anniversary` centered and danger, alone in its own card. It asks
 * first (`ConfirmDialog`); offline it refuses before the dialog, with
 * `offlineMessage('Anniversaries', 'delete')` in the page's Error box, and a
 * delete that fails shows its message there and re-enables the row. Anniversaries
 * are private to their creator, so the page only ever shows the reader's own.
 *
 * Nothing asks for anniversaries when Settings opens (the kind's refresher runs
 * on signed-in start and on a reconnect), so a page whose anniversary the store
 * does not hold asks for itself, on mount and on each connectivity change; one
 * whose anniversary is held asks nothing, so a delete (which removes the row)
 * does not start a read. An anniversary absent from the
 * store is not the same as one not loaded yet: the page goes back to the Dates
 * list, once per mount, only after its own `loadAnniversariesFromServer()`
 * answered `true` and still found no such anniversary. Until then (a reload
 * before the answer) the page shows its title and nothing under the bar; a
 * `false` answer never goes back. A delete and that fallback share one
 * once-only `leave()` (`useFallBackToDates`).
 *
 * The field pages are `OneFieldPage`s registered with `reloadsToParent`, and
 * write through `updateAnniversary`, sending the whole input with the one field
 * replaced; an unknown anniversary gets no field. The table checks only that a
 * label is not empty, so the Name page adds no length limit.
 *
 * @component
 */

import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
import type { AnniversaryInput } from '../../services/anniversariesService';
import { MARK_KEYS } from '../../services/dateReminders';
import { parseEventDate } from '../../services/eventsService';
import { useAppStore } from '../../stores/useAppStore';
import type { Anniversary } from '../../types';
import { ConfirmDialog } from './ConfirmDialog';
import { DatePage } from './DatePages';
import { useFallBackToDates } from './dateNavigation';
import { RemindMeGroup } from './RemindMe';
import { FIELD_CLASS, NOTE_FIELD_CLASS, yearlyValue } from './settingsFields';
import { OneFieldPage } from './stack/OneFieldPage';
import { SettingsGroup, SettingsRow } from './stack/SettingsRows';
import { ROW_BUTTON } from './SwitchRow';

export type AnniversaryField = 'name' | 'date' | 'note';

interface AnniversaryPageProps {
  /** The path's key: the anniversary's `serverId`, or its local id while it has none. */
  anniversaryKey: string;
}

/** The anniversary a path key names; the key is built as the Dates list builds it. */
function useAnniversary(anniversaryKey: string): Anniversary | undefined {
  return useAppStore((s) =>
    s.settings?.relationship.anniversaries.find(
      (candidate) => (candidate.serverId ?? String(candidate.id)) === anniversaryKey
    )
  );
}

export function AnniversaryPage({ anniversaryKey }: AnniversaryPageProps) {
  const userId = useAppStore((s) => s.userId);
  const authSessionVersion = useAppStore((s) => s.authSessionVersion);
  const online = useAppStore((s) => s.syncStatus.isOnline);
  const anniversary = useAnniversary(anniversaryKey);
  const loadAnniversariesFromServer = useAppStore((s) => s.loadAnniversariesFromServer);
  const removeAnniversary = useAppStore((s) => s.removeAnniversary);

  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** This page's own load answered `true`: only then is an absent anniversary really absent. */
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

  // Nothing asks for anniversaries when Settings opens (the kind's refresher
  // runs on signed-in start and on a reconnect), so a page that does not hold
  // its anniversary asks for itself; either connectivity change re-asks. Held is read through a ref, not listed as a dependency, so
  // a delete (which removes the anniversary) does not trigger a load.
  const held = useRef(false);
  useEffect(() => {
    held.current = anniversary !== undefined;
  });
  useEffect(() => {
    if (!userId) return;
    if (held.current) return;
    void loadAnniversariesFromServer().then((answer) => {
      if (mounted.current && answer) setAnswered(true);
    });
  }, [userId, authSessionVersion, online, loadAnniversariesFromServer, anniversaryKey]);

  const leave = useFallBackToDates(answered && anniversary === undefined);

  // Stable: the dialog's focus trap re-runs on a new Escape handler.
  const cancelDelete = useCallback(() => setConfirming(false), []);

  if (!anniversary) return null;

  const target = (field: AnniversaryField) => `dates/anniversary/${anniversaryKey}/${field}`;

  const requestDelete = () => {
    setError(null);
    // Refused before the dialog: the person is never asked to confirm what cannot go through.
    if (!isOnline()) {
      setError(offlineMessage('Anniversaries', 'delete'));
      return;
    }
    setConfirming(true);
  };

  const confirmDelete = async () => {
    setConfirming(false);
    if (deletingRef.current) return;
    if (!isOnline()) {
      setError(offlineMessage('Anniversaries', 'delete'));
      return;
    }
    deletingRef.current = true;
    setDeleting(true);
    let failure: string | null = null;
    try {
      await removeAnniversary(anniversary.id);
    } catch (caught) {
      console.error('[AnniversaryPage] Could not delete the anniversary:', caught);
      failure = caught instanceof Error ? caught.message : 'Could not delete the anniversary.';
    }
    deletingRef.current = false;
    if (!mounted.current) return;
    setDeleting(false);
    if (failure === null) leave();
    else setError(failure);
  };

  return (
    <DatePage testId="settings-anniversary-page" error={error}>
      <SettingsGroup>
        <SettingsRow
          key="name"
          label="Name"
          value={anniversary.label}
          truncateValue
          target={target('name')}
          testId="settings-anniversary-name"
        />
        <SettingsRow
          key="date"
          label="Date"
          value={yearlyValue(anniversary.date)}
          target={target('date')}
          testId="settings-anniversary-date"
        />
        <SettingsRow
          key="note"
          label="Note"
          value={anniversary.description ?? ''}
          truncateValue
          target={target('note')}
          testId="settings-anniversary-note"
        />
      </SettingsGroup>

      {anniversary.serverId && (
        <RemindMeGroup markKey={MARK_KEYS.anniversary(anniversary.serverId)} onError={setError} />
      )}

      <SettingsGroup>
        <button
          key="delete"
          type="button"
          onClick={requestDelete}
          disabled={deleting}
          className={`${ROW_BUTTON} justify-center text-[15px] font-medium text-danger
            disabled:cursor-not-allowed disabled:opacity-60`}
          data-testid="settings-anniversary-delete"
        >
          Delete anniversary
        </button>
      </SettingsGroup>

      {/* Outside every card, like the other dialogs, so no card can clip it. */}
      <AnimatePresence>
        {confirming && (
          <ConfirmDialog
            question="Delete this anniversary?"
            confirmLabel="Delete"
            onCancel={cancelDelete}
            onConfirm={() => void confirmDelete()}
            testId="settings-anniversary-delete-confirmation"
          />
        )}
      </AnimatePresence>
    </DatePage>
  );
}

interface AnniversaryFieldPageProps extends AnniversaryPageProps {
  field: AnniversaryField;
}

export function AnniversaryFieldPage({ anniversaryKey, field }: AnniversaryFieldPageProps) {
  const anniversary = useAnniversary(anniversaryKey);
  const updateAnniversary = useAppStore((s) => s.updateAnniversary);

  // An unknown anniversary has no field to edit.
  if (!anniversary) return null;

  const offlineRefusal = offlineMessage('Anniversaries');
  /** The whole input with one field replaced; the write replaces the row. */
  const write = (patch: Partial<AnniversaryInput>) =>
    updateAnniversary(anniversary.id, {
      label: anniversary.label,
      date: anniversary.date,
      description: anniversary.description,
      ...patch,
    });

  switch (field) {
    case 'name':
      return (
        <OneFieldPage
          label="Name"
          saved={anniversary.label}
          isValid={(value) => value !== ''}
          save={(value) => write({ label: value })}
          offlineRefusal={offlineRefusal}
          testId="settings-anniversary-name-page"
          renderField={({ id, value, onChange, disabled }) => (
            <input
              id={id}
              type="text"
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              className={FIELD_CLASS}
              data-testid="settings-anniversary-name-field"
            />
          )}
        />
      );
    case 'date':
      return (
        <OneFieldPage
          label="Date"
          saved={anniversary.date}
          isValid={(value) => parseEventDate(value) !== null}
          save={(value) => write({ date: value })}
          offlineRefusal={offlineRefusal}
          testId="settings-anniversary-date-page"
          renderField={({ id, value, onChange, disabled }) => (
            <input
              id={id}
              type="date"
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              className={FIELD_CLASS}
              data-testid="settings-anniversary-date-field"
            />
          )}
        />
      );
    case 'note':
      return (
        <OneFieldPage
          label="Note"
          saved={anniversary.description ?? ''}
          isValid={() => true}
          save={(value) => write({ description: value === '' ? undefined : value })}
          offlineRefusal={offlineRefusal}
          testId="settings-anniversary-note-page"
          renderField={({ id, value, onChange, disabled }) => (
            <textarea
              id={id}
              rows={4}
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              className={NOTE_FIELD_CLASS}
              data-testid="settings-anniversary-note-field"
            />
          )}
        />
      );
  }
}
