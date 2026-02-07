import { customMessageService } from './customMessageService';
import type { CustomMessage } from '../types';
import { CreateMessageInputSchema } from '../validation/schemas';
import { isZodError } from '../validation/errorMessages';
import { ZodError } from 'zod';
import { LOG_TRUNCATE_LENGTH } from '../config/performance';

/**
 * Migration Service - One-time migration from LocalStorage to IndexedDB
 * Story 3.5: Migrate custom messages from LocalStorage (Story 3.4) to IndexedDB
 *
 * This service handles the one-time migration of custom messages from LocalStorage
 * to the production-ready IndexedDB storage system. After successful migration,
 * the LocalStorage data is removed to prevent duplicate migrations.
 */

const LOCALSTORAGE_KEY = 'my-love-custom-messages';

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Migrate custom messages from LocalStorage to IndexedDB
 * AC-3.5.1: Custom messages are saved to IndexedDB messages store
 *
 * @returns MigrationResult with counts and any errors encountered
 */
export async function migrateCustomMessagesFromLocalStorage(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    console.log('[MigrationService] Starting LocalStorage to IndexedDB migration...');

    // Check for existing LocalStorage data
    const localStorageData = localStorage.getItem(LOCALSTORAGE_KEY);

    if (!localStorageData) {
      console.log('[MigrationService] No LocalStorage data found - migration not needed');
      return result;
    }

    // Parse LocalStorage JSON data
    let customMessages: CustomMessage[];
    try {
      customMessages = JSON.parse(localStorageData);
      console.log('[MigrationService] Found', customMessages.length, 'messages in LocalStorage');
    } catch (parseError) {
      const errorMsg = 'Failed to parse LocalStorage data';
      console.error('[MigrationService]', errorMsg, parseError);
      result.errors.push(errorMsg);
      result.success = false;
      return result;
    }

    // Validate data structure
    if (!Array.isArray(customMessages)) {
      const errorMsg = 'LocalStorage data is not an array';
      console.error('[MigrationService]', errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
      return result;
    }

    // Get existing messages from IndexedDB to detect duplicates
    const existingMessages = await customMessageService.getAll({ isCustom: true });
    const existingTexts = new Set(existingMessages.map((m) => m.text.trim().toLowerCase()));

    // Migrate each message to IndexedDB
    for (const message of customMessages) {
      try {
        // Story 5.5: Validate message structure with Zod schema
        const messageInput = {
          text: message.text,
          category: message.category,
          active: message.active ?? true, // Default to active if not specified
          tags: message.tags || [],
        };

        // Validate with schema before migration
        const validated = CreateMessageInputSchema.parse(messageInput);

        // Check for duplicates (same text already in IndexedDB)
        const normalizedText = validated.text.trim().toLowerCase();
        if (existingTexts.has(normalizedText)) {
          console.log(
            '[MigrationService] Skipping duplicate message:',
            validated.text.substring(0, LOG_TRUNCATE_LENGTH) + '...'
          );
          result.skippedCount++;
          continue;
        }

        // Create message in IndexedDB via customMessageService
        // (customMessageService.create() also validates, but we validate here to provide better error messages during migration)
        await customMessageService.create(validated);

        existingTexts.add(normalizedText); // Prevent duplicates within same migration
        result.migratedCount++;
        console.log(
          '[MigrationService] Migrated message:',
          validated.text.substring(0, LOG_TRUNCATE_LENGTH) + '...'
        );
      } catch (error) {
        // Handle validation errors gracefully
        if (isZodError(error)) {
          const errorMsg = `Invalid message data: ${message.text?.substring(0, LOG_TRUNCATE_LENGTH)} - ${(error as ZodError).issues[0]?.message}`;
          console.warn('[MigrationService]', errorMsg);
          result.skippedCount++;
          continue;
        }

        const errorMsg = `Failed to migrate message: ${message.text?.substring(0, LOG_TRUNCATE_LENGTH)}`;
        console.error('[MigrationService]', errorMsg, error);
        result.errors.push(errorMsg);
      }
    }

    // Remove LocalStorage data after successful migration
    if (result.migratedCount > 0 || result.skippedCount === customMessages.length) {
      localStorage.removeItem(LOCALSTORAGE_KEY);
      console.log('[MigrationService] Removed LocalStorage data after migration');
    }

    // Log migration summary
    console.log('[MigrationService] Migration complete:', {
      migratedCount: result.migratedCount,
      skippedCount: result.skippedCount,
      errorCount: result.errors.length,
    });

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    console.error('[MigrationService] Migration failed with unexpected error:', error);
    result.success = false;
    result.errors.push('Unexpected migration error');
    return result;
  }
}
