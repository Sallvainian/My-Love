/**
 * SoloReadingFlow Container Component
 *
 * Story 1.3: Solo Reading Flow
 * Story 1.4: Save, Resume & Optimistic UI
 * Story 1.5: Accessibility Foundations
 *
 * Orchestrates the step-by-step scripture reading experience.
 * Delegates state management to useSoloReadingFlow hook and
 * renders the appropriate phase component.
 */

import { LazyMotion, m } from 'framer-motion';
import { SCRIPTURE_STEPS, MAX_STEPS } from '../../../data/scriptureSteps';
import { useSoloReadingFlow } from '../hooks/useSoloReadingFlow';
import { ReflectionSummary } from '../reflection/ReflectionSummary';
import { scriptureTheme } from '../constants';
import { ReportPhaseView } from './ReportPhaseView';
import { ReadingPhaseView } from './ReadingPhaseView';

const loadMotionFeatures = () => import('../motionFeatures').then((module) => module.default);

export function SoloReadingFlow() {
  const flow = useSoloReadingFlow();

  // Guard: no session means we shouldn't be here
  if (!flow.session) return null;

  const isLastStep = flow.session.currentStepIndex >= MAX_STEPS - 1;
  const isNextDisabled = flow.isSyncing || !flow.isOnline;

  // Reflection phase
  if (flow.isReflectionPhase) {
    const bookmarkedVerses = Array.from(flow.bookmarkedSteps)
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
          transition={flow.crossfade}
        >
          <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
            {flow.announcement}
          </div>
          <div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4">
            <ReflectionSummary
              bookmarkedVerses={bookmarkedVerses}
              onSubmit={flow.handleReflectionSummarySubmit}
              disabled={flow.isSyncing || flow.isSubmittingSummary}
            />
          </div>
        </m.div>
      </LazyMotion>
    );
  }

  // Report phase
  if (flow.isReportPhase) {
    return (
      <ReportPhaseView
        reportSubPhase={flow.reportSubPhase}
        announcement={flow.announcement}
        crossfade={flow.crossfade}
        completionError={flow.completionError}
        reportLoadError={flow.reportLoadError}
        reportData={flow.reportData}
        isRetryingCompletion={flow.isRetryingCompletion}
        isSendingMessage={flow.isSendingMessage}
        partner={flow.partner}
        completionHeadingRef={flow.completionHeadingRef}
        handleRetrySessionCompletion={flow.handleRetrySessionCompletion}
        handleMessageSend={flow.handleMessageSend}
        handleMessageSkip={flow.handleMessageSkip}
        handleReturnToOverview={flow.handleReturnToOverview}
        handleRetryReportLoad={flow.handleRetryReportLoad}
        exitSession={flow.exitSession}
      />
    );
  }

  // Reading phase
  return (
    <ReadingPhaseView
      session={flow.session}
      state={{
        subView: flow.subView,
        slideDirection: flow.slideDirection,
        showExitConfirm: flow.showExitConfirm,
        isOnline: flow.isOnline,
        isSyncing: flow.isSyncing,
        isNextDisabled,
        isLastStep,
        scriptureError: flow.scriptureError,
        pendingRetry: flow.pendingRetry,
        bookmarkedSteps: flow.bookmarkedSteps,
        announcement: flow.announcement,
      }}
      animations={{ crossfade: flow.crossfade, slide: flow.slide }}
      elementRefs={{
        verseHeading: flow.verseHeadingRef,
        backToVerse: flow.backToVerseRef,
        exitButton: flow.exitButtonRef,
        dialog: flow.dialogRef,
      }}
      handlers={{
        onBookmarkToggle: flow.handleBookmarkToggle,
        onNextVerse: flow.handleNextVerse,
        onViewResponse: flow.handleViewResponse,
        onBackToVerse: flow.handleBackToVerse,
        onExitRequest: flow.handleExitRequest,
        onExitCancel: flow.handleExitCancel,
        onSaveAndExit: flow.handleSaveAndExit,
        onRetryFailedWrite: flow.retryFailedWrite,
      }}
    />
  );
}
