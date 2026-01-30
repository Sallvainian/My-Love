/**
 * Scripture Reading Slice — Zustand state management for Scripture Reading feature
 * Story 1.1: AC #4
 *
 * Types co-located with slice per architecture rules.
 * Follows StateCreator<AppState, AppMiddleware, [], ScriptureSlice> pattern.
 */

import type { AppStateCreator } from '../types';
import { scriptureReadingService } from '../../services/scriptureReadingService';
import type { ScriptureError } from '../../services/scriptureReadingService';
import { ScriptureErrorCode, handleScriptureError } from '../../services/scriptureReadingService';

// ============================================
// Types (Subtask 3.2)
// ============================================

export type SessionPhase = 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
export type SessionMode = 'solo' | 'together';

export interface ScriptureSession {
  id: string;
  mode: SessionMode;
  currentPhase: SessionPhase;
  currentStepIndex: number;
  version: number;
  userId: string;
  partnerId?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'abandoned';
  startedAt: Date;
  completedAt?: Date;
}

// ============================================
// State interface (Subtask 3.3)
// ============================================

export interface ScriptureReadingState {
  session: ScriptureSession | null;
  isLoading: boolean;
  isInitialized: boolean;
  isPendingLockIn: boolean;
  isPendingReflection: boolean;
  isSyncing: boolean;
  error: ScriptureError | null;
}

// ============================================
// Slice interface (actions + state)
// ============================================

export interface ScriptureSlice extends ScriptureReadingState {
  // Actions (Subtask 3.4)
  createSession: (mode: SessionMode, partnerId?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  exitSession: () => void;
  updatePhase: (phase: SessionPhase) => void;
  clearScriptureError: () => void;
}

// ============================================
// Initial state
// ============================================

const initialScriptureState: ScriptureReadingState = {
  session: null,
  isLoading: false,
  isInitialized: false,
  isPendingLockIn: false,
  isPendingReflection: false,
  isSyncing: false,
  error: null,
};

// ============================================
// Slice creator (Subtask 3.4)
// ============================================

export const createScriptureReadingSlice: AppStateCreator<ScriptureSlice> = (set) => ({
  ...initialScriptureState,

  createSession: async (mode, partnerId) => {
    set({ isLoading: true, error: null });

    try {
      const serviceSession = await scriptureReadingService.createSession(mode, partnerId);

      const session: ScriptureSession = {
        id: serviceSession.id,
        mode: serviceSession.mode,
        currentPhase: serviceSession.currentPhase,
        currentStepIndex: serviceSession.currentStepIndex,
        version: serviceSession.version,
        userId: serviceSession.userId,
        partnerId: serviceSession.partnerId,
        status: serviceSession.status,
        startedAt: serviceSession.startedAt,
        completedAt: serviceSession.completedAt,
      };

      set({ session, isLoading: false, isInitialized: true });
    } catch (error) {
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.SYNC_FAILED,
        message: error instanceof Error ? error.message : 'Failed to create session',
        details: error,
      };
      handleScriptureError(scriptureError);
      set({ error: scriptureError, isLoading: false });
    }
  },

  loadSession: async (sessionId) => {
    set({ isLoading: true, error: null });

    try {
      const serviceSession = await scriptureReadingService.getSession(sessionId);

      if (!serviceSession) {
        const scriptureError: ScriptureError = {
          code: ScriptureErrorCode.SESSION_NOT_FOUND,
          message: `Session ${sessionId} not found`,
        };
        handleScriptureError(scriptureError);
        set({ error: scriptureError, isLoading: false });
        return;
      }

      const session: ScriptureSession = {
        id: serviceSession.id,
        mode: serviceSession.mode,
        currentPhase: serviceSession.currentPhase,
        currentStepIndex: serviceSession.currentStepIndex,
        version: serviceSession.version,
        userId: serviceSession.userId,
        partnerId: serviceSession.partnerId,
        status: serviceSession.status,
        startedAt: serviceSession.startedAt,
        completedAt: serviceSession.completedAt,
      };

      set({ session, isLoading: false, isInitialized: true });
    } catch (error) {
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.SYNC_FAILED,
        message: error instanceof Error ? error.message : 'Failed to load session',
        details: error,
      };
      handleScriptureError(scriptureError);
      set({ error: scriptureError, isLoading: false });
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
    set({ error: null });
  },
});
