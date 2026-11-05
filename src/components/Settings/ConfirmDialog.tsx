/**
 * The Settings design's dialogs. `KitDialog` is the frame every one shares:
 * the kit scrim and panel, focus trapped and starting on the dialog's Cancel,
 * Escape or a tap on the scrim cancelling. `ConfirmDialog` is the
 * Confirmation dialog on it: one question, with Cancel and a destructive
 * button side by side, and nothing happens until that button is pressed. The
 * Kind chooser (`NewDatePages.tsx`) is the other dialog on the frame.
 *
 * `onCancel` need not be stable: the focus trap re-runs on a new Escape handler
 * and would put focus back on Cancel, so the frame hands it a stable one that
 * calls the latest `onCancel`. Render either inside `AnimatePresence` for the
 * exit. `testId` names the dialog; `ConfirmDialog`'s buttons are
 * `<testId>-cancel` and `<testId>-confirm`. Used by the event and anniversary
 * pages' delete (`useDateDelete`) and the top page's Log out of all devices.
 *
 * @component
 */

import { m as motion } from 'motion/react';
import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  DESTRUCTIVE_BUTTON,
  DIALOG_BACKDROP,
  DIALOG_PANEL,
  DIALOG_TITLE,
  SECONDARY_BUTTON,
} from '../shared/kitClasses';

interface KitDialogProps {
  onCancel: () => void;
  /** The dialog's Cancel, where focus starts. */
  initialFocusRef: RefObject<HTMLElement | null>;
  testId: string;
  /** The id of the element that names the dialog, or `label` when nothing on it does. */
  labelledBy?: string;
  label?: string;
  children: ReactNode;
}

export function KitDialog({
  onCancel,
  initialFocusRef,
  testId,
  labelledBy,
  label,
  children,
}: KitDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);
  const cancel = useCallback(() => onCancelRef.current(), []);

  useFocusTrap(panelRef, true, {
    onEscape: cancel,
    initialFocusRef,
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
      aria-labelledby={labelledBy}
      aria-label={label}
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
        {children}
      </motion.div>
    </motion.div>
  );
}

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
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  return (
    <KitDialog
      onCancel={onCancel}
      initialFocusRef={cancelButtonRef}
      testId={testId}
      labelledBy={titleId}
    >
      <h3 id={titleId} className={`${DIALOG_TITLE} mb-5`}>
        {question}
      </h3>
      <div className="flex gap-3">
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={onCancel}
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
    </KitDialog>
  );
}
