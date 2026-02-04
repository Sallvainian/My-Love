/**
 * PerStepReflection Component Tests
 *
 * Story 2.1: Per-Step Reflection System (AC: #2, #4)
 *
 * Tests:
 * - Rating scale: 5 numbered circle buttons in radiogroup
 * - End labels: "A little" (left) and "A lot" (right)
 * - Prompt text
 * - Rating selection and aria-checked toggling
 * - Keyboard navigation (arrow keys within radiogroup)
 * - Optional note textarea (max 200 chars, resize-none)
 * - Character counter at 200+ chars
 * - Continue button disabled until rating selected
 * - Validation: quiet helper text "Please select a rating"
 * - Focus ring styles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerStepReflection } from '../reflection/PerStepReflection';

describe('PerStepReflection', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Rendering — Prompt & Labels
  // ============================================

  describe('Prompt & Labels', () => {
    it('renders the reflection screen', () => {
      render(<PerStepReflection {...defaultProps} />);
      expect(screen.getByTestId('scripture-reflection-screen')).toBeDefined();
    });

    it('displays the prompt text', () => {
      render(<PerStepReflection {...defaultProps} />);
      expect(screen.getByTestId('scripture-reflection-prompt')).toHaveTextContent(
        'How meaningful was this for you today?'
      );
    });

    it('displays "A little" end label', () => {
      render(<PerStepReflection {...defaultProps} />);
      expect(screen.getByTestId('scripture-rating-label-low')).toHaveTextContent('A little');
    });

    it('displays "A lot" end label', () => {
      render(<PerStepReflection {...defaultProps} />);
      expect(screen.getByTestId('scripture-rating-label-high')).toHaveTextContent('A lot');
    });
  });

  // ============================================
  // Rating Scale — Radiogroup
  // ============================================

  describe('Rating Scale', () => {
    it('renders a radiogroup', () => {
      render(<PerStepReflection {...defaultProps} />);
      const group = screen.getByTestId('scripture-rating-group');
      expect(group.getAttribute('role')).toBe('radiogroup');
    });

    it('radiogroup has accessible label', () => {
      render(<PerStepReflection {...defaultProps} />);
      const group = screen.getByTestId('scripture-rating-group');
      expect(group.getAttribute('aria-label')).toBe('How meaningful was this for you today?');
    });

    it('renders 5 rating buttons', () => {
      render(<PerStepReflection {...defaultProps} />);
      for (let n = 1; n <= 5; n++) {
        expect(screen.getByTestId(`scripture-rating-${n}`)).toBeDefined();
      }
    });

    it('each rating button has role="radio"', () => {
      render(<PerStepReflection {...defaultProps} />);
      for (let n = 1; n <= 5; n++) {
        expect(screen.getByTestId(`scripture-rating-${n}`).getAttribute('role')).toBe('radio');
      }
    });

    it('each rating button has correct aria-label', () => {
      render(<PerStepReflection {...defaultProps} />);
      const labels = [
        'Rating 1 of 5: A little',
        'Rating 2 of 5',
        'Rating 3 of 5',
        'Rating 4 of 5',
        'Rating 5 of 5: A lot',
      ];
      for (let n = 1; n <= 5; n++) {
        expect(screen.getByTestId(`scripture-rating-${n}`).getAttribute('aria-label')).toBe(labels[n - 1]);
      }
    });

    it('all ratings are unchecked initially', () => {
      render(<PerStepReflection {...defaultProps} />);
      for (let n = 1; n <= 5; n++) {
        expect(screen.getByTestId(`scripture-rating-${n}`).getAttribute('aria-checked')).toBe('false');
      }
    });
  });

  // ============================================
  // Rating Selection
  // ============================================

  describe('Rating Selection', () => {
    it('marks selected rating as checked', () => {
      render(<PerStepReflection {...defaultProps} />);
      fireEvent.click(screen.getByTestId('scripture-rating-3'));
      expect(screen.getByTestId('scripture-rating-3').getAttribute('aria-checked')).toBe('true');
    });

    it('unmarks other ratings when one is selected', () => {
      render(<PerStepReflection {...defaultProps} />);
      fireEvent.click(screen.getByTestId('scripture-rating-3'));
      for (const n of [1, 2, 4, 5]) {
        expect(screen.getByTestId(`scripture-rating-${n}`).getAttribute('aria-checked')).toBe('false');
      }
    });

    it('changes selection when different rating is clicked', () => {
      render(<PerStepReflection {...defaultProps} />);
      fireEvent.click(screen.getByTestId('scripture-rating-2'));
      fireEvent.click(screen.getByTestId('scripture-rating-5'));
      expect(screen.getByTestId('scripture-rating-2').getAttribute('aria-checked')).toBe('false');
      expect(screen.getByTestId('scripture-rating-5').getAttribute('aria-checked')).toBe('true');
    });
  });

  // ============================================
  // Keyboard Navigation
  // ============================================

  describe('Keyboard Navigation', () => {
    it('moves to next rating on ArrowRight', () => {
      render(<PerStepReflection {...defaultProps} />);
      // Select rating 1 first
      fireEvent.click(screen.getByTestId('scripture-rating-1'));
      // Press ArrowRight
      fireEvent.keyDown(screen.getByTestId('scripture-rating-group'), { key: 'ArrowRight' });
      expect(screen.getByTestId('scripture-rating-2').getAttribute('aria-checked')).toBe('true');
      expect(screen.getByTestId('scripture-rating-1').getAttribute('aria-checked')).toBe('false');
    });

    it('moves to previous rating on ArrowLeft', () => {
      render(<PerStepReflection {...defaultProps} />);
      fireEvent.click(screen.getByTestId('scripture-rating-3'));
      fireEvent.keyDown(screen.getByTestId('scripture-rating-group'), { key: 'ArrowLeft' });
      expect(screen.getByTestId('scripture-rating-2').getAttribute('aria-checked')).toBe('true');
    });

    it('wraps from rating 5 to rating 1 on ArrowRight', () => {
      render(<PerStepReflection {...defaultProps} />);
      fireEvent.click(screen.getByTestId('scripture-rating-5'));
      fireEvent.keyDown(screen.getByTestId('scripture-rating-group'), { key: 'ArrowRight' });
      expect(screen.getByTestId('scripture-rating-1').getAttribute('aria-checked')).toBe('true');
    });

    it('wraps from rating 1 to rating 5 on ArrowLeft', () => {
      render(<PerStepReflection {...defaultProps} />);
      fireEvent.click(screen.getByTestId('scripture-rating-1'));
      fireEvent.keyDown(screen.getByTestId('scripture-rating-group'), { key: 'ArrowLeft' });
      expect(screen.getByTestId('scripture-rating-5').getAttribute('aria-checked')).toBe('true');
    });
  });

  // ============================================
  // Note Textarea
  // ============================================

  describe('Note Textarea', () => {
    it('renders an optional note textarea', () => {
      render(<PerStepReflection {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-reflection-note');
      expect(textarea).toBeDefined();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('has placeholder "Add a note (optional)"', () => {
      render(<PerStepReflection {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-reflection-note');
      expect(textarea.getAttribute('placeholder')).toBe('Add a note (optional)');
    });

    it('has maxLength of 200', () => {
      render(<PerStepReflection {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-reflection-note');
      expect(textarea.getAttribute('maxlength')).toBe('200');
    });

    it('has aria-label "Optional reflection note"', () => {
      render(<PerStepReflection {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-reflection-note');
      expect(textarea.getAttribute('aria-label')).toBe('Optional reflection note');
    });

    it('has resize-none class', () => {
      render(<PerStepReflection {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-reflection-note');
      expect(textarea.className).toContain('resize-none');
    });
  });

  // ============================================
  // Character Counter
  // ============================================

  describe('Character Counter', () => {
    it('does not show character counter when text is short', () => {
      render(<PerStepReflection {...defaultProps} />);
      expect(screen.queryByTestId('scripture-reflection-char-count')).toBeNull();
    });

    it('shows character counter at 150+ characters', () => {
      render(<PerStepReflection {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-reflection-note');
      const longText = 'a'.repeat(150);
      fireEvent.change(textarea, { target: { value: longText } });
      const counter = screen.getByTestId('scripture-reflection-char-count');
      expect(counter).toBeDefined();
      expect(counter).toHaveTextContent('150/200');
    });

    it('character counter has muted style', () => {
      render(<PerStepReflection {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-reflection-note');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(150) } });
      const counter = screen.getByTestId('scripture-reflection-char-count');
      expect(counter.className).toContain('text-xs');
      expect(counter.className).toContain('text-gray-400');
    });
  });

  // ============================================
  // Continue Button
  // ============================================

  describe('Continue Button', () => {
    it('renders a Continue button', () => {
      render(<PerStepReflection {...defaultProps} />);
      const btn = screen.getByTestId('scripture-reflection-continue');
      expect(btn).toHaveTextContent('Continue');
    });

    it('Continue button is aria-disabled before rating selection', () => {
      render(<PerStepReflection {...defaultProps} />);
      const btn = screen.getByTestId('scripture-reflection-continue');
      expect(btn.getAttribute('aria-disabled')).toBe('true');
    });

    it('Continue button has disabled styling when no rating', () => {
      render(<PerStepReflection {...defaultProps} />);
      const btn = screen.getByTestId('scripture-reflection-continue');
      expect(btn.className).toContain('opacity-50');
      expect(btn.className).toContain('cursor-not-allowed');
    });

    it('Continue button becomes enabled after rating selection', () => {
      render(<PerStepReflection {...defaultProps} />);
      fireEvent.click(screen.getByTestId('scripture-rating-4'));
      const btn = screen.getByTestId('scripture-reflection-continue');
      expect(btn.getAttribute('aria-disabled')).toBe('false');
      expect(btn.className).not.toContain('opacity-50');
    });

    it('calls onSubmit with rating and notes when Continue is clicked', () => {
      const onSubmit = vi.fn();
      render(<PerStepReflection {...defaultProps} onSubmit={onSubmit} />);
      fireEvent.click(screen.getByTestId('scripture-rating-4'));
      fireEvent.change(screen.getByTestId('scripture-reflection-note'), {
        target: { value: 'Test note' },
      });
      fireEvent.click(screen.getByTestId('scripture-reflection-continue'));
      expect(onSubmit).toHaveBeenCalledWith(4, 'Test note');
    });

    it('calls onSubmit with empty string for notes when no note entered', () => {
      const onSubmit = vi.fn();
      render(<PerStepReflection {...defaultProps} onSubmit={onSubmit} />);
      fireEvent.click(screen.getByTestId('scripture-rating-3'));
      fireEvent.click(screen.getByTestId('scripture-reflection-continue'));
      expect(onSubmit).toHaveBeenCalledWith(3, '');
    });
  });

  // ============================================
  // Validation
  // ============================================

  describe('Validation', () => {
    it('does not show validation text initially', () => {
      render(<PerStepReflection {...defaultProps} />);
      expect(screen.queryByTestId('scripture-reflection-validation')).toBeNull();
    });

    it('shows validation text when Continue is tapped without rating', () => {
      render(<PerStepReflection {...defaultProps} />);
      // Force click the disabled button
      const btn = screen.getByTestId('scripture-reflection-continue');
      fireEvent.click(btn);
      expect(screen.getByTestId('scripture-reflection-validation')).toHaveTextContent(
        'Please select a rating'
      );
    });

    it('validation text disappears after rating is selected', () => {
      render(<PerStepReflection {...defaultProps} />);
      // Trigger validation
      fireEvent.click(screen.getByTestId('scripture-reflection-continue'));
      expect(screen.getByTestId('scripture-reflection-validation')).toBeDefined();
      // Select rating
      fireEvent.click(screen.getByTestId('scripture-rating-2'));
      expect(screen.queryByTestId('scripture-reflection-validation')).toBeNull();
    });

    it('validation text uses muted style (not red)', () => {
      render(<PerStepReflection {...defaultProps} />);
      fireEvent.click(screen.getByTestId('scripture-reflection-continue'));
      const validation = screen.getByTestId('scripture-reflection-validation');
      expect(validation.className).toContain('text-sm');
      expect(validation.className).not.toContain('text-red');
    });
  });

  // ============================================
  // Focus Styles
  // ============================================

  describe('Focus Styles', () => {
    it('Continue button has focus-visible ring classes', () => {
      render(<PerStepReflection {...defaultProps} />);
      const btn = screen.getByTestId('scripture-reflection-continue');
      expect(btn.className).toContain('focus-visible:ring-2');
      expect(btn.className).toContain('focus-visible:ring-purple-400');
    });
  });
});
