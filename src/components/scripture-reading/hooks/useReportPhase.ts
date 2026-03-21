/**
 * useReportPhase Hook
 *
 * Manages report/reflection/completion state, session completion logic,
 * report data loading, and related accessibility for the reading flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartnerInfo } from '../../../api/partnerService';
import { MAX_STEPS } from '../../../data/scriptureSteps';
import type { ScriptureSession } from '../../../services/dbSchema';
import {
  handleScriptureError,
  ScriptureErrorCode,
  scriptureReadingService,
} from '../../../services/scriptureReadingService';
import type { SessionPhase } from '../../../stores/slices/scriptureReadingSlice';
import { logger } from '../../../utils/logger';
import type { ReflectionSummarySubmission } from '../reflection/ReflectionSummary';

// Story 2.3: Sub-phase within report phase
export type ReportSubPhase = 'compose' | 'report' | 'complete-unlinked' | 'completion-error';

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

interface UseReportPhaseParams {
  session: ScriptureSession | null;
  partner: PartnerInfo | null;
  isLoadingPartner: boolean;
  updatePhase: (phase: SessionPhase) => void;
  exitSession: () => void;
  setAnnouncement: (text: string) => void;
}

export function useReportPhase({
  session,
  partner,
  isLoadingPartner,
  updatePhase,
  exitSession,
  setAnnouncement,
}: UseReportPhaseParams) {
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
  const [messageSendFailed, setMessageSendFailed] = useState(false);
  const [reportReloadKey, setReportReloadKey] = useState(0);
  const completionRetryTargetRef = useRef<'report' | 'complete-unlinked'>('report');
  const prevReportSubPhaseRef = useRef<ReportSubPhase | null>(null);

  // Story 1.5: Focus management refs
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const prevIsCompletedRef = useRef(false);

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
            handleScriptureError({
              code: ScriptureErrorCode.SYNC_FAILED,
              message: 'Bookmark sharing preference failed to save',
              details: e,
            });
          }
          try {
            await scriptureReadingService.updateSession(session.id, {
              currentPhase: 'report',
            });
            updatePhase('report');
          } catch (phaseError) {
            handleScriptureError({
              code: ScriptureErrorCode.SYNC_FAILED,
              message: 'Reflection saved but failed to advance to report phase',
              details: phaseError,
            });
          }
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
      setMessageSendFailed(false);
      completionRetryTargetRef.current = 'report';

      void (async () => {
        try {
          try {
            await scriptureReadingService.addMessage(session.id, session.userId, message);
          } catch (error) {
            logger.info('Message write failed, proceeding with session completion', error);
            setMessageSendFailed(true);
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

  // Computed before guard for useEffect dependency
  const isReflectionPhase = session ? session.currentPhase === 'reflection' : false;
  const isReportPhase = session
    ? session.currentPhase === 'report' || session.currentPhase === 'complete'
    : false;

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
  }, [isReportEntry, reportSubPhase, setAnnouncement]);

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
  }, [isReflectionPhase, setAnnouncement]);

  return {
    // Report state
    reportSubPhase,
    reportData,
    isSubmittingSummary,
    isSendingMessage,
    isRetryingCompletion,
    completionError,
    reportLoadError,
    messageSendFailed,

    // Refs
    completionHeadingRef,

    // Computed
    isReflectionPhase,
    isReportPhase,

    // Handlers
    handleReflectionSummarySubmit,
    handleMessageSend,
    handleMessageSkip,
    handleRetrySessionCompletion,
    handleReturnToOverview,
    handleRetryReportLoad,
  };
}
