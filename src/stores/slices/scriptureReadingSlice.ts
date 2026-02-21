/**
 * Scripture Reading Slice — Zustand state management for Scripture Reading feature
 * Story 1.1: AC #4, Story 1.3: Solo Reading Flow, Story 1.4: Save, Resume & Optimistic UI
 *
 * Types imported from dbSchema (single source of truth).
 * Follows StateCreator<AppState, AppMiddleware, [], ScriptureSlice> pattern.
 */

import type { AppStateCreator, CoupleStats } from '../types';
import { scriptureReadingService } from '../../services/scriptureReadingService';
import type { ScriptureError } from '../../services/scriptureReadingService';
import { ScriptureErrorCode, handleScriptureError } from '../../services/scriptureReadingService';
import { supabase } from '../../api/supabaseClient';
import type {
  ScriptureSession,
  ScriptureSessionPhase as SessionPhase,
  ScriptureSessionMode as SessionMode,
} from '../../services/dbSchema';
import { MAX_STEPS } from '../../data/scriptureSteps';

// Re-export for consumer convenience
export type { SessionPhase, SessionMode, ScriptureSession };

// Story 4.1: Role type for together-mode lobby
export type SessionRole = 'reader' | 'responder';

// Story 4.1: Payload shape broadcast by server RPCs via 'state_updated' event
export interface StateUpdatePayload {
  sessionId: string;
  currentPhase: SessionPhase;
  version: number;
  user1Role?: SessionRole | null;
  user2Role?: SessionRole | null;
  user1Ready: boolean;
  user2Ready: boolean;
  countdownStartedAt?: number | null; // Server UTC ms or null
}

// ============================================
// Helpers
// ============================================

/**
 * Type-safe wrapper for new lobby RPCs not yet registered in database.types.ts.
 * Remove once `supabase gen types typescript --local` is run after migration.
 */
async function callLobbyRpc(
  fn: string,
  args: Record<string, unknown>
): Promise<{ data: unknown; error: { message: string } | null }> {
  // Cast required because these RPCs postdate the last types regeneration.
  // This is safe — the RPC exists in the migration; types are stale, not wrong.
  type UntypedRpc = (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  return (supabase.rpc as unknown as UntypedRpc)(fn, args);
}

function isScriptureError(value: unknown): value is ScriptureError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as ScriptureError).code === 'string' &&
    Object.values(ScriptureErrorCode).includes((value as ScriptureError).code)
  );
}

// ============================================
// Retry types (Story 1.4)
// ============================================

export interface PendingRetry {
  type: 'advanceStep' | 'saveSession' | 'reflection';
  attempts: number;
  maxAttempts: number;
  reflectionData?: {
    sessionId: string;
    stepIndex: number;
    rating: number;
    notes: string;
    isShared: boolean;
  };
}

// ============================================
// State interface (Subtask 3.3)
// ============================================

export interface ScriptureReadingState {
  session: ScriptureSession | null;
  scriptureLoading: boolean;
  isInitialized: boolean;
  isPendingLockIn: boolean;
  isPendingReflection: boolean;
  isSyncing: boolean;
  scriptureError: ScriptureError | null;
  activeSession: ScriptureSession | null;
  isCheckingSession: boolean;
  // Story 1.4: Retry state
  pendingRetry: PendingRetry | null;
  // Story 3.1: Couple stats
  coupleStats: CoupleStats | null;
  isStatsLoading: boolean;
  // Story 4.1: Lobby state
  myRole: SessionRole | null;
  partnerJoined: boolean;
  myReady: boolean;
  partnerReady: boolean;
  countdownStartedAt: number | null; // Server UTC ms — stored as number (JSON-safe, not Date)
}

// ============================================
// Slice interface (actions + state)
// ============================================

