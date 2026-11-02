import {
  ANNIVERSARIES_COPY_KIND,
  COUNTDOWN_MARKS_COPY_KIND,
  COUPLE_SETTINGS_COPY_KIND,
  PROFILE_COPY_KIND,
  PUSH_PREFERENCES_COPY_KIND,
  readSavedAnniversaries,
  readSavedCountdownMarks,
  readSavedCoupleSettings,
  readSavedOwnProfile,
  readSavedPushPreferences,
} from '../stores/slices/settingsSlice';
import { EVENTS_COPY_KIND, readSavedEvents } from '../stores/slices/eventsSlice';
import { PARTNER_COPY_KIND, readSavedPartner } from '../stores/slices/partnerSlice';
import { useAppStore } from '../stores/useAppStore';
import {
  hasNativeReminders,
  planDateReminders,
  scheduleDateReminders,
  type ReminderDates,
} from './dateReminders';
import { onLocalCopyWritten } from './localCopy';

/** The signed-in start a launch step belongs to, captured when that start began. */
export interface LaunchOwner {
  userId: string;
  authSessionVersion: number;
}

/**
 * The date reminders' re-plan and its triggers (stories 4.1, 4.2, 4.3 and 4.6).
 *
 * `replanDateReminders()` plans from the saved local copies of all five date
 * kinds (`events`, `anniversaries`, `couple-settings`, `profile`, `partner`),
 * the marks copy (`countdown-marks`, the dates marked for the month and
 * week reminders) and the push switches copy (`push-preferences`, whose
 * `dateReminders` is the Settings switch: off plans nothing, so the pending
 * reminders are cancelled), and replaces the shell's pending reminders. It
 * never reads the store's copy of a date, because the store cannot tell "not loaded" apart
 * for these kinds: the anniversaries start as `[]` and the partner is `null`
 * both when unlinked and before it has loaded. A copy exists only after a
 * server answer or a confirmed write, so a copy is a loaded value (an empty
 * marks list is a loaded "no marks"). If any of the seven reads `null` (absent,
 * failed or malformed) the whole re-plan is skipped and the pending list
 * stays: planning the other kinds would cancel that kind's reminders, which is
 * the wipe this rule forbids. It never loads anything from the server.
 *
 * Single-flight: while a re-plan runs, any number of further requests collapse
 * into one more run after it. The native calls themselves run in
 * `dateReminders.ts`'s serial chain, so a sign-out cancel never interleaves.
 *
 * Triggers: the signed-in start (`scheduleDateRemindersAtLaunch`), the push
 * permission answer (App), `startDateReminderTriggers()`'s foreground return
 * (`visibilitychange` to visible) and every successful write of a date kind's
 * copy, the marks and push switches copies included, for the signed-in user.
 * The write hook fires after the copy lands, so the re-plan reads the new value; a store
 * subscription would fire before it.
 *
 * Like `pushNotifications.ts`, it is a no-op on the web and in a shell without
 * the plugin: no plugin call, no IndexedDB read, no listener. It never throws.
 */

const DATE_COPY_KINDS: ReadonlySet<string> = new Set([
  EVENTS_COPY_KIND,
  ANNIVERSARIES_COPY_KIND,
  COUPLE_SETTINGS_COPY_KIND,
  PROFILE_COPY_KIND,
  PARTNER_COPY_KIND,
  COUNTDOWN_MARKS_COPY_KIND,
  PUSH_PREFERENCES_COPY_KIND,
]);

function isCurrent({ userId, authSessionVersion }: LaunchOwner): boolean {
  const state = useAppStore.getState();
  return state.userId === userId && state.authSessionVersion === authSessionVersion;
}

