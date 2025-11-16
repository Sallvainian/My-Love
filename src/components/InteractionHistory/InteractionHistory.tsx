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

import { useEffect, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Hand, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { getCurrentUserId } from '../../api/supabaseClient';
import type { Interaction } from '../../types';

interface InteractionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InteractionHistory({ isOpen, onClose }: InteractionHistoryProps) {
  const { getInteractionHistory, loadInteractionHistory } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load current user ID
  useEffect(() => {
    const loadUserId = async () => {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
    };
    loadUserId();
  }, []);

  // Load interaction history when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadHistory = async () => {
        setIsLoading(true);
        try {
          await loadInteractionHistory(100); // Load last 100 interactions
          console.log('[InteractionHistory] History loaded successfully');
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            data-testid="interaction-history-backdrop"
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 top-20 bottom-20 md:inset-x-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:h-auto md:max-h-[80vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            data-testid="interaction-history-modal"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Interaction History</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                data-testid="close-history-button"
                aria-label="Close"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="text-6xl mb-4 animate-pulse">💕</div>
                    <p className="text-gray-600">Loading interactions...</p>
                  </div>
                </div>
              ) : interactions.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💝</div>
                    <p className="text-gray-600 text-lg mb-2">No interactions yet</p>
                    <p className="text-gray-400 text-sm">
                      Send your first poke or kiss to get started!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {interactions.map((interaction) => {
                    const sent = isSent(interaction);
                    return (
                      <motion.div
                        key={interaction.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`
                          flex items-center gap-4 p-4 rounded-xl border-2 transition-all
                          ${sent ? 'bg-pink-50 border-pink-200' : 'bg-purple-50 border-purple-200'}
                        `}
                        data-testid={`interaction-${interaction.id}`}
                      >
                        {/* Direction Indicator */}
                        <div
                          className={`
                          flex items-center justify-center w-10 h-10 rounded-full
                          ${sent ? 'bg-pink-200' : 'bg-purple-200'}
                        `}
                        >
                          {sent ? (
                            <ArrowRight className="w-5 h-5 text-pink-600" />
                          ) : (
                            <ArrowLeft className="w-5 h-5 text-purple-600" />
                          )}
                        </div>

                        {/* Interaction Icon */}
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-sm">
                          {interaction.type === 'kiss' ? (
                            <Heart className="w-7 h-7 text-red-500 fill-current" />
                          ) : (
                            <Hand className="w-7 h-7 text-pink-500" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800 capitalize">
                              {interaction.type}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-sm text-gray-600">
                              {sent ? 'Sent' : 'Received'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimestamp(interaction.createdAt)}
                          </p>
                        </div>

                        {/* Viewed Badge */}
                        {!sent && !interaction.viewed && (
                          <div className="px-3 py-1 rounded-full bg-purple-500 text-white text-xs font-medium">
                            New
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-500 text-center">
                Showing interactions from the last 7 days ({interactions.length} total)
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
