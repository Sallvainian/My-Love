import { describe, it, expect, vi, beforeEach } from 'vitest';
import { imageCompressionService } from '../../../src/services/imageCompressionService';

// Mock canvas and Image API
const mockContext = {
  drawImage: vi.fn(),
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockContext),
  toBlob: vi.fn(),
};

// Mock Image constructor
class MockImage {
  width = 0;
  height = 0;
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

// Initialize global.Image as a mock constructor
let mockImageInstance: MockImage;
global.Image = vi.fn().mockImplementation(function(this: MockImage) {
  return mockImageInstance;
}) as unknown as typeof Image;

global.document.createElement = vi.fn((tagName: string) => {
  if (tagName === 'canvas') {
    return mockCanvas as unknown as HTMLCanvasElement;
  }
  throw new Error(`Unexpected element: ${tagName}`);
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock performance.now()
global.performance.now = vi.fn(() => 1000);

describe('imageCompressionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.width = 0;
    mockCanvas.height = 0;
    mockImageInstance = new MockImage();
    vi.mocked(global.Image).mockImplementation(function(this: MockImage) {
      return mockImageInstance;
    });
  });

  describe('validateImageFile', () => {
    it('AC-6.1.1: accepts JPEG images', () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });

      // Act
      const result = imageCompressionService.validateImageFile(file);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('AC-6.1.1: accepts PNG images', () => {
      // Arrange
      const file = new File([], 'test.png', { type: 'image/png' });

      // Act
      const result = imageCompressionService.validateImageFile(file);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('AC-6.1.1: accepts WebP images', () => {
      // Arrange
      const file = new File([], 'test.webp', { type: 'image/webp' });

      // Act
      const result = imageCompressionService.validateImageFile(file);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('AC-6.1.1: rejects non-image files', () => {
      // Arrange
      const file = new File([], 'test.pdf', { type: 'application/pdf' });

      // Act
      const result = imageCompressionService.validateImageFile(file);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported file format');
    });

    it('AC-6.1.2: rejects files larger than 25MB', () => {
      // Arrange
      const largeFile = new File([new ArrayBuffer(26 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });

      // Act
      const result = imageCompressionService.validateImageFile(largeFile);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
      expect(result.error).toContain('25 MB');
    });

    it('AC-6.1.2: accepts files at 25MB boundary', () => {
      // Arrange
      const file = new File([new ArrayBuffer(25 * 1024 * 1024)], 'test.jpg', {
        type: 'image/jpeg',
      });

      // Act
      const result = imageCompressionService.validateImageFile(file);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('warns for files larger than 10MB but under 25MB', () => {
      // Arrange
      const largeFile = new File([new ArrayBuffer(15 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });

      // Act
      const result = imageCompressionService.validateImageFile(largeFile);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('large');
      expect(result.warning).toContain('15.0 MB');
    });
  });

  describe('compressImage', () => {
    beforeEach(() => {
      // Setup default mock behavior
      mockImageInstance.width = 3000;
      mockImageInstance.height = 2000;

      // Mock successful canvas.toBlob
      mockCanvas.toBlob.mockImplementation((callback) => {
        const mockBlob = new Blob(['compressed'], { type: 'image/jpeg' });
        callback(mockBlob);
      });

      // Mock performance timing
      let callCount = 0;
      vi.mocked(performance.now).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 1000 : 2500; // 1500ms duration
      });
    });

    it('AC-6.1.4: reduces image dimensions to max 2048px width', async () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      mockImageInstance.width = 3000; // Wider than max
      mockImageInstance.height = 2000;

      // Trigger image load after createObjectURL
      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      const result = await imageCompressionService.compressImage(file);

      // Assert
      expect(result.width).toBe(2048); // Scaled to max width
      expect(result.height).toBe(Math.floor((2000 * 2048) / 3000)); // Proportional
    });

    it('AC-6.1.4: reduces image dimensions to max 2048px height', async () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      mockImageInstance.width = 2000;
      mockImageInstance.height = 3000; // Taller than max

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      const result = await imageCompressionService.compressImage(file);

      // Assert
      expect(result.height).toBe(2048); // Scaled to max height
      expect(result.width).toBe(Math.floor((2000 * 2048) / 3000)); // Proportional
    });

    it('AC-6.1.4: preserves aspect ratio when scaling', async () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      mockImageInstance.width = 4000;
      mockImageInstance.height = 3000; // 4:3 aspect ratio

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      const result = await imageCompressionService.compressImage(file);

      // Assert
      const originalRatio = 4000 / 3000;
      const compressedRatio = result.width / result.height;
      expect(Math.abs(originalRatio - compressedRatio)).toBeLessThan(0.01); // Within 1%
    });

    it('AC-6.1.4: does not upscale small images', async () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      mockImageInstance.width = 800;
      mockImageInstance.height = 600;

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      const result = await imageCompressionService.compressImage(file);

      // Assert
      expect(result.width).toBe(800); // Original dimensions preserved
      expect(result.height).toBe(600);
    });

    it('AC-6.1.5: uses 80% JPEG quality', async () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      mockImageInstance.width = 1000;
      mockImageInstance.height = 1000;

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      await imageCompressionService.compressImage(file);

      // Assert
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/jpeg',
        0.8 // AC-6.1.5: 80% quality
      );
    });

    it('AC-6.1.6: outputs JPEG format', async () => {
      // Arrange
      const file = new File([], 'test.png', { type: 'image/png' });
      mockImageInstance.width = 1000;
      mockImageInstance.height = 1000;

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      const result = await imageCompressionService.compressImage(file);

      // Assert
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/jpeg', // AC-6.1.6: Always JPEG
        expect.any(Number)
      );
      expect(result.blob.type).toBe('image/jpeg');
    });

    it('AC-6.1.7: measures compression timing with performance.now()', async () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      mockImageInstance.width = 1000;
      mockImageInstance.height = 1000;

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      await imageCompressionService.compressImage(file);

      // Assert
      expect(performance.now).toHaveBeenCalledTimes(2); // Start and end
    });

