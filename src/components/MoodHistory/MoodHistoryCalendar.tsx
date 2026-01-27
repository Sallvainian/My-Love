import { useState, useEffect, useCallback, useRef } from 'react';
import { m as motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { moodService } from '../../services/moodService';
import type { MoodEntry } from '../../types';
import {
  generateCalendarDays,
  getMonthName,
  navigateToPreviousMonth,
  navigateToNextMonth,
  formatDateKey,
  getMonthBoundaries,
} from '../../utils/calendarHelpers';
import { MoodDetailModal } from './MoodDetailModal';
import { CalendarDay } from './CalendarDay';

/**
 * Debounce delay for month navigation (Task 9: Performance optimization)
 * Prevents rapid month changes from triggering multiple queries
 */
const MONTH_NAV_DEBOUNCE_MS = 300;

/**
 * MoodHistoryCalendar Component
 * Story 6.3: AC-1 through AC-6 - Mood history calendar view
 *
 * Features:
 * - Calendar month view with 30-31 day grid (AC-1)
 * - Color-coded mood indicators on days with moods (AC-2)
 * - Current date highlighting
 * - Month navigation (prev/next) (AC-3)
 * - Mood detail modal on day tap (AC-4)
 * - Efficient data loading via getMoodsInRange() (AC-5)
 * - Loading state during mood fetch
 * - Responsive layout (mobile < 640px, desktop optimized)
 * - Performance: <200ms render for 30-day month (AC-6)
 */
export function MoodHistoryCalendar() {
  // Current month/year state
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  // Mood data
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [moodMap, setMoodMap] = useState<Map<string, MoodEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Modal state - Task 6: Wire day tap to open modal
  const [selectedMood, setSelectedMood] = useState<MoodEntry | null>(null);

  // Task 9: Navigation debounce to prevent rapid month changes
  const navDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const renderStartTimeRef = useRef<number>(0);

  /**
   * Load moods for visible month
   * AC-5: Uses getMoodsInRange() for efficient queries via by-date index
   * Task 9: Performance measurement and caching
   * Performance: <100ms query time (validated in Story 6.2)
   */
  const loadMoodsForMonth = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    const queryStart = performance.now();

    try {
      const { startOfMonth, endOfMonth } = getMonthBoundaries(year, month);
      const fetchedMoods = await moodService.getMoodsInRange(startOfMonth, endOfMonth);

      const queryTime = performance.now() - queryStart;

      // Create Map for O(1) mood lookups by date
      const map = new Map<string, MoodEntry>();
      fetchedMoods.forEach((mood) => {
        map.set(mood.date, mood);
      });

      setMoods(fetchedMoods);
      setMoodMap(map);

      // Log performance in development (Task 9: Performance measurement)
      if (import.meta.env.DEV) {
        console.log(`[MoodHistoryCalendar] Query time: ${queryTime.toFixed(2)}ms (target: <100ms)`);
      }
    } catch (error) {
      console.error('[MoodHistoryCalendar] Failed to load moods:', error);
      setMoods([]);
      setMoodMap(new Map());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load moods when month changes
  useEffect(() => {
    loadMoodsForMonth(currentYear, currentMonth);
  }, [currentYear, currentMonth, loadMoodsForMonth]);

  /**
   * Navigate to previous month
   * AC-3: Month navigation with year rollover (Dec → Jan prev year)
   * Task 9: Debounced to prevent rapid navigation triggering multiple queries
   */
  const handlePreviousMonth = useCallback(() => {
    if (navDebounceRef.current) {
      clearTimeout(navDebounceRef.current);
    }

    navDebounceRef.current = setTimeout(() => {
      const { year, month } = navigateToPreviousMonth(currentYear, currentMonth);
      setCurrentYear(year);
      setCurrentMonth(month);
    }, MONTH_NAV_DEBOUNCE_MS);
  }, [currentYear, currentMonth]);

  /**
   * Navigate to next month
   * AC-3: Month navigation with year rollover (Dec → Jan next year)
   * Task 9: Debounced to prevent rapid navigation triggering multiple queries
   */
  const handleNextMonth = useCallback(() => {
    if (navDebounceRef.current) {
      clearTimeout(navDebounceRef.current);
    }

    navDebounceRef.current = setTimeout(() => {
      const { year, month } = navigateToNextMonth(currentYear, currentMonth);
      setCurrentYear(year);
      setCurrentMonth(month);
    }, MONTH_NAV_DEBOUNCE_MS);
  }, [currentYear, currentMonth]);

  /**
   * Handle day click - Task 6: Open modal when day with mood is clicked
   * AC-4: Modal opens showing mood details
   */
  const handleDayClick = useCallback((mood: MoodEntry | undefined) => {
    if (mood) {
      setSelectedMood(mood);
    }
  }, []);

  /**
   * Close modal - Task 6: Reset selected mood
   * AC-4: Focus returns to trigger element
   */
  const handleCloseModal = useCallback(() => {
    setSelectedMood(null);
  }, []);

  /**
   * Keyboard navigation support
   * AC-3: Arrow keys for prev/next month
   * Task 9: Cleanup event listeners on unmount
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys if modal is not open (ESC handled in modal)
      if (selectedMood) return;

      if (e.key === 'ArrowLeft') {
        handlePreviousMonth();
      } else if (e.key === 'ArrowRight') {
        handleNextMonth();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePreviousMonth, handleNextMonth, selectedMood]);

  /**
   * Cleanup navigation debounce timer on unmount
   * Task 9: Prevent memory leaks
   */
  useEffect(() => {
    return () => {
      if (navDebounceRef.current) {
        clearTimeout(navDebounceRef.current);
      }
    };
  }, []);

  // Generate calendar grid days (moved before effect that uses it)
  const calendarDays = generateCalendarDays(currentYear, currentMonth);
  const monthName = getMonthName(currentMonth);

  /**
   * Measure render performance (Task 9: Performance optimization)
   * Target: <200ms for 30-day calendar
   */
  useEffect(() => {
    if (!isLoading && calendarDays.length > 0) {
      const renderTime = performance.now() - renderStartTimeRef.current;
      if (import.meta.env.DEV && renderStartTimeRef.current > 0) {
        console.log(
          `[MoodHistoryCalendar] Render time: ${renderTime.toFixed(2)}ms (target: <200ms)`
        );
      }
    }
  }, [isLoading, calendarDays.length]);

  // Track render start time (Task 9: Performance measurement)
  useEffect(() => {
    renderStartTimeRef.current = performance.now();
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6" data-testid="mood-calendar">
      {/* Calendar Header - AC-3: Month/year display with navigation */}
      {/* Task 10: Enhanced ARIA labels for screen readers */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePreviousMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
          aria-label={`Go to previous month from ${monthName} ${currentYear}`}
          data-testid="calendar-nav-prev"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>

        <h2
          className="text-2xl font-semibold text-gray-800"
          data-testid="calendar-month-header"
          aria-live="polite"
          aria-atomic="true"
        >
          {monthName} {currentYear}
        </h2>

        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
          aria-label={`Go to next month from ${monthName} ${currentYear}`}
          data-testid="calendar-nav-next"
        >
          <ChevronRight className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Day of week headers */}
      {/* Task 10: Added role and ARIA for screen reader support */}
      <div className="grid grid-cols-7 gap-2 mb-2" role="row">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-500 py-2"
            role="columnheader"
            aria-label={
              day === 'Sun'
                ? 'Sunday'
                : day === 'Mon'
                  ? 'Monday'
                  : day === 'Tue'
                    ? 'Tuesday'
                    : day === 'Wed'
                      ? 'Wednesday'
                      : day === 'Thu'
                        ? 'Thursday'
                        : day === 'Fri'
                          ? 'Friday'
                          : 'Saturday'
            }
          >
            {day}
          </div>
        ))}
      </div>

      {/* Loading state - AC-5: Show loading skeleton during mood fetch */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-2" data-testid="calendar-loading">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        /* Calendar grid - AC-1: 30-31 day grid with responsive layout */
        /* Task 9: Using memoized CalendarDay component for performance */
        <motion.div
          key={`${currentYear}-${currentMonth}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-7 gap-2"
          role="grid"
          aria-label={`Calendar for ${monthName} ${currentYear}`}
        >
          {calendarDays.map((day, index) => {
            if (!day.date || !day.dayNumber) {
              // Empty cell (padding before/after month)
              return (
                <div
                  key={`empty-${index}`}
                  className="aspect-square"
                  role="gridcell"
                  aria-hidden="true"
                />
              );
            }

            const dateKey = formatDateKey(day.date);
            const mood = moodMap.get(dateKey);

            return (
              <CalendarDay
                key={dateKey}
                dateKey={dateKey}
                dayNumber={day.dayNumber}
                isToday={day.isToday}
                mood={mood}
                monthName={monthName}
                year={currentYear}
                onClick={handleDayClick}
              />
            );
          })}
        </motion.div>
      )}

      {/* Footer: Mood count summary */}
      {!isLoading && moods.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-600">
          {moods.length} {moods.length === 1 ? 'mood' : 'moods'} logged this month
        </div>
      )}

      {/* Mood Detail Modal - Task 6: Render conditionally when mood selected */}
      <MoodDetailModal mood={selectedMood} onClose={handleCloseModal} />
    </div>
  );
}
