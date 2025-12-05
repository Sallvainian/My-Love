-- ============================================
-- My-Love Backend - Add mood_types Array Column
-- ============================================
-- Migration: 006_add_mood_types_array
-- Created: 2025-12-03
-- Story: Multi-Mood Selection Feature
-- Description: Add mood_types TEXT[] column for multi-mood selection support
-- Execute in: Supabase Dashboard → SQL Editor
--
-- IMPORTANT: This migration is additive and backward-compatible.
-- Existing records will have NULL mood_types, which is expected.

-- ============================================
-- Step 1: Add mood_types column
-- ============================================
-- Using TEXT[] array type for storing multiple mood selections
-- Nullable to maintain backward compatibility with existing records

ALTER TABLE moods
ADD COLUMN IF NOT EXISTS mood_types TEXT[];

-- ============================================
-- Step 2: Add column comment
-- ============================================
COMMENT ON COLUMN moods.mood_types IS 'Array of mood types for multi-mood selection. Primary mood (mood_type) is always the first element. NULL for legacy single-mood entries.';

-- ============================================
-- Step 3: Add CHECK constraint for array values
-- ============================================
-- Ensures all values in the array are valid mood types
-- This prevents invalid mood types from being inserted

ALTER TABLE moods
ADD CONSTRAINT moods_mood_types_values_check
CHECK (
    mood_types IS NULL
    OR mood_types <@ ARRAY[
        -- Positive moods
        'loved',
        'happy',
        'content',
        'excited',
        'thoughtful',
        'grateful',
        -- Challenging moods
        'sad',
        'anxious',
        'frustrated',
        'angry',
        'lonely',
        'tired'
    ]::TEXT[]
);

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify the migration succeeded:

-- Check column exists
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'moods' AND column_name = 'mood_types';

-- Check constraint exists
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'moods'::regclass AND conname = 'moods_mood_types_values_check';

-- Test inserting with mood_types array
-- INSERT INTO moods (user_id, mood_type, mood_types, note)
-- VALUES (auth.uid(), 'happy', ARRAY['happy', 'grateful'], 'Test multi-mood');

-- View sample data
-- SELECT id, mood_type, mood_types, created_at FROM moods ORDER BY created_at DESC LIMIT 5;
