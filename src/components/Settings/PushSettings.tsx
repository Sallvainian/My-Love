/**
 * PushSettings — "Push and reminders": a switch for each kind of push, in the
 * native iOS shell only, and below them the "Reminders" group (`CountdownMarks`)
 * that marks dates for the earlier month and week reminders.
 *
 * The website, the Home Screen web app and a shell installed before the push
 * plugins existed render nothing and fetch nothing (`hasNativePush()`). The
 * switches are the account's `push_preferences` row, loaded when the section
 * opens (`settingsSlice.loadPushPreferences`) and written one column at a
 * time, server first (`setPushPreference`). The sender reads the receiver's
 * switch, so a switch off here stops that kind on every one of the person's
 * devices.
 *
 * When iOS reports the notification permission denied, a notice opens the
 * section; the rows stay usable, because the switches are the account's and
 * outlive the iOS setting. The permission is read again when the app comes
 * back to the foreground, since the person turns it on in iOS Settings.
 *
 * @component
 */

import {
  CalendarHeart,
  Hand,
  Image as ImageIcon,
  MessageCircleHeart,
  Smile,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
import { getPushPermission, hasNativePush } from '../../services/pushNotifications';
import type { PushPreferenceKey } from '../../services/pushPreferencesService';
import { useAppStore } from '../../stores/useAppStore';
import {
  CARD,
  DIVIDER,
  FIELD_ERROR,
  GROUP_TITLE,
  NOTICE,
  SECTION_LABEL,
} from '../shared/kitClasses';
import { CountdownMarks } from './CountdownMarks';
import { SwitchRow } from './SwitchRow';

interface PushRow {
  key: PushPreferenceKey;
  /** The row's test id suffix: `settings-push-<testId>`. */
  testId: string;
  icon: LucideIcon;
  label: string;
  helper: string;
}

/** In the order Settings shows them. */
const ROWS: readonly PushRow[] = [
  {
    key: 'loveNotes',
    testId: 'love-notes',
    icon: MessageCircleHeart,
    label: 'Love notes',
    helper: 'When your partner sends a note.',
  },
  {
    key: 'moods',
    testId: 'moods',
    icon: Smile,
    label: 'Moods',
    helper: 'When your partner logs a mood.',
  },
  {
    key: 'photos',
    testId: 'photos',
    icon: ImageIcon,
    label: 'Photos',
    helper: 'When your partner adds a photo.',
  },
  {
    key: 'pokesAndKisses',
    testId: 'pokes-and-kisses',
    icon: Hand,
    label: 'Pokes and kisses',
    helper: 'When your partner sends a poke or a kiss.',
  },
  {
    key: 'dates',
    testId: 'dates',
    icon: CalendarHeart,
    label: 'Dates',
    helper: 'When your partner adds or changes a date.',
  },
  {
    key: 'partnerRequests',
    testId: 'partner-requests',
    icon: UserPlus,
    label: 'Partner requests',
    helper: 'When someone asks to be your partner, or accepts your request.',
  },
];

const PERMISSION_OFF = 'Notifications are off for My Love. Turn them on in iOS Settings.';
const LOAD_FAILED = "Couldn't load your push settings.";

function PushSettingsSection() {
  const pushPreferences = useAppStore((state) => state.pushPreferences);
  const loadFailed = useAppStore((state) => state.pushPreferencesLoadFailed);
  const loadPushPreferences = useAppStore((state) => state.loadPushPreferences);
  const setPushPreference = useAppStore((state) => state.setPushPreference);

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Rows whose save is in flight: a second tap would compute from the stale state.
  const [saving, setSaving] = useState<ReadonlySet<PushPreferenceKey>>(new Set());

  // The switches, when the section opens and when the connection returns.
  useEffect(() => {
    void loadPushPreferences();
    const reload = () => void loadPushPreferences();
    window.addEventListener('online', reload);
    return () => window.removeEventListener('online', reload);
  }, [loadPushPreferences]);

  // The iOS permission, when the section opens and each time the app is shown again.
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void getPushPermission().then((permission) => {
        if (!cancelled) setPermissionDenied(permission === 'denied');
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const toggle = useCallback(
    async (key: PushPreferenceKey, enabled: boolean) => {
      if (!isOnline()) {
        setSaveError(offlineMessage('Push settings'));
        return;
      }
      setSaveError(null);
      setSaving((current) => new Set(current).add(key));
      try {
        await setPushPreference(key, enabled);
      } catch (error) {
        console.error('[PushSettings] Could not save the push setting:', error);
        setSaveError(error instanceof Error ? error.message : 'Could not save your push setting.');
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

  // Rows wait for the account's row: until it is loaded they show the default and cannot be toggled.
  const disabled = pushPreferences === null;

  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby="settings-push-label"
      data-testid="settings-push"
    >
      <h2 id="settings-push-label" className={SECTION_LABEL}>
        Push and reminders
      </h2>
      {permissionDenied && (
        <p className={NOTICE} data-testid="settings-push-permission-off">
          {PERMISSION_OFF}
        </p>
      )}
      <div className={CARD}>
        <h3 className={`${GROUP_TITLE} px-1`}>Pushes</h3>
        {ROWS.map((row, index) => (
          <Fragment key={row.key}>
            {index > 0 && <div className={DIVIDER} aria-hidden="true" />}
            <SwitchRow
              id={`settings-push-${row.testId}`}
              icon={row.icon}
              label={row.label}
              helper={row.helper}
              checked={pushPreferences?.[row.key] ?? true}
              onChange={(next) => void toggle(row.key, next)}
              disabled={disabled || saving.has(row.key)}
            />
          </Fragment>
        ))}
      </div>
      {disabled && !loadFailed && !isOnline() && (
        <p className={FIELD_ERROR} data-testid="settings-push-offline">
          {offlineMessage('Push settings', 'load')}
        </p>
      )}
      {loadFailed && (
        <p className={FIELD_ERROR} data-testid="settings-push-load-error">
          {LOAD_FAILED}
        </p>
      )}
      {saveError && (
        <p className={FIELD_ERROR} role="alert" data-testid="settings-push-error">
          {saveError}
        </p>
      )}
      <CountdownMarks />
    </section>
  );
}

/** Renders nothing off the native shell or without the push plugins. */
export function PushSettings() {
  if (!hasNativePush()) return null;
  return <PushSettingsSection />;
}
