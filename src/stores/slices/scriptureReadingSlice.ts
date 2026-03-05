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
  ScriptureSessionStatus,
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
  user1Ready?: boolean;
  user2Ready?: boolean;
  countdownStartedAt?: number | null; // Server UTC ms or null
  currentStepIndex?: number; // Story 4.2: present when step advances via lock-in
  triggered_by?: 'lock_in' | 'phase_advance' | 'reconnect' | 'end_session';
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
  type: 'advanceStep' | 'saveSession';
  attempts: number;
  maxAttempts: number;
  sessionData?: {
    sessionId: string;
    currentStepIndex: number;
    currentPhase: SessionPhase;
    status: ScriptureSessionStatus;
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
  currentUserId: string | null; // Logged-in user's auth ID — used to distinguish user1 vs user2 in broadcasts
  // Story 4.2: Lock-in state
  partnerLocked: boolean;
  // Story 4.3: Disconnection state
  partnerDisconnected: boolean;
  partnerDisconnectedAt: number | null;
  // Internal: broadcast function set by useScriptureBroadcast hook.
  // Not for external use — prefixed with underscore to signal internal.
  _broadcastFn: ((event: string, payload: unknown) => void) | null;
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
  applySessionConverted: () => void;
  onPartnerJoined: () => void;
  onPartnerReady: (isReady: boolean) => void;
  onCountdownStarted: (startTs: number) => void;
  onBroadcastReceived: (payload: StateUpdatePayload) => void;
  // Story 4.2: Lock-in actions
  lockIn: () => Promise<void>;
  undoLockIn: () => Promise<void>;
  onPartnerLockInChanged: (locked: boolean) => void;
  // Story 4.3: Disconnection actions
  setPartnerDisconnected: (disconnected: boolean) => void;
  endSession: () => Promise<void>;
  // Internal: set by useScriptureBroadcast hook when channel subscribes/unsubscribes.
  // Do NOT call from components — this is wiring between the hook and the store.
  setBroadcastFn: (fn: ((event: string, payload: unknown) => void) | null) => void;
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
  currentUserId: null,
  // Story 4.2: Lock-in initial state
  partnerLocked: false,
  // Story 4.3: Disconnection initial state
  partnerDisconnected: false,
  partnerDisconnectedAt: null,
  // Internal: no broadcast function until useScriptureBroadcast wires it
  _broadcastFn: null,
};

// ============================================
// Helpers — session reset
// ============================================

