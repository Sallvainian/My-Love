import { AnimatePresence, m as motion } from 'framer-motion';
import {
  AlertCircle,
  Angry,
  Battery,
  Frown,
  Heart,
  Meh,
  MessageCircle,
  Smile,
  Sparkles,
  UserMinus,
  X,
  Zap,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useRef } from 'react';
import { useFocusTrap } from '../../hooks';
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
  excited: { icon: Zap, color: 'text-amber-500', bgColor: 'bg-amber-100', label: 'Excited' },
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
  angry: { icon: Angry, color: 'text-rose-600', bgColor: 'bg-rose-100', label: 'Angry' },
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
function MoodDetailContent({
  mood,
  onClose,
}: {
  mood: MoodEntry;
  onClose: () => void;
}): ReactElement {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Read moods array, fall back to [mood.mood] for legacy entries
  const allMoods: MoodType[] =
    mood.moods && mood.moods.length > 0 ? mood.moods : [mood.mood as MoodType];

  const primaryMoodConfig = MOOD_CONFIG[allMoods[0]];
  const moodDate = new Date(mood.timestamp);
  const formattedDate = formatModalDate(moodDate);
  const formattedTime = formatModalTime(moodDate);

  // AC-4: Focus trap (WCAG 2.4.3) + ESC to close
  useFocusTrap(modalRef, true, { onEscape: onClose, initialFocusRef: closeButtonRef });

  return (
    <>
      {/* Backdrop - AC-4: Fade in/out */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
        data-testid="modal-backdrop"
      />

      {/* Modal - AC-4: Slide up from bottom */}
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center"
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
          className="pointer-events-auto relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button - AC-4: X icon in top-right */}
          {/* Task 10: Enhanced focus indicator for keyboard users */}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full p-2 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-pink-500 focus:outline-none"
            aria-label="Close mood details modal"
            data-testid="modal-close-button"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>

          {/* Mood icons and type - AC-4: Icons with color */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex gap-2" aria-hidden="true">
              {allMoods.map((m) => {
                const cfg = MOOD_CONFIG[m];
                const MoodIcon = cfg.icon;
                return (
                  <div key={m} className={`rounded-full p-4 ${cfg.bgColor}`}>
                    <MoodIcon className={`h-8 w-8 ${cfg.color}`} />
                  </div>
                );
              })}
            </div>
            <div>
              <h2
                id="mood-modal-title"
                className={`text-2xl font-semibold ${primaryMoodConfig.color}`}
                data-testid="modal-mood-type"
              >
                {allMoods.map((m) => MOOD_CONFIG[m].label).join(', ')}
              </h2>
              <p className="mt-1 text-sm text-gray-500">How you were feeling</p>
            </div>
          </div>

          {/* Date and timestamp - AC-4: Formatted display */}
          <div className="mb-6 space-y-2">
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
              <h3 className="mb-2 text-sm font-medium text-gray-700">Note:</h3>
              <p className="whitespace-pre-wrap text-gray-600" data-testid="modal-note">
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
  );
}

export function MoodDetailModal({ mood, onClose }: MoodDetailModalProps): ReactElement {
  return (
    <AnimatePresence>{mood && <MoodDetailContent mood={mood} onClose={onClose} />}</AnimatePresence>
  );
}
