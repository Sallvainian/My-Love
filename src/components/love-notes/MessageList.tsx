/**
 * MessageList Component
 *
 * Virtualized scrollable list for Love Notes messages with infinite scroll.
 * Uses react-window for memory-efficient rendering of large datasets.
 *
 * Features:
 * - Virtualized rendering with List component (60fps with 1000+ messages)
 * - Infinite scroll pagination (loads older messages when scrolling up)
 * - Automatic scroll to bottom on initial load and new messages
 * - Scroll position preservation during pagination
 * - "New message" indicator when scrolled up
 * - "Beginning of conversation" indicator
 * - Automatic reconnect for realtime (handled by useRealtimeMessages)
 * - Loading indicators
 * - Empty state
 *
 * Story 2.4: Message history with scroll performance
 */

import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, Heart, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { List, useListRef } from 'react-window';
import { useInfiniteLoader } from 'react-window-infinite-loader';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import type { LoveNote } from '../../types/models';
import { LoveNoteMessage } from './LoveNoteMessage';

/**
 * Props passed to MessageRow via rowProps
 * Performance fix: Extracted outside component to prevent recreation on every render
 */
interface MessageRowCustomProps {
  notes: LoveNote[];
  showBeginning: boolean;
  isLoading: boolean;
  currentUserId: string;
  userName: string;
  partnerName: string;
  onRetry?: (tempId: string) => void;
  onRequestRemove?: (note: LoveNote) => void;
}

/**
 * MessageRow Component - Extracted outside MessageList for performance
 * This prevents function recreation on every render, which is critical
 * for react-window virtualization performance.
 *
 * Note: We use a regular function (not memo) because react-window v2
 * expects a specific function signature and handles its own optimization.
 */
function MessageRow({
  index,
  style,
  ariaAttributes,
  notes,
  showBeginning,
  isLoading,
  currentUserId,
  userName,
  partnerName,
  onRetry,
  onRequestRemove,
}: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
} & MessageRowCustomProps): React.ReactElement {
  // Row 0 sits above the oldest note: the beginning of the conversation once
  // all history is loaded, otherwise the row whose coming into view asks for
  // the older page.
  if (index === 0) {
    if (showBeginning) {
      return (
        <div style={style} {...ariaAttributes}>
          <BeginningOfConversation />
        </div>
      );
    }

    // Story 2.4 - Task 2.3: Show loading at top when fetching older messages
    if (isLoading) {
      return <LoadingSpinner style={style} />;
    }

    return <div style={style} />;
  }

  const note = notes[index - 1];

  if (!note) {
    return <div style={style} />;
  }

  const isOwnMessage = note.from_user_id === currentUserId;
  const senderName = isOwnMessage ? userName : partnerName;

  return (
    <div style={style} {...ariaAttributes}>
      <LoveNoteMessage
        message={note}
        isOwnMessage={isOwnMessage}
        senderName={senderName}
        onRetry={onRetry}
        onRequestRemove={onRequestRemove}
      />
    </div>
  );
}

export interface MessageListProps {
  /** Array of love notes to display */
  notes: LoveNote[];
  /** Current user's ID for determining message ownership */
  currentUserId: string;
  /** Partner's display name */
  partnerName: string;
  /** Current user's display name */
  userName: string;
  /** Whether notes are currently loading */
  isLoading: boolean;
  /** Callback when user scrolls to top (for loading older messages) */
  onLoadMore?: () => void;
  /** Whether there are more messages to load */
  hasMore?: boolean;
  /** Callback when user clicks retry on a failed message (Story 2.2) */
  onRetry?: (tempId: string) => void;
  /** Callback when the user asks to remove a message from their own history */
  onRequestRemove?: (note: LoveNote) => void;
}

/**
 * Beginning of Conversation Component
 * Shows when all message history has been loaded
 */
