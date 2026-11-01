import { readSavedEvents } from '../stores/slices/eventsSlice';
import { useAppStore } from '../stores/useAppStore';
import {
  hasNativeReminders,
  planDateReminders,
  scheduleDateReminders,
  type ReminderDates,
} from './dateReminders';

/** The signed-in start a launch step belongs to, captured when that start began. */
export interface LaunchOwner {
  userId: string;
  authSessionVersion: number;
}

/**
 * The launch trigger for date reminders (story 4.1): once the date copies have
 * loaded on a signed-in start, plan the reminders from them and replace the
 * shell's pending ones. Story 4.6 extends this with re-plans on foreground and
 * date change.
 *
 * It plans from the saved events copy, the dates the app last loaded, and never
 * calls `loadEvents`: Home loads events itself, and a second load would leave
 * Home's own load stale. The other kinds are in the store by now, because
 * `refreshLocalCopies()` resolves only after each refresher has applied its copy.
 *
 * Like `pushNotifications.ts`, it is a no-op on the web and in a shell without
 * the plugin: no plugin call, no IndexedDB read. It never throws. `owner` is the
 * start's identity; the step does nothing once the store's identity differs.
 */
export async function scheduleDateRemindersAtLaunch(owner: LaunchOwner): Promise<void> {
  if (!hasNativeReminders()) return;

  const { userId, authSessionVersion } = owner;
  const isCurrent = () => {
    const state = useAppStore.getState();
    return state.userId === userId && state.authSessionVersion === authSessionVersion;
  };
  // The start that raised this call may have been replaced while it waited.
  if (!isCurrent()) return;

  try {
    const events = (await readSavedEvents(userId)) ?? [];
    if (!isCurrent()) return;

    const { settings, coupleSettings, ownProfile, partner } = useAppStore.getState();
    const linked = coupleSettings?.status === 'linked' ? coupleSettings : null;
    const dates: ReminderDates = {
      events,
      anniversaries: settings?.relationship.anniversaries ?? [],
      relationshipStart: linked?.relationshipStart ?? null,
      weddingDate: linked?.weddingDate ?? null,
      ownBirthday: ownProfile ? { name: ownProfile.displayName, birthday: ownProfile.birthday } : null,
      partnerBirthday: partner ? { name: partner.displayName, birthday: partner.birthday } : null,
    };

    await scheduleDateReminders(planDateReminders(dates, new Date()), isCurrent);
  } catch (error) {
    console.error('[DateReminders] Could not plan the date reminders:', error);
  }
}
