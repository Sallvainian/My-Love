# Acceptance Criteria

1. **Message Composition Screen (Linked Users)**
   - **Given** the user has completed the reflection summary (phase transitions from `'reflection'` to `'report'`)
   - **When** the report phase begins
   - **Then** a message composition screen appears: "Write something for [Partner Name]"
   - **And** a textarea is available (max 300 characters, auto-grow, character counter at limit)
   - **And** a "Skip" option is clearly available (tertiary button, no guilt language)
   - **And** the keyboard overlap is handled (sticky CTA above keyboard or scroll into view on focus)

2. **Unlinked User — Skip Message Composition**
   - **Given** the user has no linked partner (`partner_id` is null / `session.partnerId` is undefined)
   - **When** the report phase begins
   - **Then** the message composition step is skipped entirely
   - **And** the session is marked complete (`status: 'complete'`, `completedAt` set)
   - **And** all reflections are still saved
   - **And** a simple completion screen shows "Session complete" with a "Return to Overview" button

3. **Daily Prayer Report Display (After Send/Skip)**
   - **Given** the user sends a message or skips
   - **When** the Daily Prayer Report screen loads
   - **Then** the session is marked as complete (`status: 'complete'`, `completedAt` set)
   - **And** the report shows the user's own step-by-step ratings and bookmarked verses
   - **And** if the partner sent a message, it is revealed (Dancing Script font, 18px, card styling — like receiving a gift)
   - **And** if the partner has not yet completed, their section shows "Waiting for [Partner Name]'s reflections"

4. **Asynchronous Report Viewing (Solo Session, Linked User)**
   - **Given** a Solo session is completed by a linked user
   - **When** the partner opens Scripture Reading later
   - **Then** the partner can view the Daily Prayer Report asynchronously
   - **And** the report shows the sender's message and their own data when they complete

5. **Together Mode Report Display**
   - **Given** a Together mode session is completed
   - **When** both partners have submitted reflections and messages
   - **Then** the report shows both users' step-by-step ratings and bookmarks side-by-side
   - **And** both partners' standout verse selections are shown
   - **And** both messages are revealed
   - **And** bookmark sharing respects the opt-in toggle from the reflection summary
