/**
 * DatesPage -- Settings > Dates (`/settings/dates`) and the top page's Dates
 * row.
 *
 * The row is a label and a chevron, no value. The page lists every date in one
 * place, each row with its date on the right, in the groups Together (Together
 * since, Wedding), Birthdays (yours, then the partner's), Events (upcoming,
 * soonest first), Anniversaries (your own) and Past (past events, newest
 * first, ending in a `Load more` row while either window has more). A group
 * with no rows is absent with its label. Everything is read from the store
 * slices that already hold it; the page writes nothing.
 *
 * Together shows for a linked couple (`coupleSettings` linked, or not loaded
 * yet with a partner), and the partner's birthday row whenever a partner is
 * known; an unset couple date reads `Not set` and its target is the date's
 * one-field page (`…/date`), while a value not known yet is left empty, never
 * `Loading...`. Events are narrowed to the account's own only on a confirmed
 * unlinked answer (`partnerKnown`, no partner, no `partnerLoadError`), since a
 * saved copy could still hold a former partner's rows.
 *
 * Settings does not refresh events (the `events` refresher skips this view), so
 * the page loads them on mount and on each connectivity change, as Home does;
 * rows show from the store at once, and an initial-load failure is not shown.
 * A return to the list (back from a date's page or a form) keeps the store's
 * window when it holds a server page and no refresh was skipped meanwhile
 * (`eventsStale`), so a date just added beyond what a load reads stays listed
 * (a load itself keeps the rows `Load more` reached).
 * `Load more` appends in place; its failure (or the offline refusal) keeps the
 * rows and shows its message in the Error box until the next `Load more` or
 * until the page is left.
 *
 * The bar's trailing `+` button (`settings-dates-add`, labelled `Add a date`)
 * opens the Kind chooser (`KindChooser`); a kind pushes `dates/new-event` or
 * `dates/new-anniversary` (`NewDatePages`), and a cancel closes it with no
 * navigation.
 *
 * The rows' targets are the date pages (`DatePages`), an event's own page
 * (`dates/event/<id>`, `EventPages`) and an anniversary's own page
 * (`dates/anniversary/<key>`, `AnniversaryPages`).
 *
 * @component
 */

import {
  Cake,
  Calendar,
  CalendarHeart,
  Gem,
  Heart,
  Plane,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseEventDate, type EventIcon } from '../../services/eventsService';
import { useAppStore } from '../../stores/useAppStore';
import { ADD_BUTTON } from '../shared/kitClasses';
import { getCalendarDaysDiff } from '../RelationshipTimers/eventCountdownHelpers';
import { KindChooser, type NewDateKind } from './NewDatePages';
import { coupleValue, formatListDate, parseInstant, yearlyValue } from './settingsFields';
import { SettingsBarAction } from './stack/SettingsBarAction';
import { SettingsGroup, SettingsRow } from './stack/SettingsRows';
import { useSettingsPage } from './stack/settingsPageContext';
import { ROW_BUTTON } from './SwitchRow';
import { ErrorBox } from './ErrorBox';

/** An event's tile, the same three icons as `EventCountdown`. */
const EVENT_ICONS: Record<EventIcon, LucideIcon> = {
  ring: Gem,
  plane: Plane,
  calendar: Calendar,
};

/** The top page's Dates row: a label and a chevron, no value. */
export function DatesRow() {
  return <SettingsRow icon={CalendarHeart} label="Dates" target="dates" testId="settings-dates-row" />;
}

