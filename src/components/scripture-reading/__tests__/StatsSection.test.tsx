/**
 * StatsSection Component Tests
 *
 * Story 3.1: Couple-Aggregate Stats Dashboard
 * Unit tests for the presentational StatsSection component.
 *
 * Tests:
 * - 3.1-UNIT-001 (P1): Renders 5 stat cards with correct values
 * - 3.1-UNIT-002 (P1): Skeleton loading when isLoading=true and stats=null
 * - 3.1-UNIT-003 (P1): Stale-while-revalidate (cached stats shown during refresh)
 * - 3.1-UNIT-004 (P1): Zero-state rendering (em dashes + message)
 * - 3.1-UNIT-008 (P2): No gamification language in labels
 * - 3.1-UNIT-009 (P2): Last completed renders as relative time
 * - 3.1-UNIT-010 (P2): Average rating renders with 1 decimal
 * - 3.1-UNIT-011 (P2): Glass morphism card classes present
 * - 3.1-UNIT-012 (P2): Stat values have aria-label attributes
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsSection } from '../overview/StatsSection';
import type { CoupleStats } from '../../../stores/types';

const populatedStats: CoupleStats = {
  totalSessions: 12,
  totalSteps: 204,
  lastCompleted: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  avgRating: 3.8,
  bookmarkCount: 47,
};

const zeroStats: CoupleStats = {
  totalSessions: 0,
  totalSteps: 0,
  lastCompleted: null,
  avgRating: 0,
  bookmarkCount: 0,
};

describe('StatsSection', () => {
  // ============================================
  // 3.1-UNIT-001 (P1): Renders 5 stat cards with correct values
  // ============================================
  describe('Populated state rendering', () => {
    it('should render the stats section container', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      expect(screen.getByTestId('scripture-stats-section')).toBeInTheDocument();
    });

    it('should render sessions completed card with value "12"', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const card = screen.getByTestId('scripture-stats-sessions');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('12');
      expect(card).toHaveTextContent('Sessions Completed');
    });

    it('should render steps completed card with value "204"', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const card = screen.getByTestId('scripture-stats-steps');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('204');
      expect(card).toHaveTextContent('Steps Completed');
    });

    it('should render last completed card with relative time', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const card = screen.getByTestId('scripture-stats-last-completed');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent(/\d+\s+days?\s+ago|Today/i);
      expect(card).toHaveTextContent('Last Completed');
    });

    it('should render average rating card with value "3.8"', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const card = screen.getByTestId('scripture-stats-avg-rating');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('3.8');
      expect(card).toHaveTextContent('Average Rating');
    });

    it('should render bookmarks card with value "47"', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const card = screen.getByTestId('scripture-stats-bookmarks');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('47');
      expect(card).toHaveTextContent('Bookmarks Saved');
    });

    it('should render section heading "Your Journey"', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      expect(screen.getByText('Your Journey')).toBeInTheDocument();
    });
  });

  // ============================================
  // 3.1-UNIT-002 (P1): Skeleton loading when isLoading=true and stats=null
  // ============================================
  describe('Skeleton loading state', () => {
    it('should show skeleton loading container when isLoading=true and stats=null', () => {
      render(<StatsSection stats={null} isLoading={true} />);
      expect(screen.getByTestId('scripture-stats-skeleton')).toBeInTheDocument();
      expect(screen.queryByTestId('scripture-stats-section')).not.toBeInTheDocument();
    });

    it('should render skeleton cards with animate-pulse', () => {
      render(<StatsSection stats={null} isLoading={true} />);
      const skeleton = screen.getByTestId('scripture-stats-skeleton');
      const pulseElements = skeleton.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThanOrEqual(5);
    });

    it('should have aria-busy="true" on skeleton section', () => {
      render(<StatsSection stats={null} isLoading={true} />);
      const skeleton = screen.getByTestId('scripture-stats-skeleton');
      expect(skeleton.getAttribute('aria-busy')).toBe('true');
    });
  });

  // ============================================
  // 3.1-UNIT-003 (P1): Stale-while-revalidate
  // Shows cached stats (not skeleton) when isLoading=true but stats non-null
  // ============================================
  describe('Stale-while-revalidate', () => {
    it('should show cached stats (not skeleton) when isLoading=true and stats exist', () => {
      render(<StatsSection stats={populatedStats} isLoading={true} />);
      expect(screen.getByTestId('scripture-stats-section')).toBeInTheDocument();
      expect(screen.queryByTestId('scripture-stats-skeleton')).not.toBeInTheDocument();
      expect(screen.getByTestId('scripture-stats-sessions')).toHaveTextContent('12');
      expect(screen.getByTestId('scripture-stats-steps')).toHaveTextContent('204');
    });
  });

  // ============================================
  // 3.1-UNIT-004 (P1): Zero-state rendering
  // ============================================
  describe('Zero-state rendering', () => {
    it('should show em dashes for all metric values when stats are all zeros', () => {
      render(<StatsSection stats={zeroStats} isLoading={false} />);
      expect(screen.getByTestId('scripture-stats-sessions')).toHaveTextContent('\u2014');
      expect(screen.getByTestId('scripture-stats-steps')).toHaveTextContent('\u2014');
      expect(screen.getByTestId('scripture-stats-last-completed')).toHaveTextContent('\u2014');
      expect(screen.getByTestId('scripture-stats-avg-rating')).toHaveTextContent('\u2014');
      expect(screen.getByTestId('scripture-stats-bookmarks')).toHaveTextContent('\u2014');
    });

    it('should show "Begin your first reading" zero-state message', () => {
      render(<StatsSection stats={zeroStats} isLoading={false} />);
      expect(screen.getByTestId('scripture-stats-zero-state')).toBeInTheDocument();
      expect(screen.getByText('Begin your first reading')).toBeInTheDocument();
    });

    it('should NOT show zero-state message when stats have values', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      expect(screen.queryByTestId('scripture-stats-zero-state')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 3.1-UNIT-008 (P2): No gamification language
  // ============================================
  describe('No gamification language', () => {
    it('should use neutral stat labels without gamification language', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const section = screen.getByTestId('scripture-stats-section');
      const sectionText = section.textContent ?? '';

      expect(sectionText).toContain('Sessions Completed');
      expect(sectionText).toContain('Steps Completed');
      expect(sectionText).toContain('Last Completed');
      expect(sectionText).toContain('Average Rating');
      expect(sectionText).toContain('Bookmarks Saved');

      expect(sectionText).not.toMatch(/streak/i);
      expect(sectionText).not.toMatch(/keep it up/i);
      expect(sectionText).not.toMatch(/fire/i);
      expect(sectionText).not.toMatch(/crush/i);
      expect(sectionText).not.toMatch(/amazing/i);
      expect(sectionText).not.toMatch(/great job/i);
    });
  });

  // ============================================
  // 3.1-UNIT-009 (P2): Last completed as relative time
  // ============================================
  describe('Relative time formatting', () => {
    it('should render last completed date as relative time', () => {
      const pastStats: CoupleStats = {
        ...populatedStats,
        lastCompleted: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      };
      render(<StatsSection stats={pastStats} isLoading={false} />);
      const card = screen.getByTestId('scripture-stats-last-completed');
      expect(card.textContent).toMatch(/\d+\s+days?\s+ago|Today/i);
    });

    it('should show em dash for last completed when null with non-zero stats', () => {
      const nullLastStats: CoupleStats = { ...populatedStats, lastCompleted: null };
      render(<StatsSection stats={nullLastStats} isLoading={false} />);
      const card = screen.getByTestId('scripture-stats-last-completed');
      expect(card).toHaveTextContent('\u2014');
    });
  });

  // ============================================
  // 3.1-UNIT-010 (P2): Average rating with 1 decimal
  // ============================================
  describe('Average rating formatting', () => {
    it('should render average rating with 1 decimal place', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const card = screen.getByTestId('scripture-stats-avg-rating');
      expect(card).toHaveTextContent('3.8');
    });

    it('should render whole number rating with 1 decimal (e.g., "4.0")', () => {
      const wholeRatingStats: CoupleStats = { ...populatedStats, avgRating: 4 };
      render(<StatsSection stats={wholeRatingStats} isLoading={false} />);
      const card = screen.getByTestId('scripture-stats-avg-rating');
      expect(card).toHaveTextContent('4.0');
    });
  });

  // ============================================
  // 3.1-UNIT-011 (P2): Glass morphism card classes
  // ============================================
  describe('Glass morphism styling', () => {
    it('should apply glass morphism classes to stat cards', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const sessionsCard = screen.getByTestId('scripture-stats-sessions');
      expect(sessionsCard.className).toContain('backdrop-blur-sm');
      expect(sessionsCard.className).toContain('bg-white/80');
      expect(sessionsCard.className).toContain('rounded-2xl');
    });

    it('should apply glass morphism to all 5 stat cards', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const testIds = [
        'scripture-stats-sessions',
        'scripture-stats-steps',
        'scripture-stats-last-completed',
        'scripture-stats-avg-rating',
        'scripture-stats-bookmarks',
      ];
      testIds.forEach((testId) => {
        const card = screen.getByTestId(testId);
        expect(card.className).toContain('backdrop-blur-sm');
      });
    });
  });

  // ============================================
  // 3.1-UNIT-012 (P2): Stat values have aria-label attributes
  // ============================================
  describe('Accessibility', () => {
    it('should have aria-label on stats section', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      const section = screen.getByTestId('scripture-stats-section');
      expect(section.getAttribute('aria-label')).toBe('Scripture reading statistics');
    });

    it('should have aria-label on each stat value describing the metric', () => {
      render(<StatsSection stats={populatedStats} isLoading={false} />);
      expect(screen.getByLabelText('12 sessions completed')).toBeInTheDocument();
      expect(screen.getByLabelText('204 steps completed')).toBeInTheDocument();
      expect(screen.getByLabelText(/last completed/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/average rating .* out of 5/i)).toBeInTheDocument();
      expect(screen.getByLabelText('47 bookmarks saved')).toBeInTheDocument();
    });

    it('should have descriptive aria-labels for zero-state values', () => {
      render(<StatsSection stats={zeroStats} isLoading={false} />);
      expect(screen.getByLabelText('No sessions completed')).toBeInTheDocument();
      expect(screen.getByLabelText('No steps completed')).toBeInTheDocument();
    });
  });

  // ============================================
  // Edge case: stats=null and isLoading=false shows zero-state (L2 fix)
  // When RPC fails and no cached data exists, show dashes instead of vanishing.
  // ============================================
  describe('Null state (no data, not loading)', () => {
    it('should show zero-state with dashes when stats is null and isLoading is false', () => {
      render(<StatsSection stats={null} isLoading={false} />);
      expect(screen.getByTestId('scripture-stats-section')).toBeInTheDocument();
      expect(screen.getByTestId('scripture-stats-sessions')).toHaveTextContent('\u2014');
      expect(screen.getByTestId('scripture-stats-zero-state')).toBeInTheDocument();
      expect(screen.getByText('Begin your first reading')).toBeInTheDocument();
    });
  });
});
