/**
 * Home countdown cards on the style kit (CAP-3)
 *
 * The "the day has arrived" states of every countdown that shares
 * CountdownCard: a birthday today, an event today and an anniversary that is
 * celebrating each highlight the icon tile (solid `bg-fill`, white icon) and
 * read a plain value with no emoji, while the card itself stays the plain kit
 * card. The clock is faked throughout; the repo pins `TZ=America/New_York`.
 */
import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountdownTimer } from '../../CountdownTimer/CountdownTimer';
import { BirthdayCountdown } from '../BirthdayCountdown';
import { BirthdayWeddingCards } from '../BirthdayWeddingCards';
import { EventCountdown } from '../EventCountdown';
import { useAppStore } from '../../../stores/useAppStore';
import { TimeTogether } from '../TimeTogether';

// Render every motion element as its plain tag, dropping animation props.
const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'whileHover']);
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => (
      <div {...Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key)))}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const EMOJI = /\p{Extended_Pictographic}/u;

/** The icon tile is the card's first child. */
function tileOf(card: HTMLElement): HTMLElement {
  return card.firstElementChild as HTMLElement;
}

function expectHighlighted(card: HTMLElement) {
  expect(tileOf(card)).toHaveClass('bg-fill', 'text-white');
  expect(card).toHaveClass('bg-card', 'border-line');
  expect(card.textContent ?? '').not.toMatch(EMOJI);
}

beforeEach(() => {
  vi.useFakeTimers();
  // Noon on 10 March 2026 -- the partner birthday used below.
  vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  useAppStore.setState({ coupleSettings: null });
});

describe('Countdown cards on the day itself', () => {
  it('highlights the tile and reads "Happy Birthday!" on a birthday', () => {
    render(
      <BirthdayCountdown
        name="Pat"
        birthday="2000-05-20"
        tone="partner"
        testId="birthday-countdown-partner"
      />
    );

    const card = screen.getByTestId('birthday-countdown-partner');
    expect(card).toHaveTextContent('Pat turns 26');
    expect(card).toHaveTextContent('Happy Birthday!');
    expectHighlighted(card);
  });

  it('uses the partner tile pair for a partner birthday that is not today', () => {
    render(
      <BirthdayCountdown
        name="Pat"
        birthday="2000-05-22"
        tone="partner"
        testId="birthday-countdown-partner"
      />
    );

    const card = screen.getByTestId('birthday-countdown-partner');
    // Calendar days, as EventCountdown counts them: 10 March -> 12 March is 2
    // whatever the time of day, not the 1 whole 24h period left from noon.
    // Exact, on the value element: a substring match also passes "12 days".
    expect(card.querySelector('h3 + div')?.textContent).toBe('2 days');
    expect(card).not.toHaveTextContent('Happy Birthday!');
    expect(tileOf(card)).toHaveClass('bg-ptint', 'text-partner');
  });

  it('highlights the tile and reads "Today!" for an event dated today', () => {
    render(<EventCountdown label="Meetup" icon="plane" date={new Date(2026, 2, 10)} />);

    const card = screen.getByTestId('event-countdown-meetup');
    expect(card).toHaveTextContent('Today!');
    expectHighlighted(card);
  });

  it('shows the muted placeholder as the value when an event has no date', () => {
    render(<EventCountdown label="Wedding" icon="ring" date={null} placeholderText="Date TBD" />);

    const card = screen.getByTestId('event-countdown-wedding');
    const value = card.querySelector('h3 + div');
    expect(value).toHaveTextContent('Date TBD');
    expect(value).toHaveClass('text-muted');
    expect(card).not.toHaveTextContent('XX:XX:XX');
    expect(tileOf(card)).toHaveClass('bg-tint', 'text-accent');
  });

  it('highlights a celebrating anniversary with Sparkles and "Today!"', () => {
    render(
      <CountdownTimer
        anniversaries={[{ id: 1, date: '2024-03-10', label: 'First date' }]}
        maxDisplay={3}
      />
    );

    const wrapper = screen.getByTestId('countdown-card-0');
    const card = wrapper.firstElementChild as HTMLElement;
    expect(card).toHaveTextContent('First date');
    expect(card).toHaveTextContent('Today!');
    expect(tileOf(card).querySelector('svg')).toHaveClass('lucide-sparkles');
    expectHighlighted(card);
  });
});

