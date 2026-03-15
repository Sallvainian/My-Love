import { useState, useEffect, useCallback, memo } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Smile,
  Meh,
  MessageCircle,
  Sparkles,
  RefreshCw,
  Calendar,
  Bell,
  Wifi,
  WifiOff,
  Search,
  UserPlus,
  Check,
  X,
  Users,
  Frown,
  AlertCircle,
  Angry,
  UserMinus,
  Battery,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { MoodEntry } from '../../types';
import { PARTNER_NAME } from '../../config/constants';
import { moodSyncService } from '../../api/moodSyncService';
import { PokeKissInterface } from '../PokeKissInterface';
import { logger } from '@/utils/logger';

// Mood icon mapping (same as MoodTracker)
const MOOD_CONFIG = {
  // Positive emotions
  loved: { icon: Heart, label: 'Loved', color: 'text-red-500' },
  happy: { icon: Smile, label: 'Happy', color: 'text-yellow-500' },
  content: { icon: Meh, label: 'Content', color: 'text-blue-500' },
  excited: { icon: Zap, label: 'Excited', color: 'text-amber-500' },
  thoughtful: { icon: MessageCircle, label: 'Thoughtful', color: 'text-purple-500' },
  grateful: { icon: Sparkles, label: 'Grateful', color: 'text-pink-500' },
  // Negative emotions
  sad: { icon: Frown, label: 'Sad', color: 'text-gray-500' },
  anxious: { icon: AlertCircle, label: 'Anxious', color: 'text-orange-500' },
  frustrated: { icon: Angry, label: 'Frustrated', color: 'text-red-600' },
  angry: { icon: Angry, label: 'Angry', color: 'text-rose-600' },
  lonely: { icon: UserMinus, label: 'Lonely', color: 'text-indigo-500' },
  tired: { icon: Battery, label: 'Tired', color: 'text-slate-500' },
} as const;

/**
 * Partner Mood View Component
 * Story 6.4: Task 4 - AC-3 Partner mood visibility
 * Partner Connection System (Epic 6 Extension)
 *
 * Features:
 * - Partner connection management:
 *   - Search for users by email or display name
 *   - Send partner connection requests
 *   - View sent pending requests
 *   - Accept/decline received requests
 *   - Display connected partner information
 * - Partner mood tracking (when connected):
 *   - Display list of partner's recent moods
 *   - Manual refresh button to fetch latest moods
 *   - Real-time mood updates via Supabase Realtime
 *   - Empty state when no partner moods available
 *   - Mood cards with icons, dates, and notes
 *   - Loading state during fetch
 *   - Responsive grid layout
 */
