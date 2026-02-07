# Acceptance Criteria

1. **Solo Session Starts Correctly**
   - **Given** the user selects Solo mode and starts a session
   - **When** the session begins
   - **Then** a new `scripture_session` is created with `mode='solo'`, `status='in_progress'`, `current_step_index=0`
   - **And** the first verse screen loads

2. **Verse Screen Renders Correctly**
   - **Given** the user is on a verse screen
   - **When** the screen renders
   - **Then** the verse reference is displayed (Inter 500, 12px, muted purple)
   - **And** the verse text is displayed prominently (Playfair Display 400, 20px)
   - **And** a "View Response" secondary button is available for navigation
   - **And** a "Next Verse" primary button is available (full-width, 56px, bottom-anchored)
   - **And** the progress indicator shows "Verse X of 17" as text (no progress bar)

3. **Response Screen Navigation**
   - **Given** the user taps "View Response"
   - **When** the response screen loads
   - **Then** the response prayer text is displayed (Inter 400, 16px)
   - **And** a "Back to Verse" secondary button is available
   - **And** the "Next Verse" primary button remains available
   - **And** transition uses crossfade animation (200ms, instant if reduced-motion)

4. **Step Advancement**
   - **Given** the user taps "Next Verse" (on either verse or response screen)
   - **When** advancing to the next step
   - **Then** `current_step_index` increments
   - **And** the next verse screen loads with slide-left + fade transition (300ms)
   - **And** the progress indicator updates

5. **Session Completion**
   - **Given** the user reaches step 17 (index 16) and taps "Next Verse"
   - **When** advancing past the last step
   - **Then** the session phase transitions to 'reflection'
   - **And** the reading phase is complete (reflection handled in Epic 2; for now show placeholder/completion screen)

6. **Exit with Save**
   - **Given** the user is on any reading screen
   - **When** they tap the exit button
   - **Then** a confirmation prompt appears: "Save your progress? You can continue later."
   - **And** "Save & Exit" saves `current_step_index` to server and caches locally
   - **And** session `status` remains `'in_progress'`
