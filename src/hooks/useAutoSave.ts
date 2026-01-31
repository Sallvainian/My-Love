/**
 * useAutoSave Hook
 *
 * Auto-saves scripture reading session on visibility change and before unload.
 * Fire-and-forget pattern — does not block UI or guarantee completion.
 *
 * Story 1.4: Task 1 — Auto-Save on App Close / Visibility Change (AC #1)
 */

import { useEffect, useCallback } from 'react';
import type { ScriptureSession } from '../services/dbSchema';

export interface UseAutoSaveOptions {
  session: ScriptureSession | null;
  saveSession: () => Promise<void>;
}

/**
 * React hook that auto-saves session progress on:
 * - `visibilitychange` → `hidden` (tab switch, home button, lock screen)
 * - `beforeunload` (tab close, refresh — best-effort backup)
 *
 * Only saves when session exists with status === 'in_progress'.
 */
export function useAutoSave({ session, saveSession }: UseAutoSaveOptions): void {
  const handleVisibilityChange = useCallback(() => {
    if (
      document.visibilityState === 'hidden' &&
      session?.status === 'in_progress'
    ) {
      void saveSession();
    }
  }, [session, saveSession]);

  const handleBeforeUnload = useCallback(() => {
    if (session?.status === 'in_progress') {
      void saveSession();
    }
  }, [session, saveSession]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleVisibilityChange, handleBeforeUnload]);
}

export default useAutoSave;
