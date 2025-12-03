# Story 2.3: Real-Time Message Reception

**Epic**: 2 - Love Notes Real-Time Messaging
**Story ID**: 2.3
**Status**: ready-for-dev
**Created**: 2025-12-02

---

## User Story

**As a** user,
**I want** to receive my partner's love notes instantly without refreshing,
**So that** our conversation feels like real-time chat.

---

## Context

This story implements real-time message reception using Supabase Realtime's Broadcast API. When a partner sends a message, it appears instantly in the recipient's chat interface without requiring a page refresh. This creates a seamless, instant messaging experience that makes Love Notes feel like a native chat app.

**Epic Goal**: Partners can exchange instant love notes with real-time delivery
**User Value**: Instant message reception creates immediate emotional connection and engagement
**FRs Covered**: FR8 (real-time receipt via Supabase Realtime), FR13 (haptic feedback on receive)

**Dependencies**:
- Story 2.2 complete - Message sending with optimistic updates works
- Story 2.1 complete - Chat UI foundation with message display exists
- Story 2.0 complete - `love_notes` table exists with RLS policies
- Supabase client configured (Epic 0/1)
- Authentication working (Epic 1)
- notesSlice Zustand store exists with sendNote action
- useLoveNotes hook exists

**Architecture Alignment** (from architecture.md and tech-spec-epic-2.md):
- **Supabase Realtime**: Broadcast API for cross-user message delivery
- **Zustand store**: addNote action for realtime message insertion
- **Vibration API**: navigator.vibrate([30]) for receive feedback (FR13)
- **React hooks**: useEffect for subscription lifecycle management
- **Visibility API**: Detect tab focus for scroll behavior

**CRITICAL LEARNING from Recent Commits**:
From commit `9a02e56` (fix(realtime): replace postgres_changes with Broadcast API):
- **Use Supabase Broadcast API instead of postgres_changes**
- postgres_changes subscriptions don't work reliably for cross-user updates
- Broadcast API is the correct pattern for partner-to-partner real-time messaging
- Pattern: Sender broadcasts message, receiver subscribes to user-specific channel

---

## Acceptance Criteria

| AC ID | Criteria | Validation Method |
|-------|----------|-------------------|
| **AC-2.3.1** | Supabase Realtime subscription detects INSERT events within 2 seconds, new message appears instantly at bottom of chat | E2E test with two browser contexts, timing validation |
| **AC-2.3.2** | Gentle vibration on receive: navigator.vibrate([30]), chat auto-scrolls to new message if user is at bottom | Manual vibration test, E2E scroll behavior test |
| **AC-2.3.3** | If user scrolled up, "New message ↓" indicator appears instead of auto-scroll | E2E test with scroll position verification |
| **AC-2.3.4** | Page in background tab: Realtime subscription maintained, Zustand store updated, message appears when user returns to tab | E2E test with tab visibility simulation |
| **AC-2.3.5** | Subscription lifecycle: Subscribe on component mount, unsubscribe on unmount, reconnect on network recovery, handle subscription errors gracefully | Unit test for subscription lifecycle, integration test for error handling |

---

## Implementation Tasks

### **Task 1: Research Supabase Broadcast API Pattern** (Foundation)
**Goal**: Understand the correct Realtime API to use based on recent learnings

- [ ] **1.1** Review commit `9a02e56` (fix(realtime): replace postgres_changes with Broadcast API)
  - Understand why Broadcast API replaced postgres_changes
  - Examine the mood sync service implementation pattern
  - Note: postgres_changes doesn't reliably work for cross-user real-time updates

- [ ] **1.2** Study Supabase Broadcast API documentation
  - Channel naming conventions
  - Broadcast payload structure
  - Subscription filter patterns
  - Error handling best practices

