/**
 * MessageList — a note's bubble fades in when it arrives, not whenever its
 * row mounts.
 *
 * The bubble's entrance (opacity 0, 10px low) plays when LoveNoteMessage
 * mounts. react-window mounts rows for other reasons: when an older page
 * lands it first renders the rows at the old scroll offset, which drops the
 * rows on screen, and mounts them again once the keep-place scroll lands. Every
 * note on screen faded in again.
 *
 * react-window's List is stood in for by one that renders the rows the test
 * puts in view, keyed with the list's rowKey as the real List keys them, and
 * LoveNoteMessage by one that records each mount and whether it animates.
 */
import { act, render } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const view = vi.hoisted(() => ({
  visible: { startIndex: 0, stopIndex: 5 },
  /** Every LoveNoteMessage mount, in order */
  mounts: [] as Array<{ content: string; animateEntrance: boolean | undefined }>,
  listRef: {
    current: {
      scrollToRow: vi.fn(),
      element: { scrollTop: 0, scrollTo: vi.fn() },
    },
  },
}));

vi.mock('../LoveNoteMessage', async () => {
  const { Component } = await import('react');
  type Props = { message: LoveNote; animateEntrance?: boolean };
  class LoveNoteMessage extends Component<Props> {
    componentDidMount() {
      view.mounts.push({
        content: this.props.message.content,
        animateEntrance: this.props.animateEntrance,
      });
    }
    render() {
      return <p data-testid="note">{this.props.message.content}</p>;
    }
  }
  return { LoveNoteMessage };
});

vi.mock('react-window', async () => {
  const { useEffect } = await import('react');
  return {
    useListRef: () => view.listRef,
    List: ({
      rowCount,
      onRowsRendered,
      rowComponent: Row,
      rowKey,
      rowProps,
    }: {
      rowCount: number;
      onRowsRendered: (rows: { startIndex: number; stopIndex: number }) => void;
      rowComponent: (props: Record<string, unknown>) => ReactNode;
      rowKey?: (index: number, rowProps: Record<string, unknown>) => string | number;
      rowProps: Record<string, unknown>;
    }) => {
      const startIndex = Math.min(view.visible.startIndex, rowCount - 1);
      const stopIndex = Math.min(view.visible.stopIndex, rowCount - 1);
      useEffect(() => {
        onRowsRendered({ startIndex, stopIndex });
      }, [onRowsRendered, startIndex, stopIndex]);
      const rows = [];
      for (let index = startIndex; index <= stopIndex; index++) {
        rows.push(
          <Row
            key={rowKey ? rowKey(index, rowProps) : index}
            index={index}
            style={{}}
            ariaAttributes={{
              'aria-posinset': index + 1,
              'aria-setsize': rowCount,
              role: 'listitem',
            }}
            {...rowProps}
          />
        );
      }
      return <>{rows}</>;
    },
  };
});

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

function list(notes: LoveNote[], { hasMore = true }: { hasMore?: boolean } = {}) {
  return (
    <MessageList
      notes={notes}
      currentUserId="me"
      partnerName="Partner"
      userName="Me"
      isLoading={false}
      hasMore={hasMore}
      onLoadMore={vi.fn()}
    />
  );
}

/** Lets the list's queued state updates land. */
async function settle() {
  await act(async () => {});
}

/** The mounts since `from`, as "content:animates" */
function mountsSince(from: number): string[] {
  return view.mounts.slice(from).map((m) => `${m.content}:${String(m.animateEntrance)}`);
}

/** A note of mine still sending: no server row yet, keyed by its tempId. */
const sending: LoveNote = {
  id: 'temp-1',
  tempId: 'temp-1',
  from_user_id: 'me',
  to_user_id: 'partner',
  content: 'my note',
  created_at: new Date(Date.UTC(2026, 0, 2)).toISOString(),
  sending: true,
};

beforeEach(() => {
  view.visible = { startIndex: 0, stopIndex: 5 };
  view.mounts = [];
  view.listRef.current.scrollToRow.mockReset();
  view.listRef.current.element.scrollTop = 0;
  view.listRef.current.element.scrollTo.mockReset();
});

