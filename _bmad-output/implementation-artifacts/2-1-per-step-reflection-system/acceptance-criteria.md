# Acceptance Criteria

1. **Bookmark Toggle on Verse Screen**
   - **Given** the user is on a verse screen (Solo or Together mode)
   - **When** they tap the bookmark icon
   - **Then** the BookmarkFlag toggles instantly (filled amber when active, outlined when inactive)
   - **And** the bookmark is persisted to `scripture_bookmarks` table (write-through to server, cache in IndexedDB)
   - **And** no confirmation dialog appears (instant toggle)
   - **And** the bookmark icon has `aria-label` "Bookmark this verse" / "Remove bookmark"
   - **And** the hit area is minimum 48x48px

2. **Reflection Screen After Step Completion**
   - **Given** the user completes a step (taps "Next Verse" or both lock in during Together mode)
   - **When** the reflection screen appears
   - **Then** a 1–5 rating scale is displayed with numbered circles
   - **And** end labels show "A little" (1) and "A lot" (5)
   - **And** the prompt reads "How meaningful was this for you today?"
   - **And** the rating uses `radiogroup` with `aria-label`s: "Rating 1 of 5: A little" through "Rating 5 of 5: A lot"
   - **And** an optional note textarea is available (max 200 characters, auto-grow to ~4 lines, `resize-none`)
   - **And** character counter appears at 200+ characters (muted style)

3. **Reflection Submission**
   - **Given** the user submits a reflection
   - **When** they tap "Continue"
   - **Then** the reflection is saved to `scripture_reflections` (`session_id`, `step_index`, `user_id`, `rating`, `notes`, `is_shared`)
   - **And** the write is idempotent (unique constraint on `session_id` + `step_index` + `user_id`, upsert via `ON CONFLICT DO UPDATE`)
   - **And** the IndexedDB cache is updated on success
   - **And** the session advances to the next step (or to end-of-session if step 17)

4. **Rating Validation**
   - **Given** the user has not selected a rating
   - **When** they tap "Continue"
   - **Then** quiet helper text appears below the rating: "Please select a rating"
   - **And** the Continue button remains disabled until a rating is selected
   - **And** no red flashes or aggressive validation
