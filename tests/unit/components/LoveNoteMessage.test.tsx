/**
 * LoveNoteMessage Component Tests
 *
 * Tests for chat bubble component styling and display.
 * Story 2.1: AC-2.1.1 (message styling), AC-2.1.2 (timestamp display)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LoveNoteMessage } from '../../../src/components/love-notes/LoveNoteMessage';
import type { LoveNote } from '../../../src/types/models';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

describe('LoveNoteMessage', () => {
  const mockMessage: LoveNote = {
    id: 'note-1',
    from_user_id: 'user-1',
    to_user_id: 'user-2',
    content: 'I love you!',
    created_at: '2025-11-29T14:30:00Z',
  };

  // Mock date for consistent timestamp testing
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-29T15:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('own message styling (AC-2.1.1)', () => {
    it('renders with coral background for own messages', () => {
      const { container } = render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      // Check for coral background class
      const bubble = container.querySelector('[class*="bg-[#FF6B6B]"]');
      expect(bubble).toBeTruthy();
    });

    it('renders own messages right-aligned', () => {
      const { container } = render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      // Check for items-end class (right alignment)
      const wrapper = container.querySelector('[class*="items-end"]');
      expect(wrapper).toBeTruthy();
    });

    it('shows white text for own messages', () => {
      const { container } = render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      const bubble = container.querySelector('[class*="text-white"]');
      expect(bubble).toBeTruthy();
    });
  });

  describe('partner message styling (AC-2.1.1)', () => {
    it('renders with gray background for partner messages', () => {
      const { container } = render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={false}
          senderName="Partner"
        />
      );

      // Check for gray background class
      const bubble = container.querySelector('[class*="bg-[#E9ECEF]"]');
      expect(bubble).toBeTruthy();
    });

    it('renders partner messages left-aligned', () => {
      const { container } = render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={false}
          senderName="Partner"
        />
      );

      // Check for items-start class (left alignment)
      const wrapper = container.querySelector('[class*="items-start"]');
      expect(wrapper).toBeTruthy();
    });

    it('shows dark text for partner messages', () => {
      const { container } = render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={false}
          senderName="Partner"
        />
      );

      const bubble = container.querySelector('[class*="text-gray-800"]');
      expect(bubble).toBeTruthy();
    });
  });

  describe('message content display', () => {
    it('displays the message content', () => {
      render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      expect(screen.getByText('I love you!')).toBeInTheDocument();
    });

    it('displays sender name', () => {
      render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      expect(screen.getByText(/You/)).toBeInTheDocument();
    });

    it('handles long message content', () => {
      const longMessage: LoveNote = {
        ...mockMessage,
        content:
          'This is a very long message that should wrap properly in the chat bubble without breaking the layout or causing overflow issues.',
      };

      render(
        <LoveNoteMessage
          message={longMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      expect(
        screen.getByText(/This is a very long message/)
      ).toBeInTheDocument();
    });

    it('handles special characters in message', () => {
      const specialMessage: LoveNote = {
        ...mockMessage,
        content: '💕❤️ Love you! <3 & more 😍',
      };

      render(
        <LoveNoteMessage
          message={specialMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      expect(screen.getByText(/💕❤️ Love you!/)).toBeInTheDocument();
    });
  });

  describe('timestamp display (AC-2.1.2)', () => {
    it('displays timestamp in caption', () => {
      render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      // Should show sender name and timestamp separated by dot
      const caption = screen.getByText(/You.*·/);
      expect(caption).toBeInTheDocument();
    });

    it('shows timestamp in small text', () => {
      const { container } = render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      // Check for text-xs class on caption
      const caption = container.querySelector('span.text-xs');
      expect(caption).toBeTruthy();
    });
  });

  describe('sending state', () => {
    it('shows "Sending..." indicator when message is being sent', () => {
      const sendingMessage: LoveNote = {
        ...mockMessage,
        sending: true,
      };

      render(
        <LoveNoteMessage
          message={sendingMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      expect(screen.getByText('Sending...')).toBeInTheDocument();
    });

    it('applies opacity to bubble when sending', () => {
      const sendingMessage: LoveNote = {
        ...mockMessage,
        sending: true,
      };

      const { container } = render(
        <LoveNoteMessage
          message={sendingMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      const bubble = container.querySelector('[class*="opacity-70"]');
      expect(bubble).toBeTruthy();
    });
  });

  describe('error state', () => {
    it('shows "Failed to send" indicator on error', () => {
      const errorMessage: LoveNote = {
        ...mockMessage,
        error: true,
      };

      render(
        <LoveNoteMessage
          message={errorMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      expect(screen.getByText('Failed to send · Tap to retry')).toBeInTheDocument();
    });

    it('applies error border styling', () => {
      const errorMessage: LoveNote = {
        ...mockMessage,
        error: true,
      };

      const { container } = render(
        <LoveNoteMessage
          message={errorMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      const bubble = container.querySelector('[class*="border-red-500"]');
      expect(bubble).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('has proper role for list item', () => {
      const { container } = render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      const listItem = container.querySelector('[role="listitem"]');
      expect(listItem).toBeTruthy();
    });

    it('has aria-label with sender and timestamp', () => {
      const { container } = render(
        <LoveNoteMessage
          message={mockMessage}
          isOwnMessage={true}
          senderName="You"
        />
      );

      const listItem = container.querySelector('[aria-label*="Message from You"]');
      expect(listItem).toBeTruthy();
    });
  });
});
