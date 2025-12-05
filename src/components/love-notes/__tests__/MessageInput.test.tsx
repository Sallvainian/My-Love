/**
 * MessageInput Component Tests
 *
 * Unit tests for the message input component with image picker functionality.
 * Tests text input, image selection, validation, and send behavior.
 *
 * Love Notes Images: Task 11 - Component tests (AC-1 through AC-6, AC-10, AC-11)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '../MessageInput';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock useLoveNotes hook
const mockSendNote = vi.fn();
vi.mock('../../../hooks/useLoveNotes', () => ({
  useLoveNotes: () => ({
    sendNote: mockSendNote,
  }),
}));

// Mock useVibration hook
const mockVibrate = vi.fn();
vi.mock('../../../hooks/useVibration', () => ({
  useVibration: () => ({
    vibrate: mockVibrate,
  }),
}));

// Mock image compression service
vi.mock('../../../services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: vi.fn(() => ({ valid: true })),
    estimateCompressedSize: vi.fn((file: File) => Math.round(file.size * 0.1)),
  },
}));

// Mock URL methods
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
});

describe('MessageInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendNote.mockResolvedValue(undefined);
  });

  describe('Text Input', () => {
    it('should render textarea with placeholder', () => {
      render(<MessageInput />);

      expect(screen.getByPlaceholderText('Send a love note...')).toBeInTheDocument();
    });

    it('should update content when typing', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello love');

      expect(textarea).toHaveValue('Hello love');
    });

    it('should show character counter at 900+ characters', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      const longText = 'a'.repeat(905);
      await user.type(textarea, longText);

      expect(screen.getByText('905/1000')).toBeInTheDocument();
    });

    it('should show warning color at 950+ characters', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      const longText = 'a'.repeat(955);
      await user.type(textarea, longText);

      const counter = screen.getByText('955/1000');
      expect(counter).toHaveClass('text-yellow-600');
    });

    it('should show error message when over 1000 characters', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      const longText = 'a'.repeat(1005);
      await user.type(textarea, longText);

      expect(screen.getByRole('alert')).toHaveTextContent('Message is too long');
    });
  });

  describe('Image Picker', () => {
    it('should render image picker button', () => {
      render(<MessageInput />);

      const imageButton = screen.getByRole('button', { name: /attach image/i });
      expect(imageButton).toBeInTheDocument();
    });

    it('should have hidden file input with correct accept types', () => {
      render(<MessageInput />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
      expect(fileInput).toHaveClass('hidden');
    });

    it('should show ImagePreview when image is selected', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      render(<MessageInput />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByAltText('Selected image preview')).toBeInTheDocument();
      });
    });

    it('should show error for invalid image file', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: false,
        error: 'Unsupported file format',
      });

      render(<MessageInput />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });

      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Unsupported file format');
      });

      // Should trigger error haptic
      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100]);
    });

    it('should trigger selection haptic when valid image selected', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      render(<MessageInput />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(mockVibrate).toHaveBeenCalledWith(30);
      });
    });

    it('should change placeholder when image is selected', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      render(<MessageInput />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a caption...')).toBeInTheDocument();
      });
    });

    it('should remove image when remove button clicked in preview', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      render(<MessageInput />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByAltText('Selected image preview')).toBeInTheDocument();
      });

      const removeButton = screen.getByRole('button', { name: /remove selected image/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByAltText('Selected image preview')).not.toBeInTheDocument();
      });
    });
  });

  describe('Send Button', () => {
    it('should be disabled when no text and no image', () => {
      render(<MessageInput />);

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });

    it('should be enabled when text is entered', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeEnabled();
    });

    it('should be enabled when only image is selected (no text)', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      render(<MessageInput />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /send message/i });
        expect(sendButton).toBeEnabled();
      });
    });

    it('should be disabled when text exceeds limit', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      const longText = 'a'.repeat(1005);
      await user.type(textarea, longText);

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Send Behavior', () => {
    it('should call sendNote with text content', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'I love you');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSendNote).toHaveBeenCalledWith('I love you', undefined);
      });
    });

    it('should call sendNote with image file', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      const user = userEvent.setup();
      render(<MessageInput />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByAltText('Selected image preview')).toBeInTheDocument();
      });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSendNote).toHaveBeenCalledWith('', mockFile);
      });
    });

    it('should call sendNote with both text and image', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      const user = userEvent.setup();
      render(<MessageInput />);

      // Select image
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      // Type caption
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Look at this!');

      await waitFor(() => {
        expect(screen.getByAltText('Selected image preview')).toBeInTheDocument();
      });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSendNote).toHaveBeenCalledWith('Look at this!', mockFile);
      });
    });

    it('should clear input and image after successful send', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      const user = userEvent.setup();
      render(<MessageInput />);

      // Add text
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message');

      // Add image
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByAltText('Selected image preview')).toBeInTheDocument();
      });

      // Send
      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(textarea).toHaveValue('');
        expect(screen.queryByAltText('Selected image preview')).not.toBeInTheDocument();
      });
    });

    it('should trigger success haptic on send', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockVibrate).toHaveBeenCalledWith(50);
      });
    });

    it('should trigger error haptic on send failure', async () => {
      mockSendNote.mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100]);
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should send on Enter (without Shift)', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockSendNote).toHaveBeenCalled();
      });
    });

    it('should add newline on Shift+Enter', async () => {
      const user = userEvent.setup();
      render(<MessageInput />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

      expect(textarea).toHaveValue('Line 1\nLine 2');
      expect(mockSendNote).not.toHaveBeenCalled();
    });

    it('should clear input and image on Escape', async () => {
      const { imageCompressionService } = await import(
        '../../../services/imageCompressionService'
      );
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      const user = userEvent.setup();
      render(<MessageInput />);

      // Add text
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test');

      // Add image
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByAltText('Selected image preview')).toBeInTheDocument();
      });

      // Press Escape
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(textarea).toHaveValue('');
        expect(screen.queryByAltText('Selected image preview')).not.toBeInTheDocument();
      });
    });
  });
});
