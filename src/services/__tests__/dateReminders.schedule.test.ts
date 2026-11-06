import { beforeEach, describe, expect, it, vi } from 'vitest';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  isPluginAvailable: vi.fn((_name: string) => true),
}));

const tapListeners = vi.hoisted(() => ({
  // The `localNotificationActionPerformed` callback the code under test registered.
  current: null as ((action: { actionId: string }) => void) | null,
}));

const localNotifications = vi.hoisted(() => ({
  getPending: vi.fn(() => Promise.resolve({ notifications: [] as { id: number }[] })),
  cancel: vi.fn((_options: unknown) => Promise.resolve()),
  checkPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
  requestPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
  schedule: vi.fn((_options: unknown) => Promise.resolve({ notifications: [] })),
  addListener: vi.fn((_event: string, listener: (action: { actionId: string }) => void) => {
    tapListeners.current = listener;
    return Promise.resolve({ remove: () => Promise.resolve() });
  }),
}));

// pushNotifications (the tap fan-out) loads these too.
vi.mock('@capacitor/core', () => ({ Capacitor: capacitor, registerPlugin: vi.fn(() => ({})) }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: localNotifications }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }));
vi.mock('../../api/supabaseClient', () => ({ supabase: {} }));

import {
  MAX_SCHEDULED_REMINDERS,
  REMINDER_SOUND,
  REMINDER_THREAD_ID,
  cancelDateReminders,
  hasNativeReminders,
  scheduleDateReminders,
} from '../dateReminders';
import { plan } from './dateRemindersKit';

describe('hasNativeReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
  });

  it('is true on a native shell with the plugin', () => {
    expect(hasNativeReminders()).toBe(true);
    expect(capacitor.isPluginAvailable).toHaveBeenCalledWith('LocalNotifications');
  });

  it('is false on the web', () => {
    capacitor.isNativePlatform.mockReturnValue(false);

    expect(hasNativeReminders()).toBe(false);
  });

  it('is false in a shell without the plugin', () => {
    capacitor.isPluginAvailable.mockImplementation((name) => name !== 'LocalNotifications');

    expect(hasNativeReminders()).toBe(false);
  });
});

/** Every id a date reminder can hold: the ids each cancel covers. */
const allIds = Array.from({ length: MAX_SCHEDULED_REMINDERS }, (_, i) => ({ id: i + 1 }));

describe('scheduleDateReminders', () => {
  const reminders = plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-06' }] });

  beforeEach(() => {
    vi.clearAllMocks();
    localNotifications.getPending.mockResolvedValue({ notifications: [] });
    localNotifications.cancel.mockResolvedValue(undefined);
    localNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
    localNotifications.schedule.mockResolvedValue({ notifications: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('cancels every reminder id and any other pending one, then schedules the list numbered from 1', async () => {
    localNotifications.getPending.mockResolvedValue({
      notifications: [{ id: 7 }, { id: 9 }, { id: 65 }],
    });
    const order: string[] = [];
    localNotifications.cancel.mockImplementation(() => {
      order.push('cancel');
      return Promise.resolve();
    });
    localNotifications.schedule.mockImplementation(() => {
      order.push('schedule');
      return Promise.resolve({ notifications: [] });
    });

    await scheduleDateReminders(reminders, () => true);

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: [...allIds, { id: 65 }] });
    expect(localNotifications.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          id: 1,
          title: 'Tomorrow: Dinner',
          body: '',
          threadIdentifier: 'partner-activity',
          sound: 'default',
          schedule: { on: { year: 2026, month: 11, day: 5, hour: 9, minute: 0 } },
        },
        {
          id: 2,
          title: 'Today: Dinner',
          body: '',
          threadIdentifier: 'partner-activity',
          sound: 'default',
          schedule: { on: { year: 2026, month: 11, day: 6, hour: 9, minute: 0 } },
        },
      ],
    });
    expect(order).toEqual(['cancel', 'schedule']);
  });

  it('cancels every reminder id even when nothing is pending', async () => {
    await scheduleDateReminders(reminders, () => true);

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: allIds });
    expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  it('cancels a fresh schedule the pending list has not caught up with yet', async () => {
    // `schedule` resolves before iOS's add completes, so the next run's
    // `getPending` may list only part of it: id 2 must go anyway.
    await scheduleDateReminders(reminders, () => true);
    expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });

    await scheduleDateReminders([], () => true);

    expect(localNotifications.cancel).toHaveBeenLastCalledWith({ notifications: allIds });
    expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  it.each(['prompt', 'prompt-with-rationale', 'denied'])(
    'cancels pending reminders but schedules nothing and never prompts when permission is %s',
    async (display) => {
      localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });
      localNotifications.checkPermissions.mockResolvedValue({ display });

      await scheduleDateReminders(reminders, () => true);

      expect(localNotifications.cancel).toHaveBeenCalledTimes(1);
      expect(localNotifications.schedule).not.toHaveBeenCalled();
      expect(localNotifications.requestPermissions).not.toHaveBeenCalled();
    }
  );

  it('cancels but does not schedule an empty plan', async () => {
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });

    await scheduleDateReminders([], () => true);

    expect(localNotifications.cancel).toHaveBeenCalledTimes(1);
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('makes no plugin call when the identity is already stale', async () => {
    await scheduleDateReminders(reminders, () => false);

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.checkPermissions).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it.each([
    ['getPending', 1, ['getPending']],
    ['cancel', 2, ['getPending', 'cancel']],
    ['checkPermissions', 3, ['getPending', 'cancel', 'checkPermissions']],
  ])('stops after %s when the identity changes during it', async (_name, currentCalls, called) => {
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });
    let calls = 0;
    const isCurrent = () => ++calls <= currentCalls;

    await scheduleDateReminders(reminders, isCurrent);

    const seen = (
      [
        ['getPending', localNotifications.getPending],
        ['cancel', localNotifications.cancel],
        ['checkPermissions', localNotifications.checkPermissions],
      ] as const
    )
      .filter(([, fn]) => fn.mock.calls.length > 0)
      .map(([name]) => name);
    expect(seen).toEqual(called);
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('logs a rejecting plugin call instead of throwing', async () => {
    const failure = new Error('boom');
    localNotifications.getPending.mockRejectedValue(failure);

    await expect(scheduleDateReminders(reminders, () => true)).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      '[DateReminders] Could not schedule the date reminders:',
      failure
    );
    // Unlike cancelDateReminders, a re-plan that cannot read the pending list
    // stops before cancelling anything.
    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('logs a rejecting schedule instead of throwing', async () => {
    const failure = new Error('boom');
    localNotifications.schedule.mockRejectedValue(failure);

    await expect(scheduleDateReminders(reminders, () => true)).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      '[DateReminders] Could not schedule the date reminders:',
      failure
    );
  });

  it('asks for the default notification sound on every scheduled reminder', async () => {
    // The plugin drops an empty or missing sound (silent on iOS); a name with
    // no bundled file of that name plays the default sound.
    const several = plan({
      anniversaries: [{ label: 'Dinner', date: '2020-11-06' }],
      events: [{ label: 'Trip', date: new Date(2026, 10, 9) }],
    });
    expect(several.length).toBeGreaterThan(1);

    await scheduleDateReminders(several, () => true);

    const [options] = localNotifications.schedule.mock.calls[0] as [
      { notifications: { sound?: string }[] },
    ];
    expect(options.notifications).toHaveLength(several.length);
    expect(options.notifications.map((n) => n.sound)).toEqual(several.map(() => 'default'));
    expect(REMINDER_SOUND).toBe('default');
  });
});

