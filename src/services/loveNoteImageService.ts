/**
 * Love Note Image Service
 *
 * Handles image uploads for love notes chat messages.
 * Uses Edge Function for server-side validation + Supabase Storage.
 *
 * Features:
 * - Image compression via imageCompressionService (client-side, saves bandwidth)
 * - Server-side validation via Edge Function (MIME, size, rate limiting)
 * - Signed URL generation for viewing with caching
 * - Storage path format: {user_id}/{timestamp}-{uuid}.jpg
 */

import { supabase } from '../api/supabaseClient';
import { imageCompressionService } from './imageCompressionService';
import { IMAGE_STORAGE } from '../config/images';

/** Edge Function URL for image upload with server-side validation */
const UPLOAD_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-love-note-image`;

const {
  BUCKET_NAME,
  SIGNED_URL_EXPIRY_SECONDS: SIGNED_URL_EXPIRY,
  URL_REFRESH_BUFFER_MS: URL_REFRESH_BUFFER,
  MAX_CACHE_SIZE,
} = IMAGE_STORAGE;

/**
 * Cache for signed URLs with expiry tracking
 * Prevents unnecessary API calls and handles expiry proactively
 */
interface CachedUrl {
  url: string;
  expiresAt: number;
  lastAccessed: number; // For LRU eviction
}

const signedUrlCache = new Map<string, CachedUrl>();

/**
 * In-flight request deduplication
 * Prevents duplicate API calls when multiple components request same path
 */
const pendingRequests = new Map<string, Promise<SignedUrlResult>>();

/**
 * Check if a cached URL is still valid (not expired or about to expire)
 */
function isCacheValid(cached: CachedUrl): boolean {
  return Date.now() < cached.expiresAt - URL_REFRESH_BUFFER;
}

/**
 * Clear expired entries from the cache
 * Also enforces max cache size with LRU eviction
 */
function cleanCache(): void {
  const now = Date.now();

  // First, remove expired entries
  for (const [path, cached] of signedUrlCache) {
    if (now >= cached.expiresAt) {
      signedUrlCache.delete(path);
    }
  }

  // If still over limit, remove least recently accessed
  if (signedUrlCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(signedUrlCache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toRemove = entries.slice(0, signedUrlCache.size - MAX_CACHE_SIZE);
    for (const [path] of toRemove) {
      signedUrlCache.delete(path);
    }

    if (import.meta.env.DEV) {
      console.log('[LoveNoteImageService] Cache LRU eviction:', toRemove.length, 'entries');
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
 * Edge Function response type
 */
interface EdgeFunctionResponse {
  success?: boolean;
  storagePath?: string;
  size?: number;
  mimeType?: string;
  rateLimitRemaining?: number;
  error?: string;
  message?: string;
}

/**
 * Upload a love note image via Edge Function
 *
 * Flow:
 * 1. Client-side validation and compression (saves bandwidth)
 * 2. Upload to Edge Function for server-side validation
 * 3. Edge Function validates MIME (magic bytes), size, rate limit
 * 4. Edge Function uploads to Storage and returns path
 *
 * @param file - Image file to upload
 * @param _userId - Current user's ID (unused - Edge Function gets from JWT)
 * @returns Storage path for database record
 * @throws Error if validation, compression, or upload fails
 */
export async function uploadLoveNoteImage(
  file: File,
  _userId: string
): Promise<UploadResult> {
  // Client-side validation first (fast feedback)
  const validation = imageCompressionService.validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file');
  }

  // Compress the image client-side (saves bandwidth)
  const { blob, compressedSize } = await imageCompressionService.compressImage(file);

  // Get current session for auth header
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  // Upload via Edge Function for server-side validation
  const response = await fetch(UPLOAD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: blob,
  });

  const result: EdgeFunctionResponse = await response.json();

  if (!response.ok || !result.success) {
    const errorMessage = result.message || result.error || 'Upload failed';
    console.error('[LoveNoteImageService] Edge Function error:', result);

    // Handle specific error codes
    if (response.status === 429) {
      throw new Error('Too many uploads. Please wait a minute and try again.');
    }
    if (response.status === 413) {
      throw new Error('Image is too large. Please try a smaller image.');
    }
    if (response.status === 415) {
      throw new Error('Invalid image type. Please use JPEG, PNG, WebP, or GIF.');
    }

    throw new Error(errorMessage);
  }

  console.log('[LoveNoteImageService] Image uploaded via Edge Function:', result.storagePath);

  return {
    storagePath: result.storagePath!,
    compressedSize,
  };
}

/**
 * Upload a pre-compressed blob via Edge Function (for retry flows)
 * Avoids re-compression when retrying failed uploads
 *
 * @param blob - Already compressed image blob
 * @param _userId - Current user's ID (unused - Edge Function gets from JWT)
 * @returns Storage path for database record
 */
export async function uploadCompressedBlob(
  blob: Blob,
  _userId: string
): Promise<UploadResult> {
  // Get current session for auth header
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  // Upload via Edge Function for server-side validation
  const response = await fetch(UPLOAD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: blob,
  });

  const result: EdgeFunctionResponse = await response.json();

  if (!response.ok || !result.success) {
    const errorMessage = result.message || result.error || 'Upload failed';
    console.error('[LoveNoteImageService] Edge Function error:', result);
    throw new Error(errorMessage);
  }

  return {
    storagePath: result.storagePath!,
    compressedSize: blob.size,
  };
}

/**
 * Get a signed URL for viewing a love note image
 * Uses caching with automatic expiry handling and request deduplication
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
  const now = Date.now();

  // Check cache first (unless force refresh requested)
  if (!forceRefresh) {
    const cached = signedUrlCache.get(storagePath);
    if (cached && isCacheValid(cached)) {
      // Update last accessed time for LRU tracking
      cached.lastAccessed = now;
      if (import.meta.env.DEV) {
        console.log('[LoveNoteImageService] Cache hit for:', storagePath);
      }
      return {
        url: cached.url,
        expiresAt: cached.expiresAt,
      };
    }
  }

  // Check for in-flight request to prevent duplicate API calls
  const pending = pendingRequests.get(storagePath);
  if (pending && !forceRefresh) {
    if (import.meta.env.DEV) {
      console.log('[LoveNoteImageService] Deduplicating request for:', storagePath);
    }
    return pending;
  }

  // Create the fetch promise
  const fetchPromise = (async (): Promise<SignedUrlResult> => {
    try {
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

      // Cache the result with LRU tracking
      signedUrlCache.set(storagePath, {
        ...result,
        lastAccessed: Date.now(),
      });

      // Clean cache if needed (deterministic, on size threshold)
      if (signedUrlCache.size > MAX_CACHE_SIZE) {
        cleanCache();
      }

      if (import.meta.env.DEV) {
        console.log('[LoveNoteImageService] Cached new URL for:', storagePath);
      }

      return result;
    } finally {
      // Remove from pending requests when complete
      pendingRequests.delete(storagePath);
    }
  })();

  // Track pending request for deduplication
  pendingRequests.set(storagePath, fetchPromise);

  return fetchPromise;
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
 * Batch fetch signed URLs for multiple storage paths
 * Uses parallel fetching with cache optimization and request deduplication
 *
 * @param storagePaths - Array of storage paths to fetch URLs for
 * @returns Map of storage path to signed URL result (null if failed)
 */
export async function batchGetSignedUrls(
  storagePaths: string[]
): Promise<Map<string, SignedUrlResult | null>> {
  const results = new Map<string, SignedUrlResult | null>();
  const now = Date.now();

  // Filter out paths that already have valid cached URLs
  const pathsToFetch: string[] = [];
  for (const path of storagePaths) {
    const cached = signedUrlCache.get(path);
    if (cached && isCacheValid(cached)) {
      // Update last accessed for LRU tracking
      cached.lastAccessed = now;
      results.set(path, { url: cached.url, expiresAt: cached.expiresAt });
    } else {
      pathsToFetch.push(path);
    }
  }

  if (pathsToFetch.length === 0) {
    if (import.meta.env.DEV) {
      console.log('[LoveNoteImageService] Batch: all URLs from cache');
    }
    return results;
  }

  // Fetch remaining URLs in parallel (uses deduplication internally)
  const fetchPromises = pathsToFetch.map(async (path) => {
    try {
      const result = await getSignedImageUrl(path);
      return { path, result };
    } catch (error) {
      console.error('[LoveNoteImageService] Batch fetch failed for:', path, error);
      return { path, result: null };
    }
  });

  const fetchResults = await Promise.all(fetchPromises);

  for (const { path, result } of fetchResults) {
    results.set(path, result);
  }

  if (import.meta.env.DEV) {
    console.log(
      `[LoveNoteImageService] Batch: ${storagePaths.length - pathsToFetch.length} cached, ${pathsToFetch.length} fetched`
    );
  }

  // Clean cache after batch to handle edge case where parallel fetches
  // exceed max size before individual cleanup checks can trigger
  if (signedUrlCache.size > MAX_CACHE_SIZE) {
    cleanCache();
  }

  return results;
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
