/**
 * Performance Configuration Constants
 *
 * Centralized magic numbers for pagination, storage quotas, validation limits,
 * and byte conversions. Using `as const` for type-level immutability.
 *
 * Usage:
 *   import { PAGINATION, STORAGE_QUOTAS } from '@/config/performance';
 *   const pageSize = PAGINATION.DEFAULT_PAGE_SIZE; // Type: 20 (literal)
 */

/**
 * Pagination configuration for lazy loading
 * Epic 4: Photo pagination (AC-4.2.4)
 */
export const PAGINATION = {
  /** Default number of items per page (photos, messages) */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum page size to prevent performance degradation */
  MAX_PAGE_SIZE: 100,
  /** Minimum page size (must fetch at least 1 item) */
  MIN_PAGE_SIZE: 1,
} as const;

/**
 * Storage quota thresholds and defaults
 * Epic 4: Storage monitoring (AC-4.1.9)
 */
export const STORAGE_QUOTAS = {
  /** Display warning banner when quota exceeds this percentage */
  WARNING_THRESHOLD_PERCENT: 80,
  /** Display error state and block uploads at this percentage */
  ERROR_THRESHOLD_PERCENT: 95,
  /** Fallback quota when Storage API unavailable (Safari < 15.2) */
  DEFAULT_QUOTA_MB: 50,
  /** Fallback quota in bytes (50MB * 1024 * 1024) */
  DEFAULT_QUOTA_BYTES: 50 * 1024 * 1024,
  /** Monitoring interval in milliseconds (5 minutes) */
  MONITORING_INTERVAL_MS: 5 * 60 * 1000,
} as const;

/**
 * Validation length limits for text fields
 * Epic 5: Zod validation schemas (Story 5.5)
 */
export const VALIDATION_LIMITS = {
  /** Maximum message text length (messages, custom messages) */
  MESSAGE_TEXT_MAX_LENGTH: 1000,
  /** Maximum photo caption length */
  CAPTION_MAX_LENGTH: 500,
  /** Maximum mood note length */
  NOTE_MAX_LENGTH: 1000,
  /** Maximum partner name length */
  PARTNER_NAME_MAX_LENGTH: 50,
} as const;

/**
 * Byte conversion constants for storage calculations
 */
export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = 1024 * 1024;

/**
 * Log message truncation length for debugging
 */
export const LOG_TRUNCATE_LENGTH = 50;

/**
 * Type exports for readonly constant objects
 */
export type PaginationConfig = typeof PAGINATION;
export type StorageQuotaConfig = typeof STORAGE_QUOTAS;
export type ValidationLimitsConfig = typeof VALIDATION_LIMITS;
