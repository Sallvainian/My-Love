/**
 * PastQuestionsCard -- the couple's latest answered questions on the Partner page.
 *
 * Shows what `get_daily_history` answered and computes nothing: the three newest
 * days that both partners picked, each as `{this} or {that}?`, the two option
 * texts the pair chose (mine first) and the server's own Same or Different
 * (`snapshot.same`). A day without both choices is skipped, and the section
 * renders nothing when no day qualifies. The label row's "See all" opens the
 * Past questions page (`/partner/history`, `PastQuestionsPage`) through
 * `openPartnerPage('history')`.
 *
 * @component
 */

import { Check } from 'lucide-react';
import type { DailyDaySnapshot } from '../../api/dailyQuestionApi';
import { useAppStore } from '../../stores/useAppStore';

/** How many days the card shows. */
const SHOWN_DAYS = 3;

type ShownDay = DailyDaySnapshot & {
  my_choice: NonNullable<DailyDaySnapshot['my_choice']>;
  partner_choice: NonNullable<DailyDaySnapshot['partner_choice']>;
};

function isShown(day: DailyDaySnapshot): day is ShownDay {
  return day.state === 'both' && day.my_choice !== null && day.partner_choice !== null;
}

export function PastQuestionsCard({ history }: { history: DailyDaySnapshot[] }) {
  const openPartnerPage = useAppStore((state) => state.openPartnerPage);
  const days = history.filter(isShown).slice(0, SHOWN_DAYS);
  if (days.length === 0) return null;

  return (
    <section className="flex flex-col gap-1.5" data-testid="partner-past-questions">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold tracking-[.08em] text-muted uppercase">
          Past questions
        </p>
        <button
          type="button"
          onClick={() => openPartnerPage('history')}
          className="-my-1 flex min-h-11 items-center rounded-full px-1 text-[13px] font-semibold text-accent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="partner-past-questions-see-all"
        >
          See all
        </button>
      </div>
      <div className="rounded-[20px] border border-line bg-card px-3.5 shadow-card">
        {days.map((day) => {
          const same = day.same === true;
          return (
            <div
              key={day.day_id}
              className="flex items-center gap-2 border-b border-line px-0.5 py-[11px] text-sm last:border-b-0"
              data-testid="partner-past-question"
              data-same={same ? 'true' : 'false'}
            >
              <span
                className="min-w-0 flex-1 font-semibold text-ink"
                data-testid="partner-past-question-text"
              >
                {day.question.this} or {day.question.that}?
              </span>
              <span
                className="text-xs font-semibold text-muted"
                data-testid="partner-past-question-picks"
              >
                {day.question[day.my_choice]} · {day.question[day.partner_choice]}
              </span>
              {same ? (
                <span
                  className="inline-flex w-[62px] items-center justify-end gap-[3px] text-xs font-semibold text-good"
                  data-testid="partner-past-question-mark"
                >
                  <Check className="h-[13px] w-[13px]" aria-hidden="true" />
                  Same
                </span>
              ) : (
                <span
                  className="w-[62px] text-right text-xs font-semibold text-muted"
                  data-testid="partner-past-question-mark"
                >
                  Different
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
