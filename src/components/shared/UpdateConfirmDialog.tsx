/**
 * UpdateConfirmDialog
 *
 * The native shell's "Update now?" confirm, opened by the ready toast
 * (UpdateToast) or the bell's "Update now" entry (NotificationsBell) through
 * `nativeUpdates`' confirm store, and mounted once beside UpdateToast in
 * main.tsx. No, Escape or a tap on the scrim closes it and leaves the update
 * queued for the background swap. Yes disables both buttons and restarts on
 * the new build (`applyUpdate`); while it does, the scrim and Escape are
 * ignored. A failed restart closes the dialog, and the bell's dot and entry
 * stay. The store never opens on the web, so it renders nothing there.
 */
import { AnimatePresence } from 'motion/react';
import { useId, useRef, useState, useSyncExternalStore } from 'react';
import {
  applyUpdate,
  closeUpdateConfirm,
  getUpdateConfirmOpen,
  subscribeUpdateConfirm,
} from '../../services/nativeUpdates';
import { KitDialog } from '../Settings/ConfirmDialog';
import { DESTRUCTIVE_BUTTON, DIALOG_TITLE, SECONDARY_BUTTON } from './kitClasses';

export function UpdateConfirmDialog() {
  const open = useSyncExternalStore(subscribeUpdateConfirm, getUpdateConfirmOpen);

  return (
    <AnimatePresence>{open && <UpdateConfirmPanel key="update-confirm" />}</AnimatePresence>
  );
}

function UpdateConfirmPanel() {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const noButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Escape and the scrim reach this through KitDialog; ignored mid-restart.
  const cancel = () => {
    if (busyRef.current) return;
    closeUpdateConfirm();
  };

  const handleYes = async () => {
    busyRef.current = true;
    setBusy(true);
    // The focused Yes is about to be disabled, which drops focus to <body>,
    // outside the trap; park it on the dialog's content first.
    contentRef.current?.focus();
    const applied = await applyUpdate();
    // A successful restart never gets here in the shell; a failed one leaves
    // the update waiting for the background swap.
    if (!applied) {
      busyRef.current = false;
      closeUpdateConfirm();
    }
  };

  return (
    // The front of the stack: a stacking context above every other overlay
    // (the image viewer, note and photo deletes at z-50 to z-70), the toast
    // (z-100) and the bell's drop-down (z-110), which DIALOG_BACKDROP's z-50
    // alone would sit under.
    <div className="relative z-120" data-testid="update-confirm-layer">
      <KitDialog
        onCancel={cancel}
        initialFocusRef={noButtonRef}
        testId="update-confirm"
        labelledBy={titleId}
      >
        <div ref={contentRef} tabIndex={-1} className="outline-hidden">
          <h3 id={titleId} className={DIALOG_TITLE}>
            Update now?
          </h3>
          <p className="mt-2 text-[15px] leading-[1.45] text-muted">
            You may lose what you&apos;re doing.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              ref={noButtonRef}
              type="button"
              onClick={cancel}
              disabled={busy}
              data-testid="update-confirm-no"
              className={SECONDARY_BUTTON}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => void handleYes()}
              disabled={busy}
              data-testid="update-confirm-yes"
              className={DESTRUCTIVE_BUTTON}
            >
              Yes
            </button>
          </div>
        </div>
      </KitDialog>
    </div>
  );
}
