import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '../../../src/components/love-notes/MessageInput';

// Mock server-only
vi.mock('server-only', () => ({}));

// Mock useVibration hook
vi.mock('../../../src/hooks/useVibration', () => ({
  useVibration: () => ({
    vibrate: vi.fn(),
    isSupported: true,
  }),
}));

// Mock store hook
const mockSendNote = vi.fn();
vi.mock('../../../src/hooks/useLoveNotes', () => ({
  useLoveNotes: () => ({
    sendNote: mockSendNote,
  }),
}));

describe('MessageInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendNote.mockResolvedValue(undefined);
  });

  it('should render input field and send button', () => {
    render(<MessageInput />);

    expect(screen.getByPlaceholderText(/send a love note/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('should have send button disabled when input is empty', () => {
    render(<MessageInput />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when text is entered', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Hello!');

    expect(sendButton).not.toBeDisabled();
  });

  it('should call sendNote when send button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Hello, my love!');
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSendNote).toHaveBeenCalledWith('Hello, my love!');
    });
  });

  it('should clear input after successful send', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i) as HTMLTextAreaElement;
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Test message');
    await user.click(sendButton);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should send message on Enter key', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i);

    await user.type(input, 'Test message{Enter}');

    await waitFor(() => {
      expect(mockSendNote).toHaveBeenCalledWith('Test message');
    });
  });

  it('should add new line on Shift+Enter', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i) as HTMLTextAreaElement;

    await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

    expect(input.value).toContain('Line 1\nLine 2');
    expect(mockSendNote).not.toHaveBeenCalled();
  });

  it('should clear input on Escape key', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i) as HTMLTextAreaElement;

    await user.type(input, 'Test message');
    expect(input.value).toBe('Test message');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input.value).toBe('');
  });

  it('should show character counter at 900+ characters', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i);

    // Type 899 characters - counter should not show
    await user.type(input, 'a'.repeat(899));
    expect(screen.queryByText(/\d+\/1000/)).not.toBeInTheDocument();

    // Type 1 more character - counter should show
    await user.type(input, 'a');
    expect(screen.getByText(/900\/1000/)).toBeInTheDocument();
  });

  it('should disable send button when exceeding 1000 characters', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'a'.repeat(1001));

    expect(sendButton).toBeDisabled();
    expect(screen.getByText(/1001\/1000/)).toBeInTheDocument();
  });

  it('should have proper ARIA labels', () => {
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i);
    expect(input).toHaveAttribute('aria-label', expect.stringContaining('message'));
  });

  it('should not send empty or whitespace-only messages', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i);

    // Try whitespace only
    await user.type(input, '   {Enter}');

    expect(mockSendNote).not.toHaveBeenCalled();
  });

  it('should handle send errors gracefully', async () => {
    mockSendNote.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<MessageInput />);

    const input = screen.getByPlaceholderText(/send a love note/i);

    await user.type(input, 'Test message{Enter}');

    // Should not throw or crash
    await waitFor(() => {
      expect(mockSendNote).toHaveBeenCalled();
    });
  });
});
