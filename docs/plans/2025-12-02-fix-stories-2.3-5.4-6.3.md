# Fix Stories 2.3, 5.4, 6.3 - Code Review Issues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical issues identified in code review for Stories 2.3 (Real-Time Messages), 5.4 (Mood History Timeline), and 6.3 (Photo Gallery Grid View)

**Architecture:** Three independent story fixes that can be executed in parallel. Within each story, fixes are sequential (foundation → components → tests → docs). All changes follow TDD approach with commits after each major fix.

**Tech Stack:** React, TypeScript, Zustand, Supabase Realtime (Broadcast API), react-window (VariableSizeList + InfiniteLoader), Vitest, Playwright

---

## STORY 2.3 FIXES - Real-Time Message Reception

### Task 2.3.1: Create useRealtimeMessages Hook with Broadcast API

**Files:**
- Create: `src/hooks/useRealtimeMessages.ts`
- Create: `src/hooks/__tests__/useRealtimeMessages.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/useRealtimeMessages.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeMessages } from '../useRealtimeMessages';

// Mock Supabase
vi.mock('../../api/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
      }),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock auth service
vi.mock('../../api/authService', () => ({
  authService: {
    getCurrentUserId: vi.fn().mockResolvedValue('user-123'),
  },
}));

describe('useRealtimeMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to broadcast channel on mount', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    renderHook(() => useRealtimeMessages());

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('love-notes:user-123');
    });
  });

  it('should listen for broadcast new_message events', async () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
      }),
    };

    const { supabase } = await import('../../api/supabaseClient');
    vi.mocked(supabase.channel).mockReturnValue(mockChannel as any);

    renderHook(() => useRealtimeMessages());

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'new_message' },
        expect.any(Function)
      );
    });
  });

  it('should unsubscribe on unmount', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    const { unmount } = renderHook(() => useRealtimeMessages());

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/hooks/__tests__/useRealtimeMessages.test.ts`
Expected: FAIL with "Cannot find module '../useRealtimeMessages'"

**Step 3: Write minimal implementation**

```typescript
// src/hooks/useRealtimeMessages.ts
/**
 * useRealtimeMessages Hook
 *
 * Handles real-time message reception via Supabase Broadcast API.
 * Story 2.3 - AC-2.3.1 through AC-2.3.5
 *
 * Uses Broadcast API instead of postgres_changes per commit 9a02e56 findings:
 * - postgres_changes doesn't work reliably for cross-user updates
 * - Broadcast API provides consistent cross-user messaging
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { supabase } from '../api/supabaseClient';
import { authService } from '../api/authService';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { LoveNote } from '../types/models';

export interface UseRealtimeMessagesOptions {
  onNewMessage?: (message: LoveNote) => void;
  enabled?: boolean;
}

export function useRealtimeMessages(options: UseRealtimeMessagesOptions = {}) {
  const { onNewMessage, enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const addNote = useAppStore((state) => state.addNote);

  const handleNewMessage = useCallback(
    (payload: { payload: { message: LoveNote } }) => {
      const { message } = payload.payload;

      if (import.meta.env.DEV) {
        console.log('[useRealtimeMessages] New message received:', message.id);
      }

      // Add to store (with deduplication check in addNote)
      addNote(message);

      // Trigger vibration feedback (AC-2.3.3)
      if (navigator.vibrate) {
        navigator.vibrate([30]);
      }

      // Call optional callback
      onNewMessage?.(message);
    },
    [addNote, onNewMessage]
  );

  useEffect(() => {
    if (!enabled) return;

    let subscriptionActive = true;

    const setupSubscription = async () => {
      try {
        const userId = await authService.getCurrentUserId();
        if (!userId) {
          if (import.meta.env.DEV) {
            console.log('[useRealtimeMessages] No user ID, skipping subscription');
          }
          return;
        }

        if (import.meta.env.DEV) {
          console.log('[useRealtimeMessages] Setting up Broadcast subscription for:', userId);
        }

        // Create user-specific channel for receiving messages
        const channel = supabase
          .channel(`love-notes:${userId}`)
          .on('broadcast', { event: 'new_message' }, (payload) => {
            if (!subscriptionActive) return;
            handleNewMessage(payload as { payload: { message: LoveNote } });
          })
          .subscribe((status, err) => {
            if (import.meta.env.DEV) {
              console.log('[useRealtimeMessages] Subscription status:', status, err || '');
            }

            // Handle subscription errors (AC-2.3.5)
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('[useRealtimeMessages] Subscription error:', err);
              // Attempt reconnection after delay
              setTimeout(() => {
                if (subscriptionActive && channelRef.current) {
                  channelRef.current.subscribe();
                }
              }, 5000);
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('[useRealtimeMessages] Error setting up subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      subscriptionActive = false;
      if (channelRef.current) {
        if (import.meta.env.DEV) {
          console.log('[useRealtimeMessages] Unsubscribing from channel');
        }
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, handleNewMessage]);

  return {
    isSubscribed: channelRef.current !== null,
  };
}

export default useRealtimeMessages;
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/hooks/__tests__/useRealtimeMessages.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useRealtimeMessages.ts src/hooks/__tests__/useRealtimeMessages.test.ts
git commit -m "feat(2.3): add useRealtimeMessages hook with Broadcast API

- Create dedicated hook for realtime message subscription
- Use Broadcast API instead of postgres_changes (per commit 9a02e56)
- Add subscription error handling with reconnection
- Add vibration feedback on new message
- Add unit tests for hook behavior

Story 2.3 Task 3.1"
```