type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export function PartnerMoodView() {
  const {
    partnerMoods,
    fetchPartnerMoods,
    syncStatus,
    // Partner connection state
    partner,
    isLoadingPartner,
    sentRequests,
    receivedRequests,
    searchResults,
    isSearching,
    // Partner connection actions
    loadPartner,
    loadPendingRequests,
    searchUsers,
    clearSearch,
    sendPartnerRequest,
    acceptPartnerRequest,
    declinePartnerRequest,
  } = useAppStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    show: boolean;
    mood: string;
    note?: string;
  }>({ show: false, mood: '' });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerError, setPartnerError] = useState<string | null>(null);

  // Load partner and pending requests on mount
  useEffect(() => {
    if (syncStatus.isOnline) {
      loadPartner();
      loadPendingRequests();
    }
  }, [syncStatus.isOnline, loadPartner, loadPendingRequests]);

  // Load partner moods only if partner is connected
  useEffect(() => {
    if (syncStatus.isOnline && partner) {
      handleRefresh();
    }
  }, [partner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Story 6.4: Task 6 & 7 - Real-time subscription with connection status (AC #4)
  useEffect(() => {
    if (!syncStatus.isOnline) {
      setConnectionStatus('disconnected');
      return; // Don't subscribe when offline
    }

    logger.info('[PartnerMoodView] Subscribing to partner mood updates');

    // Track notification timeout IDs for cleanup (Task 11: prevent memory leaks)
    const timeoutIds: NodeJS.Timeout[] = [];
    let unsubscribe: (() => void) | null = null;

    // Setup async subscription
    const setupSubscription = async () => {
      // Subscribe to partner mood INSERT events with status tracking
      unsubscribe = await moodSyncService.subscribeMoodUpdates(
        (newMood) => {
          logger.debug('[PartnerMoodView] Received partner mood update:', newMood);

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
          logger.info('[PartnerMoodView] Realtime status changed:', status);

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
      logger.debug('[PartnerMoodView] Unsubscribing from partner mood updates');

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

  // Debounced search - prevents spamming API on every keystroke
  useEffect(() => {
    // Debounce search by 300ms
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers(searchQuery);
      } else if (searchQuery.trim().length === 0) {
        clearSearch();
      }
    }, 300);

    // Cleanup timeout on unmount or searchQuery change
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers, clearSearch]);

  // Handle search input change
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle sending partner request
  const handleSendRequest = useCallback(
    async (userId: string) => {
      try {
        setPartnerError(null);
        await sendPartnerRequest(userId);
        setSearchQuery('');
      } catch (err) {
        setPartnerError(err instanceof Error ? err.message : 'Failed to send partner request');
      }
    },
    [sendPartnerRequest]
  );

  // Handle accepting partner request
  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      try {
        setPartnerError(null);
        await acceptPartnerRequest(requestId);
      } catch (err) {
        setPartnerError(err instanceof Error ? err.message : 'Failed to accept partner request');
      }
    },
    [acceptPartnerRequest]
  );

  // Handle declining partner request
  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      try {
        setPartnerError(null);
        await declinePartnerRequest(requestId);
      } catch (err) {
        setPartnerError(err instanceof Error ? err.message : 'Failed to decline partner request');
      }
    },
    [declinePartnerRequest]
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20" data-testid="partner-mood-view">
      {/* Real-time Notification Toast - Story 6.4: Task 6 (AC #4) */}
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 z-50 mx-4 w-full max-w-md -translate-x-1/2 transform"
            data-testid="partner-mood-notification"
          >
            <div className="flex items-center gap-3 rounded-lg bg-pink-500 px-6 py-4 text-white shadow-lg">
              <Bell className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">
                  {PARTNER_NAME} just logged a mood: {notification.mood}
                </p>
                {notification.note && (
                  <p className="mt-1 line-clamp-2 text-sm text-pink-100">{notification.note}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Partner Error Display */}
        {partnerError && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
            data-testid="partner-connection-error"
          >
            {partnerError}
          </div>
        )}

        {/* Show partner connection UI if no partner connected */}
        {!partner && !isLoadingPartner && (
          <div className="space-y-6">
            <div className="mb-8 text-center">
              <Users className="mx-auto mb-4 h-16 w-16 text-pink-500" />
              <h1 className="mb-2 text-3xl font-bold text-gray-900">Connect with Your Partner</h1>
              <p className="text-gray-600">Search for your partner to start sharing moods</p>
            </div>

            {/* Search Box */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <label
                htmlFor="partner-search"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Search by email or display name
              </label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                <input
                  id="partner-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Enter email or name..."
                  className="w-full rounded-lg border border-gray-300 py-3 pr-4 pl-10 focus:border-transparent focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  data-testid="partner-search-input"
                />
              </div>

              {/* Search Results */}
              {isSearching && (
                <div className="mt-4 text-center text-gray-500">
                  <div className="animate-pulse">Searching...</div>
                </div>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div className="mt-4 space-y-2" data-testid="partner-search-results">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{user.displayName}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <button
                        onClick={() => handleSendRequest(user.id)}
                        className="flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 font-medium text-white transition-colors hover:bg-pink-600"
                        data-testid={`send-request-${user.id}`}
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>Send Request</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="mt-4 text-center text-gray-500">
                  No users found matching "{searchQuery}"
                </div>
              )}
            </div>

            {/* Sent Requests */}
            {sentRequests.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Sent Requests</h2>
                <div className="space-y-2" data-testid="sent-requests-list">
                  {sentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-3"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {request.to_user_display_name || request.to_user_email || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Sent {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="font-medium text-yellow-700">Pending</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Received Requests */}
            {receivedRequests.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Received Requests</h2>
                <div className="space-y-2" data-testid="received-requests-list">
                  {receivedRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {request.from_user_display_name ||
                            request.from_user_email ||
                            'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Sent {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-2 font-medium text-white transition-colors hover:bg-green-600"
                          data-testid={`accept-request-${request.id}`}
                        >
                          <Check className="h-4 w-4" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(request.id)}
                          className="flex items-center gap-1 rounded-lg bg-gray-500 px-3 py-2 font-medium text-white transition-colors hover:bg-gray-600"
                          data-testid={`decline-request-${request.id}`}
                        >
                          <X className="h-4 w-4" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show loading state while checking for partner */}
        {isLoadingPartner && (
          <div className="py-12 text-center">
            <div className="mb-4 animate-pulse text-6xl">💕</div>
            <p className="text-gray-600">Loading partner information...</p>
          </div>
        )}

        {/* Show partner moods view if partner is connected */}
        {partner && !isLoadingPartner && (
          <>
            {/* Header with Refresh Button */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {partner.displayName}'s Moods
                  </h1>
                  {/* Story 6.4: Task 7 - Connection Status Indicator */}
                  {syncStatus.isOnline && (
                    <div
                      className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
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
                        <Wifi className="h-3 w-3" />
                      ) : (
                        <WifiOff className="h-3 w-3" />
                      )}
                      <span className="capitalize">{connectionStatus}</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-600">Connected with {partner.displayName}</p>
              </div>

              {/* Action buttons: Refresh + Interaction FAB */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing || !syncStatus.isOnline}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                    isRefreshing || !syncStatus.isOnline
                      ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                      : 'bg-pink-500 text-white hover:bg-pink-600'
                  }`}
                  data-testid="partner-mood-refresh-button"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>

                {/* Story 6.5: Poke/Kiss Interaction FAB - next to refresh, expands down */}
                <PokeKissInterface expandDirection="down" />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div
                className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
                data-testid="partner-mood-error"
              >
                {error}
              </div>
            )}

            {/* Offline Notice */}
            {!syncStatus.isOnline && (
              <div
                className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800"
                data-testid="partner-mood-offline-notice"
              >
                You're offline. Partner moods will load when you reconnect.
              </div>
            )}

            {/* Loading State */}
            {isRefreshing && partnerMoods.length === 0 && (
              <div className="py-12 text-center" data-testid="partner-mood-loading">
                <div className="mb-4 animate-pulse text-6xl">💕</div>
                <p className="text-gray-600">Loading partner moods...</p>
              </div>
            )}

            {/* Empty State */}
            {!isRefreshing && partnerMoods.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-12 text-center"
                data-testid="partner-mood-empty-state"
              >
                <Calendar className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <h3 className="mb-2 text-xl font-semibold text-gray-700">No moods yet</h3>
                <p className="mb-6 text-gray-500">
                  {partner.displayName} hasn't logged any moods yet.
                  {syncStatus.isOnline && <> Try refreshing to check for updates.</>}
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
          </>
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
      className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
      data-testid="partner-mood-card"
    >
      <div className="flex items-start gap-4">
        {/* Mood Icon */}
        <div className={`${config.color} mt-1`}>
          <Icon className="h-6 w-6" />
        </div>

        {/* Mood Content */}
        <div className="flex-1">
          {/* Date and Mood Label */}
          <div className="mb-2 flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-900">{config.label}</span>
              <span className="ml-2 text-sm text-gray-500">{formatDate(date)}</span>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(timestamp).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Note (if exists) */}
          {note && <p className="text-sm leading-relaxed text-gray-700">{note}</p>}
        </div>
      </div>
    </motion.div>
  );
});
