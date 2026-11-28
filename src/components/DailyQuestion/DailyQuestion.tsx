/**
 * Daily Question — today's this-or-that question for the couple.
 *
 * Reads `dailyDay` from `dailyDaySlice`; every projection (state, the
 * partner's choice, Same/Different) comes from the server snapshot, and the
 * view shows the partner's choice only when the snapshot carries it. `unlinked`
 * renders no question and no pick control, only the invitation to link (Go to
 * Partner); a failed load never does. The slice shows the account's saved day
 * first, so a day seen earlier stays on screen offline. A pick made offline is
 * queued (`dailyQueuedPicks`): while its row is pending the card shows it as
 * the own pick with no options, never as a reveal, and the server's own pick
 * (`me`/`both`) always wins over it; a refused row (`failed`) gives the options
 * back beside the reason. A normal page inside `<main>`, so it gets the dock
 * clearance and side padding from there.
 *
 * The day's writer is asked to write tomorrow's question (AD-4, AD-13): a
 * bottom sheet (`WriteQuestionSheet`) opens while the snapshot on screen holds
 * the account's own server pick (`my_choice`, so a queued pick never opens it),
 * `write.mine` is true and `write.done` false, the day is not in
 * `dailyWriteDeclined`, and the snapshot's `day` is the device's date, once the
 * server has answered in this mount for that very day (the saved day shown
 * first may be out of date). A tap on its scrim or Escape hides it until the
 * next mount of this view; only a successful send (`write.done`) or "No
 * thanks" ends it for the day.
 *
 * The couple's streak shows above the card from the slice's `coupleStreak`
 * (`get_couple_streak`; nothing is counted here, only the sentence chosen): a
 * header with the snapshot's date and, when the streak is `ok`, a chip (held,
 * with `Flame`, or `Snowflake` when blue; "{run} in a row" under it), the week
 * strip shared with the Partner card, and, while `today_state` is blue, a cold
 * banner that says how many dates were missed. Once only the own pick is in
 * (`me`), a sentence says the streak lights up when the partner answers. A
 * streak that is null, unlinked or failed to load shows none of these and
 * reports no error here; the view re-reads it on each mount.
 *
 * The streak's +1 (R4): for each `ok` streak shown, saved or fresh, the view
 * claims a celebration (`claimStreakCelebration`, the device-state
 * `daily-celebrated` kind). A claim whose held total is above the one this
 * device last celebrated has already stored it, and answers `play`: the
 * full-screen `StreakUp` shows over the view until its button closes it, so a
 * reload or a second tab never replays it. A claim is not cancelled by a
 * re-render, only by unmount, because it has already written, and is made only
 * after this mount's own read of the day has answered, so a mount that a dock
 * walk through Home unmounts at once claims nothing, and while no read of the
 * streak is in flight; the overlay belongs to the
 * session that raised it. The write sheet waits while the overlay
 * shows. Only Daily claims: the Partner page shows the count without playing it.
 *
 * The milestone (R5): when the same claim also says `milestone` (the streak's
 * milestone count is above the one this device last showed), the +1's button
 * opens the full-screen `Milestone` screen instead of closing; its Continue and
 * Close both close it, revealing the card. The write sheet waits behind both
 * stages. The count is stored as shown only as that screen comes up
 * (`claimStreakMilestone`), so a +1 cut short, by a reload or by leaving Daily,
 * leaves the milestone owed: it shows by itself the next time Daily opens, and
 * the +1 is not replayed. Only a +1 claimed before this mount's first claim
 * counts as cut short; one claimed since, by another tab, may still be playing
 * there. A milestone that showed never shows again.
 * Once only the own pick is in (`me`), the card below the day card is the board's
 * dashed waiting card (`WaitingCard`, test id `daily-waiting`, "Waiting on
 * {partner}") with a Nudge button (AD-17). The button is the second of the two
 * places a nudge is sent from, each once per question: it follows
 * `nudgeState(snapshot)` (`services/dailyNudges.ts`), enabled while its own
 * nudge is unsent and the question still takes nudges (`closesAt` set and not
 * passed), greyed once it is sent (grey always means sent) and hidden when it
 * was never sent and cannot be: after `closesAt`, or on a day saved by the
 * build before this one, which has no closing instant, until the server answers
 * for it. `useNudgeClosed` flips it at `closesAt` with no re-read. Both controls
 * send through `useNudgeSend`: a refusal or a re-read that found no nudge shows
 * `NUDGE_FAILED_MESSAGE`, a lost answer whose re-read failed too shows
 * `NUDGE_UNCHECKED_MESSAGE`, an "already sent" refusal ends as a sent nudge, and
 * offline a tap shows the offline sentence with no request. `useDailyDayRereads`
 * re-reads the day when the page comes back to the front.
 *
 * The nudge prompt (R1): once an answer is confirmed, `NudgeSheet` ("Do you want
 * to nudge your partner?") opens once, when the day on screen is that day in
 * state `me`, the snapshot's `closesAt` is set and not passed, and the prompt's
 * own nudge is unsent. A confirmation is the in-view Send my pick answering, or a
 * queued pick confirmed while this view is mounted (`dailyQueuedPickSent`
 * changing; the value found at mount is ignored, so an answer sent while Daily
 * was closed is never offered later). The offer is state of this mount, so a
 * reload, a remount or an account switch offers nothing, and Not now, the scrim
 * and Escape end it for the question while the waiting card's button stays. It
 * waits behind the +1/milestone overlays, this mount's first read and the write
 * sheet, however the write sheet closes (a send, "No thanks", the scrim or
 * Escape), and is dropped when the partner answers (their `daily_pick`, or any
 * re-read that leaves the state `me`) and at `closesAt`.
 * The write sheet opens only once the server has answered for the shown day in
 * this mount: any answer the store shows after the mount counts (`dailyDayAnswers`
 * has grown since it), whether a read, a re-read, the pick's own confirmation or
 * a refresh, and only when that answer was for the day on screen
 * (`dailyDayAnsweredId`), so a saved day that replaces it after midnight waits
 * for its own answer. A failed or offline read alone never opens it (DW-491).
 * The day-changed notice is dropped for good once the shown day offers no Send
 * or the pair is unlinked (DW-496), and the cold banner names a missed date
 * that is not yesterday by its weekday (DW-515).
 * After a write sheet's send in this mount, when the shown day's
 * `write.target_day` is not the date the sheet named as Send was tapped (the
 * partner whose clock is ahead opened that date, or another written question
 * took it, while the sheet was open), one line names the real day ("{partner}
 * gets it on Sunday."): inside the nudge prompt while it is open, and at the
 * top of the page when no prompt follows or once it has closed; it
 * belongs to the session and the day it was written from (DW-498).
 * The root carries `data-streak-claimed` (the held total of the last claim this
 * mount has had answered, whether or not it played), so a test can wait for the
 * answer before asserting that no overlay came.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Flame, Hourglass, Snowflake } from 'lucide-react';
import {
  type CoupleStreak,
  DAY_CHANGED_MESSAGE,
  type DailyChoice,
  type DailyDayAnswer,
  type DailyDaySnapshot,
} from '../../api/dailyQuestionApi';
import { isOnline } from '../../api/errorHandlers';
import { useDailyDayRereads } from '../../hooks/useDailyDayRereads';
import { useDailyPickListener } from '../../hooks/useDailyPickListener';
import { AccountDataError } from '../../services/accountDataError';
import { nudgeState } from '../../services/dailyNudges';
import { parseEventDate } from '../../services/eventsService';
import type { QueuedDailyPick } from '../../stores/slices/dailyDaySlice';
import { useAppStore } from '../../stores/useAppStore';
import { formatDateISO } from '../../utils/dateUtils';
import { CARD, FAILURE_BOX, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../shared/kitClasses';
import { StreakRow } from '../shared/StreakWeek';
import { Milestone } from './Milestone';
import { NudgeSheet } from './NudgeSheet';
import { StreakUp } from './StreakUp';
import { useNudgeClosed, useNudgeSend } from './useNudgeSend';
import { partnerGetsIt } from './writeDay';
import { WriteQuestionSheet } from './WriteQuestionSheet';

const OPTION =
  'flex min-h-12 w-full items-center justify-center rounded-[14px] px-4 py-3 text-base font-semibold wrap-break-word transition-opacity focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';
const OPTION_OFF = `${OPTION} bg-tint text-accent`;
const OPTION_ON = `${OPTION} bg-fill text-white`;

function pickedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** The chip's classes by `today_state`: grey and orange hold a flame, blue a snowflake. */
const CHIP_TONE: Record<CoupleStreak['today_state'], string> = {
  grey: 'bg-ash-tint text-ash-ink',
  orange: 'bg-fire-tint text-fire-ink',
  blue: 'bg-cold-tint text-cold-ink',
};

