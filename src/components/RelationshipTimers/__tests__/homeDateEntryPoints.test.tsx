/**
 * Home's date cards open the date pages: each card calls the real store's
 * `openSettingsPage` with its exact path and the from-Home mark, so the entry
 * carries `from: 'home'` and the flag is set.
 */
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountdownTimer } from '../../CountdownTimer/CountdownTimer';
import { BirthdayWeddingCards } from '../BirthdayWeddingCards';
import { EventCountdown } from '../EventCountdown';
import { TimeTogether } from '../TimeTogether';
import { useAppStore } from '../../../stores/useAppStore';

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'whileHover']);
vi.mock('motion/react', () => ({
  m: {
    div: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => (
      <div {...Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key)))}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const PARTNER = {
  id: 'partner',
  email: 'partner@example.test',
  displayName: 'Pat',
  linkedSince: null,
  birthday: '2000-03-18',
};
const SAM = { displayName: 'Sam', birthday: '1999-08-14' };

function resetStore() {
  useAppStore.setState({
    currentView: 'home',
    settingsPath: '',
    settingsFromHome: false,
    ownProfile: null,
    partner: null,
    coupleSettings: null,
  });
}

/** The page the last tap opened, as the store and the history entry say it. */
function expectOpened(path: string) {
  expect(useAppStore.getState()).toMatchObject({
    currentView: 'settings',
    settingsPath: path,
    settingsFromHome: true,
  });
  expect(window.location.pathname).toBe(`/settings/${path}`);
  expect(window.history.state).toEqual({
    view: 'settings',
    settingsPath: path,
    inApp: true,
    from: 'home',
  });
}

describe("Home's date cards open the date pages", () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    resetStore();
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
    resetStore();
  });

  it('opens Together since from the counter', () => {
    useAppStore.setState({
      coupleSettings: {
        status: 'linked',
        partnerId: 'partner',
        relationshipStart: new Date(2025, 9, 4, 18, 0, 0).toISOString(),
        weddingDate: null,
      },
    });
    render(<TimeTogether />);

    fireEvent.click(screen.getByTestId('time-together-open'));

    expectOpened('dates/together-since');
  });

  it('opens Together since from the "Not set yet" card too', () => {
    useAppStore.setState({
      coupleSettings: {
        status: 'linked',
        partnerId: 'partner',
        relationshipStart: null,
        weddingDate: null,
      },
    });
    render(<TimeTogether />);

    fireEvent.click(screen.getByTestId('time-together-open'));

    expectOpened('dates/together-since');
  });

  it('opens your birthday, the partner\'s birthday and the wedding from their cards', () => {
    useAppStore.setState({
      ownProfile: SAM,
      partner: PARTNER,
      coupleSettings: {
        status: 'linked',
        partnerId: 'partner',
        relationshipStart: null,
        weddingDate: '2999-06-12',
      },
    });
    render(<BirthdayWeddingCards />);

    fireEvent.click(screen.getByTestId('birthday-countdown-self-open'));
    expectOpened('dates/birthday');

    fireEvent.click(screen.getByTestId('birthday-countdown-partner-open'));
    expectOpened('dates/partner-birthday');

    fireEvent.click(screen.getByTestId('event-countdown-wedding-open'));
    expectOpened('dates/wedding');
  });

  it('opens a birthday page from a card whose birthday is not set', () => {
    useAppStore.setState({
      ownProfile: { ...SAM, birthday: null },
      partner: null,
      coupleSettings: { status: 'unlinked' },
    });
    render(<BirthdayWeddingCards />);

    fireEvent.click(screen.getByTestId('birthday-countdown-self-open'));

    expectOpened('dates/birthday');
  });

  it('opens an anniversary by its server id, or by its local id until it has one', () => {
    render(
      <CountdownTimer
        anniversaries={[
          { id: 1, date: '2024-03-16', label: 'First date', serverId: 'srv-1' },
          { id: 2, date: '2024-04-16', label: 'Second date' },
        ]}
        maxDisplay={3}
      />
    );

    fireEvent.click(screen.getByTestId('anniversary-countdown-1-open'));
    expectOpened('dates/anniversary/srv-1');

    fireEvent.click(screen.getByTestId('anniversary-countdown-2-open'));
    expectOpened('dates/anniversary/2');
  });

  it('opens whatever page an EventCountdown is given, and is no button without one', () => {
    const onOpen = vi.fn();
    render(
      <>
        <EventCountdown label="Meetup" icon="plane" date={new Date(2999, 0, 1)} onOpen={onOpen} />
        <EventCountdown label="Trip" icon="plane" date={new Date(2999, 0, 1)} />
      </>
    );

    fireEvent.click(screen.getByTestId('event-countdown-meetup-open'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('event-countdown-trip-open')).toBeNull();
  });
});
