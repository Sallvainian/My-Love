/**
 * SyncToast Component
 *
 * Toast notification for displaying sync completion feedback.
 * Shows success/warning based on sync results.
 *
 * Story 1.5: Task 5.3 - Sync Completion Feedback (AC-1.5.4)
 */

import { useEffect, useState, useCallback } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Cloud, X } from 'lucide-react';

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
export function SyncToast({
  syncResult,
  onDismiss,
  autoDismissMs = 5000,
}: SyncToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Show toast when syncResult changes
  useEffect(() => {
    if (syncResult) {
      setIsVisible(true);
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

  // Determine toast variant
  const getToastConfig = () => {
    if (isFullSuccess) {
      return {
        icon: CheckCircle,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        iconColor: 'text-green-500',
        textColor: 'text-green-800',
        message: `Synced ${successCount} pending ${successCount === 1 ? 'item' : 'items'}`,
      };
    }
    if (isPartialSuccess) {
      return {
        icon: AlertCircle,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        iconColor: 'text-yellow-500',
        textColor: 'text-yellow-800',
        message: `Synced ${successCount} of ${totalCount} items (${failCount} failed)`,
      };
    }
    if (isAllFailed) {
      return {
        icon: AlertCircle,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        iconColor: 'text-red-500',
        textColor: 'text-red-800',
        message: `Failed to sync ${failCount} ${failCount === 1 ? 'item' : 'items'}`,
      };
    }
    // No items to sync case
    return {
      icon: Cloud,
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      iconColor: 'text-gray-500',
      textColor: 'text-gray-600',
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
          className={`
            fixed top-4 left-1/2 -translate-x-1/2 z-[100]
            flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
            ${config.bgColor} ${config.borderColor} border
            min-w-[280px] max-w-[90vw]
          `}
          role="alert"
          aria-live="polite"
          data-testid="sync-toast"
        >
          <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor}`} />
          <span className={`flex-1 text-sm font-medium ${config.textColor}`}>
            {config.message}
          </span>
          <button
            onClick={handleDismiss}
            className={`p-1 rounded hover:bg-black/5 transition-colors ${config.textColor}`}
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SyncToast;
