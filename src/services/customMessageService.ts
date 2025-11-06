import { openDB, type IDBPDatabase } from 'idb';
import type { Message, CreateMessageInput, UpdateMessageInput, MessageFilter, CustomMessagesExport } from '../types';

const DB_NAME = 'my-love-db';
const DB_VERSION = 1;

/**
 * Custom Message Service - IndexedDB CRUD operations for custom messages
 * Story 3.5: Migrate from LocalStorage to IndexedDB for scalability
 *
 * Patterns followed from StorageService:
 * - Singleton class with init() guard
 * - Comprehensive error handling and logging
 * - Graceful fallbacks for failures
 */
class CustomMessageService {
  private db: IDBPDatabase<any> | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB connection
   * Uses guard to prevent concurrent initialization
   */
  async init(): Promise<void> {
    // Return existing promise if initialization already in progress
    if (this.initPromise) {
      console.log('[CustomMessageService] Init already in progress, waiting...');
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      console.log('[CustomMessageService] Already initialized');
      return Promise.resolve();
    }

    // Store promise to prevent concurrent initialization
    this.initPromise = this._doInit();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async _doInit(): Promise<void> {
    try {
      console.log('[CustomMessageService] Initializing IndexedDB connection...');
      this.db = await openDB<any>(DB_NAME, DB_VERSION);
      console.log('[CustomMessageService] IndexedDB connection established');
    } catch (error) {
      console.error('[CustomMessageService] Failed to initialize IndexedDB:', error);
      console.error('[CustomMessageService] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Create a new custom message in IndexedDB
   * AC-3.5.1: Save to IndexedDB messages store with isCustom: true
   */
  async create(input: CreateMessageInput): Promise<Message> {
    try {
      await this.init();

      const message: Omit<Message, 'id'> = {
        text: input.text,
        category: input.category,
        isCustom: true,
        active: input.active ?? true, // Default: true
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: input.tags || [],
      };

      const id = await this.db!.add('messages', message);
      console.log('[CustomMessageService] Custom message created, id:', id);

      return { ...message, id: id as number } as Message;
    } catch (error) {
      console.error('[CustomMessageService] Failed to create custom message:', error);
      console.error('[CustomMessageService] Input:', input);
      throw error;
    }
  }

  /**
   * Update an existing custom message
   * AC-3.5.4: Update active field to control rotation participation
   */
  async update(input: UpdateMessageInput): Promise<void> {
    try {
      await this.init();

      const message = await this.db!.get('messages', input.id);
      if (!message) {
        throw new Error(`Message ${input.id} not found`);
      }

      const updated: Message = {
        ...message,
        ...(input.text !== undefined && { text: input.text }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.tags !== undefined && { tags: input.tags }),
        updatedAt: new Date(),
      };

      await this.db!.put('messages', updated);
      console.log('[CustomMessageService] Custom message updated, id:', input.id);
    } catch (error) {
      console.error('[CustomMessageService] Failed to update custom message:', error);
      console.error('[CustomMessageService] Input:', input);
      throw error;
    }
  }

  /**
   * Delete a custom message from IndexedDB
   * AC-3.5.5: Remove from IndexedDB and exclude from rotation
   */
  async delete(messageId: number): Promise<void> {
    try {
      await this.init();
      await this.db!.delete('messages', messageId);
      console.log('[CustomMessageService] Custom message deleted, id:', messageId);
    } catch (error) {
      console.error('[CustomMessageService] Failed to delete custom message:', error);
      console.error('[CustomMessageService] Message id:', messageId);
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
        messages = await this.db!.getAllFromIndex('messages', 'by-category', filter.category);
      } else {
        messages = await this.db!.getAll('messages');
      }

      // Filter by isCustom
      if (filter?.isCustom !== undefined) {
        messages = messages.filter(m => m.isCustom === filter.isCustom);
      }

      // Filter by active status
      if (filter?.active !== undefined) {
        messages = messages.filter(m => m.active === filter.active);
      }

      // Filter by search term
      if (filter?.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        messages = messages.filter(m => m.text.toLowerCase().includes(term));
      }

      // Filter by tags
      if (filter?.tags && filter.tags.length > 0) {
        messages = messages.filter(m =>
          m.tags && m.tags.some(tag => filter.tags!.includes(tag))
        );
      }

      console.log('[CustomMessageService] Retrieved messages, count:', messages.length, 'filter:', filter);
      return messages;
    } catch (error) {
      console.error('[CustomMessageService] Failed to get all messages:', error);
      console.error('[CustomMessageService] Filter:', filter);
      return []; // Graceful fallback: return empty array
    }
  }

  /**
   * Get a single message by ID
   */
  async getById(messageId: number): Promise<Message | null> {
    try {
      await this.init();
      const message = await this.db!.get('messages', messageId);
      if (message) {
        console.log('[CustomMessageService] Message retrieved, id:', messageId);
      } else {
        console.warn('[CustomMessageService] Message not found, id:', messageId);
      }
      return message || null;
    } catch (error) {
      console.error('[CustomMessageService] Failed to get message:', error);
      console.error('[CustomMessageService] Message id:', messageId);
      return null; // Graceful fallback
    }
  }

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
        messages: messages.map(m => ({
          text: m.text,
          category: m.category,
          active: m.active ?? true,
          tags: m.tags || [],
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt?.toISOString() || m.createdAt.toISOString(),
        })),
      };

      console.log('[CustomMessageService] Exported messages, count:', messages.length);
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
   */
  async importMessages(exportData: CustomMessagesExport): Promise<{ imported: number; skipped: number }> {
    try {
      if (exportData.version !== '1.0') {
        throw new Error(`Unsupported export version: ${exportData.version}`);
      }

      let importedCount = 0;
      let skippedCount = 0;

      // Get existing custom message texts for duplicate detection
      const existingMessages = await this.getAll({ isCustom: true });
      const existingTexts = new Set(existingMessages.map(m => m.text.trim().toLowerCase()));

      for (const msg of exportData.messages) {
        const normalizedText = msg.text.trim().toLowerCase();

        if (existingTexts.has(normalizedText)) {
          skippedCount++;
          console.log('[CustomMessageService] Skipping duplicate message:', msg.text.substring(0, 50) + '...');
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

      console.log('[CustomMessageService] Import complete - imported:', importedCount, 'skipped:', skippedCount);
      return { imported: importedCount, skipped: skippedCount };
    } catch (error) {
      console.error('[CustomMessageService] Failed to import messages:', error);
      console.error('[CustomMessageService] Export data:', exportData);
      throw error;
    }
  }
}

// Singleton instance
export const customMessageService = new CustomMessageService();
