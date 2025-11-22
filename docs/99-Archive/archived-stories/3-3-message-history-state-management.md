# Story 3.3: Message History State Management

**Epic:** 3 - Enhanced Message Experience
**Story ID:** 3.3
**Status:** ready-for-dev
**Assignee:** Dev (Frank)
**Created:** 2025-11-03
**Sprint:** Epic 3 Implementation

---

## User Story

**As a** developer
**I want** to track message history in the Zustand store with deterministic daily rotation
**So that** swipe navigation knows which messages have been shown and can prevent future browsing

---

## Story Context

### Epic Goal

Expand the message library to 365 unique messages, implement intuitive swipe navigation for browsing message history, and create an admin interface for custom message management.

### Story Purpose

Story 3.3 implements the critical state management foundation that enables Story 3.2's swipe navigation to function correctly. Without this story, the swipe gestures would work visually, but the app wouldn't know which messages to display for each date, wouldn't prevent future message viewing, and wouldn't maintain a consistent "one message per day" experience.

This story establishes the message rotation algorithm that deterministically selects today's message based on the date seed, tracks which messages have been shown on which dates in a persistent history, and provides the state management primitives that Story 3.2's navigation handlers depend on (canNavigateBack, canNavigateForward, navigateToPreviousMessage, navigateToNextMessage).

### Position in Epic

- ✅ **Story 3.1** (Complete): 365-message library created - provides the message pool
- ✅ **Story 3.2** (Review): Swipe gesture UI implemented - provides the interaction layer
- 🔄 **Story 3.3** (Current): State management for history tracking - connects UI to data
- ⏳ **Story 3.4** (Pending): Admin interface UI for custom messages
- ⏳ **Story 3.5** (Pending): Custom message persistence and integration
- ⏳ **Story 3.6** (Optional): AI message suggestion review interface

### Dependencies

**Requires:**

- ✅ Story 3.1 complete: 365 messages in defaultMessages.ts
- ✅ Story 3.2 complete: Swipe gesture handlers and navigation UI
- ✅ Epic 1 complete: Zustand store with persist middleware working
- ✅ Epic 1 complete: Message rotation algorithm foundation (updateCurrentMessage action)

**Enables:**

- Story 3.4: Admin interface can query message history for analytics
- Story 3.5: Custom messages integrate into same rotation algorithm
- All future features relying on deterministic daily message display

### Integration Points

**Story 3.2 Integration:**

- Story 3.2 implemented UI components: `useSwipeGesture` hook, drag handlers, keyboard listeners
- Story 3.2 expects state actions: `navigateToPreviousMessage()`, `navigateToNextMessage()`
- Story 3.2 expects state getters: `canNavigateBack()`, `canNavigateForward()`
- Story 3.3 implements these actions and connects them to message rotation logic

**Architecture Integration:**

- Extends existing Zustand store (`useAppStore`) with new `messageHistory` slice
- Leverages existing `persist` middleware to save history to LocalStorage
- Enhances existing `updateCurrentMessage` action to use deterministic algorithm
- Maintains existing patterns: actions are async, updates are optimistic, errors are handled gracefully

---

## Acceptance Criteria

### AC-3.3.1: Message History State Tracking

**Given** the Zustand store is initialized
**When** the app loads or user navigates messages
**Then** the store SHALL track:

- `currentIndex: number` - Current position in history (0 = today, 1 = yesterday, etc.)
- `shownMessages: Map<string, number>` - Date (YYYY-MM-DD) → Message ID mapping
- `maxHistoryDays: number` - Limit backward navigation (default: 30 days)

**Validation:**

- Inspect `useAppStore.getState().messageHistory` in React DevTools
- Verify `shownMessages` Map persists in LocalStorage under `my-love-storage` key
- Test: Navigate to yesterday → verify currentIndex increments to 1
- Test: Return to today → verify currentIndex resets to 0

---

### AC-3.3.2: History Persistence Across Sessions

**Given** user has navigated through message history
**When** the browser is closed and reopened
**Then** the message history SHALL persist via LocalStorage using Zustand persist middleware

**Validation:**

- Navigate to 3 days back → close browser → reopen
- Verify: `shownMessages` Map contains all 3 historical entries
- Verify: Can still swipe back to those exact same messages
- Test: Use Chrome DevTools → Application → LocalStorage → inspect `my-love-storage`

---

### AC-3.3.3: Deterministic Daily Message Algorithm

**Given** the message pool (365 default + custom messages)
**When** the app loads on the same date multiple times
**Then** the algorithm SHALL always return the same message for that date (deterministic rotation)

**Implementation Requirements:**

- Use date-based seed: `YYYY-MM-DD` string converted to numeric hash
- Hash function: Simple modulo operation against message pool length
- Formula: `messageIndex = hash(dateString) % messagePool.length`
- Cache result in `shownMessages` Map to ensure consistency

**Validation:**

