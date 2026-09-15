import { useCallback, useLayoutEffect, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';

/** Invalidate asynchronous dialog completions immediately on identity change. */
export function useDialogSession() {
  const revision = useRef(0);
  useLayoutEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (
        state.userId !== previous.userId ||
        state.authSessionVersion !== previous.authSessionVersion
      ) {
        revision.current += 1;
      }
    });
    return () => {
      revision.current += 1;
      unsubscribe();
    };
  }, []);

  return useCallback(() => {
    const requestedIn = revision.current;
    return () => revision.current === requestedIn;
  }, []);
}
