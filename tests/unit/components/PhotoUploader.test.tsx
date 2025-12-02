import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PhotoUploader } from '../../../src/components/photos/PhotoUploader';
import { imageCompressionService } from '../../../src/services/imageCompressionService';

// Mock Supabase client before any imports that use it
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test/path.jpg' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.url' }, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Create mock functions that can be accessed in tests
const mockUploadPhoto = vi.fn().mockResolvedValue(undefined);
const mockLoadPhotos = vi.fn().mockResolvedValue(undefined);

// Mock usePhotos hook
vi.mock('../../../src/hooks/usePhotos', () => ({
  usePhotos: vi.fn(() => ({
    photos: [],
    isUploading: false,
    uploadProgress: 0,
    error: null,
    storageWarning: null,
    uploadPhoto: mockUploadPhoto,
    loadPhotos: mockLoadPhotos,
    deletePhoto: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
    clearStorageWarning: vi.fn(),
  })),
}));

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

describe('PhotoUploader', () => {
  const mockOnUpload = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to get file input element
  const getFileInput = (container: HTMLElement): HTMLInputElement => {
    return container.querySelector('input[type="file"]') as HTMLInputElement;
  };

  describe('File Input', () => {
    it('AC-6.1.1: accepts JPEG, PNG, WebP images via accept attribute', () => {
      // Arrange & Act
      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      // Assert
      expect(input.accept).toBe('image/jpeg,image/png,image/webp');
    });

    it('AC-6.1.10: has capture="environment" for mobile camera', () => {
      // Arrange & Act
      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      // Assert
      expect(input.getAttribute('capture')).toBe('environment');
    });
  });

  describe('File Validation', () => {
    it('AC-6.1.2: shows error for files larger than 25MB', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: false,
        error: 'File is too large (30.0 MB). Maximum file size is 25 MB.',
      });

      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      // Create file without actually allocating 30MB buffer
      const largeFile = new File([], 'large.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(largeFile, 'size', { value: 30 * 1024 * 1024 });

      // Act
      fireEvent.change(input, { target: { files: [largeFile] } });

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/too large/i)).toBeInTheDocument();
      });
      expect(imageCompressionService.validateImageFile).toHaveBeenCalledWith(largeFile);
    });

    it('AC-6.1.1: shows error for unsupported file types', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: false,
        error: 'Unsupported file format. Please select a JPEG, PNG, or WebP image.',
      });

      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      const pdfFile = new File([], 'document.pdf', { type: 'application/pdf' });

      // Act
      fireEvent.change(input, { target: { files: [pdfFile] } });

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Unsupported file format/i)).toBeInTheDocument();
      });
    });

    it('shows warning for large files (>10MB but <25MB)', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
        warning: 'This file is large (15.0 MB). Compression may take a few seconds.',
      });

      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      // Create file without actually allocating 15MB buffer
      const largeFile = new File([], 'large.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 });

      // Act
      fireEvent.change(input, { target: { files: [largeFile] } });

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/large.*15\.0 MB/i)).toBeInTheDocument();
      });
    });
  });

  describe('Preview Display', () => {
    it('AC-6.1.3: displays image preview after selection', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });

      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      const file = new File([], 'test.jpg', { type: 'image/jpeg' });

      // Act
      fireEvent.change(input, { target: { files: [file] } });

      // Assert
      await waitFor(() => {
        const preview = screen.getByAltText('Preview');
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute('src', 'blob:mock-preview-url');
      });
      expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    });

    it('shows upload button after preview', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });

      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      const file = new File([], 'test.jpg', { type: 'image/jpeg' });

      // Act
      fireEvent.change(input, { target: { files: [file] } });

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Upload Photo', { selector: 'button' })).toBeInTheDocument();
      });
    });

    it('displays file info after selection', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });

      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      const file = new File([new ArrayBuffer(5 * 1024 * 1024)], 'vacation.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 });

      // Act
      fireEvent.change(input, { target: { files: [file] } });

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/File: vacation\.jpg/i)).toBeInTheDocument();
        expect(screen.getByText(/Size: 5\.00 MB/i)).toBeInTheDocument();
      });
    });
  });

  describe('Upload Workflow', () => {
    it('calls compressImage and uploadPhoto from hook', async () => {
      // Arrange
      const mockBlob = new Blob(['compressed'], { type: 'image/jpeg' });
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });
      vi.mocked(imageCompressionService.compressImage).mockResolvedValue({
        blob: mockBlob,
        width: 2048,
        height: 1536,
        originalSize: 5 * 1024 * 1024,
        compressedSize: 500 * 1024,
      });

      const mockOnSuccess = vi.fn();
      const { container } = render(<PhotoUploader onUploadSuccess={mockOnSuccess} />);
      const input = getFileInput(container);

      const file = new File([], 'test.jpg', { type: 'image/jpeg' });

      // Act
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Upload Photo', { selector: 'button' })).toBeInTheDocument();
      });

      const uploadButton = screen.getByText('Upload Photo', { selector: 'button' });
      fireEvent.click(uploadButton);

      // Assert
      await waitFor(() => {
        expect(imageCompressionService.compressImage).toHaveBeenCalledWith(file);
        // Verify uploadPhoto was called via the hook
        expect(mockUploadPhoto).toHaveBeenCalled();
      });

      // Verify success callback was triggered
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('shows error message on compression failure (AC-6.1.8: file >= 10MB)', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });
      vi.mocked(imageCompressionService.compressImage).mockRejectedValue(
        new Error('Compression failed: Canvas toBlob failed')
      );

      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      // Create a file >= 10MB to trigger error instead of fallback
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

      // Assert - AC-6.1.8: Files >= 10MB show error when compression fails
      await waitFor(() => {
        expect(screen.getByText(/file is too large.*cannot be uploaded without compression/i)).toBeInTheDocument();
      });
    });
  });

  describe('Object URL Cleanup', () => {
    it('revokes object URL when selecting different photo', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });

      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      const file1 = new File([], 'test1.jpg', { type: 'image/jpeg' });
      const file2 = new File([], 'test2.jpg', { type: 'image/jpeg' });

      // Act
      fireEvent.change(input, { target: { files: [file1] } });
      await waitFor(() => screen.getByAltText('Preview'));

      vi.clearAllMocks();

      fireEvent.change(input, { target: { files: [file2] } });

      // Assert
      await waitFor(() => {
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
      });
    });

    it('revokes object URL on unmount', () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });

      const { unmount, container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      const file = new File([], 'test.jpg', { type: 'image/jpeg' });

      // Act
      fireEvent.change(input, { target: { files: [file] } });

      vi.clearAllMocks();
      unmount();

      // Assert
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
    });

    it('cleans up when clicking "Choose Different Photo"', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });

      const { container } = render(<PhotoUploader />);
      const input = getFileInput(container);

      const file = new File([], 'test.jpg', { type: 'image/jpeg' });

      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => screen.getByAltText('Preview'));

      vi.clearAllMocks();

      // Act
      const clearButton = screen.getByText('Choose Different Photo');
      fireEvent.click(clearButton);

      // Assert
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel callback when close button clicked', () => {
      // Arrange
      render(<PhotoUploader onCancel={mockOnCancel} />);

      // Act
      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      // Assert
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('cleans up preview when canceling', async () => {
      // Arrange
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: true,
      });

      const { container } = render(<PhotoUploader onCancel={mockOnCancel} />);
      const input = getFileInput(container);

      const file = new File([], 'test.jpg', { type: 'image/jpeg' });

      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => screen.getByAltText('Preview'));

      vi.clearAllMocks();

      // Act
      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      // Assert
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
