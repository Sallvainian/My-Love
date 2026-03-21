/**
 * ReadingPhaseView Component
 *
 * Renders the main reading phase of the solo reading flow:
 * verse/response screens, progress header, action buttons,
 * offline/error indicators, and exit confirmation dialog.
 */

import { AnimatePresence, LazyMotion, m } from 'framer-motion';
import { type RefObject } from 'react';
import { MAX_STEPS, SCRIPTURE_STEPS } from '../../../data/scriptureSteps';
import { FOCUS_RING, scriptureTheme } from '../constants';
import type { SlideDirection } from '../hooks/useSoloReadingFlow';
import { BookmarkFlag } from '../reading/BookmarkFlag';

const loadMotionFeatures = () => import('../motionFeatures').then((module) => module.default);

interface ReadingPhaseViewProps {
  session: { currentStepIndex: number };
  state: {
    subView: 'verse' | 'response';
    slideDirection: SlideDirection;
    showExitConfirm: boolean;
    isOnline: boolean;
    isSyncing: boolean;
    isNextDisabled: boolean;
    isLastStep: boolean;
    scriptureError: { message: string } | string | null;
    pendingRetry: { attempts: number; maxAttempts: number } | null;
    bookmarkedSteps: Set<number>;
    announcement: string;
  };
  animations: {
    crossfade: { duration: number };
    slide: { duration: number };
  };
  elementRefs: {
    verseHeading: RefObject<HTMLParagraphElement | null>;
    backToVerse: RefObject<HTMLButtonElement | null>;
    exitButton: RefObject<HTMLButtonElement | null>;
    dialog: RefObject<HTMLDivElement | null>;
  };
  handlers: {
    onBookmarkToggle: () => void;
    onNextVerse: () => Promise<void>;
    onViewResponse: () => void;
    onBackToVerse: () => void;
    onExitRequest: () => void;
    onExitCancel: () => void;
    onSaveAndExit: () => Promise<void>;
    onRetryFailedWrite: () => void;
  };
}

