/**
 * PartnerView -- the Partner page (`/partner`).
 *
 * Shows the couple's streak in place of the partner's moods. States, in order:
 *   - the partner is loading: a loading block;
 *   - no partner and the read failed (or offline with no saved copy):
 *     `PartnerLoadError`, never the Connect UI;
 *   - no partner, nothing failed: `PartnerConnect` alone (search, requests,
 *     linking), whatever the slice holds for the streak;
 *   - a partner: their name, then the streak card, then (when the history holds
 *     a day both partners picked) the Past questions card.
 *
 * The streak is read when a partner is present (keyed on the partner's id) and
 * kept current by `usePartnerStreakListener`. The slice shows the saved
 * `daily-streak` copy first, so the card stays up offline and after a failed
 * read, and its local-copy refresher reads the streak again on signed-in start
 * and on `online`. The past questions are read in the same effect, so on the
 * same keys, and have no saved copy: the card shows what the last successful
 * read held and hides when it holds nothing. The old mood view
 * (`PartnerMoodView`) is no longer routed; its code stays for epic 10.
 *
 * @component
 */

import { Heart } from 'lucide-react';
import { useEffect, useLayoutEffect } from 'react';
import { usePartnerStreakListener } from '../../hooks/usePartnerStreakListener';
import { useAppStore } from '../../stores/useAppStore';
import { PartnerConnect } from './PartnerConnect';
import { PartnerLoadError } from './PartnerLoadError';
import { PastQuestionsCard } from './PastQuestionsCard';
import { StreakCard } from './StreakCard';

export function PartnerView() {
  const partner = useAppStore((state) => state.partner);
  const isLoadingPartner = useAppStore((state) => state.isLoadingPartner);
  const partnerLoadError = useAppStore((state) => state.partnerLoadError);
  const isOnline = useAppStore((state) => state.syncStatus.isOnline);
  const loadPartner = useAppStore((state) => state.loadPartner);
  const loadPendingRequests = useAppStore((state) => state.loadPendingRequests);
  const coupleStreak = useAppStore((state) => state.coupleStreak);
  const coupleStreakLoading = useAppStore((state) => state.coupleStreakLoading);
  const coupleStreakError = useAppStore((state) => state.coupleStreakError);
  const loadCoupleStreak = useAppStore((state) => state.loadCoupleStreak);
  const dailyHistory = useAppStore((state) => state.dailyHistory);
  const loadDailyHistory = useAppStore((state) => state.loadDailyHistory);

  usePartnerStreakListener();

  // The partner loads online or offline: it shows the saved copy at once and
  // refreshes it from the server only when online. A layout effect so the
  // loading flag loadPartner raises synchronously lands before first paint; a
  // passive effect painted one frame of the Connect UI over a linked user while
  // the saved copy was still being read.
  useLayoutEffect(() => {
    void loadPartner();
  }, [loadPartner]);

  // Pending requests have no saved copy; they stay online-only.
  useEffect(() => {
    if (isOnline) {
      void loadPendingRequests();
    }
  }, [isOnline, loadPendingRequests]);

  // The streak and the past questions are read once a partner is present, and
  // again for a new partner. loadCoupleStreak shows the saved `daily-streak`
  // copy first; offline the read refuses and what is shown (the copy, if any)
  // stays. They are read offline too (not gated), and again when the device
  // comes back online. The history has no copy, so offline it shows only what
  // an earlier read in this session left.
  const partnerId = partner?.id ?? null;
  useEffect(() => {
    if (partnerId) {
      void loadCoupleStreak();
      void loadDailyHistory();
    }
  }, [partnerId, isOnline, loadCoupleStreak, loadDailyHistory]);

  const streak = coupleStreak?.status === 'ok' ? coupleStreak.streak : null;

  return (
    <div className="min-h-screen bg-page" data-testid="partner-view">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-3 pb-6">
        {isLoadingPartner && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Heart className="h-9 w-9 animate-pulse fill-current text-accent" aria-hidden="true" />
            <p className="text-sm text-muted">Loading partner information...</p>
          </div>
        )}

        {/* The partner could not be determined (read failed or offline, and no
            saved copy). Never the Connect UI: that is for a server-confirmed
            "unlinked" only. */}
        {!partner && !isLoadingPartner && partnerLoadError && (
          <PartnerLoadError isOnline={isOnline} onRetry={() => void loadPartner()} />
        )}

        {!partner && !isLoadingPartner && !partnerLoadError && <PartnerConnect />}

        {partner && !isLoadingPartner && (
          <>
            <header className="px-1 pt-1">
              <h1 className="font-serif text-[30px] leading-[1.1] font-semibold wrap-break-word text-ink">
                {partner.displayName}
              </h1>
            </header>

            {streak ? (
              <StreakCard streak={streak} />
            ) : coupleStreakLoading ? (
              <div
                className="flex flex-col items-center gap-3 rounded-[20px] border border-line bg-card px-5 py-10 text-center shadow-card"
                data-testid="partner-streak-loading"
              >
                <Heart
                  className="h-8 w-8 animate-pulse fill-current text-accent"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted">Loading your streak...</p>
              </div>
            ) : coupleStreakError ? (
              <div
                className="rounded-[20px] bg-dtint px-4 py-3 text-sm font-medium text-danger"
                data-testid="partner-streak-error"
              >
                {coupleStreakError}
              </div>
            ) : null}

            {dailyHistory && dailyHistory.length > 0 && <PastQuestionsCard history={dailyHistory} />}
          </>
        )}
      </div>
    </div>
  );
}
