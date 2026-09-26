/** Shared mood normalization at all display boundaries; data hooks are mocked. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMood } from '../../../api/validation/supabaseSchemas';
import type { MoodEntry, MoodType } from '../../../types';

vi.mock('../../../hooks/usePartnerMood', () => ({
  usePartnerMood: vi.fn(),
}));

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

// `MoodDetailModal` and `CalendarDay` need this under happy-dom. The motion-only
// props are destructured away rather than spread: React warns about every one of
// them reaching a DOM element, and that noise is not what these cases pin.
// Everything else — data-testid, role, aria-label, children — passes through, so
// the components rendering through the real `m` elsewhere in this file are
// unaffected in what they expose.
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

/**
 * Store state for the `MoodTracker` case, mirroring the working mock set in
 * `MoodTracker.syncBadge.test.tsx`. `getMoodForDate` is what feeds the guard.
 */
const storeState = {
  addMoodEntry: vi.fn(),
  getMoodForDate: vi.fn(() => undefined as MoodEntry | undefined),
  syncStatus: { pendingMoods: 0, isOnline: false, lastSyncAt: undefined, isSyncing: false },
  loadMoods: vi.fn(),
  syncPendingMoods: vi.fn(),
  updateSyncStatus: vi.fn(),
  moods: [] as MoodEntry[],
  // Only `displayName` is read, by `PartnerMoodDisplay`'s heading.
  partner: null as { displayName: string } | null,
};

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'USER-A-ID' } }),
}));

// `getPartnerId` resolving null keeps the real `PartnerMoodDisplay` unmounted
// inside `MoodTracker`, so its own describe below is the only thing rendering it.
vi.mock('../../../api/supabaseClient', () => ({
  getPartnerId: vi.fn(),
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
}));

vi.mock('../../../utils/backgroundSync', () => ({
  registerBackgroundSync: vi.fn(),
}));

vi.mock('../../../services/moodService', () => ({
  moodService: {
    create: vi.fn(),
    updateMood: vi.fn(),
    getAll: vi.fn(),
    getAllForUser: vi.fn(),
    getUnsyncedMoods: vi.fn(),
  },
}));

vi.mock('../../../api/moodSyncService', () => ({
  moodSyncService: {
    syncPendingMoods: vi.fn(),
    fetchMoods: vi.fn(),
  },
}));

// The history views pull in react-window and their own data hooks, and none of
// that is what this file is about.
vi.mock('../MoodHistoryTimeline', () => ({
  MoodHistoryTimeline: () => <div data-testid="timeline" />,
}));
vi.mock('../../MoodHistory', () => ({
  MoodHistoryCalendar: () => <div data-testid="calendar" />,
}));

import { moodSyncService } from '../../../api/moodSyncService';
import { getPartnerId } from '../../../api/supabaseClient';
import { usePartnerMood } from '../../../hooks/usePartnerMood';
import { createMoodSlice, type MoodSlice } from '../../../stores/slices/moodSlice';
import { CalendarDay } from '../../MoodHistory/CalendarDay';
import { MoodDetailModal } from '../../MoodHistory/MoodDetailModal';
import { MoodHistoryItem } from '../MoodHistoryItem';
import { MoodTracker } from '../MoodTracker';
import { PartnerMoodDisplay } from '../PartnerMoodDisplay';

const mockedUsePartnerMood = vi.mocked(usePartnerMood);
const mockedGetPartnerId = vi.mocked(getPartnerId);
const mockedMoodSyncService = vi.mocked(moodSyncService);

const PARTNER_ID = '00000000-0000-4000-8000-000000000002';
const DATE_KEY = '2026-09-12';

/** The non-array shapes every guarded site is pinned against. */
const NON_ARRAY_ROWS: [string, unknown][] = [
  ['a string', 'happy'],
  ['a number', 7],
  ['an object', { 0: 'happy', length: 1 }],
];

function moodRecord(moodTypes: unknown): SupabaseMood {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    user_id: PARTNER_ID,
    mood_type: 'happy',
    // Deliberately lying to the type system: the whole point is what happens
    // when a value that is not an array reaches a component that assumes one.
    mood_types: moodTypes as SupabaseMood['mood_types'],
    note: null,
    created_at: '2026-09-12T10:00:00.000Z',
    updated_at: '2026-09-12T10:00:00.000Z',
  };
}

