/**
 * PastQuestionsPage: the Partner view's history page -- its summary from the
 * streak, one row per day both partners picked with the picks and the server's
 * Same or Different, the sentinel that asks the slice for the next page, and
 * the back arrow (one entry back when the app created it, a replace to
 * `/partner` on a fresh load).
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  coupleStreak,
  dailySnapshot,
  revealSnapshot,
} from '../../../../tests/unit/stores/dailyQuestionFixture';

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

import { PastQuestionsPage } from '../PastQuestionsPage';

const state = {
  showPartnerPage: vi.fn(),
  loadMoreDailyHistory: vi.fn(async () => {}),
  loadDailyHistory: vi.fn(async () => {}),
  dailyHistoryEnd: false,
  dailyHistoryLoading: false,
  dailyHistoryError: null as string | null,
  dailyHistoryErrorOffline: false,
  dailyHistoryLoadingMore: false,
  dailyHistoryErrorMore: false,
  syncStatus: { isOnline: true },
};

const day = (
  id: string,
  mine: 'this' | 'that',
  theirs: 'this' | 'that',
  date = '2026-11-04',
  question = { this: `${id} this`, that: `${id} that` }
) => ({ ...revealSnapshot(mine, theirs), day_id: id, day: date, question });

// Captured so a test can say what the observer sees.
let observers: Array<{
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observed: Element[];
  disconnect: ReturnType<typeof vi.fn>;
}> = [];

class FakeObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observers.push({ callback, options, observed: [], disconnect: vi.fn() });
    this.entry = observers[observers.length - 1];
  }
  entry: (typeof observers)[number];
  observe(el: Element) {
    this.entry.observed.push(el);
  }
  disconnect() {
    this.entry.disconnect();
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

const intersect = (isIntersecting: boolean) =>
  observers[observers.length - 1].callback(
    [{ isIntersecting } as IntersectionObserverEntry],
    {} as IntersectionObserver
  );

function renderPage(
  overrides: Partial<Parameters<typeof PastQuestionsPage>[0]> = {}
) {
  return render(
    <PastQuestionsPage
      partnerName="Jessie"
      history={[day('d1', 'this', 'this')]}
      streak={coupleStreak({ same: 9, done: 13 })}
      {...overrides}
    />
  );
}

describe('PastQuestionsPage', () => {
  beforeEach(() => {
    cleanup();
    observers = [];
    state.showPartnerPage = vi.fn();
    state.loadMoreDailyHistory = vi.fn(async () => {});
    state.loadDailyHistory = vi.fn(async () => {});
    state.dailyHistoryEnd = false;
    state.dailyHistoryLoading = false;
    state.dailyHistoryError = null;
    state.dailyHistoryErrorOffline = false;
    state.dailyHistoryLoadingMore = false;
    state.dailyHistoryErrorMore = false;
    state.syncStatus = { isOnline: true };
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    window.history.replaceState(null, '', '/partner/history');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  describe('content', () => {
    it('shows the title and the summary from the streak', () => {
      renderPage();

      expect(screen.getByTestId('partner-history-title')).toHaveTextContent('Past questions');
      expect(screen.getByTestId('partner-history-summary')).toHaveTextContent(
        'Same pick on 9 of your 13 days'
      );
    });

    it('says day when one day is done', () => {
      renderPage({ streak: coupleStreak({ same: 1, done: 1 }) });

      expect(screen.getByTestId('partner-history-summary')).toHaveTextContent(
        /^Same pick on 1 of your 1 day$/
      );
    });

    it('shows no summary without an ok streak', () => {
      renderPage({ streak: null });

      expect(screen.queryByTestId('partner-history-summary')).not.toBeInTheDocument();
      expect(screen.getByTestId('partner-history-title')).toBeInTheDocument();
    });

    it('shows a row per day, in the order given, with the question and both picks', () => {
      renderPage({
        history: [
          day('d2', 'this', 'that', '2026-11-05', { this: 'Tea', that: 'Coffee' }),
          day('d1', 'that', 'that', '2026-11-04', { this: 'Winter', that: 'Summer' }),
        ],
      });

      const rows = screen.getAllByTestId('partner-history-row');
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByTestId('partner-history-question')).toHaveTextContent(
        'Tea or Coffee?'
      );
      expect(within(rows[0]).getByTestId('partner-history-mine')).toHaveTextContent('You: Tea');
      expect(within(rows[0]).getByTestId('partner-history-theirs')).toHaveTextContent(
        'Jessie: Coffee'
      );
      expect(within(rows[1]).getByTestId('partner-history-question')).toHaveTextContent(
        'Winter or Summer?'
      );
    });

    it('colours the chips from the kit', () => {
      renderPage();

      expect(screen.getByTestId('partner-history-mine')).toHaveClass('bg-tint', 'text-accent');
      expect(screen.getByTestId('partner-history-theirs')).toHaveClass('bg-ptint', 'text-partner');
    });

    it('marks Same with a check from the server flag, Different with the word alone', () => {
      renderPage({
        history: [day('d2', 'this', 'this'), { ...day('d1', 'this', 'that'), same: false }],
      });

      const [same, different] = screen.getAllByTestId('partner-history-row');
      expect(same).toHaveAttribute('data-same', 'true');
      expect(within(same).getByTestId('partner-history-mark')).toHaveTextContent(/^Same$/);
      expect(same.querySelector('svg.lucide-check')).not.toBeNull();
      expect(different).toHaveAttribute('data-same', 'false');
      expect(within(different).getByTestId('partner-history-mark')).toHaveTextContent(/^Different$/);
      expect(different.querySelector('svg.lucide-check')).toBeNull();
    });

    it('trusts the server flag over the choices', () => {
      renderPage({ history: [{ ...day('d1', 'this', 'that'), same: true }] });

      expect(screen.getByTestId('partner-history-row')).toHaveAttribute('data-same', 'true');
    });

    it('skips a day that is not both or lacks a choice', () => {
      renderPage({
        history: [
          dailySnapshot({ day_id: 'half', state: 'me', my_choice: 'this' }),
          { ...day('nochoice', 'this', 'this'), partner_choice: null },
          day('d2', 'this', 'this'),
        ],
      });

      expect(screen.getAllByTestId('partner-history-row')).toHaveLength(1);
    });

    it('formats the date with weekday, month and day, and the year outside this one', () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 7, 12) });
      renderPage({
        history: [day('d2', 'this', 'this', '2026-11-04'), day('d1', 'this', 'this', '2025-11-04')],
      });

      const dates = screen.getAllByTestId('partner-history-date');
      expect(dates[0]).toHaveTextContent(/^Wed, Nov 4$/);
      expect(dates[1]).toHaveTextContent(/^Tue, Nov 4, 2025$/);
    });

    it('scrolls to the top on mount', () => {
      const scrollTo = vi.fn();
      vi.stubGlobal('scrollTo', scrollTo);
      renderPage();

      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('loading and errors', () => {
    it('shows the loading block while the first read runs with no rows', () => {
      state.dailyHistoryLoading = true;
      renderPage({ history: [] });

      expect(screen.getByTestId('partner-history-loading')).toBeVisible();
      expect(screen.getByTestId('partner-history-loading')).toHaveTextContent(
        'Loading your past questions...'
      );
      expect(screen.queryByTestId('partner-history-error')).not.toBeInTheDocument();
    });

    it('shows the error above an empty list once the first read failed', () => {
      state.dailyHistoryError = 'You are offline. Past questions needs a connection to load.';
      renderPage({ history: [] });

      expect(screen.getByTestId('partner-history-error')).toBeVisible();
      expect(screen.getByTestId('partner-history-error')).toHaveTextContent(
        'You are offline. Past questions needs a connection to load.'
      );
      expect(screen.queryByTestId('partner-history-row')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-history-loading')).not.toBeInTheDocument();
    });

    it('keeps the rows and shows the error under them when a later page failed', () => {
      state.dailyHistoryError = 'Could not load your past questions.';
      renderPage();

      expect(screen.getAllByTestId('partner-history-row')).toHaveLength(1);
      const error = screen.getByTestId('partner-history-error');
      expect(error).toHaveTextContent('Could not load your past questions.');
      const card = screen.getByTestId('partner-history-row').parentElement!;
      expect(card.nextElementSibling).toBe(error);
      expect(error.nextElementSibling).toBe(screen.getByTestId('partner-history-sentinel'));
    });

    it('shows no offline refusal under rows still shown while offline', () => {
      state.syncStatus = { isOnline: false };
      state.dailyHistoryError = 'You are offline. Past questions needs a connection to load.';
      state.dailyHistoryErrorOffline = true;
      renderPage();

      expect(screen.getAllByTestId('partner-history-row')).toHaveLength(1);
      expect(screen.queryByTestId('partner-history-error')).not.toBeInTheDocument();
    });

    it('shows no offline refusal under the rows once back online, before the re-read answers', () => {
      state.syncStatus = { isOnline: true };
      state.dailyHistoryError = 'You are offline. Past questions needs a connection to load.';
      state.dailyHistoryErrorOffline = true;
      renderPage();

      expect(screen.getAllByTestId('partner-history-row')).toHaveLength(1);
      expect(screen.queryByTestId('partner-history-error')).not.toBeInTheDocument();
    });

    it('still shows the offline refusal above an empty list', () => {
      state.syncStatus = { isOnline: false };
      state.dailyHistoryError = 'You are offline. Past questions needs a connection to load.';
      state.dailyHistoryErrorOffline = true;
      renderPage({ history: [] });

      expect(screen.getByTestId('partner-history-error')).toHaveTextContent(
        'You are offline. Past questions needs a connection to load.'
      );
    });

    it('offers Retry under the rows after a failed load-more online, which asks for the page again', async () => {
      state.dailyHistoryError = 'Could not load your past questions.';
      state.dailyHistoryErrorMore = true;
      renderPage();
      expect(state.loadMoreDailyHistory).not.toHaveBeenCalled();

      const retry = within(screen.getByTestId('partner-history-error')).getByTestId(
        'partner-history-retry'
      );
      expect(retry).toBeEnabled();
      await userEvent.setup().click(retry);

      expect(state.loadMoreDailyHistory).toHaveBeenCalledTimes(1);
      expect(state.loadDailyHistory).not.toHaveBeenCalled();
    });

    it('after a failed first-page re-read over the rows, Retry re-reads the first page', async () => {
      state.dailyHistoryError = 'Could not load your past questions.';
      state.dailyHistoryEnd = true;
      renderPage();

      await userEvent.setup().click(screen.getByTestId('partner-history-retry'));

      expect(state.loadDailyHistory).toHaveBeenCalledTimes(1);
      expect(state.loadMoreDailyHistory).not.toHaveBeenCalled();
    });

    it('disables a first-page Retry while that read is in flight', () => {
      state.dailyHistoryError = 'Could not load your past questions.';
      state.dailyHistoryLoading = true;
      renderPage();

      expect(screen.getByTestId('partner-history-retry')).toBeDisabled();
    });

    it('disables Retry while a load-more is in flight', () => {
      state.dailyHistoryError = 'Could not load your past questions.';
      state.dailyHistoryErrorMore = true;
      state.dailyHistoryLoadingMore = true;
      renderPage();

      expect(screen.getByTestId('partner-history-retry')).toBeDisabled();
    });

    it('offers no Retry for a failed load-more at the end of the list, where there is no more to ask for', () => {
      state.dailyHistoryError = 'Could not load your past questions.';
      state.dailyHistoryErrorMore = true;
      state.dailyHistoryEnd = true;
      renderPage();

      expect(screen.getByTestId('partner-history-error')).toBeVisible();
      expect(screen.queryByTestId('partner-history-retry')).not.toBeInTheDocument();
    });

    it('offers no Retry above an empty list or while offline', () => {
      state.dailyHistoryError = 'Could not load your past questions.';
      renderPage({ history: [] });
      expect(screen.getByTestId('partner-history-error')).toBeVisible();
      expect(screen.queryByTestId('partner-history-retry')).not.toBeInTheDocument();

      cleanup();
      state.syncStatus = { isOnline: false };
      renderPage();
      expect(screen.getByTestId('partner-history-error')).toBeVisible();
      expect(screen.queryByTestId('partner-history-retry')).not.toBeInTheDocument();
    });

    it('shows no loading block or error when the read succeeded', () => {
      renderPage();

      expect(screen.queryByTestId('partner-history-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-history-error')).not.toBeInTheDocument();
    });
  });

  describe('paging', () => {
    it('observes the sentinel after the last row with a 600px bottom margin', () => {
      renderPage();

      expect(observers).toHaveLength(1);
      expect(observers[0].options).toEqual({ rootMargin: '0px 0px 600px 0px' });
      expect(observers[0].observed).toEqual([screen.getByTestId('partner-history-sentinel')]);
      const card = screen.getByTestId('partner-history-row').parentElement!;
      expect(card.nextElementSibling).toBe(screen.getByTestId('partner-history-sentinel'));
    });

    it('asks the slice for more when the sentinel comes into view, and not when it leaves', () => {
      renderPage();

      intersect(false);
      expect(state.loadMoreDailyHistory).not.toHaveBeenCalled();
      intersect(true);
      expect(state.loadMoreDailyHistory).toHaveBeenCalledTimes(1);
    });

    it('watches again when rows are added, so a sentinel still in view loads the next page', () => {
      const { rerender } = renderPage();

      rerender(
        <PastQuestionsPage
          partnerName="Jessie"
          history={[day('d2', 'this', 'this'), day('d1', 'this', 'this')]}
          streak={null}
        />
      );

      expect(observers).toHaveLength(2);
      expect(observers[0].disconnect).toHaveBeenCalled();
    });

    it('watches again when the device comes back online, so a failed "more" is retried', () => {
      state.syncStatus = { isOnline: false };
      const { rerender } = renderPage();
      expect(observers).toHaveLength(1);

      state.syncStatus = { isOnline: true };
      rerender(
        <PastQuestionsPage
          partnerName="Jessie"
          history={[day('d1', 'this', 'this')]}
          streak={coupleStreak({ same: 9, done: 13 })}
        />
      );

      expect(observers).toHaveLength(2);
      expect(observers[0].disconnect).toHaveBeenCalled();
    });

    it('watches again once a first-page refresh settles with the same rows, so a sentinel in view loads the next page', () => {
      const props = {
        partnerName: 'Jessie',
        history: [day('d1', 'this', 'this')],
        streak: coupleStreak({ same: 9, done: 13 }),
      };
      const { rerender } = renderPage();
      expect(observers).toHaveLength(1);

      state.dailyHistoryLoading = true;
      rerender(<PastQuestionsPage {...props} />);
      expect(observers[0].disconnect).toHaveBeenCalled();
      expect(observers).toHaveLength(1);

      state.dailyHistoryLoading = false;
      rerender(<PastQuestionsPage {...props} />);
      expect(observers).toHaveLength(2);

      intersect(true);
      expect(state.loadMoreDailyHistory).toHaveBeenCalledTimes(1);
    });

    it('does not watch while a first page has failed, and watches again once it is read', () => {
      const props = {
        partnerName: 'Jessie',
        history: [day('d1', 'this', 'this')],
        streak: coupleStreak({ same: 9, done: 13 }),
      };
      state.dailyHistoryError = 'Could not load your past questions.';
      const { rerender } = renderPage();
      expect(observers).toHaveLength(0);

      state.dailyHistoryError = null;
      rerender(<PastQuestionsPage {...props} />);
      expect(observers).toHaveLength(1);
    });

    it('still watches after a failed load-more, which the next page answers', () => {
      state.dailyHistoryError = 'Could not load your past questions.';
      state.dailyHistoryErrorMore = true;
      renderPage();

      expect(observers).toHaveLength(1);
    });

    it('does not watch at the end of the history', () => {
      state.dailyHistoryEnd = true;
      renderPage();

      expect(observers).toHaveLength(0);
    });

    it('skips the observer where IntersectionObserver is not defined', () => {
      vi.stubGlobal('IntersectionObserver', undefined);

      expect(() => renderPage()).not.toThrow();
      expect(screen.getByTestId('partner-history-row')).toBeInTheDocument();
    });
  });

  describe('back', () => {
    it('names the partner on the arrow', () => {
      renderPage();

      expect(screen.getByTestId('partner-history-back')).toHaveAccessibleName('Back to Jessie');
    });

    it('goes back one entry when the app created this one', async () => {
      const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
      window.history.replaceState({ inApp: true, depth: 2 }, '', '/partner/history');
      renderPage();

      await userEvent.click(screen.getByTestId('partner-history-back'));

      expect(back).toHaveBeenCalledTimes(1);
      expect(state.showPartnerPage).not.toHaveBeenCalled();
      back.mockRestore();
    });

    it('replaces the entry with /partner on a fresh load, keeping the length', async () => {
      const length = window.history.length;
      const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
      renderPage();

      await userEvent.click(screen.getByTestId('partner-history-back'));

      expect(back).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/partner');
      expect(window.history.length).toBe(length);
      expect(state.showPartnerPage).toHaveBeenCalledWith('');
      back.mockRestore();
    });
  });
});
