# Story 5.4: Mood History Timeline

**Epic**: 5 - Mood Tracking & Transparency
**Story ID**: 5.4
**Status**: drafted
**Created**: 2025-12-02

---

## User Story

**As a** user,
**I want** to see my mood history over time in a scrollable timeline,
**So that** I can track patterns and reflect on my emotional journey.

---

## Context

This is the final story of Epic 5, completing the mood tracking transparency feature set. After Stories 5.1-5.3 established mood logging and partner viewing, this story adds historical timeline viewing for both user and partner moods.

**Epic Goal**: Partners share emotional states with full transparency
**User Value**: Visualize emotional patterns over time to better understand yourself and your partner

**Dependencies**:
- Story 5.1 (Mood Emoji Picker Interface) - COMPLETE: 12-emoji grid with multi-select
- Story 5.2 (Quick Mood Logging Flow) - COMPLETE: Sub-5-second logging with haptic feedback
- Story 5.3 (Partner Mood Viewing & Transparency) - COMPLETE: Real-time partner mood display with Broadcast API
- Existing MoodTracker component at `src/components/MoodTracker/MoodTracker.tsx`
- MoodSlice at `src/stores/slices/moodSlice.ts`
- MoodService at `src/services/moodService.ts`
- Supabase pagination with `.range()`

**What's Already Implemented** (from Stories 5.1-5.3):
- 12-emoji mood grid with multi-select capability
- Quick mood logging (< 5 seconds) with optimistic updates
- Partner mood display with real-time Broadcast updates
- Haptic feedback on mood save (50ms pulse)
- Background sync to Supabase
- RLS policies for partner-only mood access
- Relative time formatting (`getRelativeTime`, `isJustNow` utilities)

**Gap Analysis from Epic Requirements**:
1. **Timeline View**: Need chronological mood history display (newest first)
2. **Infinite Scroll**: Load older entries in batches (50 per page) without performance degradation
3. **Virtualized Rendering**: Memory-efficient list for 1000+ entries
4. **Day Separators**: Clear visual separation between days ("Today", "Yesterday", "Nov 15")
5. **Note Expansion**: Truncate long notes with expand/collapse functionality
6. **Performance**: Smooth 60fps scrolling with react-window virtualization

---

## Acceptance Criteria

| AC ID | Criteria | Validation Method |
|-------|----------|-------------------|
| **AC-5.4.1** | Timeline view showing mood entries in chronological order (newest first) | E2E test + visual inspection |
| **AC-5.4.2** | Each entry displays emoji, timestamp, optional note with clear visual separation between days | E2E test + manual verification |
| **AC-5.4.3** | Infinite scroll loads older entries in batches (50 per page) | E2E test + performance profiling |
| **AC-5.4.4** | Smooth 60fps scrolling maintained with virtualized list rendering | Performance test + Chrome DevTools |
| **AC-5.4.5** | Memory efficient: < 100MB for 1000+ entries via virtualization | Performance test + memory profiling |
| **AC-5.4.6** | Long notes truncated with expand/collapse functionality | E2E test + visual inspection |

---

## Implementation Tasks

### **Task 1: Create MoodHistoryTimeline Component** (AC-5.4.1, AC-5.4.2)
**Goal**: Build virtualized timeline component for mood history display

- [ ] **1.1** Create `src/components/MoodTracker/MoodHistoryTimeline.tsx`:
  ```typescript
  import { useMemo, useState } from 'react';
  import { VariableSizeList as List } from 'react-window';
  import InfiniteLoader from 'react-window-infinite-loader';
  import { MoodHistoryItem } from './MoodHistoryItem';
  import { groupMoodsByDate } from '@/utils/moodGrouping';

  interface MoodHistoryTimelineProps {
    userId: string;
    isPartnerView?: boolean;
  }

  export function MoodHistoryTimeline({ userId, isPartnerView = false }: MoodHistoryTimelineProps) {
    const {
      moods,
      isLoading,
      hasMore,
      loadMore
    } = useMoodHistory(userId);

    // Group moods by date for day separators
    const groupedMoods = useMemo(() => groupMoodsByDate(moods), [moods]);

    // Item count includes mood entries + date headers
    const itemCount = groupedMoods.reduce((acc, group) =>
      acc + 1 + group.moods.length, // 1 for date header + moods
      0
    );

    // Determine if item needs loading
    const isItemLoaded = (index: number) =>
      !hasMore || index < itemCount;

    // Load more items when scrolling near bottom
    const loadMoreItems = () => {
      if (!isLoading && hasMore) {
        return loadMore();
      }
      return Promise.resolve();
    };

    // Get item size for virtualization
    const getItemSize = (index: number) => {
      const item = getItemAtIndex(index);
      if (item.type === 'date-header') return 40; // Date header height
      if (item.mood.note && item.mood.note.length > 100) return 120; // With note
      return 80; // Without note or short note
    };

    return (
      <div className="w-full h-full">
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount + (hasMore ? 1 : 0)}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={ref}
              height={600}
              itemCount={itemCount}
              itemSize={getItemSize}
              width="100%"
              onItemsRendered={onItemsRendered}
            >
              {({ index, style }) => {
                const item = getItemAtIndex(index);

                return (
                  <div style={style}>
                    {item.type === 'date-header' ? (
                      <DateHeader date={item.date} />
                    ) : (
                      <MoodHistoryItem
                        mood={item.mood}
                        isPartnerView={isPartnerView}
                      />
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
  }
  ```

