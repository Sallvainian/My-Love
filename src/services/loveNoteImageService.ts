/**
 * Love Note Image Service
 *
 * Handles image uploads for love notes chat messages.
 * Uses Supabase Storage with signed URLs for private access.
 *
 * Features:
 * - Image compression via imageCompressionService
 * - Upload to love-notes-images bucket
 * - Signed URL generation for viewing
 * - Storage path format: {user_id}/{timestamp}-{uuid}.jpg
 */

import { supabase } from '../api/supabaseClient';
import { imageCompressionService } from './imageCompressionService';

const BUCKET_NAME = 'love-notes-images';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds
const URL_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry

/**
 * Cache for signed URLs with expiry tracking
 * Prevents unnecessary API calls and handles expiry proactively
 */
interface CachedUrl {
  url: string;
  expiresAt: number;
}

const signedUrlCache = new Map<string, CachedUrl>();

/**
 * Check if a cached URL is still valid (not expired or about to expire)
 */
function isCacheValid(cached: CachedUrl): boolean {
  return Date.now() < cached.expiresAt - URL_REFRESH_BUFFER;
}

/**
 * Clear expired entries from the cache periodically
 * Called internally to prevent memory growth
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [path, cached] of signedUrlCache) {
    if (now >= cached.expiresAt) {
      signedUrlCache.delete(path);
    }
  }
}

export interface UploadResult {
  storagePath: string;
  compressedSize: number;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: number;
}

/**
 * Generate a unique storage path for a love note image
 * Format: {userId}/{timestamp}-{uuid}.jpg
 */
function generateStoragePath(userId: string): string {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();
  return `${userId}/${timestamp}-${uuid}.jpg`;
}

/**
 * Upload a love note image to Supabase Storage
 *
 * @param file - Image file to upload
 * @param userId - Current user's ID (for storage path)
 * @returns Storage path for database record
 * @throws Error if compression or upload fails
 */
export async function uploadLoveNoteImage(
  file: File,
  userId: string
): Promise<UploadResult> {
  // Validate file first
  const validation = imageCompressionService.validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file');
  }

  // Compress the image
  const { blob, compressedSize } = await imageCompressionService.compressImage(file);

  // Generate storage path
  const storagePath = generateStoragePath(userId);

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('[LoveNoteImageService] Upload failed:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  console.log('[LoveNoteImageService] Image uploaded:', storagePath);

  return {
    storagePath,
    compressedSize,
  };
}

/**
 * Upload a pre-compressed blob (for retry flows)
 * Avoids re-compression when retrying failed uploads
 *
 * @param blob - Already compressed image blob
 * @param userId - Current user's ID
 * @returns Storage path for database record
 */
export async function uploadCompressedBlob(
  blob: Blob,
  userId: string
): Promise<UploadResult> {
  const storagePath = generateStoragePath(userId);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('[LoveNoteImageService] Upload failed:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  return {
    storagePath,
    compressedSize: blob.size,
  };
}

/**
 * Get a signed URL for viewing a love note image
 * Uses caching with automatic expiry handling
 *
 * @param storagePath - Storage path from love_notes.image_url
 * @param forceRefresh - Force fetching a new URL even if cached
 * @returns Signed URL with expiry timestamp
 * @throws Error if URL generation fails
 */
export async function getSignedImageUrl(
  storagePath: string,
  forceRefresh = false
): Promise<SignedUrlResult> {
  // Clean expired entries periodically (every ~10 calls)
  if (Math.random() < 0.1) {
    cleanExpiredCache();
  }

  // Check cache first (unless force refresh requested)
  if (!forceRefresh) {
    const cached = signedUrlCache.get(storagePath);
    if (cached && isCacheValid(cached)) {
      if (import.meta.env.DEV) {
        console.log('[LoveNoteImageService] Cache hit for:', storagePath);
      }
      return {
        url: cached.url,
        expiresAt: cached.expiresAt,
      };
    }
  }

  // Fetch new signed URL
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (error) {
    console.error('[LoveNoteImageService] Signed URL failed:', error);
    throw new Error(`Failed to get image URL: ${error.message}`);
  }

  const result: SignedUrlResult = {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_EXPIRY * 1000,
  };

  // Cache the result
  signedUrlCache.set(storagePath, result);

  if (import.meta.env.DEV) {
    console.log('[LoveNoteImageService] Cached new URL for:', storagePath);
  }

  return result;
}

/**
 * Check if a signed URL needs to be refreshed (expired or about to expire)
 * Useful for components to proactively refresh URLs
 *
 * @param storagePath - Storage path to check
 * @returns true if URL should be refreshed
 */
export function needsUrlRefresh(storagePath: string): boolean {
  const cached = signedUrlCache.get(storagePath);
  if (!cached) return true;
  return !isCacheValid(cached);
}

/**
 * Clear the signed URL cache
 * Call on logout or when cleaning up
 */
export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

/**
 * Delete a love note image from storage
 * Used when deleting messages (future feature)
 *
 * @param storagePath - Storage path to delete
 */
export async function deleteLoveNoteImage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error('[LoveNoteImageService] Delete failed:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}
