/**
 * useDailyDayRereads — while signed in, the day and the streak are re-read on
 * every return to the front (DW-566) and at each local 00:00:05, with
 * one more read 5 s later when the day shown is still not the device's date
 * (DW-538). The 20:00:05 evening re-read went with the nudge slots (story 11.1).
 * The listener and the timers are removed on unmount and on a session change.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ShownDay = { status: 'ok'; snapshot: { day: string } } | { status: 'unlinked' } | null;

const state = {
  userId: 'USER-A' as string | null,
  authSessionVersion: 0,
  dailyDay: null as ShownDay,
  loadDailyDay: vi.fn(async () => {}),
  loadCoupleStreak: vi.fn(async () => {}),
};

// A store that re-renders the hook when `dailyDay` changes, as the real one does.
const listeners = new Set<() => void>();
function setShown(dailyDay: ShownDay) {
  state.dailyDay = dailyDay;
  listeners.forEach((listener) => listener());
}

vi.mock('../../stores/useAppStore', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    useAppStore: (selector: (s: typeof state) => unknown) =>
      useSyncExternalStore(subscribe, () => selector(state)),
  };
});

import { useDailyDayRereads } from '../useDailyDayRereads';

/** A local-time instant: 2026-11-05 at `hour:minute:second`. */
const at = (hour: number, minute = 0, second = 0) => new Date(2026, 10, 5, hour, minute, second);
/** Milliseconds from 23:59:00 to 00:00:05 the next day. */
const TO_MIDNIGHT = 65_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const shows = (day: string): ShownDay => ({ status: 'ok', snapshot: { day } });

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true });
}

describe('useDailyDayRereads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(state, { userId: 'USER-A', authSessionVersion: 0, dailyDay: shows('2026-11-05') });
    // A read that answers for the device's date at the moment it runs.
    state.loadDailyDay.mockImplementation(async () => {
      const now = new Date();
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setShown(shows(day));
    });
    setVisibility('visible');
    // Only the clock and the timer: nothing here drives user-event.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(at(19, 59));
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('does not re-read at 20:00:05 or at any hour before midnight: there is no evening timer', () => {
    renderHook(() => useDailyDayRereads());

    // 19:59 to 00:00:04.999: the evening slot's 20:00:05 and every hour after it.
    act(() => vi.advanceTimersByTime(4 * 60 * 60 * 1000 + 65_000 - 1));

    expect(state.loadDailyDay).not.toHaveBeenCalled();
    expect(state.loadCoupleStreak).not.toHaveBeenCalled();
    // The one timer is the midnight one.
    expect(vi.getTimerCount()).toBe(1);
  });

  it('re-reads the day and the streak at 00:00:05 local, not before', async () => {
    vi.setSystemTime(at(23, 59));
    renderHook(() => useDailyDayRereads());

    act(() => vi.advanceTimersByTime(TO_MIDNIGHT - 1));
    expect(state.loadDailyDay).not.toHaveBeenCalled();
    expect(state.loadCoupleStreak).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);
  });

  it('re-arms for the next midnight after it fires, and does not fire again the same day', async () => {
    vi.setSystemTime(at(23, 59));
    renderHook(() => useDailyDayRereads());

    await act(async () => vi.advanceTimersByTime(TO_MIDNIGHT));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTime(DAY_MS - 1));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTime(1));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(2);
    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(2);
  });

  it('reads once more 5 s later when the answer is still the old date, and only once', async () => {
    vi.setSystemTime(at(23, 59));
    // The server's clock is behind the device's: the read still answers the 5th.
    state.loadDailyDay.mockImplementation(async () => {
      setShown(shows('2026-11-05'));
    });
    renderHook(() => useDailyDayRereads());

    await act(async () => vi.advanceTimersByTime(TO_MIDNIGHT));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTime(5_000 - 1));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTime(1));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(2);
    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(2);

    // No third read that night, however long the old date stays.
    await act(async () => vi.advanceTimersByTime(60 * 60 * 1000));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(2);
  });

  it('does not read again when the midnight read answered the new date', async () => {
    vi.setSystemTime(at(23, 59));
    renderHook(() => useDailyDayRereads());

    await act(async () => vi.advanceTimersByTime(TO_MIDNIGHT + 60_000));

    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
    expect(state.dailyDay).toEqual(shows('2026-11-06'));
  });

  it('does not read again for an unlinked answer', async () => {
    vi.setSystemTime(at(23, 59));
    state.loadDailyDay.mockImplementation(async () => {
      setShown({ status: 'unlinked' });
    });
    renderHook(() => useDailyDayRereads());

    await act(async () => vi.advanceTimersByTime(TO_MIDNIGHT + 60_000));

    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
  });

  it('a midnight read that answers after unmount arms no second read', async () => {
    vi.setSystemTime(at(23, 59));
    let answer: () => void = () => {};
    state.loadDailyDay.mockImplementation(
      () => new Promise<void>((resolve) => (answer = resolve))
    );
    const { unmount } = renderHook(() => useDailyDayRereads());

    await act(async () => vi.advanceTimersByTime(TO_MIDNIGHT));
    unmount();
    await act(async () => answer());
    await act(async () => vi.advanceTimersByTime(60_000));

    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('re-reads the day and the streak on each visibilitychange to visible, and not to hidden', () => {
    renderHook(() => useDailyDayRereads());

    setVisibility('hidden');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(state.loadDailyDay).not.toHaveBeenCalled();
    expect(state.loadCoupleStreak).not.toHaveBeenCalled();

    setVisibility('visible');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(2);
    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(2);
  });

  it('a page shown again after midnight re-reads the streak for the new day (DW-566)', async () => {
    vi.setSystemTime(at(23, 59));
    renderHook(() => useDailyDayRereads());

    setVisibility('hidden');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    // Hidden across midnight: the clock moves on without the timer firing.
    vi.setSystemTime(new Date(2026, 10, 6, 7, 30));
    setVisibility('visible');
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));

    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);
    expect(state.dailyDay).toEqual(shows('2026-11-06'));
  });

  it('removes the listener and the timer on unmount', () => {
    const { unmount } = renderHook(() => useDailyDayRereads());

    unmount();
    act(() => vi.advanceTimersByTime(DAY_MS));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    expect(state.loadDailyDay).not.toHaveBeenCalled();
    expect(state.loadCoupleStreak).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing while signed out', () => {
    state.userId = null;
    renderHook(() => useDailyDayRereads());

    act(() => vi.advanceTimersByTime(DAY_MS));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    expect(state.loadDailyDay).not.toHaveBeenCalled();
    expect(state.loadCoupleStreak).not.toHaveBeenCalled();
  });

  it('listens once for a new session and drops the old listener', () => {
    const { rerender } = renderHook(() => useDailyDayRereads());

    state.authSessionVersion = 1;
    rerender();
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
  });

  it('re-arms the midnight timer for a new session and drops the old one', async () => {
    vi.setSystemTime(at(23, 59));
    const { rerender } = renderHook(() => useDailyDayRereads());

    state.authSessionVersion = 1;
    rerender();
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => vi.advanceTimersByTime(TO_MIDNIGHT));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
  });
});
