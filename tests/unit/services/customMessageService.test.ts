import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { customMessageService } from '../../../src/services/customMessageService';
import type { CreateMessageInput, UpdateMessageInput, CustomMessagesExport } from '../../../src/types';
import { createMockMessages, createMockMessage } from '../utils/testHelpers';

describe('CustomMessageService', () => {
  beforeEach(async () => {
    // Service is singleton, reset by clearing the store
    await customMessageService.init();
    await customMessageService.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create()', () => {
    it('creates a new custom message with valid input', async () => {
      const input: CreateMessageInput = {
        text: 'You make me smile every day',
        category: 'affirmation',
        active: true,
        tags: ['sweet', 'daily'],
      };

      const created = await customMessageService.create(input);

      expect(created).toBeDefined();
      expect(created.id).toBeGreaterThan(0);
      expect(created.text).toBe(input.text);
      expect(created.category).toBe(input.category);
      expect(created.active).toBe(true);
      expect(created.isCustom).toBe(true);
      expect(created.isFavorite).toBe(false);
      expect(created.tags).toEqual(['sweet', 'daily']);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it('defaults active to true when not specified', async () => {
      const input: CreateMessageInput = {
        text: 'Default active message',
        category: 'reason',
      };

      const created = await customMessageService.create(input);

      expect(created.active).toBe(true);
    });

    it('sets isCustom to true automatically', async () => {
      const input: CreateMessageInput = {
        text: 'Custom message test',
        category: 'memory',
      };

      const created = await customMessageService.create(input);

      expect(created.isCustom).toBe(true);
    });

    it('sets isFavorite to false automatically', async () => {
      const input: CreateMessageInput = {
        text: 'Not favorited yet',
        category: 'future',
      };

      const created = await customMessageService.create(input);

      expect(created.isFavorite).toBe(false);
    });

    it('initializes empty tags array when not provided', async () => {
      const input: CreateMessageInput = {
        text: 'No tags message',
        category: 'affirmation',
      };

      const created = await customMessageService.create(input);

      expect(created.tags).toEqual([]);
    });

    it('auto-increments id for multiple messages', async () => {
      const input1: CreateMessageInput = {
        text: 'First message',
        category: 'reason',
      };
      const input2: CreateMessageInput = {
        text: 'Second message',
        category: 'affirmation',
      };

      const created1 = await customMessageService.create(input1);
      const created2 = await customMessageService.create(input2);

      expect(created2.id).toBe(created1.id! + 1);
    });

    it('rejects message with empty text (validation)', async () => {
      const input: CreateMessageInput = {
        text: '',
        category: 'reason',
      };

      await expect(customMessageService.create(input)).rejects.toThrow();
    });

    it('rejects message with text exceeding 1000 chars (validation)', async () => {
      const input: CreateMessageInput = {
        text: 'a'.repeat(1001),
        category: 'reason',
      };

      await expect(customMessageService.create(input)).rejects.toThrow();
    });

    it('rejects message with invalid category (validation)', async () => {
      const input: CreateMessageInput = {
        text: 'Valid text',
        category: 'invalid_category' as any,
      };

      await expect(customMessageService.create(input)).rejects.toThrow();
    });
  });

  describe('updateMessage()', () => {
    it('updates an existing message', async () => {
      const created = await customMessageService.create({
        text: 'Original text',
        category: 'reason',
        active: true,
      });

      const update: UpdateMessageInput = {
        id: created.id!,
        text: 'Updated text',
      };

      await customMessageService.updateMessage(update);

      const updated = await customMessageService.get(created.id!);
      expect(updated?.text).toBe('Updated text');
      expect(updated?.updatedAt).toBeInstanceOf(Date);
      expect(updated?.updatedAt?.getTime()).toBeGreaterThanOrEqual(updated?.createdAt.getTime() || 0);
    });

    it('updates category field', async () => {
      const created = await customMessageService.create({
        text: 'Test message',
        category: 'reason',
      });

      await customMessageService.updateMessage({
        id: created.id!,
        category: 'affirmation',
      });

      const updated = await customMessageService.get(created.id!);
      expect(updated?.category).toBe('affirmation');
    });

    it('updates active status', async () => {
      const created = await customMessageService.create({
        text: 'Active message',
        category: 'reason',
        active: true,
      });

      await customMessageService.updateMessage({
        id: created.id!,
        active: false,
      });

      const updated = await customMessageService.get(created.id!);
      expect(updated?.active).toBe(false);
    });

    it('updates tags', async () => {
      const created = await customMessageService.create({
        text: 'Tagged message',
        category: 'memory',
        tags: ['old'],
      });

      await customMessageService.updateMessage({
        id: created.id!,
        tags: ['new', 'updated'],
      });

      const updated = await customMessageService.get(created.id!);
      expect(updated?.tags).toEqual(['new', 'updated']);
    });

    it('updates multiple fields at once', async () => {
      const created = await customMessageService.create({
        text: 'Original',
        category: 'reason',
        active: true,
        tags: ['old'],
      });

      await customMessageService.updateMessage({
        id: created.id!,
        text: 'Updated',
        category: 'affirmation',
        active: false,
        tags: ['new'],
      });

      const updated = await customMessageService.get(created.id!);
      expect(updated?.text).toBe('Updated');
      expect(updated?.category).toBe('affirmation');
      expect(updated?.active).toBe(false);
      expect(updated?.tags).toEqual(['new']);
    });

    it('rejects update with empty text (validation)', async () => {
      const created = await customMessageService.create({
        text: 'Original text',
        category: 'reason',
      });

      await expect(customMessageService.updateMessage({
        id: created.id!,
        text: '',
      })).rejects.toThrow();
    });

    it('rejects update with text exceeding 1000 chars (validation)', async () => {
      const created = await customMessageService.create({
        text: 'Original text',
        category: 'reason',
      });

      await expect(customMessageService.updateMessage({
        id: created.id!,
        text: 'a'.repeat(1001),
      })).rejects.toThrow();
    });
  });

  describe('getAll()', () => {
    beforeEach(async () => {
      // Create test data
      await customMessageService.create({
        text: 'Reason message active',
        category: 'reason',
        active: true,
        tags: ['tag1'],
      });
      await customMessageService.create({
        text: 'Reason message inactive',
        category: 'reason',
        active: false,
        tags: ['tag2'],
      });
      await customMessageService.create({
        text: 'Compliment message active',
        category: 'affirmation',
        active: true,
        tags: ['tag1', 'tag3'],
      });
      await customMessageService.create({
        text: 'Memory message active',
        category: 'memory',
        active: true,
      });
    });

    it('returns all messages when no filter provided', async () => {
      const messages = await customMessageService.getAll();
      expect(messages).toHaveLength(4);
    });

    it('filters by category', async () => {
      const messages = await customMessageService.getAll({ category: 'reason' });
      expect(messages).toHaveLength(2);
      expect(messages.every(m => m.category === 'reason')).toBe(true);
    });

    it('filters by active status', async () => {
      const activeMessages = await customMessageService.getAll({ active: true });
      expect(activeMessages).toHaveLength(3);
      expect(activeMessages.every(m => m.active === true)).toBe(true);

      const inactiveMessages = await customMessageService.getAll({ active: false });
      expect(inactiveMessages).toHaveLength(1);
      expect(inactiveMessages.every(m => m.active === false)).toBe(true);
    });

    it('filters by isCustom', async () => {
      const customMessages = await customMessageService.getAll({ isCustom: true });
      expect(customMessages).toHaveLength(4);
      expect(customMessages.every(m => m.isCustom === true)).toBe(true);
    });

    it('filters by searchTerm', async () => {
      const messages = await customMessageService.getAll({ searchTerm: 'Reason' });
      expect(messages).toHaveLength(2);
      expect(messages.every(m => m.text.toLowerCase().includes('reason'))).toBe(true);
    });

    it('filters by tags', async () => {
      const messages = await customMessageService.getAll({ tags: ['tag1'] });
      expect(messages).toHaveLength(2);
      expect(messages.every(m => m.tags && m.tags.includes('tag1'))).toBe(true);
    });

    it('combines multiple filters', async () => {
      const messages = await customMessageService.getAll({
        category: 'reason',
        active: true,
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].category).toBe('reason');
      expect(messages[0].active).toBe(true);
    });

    it('returns empty array when no matches found', async () => {
      const messages = await customMessageService.getAll({ searchTerm: 'nonexistent' });
      expect(messages).toEqual([]);
    });

    it('handles category "all" as no category filter', async () => {
      const messages = await customMessageService.getAll({ category: 'all' });
      expect(messages).toHaveLength(4);
    });
  });

  describe('get()', () => {
    it('retrieves message by id', async () => {
      const created = await customMessageService.create({
        text: 'Test message',
        category: 'reason',
      });

      const retrieved = await customMessageService.get(created.id!);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.text).toBe('Test message');
    });

    it('returns null for non-existent id', async () => {
      const retrieved = await customMessageService.get(99999);
      expect(retrieved).toBeNull();
    });
  });

  describe('delete()', () => {
    it('deletes an existing message', async () => {
      const created = await customMessageService.create({
        text: 'To be deleted',
        category: 'reason',
      });

      await customMessageService.delete(created.id!);

      const deleted = await customMessageService.get(created.id!);
      expect(deleted).toBeNull();
    });

    it('does not throw error when deleting non-existent id', async () => {
      await expect(customMessageService.delete(99999)).resolves.not.toThrow();
    });
  });

  describe('getActiveCustomMessages()', () => {
    beforeEach(async () => {
      await customMessageService.create({
        text: 'Active custom 1',
        category: 'reason',
        active: true,
      });
      await customMessageService.create({
        text: 'Inactive custom',
        category: 'reason',
        active: false,
      });
      await customMessageService.create({
        text: 'Active custom 2',
        category: 'affirmation',
        active: true,
      });
    });

    it('returns only active custom messages', async () => {
      const activeMessages = await customMessageService.getActiveCustomMessages();

      expect(activeMessages).toHaveLength(2);
      expect(activeMessages.every(m => m.active === true)).toBe(true);
      expect(activeMessages.every(m => m.isCustom === true)).toBe(true);
    });

    it('returns empty array when no active custom messages', async () => {
      await customMessageService.clear();

      await customMessageService.create({
        text: 'Inactive only',
        category: 'reason',
        active: false,
      });

      const activeMessages = await customMessageService.getActiveCustomMessages();
      expect(activeMessages).toEqual([]);
    });
  });

  describe('exportMessages()', () => {
    it('exports all custom messages to JSON format', async () => {
      await customMessageService.create({
        text: 'Export test 1',
        category: 'reason',
        active: true,
        tags: ['tag1'],
      });
      await customMessageService.create({
        text: 'Export test 2',
        category: 'affirmation',
        active: false,
        tags: [],
      });

      const exportData = await customMessageService.exportMessages();

      expect(exportData.version).toBe('1.0');
      expect(exportData.exportDate).toBeDefined();
      expect(exportData.messageCount).toBe(2);
      expect(exportData.messages).toHaveLength(2);
      expect(exportData.messages[0].text).toBe('Export test 1');
      expect(exportData.messages[0].category).toBe('reason');
      expect(exportData.messages[0].active).toBe(true);
      expect(exportData.messages[0].tags).toEqual(['tag1']);
      expect(exportData.messages[1].text).toBe('Export test 2');
    });

    it('exports date fields as ISO strings', async () => {
      await customMessageService.create({
        text: 'Date test',
        category: 'memory',
      });

      const exportData = await customMessageService.exportMessages();

      expect(exportData.messages[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(exportData.messages[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('returns empty export when no custom messages', async () => {
      const exportData = await customMessageService.exportMessages();

      expect(exportData.version).toBe('1.0');
      expect(exportData.messageCount).toBe(0);
      expect(exportData.messages).toEqual([]);
    });

    it('includes only custom messages (isCustom: true)', async () => {
      // Create a custom message
      await customMessageService.create({
        text: 'Custom message',
        category: 'reason',
      });

      const exportData = await customMessageService.exportMessages();

      expect(exportData.messageCount).toBe(1);
      expect(exportData.messages).toHaveLength(1);
    });
  });

  describe('importMessages()', () => {
    it('imports valid messages from export data', async () => {
      const exportData: CustomMessagesExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        messageCount: 2,
        messages: [
          {
            text: 'Imported message 1',
            category: 'reason',
            active: true,
            tags: ['imported'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            text: 'Imported message 2',
            category: 'affirmation',
            active: false,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      const result = await customMessageService.importMessages(exportData);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);

      const allMessages = await customMessageService.getAll();
      expect(allMessages).toHaveLength(2);
      expect(allMessages.find(m => m.text === 'Imported message 1')).toBeDefined();
      expect(allMessages.find(m => m.text === 'Imported message 2')).toBeDefined();
    });

    it('skips duplicate messages (case-insensitive)', async () => {
      // Create existing message
      await customMessageService.create({
        text: 'Existing Message',
        category: 'reason',
      });

      const exportData: CustomMessagesExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        messageCount: 2,
        messages: [
          {
            text: 'existing message', // Duplicate (case-insensitive)
            category: 'reason',
            active: true,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            text: 'New message',
            category: 'affirmation',
            active: true,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      const result = await customMessageService.importMessages(exportData);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);

      const allMessages = await customMessageService.getAll();
      expect(allMessages).toHaveLength(2); // 1 existing + 1 new
    });

    it('prevents duplicates within same import batch', async () => {
      const exportData: CustomMessagesExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        messageCount: 3,
        messages: [
          {
            text: 'Duplicate test',
            category: 'reason',
            active: true,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            text: 'DUPLICATE TEST', // Same as first (case-insensitive)
            category: 'reason',
            active: true,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            text: 'Unique message',
            category: 'affirmation',
            active: true,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      const result = await customMessageService.importMessages(exportData);

      expect(result.imported).toBe(2); // First occurrence + unique message
      expect(result.skipped).toBe(1); // Duplicate within batch

      const allMessages = await customMessageService.getAll();
      expect(allMessages).toHaveLength(2);
    });

    it('rejects unsupported export version', async () => {
      const exportData: CustomMessagesExport = {
        version: '2.0' as any,
        exportDate: new Date().toISOString(),
        messageCount: 0,
        messages: [],
      };

      await expect(customMessageService.importMessages(exportData)).rejects.toThrow('expected "1.0"');
    });

    it('validates export data structure (validation)', async () => {
      const invalidExportData = {
        version: '1.0',
        // Missing required fields
      } as any;

      await expect(customMessageService.importMessages(invalidExportData)).rejects.toThrow();
    });

    it('handles empty import gracefully', async () => {
      const exportData: CustomMessagesExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        messageCount: 0,
        messages: [],
      };

      const result = await customMessageService.importMessages(exportData);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe('clear()', () => {
    it('removes all messages from the store', async () => {
      await customMessageService.create({ text: 'Message 1', category: 'reason' });
      await customMessageService.create({ text: 'Message 2', category: 'affirmation' });

      await customMessageService.clear();

      const allMessages = await customMessageService.getAll();
      expect(allMessages).toEqual([]);
    });
  });
});
