/**
 * useScripturePresence — Ephemeral presence channel for partner position tracking
 *
 * Story 4.2: AC #2 — Partner position indicator
 *
 * Manages a separate broadcast channel `scripture-presence:{sessionId}` for ephemeral
 * partner view position updates. NOT stored in Zustand or IndexedDB — purely local state.
 *
 * Presence is broadcast:
 *   - Immediately on channel SUBSCRIBED
 *   - On view prop change (verse ↔ response)
 *   - On stepIndex change
 *   - Every ~10s heartbeat
 *
 * Stale presence (ts > 20s) is silently dropped.
 * Cleanup: channel removed + interval cleared on unmount.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../api/supabaseClient';
import { handleScriptureError, ScriptureErrorCode } from '../services/scriptureReadingService';
import type { ScriptureError } from '../services/scriptureReadingService';

export interface PartnerPresenceInfo {
  view: 'verse' | 'response' | null;
  stepIndex: number | null;
  ts: number | null;
  isPartnerConnected: boolean;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const STALE_TTL_MS = 20_000;

interface PresencePayload {
  user_id: string;
  step_index: number;
  view: 'verse' | 'response';
  ts: number;
}

export function useScripturePresence(
  sessionId: string | null,
  stepIndex: number,
  view: 'verse' | 'response'
): PartnerPresenceInfo {
  // Trigger re-subscribe after realtime channel errors/closures.
  const [retryCount, setRetryCount] = useState(0);
  const [partnerPresence, setPartnerPresence] = useState<PartnerPresenceInfo>({
    view: null,
    stepIndex: null,
    ts: null,
    isPartnerConnected: true,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string>('');
  const latestPresenceRef = useRef<{ stepIndex: number; view: 'verse' | 'response' }>({
    stepIndex,
    view,
  });

  useEffect(() => {
    latestPresenceRef.current = { stepIndex, view };
  }, [stepIndex, view]);

  // Stable sender: always reads latest step/view from refs to avoid stale closure heartbeats.
  const sendPresence = useCallback(() => {
    const channel = channelRef.current;
    const userId = userIdRef.current;
    if (!channel || !userId) return;

    const latest = latestPresenceRef.current;
    void channel.send({
      type: 'broadcast',
      event: 'presence_update',
      payload: {
        user_id: userId,
        step_index: latest.stepIndex,
        view: latest.view,
        ts: Date.now(),
      } satisfies PresencePayload,
    });
  }, []);

  // Main effect: subscribe to presence channel
  useEffect(() => {
    if (!sessionId) return;

    // Guard: prevent duplicate subscription
    if (channelRef.current !== null) return;

    const channelName = `scripture-presence:${sessionId}`;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        private: true,
      },
    });

    channel.on(
      'broadcast',
      { event: 'presence_update' },
      (msg: { payload: PresencePayload }) => {
        const payload = msg.payload;

        // Drop stale presence
        if (Date.now() - payload.ts > STALE_TTL_MS) return;

        // Reset stale detection timer on each valid presence_update
        if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
        staleTimerRef.current = setTimeout(() => {
          setPartnerPresence((prev) => ({
            ...prev,
            isPartnerConnected: false,
            view: null,
          }));
        }, STALE_TTL_MS);

        setPartnerPresence({
          view: payload.view,
          stepIndex: payload.step_index,
          ts: payload.ts,
          isPartnerConnected: true,
        });
      }
    );

    channelRef.current = channel;

    void supabase.realtime
      .setAuth()
      .then(async () => {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        userIdRef.current = authData.user?.id ?? '';

        channel.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            // Send own presence immediately
            sendPresence();

            // Start heartbeat
            intervalRef.current = setInterval(() => {
              sendPresence();
            }, HEARTBEAT_INTERVAL_MS);

            // Start stale detection timer — fires if no presence_update received within TTL
            if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
            staleTimerRef.current = setTimeout(() => {
              setPartnerPresence((prev) => ({
                ...prev,
                isPartnerConnected: false,
                view: null,
              }));
            }, STALE_TTL_MS);
          } else if (status === 'CHANNEL_ERROR') {
            const scriptureError: ScriptureError = {
              code: ScriptureErrorCode.SYNC_FAILED,
              message: 'Presence channel subscription error',
              details: err,
            };
            handleScriptureError(scriptureError);
            if (channelRef.current === channel && sessionId) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              setPartnerPresence((prev) => ({
                ...prev,
                isPartnerConnected: false,
                view: null,
              }));
              void supabase.removeChannel(channel);
              channelRef.current = null;
              setRetryCount((c) => c + 1);
            }
          }
        });
      })
      .catch((err: unknown) => {
        const scriptureError: ScriptureError = {
          code: ScriptureErrorCode.SYNC_FAILED,
          message:
            err instanceof Error ? err.message : 'Failed to authenticate presence channel',
          details: err,
        };
        handleScriptureError(scriptureError);
      });

    return () => {
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, retryCount, sendPresence]);

  // Re-send presence when view changes
  useEffect(() => {
    sendPresence();
  }, [view, sendPresence]);

  // Reset partner presence on step change (stale from old step).
  // Deliberate sync-external-state pattern: setPartnerPresence in effect body
  // resets transient view/step data while preserving connection status.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate sync reset of external presence state on step change
    setPartnerPresence((prev) => ({ view: null, stepIndex: null, ts: null, isPartnerConnected: prev.isPartnerConnected }));
    sendPresence();
  }, [stepIndex, sendPresence]);

  return partnerPresence;
}
