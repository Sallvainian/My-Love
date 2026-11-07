/**
 * Daily Question — today's this-or-that question for the couple.
 *
 * Reads `dailyDay` from `dailyQuestionSlice`; every projection (state, the
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
 * `dailyWriteDeclined`, and the snapshot's `day` is the device's date, once this
 * mount's own read of the day has answered (the saved day shown first may be
 * out of date). A tap on its scrim or Escape hides it until the next mount of
 * this view; only a successful send (`write.done`) or "No thanks" ends it for
 * the day.
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
 * walk through Home unmounts at once claims nothing; the overlay belongs to the
 * session that raised it. The write sheet waits while the overlay
 * shows. Only Daily claims: the Partner page shows the count without playing it.
 *
 * The milestone (R5): when the same claim also says `milestone` (the streak's
 * milestone count is above the one this device last showed, stored by that
 * claim), the +1's button opens the full-screen `Milestone` screen instead of
 * closing; its Continue and Close both close it, revealing the card. The write
 * sheet waits behind both stages. A milestone never shows without the +1.
 * The root carries `data-streak-claimed` (the held total of the last claim this
 * mount has had answered, whether or not it played), so a test can wait for the
 * answer before asserting that no overlay came.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, Snowflake } from 'lucide-react';
import {
  type CoupleStreak,
  DAY_CHANGED_MESSAGE,
  type DailyChoice,
  type DailyDaySnapshot,
} from '../../api/dailyQuestionApi';
import { useDailyPickListener } from '../../hooks/useDailyPickListener';
import { AccountDataError } from '../../services/accountDataError';
import { parseEventDate } from '../../services/eventsService';
import type { QueuedDailyPick } from '../../stores/slices/dailyQuestionSlice';
import { useAppStore } from '../../stores/useAppStore';
import { formatDateISO } from '../../utils/dateUtils';
import { CARD, FAILURE_BOX, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../shared/kitClasses';
import { StreakWeek } from '../shared/StreakWeek';
import { Milestone } from './Milestone';
import { StreakUp } from './StreakUp';
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

function ColdBanner({ streak }: { streak: CoupleStreak }) {
  const missed =
    streak.missed === 1 ? 'Yesterday was' : `The last ${streak.missed} days were`;
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

function DayCard({
  snapshot,
  queued,
  partnerName,
  partnerNameInline,
  onSendStart,
  onDayChanged,
}: {
  snapshot: DailyDaySnapshot;
  /** The account's queued pick for this day, if any. */
  queued: QueuedDailyPick | null;
  /** The partner's name, or "Your partner" (for the start of a sentence). */
  partnerName: string;
  /** The partner's name, or "your partner" (for the middle of a sentence). */
  partnerNameInline: string;
  /** A Send began: the parent clears its day-changed notice. */
  onSendStart: () => void;
  /** The pick was refused because the date changed; the parent shows the notice. */
  onDayChanged: () => void;
}) {
  const submitDailyPick = useAppStore((state) => state.submitDailyPick);
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
      await submitDailyPick(selected);
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
  }, [selected, submitDailyPick, onSendStart, onDayChanged]);

  const mine = snapshot.my_choice ? question[snapshot.my_choice] : null;
  const theirs = snapshot.partner_choice ? question[snapshot.partner_choice] : null;
  // The server's pick wins; a pending queued pick stands in for the own pick.
  const waitingToSend = (state === 'none' || state === 'partner') && queued && !queued.failed;
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
          <PickCard label="Your pick" text={question[queued.choice]} testId="daily-my-pick" />
          <p className="text-[13px] leading-[1.4] text-muted" data-testid="daily-my-pick-time">
            {pickedTime(queued.picked_at)}
          </p>
          <p className="text-[15px] font-semibold text-ink" data-testid="daily-pick-queued">
            Waiting for a connection to send your pick.
          </p>
          {partnerStatus}
        </div>
      )}

      {(state === 'none' || state === 'partner') && !waitingToSend && (
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
          <p className="text-[15px] font-semibold text-ink" data-testid="daily-waiting">
            Waiting on {partnerNameInline}
          </p>
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
  const claimStreakCelebration = useAppStore((state) => state.claimStreakCelebration);
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
  const continueFromStreakUp = useCallback(
    () =>
      setCelebration((current) =>
        current && current.milestone ? { ...current, stage: 'milestone' } : null
      ),
    []
  );

  // The session whose read this mount has had answered (see the effect below).
  const [readFor, setReadFor] = useState<string | null>(null);

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
    readFor === sessionKey &&
    !celebrationShown;

  // Re-read on each mount, and for a new session while the view stays open (an
  // account switch clears `dailyDay` through signedOutState). The sheet waits
  // for this mount's read to answer: the day shown first may be a saved one
  // whose turn was written on another device. A flag, not `dailyDayLoading`: a
  // later background load must not take the sheet away mid-typing.
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
  // play it on. Its read never answers in time; the second mount's does.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const shownStreak = dailyDay?.status === 'ok' && readFor === sessionKey ? streak : null;
  useEffect(() => {
    if (!shownStreak) return;
    void claimStreakCelebration(shownStreak).then((claim) => {
      if (!mounted.current) return;
      // One batch: the answer is observable (`data-streak-claimed`) in the same
      // commit that shows the overlay, or the absence of one.
      if (claim.play) {
        setCelebration({
          session: sessionKey,
          streak: shownStreak,
          stage: 'up',
          milestone: claim.milestone,
        });
      }
      setClaimedHeld(shownStreak.held);
    });
  }, [shownStreak, sessionKey, claimStreakCelebration]);

  // The partner's pick shows without a reload (AD-11).
  useDailyPickListener();

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

        {dailyDay?.status === 'ok' && (
          <>
            <StreakHeader day={dailyDay.snapshot.day} streak={streak} />

            {streak?.today_state === 'blue' && <ColdBanner streak={streak} />}

            {streak && (
              <div className={`${CARD} p-4`}>
                <StreakWeek week={streak.week} testIdPrefix="daily-streak" labelClass="text-muted" />
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
              partnerNameInline={partnerNameInline}
              onSendStart={clearDayChanged}
              onDayChanged={raiseDayChanged}
            />
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
          onContinue={continueFromStreakUp}
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
        />
      )}
    </div>
  );
}