export interface ScriptureSlice extends ScriptureReadingState {
  createSession: (mode: SessionMode, partnerId?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  exitSession: () => void;
  updatePhase: (phase: SessionPhase) => void;
  clearScriptureError: () => void;
  checkForActiveSession: () => Promise<void>;
  clearActiveSession: () => void;
  // Story 1.3: Solo Reading Flow actions
  advanceStep: () => Promise<void>;
  saveAndExit: () => Promise<void>;
  // Story 1.4: Save, Resume & Optimistic UI actions
  saveSession: () => Promise<void>;
  abandonSession: (sessionId: string) => Promise<void>;
  retryFailedWrite: () => Promise<void>;
  // Story 3.1: Stats actions
  loadCoupleStats: () => Promise<void>;
  // Story 4.1: Lobby actions
  selectRole: (role: SessionRole) => Promise<void>;
  toggleReady: (isReady: boolean) => Promise<void>;
  convertToSolo: () => Promise<void>;
  onPartnerJoined: () => void;
  onPartnerReady: (isReady: boolean) => void;
  onCountdownStarted: (startTs: number) => void;
  onBroadcastReceived: (payload: StateUpdatePayload) => void;
}

// ============================================
// Initial state
// ============================================

const initialScriptureState: ScriptureReadingState = {
  session: null,
  scriptureLoading: false,
  isInitialized: false,
  isPendingLockIn: false,
  isPendingReflection: false,
  isSyncing: false,
  scriptureError: null,
  activeSession: null,
  isCheckingSession: false,
  pendingRetry: null,
  coupleStats: null,
  isStatsLoading: false,
  // Story 4.1: Lobby initial state
  myRole: null,
  partnerJoined: false,
  myReady: false,
  partnerReady: false,
  countdownStartedAt: null,
};

// ============================================
// Slice creator (Subtask 3.4)
// ============================================

export const createScriptureReadingSlice: AppStateCreator<ScriptureSlice> = (set, get) => ({
  ...initialScriptureState,

  createSession: async (mode, partnerId) => {
    set({ scriptureLoading: true, scriptureError: null });

    try {
      const session = await scriptureReadingService.createSession(mode, partnerId);
      set({ session, scriptureLoading: false, isInitialized: true });
    } catch (error) {
      const scriptureError: ScriptureError = isScriptureError(error)
        ? error
        : {
            code: ScriptureErrorCode.SYNC_FAILED,
            message: error instanceof Error ? error.message : 'Failed to create session',
            details: error,
          };
      handleScriptureError(scriptureError);
      set({ scriptureError, scriptureLoading: false });
    }
  },

  loadSession: async (sessionId) => {
    set({ scriptureLoading: true, scriptureError: null });

    try {
      const session = await scriptureReadingService.getSession(sessionId, (refreshed) =>
        set({ session: refreshed })
      );

      if (!session) {
        const scriptureError: ScriptureError = {
          code: ScriptureErrorCode.SESSION_NOT_FOUND,
          message: `Session ${sessionId} not found`,
        };
        handleScriptureError(scriptureError);
        set({ scriptureError, scriptureLoading: false });
        return;
      }

      set({ session, scriptureLoading: false, isInitialized: true });
    } catch (error) {
      const scriptureError: ScriptureError = isScriptureError(error)
        ? error
        : {
            code: ScriptureErrorCode.SYNC_FAILED,
            message: error instanceof Error ? error.message : 'Failed to load session',
            details: error,
          };
      handleScriptureError(scriptureError);
      set({ scriptureError, scriptureLoading: false });
    }
  },

  exitSession: () => {
    set({ ...initialScriptureState });
  },

  updatePhase: (phase) => {
    set((state) => {
      if (!state.session) return {};
      return {
        session: {
          ...state.session,
          currentPhase: phase,
        },
      };
    });
  },

  clearScriptureError: () => {
    set({ scriptureError: null });
  },

  checkForActiveSession: async () => {
    set({ isCheckingSession: true });

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        set({ isCheckingSession: false });
        return;
      }

      const sessions = await scriptureReadingService.getUserSessions(userId);
      const incomplete = sessions
        .filter((s) => s.status === 'in_progress' && s.mode === 'solo')
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
      set({ activeSession: incomplete ?? null, isCheckingSession: false });
    } catch (error) {
      const scriptureError: ScriptureError = isScriptureError(error)
        ? error
        : {
            code: ScriptureErrorCode.SYNC_FAILED,
            message: error instanceof Error ? error.message : 'Failed to check for active session',
            details: error,
          };
      handleScriptureError(scriptureError);
      set({ activeSession: null, isCheckingSession: false });
    }
  },

