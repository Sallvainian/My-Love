# Epic Technical Specification: Enhanced Message Experience

Date: 2025-11-01
Author: Frank
Epic ID: 3
Status: Draft

---

## Overview

Epic 3 transforms the daily message experience from a static 100-message rotation into a rich, year-long emotional journey with 365 unique messages, intuitive swipe navigation through message history, and personalized custom message management. Building on Epic 1's stable persistence foundation and Epic 2's comprehensive test coverage, this epic delivers on the PRD's vision (FR006-FR011, FR026-FR030) to create an engaging, deeply personal message library that evolves beyond the rapid prototype's limited content.

The epic addresses two critical user needs: eliminating message repetition before the one-year mark and enabling discovery of past messages without disrupting the "one message per day" constraint. By implementing backward-only swipe navigation (FR008-FR009) with smooth Framer Motion animations, users can revisit yesterday's heartfelt note while maintaining the anticipation of tomorrow's message. The admin interface (Stories 3.4-3.5) empowers you to curate custom messages that integrate seamlessly into the rotation algorithm, making the experience uniquely tailored to your relationship. The deliverable is a content-rich, interaction-rich message system that sustains engagement throughout the entire first year of use.

## Objectives and Scope

**In Scope:**
- Expand message library from 100 to 365 unique messages across 5 categories: reasons, memories, affirmations, future plans, custom (Story 3.1)
- Implement horizontal swipe gesture navigation (left = previous day, right = toward today) with 300ms animated transitions (Story 3.2)
- Prevent forward navigation beyond current day with subtle bounce indicator (Story 3.2, FR009)
- Track message history in Zustand store with LocalStorage persistence: dates, message IDs shown, current index (Story 3.3)
- Build admin interface UI for custom message management: list all messages, create, edit, delete with category filtering (Story 3.4)
- Persist custom messages in IndexedDB `messages` store and integrate into daily rotation algorithm (Story 3.5)
- Import/export custom messages as JSON for backup/restore capability (Story 3.5)
- Optional: AI-powered message suggestion review interface with OpenAI integration (Story 3.6)
- Maintain existing favorite, share, and theme functionality without regression
- Ensure swipe navigation works on touch devices (mobile) and trackpad (desktop)
- Add keyboard navigation (arrow keys) for accessibility

**Out of Scope:**
- Multi-user message libraries (app remains single-user focused on girlfriend)
- Message scheduling or manual date override (daily rotation remains automatic)
- Message analytics or reading statistics (no tracking of which messages resonate)
- Social sharing of messages beyond existing Web Share API (no public galleries)
- Video or audio messages (text-only remains the format)
- Message threading or conversations (one-way love notes only)
- Backend storage for messages (custom messages stay client-side in IndexedDB)
- Message notifications or reminders (user opens app to see message)
- Testing infrastructure expansion for Epic 3 features (defer test coverage to Story 3.x implementation phases)

## System Architecture Alignment

Epic 3 integrates seamlessly with the existing component-based SPA architecture established in Epics 1-2 without requiring architectural changes:

**Component Architecture:** Enhances the DailyMessage component (existing) with swipe gesture handlers via Framer Motion's drag APIs. Adds new AdminPanel component for custom message management, following the same component patterns: state from Zustand, animations with Framer Motion, responsive Tailwind styling. Navigation structure remains single-view focused (no routing library), with admin panel accessed via hidden route or password-protected toggle.

**State Management:** Extends Zustand useAppStore with new state slices: `messageHistory` (tracking shown messages by date, current index for swipe position), `customMessages` (in-memory cache of user-created messages loaded from IndexedDB). Leverages existing `persist` middleware to save messageHistory to LocalStorage (partialize strategy). Existing message rotation algorithm (updateCurrentMessage action) enhanced to pull from combined pool of default (365) + custom messages.

**Data Layer:** Utilizes IndexedDB `messages` object store (established in Epic 1) with enhanced schema: add `isCustom` boolean field and `createdBy` field to distinguish default vs user-created messages. Existing indexes `by-category` and `by-date` support filtering in admin interface. No changes to service worker cache strategy or offline-first architecture.

**Animation Layer:** Framer Motion (existing dependency ^12.23.24) handles swipe gestures with `motion.div` drag constraints, onDragEnd event handlers, and smooth x-axis transitions. Reuses existing animation patterns from DailyMessage (card entrance, hearts burst) for consistency.

**Build/Deploy Pipeline:** No changes required. Admin interface bundled in same Vite build, pre-configured constants in `src/config/constants.ts` remain deployment pattern.

**Constraints:**
- Swipe navigation must work without React Router dependency (current architecture has no routing)
- Message history limited by LocalStorage quota (~5-10MB typical) - tracking 365 days of history = ~10KB (acceptable)
- Custom message library limited by IndexedDB quota (~50MB typical for text) - supports thousands of custom messages
- Admin interface must maintain PWA offline functionality (no backend dependency for CRUD operations)
- All 365 default messages must be bundled at build time (no lazy loading) - estimated bundle impact: +50KB gzipped

## Detailed Design

### Services and Modules

| Module/Service | Responsibilities | Input | Output | Owner/Story |
|----------------|------------------|-------|--------|-------------|
| **Message Library Module** | Store 365 default messages, provide access by category/date | Category filter, date | Message object | Story 3.1 |
| **defaultMessages.ts** | Export 365 pre-written messages as const array | None (compile-time) | Message[] | Story 3.1 |
| **Message Rotation Algorithm** | Calculate today's message from combined default + custom pool | Current date, message pool | Single Message | Story 3.3 |
| **Swipe Gesture Handler** | Detect horizontal swipe, trigger navigation | Touch/mouse drag events | Navigation direction | Story 3.2 |
| **Message History Manager** | Track shown messages by date, manage navigation index | User swipe actions | Updated history state | Story 3.3 |
| **AdminPanel Component** | UI for CRUD operations on custom messages | User interactions | Message mutations | Story 3.4 |
| **Custom Message Service** | IndexedDB CRUD for custom messages | Create/Read/Update/Delete commands | Promise<Message[]> | Story 3.5 |
| **Import/Export Service** | Serialize/deserialize custom messages to JSON | File upload or export trigger | JSON file or parsed messages | Story 3.5 |
| **AI Suggestion Service** | Generate message suggestions via OpenAI API | Category, count parameters | Suggested messages array | Story 3.6 (optional) |
| **DailyMessage Enhancement** | Add swipe gesture handlers to existing component | Drag events | Message navigation | Story 3.2 |

**Key Module Interactions:**
- DailyMessage Component → Swipe Gesture Handler → Message History Manager → Zustand Store
- AdminPanel Component → Custom Message Service → IndexedDB `messages` store
- Message Rotation Algorithm → Message Library Module (default 365) + Custom Message Service (user-created) → Combined message pool
- Import/Export Service → Custom Message Service → IndexedDB bidirectional sync

### Data Models and Contracts

**Enhanced Message Interface:**