describe('Countdown cards on an ordinary day', () => {
  it('reads years and days with a padded h/m/s remainder for Together', () => {
    // 367 days, 3h 5m 7s after the 2025-10-04 18:00 start (both EDT): past
    // the first anniversary, so the years prefix shows.
    vi.setSystemTime(new Date(2026, 9, 6, 21, 5, 7));
    useAppStore.setState({
      coupleSettings: {
        status: 'linked',
        partnerId: 'partner',
        relationshipStart: new Date(2025, 9, 4, 18, 0, 0).toISOString(),
        weddingDate: null,
      },
    });

    render(<TimeTogether />);

    const card = screen.getByTestId('time-together');
    expect(card.querySelector('h3')?.textContent).toBe('Together for');
    expect(card.querySelector('h3 + div')?.textContent).toBe('1 year 2 days');
    expect(card).toHaveTextContent('03h 05m 07s');
    expect(card.textContent ?? '').toMatch(/\d{2}h \d{2}m \d{2}s/);
  });

  it('reads the same day count as an event on the same date', () => {
    render(
      <>
        <BirthdayCountdown name="Pat" birthday="2000-05-22" testId="birthday-countdown-partner" />
        <EventCountdown label="Meetup" icon="plane" date={new Date(2026, 2, 12)} />
      </>
    );

    const birthday = screen.getByTestId('birthday-countdown-partner');
    const event = screen.getByTestId('event-countdown-meetup');
    expect(birthday.querySelector('h3 + div')?.textContent).toBe(
      event.querySelector('h3 + div')?.textContent
    );
  });

  it('counts calendar days across the 23-hour DST spring-forward day', () => {
    // TZ=America/New_York springs forward at 02:00 on 8 March 2026. From
    // 01:00 on 8 March the birthday's midnight on 9 March is 22 real hours
    // away: less than one 24h period, but still one calendar day.
    vi.setSystemTime(new Date(2026, 2, 8, 1, 0, 0));
    render(
      <BirthdayCountdown name="Pat" birthday="2000-05-19" testId="birthday-countdown-partner" />
    );

    const card = screen.getByTestId('birthday-countdown-partner');
    expect(card.querySelector('h3 + div')?.textContent).toBe('1 day');
  });

  it('shows a plain calendar tile, a day count and h/m for an upcoming anniversary', () => {
    // Noon on 10 March to midnight on 14 March: 3 days 12h 0m.
    render(
      <CountdownTimer
        anniversaries={[{ id: 2, date: '2024-03-14', label: 'First kiss' }]}
        maxDisplay={3}
      />
    );

    const card = screen.getByTestId('countdown-card-0').firstElementChild as HTMLElement;
    expect(card.querySelector('h3')?.textContent).toBe('First kiss');
    expect(card.querySelector('h3 + div')?.textContent).toBe('3 days');
    expect(card).toHaveTextContent('12h 00m');
    expect(card.textContent ?? '').toMatch(/\d{2}h \d{2}m/);
    expect(tileOf(card).querySelector('svg')).toHaveClass('lucide-calendar');
    expect(tileOf(card)).toHaveClass('bg-tint', 'text-accent');
    expect(tileOf(card)).not.toHaveClass('bg-fill');
    expect(screen.queryByTestId('celebration-animation')).toBeNull();
  });
});

