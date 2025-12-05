import { useState } from 'react';
import { imageCompressionService } from '../services/imageCompressionService';
import type { CompressionResult } from '../types';

type CompressionStatus = 'idle' | 'compressing' | 'complete' | 'error';

interface UseImageCompressionReturn {
  compress: (file: File) => Promise<CompressionResult | null>;
  result: CompressionResult | null;
  isCompressing: boolean;
  error: string | null;
  status: CompressionStatus;
  reset: () => void;
}

/**
 * useImageCompression Hook
 * Story 6.1: AC-6.1.4-6.1.9 - React state wrapper for image compression service
 *
 * Features:
 * - Async compression with loading states
 * - Error handling with AC-6.1.8 fallback support
 * - Status tracking: idle → compressing → complete/error
 * - Reset functionality for multiple compressions
 *
 * @example
 * ```tsx
 * const { compress, result, isCompressing, error } = useImageCompression();
 *
 * const handleFileSelect = async (file: File) => {
 *   const compressed = await compress(file);
 *   if (compressed) {
 *     // Use compressed.blob for upload
 *   }
 * };
 * ```
 */
export function useImageCompression(): UseImageCompressionReturn {
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [status, setStatus] = useState<CompressionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const compress = async (file: File): Promise<CompressionResult | null> => {
    try {
      setStatus('compressing');
      setError(null);
      setResult(null);

      // Validate file first (AC-6.1.1, AC-6.1.2)
      const validation = imageCompressionService.validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Compress image (AC-6.1.4-6.1.9)
      const compressed = await imageCompressionService.compressImage(file);

      setResult(compressed);
      setStatus('complete');
      return compressed;
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      setStatus('error');

      // AC-6.1.8: Fallback logic should be handled by caller
      // This hook just reports the error
      console.error('[useImageCompression] Compression failed:', errorMessage);
      return null;
    }
  };

  const reset = () => {
    setResult(null);
    setStatus('idle');
    setError(null);
  };

  return {
    compress,
    result,
    isCompressing: status === 'compressing',
    error,
    status,
    reset,
  };
}