- [ ] **1.2** Create `useMoodHistory` hook at `src/hooks/useMoodHistory.ts`:
  ```typescript
  import { useState, useEffect, useCallback } from 'react';
  import { moodService } from '@/services/moodService';
  import type { MoodEntry } from '@/types/models';

  const PAGE_SIZE = 50;

  export function useMoodHistory(userId: string) {
    const [moods, setMoods] = useState<MoodEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);

    // Initial load
    useEffect(() => {
      loadInitialMoods();
    }, [userId]);

    async function loadInitialMoods() {
      setIsLoading(true);
      const data = await moodService.getMoodHistory(userId, 0, PAGE_SIZE);

      setMoods(data);
      setHasMore(data.length === PAGE_SIZE);
      setOffset(PAGE_SIZE);
      setIsLoading(false);
    }

    const loadMore = useCallback(async () => {
      if (isLoading || !hasMore) return;

      setIsLoading(true);
      const data = await moodService.getMoodHistory(userId, offset, PAGE_SIZE);

      setMoods(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setOffset(prev => prev + PAGE_SIZE);
      setIsLoading(false);
    }, [userId, offset, isLoading, hasMore]);

    return {
      moods,
      isLoading,
      hasMore,
      loadMore,
    };
  }
  ```

- [ ] **1.3** Add `getMoodHistory` method to `src/services/moodService.ts`:
  ```typescript
  async getMoodHistory(
    userId: string,
    offset: number = 0,
    limit: number = 50
  ): Promise<MoodEntry[]> {
    const { data, error } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[MoodService] Failed to load mood history:', error);
      return [];
    }

    return data || [];
  }
  ```

- [ ] **1.4** Create date grouping utility at `src/utils/moodGrouping.ts`:
  ```typescript
  import type { MoodEntry } from '@/types/models';

  export interface MoodGroup {
    date: Date;
    dateLabel: string;
    moods: MoodEntry[];
  }

  export function groupMoodsByDate(moods: MoodEntry[]): MoodGroup[] {
    const groups = new Map<string, MoodEntry[]>();

    moods.forEach(mood => {
      const date = new Date(mood.created_at);
      const dateKey = date.toDateString();

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(mood);
    });

    return Array.from(groups.entries()).map(([dateKey, moods]) => ({
      date: new Date(dateKey),
      dateLabel: getDateLabel(new Date(dateKey)),
      moods,
    }));
  }

  function getDateLabel(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }
  ```

### **Task 2: Create MoodHistoryItem Component** (AC-5.4.2, AC-5.4.6)
**Goal**: Individual mood entry display with note expand/collapse functionality

- [ ] **2.1** Create `src/components/MoodTracker/MoodHistoryItem.tsx`:
  ```typescript
  import { useState } from 'react';
  import { motion, AnimatePresence } from 'framer-motion';
  import { getMoodEmoji } from '@/utils/moodEmojis';
  import { getRelativeTime } from '@/utils/dateFormat';

  interface MoodHistoryItemProps {
    mood: MoodEntry;
    isPartnerView?: boolean;
  }

  const NOTE_TRUNCATE_LENGTH = 100;

  export function MoodHistoryItem({ mood, isPartnerView = false }: MoodHistoryItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const shouldTruncate = mood.note && mood.note.length > NOTE_TRUNCATE_LENGTH;
    const displayNote = shouldTruncate && !isExpanded
      ? mood.note.slice(0, NOTE_TRUNCATE_LENGTH) + '...'
      : mood.note;

    return (
      <div className="flex items-start gap-3 py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {/* Emoji */}
        <div className="flex-shrink-0">
          <span className="text-3xl">
            {getMoodEmoji(mood.mood_type)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize">
              {mood.mood_type}
            </h4>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {getRelativeTime(mood.created_at)}
            </span>
          </div>

          {/* Note with expand/collapse */}
          {mood.note && (
            <div className="mt-1">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {displayNote}
              </p>

              {shouldTruncate && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 mt-1 font-medium"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Divider line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }
  ```

