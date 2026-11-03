/**
 * ProfilePage -- Settings > Profile (`/settings/profile`) and the two
 * one-field pages under it: Name (`/settings/profile/name`) and Birthday
 * (`/settings/profile/birthday`).
 *
 * Everything reads the store's `ownProfile` (`profileSlice`, the same state
 * Home shares), so the top page's Profile row, the header and the Name row
 * agree and follow a save with no reload. Until the profile's first answer
 * (the saved copy or the server) the rows show no value and cannot be opened,
 * because their pages prefill from it; a failed read with nothing saved opens
 * them with an empty field. The pages are `OneFieldPage`s: Save is in the bar,
 * and a save returns here. A reload on either shows this page.
 *
 * @component
 */

import { User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { authService } from '../../api/authService';
import { offlineMessage } from '../../services/accountDataError';
import { useAppStore } from '../../stores/useAppStore';
import { GROUP_ROW, fieldClass } from '../shared/kitClasses';
import {
  BIRTHDAY_MIN,
  formatDateOnly,
  isValidBirthday,
  isValidDisplayName,
  latestBirthday,
} from './settingsFields';
import { OneFieldPage } from './stack/OneFieldPage';
import { SettingsGroup, SettingsRow } from './stack/SettingsRows';

const NOT_SET = 'Not set';

/** The top page's Account row: the display name on the right. */
export function ProfileRow() {
  const displayName = useAppStore((s) => s.ownProfile?.displayName);

  return (
    <SettingsRow
      icon={User}
      label="Profile"
      value={displayName ?? undefined}
      target="profile"
      testId="settings-profile-row"
    />
  );
}

/** The signed-in account's email from the local session, which answers offline too. */
function useSessionEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authService.getSession().then((session) => {
      if (!cancelled) setEmail(session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return email;
}

export function ProfilePage() {
  const ownProfile = useAppStore((s) => s.ownProfile);
  const loadFailed = useAppStore((s) => s.ownProfileLoadFailed);
  const email = useSessionEmail();

  const displayName = ownProfile?.displayName?.trim() || null;
  // The avatar's letter: the chosen display name's, else the email's. First
  // grapheme, not `charAt(0)` or the first code point: a flag, skin-tone or ZWJ
  // emoji spans several code points and would otherwise render in part.
  const avatarSource = displayName ?? email?.trim() ?? null;
  const [firstGrapheme] = avatarSource
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(avatarSource)
    : [];
  const avatarInitial = firstGrapheme?.segment.toUpperCase() ?? '';

  // Their pages prefill from the profile, so wait for its first answer; a
  // failed read with nothing saved is an answer ("no name known").
  const waiting = ownProfile === null && !loadFailed;

  return (
    <>
      <div className={`${GROUP_ROW} px-1`} data-testid="settings-profile-header">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill text-base font-semibold text-white"
          aria-hidden="true"
          data-testid="settings-avatar"
        >
          {avatarInitial}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {displayName && (
            <p
              className="text-[15px] font-medium wrap-break-word text-ink"
              data-testid="settings-profile-header-name"
            >
              {displayName}
            </p>
          )}
          {email && (
            <p className="text-[13px] leading-[1.4] wrap-break-word text-muted" data-testid="settings-email">
              {email}
            </p>
          )}
        </div>
      </div>
      <SettingsGroup>
        <SettingsRow
          label="Name"
          value={ownProfile ? (ownProfile.displayName ?? NOT_SET) : undefined}
          target="profile/name"
          disabled={waiting}
          testId="settings-profile-name"
        />
        <SettingsRow
          label="Birthday"
          value={
            ownProfile
              ? ownProfile.birthday
                ? formatDateOnly(ownProfile.birthday)
                : NOT_SET
              : undefined
          }
          target="profile/birthday"
          disabled={waiting}
          testId="settings-profile-birthday"
        />
      </SettingsGroup>
    </>
  );
}

const FIELD_CLASS = `${fieldClass(false)} disabled:cursor-not-allowed disabled:opacity-60`;

export function NamePage() {
  const saved = useAppStore((s) => s.ownProfile?.displayName ?? '');
  const setDisplayName = useAppStore((s) => s.setDisplayName);

  return (
    <OneFieldPage
      label="Name"
      saved={saved}
      isValid={isValidDisplayName}
      save={setDisplayName}
      offlineRefusal={offlineMessage('Name changes', 'save')}
      testId="settings-name-page"
      renderField={({ id, value, onChange, disabled }) => (
        <input
          id={id}
          type="text"
          value={value}
          maxLength={30}
          autoComplete="nickname"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={FIELD_CLASS}
          data-testid="settings-name-field"
        />
      )}
    />
  );
}

export function BirthdayPage() {
  const saved = useAppStore((s) => s.ownProfile?.birthday ?? '');
  const setBirthday = useAppStore((s) => s.setBirthday);

  return (
    <OneFieldPage
      label="Birthday"
      saved={saved}
      isValid={isValidBirthday}
      save={setBirthday}
      offlineRefusal={offlineMessage('Profile changes')}
      testId="settings-birthday-page"
      renderField={({ id, value, onChange, disabled }) => (
        <input
          id={id}
          type="date"
          value={value}
          min={BIRTHDAY_MIN}
          max={latestBirthday()}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={FIELD_CLASS}
          data-testid="settings-birthday-field"
        />
      )}
    />
  );
}