  clearActiveSession: () => {
    set({ activeSession: null });
  },

  // Story 1.3: Advance to next step in the reading flow
  advanceStep: async () => {
    const state = get();
    const { session } = state;
    if (!session) return;

    const nextStep = session.currentStepIndex + 1;
    const isLastStep = nextStep >= MAX_STEPS;

    if (isLastStep) {
      // Transition to reflection phase — status stays 'in_progress' until Story 2.3 report phase
      const updatedSession: ScriptureSession = {
        ...session,
        currentPhase: 'reflection' as SessionPhase,
        currentStepIndex: MAX_STEPS - 1,
      };
      set({ session: updatedSession, isSyncing: true });

      // Persist phase change to server
      try {
        await scriptureReadingService.updateSession(session.id, {
          currentPhase: 'reflection' as SessionPhase,
          currentStepIndex: MAX_STEPS - 1,
        });
        set((state) => ({
          isSyncing: false,
          pendingRetry: state.pendingRetry?.type === 'reflection' ? state.pendingRetry : null,
        }));
      } catch (error) {
        const scriptureError: ScriptureError = isScriptureError(error)
          ? error
          : {
              code: ScriptureErrorCode.SYNC_FAILED,
              message: error instanceof Error ? error.message : 'Failed to complete session',
              details: error,
            };
        handleScriptureError(scriptureError);
        set({
          scriptureError,
          isSyncing: false,
          pendingRetry: { type: 'advanceStep', attempts: 1, maxAttempts: 3 },
        });
      }
    } else {
      // Normal step advancement
      const updatedSession: ScriptureSession = {
        ...session,
        currentStepIndex: nextStep,
      };
      set({ session: updatedSession, isSyncing: true });

      // Persist to server in background
      try {
        await scriptureReadingService.updateSession(session.id, {
          currentStepIndex: nextStep,
        });
        set((state) => ({
          isSyncing: false,
          pendingRetry: state.pendingRetry?.type === 'reflection' ? state.pendingRetry : null,
        }));
      } catch (error) {
        const scriptureError: ScriptureError = isScriptureError(error)
          ? error
          : {
              code: ScriptureErrorCode.SYNC_FAILED,
              message: error instanceof Error ? error.message : 'Failed to save step progress',
              details: error,
            };
        handleScriptureError(scriptureError);
        set({
          scriptureError,
          isSyncing: false,
          pendingRetry: { type: 'advanceStep', attempts: 1, maxAttempts: 3 },
        });
      }
    }
  },

  // Story 1.3: Save current progress and exit to overview
  saveAndExit: async () => {
    const state = get();
    const { session } = state;
    if (!session) return;

    set({ isSyncing: true, scriptureError: null });

    try {
      // Persist current step to server
      await scriptureReadingService.updateSession(session.id, {
        currentStepIndex: session.currentStepIndex,
        currentPhase: session.currentPhase,
        status: session.status,
      });

      // Clear session from active state (return to overview)
      set({ ...initialScriptureState });
    } catch (error) {
      const scriptureError: ScriptureError = isScriptureError(error)
        ? error
        : {
            code: ScriptureErrorCode.SYNC_FAILED,
            message: error instanceof Error ? error.message : 'Failed to save progress',
            details: error,
          };
      handleScriptureError(scriptureError);
      set({ scriptureError, isSyncing: false });
    }
  },

