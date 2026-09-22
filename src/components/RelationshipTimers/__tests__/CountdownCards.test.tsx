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
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountdownTimer } from '../../CountdownTimer/CountdownTimer';
import { BirthdayCountdown } from '../BirthdayCountdown';
import { EventCountdown } from '../EventCountdown';
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
  // Noon on 10 March 2026 -- Gracie's birthday in the static config.
  vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Countdown cards on the day itself', () => {
  it('highlights the tile and reads "Happy Birthday!" on a birthday', () => {
    render(
      <BirthdayCountdown
        birthday={{ name: 'Gracie', month: 3, day: 10, birthYear: 1998 }}
        tone="partner"
      />
    );

    const card = screen.getByTestId('birthday-countdown-gracie');
    expect(card).toHaveTextContent('Gracie turns 28');
    expect(card).toHaveTextContent('Happy Birthday!');
    expectHighlighted(card);
  });

  it('uses the partner tile pair for a partner birthday that is not today', () => {
    render(
      <BirthdayCountdown
        birthday={{ name: 'Gracie', month: 3, day: 12, birthYear: 1998 }}
        tone="partner"
      />
    );

    const card = screen.getByTestId('birthday-countdown-gracie');
    // Whole 24h periods from noon to the birthday's midnight (unchanged math).
    // Exact, on the value element: a substring match also passes "11 days".
    expect(card.querySelector('h3 + div')?.textContent).toBe('1 day');
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
    // 367 days, 3h 5m 7s after the 2025-10-18 18:00 start (both EDT): past
    // the first anniversary, so the years prefix shows.
    vi.setSystemTime(new Date(2026, 9, 20, 21, 5, 7));

    render(<TimeTogether />);

    const card = screen.getByTestId('time-together');
    expect(card.querySelector('h3')?.textContent).toBe('Together for');
    expect(card.querySelector('h3 + div')?.textContent).toBe('1 year 2 days');
    expect(card).toHaveTextContent('03h 05m 07s');
    expect(card.textContent ?? '').toMatch(/\d{2}h \d{2}m \d{2}s/);
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
