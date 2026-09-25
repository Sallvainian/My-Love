/**
 * SyncToast Component
 *
 * Toast notification for displaying sync completion feedback.
 * Shows success/warning based on sync results.
 *
 * Story 1.5: Task 5.3 - Sync Completion Feedback (AC-1.5.4)
 */

import { AnimatePresence, m as motion } from 'framer-motion';
import { CircleAlert, CircleCheck, Cloud, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export interface SyncResult {
  successCount: number;
  failCount: number;
}

interface SyncToastProps {
  /** Sync result to display */
  syncResult: SyncResult | null;
  /** Called when toast is dismissed */
  onDismiss: () => void;
  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  autoDismissMs?: number;
}

/**
 * Toast notification for sync completion
 *
 * @example
 * ```tsx
 * <SyncToast
 *   syncResult={{ successCount: 3, failCount: 0 }}
 *   onDismiss={() => setSyncResult(null)}
 * />
 * ```
 */
export function SyncToast({ syncResult, onDismiss, autoDismissMs = 5000 }: SyncToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Show toast when syncResult changes
  useEffect(() => {
    if (syncResult) {
      const showTimer = setTimeout(() => {
        setIsVisible(true);
      }, 0);
      return () => clearTimeout(showTimer);
    }
  }, [syncResult]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!isVisible || !syncResult || autoDismissMs === 0) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for exit animation
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [isVisible, syncResult, autoDismissMs, onDismiss]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  if (!syncResult) return null;

  const { successCount, failCount } = syncResult;
  const totalCount = successCount + failCount;
  const isFullSuccess = failCount === 0 && successCount > 0;
  const isPartialSuccess = successCount > 0 && failCount > 0;
  const isAllFailed = successCount === 0 && failCount > 0;

  // Determine toast variant. The surface is the same kit card for every
  // outcome; only the icon carries colour (green = success, pink = partial,
  // red = all failed, muted = nothing to do), so the text stays `ink`.
  const getToastConfig = () => {
    if (isFullSuccess) {
      return {
        icon: CircleCheck,
        iconColor: 'text-good',
        message: `Synced ${successCount} pending ${successCount === 1 ? 'item' : 'items'}`,
      };
    }
    if (isPartialSuccess) {
      return {
        icon: CircleAlert,
        iconColor: 'text-accent',
        message: `Synced ${successCount} of ${totalCount} items (${failCount} failed)`,
      };
    }
    if (isAllFailed) {
      return {
        icon: CircleAlert,
        iconColor: 'text-danger',
        message: `Failed to sync ${failCount} ${failCount === 1 ? 'item' : 'items'}`,
      };
    }
    // No items to sync case
    return {
      icon: Cloud,
      iconColor: 'text-muted',
      message: 'No pending items to sync',
    };
  };

  const config = getToastConfig();
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed inset-x-0 top-[calc(5rem+env(safe-area-inset-top))] z-100 mx-auto flex w-fit max-w-[90vw] min-w-70 items-center gap-3 rounded-[20px] border border-line bg-card py-1.5 pr-1.5 pl-4 shadow-float"
          role="alert"
          aria-live="polite"
          data-testid="sync-toast"
        >
          <Icon className={`h-5 w-5 shrink-0 ${config.iconColor}`} aria-hidden="true" />
          <span className="flex-1 text-sm font-medium text-ink">{config.message}</span>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