describe('Together for, from the couple start date', () => {
  afterEach(() => {
    useAppStore.setState({ coupleSettings: null });
  });

  it('shows the Settings placeholder for a linked couple with no start date yet', () => {
    useAppStore.setState({
      coupleSettings: {
        status: 'linked',
        partnerId: 'partner',
        relationshipStart: null,
        weddingDate: null,
      },
    });

    render(<TimeTogether />);

    const card = screen.getByTestId('time-together');
    expect(card.querySelector('h3')?.textContent).toBe('Together for');
    expect(card).toHaveTextContent('Set your start date in Settings');
    expect(card.textContent ?? '').not.toMatch(/\d{2}h \d{2}m \d{2}s/);
  });

  it('is hidden with no partner', () => {
    useAppStore.setState({ coupleSettings: { status: 'unlinked' } });

    render(<TimeTogether />);

    expect(screen.queryByTestId('time-together')).toBeNull();
  });

  it('is hidden while nothing is known yet (no saved copy, no server answer)', () => {
    useAppStore.setState({ coupleSettings: null });

    render(<TimeTogether />);

    expect(screen.queryByTestId('time-together')).toBeNull();
  });
});

describe('Birthday cards from the server-held birthdays', () => {
  it('labels your card "You turn N" when you have not chosen a name', () => {
    render(<BirthdayCountdown name={null} birthday="1999-08-14" testId="birthday-countdown-self" />);

    const card = screen.getByTestId('birthday-countdown-self');
    // Noon on 10 March 2026: the next 14 August is in 2026, the 27th birthday.
    expect(card.querySelector('h3')?.textContent).toBe('You turn 27');
    expect(tileOf(card)).toHaveClass('bg-tint', 'text-accent');
  });

  it('labels a card with the display name it is given', () => {
    render(
      <BirthdayCountdown
        name="Partner"
        birthday="2000-05-21"
        tone="partner"
        testId="birthday-countdown-partner"
      />
    );

    const card = screen.getByTestId('birthday-countdown-partner');
    expect(card.querySelector('h3')?.textContent).toBe('Partner turns 26');
    expect(card.querySelector('h3 + div')?.textContent).toBe('1 day');
  });

  it('counts to next year once this year\'s birthday has passed', () => {
    render(<BirthdayCountdown name="Sam" birthday="1990-03-09" testId="birthday-countdown-self" />);

    const card = screen.getByTestId('birthday-countdown-self');
    expect(card.querySelector('h3')?.textContent).toBe('Sam turns 37');
    expect(card.querySelector('h3 + div')?.textContent).toBe('364 days');
  });

  it('keeps an unset card in place with "Not set yet" and the Settings hint', () => {
    render(
      <BirthdayCountdown
        name={null}
        birthday={null}
        unsetDescription="Set it in Settings"
        testId="birthday-countdown-self"
      />
    );

    const card = screen.getByTestId('birthday-countdown-self');
    expect(card.querySelector('h3')?.textContent).toBe('Your birthday');
    const value = card.querySelector('h3 + div');
    expect(value?.textContent).toBe('Not set yet');
    expect(value).toHaveClass('text-muted');
    expect(card).toHaveTextContent('Set it in Settings');
  });

  it("shows the partner's unset card with no Settings hint", () => {
    render(
      <BirthdayCountdown
        name="Pat"
        birthday={null}
        tone="partner"
        testId="birthday-countdown-partner"
      />
    );

    const card = screen.getByTestId('birthday-countdown-partner');
    expect(card.querySelector('h3')?.textContent).toBe("Pat's birthday");
    expect(card.querySelector('h3 + div')?.textContent).toBe('Not set yet');
    expect(card.querySelector('p')).toBeNull();
  });

  it('treats an unreadable birthday as not set', () => {
    render(<BirthdayCountdown name="Pat" birthday="2000-02-30" testId="birthday-countdown-partner" />);

    expect(screen.getByTestId('birthday-countdown-partner')).toHaveTextContent('Not set yet');
  });
});

