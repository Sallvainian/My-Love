/**
 * Scripture Reading Slice — Zustand state management for Scripture Reading feature
 * Story 1.1: AC #4, Story 1.3: Solo Reading Flow, Story 1.4: Save, Resume & Optimistic UI
 *
 * Types imported from dbSchema (single source of truth).
 * Follows StateCreator<AppState, AppMiddleware, [], ScriptureSlice> pattern.
 */

import type { AppStateCreator } from '../types';
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

// ============================================
// Helpers
// ============================================

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
  type: 'advanceStep' | 'saveSession';
  attempts: number;
  maxAttempts: number;
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
      const session = await scriptureReadingService.getSession(
        sessionId,
        (refreshed) => set({ session: refreshed })
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
      const incomplete = sessions.find(
        (s) => s.status === 'in_progress' && s.mode === 'solo'
      );
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
        set({ isSyncing: false, pendingRetry: null });
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
        set({ isSyncing: false, pendingRetry: null });
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
      await scriptureReadingService.updateSession(session.id, {
        currentStepIndex: session.currentStepIndex,
        currentPhase: session.currentPhase,
        status: session.status,
      });
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
        set({ scriptureError, isSyncing: false, pendingRetry: { ...pendingRetry, attempts: newAttempts } });
      } else {
        set({
          scriptureError,
          isSyncing: false,
          pendingRetry: { ...pendingRetry, attempts: newAttempts },
        });
      }
    }
  },
});