/** Reset session-scoped state while preserving cross-session fields. */
function resetSessionState(
  get: () => ScriptureReadingState & ScriptureSlice
): Partial<ScriptureReadingState> {
  const { coupleStats, isStatsLoading, isInitialized } = get();
  return { ...initialScriptureState, coupleStats, isStatsLoading, isInitialized };
}

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
    if (get().scriptureLoading) return;
    set({ scriptureLoading: true, scriptureError: null });

    try {
      // Auth check FIRST — before any network call
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user?.id) {
        const scriptureError: ScriptureError = {
          code: ScriptureErrorCode.UNAUTHORIZED,
          message: 'Failed to verify user identity',
          details: authError,
        };
        handleScriptureError(scriptureError);
        set({ scriptureError, scriptureLoading: false });
        return;
      }
      const currentUserId = authData.user.id;

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

      // If resuming a together-mode session, convert to solo on both client and server.
      // This ensures ScriptureOverview routing (session.mode === 'solo')
      // sends the user to SoloReadingFlow instead of ReadingContainer/LobbyContainer.
      if (session.mode === 'together') {
        const soloSession = { ...session, mode: 'solo' as SessionMode };
        set({ session: soloSession, scriptureLoading: false, isInitialized: true, currentUserId });
        // Persist mode change to server (fire-and-forget, non-blocking)
        void scriptureReadingService.updateSession(sessionId, { mode: 'solo' }).catch((err) => {
          handleScriptureError({
            code: ScriptureErrorCode.SYNC_FAILED,
            message: 'Failed to convert session to solo mode',
            details: err,
          });
        });
        return;
      }

      set({ session, scriptureLoading: false, isInitialized: true, currentUserId });
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
    set(resetSessionState(get));
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
          pendingRetry: {
            type: 'advanceStep',
            attempts: 1,
            maxAttempts: 3,
            sessionData: {
              sessionId: session.id,
              currentStepIndex: MAX_STEPS - 1,
              currentPhase: 'reflection',
              status: session.status,
            },
          },
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
          pendingRetry: {
            type: 'advanceStep',
            attempts: 1,
            maxAttempts: 3,
            sessionData: {
              sessionId: session.id,
              currentStepIndex: nextStep,
              currentPhase: session.currentPhase,
              status: session.status,
            },
          },
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
      set(resetSessionState(get));
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
      set(resetSessionState(get));
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
      if (pendingRetry.sessionData) {
        await scriptureReadingService.updateSession(pendingRetry.sessionData.sessionId, {
          currentStepIndex: pendingRetry.sessionData.currentStepIndex,
          currentPhase: pendingRetry.sessionData.currentPhase,
          status: pendingRetry.sessionData.status,
        });
      } else {
        // Fallback: use current session (legacy pendingRetry without sessionData)
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
        // Max attempts reached — clear retry, keep error
        set({
          scriptureError,
          isSyncing: false,
          pendingRetry: null,
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
      // Auth check FIRST — before optimistic update so UI doesn't flash role then revert
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user?.id) {
        const scriptureError: ScriptureError = {
          code: ScriptureErrorCode.UNAUTHORIZED,
          message: 'Failed to verify user identity for role selection',
          details: authError,
        };
        handleScriptureError(scriptureError);
        set({ scriptureLoading: false, scriptureError });
        return;
      }
      const currentUserId = authData.user.id;

      // Optimistic update: set myRole now that auth is confirmed
      set({ myRole: role });

      const { data, error } = await callLobbyRpc('scripture_select_role', {
        p_session_id: session.id,
        p_role: role,
      });

      if (error) throw error;

      const snapshot = data as unknown as StateUpdatePayload;

      // Derive partnerJoined from snapshot: if partner's role is set, they're present.
      // This handles the case where User A selected a role before User B subscribed
      // to the broadcast channel, so User B missed the partner_joined broadcast.
      const isUser1 = currentUserId !== null && currentUserId === session.userId;
      const partnerRole = isUser1 ? snapshot.user2Role : snapshot.user1Role;

      set({
        currentUserId,
        scriptureLoading: false,
        session: {
          ...session,
          currentPhase: snapshot.currentPhase,
          version: snapshot.version,
        },
        ...(partnerRole != null ? { partnerJoined: true } : {}),
      });

      // Client-side broadcast: notify partner of state update
      get()._broadcastFn?.('state_updated', snapshot);
    } catch (error) {
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.SYNC_FAILED,
        message: error instanceof Error ? error.message : 'Failed to select role',
        details: error,
      };
      handleScriptureError(scriptureError);
      // Rollback optimistic update
      set({ myRole: null, scriptureError, scriptureLoading: false });
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
        // Update countdownStartedAt if server triggered countdown (use !== undefined so explicit null propagates)
        countdownStartedAt:
          snapshot.countdownStartedAt !== undefined
            ? snapshot.countdownStartedAt
            : currentState.countdownStartedAt,
      }));

      // Client-side broadcast: notify partner of state update
      get()._broadcastFn?.('state_updated', snapshot);
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

      // Client-side broadcast: notify partner that session was converted to solo.
      // Must broadcast BEFORE clearing local state, because _broadcastFn is still wired.
      get()._broadcastFn?.('session_converted', { mode: 'solo', sessionId: session.id });

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
    set({
      partnerJoined: true,
      partnerDisconnected: false,
      partnerDisconnectedAt: null,
    });
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
    const { session, currentUserId } = state;

    // Version check FIRST — drop stale broadcasts entirely
    if (session && payload.version <= session.version) return;

    // Story 4.3: End session or complete phase → exit
    if (payload.triggered_by === 'end_session' || payload.currentPhase === 'complete') {
      set(resetSessionState(get));
      return;
    }

    // session.userId is always user1_id (set by toLocalSession).
    // Compare current auth user to user1_id to correctly map partnerReady/myReady/myRole:
    //   user1 client → self is user1 → myReady = user1Ready, partnerReady = user2Ready
    //   user2 client → self is user2 → myReady = user2Ready, partnerReady = user1Ready
    const isUser1 = currentUserId !== null && session?.userId === currentUserId;

    // Story 4.2: Detect step advance from lock-in
    const stepAdvanced =
      payload.currentStepIndex != null &&
      session &&
      payload.currentStepIndex !== session.currentStepIndex;

    set((currentState) => ({
      session: currentState.session
        ? {
            ...currentState.session,
            currentPhase: payload.currentPhase,
            version: payload.version,
            // Story 4.2: Update step index if advanced
            ...(payload.currentStepIndex != null
              ? { currentStepIndex: payload.currentStepIndex }
              : {}),
          }
        : null,
      // Receiving a state_updated broadcast means the partner is present
      partnerJoined: true,
      partnerReady: isUser1
        ? (payload.user2Ready ?? currentState.partnerReady)
        : (payload.user1Ready ?? currentState.partnerReady),
      // Reconcile self-ready from authoritative snapshot — prevents drift after reconnect/reload.
      // Only update if currentUserId is known (skip if not yet authenticated in this session).
      myReady:
        currentUserId !== null
          ? isUser1
            ? (payload.user1Ready ?? currentState.myReady)
            : (payload.user2Ready ?? currentState.myReady)
          : currentState.myReady,
      // Reconcile self-role from snapshot; fall back to local value if snapshot has no role yet.
      myRole:
        currentUserId !== null
          ? ((isUser1 ? payload.user1Role : payload.user2Role) ?? currentState.myRole)
          : currentState.myRole,
      // Update countdownStartedAt if server set it (use !== undefined so explicit null propagates)
      countdownStartedAt:
        payload.countdownStartedAt !== undefined
          ? payload.countdownStartedAt
          : currentState.countdownStartedAt,
      // Story 4.2: Clear lock-in flags when step advances
      ...(stepAdvanced ? { isPendingLockIn: false, partnerLocked: false } : {}),
    }));
  },

  // Called when partner broadcasts 'session_converted' — the removed partner (user2) has been
  // detached from the session (user2_id is null). Reset to initial state so the UI navigates
  // back to overview rather than showing an active session the user no longer belongs to.
  applySessionConverted: () => {
    if (!get().session) return;
    set(resetSessionState(get));
  },

  // ============================================================
  // Story 4.2: Lock-in actions
  // ============================================================

  lockIn: async () => {
    const state = get();
    const { session } = state;
    if (!session || session.currentPhase !== 'reading' || state.isPendingLockIn) return;

    // Optimistic: set pending lock-in immediately
    set({ isPendingLockIn: true, scriptureError: null });

    try {
      const { data, error } = await callLobbyRpc('scripture_lock_in', {
        p_session_id: session.id,
        p_step_index: session.currentStepIndex,
        p_expected_version: session.version,
      });

      if (error) {
        if (typeof error.message === 'string' && error.message.startsWith('409:')) {
          throw {
            code: ScriptureErrorCode.VERSION_MISMATCH,
            message: error.message,
          } satisfies ScriptureError;
        }
        throw error;
      }

      // Client-side broadcast: the RPC returns both_locked flag and lock_status payload.
      // Broadcast the appropriate event based on whether both users are now locked.
      const lockResult = data as Record<string, unknown>;
      const broadcastFn = get()._broadcastFn;
      if (lockResult.both_locked) {
        // Both locked → step advanced. Update local state (channel is self:false,
        // so this client won't receive its own broadcast).
        const currentSession = get().session;
        if (currentSession) {
          set({
            session: {
              ...currentSession,
              currentPhase: lockResult.currentPhase as SessionPhase,
              currentStepIndex: lockResult.currentStepIndex as number,
              version: lockResult.version as number,
            },
            isPendingLockIn: false,
            partnerLocked: false,
          });
        }
        // Broadcast state_updated to partner.
        broadcastFn?.('state_updated', {
          sessionId: lockResult.sessionId,
          currentPhase: lockResult.currentPhase,
          currentStepIndex: lockResult.currentStepIndex,
          version: lockResult.version,
          triggered_by: 'lock_in',
        });
      } else {
        // Partial lock → broadcast lock_in_status_changed
        broadcastFn?.('lock_in_status_changed', lockResult.lock_status);
      }
    } catch (error) {
      if (isScriptureError(error) && error.code === ScriptureErrorCode.VERSION_MISMATCH) {
        // Version mismatch: rollback, refetch session, show subtle toast
        set({ isPendingLockIn: false });
        try {
          const refreshedSession = await scriptureReadingService.getSession(session.id, (s) =>
            set({ session: s })
          );
          if (refreshedSession) {
            set({ session: refreshedSession });
          }
        } catch (refetchErr) {
          handleScriptureError({
            code: ScriptureErrorCode.SYNC_FAILED,
            message: 'Failed to refresh session after version mismatch',
            details: refetchErr,
          });
        }
        set({
          scriptureError: {
            code: ScriptureErrorCode.VERSION_MISMATCH,
            message: 'Session updated',
          },
        });
      } else {
        // Other error: rollback + standard error handling
        set({ isPendingLockIn: false });
        const scriptureError: ScriptureError = isScriptureError(error)
          ? error
          : {
              code: ScriptureErrorCode.SYNC_FAILED,
              message: error instanceof Error ? error.message : String(error),
              details: error,
            };
        handleScriptureError(scriptureError);
        set({ scriptureError });
      }
    }
  },

  undoLockIn: async () => {
    const state = get();
    const { session } = state;
    if (!session) return;

    // Optimistic: clear pending lock-in immediately
    set({ isPendingLockIn: false });

    try {
      const { data, error } = await callLobbyRpc('scripture_undo_lock_in', {
        p_session_id: session.id,
        p_step_index: session.currentStepIndex,
      });

      if (error) throw error;

      // Client-side broadcast: notify partner that lock was undone
      const undoResult = data as Record<string, unknown>;
      if (undoResult.lock_status) {
        get()._broadcastFn?.('lock_in_status_changed', undoResult.lock_status);
      }
    } catch (error) {
      // Rollback: re-set pending lock-in
      set({ isPendingLockIn: true });
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.SYNC_FAILED,
        message: error instanceof Error ? error.message : 'Failed to undo lock-in',
        details: error,
      };
      handleScriptureError(scriptureError);
      set({ scriptureError });
    }
  },

  onPartnerLockInChanged: (locked) => {
    set({ partnerLocked: locked });
  },

  // ============================================================
  // Story 4.3: Disconnection actions
  // ============================================================

  setPartnerDisconnected: (disconnected) => {
    if (disconnected) {
      set({ partnerDisconnected: true, partnerDisconnectedAt: Date.now() });
    } else {
      set({ partnerDisconnected: false, partnerDisconnectedAt: null });
    }
  },

  endSession: async () => {
    const state = get();
    const { session } = state;
    if (!session || state.isSyncing) return;

    set({ isSyncing: true, scriptureError: null });

    try {
      const { data, error } = await callLobbyRpc('scripture_end_session', {
        p_session_id: session.id,
      });

      if (error) throw error;

      // Client-side broadcast: notify partner that session was ended.
      // Must broadcast BEFORE clearing local state, because _broadcastFn is still wired.
      const endSnapshot = data as unknown as StateUpdatePayload;
      get()._broadcastFn?.('state_updated', endSnapshot);

      // Success: reset all session state
      set(resetSessionState(get));
    } catch (error) {
      const scriptureError: ScriptureError = {
        code: ScriptureErrorCode.SYNC_FAILED,
        message: error instanceof Error ? error.message : 'Failed to end session',
        details: error,
      };
      handleScriptureError(scriptureError);
      set({ scriptureError, isSyncing: false });
    }
  },

  // Internal: wiring between useScriptureBroadcast hook and the store.
  // Called by the hook when channel subscribes (set fn) or cleanup (set null).
  setBroadcastFn: (fn) => {
    set({ _broadcastFn: fn });
  },
});
