import { AnimatePresence, m as motion } from 'framer-motion';
import {
  AlertCircle,
  Angry,
  Battery,
  Calendar,
  CheckCircle,
  Cloud,
  CloudOff,
  Frown,
  Heart,
  List,
  Meh,
  MessageCircle,
  RefreshCw,
  Smile,
  Sparkles,
  UserMinus,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPartnerId } from '../../api/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../stores/useAppStore';
import type { MoodType } from '../../types';
import { registerBackgroundSync } from '../../utils/backgroundSync';
import { triggerErrorHaptic, triggerMoodSaveHaptic } from '../../utils/haptics';
import { logger } from '../../utils/logger';
import { isOffline, OFFLINE_ERROR_MESSAGE } from '../../utils/offlineErrorHandler';
import { isValidationError } from '../../validation/errorMessages';
import { MoodHistoryCalendar } from '../MoodHistory';
import { MoodButton } from './MoodButton';
import { MoodHistoryTimeline } from './MoodHistoryTimeline';
import { PartnerMoodDisplay } from './PartnerMoodDisplay';

// Mood icon mapping - positive and challenging emotions (12 total for 3x4 grid)
const POSITIVE_MOODS = {
  loved: { icon: Heart, label: 'Loved' },
  happy: { icon: Smile, label: 'Happy' },
  content: { icon: Meh, label: 'Content' },
  excited: { icon: Zap, label: 'Excited' },
  thoughtful: { icon: MessageCircle, label: 'Thoughtful' },
  grateful: { icon: Sparkles, label: 'Grateful' },
} as const;

const CHALLENGING_MOODS = {
  sad: { icon: Frown, label: 'Sad' },
  anxious: { icon: AlertCircle, label: 'Anxious' },
  frustrated: { icon: Angry, label: 'Frustrated' },
  angry: { icon: Angry, label: 'Angry' },
  lonely: { icon: UserMinus, label: 'Lonely' },
  tired: { icon: Battery, label: 'Tired' },
} as const;

const MOOD_CONFIG = { ...POSITIVE_MOODS, ...CHALLENGING_MOODS } as const;

