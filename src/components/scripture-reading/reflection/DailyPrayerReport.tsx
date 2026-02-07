/**
 * DailyPrayerReport — Presentational component for daily prayer report display
 *
 * Story 2.3: Daily Prayer Report — Send & View (AC: #3, #4, #5)
 *
 * Features:
 * - User's step-by-step ratings with bookmark indicators
 * - Standout verse selections as read-only chips
 * - Partner message reveal (Dancing Script font)
 * - Waiting state for incomplete partner
 * - Side-by-side partner ratings when available
 * - Return to Overview button
 */

import type { ReactElement } from 'react';
import { SCRIPTURE_STEPS } from '../../../data/scriptureSteps';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2';

interface StepRating {
  stepIndex: number;
  rating: number;
}

interface DailyPrayerReportProps {
  userRatings: StepRating[];
  userBookmarks: number[];
  userStandoutVerses: number[];
  partnerMessage: string | null;
  partnerName: string | null;
  partnerRatings: StepRating[] | null;
  isPartnerComplete: boolean;
  onReturn: () => void;
}

export function DailyPrayerReport({
  userRatings,
  userBookmarks,
  userStandoutVerses,
  partnerMessage,
  partnerName,
  partnerRatings,
  isPartnerComplete,
  onReturn,
}: DailyPrayerReportProps): ReactElement {
  const bookmarkSet = new Set(userBookmarks);

  // Build a map of stepIndex → rating for quick lookup
  const userRatingMap = new Map(userRatings.map((r) => [r.stepIndex, r.rating]));
  const partnerRatingMap = partnerRatings
    ? new Map(partnerRatings.map((r) => [r.stepIndex, r.rating]))
    : null;

  return (
    <div
      className="flex w-full flex-col space-y-6"
      data-testid="scripture-report-screen"
    >
      {/* Report heading */}
      <h2
        className="text-center font-serif text-2xl font-bold text-purple-900"
        data-testid="scripture-report-heading"
        tabIndex={-1}
      >
        Daily Prayer Report
      </h2>

      {/* Your Reflections section */}
      <div data-testid="scripture-report-user-ratings">
        <h3 className="mb-3 text-center text-sm font-medium text-purple-700">
          Your Reflections
        </h3>
        <div className="space-y-1">
          {SCRIPTURE_STEPS.map((step) => {
            const rating = userRatingMap.get(step.stepIndex);
            const isBookmarked = bookmarkSet.has(step.stepIndex);
            const partnerRating = partnerRatingMap?.get(step.stepIndex);

            return (
              <div
                key={step.stepIndex}
                className="flex items-center justify-between rounded-lg px-3 py-1.5"
                data-testid={`scripture-report-rating-step-${step.stepIndex}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-purple-800">{step.verseReference}</span>
                  {isBookmarked && (
                    <span
                      className="text-amber-500"
                      data-testid={`scripture-report-bookmark-indicator-${step.stepIndex}`}
                      aria-label="Bookmarked"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* User rating circle */}
                  {rating != null && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-purple-500 bg-purple-500 text-xs font-semibold text-white">
                      {rating}
                    </span>
                  )}
                  {/* Partner rating (side-by-side) */}
                  {partnerRating != null && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-purple-300 bg-purple-100 text-xs font-semibold text-purple-700">
                      {partnerRating}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Standout Verses section */}
      <div data-testid="scripture-report-standout-verses">
        <h3 className="mb-3 text-center text-sm font-medium text-purple-700">
          Verses That Stood Out
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          {userStandoutVerses.map((stepIndex) => {
            const step = SCRIPTURE_STEPS[stepIndex];
            return (
              <span
                key={stepIndex}
                className="rounded-full border-2 border-purple-500 bg-purple-500 px-4 py-2 text-sm font-medium text-white"
              >
                {step?.verseReference ?? `Verse ${stepIndex + 1}`}
              </span>
            );
          })}
        </div>
      </div>

      {/* Partner Message section */}
      {partnerMessage && partnerName && (
        <div
          className="font-cursive rounded-2xl border border-purple-200 bg-purple-50 p-6"
          data-testid="scripture-report-partner-message"
        >
          <p className="mb-2 font-sans text-sm text-purple-500">
            A message from {partnerName}
          </p>
          <p className="text-lg font-normal leading-relaxed text-purple-900">
            {partnerMessage}
          </p>
        </div>
      )}

      {/* Waiting for partner */}
      {partnerName && !isPartnerComplete && !partnerMessage && (
        <p
          className="animate-pulse text-center text-sm italic text-purple-400"
          data-testid="scripture-report-partner-waiting"
          aria-live="polite"
        >
          Waiting for {partnerName}&apos;s reflections
        </p>
      )}

      {/* Return to Overview */}
      <button
        type="button"
        onClick={onReturn}
        data-testid="scripture-report-return-btn"
        className={`min-h-[56px] w-full rounded-2xl bg-linear-to-r from-purple-500 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 ${FOCUS_RING}`}
      >
        Return to Overview
      </button>
    </div>
  );
}
