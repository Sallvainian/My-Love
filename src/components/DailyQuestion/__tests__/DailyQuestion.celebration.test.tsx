/**
 * The streak's +1 and the milestone screen after it on Daily
 * (DailyQuestion.tsx, StreakUp.tsx, Milestone.tsx) against the real store, with
 * only the API module and `motion/react` mocked: one test per row of the
 * stories' matrices.
 */
import { createElement, forwardRef, type ComponentType, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  coupleStreak,
  dailySnapshot,
  revealSnapshot,
  waitingSnapshot,
  writerSnapshot,
} from '../../../../tests/unit/stores/dailyQuestionFixture';
import { setOnline } from '../../../../tests/unit/stores/navigatorFixtures';

const fetchDailyDay = vi.fn();
const fetchCoupleStreak = vi.fn();

const motion = vi.hoisted(() => ({ reduce: false }));

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../hooks/useDailyPickListener', () => ({ useDailyPickListener: () => {} }));

vi.mock('../../../api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/dailyQuestionApi')>()),
  fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
  fetchCoupleStreak: (...args: unknown[]) => fetchCoupleStreak(...args),
  announceDailyPick: vi.fn(async () => {}),
}));

const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition']);

// Every `m.<tag>` renders the plain tag marked `data-motion`, so a test can see
// whether a motion component was used at all.
vi.mock('motion/react', () => {
  const byTag = new Map<string, ComponentType>();
  const motionFor = (tag: string) => {
    let component = byTag.get(tag);
    if (!component) {
      component = forwardRef<HTMLElement, Record<string, unknown>>(function Motion(
        { children, ...props },
        ref
      ) {
        const rest = Object.fromEntries(
          Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key))
        );
        return createElement(
          tag,
          { ...rest, 'data-motion': 'true', ref },
          children as ReactNode
        );
      }) as unknown as ComponentType;
      byTag.set(tag, component);
    }
    return component;
  };
  return {
    m: new Proxy({}, { get: (_target, tag: string) => motionFor(tag) }),
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useReducedMotion: () => motion.reduce,
  };
});

import { DAILY_CELEBRATED_KIND, readCelebrated } from '../../../services/dailyCelebrated';
import { openMyLoveDB } from '../../../services/dbSchema';
import { deleteAccountCopies, writeLocalCopy } from '../../../services/localCopy';
import { useAppStore } from '../../../stores/useAppStore';
import { DailyQuestion } from '../DailyQuestion';

const SAME_DAY = new Date(2026, 10, 5, 12);
const USER = 'USER-A-ID';

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });
const okStreak = (overrides: Parameters<typeof coupleStreak>[0] = {}) => ({
  status: 'ok' as const,
  streak: coupleStreak(overrides),
});

/** The device last celebrated `held`; the server now answers `streak`. */
async function celebratedAt(held: number, milestones = 0) {
  await writeLocalCopy(USER, DAILY_CELEBRATED_KIND, { held, milestones });
}

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchCoupleStreak.mockReset();
  fetchCoupleStreak.mockResolvedValue({ status: 'unlinked' });
  motion.reduce = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser(USER);
  useAppStore.setState({
    partner: { id: 'USER-B-ID', displayName: 'Jessie', email: 'b@example.com' },
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
  const queueDb = await openMyLoveDB();
  await queueDb.clear('pick-queue');
  queueDb.close();
  await deleteAccountCopies(USER);
  useAppStore.setState({ coupleStreak: null, coupleStreakError: null });
});

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
});

