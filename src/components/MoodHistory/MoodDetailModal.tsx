import { AnimatePresence, m as motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useRef } from 'react';
import { MOOD_DISPLAY, MOOD_TONE } from '../../constants/moodDisplay';
import { useFocusTrap } from '../../hooks';
import type { MoodEntry } from '../../types';
import { normalizeMoodEntry } from '../../types/moods';
import { formatModalDate, formatModalTime } from '../../utils/calendarHelpers';

interface MoodDetailModalProps {
  mood: MoodEntry | null;
  onClose: () => void;
}

/**
 * MoodDetailModal Component
 * Story 6.3: AC-4 - Modal showing mood details
 *
 * Features:
 * - Displays each mood as a kit icon tile (shared MOOD_DISPLAY map)
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

  // The outer component only mounts this content for a recoverable record.
  const allMoods = mood.moods!;
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
          className="pointer-events-auto relative w-full max-w-md rounded-t-[20px] bg-card p-5 shadow-float sm:rounded-[20px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button - AC-4: X icon in top-right */}
          {/* Task 10: Enhanced focus indicator for keyboard users */}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-card2 text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close mood details modal"
            data-testid="modal-close-button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Mood icons and type - AC-4: one kit icon tile per mood */}
          <div className="mb-5 flex flex-col gap-3 pr-12">
            <div className="flex flex-wrap gap-2" aria-hidden="true">
              {allMoods.map((m, index) => {
                const MoodIcon = MOOD_DISPLAY[m].icon;
                return (
                  <div
                    key={`${m}-${index}`}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${MOOD_TONE.you}`}
                  >
                    <MoodIcon className="h-5 w-5" />
                  </div>
                );
              })}
            </div>
            <div>
              <h2
                id="mood-modal-title"
                className="text-lg font-semibold text-ink"
                data-testid="modal-mood-type"
              >
                {allMoods.map((m) => MOOD_DISPLAY[m].label).join(', ')}
              </h2>
              <p className="mt-0.5 text-sm text-muted">How you were feeling</p>
            </div>
          </div>

          {/* Date and timestamp - AC-4: Formatted display */}
          <div className="mb-5 space-y-2 text-[15px]">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink">Date:</span>
              <span className="text-muted" data-testid="modal-date">
                {formattedDate}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink">Time:</span>
              <span className="text-muted" data-testid="modal-time">
                {formattedTime}
              </span>
            </div>
          </div>

          {/* Note text - AC-4: Display if present */}
          {mood.note && (
            <div className="border-t border-line pt-4">
              <h3 className="mb-2 text-[13px] font-semibold text-ink">Note:</h3>
              <p className="text-[15px] whitespace-pre-wrap text-ink" data-testid="modal-note">
                {mood.note}
              </p>
            </div>
          )}

          {/* No note message */}
          {!mood.note && (
            <div className="border-t border-line pt-4">
              <p className="text-sm text-muted italic">No note for this mood</p>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}

export function MoodDetailModal({ mood, onClose }: MoodDetailModalProps): ReactElement {
  const normalized = mood ? normalizeMoodEntry(mood) : null;
  return (
    <AnimatePresence>{normalized && <MoodDetailContent mood={normalized} onClose={onClose} />}</AnimatePresence>
  );
}
