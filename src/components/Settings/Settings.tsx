/**
 * Settings Component
 *
 * Application settings on the style kit, as a stack of pages (`SettingsStack`).
 * The top page holds the Account group (the Profile row), the Partner group
 * (the Partner and Dates rows), the preferences and about groups, the sign-out
 * card and the version line, then the sections not yet replaced by pages of their own:
 * the couple's shared "Together since" start and wedding date (the `Together`
 * section), the couple's countdowns (events and anniversaries) and the
 * per-date reminder list (`CountdownMarks`; the native shell with the
 * local-notifications plugin only). Profile (the display name and your own
 * birthday, each on a one-field page, see `ProfilePage`), Partner (who the
 * account is linked to, see `PartnerPage`), Dates (every date in one list, see
 * `DatesPage`), Photos (this device's mobile-data choice for the offline album)
 * and Notifications (a switch for each kind of
 * push and the Date reminders switch; the native shell with the push plugins
 * only, see `NotificationsPage`) are the subpages.
 *
 * @component
 */

import {
  CircleAlert,
  Gem,
  Heart,
  Image as ImageIcon,
  LoaderCircle,
  LogOut,
  MonitorSmartphone,
  RotateCcw,
} from 'lucide-react';
import { AnimatePresence, m as motion } from 'motion/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SubmitEvent,
} from 'react';
import { authService } from '../../api/authService';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
import { parseEventDate } from '../../services/eventsService';
import { hasNativePush } from '../../services/pushNotifications';
import { showSignOutNotice } from '../../services/signOutNotice';
import {
  canTellMobileData,
  getPhotosOverMobileData,
  photoDownloadLabel,
  subscribePhotosOverMobileData,
} from '../../services/photoDownloadPreference';
import { useAppStore } from '../../stores/useAppStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { logger } from '../../utils/logger';
import {
  CARD,
  DESTRUCTIVE_BUTTON,
  DIALOG_BACKDROP,
  DIALOG_PANEL,
  DIALOG_TITLE,
  DIVIDER,
  FIELD_ERROR,
  GROUP_ROW as ROW,
  GROUP_TILE as TILE,
  SECTION_LABEL,
  SECONDARY_BUTTON,
  SMALL_SECONDARY,
  fieldClass,
} from '../shared/kitClasses';
import { AnniversarySettings } from './AnniversarySettings';
import { CountdownMarks } from './CountdownMarks';
import { DatesPage, DatesRow } from './DatesPage';
import { EventsSettings } from './EventsSettings';
import { NotificationsPage, NotificationsRow } from './NotificationsPage';
import { PartnerPage, PartnerRow } from './PartnerPage';
import { PhotosPage } from './PhotosPage';
import { BirthdayPage, NamePage, ProfilePage, ProfileRow } from './ProfilePage';
import { formatDateOnly } from './settingsFields';
import { SettingsGroup, SettingsRow } from './stack/SettingsRows';
import { SettingsStack, type SettingsPageSpec } from './stack/SettingsStack';
import { ROW_BUTTON } from './SwitchRow';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** An ISO instant as the local `YYYY-MM-DD` and `HH:MM` a date and time input take. */
function toLocalInputs(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/**
 * The inputs' local date and time as an ISO instant, or `null` when the date
 * is missing or impossible. Built from components, never `new Date(string)`:
 * a bare date string parses as UTC midnight. An empty time means midnight.
 */
function fromLocalInputs(date: string, time: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dm) return null;
  const tm = /^(\d{2}):(\d{2})$/.exec(time || '00:00');
  if (!tm) return null;
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const local = new Date(y, mo - 1, d, Number(tm[1]), Number(tm[2]));
  if (local.getFullYear() !== y || local.getMonth() !== mo - 1 || local.getDate() !== d) return null;
  return local.toISOString();
}

/**
 * "Together since": the couple's shared start, a date and a time either
 * partner can set. The value is server-held (`coupleSettings`); a save needs a
 * connection, and a refused or failed one leaves the value unchanged and says
 * why here.
 */