```typescript
// src/types/index.ts (existing, enhanced)
interface Message {
  id: number;              // Auto-increment primary key
  text: string;            // Message content (max 500 chars)
  category: MessageCategory; // reasons | memories | affirmations | future-plans | custom
  createdAt: Date;         // Creation timestamp
  isFavorite: boolean;     // Existing favorite flag
  isCustom: boolean;       // NEW: Distinguish default vs user-created
  createdBy?: 'system' | 'user' | 'ai'; // NEW: Message source
  tags?: string[];         // NEW: Optional tags for filtering
}

type MessageCategory = 'reasons' | 'memories' | 'affirmations' | 'future-plans' | 'custom';
```

**Message History State:**

```typescript
// src/store/useAppStore.ts (new slice)
interface MessageHistory {
  currentIndex: number;           // Current position in history (0 = today)
  shownMessages: Map<string, number>; // Date (YYYY-MM-DD) → Message ID
  maxHistoryDays: number;         // Limit backward navigation (default: 30 days)
}
```

**Custom Message CRUD Types:**

```typescript
// src/services/customMessageService.ts
interface CreateMessageInput {
  text: string;
  category: MessageCategory;
  tags?: string[];
}

interface UpdateMessageInput {
  id: number;
  text?: string;
  category?: MessageCategory;
  tags?: string[];
}

interface MessageFilter {
  category?: MessageCategory;
  isCustom?: boolean;
  searchTerm?: string;
  tags?: string[];
}
```

**Import/Export Schema:**

```typescript
// JSON export format
interface CustomMessagesExport {
  version: '1.0';
  exportDate: string;        // ISO timestamp
  messageCount: number;
  messages: Array<{
    text: string;
    category: MessageCategory;
    tags?: string[];
    createdAt: string;       // ISO timestamp
  }>;
}
```

**AI Suggestion Types (Story 3.6):**

```typescript
interface MessageSuggestion {
  id: string;                // Temporary UUID
  text: string;
  category: MessageCategory;
  confidence?: number;       // 0-1 AI confidence score
  status: 'pending' | 'accepted' | 'rejected';
}

interface GenerateSuggestionsRequest {
  category: MessageCategory;
  count: number;             // Default: 10
  tone?: 'romantic' | 'playful' | 'heartfelt';
}
```

**IndexedDB Schema Enhancement:**

```typescript
// Existing messages store, enhanced schema
interface MessagesStore {
  key: number;              // Auto-increment
  value: Message;
  indexes: {
    'by-category': MessageCategory;
    'by-date': Date;
    'by-custom': boolean;  // NEW: Filter default vs custom
  }
}
```

### APIs and Interfaces

**Zustand Store Actions (Enhanced):**

```typescript
// src/store/useAppStore.ts
interface MessageActions {
  // Existing (no changes)
  loadMessages: () => Promise<void>;
  addMessage: (text: string, category: MessageCategory) => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;

  // NEW: Message Navigation
  navigateToPreviousMessage: () => void;
  navigateToNextMessage: () => void;
  navigateToDate: (date: Date) => void;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;

  // NEW: Custom Message Management
  createCustomMessage: (input: CreateMessageInput) => Promise<Message>;
  updateCustomMessage: (input: UpdateMessageInput) => Promise<void>;
  deleteCustomMessage: (messageId: number) => Promise<void>;
  getCustomMessages: (filter?: MessageFilter) => Promise<Message[]>;

  // NEW: Import/Export
  exportCustomMessages: () => Promise<Blob>;
  importCustomMessages: (file: File) => Promise<number>; // Returns count imported
}
```

**Custom Message Service API:**

```typescript
// src/services/customMessageService.ts
export class CustomMessageService {
  // CRUD Operations
  async create(input: CreateMessageInput): Promise<Message>;
  async update(input: UpdateMessageInput): Promise<void>;
  async delete(messageId: number): Promise<void>;
  async getAll(filter?: MessageFilter): Promise<Message[]>;
  async getById(messageId: number): Promise<Message | null>;

  // Bulk Operations
  async importMessages(messages: CreateMessageInput[]): Promise<number>;
  async exportMessages(): Promise<CustomMessagesExport>;

  // Utilities
  async validateMessageText(text: string): Promise<{ valid: boolean; error?: string }>;
  async getMessageCount(): Promise<{ total: number; custom: number; default: number }>;
}
```

**Message Rotation Algorithm API:**

```typescript
// src/utils/messageRotation.ts (existing, enhanced)
export function getDailyMessage(
  allMessages: Message[],
  date: Date = new Date()
): Message {
  // Enhanced to handle 365+ message pool (default + custom)
  // Returns deterministic message based on date seed
}

export function getMessageForDate(
  allMessages: Message[],
  targetDate: Date
): Message {
  // NEW: Support historical message lookup for swipe navigation
}

export function getAvailableHistoryDays(
  messageHistory: MessageHistory
): number {
  // NEW: Calculate how many days back user can navigate
}
```

**Swipe Gesture Handler API:**

```typescript
// src/components/DailyMessage/useSwipeGesture.ts (new hook)
interface UseSwipeGestureReturn {
  dragProps: {
    drag: 'x';
    dragConstraints: { left: number; right: number };
    dragElastic: number;
    onDragEnd: (event: any, info: PanInfo) => void;
  };
  currentOffset: number;
  isNavigating: boolean;
}

export function useSwipeGesture(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  canSwipeLeft: boolean,
  canSwipeRight: boolean
): UseSwipeGestureReturn;
```

**AI Suggestion Service API (Story 3.6):**

```typescript
// src/services/aiSuggestionService.ts
export class AISuggestionService {
  async generateSuggestions(
    request: GenerateSuggestionsRequest
  ): Promise<MessageSuggestion[]>;

  async acceptSuggestion(suggestionId: string): Promise<Message>;

  async rejectSuggestion(suggestionId: string): Promise<void>;

  async regenerateSuggestions(
    previousSuggestions: MessageSuggestion[]
  ): Promise<MessageSuggestion[]>;
}
```

**Framer Motion Drag API Usage:**

```typescript
// DailyMessage component integration
<motion.div
  drag="x"
  dragConstraints={{ left: -100, right: canNavigateForward ? 100 : 0 }}
  dragElastic={0.2}
  onDragEnd={(event, info) => {
    if (info.offset.x < -50 && canNavigateBack) {
      navigateToPreviousMessage(); // Swipe left
    } else if (info.offset.x > 50 && canNavigateForward) {
      navigateToNextMessage(); // Swipe right
    }
  }}
  animate={{ x: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
  {/* Message card content */}
</motion.div>
```

### Workflows and Sequencing

**Story Execution Sequence:** 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 (sequential, each builds on previous)

**Critical Workflow 1: Daily Message Display with Navigation (User Journey)**

