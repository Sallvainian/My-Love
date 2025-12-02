# Epic Technical Specification: Love Notes Real-Time Messaging

Date: 2025-11-24
Author: Frank
Epic ID: 2
Status: Draft

---

## Overview

Love Notes Real-Time Messaging is the flagship feature that differentiates My-Love PWA from a basic relationship tracker. This epic delivers a real-time chat experience where partners can exchange instant messages (Love Notes) with sub-2-second delivery, optimistic UI updates, and haptic feedback. The feature leverages Supabase Realtime WebSocket subscriptions for instant message delivery, Zustand for client state management with optimistic updates, and the Vibration API for tactile feedback on send/receive events. This epic fulfills the PRD's primary success indicator: making notifications something both partners look forward to receiving.

The implementation builds upon the stable foundation established in Epic 0 (Deployment & Backend Infrastructure) and Epic 1 (PWA Foundation Audit & Stabilization), utilizing the existing Supabase client configuration, authentication flow, and session management.

## Objectives and Scope

**In Scope:**
- Create `love_notes` database table with RLS policies in Supabase
- Build chat UI foundation with message list virtualization (react-window)
- Implement message sending with optimistic updates via Zustand store
- Set up Supabase Realtime subscription for instant message reception
- Add Vibration API feedback for send/receive events (navigator.vibrate())
- Implement message history with infinite scroll pagination
- Display sender identification and timestamps on each message
- Handle error states with retry functionality and rollback

**Out of Scope:**
- Push notifications for Love Notes (covered in Epic 3, Story 3.3)
- Read receipts and typing indicators (post-MVP growth feature)
- Heart reactions or emoji responses (post-MVP growth feature)
- Voice notes or media attachments (Vision feature)
- Message editing or deletion (not required for MVP)

## System Architecture Alignment

This epic aligns with the established architecture (Architecture v2.0):

**Component Integration:**
- **Data Layer:** `love_notes` Supabase table with PostgreSQL RLS policies
- **State Management:** Zustand store (`notesStore.ts`) with persistence middleware
- **Real-Time:** Supabase Realtime channel subscription for INSERT events
- **UI Components:** `src/components/love-notes/*` (LoveNoteMessage, MessageList, MessageInput)
- **Hooks:** `src/hooks/useLoveNotes.ts` for state and subscription management

**Architecture Constraints:**
- Online-first pattern: Operations require network connectivity (no offline queue)
- Optimistic updates with rollback on failure
- WebSocket reconnection handled by Supabase client automatically
- Message content limited to 1000 characters with XSS sanitization (DOMPurify)
- Rate limiting: max 10 messages per minute (client-side enforcement)

**FR Mapping:**
| FR | Requirement | Implementation |
|----|-------------|----------------|
| FR7 | Send text messages | Story 2.2: MessageInput + Zustand sendNote action |
| FR8 | Real-time receipt via Supabase Realtime | Story 2.3: postgres_changes subscription |
| FR9 | Push notification on arrival | Deferred to Epic 3 (Story 3.3) |
| FR10 | View message history with scroll-back | Story 2.1, 2.4: Virtualized list with pagination |
| FR11 | Sender ID and timestamp display | Story 2.1: LoveNoteMessage component |
| FR12 | Optimistic update on send | Story 2.2: Zustand temp ID pattern |
| FR13 | Haptic feedback on send/receive | Story 2.2, 2.3: navigator.vibrate() |

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| `src/lib/supabase.ts` | Supabase client singleton | Environment variables | Configured Supabase client | Epic 0/1 |
| `src/stores/notesStore.ts` | Love Notes state management | User actions | State updates, API calls | Story 2.2 |
| `src/hooks/useLoveNotes.ts` | Hook for components to consume state | Component context | notes, isLoading, error, sendNote, fetchNotes | Story 2.1 |
| `src/components/love-notes/LoveNoteMessage.tsx` | Single message bubble | Message data | Styled message with timestamp | Story 2.1 |
| `src/components/love-notes/MessageList.tsx` | Virtualized message list | Notes array | Scrollable virtualized list | Story 2.4 |
| `src/components/love-notes/MessageInput.tsx` | Text input with send button | User input | Send action trigger | Story 2.2 |
| `src/pages/Notes.tsx` | Love Notes page container | Route params | Complete chat interface | Story 2.1 |

