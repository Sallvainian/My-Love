/**
 * DailyPrayerReport Component Tests
 *
 * Story 2.3: Daily Prayer Report — Send & View (AC: #3, #4, #5)
 *
 * Tests:
 * - Renders user step-by-step ratings for all 17 steps
 * - Renders bookmarked verses with amber indicator
 * - Renders standout verse selections
 * - Reveals partner message in Dancing Script font
 * - Shows waiting text when partner incomplete
 * - Does not render message section when no partner message and partner complete
 * - Return to Overview button calls onReturn
 * - Report heading has tabIndex -1 for programmatic focus
 *
 * TDD Phase: GREEN — component implemented
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DailyPrayerReport } from '../reflection/DailyPrayerReport';
import { SCRIPTURE_STEPS } from '../../../data/scriptureSteps';

describe('DailyPrayerReport', () => {
  const allRatings = Array.from({ length: 17 }, (_, i) => ({
    stepIndex: i,
    rating: (i % 5) + 1,
  }));

  const defaultProps = {
    userRatings: allRatings,
    userBookmarks: [2, 7, 14],
    userStandoutVerses: [2, 14],
    userMessage: null as string | null,
    partnerMessage: null as string | null,
    partnerName: null as string | null,
    partnerRatings: null as { stepIndex: number; rating: number }[] | null,
    partnerBookmarks: null as number[] | null,
    partnerStandoutVerses: null as number[] | null,
    isPartnerComplete: false,
    onReturn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // 2.3-RPT-001: User Step-by-Step Ratings
  // ============================================

  describe('User Ratings', () => {
    it('renders user step-by-step ratings for all 17 steps', () => {
      render(<DailyPrayerReport {...defaultProps} />);
      for (let n = 0; n < 17; n++) {
        expect(screen.getByTestId(`scripture-report-rating-step-${n}`)).toBeDefined();
      }
    });
  });

  // ============================================
  // 2.3-RPT-002: Bookmarked Verses
  // ============================================

  describe('Bookmarked Verses', () => {
    it('renders bookmarked verses with amber indicator', () => {
      render(<DailyPrayerReport {...defaultProps} />);
      // Bookmarked steps should have amber indicator
      for (const bookmarkedStep of [2, 7, 14]) {
        expect(
          screen.getByTestId(`scripture-report-bookmark-indicator-${bookmarkedStep}`)
        ).toBeDefined();
      }
      // Non-bookmarked steps should NOT have amber indicator
      expect(screen.queryByTestId('scripture-report-bookmark-indicator-0')).toBeNull();
      expect(screen.queryByTestId('scripture-report-bookmark-indicator-5')).toBeNull();
    });
  });

  // ============================================
  // 2.3-RPT-003: Standout Verse Selections
  // ============================================

  describe('Standout Verses', () => {
    it('renders standout verse selections', () => {
      render(<DailyPrayerReport {...defaultProps} />);
      const standoutSection = screen.getByTestId('scripture-report-standout-verses');
      expect(standoutSection).toBeDefined();
    });
  });

  // ============================================
  // 2.3-RPT-004: Partner Message
  // ============================================

  describe('Partner Message', () => {
    it('reveals partner message in Dancing Script font', () => {
      render(
        <DailyPrayerReport
          {...defaultProps}
          partnerMessage="You are my everything"
          partnerName="Sarah"
          isPartnerComplete={true}
        />
      );
      const messageCard = screen.getByTestId('scripture-report-partner-message');
      expect(messageCard).toBeDefined();
      expect(messageCard).toHaveTextContent('You are my everything');
      expect(messageCard.className).toContain('font-cursive');
    });
  });

  // ============================================
  // 2.3-RPT-005: Waiting for Partner
  // ============================================

  describe('Partner Waiting State', () => {
    it('shows waiting text when partner incomplete', () => {
      render(
        <DailyPrayerReport
          {...defaultProps}
          partnerName="Sarah"
          isPartnerComplete={false}
        />
      );
      const waitingText = screen.getByTestId('scripture-report-partner-waiting');
      expect(waitingText).toBeDefined();
      expect(waitingText).toHaveTextContent("Waiting for Sarah's reflections");
      expect(waitingText.className).toContain('motion-safe:animate-pulse');
      expect(waitingText.className).toContain('motion-reduce:animate-none');
    });
  });

  // ============================================
  // 2.3-RPT-006: No Message Section When Appropriate
  // ============================================

  describe('No Message Section', () => {
    it('does not render message section when no partner message and partner complete', () => {
      render(
        <DailyPrayerReport
          {...defaultProps}
          partnerMessage={null}
          partnerName="Sarah"
          isPartnerComplete={true}
        />
      );
      expect(screen.queryByTestId('scripture-report-partner-message')).toBeNull();
      expect(screen.queryByTestId('scripture-report-partner-waiting')).toBeNull();
    });
  });

  describe('AC5 Extended Data', () => {
    it('renders partner standout verses when provided', () => {
      render(
        <DailyPrayerReport
          {...defaultProps}
          partnerName="Sarah"
          partnerStandoutVerses={[1, 3]}
          isPartnerComplete={true}
        />
      );
      const section = screen.getByTestId('scripture-report-partner-standout-verses');
      expect(section).toHaveTextContent("Sarah's Standout Verses");
      expect(section).toHaveTextContent(SCRIPTURE_STEPS[1].verseReference);
      expect(section).toHaveTextContent(SCRIPTURE_STEPS[3].verseReference);
    });

    it('renders partner shared bookmark indicators', () => {
      render(<DailyPrayerReport {...defaultProps} partnerBookmarks={[2, 4]} isPartnerComplete={true} />);
      expect(screen.getByTestId('scripture-report-partner-bookmark-indicator-2')).toBeDefined();
      expect(screen.getByTestId('scripture-report-partner-bookmark-indicator-4')).toBeDefined();
      expect(screen.queryByTestId('scripture-report-partner-bookmark-indicator-1')).toBeNull();
    });

    it('renders both partner and user message cards when both exist', () => {
      render(
        <DailyPrayerReport
          {...defaultProps}
          partnerName="Sarah"
          partnerMessage="I prayed for you today"
          userMessage="Thank you for your love"
          isPartnerComplete={true}
        />
      );
      expect(screen.getByTestId('scripture-report-partner-message')).toHaveTextContent(
        'I prayed for you today'
      );
      expect(screen.getByTestId('scripture-report-user-message')).toHaveTextContent(
        'Thank you for your love'
      );
    });
  });

  // ============================================
  // 2.3-RPT-007: Return to Overview
  // ============================================

  describe('Return to Overview', () => {
    it('Return to Overview button calls onReturn', () => {
      const onReturn = vi.fn();
      render(<DailyPrayerReport {...defaultProps} onReturn={onReturn} />);
      fireEvent.click(screen.getByTestId('scripture-report-return-btn'));
      expect(onReturn).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // 2.3-RPT-008: Report Heading Accessibility
  // ============================================

  describe('Accessibility', () => {
    it('report heading has tabIndex -1 for programmatic focus', () => {
      render(<DailyPrayerReport {...defaultProps} />);
      const heading = screen.getByTestId('scripture-report-heading');
      expect(heading.getAttribute('tabindex')).toBe('-1');
    });
  });

  // ============================================
  // 2.3-RPT-009: Rating Values Displayed
  // ============================================

  describe('Rating Values', () => {
    it('displays correct rating number for each step', () => {
      render(<DailyPrayerReport {...defaultProps} />);
      // Step 0 has rating (0 % 5) + 1 = 1
      const step0 = screen.getByTestId('scripture-report-rating-step-0');
      expect(step0).toHaveTextContent('1');
      // Step 4 has rating (4 % 5) + 1 = 5
      const step4 = screen.getByTestId('scripture-report-rating-step-4');
      expect(step4).toHaveTextContent('5');
    });

    it('displays verse reference for each step', () => {
      render(<DailyPrayerReport {...defaultProps} />);
      const step0 = screen.getByTestId('scripture-report-rating-step-0');
      expect(step0).toHaveTextContent(SCRIPTURE_STEPS[0].verseReference);
    });
  });

  // ============================================
  // 2.3-RPT-010: Partner Ratings Side-by-Side
  // ============================================

  describe('Partner Ratings Side-by-Side', () => {
    const partnerRatings = Array.from({ length: 17 }, (_, i) => ({
      stepIndex: i,
      rating: 5 - (i % 5),
    }));

    it('renders partner rating circles alongside user ratings', () => {
      render(
        <DailyPrayerReport
          {...defaultProps}
          partnerRatings={partnerRatings}
          partnerName="Sarah"
          isPartnerComplete={true}
        />
      );
      // Step 0: user rating = 1, partner rating = 5
      const step0 = screen.getByTestId('scripture-report-rating-step-0');
      expect(step0).toHaveTextContent('1');
      expect(step0).toHaveTextContent('5');
    });

    it('does not render partner rating circles when partner data is null', () => {
      render(<DailyPrayerReport {...defaultProps} />);
      // With default props (partnerRatings: null), only user ratings should appear
      const step0 = screen.getByTestId('scripture-report-rating-step-0');
      // Should contain user rating 1 but not partner rating
      const ratingCircles = step0.querySelectorAll('span.flex.h-7.w-7');
      expect(ratingCircles.length).toBe(1); // Only user circle
    });
  });

  // ============================================
  // 2.3-RPT-011: Standout Verse Content
  // ============================================

  describe('Standout Verse Content', () => {
    it('displays verse references for standout selections', () => {
      render(<DailyPrayerReport {...defaultProps} />);
      const standoutSection = screen.getByTestId('scripture-report-standout-verses');
      expect(standoutSection).toHaveTextContent(SCRIPTURE_STEPS[2].verseReference);
      expect(standoutSection).toHaveTextContent(SCRIPTURE_STEPS[14].verseReference);
    });
  });

  // ============================================
  // 2.3-RPT-012: Partner Message Label
  // ============================================

  describe('Partner Message Label', () => {
    it('shows "A message from [Partner Name]" label above message', () => {
      render(
        <DailyPrayerReport
          {...defaultProps}
          partnerMessage="Praying for you"
          partnerName="Sarah"
          isPartnerComplete={true}
        />
      );
      const messageCard = screen.getByTestId('scripture-report-partner-message');
      expect(messageCard).toHaveTextContent('A message from Sarah');
      expect(messageCard).toHaveTextContent('Praying for you');
    });
  });

  // ============================================
  // 2.3-RPT-013: Report Heading Text
  // ============================================

  describe('Report Heading', () => {
    it('shows "Daily Prayer Report" heading', () => {
      render(<DailyPrayerReport {...defaultProps} />);
      const heading = screen.getByTestId('scripture-report-heading');
      expect(heading).toHaveTextContent('Daily Prayer Report');
    });
  });
});