/** The lucide class MOOD_DISPLAY's icon renders for 'happy' (FaceSlightlySmiling, via its `smile` alias)... */
const HAPPY_ICON = 'lucide-smile';
/** ...and for 'tired' (Battery). */
const TIRED_ICON = 'lucide-battery';

describe('MoodHistoryItem mood_types guard', () => {
  it.each(NON_ARRAY_ROWS)(
    'falls back to the single mood when mood_types is %s',
    (_label, value) => {
      expect(() => render(<MoodHistoryItem mood={moodRecord(value)} />)).not.toThrow();

      const icons = screen.getByTestId('mood-emoji');
      expect(within(icons).getAllByTestId(/^mood-icon-/)).toHaveLength(1);
      expect(within(icons).getByTestId('mood-icon-happy')).toHaveClass(HAPPY_ICON);
      expect(screen.getByTestId('mood-label')).toHaveTextContent('Happy');
    }
  );

  it('still renders every mood of a genuine multi-mood entry', () => {
    render(<MoodHistoryItem mood={moodRecord(['happy', 'tired'])} />);

    const icons = screen.getByTestId('mood-emoji');
    expect(within(icons).getAllByTestId(/^mood-icon-/)).toHaveLength(2);
    expect(within(icons).getByTestId('mood-icon-happy')).toHaveClass(HAPPY_ICON);
    expect(within(icons).getByTestId('mood-icon-tired')).toHaveClass(TIRED_ICON);
    expect(screen.getByTestId('mood-label')).toHaveTextContent('Happy, Tired');
  });
});

