/**
 * useScriptureBroadcast — Supabase Realtime broadcast channel lifecycle hook
 *
 * Story 4.1: AC #2, #3, #4, #5
 *
 * Manages subscription to the private broadcast channel `scripture-session:{sessionId}`.
 * This is the ONLY place in the codebase that imports supabase for Broadcast —
 * do NOT import supabase for broadcast in components or other hooks.
 *
 * Event flow:
 *   partner_joined     → onPartnerJoined() slice action
 *   ready_state_changed → onPartnerReady(is_ready) slice action
 *   state_updated      → onBroadcastReceived(payload) slice action
 *   session_converted  → applySessionConverted() slice action (local state only, no RPC)
 *
 * Cleanup: supabase.removeChannel(channel) on sessionId change or unmount.
 * Duplicate subscribe guard: checks channelRef.current?.state === 'subscribed'
 * to handle React StrictMode double-mount.
 */

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '../api/supabaseClient';
import { useAppStore } from '../stores/useAppStore';
import type { StateUpdatePayload } from '../stores/slices/scriptureReadingSlice';
import { handleScriptureError, ScriptureErrorCode } from '../services/scriptureReadingService';
import type { ScriptureError } from '../services/scriptureReadingService';

interface PartnerJoinedPayload {
  user_id: string;
}

interface ReadyStateChangedPayload {
  user_id: string;
  is_ready: boolean;
}

interface SessionConvertedPayload {
  mode: 'solo';
  sessionId: string;
}

/** Side-effect hook: subscribes to the scripture session broadcast channel. Returns nothing. */
export function useScriptureBroadcast(sessionId: string | null): void {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { onPartnerJoined, onPartnerReady, onBroadcastReceived, applySessionConverted } =
    useAppStore(
      useShallow((state) => ({
        onPartnerJoined: state.onPartnerJoined,
        onPartnerReady: state.onPartnerReady,
        onBroadcastReceived: state.onBroadcastReceived,
        applySessionConverted: state.applySessionConverted,
      }))
    );

  useEffect(() => {
    if (!sessionId) return;

    // Guard: prevent duplicate subscription on React StrictMode double-mount.
    // channelRef.current is null only after cleanup, non-null means a subscription exists.
    if (channelRef.current !== null) return;

    const channelName = `scripture-session:${sessionId}`;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        private: true,
      },
    });

    channel
      .on(
        'broadcast',
        { event: 'partner_joined' },
        (_payload: { payload: PartnerJoinedPayload }) => {
          onPartnerJoined();
        }
      )
      .on(
        'broadcast',
        { event: 'ready_state_changed' },
        (msg: { payload: ReadyStateChangedPayload }) => {
          onPartnerReady(msg.payload.is_ready);
        }
      )
      .on('broadcast', { event: 'state_updated' }, (msg: { payload: StateUpdatePayload }) => {
        onBroadcastReceived(msg.payload);
      })
      .on(
        'broadcast',
        { event: 'session_converted' },
        (_msg: { payload: SessionConvertedPayload }) => {
          // Apply local state transition only — do NOT call convertToSolo() RPC.
          // The broadcasting partner already nulled user2_id; re-invoking the RPC
          // would throw "Session not found or access denied" for the removed partner.
          applySessionConverted();
        }
      );

    channelRef.current = channel;

    // Set auth before subscribing (required for private channels).
    // Fetch the current user's ID here so the partner_joined payload satisfies the event contract.
    void supabase.realtime
      .setAuth()
      .then(async () => {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          throw authError;
        }
        const userId = authData.user?.id ?? '';

        channel.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            // Broadcast our own join to notify partner — include user_id per event contract
            void channel.send({
              type: 'broadcast',
              event: 'partner_joined',
              payload: { user_id: userId },
            });
          } else if (status === 'CHANNEL_ERROR') {
            const scriptureError: ScriptureError = {
              code: ScriptureErrorCode.SYNC_FAILED,
              message: `Broadcast channel subscription error`,
              details: err,
            };
            handleScriptureError(scriptureError);
          }
        });
      })
      .catch((err: unknown) => {
        const scriptureError: ScriptureError = {
          code: ScriptureErrorCode.SYNC_FAILED,
          message: err instanceof Error ? err.message : 'Failed to authenticate broadcast channel',
          details: err,
        };
        handleScriptureError(scriptureError);
      });

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, onPartnerJoined, onPartnerReady, onBroadcastReceived, applySessionConverted]);
}
