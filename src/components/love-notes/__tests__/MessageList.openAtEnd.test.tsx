/**
 * MessageList — the thread opens at the very bottom, and stays there.
 *
 * It used to open one scrollToRow a frame after mount. react-window sizes a
 * list with function row heights from the rows it has measured so far, and at
 * that point it had measured only the top rows and still took the list to be
 * its 600px default height; the browser clamped the scroll to that short
 * estimate, the rest of the rows were then counted, and the thread sat a note
 * or two above its end. The partner row's "Connected" line, which appears once
 * the feed joins, then took a few more pixels off the list.
 *
 * react-window's List is stood in for by one that keeps the props this checks
 * and an element whose scroll metrics the test sets.
 */
import { act, render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoveNote } from '../../../types/models';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

type Size = { height: number; width: number };

/** A scroll element with the given metrics; scrollTo clamps as a browser does. */
function scroller(scrollHeight: number, scrollTop: number, clientHeight: number) {
  const element = {
    scrollHeight,
    scrollTop,
    clientHeight,
    scrollTo({ top }: { top: number }) {
      element.scrollTop = Math.max(0, Math.min(top, element.scrollHeight - element.clientHeight));
    },
  };
  return element;
}

const view = vi.hoisted(() => ({
  defaultScrollOffset: undefined as number | undefined,
  onResize: undefined as ((size: Size, prevSize: Size) => void) | undefined,
  element: scroller(0, 0, 0),
  scrollToRow: vi.fn(),
}));

vi.mock('react-window', () => ({
  useListRef: () => ({
    current: {
      get element() {
        return view.element;
      },
      scrollToRow: view.scrollToRow,
    },
  }),
  List: ({
    children,
    defaultScrollOffset,
    onResize,
  }: {
    children?: ReactNode;
    defaultScrollOffset?: number;
    onResize?: (size: Size, prevSize: Size) => void;
  }) => {
    view.defaultScrollOffset = defaultScrollOffset;
    view.onResize = onResize;
    return <>{children}</>;
  },
}));

import { MessageList } from '../MessageList';

const notes: LoveNote[] = Array.from({ length: 50 }, (_, i) => ({
  id: `note-${i}`,
  from_user_id: i % 2 ? 'me' : 'partner',
  to_user_id: i % 2 ? 'partner' : 'me',
  content: `note ${i}`,
  created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
}));

async function open() {
  render(
    <MessageList
      notes={notes}
      currentUserId="me"
      partnerName="Partner"
      userName="Me"
      isLoading={false}
      hasMore
    />
  );
  await act(async () => {});
}

/** The list's height goes from `from` to `to`, the scroll offset unchanged. */
function resize(from: number, to: number) {
  view.element.clientHeight = to;
  act(() => view.onResize?.({ height: to, width: 393 }, { height: from, width: 393 }));
}

beforeEach(() => {
  view.defaultScrollOffset = undefined;
  view.onResize = undefined;
  view.element = scroller(0, 0, 0);
  view.scrollToRow.mockReset();
});

describe('MessageList opening at the newest note', () => {
  it('opens at an offset past the end, which the list clamps to its last row', async () => {
    await open();

    expect(view.defaultScrollOffset).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('does not scroll to the end again after mount against an unmeasured list', async () => {
    const frames = vi.spyOn(globalThis, 'requestAnimationFrame');
    await open();
    frames.mock.calls.forEach(([frame]) => act(() => frame(performance.now())));
    frames.mockRestore();

    expect(view.scrollToRow).not.toHaveBeenCalled();
  });

  it('keeps a reader at the end there when the list loses height', async () => {
    await open();
    view.element = scroller(6392, 5809, 583);

    resize(583, 578);

    // The end of a 6392px thread in a 578px list
    expect(view.element.scrollTop).toBe(6392 - 578);
  });

  it('leaves a reader who has scrolled up where they are', async () => {
    await open();
    view.element = scroller(6392, 3000, 583);

    resize(583, 578);

    expect(view.element.scrollTop).toBe(3000);
  });

  it('does not move on the first measurement, from no height at all', async () => {
    await open();
    view.element = scroller(6392, 0, 0);

    resize(0, 600);

    expect(view.element.scrollTop).toBe(0);
  });

  it('gives the thread the full height of its rows once an older page lands', async () => {
    // react-window works out row heights only as far as the reader has been
    // and averages the rest, so after an older page its height came up short
    // and a jump to the newest note stopped that far above it
    const older: LoveNote[] = [
      { ...notes[0], id: 'older-long', content: 'x'.repeat(200) },
      { ...notes[0], id: 'older-image', content: 'a photo', image_url: 'photo.jpg' },
    ];
    const props = { currentUserId: 'me', partnerName: 'Partner', userName: 'Me', isLoading: false };
    const { rerender } = render(<MessageList {...props} notes={notes} hasMore />);
    await act(async () => {});

    // The older-page row (80) and 50 short notes (124 each)
    expect(screen.getByTestId('thread-height').style.height).toBe(`${80 + 50 * 124}px`);

    rerender(<MessageList {...props} notes={[...older, ...notes]} hasMore={false} />);
    await act(async () => {});

    // The beginning of the conversation (120), a long note (176), a note with
    // a picture (380) and the 50 short notes
    expect(screen.getByTestId('thread-height').style.height).toBe(
      `${120 + 176 + 380 + 50 * 124}px`
    );
  });
});
