/**
 * UpdateToast
 *
 * The native shell's live update, shown: while a newer build downloads, a
 * toast with its progress; once it is queued, "Refresh app for update?" with a
 * Refresh button that restarts onto it at once. Either can be closed; closing
 * the prompt leaves the build queued, and the plugin still swaps it in on the
 * next background.
 *
 * It reads `nativeUpdates`' status, which stays idle on the web, so it renders
 * nothing there. It sits at the top, centred, just below iOS's status
 * (`env(safe-area-inset-top)`), over the header and above SyncToast, which
 * starts 5rem down; `--dock-left`/`--dock-right` (index.css) keep it clear of
 * the side column.
 */
import { AnimatePresence, m as motion } from 'motion/react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import {
  applyUpdate,
  getUpdateStatus,
  subscribeUpdateStatus,
  type UpdateStatus,
} from '../../services/nativeUpdates';

export function UpdateToast() {
  const status = useSyncExternalStore(subscribeUpdateStatus, getUpdateStatus);
  // The state whose toast was dismissed. It covers the header, so each state
  // can be closed; closing the progress still lets the Refresh prompt appear
  // when the download ends.
  const [dismissed, setDismissed] = useState<UpdateStatus['state'] | null>(null);

  const showDownloading = status.state === 'downloading' && dismissed !== 'downloading';
  const showReady = status.state === 'ready' && dismissed !== 'ready';

  return (
    <AnimatePresence>
      {(showDownloading || showReady) && (
        <motion.div
          key="update-toast"
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed right-[calc(var(--dock-right)+1rem)] top-[calc(env(safe-area-inset-top)+0.5rem)] left-[calc(var(--dock-left)+1rem)] z-100 mx-auto max-w-sm overflow-hidden rounded-[20px] border border-line bg-card shadow-float"
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
                <button
                  type="button"
                  onClick={() => setDismissed('downloading')}
                  className="-my-3 -mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Hide download progress"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
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
            <div className="flex items-center gap-3 py-1.5 pr-1.5 pl-4">
              <RefreshCw className="h-5 w-5 shrink-0 text-good" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-ink">Refresh app for update?</span>
              <button
                type="button"
                onClick={() => void applyUpdate()}
                className="flex min-h-11 shrink-0 items-center rounded-full bg-fill px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                data-testid="update-toast-refresh"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setDismissed('ready')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Dismiss update"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