---

### Task 2.3.2: Add Broadcast to sendNote Action

**Files:**
- Modify: `src/stores/slices/notesSlice.ts:289-340`

**Step 1: Write the failing test**

```typescript
// Add to existing notesSlice.test.ts or create if needed
describe('sendNote with broadcast', () => {
  it('should broadcast message to partner after successful insert', async () => {
    const mockChannel = {
      send: vi.fn().mockResolvedValue('ok'),
    };
    vi.mocked(supabase.channel).mockReturnValue(mockChannel as any);

    const store = createTestStore();
    await store.getState().sendNote('Hello partner!');

    expect(supabase.channel).toHaveBeenCalledWith('love-notes:partner-456');
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'new_message',
      payload: expect.objectContaining({
        message: expect.objectContaining({
          content: 'Hello partner!',
        }),
      }),
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/stores/slices/notesSlice.test.ts -t "broadcast"`
Expected: FAIL - broadcast not called

**Step 3: Update sendNote implementation**

In `src/stores/slices/notesSlice.ts`, after the successful insert (around line 315-328), add broadcast:

```typescript
// Success - replace optimistic note with server response
set((state) => ({
  notes: state.notes.map((note) =>
    note.tempId === tempId
      ? { ...data, sending: false, error: false }
      : note
  ),
}));

// Story 2.3: Broadcast message to partner's channel
try {
  const channel = supabase.channel(`love-notes:${partnerId}`);
  await channel.send({
    type: 'broadcast',
    event: 'new_message',
    payload: { message: data },
  });

  if (import.meta.env.DEV) {
    console.log('[NotesSlice] Broadcast sent to partner:', partnerId);
  }
} catch (broadcastError) {
  // Non-fatal - message is saved, just realtime failed
  console.warn('[NotesSlice] Broadcast failed (non-fatal):', broadcastError);
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/stores/slices/notesSlice.test.ts -t "broadcast"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/stores/slices/notesSlice.ts
git commit -m "feat(2.3): add broadcast to sendNote for realtime delivery

- Broadcast message to partner's channel after successful insert
- Use non-blocking broadcast (message saved even if broadcast fails)
- Partner receives message via useRealtimeMessages hook

Story 2.3 Task 2.1"
```

---

### Task 2.3.3: Add Message Deduplication to addNote

**Files:**
- Modify: `src/stores/slices/notesSlice.ts:200-204`

**Step 1: Write the failing test**

```typescript
describe('addNote deduplication', () => {
  it('should not add duplicate message by ID', () => {
    const store = createTestStore();
    const note = { id: 'note-1', content: 'Hello', from_user_id: 'user-1', to_user_id: 'user-2', created_at: new Date().toISOString() };

    store.getState().addNote(note);
    store.getState().addNote(note); // Duplicate

    expect(store.getState().notes).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/stores/slices/notesSlice.test.ts -t "deduplication"`
Expected: FAIL - notes has length 2

**Step 3: Update addNote implementation**

