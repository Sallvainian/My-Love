/**
 * The Mood header's date follows the day the form saves under
 *
 * `addMoodEntry` saves under a fresh `new Date()` on every submit
 * (moodSlice.saveForDate). The subtitle above the form has to name that same
 * day: with the view left open across midnight, the next render must show the
 * new date, not the one read when the view mounted.
 */
import { render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MoodEntry } from '../../../types';

type MotionOnlyProps = {
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  layoutId?: unknown;
};
type DivProps = HTMLAttributes<HTMLDivElement> & MotionOnlyProps & { children?: ReactNode };
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  MotionOnlyProps & { children?: ReactNode };

// Motion-only props are destructured away rather than spread: React warns about
// every one of them reaching a DOM element, and that noise is not what this
// file pins. data-testid, aria-label and children still pass through.
vi.mock('motion/react', () => ({
  m: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      layoutId: _layoutId,
      ...props
    }: DivProps) => <div {...props}>{children}</div>,
    button: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      layoutId: _layoutId,
      ...props
    }: ButtonProps) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const storeState = {
  addMoodEntry: vi.fn(),
  getMoodForDate: vi.fn(() => undefined as MoodEntry | undefined),
  syncStatus: { pendingMoods: 0, isOnline: true, lastSyncAt: undefined, isSyncing: false },
  loadMoods: vi.fn(),
  syncPendingMoods: vi.fn(),
  updateSyncStatus: vi.fn(),
  moods: [] as MoodEntry[],
};

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'USER-A-ID' } }),
}));

vi.mock('../../../api/supabaseClient', () => ({
  getPartnerId: vi.fn().mockResolvedValue(null),
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
}));

vi.mock('../../../utils/backgroundSync', () => ({
  registerBackgroundSync: vi.fn(),
}));

// The history views pull in react-window and their own data hooks, and none of
// that is what this file is about.
vi.mock('../MoodHistoryTimeline', () => ({
  MoodHistoryTimeline: () => <div data-testid="timeline" />,
}));
vi.mock('../PartnerMoodDisplay', () => ({
  PartnerMoodDisplay: () => <div data-testid="partner-mood" />,
}));
vi.mock('../../MoodHistory', () => ({
  MoodHistoryCalendar: () => <div data-testid="calendar" />,
}));

import { MoodTracker } from '../MoodTracker';

describe('MoodTracker header date', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.moods = [];
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the new day after midnight on the next render', () => {
    vi.setSystemTime(new Date(2026, 8, 22, 23, 59));
    const { rerender } = render(<MoodTracker />);
    expect(screen.getByText('Tuesday, September 22')).toBeInTheDocument();

    // The view stays mounted past midnight; the 5-minute sync replaces
    // `moods` and the store update re-renders it.
    vi.setSystemTime(new Date(2026, 8, 23, 0, 1));
    storeState.moods = [];
    rerender(<MoodTracker />);

    expect(screen.getByText('Wednesday, September 23')).toBeInTheDocument();
  });
});
