/**
 * useReadingDialogs Hook
 *
 * Manages exit confirmation dialog state, focus trap, and
 * focus save/restore for the reading flow.
 */

import { useCallback, useRef, useState } from 'react';
import { useFocusTrap } from '../../../hooks';

interface UseReadingDialogsParams {
  saveAndExit: () => Promise<void>;
}

export function useReadingDialogs({ saveAndExit }: UseReadingDialogsParams) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const exitButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Story 1.5: Store focus before dialog opens (AC #1, #3)
  //
  // Nothing is stored here any more. useFocusTrap captures the active element
  // when the trap arms and returns focus there when it disarms, which is this
  // same button -- so the ref this used to fill was written and never read.
  const handleExitRequest = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  // Story 1.5: Restore focus when dialog closes (AC #1, #3)
  //
  // The restore itself now lives in useFocusTrap, which returns focus to whatever
  // held it when the trap armed -- the same exit button this used to track. The
  // requestAnimationFrame that stood here re-focused that button a frame later,
  // so the AC had two owners and the next person to change where focus goes
  // would have had to find both.
  const handleExitCancel = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  const handleSaveAndExit = useCallback(async () => {
    setShowExitConfirm(false);
    await saveAndExit();
  }, [saveAndExit]);

  // Story 1.5: Dialog focus trap + Escape handler (AC #1, #8)
  useFocusTrap(dialogRef, showExitConfirm, { onEscape: handleExitCancel });

  return {
    showExitConfirm,
    exitButtonRef,
    dialogRef,
    handleExitRequest,
    handleExitCancel,
    handleSaveAndExit,
  };
}
