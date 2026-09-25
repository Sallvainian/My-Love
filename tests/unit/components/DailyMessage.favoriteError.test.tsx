/**
 * A favorite write that fails (offline included) must be visible, not just
 * logged: the heart is server-first now, and a silent failure would leave the
 * user believing the favorite was saved.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

// Render every motion element as its plain tag, dropping animation props.
const MOTION_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'variants', 'custom', 'drag', 'dragConstraints',
  'dragElastic', 'onDragEnd', 'whileHover', 'whileTap', 'layout',
]);
vi.mock('motion/react', () => ({
  m: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
          createElement(
            tag,
            Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key))),
            children
          ),
    }
  ),
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import { DailyMessage } from '../../../src/components/DailyMessage/DailyMessage';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { AppState } from '../../../src/stores/types';

afterEach(() => {
  cleanup();
});

function showMessage(favoriteError: string | null) {
  const message = {
    id: 1,
    text: 'You make every day brighter.',
    category: 'reason' as const,
    isCustom: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  useAppStore.setState({
    userId: 'USER-A',
    messages: [message],
    currentMessage: message,
    favoriteError,
  } as Partial<AppState>);
}

describe('DailyMessage favorite error', () => {
  it('shows the reason in an alert beside the heart', () => {
    showMessage('You are offline. Favorites need a connection to save.');

    render(<DailyMessage />);

    const alert = screen.getByTestId('message-favorite-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('You are offline. Favorites need a connection to save.');
    expect(screen.getByRole('alert')).toBe(alert);
  });

  it('shows no alert when there is no error', () => {
    showMessage(null);

    render(<DailyMessage />);

    expect(screen.getByTestId('message-text')).toBeInTheDocument();
    expect(screen.queryByTestId('message-favorite-error')).toBeNull();
  });
});

describe('DailyMessage category chip', () => {
  it('labels a reason message "Why I Love You" with a lucide heart and no emoji', () => {
    showMessage(null);

    render(<DailyMessage />);

    const chip = screen.getByTestId('message-category-badge');
    expect(chip).toHaveTextContent('Why I Love You');
    expect(chip.textContent?.trim()).toBe('Why I Love You');
    expect(chip.querySelector('svg.lucide-heart')).not.toBeNull();
    expect(chip.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
