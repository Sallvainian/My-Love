/**
 * Settings Component
 *
 * Application settings on the style kit, as a stack of pages (`SettingsStack`).
 * The top page holds the Account group (the Profile row), the Partner group
 * (the Partner and Dates rows), the preferences and about groups, the log-out
 * card and the version line, and nothing else. Profile (the display name and
 * your own birthday, each on a one-field page, see `ProfilePage`), Partner (who the account is linked to, see
 * `PartnerPage`), Dates (every date in one list, see `DatesPage`) and the
 * pages its Together since, Wedding and birthday rows open (see `DatePages`),
 * an event's own page and its four one-field pages (`dates/event/<id>…`, see
 * `EventPages`; matched in `resolveSettingsPage` since the path carries an id),
 * an anniversary's own page and its three one-field pages
 * (`dates/anniversary/<key>…`, see `AnniversaryPages`; matched the same way),
 * the New event and New anniversary form pages the Dates list's `+` button
 * opens (`dates/new-event`, `dates/new-anniversary`, see `NewDatePages`),
 * Photos (this device's mobile-data choice for the offline album)
 * and Notifications (a switch for each kind of
 * push and the Date reminders switch; the native shell with the push plugins
 * only, see `NotificationsPage`) are the subpages.
 *
 * @component
 */

