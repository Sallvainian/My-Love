-- ============================================
-- My-Love Backend - Expand Mood Type Enum
-- ============================================
-- Migration: 005_expand_mood_type_enum
-- Created: 2025-11-25
-- Story: 5.1 - Mood Emoji Picker Interface
-- Description: Expand mood_type CHECK constraint from 5 to 12 mood types
-- Execute in: Supabase Dashboard → SQL Editor
--
-- IMPORTANT: Run this migration BEFORE deploying frontend changes
-- to prevent sync failures for new mood types.

-- ============================================
-- Step 1: Drop existing CHECK constraint
-- ============================================
-- The constraint name may vary - this handles common naming patterns

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the CHECK constraint on mood_type column
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'moods'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%mood_type%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE moods DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No mood_type constraint found to drop';
    END IF;
END $$;

-- ============================================
-- Step 2: Add new CHECK constraint with 12 mood types
-- ============================================
-- Positive moods (6): loved, happy, content, excited, thoughtful, grateful
-- Challenging moods (6): sad, anxious, frustrated, angry, lonely, tired

ALTER TABLE moods
ADD CONSTRAINT moods_mood_type_check
CHECK (mood_type IN (
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
));

-- ============================================
-- Step 3: Update column comment
-- ============================================
COMMENT ON COLUMN moods.mood_type IS 'Enum: loved, happy, content, excited, thoughtful, grateful (positive) | sad, anxious, frustrated, angry, lonely, tired (challenging)';

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify the migration succeeded:

-- Check new constraint exists with all 12 values
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'moods'::regclass AND contype = 'c';

-- Test inserting new mood types (requires authenticated user)
-- INSERT INTO moods (user_id, mood_type) VALUES (auth.uid(), 'excited');
-- INSERT INTO moods (user_id, mood_type) VALUES (auth.uid(), 'angry');
