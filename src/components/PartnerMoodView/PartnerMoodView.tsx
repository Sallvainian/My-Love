import { normalizeMoodEntry } from '../../types/moods';
import { AnimatePresence, m as motion } from 'framer-motion';
import {
  Bell,
  Calendar,
  Check,
  Heart,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { handleSupabaseError, isPostgrestError } from '../../api/errorHandlers';
import { moodSyncService } from '../../api/moodSyncService';
import { PARTNER_NAME } from '../../config/constants';
import { MOOD_DISPLAY, MOOD_TONE } from '../../constants/moodDisplay';
import { parseEventDate } from '../../services/eventsService';
import { useAppStore } from '../../stores/useAppStore';
import type { MoodEntry } from '../../types';
import { logger } from '../../utils/logger';
import { PokeKissInterface } from '../PokeKissInterface';
import { SECTION_LABEL } from '../shared/kitClasses';

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
 *   - Newest mood in a "Feeling right now" card, the rest as "Recent moods" rows
 *   - Refresh icon button to fetch latest moods
 *   - Real-time mood updates via Supabase Realtime
 *   - Empty state when no partner moods available
 *   - Loading state during fetch
 */
type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/** Kit card surface and small pill button (design-tokens.md). */
const CARD = 'rounded-[20px] border border-line bg-card shadow-card';
const PILL =
  'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2';

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

  // Story 6.4: Task 11 - Performance optimization with useCallback
  // Declared before the effect that calls it: it used to live further down the
  // component, so the effect closed over it before initialization and had to
  // suppress exhaustive-deps to stay quiet.
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

  // Load partner and pending requests on mount
  useEffect(() => {
    if (syncStatus.isOnline) {
      loadPartner();
      loadPendingRequests();
    }
  }, [syncStatus.isOnline, loadPartner, loadPendingRequests]);

  // Load partner moods only if partner is connected.
  // syncStatus.isOnline belongs in the dependency list: the suppressed version
  // re-ran only when `partner` changed, so reconnecting with the same partner
  // still showed the moods fetched before going offline.
  useEffect(() => {
    if (syncStatus.isOnline && partner) {
      // handleRefresh raises isRefreshing before it awaits, and that ordering is the point:
      // the spinner and the "Loading partner moods..." panel are the only signal that a
      // fetch is in flight, so deferring the flag past the await would leave the view
      // looking idle for the whole Supabase round trip. There is nothing to derive it from
      // either — the fetch lifecycle lives outside React.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch lifecycle
      handleRefresh();
    }
  }, [syncStatus.isOnline, partner, handleRefresh]);

  // Story 6.4: Task 6 & 7 - Real-time subscription with connection status (AC #4)
  useEffect(() => {
    // The offline branch deliberately does not reset connectionStatus. This effect's own
    // cleanup already sets 'disconnected', and React runs it before the body re-runs on the
    // online -> offline flip; a first render that is already offline starts at 'disconnected'
    // from useState. The reset that used to sit here only ever rewrote the value it was about
    // to read, and charged a cascading render for it.
    if (!syncStatus.isOnline) {
      return; // Don't subscribe when offline
    }

    logger.info('[PartnerMoodView] Subscribing to partner mood updates');

    // Track notification timeout IDs for cleanup (Task 11: prevent memory leaks)
    const timeoutIds: NodeJS.Timeout[] = [];
    let unsubscribe: (() => void) | null = null;
    // subscribeMoodUpdates is async, so the effect can be torn down before it
    // resolves -- a fast tab switch, or the two renders StrictMode does in dev.
    // The cleanup below would then find `unsubscribe` still null and the
    // subscriber would stay attached for the life of the page, holding the
    // shared channel open. Mirrors the guard in usePartnerMood.
    let isMounted = true;

    // Setup async subscription
    const setupSubscription = async () => {
      // Subscribe to partner mood INSERT events with status tracking
      const unsubscribeFn = await moodSyncService.subscribeMoodUpdates(
        (newMood) => {
          logger.debug('[PartnerMoodView] Received partner mood update:', newMood);

          // Show notification toast
          const moodLabel = MOOD_DISPLAY[newMood.mood_type]?.label || newMood.mood_type;
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

      if (!isMounted) {
        unsubscribeFn();
        return;
      }
      unsubscribe = unsubscribeFn;
    };

    setupSubscription().catch((err) => {
      console.error('[PartnerMoodView] Failed to setup subscription:', err);
      if (!isMounted) return;
      setConnectionStatus('disconnected');
    });

    // Cleanup subscription on unmount (Task 11: prevent memory leaks)
    return () => {
      logger.debug('[PartnerMoodView] Unsubscribing from partner mood updates');
      isMounted = false;

      // Clear all pending notification timeouts
      timeoutIds.forEach((id) => clearTimeout(id));

      setConnectionStatus('disconnected');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [syncStatus.isOnline, fetchPartnerMoods]); // Re-subscribe if online status changes

  // Format date for display - memoized for performance
  // `date` is a local YYYY-MM-DD; `new Date(date)` would read it as UTC midnight
  // and show the previous day west of UTC.
  const formatDate = useCallback((date: string, style: 'short' | 'long' = 'short'): string => {
    const moodDate = parseEventDate(date);
    if (!moodDate) return date;
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

    // Otherwise "Thu 19 Mar" (row) or "Friday 20 March" (current card), per the
    // artboard. Built from parts rather than en-GB, which writes September as "Sept".
    const weekday = moodDate.toLocaleDateString('en-US', { weekday: style });
    const month = moodDate.toLocaleDateString('en-US', { month: style });
    return `${weekday} ${moodDate.getDate()} ${month}`;
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
        setPartnerError(
          isPostgrestError(err) && err.code === '23514'
            ? handleSupabaseError(err).message
            : err instanceof Error ? err.message : 'Failed to send partner request'
        );
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
        setPartnerError(
          isPostgrestError(err) && err.code === '23514'
            ? handleSupabaseError(err).message
            : err instanceof Error ? err.message : 'Failed to accept partner request'
        );
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
        setPartnerError(
          isPostgrestError(err) && err.code === '23514'
            ? handleSupabaseError(err).message
            : err instanceof Error ? err.message : 'Failed to decline partner request'
        );
      }
    },
    [declinePartnerRequest]
  );
  // Subtitle under the partner's name: one dot + one word for the realtime feed.
  const connection = !syncStatus.isOnline
    ? { label: 'Offline', dot: 'bg-muted', title: 'Offline' }
    : connectionStatus === 'connected'
      ? { label: 'Connected', dot: 'bg-good', title: 'Real-time updates active' }
      : connectionStatus === 'reconnecting'
        ? { label: 'Reconnecting', dot: 'bg-muted', title: 'Reconnecting...' }
        : { label: 'Disconnected', dot: 'bg-muted', title: 'Disconnected' };

  // Newest mood goes in the "Feeling right now" card; the rest are Recent moods rows.
  const [latestMood, ...olderMoods] = partnerMoods;

  return (
    <div className="min-h-screen bg-page" data-testid="partner-mood-view">
      {/* Real-time Notification Toast - Story 6.4: Task 6 (AC #4) */}
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed inset-x-4 top-[calc(5rem+env(safe-area-inset-top))] z-50 mx-auto max-w-md"
            data-testid="partner-mood-notification"
          >
            <div className="flex items-center gap-3 rounded-[20px] border border-line bg-card px-4 py-3 shadow-float">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ptint text-partner">
                <Bell className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">
                  {PARTNER_NAME} just logged a mood: {notification.mood}
                </p>
                {notification.note && (
                  <p
                    className="mt-0.5 line-clamp-2 text-[13px] wrap-break-word text-muted"
                    data-testid="partner-mood-notification-note"
                  >
                    {notification.note}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-3 pb-6">
        {/* Partner Error Display */}
        {partnerError && (
          <div
            className="rounded-[20px] bg-dtint px-4 py-3 text-sm font-medium text-danger"
            data-testid="partner-connection-error"
          >
            {partnerError}
          </div>
        )}

        {/* Show partner connection UI if no partner connected */}
        {!partner && !isLoadingPartner && (
          <>
            <header className="flex items-start gap-3 px-1 pt-1">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h1 className="font-serif text-[30px] leading-[1.1] font-semibold text-ink">
                  Connect with Your Partner
                </h1>
                <p className="text-sm text-muted">Search for your partner to start sharing moods</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tint text-accent">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
            </header>

            {/* Search Box */}
            <div className={`${CARD} p-5`} data-testid="partner-search-card">
              <label
                htmlFor="partner-search"
                className="mb-2 block text-[13px] font-semibold text-ink"
              >
                Search by email or display name
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  id="partner-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Enter email or name..."
                  className="h-12 w-full rounded-[14px] bg-field pr-4 pl-11 text-[15px] text-ink ring-1 ring-line-strong ring-inset placeholder:text-muted focus:ring-2 focus:ring-accent focus:outline-none"
                  data-testid="partner-search-input"
                />
              </div>

              {/* Search Results */}
              {isSearching && (
                <p className="mt-4 animate-pulse text-center text-sm text-muted">Searching...</p>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div
                  className="mt-3 flex flex-col divide-y divide-line"
                  data-testid="partner-search-results"
                >
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">
                          {user.displayName}
                        </p>
                        <p className="truncate text-[13px] text-muted">{user.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendRequest(user.id)}
                        className={`${PILL} bg-fill text-white focus-visible:ring-accent`}
                        data-testid={`send-request-${user.id}`}
                      >
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                        <span>Send Request</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <p className="mt-4 text-center text-sm wrap-break-word text-muted">
                  No users found matching "{searchQuery}"
                </p>
              )}
            </div>

            {/* Sent Requests */}
            {sentRequests.length > 0 && (
              <section className={`${CARD} px-5 pt-4 pb-2`}>
                <h2 className="text-[15px] font-semibold text-ink">Sent Requests</h2>
                <div className="flex flex-col divide-y divide-line" data-testid="sent-requests-list">
                  {sentRequests.map((request) => (
                    <div key={request.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">
                          {request.to_user_display_name || request.to_user_email || 'Unknown User'}
                        </p>
                        <p className="text-[13px] text-muted">
                          Sent {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-card2 px-3 py-1 text-xs font-semibold text-muted">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Received Requests */}
            {receivedRequests.length > 0 && (
              <section className={`${CARD} px-5 pt-4 pb-2`}>
                <h2 className="text-[15px] font-semibold text-ink">Received Requests</h2>
                <div
                  className="flex flex-col divide-y divide-line"
                  data-testid="received-requests-list"
                >
                  {receivedRequests.map((request) => (
                    <div key={request.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">
                          {request.from_user_display_name ||
                            request.from_user_email ||
                            'Unknown User'}
                        </p>
                        <p className="text-[13px] text-muted">
                          Sent {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleAcceptRequest(request.id)}
                          className={`${PILL} bg-fill text-white focus-visible:ring-accent`}
                          data-testid={`accept-request-${request.id}`}
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineRequest(request.id)}
                          className={`${PILL} bg-card2 text-muted focus-visible:ring-accent`}
                          data-testid={`decline-request-${request.id}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Show loading state while checking for partner */}
        {isLoadingPartner && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Heart className="h-9 w-9 animate-pulse fill-current text-accent" aria-hidden="true" />
            <p className="text-sm text-muted">Loading partner information...</p>
          </div>
        )}

        {/* Show partner moods view if partner is connected */}
        {partner && !isLoadingPartner && (
          <>
            {/* Header: partner name, realtime status, refresh icon button */}
            <header className="flex items-end justify-between gap-3 px-1 pt-1">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h1 className="font-serif text-[30px] leading-[1.1] font-semibold wrap-break-word text-ink">
                  {partner.displayName}
                </h1>
                {/* Story 6.4: Task 7 - Connection Status Indicator */}
                <p
                  className="flex items-center gap-1.5 text-sm text-muted"
                  data-testid="realtime-connection-status"
                  title={connection.title}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${connection.dot}`}
                    aria-hidden="true"
                  />
                  {connection.label}
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing || !syncStatus.isOnline}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card2 text-muted transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Refresh"
                aria-busy={isRefreshing}
                data-testid="partner-mood-refresh-button"
              >
                <RefreshCw
                  className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </header>

            {/* Error Display */}
            {error && (
              <div
                className="rounded-[20px] bg-dtint px-4 py-3 text-sm font-medium text-danger"
                data-testid="partner-mood-error"
              >
                {error}
              </div>
            )}

            {/* Offline Notice */}
            {!syncStatus.isOnline && (
              <div
                className={`${CARD} flex items-center gap-3 p-4`}
                data-testid="partner-mood-offline-notice"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card2 text-muted">
                  <WifiOff className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm text-muted">
                  You're offline. Partner moods will load when you reconnect.
                </p>
              </div>
            )}

            {/* Loading State */}
            {isRefreshing && partnerMoods.length === 0 && (
              <div
                className={`${CARD} flex flex-col items-center gap-3 px-5 py-10 text-center`}
                data-testid="partner-mood-loading"
              >
                <Heart className="h-8 w-8 animate-pulse fill-current text-accent" aria-hidden="true" />
                <p className="text-sm text-muted">Loading partner moods...</p>
              </div>
            )}

            {/* Empty State */}
            {!isRefreshing && partnerMoods.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${CARD} flex flex-col items-center gap-2 px-5 py-10 text-center`}
                data-testid="partner-mood-empty-state"
              >
                <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-ptint text-partner">
                  <Calendar className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="text-[15px] font-semibold text-ink">No moods yet</h2>
                <p className="text-sm text-muted">
                  {partner.displayName} hasn't logged any moods yet.
                  {syncStatus.isOnline && <> Try refreshing to check for updates.</>}
                </p>
              </motion.div>
            )}

            {/* Feeling right now */}
            {latestMood && (
              <MoodCard
                key={latestMood.supabaseId || latestMood.date}
                variant="current"
                moodEntry={latestMood}
                formatDate={formatDate}
              />
            )}

            {/* Story 6.5: Poke/Kiss/Fart tiles + History */}
            <PokeKissInterface />

            {/* Recent moods */}
            {olderMoods.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="partner-recent-moods-label">
                <h2 id="partner-recent-moods-label" className={SECTION_LABEL}>
                  Recent moods
                </h2>
                <div
                  className={`${CARD} flex flex-col divide-y divide-line px-3 py-1`}
                  data-testid="partner-mood-list"
                >
                  <AnimatePresence initial={false}>
                    {olderMoods.map((moodEntry, index) => (
                      <MoodCard
                        key={moodEntry.supabaseId || `${moodEntry.date}-${index + 1}`}
                        moodEntry={moodEntry}
                        formatDate={formatDate}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
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
 *
 * `current` is the "Feeling right now" card (one partner chip per mood);
 * `row` (the default) is one line of the Recent moods list card.
 */
interface MoodCardProps {
  moodEntry: MoodEntry;
  formatDate: (date: string, style?: 'short' | 'long') => string;
  variant?: 'current' | 'row';
}

export const MoodCard = memo(function MoodCard({
  moodEntry,
  formatDate,
  variant = 'row',
}: MoodCardProps) {
  const normalized = normalizeMoodEntry(moodEntry);
  if (!normalized) return null;
  const { date, note, timestamp, moods: allMoods } = normalized;
  const PrimaryIcon = MOOD_DISPLAY[normalized.mood].icon;
  const labels = allMoods.map((m) => MOOD_DISPLAY[m].label).join(', ');
  const when = `${formatDate(date, variant === 'current' ? 'long' : 'short')} · ${new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;

  if (variant === 'current') {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`${CARD} flex flex-col gap-3 p-[18px]`}
        data-testid="partner-mood-card"
      >
        <h2 className="text-[13px] font-semibold tracking-[.08em] text-muted uppercase">
          Feeling right now
        </h2>
        <div className="flex flex-wrap gap-2">
          {allMoods.map((m, index) => {
            const { icon: Icon, label } = MOOD_DISPLAY[m];
            return (
              <span
                key={`${m}-${index}`}
                className={`flex h-[34px] items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-semibold ${MOOD_TONE.partner}`}
              >
                <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
                {label}
              </span>
            );
          })}
        </div>
        <p className="text-[13px] text-muted">{when}</p>
        {note && (
          <p
            className="text-[15px] leading-relaxed wrap-break-word text-ink"
            data-testid="partner-mood-entry-note"
          >
            {note}
          </p>
        )}
      </motion.section>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex min-h-12 items-center gap-3 py-2"
      data-testid="partner-mood-card"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${MOOD_TONE.partner}`}
      >
        <PrimaryIcon className="h-[18px] w-[18px]" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[15px] font-medium wrap-break-word text-ink">{labels}</p>
        <p className="text-[13px] text-muted">{when}</p>
        {note && (
          <p
            className="mt-0.5 text-[13px] leading-relaxed wrap-break-word text-muted"
            data-testid="partner-mood-entry-note"
          >
            {note}
          </p>
        )}
      </div>
    </motion.div>
  );
});
