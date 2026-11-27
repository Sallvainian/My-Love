/**
 * The line a failed nudge shows, shared by the waiting card and `NudgeSheet`
 * through `useNudgeSend`. Kept out of the component files so
 * `react-refresh/only-export-components` stays satisfied.
 */

import { NUDGE_FAILED_MESSAGE, NUDGE_UNCHECKED_MESSAGE } from '../../api/dailyQuestionApi';
import { AccountDataError } from '../../services/accountDataError';
import type { NudgeSendOutcome } from '../../stores/slices/dailyDaySlice';

/**
 * The offline error's own sentence, else the fixed `NUDGE_FAILED_MESSAGE`
 * (the failure is logged).
 */
export function nudgeFailureMessage(caught: unknown): string {
  if (caught instanceof AccountDataError && caught.code === 'offline') return caught.message;
  console.error('[DailyQuestion] Could not send the nudge:', caught);
  return NUDGE_FAILED_MESSAGE;
}

/**
 * The line a send that did not end as sent shows: "Your nudge could not be
 * sent." when the server refused it or a re-read found none, and "We couldn't
 * check if your nudge went through. Try again?" when the answer was lost and
 * the re-read failed too (DW-539).
 */
export function nudgeOutcomeMessage(outcome: Exclude<NudgeSendOutcome, 'sent'>): string {
  return outcome === 'unchecked' ? NUDGE_UNCHECKED_MESSAGE : NUDGE_FAILED_MESSAGE;
}
