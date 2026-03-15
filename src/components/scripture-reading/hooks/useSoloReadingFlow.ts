/**
 * useSoloReadingFlow Hook
 *
 * Extracted from SoloReadingFlow container. Manages all state,
 * effects, and callbacks for the solo reading experience.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/useAppStore';
import { MAX_STEPS } from '../../../data/scriptureSteps';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useMotionConfig } from '../../../hooks/useMotionConfig';
import { useFocusTrap } from '../../../hooks';
import type { ReflectionSummarySubmission } from '../reflection/ReflectionSummary';
import {
  scriptureReadingService,
  handleScriptureError,
  ScriptureErrorCode,
} from '../../../services/scriptureReadingService';

// Sub-view within a step: verse or response
type StepSubView = 'verse' | 'response';

// Story 2.3: Sub-phase within report phase
export type ReportSubPhase = 'compose' | 'report' | 'complete-unlinked' | 'completion-error';

// Direction for slide animation
export type SlideDirection = 'left' | 'right';

export interface ReportData {
  userRatings: { stepIndex: number; rating: number }[];
  userBookmarks: number[];
  userStandoutVerses: number[];
  userMessage: string | null;
  partnerMessage: string | null;
  partnerRatings: { stepIndex: number; rating: number }[] | null;
  partnerBookmarks: number[] | null;
  partnerStandoutVerses: number[] | null;
  isPartnerComplete: boolean;
}

export function useSoloReadingFlow() {
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
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear stale announcements after 1s so aria-live region doesn't retain old text
  useEffect(() => {
    if (!announcement) return;
    if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    announcementTimerRef.current = setTimeout(() => setAnnouncement(''), 1000);
    return () => {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    };
  }, [announcement]);

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
    if (session?.currentPhase === 'report' && !partner && !isLoadingPartner)
      return 'complete-unlinked';
    return 'compose';
  });
  const [reportData, setReportData] = useState<ReportData>({
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

  // Cleanup bookmark debounce on unmount
  useEffect(() => {
    return () => {
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
        } catch (error) {
          handleScriptureError({
            code: ScriptureErrorCode.SYNC_FAILED,
            message: 'Failed to toggle bookmark',
            details: error,
          });
          // Revert optimistic toggle on server failure
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

  // Story 2.2: Handle reflection summary submission
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
            MAX_STEPS,
            data.rating,
            jsonNotes,
            isShared
          );
          try {
            await scriptureReadingService.updateSessionBookmarkSharing(
              session.id,
              session.userId,
              data.shareBookmarkedVerses
            );
          } catch (e) {
            console.error('Bookmark sharing preference failed to save', e);
          }
          await scriptureReadingService.updateSession(session.id, {
            currentPhase: 'report',
          });
          updatePhase('report');
        } catch (error) {
          handleScriptureError({
            code: ScriptureErrorCode.SYNC_FAILED,
            message: 'Failed to save reflection summary',
            details: error,
          });
        } finally {
          setIsSubmittingSummary(false);
        }
      })();
    },
    [isSubmittingSummary, session, updatePhase]
  );

  // Story 2.3: Mark session complete helper
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
      } catch (error) {
        handleScriptureError({
          code: ScriptureErrorCode.SYNC_FAILED,
          message: 'Failed to mark session complete',
          details: error,
        });
        if (attempt < 1) await new Promise((r) => setTimeout(r, 500));
      }
    }

    return false;
  }, [session, updatePhase]);

  const markSessionCompleteRef = useRef(markSessionComplete);
  markSessionCompleteRef.current = markSessionComplete;

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

          const completionSucceeded = await markSessionComplete();
          if (completionSucceeded) {
            setReportLoadError(null);
            setReportSubPhase('report');
          } else {
            setCompletionError('Unable to complete this session. Retry to open your report.');
            setReportSubPhase('completion-error');
          }
        } finally {
          setIsSendingMessage(false);
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
        const completionSucceeded = await markSessionComplete();
        if (completionSucceeded) {
          setReportLoadError(null);
          setReportSubPhase('report');
        } else {
          setCompletionError('Unable to complete this session. Retry to open your report.');
          setReportSubPhase('completion-error');
        }
      } finally {
        setIsSendingMessage(false);
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
          setCompletionError('Unable to complete this session. Please try again.');
          return;
        }

        if (completionRetryTargetRef.current === 'complete-unlinked') {
          setReportSubPhase('complete-unlinked');
        } else {
          setReportLoadError(null);
          setReportSubPhase('report');
        }
      } finally {
        setIsRetryingCompletion(false);
      }
    })();
  }, [isRetryingCompletion, markSessionComplete, session]);

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

    let isActive = true;

    if (!hasPartner) {
      setReportSubPhase('complete-unlinked');
      if (session.currentPhase === 'complete' || session.status === 'complete') {
        setCompletionError(null);
        return;
      }

      completionRetryTargetRef.current = 'complete-unlinked';
      void (async () => {
        const completionSucceeded = await markSessionCompleteRef.current();
        if (!isActive) return;

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

    return () => {
      isActive = false;
    };
  }, [isReportEntry, hasPartner, session, isLoadingPartner]);

  // Story 2.3: Load report data when report view is actually displayed
  useEffect(() => {
    if ((reportSubPhase !== 'report' && reportSubPhase !== 'complete-unlinked') || !session) return;
    setReportLoadError(null);

    let isActive = true;

    void (async () => {
      try {
        const { reflections, bookmarks, messages } =
          await scriptureReadingService.getSessionReportData(session.id);

        const userReflections = reflections.filter(
          (r) => r.userId === session.userId && r.stepIndex < MAX_STEPS && r.rating != null
        );
        const userRatings = userReflections.map((r) => ({
          stepIndex: r.stepIndex,
          rating: r.rating!,
        }));

        const userBookmarks = bookmarks
          .filter((b) => b.userId === session.userId)
          .map((b) => b.stepIndex);

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

        const partnerMsg = messages.find((m) => m.senderId !== session.userId);
        const userMsg = messages.find((m) => m.senderId === session.userId);

        const partnerReflections = reflections.filter(
          (r) => r.userId !== session.userId && r.stepIndex < MAX_STEPS && r.rating != null
        );
        const partnerRatings =
          partnerReflections.length > 0
            ? partnerReflections.map((r) => ({ stepIndex: r.stepIndex, rating: r.rating! }))
            : null;

        const partnerSessionReflection = reflections.find(
          (r) => r.userId !== session.userId && r.stepIndex === MAX_STEPS
        );
        let partnerStandoutVerses: number[] = [];
        if (partnerSessionReflection?.notes) {
          try {
            const parsed = JSON.parse(partnerSessionReflection.notes) as {
              standoutVerses?: number[];
            };
            partnerStandoutVerses = parsed.standoutVerses ?? [];
          } catch (error) {
            handleScriptureError({
              code: ScriptureErrorCode.CACHE_CORRUPTED,
              message: 'Invalid JSON in partner reflection notes',
              details: error,
            });
          }
        }

        const partnerBookmarks = bookmarks
          .filter((b) => b.userId !== session.userId && b.shareWithPartner)
          .map((b) => b.stepIndex);

        const partnerUniqueRatedSteps = new Set(partnerReflections.map((r) => r.stepIndex)).size;
        const isPartnerComplete =
          Boolean(partnerSessionReflection) || partnerUniqueRatedSteps >= MAX_STEPS;

        if (!isActive) return;
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
        if (isActive) {
          setReportLoadError('Unable to load your daily prayer report right now.');
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [reportSubPhase, session, reportReloadKey]);

  // Navigation callbacks
  const handleNextVerse = useCallback(async () => {
    setSlideDirection('left');
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
  useFocusTrap(dialogRef, showExitConfirm, { onEscape: handleExitCancel });

  // Story 1.5: Screen reader announcements + focus management on step change
  useEffect(() => {
    let focusRaf: number | null = null;

    if (
      session &&
      prevStepIndexRef.current !== undefined &&
      prevStepIndexRef.current !== session.currentStepIndex
    ) {
      setAnnouncement(`Now on verse ${session.currentStepIndex + 1}`);
      focusRaf = requestAnimationFrame(() => {
        verseHeadingRef.current?.focus();
      });
      prevStepIndexRef.current = session.currentStepIndex;
    } else {
      prevStepIndexRef.current = session?.currentStepIndex;
    }

    return () => {
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [session?.currentStepIndex, session]);

  // Story 1.5 + 2.1: Screen reader announcements + focus management on sub-view change
  useEffect(() => {
    let focusRaf: number | null = null;

    if (prevSubViewRef.current !== subView) {
      if (subView === 'response') {
        setAnnouncement(`Viewing response for verse ${(session?.currentStepIndex ?? 0) + 1}`);
        focusRaf = requestAnimationFrame(() => {
          backToVerseRef.current?.focus();
        });
      } else if (prevSubViewRef.current === 'response') {
        setAnnouncement(`Back to verse ${(session?.currentStepIndex ?? 0) + 1}`);
        focusRaf = requestAnimationFrame(() => {
          verseHeadingRef.current?.focus();
        });
      }
      prevSubViewRef.current = subView;
    }

    return () => {
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [subView, session?.currentStepIndex]);

  // Story 2.3: Announcements + focus management for report transitions
  useEffect(() => {
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
      setAnnouncement(announcementText);
      focusRaf = requestAnimationFrame(() => {
        const heading = headingSelector
          ? document.querySelector<HTMLElement>(headingSelector)
          : null;
        heading?.focus();
      });
    }

    prevReportSubPhaseRef.current = reportSubPhase;
    return () => {
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [isReportEntry, reportSubPhase]);

  // Computed before guard for useEffect dependency
  const isReflectionPhase = session ? session.currentPhase === 'reflection' : false;
  const isReportPhase = session
    ? session.currentPhase === 'report' || session.currentPhase === 'complete'
    : false;

  // Story 1.5 + 2.2: Completion screen announcement + focus
  useEffect(() => {
    let focusRaf: number | null = null;

    if (isReflectionPhase && !prevIsCompletedRef.current) {
      prevIsCompletedRef.current = true;
      setAnnouncement('Review your session reflections');
      focusRaf = requestAnimationFrame(() => {
        completionHeadingRef.current?.focus();
      });
    }
    if (!isReflectionPhase) {
      prevIsCompletedRef.current = false;
    }

    return () => {
      if (focusRaf !== null) cancelAnimationFrame(focusRaf);
    };
  }, [isReflectionPhase]);

  return {
    // Store state
    session,
    isSyncing,
    scriptureError,
    pendingRetry,
    partner,
    exitSession,
    retryFailedWrite,

    // Network / animation
    isOnline,
    crossfade,
    slide,

    // Local UI state
    subView,
    slideDirection,
    showExitConfirm,
    bookmarkedSteps,
    announcement,

    // Report state
    reportSubPhase,
    reportData,
    isSubmittingSummary,
    isSendingMessage,
    isRetryingCompletion,
    completionError,
    reportLoadError,

    // Computed
    isReflectionPhase,
    isReportPhase,

    // Refs (needed in JSX)
    verseHeadingRef,
    backToVerseRef,
    completionHeadingRef,
    exitButtonRef,
    dialogRef,

    // Handlers
    handleBookmarkToggle,
    handleReflectionSummarySubmit,
    handleMessageSend,
    handleMessageSkip,
    handleRetrySessionCompletion,
    handleReturnToOverview,
    handleRetryReportLoad,
    handleNextVerse,
    handleViewResponse,
    handleBackToVerse,
    handleExitRequest,
    handleExitCancel,
    handleSaveAndExit,
  };
}
