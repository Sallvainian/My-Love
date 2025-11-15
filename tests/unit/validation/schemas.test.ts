import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  MessageSchema,
  CreateMessageInputSchema,
  UpdateMessageInputSchema,
  PhotoSchema,
  MoodEntrySchema,
  SettingsSchema,
  CustomMessagesExportSchema,
} from '../../../src/validation/schemas';

describe('Message Validation Schemas', () => {
  describe('MessageSchema', () => {
    it('should validate a complete valid message', () => {
      const validMessage = {
        id: 1,
        text: 'I love you',
        category: 'affirmation' as const,
        isCustom: true,
        active: true,
        createdAt: new Date(),
        isFavorite: false,
        updatedAt: new Date(),
        tags: ['love', 'affirmation'],
      };

      expect(() => MessageSchema.parse(validMessage)).not.toThrow();
    });

    it('should reject empty text', () => {
      const invalidMessage = {
        text: '',
        category: 'reason' as const,
        isCustom: false,
        active: true,
        createdAt: new Date(),
      };

      expect(() => MessageSchema.parse(invalidMessage)).toThrow(ZodError);
    });

    it('should reject text exceeding 1000 characters', () => {
      const invalidMessage = {
        text: 'a'.repeat(1001),
        category: 'reason' as const,
        isCustom: false,
        active: true,
        createdAt: new Date(),
      };

      expect(() => MessageSchema.parse(invalidMessage)).toThrow(ZodError);
    });

    it('should accept text exactly at 1000 characters', () => {
      const validMessage = {
        text: 'a'.repeat(1000),
        category: 'reason' as const,
        isCustom: false,
        active: true,
        createdAt: new Date(),
      };

      expect(() => MessageSchema.parse(validMessage)).not.toThrow();
    });

    it('should reject invalid category', () => {
      const invalidMessage = {
        text: 'Test message',
        category: 'invalid-category',
        isCustom: false,
        active: true,
        createdAt: new Date(),
      };

      expect(() => MessageSchema.parse(invalidMessage)).toThrow(ZodError);
    });

    it('should accept all valid categories', () => {
      const categories = ['reason', 'memory', 'affirmation', 'future', 'custom'];

      categories.forEach((category) => {
        const message = {
          text: 'Test message',
          category,
          isCustom: false,
          active: true,
          createdAt: new Date(),
        };

        expect(() => MessageSchema.parse(message)).not.toThrow();
      });
    });

    it('should accept message with optional fields undefined', () => {
      const message = {
        text: 'Test message',
        category: 'reason' as const,
        isCustom: false,
        active: true,
        createdAt: new Date(),
      };

      expect(() => MessageSchema.parse(message)).not.toThrow();
    });

    it('should default active to true', () => {
      const message = {
        text: 'Test message',
        category: 'reason' as const,
        isCustom: false,
        createdAt: new Date(),
      };

      const result = MessageSchema.parse(message);
      expect(result.active).toBe(true);
    });
  });

  describe('CreateMessageInputSchema', () => {
    it('should validate valid create input', () => {
      const input = {
        text: 'I love you',
        category: 'affirmation' as const,
        active: true,
        tags: ['love'],
      };

      expect(() => CreateMessageInputSchema.parse(input)).not.toThrow();
    });

    it('should trim whitespace from text', () => {
      const input = {
        text: '  I love you  ',
        category: 'affirmation' as const,
      };

      const result = CreateMessageInputSchema.parse(input);
      expect(result.text).toBe('I love you');
    });

    it('should reject empty string after trim', () => {
      const input = {
        text: '   ',
        category: 'affirmation' as const,
      };

      expect(() => CreateMessageInputSchema.parse(input)).toThrow(ZodError);
    });

    it('should default active to true when not provided', () => {
      const input = {
        text: 'Test',
        category: 'reason' as const,
      };

      const result = CreateMessageInputSchema.parse(input);
      expect(result.active).toBe(true);
    });
  });

  describe('UpdateMessageInputSchema', () => {
    it('should validate valid update input', () => {
      const input = {
        id: 1,
        text: 'Updated text',
        category: 'memory' as const,
        active: false,
      };

      expect(() => UpdateMessageInputSchema.parse(input)).not.toThrow();
    });

    it('should require id', () => {
      const input = {
        text: 'Updated text',
      };

      expect(() => UpdateMessageInputSchema.parse(input)).toThrow(ZodError);
    });

    it('should accept partial updates', () => {
      const input = {
        id: 1,
        text: 'Updated text',
      };

      expect(() => UpdateMessageInputSchema.parse(input)).not.toThrow();
    });

    it('should reject negative id', () => {
      const input = {
        id: -1,
        text: 'Test',
      };

      expect(() => UpdateMessageInputSchema.parse(input)).toThrow(ZodError);
    });
  });
});

