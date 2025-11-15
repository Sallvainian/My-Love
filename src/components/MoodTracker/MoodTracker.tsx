import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Smile, Meh, MessageCircle, Sparkles, Cloud, CloudOff, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { MoodButton } from './MoodButton';
import type { MoodType } from '../../types';
import { isValidationError } from '../../validation/errorMessages';

// Mood icon mapping per story requirements
const MOOD_CONFIG = {
  loved: { icon: Heart, label: 'Loved' },
  happy: { icon: Smile, label: 'Happy' },
  content: { icon: Meh, label: 'Content' },
  thoughtful: { icon: MessageCircle, label: 'Thoughtful' },
  grateful: { icon: Sparkles, label: 'Grateful' },
} as const;

/**
 * MoodTracker Component
 * Story 6.2: AC-1 through AC-7 - Complete mood tracking UI
 *
 * Features:
 * - 5 mood type buttons with icons and animations
 * - Optional note input with 200-char counter
 * - Form validation using MoodEntrySchema
 * - Optimistic UI updates
 * - Success feedback (toast animation)
 * - One mood per day constraint (pre-populate if exists)
 * - Sync status indicator
 */
export function MoodTracker() {
  const { addMoodEntry, getMoodForDate, syncStatus, loadMoods } = useAppStore();

  // Form state
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [note, setNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Character counter
  const maxNoteLength = 200;
  const remainingChars = maxNoteLength - note.length;

  // Load moods on mount
  useEffect(() => {
    loadMoods();
  }, [loadMoods]);

  // Check if mood already exists for today (AC-5)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const existingMood = getMoodForDate(today);

    if (existingMood) {
      setSelectedMood(existingMood.mood);
      setNote(existingMood.note || '');
      setIsEditing(true);
    }
  }, [getMoodForDate]);

  const handleMoodSelect = (mood: MoodType) => {
    setSelectedMood(mood);
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

    if (!selectedMood) {
      setError('Please select a mood');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setNoteError(null);

      // Add or update mood entry via Zustand action (which calls MoodService)
      await addMoodEntry(selectedMood, note.trim() || undefined);

      // Show success feedback
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      if (import.meta.env.DEV) {
        console.log('[MoodTracker] Mood entry saved successfully');
      }
    } catch (err) {
      console.error('[MoodTracker] Failed to save mood entry:', err);

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

  const isValid = selectedMood !== null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20" data-testid="mood-tracker">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">How are you feeling?</h1>
          <p className="text-gray-600">Track your mood for today</p>
        </div>

        {/* Sync Status Indicator (AC-7) */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          {syncStatus.isOnline ? (
            <>
              <Cloud className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">Online</span>
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Offline</span>
            </>
          )}
          {syncStatus.pendingMoods > 0 && (
            <span className="ml-2 text-gray-500">
              ({syncStatus.pendingMoods} pending sync)
            </span>
          )}
        </div>

        {/* Success Toast (AC-4) */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800"
              data-testid="mood-success-toast"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">
                {isEditing ? 'Mood updated successfully!' : 'Mood logged successfully!'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        {error && (
          <div
            className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800"
            data-testid="mood-error-message"
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mood Selection (AC-2) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select your mood
            </label>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {(Object.keys(MOOD_CONFIG) as MoodType[]).map((mood) => (
                <MoodButton
                  key={mood}
                  mood={mood}
                  icon={MOOD_CONFIG[mood].icon}
                  label={MOOD_CONFIG[mood].label}
                  isSelected={selectedMood === mood}
                  onClick={() => handleMoodSelect(mood)}
                />
              ))}
            </div>
          </div>

          {/* Note Input (AC-3) */}
          <div>
            <label htmlFor="mood-note" className="block text-sm font-medium text-gray-700 mb-2">
              Add a note (optional)
            </label>
            <textarea
              id="mood-note"
              value={note}
              onChange={handleNoteChange}
              placeholder="What made you feel this way?"
              rows={4}
              maxLength={200}
              className={`w-full px-4 py-3 border rounded-lg resize-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${
                noteError ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              data-testid="mood-note-input"
            />
            <div className="flex items-center justify-between mt-2">
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
          </div>

          {/* Submit Button (AC-4, AC-5) */}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
              isValid && !isSubmitting
                ? 'bg-pink-500 hover:bg-pink-600 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            data-testid="mood-submit-button"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Mood' : 'Log Mood'}
          </button>
        </form>
      </div>
    </div>
  );
}
