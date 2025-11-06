import { customMessageService } from './customMessageService';
import type { CustomMessage } from '../types';

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
    const existingTexts = new Set(existingMessages.map(m => m.text.trim().toLowerCase()));

    // Migrate each message to IndexedDB
    for (const message of customMessages) {
      try {
        // Validate message structure
        if (!message.text || !message.category) {
          console.warn('[MigrationService] Skipping invalid message:', message);
          result.skippedCount++;
          continue;
        }

        // Check for duplicates (same text already in IndexedDB)
        const normalizedText = message.text.trim().toLowerCase();
        if (existingTexts.has(normalizedText)) {
          console.log('[MigrationService] Skipping duplicate message:', message.text.substring(0, 50) + '...');
          result.skippedCount++;
          continue;
        }

        // Create message in IndexedDB via customMessageService
        await customMessageService.create({
          text: message.text,
          category: message.category,
          active: message.active ?? true, // Default to active if not specified
          tags: message.tags || [],
        });

        existingTexts.add(normalizedText); // Prevent duplicates within same migration
        result.migratedCount++;
        console.log('[MigrationService] Migrated message:', message.text.substring(0, 50) + '...');
      } catch (error) {
        const errorMsg = `Failed to migrate message: ${message.text?.substring(0, 50)}`;
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