// Tab types for navigation
type MoodTabType = 'tracker' | 'history' | 'timeline';

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
  const { addMoodEntry, getMoodForDate, syncStatus, loadMoods, syncPendingMoods } = useAppStore();
  const { user } = useAuth();

  // Story 5.2: AC-5.2.1 - Performance timing for < 5 second flow validation
  const [mountTime] = useState(() => performance.now());

  // Tab navigation state (Story 6.3: Task 7)
  const [activeTab, setActiveTab] = useState<MoodTabType>('tracker');

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
  }, [loadMoods]);

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

  // Check if mood already exists for today (AC-5)
  useEffect(() => {
    const today = formatDateISO(new Date());
    const existingMood = getMoodForDate(today);

    if (existingMood) {
      // Support both old single mood and new multiple moods
      if (existingMood.moods && existingMood.moods.length > 0) {
        setSelectedMoods(existingMood.moods);
      } else {
        setSelectedMoods([existingMood.mood]);
      }
      setNote(existingMood.note || '');
      setIsEditing(true);
      // Auto-expand note field if existing mood has a note
      if (existingMood.note) {
        setShowNoteField(true);
      }
    }
  }, [getMoodForDate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
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

      // Story 6.4: AC #1 - Trigger background sync after mood entry
      // Run in background (don't await) - sync should not block UI
      if (syncStatus.isOnline) {
        syncPendingMoods().catch((syncError) => {
          // Log sync errors but don't show to user (graceful degradation)
          console.error('[MoodTracker] Background sync failed:', syncError);
        });
      } else {
        // Story 1.5: Show offline notification and register background sync (AC-1.5.3)
        setOfflineError(true);
        // Register background sync to sync when connection is restored
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
      await syncPendingMoods();
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
    <div className="min-h-screen bg-gray-50 pb-20" data-testid="mood-tracker">
      {/* Tab Navigation - Story 5.4: Added Timeline tab */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('tracker')}
              className={`relative flex-1 px-4 py-4 text-center font-medium transition-colors ${
                activeTab === 'tracker' ? 'text-pink-600' : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="mood-tab-tracker"
            >
              Log Mood
              {activeTab === 'tracker' && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute right-0 bottom-0 left-0 h-0.5 bg-pink-600"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`relative flex flex-1 items-center justify-center gap-2 px-4 py-4 text-center font-medium transition-colors ${
                activeTab === 'timeline' ? 'text-pink-600' : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="mood-tab-timeline"
            >
              <List className="h-4 w-4" />
              Timeline
              {activeTab === 'timeline' && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute right-0 bottom-0 left-0 h-0.5 bg-pink-600"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`relative flex flex-1 items-center justify-center gap-2 px-4 py-4 text-center font-medium transition-colors ${
                activeTab === 'history' ? 'text-pink-600' : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="mood-tab-history"
            >
              <Calendar className="h-4 w-4" />
              Calendar
              {activeTab === 'history' && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute right-0 bottom-0 left-0 h-0.5 bg-pink-600"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content - Story 5.4: Added Timeline tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'tracker' ? (
          <motion.div
            key="tracker"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-2xl px-4 py-6"
          >
            {/* Header */}
            <div className="mb-6">
              <h1 className="mb-2 text-3xl font-bold text-gray-900">How are you feeling?</h1>
              <p className="text-gray-600">Track your mood for today</p>
            </div>

            {/* Story 5.3: Partner Mood Display (AC-5.3.1, AC-5.3.2) */}
            {partnerId && <PartnerMoodDisplay partnerId={partnerId} />}

            {/* Sync Status Indicator (AC-7) */}
            <div className="mb-6 flex items-center gap-2 text-sm">
              {syncStatus.isOnline ? (
                <>
                  <Cloud className="h-4 w-4 text-green-500" />
                  <span className="text-gray-600">Online</span>
                </>
              ) : (
                <>
                  <CloudOff className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Offline</span>
                </>
              )}
              {syncStatus.pendingMoods > 0 && (
                <span className="ml-2 text-gray-500">({syncStatus.pendingMoods} pending sync)</span>
              )}
            </div>

            {/* Success Toast (AC-4) */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
                  data-testid="mood-success-toast"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">
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
                  className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4"
                  data-testid="mood-offline-error"
                >
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-5 w-5 shrink-0 text-yellow-600" />
                    <span className="text-sm text-yellow-800">{OFFLINE_ERROR_MESSAGE}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetrySync}
                    disabled={isRetrying}
                    className="flex items-center gap-1.5 rounded-md bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-700 transition-colors hover:bg-yellow-200 disabled:opacity-50"
                    data-testid="mood-retry-button"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Syncing...' : 'Retry'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Display */}
            {error && (
              <div
                className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
                data-testid="mood-error-message"
              >
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Mood Selection - Multiple selection support */}
              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700">
                  How are you feeling? (select all that apply)
                </label>

                {/* Positive Emotions - 6 moods in 2 rows of 3 */}
                <div className="mb-4">
                  <p className="mb-2 text-xs tracking-wide text-gray-500 uppercase">Positive</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.keys(POSITIVE_MOODS) as MoodType[]).map((mood) => (
                      <MoodButton
                        key={mood}
                        mood={mood}
                        icon={MOOD_CONFIG[mood].icon}
                        label={MOOD_CONFIG[mood].label}
                        isSelected={selectedMoods.includes(mood)}
                        onClick={() => handleMoodSelect(mood)}
                      />
                    ))}
                  </div>
                </div>

                {/* Challenging Emotions - 6 moods in 2 rows of 3 */}
                <div>
                  <p className="mb-2 text-xs tracking-wide text-gray-500 uppercase">Challenging</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.keys(CHALLENGING_MOODS) as MoodType[]).map((mood) => (
                      <MoodButton
                        key={mood}
                        mood={mood}
                        icon={MOOD_CONFIG[mood].icon}
                        label={MOOD_CONFIG[mood].label}
                        isSelected={selectedMoods.includes(mood)}
                        onClick={() => handleMoodSelect(mood)}
                      />
                    ))}
                  </div>
                </div>

                {selectedMoods.length > 0 && (
                  <p className="mt-3 text-sm text-gray-600">
                    Selected: {selectedMoods.map((m) => MOOD_CONFIG[m].label).join(', ')}
                  </p>
                )}
              </div>

              {/* Note Input (AC-3) - Collapsed by default for faster flow */}
              <div>
                {showNoteField ? (
                  <>
                    <label
                      htmlFor="mood-note"
                      className="mb-2 block text-sm font-medium text-gray-700"
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
                      className={`w-full resize-none rounded-lg border px-4 py-3 transition-colors focus:border-transparent focus:ring-2 focus:ring-pink-500 ${
                        noteError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      data-testid="mood-note-input"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      {noteError ? (
                        <span className="text-sm text-red-600" data-testid="mood-note-error">
                          {noteError}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">Share your thoughts</span>
                      )}
                      <span
                        className={`text-sm ${remainingChars < 20 ? 'text-orange-600' : 'text-gray-500'}`}
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
                    className="text-sm text-gray-500 transition-colors hover:text-pink-600"
                    data-testid="mood-add-note-toggle"
                  >
                    + Add note (optional)
                  </button>
                )}
              </div>

              {/* Submit Button (AC-4, AC-5) */}
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className={`w-full rounded-lg px-6 py-3 font-medium transition-colors ${
                  isValid && !isSubmitting
                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400'
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
            className="mx-auto max-w-2xl px-4 py-6"
            data-testid="mood-history-section"
          >
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-(--color-text)">Mood Timeline</h2>
              <p className="text-(--color-text) opacity-70">View your mood history over time</p>
            </div>

            {/* Timeline view - Story 5.4 */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
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
  );
}
