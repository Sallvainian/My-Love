/**
 * The line a failed nudge shows, shared by the waiting card and `NudgeSheet`.
 * Kept out of the component files so `react-refresh/only-export-components`
 * stays satisfied.
 */

import { NUDGE_FAILED_MESSAGE } from '../../api/dailyQuestionApi';
import { AccountDataError } from '../../services/accountDataError';

/**
 * The offline error's own sentence, else the fixed `NUDGE_FAILED_MESSAGE`
 * (the failure is logged).
 */
export function nudgeFailureMessage(caught: unknown): string {
  if (caught instanceof AccountDataError && caught.code === 'offline') return caught.message;
  console.error('[DailyQuestion] Could not send the nudge:', caught);
  return NUDGE_FAILED_MESSAGE;
}
