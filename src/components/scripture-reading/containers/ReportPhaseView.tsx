/**
 * ReportPhaseView Component
 *
 * Renders the report phase of the solo reading flow:
 * - Unlinked completion screen
 * - Completion error screen
 * - Message compose screen (linked users)
 * - Daily Prayer Report display
 */

import { type RefObject } from 'react';
import { LazyMotion, m } from 'framer-motion';
import { MessageCompose } from '../reflection/MessageCompose';
import { DailyPrayerReport } from '../reflection/DailyPrayerReport';
import { FOCUS_RING, scriptureTheme } from '../constants';
import type { ReportSubPhase, ReportData } from '../hooks/useSoloReadingFlow';

const loadMotionFeatures = () => import('../motionFeatures').then((module) => module.default);

interface ReportPhaseViewProps {
  reportSubPhase: ReportSubPhase;
  announcement: string;
  crossfade: { duration: number };
  completionError: string | null;
  reportLoadError: string | null;
  reportData: ReportData;
  isRetryingCompletion: boolean;
  isSendingMessage: boolean;
  partner: { displayName: string } | null;
  completionHeadingRef: RefObject<HTMLHeadingElement | null>;
  handleRetrySessionCompletion: () => void;
  handleMessageSend: (message: string) => void;
  handleMessageSkip: () => void;
  handleReturnToOverview: () => void;
  handleRetryReportLoad: () => void;
  exitSession: () => void;
}

export function ReportPhaseView({
  reportSubPhase,
  announcement,
  crossfade,
  completionError,
  reportLoadError,
  reportData,
  isRetryingCompletion,
  isSendingMessage,
  partner,
  completionHeadingRef,
  handleRetrySessionCompletion,
  handleMessageSend,
  handleMessageSkip,
  handleReturnToOverview,
  handleRetryReportLoad,
  exitSession,
}: ReportPhaseViewProps) {
  // Unlinked user — simple completion screen
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

  // Completion error screen
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
            <p className="text-sm text-purple-700" data-testid="scripture-completion-error-message">
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
            <button
              type="button"
              onClick={() => exitSession()}
              data-testid="scripture-completion-error-return-btn"
              className={`min-h-[48px] text-sm font-medium text-purple-600 hover:text-purple-800 ${FOCUS_RING}`}
            >
              Return to Overview
            </button>
          </div>
        </m.div>
      </LazyMotion>
    );
  }

  // Linked user — message compose phase
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
          <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
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

  // Daily Prayer Report display
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
