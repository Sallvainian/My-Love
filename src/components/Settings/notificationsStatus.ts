/**
 * notificationsStatus -- what the Notifications page and its top-page row
 * share: iOS's notification permission, read again each time the app is
 * shown (`usePushPermission`), and the row's one-word value
 * (`notificationsSummary`). Kept out of `NotificationsPage.tsx` so that file
 * exports only components (react-refresh).
 */

import { useEffect, useState } from 'react';
import { getPushPermission, type PushPermission } from '../../services/pushNotifications';
import type { PushPreferenceKey, PushPreferences } from '../../services/pushPreferencesService';

/** The six push switches under "Notify me about", in the order the page shows them. */
export const PUSH_SWITCH_KEYS: readonly PushPreferenceKey[] = [
  'loveNotes',
  'moods',
  'photos',
  'pokesAndKisses',
  'dates',
  'partnerRequests',
];

/**
 * The last permission any read answered. `SettingsStack` remounts the top page
 * on every return, so a hook that began at `null` would leave the Notifications
 * row without a value until the next read answered.
 */
let lastPermission: PushPermission | null = null;

/** Forgets the last permission read, so each test starts as a fresh launch does. */
export function resetPushPermissionForTests(): void {
  lastPermission = null;
}

/**
 * iOS's notification permission: the last one read (`null` before the first
 * read), read again on mount and each time the app is shown. Cancelled on
 * unmount, so a late answer sets nothing.
 */
export function usePushPermission(): PushPermission | null {
  const [permission, setPermission] = useState<PushPermission | null>(lastPermission);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void getPushPermission().then((next) => {
        lastPermission = next;
        if (!cancelled) setPermission(next);
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

  return permission;
}

/**
 * The top page row's value: `Off` when iOS has the permission denied, else
 * `On` / `Off` / `Some` over the five push switches, plus Date reminders where
 * `withReminders` (a missing plugin hides that switch, so it must not count).
 * `undefined` while the switches or the permission are not known yet, so the
 * value never flashes `On` before turning `Off`.
 */
export function notificationsSummary(
  preferences: PushPreferences | null,
  permission: PushPermission | null,
  withReminders: boolean
): 'On' | 'Off' | 'Some' | undefined {
  if (permission === 'denied') return 'Off';
  if (preferences === null || permission === null) return undefined;
  const keys = withReminders ? [...PUSH_SWITCH_KEYS, 'dateReminders' as const] : PUSH_SWITCH_KEYS;
  const on = keys.filter((key) => preferences[key]).length;
  if (on === keys.length) return 'On';
  return on === 0 ? 'Off' : 'Some';
}