```
User opens app (morning routine)
    ↓
[Story 3.3] App loads message history from LocalStorage via Zustand persist
    ↓
[Story 3.3] Message Rotation Algorithm calculates today's message:
  1. Combine default messages (365) + custom messages from IndexedDB
  2. Check messageHistory.shownMessages for today's date
  3. If exists → return cached message ID
  4. If new day → calculate deterministic message from pool
  5. Store mapping: today's date → message ID
    ↓
[Story 3.2] DailyMessage component renders with swipe gesture handlers:
  - motion.div with drag="x" enabled
  - dragConstraints based on canNavigateBack/canNavigateForward state
  - Smooth entrance animation (existing)
    ↓
User reads today's message, smiles 😊
    ↓
User swipes left (curious about yesterday's message)
    ↓
[Story 3.2] useSwipeGesture hook detects:
  - onDragEnd event triggered
  - info.offset.x < -50 (threshold for left swipe)
  - canNavigateBack = true (not at history limit)
    ↓
[Story 3.3] navigateToPreviousMessage() action:
  1. Increment currentIndex (0 → 1, meaning 1 day back)
  2. Calculate target date: today - currentIndex days
  3. Lookup messageHistory.shownMessages[targetDate]
  4. If found → load that message
  5. If not found (first time visiting that date) → run rotation algorithm for that date
  6. Update Zustand state → DailyMessage re-renders
    ↓
[Story 3.2] Framer Motion animates transition:
  - Exit animation: current message slides right (x: 300px)
  - Enter animation: previous message slides in from left (x: -300px → 0)
  - Duration: 300ms, easing: ease-out
    ↓
User sees yesterday's message, reads it, taps favorite ❤️
    ↓
Swipes right to return to today
    ↓
[Story 3.3] navigateToNextMessage() action:
  1. Decrement currentIndex (1 → 0)
  2. Return to today's message
  3. Update state → smooth transition back
    ↓
User tries to swipe right again (beyond today)
    ↓
[Story 3.2] Drag constraint prevents:
  - dragConstraints.right = 0 when currentIndex = 0
  - Elastic bounce effect (dragElastic: 0.2)
  - Subtle visual feedback: cannot navigate to future
```

**Critical Workflow 2: Custom Message Creation (Admin Flow)**

```
Developer (you) accesses admin panel
    ↓
[Story 3.4] Navigate to admin route (e.g., /admin or hidden toggle)
    ↓
AdminPanel component renders:
  - MessageList: displays all messages (default + custom) with category filter
  - CreateMessageForm: text area, category dropdown, tags input
    ↓
Click "Create New Message" button
    ↓
[Story 3.4] Form modal opens with empty fields
    ↓
Fill in form:
  - Text: "You're my favorite person to laugh with, even when we're being ridiculous."
  - Category: "reasons"
  - Tags: "humor, laughter"
    ↓
Click "Save" button
    ↓
[Story 3.5] createCustomMessage() action triggered:
  1. Validate text length (max 500 chars)
  2. Create Message object with isCustom: true, createdBy: 'user'
  3. customMessageService.create(input)
  4. Save to IndexedDB messages store
  5. Add to Zustand customMessages in-memory cache
  6. Return new message with auto-generated ID
    ↓
[Story 3.5] Message Rotation Algorithm integration:
  - Next day's rotation now includes this custom message in pool
  - Algorithm picks messages from combined default (365) + custom (1) = 366 total
  - Custom message has equal probability of appearing in rotation
    ↓
Success feedback shown: "Custom message created! ✨"
    ↓
MessageList refreshes, showing new custom message with badge
    ↓
Optional: Click "Export Messages" button
    ↓
[Story 3.5] exportCustomMessages() action:
  1. Load all custom messages from IndexedDB
  2. Serialize to JSON format (CustomMessagesExport schema)
  3. Create Blob with MIME type application/json
  4. Trigger browser download: "my-love-custom-messages-2025-11-01.json"
    ↓
Downloaded file saved to device for backup
```

**Critical Workflow 3: AI Message Suggestion Review (Story 3.6 - Optional)**

```
Admin panel open, in "AI Suggestions" section
    ↓
Click "Generate Suggestions" button
    ↓
Select parameters:
  - Category: "affirmations"
  - Count: 10
  - Tone: "heartfelt"
    ↓
[Story 3.6] generateSuggestions() called:
  1. aiSuggestionService.generateSuggestions(request)
  2. Make API call to OpenAI (or similar):
     - Prompt: "Generate 10 heartfelt affirmation messages for my girlfriend..."
     - Model: gpt-3.5-turbo (cost optimization)
     - Max tokens: 500
  3. Parse response into MessageSuggestion[] array
  4. Display suggestions with pending status
    ↓
10 suggestions displayed in scrollable list
    ↓
Review each suggestion:
  - Suggestion 1: "Your presence makes every moment brighter."
    → Click "Accept" ✅
    → acceptSuggestion() saves to custom messages (isCustom: true, createdBy: 'ai')

  - Suggestion 2: "You are enough, exactly as you are."
    → Click "Accept" ✅

  - Suggestion 3: "Generic AI-generated text that feels impersonal"
    → Click "Reject" ❌
    → Discarded, not saved
    ↓
After reviewing all 10:
  - Accepted: 7 messages (saved to IndexedDB)
  - Rejected: 3 messages (discarded)
    ↓
Optional: Click "Generate More" to get new batch
    ↓
Summary shown: "7 messages added to your custom library!"
```

**Critical Workflow 4: Import Custom Messages (Backup Restore)**

```
User reinstalls app or switches device
    ↓
Admin panel → "Import Messages" button
    ↓
File picker opens (accept: .json)
    ↓
Select previously exported file: "my-love-custom-messages-2025-11-01.json"
    ↓
[Story 3.5] importCustomMessages(file) action:
  1. Read file as text
  2. Parse JSON to CustomMessagesExport schema
  3. Validate version compatibility (v1.0)
  4. Validate message count matches array length
  5. For each message in export:
     - Create Message object with isCustom: true
     - Check for duplicates (by text content hash)
     - Save to IndexedDB if not duplicate
  6. Return count of messages imported
    ↓
Success feedback: "Imported 25 custom messages successfully! 🎉"
    ↓
MessageList refreshes with restored messages
    ↓
Message rotation now includes restored messages
```

**Critical Workflow 5: Keyboard Navigation (Accessibility)**

```
User on desktop, keyboard focused on DailyMessage card
    ↓
Press Arrow Left key
    ↓
[Story 3.2] Keyboard event handler:
  - event.key === 'ArrowLeft'
  - canNavigateBack === true
  - Trigger navigateToPreviousMessage()
    ↓
Same transition animation as swipe left
    ↓
Press Arrow Right key
    ↓
[Story 3.2] Keyboard event handler:
  - event.key === 'ArrowRight'
  - canNavigateForward === true
  - Trigger navigateToNextMessage()
    ↓
Same transition animation as swipe right
    ↓
Ensures accessibility for users without touch/trackpad
```

## Non-Functional Requirements

### Performance

**Message Library Loading Performance:**
- Initial app load with 365 default messages: < 200ms parse time (messages bundled as JS const)
- IndexedDB query for custom messages: < 50ms (assuming < 100 custom messages)
- Combined message pool construction: < 100ms total (default + custom merge)
- Target: loadMessages() completes in < 300ms total

**Swipe Navigation Performance:**
- Touch/drag gesture response time: < 16ms (60fps requirement)
- Message transition animation: 300ms smooth (Framer Motion GPU-accelerated)
- History lookup from LocalStorage: < 10ms (small map structure)
- Target: swipe-to-new-message feels instant (< 500ms total)

**Admin Interface Performance:**
- MessageList rendering 365+ messages: Virtualization with react-window (render only visible 20-30 items)
- Category filter application: < 50ms (client-side filtering)
- Custom message CRUD operations: < 100ms IndexedDB write, instant UI update (optimistic)
- Import 100 custom messages from JSON: < 500ms processing + validation

