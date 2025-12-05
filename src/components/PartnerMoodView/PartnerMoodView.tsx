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
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4"
            data-testid="partner-mood-notification"
          >
            <div className="bg-pink-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
              <Bell className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">
                  {PARTNER_NAME} just logged a mood: {notification.mood}
                </p>
                {notification.note && (
                  <p className="text-sm text-pink-100 mt-1 line-clamp-2">{notification.note}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Partner Error Display */}
        {partnerError && (
          <div
            className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800"
            data-testid="partner-connection-error"
          >
            {partnerError}
          </div>
        )}

        {/* Show partner connection UI if no partner connected */}
        {!partner && !isLoadingPartner && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Users className="w-16 h-16 mx-auto mb-4 text-pink-500" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect with Your Partner</h1>
              <p className="text-gray-600">Search for your partner to start sharing moods</p>
            </div>

            {/* Search Box */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label
                htmlFor="partner-search"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Search by email or display name
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="partner-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Enter email or name..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
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
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{user.displayName}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <button
                        onClick={() => handleSendRequest(user.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
                        data-testid={`send-request-${user.id}`}
                      >
                        <UserPlus className="w-4 h-4" />
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
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Sent Requests</h2>
                <div className="space-y-2" data-testid="sent-requests-list">
                  {sentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {request.to_user_display_name || request.to_user_email || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Sent {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-yellow-700 font-medium">Pending</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Received Requests */}
            {receivedRequests.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Received Requests</h2>
                <div className="space-y-2" data-testid="received-requests-list">
                  {receivedRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
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
                          className="flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                          data-testid={`accept-request-${request.id}`}
                        >
                          <Check className="w-4 h-4" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(request.id)}
                          className="flex items-center gap-1 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                          data-testid={`decline-request-${request.id}`}
                        >
                          <X className="w-4 h-4" />
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
          <div className="text-center py-12">
            <div className="text-6xl mb-4 animate-pulse">💕</div>
            <p className="text-gray-600">Loading partner information...</p>
          </div>
        )}

        {/* Show partner moods view if partner is connected */}
        {partner && !isLoadingPartner && (
          <>
            {/* Header with Refresh Button */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {partner.displayName}'s Moods
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
                <p className="text-gray-600">Connected with {partner.displayName}</p>
              </div>

              {/* Action buttons: Refresh + Interaction FAB */}
              <div className="flex items-center gap-3">
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
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>

                {/* Story 6.5: Poke/Kiss Interaction FAB - next to refresh, expands down */}
                <PokeKissInterface expandDirection="down" />
              </div>
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
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No moods yet</h3>
                <p className="text-gray-500 mb-6">
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
              <span className="text-sm text-gray-500 ml-2">{formatDate(date)}</span>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(timestamp).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Note (if exists) */}
          {note && <p className="text-gray-700 text-sm leading-relaxed">{note}</p>}
        </div>
      </div>
    </motion.div>
  );
});