### Data Models and Contracts

**Database Schema (Supabase/PostgreSQL):**

```sql
-- love_notes table
CREATE TABLE love_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000 AND char_length(content) >= 1),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

-- Performance index for message queries
CREATE INDEX idx_love_notes_to_user_created
  ON love_notes (to_user_id, created_at DESC);
CREATE INDEX idx_love_notes_from_user_created
  ON love_notes (from_user_id, created_at DESC);

-- Enable Realtime
ALTER TABLE love_notes REPLICA IDENTITY FULL;

-- Row Level Security
ALTER TABLE love_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON love_notes FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can insert their own messages"
  ON love_notes FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
```

**TypeScript Types:**

```typescript
// src/types/models.ts
export interface LoveNote {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
  // Client-side only fields
  sending?: boolean;  // Optimistic update indicator
  error?: boolean;    // Failed send indicator
}

export interface LoveNotesState {
  notes: LoveNote[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  fetchNotes: (page?: number) => Promise<void>;
  sendNote: (content: string, toUserId: string) => Promise<void>;
  addNote: (note: LoveNote) => void;  // For realtime additions
  retryFailedNote: (tempId: string, content: string, toUserId: string) => Promise<void>;
}
```

### APIs and Interfaces

**Supabase Database Operations:**

| Operation | Method | Request | Response | Error Codes |
|-----------|--------|---------|----------|-------------|
| Fetch messages | SELECT | `from_user_id`, `to_user_id`, pagination params | `LoveNote[]` | PGRST301 (connection), 42501 (permission) |
| Send message | INSERT | `{ content, from_user_id, to_user_id }` | `LoveNote` (inserted row) | 23505 (duplicate), 23514 (check violation) |

**Supabase Realtime Subscription:**

```typescript
// Channel configuration
const channel = supabase.channel('love-notes-channel')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'love_notes',
    filter: `to_user_id=eq.${userId}`
  }, handleNewMessage)
  .subscribe();
```

### Workflows and Sequencing

**Send Love Note Flow:**
```
1. User types message → MessageInput
2. User clicks send → Zustand sendNote action
3. Generate temp UUID → Add to state with sending: true
4. Clear input → Scroll to bottom
5. Trigger vibration → navigator.vibrate([50])
6. Supabase INSERT → Background
7. Success? Replace temp with server response
   Error? Mark as error: true, show retry option
8. Rollback if error after 10s timeout
```

**Receive Love Note Flow (Realtime):**
```
1. Partner sends message → Supabase INSERT
2. Realtime broadcast → Channel subscription
3. Event received → handleNewMessage callback
4. Trigger vibration → navigator.vibrate([30])
5. Add to Zustand store → addNote action
6. If user at bottom → Auto-scroll to new message
   Else → Show "New message ↓" indicator
```

**Message History Pagination:**
```
1. Initial load → Fetch 50 most recent (page 1)
2. User scrolls up → Intersection Observer triggers
3. Load older messages → .range(from, to)
4. Append to existing → Maintain scroll position
5. No more messages? → Show "Beginning of conversation"
```

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Message send to optimistic display | < 100ms | UI response time profiling |
| Message send to server confirmation | < 1s | Network request timing |
| Realtime message delivery (partner to screen) | < 2s | End-to-end latency test |
| Initial message list load (50 messages) | < 500ms | Network + render profiling |
| Pagination load (additional 50) | < 300ms | Network timing |
| Memory usage (1000+ messages) | < 100MB | Browser DevTools Memory panel |
| Scroll performance | 60fps | Frame rate profiling |

Source: NFR-P3 (Love Notes Real-Time Latency), NFR-P6 (Memory Usage)

### Security

| Requirement | Implementation | Validation |
|-------------|----------------|------------|
| XSS prevention | DOMPurify sanitization on content before display | Input fuzzing test |
| RLS enforcement | Supabase policies restrict access to sender/receiver only | Query as different users |
| Input validation | Max 1000 chars, min 1 char, no empty messages | Boundary testing |
| Rate limiting | Client-side: 10 messages/minute with counter | Rate limit test |
| Authentication | All operations require valid Supabase session | Unauthenticated request test |

