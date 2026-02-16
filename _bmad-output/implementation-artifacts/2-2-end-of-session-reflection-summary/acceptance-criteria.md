# Acceptance Criteria

1. **Transition to Reflection Summary After Step 17**
   - **Given** the user has completed step 17's reflection
   - **When** the session transitions to the reflection summary phase
   - **Then** the screen displays a list of verses the user bookmarked during the session
   - **And** bookmarked verses are highlighted; non-bookmarked verses are not shown
   - **And** if no bookmarks exist, text reads "You didn't mark any verses — that's okay"
   - **And** the transition uses fade-through-white animation (400ms, instant if reduced-motion)
   - **And** focus moves to the reflection form heading

2. **Reflection Summary Form Interaction**
   - **Given** the reflection summary is displayed
   - **When** the user interacts with the form
   - **Then** they can select which verse "stood out" from the bookmarked list (uses MoodButton-style chip pattern with `aria-pressed`)
   - **And** verse selection chips are minimum 48x48px touch targets
   - **And** a session-level rating (1-5) is available with the same scale pattern as per-step reflections
   - **And** an optional note textarea (max 200 chars) is available

3. **Reflection Summary Submission**
   - **Given** the user has completed the reflection summary
   - **When** they tap "Continue"
   - **Then** a verse selection and session rating are required (quiet validation, button disabled until complete)
   - **And** the reflection summary data is saved to the server
   - **And** the session phase advances to 'report'
