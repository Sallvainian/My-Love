/**
 * NotificationsPage — Settings > Notifications (`/settings/notifications`):
 * a switch for each kind of push, and below them the "Reminders" group with
 * the Date reminders switch. The page is registered in `SUBPAGES` with
 * `available: hasNativePush`, so the website, the Home Screen web app and a
 * shell installed before the push plugins existed never reach it, and nothing
 * here reads `push_preferences` there.
 *
 * The switches are the account's `push_preferences` row, loaded when the page
 * opens (`notificationsSlice.loadPushPreferences`) and written one column at a
 * time, server first (`setPushPreference`). The sender reads the receiver's
 * switch, so a switch off here stops that kind on every one of the person's
 * devices. Date reminders is the row's `dateReminders` column: writing it
 * re-plans the shell's local reminders. Its group shows only with the
 * local-notifications plugin (`hasNativeReminders()`).
 *
 * When iOS reports the notification permission denied, a Notice opens the
 * page; the switches stay usable, because they belong to the account and
 * outlive the iOS setting. The permission is read again when the app comes
 * back to the foreground, since the person turns it on in iOS Settings
 * (`usePushPermission`, in `notificationsStatus.ts`). One Error box under the
 * bar shows an offline refusal or a failed save; the next tap of any switch
 * clears it.
 *
 * The top page's Notifications row (`NotificationsRow`) reads the same store
 * and permission, so its value follows a switch on return without a reload.
 * Each date's own Remind me switch is on its page (`RemindMe`).
 *
 * @component
 */