describe("Home's birthday and wedding cards", () => {
  const PARTNER = {
    id: 'partner',
    email: 'partner@example.test',
    displayName: 'Pat',
    connectedAt: null,
    birthday: '2000-05-22',
  };
  const LINKED = { status: 'linked', partnerId: 'partner', relationshipStart: null } as const;

  afterEach(() => {
    useAppStore.setState({ ownProfile: null, partner: null, coupleSettings: null });
  });

  it('linked: both birthday cards side by side, labelled with display names, then the wedding', () => {
    useAppStore.setState({
      ownProfile: { displayName: 'Sam', birthday: '1999-08-14' },
      partner: PARTNER,
      coupleSettings: { ...LINKED, weddingDate: '2026-06-12' },
    });

    render(<BirthdayWeddingCards />);

    expect(screen.getByTestId('birthday-cards')).toHaveClass('grid-cols-2');
    expect(screen.getByTestId('birthday-countdown-self').querySelector('h3')?.textContent).toBe(
      'Sam turns 27'
    );
    const partnerCard = screen.getByTestId('birthday-countdown-partner');
    expect(partnerCard.querySelector('h3')?.textContent).toBe('Pat turns 26');
    expect(tileOf(partnerCard)).toHaveClass('bg-ptint', 'text-partner');
    // 10 March to 12 June 2026: 94 calendar days.
    expect(
      screen.getByTestId('event-countdown-wedding').querySelector('h3 + div')?.textContent
    ).toBe('94 days');
  });

  it('with no chosen names: "You turn N" and "Partner turns N"', () => {
    useAppStore.setState({
      ownProfile: { displayName: null, birthday: '1999-08-14' },
      partner: { ...PARTNER, displayName: 'Partner' },
      coupleSettings: { ...LINKED, weddingDate: null },
    });

    render(<BirthdayWeddingCards />);

    expect(screen.getByTestId('birthday-countdown-self')).toHaveTextContent('You turn 27');
    expect(screen.getByTestId('birthday-countdown-partner')).toHaveTextContent('Partner turns 26');
  });

  it('linked with no wedding date: "Date TBD"; unset birthdays stay in place', () => {
    useAppStore.setState({
      ownProfile: { displayName: 'Sam', birthday: null },
      partner: { ...PARTNER, birthday: null },
      coupleSettings: { ...LINKED, weddingDate: null },
    });

    render(<BirthdayWeddingCards />);

    const self = screen.getByTestId('birthday-countdown-self');
    expect(self).toHaveTextContent('Not set yet');
    expect(self).toHaveTextContent('Set it in Settings');
    const partnerCard = screen.getByTestId('birthday-countdown-partner');
    expect(partnerCard).toHaveTextContent('Not set yet');
    expect(partnerCard).not.toHaveTextContent('Set it in Settings');
    expect(screen.getByTestId('event-countdown-wedding')).toHaveTextContent('Date TBD');
  });

  it('unlinked: your card only, full width, and no partner or wedding card', () => {
    useAppStore.setState({
      ownProfile: { displayName: 'Sam', birthday: '1999-08-14' },
      partner: null,
      coupleSettings: { status: 'unlinked' },
    });

    render(<BirthdayWeddingCards />);

    expect(screen.getByTestId('birthday-cards')).toHaveClass('grid-cols-1');
    expect(screen.getByTestId('birthday-countdown-self')).toBeInTheDocument();
    expect(screen.queryByTestId('birthday-countdown-partner')).toBeNull();
    expect(screen.queryByTestId('event-countdown-wedding')).toBeNull();
  });

  it('shows nothing while nothing is known yet', () => {
    render(<BirthdayWeddingCards />);

    expect(screen.queryByTestId('birthday-cards')).toBeNull();
    expect(screen.queryByTestId('event-countdown-wedding')).toBeNull();
  });

  // Matrix: "Display name changed" — the label follows the store, no reload.
  it("relabels your card when your display name changes", () => {
    useAppStore.setState({ ownProfile: { displayName: null, birthday: '1999-08-14' } });
    render(<BirthdayWeddingCards />);
    expect(screen.getByTestId('birthday-countdown-self')).toHaveTextContent('You turn 27');

    act(() => {
      useAppStore.setState({ ownProfile: { displayName: 'Sam', birthday: '1999-08-14' } });
    });

    expect(screen.getByTestId('birthday-countdown-self')).toHaveTextContent('Sam turns 27');
  });
});