- [ ] **1.3** Design channel architecture for Love Notes
  - Channel naming: `love-notes:${userId}` (receiver-specific)
  - Event type: `new_message`
  - Payload structure: `{ message: LoveNote }`
  - Security: Only send to intended recipient's channel

### **Task 2: Extend notesSlice with Broadcast Logic** (AC-2.3.1)
**Goal**: Add server-side broadcast on send and client-side subscription

- [ ] **2.1** Update sendNote action in `src/stores/slices/notesSlice.ts`
  - After successful Supabase insert, broadcast message to partner's channel
  - Channel name: `love-notes:${partnerId}`
  - Event: `new_message`
  - Payload: Complete message object with metadata
  - Error handling: Log broadcast failures but don't block send

- [ ] **2.2** Add broadcastMessage helper function
  ```typescript
  const broadcastMessage = async (message: LoveNote, partnerId: string) => {
    const channel = supabase.channel(`love-notes:${partnerId}`);
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: { message }
    });
  };
  ```

- [ ] **2.3** Add addNote action for incoming realtime messages
  ```typescript
  addNote: (note: LoveNote) => {
    set((state) => ({
      notes: [note, ...state.notes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }));
  }
  ```

- [ ] **2.4** Add deduplication logic
  - Check if message already exists by ID before adding
  - Prevent duplicate messages from race conditions
  - Optimistic update from sender shouldn't be duplicated

### **Task 3: Create useRealtimeMessages Hook** (AC-2.3.1, AC-2.3.5)
**Goal**: Manage Realtime subscription lifecycle

- [ ] **3.1** Create `src/hooks/useRealtimeMessages.ts`
  - Accept userId and partnerId as parameters
  - Set up Broadcast channel subscription in useEffect
  - Subscribe to `love-notes:${userId}` channel
  - Listen for `new_message` events
  - Call notesSlice.addNote with received message

- [ ] **3.2** Implement subscription lifecycle
  ```typescript
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`love-notes:${userId}`)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const { message } = payload.payload;
        addNote(message);
        handleNewMessageReceived(message);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);
  ```

- [ ] **3.3** Add error handling and reconnection
  - Handle subscription errors
  - Log reconnection attempts
  - Show user feedback on connection issues
  - Automatic reconnection via Supabase client

- [ ] **3.4** Add connection status tracking
  - Track subscription state: connecting, connected, disconnected
  - Optionally expose status to UI for connection indicator
  - Log state changes for debugging

### **Task 4: Add Receive Feedback Logic** (AC-2.3.2)
**Goal**: Vibration and scroll behavior on message reception

- [ ] **4.1** Create handleNewMessageReceived function
  - Trigger vibration: useVibration hook with pattern [30]
  - Determine scroll behavior based on user's current position
  - If at bottom (within 100px): auto-scroll to new message
  - If scrolled up: show "New message ↓" indicator

- [ ] **4.2** Add scroll position tracking
  - Track if user is "at bottom" of MessageList
  - Update on scroll events
  - Consider bottom threshold: scrollTop + clientHeight >= scrollHeight - 100

- [ ] **4.3** Implement auto-scroll logic
  - When new message arrives and user at bottom → smooth scroll to bottom
  - Preserve scroll position when user scrolled up
  - Use smooth scroll behavior for better UX

### **Task 5: Add "New Message" Indicator** (AC-2.3.3)
**Goal**: Show indicator when message arrives while scrolled up

- [ ] **5.1** Create NewMessageIndicator component
  - `src/components/love-notes/NewMessageIndicator.tsx`
  - Fixed position at bottom of MessageList
  - Coral background with "New message ↓" text
  - Bouncing animation to draw attention
  - Clickable to scroll to bottom

- [ ] **5.2** Add indicator state to notesSlice
  - hasUnreadMessages: boolean
  - Show when message arrives while scrolled up
  - Hide when user scrolls to bottom
  - Reset on manual scroll to bottom

- [ ] **5.3** Implement click handler
  - Smooth scroll to bottom of chat
  - Clear hasUnreadMessages flag
  - Focus on message input