describe('the streak +1 on Daily', () => {
  it('first read: seeds the stored value from the streak and plays nothing', async () => {
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 4, milestones: 1 }));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-streak-chip');

    await waitFor(async () =>
      expect(await readCelebrated(USER)).toEqual({ held: 4, milestones: 1 })
    );
    expect(screen.queryByTestId('daily-streak-up')).toBeNull();
  });

  it.each([
    ['equal', 4, 4],
    ['lower', 6, 5],
  ])('%s: no overlay and the stored value stays', async (_label, stored, held) => {
    await celebratedAt(stored);
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held }));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-streak-chip');

    await waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalled());
    expect(screen.queryByTestId('daily-streak-up')).toBeNull();
    expect(await readCelebrated(USER)).toEqual({ held: stored, milestones: 0 });
  });

  it('up: stores the new held at once and plays the overlay rolling to it', async () => {
    await celebratedAt(4, 2);
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 5, run: 3 }));

    render(<DailyQuestion />);

    const overlay = await screen.findByTestId('daily-streak-up');
    expect(overlay).toHaveAttribute('role', 'dialog');
    expect(overlay).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('daily-streak-up-held')).toHaveTextContent('5');
    expect(screen.getByTestId('daily-streak-up-plus')).toHaveTextContent('+1');
    expect(screen.getByTestId('daily-streak-up-message')).toHaveTextContent(
      'You and Jessie both answered.'
    );
    expect(screen.getByTestId('daily-streak-up-message')).toHaveTextContent('3 days in a row!');
    expect(screen.getAllByTestId('daily-streak-up-day')).toHaveLength(7);
    expect(await readCelebrated(USER)).toEqual({ held: 5, milestones: 2 });
  });

  it('run 1: "1 day in a row!"', async () => {
    await celebratedAt(0);
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 1, run: 1 }));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-streak-up-message')).toHaveTextContent(
      '1 day in a row!'
    );
  });

  it('the snapshot on screen is both: the button opens the reveal, and closes the overlay', async () => {
    await celebratedAt(1);
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));
    const user = userEvent.setup();

    render(<DailyQuestion />);

    const button = await screen.findByTestId('daily-streak-up-continue');
    expect(button).toHaveTextContent("See Jessie's pick");
    await user.click(button);

    expect(screen.queryByTestId('daily-streak-up')).toBeNull();
    expect(screen.getByTestId('daily-reveal')).toBeInTheDocument();
  });

  describe('a nameless linked partner', () => {
    beforeEach(() => {
      useAppStore.setState({
        partner: { id: 'USER-B-ID', displayName: '', email: 'b@example.com' },
      } as unknown as Parameters<typeof useAppStore.setState>[0]);
    });

    it('the +1 reads "your partner" within its sentence and its reveal button', async () => {
      await celebratedAt(1);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));

      render(<DailyQuestion />);

      expect(await screen.findByTestId('daily-streak-up-message')).toHaveTextContent(
        'You and your partner both answered.'
      );
      expect(screen.getByTestId('daily-streak-up-continue')).toHaveTextContent(
        "See your partner's pick"
      );
    });

    it('the milestone screen reads "your partner" within its sentence', async () => {
      await celebratedAt(24, 0);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 25, milestones: 1 }));
      const user = userEvent.setup();

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-streak-up-continue'));

      expect(await screen.findByTestId('daily-milestone-message')).toHaveTextContent(
        'You and your partner have answered together on 25 days.'
      );
    });
  });

  it('catch-up: the snapshot is not both, so the button says Continue', async () => {
    await celebratedAt(1);
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-streak-up-continue')).toHaveTextContent('Continue');
  });

  it('a reload (a new mount) never replays it', async () => {
    await celebratedAt(1);
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));
    const user = userEvent.setup();

    const first = render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-streak-up-continue'));
    first.unmount();
    useAppStore.setState({ coupleStreak: null, dailyDay: null });

    render(<DailyQuestion />);
    await screen.findByTestId('daily-streak-chip');
    await waitFor(() =>
      expect(screen.getByTestId('daily-question-view')).toHaveAttribute('data-streak-claimed', '2')
    );

    expect(screen.queryByTestId('daily-streak-up')).toBeNull();
  });

  it('a second read of the same held total is no new play', async () => {
    await celebratedAt(1);
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-streak-up');
    // A second answer of the same held total (the listener re-reads) is no new play.
    await useAppStore.getState().loadCoupleStreak();

    expect(screen.getAllByTestId('daily-streak-up')).toHaveLength(1);
    expect(await readCelebrated(USER)).toEqual({ held: 2, milestones: 0 });
  });

  it('a partner pick arriving while Daily is open plays it for the first picker', async () => {
    await celebratedAt(1);
    fetchDailyDay.mockResolvedValue(ok(waitingSnapshot()));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 1 }));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-streak-chip');
    expect(screen.queryByTestId('daily-streak-up')).toBeNull();

    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));
    await useAppStore.getState().loadCoupleStreak();

    expect(await screen.findByTestId('daily-streak-up-held')).toHaveTextContent('2');
  });

  it("claims nothing before this mount's own read of the day has answered", async () => {
    await celebratedAt(1);
    // A short-lived mount (the dock's walk through Home) must not store a held
    // total it never gets to play: the saved day and streak are in the store.
    useAppStore.setState({
      dailyDay: ok(revealSnapshot('this', 'that')),
      coupleStreak: okStreak({ held: 2 }),
    });
    fetchDailyDay.mockReturnValue(new Promise(() => {}));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-streak-chip');

    expect(screen.queryByTestId('daily-streak-up')).toBeNull();
    expect(await readCelebrated(USER)).toEqual({ held: 1, milestones: 0 });
  });

  it('a write failure plays nothing and logs', async () => {
    await celebratedAt(1);
    const celebrated = await import('../../../services/dailyCelebrated');
    const failure = new Error('disk full');
    vi.spyOn(celebrated, 'claimCelebration').mockRejectedValue(failure);
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-streak-chip');

    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        '[DailyQuestion] Could not record the streak celebration:',
        failure
      )
    );
    expect(screen.queryByTestId('daily-streak-up')).toBeNull();
  });

  it('the write sheet waits while the overlay shows, and opens after it closes', async () => {
    await celebratedAt(1);
    fetchDailyDay.mockResolvedValue(
      ok(writerSnapshot('this', { state: 'both', partner_choice: 'that', same: false }))
    );
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));
    const user = userEvent.setup();

    render(<DailyQuestion />);

    await user.click(await screen.findByTestId('daily-streak-up-continue'));
    expect(screen.queryByTestId('daily-streak-up')).toBeNull();
    expect(await screen.findByTestId('daily-write-sheet')).toBeInTheDocument();
  });

  it('the write sheet is not up while the overlay is', async () => {
    await celebratedAt(1);
    fetchDailyDay.mockResolvedValue(
      ok(writerSnapshot('this', { state: 'both', partner_choice: 'that', same: false }))
    );
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-streak-up');

    expect(screen.queryByTestId('daily-write-sheet')).toBeNull();
  });

  describe('the milestone after the +1', () => {
    it('a milestone: the +1 first, its button opens the milestone, Continue reveals the card', async () => {
      await celebratedAt(24, 0);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 25, milestones: 1 }));
      const user = userEvent.setup();

      render(<DailyQuestion />);

      expect(await screen.findByTestId('daily-streak-up')).toBeInTheDocument();
      expect(screen.queryByTestId('daily-milestone')).toBeNull();
      // The button opens the milestone, not the reveal, so it does not say "See ...".
      expect(screen.getByTestId('daily-streak-up-continue')).toHaveTextContent('Continue');
      await user.click(screen.getByTestId('daily-streak-up-continue'));

      const milestone = await screen.findByTestId('daily-milestone');
      expect(milestone).toHaveAttribute('role', 'dialog');
      expect(milestone).toHaveAttribute('aria-modal', 'true');
      expect(screen.queryByTestId('daily-streak-up')).toBeNull();
      expect(screen.getByTestId('daily-milestone-held')).toHaveTextContent('25');
      expect(screen.getByTestId('daily-milestone-message')).toHaveTextContent(
        'You and Jessie have answered together on 25 days.'
      );
      expect(await readCelebrated(USER)).toEqual({ held: 25, milestones: 1 });

      await user.click(screen.getByTestId('daily-milestone-continue'));
      expect(screen.queryByTestId('daily-milestone')).toBeNull();
      expect(screen.getByTestId('daily-reveal')).toBeInTheDocument();
    });

    it('Close also reveals the card', async () => {
      await celebratedAt(24, 0);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 25, milestones: 1 }));
      const user = userEvent.setup();

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-streak-up-continue'));
      await user.click(await screen.findByTestId('daily-milestone-close'));

      expect(screen.queryByTestId('daily-milestone')).toBeNull();
      expect(screen.getByTestId('daily-reveal')).toBeInTheDocument();
    });

    it('a plain +1: its button closes straight away, with no milestone screen', async () => {
      await celebratedAt(25, 1);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 26, milestones: 1 }));
      const user = userEvent.setup();

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-streak-up-continue'));

      expect(screen.queryByTestId('daily-streak-up')).toBeNull();
      expect(screen.queryByTestId('daily-milestone')).toBeNull();
      expect(screen.getByTestId('daily-reveal')).toBeInTheDocument();
      expect(await readCelebrated(USER)).toEqual({ held: 26, milestones: 1 });
    });

    it('caught up past one milestone: the screen shows the streak held', async () => {
      await celebratedAt(24, 0);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 27, milestones: 1 }));
      const user = userEvent.setup();

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-streak-up-continue'));

      expect(await screen.findByTestId('daily-milestone-held')).toHaveTextContent('27');
    });

    it('two at once: one screen, 25, 50 and 75 reached, 100 grey', async () => {
      await celebratedAt(40, 1);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 75, milestones: 3 }));
      const user = userEvent.setup();

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-streak-up-continue'));
      await screen.findByTestId('daily-milestone');

      expect(screen.getAllByTestId('daily-milestone')).toHaveLength(1);
      for (const [days, reached] of [
        [25, 'true'],
        [50, 'true'],
        [75, 'true'],
        [100, 'false'],
      ] as const) {
        expect(screen.getByTestId(`daily-milestone-badge-${days}`)).toHaveAttribute(
          'data-reached',
          reached
        );
      }
      expect(await readCelebrated(USER)).toEqual({ held: 75, milestones: 3 });
    });

    it('stored milestones ahead: the +1 closes with no milestone screen', async () => {
      await celebratedAt(30, 2);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 31, milestones: 1 }));
      const user = userEvent.setup();

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-streak-up-continue'));

      expect(screen.queryByTestId('daily-milestone')).toBeNull();
      expect(await readCelebrated(USER)).toEqual({ held: 31, milestones: 2 });
    });

    it('seed: a first read with a milestone stores it and plays nothing', async () => {
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 30, milestones: 1 }));

      render(<DailyQuestion />);
      await screen.findByTestId('daily-streak-chip');

      await waitFor(async () =>
        expect(await readCelebrated(USER)).toEqual({ held: 30, milestones: 1 })
      );
      expect(screen.queryByTestId('daily-streak-up')).toBeNull();
      expect(screen.queryByTestId('daily-milestone')).toBeNull();
    });

    it('a reload (a new mount) after a milestone shows neither screen', async () => {
      await celebratedAt(24, 0);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 25, milestones: 1 }));
      const user = userEvent.setup();

      const first = render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-streak-up-continue'));
      await user.click(await screen.findByTestId('daily-milestone-continue'));
      first.unmount();
      useAppStore.setState({ coupleStreak: null, dailyDay: null });

      render(<DailyQuestion />);
      await screen.findByTestId('daily-streak-chip');
      await waitFor(() =>
        expect(screen.getByTestId('daily-question-view')).toHaveAttribute(
          'data-streak-claimed',
          '25'
        )
      );

      expect(screen.queryByTestId('daily-streak-up')).toBeNull();
      expect(screen.queryByTestId('daily-milestone')).toBeNull();
    });

    it('the write sheet waits through both stages and opens after the milestone closes', async () => {
      await celebratedAt(24, 0);
      fetchDailyDay.mockResolvedValue(
        ok(writerSnapshot('this', { state: 'both', partner_choice: 'that', same: false }))
      );
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 25, milestones: 1 }));
      const user = userEvent.setup();

      render(<DailyQuestion />);
      await screen.findByTestId('daily-streak-up');
      expect(screen.queryByTestId('daily-write-sheet')).toBeNull();

      await user.click(screen.getByTestId('daily-streak-up-continue'));
      await screen.findByTestId('daily-milestone');
      expect(screen.queryByTestId('daily-write-sheet')).toBeNull();

      await user.click(screen.getByTestId('daily-milestone-continue'));
      expect(await screen.findByTestId('daily-write-sheet')).toBeInTheDocument();
    });

    it('animated by default; Reduce Motion stills the flames and the heart', async () => {
      await celebratedAt(24, 0);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 25, milestones: 1 }));
      const user = userEvent.setup();

      const first = render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-streak-up-continue'));
      const heart = await screen.findByTestId('daily-milestone-heart');
      expect(heart).toHaveAttribute('data-animated', 'true');
      expect(heart.querySelectorAll('[class*="animate-"]')).toHaveLength(3);
      first.unmount();

      motion.reduce = true;
      await celebratedAt(24, 0);
      useAppStore.setState({ coupleStreak: null, dailyDay: null });
      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-streak-up-continue'));
      const still = await screen.findByTestId('daily-milestone-heart');

      expect(still).toHaveAttribute('data-animated', 'false');
      expect(still.querySelectorAll('[class*="animate-"]')).toHaveLength(0);
    });
  });

  describe('motion', () => {
    it('plays with motion components by default', async () => {
      await celebratedAt(1);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));

      render(<DailyQuestion />);
      const overlay = await screen.findByTestId('daily-streak-up');

      expect(overlay.querySelectorAll('[data-motion]').length).toBeGreaterThan(0);
    });

    it('Reduce Motion: the end state, with no motion element at all', async () => {
      motion.reduce = true;
      await celebratedAt(1);
      fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2 }));

      render(<DailyQuestion />);
      const overlay = await screen.findByTestId('daily-streak-up');

      expect(overlay.querySelectorAll('[data-motion]')).toHaveLength(0);
      expect(screen.getByTestId('daily-streak-up-held')).toHaveTextContent('2');
      expect(screen.getByTestId('daily-streak-up-plus')).toHaveTextContent('+1');
      expect(screen.getByTestId('daily-streak-up-message')).toHaveTextContent(
        'You and Jessie both answered.'
      );
      const days = screen.getAllByTestId('daily-streak-up-day');
      expect(days.at(-1)).toHaveAttribute('data-state', 'done');
    });
  });
});
