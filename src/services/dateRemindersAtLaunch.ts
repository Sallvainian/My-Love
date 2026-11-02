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
import { readStoredSession } from '../api/authStorage';
import { isOnline } from '../api/errorHandlers';
import { supabase } from '../api/supabaseClient';
import { onLocalCopyWritten, refreshLocalCopy } from './localCopy';

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
 * the wipe this rule forbids. The one exception is a push switches copy with
 * `dateReminders` off (DW-392): off plans nothing whatever the dates are, so
 * the pending reminders are cancelled without the other six copies. It never
 * loads anything from the server itself: it reads only saved copies.
 *
 * Single-flight: while a re-plan runs, any number of further requests collapse
 * into one more run after it. The native calls themselves run in
 * `dateReminders.ts`'s serial chain, so a sign-out cancel never interleaves.
 *
 * Triggers: the signed-in start (`scheduleDateRemindersAtLaunch`), the push
 * permission answer (App), `startDateReminderTriggers()`'s foreground return
 * (`visibilitychange` to visible), a token renewal (`TOKEN_REFRESHED`) and
 * every successful write of a date kind's copy, the marks and push switches
 * copies included, for the signed-in user. The write hook fires after the copy
 * lands, so the re-plan reads the new value; a store subscription would fire
 * before it.
 *
 * Refreshing the copies (DW-389, DW-400): a foreground return re-plans from
 * the saved copies at once, then, while online, refreshes the seven date
 * copies through `refreshLocalCopy` and re-plans again. A `TOKEN_REFRESHED` for
 * the signed-in user does the same refresh and re-plan. Both are throttled to
 * one refresh per `DATE_COPY_REFRESH_INTERVAL_MS` for one identity, so a date
 * changed on another device reaches a resumed phone without a restart. A
 * foreground return whose stored token is expired or within auth-js's 90 s
 * renewal margin re-plans only: the reads would fail and burn the throttle, so
 * the `TOKEN_REFRESHED` that the renewal emits does the refresh. The
 * launch plan runs at once from the saved copies and again once the launch
 * refresh settles, so one stalled refresher never holds it.
 *
 * Like `pushNotifications.ts`, it is a no-op on the web and in a shell without
 * the plugin: no plugin call, no IndexedDB read, no listener. It never throws.
 */

/** The shortest gap between two date-copy refreshes raised by a foreground return or a token renewal. */
export const DATE_COPY_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * How close to expiry auth-js renews an access token (`EXPIRY_MARGIN_MS` in
 * `@supabase/auth-js/lib/constants`: 3 auto-refresh ticks of 30 s). Inside it,
 * every `getSession()` first tries a renewal and reports no session if that
 * fails, so the date-copy reads would fail too.
 */
const TOKEN_RENEWAL_MARGIN_MS = 90_000;

/**
 * Whether the stored access token is expired or inside auth-js's renewal
 * margin. `expires_at` is in seconds and relative to the device clock. No
 * stored session, or one without `expires_at`, does not need renewal.
 */
function storedTokenNeedsRenewal(): boolean {
  const expiresAt = readStoredSession()?.expires_at;
  return typeof expiresAt === 'number' && expiresAt * 1000 - Date.now() < TOKEN_RENEWAL_MARGIN_MS;
}

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
    // The switch off is a complete answer: cancel everything pending without
    // waiting for the date copies, which an off switch would not plan anyway.
    if (prefs && !prefs.dateReminders) {
      await scheduleDateReminders([], () => isCurrent(owner));
      return;
    }
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
 * The signed-in start's trigger: re-plans at once from the saved copies, then,
 * when `refreshed` (the launch refresh) is given, once more after it settles.
 * `owner` is the start's identity; a step does nothing once the store's
 * identity differs.
 */
export async function scheduleDateRemindersAtLaunch(
  owner: LaunchOwner,
  refreshed?: Promise<unknown>
): Promise<void> {
  if (!hasNativeReminders()) return;
  if (!isCurrent(owner)) return;
  await replanDateReminders(owner);
  if (!refreshed) return;
  try {
    await refreshed;
  } catch {
    // The refresh failed; the saved copies are what there is to plan from.
  }
  await replanDateReminders(owner);
}

/**
 * Wires the foreground, token-renewal and date-copy-write triggers and returns
 * the function that stops them. Does nothing, and returns a no-op, on the web
 * or in a shell without the plugin.
 */
export function startDateReminderTriggers(): () => void {
  if (!hasNativeReminders()) return () => {};

  // The identity and time of the last refresh this closure started. Each start
  // begins unthrottled.
  let lastRefresh: (LaunchOwner & { at: number }) | null = null;

  /**
   * Refreshes the seven date copies and re-plans for the identity that began
   * the refresh. Does nothing when signed out, offline, or within the interval
   * of the last refresh for the same identity.
   */
  const refreshDateCopies = async (): Promise<void> => {
    const { userId, authSessionVersion } = useAppStore.getState();
    if (userId === null || !isOnline()) return;
    const owner: LaunchOwner = { userId, authSessionVersion };
    const now = Date.now();
    if (
      lastRefresh &&
      lastRefresh.userId === userId &&
      lastRefresh.authSessionVersion === authSessionVersion &&
      // A negative gap (the device clock moved back) counts as elapsed.
      now - lastRefresh.at >= 0 &&
      now - lastRefresh.at < DATE_COPY_REFRESH_INTERVAL_MS
    ) {
      return;
    }
    lastRefresh = { ...owner, at: now };
    await Promise.all(Array.from(DATE_COPY_KINDS, (kind) => refreshLocalCopy(kind)));
    // Covers a refresh that wrote nothing; a write already raised its own re-plan.
    await replanDateReminders(owner);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    void replanDateReminders();
    // A token that needs renewal makes every read fail and would burn the
    // throttle window; auth-js renews on its own foreground handler, and the
    // TOKEN_REFRESHED that follows does the refresh.
    if (!storedTokenNeedsRenewal()) void refreshDateCopies();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const stopCopyTrigger = onLocalCopyWritten((userId, kind) => {
    // A copy written for another account, or a kind that holds no date, plans nothing.
    if (!DATE_COPY_KINDS.has(kind) || useAppStore.getState().userId !== userId) return;
    void replanDateReminders();
  });

  // Kept synchronous: auth-js awaits its listeners, and a nested auth call from
  // inside one can deadlock (see useRealtimeMessages), and the refreshers make
  // authenticated requests, so the work runs on the next task.
  let renewalTimer: ReturnType<typeof setTimeout> | null = null;
  const {
    data: { subscription: authSubscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'TOKEN_REFRESHED' || session?.user?.id !== useAppStore.getState().userId) return;
    if (renewalTimer !== null) clearTimeout(renewalTimer);
    renewalTimer = setTimeout(() => {
      renewalTimer = null;
      void refreshDateCopies();
    }, 0);
  });

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    stopCopyTrigger();
    authSubscription.unsubscribe();
    if (renewalTimer !== null) clearTimeout(renewalTimer);
    renewalTimer = null;
  };
}