describe('PartnerMoodDisplay mood_types guard', () => {
  function renderWith(moodTypes: unknown) {
    mockedUsePartnerMood.mockReturnValue({
      partnerMood: moodRecord(moodTypes),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePartnerMood>);

    return render(<PartnerMoodDisplay partnerId={PARTNER_ID} />);
  }

  it.each(NON_ARRAY_ROWS)(
    'falls back to the single mood when mood_types is %s',
    (_label, value) => {
      expect(() => renderWith(value)).not.toThrow();

      const chips = screen.getByTestId('partner-mood-emoji');
      expect(within(chips).getAllByTestId('partner-mood-chip')).toHaveLength(1);
      expect(chips).toHaveTextContent('Happy');
      expect(within(chips).getByTestId('mood-icon-happy')).toHaveClass(HAPPY_ICON);
    }
  );

  it('still renders every mood of a genuine multi-mood entry', () => {
    renderWith(['happy', 'tired']);

    const chips = screen.getByTestId('partner-mood-emoji');
    const chipEls = within(chips).getAllByTestId('partner-mood-chip');
    expect(chipEls).toHaveLength(2);
    expect(chipEls[0]).toHaveTextContent('Happy');
    expect(chipEls[1]).toHaveTextContent('Tired');
    expect(within(chips).getByTestId('mood-icon-happy')).toHaveClass(HAPPY_ICON);
    expect(within(chips).getByTestId('mood-icon-tired')).toHaveClass(TIRED_ICON);
    expect(screen.getByTestId('partner-mood-label')).toHaveTextContent('Happy, Tired');
    expect(chips).toHaveAttribute('aria-label', 'happy, tired mood');
  });

  it('renders no emoji in the partner card', () => {
    renderWith(['happy', 'tired']);

    expect(screen.getByTestId('partner-mood-display').textContent).not.toMatch(
      /\p{Extended_Pictographic}/u
    );
  });

  it('renders no emoji in the no-mood state', () => {
    mockedUsePartnerMood.mockReturnValue({
      partnerMood: null,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePartnerMood>);
    render(<PartnerMoodDisplay partnerId={PARTNER_ID} />);

    expect(screen.getByTestId('no-mood-logged-state').textContent).not.toMatch(
      /\p{Extended_Pictographic}/u
    );
  });

  it('renders no emoji in the error state', () => {
    mockedUsePartnerMood.mockReturnValue({
      partnerMood: null,
      isLoading: false,
      error: 'x',
    } as unknown as ReturnType<typeof usePartnerMood>);
    render(<PartnerMoodDisplay partnerId={PARTNER_ID} />);

    expect(screen.getByTestId('partner-mood-error').textContent).not.toMatch(
      /\p{Extended_Pictographic}/u
    );
  });
});

describe('PartnerMoodDisplay partner name', () => {
  function renderCard() {
    mockedUsePartnerMood.mockReturnValue({
      partnerMood: moodRecord(['happy']),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePartnerMood>);

    return render(<PartnerMoodDisplay partnerId={PARTNER_ID} />);
  }

  /** The partner avatar at the start of the card's header row. */
  function avatar(): HTMLElement {
    return screen.getByTestId('partner-mood-avatar');
  }

  afterEach(() => {
    storeState.partner = null;
  });

  it('names the store partner and shows their initial', () => {
    storeState.partner = { displayName: 'Sam' };
    renderCard();

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sam is feeling');
    expect(avatar()).toHaveTextContent('S');
    expect(within(avatar()).queryByTestId('partner-mood-avatar-icon')).not.toBeInTheDocument();
  });

  it('trims the store name', () => {
    storeState.partner = { displayName: '  sam  ' };
    renderCard();

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('sam is feeling');
    expect(avatar()).toHaveTextContent('S');
  });

  it('takes a whole code point for the initial', () => {
    storeState.partner = { displayName: '\u{1D4AE}am' };
    renderCard();

    expect(avatar().textContent).toBe('\u{1D4AE}');
  });

  it.each([
    ['null', null],
    ['blank', { displayName: '   ' }],
  ])('falls back to "Your partner" and a User icon when the partner is %s', (_label, partner) => {
    storeState.partner = partner;
    renderCard();

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Your partner is feeling'
    );
    expect(within(avatar()).getByTestId('partner-mood-avatar-icon')).toBeInTheDocument();
    expect(avatar().textContent).toBe('');
  });
});

/** Shared by the `MoodDetailModal`, `CalendarDay` and `MoodTracker` describes. */
function moodEntry(moods: unknown): MoodEntry {
  return {
    userId: 'USER-A-ID',
    mood: 'happy',
    // Same deliberate lie as `moodRecord` above.
    moods: moods as MoodEntry['moods'],
    note: undefined,
    date: DATE_KEY,
    timestamp: new Date('2026-09-12T10:00:00.000Z'),
    synced: true,
  };
}

describe('MoodDetailModal moods guard', () => {
  it.each(NON_ARRAY_ROWS)(
    'falls back to the single mood when moods is %s',
    (_label, value) => {
      // Pre-fix, both the string and the object row threw
      // `allMoods.map is not a function` in the icon row. The number row already
      // fell back -- `(7).length` is undefined, so the old truthy check missed.
      expect(() =>
        render(<MoodDetailModal mood={moodEntry(value)} onClose={vi.fn()} />)
      ).not.toThrow();

      // 'Happy', not 'H, A, P, P, Y'.
      expect(screen.getByTestId('modal-mood-type')).toHaveTextContent('Happy');
    }
  );

  it('falls back to the single mood when moods is an empty array', () => {
    render(<MoodDetailModal mood={moodEntry([])} onClose={vi.fn()} />);

    expect(screen.getByTestId('modal-mood-type')).toHaveTextContent('Happy');
  });

  it('falls back to the single mood when moods is absent', () => {
    render(<MoodDetailModal mood={moodEntry(undefined)} onClose={vi.fn()} />);

    expect(screen.getByTestId('modal-mood-type')).toHaveTextContent('Happy');
  });

  it('still renders every mood of a genuine multi-mood entry', () => {
    render(<MoodDetailModal mood={moodEntry(['happy', 'tired'] as MoodType[])} onClose={vi.fn()} />);

    expect(screen.getByTestId('modal-mood-type')).toHaveTextContent('Happy, Tired');
  });
});

describe('CalendarDay moods guard', () => {
  function renderDay(mood: MoodEntry | undefined) {
    return render(
      <CalendarDay
        dateKey={DATE_KEY}
        dayNumber={12}
        isToday={false}
        mood={mood}
        monthName="September"
        year={2026}
        onClick={vi.fn()}
      />
    );
  }

  function ariaLabel() {
    return screen.getByTestId(`calendar-day-${DATE_KEY}`).getAttribute('aria-label');
  }

  it.each(NON_ARRAY_ROWS)('falls back to the single mood when moods is %s', (_label, value) => {
    // Pre-fix, the string row threw inside `dayClasses` before render, on
    // the old local mood config's `['h'].bgColor`; the object row cleared
    // that lookup and threw on `allMoods.join` in the aria-label. The number
    // row already fell back.
    expect(() => renderDay(moodEntry(value))).not.toThrow();

    expect(ariaLabel()).toContain('- happy mood');
  });

  it('falls back to the single mood when moods is an empty array', () => {
    renderDay(moodEntry([]));

    expect(ariaLabel()).toContain('- happy mood');
  });

  it('falls back to the single mood when moods is absent', () => {
    renderDay(moodEntry(undefined));

    expect(ariaLabel()).toContain('- happy mood');
  });

  it('still names every mood of a genuine multi-mood entry', () => {
    renderDay(moodEntry(['happy', 'tired'] as MoodType[]));

    expect(ariaLabel()).toContain('- happy, tired mood');
  });

  it('still renders a day with no mood at all', () => {
    renderDay(undefined);

    expect(ariaLabel()).toBe('September 12, 2026');
  });
});

describe('MoodTracker moods guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPartnerId.mockResolvedValue(null);
  });

  // `vi.clearAllMocks()` clears calls but not return values, so the seeded entry
  // would otherwise outlive this describe.
  afterEach(() => {
    storeState.getMoodForDate.mockReset();
  });

  function renderWithSavedMood(moods: unknown) {
    storeState.getMoodForDate.mockReturnValue(moodEntry(moods));
    return render(<MoodTracker />);
  }

  it.each(NON_ARRAY_ROWS)(
    'seeds the single mood when the saved entry moods is %s',
    (_label, value) => {
      // Pre-fix, the string row was seeded into `selectedMoods` and threw on
      // `selectedMoods.map` in the "Selected:" line; the object row threw one
      // step earlier, on `selectedMoods.includes` in the mood grid. The number
      // row already fell back.
      const { container } = renderWithSavedMood(value);

      expect(container.textContent).toContain('Selected: Happy');
    }
  );

  it('seeds the single mood when the saved entry moods is an empty array', () => {
    const { container } = renderWithSavedMood([]);

    expect(container.textContent).toContain('Selected: Happy');
  });

  it('seeds the single mood when the saved entry has no moods array', () => {
    const { container } = renderWithSavedMood(undefined);

    expect(container.textContent).toContain('Selected: Happy');
  });

  it('still seeds every mood of a genuine multi-mood entry', () => {
    const { container } = renderWithSavedMood(['happy', 'tired'] as MoodType[]);

    expect(container.textContent).toContain('Selected: Happy, Tired');
  });
});

