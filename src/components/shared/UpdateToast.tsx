/**
 * UpdateToast
 *
 * The native shell's live update, shown at the bottom of the screen: while a
 * newer build downloads, a toast with its progress; once it is queued, "Update
 * ready — tap to restart", which takes the download toast's place. The download
 * toast cannot be closed. The ready toast stays until the person acts on it
 * (owner decision 2026-11-06: a toast that hid itself after 6 seconds was
 * easily missed, often while the app was still loading): a tap on its text
 * hides it and opens the update confirm dialog (`openUpdateConfirm`,
 * UpdateConfirmDialog), and its × hides it. Once hidden, by either or by the
 * dialog opening from the bell's entry, it stays hidden for the rest of this
 * launch: this component mounts once (main.tsx), and a restart or the
 * background swap reloads the web view. The header bell's dot and entry stay
 * the way back to it.
 *
 * It reads `nativeUpdates`' status, which stays idle on the web, so it renders
 * nothing there. Its bottom edge sits 12px above `--dock-top` (index.css), the
 * dock's top edge, or on Love Notes above the composer's top edge,
 * `--composer-clearance` (useComposerClearance), and `--dock-left`/`--dock-right`
 * keep it clear of the side column. z-100 keeps it above the dock and header.
 */
import { AnimatePresence, m as motion, useReducedMotion } from 'motion/react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getUpdateConfirmOpen,
  getUpdateStatus,
  openUpdateConfirm,
  subscribeUpdateConfirm,
  subscribeUpdateStatus,
} from '../../services/nativeUpdates';

export function UpdateToast() {
  const status = useSyncExternalStore(subscribeUpdateStatus, getUpdateStatus);
  const reduceMotion = useReducedMotion();
  // Set once the ready toast has hidden, by a tap, its × or the dialog opening
  // from the bell; it never shows again this launch.
  const [readyHidden, setReadyHidden] = useState(false);

  const showReady = status.state === 'ready' && !readyHidden;
  const showDownloading = status.state === 'downloading';

  // One overlay at a time: the dialog opened from the bell's entry hides the
  // toast too, and No does not bring it back.
  useEffect(
    () =>
      subscribeUpdateConfirm(() => {
        if (getUpdateConfirmOpen()) setReadyHidden(true);
      }),
    []
  );

  const handleReadyTap = () => {
    setReadyHidden(true);
    openUpdateConfirm();
  };

  return (
    <AnimatePresence>
      {(showDownloading || showReady) && (
        <motion.div
          key="update-toast"
          // The shipped spring, mirrored for the bottom edge; Reduce Motion fades only.
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.95 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
          transition={
            reduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 500, damping: 30 }
          }
          className="fixed right-[calc(var(--dock-right)+1rem)] bottom-[calc(var(--composer-clearance,var(--dock-top))+12px)] left-[calc(var(--dock-left)+1rem)] z-100 mx-auto max-w-sm overflow-hidden rounded-[20px] border border-line bg-card shadow-float"
          role="status"
          aria-live="polite"
          data-testid="update-toast"
          data-state={status.state}
        >
          {status.state === 'downloading' ? (
            <div className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="flex-1 text-sm font-medium text-ink">Downloading update…</span>
                {status.percent !== null && (
                  <span
                    className="text-xs font-semibold text-muted tabular-nums"
                    data-testid="update-toast-percent"
                  >
                    {Math.round(status.percent)}%
                  </span>
                )}
              </div>
              <div
                className="relative h-1.5 overflow-hidden rounded-full bg-tint"
                role="progressbar"
                aria-label="Update download"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={status.percent === null ? undefined : Math.round(status.percent)}
                data-testid="update-toast-progress"
              >
                {status.percent === null ? (
                  // No percent yet: a sliding bar says the download is alive.
                  <motion.div
                    className="absolute inset-y-0 w-1/3 rounded-full bg-fill"
                    initial={{ x: '-100%' }}
                    animate={{ x: '300%' }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                  />
                ) : (
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-fill"
                    initial={false}
                    animate={{ width: `${Math.min(100, Math.max(0, status.percent))}%` }}
                    transition={{ type: 'tween', duration: 0.3 }}
                  />
                )}
              </div>
            </div>
          ) : (
            // The line is the tap target, 44px high; the × beside it closes the toast.
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleReadyTap}
                className="flex min-h-11 flex-1 items-center gap-3 pl-4 text-left transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                data-testid="update-toast-ready"
              >
                <RefreshCw className="h-5 w-5 shrink-0 text-good" aria-hidden="true" />
                <span className="flex-1 text-sm font-medium text-ink">
                  Update ready — tap to restart
                </span>
              </button>
              <button
                type="button"
                onClick={() => setReadyHidden(true)}
                aria-label="Close"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                data-testid="update-toast-close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
