import { Check, Search, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';
import { handleSupabaseError, isPostgrestError } from '../../api/errorHandlers';
import { looksLikeEmail } from '../../api/partnerService';
import { useAppStore } from '../../stores/useAppStore';

/**
 * Partner Connect -- the Partner page for an account with no partner: find a
 * partner by the exact email they sign in with, send a request, see the sent
 * and received requests, accept or decline, and the line that reports a
 * failed attempt.
 *
 * Moved unchanged from PartnerMoodView. It renders as a fragment, so its
 * header, cards and error line are siblings in the page's column. Shown only
 * once the server has said there is no partner (never while the partner is
 * loading or its read failed).
 */

/** Kit card surface and small pill button (design-tokens.md). */
const CARD = 'rounded-[20px] border border-line bg-card shadow-card';
const PILL =
  'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2';

export function PartnerConnect() {
  const {
    sentRequests,
    receivedRequests,
    searchResult,
    isSearching,
    searchUsers,
    clearSearch,
    sendPartnerRequest,
    acceptPartnerRequest,
    declinePartnerRequest,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  // The address the shown answer belongs to, so an answer never outlives an edit.
  const [searchedEmail, setSearchedEmail] = useState<string | null>(null);
  const [partnerError, setPartnerError] = useState<string | null>(null);

  // The search matches the whole address exactly, so it runs on submit rather
  // than on every keystroke: a half-typed address would only ever answer "no
  // account".
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSearchedEmail(null);
      clearSearch();
    },
    [clearSearch]
  );

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const email = searchQuery.trim();
      if (!looksLikeEmail(email)) return;
      setSearchedEmail(email);
      void searchUsers(email);
    },
    [searchQuery, searchUsers]
  );

  // Only an answer to the address in the box, and never while one is loading.
  const shownSearch =
    !isSearching && searchedEmail !== null && searchedEmail === searchQuery.trim()
      ? searchResult
      : null;

  // Handle sending partner request
  const handleSendRequest = useCallback(
    async (userId: string) => {
      try {
        setPartnerError(null);
        await sendPartnerRequest(userId);
        setSearchQuery('');
        setSearchedEmail(null);
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

  return (
    <>
      {/* Partner Error Display */}
      {partnerError && (
        <div
          className="rounded-[20px] bg-dtint px-4 py-3 text-sm font-medium text-danger"
          data-testid="partner-connection-error"
        >
          {partnerError}
        </div>
      )}

      <header className="flex items-start gap-3 px-1 pt-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="font-serif text-[30px] leading-[1.1] font-semibold text-ink">
            Connect with Your Partner
          </h1>
          <p className="text-sm text-muted">
            Find your partner by the email they sign in with
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tint text-accent">
          <Users className="h-5 w-5" aria-hidden="true" />
        </div>
      </header>

      {/* Search Box */}
      <div className={`${CARD} p-5`} data-testid="partner-search-card">
        <form onSubmit={handleSearchSubmit} noValidate>
          <label
            htmlFor="partner-search"
            className="mb-2 block text-[13px] font-semibold text-ink"
          >
            Your partner's email
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                id="partner-search"
                type="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Enter your partner's email"
                className="h-12 w-full rounded-[14px] bg-field pr-4 pl-11 text-base text-ink ring-1 ring-line-strong ring-inset placeholder:text-muted focus:ring-2 focus:ring-accent focus:outline-hidden"
                data-testid="partner-search-input"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !looksLikeEmail(searchQuery)}
              className="h-12 shrink-0 rounded-[14px] bg-fill px-4 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="partner-search-submit"
            >
              Find
            </button>
          </div>
        </form>

        {/* Search Results */}
        {isSearching && (
          <p className="mt-4 animate-pulse text-center text-sm text-muted">Searching...</p>
        )}

        {shownSearch?.status === 'found' && (
          <div
            className="mt-3 flex flex-col divide-y divide-line"
            data-testid="partner-search-results"
          >
            <div className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">
                  {shownSearch.user.displayName ?? shownSearch.user.email}
                </p>
                {shownSearch.user.displayName && (
                  <p className="truncate text-[13px] text-muted">{shownSearch.user.email}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleSendRequest(shownSearch.user.id)}
                className={`${PILL} bg-fill text-white focus-visible:ring-accent`}
                data-testid={`send-request-${shownSearch.user.id}`}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>Send Request</span>
              </button>
            </div>
          </div>
        )}

        {shownSearch?.status === 'taken' && (
          <p
            className="mt-4 text-center text-sm text-muted"
            data-testid="partner-search-taken"
          >
            That account is already connected with a partner.
          </p>
        )}

        {shownSearch?.status === 'missing' && (
          <p
            className="mt-4 text-center text-sm text-muted"
            data-testid="partner-search-empty"
          >
            No account uses that email — check it's the one they sign in with.
          </p>
        )}

        {shownSearch?.status === 'error' && (
          <p
            className="mt-4 text-center text-sm text-danger"
            data-testid="partner-search-error"
          >
            Couldn't search just now. Check your connection and try again.
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
                    {request.other_display_name ?? request.other_email ?? 'Unknown User'}
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
                    {request.other_display_name ?? request.other_email ?? 'Unknown User'}
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
  );
}
