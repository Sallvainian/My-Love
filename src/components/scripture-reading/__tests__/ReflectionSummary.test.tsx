/**
 * ReflectionSummary Component Tests
 *
 * Story 2.2: End-of-Session Reflection Summary (AC: #1, #2, #3)
 *
 * Tests:
 * - Bookmarked verses render as selectable chips
 * - No-bookmark fallback message
 * - Focus management: heading focused on mount
 * - Verse chip multi-select with aria-pressed toggling
 * - Session rating scale (1-5) with ARIA radiogroup
 * - Optional note textarea with character counter
 * - 48x48px minimum touch targets on verse chips
 * - Continue button disabled until requirements met
 * - Continue enabled with just rating when no bookmarks
 * - Validation messages on premature Continue
 * - onSubmit called with correct payload
 * - Keyboard navigation within session rating radiogroup
 * - Disabled prop prevents verse selection and rating interaction
 * - Empty notes submission includes empty string
 * - Deselecting all verses re-disables Continue button
 *
 * TDD Phase: GREEN — implementation complete
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReflectionSummary } from '../reflection/ReflectionSummary';

interface BookmarkedVerse {
  stepIndex: number;
  verseReference: string;
  verseText: string;
}

// Mock requestAnimationFrame to execute synchronously for focus tests
let originalRAF: typeof requestAnimationFrame;

describe('ReflectionSummary', () => {
  const sampleBookmarks: BookmarkedVerse[] = [
    { stepIndex: 0, verseReference: 'Psalm 147:3', verseText: 'He heals the brokenhearted and binds up their wounds.' },
    { stepIndex: 5, verseReference: '1 John 4:18', verseText: 'There is no fear in love. But perfect love drives out fear.' },
    { stepIndex: 12, verseReference: 'Romans 8:28', verseText: 'And we know that in all things God works for the good.' },
  ];

  const defaultProps = {
    bookmarkedVerses: sampleBookmarks,
    onSubmit: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    originalRAF = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
  });

  // ============================================
  // 2.2-CMP-001: Bookmarked Verses as Chips
  // ============================================

  describe('Bookmarked Verse Chips', () => {
    it('renders bookmarked verses as selectable chips', () => {
      render(<ReflectionSummary {...defaultProps} />);
      expect(screen.getByTestId('scripture-reflection-summary-screen')).toBeDefined();
      // Each bookmarked verse should render as a chip with its step index
      expect(screen.getByTestId('scripture-standout-verse-0')).toBeDefined();
      expect(screen.getByTestId('scripture-standout-verse-5')).toBeDefined();
      expect(screen.getByTestId('scripture-standout-verse-12')).toBeDefined();
      // Chips should display the verse reference text
      expect(screen.getByTestId('scripture-standout-verse-0')).toHaveTextContent('Psalm 147:3');
      expect(screen.getByTestId('scripture-standout-verse-5')).toHaveTextContent('1 John 4:18');
      expect(screen.getByTestId('scripture-standout-verse-12')).toHaveTextContent('Romans 8:28');
    });
  });

  // ============================================
  // 2.2-CMP-002: No Bookmarks Fallback
  // ============================================

  describe('No Bookmarks Fallback', () => {
    it('shows fallback message when no bookmarks exist', () => {
      render(<ReflectionSummary {...defaultProps} bookmarkedVerses={[]} />);
      expect(screen.getByTestId('scripture-no-bookmarks-message')).toBeDefined();
      expect(screen.getByTestId('scripture-no-bookmarks-message')).toHaveTextContent(
        "You didn't mark any verses \u2014 that's okay"
      );
      // Should NOT render any verse chips
      expect(screen.queryByTestId('scripture-standout-verse-0')).toBeNull();
    });
  });

  // ============================================
  // 2.2-CMP-003: Focus Management
  // ============================================

  describe('Focus Management', () => {
    it('moves focus to reflection summary heading on mount', () => {
      render(<ReflectionSummary {...defaultProps} />);
      const heading = screen.getByTestId('scripture-reflection-summary-heading');
      expect(heading).toHaveTextContent('Your Session');
      expect(heading.getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(heading);
    });
  });

  // ============================================
  // 2.2-CMP-004: Verse Chip Multi-Select
  // ============================================

  describe('Verse Chip Selection', () => {
    it('toggles aria-pressed on verse chip click (multi-select)', () => {
      render(<ReflectionSummary {...defaultProps} />);
      const chip0 = screen.getByTestId('scripture-standout-verse-0');
      const chip5 = screen.getByTestId('scripture-standout-verse-5');

      // Initially all unselected
      expect(chip0.getAttribute('aria-pressed')).toBe('false');
      expect(chip5.getAttribute('aria-pressed')).toBe('false');

      // Select first chip
      fireEvent.click(chip0);
      expect(chip0.getAttribute('aria-pressed')).toBe('true');

      // Select second chip (multi-select, first stays selected)
      fireEvent.click(chip5);
      expect(chip0.getAttribute('aria-pressed')).toBe('true');
      expect(chip5.getAttribute('aria-pressed')).toBe('true');

      // Deselect first chip
      fireEvent.click(chip0);
      expect(chip0.getAttribute('aria-pressed')).toBe('false');
      expect(chip5.getAttribute('aria-pressed')).toBe('true');
    });
  });

  // ============================================
  // 2.2-CMP-005: Session Rating Scale
  // ============================================

  describe('Session Rating Scale', () => {
    it('renders session rating with correct ARIA attributes', () => {
      render(<ReflectionSummary {...defaultProps} />);
      // Radiogroup exists
      const group = screen.getByTestId('scripture-session-rating-group');
      expect(group.getAttribute('role')).toBe('radiogroup');
      expect(group.getAttribute('aria-label')).toBe('How meaningful was this session for you today?');

      // 5 rating buttons with role="radio"
      for (let n = 1; n <= 5; n++) {
        const btn = screen.getByTestId(`scripture-session-rating-${n}`);
        expect(btn).toBeDefined();
        expect(btn.getAttribute('role')).toBe('radio');
        expect(btn.getAttribute('aria-checked')).toBe('false');
      }

      // Select a rating and verify
      fireEvent.click(screen.getByTestId('scripture-session-rating-3'));
      expect(screen.getByTestId('scripture-session-rating-3').getAttribute('aria-checked')).toBe('true');
      // Others remain unchecked
      for (const n of [1, 2, 4, 5]) {
        expect(screen.getByTestId(`scripture-session-rating-${n}`).getAttribute('aria-checked')).toBe('false');
      }
    });
  });

  // ============================================
  // 2.2-CMP-006: Note Textarea
  // ============================================

  describe('Note Textarea', () => {
    it('renders optional note textarea with char counter at 150+', () => {
      render(<ReflectionSummary {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-session-note');
      expect(textarea).toBeDefined();
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea.getAttribute('placeholder')).toBe(
        'Reflect on the session as a whole (optional)'
      );
      expect(textarea.getAttribute('maxlength')).toBe('200');
      expect(textarea.getAttribute('aria-label')).toBe('Optional session reflection note');
      expect(textarea.className).toContain('resize-none');

      // No char counter when short
      expect(screen.queryByTestId('scripture-session-note-char-count')).toBeNull();

      // Char counter appears at 150+
      const longText = 'a'.repeat(150);
      fireEvent.change(textarea, { target: { value: longText } });
      const counter = screen.getByTestId('scripture-session-note-char-count');
      expect(counter).toBeDefined();
      expect(counter).toHaveTextContent('150/200');
      expect(counter.className).toContain('text-xs');
      expect(counter.className).toContain('text-gray-400');
    });
  });

  // ============================================
  // 2.2-CMP-007: Touch Target Size
  // ============================================

  describe('Touch Target', () => {
    it('verse chips have minimum 48x48px touch target via CSS classes', () => {
      render(<ReflectionSummary {...defaultProps} />);
      const chip0 = screen.getByTestId('scripture-standout-verse-0');
      expect(chip0.className).toContain('min-w-[48px]');
      expect(chip0.className).toContain('min-h-[48px]');
    });
  });

  // ============================================
  // 2.2-CMP-008: Continue Disabled Until Requirements Met
  // ============================================

  describe('Continue Button — With Bookmarks', () => {
    it('Continue disabled until verse selected AND rating selected', () => {
      render(<ReflectionSummary {...defaultProps} />);
      const btn = screen.getByTestId('scripture-reflection-summary-continue');

      // Initially disabled (no verse, no rating)
      expect(btn.getAttribute('aria-disabled')).toBe('true');
      expect(btn.className).toContain('opacity-50');
      expect(btn.className).toContain('cursor-not-allowed');

      // Select a verse only — still disabled
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));
      expect(btn.getAttribute('aria-disabled')).toBe('true');

      // Select a rating only (deselect verse first)
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0')); // deselect
      fireEvent.click(screen.getByTestId('scripture-session-rating-4'));
      expect(btn.getAttribute('aria-disabled')).toBe('true');

      // Select both verse AND rating — enabled
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));
      expect(btn.getAttribute('aria-disabled')).toBe('false');
      expect(btn.className).not.toContain('opacity-50');
    });
  });

  // ============================================
  // 2.2-CMP-009: Continue Enabled Without Bookmarks
  // ============================================

  describe('Continue Button — No Bookmarks', () => {
    it('Continue enabled with just rating when no bookmarks exist', () => {
      render(<ReflectionSummary {...defaultProps} bookmarkedVerses={[]} />);
      const btn = screen.getByTestId('scripture-reflection-summary-continue');

      // Initially disabled (no rating)
      expect(btn.getAttribute('aria-disabled')).toBe('true');

      // Select rating — enabled (no verse requirement when no bookmarks)
      fireEvent.click(screen.getByTestId('scripture-session-rating-3'));
      expect(btn.getAttribute('aria-disabled')).toBe('false');
      expect(btn.className).not.toContain('opacity-50');
    });
  });

  // ============================================
  // 2.2-CMP-010: Validation Messages
  // ============================================

  describe('Validation', () => {
    it('shows validation messages on premature Continue tap', () => {
      render(<ReflectionSummary {...defaultProps} />);
      const btn = screen.getByTestId('scripture-reflection-summary-continue');

      // No validation initially
      expect(screen.queryByTestId('scripture-reflection-summary-validation')).toBeNull();

      // Tap Continue without selecting anything
      fireEvent.click(btn);
      const validation = screen.getByTestId('scripture-reflection-summary-validation');
      expect(validation).toBeDefined();
      // Should show both validation messages
      expect(validation.textContent).toContain('Please select a standout verse');
      expect(validation.textContent).toContain('Please select a rating');
      // Validation uses muted style (not red)
      expect(validation.className).toContain('text-sm');
      expect(validation.className).not.toContain('text-red');

      // Select verse — verse validation clears but rating validation stays
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));
      fireEvent.click(btn);
      const updatedValidation = screen.getByTestId('scripture-reflection-summary-validation');
      expect(updatedValidation.textContent).not.toContain('Please select a standout verse');
      expect(updatedValidation.textContent).toContain('Please select a rating');

      // Select rating — all validation clears
      fireEvent.click(screen.getByTestId('scripture-session-rating-4'));
      expect(screen.queryByTestId('scripture-reflection-summary-validation')).toBeNull();
    });
  });

  // ============================================
  // 2.2-CMP-011: onSubmit Payload
  // ============================================

  describe('Submission', () => {
    it('onSubmit called with correct data (standoutVerses, rating, notes)', () => {
      const onSubmit = vi.fn();
      render(<ReflectionSummary {...defaultProps} onSubmit={onSubmit} />);

      // Select two standout verses
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));
      fireEvent.click(screen.getByTestId('scripture-standout-verse-12'));

      // Select rating
      fireEvent.click(screen.getByTestId('scripture-session-rating-5'));

      // Add a note
      fireEvent.change(screen.getByTestId('scripture-session-note'), {
        target: { value: 'Powerful session' },
      });

      // Submit
      fireEvent.click(screen.getByTestId('scripture-reflection-summary-continue'));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        standoutVerses: [0, 12],
        rating: 5,
        notes: 'Powerful session',
      });
    });
  });

  // ============================================
  // 2.2-CMP-014: Keyboard Navigation
  // ============================================

  describe('Keyboard Navigation', () => {
    it('arrow keys navigate within session rating radiogroup', () => {
      render(<ReflectionSummary {...defaultProps} />);
      const group = screen.getByTestId('scripture-session-rating-group');

      // Select rating 1
      fireEvent.click(screen.getByTestId('scripture-session-rating-1'));
      expect(screen.getByTestId('scripture-session-rating-1').getAttribute('aria-checked')).toBe('true');

      // ArrowRight moves to rating 2
      fireEvent.keyDown(group, { key: 'ArrowRight' });
      expect(screen.getByTestId('scripture-session-rating-2').getAttribute('aria-checked')).toBe('true');
      expect(screen.getByTestId('scripture-session-rating-1').getAttribute('aria-checked')).toBe('false');

      // ArrowLeft moves back to rating 1
      fireEvent.keyDown(group, { key: 'ArrowLeft' });
      expect(screen.getByTestId('scripture-session-rating-1').getAttribute('aria-checked')).toBe('true');

      // ArrowLeft from 1 wraps to 5
      fireEvent.keyDown(group, { key: 'ArrowLeft' });
      expect(screen.getByTestId('scripture-session-rating-5').getAttribute('aria-checked')).toBe('true');

      // ArrowRight from 5 wraps to 1
      fireEvent.keyDown(group, { key: 'ArrowRight' });
      expect(screen.getByTestId('scripture-session-rating-1').getAttribute('aria-checked')).toBe('true');
    });
  });

  // ============================================
  // 2.2-CMP-015: Disabled Prop Behavior
  // ============================================

  describe('Disabled State', () => {
    it('disabled prop prevents verse selection and rating interaction', () => {
      render(<ReflectionSummary {...defaultProps} disabled={true} />);

      // Verse chips should be disabled
      const chip0 = screen.getByTestId('scripture-standout-verse-0');
      expect(chip0).toBeDisabled();

      // Rating buttons should be disabled
      for (let n = 1; n <= 5; n++) {
        expect(screen.getByTestId(`scripture-session-rating-${n}`)).toBeDisabled();
      }
    });

    it('disabled prop prevents submission even when form is complete', () => {
      const onSubmit = vi.fn();
      // Render as NOT disabled first to fill form, then re-render disabled
      const { rerender } = render(<ReflectionSummary {...defaultProps} onSubmit={onSubmit} disabled={false} />);
      // Select verse and rating
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));
      fireEvent.click(screen.getByTestId('scripture-session-rating-4'));
      // Re-render with disabled=true (simulating isSyncing)
      rerender(<ReflectionSummary {...defaultProps} onSubmit={onSubmit} disabled={true} />);
      // Attempt to submit — should NOT call onSubmit
      fireEvent.click(screen.getByTestId('scripture-reflection-summary-continue'));
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // 2.2-CMP-016: Empty Notes Submission
  // ============================================

  describe('Empty Notes', () => {
    it('onSubmit includes empty string for notes when no note entered', () => {
      const onSubmit = vi.fn();
      render(<ReflectionSummary {...defaultProps} onSubmit={onSubmit} />);

      // Select a verse and rating (minimum to submit)
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));
      fireEvent.click(screen.getByTestId('scripture-session-rating-3'));

      // Submit without entering a note
      fireEvent.click(screen.getByTestId('scripture-reflection-summary-continue'));

      expect(onSubmit).toHaveBeenCalledWith({
        standoutVerses: [0],
        rating: 3,
        notes: '',
      });
    });
  });

  // ============================================
  // 2.2-CMP-017: Deselect All Verses Re-disables Continue
  // ============================================

  describe('Deselect All Verses', () => {
    it('deselecting all verses re-disables Continue button', () => {
      render(<ReflectionSummary {...defaultProps} />);
      const btn = screen.getByTestId('scripture-reflection-summary-continue');

      // Select verse and rating
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));
      fireEvent.click(screen.getByTestId('scripture-session-rating-4'));
      expect(btn.getAttribute('aria-disabled')).toBe('false');

      // Deselect all verses
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));

      // Continue should be disabled again (verse required when bookmarks exist)
      expect(btn.getAttribute('aria-disabled')).toBe('true');
    });
  });
});
