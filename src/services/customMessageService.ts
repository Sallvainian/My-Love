import { openDB } from 'idb';
import type {
  Message,
  CreateMessageInput,
  UpdateMessageInput,
  MessageFilter,
  CustomMessagesExport,
} from '../types';
import { BaseIndexedDBService } from './BaseIndexedDBService';
import {
  CreateMessageInputSchema,
  UpdateMessageInputSchema,
  CustomMessagesExportSchema,
  createValidationError,
  isZodError,
} from '../validation';
import { LOG_TRUNCATE_LENGTH } from '../config/performance';

const DB_NAME = 'my-love-db';
const DB_VERSION = 3; // Story 6.2: Updated to 3 to match moodService for version compatibility

/**
 * Custom Message Service - IndexedDB CRUD operations for custom messages
 * Story 3.5: Migrate from LocalStorage to IndexedDB for scalability
 * Story 5.3: Refactored to extend BaseIndexedDBService to reduce duplication
 * Story 5.5: Added validation layer to prevent data corruption
 *
 * Extends: BaseIndexedDBService<Message>
 * - Inherits: init(), add(), get(), getAll(), update(), delete(), clear(), getPage()
 * - Implements: getStoreName(), _doInit()
 * - Preserves: Service-specific methods (getActiveCustomMessages, exportMessages, importMessages)
 */
class CustomMessageService extends BaseIndexedDBService<Message> {
  /**
   * Get the object store name for messages
   */
  protected getStoreName(): string {
    return 'messages';
  }

