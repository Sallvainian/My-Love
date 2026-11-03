/**
 * ConfirmDialog -- the Confirmation dialog of the Settings design: the kit
 * dialog asking one question, with Cancel and a destructive button side by
 * side. Focus is trapped and starts on Cancel; Escape or a tap on the scrim
 * cancels. Nothing happens until the destructive button is pressed.
 *
 * `onCancel` need not be stable: the focus trap re-runs on a new Escape handler
 * and would put focus back on Cancel, so the dialog hands it a stable one that
 * calls the latest `onCancel`. Render it inside `AnimatePresence` for the exit.
 * `testId` names the dialog; its buttons are `<testId>-cancel` and
 * `<testId>-confirm`. Used by the event page's `Delete event`; story 12 reuses
 * it for `Delete anniversary`.
 *
 * @component
 */

import { m as motion } from 'motion/react';
import { useCallback, useEffect, useId, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  DESTRUCTIVE_BUTTON,
  DIALOG_BACKDROP,
  DIALOG_PANEL,
  DIALOG_TITLE,
  SECONDARY_BUTTON,
} from '../shared/kitClasses';

interface ConfirmDialogProps {
  /** The question, verbatim (`Delete this event?`). */
  question: string;
  /** The destructive button's label (`Delete`). */
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  testId: string;
}

export function ConfirmDialog({
  question,
  confirmLabel,
  onCancel,
  onConfirm,
  testId,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);
  const cancel = useCallback(() => onCancelRef.current(), []);

  useFocusTrap(panelRef, true, {
    onEscape: cancel,
    initialFocusRef: cancelButtonRef,
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) cancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={DIALOG_BACKDROP}
      onClick={handleBackdropClick}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`${DIALOG_PANEL} max-w-sm`}
      >
        <h3 id={titleId} className={`${DIALOG_TITLE} mb-5`}>
          {question}
        </h3>
        <div className="flex gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={cancel}
            data-testid={`${testId}-cancel`}
            className={SECONDARY_BUTTON}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid={`${testId}-confirm`}
            className={DESTRUCTIVE_BUTTON}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
