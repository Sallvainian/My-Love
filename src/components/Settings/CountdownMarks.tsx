/**
 * CountdownMarks — the "Reminders" group of Settings' "Push and reminders"
 * section. Its first row is the "Date reminders" switch (story 4.3), which
 * turns every date reminder off or back on: it is the `dateReminders` field of
 * the account's push switches (`settingsSlice.pushPreferences`, kept as the
 * `push-preferences` local copy), and writing the copy re-plans the reminders.
 * It is disabled until the switches have loaded and while a save is in flight;
 * the marks rows below stay usable while it is off. Under it (story 4.2) is one
 * switch for each date the app shows a countdown to,
 * so a person can ask for an earlier heads-up ("In a month" and "In a week",
 * at 9:00) on the dates that matter to them. Every date already has its
 * day-before reminder; a switch only adds the two earlier ones.
 *
 * Native iOS shell only: without the local-notifications plugin (the website,
 * the Home Screen web app, a shell installed before the plugin existed) it
 * renders nothing and reads nothing (`hasNativeReminders()`). The marks are
 * the account's `countdown_marks` rows, kept as the `countdown-marks` local
 * copy (`settingsSlice.countdownMarks`): they load when the section opens and
 * show offline, and a toggle writes the server first, then state and copy
 * (`setCountdownMark`), which re-plans the reminders. A toggle offline is
 * refused with `offlineMessage`.
 *
 * The rows come from `reminderDateEntries`, built from the store's events,
 * anniversaries, couple settings, own profile and partner. A mark whose date
 * no longer exists matches no row and is ignored.
 *
 * @component
 */

import { Bell, Cake, CalendarDays, Gem, Heart, type LucideIcon } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
import { hasNativeReminders, MARK_KEYS, reminderDateEntries } from '../../services/dateReminders';
import { useAppStore } from '../../stores/useAppStore';
import { CARD, DIVIDER, FIELD_ERROR, GROUP_SUBTITLE, GROUP_TITLE } from '../shared/kitClasses';
import { SwitchRow } from './SwitchRow';

const HELPER = 'Remind me a month and a week before.';
const REMINDERS_HELPER = 'At 9:00 before each date.';

/** The row's icon, from the kind of date its key names. */
function iconFor(key: string): LucideIcon {
  if (key.startsWith('event:')) return CalendarDays;
  if (key === MARK_KEYS.wedding) return Gem;
  if (key === MARK_KEYS.ownBirthday || key === MARK_KEYS.partnerBirthday) return Cake;
  return Heart;
}

function CountdownMarksCard() {
  const marks = useAppStore((state) => state.countdownMarks);
  const loadCountdownMarks = useAppStore((state) => state.loadCountdownMarks);
  const setCountdownMark = useAppStore((state) => state.setCountdownMark);
  const events = useAppStore((state) => state.events);
  const anniversaries = useAppStore((state) => state.settings?.relationship.anniversaries);
  const coupleSettings = useAppStore((state) => state.coupleSettings);
  const ownProfile = useAppStore((state) => state.ownProfile);
  const partner = useAppStore((state) => state.partner);
  const pushPreferences = useAppStore((state) => state.pushPreferences);
  const setPushPreference = useAppStore((state) => state.setPushPreference);

  const [error, setError] = useState<string | null>(null);
  // Rows whose save is in flight: a second tap would compute from the stale state.
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [savingReminders, setSavingReminders] = useState(false);

  // The marks, when the section opens and when the connection returns.
  useEffect(() => {
    void loadCountdownMarks();
    const reload = () => void loadCountdownMarks();
    window.addEventListener('online', reload);
    return () => window.removeEventListener('online', reload);
  }, [loadCountdownMarks]);

  const entries = useMemo(() => {
    const linked = coupleSettings?.status === 'linked' ? coupleSettings : null;
    return reminderDateEntries({
      events,
      anniversaries: anniversaries ?? [],
      relationshipStart: linked?.relationshipStart ?? null,
      weddingDate: linked?.weddingDate ?? null,
      ownBirthday: ownProfile
        ? { name: ownProfile.displayName, birthday: ownProfile.birthday }
        : null,
      partnerBirthday: partner ? { name: partner.displayName, birthday: partner.birthday } : null,
    }, new Date());
  }, [events, anniversaries, coupleSettings, ownProfile, partner]);

  const toggle = useCallback(
    async (key: string, marked: boolean) => {
      if (!isOnline()) {
        setError(offlineMessage('Reminders'));
        return;
      }
      setError(null);
      setSaving((current) => new Set(current).add(key));
      try {
        await setCountdownMark(key, marked);
      } catch (caught) {
        console.error('[CountdownMarks] Could not save the reminder:', caught);
        setError(caught instanceof Error ? caught.message : 'Could not save your reminder.');
      } finally {
        setSaving((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [setCountdownMark]
  );

  const toggleReminders = useCallback(
    async (next: boolean) => {
      if (!isOnline()) {
        setError(offlineMessage('Reminders'));
        return;
      }
      setError(null);
      setSavingReminders(true);
      try {
        await setPushPreference('dateReminders', next);
      } catch (caught) {
        console.error('[CountdownMarks] Could not save the date reminders switch:', caught);
        setError(caught instanceof Error ? caught.message : 'Could not save your reminders.');
      } finally {
        setSavingReminders(false);
      }
    },
    [setPushPreference]
  );

  return (
    <>
      <div className={CARD} data-testid="settings-reminder-marks">
        <h3 className={`${GROUP_TITLE} px-1`}>Reminders</h3>
        <SwitchRow
          id="settings-reminders-switch"
          icon={Bell}
          label="Date reminders"
          helper={REMINDERS_HELPER}
          checked={pushPreferences?.dateReminders ?? true}
          onChange={(next) => void toggleReminders(next)}
          disabled={pushPreferences === null || savingReminders}
        />
        {entries.length === 0 ? (
          <p className={`${GROUP_SUBTITLE} px-1`} data-testid="settings-reminder-marks-empty">
            Dates you add show up here.
          </p>
        ) : (
          entries.map((entry) => (
            <Fragment key={entry.key}>
              <div className={DIVIDER} aria-hidden="true" />
              <SwitchRow
                id={`settings-reminder-mark-${entry.key}`}
                icon={iconFor(entry.key)}
                label={entry.name}
                helper={HELPER}
                checked={marks?.includes(entry.key) ?? false}
                onChange={(next) => void toggle(entry.key, next)}
                disabled={marks === null || saving.has(entry.key)}
              />
            </Fragment>
          ))
        )}
      </div>
      {error && (
        <p className={FIELD_ERROR} role="alert" data-testid="settings-reminder-marks-error">
          {error}
        </p>
      )}
    </>
  );
}

/** Renders nothing off the native shell or without the local-notifications plugin. */
export function CountdownMarks() {
  if (!hasNativeReminders()) return null;
  return <CountdownMarksCard />;
}