  /**
   * Initialize IndexedDB connection (DB v3 for version compatibility)
   * Story 6.2: Updated to v3 to match moodService and photoStorageService
   */
  protected async _doInit(): Promise<void> {
    try {
      if (import.meta.env.DEV) {
        console.log('[CustomMessageService] Initializing IndexedDB (version 3)...');
      }

      this.db = await openDB<any>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, _transaction) {
          if (import.meta.env.DEV) {
            console.log(
              `[CustomMessageService] Upgrading database from v${oldVersion} to v${newVersion}`
            );
          }

          // Create messages store if it doesn't exist
          if (!db.objectStoreNames.contains('messages')) {
            const messageStore = db.createObjectStore('messages', {
              keyPath: 'id',
              autoIncrement: true,
            });
            messageStore.createIndex('by-category', 'category');
            messageStore.createIndex('by-date', 'createdAt');
            if (import.meta.env.DEV) {
              console.log('[CustomMessageService] Created messages store with indexes');
            }
          }

          // Ensure photos store exists (should have been created in v2)
          if (!db.objectStoreNames.contains('photos')) {
            const photoStore = db.createObjectStore('photos', {
              keyPath: 'id',
              autoIncrement: true,
            });
            photoStore.createIndex('by-date', 'uploadDate', { unique: false });
            if (import.meta.env.DEV) {
              console.log('[CustomMessageService] Created photos store (fallback)');
            }
          }

          // Ensure moods store exists (should have been created in v3)
          if (!db.objectStoreNames.contains('moods')) {
            const moodsStore = db.createObjectStore('moods', {
              keyPath: 'id',
              autoIncrement: true,
            });
            moodsStore.createIndex('by-date', 'date', { unique: true });
            if (import.meta.env.DEV) {
              console.log('[CustomMessageService] Created moods store (fallback)');
            }
          }
        },
      });

      if (import.meta.env.DEV) {
        console.log('[CustomMessageService] IndexedDB initialized successfully (v3)');
      }
    } catch (error) {
      this.handleError('initialize', error as Error);
    }
  }

  /**
   * Create a new custom message in IndexedDB
   * AC-3.5.1: Save to IndexedDB messages store with isCustom: true
   * AC-5.5.6: Validate input at service boundary before IndexedDB write
   * Uses inherited add() method from base class
   */
  async create(input: CreateMessageInput): Promise<Message> {
    try {
      // Validate input at service boundary
      const validated = CreateMessageInputSchema.parse(input);

      const message: Omit<Message, 'id'> = {
        text: validated.text,
        category: validated.category,
        isCustom: true,
        active: validated.active ?? true, // Default: true
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: validated.tags || [],
      };

      const created = await super.add(message);
      if (import.meta.env.DEV) {
        console.log('[CustomMessageService] Custom message created, id:', created.id);
      }

      return created;
    } catch (error) {
      // Transform Zod validation errors into user-friendly messages
      if (isZodError(error)) {
        console.error('[CustomMessageService] Validation failed:', error.issues);
        throw createValidationError(error);
      }
      console.error('[CustomMessageService] Failed to create custom message:', error);
      console.error('[CustomMessageService] Input:', input);
      throw error;
    }
  }

  /**
   * Update an existing custom message
   * AC-3.5.4: Update active field to control rotation participation
   * AC-5.5.6: Validate input at service boundary before IndexedDB write
   * Uses inherited update() method from base class with custom updatedAt logic
   */
  async updateMessage(input: UpdateMessageInput): Promise<void> {
    try {
      // Validate input at service boundary
      const validated = UpdateMessageInputSchema.parse(input);

      const updates: Partial<Message> = {
        ...(validated.text !== undefined && { text: validated.text }),
        ...(validated.category !== undefined && { category: validated.category }),
        ...(validated.active !== undefined && { active: validated.active }),
        ...(validated.tags !== undefined && { tags: validated.tags }),
        updatedAt: new Date(),
      };

      await super.update(validated.id, updates);
      if (import.meta.env.DEV) {
        console.log('[CustomMessageService] Custom message updated, id:', validated.id);
      }
    } catch (error) {
      // Transform Zod validation errors into user-friendly messages
      if (isZodError(error)) {
        console.error('[CustomMessageService] Validation failed:', error.issues);
        throw createValidationError(error);
      }
      console.error('[CustomMessageService] Failed to update custom message:', error);
      console.error('[CustomMessageService] Input:', input);
      throw error;
    }
  }

  /**
   * Get all messages with optional filtering
   * AC-3.5.3: Category filter works with custom messages
   */
  async getAll(filter?: MessageFilter): Promise<Message[]> {
    try {
      await this.init();

      let messages: Message[];

      // Use index if filtering by category
      if (filter?.category && filter.category !== 'all') {
        messages = await (this.db! as any).getAllFromIndex(
          'messages',
          'by-category',
          filter.category
        );
      } else {
        messages = await (this.db! as any).getAll('messages');
      }

      // Filter by isCustom
      if (filter?.isCustom !== undefined) {
        messages = messages.filter((m) => m.isCustom === filter.isCustom);
      }

      // Filter by active status
      if (filter?.active !== undefined) {
        messages = messages.filter((m) => m.active === filter.active);
      }

      // Filter by search term
      if (filter?.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        messages = messages.filter((m) => m.text.toLowerCase().includes(term));
      }

      // Filter by tags
      if (filter?.tags && filter.tags.length > 0) {
        messages = messages.filter(
          (m) => m.tags && m.tags.some((tag) => filter.tags!.includes(tag))
        );
      }

      if (import.meta.env.DEV) {
        console.log(
          '[CustomMessageService] Retrieved messages, count:',
          messages.length,
          'filter:',
          filter
        );
      }
      return messages;
    } catch (error) {
      console.error('[CustomMessageService] Failed to get all messages:', error);
      console.error('[CustomMessageService] Filter:', filter);
      return []; // Graceful fallback: return empty array
    }
  }

  /**
   * Note: delete() and get() methods are inherited from BaseIndexedDBService
   * - delete(id: number): Promise<void> - Delete message by ID
   * - get(id: number): Promise<Message | null> - Get message by ID (replaces getById)
   */

  /**
   * Get only active custom messages for rotation algorithm
   * AC-3.5.2: Only messages with active: true participate in daily rotation
   */
  async getActiveCustomMessages(): Promise<Message[]> {
    return this.getAll({ isCustom: true, active: true });
  }

  /**
   * Export all custom messages to JSON for backup
   * AC-3.5.6: Export functionality for backing up custom messages
   */
  async exportMessages(): Promise<CustomMessagesExport> {
    try {
      const messages = await this.getAll({ isCustom: true });

      const exportData: CustomMessagesExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map((m) => ({
          text: m.text,
          category: m.category,
          active: m.active ?? true,
          tags: m.tags || [],
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt?.toISOString() || m.createdAt.toISOString(),
        })),
      };

      if (import.meta.env.DEV) {
        console.log('[CustomMessageService] Exported messages, count:', messages.length);
      }
      return exportData;
    } catch (error) {
      console.error('[CustomMessageService] Failed to export messages:', error);
      // Return empty export on failure
      return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        messageCount: 0,
        messages: [],
      };
    }
  }

  /**
   * Import custom messages from JSON backup
   * AC-3.5.6: Import functionality with duplicate detection
   * AC-5.5.6: Validate import data structure before processing
   */
  async importMessages(
    exportData: CustomMessagesExport
  ): Promise<{ imported: number; skipped: number }> {
    try {
      // Validate import data structure at service boundary
      const validated = CustomMessagesExportSchema.parse(exportData);

      if (validated.version !== '1.0') {
        throw new Error(`Unsupported export version: ${validated.version}`);
      }

      let importedCount = 0;
      let skippedCount = 0;

      // Get existing custom message texts for duplicate detection
      const existingMessages = await this.getAll({ isCustom: true });
      const existingTexts = new Set(existingMessages.map((m) => m.text.trim().toLowerCase()));

      for (const msg of validated.messages) {
        const normalizedText = msg.text.trim().toLowerCase();

        if (existingTexts.has(normalizedText)) {
          skippedCount++;
          if (import.meta.env.DEV) {
            console.log(
              '[CustomMessageService] Skipping duplicate message:',
              msg.text.substring(0, LOG_TRUNCATE_LENGTH) + '...'
            );
          }
        } else {
          await this.create({
            text: msg.text,
            category: msg.category,
            active: msg.active,
            tags: msg.tags,
          });
          existingTexts.add(normalizedText); // Prevent duplicates within same import
          importedCount++;
        }
      }

      if (import.meta.env.DEV) {
        console.log(
          '[CustomMessageService] Import complete - imported:',
          importedCount,
          'skipped:',
          skippedCount
        );
      }
      return { imported: importedCount, skipped: skippedCount };
    } catch (error) {
      // Transform Zod validation errors into user-friendly messages
      if (isZodError(error)) {
        console.error('[CustomMessageService] Import data validation failed:', error.issues);
        throw createValidationError(error);
      }
      console.error('[CustomMessageService] Failed to import messages:', error);
      console.error('[CustomMessageService] Export data:', exportData);
      throw error;
    }
  }
}

// Singleton instance
export const customMessageService = new CustomMessageService();