**Bundle Size Impact:**
- 265 additional messages (100 → 365): ~40-50KB gzipped (acceptable)
- AdminPanel component: ~15KB gzipped (lazy load if possible, but single view architecture limits this)
- Total Epic 3 bundle impact: < 75KB gzipped (maintains < 200KB total target from architecture)

**Memory Footprint:**
- 365 default messages in memory: ~150KB (strings + metadata)
- 100 custom messages in memory: ~50KB (typical custom library)
- Message history tracking (30 days): ~5KB (date → ID map)
- Total additional memory: < 250KB (acceptable for modern devices)

**Performance Monitoring Targets:**
- Lighthouse Performance score: Maintain > 90 (current baseline from Epic 1)
- Time to Interactive: Maintain < 3s (no regression from Epic 1)
- First Contentful Paint: Maintain < 1.5s
- Animation frame rate: 60fps sustained during swipe gestures (no dropped frames)

### Security

**Client-Side Data Security:**
- Custom messages stored in IndexedDB (origin-isolated storage, same as Epic 1)
- No transmission of personal messages over network (fully offline CRUD)
- Admin panel access control: password/PIN protection (Story 3.4 implementation detail)
- Export files contain only message content, no PII (partner name not included)

**Input Validation:**
- Message text: max 500 characters, HTML escaping via React (XSS protection)
- Category: enum validation (only accept valid MessageCategory values)
- Tags: sanitize input, limit to 10 tags per message, max 50 chars per tag
- Import JSON: schema validation before processing (reject malformed files)

**AI Integration Security (Story 3.6):**
- OpenAI API key stored in environment variables (never in client bundle)
- If client-side AI integration: API key rotation strategy, rate limiting
- Prefer backend proxy for AI calls (future enhancement to prevent key exposure)
- Content moderation: review AI suggestions before acceptance (human-in-loop)

**Admin Panel Protection:**
- Option 1: Hidden route (/admin-secret-path) not discoverable via navigation
- Option 2: PIN/password prompt (stored in LocalStorage, bcrypt hash)
- Option 3: Development-only feature (excluded from production build via env flag)
- Recommendation: Option 1 + Option 2 for defense in depth

**Data Export Security:**
- JSON export triggered by explicit user action only (no auto-export)
- Downloaded file saved to user's device (user controls file security)
- No upload to cloud services (respects privacy-first architecture)
- File format: plain JSON (readable, no obfuscation needed for personal use)

**Dependency Security:**
- No new production dependencies beyond existing (React, Zustand, Framer Motion)
- AI integration (Story 3.6) may add openai package (npm audit before adding)
- Regular Dependabot updates for existing dependencies (inherited from Epic 1)

### Reliability/Availability

**Message Rotation Reliability:**
- Deterministic algorithm ensures same message shown all day (no drift across app reopens)
- Message history persistence prevents data loss on browser crash/restart
- Fallback: if message rotation fails, show first message from pool (graceful degradation)
- Edge case handling: leap years, timezone changes (use UTC for date calculations)

**Swipe Navigation Reliability:**
- Drag gesture threshold (-50px) prevents accidental navigation from small movements
- Drag constraints prevent infinite navigation (bounded by history limits)
- State synchronization: Zustand ensures navigation state consistent with displayed message
- Error handling: if target message not found, stay on current message with error toast

**Custom Message CRUD Reliability:**
- IndexedDB transactions: atomic operations (create/update/delete succeed or fail together)
- Optimistic UI updates: instant feedback, rollback on failure
- Duplicate prevention: check for existing message by text hash before import
- Data validation: reject invalid messages before IndexedDB write

**Offline Availability:**
- All Epic 3 features work fully offline (no backend dependency for core functionality)
- Service worker (from Epic 1) continues to cache app shell and assets
- IndexedDB operations function normally offline (local storage)
- AI Suggestions (Story 3.6): graceful offline handling (disable "Generate" button with tooltip)

**Error Recovery:**
- Message load failure: retry with exponential backoff (3 attempts max)
- IndexedDB quota exceeded: show user-friendly error, suggest deleting old custom messages
- Import JSON parse failure: show specific error (invalid JSON, wrong schema, etc.)
- Swipe gesture conflict: if user swipes during animation, queue next navigation after current completes

**Data Integrity:**
- Message history Map persisted to LocalStorage as JSON (serialization/deserialization tested)
- Custom messages include createdAt timestamp for audit trail
- Export/import preserves message metadata (category, tags, timestamps)
- No data loss on app updates (IndexedDB schema migrations if needed in future)

### Observability

**Development Logging:**
- Console logging for message rotation decisions (dev mode only):
  - `[MessageRotation] Today's message ID: 42, category: reasons`
  - `[MessageHistory] Navigated to 2025-10-31, message ID: 38`
- Swipe gesture debug info:
  - `[SwipeGesture] Drag offset: -75px, threshold met: true`
  - `[SwipeGesture] Navigation: previous (index 0 → 1)`
- Custom message service operations:
  - `[CustomMessages] Created message ID: 366, category: custom`
  - `[Import] Imported 25 messages, 3 duplicates skipped`

**User-Facing Feedback:**
- Success toasts: "Custom message created! ✨", "Messages exported successfully!"
- Error toasts: "Failed to save message. Please try again.", "Import failed: Invalid file format"
- Loading indicators: Spinner during IndexedDB operations, AI suggestion generation
- Swipe feedback: Subtle visual cues (drag resistance, bounce at limits)

**Analytics (Optional, Privacy-Respecting):**
- Local-only analytics: track custom message count, most-used categories (no external service)
- No user behavior tracking or message content logging
- Admin panel stats: total messages, custom vs default ratio, import/export usage

**Debugging Tools:**
- React DevTools: inspect Zustand store state (messageHistory, customMessages)
- IndexedDB inspector (browser DevTools): view messages store, verify custom messages saved
- LocalStorage inspector: view messageHistory persistence, Zustand state
- Framer Motion DevTools: inspect animation states and transitions

**Error Reporting:**
- ErrorBoundary (from Epic 1) catches React errors in new components
- Console.error for critical failures (IndexedDB errors, import parsing failures)
- User-friendly error screens with actionable recovery steps
- No external error reporting service (privacy-first, local debugging only)

**Performance Profiling:**
- React Profiler: measure DailyMessage re-render times with swipe navigation
- Chrome DevTools Performance: profile message rotation algorithm, IndexedDB operations
- Lighthouse: verify Epic 3 changes don't degrade PWA score
- Bundle analyzer: ensure 365 messages don't bloat bundle excessively

## Dependencies and Integrations

### Existing Dependencies (No Changes Required)