```typescript
/**
 * Add a single note to the list (for optimistic updates / realtime)
 * Includes deduplication check (Story 2.3 Task 2.4)
 */
addNote: (note) => {
  set((state) => {
    // Deduplication: check if message already exists by ID
    const exists = state.notes.some((n) => n.id === note.id);
    if (exists) {
      if (import.meta.env.DEV) {
        console.log('[NotesSlice] Duplicate message ignored:', note.id);
      }
      return state; // No change
    }

    return {
      notes: [...state.notes, note],
    };
  });
},
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/stores/slices/notesSlice.test.ts -t "deduplication"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/stores/slices/notesSlice.ts
git commit -m "fix(2.3): add message deduplication to addNote

- Check if message ID already exists before adding
- Prevents duplicates from race conditions between optimistic update and realtime

Story 2.3 Task 2.4"
```

---

### Task 2.3.4: Update useLoveNotes to Use New Hook

**Files:**
- Modify: `src/hooks/useLoveNotes.ts:117-196`

**Step 1: Refactor useLoveNotes**

Replace the entire realtime subscription section (lines 117-196) with:

```typescript
// Story 2.3: Real-time subscription via dedicated hook
// Using Broadcast API per useRealtimeMessages implementation
useRealtimeMessages({ enabled: autoFetch });
```

Add import at top:
```typescript
import { useRealtimeMessages } from './useRealtimeMessages';
```

Remove unused imports:
```typescript
// Remove: import type { RealtimeChannel } from '@supabase/supabase-js';
```

**Step 2: Run existing tests**

Run: `npm run test -- src/hooks`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/useLoveNotes.ts
git commit -m "refactor(2.3): use useRealtimeMessages hook in useLoveNotes

- Replace postgres_changes with Broadcast API via dedicated hook
- Simplify useLoveNotes by delegating realtime to useRealtimeMessages
- Remove unused RealtimeChannel import

Story 2.3 Task 3.2"
```

---

### Task 2.3.5: Create NewMessageIndicator Component

**Files:**
- Create: `src/components/love-notes/NewMessageIndicator.tsx`
- Create: `src/components/love-notes/__tests__/NewMessageIndicator.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/love-notes/__tests__/NewMessageIndicator.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewMessageIndicator } from '../NewMessageIndicator';

