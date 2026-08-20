/**
 * EventCountdown — getCalendarDaysDiff boundaries + no "Event passed" path
 *
 * Story 3 (dynamic events), CAP-3: the "Event passed" branch was deleted
 * entirely — no `date` reaching this component should ever render that
 * string. A past date renders no card at all, which is also what retires a
 * card at local midnight without a dedicated midnight timer: Home's filter
 * runs only during an App render, while this component ticks every second.
 *
 * `getCalendarDaysDiff` is the exact local-midnight comparison Home's filter
 * reuses (`integration-points.md` §4) — pinned here at its yesterday/today/
 * tomorrow boundaries, and across a DST spring-forward, so a future edit
 * cannot silently shift it by one. The clock is faked throughout; the repo
 * pins `TZ=America/New_York` (`vitest.config.ts:34`).
 */
import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EventCountdown,
  getCalendarDaysDiff,
  getEventsSlotView,
  getUpcomingEventCards,
} from '../EventCountdown';

// Motion-only props are dropped rather than spread onto the DOM node: React
// rejects `whileHover`/`initial`/`animate`/`transition` on a plain <div> and
// logs a warning per render, which is the same console channel a genuine
// render error would surface on. EventCountdown imports only `m`, so nothing
// else needs mocking here.
vi.mock('framer-motion', () => ({
  m: {
    div: ({
      children,
      whileHover: _whileHover,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: { children?: ReactNode } & Record<string, unknown>) => <div {...props}>{children}</div>,
  },
}));

function localMidnightOffsetFromToday(dayOffset: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
}

// The clock is pinned for every test in this file. Without it a run that
// straddles local midnight resolves `today` differently in the helper above
// and inside the component, flipping the boundary expectations by one.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getCalendarDaysDiff', () => {
  it('returns -1 for yesterday', () => {
    expect(getCalendarDaysDiff(localMidnightOffsetFromToday(-1))).toBe(-1);
  });

  it('returns 0 for today', () => {
    expect(getCalendarDaysDiff(localMidnightOffsetFromToday(0))).toBe(0);
  });

  it('returns 1 for tomorrow', () => {
    expect(getCalendarDaysDiff(localMidnightOffsetFromToday(1))).toBe(1);
  });

  it('counts calendar days, not 24-hour spans, across a DST spring-forward', () => {
    // The repo pins TZ=America/New_York, where the clocks jump at 02:00 on
    // 2026-03-08. The 23-hour span is therefore Mar 8 -> Mar 9, NOT Mar 7 ->
    // Mar 8: midnight-to-midnight across Mar 7 is a full 24 hours because the
    // transition has not happened yet. Measured raw quotients under that zone
    // are 1.0000 for Mar 7 -> Mar 8 and 0.9583 for Mar 8 -> Mar 9, so only the
    // latter distinguishes the implementation's Math.round from Math.floor —
    // which is the choice this case exists to pin.
    vi.setSystemTime(new Date(2026, 2, 8, 12, 0, 0));
    expect(getCalendarDaysDiff(new Date(2026, 2, 9))).toBe(1);
  });

  it('counts calendar days across a DST fall-back', () => {
    // The mirror case: 2026-11-01 is a 25-hour day, raw quotient 1.0417.
    vi.setSystemTime(new Date(2026, 10, 1, 12, 0, 0));
    expect(getCalendarDaysDiff(new Date(2026, 10, 2))).toBe(1);
  });

  it('uses the caller-supplied clock rather than sampling a second one', () => {
    const now = new Date(2026, 0, 15, 23, 59, 59);
    expect(getCalendarDaysDiff(new Date(2026, 0, 16), now)).toBe(1);
  });
});