| Package | Version | Type | Purpose | Epic 3 Usage |
|---------|---------|------|---------|--------------|
| **react** | ^19.1.1 | production | UI framework | AdminPanel component, enhanced DailyMessage |
| **react-dom** | ^19.1.1 | production | React rendering | No changes |
| **zustand** | ^5.0.8 | production | State management | Extended store with messageHistory, customMessages |
| **idb** | ^8.0.3 | production | IndexedDB wrapper | Custom message CRUD via existing storageService |
| **framer-motion** | ^12.23.24 | production | Animations | Swipe gesture handlers (drag API), message transitions |
| **lucide-react** | ^0.548.0 | production | Icons | Admin panel icons (plus, edit, trash, download, upload) |
| **workbox-window** | ^7.3.0 | production | Service worker | No changes (inherited from Epic 1) |
| **typescript** | ~5.9.3 | development | Type safety | Enhanced interfaces (MessageHistory, CreateMessageInput) |
| **vite** | ^7.1.7 | development | Build tool | Bundle 365 messages, tree-shake unused code |
| **tailwindcss** | ^3.4.18 | development | Styling | AdminPanel component styling |
| **@playwright/test** | ^1.56.1 | development | E2E testing | Test Epic 3 features (defer to implementation) |

**Total Dependencies:** 0 new production dependencies, Epic 3 uses only existing stack

### Optional New Dependency (Story 3.6)

| Package | Version | Type | Purpose | When to Add |
|---------|---------|------|---------|-------------|
| **openai** | ^4.x (latest) | production | AI message generation | Only if implementing Story 3.6 (optional) |

**Decision Point:** Story 3.6 is optional enhancement. If implementing, add `openai` package and update package.json. If skipping, Epic 3 completes with 0 new dependencies.

### Integration Points

**Framer Motion Drag API Integration:**
```typescript
// Enhanced DailyMessage component uses existing framer-motion ^12.23.24
import { motion, PanInfo } from 'framer-motion';

// Drag API usage (no new dependency, leveraging existing)
<motion.div
  drag="x"
  dragConstraints={{ left: -100, right: 0 }}
  dragElastic={0.2}
  onDragEnd={(event: any, info: PanInfo) => handleSwipe(info)}
/>
```

**Zustand Store Extension:**
```typescript
// Existing store (src/store/useAppStore.ts) enhanced with new slices
// No migration required, new fields added alongside existing state
interface AppState {
  // Existing (Epic 1) - NO CHANGES
  settings: Settings | null;
  isOnboarded: boolean;
  messages: Message[];

  // NEW (Epic 3) - Added fields
  messageHistory: MessageHistory;
  customMessages: Message[];
  currentMessageIndex: number;
}
```

**IndexedDB Schema Enhancement:**
```typescript
// Existing messages object store enhanced with new indexes
// Migration: Add 'by-custom' index to existing store

// src/services/storageService.ts enhancement
const db = await openDB<MyLoveDB>('my-love-db', 2, { // Version 1 → 2
  upgrade(db, oldVersion, newVersion, transaction) {
    if (oldVersion < 2) {
      // Migration: add 'by-custom' index to messages store
      const messagesStore = transaction.objectStore('messages');
      messagesStore.createIndex('by-custom', 'isCustom', { unique: false });
    }
  },
});
```

**No External Services Integration:**
- No backend API calls (custom messages stored client-side only)
- No cloud storage services
- No analytics services
- Optional: OpenAI API for Story 3.6 (requires API key in .env, user-provided)

### Dependency Version Constraints

**Compatibility Matrix:**

| Dependency | Current | Epic 3 Requirement | Notes |
|------------|---------|-------------------|-------|
| React | 19.1.1 | >= 19.0.0 | AdminPanel uses modern hooks (no legacy code) |
| Zustand | 5.0.8 | >= 5.0.0 | Persist middleware compatible |
| Framer Motion | 12.23.24 | >= 12.0.0 | Drag API stable since v11, using v12 features |
| IndexedDB (idb) | 8.0.3 | >= 7.0.0 | Schema migration support |
| TypeScript | 5.9.3 | >= 5.0.0 | Strict mode, advanced types for message filters |

**No Breaking Changes:** Epic 3 maintains backward compatibility with Epic 1/2 dependency versions.

### Build Configuration Impact

**Vite Configuration (vite.config.ts) - No Changes Required:**
```typescript
// Existing config supports Epic 3 without modifications
export default defineConfig({
  base: '/My-Love/',           // Unchanged
  plugins: [react(), VitePWA()], // Unchanged
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined  // Could add AdminPanel code splitting (optional)
      }
    }
  }
});
```

**Optional Build Optimization:**
```typescript
// If bundle size exceeds target, add code splitting for AdminPanel
manualChunks: {
  'admin': ['src/components/AdminPanel/AdminPanel.tsx'],
  'messages': ['src/data/defaultMessages.ts']
}
```

**TypeScript Configuration (tsconfig.json) - No Changes:**
- Strict mode enabled: validates new MessageHistory, CreateMessageInput types
- Target ES2020: supports Map, async/await (used in custom message service)
- JSX: react-jsx (unchanged from Epic 1)

### Storage Quota Considerations

**LocalStorage Usage:**
- Existing (Epic 1): ~5KB (settings, onboarding state, existing messageHistory)
- Epic 3 Addition: ~5KB (enhanced messageHistory with 30-day tracking)
- Total: ~10KB (well under 5-10MB quota)

**IndexedDB Usage:**
- Existing (Epic 1): ~1MB (100 messages, minimal photos)
- Epic 3 Addition:
  - 265 additional default messages: ~100KB (text only)
  - Custom messages (100 typical): ~50KB
  - Total additional: ~150KB
- Total: ~1.15MB (well under 50MB typical quota)

**Quota Management:**
- Monitor IndexedDB size via customMessageService.getMessageCount()
- Warn user at 80% quota (if browser provides quota API)
- Suggest export + selective delete if approaching limit

### Browser Compatibility (Inherited from Epic 1)

**Swipe Gestures:**
- Chrome/Edge: ✅ Pointer events, touch events (full support)
- Safari: ✅ Touch events (full support)
- Firefox: ✅ Pointer events (full support)

**IndexedDB:**
- All modern browsers: ✅ (Epic 1 validated)
- IndexedDB v2 migration: ✅ (supported since 2017)

**Framer Motion:**
- All browsers: ✅ GPU acceleration, CSS transforms
- Fallback: CSS transitions if browser lacks GPU support (rare)

## Acceptance Criteria (Authoritative)

These acceptance criteria are extracted from [epics.md](./epics.md) Epic 3 and serve as the authoritative source for story completion validation.

### Story 3.1: Expand Message Library to 365 Messages

**AC-3.1.1** Generate or source 265 additional love messages across the 5 categories (reasons, memories, affirmations, future plans, custom)
**AC-3.1.2** Messages are high-quality, heartfelt, and varied in tone and length
**AC-3.1.3** Update defaultMessages.ts with all 365 messages
**AC-3.1.4** Each message tagged with appropriate category
**AC-3.1.5** No duplicate messages in library
**AC-3.1.6** Message rotation algorithm handles 365-message library correctly

### Story 3.2: Implement Horizontal Swipe Navigation - Backward Only

**AC-3.2.1** Swipe left gesture navigates to previous day's message
**AC-3.2.2** Swipe right from any past message returns toward today
**AC-3.2.3** Cannot swipe right beyond today's message (subtle bounce indicator)
**AC-3.2.4** Smooth animated transition between messages (300ms ease-out)
**AC-3.2.5** Message history loads correctly from message rotation algorithm
**AC-3.2.6** Swipe gesture works on touch devices and trackpad (desktop)
**AC-3.2.7** Accessibility: keyboard navigation (arrow keys) also works

