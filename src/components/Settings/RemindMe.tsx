/**
 * RemindMe -- the `Remind me` switch on a date's page, one switch for one date.
 * Together since, Wedding and both birthdays use it now; stories 11 and 12 reuse
 * it on the event and anniversary pages.
 *
 * Native iOS shell with the local-notifications plugin only: without it
 * (`hasNativeReminders()`) the group is not drawn and nothing is read. The mark
 * is the account's `countdown_marks` row for `markKey` (`datesSlice`): the
 * switch is on while `countdownMarks` holds the key, and is disabled, off,
 * until the marks have loaded. A tap writes the server first (`setCountdownMark`),
 * which re-plans the reminders; the switch is disabled while its save is in
 * flight. The marks and the account's push preferences load when the group
 * mounts and when the connection returns.
 *
 * The Footnote under the card is `A month and a week before.`, or, while the
 * Date reminders switch (Notifications) is off, the switch is disabled and the
 * Footnote says to turn it on; the mark itself is kept. The page owns the Error
 * box: `onError(null)` on each tap, then `onError(message)` for an offline
 * refusal or a failed save.
 *
 * @component
 */

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
import { hasNativeReminders } from '../../services/dateReminders';
import { useAppStore } from '../../stores/useAppStore';
import { FOOTNOTE } from '../shared/kitClasses';
import { SettingsGroup } from './stack/SettingsRows';
import { SwitchRow } from './SwitchRow';

const FOOTNOTE_ON = 'A month and a week before.';
const FOOTNOTE_OFF = 'Date reminders are off. Turn them on in Notifications.';

interface RemindMeGroupProps {
  /** The date's mark key (`MARK_KEYS` in `services/dateReminders.ts`). */
  markKey: string;
  /** Hands the page's Error box a message, or `null` to clear it. */
  onError: (message: string | null) => void;
}

function RemindMeCard({ markKey, onError }: RemindMeGroupProps) {
  const marks = useAppStore((state) => state.countdownMarks);
  const loadCountdownMarks = useAppStore((state) => state.loadCountdownMarks);
  const setCountdownMark = useAppStore((state) => state.setCountdownMark);
  const pushPreferences = useAppStore((state) => state.pushPreferences);
  const loadPushPreferences = useAppStore((state) => state.loadPushPreferences);
  // A second tap would compute from the stale state.
  const [saving, setSaving] = useState(false);

  // The marks and the Date reminders switch, when the group opens and when the connection returns.
  useEffect(() => {
    const load = () => {
      void loadCountdownMarks();
      void loadPushPreferences();
    };
    load();
    window.addEventListener('online', load);
    return () => window.removeEventListener('online', load);
  }, [loadCountdownMarks, loadPushPreferences]);

  // The default is on, as on the Notifications page, until the row has loaded.
  const remindersOff = pushPreferences?.dateReminders === false;

  const toggle = async (next: boolean) => {
    onError(null);
    if (!isOnline()) {
      onError(offlineMessage('Reminders'));
      return;
    }
    setSaving(true);
    try {
      await setCountdownMark(markKey, next);
    } catch (caught) {
      console.error('[RemindMe] Could not save the reminder:', caught);
      onError(caught instanceof Error ? caught.message : 'Could not save your reminder.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsGroup
      footnote={
        <p className={FOOTNOTE} data-testid="settings-remind-me-footnote">
          {remindersOff ? FOOTNOTE_OFF : FOOTNOTE_ON}
        </p>
      }
    >
      <SwitchRow
        key="remind-me"
        id="settings-remind-me"
        icon={Bell}
        label="Remind me"
        checked={marks?.includes(markKey) ?? false}
        onChange={(next) => void toggle(next)}
        disabled={marks === null || saving || remindersOff}
      />
    </SettingsGroup>
  );
}

/** Renders nothing off the native shell or without the local-notifications plugin. */
export function RemindMeGroup(props: RemindMeGroupProps) {
  if (!hasNativeReminders()) return null;
  return <RemindMeCard {...props} />;
}