describe('MessageList entrance animation', () => {
  it('fades in the notes on screen when the thread appears', async () => {
    view.visible = { startIndex: 46, stopIndex: 50 };
    render(list(notesBetween(51, 100)));
    await settle();

    expect(mountsSince(0)).toEqual([
      'note 96:true',
      'note 97:true',
      'note 98:true',
      'note 99:true',
      'note 100:true',
    ]);
  });

  it('does not fade in the notes on screen again when an older page lands', async () => {
    view.visible = { startIndex: 46, stopIndex: 50 };
    const { rerender } = render(list(notesBetween(51, 100)));
    await settle();
    // The reader scrolls up to notes 53..56 (rows 3..6).
    view.visible = { startIndex: 3, stopIndex: 6 };
    rerender(list(notesBetween(51, 100)));
    await settle();
    const landed = view.mounts.length;

    // The older page lands: the List first renders the rows at the old offset,
    // now notes 3..6, and the rows on screen go.
    rerender(list(notesBetween(1, 100)));
    await settle();
    // The keep-place scroll lands on notes 53..56, now rows 53..56.
    view.visible = { startIndex: 53, stopIndex: 56 };
    rerender(list(notesBetween(1, 100)));
    await settle();

    expect(mountsSince(landed)).toEqual([
      'note 3:false',
      'note 4:false',
      'note 5:false',
      'note 6:false',
      'note 53:false',
      'note 54:false',
      'note 55:false',
      'note 56:false',
    ]);
  });

  it('fades in a note received while the reader is at the bottom', async () => {
    view.visible = { startIndex: 46, stopIndex: 50 };
    const { rerender } = render(list(notesBetween(51, 100)));
    await settle();
    const before = view.mounts.length;

    // The note arrives; the scroll to the bottom then puts its row in view.
    rerender(list(notesBetween(51, 101)));
    await settle();
    view.visible = { startIndex: 47, stopIndex: 51 };
    rerender(list(notesBetween(51, 101)));
    await settle();

    expect(mountsSince(before)).toEqual(['note 101:true']);
  });

  it('fades in a note I send once, and keeps its row when the server confirms it', async () => {
    view.visible = { startIndex: 46, stopIndex: 50 };
    const { rerender } = render(list(notesBetween(51, 100), { hasMore: false }));
    await settle();
    const before = view.mounts.length;

    rerender(list([...notesBetween(51, 100), sending], { hasMore: false }));
    await settle();
    // Its send state changes before the scroll to the bottom lands.
    const queued = { ...sending, sending: false, queued: true };
    rerender(list([...notesBetween(51, 100), queued], { hasMore: false }));
    await settle();
    view.visible = { startIndex: 47, stopIndex: 51 };
    rerender(list([...notesBetween(51, 100), queued], { hasMore: false }));
    await settle();
    // The committed row replaces it, carrying its tempId as idempotency_key.
    const confirmed = {
      ...sending,
      id: 'server-id-1',
      tempId: undefined,
      sending: false,
      idempotency_key: sending.tempId,
    } as LoveNote;
    rerender(list([...notesBetween(51, 100), confirmed], { hasMore: false }));
    await settle();

    expect(mountsSince(before)).toEqual(['my note:true']);
  });

  it('fades in a partner note that arrives above an unsent note of mine', async () => {
    const unsent = { ...sending, sending: false, error: true };
    view.visible = { startIndex: 47, stopIndex: 51 };
    const { rerender } = render(list([...notesBetween(51, 100), unsent], { hasMore: false }));
    await settle();
    const before = view.mounts.length;

    // A refresh puts the server's page, now with note 101, ahead of the unsent
    // note; the unsent note keeps its row, the new one gets its own.
    view.visible = { startIndex: 48, stopIndex: 52 };
    rerender(list([...notesBetween(51, 101), unsent], { hasMore: false }));
    await settle();

    expect(mountsSince(before)).toEqual(['note 101:true']);
  });
});
