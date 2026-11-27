/**
 * What a saved or fresh day snapshot says about nudges, read in one place
 * (architecture AD-16, AD-17).
 *
 * A partner can be nudged about a daily question from two places, each once per
 * question: the prompt right after an answer (`prompt`) and the waiting card's
 * Nudge button (`button`). The server's answer carries `nudges { prompt_sent,
 * button_sent, closes_at }`. A day saved by the build before story 11.1 carries
 * the old `nudge { slot, spent }` instead, read by slot with the owner's decided
 * mapping (story 11.1, criteria 19 and 23), which is not a record of which
 * control was tapped (the old slot followed the sender's clock): `after_pick` is
 * read as the prompt and `evening` as the button, with no closing instant (so an
 * unsent button on such a day stays hidden until the server answers for that day).
 *
 * @module services/dailyNudges
 */

import type { DailyDaySnapshot } from '../api/validation/dailyQuestionSchemas';

export type NudgeSource = 'prompt' | 'button';

export interface NudgeState {
  promptSent: boolean;
  buttonSent: boolean;
  /**
   * The instant the question stops taking nudges, an ISO timestamp with an
   * offset, or null when the server gave none (no nudge could be offered, or the
   * day was saved by the build before story 11.1).
   */
  closesAt: string | null;
}

const NO_NUDGES: NudgeState = { promptSent: false, buttonSent: false, closesAt: null };

/** The nudge state of `snapshot`: from `nudges`, else from the legacy `nudge` by slot. */
export function nudgeState(snapshot: DailyDaySnapshot | null | undefined): NudgeState {
  if (!snapshot) return NO_NUDGES;
  if (snapshot.nudges) {
    return {
      promptSent: snapshot.nudges.prompt_sent,
      buttonSent: snapshot.nudges.button_sent,
      closesAt: snapshot.nudges.closes_at,
    };
  }
  const legacy = snapshot.nudge;
  if (!legacy?.spent) return NO_NUDGES;
  return {
    promptSent: legacy.slot === 'after_pick',
    buttonSent: legacy.slot === 'evening',
    closesAt: null,
  };
}

/** Whether `source`'s nudge is on record in `state`. */
export function isNudgeSent(state: NudgeState, source: NudgeSource): boolean {
  return source === 'prompt' ? state.promptSent : state.buttonSent;
}

/**
 * Whether `closesAt` has passed at `now` (milliseconds). A null or unreadable
 * instant has not: nothing then offers a nudge anyway, and a bad value must not
 * hide a sent button.
 */
export function hasNudgeClosed(closesAt: string | null, now: number): boolean {
  if (closesAt === null) return false;
  const at = Date.parse(closesAt);
  return Number.isFinite(at) && now >= at;
}

/** `snapshot` with `source`'s nudge marked sent, keeping the closing instant. */
export function withNudgeSent(snapshot: DailyDaySnapshot, source: NudgeSource): DailyDaySnapshot {
  const state = nudgeState(snapshot);
  return {
    ...snapshot,
    nudges: {
      prompt_sent: state.promptSent || source === 'prompt',
      button_sent: state.buttonSent || source === 'button',
      closes_at: state.closesAt,
    },
  };
}

/**
 * `entry`, with each source's nudge sent when `other` (the same day) has it
 * sent: a nudge once sent stays sent, so a read that started before the send
 * cannot enable its control or offer its prompt again, and a day saved by the
 * build before story 11.1 is read by slot like the server's own rows. The
 * closing instant is `entry`'s, or `other`'s when `entry` carries no `nudges`
 * (a saved legacy day kept over a newer answer).
 */
export function keepNudgesSent(
  entry: DailyDaySnapshot,
  other: DailyDaySnapshot | undefined
): DailyDaySnapshot {
  if (!other) return entry;
  const mine = nudgeState(entry);
  const theirs = nudgeState(other);
  const promptSent = mine.promptSent || theirs.promptSent;
  const buttonSent = mine.buttonSent || theirs.buttonSent;
  const closesAt = entry.nudges ? mine.closesAt : (theirs.closesAt ?? mine.closesAt);
  if (
    entry.nudges
      ? entry.nudges.prompt_sent === promptSent &&
        entry.nudges.button_sent === buttonSent &&
        entry.nudges.closes_at === closesAt
      : promptSent === mine.promptSent && buttonSent === mine.buttonSent && closesAt === mine.closesAt
  ) {
    return entry;
  }
  return {
    ...entry,
    nudges: { prompt_sent: promptSent, button_sent: buttonSent, closes_at: closesAt },
  };
}
