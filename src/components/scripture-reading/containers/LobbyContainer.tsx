/**
 * LobbyContainer Component
 *
 * Story 4.1: AC #1-#5 — Lobby, Role Selection & Countdown orchestration
 *
 * Phases:
 *   Phase A — Role Selection: session.currentPhase === 'lobby' && !myRole
 *   Phase B — Lobby Waiting: myRole set && phase === 'lobby'
 *   Phase C — Countdown: countdownStartedAt !== null
 *
 * Connects to scriptureReadingSlice for lobby state.
 * Calls useScriptureBroadcast for channel lifecycle.
 * Does NOT import supabase directly (broadcast handled by hook).
 */

import { useCallback } from 'react';
import type { ReactElement } from 'react';
import { BookOpen, MessageCircle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/useAppStore';
import type { SessionRole } from '../../../stores/slices/scriptureReadingSlice';
import { useScriptureBroadcast } from '../../../hooks/useScriptureBroadcast';
import { Countdown } from '../session/Countdown';

// Lavender Dreams design tokens (from ScriptureOverview)
const scriptureTheme = {
  primary: '#A855F7',
  background: '#F3E5F5',
  surface: '#FAF5FF',
};

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';

export function LobbyContainer(): ReactElement {
  const {
    session,
    myRole,
    partnerJoined,
    myReady,
    partnerReady,
    countdownStartedAt,
    scriptureLoading,
    selectRole,
    toggleReady,
    convertToSolo,
    updatePhase,
    partner,
  } = useAppStore(
    useShallow((state) => ({
      session: state.session,
      myRole: state.myRole,
      partnerJoined: state.partnerJoined,
      myReady: state.myReady,
      partnerReady: state.partnerReady,
      countdownStartedAt: state.countdownStartedAt,
      scriptureLoading: state.scriptureLoading,
      selectRole: state.selectRole,
      toggleReady: state.toggleReady,
      convertToSolo: state.convertToSolo,
      updatePhase: state.updatePhase,
      partner: state.partner,
    }))
  );

  // Broadcast channel lifecycle — manages subscribe/unsubscribe
  useScriptureBroadcast(session?.id ?? null);

  const partnerName = partner?.displayName ?? 'your partner';

  const handleSelectRole = useCallback(
    async (role: SessionRole) => {
      await selectRole(role);
    },
    [selectRole]
  );

  const handleToggleReady = useCallback(async () => {
    await toggleReady(!myReady);
  }, [toggleReady, myReady]);

  const handleContinueSolo = useCallback(async () => {
    await convertToSolo();
  }, [convertToSolo]);

  const handleCountdownComplete = useCallback(() => {
    if (session) {
      updatePhase('reading');
    }
  }, [session, updatePhase]);

  // Phase C: Countdown
  if (countdownStartedAt !== null) {
    return (
      <main
        className="flex min-h-screen items-center justify-center p-4"
        style={{ backgroundColor: scriptureTheme.background }}
        data-testid="lobby-countdown-phase"
      >
        <Countdown startedAt={countdownStartedAt} onComplete={handleCountdownComplete} />
      </main>
    );
  }

  // Phase A: Role Selection (myRole not set yet)
  if (!myRole) {
    return (
      <main
        className="min-h-screen p-4"
        style={{ backgroundColor: scriptureTheme.background }}
        data-testid="lobby-role-selection"
      >
        <div className="mx-auto max-w-md space-y-6 pt-8">
          <header className="text-center">
            <h1 className="font-serif text-2xl font-bold text-purple-900">
              How would you like to participate?
            </h1>
            <p className="mt-2 text-sm text-purple-600">Choose your role for this session</p>
          </header>

          <div className="grid grid-cols-2 gap-4">
            {/* Reader card */}
            <button
              type="button"
              data-testid="lobby-role-reader"
              disabled={scriptureLoading}
              onClick={() => void handleSelectRole('reader')}
              className={`flex min-h-[140px] flex-col items-center gap-3 rounded-2xl border border-purple-200/50 bg-white/80 p-6 text-left backdrop-blur-sm transition-all duration-200 hover:border-purple-400 active:bg-purple-50/80 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} `}
            >
              <BookOpen className="h-8 w-8 text-purple-500" />
              <div className="text-center">
                <p className="font-semibold text-purple-900">Reader</p>
                <p className="mt-1 text-xs text-gray-600">You read the verse</p>
              </div>
            </button>

            {/* Responder card */}
            <button
              type="button"
              data-testid="lobby-role-responder"
              disabled={scriptureLoading}
              onClick={() => void handleSelectRole('responder')}
              className={`flex min-h-[140px] flex-col items-center gap-3 rounded-2xl border border-purple-200/50 bg-white/80 p-6 text-left backdrop-blur-sm transition-all duration-200 hover:border-purple-400 active:bg-purple-50/80 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} `}
            >
              <MessageCircle className="h-8 w-8 text-purple-500" />
              <div className="text-center">
                <p className="font-semibold text-purple-900">Responder</p>
                <p className="mt-1 text-xs text-gray-600">You read the response</p>
              </div>
            </button>
          </div>

          {/* Continue solo option */}
          <div className="pt-4 text-center">
            <button
              type="button"
              data-testid="lobby-continue-solo"
              onClick={() => void handleContinueSolo()}
              className={`text-sm text-purple-400 transition-colors hover:text-purple-600 ${FOCUS_RING} rounded-lg px-3 py-2`}
            >
              Continue solo
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Phase B: Lobby Waiting (role selected, waiting for partner / ready up)
  return (
    <main
      className="min-h-screen p-4"
      style={{ backgroundColor: scriptureTheme.background }}
      data-testid="lobby-waiting"
    >
      <div className="mx-auto max-w-md space-y-6 pt-8">
        <header className="text-center">
          <h1 className="font-serif text-2xl font-bold text-purple-900">Reading Together</h1>
        </header>

        {/* Partner status — aria-live region for announcements */}
        <div aria-live="polite" aria-atomic="false" className="text-center">
          {/* Partner join status */}
          <div
            data-testid="lobby-partner-status"
            className="flex items-center justify-center gap-2 text-purple-700"
          >
            {partnerJoined ? (
              <>
                <span className="text-lg text-green-500">✓</span>
                <span className="font-medium">{partnerName} has joined!</span>
              </>
            ) : (
              <>
                <span
                  className="inline-block h-2 w-2 animate-pulse rounded-full bg-purple-400"
                  aria-hidden="true"
                />
                <span className="text-purple-600">Waiting for {partnerName}...</span>
              </>
            )}
          </div>

          {/* Partner ready indicator */}
          {partnerJoined && (
            <div
              data-testid="lobby-partner-ready"
              className={`mt-3 text-sm font-medium ${partnerReady ? 'text-green-600' : 'text-purple-400'}`}
            >
              {partnerReady ? (
                <span>✓ {partnerName} is ready</span>
              ) : (
                <span>{partnerName} is not ready yet</span>
              )}
            </div>
          )}
        </div>

        {/* Ready toggle */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            data-testid="lobby-ready-button"
            disabled={scriptureLoading}
            onClick={() => void handleToggleReady()}
            className={`min-h-[56px] w-full rounded-2xl py-4 text-lg font-semibold transition-all duration-200 ${
              myReady
                ? 'border-2 border-purple-400 bg-purple-100 text-purple-700'
                : 'bg-purple-500 text-white shadow-lg shadow-purple-500/25 hover:bg-purple-600 active:bg-purple-700'
            } disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} `}
          >
            {myReady ? 'Ready ✓' : "I'm Ready"}
          </button>

          {myReady && !partnerReady && (
            <p className="text-center text-sm text-purple-500">
              {"We'll continue when you're both ready"}
            </p>
          )}
        </div>

        {/* Continue solo link */}
        <div className="pt-2 text-center">
          <button
            type="button"
            data-testid="lobby-continue-solo"
            onClick={() => void handleContinueSolo()}
            className={`text-sm text-purple-400 transition-colors hover:text-purple-600 ${FOCUS_RING} rounded-lg px-3 py-2`}
          >
            Continue solo
          </button>
        </div>
      </div>
    </main>
  );
}
