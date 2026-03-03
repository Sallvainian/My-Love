-- Add inline documentation for the hardcoded step boundary in scripture_lock_in.
-- The RPC uses `IF p_step_index < 16` to decide advance vs reflection.
-- 16 = MAX_STEPS - 1 (0-indexed). MAX_STEPS is defined as 17 in the app
-- (src/components/scripture-reading/constants.ts). If step count changes,
-- this value must be updated to match.

COMMENT ON FUNCTION public.scripture_lock_in IS
  'Story 4.2: Both-locked step advance. If p_step_index < 16 (MAX_STEPS - 1, 0-indexed), advances to next step. At step 16, transitions to reflection phase. NOTE: 16 is coupled to MAX_STEPS = 17 in the frontend constants.';
