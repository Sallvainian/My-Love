/**
 * useAutoToast — Auto-dismissing toast primitive
 *
 * Accepts a trigger value (truthy = show, falsy = hide) and a duration in ms.
 * Returns the trigger value while visible, then null after auto-dismiss.
 *
 * Centralizes the setState-in-effect pattern behind a single lint suppression.
 */

import { useState, useEffect, useRef } from 'react';

export function useAutoToast<T>(trigger: T | null | false, durationMs: number): T | null {
  const [visible, setVisible] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (trigger) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: sync external trigger into auto-dismissing toast state
      setVisible(trigger);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(null), durationMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trigger, durationMs]);

  return visible;
}
