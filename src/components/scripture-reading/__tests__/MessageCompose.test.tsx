/**
 * MessageCompose Component Tests
 *
 * Story 2.3: Daily Prayer Report — Send & View (AC: #1)
 *
 * Tests:
 * - Renders partner name in heading
 * - Textarea accepts input up to 300 chars
 * - Character counter visible at 225+ chars
 * - Character counter hidden below 225 chars
 * - Send button calls onSend with message text
 * - Skip button calls onSkip
 * - Send and Skip disabled when disabled prop is true
 * - Textarea has correct aria-label
 * - Focus moves to textarea on mount
 *
 * TDD Phase: GREEN — component implemented
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageCompose } from '../reflection/MessageCompose';

describe('MessageCompose', () => {
  const defaultProps = {
    partnerName: 'Sarah',
    onSend: vi.fn(),
    onSkip: vi.fn(),
    disabled: false,
  };

  let originalRAF: typeof requestAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();
    originalRAF = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
  });

  // ============================================
  // 2.3-CMP-001: Partner Name in Heading
  // ============================================

  describe('Heading', () => {
    it('renders partner name in heading', () => {
      render(<MessageCompose {...defaultProps} />);
      const heading = screen.getByTestId('scripture-message-compose-heading');
      expect(heading).toHaveTextContent('Write something for Sarah');
    });
  });

  // ============================================
  // 2.3-CMP-002: Textarea Input
  // ============================================

  describe('Textarea', () => {
    it('textarea accepts input up to 300 chars', () => {
      render(<MessageCompose {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      expect(textarea).toBeDefined();
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea.getAttribute('maxlength')).toBe('300');

      // Fill with text and verify value
      const testText = 'This is a message for my partner';
      fireEvent.change(textarea, { target: { value: testText } });
      expect(textarea).toHaveValue(testText);
    });
  });

  // ============================================
  // 2.3-CMP-003: Character Counter Visibility (75% threshold)
  // ============================================

  describe('Character Counter', () => {
    it('character counter visible at 225+ chars', () => {
      render(<MessageCompose {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      const longText = 'a'.repeat(260);
      fireEvent.change(textarea, { target: { value: longText } });
      const counter = screen.getByTestId('scripture-message-char-count');
      expect(counter).toBeDefined();
      expect(counter).toHaveTextContent('260/300');
    });

    it('character counter hidden below 225 chars', () => {
      render(<MessageCompose {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      const shortText = 'a'.repeat(100);
      fireEvent.change(textarea, { target: { value: shortText } });
      expect(screen.queryByTestId('scripture-message-char-count')).toBeNull();
    });
  });

  // ============================================
  // 2.3-CMP-004: Send Button
  // ============================================

  describe('Send Button', () => {
    it('Send button calls onSend with message text', () => {
      const onSend = vi.fn();
      render(<MessageCompose {...defaultProps} onSend={onSend} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      const message = 'I love you and I am praying for you today';
      fireEvent.change(textarea, { target: { value: message } });
      fireEvent.click(screen.getByTestId('scripture-message-send-btn'));
      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenCalledWith(message);
    });
  });

  // ============================================
  // 2.3-CMP-005: Skip Button
  // ============================================

  describe('Skip Button', () => {
    it('Skip button calls onSkip', () => {
      const onSkip = vi.fn();
      render(<MessageCompose {...defaultProps} onSkip={onSkip} />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));
      expect(onSkip).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // 2.3-CMP-006: Disabled State
  // ============================================

  describe('Disabled State', () => {
    it('Send and Skip disabled when disabled prop is true', () => {
      render(<MessageCompose {...defaultProps} disabled={true} />);
      const sendBtn = screen.getByTestId('scripture-message-send-btn');
      const skipBtn = screen.getByTestId('scripture-message-skip-btn');
      expect(sendBtn).toBeDisabled();
      expect(skipBtn).toBeDisabled();
    });
  });

  // ============================================
  // 2.3-CMP-007: Textarea Accessibility
  // ============================================

  describe('Accessibility', () => {
    it('textarea has correct aria-label', () => {
      render(<MessageCompose {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      expect(textarea.getAttribute('aria-label')).toBe('Message to partner');
    });

    it('focus moves to textarea on mount', () => {
      render(<MessageCompose {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      expect(document.activeElement).toBe(textarea);
    });
  });

  // ============================================
  // 2.3-CMP-008: Send Button Empty Guard
  // ============================================

  describe('Empty Message Guard', () => {
    it('send button is aria-disabled when textarea is empty', () => {
      render(<MessageCompose {...defaultProps} />);
      const sendBtn = screen.getByTestId('scripture-message-send-btn');
      expect(sendBtn.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not call onSend when message is empty', () => {
      const onSend = vi.fn();
      render(<MessageCompose {...defaultProps} onSend={onSend} />);
      fireEvent.click(screen.getByTestId('scripture-message-send-btn'));
      expect(onSend).not.toHaveBeenCalled();
    });

    it('does not call onSend when message is whitespace only', () => {
      const onSend = vi.fn();
      render(<MessageCompose {...defaultProps} onSend={onSend} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(screen.getByTestId('scripture-message-send-btn'));
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // 2.3-CMP-009: Character Counter Boundary
  // ============================================

  describe('Character Counter Boundary', () => {
    it('character counter appears at exactly 225 chars', () => {
      render(<MessageCompose {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(225) } });
      const counter = screen.getByTestId('scripture-message-char-count');
      expect(counter).toHaveTextContent('225/300');
    });

    it('character counter shows correct count at max length', () => {
      render(<MessageCompose {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(300) } });
      const counter = screen.getByTestId('scripture-message-char-count');
      expect(counter).toHaveTextContent('300/300');
    });

    it('character counter hidden at 224 chars', () => {
      render(<MessageCompose {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(224) } });
      expect(screen.queryByTestId('scripture-message-char-count')).toBeNull();
    });

    it('character counter has aria-live polite for screen readers', () => {
      render(<MessageCompose {...defaultProps} />);
      const textarea = screen.getByTestId('scripture-message-textarea');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(260) } });
      const counter = screen.getByTestId('scripture-message-char-count');
      expect(counter.getAttribute('aria-live')).toBe('polite');
    });
  });

  // ============================================
  // 2.3-CMP-010: Skip Button Label
  // ============================================

  describe('Skip Button Label', () => {
    it('skip button shows "Skip for now" (no-guilt language)', () => {
      render(<MessageCompose {...defaultProps} />);
      expect(screen.getByTestId('scripture-message-skip-btn')).toHaveTextContent('Skip for now');
    });
  });
});
