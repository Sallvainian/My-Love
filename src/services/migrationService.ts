import { ZodError } from 'zod/v4';
import { LOG_TRUNCATE_LENGTH } from '../config/performance';
import type { CustomMessage } from '../types';
import { logger } from '../utils/logger';
import { isZodError } from '../validation/errorMessages';
import { CreateMessageInputSchema } from '../validation/schemas';
import { customMessageService } from './customMessageService';

/**
 * Migration Service - One-time migration from LocalStorage to IndexedDB
 * Story 3.5: Migrate custom messages from LocalStorage (Story 3.4) to IndexedDB
 *
 * This service handles the one-time migration of custom messages from LocalStorage
 * to the production-ready IndexedDB storage system. The LocalStorage list is
 * kept afterwards rather than removed; see below for why.
 *
 * THESE ROWS HAVE NO OWNER, AND THIS MIGRATION MAY NOT INVENT ONE
 *
 * The Story 3.4 LocalStorage list predates accounts. It is per-device data, and
 * the account signed in when this runs — App.tsx fires it once a session
 * exists — is simply whoever opened the app first, not the author. Stamping it
 * with that id would hand one partner the other's messages, which is the exact
 * leak the ownership work removes. So the rows are stored unowned: preserved on
 * disk, hidden from every account, claimed by none. Returning them to a user is
 * a product decision, not one a migration makes silently.
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
    logger.info('[MigrationService] Starting LocalStorage to IndexedDB migration...');

    // Check for existing LocalStorage data
    const localStorageData = localStorage.getItem(LOCALSTORAGE_KEY);

    if (!localStorageData) {
      logger.info('[MigrationService] No LocalStorage data found - migration not needed');
      return result;
    }

    // Parse LocalStorage JSON data
    let customMessages: CustomMessage[];
    try {
      customMessages = JSON.parse(localStorageData);
      logger.info('[MigrationService] Found', customMessages.length, 'messages in LocalStorage');
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

    // Duplicate detection now lives inside customMessageService: it compares
    // against the unowned rows only, and does the check and the write in one
    // transaction. Reading those rows here to build a text set is precisely the
    // unscoped read the service stopped exposing — and an owner-scoped read
    // would compare this device's legacy list against the signed-in account's
    // own messages, skipping a migration because the wrong person wrote the
    // same sentence.
    //
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
        // (createUnownedIfAbsent() also validates, but we validate here to provide better error messages during migration)
        const validated = CreateMessageInputSchema.parse(messageInput);

        // Store without an owner, skipping a text this device already migrated.
        // The service's check-and-write is one transaction, so it also prevents
        // duplicates WITHIN this batch without a local text set.
        const outcome = await customMessageService.createUnownedIfAbsent(validated);

        if (outcome === 'duplicate') {
          logger.debug(
            '[MigrationService] Skipping duplicate message:',
            validated.text.substring(0, LOG_TRUNCATE_LENGTH) + '...'
          );
          result.skippedCount++;
          continue;
        }

        result.migratedCount++;
        logger.info(
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

    // The LocalStorage list is KEPT, not removed. The rows this migration wrote
    // are unowned — preserved on disk but hidden from every account until the
    // product decision above returns them — so this key holds the only copy a
    // user can still read. Removing it would destroy that copy for a benefit
    // the dedup already provides: `createUnownedIfAbsent` compares normalized
    // text inside one readwrite transaction, so a repeat migration reports
    // 'duplicate' and writes nothing.
    if (result.migratedCount > 0 || result.skippedCount === customMessages.length) {
      logger.info('[MigrationService] Kept LocalStorage data: migrated rows are unowned');
    }

    // Log migration summary
    logger.info('[MigrationService] Migration complete:', {
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
