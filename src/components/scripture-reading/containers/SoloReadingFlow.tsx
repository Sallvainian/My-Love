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
import { AnimatePresence, LazyMotion, m } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/useAppStore';
import { SCRIPTURE_STEPS, MAX_STEPS } from '../../../data/scriptureSteps';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useMotionConfig } from '../../../hooks/useMotionConfig';
import { BookmarkFlag } from '../reading/BookmarkFlag';
import { PerStepReflection } from '../reflection/PerStepReflection';
import { ReflectionSummary } from '../reflection/ReflectionSummary';
import type { ReflectionSummarySubmission } from '../reflection/ReflectionSummary';
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
type ReportSubPhase = 'compose' | 'report' | 'complete-unlinked' | 'completion-error';

// Direction for slide animation
type SlideDirection = 'left' | 'right';

// Shared focus ring classes (Story 1.5: AC #1)
const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';
const loadMotionFeatures = () => import('../motionFeatures').then((module) => module.default);

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
    isLoadingPartner,
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
      isLoadingPartner: state.isLoadingPartner,
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
  const [reportSubPhase, setReportSubPhase] = useState<ReportSubPhase>(() => {
    if (session?.currentPhase === 'complete' || session?.status === 'complete') return 'report';
    return 'compose';
  });
  const [reportData, setReportData] = useState<{
    userRatings: { stepIndex: number; rating: number }[];
    userBookmarks: number[];
    userStandoutVerses: number[];
    userMessage: string | null;
    partnerMessage: string | null;
    partnerRatings: { stepIndex: number; rating: number }[] | null;
    partnerBookmarks: number[] | null;
    partnerStandoutVerses: number[] | null;
    isPartnerComplete: boolean;
  }>({
    userRatings: [],
    userBookmarks: [],
    userStandoutVerses: [],
    userMessage: null,
    partnerMessage: null,
    partnerRatings: null,
    partnerBookmarks: null,
    partnerStandoutVerses: null,
    isPartnerComplete: false,
  });
  const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isRetryingCompletion, setIsRetryingCompletion] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [reportLoadError, setReportLoadError] = useState<string | null>(null);
  const [reportReloadKey, setReportReloadKey] = useState(0);
  const completionRetryTargetRef = useRef<'report' | 'complete-unlinked'>('report');
  const prevReportSubPhaseRef = useRef<ReportSubPhase | null>(null);

  // Story 2.1: Debounce ref for bookmark server write (300ms, last-write-wins)
  const bookmarkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup bookmark debounce on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (bookmarkDebounceRef.current) clearTimeout(bookmarkDebounceRef.current);
    };
  }, []);

  // Track previous isOnline to detect offline → online transitions
  const prevIsOnlineRef = useRef(isOnline);
  const sessionId = session?.id;
  const sessionUserId = session?.userId;

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
    if (!sessionId || !sessionUserId) return;
    void (async () => {
      const bookmarks = await scriptureReadingService.getBookmarksBySession(sessionId);
      const userBookmarks = bookmarks.filter((b) => b.userId === sessionUserId);
      setBookmarkedSteps(new Set(userBookmarks.map((b) => b.stepIndex)));
    })();
  }, [sessionId, sessionUserId]);

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
          await scriptureReadingService.toggleBookmark(
            session.id,
            stepIndex,
            session.userId,
            false
          );
        } catch {
          // Revert on failure
          if (!isMountedRef.current) return;
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
    (data: ReflectionSummarySubmission) => {
      if (!session || isSubmittingSummary) return;

      setIsSubmittingSummary(true);

      void (async () => {
        try {
          const isShared = session.mode === 'together';
          const jsonNotes = JSON.stringify({
            standoutVerses: data.standoutVerses,
            userNote: data.notes,
          });
          await scriptureReadingService.addReflection(
            session.id,
            MAX_STEPS, // sentinel value for session-level reflection
            data.rating,
            jsonNotes,
            isShared
          );

          await scriptureReadingService.updateSessionBookmarkSharing(
            session.id,
            session.userId,
            data.shareBookmarkedVerses
          );
        } catch {
          // Non-blocking: failures here should not prevent report flow entry.
        } finally {
          if (isMountedRef.current) {
            setIsSubmittingSummary(false);
          }
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
    [isSubmittingSummary, session, updatePhase]
  );

  // Story 2.3: Mark session complete helper
  // Returns success/failure and retries once on transient failure.
  const markSessionComplete = useCallback(async (): Promise<boolean> => {
    if (!session) return false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await scriptureReadingService.updateSession(session.id, {
          status: 'complete',
          completedAt: new Date(),
          currentPhase: 'complete',
        });
        updatePhase('complete');
        return true;
      } catch {
        // Controlled retry (max 1 retry)
      }
    }

    return false;
  }, [session, updatePhase]);

  // Story 2.3: Handle message send
  const handleMessageSend = useCallback(
    (message: string) => {
      if (!session || isSendingMessage) return;
      setIsSendingMessage(true);
      setCompletionError(null);
      completionRetryTargetRef.current = 'report';

      void (async () => {
        try {
          try {
            await scriptureReadingService.addMessage(session.id, session.userId, message);
          } catch {
            // Non-blocking: message write failure shouldn't block session completion
          }

          // Mark session complete and advance to report view only on success
          const completionSucceeded = await markSessionComplete();
          if (completionSucceeded) {
            setReportLoadError(null);
            setReportSubPhase('report');
          } else if (isMountedRef.current) {
            setCompletionError('Unable to complete this session. Retry to open your report.');
            setReportSubPhase('completion-error');
          }
        } finally {
          if (isMountedRef.current) {
            setIsSendingMessage(false);
          }
        }
      })();
    },
    [session, isSendingMessage, markSessionComplete]
  );

  // Story 2.3: Handle message skip
  const handleMessageSkip = useCallback(() => {
    if (!session || isSendingMessage) return;
    setIsSendingMessage(true);
    setCompletionError(null);
    completionRetryTargetRef.current = 'report';

    void (async () => {
      try {
        // Skip message, mark session complete, advance to report view only on success
        const completionSucceeded = await markSessionComplete();
        if (completionSucceeded) {
          setReportLoadError(null);
          setReportSubPhase('report');
        } else if (isMountedRef.current) {
          setCompletionError('Unable to complete this session. Retry to open your report.');
          setReportSubPhase('completion-error');
        }
      } finally {
        if (isMountedRef.current) {
          setIsSendingMessage(false);
        }
      }
    })();
  }, [session, isSendingMessage, markSessionComplete]);

  const handleRetrySessionCompletion = useCallback(() => {
    if (!session || isRetryingCompletion) return;
    setIsRetryingCompletion(true);
    setCompletionError(null);

    void (async () => {
      try {
        const completionSucceeded = await markSessionComplete();
        if (!completionSucceeded) {
          if (isMountedRef.current) {
            setCompletionError('Unable to complete this session. Please try again.');
          }
          return;
        }

        if (!isMountedRef.current) return;
        if (completionRetryTargetRef.current === 'complete-unlinked') {
          setReportSubPhase('complete-unlinked');
        } else {
          setReportLoadError(null);
          setReportSubPhase('report');
        }
      } finally {
        if (isMountedRef.current) {
          setIsRetryingCompletion(false);
        }
      }
    })();
  }, [isRetryingCompletion, markSessionComplete, session]);

  // Story 2.3: Handle return to overview from report
  const handleReturnToOverview = useCallback(() => {
    exitSession();
  }, [exitSession]);

  const handleRetryReportLoad = useCallback(() => {
    setReportLoadError(null);
    setReportReloadKey((prev) => prev + 1);
  }, []);

  // Story 2.3: Determine initial report sub-phase and mark unlinked session complete
  const isReportEntry = session?.currentPhase === 'report' || session?.currentPhase === 'complete';
  const hasPartner = partner !== null;
  useEffect(() => {
    if (!isReportEntry || !session) return;
    const isWaitingForPartnerResolution = !hasPartner && isLoadingPartner;

    if (isWaitingForPartnerResolution) {
      return;
    }

    if (!hasPartner) {
      setReportSubPhase('complete-unlinked');
      if (session.currentPhase === 'complete' || session.status === 'complete') {
        setCompletionError(null);
        return;
      }

      completionRetryTargetRef.current = 'complete-unlinked';
      void (async () => {
        const completionSucceeded = await markSessionComplete();
        if (!isMountedRef.current) return;

        if (completionSucceeded) {
          setCompletionError(null);
        } else {
          setCompletionError('Unable to complete this session. Retry to continue.');
        }
      })();
    } else {
      if (session.currentPhase === 'complete' || session.status === 'complete') {
        setCompletionError(null);
        setReportSubPhase('report');
      } else {
        setCompletionError(null);
        setReportSubPhase('compose');
      }
    }
  }, [isReportEntry, hasPartner, session, isLoadingPartner, markSessionComplete]);

  // Story 2.3: Load report data when report view is actually displayed
  useEffect(() => {
    if ((reportSubPhase !== 'report' && reportSubPhase !== 'complete-unlinked') || !session) return;
    setReportLoadError(null);

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

        // Message perspectives
        const partnerMsg = messages.find((m) => m.senderId !== session.userId);
        const userMsg = messages.find((m) => m.senderId === session.userId);

        // Partner ratings (reflections from other user)
        const partnerReflections = reflections.filter(
          (r) => r.userId !== session.userId && r.stepIndex < MAX_STEPS && r.rating != null
        );
        const partnerRatings =
          partnerReflections.length > 0
            ? partnerReflections.map((r) => ({ stepIndex: r.stepIndex, rating: r.rating! }))
            : null;

        // Partner standout verses from session-level reflection notes JSON
        const partnerSessionReflection = reflections.find(
          (r) => r.userId !== session.userId && r.stepIndex === MAX_STEPS
        );
        let partnerStandoutVerses: number[] = [];
        if (partnerSessionReflection?.notes) {
          try {
            const parsed = JSON.parse(partnerSessionReflection.notes) as { standoutVerses?: number[] };
            partnerStandoutVerses = parsed.standoutVerses ?? [];
          } catch {
            // Invalid JSON in partner notes — proceed without standout verses
          }
        }

        // Partner bookmarks only if explicitly shared
        const partnerBookmarks = bookmarks
          .filter((b) => b.userId !== session.userId && b.shareWithPartner)
          .map((b) => b.stepIndex);

        // Completion inference:
        // preferred: partner has session-level reflection row
        // fallback: partner has reflections for every step (legacy sessions without summary row)
        const partnerUniqueRatedSteps = new Set(partnerReflections.map((r) => r.stepIndex)).size;
        const isPartnerComplete =
          Boolean(partnerSessionReflection) || partnerUniqueRatedSteps >= MAX_STEPS;

        if (!isMountedRef.current) return;
        setReportData({
          userRatings,
          userBookmarks,
          userStandoutVerses,
          userMessage: userMsg?.message ?? null,
          partnerMessage: partnerMsg?.message ?? null,
          partnerRatings,
          partnerBookmarks: partnerBookmarks.length > 0 ? partnerBookmarks : null,
          partnerStandoutVerses: partnerStandoutVerses.length > 0 ? partnerStandoutVerses : null,
          isPartnerComplete,
        });
      } catch {
        if (isMountedRef.current) {
          setReportLoadError('Unable to load your daily prayer report right now.');
        }
      }
    })();
  }, [reportSubPhase, session, reportReloadKey]);

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
        const isShared = session.mode === 'together';
        try {
          await scriptureReadingService.addReflection(
            session.id,
            session.currentStepIndex,
            rating,
            notes,
            isShared
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
                isShared,
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
    let announcementTimer: ReturnType<typeof setTimeout> | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    let focusRaf: number | null = null;

    if (
      session &&
      prevStepIndexRef.current !== undefined &&
      prevStepIndexRef.current !== session.currentStepIndex
    ) {
      // Use timeout to decouple announcement from render and fix sync setState lint
      announcementTimer = setTimeout(() => {
        setAnnouncement(`Now on verse ${session.currentStepIndex + 1}`);
      }, 100);
      focusRaf = requestAnimationFrame(() => {
        verseHeadingRef.current?.focus();
      });
      prevStepIndexRef.current = session.currentStepIndex;
      clearTimer = setTimeout(() => setAnnouncement(''), 1000);
    } else {
      prevStepIndexRef.current = session?.currentStepIndex;
    }

    return () => {
      if (announcementTimer !== null) clearTimeout(announcementTimer);
      if (clearTimer !== null) clearTimeout(clearTimer);
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [session?.currentStepIndex, session]);

  // Story 1.5 + 2.1: Screen reader announcements + focus management on sub-view change (AC #2, #3)
  // Combined into single effect to avoid shared-ref race condition between separate effects
  useEffect(() => {
    let announcementTimer: ReturnType<typeof setTimeout> | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    let focusRaf: number | null = null;

    if (prevSubViewRef.current !== subView) {
      if (subView === 'response') {
        const msg = `Viewing response for verse ${(session?.currentStepIndex ?? 0) + 1}`;
        announcementTimer = setTimeout(() => setAnnouncement(msg), 100);
        focusRaf = requestAnimationFrame(() => {
          backToVerseRef.current?.focus();
        });
      } else if (subView === 'reflection') {
        // Story 2.1: Focus reflection heading on transition
        announcementTimer = setTimeout(() => setAnnouncement('Reflect on this verse'), 100);
        focusRaf = requestAnimationFrame(() => {
          // Focus the reflection prompt heading via data-testid
          const reflectionPrompt = document.querySelector<HTMLElement>(
            '[data-testid="scripture-reflection-prompt"]'
          );
          reflectionPrompt?.focus();
        });
      } else if (prevSubViewRef.current === 'response') {
        announcementTimer = setTimeout(
          () => setAnnouncement(`Back to verse ${(session?.currentStepIndex ?? 0) + 1}`),
          100
        );
        focusRaf = requestAnimationFrame(() => {
          verseHeadingRef.current?.focus();
        });
      }
      clearTimer = setTimeout(() => setAnnouncement(''), 1000);
      prevSubViewRef.current = subView;
    }

    return () => {
      if (announcementTimer !== null) clearTimeout(announcementTimer);
      if (clearTimer !== null) clearTimeout(clearTimer);
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [subView, session?.currentStepIndex]);

  // Story 2.3: Announcements + focus management for report transitions
  useEffect(() => {
    let announcementTimer: ReturnType<typeof setTimeout> | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    let focusRaf: number | null = null;

    if (!isReportEntry) {
      prevReportSubPhaseRef.current = null;
      return;
    }
    if (prevReportSubPhaseRef.current === reportSubPhase) return;

    let announcementText: string | null = null;
    let headingSelector: string | null = null;

    if (reportSubPhase === 'compose') {
      announcementText = 'Write a message for your partner';
      headingSelector = '[data-testid="scripture-message-compose-heading"]';
    } else if (reportSubPhase === 'report') {
      announcementText = 'Your Daily Prayer Report';
      headingSelector = '[data-testid="scripture-report-heading"]';
    } else if (reportSubPhase === 'complete-unlinked') {
      announcementText = 'Session complete';
      headingSelector = '[data-testid="scripture-unlinked-complete-heading"]';
    }

    if (announcementText) {
      announcementTimer = setTimeout(() => setAnnouncement(announcementText!), 100);
      focusRaf = requestAnimationFrame(() => {
        const heading = headingSelector
          ? document.querySelector<HTMLElement>(headingSelector)
          : null;
        heading?.focus();
      });
    }

    prevReportSubPhaseRef.current = reportSubPhase;
    clearTimer = setTimeout(() => setAnnouncement(''), 1000);
    return () => {
      if (announcementTimer !== null) clearTimeout(announcementTimer);
      if (clearTimer !== null) clearTimeout(clearTimer);
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [isReportEntry, reportSubPhase]);

  // Computed before guard for useEffect dependency
  const isReflectionPhase = session ? session.currentPhase === 'reflection' : false;
  const isReportPhase = session
    ? session.currentPhase === 'report' || session.currentPhase === 'complete'
    : false;

  // Story 1.5 + 2.2: Completion screen announcement + focus (AC #2, #3)
  useEffect(() => {
    let announcementTimer: ReturnType<typeof setTimeout> | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    let focusRaf: number | null = null;

    if (isReflectionPhase && !prevIsCompletedRef.current) {
      prevIsCompletedRef.current = true;
      const msg = 'Review your session reflections';
      announcementTimer = setTimeout(() => setAnnouncement(msg), 100);
      focusRaf = requestAnimationFrame(() => {
        completionHeadingRef.current?.focus();
      });
      clearTimer = setTimeout(() => setAnnouncement(''), 1000);
    }
    if (!isReflectionPhase) {
      prevIsCompletedRef.current = false;
    }

    return () => {
      if (announcementTimer !== null) clearTimeout(announcementTimer);
      if (clearTimer !== null) clearTimeout(clearTimer);
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [isReflectionPhase]);

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
      <LazyMotion features={loadMotionFeatures} strict>
        <m.div
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
              disabled={isSyncing || isSubmittingSummary}
            />
          </div>
        </m.div>
      </LazyMotion>
    );
  }

  // Story 2.3: Report phase — message compose, daily prayer report, or unlinked completion
  if (isReportPhase) {
    // Unlinked user — show simple completion screen (Task 3, AC #2)
    if (reportSubPhase === 'complete-unlinked') {
      return (
        <LazyMotion features={loadMotionFeatures} strict>
          <m.div
            className="flex min-h-screen flex-col p-4 pb-20"
            style={{ backgroundColor: scriptureTheme.background }}
            data-testid="scripture-unlinked-complete-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={crossfade}
          >
            <div
              className="sr-only"
              aria-live="polite"
              aria-atomic="true"
              data-testid="sr-announcer"
            >
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
              {completionError ? (
                <div
                  role="alert"
                  data-testid="scripture-completion-error"
                  className="w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  <p>{completionError}</p>
                  <button
                    type="button"
                    onClick={handleRetrySessionCompletion}
                    disabled={isRetryingCompletion}
                    data-testid="scripture-completion-retry-btn"
                    className={`mt-3 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 ${FOCUS_RING}`}
                  >
                    {isRetryingCompletion ? 'Retrying...' : 'Retry'}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-purple-600">Your reflections have been saved</p>
              )}
              <button
                onClick={() => exitSession()}
                disabled={Boolean(completionError)}
                className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 ${FOCUS_RING}`}
                data-testid="scripture-unlinked-return-btn"
                type="button"
              >
                Return to Overview
              </button>
            </div>
          </m.div>
        </LazyMotion>
      );
    }

    if (reportSubPhase === 'completion-error') {
      return (
        <LazyMotion features={loadMotionFeatures} strict>
          <m.div
            className="flex min-h-screen flex-col p-4 pb-20"
            style={{ backgroundColor: scriptureTheme.background }}
            data-testid="scripture-completion-error-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={crossfade}
          >
            <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
              {announcement}
            </div>
            <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center space-y-5 text-center">
              <h2
                className="font-serif text-2xl font-bold text-purple-900"
                tabIndex={-1}
                data-testid="scripture-completion-error-heading"
              >
                Couldn&apos;t finish this session
              </h2>
              <p
                className="text-sm text-purple-700"
                data-testid="scripture-completion-error-message"
              >
                {completionError ?? 'Please retry to continue.'}
              </p>
              <button
                type="button"
                onClick={handleRetrySessionCompletion}
                disabled={isRetryingCompletion}
                data-testid="scripture-completion-retry-btn"
                className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 ${FOCUS_RING}`}
              >
                {isRetryingCompletion ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          </m.div>
        </LazyMotion>
      );
    }

    // Linked user — message compose phase (Task 4, AC #1)
    if (reportSubPhase === 'compose') {
      return (
        <LazyMotion features={loadMotionFeatures} strict>
          <m.div
            className="flex min-h-screen flex-col p-4 pb-20"
            style={{ backgroundColor: scriptureTheme.background }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={crossfade}
          >
            <div
              className="sr-only"
              aria-live="polite"
              aria-atomic="true"
              data-testid="sr-announcer"
            >
              {announcement}
            </div>
            <div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4">
              {completionError && (
                <div
                  role="alert"
                  data-testid="scripture-completion-error"
                  className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  <p>{completionError}</p>
                  <button
                    type="button"
                    onClick={handleRetrySessionCompletion}
                    disabled={isRetryingCompletion}
                    data-testid="scripture-completion-retry-btn"
                    className={`mt-3 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 ${FOCUS_RING}`}
                  >
                    {isRetryingCompletion ? 'Retrying...' : 'Retry'}
                  </button>
                </div>
              )}
              <MessageCompose
                partnerName={partner?.displayName ?? 'your partner'}
                onSend={handleMessageSend}
                onSkip={handleMessageSkip}
                disabled={isSendingMessage}
                autoFocusTextarea={false}
              />
            </div>
          </m.div>
        </LazyMotion>
      );
    }

    // Daily Prayer Report display (Task 4, AC #3, #4, #5)
    return (
      <LazyMotion features={loadMotionFeatures} strict>
        <m.div
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
            {reportLoadError && (
              <div
                role="alert"
                data-testid="scripture-report-error"
                className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <p>{reportLoadError}</p>
                <button
                  type="button"
                  onClick={handleRetryReportLoad}
                  data-testid="scripture-report-retry-btn"
                  className={`mt-3 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 ${FOCUS_RING}`}
                >
                  Retry
                </button>
              </div>
            )}
            <DailyPrayerReport
              userRatings={reportData.userRatings}
              userBookmarks={reportData.userBookmarks}
              userStandoutVerses={reportData.userStandoutVerses}
              userMessage={reportData.userMessage}
              partnerMessage={reportData.partnerMessage}
              partnerName={partner?.displayName ?? null}
              partnerRatings={reportData.partnerRatings}
              partnerBookmarks={reportData.partnerBookmarks}
              partnerStandoutVerses={reportData.partnerStandoutVerses}
              isPartnerComplete={reportData.isPartnerComplete}
              onReturn={handleReturnToOverview}
            />
          </div>
        </m.div>
      </LazyMotion>
    );
  }

  // Guard: currentStep should always exist for valid step index
  if (!currentStep) return null;

  return (
    <LazyMotion features={loadMotionFeatures} strict>
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
            <m.div
              key={`step-${session.currentStepIndex}-${subView}`}
              custom={slideDirection}
              variants={subView === 'verse' ? slideVariants : undefined}
              initial={subView === 'verse' ? 'enter' : { opacity: 0 }}
              animate={subView === 'verse' ? 'center' : { opacity: 1 }}
              exit={subView === 'verse' ? 'exit' : { opacity: 0 }}
              transition={
                subView === 'reflection'
                  ? { duration: 0.4 }
                  : subView === 'verse'
                    ? slide
                    : crossfade
              }
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
                  <PerStepReflection onSubmit={handleReflectionSubmit} disabled={isSyncing} />
                </div>
              )}
            </m.div>
          </AnimatePresence>

          {/* Story 1.4: Offline indicator (AC #4) */}
          {!isOnline && (
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
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={crossfade}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
              data-testid="exit-confirm-overlay"
              onClick={handleExitCancel}
            >
              <m.div
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
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}
