/**
 * ScriptureOverview Container Component
 *
 * Story 1.1 + 1.2: Navigation Entry Point & Overview Page
 * Main entry point for Scripture Reading feature.
 *
 * Handles:
 * - Partner status detection (linked/unlinked/loading)
 * - Start button entry point → mode selection reveal
 * - Mode selection (Solo always available, Together conditional on partner)
 * - Session resume for incomplete solo sessions
 * - Session creation via scriptureReadingSlice
 * - Navigation to partner setup flow
 *
 * Uses container/presentational pattern:
 * - This container connects to Zustand store
 * - Passes props to presentational components
 */

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAppStore } from '../../../stores/useAppStore';
import { MAX_STEPS } from '../../../data/scriptureSteps';

// Lavender Dreams design tokens
const scriptureTheme = {
  primary: '#A855F7', // Purple-500
  background: '#F3E5F5', // Light lavender
  surface: '#FAF5FF', // Very light purple
};

// Animation duration for mode selection reveal (seconds)
const MODE_REVEAL_DURATION = 0.2;

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
}

function ModeCard({ title, description, icon, onClick, disabled, variant }: ModeCardProps) {
  const baseClasses =
    'w-full p-6 rounded-2xl transition-all duration-200 text-left min-h-[120px] flex flex-col backdrop-blur-sm';
  const variantClasses =
    variant === 'primary'
      ? 'bg-purple-500/90 text-white hover:bg-purple-600/90 active:bg-purple-700/90 border border-purple-400/50'
      : 'bg-white/80 border border-purple-200/50 text-gray-800 hover:border-purple-400 active:bg-purple-50/80';
  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${disabledClasses}`}
      type="button"
    >
      <div className="flex items-center gap-3 mb-2">
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
      <div className="h-4 bg-purple-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-purple-100 rounded w-1/2" />
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
      className="w-full p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 hover:bg-purple-100 transition-colors text-left"
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
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const shouldReduceMotion = useReducedMotion();

  // Partner slice state
  const { partner, isLoadingPartner, loadPartner, setView } = useAppStore((state) => ({
    partner: state.partner,
    isLoadingPartner: state.isLoadingPartner,
    loadPartner: state.loadPartner,
    setView: state.setView,
  }));

  // Scripture reading slice state
  const {
    isSessionLoading,
    sessionError,
    activeSession,
    isCheckingSession,
    createSession,
    loadSession,
    exitSession,
    clearScriptureError,
    checkForActiveSession,
  } = useAppStore((state) => ({
    isSessionLoading: state.scriptureLoading,
    sessionError: state.scriptureError,
    activeSession: state.activeSession,
    isCheckingSession: state.isCheckingSession,
    createSession: state.createSession,
    loadSession: state.loadSession,
    exitSession: state.exitSession,
    clearScriptureError: state.clearScriptureError,
    checkForActiveSession: state.checkForActiveSession,
  }));

  // Local UI state
  const [showModes, setShowModes] = useState(false);

  // Load partner status on mount
  useEffect(() => {
    loadPartner();
  }, [loadPartner]);

  // Check for incomplete solo session on mount (AC #6)
  useEffect(() => {
    void checkForActiveSession();
  }, [checkForActiveSession]);

  // Determine partner status
  const getPartnerStatus = (): PartnerStatus => {
    if (isLoadingPartner) return 'loading';
    if (partner !== null) return 'linked';
    return 'unlinked';
  };

  const partnerStatus = getPartnerStatus();

  // Action handlers
  const handleStart = useCallback(() => {
    setShowModes(true);
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

  const handleStartFresh = useCallback(() => {
    exitSession();
    setShowModes(false);
  }, [exitSession]);

  const handleLinkPartner = useCallback(() => {
    setView('partner');
  }, [setView]);

  const fadeTransition = shouldReduceMotion ? { duration: 0 } : { duration: MODE_REVEAL_DURATION };

  return (
    <div
      className="min-h-screen p-4"
      style={{ backgroundColor: scriptureTheme.background }}
      data-testid="scripture-overview"
    >
      <div className="max-w-md mx-auto space-y-6">
        {/* Header with Playfair Display */}
        <header className="text-center pt-4 pb-2">
          <h1 className="text-2xl font-bold text-purple-900 font-serif">Scripture Reading</h1>
          <p className="text-purple-700 mt-1">Read and reflect together</p>
        </header>

        {/* Partner Status Area */}
        <section className="space-y-4" aria-label="Partner status">
          {partnerStatus === 'loading' && <PartnerStatusSkeleton />}
          {partnerStatus === 'unlinked' && <PartnerLinkMessage onLinkPartner={handleLinkPartner} />}
        </section>

        {/* Resume Prompt (AC #6) */}
        {!isCheckingSession && activeSession && !showModes && (
          <section
            className="bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl p-5 space-y-4"
            data-testid="resume-prompt"
            aria-label="Resume session"
          >
            <p className="text-purple-900 font-medium">
              Continue where you left off? (Step {activeSession.currentStepIndex + 1} of {MAX_STEPS})
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleContinue}
                disabled={isSessionLoading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 disabled:opacity-50 min-h-[48px]"
                data-testid="resume-continue"
                type="button"
              >
                {isSessionLoading ? 'Loading...' : 'Continue'}
              </button>
              <button
                onClick={handleStartFresh}
                className="py-3 px-4 text-purple-600 hover:text-purple-800 font-medium min-h-[48px]"
                data-testid="resume-start-fresh"
                type="button"
              >
                Start fresh
              </button>
            </div>
          </section>
        )}

        {/* Error Display */}
        {sessionError && (
          <div
            className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm"
            data-testid="session-error"
            role="alert"
          >
            {getErrorMessage(sessionError)}
          </div>
        )}

        {/* Start Button (AC #2, #3) — shown when no resume prompt and modes not yet revealed */}
        {!showModes && !activeSession && !isCheckingSession && (
          <button
            onClick={handleStart}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-semibold text-lg hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 min-h-[56px] shadow-lg shadow-purple-500/25"
            data-testid="start-button"
            type="button"
          >
            Start
          </button>
        )}

        {/* Loading skeleton while checking for active session */}
        {!showModes && isCheckingSession && (
          <div
            className="w-full h-[56px] bg-purple-200/50 rounded-2xl animate-pulse"
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
                <div
                  className="text-center text-purple-600 py-2"
                  data-testid="session-loading"
                >
                  Creating session...
                </div>
              )}

              {/* Solo Mode - Always accessible */}
              <ModeCard
                title="Solo"
                description="Read and reflect on your own time"
                icon={<SoloIcon />}
                onClick={handleStartSolo}
                disabled={isSessionLoading}
                variant="secondary"
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
                disabled={partnerStatus !== 'linked' || isSessionLoading}
                variant="primary"
              />

              {/* Partner link for unlinked users within mode selection (AC #5) */}
              {partnerStatus === 'unlinked' && (
                <button
                  onClick={handleLinkPartner}
                  className="w-full text-center text-purple-600 hover:text-purple-800 text-sm font-medium py-2"
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
    </div>
  );
}
