/**
 * Image Configuration Constants
 *
 * Centralized configuration for image compression, storage, validation,
 * and rate limiting. Using `as const` for type-level immutability.
 *
 * Usage:
 *   import { IMAGE_COMPRESSION, IMAGE_STORAGE } from '@/config/images';
 *   const maxWidth = IMAGE_COMPRESSION.MAX_WIDTH; // Type: 2048 (literal)
 */

/**
 * Image compression settings for Canvas API compression
 * Epic 6: Love Notes Image Attachments (AC-6.1.4-6.1.9)
 */
export const IMAGE_COMPRESSION = {
  /** Maximum output width in pixels (maintains aspect ratio) */
  MAX_WIDTH: 2048,
  /** Maximum output height in pixels (maintains aspect ratio) */
  MAX_HEIGHT: 2048,
  /** JPEG quality (0.0-1.0, 80% = 0.8) */
  QUALITY: 0.8,
} as const;

/**
 * Image validation limits
 * Epic 6: File validation (AC-6.1.1, AC-6.1.2)
 */
export const IMAGE_VALIDATION = {
  /** Maximum raw file size in bytes (25MB) */
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,
  /** Large file warning threshold in bytes (10MB) - may approach 3s compression limit */
  LARGE_FILE_WARNING_BYTES: 10 * 1024 * 1024,
  /** Threshold for showing compression indicator in preview (5MB) */
  COMPRESSION_INDICATOR_THRESHOLD_BYTES: 5 * 1024 * 1024,
  /** Allowed MIME types for image upload */
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
  /** Allowed file extensions (server-side validation) */
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'] as readonly string[],
} as const;

/**
 * Supabase Storage configuration for love note images
 * Epic 6: Storage integration (Story 6.2)
 */
export const IMAGE_STORAGE = {
  /** Storage bucket name */
  BUCKET_NAME: 'love-notes-images',
  /** Signed URL expiry duration in seconds (1 hour) */
  SIGNED_URL_EXPIRY_SECONDS: 3600,
  /** Refresh buffer before expiry in milliseconds (5 minutes) */
  URL_REFRESH_BUFFER_MS: 5 * 60 * 1000,
  /** Maximum cached URLs to prevent memory growth */
  MAX_CACHE_SIZE: 100,
  /** Cache control header value for uploads */
  CACHE_CONTROL: '3600',
  /** Content type for compressed uploads */
  CONTENT_TYPE: 'image/jpeg',
} as const;

/**
 * Notes pagination and rate limiting
 * Story 2.2: Send flow with rate limiting
 */
export const NOTES_CONFIG = {
  /** Default page size for notes pagination */
  PAGE_SIZE: 50,
  /** Maximum messages allowed in rate limit window */
  RATE_LIMIT_MAX_MESSAGES: 10,
  /** Rate limit window duration in milliseconds (1 minute) */
  RATE_LIMIT_WINDOW_MS: 60000,
} as const;

/**
 * Type exports for readonly constant objects
 */
export type ImageCompressionConfig = typeof IMAGE_COMPRESSION;
export type ImageValidationConfig = typeof IMAGE_VALIDATION;
export type ImageStorageConfig = typeof IMAGE_STORAGE;
export type NotesConfig = typeof NOTES_CONFIG;
