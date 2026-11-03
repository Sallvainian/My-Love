/**
 * CountdownCard's tap target: with `onOpen` the whole card is a button laid
 * over it as a sibling of the content, so the label stays a level-3 heading;
 * without it the card renders as before, no button.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Heart } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CountdownCard } from '../CountdownCard';

afterEach(cleanup);

describe('CountdownCard onOpen', () => {
  it('renders no button without onOpen, and the card is not positioned for one', () => {
    render(<CountdownCard icon={Heart} label="Wedding" value="5 days" testId="card" />);

    const card = screen.getByTestId('card');
    expect(within(card).queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('card-open')).toBeNull();
    expect(card).not.toHaveClass('relative');
    expect(card).not.toHaveClass('transition-opacity');
  });

  it('overlays one button named by the label, keeping the heading and content as siblings', () => {
    render(<CountdownCard icon={Heart} label="Wedding" value="5 days" testId="card" onOpen={vi.fn()} />);

    const card = screen.getByTestId('card');
    const button = screen.getByTestId('card-open');
    expect(card).toHaveClass('relative');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAccessibleName('Wedding');
    expect(button).toHaveClass('absolute', 'inset-0', 'rounded-[20px]');
    // The pressed state is on the card: the transparent button's own opacity shows nothing.
    expect(card).toHaveClass('transition-opacity', 'hover:opacity-90', 'active:opacity-90');
    expect(button).not.toHaveClass('transition-opacity', 'hover:opacity-90');
    expect(button).toHaveClass('focus:outline-hidden', 'focus-visible:ring-2', 'focus-visible:ring-accent');
    expect(within(card).getAllByRole('button')).toHaveLength(1);
    // The button has no children, so the heading is still a heading.
    expect(button).toBeEmptyDOMElement();
    expect(within(card).getByRole('heading', { level: 3, name: 'Wedding' })).toBeInTheDocument();
    expect(within(card).getByTestId('countdown-value')).toHaveTextContent('5 days');
  });

  it('calls onOpen once per click', () => {
    const onOpen = vi.fn();
    render(<CountdownCard icon={Heart} label="Wedding" value="5 days" testId="card" onOpen={onOpen} />);

    fireEvent.click(screen.getByTestId('card-open'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