  // Story 1.4: Save session without clearing state (silent save)
  saveSession: async () => {
    const state = get();
    const { session } = state;
    if (!session) return;

    set({ isSyncing: true });

    try {
      await scriptureReadingService.updateSession(session.id, {
        currentStepIndex: session.currentStepIndex,
        currentPhase: session.currentPhase,
        status: session.status,
      });
      set({ isSyncing: false });
    } catch (error) {
      const scriptureError: ScriptureError = isScriptureError(error)
        ? error
        : {
            code: ScriptureErrorCode.SYNC_FAILED,
            message: error instanceof Error ? error.message : 'Failed to save session',
            details: error,
          };
      handleScriptureError(scriptureError);
      set({ scriptureError, isSyncing: false });
    }
  },

  // Story 1.4: Abandon session on server and clear local state
  abandonSession: async (sessionId) => {
    set({ scriptureLoading: true, scriptureError: null });

    try {
      await scriptureReadingService.updateSession(sessionId, {
        status: 'abandoned',
      });
      set({ ...initialScriptureState });
    } catch (error) {
      const scriptureError: ScriptureError = isScriptureError(error)
        ? error
        : {
            code: ScriptureErrorCode.SYNC_FAILED,
            message: error instanceof Error ? error.message : 'Failed to abandon session',
            details: error,
          };
      handleScriptureError(scriptureError);
      set({ scriptureError, scriptureLoading: false });
    }
  },

  // Story 1.4: Retry failed server write
  retryFailedWrite: async () => {
    const state = get();
    const { pendingRetry, session } = state;
    if (!pendingRetry || !session) return;

    set({ isSyncing: true, scriptureError: null });

    try {
      if (pendingRetry.type === 'reflection' && pendingRetry.reflectionData) {
        const { sessionId, stepIndex, rating, notes, isShared } = pendingRetry.reflectionData;
        await scriptureReadingService.addReflection(sessionId, stepIndex, rating, notes, isShared);
      } else {
        await scriptureReadingService.updateSession(session.id, {
          currentStepIndex: session.currentStepIndex,
          currentPhase: session.currentPhase,
          status: session.status,
        });
      }
      set({ isSyncing: false, pendingRetry: null, scriptureError: null });
    } catch (error) {
      const newAttempts = pendingRetry.attempts + 1;
      const scriptureError: ScriptureError = isScriptureError(error)
        ? error
        : {
            code: ScriptureErrorCode.SYNC_FAILED,
            message: error instanceof Error ? error.message : 'Retry failed',
            details: error,
          };
      handleScriptureError(scriptureError);

      if (newAttempts >= pendingRetry.maxAttempts) {
        // Max attempts reached — clear retry but keep error
        set({
          scriptureError,
          isSyncing: false,
          pendingRetry: { ...pendingRetry, attempts: newAttempts },
        });
      } else {
        set({
          scriptureError,
          isSyncing: false,
          pendingRetry: { ...pendingRetry, attempts: newAttempts },
        });
      }
    }
  },