/**
 * Standalone store built from the slice, the way `createTestStore` in
 * `tests/unit/stores/moodSliceFixture.ts` builds one — `fetchPartnerMoods` is
 * an action, not a render.
 */
function createTestStore() {
  const stateRef = { current: null as (MoodSlice & Record<string, unknown>) | null };

  const get = () => stateRef.current!;
  const set = (
    updater:
      | Partial<MoodSlice & Record<string, unknown>>
      | ((s: MoodSlice & Record<string, unknown>) => Partial<MoodSlice & Record<string, unknown>>)
  ) => {
    const update = typeof updater === 'function' ? updater(stateRef.current!) : updater;
    stateRef.current = { ...stateRef.current!, ...update };
  };
  const api = {} as never;

  const state = createMoodSlice(set as never, get as never, api);
  stateRef.current = { ...state };
  return { get };
}

describe('moodSlice.fetchPartnerMoods mood_types guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockedGetPartnerId.mockResolvedValue(PARTNER_ID);
  });

  // Matching the `describe('moodSlice')` `afterEach` in
  // `tests/unit/stores/moodSlice.test.ts` (repeated in each
  // `moodSlice.*.test.ts`), plus the `onLine`
  // redefinition this describe makes — it is a plain data property, so
  // `restoreAllMocks` does not undo it and it would leak into anything appended
  // after this describe.
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  async function fetchWith(moodTypes: unknown) {
    mockedMoodSyncService.fetchMoods.mockResolvedValue([moodRecord(moodTypes)]);

    const { get } = createTestStore();
    await get().fetchPartnerMoods();
    return get().partnerMoods;
  }

  it.each(NON_ARRAY_ROWS)('stores the single mood when mood_types is %s', async (_label, value) => {
    // Pre-fix, the string and object rows were stored verbatim as
    // `MoodEntry.moods`, leaving every consumer to defend itself. The number row
    // already fell back.
    const partnerMoods = await fetchWith(value);

    expect(partnerMoods[0].moods).toEqual(['happy']);
  });

  it('stores the single mood when mood_types is an empty array', async () => {
    const partnerMoods = await fetchWith([]);

    expect(partnerMoods[0].moods).toEqual(['happy']);
  });

  it('stores the single mood when mood_types is null', async () => {
    const partnerMoods = await fetchWith(null);

    expect(partnerMoods[0].moods).toEqual(['happy']);
  });

  it('still stores every mood of a genuine multi-mood record', async () => {
    const partnerMoods = await fetchWith(['happy', 'tired']);

    expect(partnerMoods[0].moods).toEqual(['happy', 'tired']);
  });
});