- Open app on 2025-11-03 → note message ID (e.g., ID 42)
- Close and reopen app 5 times on same date
- Verify: Message ID 42 shows every time (no variation)
- Test: Manually advance system date to 2025-11-04
- Verify: Different message appears (deterministic but date-dependent)

---

### AC-3.3.4: Future Date Prevention

**Given** user is viewing today's message
**When** user attempts to navigate forward (swipe right or arrow right)
**Then** the system SHALL prevent loading messages from future dates

**Implementation:**

- `canNavigateForward()` returns `false` when `currentIndex === 0` (today)
- Story 3.2's drag constraints block right swipe when `canNavigateForward() === false`
- No message lookup logic executes for dates beyond today

**Validation:**

- Navigate to today's message → verify right swipe disabled
- Navigate to yesterday → verify right swipe enabled (can return to today)
- Test: Keyboard arrow right → verify no effect when on today
- Test: Programmatically set `currentIndex = -1` → verify app corrects to 0

---

### AC-3.3.5: First-Time User Edge Case

**Given** user opens app for the first time
**When** the app initializes
**Then** the message history SHALL start with today only (no historical entries)

**Expected Initial State:**

```typescript
{
  currentIndex: 0,
  shownMessages: new Map([
    ['2025-11-03', 42]  // Today's date → message ID
  ]),
  maxHistoryDays: 30
}
```

**Validation:**

- Clear LocalStorage and IndexedDB (simulating first-time user)
- Open app → verify only today's message available
- Attempt to swipe left → verify `canNavigateBack() === false` (no history yet)
- Close and reopen → verify today's message ID persists

---

### AC-3.3.6: Skipped Days Edge Case

**Given** user last opened app 3 days ago
**When** user opens app today and swipes back
**Then** the system SHALL show messages for all skipped days (fill in missed messages)

**Expected Behavior:**

- User last visit: 2025-10-31 (message ID 38)
- Today: 2025-11-03
- Swipe left from 2025-11-03 → show 2025-11-02 (calculate message for that date)
- Swipe left again → show 2025-11-01 (calculate message for that date)
- Swipe left again → show 2025-10-31 (load cached message ID 38)

**Implementation:**

- Check `shownMessages` Map for target date
- If entry exists → load that message ID
- If entry missing → run rotation algorithm for that date, add to Map

**Validation:**

- Set `shownMessages` to only have entry for 2025-10-31
- Swipe left → verify 2025-11-02 message calculated and displayed
- Verify: `shownMessages` Map now contains 2025-11-02 entry
- Swipe back to 2025-10-31 → verify shows same message ID 38 (cached)

---

## Technical Approach

### 1. Zustand Store Enhancement

**New State Slice: `messageHistory`**

Location: `src/stores/useAppStore.ts`

```typescript
interface MessageHistory {
  currentIndex: number; // 0 = today, 1 = yesterday, 2 = 2 days ago
  shownMessages: Map<string, number>; // Date string → Message ID
  maxHistoryDays: number; // Limit backward navigation (default: 30)
}

interface AppState {
  // Existing state...
  settings: Settings | null;
  isOnboarded: boolean;
  messages: Message[];
  currentMessage: Message | null;

  // NEW: Message history tracking
  messageHistory: MessageHistory;

  // Existing + NEW actions...
  initializeApp: () => Promise<void>;
  updateCurrentMessage: () => void;

  // NEW: Navigation actions
  navigateToPreviousMessage: () => void;
  navigateToNextMessage: () => void;
  navigateToDate: (date: Date) => void;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;
  getMessageForDate: (date: Date) => Message;
}
```

**Persistence Configuration:**

```typescript
persist(
  (set, get) => ({
    // State and actions...
  }),
  {
    name: 'my-love-storage',
    partialize: (state) => ({
      settings: state.settings,
      isOnboarded: state.isOnboarded,
      messageHistory: {
        ...state.messageHistory,
        // Convert Map to array for JSON serialization
        shownMessages: Array.from(state.messageHistory.shownMessages.entries()),
      },
    }),
    // Custom merge strategy to reconstruct Map from array
    merge: (persistedState, currentState) => ({
      ...currentState,
      ...persistedState,
      messageHistory: {
        ...persistedState.messageHistory,
        shownMessages: new Map(persistedState.messageHistory.shownMessages),
      },
    }),
  }
);
```

### 2. Message Rotation Algorithm

**Purpose:** Deterministic message selection based on date seed

**Algorithm Specification:**