  // Story 3.1: Load couple-aggregate stats from server
  loadCoupleStats: async () => {
    set({ isStatsLoading: true });

    try {
      const stats = await scriptureReadingService.getCoupleStats();
      if (stats) {
        set({ coupleStats: stats, isStatsLoading: false });
      } else {
        set({ isStatsLoading: false });
      }
    } catch (error) {
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.SYNC_FAILED,
        message: error instanceof Error ? error.message : 'Failed to load couple stats',
        details: error,
      };
      handleScriptureError(scriptureError);
      set({ isStatsLoading: false });
    }
  },

  // ============================================================
  // Story 4.1: Lobby actions
  // ============================================================

  // Calls scripture_select_role RPC, updates local myRole, sets phase to 'lobby'
  selectRole: async (role) => {
    const state = get();
    const { session } = state;
    if (!session) return;

    set({ scriptureLoading: true, scriptureError: null });

    try {
      const { data, error } = await callLobbyRpc('scripture_select_role', {
        p_session_id: session.id,
        p_role: role,
      });

      if (error) throw error;

      const snapshot = data as unknown as StateUpdatePayload;
      set({
        myRole: role,
        scriptureLoading: false,
        session: {
          ...session,
          currentPhase: snapshot.currentPhase,
          version: snapshot.version,
        },
      });
    } catch (error) {
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.SYNC_FAILED,
        message: error instanceof Error ? error.message : 'Failed to select role',
        details: error,
      };
      handleScriptureError(scriptureError);
      set({ scriptureError, scriptureLoading: false });
    }
  },

  // Optimistically sets myReady, calls scripture_toggle_ready RPC, rolls back on error
  toggleReady: async (isReady) => {
    const state = get();
    const { session } = state;
    if (!session) return;

    // Optimistic update
    set({ myReady: isReady });

    try {
      const { data, error } = await callLobbyRpc('scripture_toggle_ready', {
        p_session_id: session.id,
        p_is_ready: isReady,
      });

      if (error) throw error;

      const snapshot = data as unknown as StateUpdatePayload;
      // Update session phase/version from server response
      set((currentState) => ({
        session: currentState.session
          ? {
              ...currentState.session,
              currentPhase: snapshot.currentPhase,
              version: snapshot.version,
            }
          : null,
        // Update countdownStartedAt if server triggered countdown
        countdownStartedAt:
          snapshot.countdownStartedAt != null
            ? snapshot.countdownStartedAt
            : currentState.countdownStartedAt,
      }));
    } catch (error) {
      // Roll back optimistic update on failure
      set({ myReady: !isReady });
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.SYNC_FAILED,
        message: error instanceof Error ? error.message : 'Failed to toggle ready state',
        details: error,
      };
      handleScriptureError(scriptureError);
      set({ scriptureError });
    }
  },

  // Calls scripture_convert_to_solo RPC, resets lobby state, moves to solo reading
  convertToSolo: async () => {
    const state = get();
    const { session } = state;
    if (!session) return;

    set({ scriptureLoading: true, scriptureError: null });

    try {
      const { error } = await callLobbyRpc('scripture_convert_to_solo', {
        p_session_id: session.id,
      });

      if (error) throw error;

      set({
        scriptureLoading: false,
        myRole: null,
        partnerJoined: false,
        myReady: false,
        partnerReady: false,
        countdownStartedAt: null,
        session: {
          ...session,
          mode: 'solo' as SessionMode,
          currentPhase: 'reading' as SessionPhase,
          status: 'in_progress',
        },
      });
    } catch (error) {
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.SYNC_FAILED,
        message: error instanceof Error ? error.message : 'Failed to convert to solo',
        details: error,
      };
      handleScriptureError(scriptureError);
      set({ scriptureError, scriptureLoading: false });
    }
  },

  // Called when partner joins the broadcast channel
  onPartnerJoined: () => {
    set({ partnerJoined: true });
  },

  // Called when partner's ready state changes via broadcast
  onPartnerReady: (isReady) => {
    set({ partnerReady: isReady });
  },

  // Called when server starts the countdown (both users ready)
  onCountdownStarted: (startTs) => {
    const state = get();
    const { session } = state;
    set({
      countdownStartedAt: startTs,
      session: session ? { ...session, currentPhase: 'countdown' as SessionPhase } : null,
    });
  },

  // Called when 'state_updated' broadcast received — version-checked snapshot update
  onBroadcastReceived: (payload) => {
    const state = get();
    const { session } = state;

    // Version check: only apply if received version is newer
    if (session && payload.version <= session.version) return;

    set((currentState) => ({
      session: currentState.session
        ? {
            ...currentState.session,
            currentPhase: payload.currentPhase,
            version: payload.version,
          }
        : null,
      // Update partner ready from snapshot (user2Ready tracks partner in most cases)
      partnerReady: payload.user2Ready,
      // Update countdownStartedAt if server set it
      countdownStartedAt:
        payload.countdownStartedAt != null
          ? payload.countdownStartedAt
          : currentState.countdownStartedAt,
    }));
  },
});