describe('malformed element recovery at mood displays', () => {
  beforeEach(() => {
    mockedGetPartnerId.mockResolvedValue(null);
    storeState.getMoodForDate.mockReset();
  });

  const displays = ['history', 'partner', 'modal', 'calendar', 'tracker'] as const;
  function display(kind: (typeof displays)[number], invalid = false) {
    const values = invalid ? [null, 'unknown'] : ['sad', null, 'tired', 'sad'];
    const local = { ...moodEntry(values), mood: 'unknown', note: invalid ? 'hidden note' : undefined } as unknown as MoodEntry;
    const remote = { ...moodRecord(values), mood_type: 'unknown' } as unknown as SupabaseMood;
    if (kind === 'history') return render(<MoodHistoryItem mood={remote} />);
    if (kind === 'partner') {
      mockedUsePartnerMood.mockReturnValue({ partnerMood: remote, isLoading: false, error: null } as ReturnType<typeof usePartnerMood>);
      return render(<PartnerMoodDisplay partnerId={PARTNER_ID} />);
    }
    if (kind === 'modal') return render(<MoodDetailModal mood={local} onClose={vi.fn()} />);
    if (kind === 'calendar') return render(<CalendarDay dateKey={DATE_KEY} dayNumber={12} isToday={false} mood={local} monthName="September" year={2026} onClick={vi.fn()} />);
    storeState.getMoodForDate.mockReturnValue(local);
    return render(<MoodTracker />);
  }

  it.each([
    ['history', () => screen.getByTestId('mood-label').textContent, 'Sad, Tired, Sad'],
    ['partner', () => screen.getByTestId('partner-mood-label').textContent, 'Sad, Tired, Sad'],
    ['modal', () => screen.getByTestId('modal-mood-type').textContent, 'Sad, Tired, Sad'],
    [
      'calendar',
      () => screen.getByTestId(`calendar-day-${DATE_KEY}`).getAttribute('aria-label'),
      'September 12, 2026 - sad, tired, sad mood. Press enter to view details.',
    ],
    ['tracker', () => screen.getByText(/^Selected:/).textContent, 'Selected: Sad, Tired, Sad'],
  ] as const)('%s preserves recognized values in order, including duplicates', (kind, read, expected) => {
    display(kind);
    expect(read()).toBe(expected);
  });

  it.each([
    ['history', 'mood-history-item'],
    ['partner', 'partner-mood-display'],
    ['modal', 'mood-detail-modal'],
  ] as const)('%s excludes wholly invalid moods instead of inventing a display value', (kind, testId) => {
    display(kind, true);
    expect(screen.queryByTestId(testId)).toBeNull();
  });

  it('calendar excludes wholly invalid moods instead of inventing a display value', () => {
    display('calendar', true);
    expect(screen.getByTestId(`calendar-day-${DATE_KEY}`)).toHaveAttribute('data-has-mood', 'false');
  });

  it('tracker excludes wholly invalid moods instead of inventing a display value', async () => {
    const { container } = display('tracker', true);
    expect(container.textContent).not.toContain('Selected:');
    // A seeded entry with a note auto-expands the note field, so the collapsed
    // toggle is itself evidence the entry was not seeded; opening it must then
    // show an empty note rather than 'hidden note'.
    await userEvent.click(screen.getByTestId('mood-add-note-toggle'));
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('normalizes partner records independently and omits invalid siblings', async () => {
    mockedGetPartnerId.mockResolvedValue(PARTNER_ID);
    mockedMoodSyncService.fetchMoods.mockResolvedValue([
      { ...moodRecord(['tired', null, 'sad', 'tired']), mood_type: 'unknown' },
      { ...moodRecord([null]), mood_type: 'unknown' },
    ] as unknown as Awaited<ReturnType<typeof moodSyncService.fetchMoods>>);
    const { get } = createTestStore();
    await get().fetchPartnerMoods();
    expect(get().partnerMoods).toHaveLength(1);
    expect(get().partnerMoods[0]).toMatchObject({ mood: 'tired', moods: ['tired', 'sad', 'tired'] });
  });
});
