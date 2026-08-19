/**
 * AnniversarySettings renders the calendar date the user picked.
 *
 * `anniversary.date` is a bare "YYYY-MM-DD"; fed to `new Date(...)` that is
 * the ECMA-262 date-only form, parsed as UTC midnight — so under this suite's
 * pinned TZ=America/New_York the list showed the PREVIOUS day, disagreeing
 * with Home's countdown, which splits the string into local components.
 */
import { render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: MotionDivProps) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import { useAppStore } from '../../../stores/useAppStore';
import { AnniversarySettings } from '../AnniversarySettings';

describe('AnniversarySettings date display', () => {
  it('shows the picked calendar day, not its UTC rendering', () => {
    // settingsSlice seeds `settings` non-null defaults, so the assertion holds.
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings!,
        relationship: {
          ...useAppStore.getState().settings!.relationship,
          anniversaries: [{ id: 1, date: '2025-11-26', label: 'First kiss' }],
        },
      },
    } as Parameters<typeof useAppStore.setState>[0]);

    render(<AnniversarySettings />);

    expect(screen.getByText('November 26, 2025')).toBeInTheDocument();
    expect(screen.queryByText('November 25, 2025')).toBeNull();
  });
});