describe('EventCountdown — "Event passed" is never rendered', () => {
  it('does not render "Event passed" for a past date', () => {
    const yesterday = localMidnightOffsetFromToday(-1);

    render(<EventCountdown label="Old Event" icon="calendar" date={yesterday} />);

    expect(screen.queryByText(/Event passed/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Event passed/i);
  });

  it('renders nothing at all for a past (non-today) date', () => {
    // Home filters these out before they ever reach EventCountdown (CAP-3),
    // but the component must enforce it too: App's filter runs only during an
    // App render, while this component re-renders every second, so a card
    // whose day rolls over while Home sits open would otherwise keep its
    // shell above an empty countdown region. Asserting the label is gone —
    // not merely that a day count is absent — is what distinguishes "card
    // retired" from "card present but blank".
    const yesterday = localMidnightOffsetFromToday(-1);

    const { container } = render(
      <EventCountdown label="Old Event" icon="calendar" date={yesterday} description="Gone" />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Old Event')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/-?\d+\s*days?/i);
    expect(document.body.textContent).not.toMatch(/Event passed/i);
  });

  it('retires a card on its own interval when local midnight passes', () => {
    // The regression this guards: with only App's filter, an event dated
    // today stays mounted past midnight and the component's own 1s tick
    // repaints it with a negative day count and no matching branch.
    const today = localMidnightOffsetFromToday(0);

    const { container } = render(
      <EventCountdown label="Rollover Event" icon="calendar" date={today} />
    );

    expect(screen.getByText('Today! 🎉')).toBeInTheDocument();

    // Cross local midnight, then let the component's setInterval fire.
    vi.setSystemTime(new Date(2026, 0, 16, 0, 0, 1));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(container).toBeEmptyDOMElement();
    expect(document.body.textContent).not.toMatch(/Event passed/i);
  });

  it('notifies its parent when it retires at local midnight', () => {
    // Home filters upcoming events during App's render, which does not tick.
    // Without this callback the last event rolling over removes its own card
    // while App still counts it, and the slot shows neither a card nor the
    // "no upcoming events" placeholder.
    const onRetire = vi.fn();
    const today = localMidnightOffsetFromToday(0);

    render(
      <EventCountdown label="Rollover Event" icon="calendar" date={today} onRetire={onRetire} />
    );

    expect(onRetire).not.toHaveBeenCalled();

    vi.setSystemTime(new Date(2026, 0, 16, 0, 0, 1));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onRetire).toHaveBeenCalled();
  });

  it('does not notify a parent while the event is still upcoming', () => {
    const onRetire = vi.fn();
    const tomorrow = localMidnightOffsetFromToday(1);

    render(
      <EventCountdown label="Upcoming Event" icon="calendar" date={tomorrow} onRetire={onRetire} />
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onRetire).not.toHaveBeenCalled();
  });

  it('renders label and description for a future event', () => {
    const tomorrow = localMidnightOffsetFromToday(1);

    render(
      <EventCountdown
        label="Trip to Boston"
        icon="plane"
        date={tomorrow}
        description="Weekend visit"
      />
    );

    expect(screen.getByText('Trip to Boston')).toBeInTheDocument();
    expect(screen.getByText('Weekend visit')).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/1 day(?!s)/);
  });

  it('renders "Today! 🎉" for an event dated today', () => {
    const today = localMidnightOffsetFromToday(0);

    render(<EventCountdown label="Anniversary" icon="calendar" date={today} />);

    expect(screen.getByText('Today! 🎉')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Event passed/i);
  });
});

