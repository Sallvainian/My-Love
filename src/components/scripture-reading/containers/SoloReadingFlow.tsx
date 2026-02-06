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
import { BookmarkFlag } from '../reading/BookmarkFlag';
import { PerStepReflection } from '../reflection/PerStepReflection';
import { ReflectionSummary } from '../reflection/ReflectionSummary';
import { MessageCompose } from '../reflection/MessageCompose';
import { DailyPrayerReport } from '../reflection/DailyPrayerReport';
import { scriptureReadingService } from '../../../services/scriptureReadingService';

// Lavender Dreams design tokens (shared with ScriptureOverview)
const scriptureTheme = {
  primary: '#A855F7',
  background: '#F3E5F5',
  surface: '#FAF5FF',
};

// Sub-view within a step: verse, response, or reflection
type StepSubView = 'verse' | 'response' | 'reflection';

// Story 2.3: Sub-phase within report phase
type ReportSubPhase = 'compose' | 'report' | 'complete-unlinked';

// Direction for slide animation
type SlideDirection = 'left' | 'right';

// Shared focus ring classes (Story 1.5: AC #1)
const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';

export function SoloReadingFlow() {
  const { crossfade, slide } = useMotionConfig();
  const { isOnline } = useNetworkStatus();

  // Scripture reading slice state + partner slice
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
    updatePhase,
    partner,
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
      updatePhase: state.updatePhase,
      partner: state.partner,
    }))
  );

  // Story 1.4: Wire useAutoSave (must be before session null-guard)
  useAutoSave({ session, saveSession });

  // Local UI state
  const [subView, setSubView] = useState<StepSubView>('verse');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('left');

  // Story 2.1: Bookmark state (optimistic toggle, per-step)
  const [bookmarkedSteps, setBookmarkedSteps] = useState<Set<number>>(new Set());

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

  // Story 2.3: Report sub-phase state and data
  const [reportSubPhase, setReportSubPhase] = useState<ReportSubPhase>('compose');
  const [reportData, setReportData] = useState<{
    userRatings: { stepIndex: number; rating: number }[];
    userBookmarks: number[];
    userStandoutVerses: number[];
    partnerMessage: string | null;
    partnerRatings: { stepIndex: number; rating: number }[] | null;
    partnerBookmarks: number[] | null;
    partnerStandoutVerses: number[] | null;
    isPartnerComplete: boolean;
  }>({
    userRatings: [],
    userBookmarks: [],
    userStandoutVerses: [],
    partnerMessage: null,
    partnerRatings: null,
    partnerBookmarks: null,
    partnerStandoutVerses: null,
    isPartnerComplete: false,
  });
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Story 2.1: Debounce ref for bookmark server write (300ms, last-write-wins)
  const bookmarkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup bookmark debounce on unmount
  useEffect(() => {
    return () => {
      if (bookmarkDebounceRef.current) clearTimeout(bookmarkDebounceRef.current);
    };
  }, []);

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

  // Story 2.1: Load bookmarks for current session on mount/session change
  useEffect(() => {
    if (!session) return;
    void (async () => {
      const bookmarks = await scriptureReadingService.getBookmarksBySession(session.id);
      const userBookmarks = bookmarks.filter((b) => b.userId === session.userId);
      setBookmarkedSteps(new Set(userBookmarks.map((b) => b.stepIndex)));
    })();
  }, [session?.id, session?.userId]);

  // Story 2.1: Bookmark toggle handler (optimistic UI immediate, debounced server write)
  const handleBookmarkToggle = useCallback(() => {
    if (!session) return;
    const stepIndex = session.currentStepIndex;

    // Optimistic toggle (instant per AC #1)
    setBookmarkedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });

    // Debounce server write (300ms, last-write-wins)
    if (bookmarkDebounceRef.current) {
      clearTimeout(bookmarkDebounceRef.current);
    }
    bookmarkDebounceRef.current = setTimeout(() => {
      bookmarkDebounceRef.current = null;
      void (async () => {
        try {
          await scriptureReadingService.toggleBookmark(session.id, stepIndex, session.userId, false);
        } catch {
          // Revert on failure
          setBookmarkedSteps((prev) => {
            const next = new Set(prev);
            if (next.has(stepIndex)) {
              next.delete(stepIndex);
            } else {
              next.add(stepIndex);
            }
            return next;
          });
        }
      })();
    }, 300);
  }, [session]);

  // Story 2.2: Handle reflection summary submission — save session reflection then advance to report
  const handleReflectionSummarySubmit = useCallback(
    (data: { standoutVerses: number[]; rating: number; notes: string }) => {
      if (!session) return;

      // Save session-level reflection in background (non-blocking)
      void (async () => {
        try {
          const jsonNotes = JSON.stringify({
            standoutVerses: data.standoutVerses,
            userNote: data.notes,
          });
          await scriptureReadingService.addReflection(
            session.id,
            MAX_STEPS, // sentinel value for session-level reflection
            data.rating,
            jsonNotes,
            false
          );
        } catch {
          // Non-blocking: reflection write failure shouldn't block phase advancement
        }
      })();

      // Advance phase to 'report' optimistically via store
      updatePhase('report');

      // Persist phase change to server in background
      void (async () => {
        try {
          await scriptureReadingService.updateSession(session.id, {
            currentPhase: 'report',
          });
        } catch {
          // Non-blocking: phase persistence failure handled by eventual consistency
        }
      })();
    },
    [session, updatePhase]
  );

  // Story 2.3: Mark session complete helper
  // Updates server status but keeps local phase as 'report' for UI rendering
  const markSessionComplete = useCallback(async () => {
    if (!session) return;
    try {
      await scriptureReadingService.updateSession(session.id, {
        status: 'complete',
        completedAt: new Date(),
      });
    } catch {
      // Non-blocking: session completion failure handled by eventual consistency
    }
  }, [session]);

  // Story 2.3: Handle message send
  const handleMessageSend = useCallback(
    (message: string) => {
      if (!session || isSendingMessage) return;
      setIsSendingMessage(true);

      // Fire-and-forget message write
      void (async () => {
        try {
          await scriptureReadingService.addMessage(session.id, session.userId, message);
        } catch {
          // Non-blocking: message write failure shouldn't block session completion
        }
      })();

      // Mark session complete and advance to report view
      void markSessionComplete();
      setReportSubPhase('report');
      setIsSendingMessage(false);
    },
    [session, isSendingMessage, markSessionComplete]
  );

  // Story 2.3: Handle message skip
  const handleMessageSkip = useCallback(() => {
    if (!session || isSendingMessage) return;
    setIsSendingMessage(true);

    // Skip message, mark session complete, advance to report view
    void markSessionComplete();
    setReportSubPhase('report');
    setIsSendingMessage(false);
  }, [session, isSendingMessage, markSessionComplete]);

  // Story 2.3: Handle return to overview from report
  const handleReturnToOverview = useCallback(() => {
    exitSession();
  }, [exitSession]);

  // Story 2.3: Determine initial report sub-phase and mark unlinked session complete
  const isReportEntry = session?.currentPhase === 'report';
  const hasPartner = partner !== null;
  useEffect(() => {
    if (!isReportEntry || !session) return;

    if (!hasPartner) {
      setReportSubPhase('complete-unlinked');
      void markSessionComplete();
    } else {
      setReportSubPhase('compose');
    }
  }, [isReportEntry, hasPartner, session, markSessionComplete]);

  // Story 2.3: Load report data when report view is actually displayed
  useEffect(() => {
    if ((reportSubPhase !== 'report' && reportSubPhase !== 'complete-unlinked') || !session) return;

    void (async () => {
      try {
        // Use server-fresh data (not cache) to include partner contributions
        const { reflections, bookmarks, messages } =
          await scriptureReadingService.getSessionReportData(session.id);

        // Build user ratings from reflections (exclude session-level at MAX_STEPS, require rating)
        const userReflections = reflections.filter(
          (r) => r.userId === session.userId && r.stepIndex < MAX_STEPS && r.rating != null
        );
        const userRatings = userReflections.map((r) => ({
          stepIndex: r.stepIndex,
          rating: r.rating!,
        }));

        // User bookmarks
        const userBookmarks = bookmarks
          .filter((b) => b.userId === session.userId)
          .map((b) => b.stepIndex);

        // Extract standout verses from session-level reflection (stepIndex === MAX_STEPS)
        const sessionReflection = reflections.find(
          (r) => r.userId === session.userId && r.stepIndex === MAX_STEPS
        );
        let userStandoutVerses: number[] = [];
        if (sessionReflection?.notes) {
          try {
            const parsed = JSON.parse(sessionReflection.notes) as { standoutVerses?: number[] };
            userStandoutVerses = parsed.standoutVerses ?? [];
          } catch {
            // Invalid JSON in notes — proceed without standout verses
          }
        }

        // Partner message (filter by sender !== current user)
        const partnerMsg = messages.find((m) => m.senderId !== session.userId);

        // Partner ratings (reflections from other user)
        const partnerReflections = reflections.filter(
          (r) => r.userId !== session.userId && r.stepIndex < MAX_STEPS && r.rating != null
        );
        const partnerRatings = partnerReflections.length > 0
          ? partnerReflections.map((r) => ({ stepIndex: r.stepIndex, rating: r.rating! }))
          : null;

        // Partner bookmarks
        const partnerBookmarkSteps = bookmarks
          .filter((b) => b.userId !== session.userId)
          .map((b) => b.stepIndex);
        const partnerBookmarks = partnerBookmarkSteps.length > 0 ? partnerBookmarkSteps : null;

        // Partner standout verses (from session-level reflection)
        const partnerSessionReflection = reflections.find(
          (r) => r.userId !== session.userId && r.stepIndex === MAX_STEPS
        );
        let partnerStandoutVerses: number[] | null = null;
        if (partnerSessionReflection?.notes) {
          try {
            const parsed = JSON.parse(partnerSessionReflection.notes) as { standoutVerses?: number[] };
            partnerStandoutVerses = parsed.standoutVerses ?? null;
          } catch {
            // Invalid JSON in partner notes — proceed without standout verses
          }
        }

        setReportData({
          userRatings,
          userBookmarks,
          userStandoutVerses,
          partnerMessage: partnerMsg?.message ?? null,
          partnerRatings,
          partnerBookmarks,
          partnerStandoutVerses,
          isPartnerComplete: partnerReflections.length > 0,
        });
      } catch {
        // Non-blocking: report data loading failure uses empty defaults
      }
    })();
  }, [reportSubPhase, session]);

  // H1 Fix: ALL useCallback hooks BEFORE the session guard
  // Story 2.1: Next Verse now transitions to reflection instead of advancing directly
  const handleNextVerse = useCallback(() => {
    setSubView('reflection');
  }, []);

  // Story 2.1: Handle reflection submission — save reflection then advance step
  const handleReflectionSubmit = useCallback(
    async (rating: number, notes: string) => {
      if (!session) return;

      // Advance step first (non-blocking UX)
      setSlideDirection('left');
      setSubView('verse');

      // Save reflection in background (non-blocking per AC)
      void (async () => {
        try {
          await scriptureReadingService.addReflection(
            session.id,
            session.currentStepIndex,
            rating,
            notes,
            false // is_shared defaults to false
          );
        } catch {
          useAppStore.setState({
            pendingRetry: {
              type: 'reflection',
              attempts: 1,
              maxAttempts: 3,
              reflectionData: {
                sessionId: session.id,
                stepIndex: session.currentStepIndex,
                rating,
                notes,
                isShared: false,
              },
            },
          });
        }
      })();

      await advanceStep();
    },
    [session, advanceStep]
  );

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

  // Story 1.5 + 2.1: Screen reader announcements + focus management on sub-view change (AC #2, #3)
  // Combined into single effect to avoid shared-ref race condition between separate effects
  useEffect(() => {
    if (prevSubViewRef.current !== subView) {
      if (subView === 'response') {
        const msg = `Viewing response for verse ${(session?.currentStepIndex ?? 0) + 1}`;
        setTimeout(() => setAnnouncement(msg), 100);
        requestAnimationFrame(() => {
          backToVerseRef.current?.focus();
        });
      } else if (subView === 'reflection') {
        // Story 2.1: Focus reflection heading on transition
        setTimeout(() => setAnnouncement('Reflect on this verse'), 100);
        requestAnimationFrame(() => {
          // Focus the reflection prompt heading via data-testid
          const reflectionPrompt = document.querySelector<HTMLElement>(
            '[data-testid="scripture-reflection-prompt"]'
          );
          reflectionPrompt?.focus();
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
  const isReflectionPhase = session ? session.currentPhase === 'reflection' : false;
  const isReportPhase = session ? session.currentPhase === 'report' : false;
  const isCompleted = isReflectionPhase || isReportPhase;

  // Story 1.5 + 2.2: Completion screen announcement + focus (AC #2, #3)
  useEffect(() => {
    if (isCompleted && !prevIsCompletedRef.current) {
      prevIsCompletedRef.current = true;
      const msg = isReflectionPhase
        ? 'Review your session reflections'
        : `Reading complete. All ${MAX_STEPS} verses finished.`;
      setTimeout(() => setAnnouncement(msg), 100);
      requestAnimationFrame(() => {
        completionHeadingRef.current?.focus();
      });
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, isReflectionPhase]);

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

  // Story 2.2: Reflection summary screen (after step 17 reflection completes)
  if (isReflectionPhase) {
    // Map bookmarkedSteps Set to array of verse data for ReflectionSummary
    const bookmarkedVerses = Array.from(bookmarkedSteps)
      .sort((a, b) => a - b)
      .map((stepIndex) => ({
        stepIndex,
        verseReference: SCRIPTURE_STEPS[stepIndex].verseReference,
        verseText: SCRIPTURE_STEPS[stepIndex].verseText,
      }));

    return (
      <motion.div
        className="flex min-h-screen flex-col p-4 pb-20"
        style={{ backgroundColor: scriptureTheme.background }}
        data-testid="scripture-completion-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={crossfade}
      >
        {/* Screen reader announcer */}
        <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
          {announcement}
        </div>

        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4">
          <ReflectionSummary
            bookmarkedVerses={bookmarkedVerses}
            onSubmit={handleReflectionSummarySubmit}
            disabled={isSyncing}
          />
        </div>
      </motion.div>
    );
  }

  // Story 2.3: Report phase — message compose, daily prayer report, or unlinked completion
  if (isReportPhase) {
    // Unlinked user — show simple completion screen (Task 3, AC #2)
    if (reportSubPhase === 'complete-unlinked') {
      return (
        <motion.div
          className="flex min-h-screen flex-col p-4 pb-20"
          style={{ backgroundColor: scriptureTheme.background }}
          data-testid="scripture-unlinked-complete-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={crossfade}
        >
          <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
            {announcement}
          </div>
          <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center space-y-6 text-center">
            <h2
              className="font-serif text-2xl font-bold text-purple-900"
              ref={completionHeadingRef}
              tabIndex={-1}
              data-testid="scripture-unlinked-complete-heading"
            >
              Session complete
            </h2>
            <p className="text-sm text-purple-600">
              Your reflections have been saved
            </p>
            <button
              onClick={() => exitSession()}
              className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 ${FOCUS_RING}`}
              data-testid="scripture-unlinked-return-btn"
              type="button"
            >
              Return to Overview
            </button>
          </div>
        </motion.div>
      );
    }

    // Linked user — message compose phase (Task 4, AC #1)
    if (reportSubPhase === 'compose') {
      return (
        <motion.div
          className="flex min-h-screen flex-col p-4 pb-20"
          style={{ backgroundColor: scriptureTheme.background }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={crossfade}
        >
          <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
            {announcement}
          </div>
          <div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4">
            <MessageCompose
              partnerName={partner?.displayName ?? 'your partner'}
              onSend={handleMessageSend}
              onSkip={handleMessageSkip}
              disabled={isSendingMessage}
            />
          </div>
        </motion.div>
      );
    }

    // Daily Prayer Report display (Task 4, AC #3, #4, #5)
    return (
      <motion.div
        className="flex min-h-screen flex-col p-4 pb-20"
        style={{ backgroundColor: scriptureTheme.background }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={crossfade}
      >
        <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
          {announcement}
        </div>
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4">
          <DailyPrayerReport
            userRatings={reportData.userRatings}
            userBookmarks={reportData.userBookmarks}
            userStandoutVerses={reportData.userStandoutVerses}
            partnerMessage={reportData.partnerMessage}
            partnerName={partner?.displayName ?? null}
            partnerRatings={reportData.partnerRatings}
            partnerBookmarks={reportData.partnerBookmarks}
            partnerStandoutVerses={reportData.partnerStandoutVerses}
            isPartnerComplete={reportData.isPartnerComplete}
            onReturn={handleReturnToOverview}
          />
        </div>
      </motion.div>
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
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4">
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={`step-${session.currentStepIndex}-${subView}`}
            custom={slideDirection}
            variants={subView === 'verse' ? slideVariants : undefined}
            initial={subView === 'verse' ? 'enter' : { opacity: 0 }}
            animate={subView === 'verse' ? 'center' : { opacity: 1 }}
            exit={subView === 'verse' ? 'exit' : { opacity: 0 }}
            transition={subView === 'reflection' ? { duration: 0.4 } : subView === 'verse' ? slide : crossfade}
            className="flex w-full flex-1 flex-col justify-center pb-32"
          >
            {subView === 'verse' ? (
              /* Verse Screen */
              <div className="flex w-full flex-col space-y-6" data-testid="verse-screen">
                {/* Verse reference — Story 1.5: contrast fix text-purple-500 → text-purple-600, tabIndex for focus management */}
                <div className="flex items-center justify-between">
                  <div className="w-12" /> {/* Spacer for centering */}
                  <p
                    ref={verseHeadingRef}
                    tabIndex={-1}
                    className="text-center text-xs font-medium tracking-wide text-purple-600"
                    data-testid="scripture-verse-reference"
                  >
                    {currentStep.verseReference}
                  </p>
                  {/* Story 2.1: Bookmark toggle (AC #1) */}
                  <BookmarkFlag
                    isBookmarked={bookmarkedSteps.has(session.currentStepIndex)}
                    onToggle={handleBookmarkToggle}
                    disabled={!isOnline}
                  />
                </div>

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
            ) : subView === 'response' ? (
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
            ) : (
              /* Story 2.1: Reflection Screen (AC #2, #3, #4) */
              <div data-testid="reflection-subview">
                <PerStepReflection
                  onSubmit={handleReflectionSubmit}
                  disabled={isSyncing}
                />
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
                className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg text-sm font-medium text-amber-800 hover:text-amber-900 ${FOCUS_RING}`}
                data-testid="retry-button"
                type="button"
              >
                Retry ({pendingRetry.attempts}/{pendingRetry.maxAttempts})
              </button>
            )}
          </div>
        )}

        {/* Action buttons - bottom anchored for thumb-friendly access */}
        {subView !== 'reflection' && (
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
        )}
      </div>

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
