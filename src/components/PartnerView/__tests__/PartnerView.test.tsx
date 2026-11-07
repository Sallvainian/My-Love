/**
 * PartnerView: the Partner page. Its states in the old view's order (loading,
 * load error, Connect alone, partner + streak), the streak card's copy and
 * colours, and what the old mood view showed that this one must not.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoupleStreakAnswer } from '../../../api/validation/dailyQuestionSchemas';
import { coupleStreak } from '../../../../tests/unit/stores/dailyQuestionFixture';

vi.mock('../../../hooks/usePartnerStreakListener', () => ({
  usePartnerStreakListener: vi.fn(),
}));
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
}));

import { usePartnerStreakListener } from '../../../hooks/usePartnerStreakListener';
import { PartnerView } from '../PartnerView';

const PARTNER = { id: 'partner-1', email: 'jessie@example.test', displayName: 'Jessie' };

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    partner: PARTNER as typeof PARTNER | null,
    isLoadingPartner: false,
    partnerLoadError: false,
    syncStatus: { isOnline: true },
    loadPartner: vi.fn(async () => {}),
    loadPendingRequests: vi.fn(async () => {}),
    sentRequests: [],
    receivedRequests: [],
    searchResult: null,
    isSearching: false,
    searchUsers: vi.fn(),
    clearSearch: vi.fn(),
    sendPartnerRequest: vi.fn(),
    acceptPartnerRequest: vi.fn(),
    declinePartnerRequest: vi.fn(),
    coupleStreak: null as CoupleStreakAnswer | null,
    coupleStreakLoading: false,
    coupleStreakError: null as string | null,
    loadCoupleStreak: vi.fn(async () => {}),
    ...overrides,
  };
}

let state = makeState();

const okStreak = (overrides: Parameters<typeof coupleStreak>[0] = {}): CoupleStreakAnswer => ({
  status: 'ok',
  streak: coupleStreak(overrides),
});

describe('PartnerView', () => {
  beforeEach(() => {
    cleanup();
    state = makeState();
  });

  describe('page states', () => {
    it('loading the partner: the loading block, and neither Connect nor the card', () => {
      state = makeState({ isLoadingPartner: true, coupleStreak: okStreak() });
      render(<PartnerView />);

      expect(screen.getByText('Loading partner information...')).toBeInTheDocument();
      expect(screen.queryByTestId('partner-streak-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-search-card')).not.toBeInTheDocument();
    });

    it('no partner and a failed read: the load-error card, retry reads the partner again', async () => {
      state = makeState({ partner: null, partnerLoadError: true, coupleStreak: okStreak() });
      render(<PartnerView />);

      expect(screen.getByTestId('partner-load-error')).toBeInTheDocument();
      expect(screen.queryByTestId('partner-search-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-streak-card')).not.toBeInTheDocument();
      state.loadPartner.mockClear();
      screen.getByTestId('partner-load-retry').click();
      expect(state.loadPartner).toHaveBeenCalledTimes(1);
    });

    it('no partner, nothing failed: Connect alone, whatever the slice holds', () => {
      state = makeState({
        partner: null,
        coupleStreak: okStreak({ held: 40 }),
        coupleStreakLoading: true,
      });
      render(<PartnerView />);

      expect(screen.getByTestId('partner-view')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Connect with Your Partner' })
      ).toBeInTheDocument();
      expect(screen.getByTestId('partner-search-card')).toBeInTheDocument();
      expect(screen.queryByTestId('partner-streak-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-streak-loading')).not.toBeInTheDocument();
    });

    it("a partner: the partner's name, then the card", () => {
      state = makeState({ coupleStreak: okStreak() });
      render(<PartnerView />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Jessie');
      expect(screen.getByTestId('partner-streak-card')).toBeInTheDocument();
      expect(screen.queryByTestId('partner-search-card')).not.toBeInTheDocument();
    });

    it('a partner and no streak yet: loading, then the error with nothing to show', () => {
      state = makeState({ coupleStreakLoading: true });
      const { rerender } = render(<PartnerView />);
      expect(screen.getByTestId('partner-streak-loading')).toBeInTheDocument();

      state = makeState({ coupleStreakError: 'The streak could not be read.' });
      rerender(<PartnerView />);
      expect(screen.queryByTestId('partner-streak-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('partner-streak-error')).toHaveTextContent(
        'The streak could not be read.'
      );
    });

    it('a failed refresh leaves the card that is shown', () => {
      state = makeState({ coupleStreak: okStreak(), coupleStreakError: 'boom' });
      render(<PartnerView />);

      expect(screen.getByTestId('partner-streak-card')).toBeInTheDocument();
      expect(screen.queryByTestId('partner-streak-error')).not.toBeInTheDocument();
    });

    it('shows none of the old mood view', () => {
      state = makeState({ coupleStreak: okStreak() });
      render(<PartnerView />);

      expect(screen.queryByTestId('partner-mood-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-mood-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('poke-kiss-interface')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-mood-notification')).not.toBeInTheDocument();
    });
  });

  describe('loading', () => {
    it('reads the partner on mount and the pending requests while online', () => {
      render(<PartnerView />);

      expect(state.loadPartner).toHaveBeenCalledTimes(1);
      expect(state.loadPendingRequests).toHaveBeenCalledTimes(1);
      expect(usePartnerStreakListener).toHaveBeenCalled();
    });

    it('does not read the pending requests offline', () => {
      state = makeState({ syncStatus: { isOnline: false } });
      render(<PartnerView />);

      expect(state.loadPartner).toHaveBeenCalledTimes(1);
      expect(state.loadPendingRequests).not.toHaveBeenCalled();
    });

    it('reads the streak when a partner is present, and not without one', () => {
      render(<PartnerView />);
      expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);

      cleanup();
      state = makeState({ partner: null });
      render(<PartnerView />);
      expect(state.loadCoupleStreak).not.toHaveBeenCalled();
    });

    it("reads the streak again for a different partner (keyed on the partner's id)", () => {
      const { rerender } = render(<PartnerView />);
      expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);

      state = { ...state, partner: { ...PARTNER, id: 'partner-2' } };
      rerender(<PartnerView />);
      expect(state.loadCoupleStreak).toHaveBeenCalledTimes(2);

      // The same partner again is no new read.
      rerender(<PartnerView />);
      expect(state.loadCoupleStreak).toHaveBeenCalledTimes(2);
    });

    it('reads the streak offline too, and again when the device comes back online', () => {
      state = makeState({ syncStatus: { isOnline: false } });
      const { rerender } = render(<PartnerView />);
      expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);

      state = { ...state, syncStatus: { isOnline: true } };
      rerender(<PartnerView />);

      expect(state.loadCoupleStreak).toHaveBeenCalledTimes(2);
    });
  });

  describe('the streak card', () => {
    it('held 1 reads "day"; held 12 reads "days"', () => {
      state = makeState({ coupleStreak: okStreak({ held: 1, run: 1 }) });
      const { rerender } = render(<PartnerView />);
      expect(screen.getByTestId('partner-streak-held')).toHaveTextContent(/^1$/);
      expect(screen.getByTestId('partner-streak-card')).toHaveTextContent('day answered together');
      expect(screen.getByTestId('partner-streak-card')).not.toHaveTextContent('days answered');

      state = makeState({ coupleStreak: okStreak({ held: 12, run: 5 }) });
      rerender(<PartnerView />);
      expect(screen.getByTestId('partner-streak-held')).toHaveTextContent(/^12$/);
      expect(screen.getByTestId('partner-streak-run')).toHaveTextContent(/^5$/);
      expect(screen.getByTestId('partner-streak-card')).toHaveTextContent('days answered together');
      expect(screen.getByTestId('partner-streak-card')).toHaveTextContent('in a row');
    });

    it.each([
      [0, 0, 'Next milestone: 25 days · 25 to go'],
      [24, 0, 'Next milestone: 25 days · 1 to go'],
      [25, 1, 'Next milestone: 50 days · 25 to go'],
      [130, 5, 'Next milestone: 150 days · 20 to go'],
    ])('with %i held the next milestone reads "%s"', (held, milestones, text) => {
      state = makeState({ coupleStreak: okStreak({ held, milestones }) });
      render(<PartnerView />);

      expect(screen.getByTestId('partner-streak-next')).toHaveTextContent(text);
    });

    it.each(['grey', 'orange', 'blue'] as const)('carries data-state %s', (todayState) => {
      state = makeState({ coupleStreak: okStreak({ today_state: todayState }) });
      render(<PartnerView />);

      expect(screen.getByTestId('partner-streak-card')).toHaveAttribute('data-state', todayState);
    });

    it('draws a snowflake for blue and a flame otherwise', () => {
      state = makeState({ coupleStreak: okStreak({ today_state: 'blue', missed: 1 }) });
      const { rerender } = render(<PartnerView />);
      const tileIcon = () => screen.getByTestId('partner-streak-icon').querySelector('svg')!;
      expect(tileIcon().getAttribute('class')).toContain('lucide-snowflake');

      for (const today_state of ['orange', 'grey'] as const) {
        state = makeState({ coupleStreak: okStreak({ today_state }) });
        rerender(<PartnerView />);
        expect(tileIcon().getAttribute('class')).toContain('lucide-flame');
      }
    });

    it('shows seven dates with their states; the last is labelled Today', () => {
      state = makeState({
        coupleStreak: okStreak({
          week: [
            { day: '2030-03-03', state: 'open' },
            { day: '2030-03-04', state: 'done' },
            { day: '2030-03-05', state: 'missed' },
            { day: '2030-03-06', state: 'open' },
            { day: '2030-03-07', state: 'done' },
            { day: '2030-03-08', state: 'missed' },
            { day: '2030-03-09', state: 'done' },
          ],
        }),
      });
      render(<PartnerView />);

      const days = within(screen.getByTestId('partner-streak-week')).getAllByTestId(
        'partner-streak-day'
      );
      expect(days.map((day) => day.getAttribute('data-state'))).toEqual([
        'open',
        'done',
        'missed',
        'open',
        'done',
        'missed',
        'done',
      ]);
      // 2030-03-03 is a Sunday: S M T W T F, read as local dates, then Today.
      expect(days.map((day) => day.textContent)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'Today']);
    });
  });
});
