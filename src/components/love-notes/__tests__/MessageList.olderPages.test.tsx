/**
 * MessageList — older pages load at the top, not the bottom (DW-221).
 *
 * Notes run oldest first, so an older page belongs above row 0. The list used
 * to put its only unloaded row past the newest note: the older page was asked
 * for at the bottom (on open, too), each page that arrived counted as a new
 * message and scrolled back down, and the loader asked again — paging through
 * the whole history.
 *
 * The real loader runs here. react-window's List is stood in for by one that
 * renders every row and reports the visible range the test sets, when that
 * range or its callback changes, as the real List does.
 */
import { act, render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoveNote } from '../../../types/models';

vi.mock('motion/react', () => {
  const strip = ({
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    ...props
  }: Record<string, unknown>) => props;
  return {
    motion: {
      div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
        <div {...strip(props)}>{children}</div>
      ),
      button: ({
        children,
        ...props
      }: HTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
        <button {...strip(props)}>{children}</button>
      ),
    },
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

vi.mock('../LoveNoteMessage', () => ({
  LoveNoteMessage: ({ message }: { message: LoveNote }) => (
    <p data-testid="note">{message.content}</p>
  ),
}));

const view = vi.hoisted(() => ({
  visible: { startIndex: 0, stopIndex: 5 },
  rowCount: 0,
  listRef: { current: { scrollToRow: vi.fn() } },
}));

vi.mock('react-window', () => ({
  useListRef: () => view.listRef,
  List: ({
    rowCount,
    onRowsRendered,
    rowComponent: Row,
    rowProps,
  }: {
    rowCount: number;
    onRowsRendered: (rows: { startIndex: number; stopIndex: number }) => void;
    rowComponent: (props: Record<string, unknown>) => ReactNode;
    rowProps: Record<string, unknown>;
  }) => {
    view.rowCount = rowCount;
    const startIndex = view.visible.startIndex;
    const stopIndex = Math.min(view.visible.stopIndex, rowCount - 1);
    useEffect(() => {
      onRowsRendered({ startIndex, stopIndex });
    }, [onRowsRendered, startIndex, stopIndex]);
    return (
      <>
        {Array.from({ length: rowCount }, (_, index) => (
          <Row
            key={index}
            index={index}
            style={{}}
            ariaAttributes={{
              'aria-posinset': index + 1,
              'aria-setsize': rowCount,
              role: 'listitem',
            }}
            {...rowProps}
          />
        ))}
      </>
    );
  },
}));

import { MessageList } from '../MessageList';

/** Notes `from`..`to` (inclusive), oldest first, as the store holds them. */
function notesBetween(from: number, to: number): LoveNote[] {
  const notes: LoveNote[] = [];
  for (let n = from; n <= to; n++) {
    notes.push({
      id: `note-${n}`,
      from_user_id: 'partner',
      to_user_id: 'me',
      content: `note ${n}`,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(),
    });
  }
  return notes;
}

function list(
  notes: LoveNote[],
  onLoadMore: () => void,
  { isLoading = false, hasMore = true }: { isLoading?: boolean; hasMore?: boolean } = {}
) {
  return (
    <MessageList
      notes={notes}
      currentUserId="me"
      partnerName="Partner"
      userName="Me"
      isLoading={isLoading}
      hasMore={hasMore}
      onLoadMore={onLoadMore}
    />
  );
}

/** A note of mine that failed to send: no server row yet, keyed by its tempId. */
const unsent: LoveNote = {
  id: 'temp-1',
  tempId: 'temp-1',
  from_user_id: 'me',
  to_user_id: 'partner',
  content: 'unsent note',
  created_at: new Date(Date.UTC(2026, 0, 2)).toISOString(),
  error: true,
};

/** Lets the list's queued state updates land. */
async function settle() {
  await act(async () => {});
}

/** Opens 50 notes with more to load, scrolled to the newest note. */
async function openAtNewest(onLoadMore: () => void) {
  view.visible = { startIndex: 45, stopIndex: 50 };
  const rendered = render(list(notesBetween(51, 100), onLoadMore));
  await settle();
  return rendered;
}

/** The reader scrolls so that rows `startIndex`..`stopIndex` are on screen. */
async function showRows(
  rerender: (ui: ReactNode) => void,
  onLoadMore: () => void,
  startIndex: number,
  stopIndex: number
) {
  view.visible = { startIndex, stopIndex };
  rerender(list(notesBetween(51, 100), onLoadMore));
  await settle();
}

beforeEach(() => {
  view.visible = { startIndex: 0, stopIndex: 5 };
  view.rowCount = 0;
  view.listRef.current.scrollToRow.mockReset();
  // The first-open scroll to the end runs on the next frame; it is left out
  // here so each test owns the reported range.
  vi.stubGlobal('requestAnimationFrame', () => 0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MessageList older pages', () => {
  it('asks for nothing while the newest notes are on screen', async () => {
    view.visible = { startIndex: 45, stopIndex: 50 };
    const onLoadMore = vi.fn();
    render(list(notesBetween(51, 100), onLoadMore));
    await settle();

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('asks for the older page once the top of the thread is on screen', async () => {
    const onLoadMore = vi.fn();
    const { rerender } = await openAtNewest(onLoadMore);

    await showRows(rerender, onLoadMore, 0, 5);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing until the thread has opened at the newest note', async () => {
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    // The first frame, before the scroll to the end, reports the top.
    view.visible = { startIndex: 0, stopIndex: 6 };
    const onLoadMore = vi.fn();
    const { rerender } = render(list(notesBetween(51, 100), onLoadMore));
    await settle();
    expect(onLoadMore).not.toHaveBeenCalled();

    // The scroll to the end runs on the next frame and lands.
    act(() => frame?.(0));
    expect(view.listRef.current.scrollToRow).toHaveBeenCalledWith({ align: 'end', index: 50 });
    await showRows(rerender, onLoadMore, 45, 50);
    expect(onLoadMore).not.toHaveBeenCalled();

    // Scrolled back up to the top.
    await showRows(rerender, onLoadMore, 0, 6);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('keeps the reader on the note they were at when the older page arrives', async () => {
    const onLoadMore = vi.fn();
    const { rerender } = await openAtNewest(onLoadMore);
    await showRows(rerender, onLoadMore, 0, 5);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(list(notesBetween(51, 100), onLoadMore, { isLoading: true }));
    await settle();
    rerender(list(notesBetween(1, 100), onLoadMore));
    await settle();

    // Note 51 was the first note, below the top row; 50 older notes now sit
    // above it.
    expect(view.listRef.current.scrollToRow).toHaveBeenCalledWith({ index: 51, align: 'start' });
    expect(view.listRef.current.scrollToRow).not.toHaveBeenCalledWith(
      expect.objectContaining({ align: 'end' })
    );
    expect(screen.queryByTestId('new-message-indicator')).toBeNull();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // The scroll lands there: still no further page.
    view.visible = { startIndex: 51, stopIndex: 56 };
    rerender(list(notesBetween(1, 100), onLoadMore));
    await settle();
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing more before the scroll back to the reader has landed', async () => {
    const onLoadMore = vi.fn();
    const { rerender } = await openAtNewest(onLoadMore);
    await showRows(rerender, onLoadMore, 0, 5);
    rerender(list(notesBetween(51, 100), onLoadMore, { isLoading: true }));
    await settle();
    rerender(list(notesBetween(1, 100), onLoadMore));
    await settle();
    expect(view.listRef.current.scrollToRow).toHaveBeenCalledWith({ index: 51, align: 'start' });

    // The real List renders again from the old scroll offset before the scroll
    // event lands, and reports a slightly different range at the top.
    view.visible = { startIndex: 0, stopIndex: 6 };
    rerender(list(notesBetween(1, 100), onLoadMore));
    await settle();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // The scroll lands; back at the top later, the next page is asked for.
    view.visible = { startIndex: 51, stopIndex: 56 };
    rerender(list(notesBetween(1, 100), onLoadMore));
    await settle();
    view.visible = { startIndex: 0, stopIndex: 5 };
    rerender(list(notesBetween(1, 100), onLoadMore));
    await settle();
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it('asks once for a page that fails, and again after scrolling away and back', async () => {
    const onLoadMore = vi.fn();
    const { rerender } = await openAtNewest(onLoadMore);
    await showRows(rerender, onLoadMore, 0, 5);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // The request runs and fails: no page, older pages still to come, and the
    // top of the thread still on screen.
    rerender(list(notesBetween(51, 100), onLoadMore, { isLoading: true }));
    await settle();
    rerender(list(notesBetween(51, 100), onLoadMore));
    await settle();
    await showRows(rerender, onLoadMore, 0, 5);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // Away from the top, then back: one retry.
    await showRows(rerender, onLoadMore, 20, 25);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    await showRows(rerender, onLoadMore, 0, 5);
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it('still scrolls to a new note arriving at the bottom', async () => {
    view.visible = { startIndex: 45, stopIndex: 50 };
    const onLoadMore = vi.fn();
    const { rerender } = render(list(notesBetween(51, 100), onLoadMore));
    await settle();
    view.listRef.current.scrollToRow.mockClear();

    rerender(list(notesBetween(51, 101), onLoadMore));
    await settle();

    expect(view.listRef.current.scrollToRow).toHaveBeenCalledWith({
      align: 'end',
      index: view.rowCount - 1,
    });
    expect(screen.queryByTestId('new-message-indicator')).toBeNull();
  });

  it('counts a partner note arriving before an unsent note of mine as new', async () => {
    view.visible = { startIndex: 20, stopIndex: 25 };
    const onLoadMore = vi.fn();
    const { rerender } = render(
      list([...notesBetween(51, 100), unsent], onLoadMore, { hasMore: false })
    );
    await settle();

    // A refresh puts the server's page first and the unconfirmed note last.
    rerender(list([...notesBetween(51, 101), unsent], onLoadMore, { hasMore: false }));
    await settle();

    expect(screen.getByTestId('new-message-indicator')).toBeInTheDocument();
  });

  it('scrolls to a partner note arriving before an unsent note while at the bottom', async () => {
    view.visible = { startIndex: 46, stopIndex: 51 };
    const onLoadMore = vi.fn();
    const { rerender } = render(
      list([...notesBetween(51, 100), unsent], onLoadMore, { hasMore: false })
    );
    await settle();
    view.listRef.current.scrollToRow.mockClear();

    rerender(list([...notesBetween(51, 101), unsent], onLoadMore, { hasMore: false }));
    await settle();

    expect(view.listRef.current.scrollToRow).toHaveBeenCalledWith({
      align: 'end',
      index: view.rowCount - 1,
    });
  });

  it('does not count my note being confirmed by the server as new', async () => {
    view.visible = { startIndex: 20, stopIndex: 25 };
    const onLoadMore = vi.fn();
    const { rerender } = render(
      list([...notesBetween(51, 100), unsent], onLoadMore, { hasMore: false })
    );
    await settle();

    const confirmed = {
      ...unsent,
      id: 'server-id-1',
      tempId: undefined,
      error: false,
      idempotency_key: unsent.tempId,
    } as LoveNote;
    rerender(list([...notesBetween(51, 100), confirmed], onLoadMore, { hasMore: false }));
    await settle();

    expect(screen.queryByTestId('new-message-indicator')).toBeNull();
  });

  it('shows the loading spinner above every note while the older page loads', async () => {
    const onLoadMore = vi.fn();
    render(list(notesBetween(51, 100), onLoadMore, { isLoading: true }));
    await settle();

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    const shown = screen.getAllByTestId('note').map((note) => note.textContent);
    expect(shown).toHaveLength(50);
    expect(shown[0]).toBe('note 51');
    expect(shown[49]).toBe('note 100');
  });
});