import {
  Bell,
  Hand,
  Image as ImageIcon,
  MessageCircleHeart,
  Smile,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
import { hasNativeReminders } from '../../services/dateReminders';
import type { PushPreferenceKey } from '../../services/pushPreferencesService';
import { useAppStore } from '../../stores/useAppStore';
import { FOOTNOTE, NOTICE } from '../shared/kitClasses';
import { notificationsSummary, usePushPermission } from './notificationsStatus';
import { SettingsGroup, SettingsRow } from './stack/SettingsRows';
import { SwitchRow } from './SwitchRow';
import { ErrorBox } from './ErrorBox';

interface PushRow {
  key: PushPreferenceKey;
  /** The row's test id suffix: `settings-push-<testId>`. */
  testId: string;
  icon: LucideIcon;
  label: string;
}

/** In the order Settings shows them. */
const ROWS: readonly PushRow[] = [
  { key: 'loveNotes', testId: 'love-notes', icon: MessageCircleHeart, label: 'Love notes' },
  { key: 'moods', testId: 'moods', icon: Smile, label: 'Moods' },
  { key: 'photos', testId: 'photos', icon: ImageIcon, label: 'Photos' },
  { key: 'pokesAndKisses', testId: 'pokes-and-kisses', icon: Hand, label: 'Pokes and kisses' },
  {
    key: 'partnerRequests',
    testId: 'partner-requests',
    icon: UserPlus,
    label: 'Partner requests',
  },
];

const PERMISSION_OFF = 'Notifications are off for My Love. Turn them on in iOS Settings.';
// Under the card like a Footnote: 8px from the group's gap, the 4px inset, no `mt-1`.
const LINE_ERROR = 'px-1 text-sm text-danger';
const LOAD_FAILED = "Couldn't load your push settings.";
const REMINDERS_FOOTNOTE =
  'At 9:00 the day before, and on the day for birthdays and anniversaries.';

/** The page body; `Settings` mounts it only where `hasNativePush()` is true. */
export function NotificationsPage() {
  const pushPreferences = useAppStore((state) => state.pushPreferences);
  const loadFailed = useAppStore((state) => state.pushPreferencesLoadFailed);
  const loadPushPreferences = useAppStore((state) => state.loadPushPreferences);
  const setPushPreference = useAppStore((state) => state.setPushPreference);
  const permission = usePushPermission();

  const [error, setError] = useState<string | null>(null);
  // Switches whose save is in flight: a second tap would compute from the stale state.
  const [saving, setSaving] = useState<ReadonlySet<PushPreferenceKey>>(new Set());

  // The switches, when the page opens and when the connection returns.
  useEffect(() => {
    void loadPushPreferences();
    const reload = () => void loadPushPreferences();
    window.addEventListener('online', reload);
    return () => window.removeEventListener('online', reload);
  }, [loadPushPreferences]);

  const toggle = useCallback(
    async (key: PushPreferenceKey, enabled: boolean) => {
      const reminders = key === 'dateReminders';
      if (!isOnline()) {
        setError(offlineMessage(reminders ? 'Reminders' : 'Push settings'));
        return;
      }
      setError(null);
      setSaving((current) => new Set(current).add(key));
      try {
        await setPushPreference(key, enabled);
      } catch (caught) {
        console.error(
          reminders
            ? '[NotificationsPage] Could not save the date reminders switch:'
            : '[NotificationsPage] Could not save the push setting:',
          caught
        );
        setError(
          caught instanceof Error
            ? caught.message
            : reminders
              ? 'Could not save your reminders.'
              : 'Could not save your push setting.'
        );
      } finally {
        setSaving((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [setPushPreference]
  );

  // Switches wait for the account's row: until the saved copy or the server has answered they
  // show the default and cannot be toggled.
  const disabled = pushPreferences === null;
  const offlineLoad = disabled && !loadFailed && !isOnline();

  return (
    <div className="flex flex-col gap-4" data-testid="settings-notifications">
      {error && <ErrorBox message={error} testId="settings-notifications-error" />}
      {permission === 'denied' && (
        <p className={NOTICE} data-testid="settings-push-permission-off">
          {PERMISSION_OFF}
        </p>
      )}
      <SettingsGroup
        label="Notify me about"
        footnote={
          <>
            {offlineLoad && (
              <p className={LINE_ERROR} data-testid="settings-push-offline">
                {offlineMessage('Push settings', 'load')}
              </p>
            )}
            {loadFailed && (
              <p className={LINE_ERROR} data-testid="settings-push-load-error">
                {LOAD_FAILED}
              </p>
            )}
          </>
        }
      >
        {ROWS.map((row) => (
          <SwitchRow
            key={row.key}
            id={`settings-push-${row.testId}`}
            icon={row.icon}
            label={row.label}
            checked={pushPreferences?.[row.key] ?? true}
            onChange={(next) => void toggle(row.key, next)}
            disabled={disabled || saving.has(row.key)}
          />
        ))}
      </SettingsGroup>
      {hasNativeReminders() && (
        <SettingsGroup
          label="Reminders"
          footnote={
            <p className={FOOTNOTE} data-testid="settings-reminders-footnote">
              {REMINDERS_FOOTNOTE}
            </p>
          }
        >
          <SwitchRow
            key="dateReminders"
            id="settings-reminders-switch"
            icon={Bell}
            label="Date reminders"
            checked={pushPreferences?.dateReminders ?? true}
            onChange={(next) => void toggle('dateReminders', next)}
            disabled={disabled || saving.has('dateReminders')}
          />
        </SettingsGroup>
      )}
    </div>
  );
}

/**
 * The Preferences row that opens the page, with the state in a word. It loads
 * the switches itself (the page may not have been opened yet), on mount and
 * when the connection returns. `Settings` renders it only where
 * `hasNativePush()` is true.
 */
export function NotificationsRow() {
  const pushPreferences = useAppStore((state) => state.pushPreferences);
  const loadPushPreferences = useAppStore((state) => state.loadPushPreferences);
  const permission = usePushPermission();

  useEffect(() => {
    void loadPushPreferences();
    const reload = () => void loadPushPreferences();
    window.addEventListener('online', reload);
    return () => window.removeEventListener('online', reload);
  }, [loadPushPreferences]);

  return (
    <SettingsRow
      icon={Bell}
      label="Notifications"
      value={notificationsSummary(pushPreferences, permission, hasNativeReminders())}
      target="notifications"
      testId="settings-notifications-row"
    />
  );
}