describe('scheduleDateReminders thread id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localNotifications.getPending.mockResolvedValue({ notifications: [] });
    localNotifications.cancel.mockResolvedValue(undefined);
    localNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
    localNotifications.schedule.mockResolvedValue({ notifications: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('stamps every scheduled reminder with thread id partner-activity', async () => {
    const reminders = plan({
      anniversaries: [{ label: 'Dinner', date: '2020-11-06' }],
      events: [{ label: 'Trip', date: new Date(2026, 10, 9) }],
    });
    expect(reminders.length).toBeGreaterThan(1);

    await scheduleDateReminders(reminders, () => true);

    const [options] = localNotifications.schedule.mock.calls[0] as [
      { notifications: { threadIdentifier?: string }[] },
    ];
    expect(options.notifications).toHaveLength(reminders.length);
    expect(options.notifications.map((n) => n.threadIdentifier)).toEqual(
      reminders.map(() => 'partner-activity')
    );
    expect(REMINDER_THREAD_ID).toBe('partner-activity');
  });
});

describe('cancelDateReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    localNotifications.getPending.mockResolvedValue({ notifications: [] });
    localNotifications.cancel.mockResolvedValue(undefined);
    localNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
    localNotifications.schedule.mockResolvedValue({ notifications: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it.each([
    ['on the web', () => capacitor.isNativePlatform.mockReturnValue(false)],
    [
      'in a shell without the plugin',
      () => capacitor.isPluginAvailable.mockImplementation((name) => name !== 'LocalNotifications'),
    ],
  ])('does nothing %s', async (_name, arrange) => {
    arrange();

    await cancelDateReminders();

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.cancel).not.toHaveBeenCalled();
  });

  it('cancels ids 1..64 when nothing is pending', async () => {
    await cancelDateReminders();

    expect(localNotifications.cancel).toHaveBeenCalledTimes(1);
    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: allIds });
  });

  it('cancels the union of ids 1..64 and every pending id', async () => {
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 7 }, { id: 65 }, { id: 900 }] });

    await cancelDateReminders();

    expect(localNotifications.cancel).toHaveBeenCalledWith({
      notifications: [...allIds, { id: 65 }, { id: 900 }],
    });
  });

  it('still cancels ids 1..64 when the pending list cannot be read, and logs it', async () => {
    const failure = new Error('boom');
    localNotifications.getPending.mockRejectedValue(failure);

    await expect(cancelDateReminders()).resolves.toBeUndefined();

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: allIds });
    expect(console.error).toHaveBeenCalledWith(
      '[DateReminders] Could not list the pending date reminders:',
      failure
    );
  });

  it('logs a rejected cancel instead of throwing', async () => {
    localNotifications.cancel.mockRejectedValue(new Error('boom'));

    await expect(cancelDateReminders()).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      '[DateReminders] Could not cancel the date reminders:',
      expect.any(Error)
    );
  });

  it('runs after a schedule that is in flight, not between its calls', async () => {
    const order: string[] = [];
    let finishSchedule: () => void = () => {};
    localNotifications.schedule.mockImplementation(() => {
      order.push('schedule:start');
      return new Promise((resolve) => {
        finishSchedule = () => {
          order.push('schedule:end');
          resolve({ notifications: [] });
        };
      });
    });
    localNotifications.cancel.mockImplementation(() => {
      order.push('cancel');
      return Promise.resolve();
    });
    const reminders = plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-06' }] });

    // The schedule's own cancel comes first; the sign-out cancel must wait for the schedule.
    const scheduled = scheduleDateReminders(reminders, () => true);
    await vi.waitFor(() => expect(order).toEqual(['cancel', 'schedule:start']));
    // Attached before the cancel is queued, so it runs before the cancel's turn.
    let scheduleSettled = false;
    void scheduled.then(() => {
      scheduleSettled = true;
    });
    // The cancel's first call: one made before the schedule settled ran between its calls.
    localNotifications.getPending.mockImplementation(() => {
      order.push(scheduleSettled ? 'getPending' : 'getPending:early');
      return Promise.resolve({ notifications: [] });
    });
    const cancelled = cancelDateReminders();
    expect(order).toEqual(['cancel', 'schedule:start']);

    finishSchedule();
    await Promise.all([scheduled, cancelled]);

    expect(order).toEqual(['cancel', 'schedule:start', 'schedule:end', 'getPending', 'cancel']);
  });

  it('keeps the chain going after a failed run', async () => {
    localNotifications.getPending.mockRejectedValueOnce(new Error('boom'));
    const reminders = plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-06' }] });

    await scheduleDateReminders(reminders, () => true);
    await cancelDateReminders();

    expect(localNotifications.cancel).toHaveBeenCalledTimes(1);
  });
});