Source: NFR-S5 (Input Validation), NFR-S3 (Data at Rest Protection)

### Reliability/Availability

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| Network loss during send | Optimistic update remains with error indicator | Manual retry button |
| Realtime disconnection | Supabase client auto-reconnects | Subscription recovery automatic |
| Server error on send | Rollback optimistic update, show error toast | Retry option |
| Tab backgrounding | Subscription maintained by browser | Messages appear on return |
| Message validation failure | Prevent send, show inline error | Clear error on edit |

Source: NFR-R1 (Error Tolerance), NFR-I2 (Supabase Realtime Reliability)

### Observability

| Signal | Type | Purpose |
|--------|------|---------|
| `love_note.sent` | Event log | Track message sending attempts and success |
| `love_note.received` | Event log | Track realtime message reception |
| `love_note.error` | Error log | Capture send failures with context |
| `realtime.disconnect` | Warning log | Track WebSocket disconnection events |
| `realtime.reconnect` | Info log | Track successful reconnections |

Implementation: Console logging in development, structured logger in production (future Sentry integration).

## Dependencies and Integrations

| Dependency | Version | Purpose | Constraint |
|------------|---------|---------|------------|
| @supabase/supabase-js | ^2.81.1 | Database, Auth, Realtime | Already installed, compatible |
| zustand | ^5.0.8 | State management with persistence | Already installed, compatible |
| react-window | ^1.8.10 | List virtualization for performance | New dependency, add via npm |
| dompurify | ^3.0.6 | XSS sanitization | New dependency, add via npm |
| date-fns | ^3.0.0 | Timestamp formatting | Optional, can use Intl.DateTimeFormat |

**Integration Points:**
- **Supabase Auth:** Requires authenticated session for all operations
- **Supabase Database:** love_notes table with RLS
- **Supabase Realtime:** postgres_changes subscription
- **Zustand persist:** localStorage for message cache
- **Vibration API:** Browser support required (graceful degradation)

## Acceptance Criteria (Authoritative)

1. **AC 2.0.1:** `love_notes` table exists in Supabase with id, from_user_id, to_user_id, content, created_at columns
2. **AC 2.0.2:** RLS policy allows users to SELECT only messages where they are sender OR recipient
3. **AC 2.0.3:** RLS policy allows users to INSERT only messages where they are the sender
4. **AC 2.0.4:** Supabase Realtime is enabled on the love_notes table
5. **AC 2.1.1:** Love Notes page displays message list with partner messages on left (gray) and user messages on right (coral)
6. **AC 2.1.2:** Each message shows sender name and timestamp in friendly format ("2:45 PM", "Yesterday")
7. **AC 2.1.3:** Message list is virtualized for performance with 50+ messages
8. **AC 2.2.1:** User can type message in input field at bottom of screen
9. **AC 2.2.2:** Send button is disabled until message has 1+ characters
10. **AC 2.2.3:** Message appears immediately with "sending" indicator (optimistic update)
11. **AC 2.2.4:** Vibration triggers on send: navigator.vibrate([50])
12. **AC 2.2.5:** Input clears and chat scrolls to bottom after send
13. **AC 2.2.6:** Failed send shows error indicator with retry option
14. **AC 2.3.1:** Realtime subscription receives partner's messages within 2 seconds
15. **AC 2.3.2:** New messages appear instantly without page refresh
16. **AC 2.3.3:** Vibration triggers on receive: navigator.vibrate([30])
17. **AC 2.3.4:** Auto-scroll to new message if user is at bottom; show indicator if scrolled up
18. **AC 2.4.1:** Scrolling up loads older messages (50 per page)
19. **AC 2.4.2:** Scroll maintains position during data load
20. **AC 2.4.3:** "Beginning of conversation" indicator shows at top when all messages loaded
21. **AC 2.4.4:** Scrolling maintains 60fps with 1000+ messages loaded

## Traceability Mapping