import {
  CircleAlert,
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
} from 'react';
import { authService } from '../../api/authService';
import { isOnline } from '../../api/errorHandlers';
import { offlineMessage } from '../../services/accountDataError';
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
  DESTRUCTIVE_BUTTON,
  DIALOG_BACKDROP,
  DIALOG_PANEL,
  DIALOG_TITLE,
  SECONDARY_BUTTON,
} from '../shared/kitClasses';
import { AnniversaryFieldPage, AnniversaryPage, type AnniversaryField } from './AnniversaryPages';
import {
  PartnerBirthdayPage,
  TogetherSinceDatePage,
  TogetherSincePage,
  WeddingDatePage,
  WeddingPage,
  YourBirthdayPage,
} from './DatePages';
import { DatesPage, DatesRow } from './DatesPage';
import { EventFieldPage, EventPage, type EventField } from './EventPages';
import { NewAnniversaryPage, NewEventPage } from './NewDatePages';
import { NotificationsPage, NotificationsRow } from './NotificationsPage';
import { PartnerPage, PartnerRow } from './PartnerPage';
import { PhotosPage } from './PhotosPage';
import { BirthdayPage, NamePage, ProfilePage, ProfileRow } from './ProfilePage';
import { SettingsGroup, SettingsRow } from './stack/SettingsRows';
import { SettingsStack, type SettingsPageSpec } from './stack/SettingsStack';
import { ROW_BUTTON } from './SwitchRow';

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
    'dates/new-event',
    {
      title: 'New event',
      titleStyle: 'small',
      reloadsToParent: true,
      leading: 'cancel',
      render: () => <NewEventPage />,
    },
  ],
  [
    'dates/new-anniversary',
    {
      title: 'New anniversary',
      titleStyle: 'small',
      reloadsToParent: true,
      leading: 'cancel',
      render: () => <NewAnniversaryPage />,
    },
  ],
  [
    'dates/together-since',
    {
      title: 'Together since',
      titleStyle: 'small',
      render: () => <TogetherSincePage />,
    },
  ],
  [
    'dates/together-since/date',
    {
      title: 'Date',
      titleStyle: 'small',
      reloadsToParent: true,
      render: () => <TogetherSinceDatePage />,
    },
  ],
  [
    'dates/wedding',
    {
      title: 'Wedding',
      titleStyle: 'small',
      render: () => <WeddingPage />,
    },
  ],
  [
    'dates/wedding/date',
    {
      title: 'Date',
      titleStyle: 'small',
      reloadsToParent: true,
      render: () => <WeddingDatePage />,
    },
  ],
  [
    'dates/birthday',
    {
      title: 'Your birthday',
      titleStyle: 'small',
      render: () => <YourBirthdayPage />,
    },
  ],
  [
    'dates/birthday/date',
    {
      title: 'Date',
      titleStyle: 'small',
      reloadsToParent: true,
      render: () => <BirthdayPage />,
    },
  ],
  [
    'dates/partner-birthday',
    {
      // The partner's name is not known here; `Settings` titles the page with it.
      title: 'Birthday',
      titleStyle: 'small',
      render: () => <PartnerBirthdayPage />,
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

/**
 * Whether the subpage at `path` exists on this device. A top-page row whose page
 * has `available` reads the same check the page uses, from `SUBPAGES`, rather
 * than calling that function again. A path missing from `SUBPAGES` counts as
 * available.
 */
function subpageAvailable(path: string): boolean {
  return SUBPAGES.get(path)?.available?.() !== false;
}

/** `dates/event/<id>` and its field pages; the id is any one path segment. */
const EVENT_PATH = /^dates\/event\/([^/]+)(?:\/(name|date|note|icon))?$/;

const EVENT_FIELD_TITLES: Record<EventField, string> = {
  name: 'Name',
  date: 'Date',
  note: 'Note',
  icon: 'Icon',
};

/** `dates/anniversary/<key>` and its field pages; the key is any one path segment. */
const ANNIVERSARY_PATH = /^dates\/anniversary\/([^/]+)(?:\/(name|date|note))?$/;

const ANNIVERSARY_FIELD_TITLES: Record<AnniversaryField, string> = {
  name: 'Name',
  date: 'Date',
  note: 'Note',
};

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
  // The partner's birthday page is titled with their name, which `SUBPAGES` cannot know.
  const partnerName = useAppStore((s) => s.partner?.displayName);
  // An event's page is titled with its name, which `SUBPAGES` cannot know either.
  const events = useAppStore((s) => s.events);
  // An anniversary's page is titled with its label, which `SUBPAGES` cannot know either.
  const anniversaries = useAppStore((s) => s.settings?.relationship.anniversaries);
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
          {subpageAvailable('notifications') && <NotificationsRow key="notifications" />}
          {subpageAvailable('photos') && (
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

        {/* The IA's unlabeled last card, with the version line 4px under it. */}
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
  // device may not have it), except the event pages, whose path carries an id
  // and which are matched here (the anniversary pages, whose path carries a key,
  // are matched here too). Its row on the parent page is a `SettingsRow`
  // with `target`.
  const resolveSettingsPage = (path: string): SettingsPageSpec | null => {
    if (path === '') return topPage;
    const eventMatch = EVENT_PATH.exec(path);
    if (eventMatch) {
      const eventId = eventMatch[1];
      const field = eventMatch[2] as EventField | undefined;
      if (field) {
        return {
          title: EVENT_FIELD_TITLES[field],
          titleStyle: 'small',
          reloadsToParent: true,
          render: () => <EventFieldPage eventId={eventId} field={field} />,
        };
      }
      return {
        title: events.find((event) => event.id === eventId)?.label ?? 'Event',
        titleStyle: 'small',
        render: () => <EventPage eventId={eventId} />,
      };
    }
    const anniversaryMatch = ANNIVERSARY_PATH.exec(path);
    if (anniversaryMatch) {
      const anniversaryKey = anniversaryMatch[1];
      const field = anniversaryMatch[2] as AnniversaryField | undefined;
      if (field) {
        return {
          title: ANNIVERSARY_FIELD_TITLES[field],
          titleStyle: 'small',
          reloadsToParent: true,
          render: () => <AnniversaryFieldPage anniversaryKey={anniversaryKey} field={field} />,
        };
      }
      const anniversary = anniversaries?.find(
        (candidate) => (candidate.serverId ?? String(candidate.id)) === anniversaryKey
      );
      return {
        title: anniversary?.label ?? 'Anniversary',
        titleStyle: 'small',
        render: () => <AnniversaryPage anniversaryKey={anniversaryKey} />,
      };
    }
    const spec = SUBPAGES.get(path) ?? null;
    if (spec && path === 'dates/partner-birthday' && partnerName) {
      return { ...spec, title: `${partnerName}'s birthday` };
    }
    return spec;
  };

  return <SettingsStack resolvePage={resolveSettingsPage} />;
};