describe('Photo Validation Schema', () => {
  describe('PhotoSchema', () => {
    const createValidPhoto = () => ({
      id: 1,
      imageBlob: new Blob(['test'], { type: 'image/jpeg' }),
      caption: 'A beautiful sunset',
      tags: ['sunset', 'nature'],
      uploadDate: new Date(),
      originalSize: 1024000,
      compressedSize: 512000,
      width: 1920,
      height: 1080,
      mimeType: 'image/jpeg' as const,
    });

    it('should validate a complete valid photo', () => {
      const photo = createValidPhoto();
      expect(() => PhotoSchema.parse(photo)).not.toThrow();
    });

    it('should reject non-Blob imageBlob', () => {
      const photo = {
        ...createValidPhoto(),
        imageBlob: 'not-a-blob',
      };

      expect(() => PhotoSchema.parse(photo)).toThrow(ZodError);
    });

    it('should reject caption exceeding 500 characters', () => {
      const photo = {
        ...createValidPhoto(),
        caption: 'a'.repeat(501),
      };

      expect(() => PhotoSchema.parse(photo)).toThrow(ZodError);
    });

    it('should accept caption exactly at 500 characters', () => {
      const photo = {
        ...createValidPhoto(),
        caption: 'a'.repeat(500),
      };

      expect(() => PhotoSchema.parse(photo)).not.toThrow();
    });

    it('should accept empty string caption', () => {
      const photo = {
        ...createValidPhoto(),
        caption: '',
      };

      expect(() => PhotoSchema.parse(photo)).not.toThrow();
    });

    it('should default tags to empty array', () => {
      const photo = {
        id: 1,
        imageBlob: new Blob(['test'], { type: 'image/jpeg' }),
        uploadDate: new Date(),
        originalSize: 1024,
        compressedSize: 512,
        width: 100,
        height: 100,
        mimeType: 'image/jpeg' as const,
      };

      const result = PhotoSchema.parse(photo);
      expect(result.tags).toEqual([]);
    });

    it('should reject negative sizes', () => {
      const photo = {
        ...createValidPhoto(),
        compressedSize: -100,
      };

      expect(() => PhotoSchema.parse(photo)).toThrow(ZodError);
    });

    it('should reject zero sizes', () => {
      const photo = {
        ...createValidPhoto(),
        originalSize: 0,
      };

      expect(() => PhotoSchema.parse(photo)).toThrow(ZodError);
    });

    it('should reject non-integer dimensions', () => {
      const photo = {
        ...createValidPhoto(),
        width: 1920.5,
      };

      expect(() => PhotoSchema.parse(photo)).toThrow(ZodError);
    });

    it('should reject negative dimensions', () => {
      const photo = {
        ...createValidPhoto(),
        height: -100,
      };

      expect(() => PhotoSchema.parse(photo)).toThrow(ZodError);
    });

    it('should accept all valid MIME types', () => {
      const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

      mimeTypes.forEach((mimeType) => {
        const photo = {
          ...createValidPhoto(),
          mimeType,
          imageBlob: new Blob(['test'], { type: mimeType }),
        };

        expect(() => PhotoSchema.parse(photo)).not.toThrow();
      });
    });

    it('should reject invalid MIME type', () => {
      const photo = {
        ...createValidPhoto(),
        mimeType: 'image/gif',
      };

      expect(() => PhotoSchema.parse(photo)).toThrow(ZodError);
    });
  });
});