export function ReadingPhaseView({
  session,
  state,
  animations,
  elementRefs,
  handlers,
}: ReadingPhaseViewProps) {
  const {
    verseHeading: verseHeadingRef,
    backToVerse: backToVerseRef,
    exitButton: exitButtonRef,
    dialog: dialogRef,
  } = elementRefs;
  const currentStep = SCRIPTURE_STEPS[session.currentStepIndex];

  // Guard: currentStep should always exist for valid step index
  if (!currentStep) return null;

  // Animation variants
  const slideVariants = {
    enter: (direction: SlideDirection) => ({
      x: direction === 'left' ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: SlideDirection) => ({
      x: direction === 'left' ? -100 : 100,
      opacity: 0,
    }),
  };

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <div
        className="flex min-h-screen flex-col pb-20"
        style={{ backgroundColor: scriptureTheme.background }}
        data-testid="solo-reading-flow"
      >
        {/* Screen reader announcer */}
        <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
          {state.announcement}
        </div>

        {/* Header with exit button and progress */}
        <header className="mx-auto flex w-full max-w-md items-center justify-between p-4">
          <button
            ref={exitButtonRef}
            onClick={handlers.onExitRequest}
            className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg p-2 text-purple-600 transition-colors hover:text-purple-800 ${FOCUS_RING}`}
            aria-label="Exit reading"
            data-testid="exit-button"
            type="button"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Progress indicator */}
          <span
            className="text-sm font-medium text-purple-600"
            aria-label={`Currently on verse ${session.currentStepIndex + 1} of ${MAX_STEPS}`}
            aria-current="step"
            data-testid="scripture-progress-indicator"
          >
            Verse {session.currentStepIndex + 1} of {MAX_STEPS}
          </span>

          {/* Section theme badge */}
          <span
            className="max-w-[100px] truncate text-right text-xs text-purple-600"
            data-testid="section-theme"
          >
            {currentStep.sectionTheme}
          </span>
        </header>

        {/* Main content area */}
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4">
          <AnimatePresence mode="wait" custom={state.slideDirection}>
            <m.div
              key={`step-${session.currentStepIndex}-${state.subView}`}
              custom={state.slideDirection}
              variants={state.subView === 'verse' ? slideVariants : undefined}
              initial={state.subView === 'verse' ? 'enter' : { opacity: 0 }}
              animate={state.subView === 'verse' ? 'center' : { opacity: 1 }}
              exit={state.subView === 'verse' ? 'exit' : { opacity: 0 }}
              transition={state.subView === 'verse' ? animations.slide : animations.crossfade}
              className="flex w-full flex-1 flex-col justify-center pb-32"
            >
              {state.subView === 'verse' ? (
                /* Verse Screen */
                <div className="flex w-full flex-col space-y-6" data-testid="verse-screen">
                  <div className="flex items-center justify-between">
                    <div className="w-12" />
                    <p
                      ref={verseHeadingRef}
                      tabIndex={-1}
                      className="text-center text-xs font-medium tracking-wide text-purple-700"
                      data-testid="scripture-verse-reference"
                    >
                      {currentStep.verseReference}
                    </p>
                    <BookmarkFlag
                      isBookmarked={state.bookmarkedSteps.has(session.currentStepIndex)}
                      onToggle={handlers.onBookmarkToggle}
                      disabled={!state.isOnline}
                    />
                  </div>

                  <blockquote
                    className="rounded-2xl border border-purple-200/50 bg-white/80 p-6 backdrop-blur-sm"
                    data-testid="scripture-verse-text"
                  >
                    <p className="font-serif text-xl leading-relaxed text-purple-900">
                      {currentStep.verseText}
                    </p>
                  </blockquote>
                </div>
              ) : (
                /* Response Screen */
                <div className="flex w-full flex-col space-y-6" data-testid="response-screen">
                  <p
                    className="text-center text-xs font-medium tracking-wide text-purple-600"
                    data-testid="scripture-response-verse-reference"
                  >
                    Response to {currentStep.verseReference}
                  </p>

                  <div
                    className="rounded-2xl border border-purple-200/50 bg-white/80 p-6 backdrop-blur-sm"
                    data-testid="scripture-response-text"
                  >
                    <p className="text-base leading-relaxed text-purple-800">
                      {currentStep.responseText}
                    </p>
                  </div>
                </div>
              )}
            </m.div>
          </AnimatePresence>

          {/* Offline indicator */}
          {!state.isOnline && (
            <div
              className="mb-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
              data-testid="offline-indicator"
              role="status"
              aria-live="polite"
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M13 12a1 1 0 11-2 0 1 1 0 012 0z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
              <span>You&apos;re offline. Cached data shown. Connect to continue.</span>
            </div>
          )}

          {/* Syncing indicator */}
          {state.isSyncing && (
            <div className="py-1 text-center text-xs text-purple-600" data-testid="sync-indicator">
              Saving...
            </div>
          )}

          {/* Error display */}
          {state.scriptureError && !state.pendingRetry && (
            <div
              className="mb-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              data-testid="reading-error"
              role="alert"
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                data-testid="error-icon"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <span>
                {typeof state.scriptureError === 'string'
                  ? state.scriptureError
                  : state.scriptureError.message}
              </span>
            </div>
          )}

          {/* Retry UI */}
          {state.pendingRetry && (
            <div
              className="mb-2 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3"
              data-testid="retry-banner"
            >
              <span className="text-sm text-amber-700">
                {state.pendingRetry.attempts >= state.pendingRetry.maxAttempts
                  ? 'Save failed. Your progress is saved locally.'
                  : 'Save failed. Tap to retry.'}
              </span>
              {state.pendingRetry.attempts < state.pendingRetry.maxAttempts && (
                <button
                  onClick={handlers.onRetryFailedWrite}
                  className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg text-sm font-medium text-amber-800 hover:text-amber-900 ${FOCUS_RING}`}
                  data-testid="retry-button"
                  type="button"
                >
                  Retry ({state.pendingRetry.attempts}/{state.pendingRetry.maxAttempts})
                </button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3 pt-4">
            {state.subView === 'verse' ? (
              <>
                <button
                  onClick={handlers.onViewResponse}
                  className={`min-h-[48px] w-full rounded-xl border border-purple-200/50 bg-white/80 px-4 py-3 font-medium text-purple-700 backdrop-blur-sm transition-colors hover:bg-purple-50/80 active:bg-purple-100/80 ${FOCUS_RING}`}
                  data-testid="scripture-view-response-button"
                  type="button"
                >
                  View Response
                </button>

                <button
                  onClick={handlers.onNextVerse}
                  disabled={state.isNextDisabled}
                  className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 ${FOCUS_RING}`}
                  data-testid="scripture-next-verse-button"
                  type="button"
                >
                  {state.isLastStep ? 'Complete Reading' : 'Next Verse'}
                </button>

                {!state.isOnline && (
                  <p className="text-center text-xs text-amber-700" data-testid="disabled-reason">
                    Connect to internet to continue
                  </p>
                )}
              </>
            ) : (
              <>
                <button
                  ref={backToVerseRef}
                  onClick={handlers.onBackToVerse}
                  className={`min-h-[48px] w-full rounded-xl border border-purple-200/50 bg-white/80 px-4 py-3 font-medium text-purple-700 backdrop-blur-sm transition-colors hover:bg-purple-50/80 active:bg-purple-100/80 ${FOCUS_RING}`}
                  data-testid="scripture-back-to-verse-button"
                  type="button"
                >
                  Back to Verse
                </button>

                <button
                  onClick={handlers.onNextVerse}
                  disabled={state.isNextDisabled}
                  className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 ${FOCUS_RING}`}
                  data-testid="scripture-next-verse-button"
                  type="button"
                >
                  {state.isLastStep ? 'Complete Reading' : 'Next Verse'}
                </button>

                {!state.isOnline && (
                  <p className="text-center text-xs text-amber-700" data-testid="disabled-reason">
                    Connect to internet to continue
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Exit Confirmation Dialog */}
        <AnimatePresence>
          {state.showExitConfirm && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={animations.crossfade}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
              data-testid="exit-confirm-overlay"
              onClick={handlers.onExitCancel}
            >
              <m.div
                ref={dialogRef}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={animations.crossfade}
                className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"
                data-testid="exit-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="exit-dialog-title"
                aria-describedby="exit-dialog-desc"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="exit-dialog-title" className="text-lg font-semibold text-purple-900">
                  Save your progress?
                </h2>
                <p id="exit-dialog-desc" className="text-sm text-purple-700">
                  You can continue where you left off.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handlers.onSaveAndExit}
                    disabled={state.isSyncing}
                    className={`min-h-[48px] flex-1 rounded-xl bg-linear-to-r from-purple-500 to-purple-600 px-4 py-3 font-medium text-white hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 ${FOCUS_RING}`}
                    data-testid="save-and-exit-button"
                    type="button"
                    autoFocus
                  >
                    {state.isSyncing ? 'Saving...' : 'Save & Exit'}
                  </button>
                  <button
                    onClick={handlers.onExitCancel}
                    className={`min-h-[48px] rounded-lg px-4 py-3 font-medium text-purple-600 hover:text-purple-800 ${FOCUS_RING}`}
                    data-testid="cancel-exit-button"
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}
