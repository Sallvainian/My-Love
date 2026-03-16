/**
 * useSoloReadingFlow Hook
 *
 * Thin orchestrator that composes sub-hooks by concern:
 * - useReadingNavigation — verse navigation, step transitions, slide direction
 * - useReportPhase — report generation, reflection summary, prayer report state
 * - useSessionPersistence — auto-save, bookmarks, retry logic
 * - useReadingDialogs — exit confirmation dialog, focus trap
 */

import { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/useAppStore';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useMotionConfig } from '../../../hooks/useMotionConfig';
import { useReadingNavigation } from './useReadingNavigation';
import { useReportPhase } from './useReportPhase';
import { useSessionPersistence } from './useSessionPersistence';
import { useReadingDialogs } from './useReadingDialogs';

// Re-export types for consumers that import from this module
export type { SlideDirection } from './useReadingNavigation';
export type { ReportSubPhase, ReportData } from './useReportPhase';

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

  // Shared announcement state (used by navigation + report sub-hooks)
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

  // Sub-hooks
  const persistence = useSessionPersistence({
    session,
    isOnline,
    pendingRetry,
    saveSession,
    retryFailedWrite,
  });

  const navigation = useReadingNavigation({
    session,
    advanceStep,
    setAnnouncement,
  });

  const report = useReportPhase({
    session,
    partner,
    isLoadingPartner,
    updatePhase,
    exitSession,
    setAnnouncement,
  });

  const dialogs = useReadingDialogs({ saveAndExit });

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

    // Announcement (shared)
    announcement,

    // From navigation
    subView: navigation.subView,
    slideDirection: navigation.slideDirection,
    verseHeadingRef: navigation.verseHeadingRef,
    backToVerseRef: navigation.backToVerseRef,
    handleNextVerse: navigation.handleNextVerse,
    handleViewResponse: navigation.handleViewResponse,
    handleBackToVerse: navigation.handleBackToVerse,

    // From persistence
    bookmarkedSteps: persistence.bookmarkedSteps,
    handleBookmarkToggle: persistence.handleBookmarkToggle,

    // From report
    reportSubPhase: report.reportSubPhase,
    reportData: report.reportData,
    isSubmittingSummary: report.isSubmittingSummary,
    isSendingMessage: report.isSendingMessage,
    isRetryingCompletion: report.isRetryingCompletion,
    completionError: report.completionError,
    reportLoadError: report.reportLoadError,
    completionHeadingRef: report.completionHeadingRef,
    isReflectionPhase: report.isReflectionPhase,
    isReportPhase: report.isReportPhase,
    handleReflectionSummarySubmit: report.handleReflectionSummarySubmit,
    handleMessageSend: report.handleMessageSend,
    handleMessageSkip: report.handleMessageSkip,
    handleRetrySessionCompletion: report.handleRetrySessionCompletion,
    handleReturnToOverview: report.handleReturnToOverview,
    handleRetryReportLoad: report.handleRetryReportLoad,

    // From dialogs
    showExitConfirm: dialogs.showExitConfirm,
    exitButtonRef: dialogs.exitButtonRef,
    dialogRef: dialogs.dialogRef,
    handleExitRequest: dialogs.handleExitRequest,
    handleExitCancel: dialogs.handleExitCancel,
    handleSaveAndExit: dialogs.handleSaveAndExit,
  };
}
