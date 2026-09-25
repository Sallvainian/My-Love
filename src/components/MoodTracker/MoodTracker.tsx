import { AnimatePresence, m as motion } from 'framer-motion';
import { CircleCheckBig, Cloud, CloudOff, Plus, RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useState, type SubmitEvent } from 'react';
import { getPartnerId } from '../../api/supabaseClient';
import { CHALLENGING_MOODS, MOOD_DISPLAY, POSITIVE_MOODS } from '../../constants/moodDisplay';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../stores/useAppStore';
import type { MoodEntry, MoodType } from '../../types';
import { normalizeMoodEntry } from '../../types/moods';
import { registerBackgroundSync } from '../../utils/backgroundSync';
import { formatDateISO } from '../../utils/dateUtils';
import { triggerErrorHaptic, triggerMoodSaveHaptic } from '../../utils/haptics';
import { logger } from '../../utils/logger';
import { isOffline, OFFLINE_ERROR_MESSAGE } from '../../utils/offlineErrorHandler';
import { isValidationError } from '../../validation/errorMessages';
import { MoodHistoryCalendar } from '../MoodHistory';
import { SECTION_LABEL } from '../shared/kitClasses';
import { MoodButton } from './MoodButton';
import { MoodHistoryTimeline } from './MoodHistoryTimeline';
import { PartnerMoodDisplay } from './PartnerMoodDisplay';

// Tab types for navigation
type MoodTabType = 'tracker' | 'history' | 'timeline';

/** Segmented control: the tab key (also its testid suffix) and its label. */
const MOOD_TABS: readonly { key: MoodTabType; label: string }[] = [
  { key: 'tracker', label: 'Log' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'history', label: 'Calendar' },
];

/**
 * MoodTracker Component
 * Story 6.2: AC-1 through AC-7 - Complete mood tracking UI
 * Story 6.3: Task 7 - Integrated with MoodHistoryCalendar via tab navigation
 *
 * Features:
 * - 5 mood type buttons with icons and animations
 * - Optional note input with 200-char counter
 * - Form validation using MoodEntrySchema
 * - Optimistic UI updates
 * - Success feedback (toast animation)
 * - One mood per day constraint (pre-populate if exists)
 * - Sync status indicator
 * - Tab navigation: Log Mood / History (Story 6.3)
 */
