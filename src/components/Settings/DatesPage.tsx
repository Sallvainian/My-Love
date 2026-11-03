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
 * `Load more` appends in place; its failure (or the offline refusal) keeps the
 * rows and shows its message in the Error box until the next `Load more` or
 * until the page is left.
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
  CircleAlert,
  Gem,
  Heart,
  Plane,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseEventDate, type EventIcon } from '../../services/eventsService';
import { useAppStore } from '../../stores/useAppStore';
import { FAILURE_BOX } from '../shared/kitClasses';
import { getCalendarDaysDiff } from '../RelationshipTimers/eventCountdownHelpers';
import { coupleValue, formatListDate, parseInstant, yearlyValue } from './settingsFields';
import { SettingsGroup, SettingsRow } from './stack/SettingsRows';
import { ROW_BUTTON } from './SwitchRow';

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
  const eventsIsLoading = useAppStore((s) => s.eventsIsLoading);
  const eventsIsLoadingMore = useAppStore((s) => s.eventsIsLoadingMore);
  const loadEvents = useAppStore((s) => s.loadEvents);
  const loadMoreEvents = useAppStore((s) => s.loadMoreEvents);
  const coupleSettings = useAppStore((s) => s.coupleSettings);
  const anniversaries = useAppStore((s) => s.settings?.relationship.anniversaries);
  const ownProfile = useAppStore((s) => s.ownProfile);
  const partner = useAppStore((s) => s.partner);
  const partnerKnown = useAppStore((s) => s.partnerKnown);
  const partnerLoadError = useAppStore((s) => s.partnerLoadError);

  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
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
  useEffect(() => {
    if (!userId) return;
    void loadEvents();
  }, [userId, authSessionVersion, isOnline, loadEvents]);

  const handleLoadMore = async () => {
    setLoadMoreError(null);
    const result = await loadMoreEvents();
    if (mounted.current && result.status === 'failure') setLoadMoreError(result.error);
  };

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
      {loadMoreError && (
        <div
          className={`${FAILURE_BOX} flex items-start gap-2`}
          role="alert"
          data-testid="settings-dates-error"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loadMoreError}</span>
        </div>
      )}

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
    </>
  );
}