### **Task 6: Handle Background Tab Behavior** (AC-2.3.4)
**Goal**: Maintain subscription when tab is backgrounded

- [ ] **6.1** Add Visibility API integration
  - Listen to visibilitychange events
  - Track document.visibilityState
  - Keep subscription active when hidden
  - Re-sync on tab focus if needed

- [ ] **6.2** Test subscription persistence
  - Verify channel maintains connection when tab hidden
  - Messages queued while hidden appear on focus
  - No duplicate message handling

- [ ] **6.3** Add tab focus handler
  - On tab visible: scroll to bottom if new messages
  - Clear unread indicator
  - Optional: brief vibration on return with new messages

### **Task 7: Integrate into LoveNotes Component** (AC-2.3.1)
**Goal**: Activate realtime subscription in Notes page

- [ ] **7.1** Update `src/components/love-notes/LoveNotes.tsx`
  - Import useRealtimeMessages hook
  - Call hook with current user ID and partner ID
  - Pass scroll behavior handlers to MessageList
  - Integrate NewMessageIndicator component

- [ ] **7.2** Add subscription status display (optional)
  - Show connection indicator in header
  - "Connected" | "Connecting..." | "Disconnected"
  - Use subtle UI element (green dot, etc.)

- [ ] **7.3** Handle partner ID resolution
  - Get partner ID from user profile or relationship table
  - Handle case where partner not set (show error)
  - Validate partner ID exists before subscription

### **Task 8: Unit Tests** (All ACs)
**Goal**: Test coverage for realtime reception

- [ ] **8.1** Create `tests/unit/hooks/useRealtimeMessages.test.ts`
  - Test subscription setup on mount
  - Test unsubscribe on unmount
  - Test message reception and addNote call
  - Test error handling
  - Mock Supabase channel methods

- [ ] **8.2** Update `tests/unit/stores/notesSlice.test.ts`
  - Test addNote action
  - Test message deduplication
  - Test broadcast logic in sendNote
  - Test sort order after addNote

- [ ] **8.3** Create `tests/unit/components/NewMessageIndicator.test.tsx`
  - Test indicator visibility logic
  - Test click handler
  - Test animation presence
  - Test accessibility (ARIA labels)

- [ ] **8.4** Test scroll behavior logic
  - Test auto-scroll when at bottom
  - Test indicator show when scrolled up
  - Test indicator hide on scroll to bottom
  - Mock scroll position calculations

### **Task 9: Integration Testing** (AC-2.3.1, AC-2.3.2, AC-2.3.3, AC-2.3.4)
**Goal**: End-to-end realtime message flow

- [ ] **9.1** Create `tests/e2e/realtime-message-reception.spec.ts` (Playwright)
  - Open two browser contexts (Partner A and Partner B)
  - Authenticate both users
  - Partner A navigates to Notes page
  - Partner B sends message
  - Verify message appears in Partner A's chat within 2 seconds
  - Verify auto-scroll behavior

- [ ] **9.2** Add scroll position test scenario
  - Partner A scrolls up in chat history
  - Partner B sends message
  - Verify "New message ↓" indicator appears
  - Click indicator
  - Verify scroll to bottom

- [ ] **9.3** Add background tab test
  - Partner A navigates to Notes, then switches tab
  - Partner B sends message
  - Switch back to Partner A's tab
  - Verify message appears without refresh

- [ ] **9.4** Add network recovery test
  - Simulate network disconnect
  - Send message
  - Restore network
  - Verify subscription reconnects
  - Verify message received after reconnection

---

## Dev Notes

### Architecture Patterns and Constraints

**Technology Stack** (from architecture.md and tech-spec-epic-2.md):
- **React 19**: Functional components with hooks
- **Zustand 5.x**: State management with realtime message insertion
- **Supabase Realtime Broadcast API**: Cross-user message delivery (NOT postgres_changes)
- **Vibration API**: navigator.vibrate([30]) for receive feedback (FR13)
- **Visibility API**: document.visibilityState for tab focus detection

