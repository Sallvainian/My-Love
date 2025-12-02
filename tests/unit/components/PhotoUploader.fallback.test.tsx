import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PhotoUploader } from '../../../src/components/photos/PhotoUploader';
import { imageCompressionService } from '../../../src/services/imageCompressionService';

// Mock imageCompressionService
vi.mock('../../../src/services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: vi.fn(),
    compressImage: vi.fn(),
  },
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
global.URL.revokeObjectURL = vi.fn();

// Mock Image for dimension testing
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 0;
  height = 0;
  src = '';

  constructor() {
    // Simulate successful image load after a microtask
    setTimeout(() => {
      this.width = 1920;
      this.height = 1080;
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
}

global.Image = MockImage as any;

describe('PhotoUploader - AC-6.1.8 Fallback Logic', () => {
  const mockOnUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to get file input element
  const getFileInput = (container: HTMLElement): HTMLInputElement => {
    return container.querySelector('input[type="file"]') as HTMLInputElement;
  };

  describe('Compression Failure Fallback', () => {
    it('AC-6.1.8: uses original file if compression fails and file < 10MB', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });
      vi.mocked(imageCompressionService.compressImage).mockRejectedValue(
        new Error('Compression failed: Canvas toBlob failed')
      );

      const { container } = render(<PhotoUploader onUpload={mockOnUpload} />);
      const input = getFileInput(container);

      // Create a 5MB file (< 10MB threshold)
      const smallFile = new File([new ArrayBuffer(5 * 1024 * 1024)], 'small.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(smallFile, 'size', { value: 5 * 1024 * 1024 });

      // Act
      fireEvent.change(input, { target: { files: [smallFile] } });

      await waitFor(() => {
        expect(screen.getByText('Upload Photo', { selector: 'button' })).toBeInTheDocument();
      });

      const uploadButton = screen.getByText('Upload Photo', { selector: 'button' });
      fireEvent.click(uploadButton);

      // Assert - should fall back to original file
      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalled();
      });

      // Verify that onUpload was called with the original file (as a blob)
      const uploadCall = mockOnUpload.mock.calls[0];
      expect(uploadCall).toBeDefined();
      expect(uploadCall[0]).toBeInstanceOf(Blob); // Original file
      expect(uploadCall[1]).toEqual({
        width: 1920,
        height: 1080,
        originalSize: 5 * 1024 * 1024,
        compressedSize: 5 * 1024 * 1024, // Same as original when using fallback
      });
    });

    it('AC-6.1.8: shows error if compression fails and file >= 10MB', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });
      vi.mocked(imageCompressionService.compressImage).mockRejectedValue(
        new Error('Compression failed: Canvas toBlob failed')
      );

      const { container } = render(<PhotoUploader onUpload={mockOnUpload} />);
      const input = getFileInput(container);

      // Create a 15MB file (>= 10MB threshold)
      const largeFile = new File([new ArrayBuffer(15 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 });

      // Act
      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText('Upload Photo', { selector: 'button' })).toBeInTheDocument();
      });

      const uploadButton = screen.getByText('Upload Photo', { selector: 'button' });
      fireEvent.click(uploadButton);

      // Assert - should show error message
      await waitFor(() => {
        expect(screen.getByText(/file is too large.*cannot be uploaded without compression/i)).toBeInTheDocument();
      });

      // Should NOT call onUpload
      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('AC-6.1.8: uses original file at exactly 10MB threshold', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });
      vi.mocked(imageCompressionService.compressImage).mockRejectedValue(
        new Error('Compression failed')
      );

      const { container } = render(<PhotoUploader onUpload={mockOnUpload} />);
      const input = getFileInput(container);

      // Create exactly 10MB file (edge case)
      const exactFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'exact.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(exactFile, 'size', { value: 10 * 1024 * 1024 });

      // Act
      fireEvent.change(input, { target: { files: [exactFile] } });

      await waitFor(() => {
        expect(screen.getByText('Upload Photo', { selector: 'button' })).toBeInTheDocument();
      });

      const uploadButton = screen.getByText('Upload Photo', { selector: 'button' });
      fireEvent.click(uploadButton);

      // Assert - should fall back to original file (10MB is acceptable)
      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalled();
      });

      const uploadCall = mockOnUpload.mock.calls[0];
      expect(uploadCall[1]).toEqual({
        width: 1920,
        height: 1080,
        originalSize: 10 * 1024 * 1024,
        compressedSize: 10 * 1024 * 1024,
      });
    });

    it('AC-6.1.8: shows error at 10MB + 1 byte threshold', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });
      vi.mocked(imageCompressionService.compressImage).mockRejectedValue(
        new Error('Compression failed')
      );

      const { container } = render(<PhotoUploader onUpload={mockOnUpload} />);
      const input = getFileInput(container);

      // Create 10MB + 1 byte file (should trigger error)
      const overFile = new File([new ArrayBuffer(10 * 1024 * 1024 + 1)], 'over.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(overFile, 'size', { value: 10 * 1024 * 1024 + 1 });

      // Act
      fireEvent.change(input, { target: { files: [overFile] } });

      await waitFor(() => {
        expect(screen.getByText('Upload Photo', { selector: 'button' })).toBeInTheDocument();
      });

      const uploadButton = screen.getByText('Upload Photo', { selector: 'button' });
      fireEvent.click(uploadButton);

      // Assert - should show error
      await waitFor(() => {
        expect(screen.getByText(/file is too large.*cannot be uploaded without compression/i)).toBeInTheDocument();
      });

      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('AC-6.1.8: shows error when dimension extraction fails during fallback', async () => {
      // Arrange - Mock compression to fail
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });
      vi.mocked(imageCompressionService.compressImage).mockRejectedValue(
        new Error('Canvas context failed')
      );

      // Mock Image to fail loading at global level
      const originalImage = global.Image;
      global.Image = class MockFailingImage {
        set src(_: string) {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'));
          }, 0);
        }
        onerror: ((ev: Event) => void) | null = null;
        onload: (() => void) | null = null;
      } as any;

      const { container } = render(<PhotoUploader onUpload={mockOnUpload} />);
      const input = getFileInput(container);

      // Create small file that would trigger fallback (5MB < 10MB)
      const file = new File([new ArrayBuffer(5 * 1024 * 1024)], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 });

      // Act
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Upload Photo', { selector: 'button' })).toBeInTheDocument();
      });

      const uploadButton = screen.getByText('Upload Photo', { selector: 'button' });
      fireEvent.click(uploadButton);

      // Assert - should show dimension error
      await waitFor(() => {
        expect(screen.getByText(/unable to process this image file.*corrupted or.*unsupported format/i)).toBeInTheDocument();
      });

      // Should NOT call onUpload
      expect(mockOnUpload).not.toHaveBeenCalled();

      // Restore
      global.Image = originalImage;
    });
  });
});