### Story 3.3: Message History State Management

**AC-3.3.1** Store tracks: current message index, message history (dates + message IDs shown)
**AC-3.3.2** History persists across sessions (LocalStorage via Zustand persist)
**AC-3.3.3** Algorithm ensures today's message is deterministic (same message all day)
**AC-3.3.4** Prevents loading messages from future dates
**AC-3.3.5** Handles edge case: first-time user has no history (starts with today only)
**AC-3.3.6** Handles edge case: user skipped days (show missed messages when swiping back)

### Story 3.4: Admin Interface - Custom Message Management (Phase 1: UI)

**AC-3.4.1** Add "Admin" tab in navigation (password-protected or hidden route)
**AC-3.4.2** UI displays list of all messages with category filter
**AC-3.4.3** UI shows "Create New Message" button
**AC-3.4.4** UI shows "Edit" and "Delete" buttons for each message
**AC-3.4.5** Form for creating new message: text area, category dropdown, save/cancel
**AC-3.4.6** Form for editing existing message: pre-populated fields, save/cancel
**AC-3.4.7** All UI is styled consistently with app theme
**AC-3.4.8** No backend integration yet (save to LocalStorage temporarily)

### Story 3.5: Admin Interface - Message Persistence & Integration

**AC-3.5.1** Custom messages saved to IndexedDB `messages` object store
**AC-3.5.2** Message rotation algorithm pulls from both default and custom messages
**AC-3.5.3** Category filter works with custom messages
**AC-3.5.4** Custom messages can be marked as "active" or "draft" (only active rotate)
**AC-3.5.5** Deletion removes from IndexedDB and rotation
**AC-3.5.6** Import/export feature to back up custom messages (JSON format)
**AC-3.5.7** Test: Create custom message, verify it appears in rotation next day

### Story 3.6: AI Message Suggestion Review Interface (Optional Enhancement)

**AC-3.6.1** Admin panel includes "Generate Suggestions" button
**AC-3.6.2** Uses OpenAI API (or similar) to generate 10 message suggestions
**AC-3.6.3** Each suggestion displayed with "Accept" and "Reject" buttons
**AC-3.6.4** Accepted messages added to custom message library as drafts
**AC-3.6.5** Rejected messages discarded
**AC-3.6.6** Can regenerate new batch of suggestions
**AC-3.6.7** Rate limiting or cost control to prevent excessive API usage

**Total Acceptance Criteria:** 40 atomic, testable criteria across 6 stories

## Traceability Mapping

This table maps acceptance criteria to technical specifications, impacted components, and test approaches.

| AC ID | Spec Section | Component/Module | Test Approach |
|-------|-------------|------------------|---------------|
| **AC-3.1.1** | Services | defaultMessages.ts | Verify 365 messages exist, 265 new messages added |
| **AC-3.1.2** | Data Models | Message[] array | Manual review: quality, variety, heartfelt tone |
| **AC-3.1.3** | Services | defaultMessages.ts | Code review: file exports 365 messages |
| **AC-3.1.4** | Data Models | Message.category | Verify each message has valid category tag |
| **AC-3.1.5** | Services | defaultMessages.ts | Script: check for duplicate message text |
| **AC-3.1.6** | Workflows | Message Rotation Algorithm | Test: verify rotation works with 365 messages |
| **AC-3.2.1** | APIs | useSwipeGesture hook | E2E: swipe left, verify previous message loads |
| **AC-3.2.2** | APIs | useSwipeGesture hook | E2E: swipe right from past, verify returns toward today |
| **AC-3.2.3** | Workflows | Drag constraints | E2E: swipe right from today, verify bounce indicator |
| **AC-3.2.4** | APIs | Framer Motion transitions | Visual test: verify 300ms smooth animation |
| **AC-3.2.5** | Workflows | Message rotation algorithm | E2E: navigate back, verify correct historical message |
| **AC-3.2.6** | APIs | useSwipeGesture hook | E2E: test on mobile (touch) and desktop (trackpad) |
| **AC-3.2.7** | APIs | Keyboard event handlers | E2E: press arrow keys, verify navigation works |
| **AC-3.3.1** | Data Models | MessageHistory interface | Code review: verify state tracking fields |
| **AC-3.3.2** | NFR Reliability | Zustand persist middleware | E2E: navigate, refresh browser, verify history persisted |
| **AC-3.3.3** | Workflows | Message Rotation Algorithm | E2E: open app multiple times same day, verify same message |
| **AC-3.3.4** | Workflows | canNavigateForward() | Unit test: verify future dates blocked |
| **AC-3.3.5** | Workflows | Message history initialization | E2E: new user, verify only today's message available |
| **AC-3.3.6** | Workflows | Message history lookup | E2E: skip 3 days, swipe back, verify all 3 shown |
| **AC-3.4.1** | Services | AdminPanel component | E2E: navigate to /admin, verify panel renders |
| **AC-3.4.2** | Services | MessageList component | E2E: verify all messages displayed with filter |
| **AC-3.4.3** | Services | CreateMessageForm | E2E: verify "Create" button opens form modal |
| **AC-3.4.4** | Services | MessageList actions | E2E: verify Edit/Delete buttons on each message |
| **AC-3.4.5** | Services | CreateMessageForm | E2E: fill form, verify save creates message |
| **AC-3.4.6** | Services | EditMessageForm | E2E: edit message, verify pre-populated fields |
| **AC-3.4.7** | NFR Observability | AdminPanel styling | Visual test: verify theme consistency |
| **AC-3.4.8** | Services | Temporary LocalStorage | E2E: create message, verify saved (pre-Story 3.5) |
| **AC-3.5.1** | APIs | customMessageService.create() | E2E: create message, verify in IndexedDB |
| **AC-3.5.2** | Workflows | Message Rotation Algorithm | E2E: add custom message, verify appears in rotation |
| **AC-3.5.3** | Services | MessageList filter | E2E: filter by category, verify custom messages included |
| **AC-3.5.4** | Data Models | Message.isCustom, status field | E2E: toggle active/draft, verify rotation behavior |
| **AC-3.5.5** | APIs | customMessageService.delete() | E2E: delete message, verify removed from rotation |
| **AC-3.5.6** | APIs | exportCustomMessages(), importCustomMessages() | E2E: export, verify JSON file; import, verify messages restored |
| **AC-3.5.7** | Workflows | End-to-end custom message flow | E2E: create custom, next day verify in rotation |
| **AC-3.6.1** | Services | AISuggestionService UI | E2E: verify "Generate" button in admin panel |
| **AC-3.6.2** | APIs | aiSuggestionService.generateSuggestions() | Integration test: verify OpenAI API call succeeds |
| **AC-3.6.3** | Services | Suggestion review UI | E2E: verify Accept/Reject buttons on suggestions |
| **AC-3.6.4** | APIs | acceptSuggestion() | E2E: accept suggestion, verify saved as draft |
| **AC-3.6.5** | APIs | rejectSuggestion() | E2E: reject suggestion, verify discarded |
| **AC-3.6.6** | Services | Regenerate suggestions | E2E: click regenerate, verify new batch displayed |
| **AC-3.6.7** | NFR Performance | API rate limiting | Manual test: verify rate limiting prevents excessive calls |

