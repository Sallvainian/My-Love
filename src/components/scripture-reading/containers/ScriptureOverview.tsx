/**
 * ScriptureOverview Container Component
 *
 * Story 1.1 + 1.2 + 1.3 + 1.4 + 1.5: Navigation Entry Point, Overview Page,
 * Reading Flow Router, Save/Resume & Optimistic UI, Accessibility Foundations
 *
 * Main entry point for Scripture Reading feature.
 *
 * Handles:
 * - Partner status detection (linked/unlinked/loading)
 * - Start button entry point → mode selection reveal
 * - Mode selection (Solo always available, Together conditional on partner)
 * - Session resume for incomplete solo sessions
 * - Session creation via scriptureReadingSlice
 * - Navigation to partner setup flow
 * - Story 1.3: Routes to SoloReadingFlow when session is active
 * - Story 1.4: Offline blocking of Start/mode selection
 * - Story 1.4: "Start fresh" calls abandonSession to mark server session as abandoned
 * - Story 1.5: Focus-visible styles, semantic HTML, contrast fixes, error icon,
 *   screen reader announcements, touch targets
 *
 * Uses container/presentational pattern:
 * - This container connects to Zustand store
 * - Passes props to presentational components
 */

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/useAppStore';
import { MAX_STEPS } from '../../../data/scriptureSteps';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useMotionConfig } from '../../../hooks/useMotionConfig';
import { SoloReadingFlow } from './SoloReadingFlow';
import { LobbyContainer } from './LobbyContainer';
import { StatsSection } from '../overview/StatsSection';

// Lavender Dreams design tokens
const scriptureTheme = {
  primary: '#A855F7', // Purple-500
  background: '#F3E5F5', // Light lavender
  surface: '#FAF5FF', // Very light purple
};

// Shared focus ring classes (Story 1.5: AC #1)
const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';

// Partner status union type for explicit handling
type PartnerStatus = 'loading' | 'linked' | 'unlinked';

// Helper: extract message from error (handles both string and ScriptureError)
function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}

interface ModeCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant: 'primary' | 'secondary';
  testId?: string;
}

