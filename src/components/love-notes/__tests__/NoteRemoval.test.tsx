/**
 * Removing a message from your own history — UI
 *
 * Two things are load-bearing here and neither is cosmetic:
 *
 * 1. The control must never appear on a note that has no server row. An
 *    optimistic note's `id` IS its tempId, and a failed send keeps that id, so
 *    offering removal there would post `temp-...` into a uuid column.
 * 2. The dialog has to say who this affects. Removal is one-way and invisible to
 *    the partner, so a user who misreads it as "delete for both" cannot find out
 *    they were wrong and cannot undo it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoveNote } from '../../../types/models';
import { LoveNoteMessage } from '../LoveNoteMessage';
import { NoteRemoveConfirmation } from '../NoteRemoveConfirmation';

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: MotionDivProps) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('../../../services/loveNoteImageService', () => ({
  getSignedImageUrl: vi.fn(async () => ({ url: 'https://example.test/x.jpg', expiresAt: 0 })),
}));

vi.mock('../FullScreenImageViewer', () => ({
  FullScreenImageViewer: () => null,
}));

const committed: LoveNote = {
  id: '11111111-1111-4111-8111-111111111111',
  from_user_id: 'user-a',
  to_user_id: 'user-b',
  content: 'i love you',
  created_at: '2026-08-17T10:00:00.000Z',
};

function renderBubble(message: LoveNote, onRequestRemove?: (n: LoveNote) => void) {
  return render(
    <LoveNoteMessage
      message={message}
      isOwnMessage
      senderName="You"
      onRequestRemove={onRequestRemove}
    />
  );
}

describe('remove control on a message bubble', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers removal on a message that has a server row', () => {
    const onRequestRemove = vi.fn();
    renderBubble(committed, onRequestRemove);

    fireEvent.click(screen.getByTestId('note-remove-button'));

    expect(onRequestRemove).toHaveBeenCalledWith(committed);
  });

  it('does not offer removal while a message is still sending', () => {
    renderBubble({ ...committed, id: 'temp-1-abc', tempId: 'temp-1-abc', sending: true }, vi.fn());

    expect(screen.queryByTestId('note-remove-button')).toBeNull();
  });

  it('does not offer removal on a failed send, which keeps its temp id', () => {
    renderBubble({ ...committed, id: 'temp-1-abc', tempId: 'temp-1-abc', error: true }, vi.fn());

    expect(screen.queryByTestId('note-remove-button')).toBeNull();
  });

  it('renders no control at all when the screen passes no handler', () => {
    renderBubble(committed);

    expect(screen.queryByTestId('note-remove-button')).toBeNull();
  });

  it('labels the control for screen readers rather than relying on the icon', () => {
    renderBubble(committed, vi.fn());

    expect(screen.getByTestId('note-remove-button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('your history') as unknown as string
    );
  });
});

describe('remove confirmation dialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('states that the partner keeps their copy', () => {
    render(
      <NoteRemoveConfirmation note={committed} onClose={vi.fn()} onConfirmRemove={vi.fn()} />
    );

    expect(screen.getByText(/your partner keeps their copy/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot undo/i)).toBeInTheDocument();
  });

  it('leaves the message alone when cancelled', () => {
    const onClose = vi.fn();
    const onConfirmRemove = vi.fn();
    render(
      <NoteRemoveConfirmation
        note={committed}
        onClose={onClose}
        onConfirmRemove={onConfirmRemove}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(onConfirmRemove).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('removes only on the confirming action, then closes', async () => {
    const onClose = vi.fn();
    const onConfirmRemove = vi.fn(async () => undefined);
    render(
      <NoteRemoveConfirmation
        note={committed}
        onClose={onClose}
        onConfirmRemove={onConfirmRemove}
      />
    );

    fireEvent.click(screen.getByTestId('note-remove-confirm'));

    await waitFor(() => expect(onConfirmRemove).toHaveBeenCalledWith(committed.id));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps the dialog open and explains itself when the removal fails', async () => {
    const onClose = vi.fn();
    const onConfirmRemove = vi.fn(async () => {
      throw new Error('nope');
    });
    render(
      <NoteRemoveConfirmation
        note={committed}
        onClose={onClose}
        onConfirmRemove={onConfirmRemove}
      />
    );

    fireEvent.click(screen.getByTestId('note-remove-confirm'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });
});
