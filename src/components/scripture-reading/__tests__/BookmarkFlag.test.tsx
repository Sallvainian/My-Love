/**
 * BookmarkFlag Component Tests
 *
 * Story 2.1: Per-Step Reflection System (AC: #1)
 *
 * Tests:
 * - Renders outlined bookmark icon when inactive
 * - Renders filled amber bookmark icon when active
 * - Correct aria-label toggling
 * - aria-pressed attribute reflects state
 * - 48x48px minimum touch target
 * - Calls onToggle callback immediately (no internal debounce)
 * - Disabled state prevents toggle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookmarkFlag } from '../reading/BookmarkFlag';

describe('BookmarkFlag', () => {
  const defaultProps = {
    isBookmarked: false,
    onToggle: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Rendering
  // ============================================

  describe('Rendering', () => {
    it('renders the bookmark button', () => {
      render(<BookmarkFlag {...defaultProps} />);
      expect(screen.getByTestId('scripture-bookmark-button')).toBeDefined();
    });

    it('renders as a button element', () => {
      render(<BookmarkFlag {...defaultProps} />);
      const btn = screen.getByTestId('scripture-bookmark-button');
      expect(btn.tagName).toBe('BUTTON');
    });
  });

  // ============================================
  // Visual State
  // ============================================

  describe('Visual State', () => {
    it('shows outlined icon when not bookmarked', () => {
      render(<BookmarkFlag {...defaultProps} isBookmarked={false} />);
      const btn = screen.getByTestId('scripture-bookmark-button');
      // When inactive, the icon should NOT have the fill class
      const icon = btn.querySelector('[data-testid="bookmark-icon"]');
      expect(icon).toBeDefined();
      expect(icon?.getAttribute('fill')).toBe('none');
    });

    it('shows filled amber icon when bookmarked', () => {
      render(<BookmarkFlag {...defaultProps} isBookmarked={true} />);
      const icon = screen.getByTestId('bookmark-icon');
      expect(icon.getAttribute('fill')).toBe('currentColor');
    });
  });

  // ============================================
  // Accessibility — aria-label
  // ============================================

  describe('Accessibility — aria-label', () => {
    it('has aria-label "Bookmark this verse" when inactive', () => {
      render(<BookmarkFlag {...defaultProps} isBookmarked={false} />);
      const btn = screen.getByTestId('scripture-bookmark-button');
      expect(btn.getAttribute('aria-label')).toBe('Bookmark this verse');
    });

    it('has aria-label "Remove bookmark" when active', () => {
      render(<BookmarkFlag {...defaultProps} isBookmarked={true} />);
      const btn = screen.getByTestId('scripture-bookmark-button');
      expect(btn.getAttribute('aria-label')).toBe('Remove bookmark');
    });
  });

  // ============================================
  // Accessibility — aria-pressed
  // ============================================

  describe('Accessibility — aria-pressed', () => {
    it('has aria-pressed="false" when not bookmarked', () => {
      render(<BookmarkFlag {...defaultProps} isBookmarked={false} />);
      const btn = screen.getByTestId('scripture-bookmark-button');
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });

    it('has aria-pressed="true" when bookmarked', () => {
      render(<BookmarkFlag {...defaultProps} isBookmarked={true} />);
      const btn = screen.getByTestId('scripture-bookmark-button');
      expect(btn.getAttribute('aria-pressed')).toBe('true');
    });
  });

  // ============================================
  // Touch Target
  // ============================================

  describe('Touch Target', () => {
    it('has minimum 48x48px touch target via CSS classes', () => {
      render(<BookmarkFlag {...defaultProps} />);
      const btn = screen.getByTestId('scripture-bookmark-button');
      expect(btn.className).toContain('min-w-[48px]');
      expect(btn.className).toContain('min-h-[48px]');
    });
  });

  // ============================================
  // Toggle Behavior
  // ============================================

  describe('Toggle Behavior', () => {
    it('calls onToggle immediately when clicked', () => {
      const onToggle = vi.fn();
      render(<BookmarkFlag {...defaultProps} onToggle={onToggle} />);
      fireEvent.click(screen.getByTestId('scripture-bookmark-button'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onToggle on each click (no internal debounce)', () => {
      const onToggle = vi.fn();
      render(<BookmarkFlag {...defaultProps} onToggle={onToggle} />);
      const btn = screen.getByTestId('scripture-bookmark-button');
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      expect(onToggle).toHaveBeenCalledTimes(3);
    });

    it('does not call onToggle when disabled', () => {
      const onToggle = vi.fn();
      render(<BookmarkFlag {...defaultProps} onToggle={onToggle} disabled={true} />);
      fireEvent.click(screen.getByTestId('scripture-bookmark-button'));
      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Focus Styles
  // ============================================

  describe('Focus Styles', () => {
    it('has focus-visible ring classes', () => {
      render(<BookmarkFlag {...defaultProps} />);
      const btn = screen.getByTestId('scripture-bookmark-button');
      expect(btn.className).toContain('focus-visible:ring-2');
      expect(btn.className).toContain('focus-visible:ring-purple-400');
      expect(btn.className).toContain('focus-visible:ring-offset-2');
    });
  });
});