**Coverage Summary:**
- **Services/Modules**: 14 ACs
- **Data Models**: 4 ACs
- **APIs/Interfaces**: 10 ACs
- **Workflows**: 8 ACs
- **NFR Performance**: 1 AC
- **NFR Reliability**: 1 AC
- **NFR Observability**: 2 ACs

## Risks, Assumptions, Open Questions

### Risks

**R1: Message Quality Degradation with 365 Messages (MEDIUM)**
- **Risk:** Generating 265 additional high-quality, heartfelt messages is challenging; quality may decline toward end
- **Impact:** Later messages feel generic or repetitive, reducing emotional impact
- **Mitigation:** Source messages from multiple creators (AI suggestions + manual curation), review all messages for quality before merging, maintain "best of" collection for rotation prioritization
- **Owner:** Story 3.1

**R2: Swipe Gesture Conflicts with Browser Navigation (LOW)**
- **Risk:** Horizontal swipe on mobile Safari may trigger browser back/forward navigation instead of message navigation
- **Impact:** User accidentally navigates away from app when trying to browse messages
- **Mitigation:** Use preventDefault() on touch events within message card bounds, test extensively on Safari iOS, add visual hint to swipe within card area
- **Owner:** Story 3.2

**R3: LocalStorage Quota Exceeded for Message History (LOW)**
- **Risk:** Tracking 365 days of message history may exceed LocalStorage quota (typically 5-10MB)
- **Impact:** Zustand persist middleware fails, message history not saved across sessions
- **Mitigation:** Limit message history tracking to 30-90 days (configurable), implement LRU eviction for old entries, compress history data structure (Map → array of tuples)
- **Owner:** Story 3.3

**R4: Admin Panel Discovery by End User (MEDIUM)**
- **Risk:** Girlfriend discovers admin panel and sees unfinished custom messages or AI-generated drafts
- **Impact:** Spoils surprise, reduces authenticity of personalized messages
- **Mitigation:** Option 1: Hidden route (/admin-[random-hash]), Option 2: PIN/password protection, Option 3: Development-only build flag (exclude from production)
- **Owner:** Story 3.4

**R5: Custom Message Import Malformed Data (MEDIUM)**
- **Risk:** Importing JSON from external source or corrupted export introduces invalid messages into rotation
- **Impact:** App crashes on message load, displays broken messages, rotation algorithm fails
- **Mitigation:** Comprehensive JSON schema validation before import, reject files with invalid structure, sanitize message text for XSS, limit import to 500 messages max
- **Owner:** Story 3.5

**R6: AI-Generated Messages Cost Overrun (HIGH - Story 3.6)**
- **Risk:** Unlimited AI suggestion generation leads to high OpenAI API costs ($0.002/1K tokens × excessive requests)
- **Impact:** Unexpected monthly bills, budget exceeded
- **Mitigation:** Hard limit: 5 batches (50 suggestions) per day, cache suggestions locally, consider free alternatives (local LLM), display cost estimate before generation, make Story 3.6 opt-in
- **Owner:** Story 3.6

### Assumptions

**A1: 365 Messages Sufficient for Year One**
- **Assumption:** Users will engage with app daily for one year, requiring 365 unique messages before potential repetition acceptable
- **Validation:** PRD explicitly requests 365 messages (FR006)
- **Impact if wrong:** If users continue beyond year one, messages repeat (acceptable trade-off, can add more later)

**A2: Swipe Navigation Intuitive Without Onboarding**
- **Assumption:** Swipe left/right gesture is discoverable without tutorial or onboarding flow
- **Validation:** Industry standard (Tinder, dating apps, photo galleries use swipe)
- **Impact if wrong:** Users may not discover navigation feature; add subtle visual hint or first-time tooltip

**A3: Custom Messages Remain Local-Only**
- **Assumption:** No need for backend storage or cross-device sync of custom messages (single-device use case)
- **Validation:** PRD Out of Scope: cross-device sync (line 183)
- **Impact if wrong:** User reinstalls app or switches devices, loses custom messages (mitigated by export/import feature)

**A4: Admin Panel Acceptable in Production Build**
- **Assumption:** Including admin panel in production bundle is acceptable (hidden route, password-protected)
- **Validation:** Single-user app, you (developer) are the admin
- **Impact if wrong:** Bundle size increases ~15KB, girlfriend discovers panel (mitigated by R4 mitigations)

**A5: IndexedDB Schema Migration Straightforward**
- **Assumption:** Adding 'by-custom' index to existing messages store is non-breaking migration
- **Validation:** idb library supports upgrade() handler for migrations (tested in Epic 1)
- **Impact if wrong:** Migration fails, existing messages lost (unlikely, can test with data backup)

### Open Questions

**Q1: How Many Messages Should Message History Track?** (Priority: MEDIUM)
- **Question:** Should messageHistory track all 365 days or limit to last 30-90 days for LocalStorage efficiency?
- **Impact:** Full year tracking = ~10KB LocalStorage, 30 days = ~1KB (both acceptable)
- **Recommendation:** Default 30 days, make configurable via settings (maxHistoryDays: number)
- **Decision needed by:** Story 3.3 implementation

**Q2: Should Custom Messages Have Priority in Rotation?** (Priority: LOW)
- **Question:** Should custom messages appear more frequently than default messages (2x probability)?
- **Impact:** More personalized experience vs. depleting custom library faster
- **Recommendation:** Equal probability initially, add "priority" field for future enhancement
- **Decision needed by:** Story 3.5 implementation

**Q3: What Format for AI-Generated Message Prompts?** (Priority: HIGH - if implementing Story 3.6)
- **Question:** Should prompt include examples, relationship context, tone instructions?
- **Impact:** Affects quality and relevance of AI suggestions
- **Recommendation:** Prompt template: "Generate heartfelt [category] messages for my girlfriend, similar to: [2-3 examples], tone: [romantic/playful/heartfelt]"
- **Decision needed by:** Story 3.6 planning

**Q4: Should Admin Panel Support Batch Operations?** (Priority: LOW)
- **Question:** Allow multi-select delete, bulk import from CSV, batch category reassignment?
- **Impact:** Faster management for large custom libraries (100+ messages)
- **Recommendation:** Defer to future enhancement, single operations sufficient for MVP
- **Decision needed by:** Story 3.4 planning

**Q5: Should Message Rotation Algorithm Be Truly Random or Weighted?** (Priority: MEDIUM)
- **Question:** Pure random from pool vs. weighted by category (ensure variety) or recently shown (prevent close repetition)?
- **Impact:** User experience - pure random may show same category 3 days in row
- **Recommendation:** Pseudo-random with category distribution (20% reasons, 20% memories, 20% affirmations, 20% future plans, 20% custom)
- **Decision needed by:** Story 3.3 implementation

## Test Strategy Summary

### Test Approach Philosophy

**Integration Testing Focus:**
- Epic 3 leverages existing Playwright E2E test infrastructure from Epic 2
- Tests validate full user journeys: swipe navigation, custom message CRUD, rotation algorithm
- Focus on critical paths: today's message → swipe left → yesterday → swipe right → today
- Admin panel tested separately with CRUD operations and import/export workflows

