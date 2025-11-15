import { describe, it, expect } from 'vitest';
import {
  PAGINATION,
  STORAGE_QUOTAS,
  VALIDATION_LIMITS,
  BYTES_PER_KB,
  BYTES_PER_MB,
} from '../../src/config/performance';

describe('Performance Constants', () => {
  describe('PAGINATION', () => {
    it('defines default page sizes', () => {
      expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(20);
      expect(PAGINATION.MAX_PAGE_SIZE).toBe(100);
      expect(PAGINATION.MIN_PAGE_SIZE).toBe(1);
    });
  });

  describe('STORAGE_QUOTAS', () => {
    it('defines quota thresholds', () => {
      expect(STORAGE_QUOTAS.WARNING_THRESHOLD_PERCENT).toBe(80);
      expect(STORAGE_QUOTAS.ERROR_THRESHOLD_PERCENT).toBe(95);
      expect(STORAGE_QUOTAS.DEFAULT_QUOTA_MB).toBe(50);
      expect(STORAGE_QUOTAS.DEFAULT_QUOTA_BYTES).toBe(50 * 1024 * 1024);
    });
  });

  describe('VALIDATION_LIMITS', () => {
    it('defines text length limits', () => {
      expect(VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH).toBe(1000);
      expect(VALIDATION_LIMITS.CAPTION_MAX_LENGTH).toBe(500);
      expect(VALIDATION_LIMITS.NOTE_MAX_LENGTH).toBe(1000);
    });
  });

  describe('Byte Conversion Constants', () => {
    it('defines byte conversion factors', () => {
      expect(BYTES_PER_KB).toBe(1024);
      expect(BYTES_PER_MB).toBe(1024 * 1024);
    });
  });

  describe('Type Safety', () => {
    it('constants are readonly', () => {
      // TypeScript compile-time check: attempting to modify should fail
      // @ts-expect-error - Cannot assign to readonly property
      PAGINATION.DEFAULT_PAGE_SIZE = 30;
    });
  });
});