/** One re-plan for `owner`. Never rejects. */
async function planOnce(owner: LaunchOwner): Promise<void> {
  // The request may have been replaced while it waited.
  if (!isCurrent(owner)) return;

  try {
    const { userId } = owner;
    const [events, anniversaries, coupleSettings, ownProfile, partner, marks, prefs] = await Promise.all([
      readSavedEvents(userId),
      readSavedAnniversaries(userId),
      readSavedCoupleSettings(userId),
      readSavedOwnProfile(userId),
      readSavedPartner(userId),
      readSavedCountdownMarks(userId),
      readSavedPushPreferences(userId),
    ]);
    if (!isCurrent(owner)) return;
    // A copy that is missing is not yet loaded: keep whatever is pending.
    if (!events || !anniversaries || !coupleSettings || !ownProfile || !partner || !marks || !prefs) return;

    const linked = coupleSettings.status === 'linked' ? coupleSettings : null;
    const dates: ReminderDates = {
      events,
      anniversaries,
      relationshipStart: linked?.relationshipStart ?? null,
      weddingDate: linked?.weddingDate ?? null,
      ownBirthday: { name: ownProfile.displayName, birthday: ownProfile.birthday },
      partnerBirthday:
        partner.status === 'linked'
          ? { name: partner.partner.displayName, birthday: partner.partner.birthday }
          : null,
      marks: new Set(marks),
      remindersOn: prefs.dateReminders,
    };

    await scheduleDateReminders(planDateReminders(dates, new Date()), () => isCurrent(owner));
  } catch (error) {
    console.error('[DateReminders] Could not plan the date reminders:', error);
  }
}

let running: Promise<void> | null = null;
let waiting: { owner: LaunchOwner; done: Promise<void> } | null = null;

function startRun(owner: LaunchOwner): Promise<void> {
  const run: Promise<void> = planOnce(owner).finally(() => {
    if (running === run) running = null;
  });
  running = run;
  return run;
}

/**
 * Re-plans the date reminders from the saved copies, for `owner` (default: the
 * identity the store is on now; nothing when signed out). Resolves when the run
 * that covers this request has finished. Does nothing on the web or in a shell
 * without the plugin. Never rejects.
 */
export function replanDateReminders(owner?: LaunchOwner): Promise<void> {
  if (!hasNativeReminders()) return Promise.resolve();
  // A request raised for a start that has since been replaced must not take
  // over the queued follow-up, which may be the current account's.
  if (owner && !isCurrent(owner)) return Promise.resolve();
  const { userId, authSessionVersion } = useAppStore.getState();
  const who = owner ?? (userId === null ? null : { userId, authSessionVersion });
  if (!who) return Promise.resolve();

  if (waiting) {
    waiting.owner = who;
    return waiting.done;
  }
  if (running === null) return startRun(who);

  const slot: { owner: LaunchOwner; done: Promise<void> } = { owner: who, done: Promise.resolve() };
  slot.done = running.then(() => {
    waiting = null;
    return startRun(slot.owner);
  });
  waiting = slot;
  return slot.done;
}

/**
 * The signed-in start's trigger: re-plans once the date copies have loaded.
 * `owner` is the start's identity; the step does nothing once the store's
 * identity differs.
 */
export async function scheduleDateRemindersAtLaunch(owner: LaunchOwner): Promise<void> {
  if (!hasNativeReminders()) return;
  if (!isCurrent(owner)) return;
  await replanDateReminders(owner);
}

/**
 * Wires the foreground and date-copy-write triggers and returns the function
 * that stops them. Does nothing, and returns a no-op, on the web or in a shell
 * without the plugin.
 */
export function startDateReminderTriggers(): () => void {
  if (!hasNativeReminders()) return () => {};

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void replanDateReminders();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const stopCopyTrigger = onLocalCopyWritten((userId, kind) => {
    // A copy written for another account, or a kind that holds no date, plans nothing.
    if (!DATE_COPY_KINDS.has(kind) || useAppStore.getState().userId !== userId) return;
    void replanDateReminders();
  });

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    stopCopyTrigger();
  };
}
