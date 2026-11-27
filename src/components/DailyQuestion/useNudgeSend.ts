/**
 * The two nudge controls' shared behavior (stories 11.1, criteria 14, 16, 17):
 * the prompt's Nudge (`NudgeSheet`) and the waiting card's button both send
 * through `useNudgeSend`, so a lost answer, an "already sent" refusal and the
 * offline sentence read the same on each, and both close at the question's
 * closing instant through `useNudgeClosed`.
 *
 * @module components/DailyQuestion/useNudgeSend
 */

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { hasNudgeClosed, type NudgeSource } from '../../services/dailyNudges';
import { useAppStore } from '../../stores/useAppStore';
import { nudgeFailureMessage, nudgeOutcomeMessage } from './nudgeFailureMessage';

export interface NudgeSend {
  /** Sends the nudge from the hook's source; resolves true when it ended as a sent nudge. */
  send: () => Promise<boolean>;
  /** A send, including the re-read after a lost answer, is in progress. */
  busy: boolean;
  /** Whether a send is in progress, read at once (before a re-render shows `busy`). */
  isBusy: () => boolean;
  /** The failure line of the last send, cleared by the next one. */
  error: string | null;
}

export function useNudgeSend(source: NudgeSource): NudgeSend {
  const sendDailyNudge = useAppStore((state) => state.sendDailyNudge);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const send = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setError(null);
    setBusy(true);
    try {
      const outcome = await sendDailyNudge(source);
      if (outcome === 'sent') return true;
      setError(nudgeOutcomeMessage(outcome));
      return false;
    } catch (caught) {
      setError(nudgeFailureMessage(caught));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [sendDailyNudge, source]);

  const isBusy = useCallback(() => busyRef.current, []);

  return { send, busy, isBusy, error };
}

/** The longest delay a timer takes; a closing instant is never this far away. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Whether the question has stopped taking nudges: true from `closesAt` on, with
 * no re-read of the day. It reads the clock itself (`useSyncExternalStore`), so
 * a `closesAt` that has already passed when it reaches a mounted hook, a re-read
 * answering after the instant for one, is closed in that render, before paint,
 * with no timer; for a future instant one timer wakes the hook at the instant.
 * A null or unreadable `closesAt` never closes.
 */
export function useNudgeClosed(closesAt: string | null): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (closesAt === null) return () => {};
      const at = Date.parse(closesAt);
      if (!Number.isFinite(at)) return () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;
      const wake = () => {
        const left = at - Date.now();
        // A timer that fires a hair early waits out the rest.
        if (left > 0) timer = setTimeout(wake, Math.min(left, MAX_TIMER_MS));
        else notify();
      };
      if (at - Date.now() > 0) wake();
      return () => clearTimeout(timer);
    },
    [closesAt]
  );
  const getSnapshot = useCallback(() => hasNudgeClosed(closesAt, Date.now()), [closesAt]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