**CRITICAL Pattern Change** (from commit 9a02e56):
```typescript
// ❌ OLD PATTERN (doesn't work for cross-user):
const channel = supabase.channel('love-notes-channel')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'love_notes',
    filter: `to_user_id=eq.${userId}`
  }, handleNewMessage)
  .subscribe();

// ✅ NEW PATTERN (correct for cross-user):
// SENDER SIDE:
const channel = supabase.channel(`love-notes:${partnerId}`);
await channel.send({
  type: 'broadcast',
  event: 'new_message',
  payload: { message: noteData }
});

// RECEIVER SIDE:
const channel = supabase
  .channel(`love-notes:${userId}`)
  .on('broadcast', { event: 'new_message' }, (payload) => {
    const { message } = payload.payload;
    addNote(message);
  })
  .subscribe();
```

**Realtime Subscription Architecture**:
```
┌─────────────────┐                  ┌─────────────────┐
│   Partner A     │                  │   Partner B     │
│  (Sender)       │                  │  (Receiver)     │
├─────────────────┤                  ├─────────────────┤
│ 1. Send message │                  │ 3. Receive      │
│ 2. Broadcast to │─────────────────>│    broadcast    │
│    channel:B    │  Supabase        │ 4. Add to store │
│                 │  Realtime        │ 5. Vibrate      │
│                 │                  │ 6. Scroll/Show  │
└─────────────────┘                  └─────────────────┘
```

**Component Architecture** (from existing codebase):
```
src/
├── components/
│   └── love-notes/
│       ├── LoveNoteMessage.tsx        # EXISTING - no changes
│       ├── MessageList.tsx            # UPDATE - scroll tracking
│       ├── MessageInput.tsx           # EXISTING - no changes
│       ├── NewMessageIndicator.tsx   # NEW - unread message indicator
│       ├── LoveNotes.tsx              # UPDATE - integrate realtime hook
│       └── index.ts                   # UPDATE - export NewMessageIndicator
├── hooks/
│   ├── useLoveNotes.ts                # EXISTING - uses notesSlice
│   ├── useRealtimeMessages.ts         # NEW - Broadcast subscription
│   ├── useVibration.ts                # EXISTING - from Story 2.2
│   └── index.ts                       # UPDATE - export useRealtimeMessages
├── stores/slices/
│   └── notesSlice.ts                  # UPDATE - add addNote, broadcast
└── types/
    └── models.ts                      # UPDATE - add RealtimeMessagePayload
```

**Naming Conventions** (from existing patterns):
- Components: PascalCase (`NewMessageIndicator.tsx`)
- Hooks: camelCase with `use` prefix (`useRealtimeMessages.ts`)
- Channels: kebab-case (`love-notes:userId`)
- Events: snake_case (`new_message`)
- Styling: Tailwind CSS utility classes (project standard)

