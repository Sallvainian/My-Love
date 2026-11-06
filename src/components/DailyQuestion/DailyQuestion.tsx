/**
 * Daily Question — today's this-or-that question for the couple.
 *
 * Reads `dailyDay` from `dailyQuestionSlice`; every projection (state, the
 * partner's choice, Same/Different) comes from the server snapshot, and the
 * view shows the partner's choice only when the snapshot carries it. `unlinked`
 * renders no question and no pick control. A normal page inside `<main>`, so it
 * gets the dock clearance and side padding from there.
 */

import { useCallback, useEffect, useState } from 'react';
import { isOnline } from '../../api/errorHandlers';
import {
  DAY_CHANGED_MESSAGE,
  type DailyChoice,
  type DailyDaySnapshot,
} from '../../api/dailyQuestionApi';
import { AccountDataError, offlineMessage } from '../../services/accountDataError';
import { useAppStore } from '../../stores/useAppStore';
import { CARD, FAILURE_BOX, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../shared/kitClasses';

const OPTION =
  'flex min-h-12 w-full items-center justify-center rounded-[14px] px-4 py-3 text-base font-semibold wrap-break-word transition-opacity focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';
const OPTION_OFF = `${OPTION} bg-tint text-accent`;
const OPTION_ON = `${OPTION} bg-fill text-white`;

function pickedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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
  partnerName,
  onSendStart,
  onDayChanged,
}: {
  snapshot: DailyDaySnapshot;
  partnerName: string;
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
    if (!isOnline()) {
      setSendError(offlineMessage('Your pick', 'send', 'needs'));
      return;
    }
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

  return (
    <div className={`${CARD} gap-4 p-5`}>
      <h1
        className="font-serif text-[28px] leading-[1.15] font-semibold wrap-break-word text-ink"
        data-testid="daily-question"
      >
        {question.this} or {question.that}?
      </h1>

      {(state === 'none' || state === 'partner') && (
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
          <p className="text-[13px] leading-[1.4] text-muted" data-testid="daily-partner-status">
            {state === 'partner' ? `${partnerName} has picked` : `${partnerName} hasn't picked yet`}
          </p>
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
            Waiting on {partnerName}
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
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  const partnerName = useAppStore((state) => state.partner?.displayName)?.trim() || 'Your partner';

  // The day-changed notice belongs to the session that raised it, so an account
  // change hides it without an effect resetting state.
  const sessionKey = `${userId ?? ''}:${authSessionVersion}`;
  const [dayChangedIn, setDayChangedIn] = useState<string | null>(null);
  const showDayChanged = dayChangedIn === sessionKey;
  const clearDayChanged = useCallback(() => setDayChangedIn(null), []);
  const raiseDayChanged = useCallback(() => setDayChangedIn(sessionKey), [sessionKey]);

  // Re-read on each mount, and for a new session while the view stays open (an
  // account switch clears `dailyDay` through signedOutState): no local copy yet.
  useEffect(() => {
    void loadDailyDay();
  }, [loadDailyDay, userId, authSessionVersion]);

  return (
    <div className="min-h-screen bg-page" data-testid="daily-question-view">
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
          <DayCard
            key={dailyDay.snapshot.day_id}
            snapshot={dailyDay.snapshot}
            partnerName={partnerName}
            onSendStart={clearDayChanged}
            onDayChanged={raiseDayChanged}
          />
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
    </div>
  );
}
