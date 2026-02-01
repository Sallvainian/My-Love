/**
 * SoloReadingFlow Container Component
 *
 * Story 1.3: Solo Reading Flow
 * Story 1.4: Save, Resume & Optimistic UI
 * Story 1.5: Accessibility Foundations
 *
 * Manages the step-by-step scripture reading experience.
 *
 * Handles:
 * - Displaying current verse and response screens
 * - Step navigation (next verse, view response, back to verse)
 * - Progress tracking (Verse X of 17)
 * - Exit confirmation with save
 * - Session completion transition to reflection phase
 * - Story 1.4: Auto-save on visibility change / beforeunload
 * - Story 1.4: Offline indicator and blocked advancement
 * - Story 1.4: Retry UI for failed server writes
 * - Story 1.4: Auto-retry on reconnect
 * - Story 1.5: Focus-visible ring styles, screen reader announcements,
 *   focus management, dialog focus trap, color independence, contrast fixes
 *
 * Uses container/presentational pattern:
 * - This container connects to Zustand store
 * - Passes props to presentational sub-components
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/useAppStore';
import { SCRIPTURE_STEPS, MAX_STEPS } from '../../../data/scriptureSteps';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useMotionConfig } from '../../../hooks/useMotionConfig';

// Lavender Dreams design tokens (shared with ScriptureOverview)
const scriptureTheme = {
  primary: '#A855F7',
  background: '#F3E5F5',
  surface: '#FAF5FF',
};

// Sub-view within a step: verse or response
type StepSubView = 'verse' | 'response';

// Direction for slide animation
type SlideDirection = 'left' | 'right';

// Shared focus ring classes (Story 1.5: AC #1)
const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';

export function SoloReadingFlow() {
  const { crossfade, slide } = useMotionConfig();
  const { isOnline } = useNetworkStatus();

  // Scripture reading slice state
  const {
    session,
    isSyncing,
    scriptureError,
    pendingRetry,
    advanceStep,
    saveAndExit,
    saveSession,
    exitSession,
    retryFailedWrite,
  } = useAppStore(
    useShallow((state) => ({
      session: state.session,
      isSyncing: state.isSyncing,
      scriptureError: state.scriptureError,
      pendingRetry: state.pendingRetry,
      advanceStep: state.advanceStep,
      saveAndExit: state.saveAndExit,
      saveSession: state.saveSession,
      exitSession: state.exitSession,
      retryFailedWrite: state.retryFailedWrite,
    }))
  );

  // Story 1.4: Wire useAutoSave (must be before session null-guard)
  useAutoSave({ session, saveSession });

  // Local UI state
  const [subView, setSubView] = useState<StepSubView>('verse');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('left');

  // Story 1.5: Screen reader announcement state (AC #2)
  const [announcement, setAnnouncement] = useState('');

  // Story 1.5: Focus management refs (AC #3)
  const verseHeadingRef = useRef<HTMLParagraphElement>(null);
  const backToVerseRef = useRef<HTMLButtonElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const exitButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Story 1.5: Track previous values for announcement and focus logic
  const prevStepIndexRef = useRef<number | undefined>(undefined);
  const prevSubViewRef = useRef<StepSubView>('verse');
  const prevIsCompletedRef = useRef(false);

  // Track previous isOnline to detect offline → online transitions
  const prevIsOnlineRef = useRef(isOnline);

  // Story 1.4: Auto-retry on reconnect (offline → online with pendingRetry)
  useEffect(() => {
    if (
      !prevIsOnlineRef.current &&
      isOnline &&
      pendingRetry &&
      pendingRetry.attempts < pendingRetry.maxAttempts
    ) {
      void retryFailedWrite();
    }
    prevIsOnlineRef.current = isOnline;
  }, [isOnline, pendingRetry, retryFailedWrite]);

  // H1 Fix: ALL useCallback hooks BEFORE the session guard
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

  // Story 1.5: Store focus before dialog opens (AC #1, #3)
  const handleExitRequest = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setShowExitConfirm(true);
  }, []);

  // Story 1.5: Restore focus when dialog closes (AC #1, #3)
  const handleExitCancel = useCallback(() => {
    setShowExitConfirm(false);
    requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
  }, []);

  const handleSaveAndExit = useCallback(async () => {
    setShowExitConfirm(false);
    await saveAndExit();
  }, [saveAndExit]);

  // Story 1.5: Dialog focus trap + Escape handler (AC #1, #8)
  useEffect(() => {
    if (!showExitConfirm || !dialogRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExitCancel();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showExitConfirm, handleExitCancel]);

  // Story 1.5: Screen reader announcements + focus management on step change (AC #2, #3)
  // Combined into single effect to avoid shared-ref race condition between separate effects
  useEffect(() => {
    if (
      session &&
      prevStepIndexRef.current !== undefined &&
      prevStepIndexRef.current !== session.currentStepIndex
    ) {
      // Use timeout to decouple announcement from render and fix sync setState lint
      setTimeout(() => {
        setAnnouncement(`Now on verse ${session.currentStepIndex + 1}`);
      }, 100);
      requestAnimationFrame(() => {
        verseHeadingRef.current?.focus();
      });
      prevStepIndexRef.current = session.currentStepIndex;
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }
    prevStepIndexRef.current = session?.currentStepIndex;
  }, [session?.currentStepIndex, session]);

  // Story 1.5: Screen reader announcements + focus management on sub-view change (AC #2, #3)
  // Combined into single effect to avoid shared-ref race condition between separate effects
  useEffect(() => {
    if (prevSubViewRef.current !== subView) {
      if (subView === 'response') {
        const msg = `Viewing response for verse ${(session?.currentStepIndex ?? 0) + 1}`;
        setTimeout(() => setAnnouncement(msg), 100);
        requestAnimationFrame(() => {
          backToVerseRef.current?.focus();
        });
      } else if (prevSubViewRef.current === 'response') {
        setTimeout(
          () => setAnnouncement(`Back to verse ${(session?.currentStepIndex ?? 0) + 1}`),
          100
        );
        requestAnimationFrame(() => {
          verseHeadingRef.current?.focus();
        });
      }
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      prevSubViewRef.current = subView;
      return () => clearTimeout(timer);
    }
  }, [subView, session?.currentStepIndex]);

  // Computed before guard for useEffect dependency
  const isCompleted = session
    ? session.status === 'complete' || session.currentPhase === 'reflection'
    : false;

  // Story 1.5: Completion screen announcement + focus (AC #2, #3)
  useEffect(() => {
    if (isCompleted && !prevIsCompletedRef.current) {
      prevIsCompletedRef.current = true;
      const msg = `Reading complete. All ${MAX_STEPS} verses finished.`;
      setTimeout(() => setAnnouncement(msg), 100);
      requestAnimationFrame(() => {
        completionHeadingRef.current?.focus();
      });
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted]);

  // Guard: no session means we shouldn't be here
  if (!session) return null;

  const currentStep = SCRIPTURE_STEPS[session.currentStepIndex];
  const isLastStep = session.currentStepIndex >= MAX_STEPS - 1;

  // Determine if Next Verse should be disabled
  const isNextDisabled = isSyncing || !isOnline;

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

  // Completion screen (placeholder for Epic 2 reflection)
  if (isCompleted) {
    return (
      <div
        className="flex min-h-screen flex-col p-4 pb-20"
        style={{ backgroundColor: scriptureTheme.background }}
        data-testid="scripture-completion-screen"
      >
        {/* Story 1.5: Screen reader announcer (AC #2) */}
        <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
          {announcement}
        </div>

        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center space-y-6 text-center">
          <div className="text-6xl" aria-hidden="true">
            🙏
          </div>
          <h1
            className="font-serif text-2xl font-bold text-purple-900"
            ref={completionHeadingRef}
            tabIndex={-1}
            data-testid="completion-heading"
          >
            Reading Complete
          </h1>
          <p className="text-purple-700">
            You&apos;ve completed all {MAX_STEPS} scripture readings. Take a moment to reflect on
            what you&apos;ve read.
          </p>
          <p className="text-sm text-purple-600">Reflection feature coming soon (Epic 2)</p>
          <button
            onClick={() => exitSession()}
            className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 ${FOCUS_RING}`}
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
      className="flex min-h-screen flex-col pb-20"
      style={{ backgroundColor: scriptureTheme.background }}
      data-testid="solo-reading-flow"
    >
      {/* Story 1.5: Screen reader announcer (AC #2) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
        {announcement}
      </div>

      {/* Header with exit button and progress */}
      <header className="mx-auto flex w-full max-w-md items-center justify-between p-4">
        <button
          ref={exitButtonRef}
          onClick={handleExitRequest}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-purple-600 transition-colors hover:text-purple-800 ${FOCUS_RING}`}
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

        {/* Progress indicator (AC: "Verse X of 17" as text) */}
        <span
          className="text-sm font-medium text-purple-600"
          aria-label={`Currently on verse ${session.currentStepIndex + 1} of ${MAX_STEPS}`}
          aria-current="step"
          data-testid="scripture-progress-indicator"
        >
          Verse {session.currentStepIndex + 1} of {MAX_STEPS}
        </span>

        {/* Section theme badge — Story 1.5: contrast fix text-purple-400 → text-purple-600 */}
        <span
          className="max-w-[100px] truncate text-right text-xs text-purple-600"
          data-testid="section-theme"
        >
          {currentStep.sectionTheme}
        </span>
      </header>

      {/* Main content area */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4">
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={`step-${session.currentStepIndex}-${subView}`}
            custom={slideDirection}
            variants={subView === 'verse' ? slideVariants : undefined}
            initial={subView === 'verse' ? 'enter' : { opacity: 0 }}
            animate={subView === 'verse' ? 'center' : { opacity: 1 }}
            exit={subView === 'verse' ? 'exit' : { opacity: 0 }}
            transition={subView === 'verse' ? slide : crossfade}
            className="flex w-full flex-1 flex-col justify-center pb-32"
          >
            {subView === 'verse' ? (
              /* Verse Screen */
              <div className="flex w-full flex-col space-y-6" data-testid="verse-screen">
                {/* Verse reference — Story 1.5: contrast fix text-purple-500 → text-purple-600, tabIndex for focus management */}
                <p
                  ref={verseHeadingRef}
                  tabIndex={-1}
                  className="text-center text-xs font-medium tracking-wide text-purple-600"
                  data-testid="scripture-verse-reference"
                >
                  {currentStep.verseReference}
                </p>

                {/* Verse text - prominent display */}
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
                {/* Verse reference (context) — Story 1.5: contrast fix text-purple-400 → text-purple-600 */}
                <p
                  className="text-center text-xs font-medium tracking-wide text-purple-600"
                  data-testid="scripture-response-verse-reference"
                >
                  Response to {currentStep.verseReference}
                </p>

                {/* Response prayer text */}
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
          </motion.div>
        </AnimatePresence>

        {/* Story 1.4: Offline indicator (AC #4) */}
        {!isOnline && (
          <div
            className="mb-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
            data-testid="offline-indicator"
            role="status"
            aria-live="polite"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Syncing indicator — Story 1.5: contrast fix text-purple-400 → text-purple-600 */}
        {isSyncing && (
          <div className="py-1 text-center text-xs text-purple-600" data-testid="sync-indicator">
            Saving...
          </div>
        )}

        {/* Error display — Story 1.5: warning icon for color independence (AC #5) */}
        {scriptureError && !pendingRetry && (
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
              {typeof scriptureError === 'string' ? scriptureError : scriptureError.message}
            </span>
          </div>
        )}

        {/* Story 1.4: Retry UI (AC #6) */}
        {pendingRetry && (
          <div
            className="mb-2 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3"
            data-testid="retry-banner"
          >
            <span className="text-sm text-amber-700">
              {pendingRetry.attempts >= pendingRetry.maxAttempts
                ? 'Save failed. Your progress is saved locally.'
                : 'Save failed. Tap to retry.'}
            </span>
            {pendingRetry.attempts < pendingRetry.maxAttempts && (
              <button
                onClick={retryFailedWrite}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-sm font-medium text-amber-800 hover:text-amber-900 ${FOCUS_RING}`}
                data-testid="retry-button"
                type="button"
              >
                Retry ({pendingRetry.attempts}/{pendingRetry.maxAttempts})
              </button>
            )}
          </div>
        )}

        {/* Action buttons - bottom anchored for thumb-friendly access */}
        <div className="space-y-3 pt-4">
          {subView === 'verse' ? (
            <>
              {/* View Response - secondary button */}
              <button
                onClick={handleViewResponse}
                className={`min-h-[48px] w-full rounded-xl border border-purple-200/50 bg-white/80 px-4 py-3 font-medium text-purple-700 backdrop-blur-sm transition-colors hover:bg-purple-50/80 active:bg-purple-100/80 ${FOCUS_RING}`}
                data-testid="scripture-view-response-button"
                type="button"
              >
                View Response
              </button>

              {/* Next Verse - primary button */}
              <button
                onClick={handleNextVerse}
                disabled={isNextDisabled}
                className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 ${FOCUS_RING}`}
                data-testid="scripture-next-verse-button"
                type="button"
              >
                {isLastStep ? 'Complete Reading' : 'Next Verse'}
              </button>

              {/* Story 1.5: Disabled reason text (AC #5) */}
              {!isOnline && (
                <p className="text-center text-xs text-amber-700" data-testid="disabled-reason">
                  Connect to internet to continue
                </p>
              )}
            </>
          ) : (
            <>
              {/* Back to Verse - secondary button */}
              <button
                ref={backToVerseRef}
                onClick={handleBackToVerse}
                className={`min-h-[48px] w-full rounded-xl border border-purple-200/50 bg-white/80 px-4 py-3 font-medium text-purple-700 backdrop-blur-sm transition-colors hover:bg-purple-50/80 active:bg-purple-100/80 ${FOCUS_RING}`}
                data-testid="scripture-back-to-verse-button"
                type="button"
              >
                Back to Verse
              </button>

              {/* Next Verse - primary button (also available on response screen) */}
              <button
                onClick={handleNextVerse}
                disabled={isNextDisabled}
                className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 ${FOCUS_RING}`}
                data-testid="scripture-next-verse-button"
                type="button"
              >
                {isLastStep ? 'Complete Reading' : 'Next Verse'}
              </button>

              {/* Story 1.5: Disabled reason text (AC #5) */}
              {!isOnline && (
                <p className="text-center text-xs text-amber-700" data-testid="disabled-reason">
                  Connect to internet to continue
                </p>
              )}
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
            transition={crossfade}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            data-testid="exit-confirm-overlay"
            onClick={handleExitCancel}
          >
            <motion.div
              ref={dialogRef}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={crossfade}
              className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"
              data-testid="exit-confirm-dialog"
              role="dialog"
              aria-labelledby="exit-dialog-title"
              aria-describedby="exit-dialog-desc"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="exit-dialog-title" className="text-lg font-semibold text-purple-900">
                Save your progress?
              </h2>
              <p id="exit-dialog-desc" className="text-sm text-purple-700">
                Save your progress? You can continue later.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveAndExit}
                  disabled={isSyncing}
                  className={`min-h-[48px] flex-1 rounded-xl bg-linear-to-r from-purple-500 to-purple-600 px-4 py-3 font-medium text-white hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 ${FOCUS_RING}`}
                  data-testid="save-and-exit-button"
                  type="button"
                  autoFocus
                >
                  {isSyncing ? 'Saving...' : 'Save & Exit'}
                </button>
                <button
                  onClick={handleExitCancel}
                  className={`min-h-[48px] rounded-lg px-4 py-3 font-medium text-purple-600 hover:text-purple-800 ${FOCUS_RING}`}
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