describe('NewMessageIndicator', () => {
  it('should render when hasNewMessages is true', () => {
    render(<NewMessageIndicator hasNewMessages={true} onClick={vi.fn()} />);
    expect(screen.getByTestId('new-message-indicator')).toBeInTheDocument();
  });

  it('should not render when hasNewMessages is false', () => {
    render(<NewMessageIndicator hasNewMessages={false} onClick={vi.fn()} />);
    expect(screen.queryByTestId('new-message-indicator')).not.toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    render(<NewMessageIndicator hasNewMessages={true} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('new-message-indicator'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should display message count when provided', () => {
    render(<NewMessageIndicator hasNewMessages={true} count={3} onClick={vi.fn()} />);
    expect(screen.getByText('3 new messages')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/love-notes/__tests__/NewMessageIndicator.test.tsx`
Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
// src/components/love-notes/NewMessageIndicator.tsx
/**
 * NewMessageIndicator Component
 *
 * Floating indicator shown when new messages arrive while scrolled up.
 * Story 2.3 - AC-2.3.3, Task 5.1
 */

import { ChevronDown } from 'lucide-react';

interface NewMessageIndicatorProps {
  hasNewMessages: boolean;
  count?: number;
  onClick: () => void;
}

export function NewMessageIndicator({ hasNewMessages, count, onClick }: NewMessageIndicatorProps) {
  if (!hasNewMessages) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-full shadow-lg hover:bg-pink-600 transition-colors animate-bounce"
      data-testid="new-message-indicator"
      aria-label={count ? `${count} new messages, click to scroll down` : 'New messages, click to scroll down'}
    >
      <ChevronDown className="w-4 h-4" />
      <span className="text-sm font-medium">
        {count ? `${count} new message${count > 1 ? 's' : ''}` : 'New messages'}
      </span>
    </button>
  );
}

export default NewMessageIndicator;
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/love-notes/__tests__/NewMessageIndicator.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/love-notes/NewMessageIndicator.tsx src/components/love-notes/__tests__/NewMessageIndicator.test.tsx
git commit -m "feat(2.3): add NewMessageIndicator component

- Floating indicator for new messages when scrolled up
- Shows message count when provided
- Accessible with aria-label
- Animated bounce effect

Story 2.3 Task 5.1"
```

---

### Task 2.3.6: Add hasUnreadMessages to NotesSlice

**Files:**
- Modify: `src/stores/slices/notesSlice.ts`

**Step 1: Add state and actions**

Add to NotesSlice interface:
```typescript
hasUnreadMessages: boolean;
setHasUnreadMessages: (has: boolean) => void;
```

Add to initial state:
```typescript
hasUnreadMessages: false,
```

Add action:
```typescript
setHasUnreadMessages: (has) => {
  set({ hasUnreadMessages: has });
},
```

Update addNote to set hasUnreadMessages true when adding realtime message.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/stores/slices/notesSlice.ts
git commit -m "feat(2.3): add hasUnreadMessages state to notesSlice

- Track when new messages arrive while not at bottom
- Add setHasUnreadMessages action

Story 2.3 Task 5.2"
```

---

### Task 2.3.7: Update Story 2.3 Documentation

**Files:**
- Modify: `docs/05-Epics-Stories/2-3-real-time-message-reception.md`

**Step 1: Mark tasks complete and update Dev Agent Record**

Update the tasks section to mark completed tasks with `[x]`.
Update the File List in Dev Agent Record to reflect actual files created/modified.

**Step 2: Commit**

```bash
git add docs/05-Epics-Stories/2-3-real-time-message-reception.md
git commit -m "docs(2.3): update story with completed tasks and file list

- Mark Tasks 2.1, 2.4, 3.1-3.2, 5.1-5.2 as complete
- Update Dev Agent Record with actual file list
- Document Broadcast API architecture decision"
```

---

## STORY 5.4 FIXES - Mood History Timeline

### Task 5.4.1: Fix react-window Imports and API

**Files:**
- Modify: `src/components/MoodTracker/MoodHistoryTimeline.tsx:10-12`

**Step 1: Update imports**

```typescript
// BEFORE (wrong):
import { List } from 'react-window';
import { useInfiniteLoader } from 'react-window-infinite-loader';

// AFTER (correct):
import { VariableSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: FAIL - props don't match

**Step 3: Commit partial**

```bash
git add src/components/MoodTracker/MoodHistoryTimeline.tsx
git commit -m "fix(5.4): update react-window imports to correct API

- Change List to VariableSizeList
- Change useInfiniteLoader hook to InfiniteLoader component

Story 5.4 Task 1.1 (partial)"
```

---

### Task 5.4.2: Implement Variable Sizing with getItemSize

**Files:**
- Modify: `src/components/MoodTracker/MoodHistoryTimeline.tsx:156-165`

**Step 1: Replace fixed ROW_HEIGHT with getItemSize**

```typescript
// Remove: const ROW_HEIGHT = 100;

// Add: Variable sizing function per story spec
const getItemSize = (index: number): number => {
  const item = timelineItems[index];
  if (!item) return 80; // Default for loading items

  if (item.type === 'date-header') {
    return 40; // Date headers are compact
  }

  // Mood items vary by note length
  const noteLength = item.mood.note?.length || 0;
  if (noteLength > 100) {
    return 120; // Long notes need more space
  }
  return 80; // Standard mood item height
};
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: May have errors - need to update component usage

---

### Task 5.4.3: Refactor to Use InfiniteLoader Wrapper Pattern

**Files:**
- Modify: `src/components/MoodTracker/MoodHistoryTimeline.tsx:159-206`

**Step 1: Rewrite the render section**

Replace the current render return (lines 188-206) with:

```typescript
// Create ref for VariableSizeList
const listRef = useRef<InstanceType<typeof List>>(null);

return (
  <div className="w-full h-full" data-testid="mood-history-timeline">
    <InfiniteLoader
      isItemLoaded={isRowLoaded}
      itemCount={timelineItems.length + (hasMore ? 1 : 0)}
      loadMoreItems={loadMoreRows}
    >
      {({ onItemsRendered, ref }) => (
        <List
          ref={(list) => {
            // Assign to both refs
            ref(list);
            if (listRef) listRef.current = list;
          }}
          height={600}
          itemCount={timelineItems.length}
          itemSize={getItemSize}
          width="100%"
          onItemsRendered={onItemsRendered}
        >
          {({ index, style }) => {
            const item = timelineItems[index];

            return (
              <div style={style}>
                {item.type === 'date-header' ? (
                  <DateHeader date={item.dateLabel} />
                ) : (
                  <MoodHistoryItem mood={item.mood} isPartnerView={isPartnerView} />
                )}
              </div>
            );
          }}
        </List>
      )}
    </InfiniteLoader>

    {isLoading && (
      <div className="text-center py-4">
        <LoadingSpinner />
      </div>
    )}
  </div>
);
```

**Step 2: Add missing import**

```typescript
import { useRef } from 'react';
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/MoodTracker/MoodHistoryTimeline.tsx
git commit -m "fix(5.4): refactor to correct react-window API

- Use VariableSizeList with itemSize function
- Use InfiniteLoader component wrapper (not hook)
- Implement variable heights: 40px headers, 80px standard, 120px long notes
- Fix all prop names to match react-window API

Story 5.4 Task 1.1"
```

---

### Task 5.4.4: Create MoodHistoryTimeline Unit Tests

**Files:**
- Create: `src/components/MoodTracker/__tests__/MoodHistoryTimeline.test.tsx`

**Step 1: Write tests**

```typescript
// src/components/MoodTracker/__tests__/MoodHistoryTimeline.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MoodHistoryTimeline } from '../MoodHistoryTimeline';

// Mock useMoodHistory hook
vi.mock('../../../hooks/useMoodHistory', () => ({
  useMoodHistory: vi.fn(() => ({
    moods: [],
    isLoading: false,
    hasMore: false,
    loadMore: vi.fn(),
    error: null,
  })),
}));

// Mock performance monitoring
vi.mock('../../../utils/performanceMonitoring', () => ({
  measureScrollPerformance: vi.fn(() => ({ disconnect: vi.fn() })),
}));

describe('MoodHistoryTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no moods', () => {
    render(<MoodHistoryTimeline userId="user-123" />);
    expect(screen.getByTestId('empty-mood-history-state')).toBeInTheDocument();
  });

  it('should render error state when error occurs', async () => {
    const { useMoodHistory } = await import('../../../hooks/useMoodHistory');
    vi.mocked(useMoodHistory).mockReturnValue({
      moods: [],
      isLoading: false,
      hasMore: false,
      loadMore: vi.fn(),
      error: 'Network error',
    });

    render(<MoodHistoryTimeline userId="user-123" />);
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('should render timeline with date headers and mood items', async () => {
    const mockMoods = [
      { id: '1', emoji: '😊', note: 'Great day', created_at: '2024-12-02T10:00:00Z', user_id: 'user-123' },
      { id: '2', emoji: '😴', note: 'Tired', created_at: '2024-12-01T15:00:00Z', user_id: 'user-123' },
    ];

    const { useMoodHistory } = await import('../../../hooks/useMoodHistory');
    vi.mocked(useMoodHistory).mockReturnValue({
      moods: mockMoods,
      isLoading: false,
      hasMore: false,
      loadMore: vi.fn(),
      error: null,
    });

    render(<MoodHistoryTimeline userId="user-123" />);
    expect(screen.getByTestId('mood-history-timeline')).toBeInTheDocument();
  });
});
```

**Step 2: Run test**

Run: `npm run test -- src/components/MoodTracker/__tests__/MoodHistoryTimeline.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/MoodTracker/__tests__/MoodHistoryTimeline.test.tsx
git commit -m "test(5.4): add MoodHistoryTimeline unit tests

- Test empty state rendering
- Test error state rendering
- Test timeline with date headers and mood items

Story 5.4 Task 6.1"
```

---

### Task 5.4.5: Create MoodHistoryItem Unit Tests

**Files:**
- Create: `src/components/MoodTracker/__tests__/MoodHistoryItem.test.tsx`

**Step 1: Write tests**

```typescript
// src/components/MoodTracker/__tests__/MoodHistoryItem.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoodHistoryItem } from '../MoodHistoryItem';

const mockMood = {
  id: 'mood-1',
  emoji: '😊',
  note: 'Had a great day at work!',
  created_at: '2024-12-02T10:30:00Z',
  user_id: 'user-123',
};

describe('MoodHistoryItem', () => {
  it('should render mood emoji', () => {
    render(<MoodHistoryItem mood={mockMood} />);
    expect(screen.getByText('😊')).toBeInTheDocument();
  });

  it('should render mood note when present', () => {
    render(<MoodHistoryItem mood={mockMood} />);
    expect(screen.getByText('Had a great day at work!')).toBeInTheDocument();
  });

  it('should render timestamp', () => {
    render(<MoodHistoryItem mood={mockMood} />);
    // Should show time like "10:30 AM"
    expect(screen.getByText(/10:30/i)).toBeInTheDocument();
  });

  it('should handle mood without note', () => {
    const moodWithoutNote = { ...mockMood, note: null };
    render(<MoodHistoryItem mood={moodWithoutNote} />);
    expect(screen.getByText('😊')).toBeInTheDocument();
  });

  it('should expand long notes on click', () => {
    const longNoteMood = {
      ...mockMood,
      note: 'A'.repeat(150), // Long note
    };
    render(<MoodHistoryItem mood={longNoteMood} />);

    // Note should be truncated initially
    const noteElement = screen.getByTestId('mood-note');
    expect(noteElement).toHaveClass('line-clamp-2');

    // Click to expand
    fireEvent.click(noteElement);
    expect(noteElement).not.toHaveClass('line-clamp-2');
  });
});
```

**Step 2: Run test**

Run: `npm run test -- src/components/MoodTracker/__tests__/MoodHistoryItem.test.tsx`
Expected: PASS (or may need to add data-testid to MoodHistoryItem)

**Step 3: Commit**

```bash
git add src/components/MoodTracker/__tests__/MoodHistoryItem.test.tsx
git commit -m "test(5.4): add MoodHistoryItem unit tests

- Test emoji rendering
- Test note display
- Test timestamp formatting
- Test long note expand/collapse

Story 5.4 Task 6.2"
```

---

### Task 5.4.6: Update Story 5.4 Documentation

**Files:**
- Modify: `docs/05-Epics-Stories/5-4-mood-history-timeline.md`

**Step 1: Mark tasks complete and update file list**

**Step 2: Commit**

```bash
git add docs/05-Epics-Stories/5-4-mood-history-timeline.md
git commit -m "docs(5.4): update story with completed tasks

- Mark Tasks 1.1, 6.1, 6.2 as complete
- Update Dev Agent Record with actual file list
- Document react-window API fix"
```

---

## STORY 6.3 FIXES - Photo Gallery Grid View

### Task 6.3.1: Fix Grid Columns (3-col Mobile, 4-col Desktop)

**Files:**
- Modify: `src/components/PhotoGallery/PhotoGallery.tsx:312`

**Step 1: Update grid classes**

```typescript
// BEFORE (wrong - 2 columns mobile):
className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4 w-full"

// AFTER (correct - 3 columns mobile per AC 6.3.1):
className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3 w-full"
```

**Step 2: Commit**

```bash
git add src/components/PhotoGallery/PhotoGallery.tsx
git commit -m "fix(6.3): correct grid columns per AC 6.3.1

- 3 columns on mobile (was 2)
- 4 columns on desktop md:768px+ (was lg:1024px+)

Story 6.3 AC 6.3.1"
```

---

### Task 6.3.2: Fix Empty State Message

**Files:**
- Modify: `src/components/PhotoGallery/PhotoGallery.tsx:292`

**Step 1: Update message**

```typescript
// BEFORE (wrong):
<p className="text-gray-500 text-lg mb-6">No photos yet. Upload your first memory!</p>

// AFTER (correct per AC 6.3.6):
<p className="text-gray-500 text-lg mb-6">No photos yet. Start building your memories!</p>
```

**Step 2: Commit**

```bash
git add src/components/PhotoGallery/PhotoGallery.tsx
git commit -m "fix(6.3): correct empty state message per AC 6.3.6

Story 6.3 AC 6.3.6"
```

---

### Task 6.3.3: Fix Blur Placeholder Logic

**Files:**
- Modify: `src/components/PhotoGallery/PhotoGridItem.tsx:76-78`

**Step 1: Update placeholder condition**

```typescript
// BEFORE (wrong - only shows when visible):
{!isLoaded && isVisible && (
  <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
)}

// AFTER (correct - always show until loaded):
{!isLoaded && (
  <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
)}
```

**Step 2: Commit**

```bash
git add src/components/PhotoGallery/PhotoGridItem.tsx
git commit -m "fix(6.3): always show blur placeholder until loaded

- Show placeholder for all unloaded images, not just visible ones
- Prevents layout shift and invisible gaps

Story 6.3 AC 6.3.2"
```

---

### Task 6.3.4: Add Timestamp Display to PhotoGridItem

**Files:**
- Modify: `src/components/PhotoGallery/PhotoGridItem.tsx`

**Step 1: Add timestamp display**

Add import:
```typescript
import { formatDistanceToNow } from 'date-fns';
```

Add timestamp to the component render (after caption if it exists):

```typescript
{/* Timestamp display (AC 6.3.10) */}
<span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
  {formatDistanceToNow(new Date(photo.created_at), { addSuffix: true })}
</span>
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/PhotoGallery/PhotoGridItem.tsx
git commit -m "feat(6.3): add timestamp display to photo grid items

- Show relative timestamp (e.g., '2 hours ago')
- Uses date-fns formatDistanceToNow

Story 6.3 AC 6.3.10"
```

---

### Task 6.3.5: Implement Click Handler for Full-Screen Viewer

**Files:**
- Modify: `src/components/PhotoGallery/PhotoGallery.tsx:319-325`

**Step 1: Check if PhotoCarousel exists and can handle string IDs**

First, examine PhotoCarousel to understand current implementation.

**Step 2: Update click handler**

```typescript
onPhotoClick={(photoId) => {
  // Find photo index for carousel
  const photoIndex = photos.findIndex(p => p.id === photoId);
  if (photoIndex !== -1) {
    selectPhoto(photoIndex);
    // Navigate to carousel view or open modal
    // If using modal approach, set state to show carousel
  }
}}
```

Or implement a simple full-screen overlay:

```typescript
const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

// In render:
onPhotoClick={(photoId) => setSelectedPhotoId(photoId)}

// Add overlay:
{selectedPhotoId && (
  <div
    className="fixed inset-0 z-50 bg-black flex items-center justify-center"
    onClick={() => setSelectedPhotoId(null)}
  >
    <img
      src={photos.find(p => p.id === selectedPhotoId)?.signedUrl}
      alt="Full screen photo"
      className="max-w-full max-h-full object-contain"
    />
    <button
      className="absolute top-4 right-4 text-white"
      onClick={() => setSelectedPhotoId(null)}
    >
      Close
    </button>
  </div>
)}
```

**Step 3: Commit**

```bash
git add src/components/PhotoGallery/PhotoGallery.tsx
git commit -m "feat(6.3): implement click handler for full-screen view

- Open full-screen overlay when photo is clicked
- Click outside or close button to dismiss

Story 6.3 AC 6.3.5"
```

---

### Task 6.3.6: Add ARIA Attributes for Accessibility

**Files:**
- Modify: `src/components/PhotoGallery/PhotoGallery.tsx:311-314`

**Step 1: Add accessibility attributes**

```typescript
<div
  role="grid"
  aria-label="Photo gallery"
  className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3 w-full"
  data-testid="photo-gallery-grid"
>
```

**Step 2: Commit**

```bash
git add src/components/PhotoGallery/PhotoGallery.tsx
git commit -m "a11y(6.3): add ARIA attributes to photo gallery grid

- Add role='grid' for screen readers
- Add aria-label='Photo gallery'

Story 6.3 Dev Notes compliance"
```

---

### Task 6.3.7: Remove Console.log Pollution

**Files:**
- Modify: `src/components/PhotoGallery/PhotoGallery.tsx`

**Step 1: Remove or gate console logs**

Search for all `console.log` in the file and either:
- Remove them entirely
- Or wrap in `if (import.meta.env.DEV)`

**Step 2: Commit**

```bash
git add src/components/PhotoGallery/PhotoGallery.tsx
git commit -m "chore(6.3): remove console.log statements from production

- Gate debug logs behind DEV environment check
- Cleaner production code"
```

---

### Task 6.3.8: Create PhotoGallery Unit Tests

**Files:**
- Create: `src/components/PhotoGallery/__tests__/PhotoGallery.test.tsx`

**Step 1: Write tests**

```typescript
// src/components/PhotoGallery/__tests__/PhotoGallery.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PhotoGallery } from '../PhotoGallery';

// Mock photoService
vi.mock('../../../services/photoService', () => ({
  photoService: {
    getPhotos: vi.fn().mockResolvedValue([]),
  },
}));

// Mock store
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      selectPhoto: vi.fn(),
      photos: [],
      loadPhotos: vi.fn(),
    };
    return selector(state);
  }),
}));

describe('PhotoGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no photos', async () => {
    render(<PhotoGallery />);

    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery-empty-state')).toBeInTheDocument();
    });
  });

  it('should show correct empty state message', async () => {
    render(<PhotoGallery />);

    await waitFor(() => {
      expect(screen.getByText('No photos yet. Start building your memories!')).toBeInTheDocument();
    });
  });

  it('should render grid with photos', async () => {
    const mockPhotos = [
      { id: '1', signedUrl: 'url1', thumbnailUrl: 'thumb1', created_at: '2024-12-02T10:00:00Z' },
      { id: '2', signedUrl: 'url2', thumbnailUrl: 'thumb2', created_at: '2024-12-01T10:00:00Z' },
    ];

    const { photoService } = await import('../../../services/photoService');
    vi.mocked(photoService.getPhotos).mockResolvedValue(mockPhotos);

    render(<PhotoGallery />);

    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery-grid')).toBeInTheDocument();
    });
  });

  it('should have correct grid classes for responsive layout', async () => {
    const mockPhotos = [{ id: '1', signedUrl: 'url1', thumbnailUrl: 'thumb1', created_at: '2024-12-02T10:00:00Z' }];

    const { photoService } = await import('../../../services/photoService');
    vi.mocked(photoService.getPhotos).mockResolvedValue(mockPhotos);

    render(<PhotoGallery />);

    await waitFor(() => {
      const grid = screen.getByTestId('photo-gallery-grid');
      expect(grid).toHaveClass('grid-cols-3'); // 3 columns mobile
      expect(grid).toHaveClass('md:grid-cols-4'); // 4 columns desktop
    });
  });
});
```

**Step 2: Run test**

Run: `npm run test -- src/components/PhotoGallery/__tests__/PhotoGallery.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/PhotoGallery/__tests__/PhotoGallery.test.tsx
git commit -m "test(6.3): add PhotoGallery unit tests

