/**
 * PastQuestionsPage -- every past question of the couple, at `/partner/history`.
 *
 * A page of the Partner view (`partnerPath` `'history'`), not a view of its own,
 * so the dock keeps Partner lit. It has its own sticky bar with a back arrow in
 * place of the app header (the App hides the header for it, as for Settings),
 * the title, the streak's "Same pick on {same} of your {done} days" (only with an
 * `ok` streak; the counts are the server's) and a card with every day both
 * partners picked, newest first: the question, its date, the two picks and the
 * server's own Same or Different (`snapshot.same`). A sentinel after the last
 * row, watched by an `IntersectionObserver` with a 600px margin, asks the slice
 * for the next page (`loadMoreDailyHistory`) as the list nears its end.
 *
 * Back runs `history.back()` when the app created the entry; on a page a fresh
 * load opened it replaces the entry with `/partner` instead of leaving the app.
 * It sits inside `<main>`, so it inherits `--dock-clearance` and
 * `--dock-left`/`--dock-right`; its glass reaches under the side column as the
 * app header's does.
 *
 * @component
 */

import { Check, ChevronLeft, Heart } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { CoupleStreak, DailyDaySnapshot } from '../../api/dailyQuestionApi';
import { parseEventDate } from '../../services/eventsService';
import { replaceWithPartnerTop } from '../../stores/slices/navigationSlice';
import { useAppStore } from '../../stores/useAppStore';
import { NetworkStatusIndicator } from '../shared';

type ShownDay = DailyDaySnapshot & {
  my_choice: NonNullable<DailyDaySnapshot['my_choice']>;
  partner_choice: NonNullable<DailyDaySnapshot['partner_choice']>;
};

function isShown(day: DailyDaySnapshot): day is ShownDay {
  return day.state === 'both' && day.my_choice !== null && day.partner_choice !== null;
}

/** `Wed, Nov 4`, with `, 2025` when the year is not the current one. */
function formatDay(day: string): string {
  const date = parseEventDate(day);
  if (!date) return day;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

interface PastQuestionsPageProps {
  partnerName: string;
  history: DailyDaySnapshot[];
  /** The couple's streak, when it was read; the summary needs it. */
  streak: CoupleStreak | null;
}

export function PastQuestionsPage({ partnerName, history, streak }: PastQuestionsPageProps) {
  const showPartnerPage = useAppStore((state) => state.showPartnerPage);
  const loadMoreDailyHistory = useAppStore((state) => state.loadMoreDailyHistory);
  const dailyHistoryEnd = useAppStore((state) => state.dailyHistoryEnd);
  const dailyHistoryLoading = useAppStore((state) => state.dailyHistoryLoading);
  const dailyHistoryError = useAppStore((state) => state.dailyHistoryError);
  const dailyHistoryErrorOffline = useAppStore((state) => state.dailyHistoryErrorOffline);
  const isOnline = useAppStore((state) => state.syncStatus.isOnline);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const days = history.filter(isShown);

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, []);

  // Re-observed whenever the rows change (a sentinel still in view after a page
  // landed reports again and loads the next one) and when the device comes back
  // online (a "more" that failed offline is tried again).
  const rowCount = days.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || dailyHistoryEnd || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMoreDailyHistory();
      },
      { rootMargin: '0px 0px 600px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [rowCount, dailyHistoryEnd, isOnline, loadMoreDailyHistory]);

  const goBack = () => {
    if (window.history.state?.inApp === true) {
      window.history.back();
      return;
    }
    replaceWithPartnerTop();
    showPartnerPage('');
  };

  return (
    <div data-testid="partner-history">
      <div className="safe-top sticky top-0 z-30" data-testid="partner-history-bar">
        <div className="h-16" />
        {/* The glass reaches up behind the status bar and out under the side column. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 -right-(--dock-right) -left-(--dock-left) h-[calc(4rem+env(safe-area-inset-top))] border-b border-line bg-glass backdrop-blur-lg"
        />
        <div className="absolute inset-x-0 top-[env(safe-area-inset-top)] mx-auto flex h-16 max-w-2xl items-center px-2">
          <button
            type="button"
            onClick={goBack}
            aria-label={`Back to ${partnerName}`}
            data-testid="partner-history-back"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-ink focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronLeft className="h-[22px] w-[22px]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Under the bar: with no app header above, the banner would sit under the status bar. */}
      <NetworkStatusIndicator showOnlyWhenOffline />

      <div className="mx-auto flex max-w-2xl flex-col gap-3.5 px-4 pt-1 pb-6">
        <div className="flex flex-col gap-1 px-1">
          <h1
            className="font-serif text-[30px] leading-[1.1] font-semibold text-ink"
            data-testid="partner-history-title"
          >
            Past questions
          </h1>
          {streak && (
            <p className="text-sm text-muted" data-testid="partner-history-summary">
              Same pick on {streak.same} of your {streak.done} {streak.done === 1 ? 'day' : 'days'}
            </p>
          )}
        </div>

        {days.length === 0 && dailyHistoryLoading && (
          <div
            className="flex flex-col items-center gap-3 rounded-[20px] border border-line bg-card px-5 py-10 text-center shadow-card"
            data-testid="partner-history-loading"
          >
            <Heart className="h-8 w-8 animate-pulse fill-current text-accent" aria-hidden="true" />
            <p className="text-sm text-muted">Loading your past questions...</p>
          </div>
        )}

        {days.length > 0 && (
          <div className="rounded-[20px] border border-line bg-card px-3.5 shadow-card">
            {days.map((day) => {
              const same = day.same === true;
              return (
                <div
                  key={day.day_id}
                  className="flex flex-col gap-1.5 border-b border-line px-0.5 py-3 last:border-b-0"
                  data-testid="partner-history-row"
                  data-same={same ? 'true' : 'false'}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="min-w-0 text-[15px] font-semibold text-ink"
                      data-testid="partner-history-question"
                    >
                      {day.question.this} or {day.question.that}?
                    </span>
                    <span
                      className="shrink-0 text-xs text-muted"
                      data-testid="partner-history-date"
                    >
                      {formatDay(day.day)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-flex h-[26px] items-center rounded-full bg-tint px-2.5 text-xs font-semibold text-accent"
                      data-testid="partner-history-mine"
                    >
                      You: {day.question[day.my_choice]}
                    </span>
                    <span
                      className="inline-flex h-[26px] items-center rounded-full bg-ptint px-2.5 text-xs font-semibold text-partner"
                      data-testid="partner-history-theirs"
                    >
                      {partnerName}: {day.question[day.partner_choice]}
                    </span>
                    {same ? (
                      <span
                        className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-good"
                        data-testid="partner-history-mark"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Same
                      </span>
                    ) : (
                      <span
                        className="ml-auto text-xs font-semibold text-muted"
                        data-testid="partner-history-mark"
                      >
                        Different
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* A failed read: above an empty list, or under the rows unless it was the
            offline refusal; those rows stay valid and the banner says why. */}
        {dailyHistoryError && (days.length === 0 ? !dailyHistoryLoading : !dailyHistoryErrorOffline) && (
          <div
            className="rounded-[20px] bg-dtint px-4 py-3 text-sm font-medium text-danger"
            data-testid="partner-history-error"
          >
            {dailyHistoryError}
          </div>
        )}

        <div ref={sentinelRef} aria-hidden="true" className="h-px" data-testid="partner-history-sentinel" />
      </div>
    </div>
  );
}
