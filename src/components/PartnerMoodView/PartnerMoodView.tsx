import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Smile, Meh, MessageCircle, Sparkles, RefreshCw, Calendar, Bell, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { MoodType, MoodEntry } from '../../types';
import { PARTNER_NAME } from '../../config/constants';
import { moodSyncService } from '../../api/moodSyncService';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Mood icon mapping (same as MoodTracker)
const MOOD_CONFIG = {
  loved: { icon: Heart, label: 'Loved', color: 'text-red-500' },
  happy: { icon: Smile, label: 'Happy', color: 'text-yellow-500' },
  content: { icon: Meh, label: 'Content', color: 'text-blue-500' },
  thoughtful: { icon: MessageCircle, label: 'Thoughtful', color: 'text-purple-500' },
  grateful: { icon: Sparkles, label: 'Grateful', color: 'text-pink-500' },
} as const;

/**
 * Partner Mood View Component
 * Story 6.4: Task 4 - AC-3 Partner mood visibility
 *
 * Features:
 * - Display list of partner's recent moods
 * - Manual refresh button to fetch latest moods
 * - Empty state when no partner moods available
 * - Mood cards with icons, dates, and notes
 * - Loading state during fetch
 * - Responsive grid layout
 */
type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export function PartnerMoodView() {
  const { partnerMoods, fetchPartnerMoods, syncStatus } = useAppStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    show: boolean;
    mood: string;
    note?: string;
  }>({ show: false, mood: '' });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Load partner moods on mount
  useEffect(() => {
    if (syncStatus.isOnline) {
      handleRefresh();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Story 6.4: Task 6 & 7 - Real-time subscription with connection status (AC #4)
  useEffect(() => {
    if (!syncStatus.isOnline) {
      setConnectionStatus('disconnected');
      return; // Don't subscribe when offline
    }

    if (import.meta.env.DEV) {
      console.log('[PartnerMoodView] Subscribing to partner mood updates');
    }

    // Track notification timeout IDs for cleanup (Task 11: prevent memory leaks)
    const timeoutIds: NodeJS.Timeout[] = [];
    let unsubscribe: (() => void) | null = null;

    // Setup async subscription
    const setupSubscription = async () => {
      // Subscribe to partner mood INSERT events with status tracking
      unsubscribe = await moodSyncService.subscribeMoodUpdates(
        (newMood) => {
          if (import.meta.env.DEV) {
            console.log('[PartnerMoodView] Received partner mood update:', newMood);
          }

          // Show notification toast
          const moodLabel = MOOD_CONFIG[newMood.mood_type]?.label || newMood.mood_type;
          setNotification({
            show: true,
            mood: moodLabel,
            note: newMood.note || undefined,
          });

          // Auto-hide notification after 5 seconds (with cleanup tracking)
          const timeoutId = setTimeout(() => {
            setNotification({ show: false, mood: '' });
          }, 5000);
          timeoutIds.push(timeoutId);

          // Refresh partner moods list to include the new mood
          fetchPartnerMoods(30).catch((err) => {
            console.error('[PartnerMoodView] Failed to refresh after realtime update:', err);
          });
        },
        (status) => {
          // Story 6.4: Task 7 - Map Supabase Realtime status to ConnectionStatus
          if (import.meta.env.DEV) {
            console.log('[PartnerMoodView] Realtime status changed:', status);
          }

          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            setConnectionStatus('disconnected');
          } else if (status === 'TIMED_OUT') {
            setConnectionStatus('reconnecting');
          }
        }
      );
    };

    setupSubscription().catch((err) => {
      console.error('[PartnerMoodView] Failed to setup subscription:', err);
      setConnectionStatus('disconnected');
    });

    // Cleanup subscription on unmount (Task 11: prevent memory leaks)
    return () => {
      if (import.meta.env.DEV) {
        console.log('[PartnerMoodView] Unsubscribing from partner mood updates');
      }

      // Clear all pending notification timeouts
      timeoutIds.forEach((id) => clearTimeout(id));

      setConnectionStatus('disconnected');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [syncStatus.isOnline, fetchPartnerMoods]); // Re-subscribe if online status changes

  // Story 6.4: Task 11 - Performance optimization with useCallback
  const handleRefresh = useCallback(async () => {
    if (!syncStatus.isOnline) {
      setError('Cannot fetch moods while offline');
      return;
    }

    try {
      setIsRefreshing(true);
      setError(null);
      await fetchPartnerMoods(30); // Fetch last 30 moods
    } catch (err) {
      console.error('[PartnerMoodView] Failed to fetch partner moods:', err);
      setError('Failed to load partner moods. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [syncStatus.isOnline, fetchPartnerMoods]);

  // Format date for display - memoized for performance
  const formatDate = useCallback((date: string): string => {
    const moodDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if today
    if (moodDate.toDateString() === today.toDateString()) {
      return 'Today';
    }

    // Check if yesterday
    if (moodDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Otherwise format as "Mon, Jan 15"
    return moodDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20" data-testid="partner-mood-view">
      {/* Real-time Notification Toast - Story 6.4: Task 6 (AC #4) */}
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4"
            data-testid="partner-mood-notification"
          >
            <div className="bg-pink-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
              <Bell className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">
                  {PARTNER_NAME} just logged a mood: {notification.mood}
                </p>
                {notification.note && (
                  <p className="text-sm text-pink-100 mt-1 line-clamp-2">
                    {notification.note}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header with Refresh Button */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {PARTNER_NAME}'s Moods
              </h1>
              {/* Story 6.4: Task 7 - Connection Status Indicator */}
              {syncStatus.isOnline && (
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                    connectionStatus === 'connected'
                      ? 'bg-green-100 text-green-700'
                      : connectionStatus === 'reconnecting'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                  data-testid="realtime-connection-status"
                  title={
                    connectionStatus === 'connected'
                      ? 'Real-time updates active'
                      : connectionStatus === 'reconnecting'
                        ? 'Reconnecting...'
                        : 'Disconnected'
                  }
                >
                  {connectionStatus === 'connected' ? (
                    <Wifi className="w-3 h-3" />
                  ) : (
                    <WifiOff className="w-3 h-3" />
                  )}
                  <span className="capitalize">{connectionStatus}</span>
                </div>
              )}
            </div>
            <p className="text-gray-600">See how they've been feeling</p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || !syncStatus.isOnline}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isRefreshing || !syncStatus.isOnline
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-pink-500 hover:bg-pink-600 text-white'
            }`}
            data-testid="partner-mood-refresh-button"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div
            className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800"
            data-testid="partner-mood-error"
          >
            {error}
          </div>
        )}

        {/* Offline Notice */}
        {!syncStatus.isOnline && (
          <div
            className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800"
            data-testid="partner-mood-offline-notice"
          >
            You're offline. Partner moods will load when you reconnect.
          </div>
        )}

        {/* Loading State */}
        {isRefreshing && partnerMoods.length === 0 && (
          <div className="text-center py-12" data-testid="partner-mood-loading">
            <div className="text-6xl mb-4 animate-pulse">💕</div>
            <p className="text-gray-600">Loading partner moods...</p>
          </div>
        )}

        {/* Empty State */}
        {!isRefreshing && partnerMoods.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
            data-testid="partner-mood-empty-state"
          >
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No moods yet
            </h3>
            <p className="text-gray-500 mb-6">
              {PARTNER_NAME} hasn't logged any moods yet.
              {syncStatus.isOnline && (
                <> Try refreshing to check for updates.</>
              )}
            </p>
          </motion.div>
        )}

        {/* Mood List */}
        {partnerMoods.length > 0 && (
          <div className="space-y-4" data-testid="partner-mood-list">
            <AnimatePresence>
              {partnerMoods.map((moodEntry, index) => (
                <MoodCard
                  key={moodEntry.supabaseId || `${moodEntry.date}-${index}`}
                  moodEntry={moodEntry}
                  formatDate={formatDate}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual Mood Card Component
 * Story 6.4: Task 11 - Memoized for performance optimization
 */
interface MoodCardProps {
  moodEntry: MoodEntry;
  formatDate: (date: string) => string;
}

const MoodCard = memo(function MoodCard({ moodEntry, formatDate }: MoodCardProps) {
  const { mood, date, note, timestamp } = moodEntry;
  const config = MOOD_CONFIG[mood];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
      data-testid="partner-mood-card"
    >
      <div className="flex items-start gap-4">
        {/* Mood Icon */}
        <div className={`${config.color} mt-1`}>
          <Icon className="w-6 h-6" />
        </div>

        {/* Mood Content */}
        <div className="flex-1">
          {/* Date and Mood Label */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-semibold text-gray-900">{config.label}</span>
              <span className="text-sm text-gray-500 ml-2">
                {formatDate(date)}
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(timestamp).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Note (if exists) */}
          {note && (
            <p className="text-gray-700 text-sm leading-relaxed">{note}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
});