function TogetherSinceRow() {
  const coupleSettings = useAppStore((s) => s.coupleSettings);

  const subtitle = (() => {
    if (!coupleSettings) return 'Loading...';
    if (coupleSettings.status === 'unlinked') return 'Link a partner first to set your start date';
    if (!coupleSettings.relationshipStart) return 'Not set yet';
    return new Date(coupleSettings.relationshipStart).toLocaleString(undefined, {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  })();

  const start = coupleSettings?.status === 'linked' ? coupleSettings.relationshipStart : null;

  return (
    <div className="flex flex-col gap-2 py-1" data-testid="settings-together-since">
      <div className={ROW}>
        <span className={TILE} aria-hidden="true">
          <Heart className="h-4.25 w-4.25" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[15px] font-medium text-ink">Together since</p>
          <p
            className="text-[13px] wrap-break-word text-muted"
            data-testid="settings-together-since-value"
          >
            {subtitle}
          </p>
        </div>
      </div>
      {/* Remounted when the saved value changes, so the inputs pick it up. */}
      {coupleSettings?.status === 'linked' && <TogetherSinceForm key={start ?? 'unset'} start={start} />}
    </div>
  );
}

function TogetherSinceForm({ start }: { start: string | null }) {
  const setRelationshipStart = useAppStore((s) => s.setRelationshipStart);
  const initial = toLocalInputs(start);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = fromLocalInputs(date, time);
    if (!value) {
      setSaveError('Pick a date first.');
      return;
    }
    // A mistyped year would otherwise count "together for" toward a future day.
    if (new Date(value).getTime() > Date.now()) {
      setSaveError('Pick a date in the past.');
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      await setRelationshipStart(value);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the start date.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSave} noValidate>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="settings-together-since-date">
          Start date
        </label>
        <input
          id="settings-together-since-date"
          type="date"
          value={date}
          max={toLocalInputs(new Date().toISOString()).date}
          onChange={(e) => setDate(e.target.value)}
          className={fieldClass(false)}
          data-testid="settings-together-since-date"
        />
        <label className="sr-only" htmlFor="settings-together-since-time">
          Start time
        </label>
        <input
          id="settings-together-since-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={fieldClass(false)}
          data-testid="settings-together-since-time"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className={SMALL_SECONDARY}
          data-testid="settings-together-since-save"
        >
          {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSaving ? 'Saving…' : 'Save start date'}
        </button>
      </div>
      {saveError && (
        <p className={FIELD_ERROR} role="alert" data-testid="settings-together-since-error">
          {saveError}
        </p>
      )}
    </form>
  );
}

/**
 * "Wedding": the couple's shared wedding date, any date, which either partner
 * sets, changes or clears. Shown for a linked couple only. Same save rules as
 * "Together since".
 */
function WeddingRow() {
  const coupleSettings = useAppStore((s) => s.coupleSettings);
  if (coupleSettings?.status !== 'linked') return null;
  const { weddingDate } = coupleSettings;

  return (
    <>
      <div className={DIVIDER} aria-hidden="true" />
      <div className="flex flex-col gap-2 py-1" data-testid="settings-wedding">
        <div className={ROW}>
          <span className={TILE} aria-hidden="true">
            <Gem className="h-4.25 w-4.25" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-[15px] font-medium text-ink">Wedding</p>
            <p className="text-[13px] wrap-break-word text-muted" data-testid="settings-wedding-value">
              {weddingDate ? formatDateOnly(weddingDate) : 'Not set yet'}
            </p>
          </div>
        </div>
        <WeddingForm key={weddingDate ?? 'unset'} weddingDate={weddingDate} />
      </div>
    </>
  );
}

function WeddingForm({ weddingDate }: { weddingDate: string | null }) {
  const setWeddingDate = useAppStore((s) => s.setWeddingDate);
  const [date, setDate] = useState(weddingDate ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async (value: string | null) => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await setWeddingDate(value);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the wedding date.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parseEventDate(date)) {
      setSaveError('Pick a date first.');
      return;
    }
    await save(date);
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSave} noValidate>
      <label className="sr-only" htmlFor="settings-wedding-date">
        Wedding date
      </label>
      <input
        id="settings-wedding-date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className={fieldClass(false)}
        data-testid="settings-wedding-date"
      />
      <div className="flex items-center justify-end gap-2">
        {weddingDate && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void save(null)}
            className={SMALL_SECONDARY}
            data-testid="settings-wedding-clear"
          >
            Clear
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className={SMALL_SECONDARY}
          data-testid="settings-wedding-save"
        >
          {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSaving ? 'Saving…' : 'Save wedding date'}
        </button>
      </div>
      {saveError && (
        <p className={FIELD_ERROR} role="alert" data-testid="settings-wedding-error">
          {saveError}
        </p>
      )}
    </form>
  );
}

