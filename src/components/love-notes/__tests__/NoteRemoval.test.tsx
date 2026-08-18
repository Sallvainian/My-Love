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
import { useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoveNote } from '../../../types/models';
import { LoveNoteMessage } from '../LoveNoteMessage';
import { MessageList } from '../MessageList';
import { NoteRemoveConfirmation } from '../NoteRemoveConfirmation';

// Most of these cases never exercise the fallback; they only need the prop to
// satisfy the contract. The two that do exercise it pass a real ref.
const inertFallback = { current: null } as React.RefObject<HTMLElement | null>;

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

function renderBubble(
  message: LoveNote,
  onRequestRemove?: (n: LoveNote) => void,
  isOwnMessage = true
) {
  return render(
    <LoveNoteMessage
      message={message}
      isOwnMessage={isOwnMessage}
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

  it('offers removal on a message the partner sent, not just your own', () => {
    const onRequestRemove = vi.fn();
    // Narrowing this to own messages only would be a plausible edit and would
    // silently drop half the feature — the spec is explicit that a user can
    // remove a message they received.
    renderBubble({ ...committed, from_user_id: 'user-b', to_user_id: 'user-a' }, onRequestRemove, false);

    fireEvent.click(screen.getByTestId('note-remove-button'));

    expect(onRequestRemove).toHaveBeenCalled();
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
      <NoteRemoveConfirmation note={committed} onClose={vi.fn()} onConfirmRemove={vi.fn()} fallbackFocusRef={inertFallback} />
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
        fallbackFocusRef={inertFallback}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(onConfirmRemove).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('returns focus to the control that opened it when dismissed', async () => {
    // The trash button is still mounted behind the dialog, so dropping focus on
    // <body> at dismissal loses a keyboard user's place in the thread.
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button data-testid="trigger">remove</button>
          {open && (
            <NoteRemoveConfirmation
              note={committed}
              onClose={vi.fn()}
              onConfirmRemove={vi.fn()}
              fallbackFocusRef={inertFallback}
            />
          )}
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    screen.getByTestId('trigger').focus();

    rerender(<Harness open />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Cancel')));

    rerender(<Harness open={false} />);

    expect(document.activeElement).toBe(screen.getByTestId('trigger'));
  });

  it('lands focus on the thread when the row that opened it is removed', async () => {
    // The success path. Confirming unmounts the row and the control that opened
    // this dialog with it, so restoring to the opener is a no-op and focus would
    // fall to <body> -- losing a keyboard user's place entirely.
    function Harness() {
      const threadRef = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(false);
      const [rowPresent, setRowPresent] = useState(true);
      return (
        <div ref={threadRef} tabIndex={-1} data-testid="thread">
          {rowPresent && (
            <button data-testid="trigger" onClick={() => setOpen(true)}>
              remove
            </button>
          )}
          {open && (
            <NoteRemoveConfirmation
              note={committed}
              onClose={() => setOpen(false)}
              onConfirmRemove={async () => {
                // what removeNote does: the row leaves the store on success
                setRowPresent(false);
              }}
              fallbackFocusRef={threadRef}
            />
          )}
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Cancel')));
    fireEvent.click(screen.getByTestId('note-remove-confirm'));

    // Gate on focus itself. onConfirmRemove drops the row and onClose closes the
    // dialog in two separate commits, and which lands first is not fixed -- so
    // waiting on the row alone can observe the moment after the row goes but
    // before the dialog's cleanup has placed focus.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('thread')));
    expect(screen.queryByTestId('trigger')).toBeNull();
  });

  it('still lands focus when the removal empties the thread entirely', async () => {
    // Removing your last visible note is the case an earlier version got wrong.
    // It asked `opener.isConnected` at cleanup to decide whether the opener had
    // survived, but React runs cleanups against a DOM it has not finished
    // mutating: with the trigger nested inside the container MessageList swaps
    // for its empty state, isConnected still read true, the guard bailed, and
    // focus fell to <body>. This harness reproduces that nesting -- the inner
    // container is replaced, the outer wrapper LoveNotes owns is not.
    function Harness() {
      const threadRef = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(false);
      const [hasNotes, setHasNotes] = useState(true);
      return (
        <div ref={threadRef} tabIndex={-1} data-testid="thread">
          {hasNotes ? (
            <div data-testid="virtualized-list">
              <button data-testid="trigger" onClick={() => setOpen(true)}>
                remove
              </button>
            </div>
          ) : (
            <div data-testid="empty-state">No messages to show</div>
          )}
          {open && (
            <NoteRemoveConfirmation
              note={committed}
              onClose={() => setOpen(false)}
              onConfirmRemove={async () => {
                setHasNotes(false);
              }}
              fallbackFocusRef={threadRef}
            />
          )}
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Cancel')));
    fireEvent.click(screen.getByTestId('note-remove-confirm'));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('thread')));
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('leaves the fallback alone when the user cancels, so the opener keeps focus', async () => {
    // The counterpart. Cancelling must NOT route through the fallback -- the
    // opener is still there and useFocusTrap restores it. If this ever lands on
    // the thread wrapper instead, the success flag is being set too eagerly.
    function Harness() {
      const threadRef = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <div ref={threadRef} tabIndex={-1} data-testid="thread">
          <button data-testid="trigger" onClick={() => setOpen(true)}>
            remove
          </button>
          {open && (
            <NoteRemoveConfirmation
              note={committed}
              onClose={() => setOpen(false)}
              onConfirmRemove={vi.fn()}
              fallbackFocusRef={threadRef}
            />
          )}
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Cancel')));
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('trigger')));
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('closes on Escape and takes focus off the trash button behind the overlay', async () => {
    const onClose = vi.fn();
    const onConfirmRemove = vi.fn();
    render(
      <NoteRemoveConfirmation
        note={committed}
        onClose={onClose}
        onConfirmRemove={onConfirmRemove}
        fallbackFocusRef={inertFallback}
      />
    );

    // Cancel takes initial focus because this cannot be undone.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Cancel')));

    // useFocusTrap listens on the dialog container, so the event has to start
    // where focus actually is and bubble — which is what a real keypress does.
    fireEvent.keyDown(screen.getByText('Cancel'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
    expect(onConfirmRemove).not.toHaveBeenCalled();
  });

  it('does not yank focus back to Cancel when the parent re-renders', async () => {
    // LoveNotes passes `onClose={() => setNotePendingRemoval(null)}` — a fresh
    // arrow on every render — so any parent re-render while the dialog is open
    // (a realtime note arriving is enough) changes the identity useFocusTrap
    // depends on and re-runs its effect.
    const { rerender } = render(
      <NoteRemoveConfirmation note={committed} onClose={() => {}} onConfirmRemove={vi.fn()} fallbackFocusRef={inertFallback} />
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Cancel')));

    // the user tabs to the destructive button and pauses
    screen.getByTestId('note-remove-confirm').focus();
    expect(document.activeElement).toBe(screen.getByTestId('note-remove-confirm'));

    rerender(
      <NoteRemoveConfirmation note={committed} onClose={() => {}} onConfirmRemove={vi.fn()} fallbackFocusRef={inertFallback} />
    );

    expect(document.activeElement).toBe(screen.getByTestId('note-remove-confirm'));
  });

  it('keeps focus inside the dialog while the removal is in flight', async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = () => resolve();
    });

    render(
      <NoteRemoveConfirmation
        note={committed}
        onClose={vi.fn()}
        onConfirmRemove={() => pending}
        fallbackFocusRef={inertFallback}
      />
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Cancel')));

    const confirm = screen.getByTestId('note-remove-confirm');
    confirm.focus();
    fireEvent.click(confirm);

    // isRemoving is now true, which disables BOTH buttons. A real browser drops
    // focus to <body> when the focused element becomes disabled (verified in
    // Chrome; happy-dom does not model it, so `contains()` alone would pass here
    // whether or not the bug existed). Assert the explicit custody handover
    // instead — the panel takes focus before the disable lands.
    await waitFor(() => expect(screen.getByTestId('note-remove-confirm')).toBeDisabled());
    const panel = screen.getByRole('dialog').querySelector('[tabindex="-1"]');
    expect(document.activeElement).toBe(panel);

    release?.();
  });

  it('removes only on the confirming action, then closes', async () => {
    const onClose = vi.fn();
    const onConfirmRemove = vi.fn(async () => undefined);
    render(
      <NoteRemoveConfirmation
        note={committed}
        onClose={onClose}
        onConfirmRemove={onConfirmRemove}
        fallbackFocusRef={inertFallback}
      />
    );

    fireEvent.click(screen.getByTestId('note-remove-confirm'));

    await waitFor(() => expect(onConfirmRemove).toHaveBeenCalledWith(committed.id));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the actual reason rather than advice that cannot work', async () => {
    // removeNote throws user-facing messages, and some of them mean a retry can
    // never succeed — a note that has left the loaded window throws on every
    // attempt. A fixed "please try again" sent the user round a loop.
    render(
      <NoteRemoveConfirmation
        note={committed}
        onClose={vi.fn()}
        onConfirmRemove={async () => {
          throw new Error('That message is no longer loaded');
        }}
        fallbackFocusRef={inertFallback}
      />
    );

    fireEvent.click(screen.getByTestId('note-remove-confirm'));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('That message is no longer loaded')
    );
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
        fallbackFocusRef={inertFallback}
      />
    );

    fireEvent.click(screen.getByTestId('note-remove-confirm'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();

    // The catch intends to hand focus back to Cancel so the user can leave.
    await waitFor(() => expect(screen.getByText('Cancel')).not.toBeDisabled());
    expect(document.activeElement).toBe(screen.getByText('Cancel'));
  });
});

describe('the wiring from list to dialog', () => {
  beforeEach(() => vi.clearAllMocks());

  // onRequestRemove is optional at every hop — MessageListProps, the MessageList
  // destructure, the rowProps object, MessageRow, and LoveNoteMessage — so
  // dropping it anywhere typechecks, leaves both other suites green, and removes
  // the feature. This is the only test that notices.
  it('carries the request from a rendered row out to the caller', () => {
    const onRequestRemove = vi.fn();

    render(
      <MessageList
        notes={[committed]}
        currentUserId="user-a"
        partnerName="Partner"
        userName="You"
        isLoading={false}
        onRequestRemove={onRequestRemove}
      />
    );

    fireEvent.click(screen.getByTestId('note-remove-button'));

    expect(onRequestRemove).toHaveBeenCalledWith(committed);
  });
});