**UX Design Patterns**:
- New message indicator: Coral background (#FF6B6B), white text
- Bouncing animation: Tailwind `animate-bounce`
- Auto-scroll: Smooth behavior with `scrollBehavior: 'smooth'`
- Vibration: Gentle pattern [30] (30ms single pulse)
- Connection status: Green dot when connected, yellow when connecting

### Project Structure Notes

**Files to Create:**
```
src/
├── components/love-notes/
│   └── NewMessageIndicator.tsx        # NEW - "New message ↓" indicator
└── hooks/
    └── useRealtimeMessages.ts         # NEW - Realtime Broadcast subscription

tests/
├── unit/
│   ├── components/
│   │   └── NewMessageIndicator.test.tsx
│   └── hooks/
│       └── useRealtimeMessages.test.ts
└── e2e/
    └── realtime-message-reception.spec.ts
```

**Files to Modify:**
```
src/
├── components/love-notes/
│   ├── MessageList.tsx                # Add scroll position tracking
│   ├── LoveNotes.tsx                  # Integrate useRealtimeMessages hook
│   └── index.ts                       # Export NewMessageIndicator
├── hooks/
│   └── index.ts                       # Export useRealtimeMessages
├── stores/slices/
│   └── notesSlice.ts                  # Add addNote action, broadcast in sendNote
└── types/
    └── models.ts                      # Add RealtimeMessagePayload interface

tests/unit/stores/
└── notesSlice.test.ts                 # Add tests for addNote, broadcast
```

**No New Dependencies Required:**
- Supabase Realtime Broadcast API is already available in @supabase/supabase-js
- Vibration API is native browser API
- Visibility API is native browser API

### Learnings from Previous Stories

**From Story 2.2 (Status: done - just completed):**

**Send Functionality Established:**
- sendNote action in notesSlice with optimistic updates
- MessageInput component with validation and sanitization
- useVibration hook for haptic feedback (can reuse for receive)
- Rate limiting and error handling patterns
- XSS sanitization with DOMPurify

**Broadcast Pattern to Implement:**
```typescript
// From Story 2.2, we have the send action
// Need to add broadcast after successful insert:
sendNote: async (content: string) => {
  // ... existing optimistic update logic ...

  const { data, error } = await supabase
    .from('love_notes')
    .insert({ content, to_user_id: partnerId })
    .select()
    .single();

  if (data) {
    // NEW: Broadcast to partner's channel
    const channel = supabase.channel(`love-notes:${partnerId}`);
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: { message: data }
    });

    // ... existing success handling ...
  }
}
```

**Testing Patterns:**
- 52 tests passing for Story 2.1
- Additional tests added for Story 2.2
- Mock Supabase client in unit tests
- Real Supabase in E2E tests
- Two-browser E2E tests for realtime verification

[Source: docs/05-Epics-Stories/2-2-send-love-note-with-optimistic-updates.md]

### Git Intelligence from Recent Commits

**CRITICAL Learning - Broadcast API Pattern** (commit 9a02e56):
```
fix(realtime): replace postgres_changes with Broadcast API for partner mood updates

Key Changes:
- Replaced postgres_changes subscription with Broadcast API
- postgres_changes doesn't work reliably for cross-user real-time updates
- Broadcast pattern: Sender broadcasts to receiver's channel
- Receiver subscribes to their own channel for incoming messages
```

**Implementation Pattern from Mood Sync:**
```typescript
// Sender broadcasts to partner's channel
const syncMood = async (mood: MoodEntry) => {
  const { data, error } = await supabase
    .from('mood_entries')
    .insert(mood)
    .select()
    .single();

  if (data) {
    const channel = supabase.channel(`moods:${partnerId}`);
    await channel.send({
      type: 'broadcast',
      event: 'mood_update',
      payload: { mood: data }
    });
  }
};

// Receiver subscribes to their own channel
useEffect(() => {
  const channel = supabase
    .channel(`moods:${userId}`)
    .on('broadcast', { event: 'mood_update' }, (payload) => {
      const { mood } = payload.payload;
      updatePartnerMood(mood);
    })
    .subscribe();

  return () => channel.unsubscribe();
}, [userId]);
```

**Other Recent Patterns:**
1. **E2E Authentication** (2399826):
   - Proper auth setup in E2E tests before feature testing
   - Use beforeEach for auth state setup

2. **Supabase Mocking** (d14d983):
   - Use vi.mock('server-only') pattern
   - Mock channel.subscribe() and channel.on() methods

### Testing Standards

**Unit Tests (Vitest):**
- Test useRealtimeMessages subscription lifecycle
- Test addNote action in notesSlice
- Test message deduplication logic
- Test broadcast functionality in sendNote
- Test NewMessageIndicator component
- Mock Supabase channel methods
- Mock Vibration API

**E2E Tests (Playwright):**
- Two-browser realtime message flow
- Timing validation (< 2 second delivery)
- Scroll behavior verification
- Indicator appearance when scrolled up
- Background tab message queueing
- Network recovery and reconnection

**Coverage Targets:**
- Hooks: 100%
- Components: 90%
- Store actions: 100%
- Realtime flow: 100%

**Manual Validation Checklist:**
- [ ] Message appears within 2 seconds in partner's chat
- [ ] Vibration feedback on message receive (mobile test)
- [ ] Auto-scroll when at bottom of chat
- [ ] Indicator appears when scrolled up
- [ ] Clicking indicator scrolls to bottom
- [ ] Messages received while tab backgrounded
- [ ] Subscription reconnects after network loss
- [ ] No duplicate messages from race conditions
- [ ] Connection status indicator shows correct state
- [ ] Multiple rapid messages handled correctly

### References

**Source Documents:**
- **Epics**: [docs/05-Epics-Stories/epics.md](./epics.md) - Story 2.3 definition (lines 733-778)
- **Tech Spec**: [docs/05-Epics-Stories/tech-spec-epic-2.md](./tech-spec-epic-2.md) - Epic 2 architecture
- **Previous Story**: [docs/05-Epics-Stories/2-2-send-love-note-with-optimistic-updates.md](./2-2-send-love-note-with-optimistic-updates.md) - Send functionality
- **Database Story**: [docs/05-Epics-Stories/2-0-love-notes-database-schema-setup.md](./2-0-love-notes-database-schema-setup.md) - Database schema

**Key Functional Requirements Covered:**
- **FR8**: Real-time message receipt via Supabase Realtime (Broadcast API)
- **FR13**: Haptic feedback (Vibration API on receive)

**Epic Goal Alignment:**
- Story 2.1: Display messages ✓
- Story 2.2: Send messages ✓
- **Story 2.3: Receive messages in real-time** ← Current
- Story 2.4: History pagination and performance

**Web APIs Used:**
- **Supabase Realtime Broadcast API**: Channel-based message delivery
- **Vibration API**: navigator.vibrate([30]) for receive feedback
- **Visibility API**: document.visibilityState for tab focus detection
- **Intersection Observer**: Scroll position tracking (future enhancement)

**Critical Architecture Decision:**
- **Use Broadcast API, NOT postgres_changes**
- Reason: postgres_changes doesn't work reliably for cross-user updates
- Pattern learned from commit 9a02e56 (mood sync fix)
- Each user subscribes to their own channel: `love-notes:${userId}`
- Sender broadcasts to partner's channel after successful insert

---

## Dev Agent Record

### Context Reference

- Story context will be generated by dev-story workflow

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

**2025-12-02 - Story Creation:**
- Story created via create-story workflow (BMAD)
- Context loaded from epics.md, tech-spec-epic-2.md, Story 2.2
- Git intelligence analyzed from commit 9a02e56 (CRITICAL for Broadcast API pattern)
- Previous story patterns referenced for consistency
- Realtime Broadcast pattern documented from recent mood sync fix

**Key Intelligence Gathered:**
1. **Broadcast API Pattern**: Learned from commit 9a02e56 that postgres_changes doesn't work for cross-user updates
2. **Channel Architecture**: Each user subscribes to `channel:userId`, sender broadcasts to partner's channel
3. **Previous Stories**: Story 2.2 provides send functionality and vibration hook to reuse
4. **Testing Patterns**: Two-browser E2E tests required for realtime verification

### Completion Notes List

*(Will be populated during implementation)*

### File List

*(Will be populated during implementation)*

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-02 | Claude Sonnet 4.5 (BMad Workflow) | Story created from epics.md via create-story workflow with comprehensive context analysis and critical Broadcast API learning from git history |