/** "Thursday, November 5" for a `YYYY-MM-DD` date, read as local (never UTC). */
function longDate(day: string): string {
  const date = parseEventDate(day);
  return date
    ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';
}

function StreakHeader({
  day,
  streak,
}: {
  day: string;
  /** The streak when `get_couple_streak` answered `ok`, else null. */
  streak: CoupleStreak | null;
}) {
  const Icon = streak?.today_state === 'blue' ? Snowflake : Flame;
  return (
    <div className="flex items-start justify-between gap-3 px-1" data-testid="daily-header">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-semibold text-accent">Today&apos;s question</p>
        <p className="text-[13px] leading-[1.4] text-muted" data-testid="daily-date">
          {longDate(day)}
        </p>
      </div>
      {streak && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${CHIP_TONE[streak.today_state]}`}
            data-testid="daily-streak-chip"
            data-state={streak.today_state}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span data-testid="daily-streak-held">{streak.held}</span>
          </span>
          <p className="text-xs font-semibold text-muted" data-testid="daily-streak-run">
            {streak.run} in a row
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The opening words of the cold banner (DW-515). The streak's `week` ends with
 * the viewer's date, so the entry before the last one is yesterday. A date
 * closes only after both partners' midnights, so the missed date can be the day
 * before yesterday; the words name it then:
 *   - one missed date: "Yesterday was", or the weekday of the newest missed
 *     date in `week` ("Tuesday was");
 *   - several: "The last {n} days were" while yesterday is among the missed
 *     dates, "{n} days were" otherwise.
 * With no missed date in `week` to name (or one that does not parse), the
 * count alone decides, as before.
 */
function coldBannerWords(streak: CoupleStreak): string {
  const { week, missed } = streak;
  const newestMissed = [...week].reverse().find((entry) => entry.state === 'missed');
  const yesterday = week.length >= 2 ? week[week.length - 2] : undefined;
  const yesterdayMissed = yesterday?.state === 'missed';
  if (missed === 1) {
    if (!newestMissed || newestMissed === yesterday) return 'Yesterday was';
    const date = parseEventDate(newestMissed.day);
    return date
      ? `${date.toLocaleDateString('en-US', { weekday: 'long' })} was`
      : 'Yesterday was';
  }
  if (!newestMissed || yesterdayMissed) return `The last ${missed} days were`;
  return `${missed} days were`;
}

function ColdBanner({ streak }: { streak: CoupleStreak }) {
  const missed = coldBannerWords(streak);
  return (
    <div
      className="flex flex-col gap-1 rounded-[20px] bg-cold-tint p-4 text-cold-ink"
      data-testid="daily-streak-cold"
    >
      <p className="text-[15px] font-bold">Your streak went cold</p>
      <p className="text-[13px] leading-[1.4]">
        {missed} missed, so it&apos;s frozen at {streak.held}. You keep the {streak.held}. Both
        answer today to light it back up.
      </p>
    </div>
  );
}

function PickCard({
  label,
  text,
  testId,
}: {
  label: string;
  text: string;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] bg-card2 p-3">
      <span className="text-xs font-semibold tracking-[.08em] text-muted uppercase">{label}</span>
      <span className="text-base font-semibold text-ink" data-testid={testId}>
        {text}
      </span>
    </div>
  );
}

/**
 * The waiting card (the board's `Waiting.dc.html`): the viewer's pick is in and
 * the partner's is not. Its Nudge button sends the button's one nudge about this
 * question through `useNudgeSend`; the failure box shows the offline sentence or
 * the send's failure line, and clears on the next tap. The button is greyed once
 * its nudge is sent, and hidden (with its failure box) while it is unsent and
 * the question takes no nudge: after `closesAt`, or with no `closesAt` at all.
 */
function WaitingCard({
  snapshot,
  partnerNameInline,
}: {
  snapshot: DailyDaySnapshot;
  /** The partner's name, or "your partner" (for the middle of a sentence). */
  partnerNameInline: string;
}) {
  const { send, busy, error: nudgeError } = useNudgeSend('button');
  const { buttonSent, closesAt } = nudgeState(snapshot);
  const closed = useNudgeClosed(closesAt);
  const offerable = closesAt !== null && !closed;
  const showButton = buttonSent || offerable;

  return (
    <div
      className="flex flex-col items-center gap-2.5 rounded-[20px] border-2 border-dashed border-partner/40 bg-ptint/50 p-[18px] text-center"
      data-testid="daily-waiting"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-ptint text-partner">
        <Hourglass className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-[15px] font-semibold text-ink">Waiting on {partnerNameInline}</p>
      <p className="text-[13px] leading-[1.4] text-muted">
        They can&apos;t see your pick until they make theirs.
      </p>
      {showButton && (
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ptint px-[18px] text-sm font-semibold text-partner transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-partner disabled:cursor-not-allowed disabled:opacity-50"
          disabled={buttonSent || busy}
          data-sent={buttonSent ? 'true' : undefined}
          onClick={() => void send()}
          data-testid="daily-nudge"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          Nudge {partnerNameInline}
        </button>
      )}
      {showButton && nudgeError && (
        <div className={`${FAILURE_BOX} self-stretch`} role="alert" data-testid="daily-nudge-error">
          {nudgeError}
        </div>
      )}
    </div>
  );
}

/** The day takes a pick and the account's queued one for it is still waiting to be sent. */
function hasPendingPick(state: DailyDaySnapshot['state'], queued: QueuedDailyPick | null): boolean {
  return (state === 'none' || state === 'partner') && queued !== null && !queued.failed;
}

/** Whether the day card renders a Send: the day takes a pick and none is queued and waiting. */
function offersSend(state: DailyDaySnapshot['state'], queued: QueuedDailyPick | null): boolean {
  return (state === 'none' || state === 'partner') && !hasPendingPick(state, queued);
}

function DayCard({
  snapshot,
  queued,
  partnerName,
  onSendStart,
  onDayChanged,
  onPickSent,
}: {
  snapshot: DailyDaySnapshot;
  /** The account's queued pick for this day, if any. */
  queued: QueuedDailyPick | null;
  /** The partner's name, or "Your partner" (for the start of a sentence). */
  partnerName: string;
  /** A Send began: the parent clears its day-changed notice. */
  onSendStart: () => void;
  /** The pick was refused because the date changed; the parent shows the notice. */
  onDayChanged: () => void;
  /** The pick's request answered (not queued, not refused): the parent decides on the nudge offer from the answer stored. */
  onPickSent: (dayId: string, stored: DailyDayAnswer) => void;
}) {
  const submitDailyPick = useAppStore((state) => state.submitDailyPick);
  // Read so a connection change re-renders the queued line below.
  const connected = useAppStore((state) => state.syncStatus.isOnline);
  const [selected, setSelected] = useState<DailyChoice | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const { question, state } = snapshot;

  const send = useCallback(async () => {
    if (!selected) return;
    onSendStart();
    setSendError(null);
    setSending(true);
    try {
      const stored = await submitDailyPick(selected);
      if (stored) onPickSent(snapshot.day_id, stored);
    } catch (caught) {
      if (caught instanceof AccountDataError && caught.code === 'day-changed') {
        // The notice sits above the card: a new day_id remounts the card.
        onDayChanged();
      } else {
        console.error('[DailyQuestion] Could not send the pick:', caught);
        setSendError(caught instanceof Error ? caught.message : 'Could not send your pick.');
      }
    } finally {
      setSending(false);
    }
  }, [selected, submitDailyPick, onSendStart, onDayChanged, onPickSent, snapshot.day_id]);

  const mine = snapshot.my_choice ? question[snapshot.my_choice] : null;
  const theirs = snapshot.partner_choice ? question[snapshot.partner_choice] : null;
  // The server's pick wins; a pending queued pick stands in for the own pick.
  const waitingToSend = hasPendingPick(state, queued) ? queued : null;
  const refused = (state === 'none' || state === 'partner') && queued?.failed ? queued : null;
  const partnerStatus = (
    <p className="text-[13px] leading-[1.4] text-muted" data-testid="daily-partner-status">
      {state === 'partner' ? `${partnerName} has picked` : `${partnerName} hasn't picked yet`}
    </p>
  );

  return (
    <div className={`${CARD} gap-4 p-5`}>
      <h1
        className="font-serif text-[28px] leading-[1.15] font-semibold wrap-break-word text-ink"
        data-testid="daily-question"
      >
        {question.this} or {question.that}?
      </h1>

      {waitingToSend && (
        <div className="flex flex-col gap-2">
          <PickCard label="Your pick" text={question[waitingToSend.choice]} testId="daily-my-pick" />
          <p className="text-[13px] leading-[1.4] text-muted" data-testid="daily-my-pick-time">
            {pickedTime(waitingToSend.picked_at)}
          </p>
          <p className="text-[15px] font-semibold text-ink" data-testid="daily-pick-queued">
            {/* Online, the pick was queued after a failed send and the drain
                is already retrying it; only offline is it waiting. */}
            {connected && isOnline()
              ? 'Sending your pick…'
              : 'Waiting for a connection to send your pick.'}
          </p>
          {partnerStatus}
        </div>
      )}

      {offersSend(state, queued) && (
        <>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={selected === 'this' ? OPTION_ON : OPTION_OFF}
              aria-pressed={selected === 'this'}
              disabled={sending}
              onClick={() => setSelected('this')}
              data-testid="daily-option-this"
            >
              {question.this}
            </button>
            <button
              type="button"
              className={selected === 'that' ? OPTION_ON : OPTION_OFF}
              aria-pressed={selected === 'that'}
              disabled={sending}
              onClick={() => setSelected('that')}
              data-testid="daily-option-that"
            >
              {question.that}
            </button>
          </div>
          {partnerStatus}
          {refused && (
            <div className={FAILURE_BOX} role="alert" data-testid="daily-pick-failed">
              {refused.failure || 'Your pick could not be sent.'}
            </div>
          )}
          <div className="flex">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={!selected || sending}
              onClick={() => void send()}
              data-testid="daily-send-pick"
            >
              Send my pick
            </button>
          </div>
        </>
      )}

      {state === 'me' && mine && (
        <div className="flex flex-col gap-2">
          <PickCard label="Your pick" text={mine} testId="daily-my-pick" />
          {snapshot.my_picked_at && (
            <p className="text-[13px] leading-[1.4] text-muted" data-testid="daily-my-pick-time">
              {pickedTime(snapshot.my_picked_at)}
            </p>
          )}
        </div>
      )}

      {state === 'both' && mine && theirs && (
        <div className="flex flex-col gap-2" data-testid="daily-reveal">
          <PickCard label="You" text={mine} testId="daily-reveal-mine" />
          <PickCard label={partnerName} text={theirs} testId="daily-reveal-partner" />
          <p className="text-[15px] font-semibold text-accent" data-testid="daily-reveal-mark">
            {snapshot.same ? 'Same picks' : 'Different picks'}
          </p>
        </div>
      )}

      {sendError && (
        <div className={FAILURE_BOX} role="alert" data-testid="daily-send-error">
          {sendError}
        </div>
      )}
    </div>
  );
}

/** A write sheet's send in this mount: its session, source day and the date it named. */
interface WriteSent {
  session: string;
  dayId: string;
  named: string;
}

/**
 * The line naming the real day of a question this mount wrote (DW-498): only
 * for the same session and source day, once the turn is done, when the date it
 * is asked is not the one the sheet named; null otherwise.
 */
function movedWriteDayLine(
  sent: WriteSent | null,
  sessionKey: string,
  shown: DailyDaySnapshot | null,
  partnerName: string
): string | null {
  if (sent === null || sent.session !== sessionKey || shown === null) return null;
  if (shown.day_id !== sent.dayId || !shown.write.done) return null;
  const target = shown.write.target_day;
  if (target === undefined || target === sent.named) return null;
  return partnerGetsIt(partnerName, shown.day, target);
}

/** The line from `movedWriteDayLine`, or nothing; `inSheet` for the nudge prompt's panel. */
function WriteDayLine({
  sent,
  sessionKey,
  shown,
  partnerName,
  inSheet = false,
}: {
  sent: WriteSent | null;
  sessionKey: string;
  shown: DailyDaySnapshot | null;
  partnerName: string;
  inSheet?: boolean;
}) {
  const line = movedWriteDayLine(sent, sessionKey, shown, partnerName);
  if (line === null) return null;
  return (
    <p
      className={`${inSheet ? '' : 'px-1 '}text-[15px] leading-[1.4] text-ink`}
      role="status"
      data-testid="daily-write-day"
    >
      {line}
    </p>
  );
}

export function DailyQuestion() {
  const dailyDay = useAppStore((state) => state.dailyDay);
  const loading = useAppStore((state) => state.dailyDayLoading);
  const loadError = useAppStore((state) => state.dailyDayError);
  const loadDailyDay = useAppStore((state) => state.loadDailyDay);
  const loadCoupleStreak = useAppStore((state) => state.loadCoupleStreak);
  const coupleStreak = useAppStore((state) => state.coupleStreak);
  const queuedPicks = useAppStore((state) => state.dailyQueuedPicks);
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  const navigatePartner = useAppStore((state) => state.navigatePartner);
  const writeDeclined = useAppStore((state) => state.dailyWriteDeclined);
  const streakLoading = useAppStore((state) => state.coupleStreakLoading);
  const claimStreakCelebration = useAppStore((state) => state.claimStreakCelebration);
  const claimStreakMilestone = useAppStore((state) => state.claimStreakMilestone);
  const ownPartnerName = useAppStore((state) => state.partner?.displayName)?.trim();
  // A nameless partner reads "Your partner" at the start of a sentence and "your partner" within one.
  const partnerName = ownPartnerName || 'Your partner';
  const partnerNameInline = ownPartnerName || 'your partner';

  // The day-changed notice belongs to the session that raised it, so an account
  // change hides it without an effect resetting state.
  const sessionKey = `${userId ?? ''}:${authSessionVersion}`;
  const [dayChangedIn, setDayChangedIn] = useState<string | null>(null);
  const showDayChanged = dayChangedIn === sessionKey;
  const clearDayChanged = useCallback(() => setDayChangedIn(null), []);
  const raiseDayChanged = useCallback(() => setDayChangedIn(sessionKey), [sessionKey]);
  // The notice sits above a card that can send, and goes with the last Send it
  // could be cleared by: once the shown day offers none (the partner's pick
  // moved it to `me` or `both`, or the own pick is queued) it is dropped for
  // good, so a later day that offers a Send does not bring it back. An
  // `unlinked` re-read leaves no card and no Send, so it drops the notice too.
  // Adjusted while rendering, which React re-runs at once, rather than in an
  // effect.
  if (
    showDayChanged &&
    (dailyDay?.status === 'unlinked' ||
      (dailyDay?.status === 'ok' &&
        !offersSend(
          dailyDay.snapshot.state,
          queuedPicks.find((row) => row.day_id === dailyDay.snapshot.day_id) ?? null
        )))
  ) {
    setDayChangedIn(null);
  }

  // The +1 overlay, kept with the session that raised it so an account change
  // hides it, like the day-changed notice above.
  const [celebration, setCelebration] = useState<{
    session: string;
    streak: CoupleStreak;
    /** Which screen is up: the +1, then (when `milestone`) the milestone. */
    stage: 'up' | 'milestone';
    milestone: boolean;
  } | null>(null);
  // The held total of the last claim this mount has had answered, play or not.
  const [claimedHeld, setClaimedHeld] = useState<number | null>(null);
  const celebrationShown = celebration !== null && celebration.session === sessionKey;
  const closeCelebration = useCallback(() => setCelebration(null), []);
  // Cleared on unmount: whatever a claim answers then has nowhere to show.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // The +1 stays up until the milestone's claim answers. A claim that says no
  // (shown in another tab, or a failed write) closes the +1; one answered after
  // a second press already opened the milestone leaves that screen up.
  const continueFromStreakUp = useCallback(async () => {
    if (!celebration?.milestone) {
      setCelebration(null);
      return;
    }
    const claimed = await claimStreakMilestone(celebration.streak, () => mounted.current);
    // `current` may hold a newer claim's streak: the screen takes that one.
    setCelebration((current) => {
      if (claimed) return { ...(current ?? celebration), stage: 'milestone' };
      return current?.stage === 'up' ? null : current;
    });
  }, [celebration, claimStreakMilestone]);

  // The session whose read this mount has had finished, answered or not (see
  // the effect below).
  const [readFor, setReadFor] = useState<string | null>(null);
  // The write sheet waits for the server's answer in this mount (DW-491): the
  // store's count of shown answers, taken when this mount began its session,
  // and the count now. Whatever the server answers after that, a read, a pick's
  // confirmation or a re-read, lets the sheet ask, provided the answer was for
  // the day now on screen (`dailyDayAnsweredId`): the saved day shown first
  // does not, nor one that replaces the day after midnight. The baseline is
  // adjusted while rendering, as the day-changed notice is, so no render sees
  // the new session against the old count.
  const answers = useAppStore((state) => state.dailyDayAnswers);
  const answeredDayId = useAppStore((state) => state.dailyDayAnsweredId);
  const [answersAtMount, setAnswersAtMount] = useState({ session: sessionKey, count: answers });
  if (answersAtMount.session !== sessionKey) {
    setAnswersAtMount({ session: sessionKey, count: answers });
  }
  const answeredHere = answersAtMount.session === sessionKey && answers > answersAtMount.count;

  // The write sheet, closed by a scrim tap or Escape, stays closed for this
  // mount of Daily: the day it was closed for, so a new day can ask again.
  const [writeClosedFor, setWriteClosedFor] = useState<string | null>(null);
  const closeWriteSheet = useCallback(() => {
    if (dailyDay?.status === 'ok') setWriteClosedFor(dailyDay.snapshot.day_id);
  }, [dailyDay]);
  const writeSnapshot = dailyDay?.status === 'ok' ? dailyDay.snapshot : null;
  const showWriteSheet =
    writeSnapshot !== null &&
    writeSnapshot.my_choice !== null &&
    writeSnapshot.write.mine &&
    !writeSnapshot.write.done &&
    !writeDeclined.includes(writeSnapshot.day_id) &&
    writeSnapshot.day === formatDateISO(new Date()) &&
    writeClosedFor !== writeSnapshot.day_id &&
    answeredHere &&
    answeredDayId === writeSnapshot.day_id &&
    !celebrationShown;

  // A send the write sheet made in this mount: the session, the day it was
  // written from and the date the sheet named. When the answer (or a later read
  // of that day) asks the question on another date, one line names it (DW-498).
  const [writeSent, setWriteSent] = useState<WriteSent | null>(null);

  // The nudge prompt (R1), raised only by a confirmed answer while this view is
  // mounted: the in-view Send my pick, or a queued pick confirmed meanwhile. It
  // is kept with the session it was raised in, so an account change hides it,
  // and it is state of this mount: a reload or a remount offers nothing, so
  // "Not now" needs no stored flag. Whether it shows is decided below from the
  // shown day, never from the offer alone.
  const [nudgeOffer, setNudgeOffer] = useState<{ session: string; dayId: string } | null>(null);
  const closeNudgeOffer = useCallback(() => setNudgeOffer(null), []);
  // An answer the server confirmed: offer the prompt when the day on screen is
  // that day with only the own pick in. Whether the question still takes
  // nudges is checked where the sheet shows, at the closing instant itself.
  const raiseNudgeOffer = useCallback(
    (dayId: string, shown: DailyDayAnswer | null): boolean => {
      if (shown?.status !== 'ok') return false;
      const snap = shown.snapshot;
      if (snap.day_id !== dayId || snap.state !== 'me' || !snap.my_choice) return false;
      setNudgeOffer({ session: sessionKey, dayId });
      return true;
    },
    [sessionKey]
  );
  const offerNudge = useCallback(
    (dayId: string, shown: DailyDayAnswer) => {
      raiseNudgeOffer(dayId, shown);
    },
    [raiseNudgeOffer]
  );
  // A queued pick confirmed while this view is mounted offers the prompt too. A
  // value the store already held at mount is not one (an answer sent while Daily
  // was closed is not offered later). Adjusted while rendering, like the
  // answers baseline above.
  const queuedPickSent = useAppStore((state) => state.dailyQueuedPickSent);
  const [handledQueuedSend, setHandledQueuedSend] = useState(queuedPickSent);
  if (queuedPickSent !== handledQueuedSend) {
    setHandledQueuedSend(queuedPickSent);
    if (queuedPickSent !== null) raiseNudgeOffer(queuedPickSent.dayId, dailyDay);
  }
  // The partner's pick on that day ends the offer for good.
  const dropNudgeOffer = useCallback(
    (dayId: string) => setNudgeOffer((current) => (current?.dayId === dayId ? null : current)),
    []
  );
  const nudgeSnapshot = dailyDay?.status === 'ok' ? dailyDay.snapshot : null;
  const promptNudge = nudgeState(nudgeSnapshot);
  const promptClosed = useNudgeClosed(promptNudge.closesAt);
  const showNudgeSheet =
    nudgeOffer !== null &&
    nudgeOffer.session === sessionKey &&
    nudgeSnapshot !== null &&
    nudgeSnapshot.day_id === nudgeOffer.dayId &&
    nudgeSnapshot.state === 'me' &&
    promptNudge.closesAt !== null &&
    !promptClosed &&
    !promptNudge.promptSent &&
    readFor === sessionKey &&
    !celebrationShown &&
    !showWriteSheet;

  // Re-read on each mount, and for a new session while the view stays open (an
  // account switch clears `dailyDay` through signedOutState). The sheet waits
  // for the server to answer in this mount (`answeredHere`): the day shown first
  // may be a saved one whose turn was written on another device, and a read
  // that failed or ran offline has not shown otherwise. The nudge offer and the
  // +1 claim wait for any finished read (`readFor`). Counts and flags, not
  // `dailyDayLoading`: a later background load must not take the sheet away
  // mid-typing, and a later answer only ever adds to the count.
  useEffect(() => {
    void loadDailyDay().then(() => setReadFor(sessionKey));
    void loadCoupleStreak();
  }, [loadDailyDay, loadCoupleStreak, sessionKey]);

  // Only a successful, linked answer shows anything; a null, unlinked or failed
  // read leaves the header without a chip, with no strip and no banner.
  const streak = coupleStreak?.status === 'ok' ? coupleStreak.streak : null;

  // Claim the +1 for each `ok` streak the view shows, once this mount's own
  // read of the day has answered (`readFor`). A claim has already written by
  // the time it answers, so a re-render must not cancel it: only unmount does
  // (the ref), as nothing is left to show it on. The wait matters because a
  // dock tap from a page above Home walks back to Home first (`setView`): Daily
  // mounts, unmounts and mounts again within milliseconds, and a claim made by
  // that first, short-lived mount would store the held total with nothing to
  // play it on. Its read never answers in time; the second mount's does. It
  // also waits out a streak read in flight (this mount's own among them): a
  // milestone owed from the saved streak would otherwise come up and be replaced
  // by the +1 of a newer held total in the server's answer. A claim made while
  // an overlay is up (a re-read answering a higher total) never restarts it: see
  // `setCelebration` below.
  const shownStreak =
    dailyDay?.status === 'ok' && readFor === sessionKey && !streakLoading ? streak : null;
  // The held total stored on this device when this mount's first claim was made.
  const openedWith = useRef<{ session: string; held: number } | null>(null);
  useEffect(() => {
    if (!shownStreak) return;
    const claimAndShow = async () => {
      const claim = await claimStreakCelebration(shownStreak);
      if (!mounted.current) return;
      if (openedWith.current?.session !== sessionKey) {
        // A first read has just seeded the streak's own held total.
        openedWith.current = {
          session: sessionKey,
          held: claim.previous?.held ?? shownStreak.held,
        };
      }
      // Owed since before this mount, so no other view is playing its +1.
      const owed =
        !claim.play && claim.milestone && openedWith.current.held === shownStreak.held;
      const showOwed =
        owed && (await claimStreakMilestone(shownStreak, () => mounted.current));
      if (!mounted.current) return;
      // One batch: the answer is observable (`data-streak-claimed`) in the same
      // commit that shows the overlay, or the absence of one.
      if (claim.play || showOwed) {
        // An overlay already up is never restarted: a newer claim only brings
        // it the newer streak (the milestone kept if either claim had one) and
        // leaves it on the stage it is on.
        setCelebration((current) =>
          current !== null && current.session === sessionKey
            ? {
                ...current,
                streak: shownStreak,
                milestone: current.milestone || claim.milestone,
              }
            : {
                session: sessionKey,
                streak: shownStreak,
                stage: claim.play ? 'up' : 'milestone',
                milestone: claim.milestone,
              }
        );
      }
      setClaimedHeld(shownStreak.held);
    };
    void claimAndShow();
  }, [shownStreak, sessionKey, claimStreakCelebration, claimStreakMilestone]);

  // The partner's pick shows without a reload (AD-11).
  useDailyPickListener(dropNudgeOffer);
  // A return to the front re-reads the day.
  useDailyDayRereads();

  return (
    <div
      className="min-h-screen bg-page"
      data-testid="daily-question-view"
      data-streak-claimed={claimedHeld ?? undefined}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-3 pb-6">
        {showDayChanged && (
          <p
            className="px-1 text-[13px] leading-[1.4] text-muted"
            role="status"
            data-testid="daily-day-changed"
          >
            {DAY_CHANGED_MESSAGE}
          </p>
        )}

        {!showNudgeSheet && (
          <WriteDayLine
            sent={writeSent}
            sessionKey={sessionKey}
            shown={writeSnapshot}
            partnerName={partnerName}
          />
        )}

        {dailyDay?.status === 'ok' && (
          <>
            <StreakHeader day={dailyDay.snapshot.day} streak={streak} />

            {streak?.today_state === 'blue' && <ColdBanner streak={streak} />}

            {streak && (
              <div className={`${CARD} p-4`}>
                <StreakRow streak={streak} testIdPrefix="daily-streak" labelClass="text-muted" />
              </div>
            )}

            {dailyDay.snapshot.state === 'me' && (
              <p
                className="px-1 text-[15px] leading-[1.4] font-semibold text-ink"
                data-testid="daily-streak-waiting"
              >
                Your half is in. The streak lights up when {partnerNameInline} answers too.
              </p>
            )}

            <DayCard
              key={dailyDay.snapshot.day_id}
              snapshot={dailyDay.snapshot}
              queued={queuedPicks.find((row) => row.day_id === dailyDay.snapshot.day_id) ?? null}
              partnerName={partnerName}
              onSendStart={clearDayChanged}
              onDayChanged={raiseDayChanged}
              onPickSent={offerNudge}
            />

            {dailyDay.snapshot.state === 'me' && dailyDay.snapshot.my_choice && (
              <WaitingCard
                key={`${dailyDay.snapshot.day_id}:waiting`}
                snapshot={dailyDay.snapshot}
                partnerNameInline={partnerNameInline}
              />
            )}
          </>
        )}

        {dailyDay?.status === 'unlinked' && (
          <div className={`${CARD} gap-3 p-5`} data-testid="daily-invite">
            <h1 className="font-serif text-[28px] leading-[1.15] font-semibold wrap-break-word text-ink">
              Link with your partner
            </h1>
            <p className="text-[15px] leading-[1.4] text-muted">
              Daily asks you both one question a day. Link your accounts to start.
            </p>
            <div className="flex">
              <button
                type="button"
                className={PRIMARY_BUTTON}
                onClick={navigatePartner}
                data-testid="daily-invite-link"
              >
                Go to Partner
              </button>
            </div>
          </div>
        )}

        {dailyDay === null && !loadError && (
          <p className="px-1 text-sm text-muted" data-testid="daily-loading">
            Loading today&apos;s question…
          </p>
        )}

        {loadError && (
          <div className={`${FAILURE_BOX} flex flex-col gap-3`} role="alert" data-testid="daily-error">
            <span>{loadError}</span>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={loading}
              onClick={() => void loadDailyDay()}
              data-testid="daily-retry"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {celebrationShown && celebration.stage === 'up' && (
        <StreakUp
          streak={celebration.streak}
          partnerName={partnerNameInline}
          showReveal={
            !celebration.milestone && dailyDay?.status === 'ok' && dailyDay.snapshot.state === 'both'
          }
          onContinue={() => void continueFromStreakUp()}
        />
      )}

      {celebrationShown && celebration.stage === 'milestone' && (
        <Milestone
          streak={celebration.streak}
          partnerName={partnerNameInline}
          onClose={closeCelebration}
        />
      )}

      {showWriteSheet && (
        <WriteQuestionSheet
          key={writeSnapshot.day_id}
          dayId={writeSnapshot.day_id}
          day={writeSnapshot.day}
          targetDay={writeSnapshot.write.target_day}
          partnerName={partnerName}
          onClose={closeWriteSheet}
          onSent={(named) =>
            setWriteSent({ session: sessionKey, dayId: writeSnapshot.day_id, named })
          }
        />
      )}

      {showNudgeSheet && (
        <NudgeSheet key={nudgeSnapshot.day_id} onClose={closeNudgeOffer}>
          <WriteDayLine
            sent={writeSent}
            sessionKey={sessionKey}
            shown={writeSnapshot}
            partnerName={partnerName}
            inSheet
          />
        </NudgeSheet>
      )}
    </div>
  );
}