```typescript
// src/utils/messageRotation.ts

export function getDailyMessage(allMessages: Message[], date: Date = new Date()): Message {
  // Generate deterministic hash from date
  const dateString = formatDate(date); // "YYYY-MM-DD"
  const hash = hashDateString(dateString);

  // Calculate message index using modulo
  const messageIndex = hash % allMessages.length;

  // Return message at calculated index
  return allMessages[messageIndex];
}

function hashDateString(dateString: string): number {
  // Simple hash: sum of character codes
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = (hash << 5) - hash + dateString.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMessageForDate(allMessages: Message[], targetDate: Date): Message {
  // Same algorithm, but accepts any date
  return getDailyMessage(allMessages, targetDate);
}

export function getAvailableHistoryDays(
  messageHistory: MessageHistory,
  settings: Settings
): number {
  // Calculate how many days back user can navigate
  const relationshipStartDate = new Date(settings.relationshipStartDate);
  const today = new Date();
  const daysSinceStart = Math.floor(
    (today.getTime() - relationshipStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Return minimum of: configured max, days since start, or 30 default
  return Math.min(messageHistory.maxHistoryDays || 30, daysSinceStart, 30);
}
```

### 3. Navigation Actions Implementation

**Action: `navigateToPreviousMessage()`**

```typescript
navigateToPreviousMessage: () => {
  const { messageHistory, messages, settings } = get();

  // Check if can navigate back
  if (!get().canNavigateBack()) {
    console.warn('[MessageHistory] Cannot navigate back - at history limit');
    return;
  }

  // Increment index (0 → 1 = today → yesterday)
  const newIndex = messageHistory.currentIndex + 1;

  // Calculate target date
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() - newIndex);
  const dateString = formatDate(targetDate);

  // Check if message for this date is cached
  let messageId = messageHistory.shownMessages.get(dateString);

  // If not cached, calculate and cache it
  if (!messageId) {
    const message = getDailyMessage(messages, targetDate);
    messageId = message.id;

    // Update cache
    const updatedShownMessages = new Map(messageHistory.shownMessages);
    updatedShownMessages.set(dateString, messageId);

    set({
      messageHistory: {
        ...messageHistory,
        currentIndex: newIndex,
        shownMessages: updatedShownMessages
      }
    });
  } else {
    // Just update index, message already cached
    set({
      messageHistory: {
        ...messageHistory,
        currentIndex: newIndex
      }
    });
  }

  // Update currentMessage to trigger UI re-render
  const targetMessage = messages.find(m => m.id === messageId);
  if (targetMessage) {
    set({ currentMessage: targetMessage });
  }

  console.log(`[MessageHistory] Navigated to ${dateString}, message ID: ${messageId}`);
},
```

**Action: `navigateToNextMessage()`**

```typescript
navigateToNextMessage: () => {
  const { messageHistory, messages } = get();

  // Check if can navigate forward
  if (!get().canNavigateForward()) {
    console.warn('[MessageHistory] Cannot navigate forward - already at today');
    return;
  }

  // Decrement index (1 → 0 = yesterday → today)
  const newIndex = messageHistory.currentIndex - 1;

  // Calculate target date
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() - newIndex);
  const dateString = formatDate(targetDate);

  // Load message for target date (should be cached)
  const messageId = messageHistory.shownMessages.get(dateString);
  const targetMessage = messages.find(m => m.id === messageId);

  // Update state
  set({
    messageHistory: {
      ...messageHistory,
      currentIndex: newIndex
    },
    currentMessage: targetMessage || null
  });

  console.log(`[MessageHistory] Navigated to ${dateString}, message ID: ${messageId}`);
},
```

**Getter: `canNavigateBack()`**

```typescript
canNavigateBack: () => {
  const { messageHistory, settings } = get();
  const availableDays = getAvailableHistoryDays(messageHistory, settings);
  return messageHistory.currentIndex < availableDays;
},
```

**Getter: `canNavigateForward()`**

```typescript
canNavigateForward: () => {
  const { messageHistory } = get();
  // Can navigate forward if not at today (currentIndex > 0)
  return messageHistory.currentIndex > 0;
},
```

### 4. Enhanced `updateCurrentMessage()` Action

**Purpose:** Initialize today's message on app load or date change

```typescript
updateCurrentMessage: () => {
  const { messages, messageHistory } = get();

  if (messages.length === 0) {
    console.warn('[MessageHistory] No messages loaded yet');
    return;
  }

  // Get today's date
  const today = new Date();
  const dateString = formatDate(today);

  // Check if today's message is already cached
  let messageId = messageHistory.shownMessages.get(dateString);

  if (!messageId) {
    // Calculate today's message using rotation algorithm
    const todayMessage = getDailyMessage(messages, today);
    messageId = todayMessage.id;

    // Cache it
    const updatedShownMessages = new Map(messageHistory.shownMessages);
    updatedShownMessages.set(dateString, messageId);

    set({
      messageHistory: {
        ...messageHistory,
        shownMessages: updatedShownMessages,
        currentIndex: 0 // Reset to today
      }
    });

    console.log(`[MessageRotation] New day! Today's message ID: ${messageId}`);
  }

  // Load the message object
  const currentMessage = messages.find(m => m.id === messageId);
  set({ currentMessage });
},
```

### 5. DailyMessage Component Integration

**Location:** `src/components/DailyMessage/DailyMessage.tsx`

**Changes Required:**

```typescript
// Import navigation actions from store
const {
  currentMessage,
  navigateToPreviousMessage,
  navigateToNextMessage,
  canNavigateBack,
  canNavigateForward
} = useAppStore();

