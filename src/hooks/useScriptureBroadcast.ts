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
 *   session_converted  → convertToSolo() slice action
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

  const { onPartnerJoined, onPartnerReady, onBroadcastReceived, convertToSolo } = useAppStore(
    useShallow((state) => ({
      onPartnerJoined: state.onPartnerJoined,
      onPartnerReady: state.onPartnerReady,
      onBroadcastReceived: state.onBroadcastReceived,
      convertToSolo: state.convertToSolo,
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
          void convertToSolo();
        }
      );

    channelRef.current = channel;

    // Set auth before subscribing (required for private channels)
    void supabase.realtime.setAuth().then(() => {
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Broadcast our own join to notify partner
          void channel.send({
            type: 'broadcast',
            event: 'partner_joined',
            payload: {},
          });
        } else if (status === 'CHANNEL_ERROR') {
          // Log subscription errors — do not swallow silently
          if (import.meta.env.DEV) {
            console.error('[useScriptureBroadcast] Channel error:', err);
          }
        }
      });
    });

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, onPartnerJoined, onPartnerReady, onBroadcastReceived, convertToSolo]);
}
