/**
 * MoodHistoryCalendar re-reads the shown month when the store's `moods` change.
 *
 * The calendar reads IndexedDB per month. The server backfill writes into that
 * store and then reloads `moods`; without watching the array, a fresh device's
 * calendar stayed empty until the user changed month.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { MoodEntry } from '../../../types';

const getMoodsInRange = vi.fn();
vi.mock('../../../services/moodService', () => ({
  moodService: {
    getMoodsInRange: (start: Date, end: Date, userId: string) =>
      getMoodsInRange(start, end, userId),
  },
}));

const store = create<{ userId: string | null; moods: MoodEntry[] }>()(() => ({
  userId: 'user-1',
  moods: [],
}));
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: <T,>(selector: (s: { userId: string | null; moods: MoodEntry[] }) => T) =>
    store(selector),
}));

import { MoodHistoryCalendar } from '../MoodHistoryCalendar';

function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function mood(): MoodEntry {
  return {
    id: 1,
    userId: 'user-1',
    mood: 'happy',
    moods: ['happy'],
    date: todayISO(),
    timestamp: new Date(),
    synced: true,
    supabaseId: 'server-1',
  };
}

describe('MoodHistoryCalendar store reload', () => {
  beforeEach(() => {
    getMoodsInRange.mockReset();
    store.setState({ userId: 'user-1', moods: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows moods written to IndexedDB after mount once the store reloads, without a month change', async () => {
    getMoodsInRange.mockResolvedValueOnce([]);
    render(<MoodHistoryCalendar />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).not.toBeInTheDocument());
    const header = screen.getByTestId('calendar-month-header').textContent;
    expect(screen.queryByText(/logged this month/)).not.toBeInTheDocument();

    // The backfill merged a server mood and reloaded the store.
    getMoodsInRange.mockResolvedValue([mood()]);
    act(() => store.setState({ moods: [mood()] }));

    expect(await screen.findByText('1 mood logged this month')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-month-header').textContent).toBe(header);
    expect(getMoodsInRange).toHaveBeenCalledTimes(2);
    expect(getMoodsInRange).toHaveBeenLastCalledWith(expect.any(Date), expect.any(Date), 'user-1');
  });

  it('an older read that settles last does not replace the latest one', async () => {
    let settleFirst: (rows: MoodEntry[]) => void = () => {};
    let settleSecond: (rows: MoodEntry[]) => void = () => {};
    getMoodsInRange
      .mockReturnValueOnce(new Promise((resolve) => (settleFirst = resolve)))
      .mockReturnValueOnce(new Promise((resolve) => (settleSecond = resolve)));
    render(<MoodHistoryCalendar />);
    act(() => store.setState({ moods: [mood()] }));
    expect(getMoodsInRange).toHaveBeenCalledTimes(2);

    await act(async () => settleSecond([mood()]));
    await act(async () => settleFirst([]));

    expect(screen.queryByTestId('calendar-loading')).not.toBeInTheDocument();
    expect(screen.getByText('1 mood logged this month')).toBeInTheDocument();
    expect(screen.getByTestId(`calendar-day-${todayISO()}`)).toHaveAttribute('data-has-mood', 'true');
  });

  it('keeps the grid on screen (no loading skeleton) while re-reading the same month', async () => {
    getMoodsInRange.mockResolvedValueOnce([mood()]);
    render(<MoodHistoryCalendar />);
    expect(await screen.findByText('1 mood logged this month')).toBeInTheDocument();

    let settle: (rows: MoodEntry[]) => void = () => {};
    getMoodsInRange.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    act(() => store.setState({ moods: [mood()] }));

    expect(screen.queryByTestId('calendar-loading')).not.toBeInTheDocument();
    await act(async () => settle([mood()]));
    expect(screen.getByText('1 mood logged this month')).toBeInTheDocument();
  });
});