// Pass to useSwipeGesture hook (from Story 3.2)
const swipeGesture = useSwipeGesture(
  navigateToPreviousMessage,  // onSwipeLeft callback
  navigateToNextMessage,       // onSwipeRight callback
  canNavigateBack(),           // enable left swipe
  canNavigateForward()         // enable right swipe
);

// Apply drag props to message card
<motion.div
  {...swipeGesture.dragProps}
  className="message-card"
>
  {/* Message content */}
</motion.div>
```

### 6. Data Flow Diagram

```
App Load
    ↓
initializeApp()
    ↓
loadMessages() → IndexedDB → 365 messages in memory
    ↓
updateCurrentMessage()
    ↓
Check messageHistory.shownMessages for today's date
    ├─ Found → Load cached message ID
    └─ Not found → Run getDailyMessage() → Cache result
    ↓
Set currentMessage → DailyMessage renders
    ↓
User swipes left
    ↓
useSwipeGesture.onDragEnd() → navigateToPreviousMessage()
    ↓
Increment currentIndex (0 → 1)
Calculate target date (today - 1 day)
Check cache for that date
    ├─ Found → Load cached message
    └─ Not found → Calculate message → Cache it
    ↓
Update currentMessage → Framer Motion transition
    ↓
DailyMessage re-renders with new message
```

---

## Testing Strategy

### Unit Tests

**File:** `src/stores/useAppStore.test.ts`

**Test Cases:**

1. **MessageHistory Initialization**
   - Given: Fresh store
   - Verify: `currentIndex = 0`, `shownMessages = new Map()`, `maxHistoryDays = 30`

2. **Deterministic Message Selection**
   - Given: 365 messages, date = "2025-11-03"
   - When: Call `getDailyMessage()` 10 times
   - Verify: Returns same message ID every time

3. **Navigate Back Action**
   - Given: `currentIndex = 0` (today)
   - When: Call `navigateToPreviousMessage()`
   - Verify: `currentIndex = 1`, `shownMessages` contains yesterday's entry

4. **Navigate Forward Action**
   - Given: `currentIndex = 1` (yesterday)
   - When: Call `navigateToNextMessage()`
   - Verify: `currentIndex = 0`, `currentMessage` is today's message

5. **Boundary: Cannot Navigate Forward from Today**
   - Given: `currentIndex = 0`
   - When: Call `canNavigateForward()`
   - Verify: Returns `false`

6. **Boundary: Cannot Navigate Back Beyond Limit**
   - Given: `currentIndex = 30` (at maxHistoryDays)
   - When: Call `canNavigateBack()`
   - Verify: Returns `false`

**File:** `src/utils/messageRotation.test.ts`

**Test Cases:**

1. **Hash Function Consistency**
   - Given: Date string "2025-11-03"
   - When: Hash 100 times
   - Verify: Returns same numeric hash every time

2. **Date Format Validation**
   - Given: `Date` object for Nov 3, 2025
   - When: Call `formatDate()`
   - Verify: Returns "2025-11-03" (correct padding)

3. **Message Pool Edge Case: Single Message**
   - Given: Message pool with 1 message
   - When: Calculate message for any date
   - Verify: Always returns that one message (modulo 1 = 0)

4. **Message Pool Edge Case: Empty Pool**
   - Given: Empty message array
   - When: Call `getDailyMessage()`
   - Verify: Throws error or returns null gracefully

### Integration Tests

**File:** `tests/e2e/message-history.spec.ts`

**Test Cases:**

1. **AC-3.3.2: Persistence Across Sessions**

   ```typescript
   test('message history persists across browser sessions', async ({ page }) => {
     await page.goto('/');

     // Navigate to 3 days back
     await page.keyboard.press('ArrowLeft'); // Day -1
     await page.keyboard.press('ArrowLeft'); // Day -2
     await page.keyboard.press('ArrowLeft'); // Day -3

     const message3DaysAgo = await page.textContent('[data-testid="message-text"]');

     // Close and reopen browser
     await page.context().close();
     const newContext = await browser.newContext();
     const newPage = await newContext.newPage();
     await newPage.goto('/');

     // Navigate back to 3 days ago
     await newPage.keyboard.press('ArrowLeft');
     await newPage.keyboard.press('ArrowLeft');
     await newPage.keyboard.press('ArrowLeft');

     const messageAfterReopen = await newPage.textContent('[data-testid="message-text"]');

     // Verify: Same message shown (history persisted)
     expect(messageAfterReopen).toBe(message3DaysAgo);
   });
   ```

2. **AC-3.3.3: Deterministic Daily Message**

   ```typescript
   test('same message shown all day regardless of reopens', async ({ page }) => {
     await page.goto('/');

     const firstMessage = await page.textContent('[data-testid="message-text"]');

     // Reload 5 times
     for (let i = 0; i < 5; i++) {
       await page.reload();
       const reloadedMessage = await page.textContent('[data-testid="message-text"]');
       expect(reloadedMessage).toBe(firstMessage);
     }
   });
   ```

3. **AC-3.3.4: Future Date Prevention**

   ```typescript
   test('cannot navigate beyond today', async ({ page }) => {
     await page.goto('/');

     const todayMessage = await page.textContent('[data-testid="message-text"]');

     // Try to navigate forward (should fail silently)
     await page.keyboard.press('ArrowRight');

     const messageAfterAttempt = await page.textContent('[data-testid="message-text"]');

     // Verify: Still showing today's message
     expect(messageAfterAttempt).toBe(todayMessage);
   });
   ```

4. **AC-3.3.5: First-Time User**

   ```typescript
   test('first-time user starts with today only', async ({ page }) => {
     // Clear all storage (simulate first visit)
     await page.context().clearCookies();
     await page.evaluate(() => {
       localStorage.clear();
       indexedDB.deleteDatabase('my-love-db');
     });

     await page.goto('/');

     // Verify: Cannot navigate back (no history)
     const leftArrowDisabled = await page.evaluate(() => {
       const store = (window as any).__APP_STORE__;
       return !store.getState().canNavigateBack();
     });

     expect(leftArrowDisabled).toBe(true);
   });
   ```

5. **AC-3.3.6: Skipped Days**

   ```typescript
   test('fills in missed messages for skipped days', async ({ page }) => {
     await page.goto('/');

     // Simulate: Last visit was 3 days ago
     await page.evaluate(() => {
       const store = (window as any).__APP_STORE__;
       const threeDaysAgo = new Date();
       threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
       const dateString = threeDaysAgo.toISOString().split('T')[0];

       // Set history to only have 3 days ago
       store.setState({
         messageHistory: {
           currentIndex: 0,
           shownMessages: new Map([[dateString, 38]]),
           maxHistoryDays: 30,
         },
       });
     });

     // Navigate back through skipped days
     await page.keyboard.press('ArrowLeft'); // Yesterday (should calculate)
     const yesterdayMessage = await page.textContent('[data-testid="message-text"]');

     await page.keyboard.press('ArrowLeft'); // 2 days ago (should calculate)
     const twoDaysAgoMessage = await page.textContent('[data-testid="message-text"]');

     await page.keyboard.press('ArrowLeft'); // 3 days ago (should load cached ID 38)
     const threeDaysAgoMessageId = await page.evaluate(() => {
       const store = (window as any).__APP_STORE__;
       return store.getState().currentMessage?.id;
     });

     // Verify: 3 days ago shows cached message ID 38
     expect(threeDaysAgoMessageId).toBe(38);

     // Verify: All intermediate days have entries in shownMessages
     const historySize = await page.evaluate(() => {
       const store = (window as any).__APP_STORE__;
       return store.getState().messageHistory.shownMessages.size;
     });

     expect(historySize).toBeGreaterThanOrEqual(4); // Today + yesterday + 2 days ago + 3 days ago
   });
   ```

### Manual Testing Checklist

- [ ] Open app → verify today's message displays
- [ ] Close and reopen 3 times → verify same message
- [ ] Swipe left 5 times → verify 5 different past messages
- [ ] Swipe right back to today → verify returns to today's message
- [ ] Try to swipe right from today → verify bounce indicator (no further navigation)
- [ ] Open DevTools → Application → LocalStorage → verify `messageHistory.shownMessages` populated
- [ ] Change system date to tomorrow → reload app → verify different message appears
- [ ] Clear LocalStorage → reload → verify starts with today only (no back navigation)
- [ ] Inspect Zustand DevTools → verify `currentIndex` updates during navigation

---

## Implementation Plan

### Phase 1: Message Rotation Algorithm (2 hours)

**Tasks:**

1. Create `src/utils/messageRotation.ts` with:
   - `getDailyMessage(messages, date)` function
   - `hashDateString(dateString)` function
   - `formatDate(date)` function
   - `getMessageForDate(messages, targetDate)` function
   - `getAvailableHistoryDays(messageHistory, settings)` function

2. Write unit tests in `src/utils/messageRotation.test.ts`:
   - Test deterministic hash function
   - Test date formatting
   - Test message selection with various pool sizes
   - Test edge cases (empty pool, single message)

3. Validate:
   - All unit tests pass
   - Hash function returns consistent results
   - Date formatting handles padding correctly

**Completion Criteria:**

- ✅ All functions implemented with TypeScript types
- ✅ Unit tests pass (100% coverage)
- ✅ Algorithm validated with manual testing (same date → same message)

---

### Phase 2: Zustand Store Enhancement (3 hours)

**Tasks:**

1. Update `src/stores/useAppStore.ts`:
   - Add `messageHistory: MessageHistory` state slice
   - Implement `navigateToPreviousMessage()` action
   - Implement `navigateToNextMessage()` action
   - Implement `navigateToDate(date)` action (future use)
   - Implement `canNavigateBack()` getter
   - Implement `canNavigateForward()` getter
   - Implement `getMessageForDate(date)` getter

2. Update persist middleware configuration:
   - Add `messageHistory` to partialize function
   - Implement Map → Array serialization
   - Implement Array → Map deserialization in merge strategy

3. Enhance `updateCurrentMessage()` action:
   - Check `shownMessages` cache for today
   - Call `getDailyMessage()` if not cached
   - Update cache with today's message ID
   - Set `currentMessage` from loaded message

4. Add console logging for debugging:
   - Log message rotation decisions
   - Log navigation actions (previous, next)
   - Log cache hits vs. misses

**Completion Criteria:**

- ✅ Store compiles without TypeScript errors
- ✅ Persist middleware serializes Map correctly
- ✅ Navigation actions update state correctly
- ✅ Console logs show rotation decisions in dev mode

---

### Phase 3: DailyMessage Component Integration (1 hour)

**Tasks:**

1. Update `src/components/DailyMessage/DailyMessage.tsx`:
   - Import navigation actions from `useAppStore`
   - Pass navigation callbacks to `useSwipeGesture` hook (Story 3.2)
   - Verify `canNavigateBack()` and `canNavigateForward()` control drag constraints

2. Test integration with Story 3.2:
   - Swipe left triggers `navigateToPreviousMessage()`
   - Swipe right triggers `navigateToNextMessage()`
   - Keyboard navigation calls correct actions
   - Drag constraints respect navigation boundaries

**Completion Criteria:**

- ✅ Component compiles without errors
- ✅ Swipe gestures trigger correct store actions
- ✅ UI updates smoothly during navigation
- ✅ No console errors during navigation

---

### Phase 4: Integration Testing (2 hours)

**Tasks:**

1. Create `tests/e2e/message-history.spec.ts` with 5 test cases:
   - Persistence across sessions (AC-3.3.2)
   - Deterministic message (AC-3.3.3)
   - Future date prevention (AC-3.3.4)
   - First-time user (AC-3.3.5)
   - Skipped days (AC-3.3.6)

2. Run all tests in all browsers:
   - `npm run test:e2e`
   - Verify pass rate: 100%

3. Manual testing against checklist:
   - Complete all manual test scenarios
   - Document any edge cases discovered

**Completion Criteria:**

- ✅ All 5 E2E tests pass consistently (no flakiness)
- ✅ Tests pass in Chromium, Firefox, WebKit
- ✅ Manual testing checklist 100% complete
- ✅ No regressions in Epic 1-2 tests

---

### Phase 5: Documentation & Handoff (1 hour)

**Tasks:**

1. Update architecture documentation:
   - Add `messageHistory` state slice to architecture.md
   - Document message rotation algorithm in tech-spec-epic-3.md
   - Add data flow diagram to this story document

2. Update sprint-status.yaml:
   - Mark Story 3.3 as "review" when complete
   - Add completion timestamp
   - Document any deviations from plan

3. Create learnings summary:
   - Document algorithm performance
   - Note any edge cases discovered
   - Recommendations for Story 3.4

**Completion Criteria:**

- ✅ All documentation updated
- ✅ Sprint status reflects completion
- ✅ Learnings documented for next story

---

**Total Estimated Effort:** 9 hours

---

## Key Decisions

### Decision 1: Hash Algorithm Simplicity

**Context:** Need deterministic message selection based on date
**Options:**

1. Complex cryptographic hash (SHA-256)
2. Simple string character code sum
3. Built-in JavaScript `hashCode()` (doesn't exist)

**Decision:** Option 2 - Simple character code sum
**Rationale:**

- Sufficient for our use case (message selection, not security)
- Fast computation (no crypto library needed)
- Deterministic across browsers (no platform-specific behavior)
- Easy to debug and understand

**Trade-offs:**

- Less random distribution than cryptographic hash
- Acceptable for 365-message pool (collisions unlikely)

---

### Decision 2: Map Serialization Strategy

**Context:** Zustand persist middleware doesn't serialize Map natively
**Options:**

1. Convert Map to Object (`Object.fromEntries()`)
2. Convert Map to Array (`Array.from()`)
3. Use custom serialization library

**Decision:** Option 2 - Array serialization
**Rationale:**

- Simple and reliable
- No loss of key type information (string keys)
- Easy to reconstruct Map on deserialization
- No external dependencies

**Implementation:**

```typescript
// Serialize: Map → Array
partialize: (state) => ({
  messageHistory: {
    ...state.messageHistory,
    shownMessages: Array.from(state.messageHistory.shownMessages.entries()),
  },
});

