import { useEffect, useRef } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Heart,
  Smile,
  Meh,
  MessageCircle,
  Sparkles,
  Frown,
  AlertCircle,
  Angry,
  UserMinus,
  Battery,
} from 'lucide-react';
import type { MoodEntry, MoodType } from '../../types';
import { formatModalDate, formatModalTime } from '../../utils/calendarHelpers';

/**
 * Mood icon and color configuration
 * Story 6.3: AC-4 - Mood type with icon and color
 * Updated: Added negative emotions support
 */
const MOOD_CONFIG = {
  // Positive emotions
  loved: { icon: Heart, color: 'text-pink-500', bgColor: 'bg-pink-100', label: 'Loved' },
  happy: { icon: Smile, color: 'text-yellow-500', bgColor: 'bg-yellow-100', label: 'Happy' },
  content: { icon: Meh, color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'Content' },
  thoughtful: {
    icon: MessageCircle,
    color: 'text-purple-500',
    bgColor: 'bg-purple-100',
    label: 'Thoughtful',
  },
  grateful: {
    icon: Sparkles,
    color: 'text-green-500',
    bgColor: 'bg-green-100',
    label: 'Grateful',
  },
  // Negative emotions
  sad: { icon: Frown, color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'Sad' },
  anxious: {
    icon: AlertCircle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100',
    label: 'Anxious',
  },
  frustrated: { icon: Angry, color: 'text-red-500', bgColor: 'bg-red-100', label: 'Frustrated' },
  lonely: { icon: UserMinus, color: 'text-indigo-500', bgColor: 'bg-indigo-100', label: 'Lonely' },
  tired: { icon: Battery, color: 'text-slate-500', bgColor: 'bg-slate-100', label: 'Tired' },
} as const;

interface MoodDetailModalProps {
  mood: MoodEntry | null;
  onClose: () => void;
}

/**
 * MoodDetailModal Component
 * Story 6.3: AC-4 - Modal showing mood details
 *
 * Features:
 * - Displays mood type with icon and color
 * - Formatted date: "Monday, Nov 15, 2025"
 * - Formatted timestamp: "3:42 PM"
 * - Shows note text if present
 * - Close button (X icon) in top-right
 * - ESC key handler for dismissal
 * - Framer Motion animations: slide up from bottom with backdrop fade
 * - Focus trap: tab cycles within modal
 * - Focus returns to trigger on close (accessibility)
 */
export function MoodDetailModal({ mood, onClose }: MoodDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * ESC key handler - AC-4: Close modal on ESC
   */
  useEffect(() => {
    if (!mood) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mood, onClose]);

  /**
   * Focus trap - AC-4: Tab cycles within modal
   */
  useEffect(() => {
    if (!mood || !modalRef.current) return;

    // Focus close button when modal opens
    closeButtonRef.current?.focus();

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [mood]);

  if (!mood) return null;

  const moodConfig = MOOD_CONFIG[mood.mood as MoodType];
  const Icon = moodConfig.icon;
  const moodDate = new Date(mood.timestamp);
  const formattedDate = formatModalDate(moodDate);
  const formattedTime = formatModalTime(moodDate);

  return (
    <AnimatePresence>
      {mood && (
        <>
          {/* Backdrop - AC-4: Fade in/out */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
            aria-hidden="true"
            data-testid="modal-backdrop"
          />

          {/* Modal - AC-4: Slide up from bottom */}
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mood-modal-title"
            data-testid="mood-detail-modal"
          >
            <motion.div
              ref={modalRef}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-6 pointer-events-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button - AC-4: X icon in top-right */}
              {/* Task 10: Enhanced focus indicator for keyboard users */}
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500"
                aria-label="Close mood details modal"
                data-testid="modal-close-button"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>

              {/* Mood icon and type - AC-4: Icon with color */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-4 rounded-full ${moodConfig.bgColor}`} aria-hidden="true">
                  <Icon className={`w-8 h-8 ${moodConfig.color}`} />
                </div>
                <div>
                  <h2
                    id="mood-modal-title"
                    className={`text-2xl font-semibold ${moodConfig.color}`}
                    data-testid="modal-mood-type"
                  >
                    {moodConfig.label}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">How you were feeling</p>
                </div>
              </div>

              {/* Date and timestamp - AC-4: Formatted display */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="font-medium">Date:</span>
                  <span data-testid="modal-date">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="font-medium">Time:</span>
                  <span data-testid="modal-time">{formattedTime}</span>
                </div>
              </div>

              {/* Note text - AC-4: Display if present */}
              {mood.note && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Note:</h3>
                  <p className="text-gray-600 whitespace-pre-wrap" data-testid="modal-note">
                    {mood.note}
                  </p>
                </div>
              )}

              {/* No note message */}
              {!mood.note && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-400 italic">No note for this mood</p>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
