/**
 * ReadingContainer — Together-mode reading orchestrator
 *
 * Story 4.2: All ACs
 *
 * Manages:
 * - Role indicator (alternating reader/responder)
 * - Verse / response navigation tabs
 * - Lock-in button + waiting state
 * - Partner position via useScripturePresence
 * - Step advance animation (slide-left on lock-in complete)
 * - "Session updated" toast on 409 version mismatch
 *
 * Does NOT call useScriptureBroadcast — it is mounted by ScriptureOverview
 * and persists through the lobby → reading transition.
 */

import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/useAppStore';
import type { SessionRole } from '../../../stores/slices/scriptureReadingSlice';
import { SCRIPTURE_STEPS, MAX_STEPS } from '../../../data/scriptureSteps';
import { useScripturePresence } from '../../../hooks/useScripturePresence';
import { useMotionConfig } from '../../../hooks/useMotionConfig';
import { BookmarkFlag } from '../reading/BookmarkFlag';
import { RoleIndicator } from '../reading/RoleIndicator';
import { PartnerPosition } from '../reading/PartnerPosition';
import { LockInButton } from '../session/LockInButton';
import { DisconnectionOverlay } from '../session/DisconnectionOverlay';

// Lavender Dreams design tokens
const scriptureTheme = {
  primary: '#A855F7',
  background: '#F3E5F5',
};

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';