- [ ] **2.2** Create DateHeader component:
  ```typescript
  // In MoodHistoryTimeline.tsx or separate file
  function DateHeader({ date }: { date: string }) {
    return (
      <div className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          {date}
        </h3>
      </div>
    );
  }
  ```

### **Task 3: Integrate Timeline into Mood Page** (AC-5.4.1)
**Goal**: Add mood history section to existing Mood Tracker page

- [ ] **3.1** Update `src/components/MoodTracker/MoodTracker.tsx`:
  ```typescript
  import { useState } from 'react';
  import { MoodHistoryTimeline } from './MoodHistoryTimeline';
  import { PartnerMoodDisplay } from './PartnerMoodDisplay';
  import { MoodEmojiPicker } from './MoodEmojiPicker';
  import { useAuth } from '@/hooks/useAuth';
  import { usePartnerProfile } from '@/hooks/usePartnerProfile';

  export function MoodTracker() {
    const { user } = useAuth();
    const { partnerProfile } = usePartnerProfile();
    const [activeTab, setActiveTab] = useState<'my-moods' | 'partner-moods'>('my-moods');

    return (
      <div className="max-w-2xl mx-auto p-4">
        {/* Partner's current mood (from Story 5.3) */}
        {partnerProfile && (
          <PartnerMoodDisplay partnerId={partnerProfile.id} />
        )}

        {/* Mood logging UI (from Stories 5.1 & 5.2) */}
        <MoodEmojiPicker />

        {/* NEW: Mood History Section */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Mood History
          </h2>

          {/* Tab switcher: My Moods / Partner Moods */}
          <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('my-moods')}
              className={`pb-2 px-4 font-medium transition-colors ${
                activeTab === 'my-moods'
                  ? 'text-pink-500 border-b-2 border-pink-500'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              My Moods
            </button>
            {partnerProfile && (
              <button
                onClick={() => setActiveTab('partner-moods')}
                className={`pb-2 px-4 font-medium transition-colors ${
                  activeTab === 'partner-moods'
                    ? 'text-pink-500 border-b-2 border-pink-500'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Partner's Moods
              </button>
            )}
          </div>

          {/* Timeline view */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {activeTab === 'my-moods' ? (
              <MoodHistoryTimeline userId={user!.id} />
            ) : (
              <MoodHistoryTimeline
                userId={partnerProfile!.id}
                isPartnerView={true}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
  ```

### **Task 4: Performance Optimization & Testing** (AC-5.4.3, AC-5.4.4, AC-5.4.5)
**Goal**: Ensure smooth 60fps scrolling and memory efficiency for large datasets

- [ ] **4.1** Install required dependencies:
  ```bash
  npm install react-window react-window-infinite-loader
  npm install --save-dev @types/react-window
  ```

- [ ] **4.2** Add performance monitoring utility at `src/utils/performanceMonitoring.ts`:
  ```typescript
  export function measureScrollPerformance(): PerformanceObserver {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          console.debug('[Performance] Scroll frame time:', entry.duration, 'ms');

          if (entry.duration > 16.67) {
            console.warn('[Performance] Frame drop detected:', entry.duration, 'ms');
          }
        }
      }
    });

    observer.observe({ entryTypes: ['measure'] });
    return observer;
  }

  export function measureMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1048576;
      console.debug('[Memory] Used heap size:', usedMB.toFixed(2), 'MB');
      return usedMB;
    }
    return 0;
  }
  ```

- [ ] **4.3** Add scroll performance test to `MoodHistoryTimeline`:
  ```typescript
  // In MoodHistoryTimeline.tsx
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const observer = measureScrollPerformance();
      return () => observer.disconnect();
    }
  }, []);
  ```

- [ ] **4.4** Create performance E2E test at `tests/e2e/mood-history-performance.spec.ts`:
  ```typescript
  import { test, expect } from '@playwright/test';

  test.describe('Mood History Timeline Performance', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/moods');
      await page.getByTestId('mood-history-tab-my-moods').click();
    });

    test('Loads first 50 entries quickly (AC-5.4.3)', async ({ page }) => {
      const startTime = Date.now();

      await expect(page.getByTestId('mood-history-item').first()).toBeVisible();

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(500); // < 500ms initial load
    });

    test('Infinite scroll loads next page efficiently', async ({ page }) => {
      // Scroll to trigger next page load
      await page.getByTestId('mood-history-timeline').evaluate(node => {
        node.scrollTop = node.scrollHeight;
      });

      const startTime = Date.now();
      await page.waitForTimeout(300); // Allow load to trigger

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(300); // < 300ms subsequent loads
    });

    test('Maintains smooth scrolling (AC-5.4.4)', async ({ page }) => {
      // Enable performance metrics
      await page.evaluate(() => {
        (window as any).scrollFrameTimes = [];

        let lastTime = performance.now();
        const measureFrame = () => {
          const now = performance.now();
          const frameTime = now - lastTime;
          (window as any).scrollFrameTimes.push(frameTime);
          lastTime = now;
          requestAnimationFrame(measureFrame);
        };
        requestAnimationFrame(measureFrame);
      });

      // Perform scroll
      await page.getByTestId('mood-history-timeline').evaluate(node => {
        node.scrollBy({ top: 500, behavior: 'smooth' });
      });

      await page.waitForTimeout(1000);

      // Check frame times
      const frameTimes = await page.evaluate(() => (window as any).scrollFrameTimes);
      const avgFrameTime = frameTimes.reduce((a: number, b: number) => a + b, 0) / frameTimes.length;

      expect(avgFrameTime).toBeLessThan(16.67); // 60fps = 16.67ms per frame
    });

    test('Memory efficient with large dataset (AC-5.4.5)', async ({ page, context }) => {
      // Grant memory profiling permission
      await context.grantPermissions(['performance-timeline']);

      // Scroll through 1000+ entries simulation
      for (let i = 0; i < 20; i++) {
        await page.getByTestId('mood-history-timeline').evaluate(node => {
          node.scrollTop = node.scrollHeight;
        });
        await page.waitForTimeout(100);
      }

      // Measure memory
      const memoryUsage = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize / 1048576;
        }
        return 0;
      });

      // Virtualization should keep memory under 100MB
      expect(memoryUsage).toBeLessThan(100);
    });
  });
  ```

### **Task 5: Add E2E Tests for Timeline Features** (All ACs)
**Goal**: Comprehensive E2E test coverage for mood history timeline

- [ ] **5.1** Create E2E test file `tests/e2e/mood-history-timeline.spec.ts`:
  ```typescript
  import { test, expect } from '@playwright/test';

  test.describe('Mood History Timeline', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/moods');
      await page.getByTestId('mood-history-section').scrollIntoView();
    });

    test('Displays mood entries in chronological order (AC-5.4.1)', async ({ page }) => {
      const entries = page.getByTestId('mood-history-item');
      await expect(entries).toHaveCount({ gte: 1 });

      // Verify chronological order (newest first)
      const timestamps = await entries.evaluateAll(nodes =>
        nodes.map(node => node.getAttribute('data-timestamp'))
      );

      for (let i = 0; i < timestamps.length - 1; i++) {
        const current = new Date(timestamps[i]!).getTime();
        const next = new Date(timestamps[i + 1]!).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    test('Shows all required elements for each entry (AC-5.4.2)', async ({ page }) => {
      const firstEntry = page.getByTestId('mood-history-item').first();

      await expect(firstEntry.getByTestId('mood-emoji')).toBeVisible();
      await expect(firstEntry.getByTestId('mood-label')).toBeVisible();
      await expect(firstEntry.getByTestId('mood-timestamp')).toBeVisible();
    });

    test('Groups entries by date with headers (AC-5.4.2)', async ({ page }) => {
      await expect(page.getByTestId('date-header-today')).toBeVisible();

      // Verify date header text format
      const headerText = await page.getByTestId('date-header-today').textContent();
      expect(headerText).toMatch(/Today|Yesterday|[A-Z][a-z]{2} \d{1,2}/);
    });

    test('Infinite scroll loads more entries (AC-5.4.3)', async ({ page }) => {
      const initialCount = await page.getByTestId('mood-history-item').count();

      // Scroll to bottom
      await page.getByTestId('mood-history-timeline').evaluate(node => {
        node.scrollTop = node.scrollHeight;
      });

      // Wait for new items to load
      await page.waitForTimeout(500);

      const newCount = await page.getByTestId('mood-history-item').count();
      expect(newCount).toBeGreaterThan(initialCount);
    });

    test('Expands and collapses long notes (AC-5.4.6)', async ({ page }) => {
      // Find entry with long note
      const longNoteEntry = page.getByTestId('mood-history-item')
        .filter({ has: page.getByText('Show more') })
        .first();

      if (await longNoteEntry.count() > 0) {
        const noteText = await longNoteEntry.getByTestId('mood-note').textContent();
        expect(noteText).toContain('...');

        // Click "Show more"
        await longNoteEntry.getByText('Show more').click();

        const expandedNoteText = await longNoteEntry.getByTestId('mood-note').textContent();
        expect(expandedNoteText).not.toContain('...');

        // Click "Show less"
        await longNoteEntry.getByText('Show less').click();

        const collapsedNoteText = await longNoteEntry.getByTestId('mood-note').textContent();
        expect(collapsedNoteText).toContain('...');
      }
    });

    test('Switches between My Moods and Partner Moods tabs', async ({ page }) => {
      // Click Partner Moods tab
      await page.getByTestId('mood-history-tab-partner-moods').click();

      await expect(page.getByTestId('mood-history-timeline')).toBeVisible();

      // Verify partner entries shown
      const partnerEntries = page.getByTestId('mood-history-item');
      await expect(partnerEntries.first()).toBeVisible();

      // Switch back to My Moods
      await page.getByTestId('mood-history-tab-my-moods').click();
      await expect(page.getByTestId('mood-history-timeline')).toBeVisible();
    });

    test('Shows loading state while fetching more entries', async ({ page }) => {
      // Scroll near bottom
      await page.getByTestId('mood-history-timeline').evaluate(node => {
        node.scrollTop = node.scrollHeight - 100;
      });

      // Verify loading spinner appears
      await expect(page.getByTestId('loading-spinner')).toBeVisible();

      // Wait for load to complete
      await page.waitForTimeout(500);
      await expect(page.getByTestId('loading-spinner')).not.toBeVisible();
    });

    test('Handles empty history gracefully', async ({ page }) => {
      // Navigate to moods page with user who has no history
      await page.goto('/moods?user=no-history-user-id');

      await expect(page.getByTestId('empty-mood-history-state')).toBeVisible();
      await expect(page.getByText('No mood history yet')).toBeVisible();
    });
  });
  ```

### **Task 6: Add Unit Tests**
**Goal**: Test coverage for new components and utilities

- [ ] **6.1** Create test file `src/components/MoodTracker/__tests__/MoodHistoryTimeline.test.tsx`:
  ```typescript
  import { render, screen, waitFor } from '@testing-library/react';
  import { MoodHistoryTimeline } from '../MoodHistoryTimeline';
  import { useMoodHistory } from '@/hooks/useMoodHistory';

  vi.mock('@/hooks/useMoodHistory');
  vi.mock('react-window');
  vi.mock('react-window-infinite-loader');

  describe('MoodHistoryTimeline', () => {
    const mockUserId = 'user-123';

    it('renders timeline with mood entries', async () => {
      vi.mocked(useMoodHistory).mockReturnValue({
        moods: [
          {
            id: '1',
            user_id: mockUserId,
            mood_type: 'happy',
            note: 'Great day!',
            created_at: new Date().toISOString(),
          },
          {
            id: '2',
            user_id: mockUserId,
            mood_type: 'calm',
            created_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          },
        ],
        isLoading: false,
        hasMore: true,
        loadMore: vi.fn(),
      });

      render(<MoodHistoryTimeline userId={mockUserId} />);

      await waitFor(() => {
        expect(screen.getByText('happy')).toBeInTheDocument();
        expect(screen.getByText('calm')).toBeInTheDocument();
      });
    });

    it('shows loading state', () => {
      vi.mocked(useMoodHistory).mockReturnValue({
        moods: [],
        isLoading: true,
        hasMore: false,
        loadMore: vi.fn(),
      });

      render(<MoodHistoryTimeline userId={mockUserId} />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('triggers loadMore when scrolling to bottom', async () => {
      const mockLoadMore = vi.fn();

      vi.mocked(useMoodHistory).mockReturnValue({
        moods: Array(50).fill(null).map((_, i) => ({
          id: `${i}`,
          user_id: mockUserId,
          mood_type: 'happy',
          created_at: new Date().toISOString(),
        })),
        isLoading: false,
        hasMore: true,
        loadMore: mockLoadMore,
      });

      render(<MoodHistoryTimeline userId={mockUserId} />);

      // Simulate scroll event (implementation depends on react-window mock)
      // For this test, verify loadMore is callable
      expect(mockLoadMore).toBeDefined();
    });
  });
  ```

- [ ] **6.2** Create test file `src/utils/__tests__/moodGrouping.test.ts`:
  ```typescript
  import { groupMoodsByDate } from '../moodGrouping';
  import type { MoodEntry } from '@/types/models';

  describe('groupMoodsByDate', () => {
    it('groups moods by date correctly', () => {
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);

      const moods: MoodEntry[] = [
        {
          id: '1',
          user_id: 'user-123',
          mood_type: 'happy',
          created_at: today.toISOString(),
        },
        {
          id: '2',
          user_id: 'user-123',
          mood_type: 'calm',
          created_at: today.toISOString(),
        },
        {
          id: '3',
          user_id: 'user-123',
          mood_type: 'excited',
          created_at: yesterday.toISOString(),
        },
      ];

      const groups = groupMoodsByDate(moods);

      expect(groups).toHaveLength(2);
      expect(groups[0].dateLabel).toBe('Today');
      expect(groups[0].moods).toHaveLength(2);
      expect(groups[1].dateLabel).toBe('Yesterday');
      expect(groups[1].moods).toHaveLength(1);
    });

    it('returns "Today" label for current day', () => {
      const moods: MoodEntry[] = [
        {
          id: '1',
          user_id: 'user-123',
          mood_type: 'happy',
          created_at: new Date().toISOString(),
        },
      ];

      const groups = groupMoodsByDate(moods);
      expect(groups[0].dateLabel).toBe('Today');
    });

    it('returns "Yesterday" label for previous day', () => {
      const yesterday = new Date(Date.now() - 86400000);

      const moods: MoodEntry[] = [
        {
          id: '1',
          user_id: 'user-123',
          mood_type: 'happy',
          created_at: yesterday.toISOString(),
        },
      ];

      const groups = groupMoodsByDate(moods);
      expect(groups[0].dateLabel).toBe('Yesterday');
    });

    it('returns formatted date for older entries', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000);

      const moods: MoodEntry[] = [
        {
          id: '1',
          user_id: 'user-123',
          mood_type: 'happy',
          created_at: threeDaysAgo.toISOString(),
        },
      ];

      const groups = groupMoodsByDate(moods);
      expect(groups[0].dateLabel).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/); // e.g., "Nov 29"
    });

    it('handles empty mood array', () => {
      const groups = groupMoodsByDate([]);
      expect(groups).toHaveLength(0);
    });
  });
  ```

---

## Dev Notes

### Architecture Patterns and Constraints

**Technology Stack** (from Architecture doc):
- **React 19 + Vite 7** - Modern web stack with fast HMR
- **Tailwind CSS 3.4** - Utility-first styling with dark mode support
- **Framer Motion 12** - Declarative animations (optional for timeline transitions)
- **Zustand 5** - State management (existing MoodSlice)
- **react-window** - Virtualized list rendering for performance
- **react-window-infinite-loader** - Infinite scroll functionality
- **Supabase** - Backend with pagination via `.range()`

**Component Location**:
- New component: `src/components/MoodTracker/MoodHistoryTimeline.tsx`
- New component: `src/components/MoodTracker/MoodHistoryItem.tsx`
- New hook: `src/hooks/useMoodHistory.ts`
- New utility: `src/utils/moodGrouping.ts`
- New utility: `src/utils/performanceMonitoring.ts`
- Service update: `src/services/moodService.ts` (add `getMoodHistory` method)

**Virtualization Pattern** (Performance Critical):
```typescript
// Use react-window for memory-efficient rendering
import { VariableSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

// Only visible items rendered in DOM
// Variable sizing allows different heights for notes
// InfiniteLoader handles pagination automatically
```

**Pagination Pattern** (from Supabase):
```typescript
// Efficient server-side pagination
const { data } = await supabase
  .from('mood_entries')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1); // Inclusive range

// Example: offset=0, limit=50 → range(0, 49) = first 50 rows
// Example: offset=50, limit=50 → range(50, 99) = next 50 rows
```

### Project Structure Notes

**Files to Create:**
```
src/
├── components/
│   └── MoodTracker/
│       ├── MoodHistoryTimeline.tsx       # Main timeline component (NEW)
│       ├── MoodHistoryItem.tsx          # Individual entry component (NEW)
│       └── __tests__/
│           ├── MoodHistoryTimeline.test.tsx  # Timeline unit tests (NEW)
│           └── MoodHistoryItem.test.tsx      # Item unit tests (NEW)
├── hooks/
│   ├── useMoodHistory.ts                # Pagination hook (NEW)
│   └── __tests__/
│       └── useMoodHistory.test.ts       # Hook tests (NEW)
├── utils/
│   ├── moodGrouping.ts                  # Date grouping logic (NEW)
│   ├── performanceMonitoring.ts         # Performance utilities (NEW)
│   └── __tests__/
│       ├── moodGrouping.test.ts         # Grouping tests (NEW)
│       └── performanceMonitoring.test.ts # Perf tests (NEW)
tests/
└── e2e/
    ├── mood-history-timeline.spec.ts     # E2E functional tests (NEW)
    └── mood-history-performance.spec.ts  # E2E performance tests (NEW)
```

**Files to Modify:**
```
src/
├── services/
│   └── moodService.ts                   # Add getMoodHistory method
└── components/
    └── MoodTracker/
        └── MoodTracker.tsx              # Integrate MoodHistoryTimeline
package.json                            # Add react-window dependencies
```

### Learnings from Previous Stories

**From Story 5.1 (Mood Emoji Picker Interface)**:
- 12-mood emoji grid established
- MoodType enum: happy, sad, excited, anxious, calm, angry, loving, grateful, tired, energetic, confused, hopeful
- Emoji utility: `getMoodEmoji(moodType)` returns correct emoji string
- Vibration pattern: `navigator.vibrate(15)` for selections

[Source: docs/05-Epics-Stories/5-1-mood-emoji-picker-interface.md]

**From Story 5.2 (Quick Mood Logging Flow)**:
- Optimistic update pattern for instant feedback
- Background sync to Supabase non-blocking
- Success toast with 3-second auto-dismiss
- Performance timing: < 5 seconds from start to save

[Source: docs/05-Epics-Stories/5-2-quick-mood-logging-flow.md]

**From Story 5.3 (Partner Mood Viewing & Transparency)**:
- Real-time partner mood updates via Broadcast API
- Relative time formatting utilities: `getRelativeTime()`, `isJustNow()`
- RLS policies allow partner-only access to mood_entries
- Partner mood display pattern with prominence

[Source: docs/05-Epics-Stories/5-3-partner-mood-viewing-transparency.md]

**From Recent Git Commits**:
- **Commit 9a02e56**: `fix(realtime): replace postgres_changes with Broadcast API for partner mood updates`
  - Use Broadcast API for real-time features (not postgres_changes)
  - Channel naming pattern: `partner-mood:${partnerId}`
- **Commit 2399826**: `fix(e2e): improve authentication handling in mood logging tests`
  - E2E tests must handle welcome screen before navigation
  - Authentication flow critical for test reliability

### Performance Requirements

**Target Metrics** (from Epic 5 requirements):
- **Initial Load**: < 500ms for first 50 entries
- **Subsequent Loads**: < 300ms per pagination batch
- **Scrolling**: Smooth 60fps (< 16.67ms per frame)
- **Memory**: < 100MB for 1000+ entries (via virtualization)

**Virtualization Benefits**:
1. Only renders visible items (typically 10-20 on screen)
2. Recycles DOM nodes as user scrolls
3. Minimal memory footprint regardless of total entry count
4. Smooth scrolling without layout thrashing

**Optimization Strategies**:
- Use `VariableSizeList` for different entry heights (with/without notes)
- Memoize date grouping calculation with `useMemo`
- Implement window resize handling for responsive virtualization
- Profile with Chrome DevTools Performance tab

### Testing Standards

**Unit Testing**:
- Test file pattern: `*.test.ts` or `*.test.tsx`
- Location: Co-located `__tests__/` directories
- Framework: Vitest
- Coverage: Components, hooks, utilities

**E2E Testing**:
- Test file pattern: `*.spec.ts`
- Location: `tests/e2e/`
- Framework: Playwright
- Test selectors: `data-testid` attributes
- Performance profiling: Verify 60fps scrolling, memory usage

**Performance Testing**:
- Chrome DevTools Performance API
- Memory profiling with `performance.memory`
- Frame rate measurement with `requestAnimationFrame`
- Scroll performance with `PerformanceObserver`

### Empty State Handling

**No Mood History**:
```typescript
function EmptyMoodHistoryState() {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📊</div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        No mood history yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        Start logging your moods to see your emotional journey
      </p>
    </div>
  );
}
```

### Accessibility Considerations

**Keyboard Navigation**:
- Timeline scrollable via keyboard (arrow keys, Page Up/Down)
- Tab navigation between My Moods / Partner Moods tabs
- Screen reader announces date headers

**ARIA Labels**:
```typescript
<div
  role="list"
  aria-label="Mood history timeline"
  data-testid="mood-history-timeline"
>
  <div role="listitem" aria-label={`Mood entry: ${mood.mood_type} from ${timestamp}`}>
    {/* Entry content */}
  </div>
</div>
```

### References

**Source Documents**:
- **Epic Source**: [docs/05-Epics-Stories/epics.md](./epics.md) - Epic 5: Story 5.4 Mood History Timeline
- **Architecture**: [docs/02-Architecture/architecture.md](../02-Architecture/architecture.md) - React patterns, Supabase pagination
- **PRD**: [docs/01-PRD/prd.md](../01-PRD/prd.md) - FR25 (mood history timeline)
- **Previous Stories**:
  - [docs/05-Epics-Stories/5-1-mood-emoji-picker-interface.md](./5-1-mood-emoji-picker-interface.md) - Mood types and emoji utilities
  - [docs/05-Epics-Stories/5-2-quick-mood-logging-flow.md](./5-2-quick-mood-logging-flow.md) - Optimistic updates and performance patterns
  - [docs/05-Epics-Stories/5-3-partner-mood-viewing-transparency.md](./5-3-partner-mood-viewing-transparency.md) - Partner viewing and Broadcast API

**Key Functional Requirements Covered**:
- **FR25**: Users can view mood history timeline showing entries over time (AC-5.4.1 through AC-5.4.6)

**Recent Git Commits Referenced**:
- `9a02e56` - Broadcast API patterns for real-time updates
- `2399826` - E2E test authentication improvements

---

## Dev Agent Record

### Context Reference

Context XML will be created by dev workflow automation.

### Agent Model Used

Story created by: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) via BMAD create-story workflow

### Debug Log References

None yet - implementation pending

### Completion Notes List

Implementation pending - story marked as `drafted`

### File List

**Files to Create** (11 new files):
1. `src/components/MoodTracker/MoodHistoryTimeline.tsx` - Main timeline component with virtualization
2. `src/components/MoodTracker/MoodHistoryItem.tsx` - Individual mood entry display component
3. `src/hooks/useMoodHistory.ts` - Pagination hook for loading mood history
4. `src/utils/moodGrouping.ts` - Date grouping utility for timeline organization
5. `src/utils/performanceMonitoring.ts` - Performance measurement utilities
6. `src/components/MoodTracker/__tests__/MoodHistoryTimeline.test.tsx` - Timeline unit tests
7. `src/components/MoodTracker/__tests__/MoodHistoryItem.test.tsx` - Item unit tests
8. `src/hooks/__tests__/useMoodHistory.test.ts` - Hook unit tests
9. `src/utils/__tests__/moodGrouping.test.ts` - Grouping logic unit tests
10. `tests/e2e/mood-history-timeline.spec.ts` - E2E functional tests
11. `tests/e2e/mood-history-performance.spec.ts` - E2E performance tests

**Files to Modify** (3 existing files):
1. `src/services/moodService.ts` - Add `getMoodHistory(userId, offset, limit)` method
2. `src/components/MoodTracker/MoodTracker.tsx` - Integrate MoodHistoryTimeline component with tab switcher
3. `package.json` - Add `react-window`, `react-window-infinite-loader`, `@types/react-window` dependencies

**Total Files**: 14 (11 new + 3 modified)

**Dependencies to Install**:
```bash
npm install react-window react-window-infinite-loader
npm install --save-dev @types/react-window
```

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-02 | Claude Sonnet 4.5 (BMAD Workflow) | Story created via create-story workflow with comprehensive context analysis. Ready for implementation after dependencies installed. |

---

**Story Creation Complete**: All required sections populated with comprehensive developer context, acceptance criteria, implementation tasks, testing requirements, architectural patterns, and performance optimization strategies. Story is marked `drafted` and ready for review and dev agent implementation.