function BeginningOfConversation() {
  return (
    <div
      className="flex flex-col items-center py-8 text-center"
      data-testid="beginning-of-conversation"
    >
      <Heart className="mb-2 h-8 w-8 text-accent" aria-hidden="true" />
      <p className="text-sm text-muted">This is the beginning of your love story</p>
    </div>
  );
}

/**
 * Loading spinner component
 */
function LoadingSpinner({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      className="flex items-center justify-center py-4"
      style={style}
      data-testid="loading-spinner"
    >
      <LoaderCircle className="h-6 w-6 animate-spin text-accent" />
    </div>
  );
}

/** Rows beyond the visible range within which the loader asks for more */
const LOAD_THRESHOLD = 10;

/**
 * Calculate row height based on message content length and image presence
 * Story 2.4 - Task 1.3: Variable row height calculation
 */
function calculateRowHeight(note: LoveNote | null, index: number): number {
  if (!note || index < 0) {
    return 80; // Default/loading height
  }

  const contentLength = note.content?.length || 0;
  const hasImage = !!(note.image_url || note.imagePreviewUrl);

  // Base height: sender name (20px) + timestamp (20px) + padding (24px) + margin (12px) = 76px
  const baseHeight = 76;

  // Image height: max-h-64 = 256px for images
  const imageHeight = hasImage ? 256 : 0;

  // Content height varies by length (only if there's text content)
  let textHeight = 0;
  if (contentLength > 0) {
    if (contentLength < 50) {
      textHeight = 48; // Short text with padding
    } else if (contentLength < 200) {
      textHeight = 64; // Medium text
    } else {
      textHeight = 100; // Long text
    }
  }

  return baseHeight + imageHeight + textHeight;
}

/**
 * MessageList - Virtualized scrollable message container
 *
 * Renders love notes in a performant virtualized list.
 * Story 2.4: AC-2.4.1, AC-2.4.2, AC-2.4.3, AC-2.4.4, AC-2.4.5
 */