describe('Mood Validation Schema', () => {
  describe('MoodEntrySchema', () => {
    it('should validate valid mood entry', () => {
      const mood = {
        date: '2024-11-14',
        mood: 'loved' as const,
        note: 'Had a wonderful day',
      };

      expect(() => MoodEntrySchema.parse(mood)).not.toThrow();
    });

    it('should accept all valid mood types', () => {
      const moods = ['loved', 'happy', 'content', 'thoughtful', 'grateful'];

      moods.forEach((mood) => {
        const entry = {
          date: '2024-11-14',
          mood,
        };

        expect(() => MoodEntrySchema.parse(entry)).not.toThrow();
      });
    });

    it('should reject invalid mood type', () => {
      const mood = {
        date: '2024-11-14',
        mood: 'invalid-mood',
      };

      expect(() => MoodEntrySchema.parse(mood)).toThrow(ZodError);
    });

    it('should reject invalid date format', () => {
      const invalidDates = [
        '2024-13-01', // Invalid month
        '2024-11-32', // Invalid day
        '11-14-2024', // Wrong format
        '2024/11/14', // Wrong separator
        '2024-1-1', // Missing leading zeros
      ];

      invalidDates.forEach((date) => {
        const mood = {
          date,
          mood: 'loved' as const,
        };

        expect(() => MoodEntrySchema.parse(mood)).toThrow(ZodError);
      });
    });

    it('should reject leap year edge cases like February 30th', () => {
      const invalidLeapYearDates = [
        '2023-02-30', // Feb 30 doesn't exist
        '2023-02-29', // 2023 is not a leap year
        '2024-02-30', // Feb 30 doesn't exist even in leap years
      ];

      invalidLeapYearDates.forEach((date) => {
        const mood = {
          date,
          mood: 'loved' as const,
        };

        expect(() => MoodEntrySchema.parse(mood)).toThrow(ZodError);
      });
    });

    it('should accept valid ISO date formats', () => {
      const validDates = ['2024-01-01', '2024-12-31', '2025-06-15'];

      validDates.forEach((date) => {
        const mood = {
          date,
          mood: 'loved' as const,
        };

        expect(() => MoodEntrySchema.parse(mood)).not.toThrow();
      });
    });

    it('should reject note exceeding 200 characters', () => {
      const mood = {
        date: '2024-11-14',
        mood: 'loved' as const,
        note: 'a'.repeat(201),
      };

      expect(() => MoodEntrySchema.parse(mood)).toThrow(ZodError);
    });

    it('should accept note exactly at 200 characters', () => {
      const mood = {
        date: '2024-11-14',
        mood: 'loved' as const,
        note: 'a'.repeat(200),
      };

      expect(() => MoodEntrySchema.parse(mood)).not.toThrow();
    });

    it('should accept empty note', () => {
      const mood = {
        date: '2024-11-14',
        mood: 'loved' as const,
        note: '',
      };

      expect(() => MoodEntrySchema.parse(mood)).not.toThrow();
    });
  });
});

