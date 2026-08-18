/**
 * MoodDetailModal — focus behaviour
 *
 * This component's own doc block claims "Focus returns to trigger on close
 * (accessibility)" (MoodDetailModal.tsx:77), and MoodHistoryCalendar.tsx:173
 * states the same as AC-4. Neither was true: useFocusTrap took focus and never
 * gave it back. Nothing here had a test file at all, so the gap between the
 * stated acceptance criterion and the behaviour went unnoticed.
 *
 * These pin the contract rather than the implementation, so the shared hook can
 * be changed again with something other than hope behind it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MoodEntry } from '../../../types';
import { MoodDetailModal } from '../MoodDetailModal';

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const mood: MoodEntry = {
  userId: 'USER-A',
  mood: 'happy',
  moods: ['happy'],
  note: 'a good day',
  date: '2026-08-17',
  timestamp: new Date('2026-08-17T15:42:00.000Z'),
  synced: true,
};

function Harness({ open, onClose = vi.fn() }: { open: boolean; onClose?: () => void }) {
  return (
    <>
      <button data-testid="trigger">open</button>
      <MoodDetailModal mood={open ? mood : null} onClose={onClose} />
    </>
  );
}

describe('MoodDetailModal focus', () => {
  it('moves focus into the dialog when it opens', async () => {
    const { rerender } = render(<Harness open={false} />);
    screen.getByTestId('trigger').focus();

    rerender(<Harness open />);

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('modal-close-button'))
    );
  });

  it('returns focus to the trigger on close, as its AC states', async () => {
    const { rerender } = render(<Harness open={false} />);
    screen.getByTestId('trigger').focus();

    rerender(<Harness open />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('modal-close-button'))
    );

    rerender(<Harness open={false} />);

    expect(document.activeElement).toBe(screen.getByTestId('trigger'));
  });

  it('closes on Escape from inside the dialog', async () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('modal-close-button'))
    );
    fireEvent.keyDown(screen.getByTestId('modal-close-button'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
