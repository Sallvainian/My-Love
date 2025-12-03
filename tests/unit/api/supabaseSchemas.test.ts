import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  SupabaseMoodSchema,
  SupabaseUserSchema,
  SupabaseInteractionSchema,
  MoodArraySchema,
  MoodInsertSchema,
  MoodUpdateSchema,
  UserInsertSchema,
  UserUpdateSchema,
  InteractionInsertSchema,
  InteractionUpdateSchema,
} from '../../../src/api/validation/supabaseSchemas';

describe('Supabase Validation Schemas', () => {
  describe('SupabaseMoodSchema', () => {
    it('should validate a complete valid mood record', () => {
      const validMood = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy' as const,
        note: 'Feeling great today!',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseMoodSchema.parse(validMood)).not.toThrow();
    });

    it('should validate mood with null note', () => {
      const validMood = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'content' as const,
        note: null,
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseMoodSchema.parse(validMood)).not.toThrow();
    });

    it('should accept all valid mood types', () => {
      const moodTypes = ['loved', 'happy', 'content', 'thoughtful', 'grateful'];

      moodTypes.forEach((moodType) => {
        const mood = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: moodType,
          note: 'Test note',
          created_at: '2024-01-15T10:30:00.000Z',
          updated_at: '2024-01-15T10:30:00.000Z',
        };

        expect(() => SupabaseMoodSchema.parse(mood)).not.toThrow();
      });
    });

    it('should reject invalid mood type', () => {
      const invalidMood = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'ecstatic',
        note: 'Test note',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseMoodSchema.parse(invalidMood)).toThrow(ZodError);
    });

    it('should reject invalid UUID format', () => {
      const invalidMood = {
        id: 'not-a-uuid',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy' as const,
        note: 'Test note',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseMoodSchema.parse(invalidMood)).toThrow(ZodError);
    });

    it('should reject invalid timestamp format', () => {
      const invalidMood = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy' as const,
        note: 'Test note',
        created_at: '2024-01-15 10:30:00', // Invalid format
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseMoodSchema.parse(invalidMood)).toThrow(ZodError);
    });

    it('should reject missing required fields', () => {
      const invalidMood = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        mood_type: 'happy' as const,
        // Missing user_id
        note: 'Test note',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseMoodSchema.parse(invalidMood)).toThrow(ZodError);
    });
  });

  describe('MoodInsertSchema', () => {
    it('should validate mood insert with required fields', () => {
      const validInsert = {
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'loved' as const,
      };

      expect(() => MoodInsertSchema.parse(validInsert)).not.toThrow();
    });

    it('should validate mood insert with optional fields', () => {
      const validInsert = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'grateful' as const,
        note: 'Grateful for this day',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => MoodInsertSchema.parse(validInsert)).not.toThrow();
    });

    it('should reject note exceeding 200 characters', () => {
      const invalidInsert = {
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy' as const,
        note: 'a'.repeat(201),
      };

      expect(() => MoodInsertSchema.parse(invalidInsert)).toThrow(ZodError);
    });

    it('should accept note exactly at 200 characters', () => {
      const validInsert = {
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy' as const,
        note: 'a'.repeat(200),
      };

      expect(() => MoodInsertSchema.parse(validInsert)).not.toThrow();
    });
  });

  describe('MoodUpdateSchema', () => {
    it('should validate partial mood update', () => {
      const validUpdate = {
        note: 'Updated note',
      };

      expect(() => MoodUpdateSchema.parse(validUpdate)).not.toThrow();
    });

    it('should validate mood type update', () => {
      const validUpdate = {
        mood_type: 'thoughtful' as const,
      };

      expect(() => MoodUpdateSchema.parse(validUpdate)).not.toThrow();
    });

    it('should reject invalid partial update', () => {
      const invalidUpdate = {
        mood_type: 'invalid' as const,
      };

      expect(() => MoodUpdateSchema.parse(invalidUpdate)).toThrow(ZodError);
    });
  });

  describe('MoodArraySchema', () => {
    it('should validate empty array', () => {
      expect(() => MoodArraySchema.parse([])).not.toThrow();
    });

    it('should validate array of valid moods', () => {
      const validMoods = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: 'happy' as const,
          note: 'Mood 1',
          created_at: '2024-01-15T10:30:00.000Z',
          updated_at: '2024-01-15T10:30:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: 'content' as const,
          note: null,
          created_at: '2024-01-16T10:30:00.000Z',
          updated_at: '2024-01-16T10:30:00.000Z',
        },
      ];

      expect(() => MoodArraySchema.parse(validMoods)).not.toThrow();
    });

    it('should reject array with invalid mood', () => {
      const invalidMoods = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: 'happy' as const,
          note: 'Valid mood',
          created_at: '2024-01-15T10:30:00.000Z',
          updated_at: '2024-01-15T10:30:00.000Z',
        },
        {
          id: 'invalid-uuid',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: 'sad' as const, // Invalid mood type
          note: 'Invalid mood',
          created_at: '2024-01-16T10:30:00.000Z',
          updated_at: '2024-01-16T10:30:00.000Z',
        },
      ];

      expect(() => MoodArraySchema.parse(invalidMoods)).toThrow(ZodError);
    });
  });

  describe('SupabaseUserSchema', () => {
    it('should validate a complete valid user record', () => {
      const validUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        partner_name: 'Jane Doe',
        device_id: '550e8400-e29b-41d4-a716-446655440099',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseUserSchema.parse(validUser)).not.toThrow();
    });

    it('should validate user with null partner_name', () => {
      const validUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        partner_name: null,
        device_id: '550e8400-e29b-41d4-a716-446655440099',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseUserSchema.parse(validUser)).not.toThrow();
    });
  });

  describe('UserInsertSchema', () => {
    it('should validate user insert with required id', () => {
      const validInsert = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => UserInsertSchema.parse(validInsert)).not.toThrow();
    });

    it('should validate user insert with all fields', () => {
      const validInsert = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        partner_name: 'Jane Doe',
        device_id: '550e8400-e29b-41d4-a716-446655440099',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => UserInsertSchema.parse(validInsert)).not.toThrow();
    });
  });

  describe('SupabaseInteractionSchema', () => {
    it('should validate a complete valid interaction record', () => {
      const validInteraction = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'poke' as const,
        from_user_id: '550e8400-e29b-41d4-a716-446655440001',
        to_user_id: '550e8400-e29b-41d4-a716-446655440002',
        viewed: false,
        created_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseInteractionSchema.parse(validInteraction)).not.toThrow();
    });

    it('should accept all valid interaction types', () => {
      const interactionTypes = ['poke', 'kiss'];

      interactionTypes.forEach((type) => {
        const interaction = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type,
          from_user_id: '550e8400-e29b-41d4-a716-446655440001',
          to_user_id: '550e8400-e29b-41d4-a716-446655440002',
          viewed: true,
          created_at: '2024-01-15T10:30:00.000Z',
        };

        expect(() => SupabaseInteractionSchema.parse(interaction)).not.toThrow();
      });
    });

    it('should reject invalid interaction type', () => {
      const invalidInteraction = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'hug',
        from_user_id: '550e8400-e29b-41d4-a716-446655440001',
        to_user_id: '550e8400-e29b-41d4-a716-446655440002',
        viewed: false,
        created_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => SupabaseInteractionSchema.parse(invalidInteraction)).toThrow(ZodError);
    });
  });

  describe('InteractionInsertSchema', () => {
    it('should validate interaction insert with required fields', () => {
      const validInsert = {
        type: 'kiss' as const,
        from_user_id: '550e8400-e29b-41d4-a716-446655440001',
        to_user_id: '550e8400-e29b-41d4-a716-446655440002',
      };

      expect(() => InteractionInsertSchema.parse(validInsert)).not.toThrow();
    });

    it('should validate interaction insert with optional fields', () => {
      const validInsert = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'poke' as const,
        from_user_id: '550e8400-e29b-41d4-a716-446655440001',
        to_user_id: '550e8400-e29b-41d4-a716-446655440002',
        viewed: false,
        created_at: '2024-01-15T10:30:00.000Z',
      };

      expect(() => InteractionInsertSchema.parse(validInsert)).not.toThrow();
    });
  });

  describe('InteractionUpdateSchema', () => {
    it('should validate partial interaction update', () => {
      const validUpdate = {
        viewed: true,
      };

      expect(() => InteractionUpdateSchema.parse(validUpdate)).not.toThrow();
    });

    it('should validate interaction type update', () => {
      const validUpdate = {
        type: 'kiss' as const,
      };

      expect(() => InteractionUpdateSchema.parse(validUpdate)).not.toThrow();
    });
  });
});