export function ReadingContainer(): ReactElement | null {
  const { slide } = useMotionConfig();

  const {
    session,
    myRole,
    isPendingLockIn,
    partnerLocked,
    scriptureError,
    lockIn,
    undoLockIn,
    partner,
    partnerDisconnected,
    partnerDisconnectedAt,
    setPartnerDisconnected,
    endSession,
    loadSession,
    isSyncing,
  } = useAppStore(
    useShallow((state) => ({
      session: state.session,
      myRole: state.myRole,
      isPendingLockIn: state.isPendingLockIn,
      partnerLocked: state.partnerLocked,
      scriptureError: state.scriptureError,
      lockIn: state.lockIn,
      undoLockIn: state.undoLockIn,
      partner: state.partner,
      partnerDisconnected: state.partnerDisconnected,
      partnerDisconnectedAt: state.partnerDisconnectedAt,
      setPartnerDisconnected: state.setPartnerDisconnected,
      endSession: state.endSession,
      loadSession: state.loadSession,
      isSyncing: state.isSyncing,
    }))
  );

  const partnerName = partner?.displayName ?? 'your partner';

  // Local view state: verse or response tab
  const [localView, setLocalView] = useState<'verse' | 'response'>('verse');
  const [bookmarkedSteps, setBookmarkedSteps] = useState<Set<number>>(new Set());
  const [isLockActionPending, setIsLockActionPending] = useState(false);

  // Story 4.3: Reconnected toast (green tint, 2s auto-dismiss)
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);
  const reconnectedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Presence channel
  const partnerPresence = useScripturePresence(
    session?.id ?? null,
    session?.currentStepIndex ?? 0,
    localView
  );

  // Story 4.3: Track isPartnerConnected transitions
  const prevConnectedRef = useRef(partnerPresence.isPartnerConnected);
  useEffect(() => {
    const wasConnected = prevConnectedRef.current;
    const isConnected = partnerPresence.isPartnerConnected;
    prevConnectedRef.current = isConnected;

    if (wasConnected && !isConnected) {
      // Partner disconnected
      setPartnerDisconnected(true);
    } else if (!wasConnected && isConnected) {
      // Partner reconnected — resync state
      setPartnerDisconnected(false);
      if (session?.id) {
        void loadSession(session.id);
      }
      // Story 4.3: Show "Reconnected" toast (green tint, 2s auto-dismiss)
      setShowReconnectedToast(true);
      if (reconnectedToastTimerRef.current) clearTimeout(reconnectedToastTimerRef.current);
      reconnectedToastTimerRef.current = setTimeout(
        () => setShowReconnectedToast(false),
        2000
      );
    }
    return () => {
      if (reconnectedToastTimerRef.current) clearTimeout(reconnectedToastTimerRef.current);
    };
  }, [partnerPresence.isPartnerConnected, setPartnerDisconnected, loadSession, session?.id]);

  // Story 4.3: Keep Waiting handler — dismiss timeout buttons, return to reconnecting state
  const handleKeepWaiting = useCallback(() => {
    // If partner already reconnected during Phase B (race condition), dismiss overlay
    if (partnerPresence.isPartnerConnected) {
      setPartnerDisconnected(false);
    } else {
      // Reset disconnectedAt to "now" so the overlay restarts Phase A countdown
      setPartnerDisconnected(true);
    }
  }, [partnerPresence.isPartnerConnected, setPartnerDisconnected]);

  const handleEndSession = useCallback(() => {
    void endSession();
  }, [endSession]);

  // Track previous step index for animation direction
  const prevStepRef = useRef(session?.currentStepIndex ?? 0);

  // Toast state for "Session updated" on 409
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errorToastMessage, setErrorToastMessage] = useState<string | null>(null);
  const errorToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Watch scriptureError for 409 "Session updated" toast
  useEffect(() => {
    if (scriptureError?.message === 'Session updated') {
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 3000);
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [scriptureError]);

  // Show a visible error toast for non-409 sync failures (including endSession RPC failures).
  useEffect(() => {
    if (!scriptureError || scriptureError.message === 'Session updated') return;

    const message = scriptureError.message.trim() || 'Something went wrong. Please try again.';
    setErrorToastMessage(message);
    if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current);
    errorToastTimerRef.current = setTimeout(() => setErrorToastMessage(null), 4000);

    return () => {
      if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current);
    };
  }, [scriptureError]);

  // Reset localView to 'verse' on step advance
  useEffect(() => {
    if (session && session.currentStepIndex !== prevStepRef.current) {
      prevStepRef.current = session.currentStepIndex;
      setLocalView('verse');
    }
  }, [session?.currentStepIndex, session]);

  // Effective role calculation: roles alternate each step
  const effectiveRole: SessionRole =
    myRole === null
      ? 'reader'
      : (myRole === 'reader') === ((session?.currentStepIndex ?? 0) % 2 === 0)
        ? 'reader'
        : 'responder';

  // Current step data
  const currentStepIndex = session?.currentStepIndex ?? 0;
  const step = SCRIPTURE_STEPS[currentStepIndex];
  const isBookmarked = bookmarkedSteps.has(currentStepIndex);

  const handleBookmarkToggle = useCallback(() => {
    setBookmarkedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(currentStepIndex)) {
        next.delete(currentStepIndex);
      } else {
        next.add(currentStepIndex);
      }
      return next;
    });
  }, [currentStepIndex]);

  const handleLockIn = useCallback(() => {
    if (isLockActionPending || isPendingLockIn) return;
    setIsLockActionPending(true);
    void lockIn().finally(() => setIsLockActionPending(false));
  }, [isLockActionPending, isPendingLockIn, lockIn]);

  const handleUndoLockIn = useCallback(() => {
    if (isLockActionPending) return;
    setIsLockActionPending(true);
    void undoLockIn().finally(() => setIsLockActionPending(false));
  }, [isLockActionPending, undoLockIn]);

  if (!session || !step) return null;

  return (
    <main
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: scriptureTheme.background }}
      data-testid="reading-container"
    >
      {/* Story 4.3: Disconnection overlay */}
      {partnerDisconnected && partnerDisconnectedAt !== null && (
        <DisconnectionOverlay
          partnerName={partnerName}
          disconnectedAt={partnerDisconnectedAt}
          onKeepWaiting={handleKeepWaiting}
          onEndSession={handleEndSession}
          isEnding={isSyncing}
        />
      )}

      {/* Toast: "Session updated" */}
      {showToast && (
        <div
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-purple-200 px-4 py-2 text-sm text-purple-800 shadow-md"
          data-testid="session-update-toast"
          role="status"
        >
          Session updated
        </div>
      )}

      {/* Story 4.3: Toast — "Reconnected" (green tint, 2s auto-dismiss) */}
      {showReconnectedToast && (
        <div
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-green-200 px-4 py-2 text-sm text-green-800 shadow-md"
          data-testid="reconnected-toast"
          role="status"
        >
          Reconnected
        </div>
      )}

      {/* Story 4.3: Visible sync failure toast for reading phase actions */}
      {errorToastMessage && (
        <div
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-800 shadow-md"
          data-testid="session-error-toast"
          role="alert"
        >
          {errorToastMessage}
        </div>
      )}

      <div className="mx-auto w-full max-w-md flex-1 p-4">
        {/* Step progress */}
        <header className="mb-4 text-center">
          <p className="text-sm font-medium text-purple-600" data-testid="reading-step-progress">
            Verse {currentStepIndex + 1} of {MAX_STEPS}
          </p>
          <p className="mt-1 text-xs text-purple-400">{step.sectionTheme}</p>
        </header>

        {/* Role indicator */}
        <div className="mb-4 text-center">
          <RoleIndicator role={effectiveRole} />
        </div>

        {/* Verse / Response tabs */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setLocalView('verse')}
            className={`min-h-[48px] flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
              localView === 'verse'
                ? 'bg-purple-500 text-white'
                : 'bg-white/60 text-purple-700 hover:bg-white/80'
            } ${FOCUS_RING}`}
            data-testid="reading-tab-verse"
            aria-pressed={localView === 'verse'}
          >
            Verse
          </button>
          <button
            type="button"
            onClick={() => setLocalView('response')}
            className={`min-h-[48px] flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
              localView === 'response'
                ? 'bg-purple-500 text-white'
                : 'bg-white/60 text-purple-700 hover:bg-white/80'
            } ${FOCUS_RING}`}
            data-testid="reading-tab-response"
            aria-pressed={localView === 'response'}
          >
            Response
          </button>
        </div>

        {/* Reading content with step animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentStepIndex}-${localView}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={slide}
            className="rounded-2xl border border-purple-200/50 bg-white/80 p-6 backdrop-blur-sm"
          >
            {localView === 'verse' ? (
              <div>
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-purple-600">{step.verseReference}</p>
                    <BookmarkFlag isBookmarked={isBookmarked} onToggle={handleBookmarkToggle} />
                  </div>
                </div>
                <p
                  className="font-serif text-lg leading-relaxed text-gray-800"
                  data-testid="reading-verse-text"
                >
                  {step.verseText}
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-sm font-medium text-purple-600">Response Prayer</p>
                <p
                  className="text-base leading-relaxed text-gray-700"
                  data-testid="reading-response-text"
                >
                  {step.responseText}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Partner position */}
        <div className="mt-4 text-center">
          <PartnerPosition partnerName={partnerName} presence={partnerPresence} />
        </div>
      </div>

      {/* Lock-in area — fixed at bottom */}
      <div className="sticky bottom-0 border-t border-purple-200/50 bg-white/90 p-4 backdrop-blur-sm">
        <div className="mx-auto max-w-md">
          <LockInButton
            isLocked={isPendingLockIn}
            isPending={isLockActionPending}
            partnerLocked={partnerLocked}
            partnerName={partnerName}
            onLockIn={handleLockIn}
            onUndoLockIn={handleUndoLockIn}
            isPartnerDisconnected={partnerDisconnected}
          />
        </div>
      </div>
    </main>
  );
}