- Test empty state rendering and message
- Test grid rendering with photos
- Test responsive grid classes

Story 6.3 Task 8"
```

---

### Task 6.3.9: Update Story 6.3 Documentation

**Files:**
- Modify: `docs/05-Epics-Stories/6-3-photo-gallery-grid-view.md`

**Step 1: Mark tasks complete and update file list**

**Step 2: Commit**

```bash
git add docs/05-Epics-Stories/6-3-photo-gallery-grid-view.md
git commit -m "docs(6.3): update story with completed tasks

- Mark Tasks 1-6, 8 as complete
- Update Dev Agent Record with actual file list
- Document all AC fixes"
```

---

## VERIFICATION GATES

After completing all tasks, run these verification commands:

### Gate 1: TypeScript Compilation
```bash
npm run typecheck
```
Expected: No errors

### Gate 2: Unit Tests
```bash
npm run test
```
Expected: All tests pass

### Gate 3: Lint
```bash
npm run lint
```
Expected: No errors

### Gate 4: Build
```bash
npm run build
```
Expected: Successful build

### Gate 5: E2E Tests (if available)
```bash
npm run test:e2e
```
Expected: All tests pass

---

## FINAL STEPS

### Update Sprint Status

After all fixes verified, update `docs/05-Epics-Stories/sprint-status.yaml`:

```yaml
2-3-real-time-message-reception: done # Code review fixes complete 2025-12-02
5-4-mood-history-timeline: done # Code review fixes complete 2025-12-02
6-3-photo-gallery-grid-view: done # Code review fixes complete 2025-12-02
```

### Final Commit

```bash
git add docs/05-Epics-Stories/sprint-status.yaml
git commit -m "chore: mark stories 2.3, 5.4, 6.3 as done

All code review issues resolved:
- 2.3: Broadcast API migration, deduplication, new components
- 5.4: react-window API fix, variable sizing, unit tests
- 6.3: Grid columns, timestamps, click handler, unit tests"
```

---

## SUMMARY

**Total Tasks:** 25 (across 3 stories)
**Estimated Time (Sequential):** 4-6 hours
**Estimated Time (Parallel):** 2 hours with 3 subagents

**Story 2.3:** 7 tasks (Broadcast API, hooks, components, tests)
**Story 5.4:** 6 tasks (react-window fix, tests, docs)
**Story 6.3:** 9 tasks (grid, messages, timestamps, click, tests)

All changes follow TDD approach with frequent commits.