describe('getEventsSlotView', () => {
  it('hides the slot before the account\'s first load has settled (no empty-state flash)', () => {
    // The regression this pins: keying on eventsSlice's `eventsIsLoading`
    // instead, which initializes false and is only raised once the effect
    // runs, paints the placeholder on the first frame and then removes it.
    expect(getEventsSlotView(0, 0, false, false)).toBe('hidden');
  });

  it('shows the empty placeholder once settled with zero upcoming events', () => {
    expect(getEventsSlotView(0, 0, true, false)).toBe('empty');
  });

  it('shows the list, never hiding already-loaded cards during a background reload', () => {
    // A revisit re-triggers loadEvents() with stale data already in the
    // store: rawEventCount > 0, so the "hidden" branch must not fire even
    // before that reload settles.
    expect(getEventsSlotView(2, 2, false, false)).toBe('list');
  });

  it('shows the list once settled with upcoming events', () => {
    expect(getEventsSlotView(1, 1, true, false)).toBe('list');
  });

  it('shows the placeholder, not the list, when every stored event has passed', () => {
    expect(getEventsSlotView(3, 0, true, false)).toBe('empty');
  });

  it('reports the failure instead of claiming emptiness when the settling load failed', () => {
    // The lie this pins: loadEvents swallows its error and resolves, so the
    // .finally gate settles identically for success and failure — and an
    // offline user on Home was told "No upcoming events yet." about a list
    // nothing ever observed.
    expect(getEventsSlotView(0, 0, true, true)).toBe('error');
  });

  it('keeps showing last-good cards over an error banner when a refresh fails', () => {
    expect(getEventsSlotView(2, 2, true, true)).toBe('list');
  });

  it('stays hidden for a new account even if the previous account\'s load had failed', () => {
    // eventsLoadFailed is App state and outlives an account switch for a
    // moment; the per-user settled gate is what must decide, so a stale
    // failure flag must not surface an error for an account that has not
    // loaded yet.
    expect(getEventsSlotView(0, 0, false, true)).toBe('hidden');
  });
});

describe('getUpcomingEventCards', () => {
  /** An event dated `dayOffset` days from the pinned today. */
  const event = (id: string, dayOffset: number) => ({
    id,
    date: localMidnightOffsetFromToday(dayOffset),
  });

  it('drops events that have already passed and keeps one dated today', () => {
    const events = [event('past', -1), event('today', 0), event('soon', 3)];

    const { upcomingCount, visible } = getUpcomingEventCards(events, new Date(), 3);

    expect(visible.map((e) => e.id)).toEqual(['today', 'soon']);
    expect(upcomingCount).toBe(2);
  });

  it('renders at most maxCards, and specifically the soonest ones', () => {
    const events = [event('a', 1), event('b', 5), event('c', 9), event('d', 20)];

    const { visible } = getUpcomingEventCards(events, new Date(), 3);

    expect(visible.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('reports the UNCAPPED upcoming count, which is what the slot decision needs', () => {
    // Handing getEventsSlotView the capped length instead would make "more
    // events than fit" indistinguishable from "exactly the cap".
    const events = [event('a', 1), event('b', 2), event('c', 3), event('d', 4)];

    const { upcomingCount, visible } = getUpcomingEventCards(events, new Date(), 3);

    expect(visible).toHaveLength(3);
    expect(upcomingCount).toBe(4);
    expect(getEventsSlotView(events.length, upcomingCount, true, false)).toBe('list');
  });

  it('refills the freed slot at local midnight instead of leaving a short list', () => {
    // The state the render cap created: an upcoming event held in the store
    // and deliberately not rendered. It has to become visible when the soonest
    // card retires — App re-runs this with a later `now` off the retire tick —
    // or Home shows two cards with a third event pending until a reload.
    const events = [event('first', 0), event('second', 4), event('third', 9), event('fourth', 14)];

    const before = getUpcomingEventCards(events, new Date(), 3);
    expect(before.visible.map((e) => e.id)).toEqual(['first', 'second', 'third']);

    // One day on: 'first' is yesterday, so it leaves the filter entirely.
    vi.setSystemTime(new Date(2026, 0, 16, 12, 0, 0));
    const after = getUpcomingEventCards(events, new Date(), 3);

    expect(after.visible.map((e) => e.id)).toEqual(['second', 'third', 'fourth']);
    expect(after.upcomingCount).toBe(3);
  });

  it('returns an empty list, not a throw, when nothing is upcoming', () => {
    const { upcomingCount, visible } = getUpcomingEventCards([event('old', -30)], new Date(), 3);

    expect(visible).toEqual([]);
    expect(upcomingCount).toBe(0);
  });
});
