# Acceptance Criteria

1. **Navigation Tab Accessible**
   - **Given** the user is logged in and on any page
   - **When** they tap the "Scripture" tab in bottom navigation
   - **Then** the Scripture Reading overview page loads
   - **And** `'scripture'` exists in ViewType in navigationSlice
   - **And** the Scripture tab appears in BottomNavigation with the `BookOpen` icon (already exists from Story 1.1)

2. **Overview Page Renders with Lavender Dreams Theme**
   - **Given** the user is on the Scripture Reading overview page
   - **When** the page renders
   - **Then** the page displays using Lavender Dreams theme (purple gradients, glass morphism cards)
   - **And** the page shows a "Start" button to begin a new session
   - **And** the layout follows single-column mobile-first design with `max-w-md` centered on md+

3. **Mode Selection Available via Start Button**
   - **Given** the user taps "Start"
   - **When** mode selection appears
   - **Then** "Solo" and "Together" mode options are displayed

4. **Together Mode Enabled for Linked Partners**
   - **Given** the user has a linked partner (`partner_id` is not null)
   - **When** mode selection is shown
   - **Then** both Solo and Together modes are enabled and selectable

5. **Together Mode Disabled for Unlinked Users**
   - **Given** the user has no linked partner (`partner_id` is null)
   - **When** mode selection is shown
   - **Then** Together mode is grayed out with message "Link your partner to do this together"
   - **And** a "Set up partner" link navigates to the existing partner linking flow
   - **And** Solo mode is fully functional

6. **Resume Prompt for Incomplete Sessions**
   - **Given** the user has an incomplete Solo session
   - **When** the overview page loads
   - **Then** a resume prompt shows "Continue where you left off? (Step X of 17)"
   - **And** a "Start fresh" option is available to explicitly clear saved state
