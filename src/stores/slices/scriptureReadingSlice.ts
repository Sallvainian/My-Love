/**
 * Scripture Reading Slice — Zustand state management for Scripture Reading feature
 * Story 1.1: AC #4
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
};

// ============================================
// Slice creator (Subtask 3.4)
// ============================================

export const createScriptureReadingSlice: AppStateCreator<ScriptureSlice> = (set) => ({
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
});