export function DatesPage() {
  const userId = useAppStore((s) => s.userId);
  const authSessionVersion = useAppStore((s) => s.authSessionVersion);
  const isOnline = useAppStore((s) => s.syncStatus.isOnline);
  const events = useAppStore((s) => s.events);
  const eventsPagination = useAppStore((s) => s.eventsPagination);
  const eventsStale = useAppStore((s) => s.eventsStale);
  const eventsIsLoading = useAppStore((s) => s.eventsIsLoading);
  const eventsIsLoadingMore = useAppStore((s) => s.eventsIsLoadingMore);
  const loadEvents = useAppStore((s) => s.loadEvents);
  const loadMoreEvents = useAppStore((s) => s.loadMoreEvents);
  const openSettingsPage = useAppStore((s) => s.openSettingsPage);
  const coupleSettings = useAppStore((s) => s.coupleSettings);
  const anniversaries = useAppStore((s) => s.settings?.relationship.anniversaries);
  const ownProfile = useAppStore((s) => s.ownProfile);
  const partner = useAppStore((s) => s.partner);
  const partnerKnown = useAppStore((s) => s.partnerKnown);
  const partnerLoadError = useAppStore((s) => s.partnerLoadError);

  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  /** The kind picked in the chooser, whose page opens once the chooser is off screen. */
  const [chosen, setChosen] = useState<NewDateKind | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    // Re-armed on setup so StrictMode's cleanup/setup replay leaves the live page settled.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Events are not refreshed while Settings is open, so the page asks, as Home
  // does. Either connectivity change re-asks: offline settles on the saved copy,
  // reconnecting fetches. The outcome is not shown: it is not an action just tried.
  // Coming back to the list (from a date's page or a form) does not ask when the
  // store already holds a server page: a load keeps the depth `Load more` had
  // reached, but it replaces the list with the server's rows, which would drop
  // a date just added beyond that depth. A refresh skipped while the list was
  // away (`eventsStale`) or a failed load (`eventsError`) still asks. The skip
  // holds only for the arrival's own account, session and connectivity, so
  // StrictMode's replay skips too and any later change asks as before.
  const { arrivedBack } = useSettingsPage();
  const eventsError = useAppStore((s) => s.eventsError);
  const keptOnArrival = useRef(
    arrivedBack && eventsPagination !== null && !eventsStale && eventsError === null
      ? `${userId}:${authSessionVersion}:${isOnline}`
      : null
  );
  // Whether a load has answered the current stale mark (below).
  const staleAnswered = useRef(false);
  useEffect(() => {
    if (!userId) return;
    if (keptOnArrival.current === `${userId}:${authSessionVersion}:${isOnline}`) return;
    keptOnArrival.current = null;
    staleAnswered.current = true;
    void loadEvents();
  }, [userId, authSessionVersion, isOnline, loadEvents]);

  // A refresh skipped while the list shows (the iPhone shell's return to the
  // foreground or a token renewal marks the list stale) asks now, so the list
  // is fresh before a date is opened from it. Asked once per mark: not again
  // when the load fails, not while a load is on its way (it clears the mark),
  // and not while the store still reads offline, as a reconnect's own
  // connectivity change asks just after, through the effect above.
  useEffect(() => {
    if (!eventsStale) {
      staleAnswered.current = false;
      return;
    }
    if (staleAnswered.current || !userId || eventsIsLoading || !isOnline) return;
    staleAnswered.current = true;
    void loadEvents();
  }, [eventsStale, eventsIsLoading, isOnline, userId, loadEvents]);

  const handleLoadMore = async () => {
    setLoadMoreError(null);
    const result = await loadMoreEvents();
    if (mounted.current && result.status === 'failure') setLoadMoreError(result.error);
  };

  // Stable: the dialog's focus trap re-runs on a new Escape handler.
  const cancelChoosing = useCallback(() => setChoosing(false), []);

  // The chooser closes at once, with no fade, and the kind's form page is
  // pushed (one history entry) only after a frame without it has been drawn.
  // The iPhone shell pictures the page being left when the URL changes, and
  // its back swipe slides that picture in, so a push while the chooser was
  // still on screen brought the chooser back for a moment on the swipe.
  const choose = (kind: NewDateKind) => {
    setChoosing(false);
    setChosen(kind);
  };
  useEffect(() => {
    if (chosen === null) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() =>
        openSettingsPage(chosen === 'event' ? 'dates/new-event' : 'dates/new-anniversary')
      );
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [chosen, openSettingsPage]);

  const now = new Date();
  const linked =
    coupleSettings?.status === 'linked' || (coupleSettings === null && partner !== null);
  const confirmedUnlinked = partnerKnown && partner === null && !partnerLoadError;
  const visibleEvents = confirmedUnlinked ? events.filter((event) => event.userId === userId) : events;
  // Soonest first as the store keeps them; today counts as upcoming, as on Home.
  const upcoming = visibleEvents.filter((event) => getCalendarDaysDiff(event.date, now) >= 0);
  const past = visibleEvents.filter((event) => getCalendarDaysDiff(event.date, now) < 0).reverse();
  const hasMore = Boolean(eventsPagination?.upcoming.hasMore || eventsPagination?.past.hasMore);

  const coupleLoaded = coupleSettings?.status === 'linked';
  const start = coupleSettings?.status === 'linked' ? coupleSettings.relationshipStart : null;
  const wedding = coupleSettings?.status === 'linked' ? coupleSettings.weddingDate : null;
  // A loaded `Not set` opens the date's one-field page directly.
  const sinceTarget = coupleLoaded && !start ? 'dates/together-since/date' : 'dates/together-since';
  const weddingTarget = coupleLoaded && !wedding ? 'dates/wedding/date' : 'dates/wedding';

  return (
    <>
      <SettingsBarAction>
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className={ADD_BUTTON}
          aria-label="Add a date"
          data-testid="settings-dates-add"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </SettingsBarAction>

      {loadMoreError && <ErrorBox message={loadMoreError} testId="settings-dates-error" />}

      {linked && (
        <SettingsGroup label="Together" testId="settings-dates-together">
          <SettingsRow
            key="together-since"
            icon={Heart}
            label="Together since"
            value={coupleValue(coupleLoaded, start, parseInstant, now)}
            target={sinceTarget}
            testId="settings-dates-together-since"
          />
          <SettingsRow
            key="wedding"
            icon={Gem}
            label="Wedding"
            value={coupleValue(coupleLoaded, wedding, parseEventDate, now)}
            target={weddingTarget}
            testId="settings-dates-wedding"
          />
        </SettingsGroup>
      )}

      <SettingsGroup label="Birthdays" testId="settings-dates-birthdays">
        <SettingsRow
          key="self"
          icon={Cake}
          label="You"
          value={ownProfile ? yearlyValue(ownProfile.birthday) : undefined}
          target="dates/birthday"
          testId="settings-dates-birthday-self"
        />
        {partner && (
          <SettingsRow
            key="partner"
            icon={Cake}
            label={partner.displayName}
            value={yearlyValue(partner.birthday)}
            target="dates/partner-birthday"
            testId="settings-dates-birthday-partner"
          />
        )}
      </SettingsGroup>

      <SettingsGroup label="Events" testId="settings-dates-events">
        {upcoming.map((event) => (
          <SettingsRow
            key={event.id}
            icon={EVENT_ICONS[event.icon]}
            label={event.label}
            value={formatListDate(event.date, now)}
            target={`dates/event/${event.id}`}
            testId={`settings-dates-event-${event.id}`}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup label="Anniversaries" testId="settings-dates-anniversaries">
        {anniversaries?.map((anniversary) => {
          const key = anniversary.serverId ?? String(anniversary.id);
          return (
            <SettingsRow
              key={key}
              icon={Heart}
              label={anniversary.label}
              value={yearlyValue(anniversary.date)}
              target={`dates/anniversary/${key}`}
              testId={`settings-dates-anniversary-${key}`}
            />
          );
        })}
      </SettingsGroup>

      <SettingsGroup label="Past" testId="settings-dates-past">
        {past.map((event) => (
          <SettingsRow
            key={event.id}
            icon={EVENT_ICONS[event.icon]}
            label={event.label}
            value={formatListDate(event.date, now)}
            target={`dates/event/${event.id}`}
            testId={`settings-dates-event-${event.id}`}
          />
        ))}
        {hasMore && (
          <button
            key="load-more"
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={eventsIsLoading || eventsIsLoadingMore}
            className={`${ROW_BUTTON} text-[15px] font-medium text-ink disabled:cursor-not-allowed disabled:opacity-60`}
            data-testid="settings-dates-load-more"
          >
            Load more
          </button>
        )}
      </SettingsGroup>

      {/* Outside every card, like the other dialogs, so no card can clip it. */}
      {/* Unmounting the AnimatePresence itself drops the chooser with no exit fade. */}
      {chosen === null && (
        <AnimatePresence>
          {choosing && <KindChooser onChoose={choose} onCancel={cancelChoosing} />}
        </AnimatePresence>
      )}
    </>
  );
}
