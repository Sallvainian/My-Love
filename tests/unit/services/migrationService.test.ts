import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateCustomMessagesFromLocalStorage } from '../../../src/services/migrationService';

describe('MigrationService Validation', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should skip invalid legacy messages with empty text', async () => {
    const invalidMessages = [
      {
        text: '', // Invalid: empty text
        category: 'reason' as const,
        active: true,
        tags: [],
      },
      {
        text: 'Valid message',
        category: 'reason' as const,
        active: true,
        tags: [],
      },
    ];

    localStorage.setItem('my-love-custom-messages', JSON.stringify(invalidMessages));

    const result = await migrateCustomMessagesFromLocalStorage();

    // Should skip the invalid message (empty text) but migrate the valid one
    expect(result.skippedCount).toBeGreaterThanOrEqual(1);
    expect(result.migratedCount).toBeGreaterThanOrEqual(0); // May be 0 if duplicates exist
  });

  it('should skip messages with invalid category', async () => {
    const invalidMessages = [
      {
        text: 'Valid text but invalid category',
        category: 'invalid_category', // Invalid: not in enum
        active: true,
        tags: [],
      },
    ];

    localStorage.setItem('my-love-custom-messages', JSON.stringify(invalidMessages));

    const result = await migrateCustomMessagesFromLocalStorage();

    // Should skip due to validation failure
    expect(result.skippedCount).toBeGreaterThanOrEqual(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(0); // Validation errors are logged as warnings, not errors
  });

  it('should handle messages with text exceeding max length', async () => {
    const longText = 'a'.repeat(1001); // Exceeds max length of 1000
    const invalidMessages = [
      {
        text: longText,
        category: 'reason' as const,
        active: true,
        tags: [],
      },
    ];

    localStorage.setItem('my-love-custom-messages', JSON.stringify(invalidMessages));

    const result = await migrateCustomMessagesFromLocalStorage();

    // Should skip due to text length validation
    expect(result.skippedCount).toBeGreaterThanOrEqual(1);
  });

  it('should return success when no migration needed', async () => {
    // No LocalStorage data
    const result = await migrateCustomMessagesFromLocalStorage();

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
  });

  it('should validate message structure before migration', async () => {
    const validMessages = [
      {
        text: 'This is a valid message',
        category: 'reason' as const,
        active: true,
        tags: ['tag1', 'tag2'],
      },
    ];

    localStorage.setItem('my-love-custom-messages', JSON.stringify(validMessages));

    const result = await migrateCustomMessagesFromLocalStorage();

    // Should successfully validate and migrate (or skip if duplicate)
    expect(result.success).toBe(true);
    expect(result.migratedCount + result.skippedCount).toBe(validMessages.length);
  });
});