// Deserialize: Array → Map
merge: (persisted, current) => ({
  ...current,
  ...persisted,
  messageHistory: {
    ...persisted.messageHistory,
    shownMessages: new Map(persisted.messageHistory.shownMessages),
  },
});
```

---

### Decision 3: History Limit (maxHistoryDays)

**Context:** Need to limit backward navigation to prevent excessive history
**Options:**

1. No limit (navigate to relationship start date)
2. Fixed 30-day limit
3. Configurable limit based on relationship duration

**Decision:** Option 3 - Configurable with 30-day default
**Rationale:**

- Flexible: Can increase limit in settings for long-term relationships
- Performance: Limits LocalStorage size (30 days = ~1KB)
- User experience: Most users won't navigate beyond 30 days
- Relationship context: Honors relationship start date (can't go before that)

**Implementation:**

```typescript
const availableDays = Math.min(
  messageHistory.maxHistoryDays || 30, // Configured or default
  daysSinceRelationshipStart, // Can't go before start
  30 // Hard cap
);
```

---

## Risks & Mitigations

### Risk 1: LocalStorage Quota Exceeded

**Severity:** LOW
**Probability:** LOW
**Impact:** Message history not saved, user loses navigation state

**Scenario:**

- User navigates through 365 days of history
- `shownMessages` Map grows to ~10KB (365 entries × ~30 bytes each)
- Other persisted state (settings, moods) + messageHistory exceeds 5MB quota

**Mitigation:**

1. Implement LRU eviction: Keep only most recent 90 days in `shownMessages`
2. Add quota exceeded error handling: Show user-friendly message
3. Monitor LocalStorage size in dev console
4. Compress date strings (store as timestamps instead of "YYYY-MM-DD")

**Implementation:**

```typescript
// LRU eviction (if needed in future)
if (shownMessages.size > 90) {
  const oldestDate = Array.from(shownMessages.keys()).sort()[0];
  shownMessages.delete(oldestDate);
}
```

---

### Risk 2: Date Calculation Edge Cases

**Severity:** MEDIUM
**Probability:** MEDIUM
**Impact:** Wrong message shown for edge cases (timezone changes, DST, leap years)

**Scenarios:**

- User travels across timezones → Date string changes mid-day
- Daylight Saving Time boundary → Date calculation off by 1 hour
- Leap year (Feb 29) → Date formatting edge case

**Mitigation:**

1. Use UTC for all date calculations (ignore local timezone)
2. Test specifically on Feb 29, 2024 (leap year)
3. Test during DST transitions (spring forward, fall back)
4. Add explicit timezone handling in `formatDate()`

**Implementation:**

```typescript
function formatDate(date: Date): string {
  // Use UTC to avoid timezone issues
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

---

### Risk 3: Race Condition on Rapid Navigation

**Severity:** LOW
**Probability:** LOW
**Impact:** UI shows wrong message briefly, then corrects

**Scenario:**

- User rapidly swipes left multiple times
- Multiple `navigateToPreviousMessage()` calls in flight
- State updates out of order → wrong message displayed

**Mitigation:**

1. Debounce navigation actions (150ms cooldown)
2. Disable navigation during animation (Story 3.2 handles this)
3. Add `isNavigating` flag to prevent concurrent navigations
4. Test rapid navigation in E2E tests

**Implementation:**

```typescript
// In useSwipeGesture hook (Story 3.2)
const [isNavigating, setIsNavigating] = useState(false);

const handleSwipeLeft = async () => {
  if (isNavigating) return; // Prevent concurrent navigation

  setIsNavigating(true);
  await navigateToPreviousMessage();

  // Wait for animation to complete
  setTimeout(() => setIsNavigating(false), 300); // Animation duration
};
```

---

## Success Metrics

### Functional Metrics

- ✅ **100% of AC tests pass** - All 6 acceptance criteria validated
- ✅ **0 regressions** - Epic 1-2 tests still pass after Story 3.3 integration
- ✅ **Deterministic rotation** - Same date always returns same message ID (tested 100 times)

### Performance Metrics

- ⚡ **< 10ms navigation latency** - Time from swipe gesture to state update
- ⚡ **< 50ms message lookup** - Time to calculate or retrieve message from cache
- ⚡ **< 1KB LocalStorage growth per day** - Efficient history tracking (30 days = ~1KB)

### Quality Metrics

- 🎯 **100% unit test coverage** - Message rotation algorithm fully tested
- 🎯 **100% E2E test coverage** - All AC scenarios automated
- 🎯 **0 console errors** - Clean runtime logs in dev and production

### User Experience Metrics

- 😊 **Smooth navigation** - No jank or dropped frames during message transitions
- 😊 **Consistent experience** - Same message shown all day, regardless of reopens
- 😊 **Intuitive boundaries** - Cannot navigate to future (visual feedback from Story 3.2)

---

## Definition of Done

**Code Complete:**

- [ ] All TypeScript files compile without errors
- [ ] ESLint warnings: 0
- [ ] All unit tests pass (messageRotation.test.ts)
- [ ] All integration tests pass (message-history.spec.ts)
- [ ] No console errors or warnings in browser

**Functional Complete:**

- [ ] AC-3.3.1: Message history state tracking implemented
- [ ] AC-3.3.2: History persists across browser sessions
- [ ] AC-3.3.3: Deterministic daily message algorithm works
- [ ] AC-3.3.4: Future date navigation prevented
- [ ] AC-3.3.5: First-time user edge case handled
- [ ] AC-3.3.6: Skipped days edge case handled

**Integration Complete:**

- [ ] Story 3.2 swipe gestures trigger correct navigation actions
- [ ] Story 3.2 drag constraints respect `canNavigateBack()` and `canNavigateForward()`
- [ ] Keyboard navigation works (arrow keys call navigation actions)
- [ ] No regressions in Epic 1-2 features (all previous tests pass)

**Documentation Complete:**

- [ ] Architecture.md updated with `messageHistory` slice
- [ ] Tech-spec-epic-3.md updated with algorithm details
- [ ] Sprint-status.yaml updated to "review" status
- [ ] Learnings summary documented for Story 3.4

**Quality Assurance Complete:**

- [ ] Manual testing checklist 100% complete
- [ ] All 5 E2E tests pass in all browsers (Chromium, Firefox, WebKit)
- [ ] Performance validated: navigation < 10ms, lookup < 50ms
- [ ] LocalStorage size validated: < 1KB per 30 days of history

---

## Learnings from Previous Story

### From Story 3.2 (Swipe Navigation UI)

**Key Integration Points:**

- Story 3.2 created `useSwipeGesture` hook that expects 4 parameters:
  - `onSwipeLeft: () => void` → Story 3.3 provides `navigateToPreviousMessage`
  - `onSwipeRight: () => void` → Story 3.3 provides `navigateToNextMessage`
  - `canSwipeLeft: boolean` → Story 3.3 provides `canNavigateBack()`
  - `canSwipeRight: boolean` → Story 3.3 provides `canNavigateForward()`

**Testing Approach Validated:**

- E2E tests using Playwright keyboard navigation (`page.keyboard.press('ArrowLeft')`) are reliable
- Visual animation testing should be manual (automated tests confirm state, not visual smoothness)
- Browser refresh tests validate persistence correctly

**Architecture Patterns to Follow:**

- Console logging for navigation decisions (matches Story 3.2 pattern)
- Zustand store actions should be synchronous (state updates), not async (unless I/O)
- Error handling: fail gracefully, log warnings, don't throw exceptions

**Performance Considerations:**

- Story 3.2 animation duration: 300ms → Story 3.3 navigation must complete within this window
- Framer Motion GPU acceleration → ensure state updates don't block rendering
- Debounce rapid navigation to prevent race conditions

**Edge Cases Discovered in Story 3.2:**

- Safari iOS swipe conflicts: Story 3.2 resolved with `preventDefault()` on touch events
- Trackpad momentum scrolling: Story 3.2 added drag threshold to prevent accidental navigation
- Keyboard focus management: Story 3.2 ensured arrow keys work only when message card focused

**Recommendations for Story 3.3:**

1. Reuse Story 3.2's debounce pattern for navigation actions
2. Add console logs matching Story 3.2's format for consistency
3. Test on same devices as Story 3.2 (Safari iOS, Chrome desktop, Firefox)
4. Validate that state updates don't interfere with Story 3.2's animations

---

## Notes

**Context from Tech Spec:**

- Message rotation algorithm is foundational for entire Epic 3
- Custom messages (Story 3.5) will integrate into same rotation pool
- Admin interface (Story 3.4) may display messageHistory stats

**Context from PRD:**

- FR007: One message per day (deterministic rotation)
- FR008: Backward navigation only (no future messages)
- FR009: Explicit prevention of forward navigation beyond today

**Architecture Alignment:**

- Extends existing Zustand store patterns (no architectural changes)
- Leverages existing persist middleware (just adds new state slice)
- Follows offline-first principle (no network required for navigation)

**Story Sequencing:**

- Story 3.1 (365 messages) provides the message pool → COMPLETE
- Story 3.2 (swipe UI) provides the interaction layer → COMPLETE
- Story 3.3 (this story) connects UI to data → CURRENT
- Story 3.4 (admin UI) will rely on this rotation algorithm → NEXT

---

## Open Questions

**Q1: Should maxHistoryDays be user-configurable?**

- Current: Hardcoded 30 days
- Alternative: Add to Settings page (Story 3.4+)
- Decision: Defer to Epic 4 (settings enhancement), keep 30 for now

**Q2: How to handle custom messages in rotation algorithm?**

- Current: Algorithm accepts `messages: Message[]` array (any source)
- Future (Story 3.5): Pass combined array `[...defaultMessages, ...customMessages]`
- Decision: No changes needed in Story 3.3, algorithm is message-source agnostic

**Q3: Should we log message rotation decisions in production?**

- Current: Console logs in dev mode only
- Alternative: Always log for debugging (girlfriend might see in DevTools)
- Decision: Dev mode only, use `if (import.meta.env.DEV) console.log(...)`

---

**Story Status:** Ready for Implementation
**Next Story:** 3.4 - Admin Interface UI (Custom Message Management)
