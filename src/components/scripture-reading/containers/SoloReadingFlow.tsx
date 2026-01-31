/**
 * SoloReadingFlow Container Component
 *
 * Story 1.3: Solo Reading Flow
 * Manages the step-by-step scripture reading experience.
 *
 * Handles:
 * - Displaying current verse and response screens
 * - Step navigation (next verse, view response, back to verse)
 * - Progress tracking (Verse X of 17)
 * - Exit confirmation with save
 * - Session completion transition to reflection phase
 *
 * Uses container/presentational pattern:
 * - This container connects to Zustand store
 * - Passes props to presentational sub-components
 */

import { useState, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAppStore } from '../../../stores/useAppStore';
import { SCRIPTURE_STEPS, MAX_STEPS } from '../../../data/scriptureSteps';

// Lavender Dreams design tokens (shared with ScriptureOverview)
const scriptureTheme = {
  primary: '#A855F7',
  background: '#F3E5F5',
  surface: '#FAF5FF',
};

// Animation durations (seconds)
const CROSSFADE_DURATION = 0.2;
const SLIDE_DURATION = 0.3;

// Sub-view within a step: verse or response
type StepSubView = 'verse' | 'response';

// Direction for slide animation
type SlideDirection = 'left' | 'right';

export function SoloReadingFlow() {
  const shouldReduceMotion = useReducedMotion();

  // Scripture reading slice state
  const { session, isSyncing, scriptureError, advanceStep, saveAndExit } = useAppStore(
    (state) => ({
      session: state.session,
      isSyncing: state.isSyncing,
      scriptureError: state.scriptureError,
      advanceStep: state.advanceStep,
      saveAndExit: state.saveAndExit,
    })
  );

  // Local UI state
  const [subView, setSubView] = useState<StepSubView>('verse');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('left');

  // Guard: no session means we shouldn't be here
  if (!session) return null;

  const currentStep = SCRIPTURE_STEPS[session.currentStepIndex];
  const isLastStep = session.currentStepIndex >= MAX_STEPS - 1;
  const isCompleted = session.status === 'complete' || session.currentPhase === 'reflection';

  // Action handlers
  const handleNextVerse = useCallback(async () => {
    setSlideDirection('left');
    setSubView('verse');
    await advanceStep();
  }, [advanceStep]);

  const handleViewResponse = useCallback(() => {
    setSubView('response');
  }, []);

  const handleBackToVerse = useCallback(() => {
    setSubView('verse');
  }, []);

  const handleExitRequest = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  const handleExitCancel = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  const handleSaveAndExit = useCallback(async () => {
    setShowExitConfirm(false);
    await saveAndExit();
  }, [saveAndExit]);

  // Animation variants
  const crossfadeTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: CROSSFADE_DURATION };

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

  const slideTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: SLIDE_DURATION, ease: 'easeInOut' };

  // Completion screen (placeholder for Epic 2 reflection)
  if (isCompleted) {
    return (
      <div
        className="min-h-screen p-4 flex flex-col"
        style={{ backgroundColor: scriptureTheme.background }}
        data-testid="reading-complete"
      >
        <div className="max-w-md mx-auto flex-1 flex flex-col items-center justify-center text-center space-y-6">
          <div className="text-6xl" aria-hidden="true">
            🙏
          </div>
          <h1 className="text-2xl font-bold text-purple-900 font-serif">
            Reading Complete
          </h1>
          <p className="text-purple-700">
            You&apos;ve completed all {MAX_STEPS} scripture readings. Take a moment to reflect on
            what you&apos;ve read.
          </p>
          <p className="text-purple-500 text-sm">
            Reflection feature coming soon (Epic 2)
          </p>
          <button
            onClick={() => {
              // Return to overview by clearing session
              const { exitSession } = useAppStore.getState();
              exitSession();
            }}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-semibold text-lg hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 min-h-[56px] shadow-lg shadow-purple-500/25"
            data-testid="return-to-overview"
            type="button"
          >
            Return to Overview
          </button>
        </div>
      </div>
    );
  }

  // Guard: currentStep should always exist for valid step index
  if (!currentStep) return null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: scriptureTheme.background }}
      data-testid="solo-reading-flow"
    >
      {/* Header with exit button and progress */}
      <header className="flex items-center justify-between p-4 max-w-md mx-auto w-full">
        <button
          onClick={handleExitRequest}
          className="p-2 text-purple-600 hover:text-purple-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Exit reading"
          data-testid="exit-button"
          type="button"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Progress indicator (AC: "Verse X of 17" as text) */}
        <span
          className="text-purple-600 text-sm font-medium"
          aria-label={`Currently on verse ${session.currentStepIndex + 1} of ${MAX_STEPS}`}
          data-testid="progress-indicator"
        >
          Verse {session.currentStepIndex + 1} of {MAX_STEPS}
        </span>

        {/* Section theme badge */}
        <span
          className="text-purple-400 text-xs max-w-[100px] text-right truncate"
          data-testid="section-theme"
        >
          {currentStep.sectionTheme}
        </span>
      </header>

      {/* Main content area */}
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pb-4">
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={`step-${session.currentStepIndex}-${subView}`}
            custom={slideDirection}
            variants={subView === 'verse' ? slideVariants : undefined}
            initial={subView === 'verse' ? 'enter' : { opacity: 0 }}
            animate={subView === 'verse' ? 'center' : { opacity: 1 }}
            exit={subView === 'verse' ? 'exit' : { opacity: 0 }}
            transition={subView === 'verse' ? slideTransition : crossfadeTransition}
            className="flex-1 flex flex-col"
          >
            {subView === 'verse' ? (
              /* Verse Screen */
              <div
                className="flex-1 flex flex-col justify-center space-y-6"
                data-testid="verse-screen"
              >
                {/* Verse reference */}
                <p
                  className="text-center text-purple-500 text-sm font-medium tracking-wide"
                  data-testid="verse-reference"
                >
                  {currentStep.verseReference}
                </p>

                {/* Verse text - prominent display */}
                <blockquote
                  className="bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl p-6"
                  data-testid="verse-text"
                >
                  <p className="text-xl text-purple-900 font-serif leading-relaxed">
                    {currentStep.verseText}
                  </p>
                </blockquote>
              </div>
            ) : (
              /* Response Screen */
              <div
                className="flex-1 flex flex-col justify-center space-y-6"
                data-testid="response-screen"
              >
                {/* Verse reference (context) */}
                <p
                  className="text-center text-purple-400 text-xs font-medium tracking-wide"
                  data-testid="response-verse-reference"
                >
                  Response to {currentStep.verseReference}
                </p>

                {/* Response prayer text */}
                <div
                  className="bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl p-6"
                  data-testid="response-text"
                >
                  <p className="text-base text-purple-800 leading-relaxed">
                    {currentStep.responseText}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Syncing indicator */}
        {isSyncing && (
          <div
            className="text-center text-purple-400 text-xs py-1"
            data-testid="sync-indicator"
          >
            Saving...
          </div>
        )}

        {/* Error display */}
        {scriptureError && (
          <div
            className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm mb-2"
            data-testid="reading-error"
            role="alert"
          >
            {typeof scriptureError === 'string'
              ? scriptureError
              : scriptureError.message}
          </div>
        )}

        {/* Action buttons - bottom anchored for thumb-friendly access */}
        <div className="space-y-3 pt-4">
          {subView === 'verse' ? (
            <>
              {/* View Response - secondary button */}
              <button
                onClick={handleViewResponse}
                className="w-full py-3 px-4 bg-white/80 backdrop-blur-sm border border-purple-200/50 text-purple-700 rounded-xl font-medium hover:bg-purple-50/80 active:bg-purple-100/80 transition-colors min-h-[48px]"
                data-testid="view-response-button"
                type="button"
              >
                View Response
              </button>

              {/* Next Verse - primary button */}
              <button
                onClick={handleNextVerse}
                disabled={isSyncing}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-semibold text-lg hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 min-h-[56px] shadow-lg shadow-purple-500/25"
                data-testid="next-verse-button"
                type="button"
              >
                {isLastStep ? 'Complete Reading' : 'Next Verse'}
              </button>
            </>
          ) : (
            <>
              {/* Back to Verse - secondary button */}
              <button
                onClick={handleBackToVerse}
                className="w-full py-3 px-4 bg-white/80 backdrop-blur-sm border border-purple-200/50 text-purple-700 rounded-xl font-medium hover:bg-purple-50/80 active:bg-purple-100/80 transition-colors min-h-[48px]"
                data-testid="back-to-verse-button"
                type="button"
              >
                Back to Verse
              </button>

              {/* Next Verse - primary button (also available on response screen) */}
              <button
                onClick={handleNextVerse}
                disabled={isSyncing}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-semibold text-lg hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 min-h-[56px] shadow-lg shadow-purple-500/25"
                data-testid="next-verse-button"
                type="button"
              >
                {isLastStep ? 'Complete Reading' : 'Next Verse'}
              </button>
            </>
          )}
        </div>
      </main>

      {/* Exit Confirmation Dialog */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={crossfadeTransition}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            data-testid="exit-confirm-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={crossfadeTransition}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4"
              data-testid="exit-confirm-dialog"
              role="dialog"
              aria-labelledby="exit-dialog-title"
              aria-describedby="exit-dialog-desc"
            >
              <h2
                id="exit-dialog-title"
                className="text-lg font-semibold text-purple-900"
              >
                Save your progress?
              </h2>
              <p
                id="exit-dialog-desc"
                className="text-purple-700 text-sm"
              >
                You can continue later from where you left off.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveAndExit}
                  disabled={isSyncing}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 min-h-[48px]"
                  data-testid="save-and-exit-button"
                  type="button"
                >
                  {isSyncing ? 'Saving...' : 'Save & Exit'}
                </button>
                <button
                  onClick={handleExitCancel}
                  className="py-3 px-4 text-purple-600 hover:text-purple-800 font-medium min-h-[48px]"
                  data-testid="cancel-exit-button"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