function ModeCard({ title, description, icon, onClick, disabled, variant, testId }: ModeCardProps) {
  const baseClasses = `w-full p-6 rounded-2xl transition-all duration-200 text-left min-h-[120px] flex flex-col backdrop-blur-sm ${FOCUS_RING}`;
  const variantClasses =
    variant === 'primary'
      ? 'bg-purple-500/90 text-white hover:bg-purple-600/90 active:bg-purple-700/90 border border-purple-400/50'
      : 'bg-white/80 border border-purple-200/50 text-gray-800 hover:border-purple-400 active:bg-purple-50/80';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${disabledClasses}`}
      data-testid={testId}
      type="button"
    >
      <div className="mb-2 flex items-center gap-3">
        {icon}
        <span className="text-lg font-semibold">{title}</span>
      </div>
      <p className={`text-sm ${variant === 'primary' ? 'text-purple-100' : 'text-gray-600'}`}>
        {description}
      </p>
    </button>
  );
}

function PartnerStatusSkeleton() {
  return (
    <div className="animate-pulse" data-testid="partner-status-skeleton">
      <div className="mb-2 h-4 w-3/4 rounded bg-purple-200" />
      <div className="h-3 w-1/2 rounded bg-purple-100" />
    </div>
  );
}

interface PartnerLinkMessageProps {
  onLinkPartner: () => void;
}

function PartnerLinkMessage({ onLinkPartner }: PartnerLinkMessageProps) {
  return (
    <button
      onClick={onLinkPartner}
      className={`w-full rounded-xl border border-purple-200 bg-purple-50 p-4 text-left text-purple-700 transition-colors hover:bg-purple-100 ${FOCUS_RING}`}
      data-testid="link-partner-message"
      type="button"
    >
      <span className="text-sm font-medium">🔗 Link your partner to do this together</span>
    </button>
  );
}

// Solo icon component
function SoloIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

// Together icon component
function TogetherIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
      />
    </svg>
  );
}

export function ScriptureOverview() {
  const { modeReveal } = useMotionConfig();
  const { isOnline } = useNetworkStatus();

  // Partner slice state
  const { partner, isLoadingPartner, loadPartner, setView } = useAppStore(
    useShallow((state) => ({
      partner: state.partner,
      isLoadingPartner: state.isLoadingPartner,
      loadPartner: state.loadPartner,
      setView: state.setView,
    }))
  );

  // Scripture reading slice state
  const {
    session,
    isSessionLoading,
    sessionError,
    activeSession,
    isCheckingSession,
    createSession,
    loadSession,
    abandonSession,
    clearActiveSession,
    clearScriptureError,
    checkForActiveSession,
    coupleStats,
    isStatsLoading,
    loadCoupleStats,
  } = useAppStore(
    useShallow((state) => ({
      session: state.session,
      isSessionLoading: state.scriptureLoading,
      sessionError: state.scriptureError,
      activeSession: state.activeSession,
      isCheckingSession: state.isCheckingSession,
      createSession: state.createSession,
      loadSession: state.loadSession,
      abandonSession: state.abandonSession,
      clearActiveSession: state.clearActiveSession,
      clearScriptureError: state.clearScriptureError,
      checkForActiveSession: state.checkForActiveSession,
      coupleStats: state.coupleStats,
      isStatsLoading: state.isStatsLoading,
      loadCoupleStats: state.loadCoupleStats,
    }))
  );

  // Local UI state
  const [isModeSelectionRequested, setIsModeSelectionRequested] = useState(false);
  const [freshStartRequested] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('fresh') === 'true';
  });

  // Story 1.5: Screen reader announcement state (AC #2)
  const [announcement, setAnnouncement] = useState('');
  const showModes = isModeSelectionRequested && !session;

  // Load partner status on mount
  useEffect(() => {
    loadPartner();
  }, [loadPartner]);

  // Story 3.1: Load couple stats on mount (after partner loading)
  // Skip RPC call when offline — show cached stats from Zustand persist
  useEffect(() => {
    if (!isLoadingPartner && isOnline) {
      void loadCoupleStats();
    }
  }, [isLoadingPartner, isOnline, loadCoupleStats]);

  // Check for incomplete solo session on mount (AC #6)
  // Re-check when session becomes null (e.g., after save-and-exit)
  useEffect(() => {
    if (!session) {
      if (freshStartRequested) {
        // Test helper path: bypass resume prompt without mutating server state.
        clearActiveSession();
        return;
      }
      void checkForActiveSession();
    }
  }, [checkForActiveSession, clearActiveSession, freshStartRequested, session]);

  // Story 1.5: Announce session resume when activeSession loads (AC #2)
  useEffect(() => {
    if (activeSession && !isCheckingSession) {
      const showTimer = setTimeout(() => {
        setAnnouncement(`Session resumed at verse ${activeSession.currentStepIndex + 1}`);
      }, 0);
      const clearTimer = setTimeout(() => setAnnouncement(''), 1000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [activeSession, isCheckingSession]);

  // Determine partner status
  const getPartnerStatus = (): PartnerStatus => {
    if (isLoadingPartner) return 'loading';
    if (partner !== null) return 'linked';
    return 'unlinked';
  };

  const partnerStatus = getPartnerStatus();

  // Action handlers
  const handleStart = useCallback(() => {
    setIsModeSelectionRequested(true);
    clearScriptureError();
  }, [clearScriptureError]);

  const handleStartSolo = useCallback(async () => {
    await createSession('solo');
  }, [createSession]);

  const handleStartTogether = useCallback(async () => {
    if (partner) {
      await createSession('together', partner.id);
    }
  }, [createSession, partner]);

  const handleContinue = useCallback(async () => {
    if (activeSession) {
      await loadSession(activeSession.id);
    }
  }, [activeSession, loadSession]);

  // Story 1.4: "Start fresh" → abandon server session, then allow new session
  const handleStartFresh = useCallback(async () => {
    if (activeSession) {
      await abandonSession(activeSession.id);
    }
    setIsModeSelectionRequested(false);
  }, [activeSession, abandonSession]);

  const handleLinkPartner = useCallback(() => {
    setView('partner');
  }, [setView]);

  const fadeTransition = modeReveal;

  // Story 1.3: Route to SoloReadingFlow when session is active
  if (session && session.status === 'in_progress' && session.mode === 'solo') {
    return <SoloReadingFlow />;
  }

  // Story 1.3: Also route to SoloReadingFlow for completion screen
  if (session && (session.status === 'complete' || session.currentPhase === 'reflection')) {
    return <SoloReadingFlow />;
  }

  // Story 4.1: Route to LobbyContainer for together-mode lobby and countdown phases
  if (
    session &&
    session.mode === 'together' &&
    (session.currentPhase === 'lobby' || session.currentPhase === 'countdown')
  ) {
    return <LobbyContainer />;
  }

  return (
    <main
      className="min-h-screen p-4"
      style={{ backgroundColor: scriptureTheme.background }}
      data-testid="scripture-overview"
    >
      {/* Story 1.5: Screen reader announcer (AC #2) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="sr-announcer">
        {announcement}
      </div>

      <div className="mx-auto max-w-md space-y-6">
        {/* Header with Playfair Display */}
        <header className="pt-4 pb-2 text-center">
          <h1 className="font-serif text-2xl font-bold text-purple-900">Scripture Reading</h1>
          <p className="mt-1 text-purple-700">Read and reflect together</p>
        </header>

        {/* Story 3.1: Stats Section */}
        <StatsSection stats={coupleStats} isLoading={isStatsLoading} />

        {/* Partner Status Area */}
        <section className="space-y-4" aria-label="Partner status">
          {partnerStatus === 'loading' && <PartnerStatusSkeleton />}
          {partnerStatus === 'unlinked' && <PartnerLinkMessage onLinkPartner={handleLinkPartner} />}
        </section>

        {/* Resume Prompt (AC #6) */}
        {!isCheckingSession && activeSession && !showModes && (
          <section
            className="space-y-4 rounded-2xl border border-purple-200/50 bg-white/80 p-5 backdrop-blur-sm"
            data-testid="resume-prompt"
            aria-label="Resume session"
          >
            <p className="font-medium text-purple-900">
              Continue where you left off? (Step {activeSession.currentStepIndex + 1} of {MAX_STEPS}
              )
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleContinue}
                disabled={isSessionLoading}
                className={`min-h-[48px] flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3 font-medium text-white hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 ${FOCUS_RING}`}
                data-testid="resume-continue"
                type="button"
              >
                {isSessionLoading ? 'Loading...' : 'Continue'}
              </button>
              <button
                onClick={handleStartFresh}
                className={`min-h-[48px] rounded-lg px-4 py-3 font-medium text-purple-600 hover:text-purple-800 ${FOCUS_RING}`}
                data-testid="resume-start-fresh"
                type="button"
              >
                Start fresh
              </button>
            </div>
          </section>
        )}

        {/* Story 1.4: Offline indicator for overview (AC #4) */}
        {!isOnline && (
          <div
            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
            data-testid="offline-indicator"
            role="status"
            aria-live="polite"
          >
            <svg
              className="h-4 w-4 flex-shrink-0"
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
            <span>You&apos;re offline</span>
          </div>
        )}

        {/* Error Display — Story 1.5: warning icon for color independence (AC #5) */}
        {sessionError && (
          <div
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            data-testid="session-error"
            role="alert"
          >
            <svg
              className="h-4 w-4 flex-shrink-0"
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
            <span>{getErrorMessage(sessionError)}</span>
          </div>
        )}

        {/* Start Button (AC #2, #3) — shown when no resume prompt and modes not yet revealed */}
        {!showModes && !activeSession && !isCheckingSession && (
          <button
            onClick={handleStart}
            disabled={!isOnline}
            className={`min-h-[56px] w-full rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 ${FOCUS_RING}`}
            data-testid="scripture-start-button"
            type="button"
          >
            Start
          </button>
        )}

        {/* Loading skeleton while checking for active session */}
        {!showModes && isCheckingSession && (
          <div
            className="h-[56px] w-full animate-pulse rounded-2xl bg-purple-200/50"
            data-testid="session-check-loading"
          />
        )}

        {/* Mode Selection Cards (AC #3, #4, #5) — revealed after Start tap */}
        <AnimatePresence>
          {showModes && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={fadeTransition}
              className="space-y-4"
              aria-label="Choose reading mode"
              data-testid="mode-selection"
            >
              {/* Loading overlay during session creation */}
              {isSessionLoading && (
                <div className="py-2 text-center text-purple-600" data-testid="session-loading">
                  Creating session...
                </div>
              )}

              {/* Solo Mode - Always accessible (when online) */}
              <ModeCard
                title="Solo"
                description="Read and reflect on your own time"
                icon={<SoloIcon />}
                onClick={handleStartSolo}
                disabled={isSessionLoading || !isOnline}
                variant="secondary"
                testId="scripture-mode-solo"
              />

              {/* Together Mode - Conditional on partner (AC #4, #5) */}
              <ModeCard
                title="Together"
                description={
                  partnerStatus === 'linked'
                    ? 'Read and reflect with your partner in real-time'
                    : 'Link your partner to do this together'
                }
                icon={<TogetherIcon />}
                onClick={handleStartTogether}
                disabled={partnerStatus !== 'linked' || isSessionLoading || !isOnline}
                variant="primary"
              />

              {/* Partner link for unlinked users within mode selection (AC #5) — Story 1.5: min touch target */}
              {partnerStatus === 'unlinked' && (
                <button
                  onClick={handleLinkPartner}
                  className={`min-h-[44px] w-full rounded-lg py-2 text-center text-sm font-medium text-purple-600 hover:text-purple-800 ${FOCUS_RING}`}
                  data-testid="setup-partner-link"
                  type="button"
                >
                  Set up partner
                </button>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