**Progressive Test Coverage:**
- Story 3.1: Manual review of 365 messages (quality, no duplicates)
- Story 3.2: E2E swipe gesture tests (touch/trackpad/keyboard)
- Story 3.3: E2E message history persistence tests (browser refresh, multi-day tracking)
- Story 3.4: E2E admin UI tests (create, edit, delete forms)
- Story 3.5: E2E custom message integration tests (rotation, import/export)
- Story 3.6: Integration tests for AI API (mock OpenAI, validate responses)

### Test Coverage Targets

**Epic 3 Feature Coverage (Estimated 25 new test cases):**

| Feature | Test Suite | Test Count | Story |
|---------|-----------|------------|-------|
| **Message Library (365)** | message-library.spec.ts | 3 | 3.1 |
| - Verify 365 messages loaded | | 1 | |
| - Verify no duplicates | | 1 | |
| - Verify all categories represented | | 1 | |
| **Swipe Navigation** | swipe-navigation.spec.ts | 8 | 3.2 |
| - Swipe left navigates to previous message | | 1 | |
| - Swipe right navigates toward today | | 1 | |
| - Cannot swipe right beyond today (bounce) | | 1 | |
| - Smooth animation (300ms) | | 1 | |
| - Keyboard navigation (arrow keys) | | 2 | |
| - Touch vs trackpad compatibility | | 2 | |
| **Message History** | message-history.spec.ts | 5 | 3.3 |
| - History persists across browser refresh | | 1 | |
| - Same message shown all day (deterministic) | | 1 | |
| - Cannot navigate to future dates | | 1 | |
| - First-time user starts with today only | | 1 | |
| - Skipped days shown when swiping back | | 1 | |
| **Admin Panel UI** | admin-panel.spec.ts | 5 | 3.4 |
| - Admin route renders panel | | 1 | |
| - MessageList displays with category filter | | 1 | |
| - Create message form opens and saves | | 1 | |
| - Edit message form pre-populates | | 1 | |
| - Delete message confirmation works | | 1 | |
| **Custom Message Integration** | custom-messages.spec.ts | 4 | 3.5 |
| - Custom message saved to IndexedDB | | 1 | |
| - Custom message appears in rotation | | 1 | |
| - Export custom messages to JSON | | 1 | |
| - Import custom messages from JSON | | 1 | |

**Total:** 25 test cases × 3 browsers (Chromium, Firefox, WebKit) = 75 test executions

### Test Execution Strategy

**Local Development:**
- Command: `npm run test:e2e` (all tests, all browsers)
- Command: `npx playwright test swipe-navigation.spec.ts --headed` (debug specific suite)
- Parallel execution: 4 workers (inherited from Epic 2)
- Target execution time: < 7 minutes (Epic 3 adds ~2 min to Epic 2 baseline)

**CI (GitHub Actions):**
- Trigger: Push to main, all pull requests (inherited from Epic 2)
- Epic 3 tests run alongside Epic 1-2 tests (cumulative suite)
- Target execution time: < 15 minutes (Epic 1-3 comprehensive suite)
- PR blocking: Any test failure blocks merge

### Test Data Management

**Message Library Test Data:**
```typescript
// tests/fixtures/messages.ts
export const testMessages: Message[] = [
  { id: 1, text: "Test message 1", category: 'reasons', ... },
  { id: 2, text: "Test message 2", category: 'memories', ... },
  // 10 test messages for swipe navigation testing
];
```

**Custom Message Test Fixtures:**
```typescript
// tests/fixtures/customMessages.ts
export const customMessagePayload: CreateMessageInput = {
  text: "You're my favorite person to laugh with.",
  category: 'reasons',
  tags: ['humor', 'laughter']
};

export const customMessagesExport: CustomMessagesExport = {
  version: '1.0',
  exportDate: '2025-11-01T10:00:00Z',
  messageCount: 5,
  messages: [ /* 5 test messages */ ]
};
```

**Message History Test Scenarios:**
```typescript
// tests/fixtures/messageHistory.ts
export const messageHistoryScenarios = {
  firstTimeUser: {
    currentIndex: 0,
    shownMessages: new Map(),
    maxHistoryDays: 30
  },
  userWith7DaysHistory: {
    currentIndex: 0,
    shownMessages: new Map([
      ['2025-11-01', 42],
      ['2025-10-31', 38],
      // ... 5 more entries
    ]),
    maxHistoryDays: 30
  }
};
```

### Test Environment Configuration

**Playwright Test Helpers (Enhanced):**
```typescript
// tests/support/helpers/messageHelpers.ts
export async function seedMessages(
  page: Page,
  messages: Message[]
): Promise<void> {
  // Helper to populate IndexedDB messages store
}

export async function clearMessageHistory(page: Page): Promise<void> {
  // Helper to reset messageHistory in LocalStorage
}

export async function navigateToAdminPanel(
  page: Page,
  password?: string
): Promise<void> {
  // Helper to access admin panel (handle password if needed)
}
```

### Definition of Done (Testing Perspective)

**Story 3.1 Complete When:**
- 365 messages in defaultMessages.ts
- Manual review: all messages high-quality, no duplicates
- Message rotation algorithm handles 365-message pool

**Story 3.2 Complete When:**
- 8 swipe navigation tests pass (touch, trackpad, keyboard)
- Smooth 300ms animation verified visually
- No browser navigation conflicts (Safari tested)

**Story 3.3 Complete When:**
- 5 message history tests pass (persistence, determinism, edge cases)
- LocalStorage quota under 10KB verified
- Skipped days and first-time user scenarios work

**Story 3.4 Complete When:**
- 5 admin panel UI tests pass (CRUD operations)
- Admin panel visually consistent with app theme
- Password protection or hidden route implemented

**Story 3.5 Complete When:**
- 4 custom message integration tests pass
- Export/import JSON workflow verified end-to-end
- Custom messages appear in rotation next day

**Story 3.6 Complete When (if implemented):**
- AI suggestion generation succeeds (OpenAI API integration)
- Accept/reject workflow saves/discards suggestions correctly
- Rate limiting prevents excessive API calls (cost control)

### Regression Testing

**Epic 1-2 Tests Must Still Pass:**
- All 37 Epic 1 tests (message display, favorites, settings, persistence)
- All Epic 2 infrastructure tests (Playwright setup, PWA helpers)
- Target: 0 regressions introduced by Epic 3 changes
- If regression detected: fix before marking story complete

### Performance Testing

**Bundle Size Validation:**
- Pre-Epic 3: ~125KB gzipped (Epic 1-2 baseline)
- Post-Epic 3: < 200KB gzipped (75KB budget)
- Measure: `npm run build && du -h dist/assets/*.js`

**Animation Performance:**
- Swipe gesture frame rate: 60fps sustained (Chrome DevTools Performance)
- Message transition: no dropped frames during 300ms animation
- Measure: Playwright performance traces during swipe tests

**Lighthouse Score:**
- Pre-Epic 3: > 90 Performance score
- Post-Epic 3: Maintain > 90 (no regression)
- Measure: Lighthouse CI in GitHub Actions (optional enhancement)