describe('Settings Validation Schema', () => {
  describe('SettingsSchema', () => {
    const createValidSettings = () => ({
      themeName: 'sunset' as const,
      notificationTime: '09:00',
      relationship: {
        startDate: '2020-01-15',
        partnerName: 'Alice',
        anniversaries: [
          {
            id: 1,
            date: '2020-01-15',
            label: 'First date',
            description: 'Met at coffee shop',
          },
        ],
      },
      customization: {
        accentColor: '#ff6b9d',
        fontFamily: 'Inter',
      },
      notifications: {
        enabled: true,
        time: '09:00',
      },
    });

    it('should validate complete valid settings', () => {
      const settings = createValidSettings();
      expect(() => SettingsSchema.parse(settings)).not.toThrow();
    });

    it('should accept all valid themes', () => {
      const themes = ['sunset', 'ocean', 'lavender', 'rose'];

      themes.forEach((themeName) => {
        const settings = {
          ...createValidSettings(),
          themeName,
        };

        expect(() => SettingsSchema.parse(settings)).not.toThrow();
      });
    });

    it('should reject invalid theme', () => {
      const settings = {
        ...createValidSettings(),
        themeName: 'invalid-theme',
      };

      expect(() => SettingsSchema.parse(settings)).toThrow(ZodError);
    });

    it('should reject empty partner name', () => {
      const settings = createValidSettings();
      settings.relationship.partnerName = '';

      expect(() => SettingsSchema.parse(settings)).toThrow(ZodError);
    });

    it('should reject invalid time format', () => {
      const invalidTimes = [
        '9:00', // Missing leading zero
        '09:0', // Missing trailing zero
        '09-00', // Wrong separator
        '25:00', // Invalid hour
        '09:60', // Invalid minute
      ];

      invalidTimes.forEach((notificationTime) => {
        const settings = {
          ...createValidSettings(),
          notificationTime,
        };

        expect(() => SettingsSchema.parse(settings)).toThrow(ZodError);
      });
    });

    it('should accept valid time formats', () => {
      const validTimes = ['00:00', '09:30', '12:00', '23:59'];

      validTimes.forEach((notificationTime) => {
        const settings = {
          ...createValidSettings(),
          notificationTime,
        };

        expect(() => SettingsSchema.parse(settings)).not.toThrow();
      });
    });

    it('should validate nested relationship structure', () => {
      const settings = createValidSettings();
      settings.relationship.anniversaries = [];

      expect(() => SettingsSchema.parse(settings)).not.toThrow();
    });

    it('should reject invalid anniversary date', () => {
      const settings = createValidSettings();
      settings.relationship.anniversaries[0].date = '2024-13-01';

      expect(() => SettingsSchema.parse(settings)).toThrow(ZodError);
    });

    it('should reject empty anniversary label', () => {
      const settings = createValidSettings();
      settings.relationship.anniversaries[0].label = '';

      expect(() => SettingsSchema.parse(settings)).toThrow(ZodError);
    });

    it('should accept anniversary without description', () => {
      const settings = createValidSettings();
      delete settings.relationship.anniversaries[0].description;

      expect(() => SettingsSchema.parse(settings)).not.toThrow();
    });
  });
});

describe('Export Schema Validation', () => {
  describe('CustomMessagesExportSchema', () => {
    const createValidExport = () => ({
      version: '1.0' as const,
      exportDate: '2024-11-14T10:00:00Z',
      messageCount: 2,
      messages: [
        {
          text: 'I love you',
          category: 'affirmation' as const,
          active: true,
          tags: ['love'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          text: 'Remember our first date',
          category: 'memory' as const,
          active: true,
          tags: [],
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ],
    });

    it('should validate valid export data', () => {
      const exportData = createValidExport();
      expect(() => CustomMessagesExportSchema.parse(exportData)).not.toThrow();
    });

    it('should reject invalid version', () => {
      const exportData = {
        ...createValidExport(),
        version: '2.0',
      };

      expect(() => CustomMessagesExportSchema.parse(exportData)).toThrow(ZodError);
    });

    it('should reject negative message count', () => {
      const exportData = {
        ...createValidExport(),
        messageCount: -1,
      };

      expect(() => CustomMessagesExportSchema.parse(exportData)).toThrow(ZodError);
    });

    it('should accept empty messages array', () => {
      const exportData = {
        ...createValidExport(),
        messages: [],
        messageCount: 0,
      };

      expect(() => CustomMessagesExportSchema.parse(exportData)).not.toThrow();
    });

    it('should reject message with invalid category', () => {
      const exportData = createValidExport();
      exportData.messages[0].category = 'invalid' as any;

      expect(() => CustomMessagesExportSchema.parse(exportData)).toThrow(ZodError);
    });

    it('should reject message with empty text', () => {
      const exportData = createValidExport();
      exportData.messages[0].text = '';

      expect(() => CustomMessagesExportSchema.parse(exportData)).toThrow(ZodError);
    });

    it('should reject message with text exceeding 1000 chars', () => {
      const exportData = createValidExport();
      exportData.messages[0].text = 'a'.repeat(1001);

      expect(() => CustomMessagesExportSchema.parse(exportData)).toThrow(ZodError);
    });
  });
});
