/**
 * A background sync must not erase the mood the user is still typing
 *
 * The form seeds itself during render, triggered by `moods` ARRAY IDENTITY:
 * `if (moods !== seededFrom)`. That identity churns on its own — `loadMoods`
 * ends in an unconditional `set({ moods: allMoods })`, and `syncPendingMoods`
 * calls `loadMoods` after every pass that acquires the lock, including a pass
 * that synced nothing. App.tsx fires `syncPendingMoods` from a 5-minute
 * interval and from the `online` event.
 *
 * Reseeding therefore fires on a timer, with no user action at all. That is
 * tolerable while it only reseeds FROM a saved entry: the values it writes are
 * the ones already on screen. It is not tolerable when there is no saved entry
 * to seed from — the ordinary first-mood-of-the-day case — because "seed from
 * nothing" means "clear", and the timer then wipes the moods the user just
 * tapped and the note they are mid-sentence in.
 *
 * The regression this pins added exactly that `else { setSelectedMoods([]);
 * setNote(''); setIsEditing(false); }`. The two cases below are the two halves
 * of the contract: an unsaved draft survives the churn, and a saved entry still
 * seeds the form.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

/** What `loadMoods` does after every sync pass: hand back a brand-new array */
function backgroundSyncReloads(rows: MoodEntry[] = []): void {
  storeState.moods = [...rows];
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('MoodTracker draft preservation across a background reload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.moods = [];
    storeState.getMoodForDate.mockReturnValue(undefined);
  });

  it('keeps an unsaved selection and note when the moods array is replaced', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MoodTracker />);

    await user.click(screen.getByTestId('mood-button-happy'));
    await user.click(screen.getByTestId('mood-button-tired'));
    await user.click(screen.getByTestId('mood-add-note-toggle'));
    await user.type(screen.getByTestId('mood-note-input'), 'A-DRAFT-NOTE-STILL-BEING-TYPED');

    // The 5-minute interval fires. Nothing was synced and nothing is saved for
    // today, but `loadMoods` still replaces the array.
    backgroundSyncReloads();
    rerender(<MoodTracker />);

    expect(screen.getByTestId('mood-button-happy')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mood-button-tired')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mood-note-input')).toHaveValue('A-DRAFT-NOTE-STILL-BEING-TYPED');
  });

  it('still seeds the form from a saved entry for today', () => {
    // The other half. Without this, a guard that simply never reseeds would
    // satisfy the case above and silently break editing.
    const { rerender } = render(<MoodTracker />);

    const saved: MoodEntry = {
      id: 1,
      userId: 'USER-A-ID',
      mood: 'sad',
      moods: ['sad', 'tired'],
      note: 'A-SAVED-NOTE',
      date: todayISO(),
      timestamp: new Date(),
      synced: false,
    };
    storeState.getMoodForDate.mockReturnValue(saved);
    backgroundSyncReloads([saved]);
    rerender(<MoodTracker />);

    expect(screen.getByTestId('mood-button-sad')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mood-button-tired')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mood-note-input')).toHaveValue('A-SAVED-NOTE');
  });
});
