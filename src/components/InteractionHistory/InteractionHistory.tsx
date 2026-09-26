/**
 * InteractionHistory Component
 *
 * Displays interaction history for the last 7 days.
 * Shows pokes and kisses sent/received with timestamps.
 *
 * Features:
 * - List view of interactions (last 7 days)
 * - Visual indicators for interaction type
 * - Sender/receiver indication
 * - Timestamp display
 * - Empty state when no interactions exist
 *
 * AC Coverage:
 * - AC#6: Interaction history viewable (last 7 days)
 */

import { AnimatePresence, m as motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Heart, X, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks';
import { useAppStore } from '../../stores/useAppStore';
import type { Interaction } from '../../types';
import { logger } from '../../utils/logger';

interface InteractionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InteractionHistory({ isOpen, onClose }: InteractionHistoryProps) {
  const { getInteractionHistory, loadInteractionHistory } = useAppStore();
  const currentUserId = useAppStore((state) => state.userId);
  const [isLoading, setIsLoading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap (WCAG 2.4.3) + Escape to close, focus returned on close
  useFocusTrap(sheetRef, isOpen, { onEscape: onClose, initialFocusRef: closeButtonRef });

  // Load interaction history when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadHistory = async () => {
        setIsLoading(true);
        try {
          await loadInteractionHistory(100); // Load last 100 interactions
          logger.debug('[InteractionHistory] History loaded successfully');
        } catch (error) {
          console.error('[InteractionHistory] Failed to load history:', error);
        } finally {
          setIsLoading(false);
        }
      };

      loadHistory();
    }
  }, [isOpen, loadInteractionHistory]);

  // Get interactions from last 7 days
  const interactions = getInteractionHistory(7);

  // Format timestamp for display
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Determine if interaction was sent or received
  const isSent = (interaction: Interaction): boolean => {
    return interaction.fromUserId === currentUserId;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            data-testid="interaction-history-backdrop"
          />

          {/* Bottom sheet (centred dialog from `sm` up) */}
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <motion.div
              ref={sheetRef}
              className="pointer-events-auto flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-[20px] bg-card shadow-float sm:rounded-[20px]"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="interaction-history-title"
              data-testid="interaction-history-modal"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                <h2 id="interaction-history-title" className="text-lg font-semibold text-ink">
                  Interaction History
                </h2>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card2 text-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                  data-testid="close-history-button"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Content */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {/* The saved copy (or this session's list) stays on screen
                    while the refresh runs; the spinner is for an empty list. */}
                {isLoading && interactions.length === 0 ? (
                  <div
                    className="flex flex-col items-center gap-3 py-10 text-center"
                    data-testid="interaction-history-loading"
                  >
                    <Heart
                      className="h-8 w-8 animate-pulse fill-current text-accent"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-muted">Loading interactions...</p>
                  </div>
                ) : interactions.length === 0 ? (
                  <div
                    className="flex flex-col items-center gap-2 py-10 text-center"
                    data-testid="interaction-history-empty"
                  >
                    <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-tint text-accent">
                      <Heart className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="text-[15px] font-semibold text-ink">No interactions yet</p>
                    <p className="text-sm text-muted">Send your first poke or kiss to get started!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {interactions.map((interaction) => {
                      const sent = isSent(interaction);
                      const Icon = interaction.type === 'kiss' ? Heart : Zap;
                      const Direction = sent ? ArrowRight : ArrowLeft;
                      return (
                        <motion.div
                          key={interaction.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex items-center gap-3 rounded-[20px] p-3 ${sent ? 'bg-tint' : 'bg-ptint'}`}
                          data-testid={`interaction-${interaction.id}`}
                        >
                          {/* Interaction Icon */}
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card ${sent ? 'text-accent' : 'text-partner'}`}
                          >
                            <Icon
                              className={`h-5 w-5 ${interaction.type === 'kiss' ? 'fill-current' : ''}`}
                              aria-hidden="true"
                            />
                          </div>

                          {/* Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[15px] font-semibold text-ink capitalize">
                                {interaction.type}
                              </span>
                              <span className="text-muted" aria-hidden="true">
                                ·
                              </span>
                              <span
                                className={`flex items-center gap-1 text-[13px] font-medium ${sent ? 'text-accent' : 'text-partner'}`}
                              >
                                <Direction className="h-3.5 w-3.5" aria-hidden="true" />
                                {sent ? 'Sent' : 'Received'}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[13px] text-muted">
                              {formatTimestamp(interaction.createdAt)}
                            </p>
                          </div>

                          {/* Viewed Badge */}
                          {!sent && !interaction.viewed && (
                            <span className="shrink-0 rounded-full bg-fill px-2.5 py-0.5 text-[11px] font-bold text-white">
                              New
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-line px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <p className="text-center text-[13px] text-muted">
                  Showing interactions from the last 7 days ({interactions.length} total)
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
