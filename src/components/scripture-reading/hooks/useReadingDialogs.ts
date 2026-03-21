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
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Story 1.5: Store focus before dialog opens (AC #1, #3)
  const handleExitRequest = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setShowExitConfirm(true);
  }, []);

  // Story 1.5: Restore focus when dialog closes (AC #1, #3)
  const handleExitCancel = useCallback(() => {
    setShowExitConfirm(false);
    requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
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
