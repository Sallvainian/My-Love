/**
 * DatePages -- the couple dates' and the birthdays' own pages under
 * `/settings/dates/…`: Together since (`dates/together-since`), Wedding
 * (`dates/wedding`), Your birthday (`dates/birthday`) and the partner's
 * birthday (`dates/partner-birthday`), plus the one-field Date pages for the
 * first two (`…/date`). Your birthday's Date page is `BirthdayPage`.
 *
 * Each page is a Date row, whose value reads as on the Dates list, and the
 * Remind me switch (`RemindMeGroup`, the iOS shell only). Together since and
 * Wedding belong to the couple and either partner edits them; Wedding adds a
 * centered `Clear` alone in its own card while a date is set, which sets it
 * back to `Not set` and returns to the Dates list. The partner's birthday is a
 * read-only Date row and a Footnote saying whose it is to set. Together since
 * is a date and a time on one `datetime-local` field and must not be in the
 * future; the wedding is any date.
 *
 * Until the couple settings have loaded the Date row is empty and disabled, so
 * a page never prefills from a read that has not arrived. When the server has
 * confirmed there is no partner (the couple `unlinked`, or the partner read
 * answered `unlinked`), a page is not there to show and goes back to the Dates
 * list once per mount, on a reload too. A failed partner read is not an answer:
 * the partner's birthday page then shows its title and nothing under it.
 *
 * Each page owns one Error box (`settings-date-error`) above its first card for
 * the Remind me switch and `Clear`; the Date pages are `OneFieldPage`s and show
 * their own. Both are registered in `Settings` (`SUBPAGES`).
 *
 * @component
 */

import { CircleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
import { parseEventDate } from '../../services/eventsService';
import { MARK_KEYS } from '../../services/dateReminders';
import { useAppStore } from '../../stores/useAppStore';
import { FAILURE_BOX, FOOTNOTE, fieldClass } from '../shared/kitClasses';
import { useFallBackToDates } from './dateNavigation';
import { RemindMeGroup } from './RemindMe';
import {
  coupleValue,
  fromLocalDateTime,
  isValidTogetherSince,
  parseInstant,
  toLocalDateTime,
  yearlyValue,
} from './settingsFields';
import { OneFieldPage } from './stack/OneFieldPage';
import { ReadOnlyRow, SettingsGroup, SettingsRow } from './stack/SettingsRows';
import { useSettingsPage } from './stack/settingsPageContext';
import { ROW_BUTTON } from './SwitchRow';

const FIELD_CLASS = `${fieldClass(false)} disabled:cursor-not-allowed disabled:opacity-60`;

/**
 * Whether the server has confirmed there is no partner: the couple settings
 * say `unlinked`, or they have not loaded and the partner read answered
 * `unlinked` (the same expression as the Dates list). A failed read is not.
 */
function useCoupleAbsent(): boolean {
  const coupleSettings = useAppStore((s) => s.coupleSettings);
  const partner = useAppStore((s) => s.partner);
  const partnerKnown = useAppStore((s) => s.partnerKnown);
  const partnerLoadError = useAppStore((s) => s.partnerLoadError);
  const confirmedUnlinked = partnerKnown && partner === null && !partnerLoadError;
  return coupleSettings?.status === 'unlinked' || (coupleSettings === null && confirmedUnlinked);
}

interface DatePageProps {
  testId: string;
  error: string | null;
  children: ReactNode;
}

/** A date page's wrapper, with its Error box above the first card. */
export function DatePage({ testId, error, children }: DatePageProps) {
  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      {error && (
        <div
          className={`${FAILURE_BOX} flex items-start gap-2`}
          role="alert"
          data-testid="settings-date-error"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {children}
    </div>
  );
}

interface DateRowProps {
  /** `undefined` while the value is not known yet. */
  value: string | undefined;
  /** The Date page this row opens. */
  target: string;
  /** Waiting for the read the Date page prefills from. */
  disabled?: boolean;
}

/** The Date row: one card holding the one field's row. */
function DateRow({ value, target, disabled }: DateRowProps) {
  return (
    <SettingsGroup>
      <SettingsRow
        key="date"
        label="Date"
        value={value}
        target={target}
        disabled={disabled}
        testId="settings-date-row"
      />
    </SettingsGroup>
  );
}

export function TogetherSincePage() {
  const coupleSettings = useAppStore((s) => s.coupleSettings);
  const [error, setError] = useState<string | null>(null);
  useFallBackToDates(useCoupleAbsent());

  const loaded = coupleSettings?.status === 'linked';
  const start = coupleSettings?.status === 'linked' ? coupleSettings.relationshipStart : null;

  return (
    <DatePage testId="settings-together-since-page" error={error}>
      <DateRow
        value={coupleValue(loaded, start, parseInstant, new Date())}
        target="dates/together-since/date"
        disabled={!loaded}
      />
      <RemindMeGroup markKey={MARK_KEYS.relationshipStart} onError={setError} />
    </DatePage>
  );
}

export function TogetherSinceDatePage() {
  const start = useAppStore((s) =>
    s.coupleSettings?.status === 'linked' ? s.coupleSettings.relationshipStart : null
  );
  const setRelationshipStart = useAppStore((s) => s.setRelationshipStart);

  return (
    <OneFieldPage
      label="Date"
      saved={toLocalDateTime(start)}
      isValid={isValidTogetherSince}
      save={(value) => setRelationshipStart(fromLocalDateTime(value)!)}
      offlineRefusal={offlineMessage('Couple settings')}
      testId="settings-together-since-date-page"
      renderField={({ id, value, onChange, disabled }) => (
        <input
          id={id}
          type="datetime-local"
          value={value}
          max={toLocalDateTime(new Date().toISOString())}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={FIELD_CLASS}
          data-testid="settings-together-since-field"
        />
      )}
    />
  );
}

export function WeddingPage() {
  const coupleSettings = useAppStore((s) => s.coupleSettings);
  const setWeddingDate = useAppStore((s) => s.setWeddingDate);
  const { goBack } = useSettingsPage();
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  /** False once the page is left, so a clear that lands late does not navigate. */
  const mounted = useRef(false);
  useFallBackToDates(useCoupleAbsent());

  useEffect(() => {
    // Re-armed on setup so StrictMode's cleanup/setup replay leaves the live page settled.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loaded = coupleSettings?.status === 'linked';
  const wedding = coupleSettings?.status === 'linked' ? coupleSettings.weddingDate : null;

  const clear = async () => {
    setError(null);
    if (!isOnline()) {
      setError(offlineMessage('Couple settings'));
      return;
    }
    setClearing(true);
    try {
      await setWeddingDate(null);
      if (mounted.current) goBack();
    } catch (caught) {
      console.error('[WeddingPage] Could not clear the wedding date:', caught);
      if (mounted.current) {
        setError(caught instanceof Error ? caught.message : 'Could not clear the wedding date.');
      }
    } finally {
      if (mounted.current) setClearing(false);
    }
  };

  return (
    <DatePage testId="settings-wedding-page" error={error}>
      <DateRow
        value={coupleValue(loaded, wedding, parseEventDate, new Date())}
        target="dates/wedding/date"
        disabled={!loaded}
      />
      <RemindMeGroup markKey={MARK_KEYS.wedding} onError={setError} />
      {wedding && (
        <SettingsGroup>
          <button
            key="clear"
            type="button"
            onClick={() => void clear()}
            disabled={clearing}
            className={`${ROW_BUTTON} justify-center text-[15px] font-medium text-danger
              disabled:cursor-not-allowed disabled:opacity-60`}
            data-testid="settings-wedding-clear"
          >
            Clear
          </button>
        </SettingsGroup>
      )}
    </DatePage>
  );
}

export function WeddingDatePage() {
  const wedding = useAppStore((s) =>
    s.coupleSettings?.status === 'linked' ? s.coupleSettings.weddingDate : null
  );
  const setWeddingDate = useAppStore((s) => s.setWeddingDate);

  return (
    <OneFieldPage
      label="Date"
      saved={wedding ?? ''}
      isValid={(value) => parseEventDate(value) !== null}
      save={setWeddingDate}
      offlineRefusal={offlineMessage('Couple settings')}
      testId="settings-wedding-date-page"
      renderField={({ id, value, onChange, disabled }) => (
        <input
          id={id}
          type="date"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={FIELD_CLASS}
          data-testid="settings-wedding-field"
        />
      )}
    />
  );
}

export function YourBirthdayPage() {
  const ownProfile = useAppStore((s) => s.ownProfile);
  const loadFailed = useAppStore((s) => s.ownProfileLoadFailed);
  const [error, setError] = useState<string | null>(null);

  // The Date page prefills from the profile, so wait for its first answer; a
  // failed read with nothing saved is an answer ("no birthday known").
  const waiting = ownProfile === null && !loadFailed;

  return (
    <DatePage testId="settings-your-birthday-page" error={error}>
      <DateRow
        value={ownProfile ? yearlyValue(ownProfile.birthday) : undefined}
        target="dates/birthday/date"
        disabled={waiting}
      />
      <RemindMeGroup markKey={MARK_KEYS.ownBirthday} onError={setError} />
    </DatePage>
  );
}

export function PartnerBirthdayPage() {
  const partner = useAppStore((s) => s.partner);
  const partnerKnown = useAppStore((s) => s.partnerKnown);
  const partnerLoadError = useAppStore((s) => s.partnerLoadError);
  const [error, setError] = useState<string | null>(null);
  useFallBackToDates(partnerKnown && partner === null && !partnerLoadError);

  return (
    <DatePage testId="settings-partner-birthday-page" error={error}>
      {partner && (
        <>
          <SettingsGroup
            footnote={
              <p className={FOOTNOTE} data-testid="settings-partner-birthday-footnote">
                {partner.displayName} sets this in their Profile.
              </p>
            }
          >
            <ReadOnlyRow
              key="date"
              label="Date"
              value={yearlyValue(partner.birthday) ?? ''}
              testId="settings-partner-birthday-date"
            />
          </SettingsGroup>
          <RemindMeGroup markKey={MARK_KEYS.partnerBirthday} onError={setError} />
        </>
      )}
    </DatePage>
  );
}