    it('AC-6.1.7: logs performance warning if exceeds 3s for large files', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const largeFile = new File([new ArrayBuffer(12 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(largeFile, 'size', { value: 12 * 1024 * 1024 });

      mockImageInstance.width = 4000;
      mockImageInstance.height = 3000;

      // Mock slow compression (>3000ms)
      let callCount = 0;
      vi.mocked(performance.now).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 1000 : 4500; // 3500ms duration
      });

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      await imageCompressionService.compressImage(largeFile);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance target exceeded')
      );
      consoleSpy.mockRestore();
    });

    it('AC-6.1.8: uses fallback on compression failure', async () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });

      // Clear and override the toBlob mock to simulate failure
      mockCanvas.toBlob.mockReset();
      mockCanvas.toBlob.mockImplementation((callback: BlobCallback) => {
        callback(null); // Simulate toBlob failure
      });

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      const result = await imageCompressionService.compressImage(file);

      // Assert - fallback returns original file with flag
      expect(result.fallbackUsed).toBe(true);
      expect(result.blob).toBe(file); // Returns original file
    });

    it('AC-6.1.9: EXIF stripping is automatic via Canvas redraw (documented)', async () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      mockImageInstance.width = 1000;
      mockImageInstance.height = 1000;

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      await imageCompressionService.compressImage(file);

      // Assert
      // AC-6.1.9: EXIF metadata is automatically stripped when drawing to canvas
      // This is a browser behavior, not something we can test programmatically
      // Documentation: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    it('cleans up object URLs after image load', async () => {
      // Arrange
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      mockImageInstance.width = 1000;
      mockImageInstance.height = 1000;

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      await imageCompressionService.compressImage(file);

      // Assert
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('returns compression metadata', async () => {
      // Arrange
      const originalSize = 5 * 1024 * 1024; // 5MB
      const file = new File([new ArrayBuffer(originalSize)], 'test.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(file, 'size', { value: originalSize });

      mockImageInstance.width = 2000;
      mockImageInstance.height = 1500;

      const compressedBlob = new Blob([new ArrayBuffer(500 * 1024)], {
        type: 'image/jpeg',
      }); // 500KB
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(compressedBlob);
      });

      setTimeout(() => {
        if (mockImageInstance.onload) mockImageInstance.onload();
      }, 0);

      // Act
      const result = await imageCompressionService.compressImage(file);

      // Assert
      expect(result.originalSize).toBe(originalSize);
      expect(result.compressedSize).toBe(compressedBlob.size);
      expect(result.width).toBe(2000);
      expect(result.height).toBe(1500);
      expect(result.blob).toBe(compressedBlob);
    });
  });
});