| AC | Spec Section | Component(s) | Test Idea |
|----|--------------|--------------|-----------|
| AC 2.0.1 | Data Models | Supabase SQL migration | Verify table exists with correct columns |
| AC 2.0.2 | Data Models | RLS policy | Query as sender/receiver - success; query as third user - empty |
| AC 2.0.3 | Data Models | RLS policy | Insert as from_user_id - success; insert as different user - failure |
| AC 2.0.4 | APIs | Supabase Realtime config | Verify REPLICA IDENTITY FULL set on table |
| AC 2.1.1 | Services, Workflows | LoveNoteMessage, MessageList | Visual test: messages styled correctly by sender |
| AC 2.1.2 | Services | LoveNoteMessage | Unit test: timestamp formatting for today/yesterday/older |
| AC 2.1.3 | Services | MessageList (react-window) | Performance test: 100+ messages, check DOM node count |
| AC 2.2.1 | Services | MessageInput | E2E: input field visible and functional |
| AC 2.2.2 | Services | MessageInput | Unit test: button disabled when empty, enabled when text |
| AC 2.2.3 | Workflows | notesStore sendNote | Integration: verify sending state immediately after action |
| AC 2.2.4 | Workflows | MessageInput | Manual test: vibration on send (requires mobile browser) |
| AC 2.2.5 | Workflows | Notes page, MessageInput | E2E: input clears, scroll position at bottom |
| AC 2.2.6 | Workflows | notesStore, LoveNoteMessage | Integration: simulate network error, verify error state |
| AC 2.3.1 | APIs, Workflows | useLoveNotes hook | E2E: send from one browser, receive in another < 2s |
| AC 2.3.2 | APIs | useLoveNotes hook | E2E: message appears without manual refresh |
| AC 2.3.3 | Workflows | useLoveNotes hook | Manual test: vibration on receive |
| AC 2.3.4 | Workflows | MessageList | E2E: scroll behavior based on position |
| AC 2.4.1 | Workflows, APIs | MessageList, notesStore | E2E: scroll up triggers load, 50 messages added |
| AC 2.4.2 | Workflows | MessageList | E2E: scroll position stable during pagination |
| AC 2.4.3 | Workflows | MessageList | E2E: indicator visible at conversation start |
| AC 2.4.4 | Performance | MessageList | Performance profile: maintain 60fps with stress test |

## Risks, Assumptions, Open Questions

| Type | Item | Mitigation/Next Step |
|------|------|---------------------|
| **Risk** | Supabase Realtime WebSocket may disconnect during tab backgrounding | Built-in auto-reconnect in Supabase client; test subscription recovery on foreground |
| **Risk** | Mobile Safari may have Vibration API limitations | Feature detection with graceful degradation (no vibration if unsupported) |
| **Risk** | react-window may have learning curve for variable height messages | Use VariableSizeList with measured heights; fallback to fixed height if issues |
| **Assumption** | Partner relationship is already established via user profiles table | Verify partner_id available in user profile during Epic 1 validation |
| **Assumption** | Supabase anon key is sufficient for client operations (RLS protects data) | Already validated in Epic 0/1 |
| **Assumption** | 50 messages per page is appropriate pagination size | Can adjust based on performance testing |
| **Question** | Should we implement message character counter at 900+ chars? | Recommend: Yes, for UX clarity - show "950/1000" |
| **Question** | How to handle duplicate message detection (accidental double-send)? | Recommend: Client-side debounce on send button (300ms) |
| **Question** | Should conversation be bi-directional query or two separate queries? | Recommend: Single query with OR condition for both directions |

## Test Strategy Summary

**Test Levels:**
1. **Unit Tests (Vitest):**
   - notesStore actions: fetchNotes, sendNote, addNote, optimistic update logic
   - LoveNoteMessage: timestamp formatting, styling based on sender
   - MessageInput: validation, disabled state, send action

2. **Integration Tests (Vitest):**
   - useLoveNotes hook: state management with mocked Supabase
   - Realtime subscription setup and teardown
   - Error handling and retry logic

3. **E2E Tests (Playwright):**
   - Full send/receive flow between two browser contexts
   - Message history pagination
   - Scroll behavior and performance
   - Error state handling

**Coverage Targets:**
- Zustand store actions: 100%
- Component rendering: 90%
- API integration paths: 100%
- Error handling paths: 90%

**Edge Cases:**
- Empty message prevention
- Maximum length (1000 chars) enforcement
- XSS attempt in message content
- Rapid successive sends (rate limiting)
- Network timeout during send
- Reconnection after prolonged offline
- Very long conversation (1000+ messages)
- Special characters and emoji in messages