/**
 * Shown on the login screen when "Log out of all devices" logged this device
 * out but could not reach every other one (the server was unreachable, or the
 * push registrations could not be removed). Settings owns the wording; the
 * login screen only displays it (`services/signOutNotice.ts`).
 */
const PARTIAL_SIGN_OUT_NOTICE =
  "You're logged out on this device, but your other devices could not be logged out. Sign in again when you're online and try Log out of all devices once more.";

interface SignOutEverywhereConfirmationProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Asks before ending every session. Cancel takes initial focus, as in
 * `EventDeleteConfirmation`: the action signs the person out of every device.
 */
function SignOutEverywhereConfirmation({ onCancel, onConfirm }: SignOutEverywhereConfirmationProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = 'settings-sign-out-everywhere-title';

  useFocusTrap(panelRef, true, {
    onEscape: onCancel,
    initialFocusRef: cancelButtonRef,
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={DIALOG_BACKDROP}
      onClick={handleBackdropClick}
      data-testid="settings-sign-out-everywhere-confirmation"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`${DIALOG_PANEL} max-w-sm`}
      >
        <h3 id={titleId} className={`${DIALOG_TITLE} mb-5`}>
          Log out on every device? You'll need to sign in again on each one.
        </h3>
        <div className="flex gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            data-testid="settings-sign-out-everywhere-cancel"
            className={SECONDARY_BUTTON}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="settings-sign-out-everywhere-confirm"
            className={DESTRUCTIVE_BUTTON}
          >
            Log out everywhere
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Settings' subpages by path under /settings; the top page is built in `Settings`. */
const SUBPAGES = new Map<string, SettingsPageSpec>([
  [
    'profile',
    {
      title: 'Profile',
      titleStyle: 'large',
      render: () => <ProfilePage />,
    },
  ],
  [
    'profile/name',
    {
      title: 'Name',
      titleStyle: 'small',
      reloadsToParent: true,
      render: () => <NamePage />,
    },
  ],
  [
    'profile/birthday',
    {
      title: 'Birthday',
      titleStyle: 'small',
      reloadsToParent: true,
      render: () => <BirthdayPage />,
    },
  ],
  [
    'partner',
    {
      title: 'Partner',
      titleStyle: 'large',
      render: () => <PartnerPage />,
    },
  ],
  [
    'dates',
    {
      title: 'Dates',
      titleStyle: 'large',
      render: () => <DatesPage />,
    },
  ],
  [
    'notifications',
    {
      title: 'Notifications',
      titleStyle: 'large',
      available: hasNativePush,
      render: () => <NotificationsPage />,
    },
  ],
  [
    'photos',
    {
      title: 'Photos',
      titleStyle: 'large',
      available: canTellMobileData,
      render: () => <PhotosPage />,
    },
  ],
]);

interface SettingsProps {
  /** Replays the welcome splash; the About row is not rendered without it. */
  onShowWelcome?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onShowWelcome }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // Which sign-out is running; both buttons wait while either does.
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
  /** The "Log out on every device?" dialog is open; nothing is signed out until it confirms. */
  const [confirmingEverywhere, setConfirmingEverywhere] = useState(false);
  /** A sign-out is running; the guard `handleLogout` reads before `isLoggingOut` can. */
  const signOutRunningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const loadOwnProfile = useAppStore((s) => s.loadOwnProfile);
  // The Photos row's value; the choice itself is made on the Photos page.
  const photosOverMobileData = useSyncExternalStore(
    subscribePhotosOverMobileData,
    getPhotosOverMobileData,
    getPhotosOverMobileData
  );

  // The Profile rows and pages read the store's own profile (`profileSlice`),
  // which Home shares; this fills it when Settings opens. A failed read is not
  // surfaced in the page-level error banner: that one is for actions the user
  // just took, and the pages say what they know themselves. The slice logs a
  // failed server read (an offline one is not logged).
  useEffect(() => {
    void loadOwnProfile();
  }, [loadOwnProfile]);

  const handleLogout = async (everywhere = false) => {
    // A ref, not `isLoggingOut`: a second press in the same tick, or on the
    // confirm button while the dialog plays its exit, sees the old state.
    if (signOutRunningRef.current) return;
    setError(null);
    // Ending the other devices' sessions is a server call; refuse it up front
    // rather than sign out only this device.
    if (everywhere && !isOnline()) {
      setError(offlineMessage('Logging out of all devices', 'go through', 'needs'));
      return;
    }
    signOutRunningRef.current = true;
    setIsLoggingOut(true);
    setSigningOutEverywhere(everywhere);

    try {
      const { otherDevicesSignedOut } = await authService.signOut({ everywhere });

      // This device is signed out either way. Settings unmounts when SIGNED_OUT
      // lands, so the person is told on the login screen they land on.
      if (!otherDevicesSignedOut) showSignOutNotice(PARTIAL_SIGN_OUT_NOTICE);

      logger.debug('[Settings] User signed out successfully');

      // Session will be cleared by auth state listener in App.tsx
      // User will automatically be redirected to LoginScreen
    } catch (err) {
      console.error('[Settings] Logout failed:', err);
      setError('Failed to log out. Please try again.');
      signOutRunningRef.current = false;
      setIsLoggingOut(false);
      setSigningOutEverywhere(false);
    }
  };

  // Offline is refused before the dialog, so the person is never asked to
  // confirm what cannot go through.
  const handleSignOutEverywhereRow = () => {
    setError(null);
    if (!isOnline()) {
      setError(offlineMessage('Logging out of all devices', 'go through', 'needs'));
      return;
    }
    setConfirmingEverywhere(true);
  };

  // Stable: the dialog's focus trap re-runs on a new onEscape and puts focus
  // back on Cancel, so an inline arrow would move it on every Settings render.
  const handleCancelEverywhere = useCallback(() => setConfirmingEverywhere(false), []);

  const handleConfirmEverywhere = () => {
    setConfirmingEverywhere(false);
    void handleLogout(true);
  };

  const topPage: SettingsPageSpec = {
    title: 'Settings',
    titleStyle: 'large',
    render: () => (
      <>
        {error && (
          <div
            className="flex items-center gap-2 rounded-[14px] bg-dtint px-4 py-3 text-sm text-danger"
            role="alert"
          >
            <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Account: the Profile row opens the display name and birthday. */}
        <SettingsGroup label="Account">
          <ProfileRow key="profile" />
        </SettingsGroup>

        {/* Partner: who the account is linked to, then every date in one list. */}
        <SettingsGroup label="Partner">
          <PartnerRow key="partner" />
          <DatesRow key="dates" />
        </SettingsGroup>

        {/* Preferences: the rows whose pages exist; nothing renders where none does. */}
        <SettingsGroup label="Preferences">
          {hasNativePush() && <NotificationsRow key="notifications" />}
          {canTellMobileData() && (
            <SettingsRow
              icon={ImageIcon}
              label="Photos"
              value={photoDownloadLabel(photosOverMobileData)}
              target="photos"
              testId="settings-photos-row"
            />
          )}
        </SettingsGroup>

        <SettingsGroup label="About">
          {onShowWelcome && (
            <SettingsRow
              icon={RotateCcw}
              label="Replay welcome message"
              onClick={onShowWelcome}
              testId="settings-replay-welcome"
            />
          )}
        </SettingsGroup>

        {/* The IA's unlabeled last card, with the version line 4px under it. The
            Together and Countdowns sections and the per-date reminder list follow
            until their stories give them pages of their own. */}
        <div className="flex flex-col gap-1">
          {/* Log out — its own quiet card, not a red block. */}
          <SettingsGroup testId="settings-sign-out-card">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className={`${ROW_BUTTON} text-[15px] font-medium text-danger disabled:cursor-not-allowed disabled:opacity-60`}
              data-testid="settings-sign-out"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dtint"
                aria-hidden="true"
              >
                {isLoggingOut && !signingOutEverywhere ? (
                  <LoaderCircle className="h-4.25 w-4.25 animate-spin" />
                ) : (
                  <LogOut className="h-4.25 w-4.25" />
                )}
              </span>
              {isLoggingOut && !signingOutEverywhere ? 'Logging out…' : 'Log out'}
            </button>
            {/* For a lost or given-away phone: Log out above ends this device's
                session only. */}
            <button
              type="button"
              onClick={handleSignOutEverywhereRow}
              disabled={isLoggingOut}
              className={`${ROW_BUTTON} text-[15px] font-medium text-danger disabled:cursor-not-allowed disabled:opacity-60`}
              data-testid="settings-sign-out-everywhere"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dtint"
                aria-hidden="true"
              >
                {signingOutEverywhere ? (
                  <LoaderCircle className="h-4.25 w-4.25 animate-spin" />
                ) : (
                  <MonitorSmartphone className="h-4.25 w-4.25" />
                )}
              </span>
              {signingOutEverywhere ? 'Logging out of all devices…' : 'Log out of all devices'}
            </button>
          </SettingsGroup>
          <p className="text-center text-[13px] text-muted" data-testid="settings-version">
            Version {__APP_VERSION__} · made for the two of you
          </p>
        </div>

        {/* Together — the couple's shared dates, until their story gives them pages of their own. */}
        <section className="flex flex-col gap-2" aria-labelledby="settings-together-label">
          <h2 id="settings-together-label" className={SECTION_LABEL}>
            Together
          </h2>
          <div className={CARD}>
            <TogetherSinceRow />
            <WeddingRow />
          </div>
        </section>

        {/* Countdowns — the couple-shared events above the anniversaries. */}
        <section className="flex flex-col gap-2" aria-labelledby="settings-countdowns-label">
          <h2 id="settings-countdowns-label" className={SECTION_LABEL}>
            Countdowns
          </h2>
          <div className={CARD} data-testid="settings-countdowns-card">
            <EventsSettings />
            <div className={DIVIDER} aria-hidden="true" />
            <AnniversarySettings />
          </div>
        </section>

        {/* The per-date reminder list — only in the native shell with the local-notifications
            plugin; story 13 moves each switch onto its date's page. */}
        <CountdownMarks />

        {/* Outside every card, like the other dialogs, so no card can clip it. */}
        <AnimatePresence>
          {confirmingEverywhere && (
            <SignOutEverywhereConfirmation
              onCancel={handleCancelEverywhere}
              onConfirm={handleConfirmEverywhere}
            />
          )}
        </AnimatePresence>
      </>
    ),
  };

  // The top page is built above; every subpage is registered in `SUBPAGES`
  // (its path under /settings, title, title style, and `available` where a
  // device may not have it). Its row on the parent page is a `SettingsRow`
  // with `target`.
  const resolveSettingsPage = (path: string): SettingsPageSpec | null =>
    path === '' ? topPage : (SUBPAGES.get(path) ?? null);

  return <SettingsStack resolvePage={resolveSettingsPage} />;
};