describe('listenForReminderTaps', () => {
  // The listener and the held tap are module state: each case loads fresh modules.
  async function load() {
    vi.resetModules();
    const reminders = await import('../dateReminders');
    const push = await import('../pushNotifications');
    return { listenForReminderTaps: reminders.listenForReminderTaps, onPushTap: push.onPushTap };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tapListeners.current = null;
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    localNotifications.addListener.mockImplementation((_event, listener) => {
      tapListeners.current = listener;
      return Promise.resolve({ remove: () => Promise.resolve() });
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('routes a warm tap to Home for every onPushTap handler', async () => {
    const { listenForReminderTaps, onPushTap } = await load();
    const handler = vi.fn();
    onPushTap(handler);
    await listenForReminderTaps();

    expect(localNotifications.addListener).toHaveBeenCalledWith(
      'localNotificationActionPerformed',
      expect.any(Function)
    );
    tapListeners.current!({ actionId: 'tap' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('home');
  });

  it('holds a cold-start tap until a handler subscribes, then delivers it once', async () => {
    const { listenForReminderTaps, onPushTap } = await load();
    await listenForReminderTaps();

    tapListeners.current!({ actionId: 'tap' });
    const first = vi.fn();
    onPushTap(first);
    const second = vi.fn();
    onPushTap(second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith('home');
    expect(second).not.toHaveBeenCalled();
  });

  it.each(['dismiss', 'snooze'])('ignores actionId %s', async (actionId) => {
    const { listenForReminderTaps, onPushTap } = await load();
    const handler = vi.fn();
    onPushTap(handler);
    await listenForReminderTaps();

    tapListeners.current!({ actionId });
    const late = vi.fn();
    onPushTap(late);

    expect(handler).not.toHaveBeenCalled();
    expect(late).not.toHaveBeenCalled();
  });

  it('adds the listener once however often it is called', async () => {
    const { listenForReminderTaps } = await load();

    await listenForReminderTaps();
    await listenForReminderTaps();

    expect(localNotifications.addListener).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed add, and logs the failure', async () => {
    const { listenForReminderTaps } = await load();
    const failure = new Error('bridge gone');
    localNotifications.addListener.mockRejectedValueOnce(failure);

    await expect(listenForReminderTaps()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      '[DateReminders] Could not listen for reminder taps:',
      failure
    );
    await listenForReminderTaps();

    expect(localNotifications.addListener).toHaveBeenCalledTimes(2);
    expect(tapListeners.current).not.toBeNull();
  });

  it.each([
    ['on the web', () => capacitor.isNativePlatform.mockReturnValue(false)],
    [
      'in a shell without the plugin',
      () => capacitor.isPluginAvailable.mockImplementation((name) => name !== 'LocalNotifications'),
    ],
  ])('adds no listener %s', async (_name, arrange) => {
    const { listenForReminderTaps } = await load();
    arrange();

    await listenForReminderTaps();

    expect(localNotifications.addListener).not.toHaveBeenCalled();
  });
});