export function MoodTracker() {
  const { addMoodEntry, getMoodForDate, syncStatus, loadMoods, syncPendingMoods, updateSyncStatus } =
    useAppStore();
  const moods = useAppStore((s) => s.moods);
  const { user } = useAuth();

  // Story 5.2: AC-5.2.1 - Performance timing for < 5 second flow validation
  const [mountTime] = useState(() => performance.now());

  // Tab navigation state (Story 6.3: Task 7)
  const [activeTab, setActiveTab] = useState<MoodTabType>('tracker');

  // Page subtitle, e.g. "Tuesday, September 22". Read on every render so it names the same
  // fresh "today" that addMoodEntry saves under, even with the view left open past midnight.
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Form state - now supports multiple mood selection
  const [selectedMoods, setSelectedMoods] = useState<MoodType[]>([]);
  const [note, setNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Story 5.2: Note field collapsed by default (tech debt fix)
  const [showNoteField, setShowNoteField] = useState(false);

  // Story 1.5: Offline error state with retry action (AC-1.5.3)
  const [offlineError, setOfflineError] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Story 5.3: Partner mood viewing (AC-5.3.1) - cached to avoid re-fetching
  const [partnerId, setPartnerId] = useState<string | null>(null);

  // Character counter
  const maxNoteLength = 200;
  const remainingChars = maxNoteLength - note.length;

  // Load moods on mount
  useEffect(() => {
    loadMoods();
    // The pending-sync badge below is the only signal an offline user has that
    // their moods have not left the device. `updateSyncStatus` counts nothing
    // when `userId` is null, and App.tsx's unconditional call runs once on
    // mount before auth resolves — authSlice is deliberately not persisted, so
    // that is every cold start. Every other trigger needs a connectivity
    // transition or the network. This effect runs post-auth, which is the only
    // place the count is knowable offline.
    updateSyncStatus();
  }, [loadMoods, updateSyncStatus]);

  // Load partner ID for partner mood display (Story 5.3) - only once on mount
  useEffect(() => {
    let mounted = true;

    async function loadPartnerId() {
      const id = await getPartnerId();
      if (mounted) {
        setPartnerId(id);
      }
    }

    loadPartnerId();

    return () => {
      mounted = false;
    };
  }, []);

  // Seed the form from today's saved entry (AC-5). This used to be an effect keyed on
  // `moods`, which cost a second commit every time it fired — the store outlives this view,
  // so returning to the Mood tab could paint an empty form for a frame before the saved
  // entry landed in it. Adjusting state during render collapses that into one commit.
  //
  // The trigger is deliberately unchanged: first render, then any render where `moods` is a
  // different array than the one already seeded from. That fires more often than the
  // contents actually change, since loadMoods hands back a fresh array after every sync,
  // and reseeding overwrites whatever is in the form — exactly what the effect did. The
  // `null` sentinel is what makes the first render count; seeding it from `moods` would skip
  // a remount where the store is already populated.
  //
  // The `new Date()` below is an impure read that has moved into the render path. It runs
  // only inside this branch, and only to pick which saved entry to seed from, so the worst
  // it can do is straddle a midnight rollover — the same exposure the effect had. Note that
  // react-hooks/purity does not flag `new Date()` (it flags `Date.now()`), so the linter
  // will not catch it if this block is ever widened to run on every render.
  const [seededFrom, setSeededFrom] = useState<MoodEntry[] | null>(null);
  if (moods !== seededFrom) {
    setSeededFrom(moods);

    const today = formatDateISO(new Date());
    const rawMood = getMoodForDate(today);
    const existingMood = rawMood ? normalizeMoodEntry(rawMood) : null;

    if (existingMood) {
      setSelectedMoods(existingMood.moods);
      setNote(existingMood.note || '');
      setIsEditing(true);
      // Auto-expand note field if existing mood has a note
      if (existingMood.note) {
        setShowNoteField(true);
      }
    }
    // No `else` that clears the form. The trigger above is `moods` ARRAY IDENTITY,
    // and loadMoods hands back a fresh array after every sync pass — App.tsx runs
    // one on a 5-minute interval and on every `online` event. On the ordinary
    // first-entry-of-the-day path there is no saved row to seed from, so an `else`
    // here fires on that timer and wipes the moods the user just tapped and the
    // note they are still typing, mid-keystroke. Reseeding only overwrites the
    // form when there is a saved entry to overwrite it WITH, which is the
    // behaviour this block has always had.
  }

  const handleMoodSelect = (mood: MoodType) => {
    setSelectedMoods((prev) => {
      if (prev.includes(mood)) {
        // Deselect if already selected
        return prev.filter((m) => m !== mood);
      } else {
        // Add to selection
        return [...prev, mood];
      }
    });
    setError(null);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNote = e.target.value;
    if (newNote.length <= maxNoteLength) {
      setNote(newNote);
      setNoteError(null);
    }
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (selectedMoods.length === 0) {
      setError('Please select at least one mood');
      return;
    }

    // Story 1.5: Clear previous offline error state (AC-1.5.3)
    setOfflineError(false);

    try {
      setIsSubmitting(true);
      setError(null);
      setNoteError(null);

      // Pass all selected moods to addMoodEntry (first mood becomes primary for backward compat)
      await addMoodEntry(selectedMoods, note.trim() || undefined);

      // Show success feedback
      setShowSuccess(true);
      triggerMoodSaveHaptic(); // Story 5.2: AC-5.2.2 - Haptic feedback on successful save
      setTimeout(() => setShowSuccess(false), 3000);

      logger.debug('[MoodTracker] Mood entry saved successfully:', selectedMoods);
      logger.debug(
        `[Mood Log] Complete flow: ${(performance.now() - mountTime).toFixed(0)}ms (target: <5000ms)`
      );

      // Story 1.5: Show offline notification and register background sync (AC-1.5.3)
      // Note: syncPendingMoods is already called inside addMoodEntry (moodSlice) when online,
      // so we only need to handle the offline case here.
      if (!syncStatus.isOnline) {
        setOfflineError(true);
        registerBackgroundSync('sync-pending-moods').catch((syncError) => {
          console.error('[MoodTracker] Failed to register background sync:', syncError);
        });
      }
    } catch (err) {
      console.error('[MoodTracker] Failed to save mood entry:', err);
      triggerErrorHaptic(); // Story 5.2: AC-5.2.2 - Error haptic feedback

      // Handle validation errors with field-specific messages (Story 5.5)
      if (isValidationError(err)) {
        const fieldErrors = err.fieldErrors;

        if (fieldErrors.has('note')) {
          setNoteError(fieldErrors.get('note') || null);
        }
        if (fieldErrors.has('mood')) {
          setError(fieldErrors.get('mood') || null);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to save mood entry. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Story 1.5: Retry sync when back online (AC-1.5.3)
  const handleRetrySync = async () => {
    if (isOffline()) {
      // Still offline - show feedback
      logger.debug('[MoodTracker] Retry blocked - still offline');
      return;
    }

    setIsRetrying(true);
    try {
      const result = await syncPendingMoods();

      // A skipped batch attempted nothing — another tab or the service worker
      // holds the lock. Clearing the banner and flashing success here would
      // tell the user their moods are safely uploaded when they are still
      // pending. Leave the banner up; the context that owns the batch is
      // already syncing them.
      if (result.skipped) {
        logger.debug('[MoodTracker] Retry skipped - another context is syncing');
        return;
      }

      setOfflineError(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      logger.debug('[MoodTracker] Retry sync successful');
    } catch (err) {
      console.error('[MoodTracker] Retry sync failed:', err);
      setError('Sync failed. Please try again later.');
    } finally {
      setIsRetrying(false);
    }
  };

  const isValid = selectedMoods.length > 0;

  return (
    <div className="min-h-screen bg-page" data-testid="mood-tracker">
      {/* Page title, above the segmented control on every tab */}
      <header className="mx-auto flex max-w-2xl flex-col gap-1 px-5 pt-4">
        <h1 className="font-serif text-[30px] leading-[1.1] font-semibold text-ink">
          How are you feeling?
        </h1>
        <p className="text-sm text-muted">{todayLabel}</p>
      </header>

      {/* Segmented control - Story 5.4: Log / Timeline / Calendar */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-10 bg-page">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex rounded-full bg-card2 p-1">
            {MOOD_TABS.map(({ key, label }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`h-9 flex-1 rounded-full text-sm font-semibold transition-colors ${
                    isActive ? 'bg-card text-ink shadow-sm' : 'text-muted'
                  }`}
                  aria-pressed={isActive}
                  data-testid={`mood-tab-${key}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content - the view's one horizontal gutter. `overflow-x-clip`
          keeps the tabs' sideways enter/exit slide from widening the page. */}
      <div className="mx-auto max-w-2xl overflow-x-clip px-4 pt-1 pb-6">
        <AnimatePresence mode="wait">
          {activeTab === 'tracker' ? (
            <motion.div
              key="tracker"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              {/* Story 5.3: Partner Mood Display (AC-5.3.1, AC-5.3.2) */}
              {partnerId && <PartnerMoodDisplay partnerId={partnerId} />}

              {/* Success Toast (AC-4) */}
              <AnimatePresence>
                {showSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex items-center gap-2 rounded-[20px] border border-line bg-card p-3.5 text-ink shadow-card"
                    data-testid="mood-success-toast"
                  >
                    <CircleCheckBig className="h-5 w-5 shrink-0 text-good" aria-hidden="true" />
                    <span className="text-[15px] font-medium">
                      {isEditing ? 'Mood updated successfully!' : 'Mood logged successfully!'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Story 1.5: Offline Error with Retry Button (AC-1.5.3) */}
              <AnimatePresence>
                {offlineError && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-line bg-card p-3.5 shadow-card"
                    data-testid="mood-offline-error"
                  >
                    <div className="flex items-center gap-2">
                      <WifiOff className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                      <span className="text-sm text-ink">{OFFLINE_ERROR_MESSAGE}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetrySync}
                      disabled={isRetrying}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-semibold text-accent transition-opacity disabled:opacity-50"
                      data-testid="mood-retry-button"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      {isRetrying ? 'Syncing...' : 'Retry'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Display */}
              {error && (
                <div
                  className="rounded-[20px] bg-dtint p-3.5 text-sm text-danger"
                  data-testid="mood-error-message"
                >
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Mood Selection - Multiple selection support */}
                <div className="flex flex-col gap-2.5">
                  <p className={SECTION_LABEL}>Positive</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {POSITIVE_MOODS.map((mood) => (
                      <MoodButton
                        key={mood}
                        mood={mood}
                        icon={MOOD_DISPLAY[mood].icon}
                        label={MOOD_DISPLAY[mood].label}
                        isSelected={selectedMoods.includes(mood)}
                        onClick={() => handleMoodSelect(mood)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <p className={SECTION_LABEL}>Challenging</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {CHALLENGING_MOODS.map((mood) => (
                      <MoodButton
                        key={mood}
                        mood={mood}
                        icon={MOOD_DISPLAY[mood].icon}
                        label={MOOD_DISPLAY[mood].label}
                        isSelected={selectedMoods.includes(mood)}
                        onClick={() => handleMoodSelect(mood)}
                      />
                    ))}
                  </div>
                </div>

                {/* Selection summary + Sync Status Indicator (AC-7), one muted row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[13px] text-muted">
                  {selectedMoods.length > 0 && (
                    <span className="min-w-0">
                      Selected: {selectedMoods.map((m) => MOOD_DISPLAY[m].label).join(', ')}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    {syncStatus.isOnline ? (
                      <>
                        <Cloud className="h-4 w-4 text-good" aria-hidden="true" />
                        <span>Online</span>
                      </>
                    ) : (
                      <>
                        <CloudOff className="h-4 w-4" aria-hidden="true" />
                        <span>Offline</span>
                      </>
                    )}
                    {syncStatus.pendingMoods > 0 && (
                      <span>({syncStatus.pendingMoods} pending sync)</span>
                    )}
                  </span>
                </div>

                {/* Note Input (AC-3) - Collapsed by default for faster flow */}
                <div>
                  {showNoteField ? (
                    <>
                      <label
                        htmlFor="mood-note"
                        className="mb-2 block text-[13px] font-semibold text-ink"
                      >
                        Add a note (optional)
                      </label>
                      <textarea
                        id="mood-note"
                        value={note}
                        onChange={handleNoteChange}
                        placeholder="What made you feel this way?"
                        rows={4}
                        maxLength={200}
                        className={`w-full resize-none rounded-[14px] bg-field px-4 py-3 text-base text-ink ring-inset placeholder:text-muted focus:ring-2 focus:outline-hidden ${
                          noteError
                            ? 'ring-2 ring-danger focus:ring-danger'
                            : 'ring-1 ring-line-strong focus:ring-accent'
                        }`}
                        data-testid="mood-note-input"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        {noteError ? (
                          <span className="text-sm text-danger" data-testid="mood-note-error">
                            {noteError}
                          </span>
                        ) : (
                          <span className="text-sm text-muted">Share your thoughts</span>
                        )}
                        <span
                          className={`text-sm ${remainingChars < 20 ? 'text-accent' : 'text-muted'}`}
                          data-testid="mood-char-counter"
                        >
                          {remainingChars}/{maxNoteLength}
                        </span>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNoteField(true)}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-semibold text-accent"
                      data-testid="mood-add-note-toggle"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add note (optional)
                    </button>
                  )}
                </div>

                {/* Submit Button (AC-4, AC-5) */}
                <button
                  type="submit"
                  disabled={!isValid || isSubmitting}
                  className={`h-12 w-full rounded-full px-6 text-[15px] font-semibold transition-colors ${
                    isValid && !isSubmitting
                      ? 'bg-fill text-white'
                      : 'cursor-not-allowed bg-card2 text-muted'
                  }`}
                  data-testid="mood-submit-button"
                >
                  {isSubmitting ? 'Saving...' : isEditing ? 'Update Mood' : 'Log Mood'}
                </button>
              </form>
            </motion.div>
          ) : activeTab === 'timeline' ? (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2.5"
              data-testid="mood-history-section"
            >
              <h2 className={SECTION_LABEL}>Mood Timeline</h2>

              {/* Timeline view - Story 5.4 */}
              <div
                className="overflow-hidden rounded-[20px] border border-line bg-card shadow-card"
                data-testid="mood-timeline-card"
              >
                {user && <MoodHistoryTimeline userId={user.id} />}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* MoodHistoryCalendar - Story 6.3: Task 7 */}
              <MoodHistoryCalendar />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