export function MessageList({
  notes,
  currentUserId,
  partnerName,
  userName,
  isLoading,
  onLoadMore,
  hasMore = false,
  onRetry,
  onRequestRemove,
}: MessageListProps): ReactNode {
  // Use react-window v2's typed ref hook for proper API access
  const listRef = useListRef(null);
  const hasScrolledToBottom = useRef(false);
  const scrollToBottomOnNextRender = useRef(false);
  // The notes at either end as of the last commit: an older page moves the
  // first, a new message the last. Length alone cannot tell the two apart.
  const prevFirstNoteId = useRef(notes[0]?.id);
  const prevLastNoteId = useRef(notes[notes.length - 1]?.id);
  // First visible row as last reported, to keep the reader's place when an
  // older page lands above it
  const firstVisibleRow = useRef(0);
  // Whether the list has shown its last row since the thread appeared. It
  // opens scrolled to the newest note, but its first frame, before that
  // scroll, reports the top; older pages wait until the end has been seen.
  const hasShownEnd = useRef(false);

  // Story 2.3: Track if user is at bottom and show new message indicator
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);

  // Calculate whether to show "Beginning of conversation"
  const showBeginning = !hasMore && notes.length > 0;

  // Row 0 is the header above the oldest note (beginning of conversation, or
  // the older-page row); note i is row i + 1
  const totalRowCount = notes.length + 1;

  // Story 2.4 - Task 2.1: Configure infinite loader
  // Notes run oldest first, so the one row left to load is the header row,
  // and only while older pages remain.
  const isRowLoaded = useCallback((index: number) => !(hasMore && index === 0), [hasMore]);

  // Offline, an older page cannot load and nothing is asked for. The loader
  // keeps the rows it asked about in a Set it rebuilds only when this callback
  // changes identity, so `isOnline` is a dependency: back online, those rows
  // are forgotten and the next scroll up asks again.
  const { isOnline } = useNetworkStatus();
  // The first note the last older page was asked from. Asked again from the
  // same note, not loading and with more to come, that request came back
  // without a page (a failed read clears the loading flag and sets no error
  // over notes on screen): asking again at once would repeat it for as long as
  // the header stays in range. It is cleared once the reader scrolls away from
  // the top, so scrolling back retries.
  const [olderAskedFrom, setOlderAskedFrom] = useState<string | undefined>();
  const firstNoteId = notes[0]?.id;
  const loadMoreRows = useCallback(
    async (_startIndex: number, _stopIndex: number) => {
      if (isOnline && !isLoading && hasMore && onLoadMore && olderAskedFrom !== firstNoteId) {
        setOlderAskedFrom(firstNoteId);
        await onLoadMore();
      }
    },
    [isOnline, isLoading, hasMore, onLoadMore, olderAskedFrom, firstNoteId]
  );

  // Setup infinite loading hook - must be called before conditional returns
  const infiniteLoaderCallback = useInfiniteLoader({
    isRowLoaded,
    loadMoreRows,
    rowCount: totalRowCount,
    threshold: LOAD_THRESHOLD,
    minimumBatchSize: 50,
  });

  // Wrapper for onRowsRendered that also tracks scroll position (v2 API)
  // In react-window v2, onRowsRendered receives { startIndex, stopIndex } for visible rows
  const onRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      // The List reports before this component's effects run. When an older
      // page has just landed, the rows it reports are the old top of the
      // thread, not yet moved down to the note the reader was on: the header
      // there would ask for the next page at once.
      const prevFirstId = prevFirstNoteId.current;
      if (
        notes[0]?.id !== prevFirstId &&
        notes.some((note, index) => index > 0 && note.id === prevFirstId)
      ) {
        return;
      }
      firstVisibleRow.current = visibleRows.startIndex;
      // The header is out of the loader's range: back at the top, ask again
      if (visibleRows.startIndex > LOAD_THRESHOLD) setOlderAskedFrom(undefined);

      // Track if user is at bottom (within last few rows)
      // stopIndex is the last visible row index
      const atBottom = visibleRows.stopIndex >= totalRowCount - 2;
      if (atBottom) hasShownEnd.current = true;

      // Call the infinite loader callback first
      if (hasShownEnd.current) infiniteLoaderCallback(visibleRows);

      setIsAtBottom(atBottom);

      // Hide new message indicator when user scrolls to bottom
      if (atBottom && showNewMessageIndicator) {
        setShowNewMessageIndicator(false);
      }
    },
    [notes, infiniteLoaderCallback, totalRowCount, showNewMessageIndicator]
  );

  // Variable row height function
  const getRowHeight = useCallback(
    (index: number): number => {
      if (index === 0) {
        // BeginningOfConversation height, or the older-page row's: the same
        // whether or not its spinner shows, so the notes below do not move
        return hasMore ? 80 : 120;
      }

      return calculateRowHeight(notes[index - 1], index - 1);
    },
    [notes, hasMore]
  );

  // Automatic scroll to bottom on initial load
  useEffect(() => {
    if (notes.length > 0 && listRef.current && !hasScrolledToBottom.current) {
      hasScrolledToBottom.current = true;
      // Defer scroll to next frame so react-window can complete its layout pass.
      // Without this, scrollToRow fires before the list has measured its rows,
      // causing the chat to stay scrolled to the top when re-entering the tab.
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollToRow({ align: 'end', index: totalRowCount - 1 });
          queueMicrotask(() => setIsAtBottom(true));
        }
      });
    }
  }, [listRef, notes.length, totalRowCount]);

  // Story 2.3: AC-2.3.4 - Handle new messages with conditional automatic scroll
  useEffect(() => {
    const prevFirstId = prevFirstNoteId.current;
    const prevLastId = prevLastNoteId.current;
    prevFirstNoteId.current = notes[0]?.id;
    prevLastNoteId.current = notes[notes.length - 1]?.id;
    // An emptied thread unmounts the list; a new one opens at its top again
    if (notes.length === 0) hasShownEnd.current = false;
    if (!listRef.current) return;

    // A new message follows the previous last note (or starts the thread). A
    // confirmed send swaps the last note's id in place and a removal uncovers
    // an older one: neither is a new message.
    const prevLastIndex =
      prevLastId === undefined ? -1 : notes.findIndex((note) => note.id === prevLastId);
    const newMessage =
      notes.length > 0 &&
      (prevLastId === undefined || (prevLastIndex >= 0 && prevLastIndex < notes.length - 1));

    // An older page puts notes above the previous first note. A refresh that
    // replaced the thread leaves no previous first note to find.
    const olderAdded =
      prevFirstId === undefined || notes[0]?.id === prevFirstId
        ? 0
        : Math.max(
            0,
            notes.findIndex((note) => note.id === prevFirstId)
          );

    if (!newMessage && olderAdded === 0) return;

    if (isAtBottom) {
      // Automatic scroll to new message if user was at bottom
      scrollToBottomOnNextRender.current = true;
      queueMicrotask(() => {
        setIsAtBottom(true);
        setShowNewMessageIndicator(false);
      });
      return;
    }

    if (olderAdded > 0) {
      // Keep the row the reader was on (from the old first note down) at the
      // top; without this the list stays at the top and asks again.
      const index = Math.max(firstVisibleRow.current, 1) + olderAdded;
      listRef.current.scrollToRow({ index: Math.min(index, totalRowCount - 1), align: 'start' });
    }

    if (newMessage) {
      // Show "new message" indicator if user scrolled up
      queueMicrotask(() => setShowNewMessageIndicator(true));
    }
  }, [listRef, notes, isAtBottom, totalRowCount]);

  // Execute scroll to bottom after render (when new message arrives)
  useEffect(() => {
    if (scrollToBottomOnNextRender.current && listRef.current) {
      // Use react-window v2 API
      listRef.current.scrollToRow({ align: 'end', index: totalRowCount - 1 });
      scrollToBottomOnNextRender.current = false;
    }
  });

  // Scroll to bottom handler for new message indicator
  // Note: React Compiler handles memoization automatically
  const scrollToBottom = () => {
    if (listRef.current) {
      // Use react-window v2 API
      listRef.current.scrollToRow({ align: 'end', index: totalRowCount - 1 });
      setShowNewMessageIndicator(false);
      setIsAtBottom(true);
    }
  };

  // Empty state
  if (!isLoading && notes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-tint text-accent"
        >
          <Heart className="h-7 w-7" aria-hidden="true" />
        </motion.div>
        {/*
          Deliberately neutral: this state is also what a user sees after removing
          every message they could see, and "no love notes yet" would be a lie
          about a conversation that did happen.
        */}
        <h3 className="mb-1 text-lg font-semibold text-ink">No messages to show</h3>
        <p className="max-w-xs text-[15px] text-muted">Send your partner a note whenever you like</p>
      </div>
    );
  }

  // Initial loading state
  if (isLoading && notes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Memoize rowProps to prevent unnecessary re-renders
  // Only recreate when the actual data changes
  const rowProps: MessageRowCustomProps = {
    notes,
    showBeginning,
    isLoading,
    currentUserId,
    userName,
    partnerName,
    onRetry,
    onRequestRemove,
  };

  return (
    <div className="relative flex-1 overflow-hidden" data-testid="virtualized-list">
      {/* Story 2.3: AC-2.3.4 - New message indicator */}
      <AnimatePresence>
        {showNewMessageIndicator && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={scrollToBottom}
            className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-fill px-4 py-2 text-white shadow-float transition-opacity hover:opacity-90"
            aria-label="Scroll to new message"
            data-testid="new-message-indicator"
          >
            <span className="text-sm font-medium">New message</span>
            <ArrowDown className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Story 2.4 - Task 1.2: Virtualized List */}
      <List
        listRef={listRef}
        rowCount={totalRowCount}
        rowHeight={getRowHeight}
        onRowsRendered={onRowsRendered}
        defaultHeight={600}
        rowComponent={MessageRow}
        rowProps={rowProps}
      />
    </div>
  );
}
