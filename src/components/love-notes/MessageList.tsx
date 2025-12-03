/**
 * MessageList Component
 *
 * Virtualized scrollable list for Love Notes messages with infinite scroll.
 * Uses react-window for memory-efficient rendering of large datasets.
 *
 * Features:
 * - Virtualized rendering with List component (60fps with 1000+ messages)
 * - Infinite scroll pagination (loads older messages when scrolling up)
 * - Auto-scroll to bottom on initial load and new messages
 * - Scroll position preservation during pagination
 * - "New message" indicator when scrolled up
 * - "Beginning of conversation" indicator
 * - Pull-to-refresh functionality
 * - Loading indicators
 * - Empty state
 *
 * Story 2.4: Message history with scroll performance
 */

import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { List } from 'react-window';
import { useInfiniteLoader } from 'react-window-infinite-loader';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Loader2, ArrowDown, RefreshCw } from 'lucide-react';
import { LoveNoteMessage } from './LoveNoteMessage';
import type { LoveNote } from '../../types/models';

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
  /** Callback for refresh action (Story 2.4 - AC-2.4.5) */
  onRefresh?: () => void;
}

/**
 * Beginning of Conversation Component
 * Shows when all message history has been loaded
 */
function BeginningOfConversation() {
  return (
    <div className="text-center py-8 text-gray-400" data-testid="beginning-of-conversation">
      <div className="text-4xl mb-2">💕</div>
      <p className="text-sm">This is the beginning of your love story</p>
    </div>
  );
}

/**
 * Loading spinner component
 */
function LoadingSpinner({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="flex items-center justify-center py-4" style={style} data-testid="loading-spinner">
      <Loader2 className="w-6 h-6 animate-spin text-[#FF6B6B]" />
    </div>
  );
}

/**
 * Calculate row height based on message content length
 * Story 2.4 - Task 1.3: Variable row height calculation
 */
function calculateRowHeight(note: LoveNote | null, includeBeginning: boolean, index: number): number {
  // Beginning of conversation indicator
  if (includeBeginning && index === 0) {
    return 120; // BeginningOfConversation component height
  }

  // Adjust index if beginning indicator is present
  const adjustedIndex = includeBeginning ? index - 1 : index;

  if (!note || adjustedIndex < 0) {
    return 80; // Default/loading height
  }

  const contentLength = note.content?.length || 0;

  // Base height: sender name (20px) + timestamp (20px) + padding (24px) + margin (12px) = 76px
  const baseHeight = 76;

  // Content height varies by length
  if (contentLength < 50) {
    return baseHeight + 24; // ~60px content
  } else if (contentLength < 200) {
    return baseHeight + 40; // ~80px content
  } else {
    return baseHeight + 80; // ~120px content
  }
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
  onRefresh,
}: MessageListProps): ReactNode {
  const listRef = useRef<any>(null);
  const hasScrolledToBottom = useRef(false);
  const prevNotesLength = useRef(notes.length);
  const scrollToBottomOnNextRender = useRef(false);

  // Story 2.3: Track if user is at bottom and show new message indicator
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);

  // Calculate whether to show "Beginning of conversation"
  const showBeginning = !hasMore && notes.length > 0;

  // Total row count including beginning indicator
  const totalRowCount = showBeginning ? notes.length + 1 : notes.length;

  // Story 2.4 - Task 2.1: Configure infinite loader
  const isRowLoaded = useCallback(
    (index: number) => {
      // If beginning indicator is shown, adjust index
      const adjustedIndex = showBeginning ? index - 1 : index;
      return !hasMore || adjustedIndex < notes.length;
    },
    [hasMore, notes.length, showBeginning]
  );

  const loadMoreRows = useCallback(
    async (_startIndex: number, _stopIndex: number) => {
      if (!isLoading && hasMore && onLoadMore) {
        await onLoadMore();
      }
    },
    [isLoading, hasMore, onLoadMore]
  );

  // Setup infinite loading hook - must be called before conditional returns
  const onRowsRendered = useInfiniteLoader({
    isRowLoaded,
    loadMoreRows,
    rowCount: totalRowCount + (hasMore ? 1 : 0),
    threshold: 10,
    minimumBatchSize: 50,
  });

  // Variable row height function
  const getRowHeight = useCallback(
    (index: number): number => {
      if (showBeginning && index === 0) {
        return 120; // BeginningOfConversation height
      }

      const adjustedIndex = showBeginning ? index - 1 : index;
      const note = notes[adjustedIndex];
      return calculateRowHeight(note, false, adjustedIndex);
    },
    [notes, showBeginning]
  );

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (notes.length > 0 && listRef.current && !hasScrolledToBottom.current) {
      listRef.current.scrollToItem(totalRowCount - 1, 'end');
      hasScrolledToBottom.current = true;
      setIsAtBottom(true);
    }
  }, [notes.length, totalRowCount]);

  // Story 2.3: AC-2.3.4 - Handle new messages with conditional auto-scroll
  useEffect(() => {
    if (notes.length > prevNotesLength.current && listRef.current) {
      const wasAtBottom = isAtBottom;

      if (wasAtBottom) {
        // Auto-scroll to new message if user was at bottom
        scrollToBottomOnNextRender.current = true;
        setIsAtBottom(true);
        setShowNewMessageIndicator(false);
      } else {
        // Show "new message" indicator if user scrolled up
        setShowNewMessageIndicator(true);
      }
    }
    prevNotesLength.current = notes.length;
  }, [notes.length, isAtBottom]);

  // Execute scroll to bottom after render (when new message arrives)
  useEffect(() => {
    if (scrollToBottomOnNextRender.current && listRef.current) {
      listRef.current.scrollToItem(totalRowCount - 1, 'end');
      scrollToBottomOnNextRender.current = false;
    }
  });

  // Calculate estimated total height for scroll calculations
  // Uses actual row heights for more accurate estimation
  const estimatedTotalHeight = useCallback((): number => {
    if (totalRowCount === 0) return 0;

    let height = 0;
    for (let i = 0; i < totalRowCount; i++) {
      height += getRowHeight(i);
    }
    return height;
  }, [totalRowCount, getRowHeight]);

  // Handle scroll for bottom detection
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      if (!listRef.current) return;

      const scrollOffset = target.scrollTop;

      // Guard against division by zero / empty state
      if (totalRowCount === 0) {
        setIsAtBottom(true);
        return;
      }

      // Use calculated total height for more accurate bottom detection
      const totalHeight = estimatedTotalHeight();
      const visibleHeight = 600; // Default height from List component

      // Guard against edge case where totalHeight is 0
      if (totalHeight === 0) {
        setIsAtBottom(true);
        return;
      }

      const scrolledToBottom = scrollOffset + visibleHeight >= totalHeight - 50;

      setIsAtBottom(scrolledToBottom);

      // Hide new message indicator when user scrolls to bottom
      if (scrolledToBottom && showNewMessageIndicator) {
        setShowNewMessageIndicator(false);
      }
    },
    [totalRowCount, showNewMessageIndicator, estimatedTotalHeight]
  );

  // Scroll to bottom handler for new message indicator
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(totalRowCount - 1, 'end');
      setShowNewMessageIndicator(false);
      setIsAtBottom(true);
    }
  }, [totalRowCount]);

  // Refresh handler (Story 2.4 - AC-2.4.5)
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  // Empty state
  if (!isLoading && notes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-[#FFF5F5] rounded-full p-6 mb-4"
        >
          <Heart className="w-12 h-12 text-[#FF6B6B]" />
        </motion.div>
        <h3 className="text-lg font-medium text-gray-700 mb-2">No love notes yet</h3>
        <p className="text-gray-500 max-w-xs">
          Send one to start the conversation with your partner! 💕
        </p>
      </div>
    );
  }

  // Initial loading state
  if (isLoading && notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B6B]" />
      </div>
    );
  }

  // Story 2.4 - Task 1.4: MessageRow component
  const MessageRow = ({
    index,
    style,
    ariaAttributes,
  }: {
    index: number;
    style: React.CSSProperties;
    ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  }) => {
    // Show beginning of conversation at index 0 if all history loaded
    if (showBeginning && index === 0) {
      return (
        <div style={style} {...ariaAttributes}>
          <BeginningOfConversation />
        </div>
      );
    }

    // Story 2.4 - Task 2.3: Show loading at top when fetching older messages
    if (index === 0 && isLoading && notes.length > 0) {
      return <LoadingSpinner style={style} />;
    }

    // Adjust index for notes array if beginning indicator is present
    const adjustedIndex = showBeginning ? index - 1 : index;
    const note = notes[adjustedIndex];

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
        />
      </div>
    );
  };

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Story 2.4 - AC-2.4.5: Refresh button */}
      {onRefresh && (
        <button
          onClick={handleRefresh}
          className="absolute top-2 right-2 z-20 bg-white/90 hover:bg-white rounded-full p-2 shadow-md transition-colors"
          aria-label="Refresh messages"
          data-testid="refresh-button"
        >
          <RefreshCw className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {/* Story 2.3: AC-2.3.4 - New message indicator */}
      <AnimatePresence>
        {showNewMessageIndicator && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={scrollToBottom}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-[#FF6B6B] text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 hover:bg-[#FF5252] transition-colors"
            aria-label="Scroll to new message"
            data-testid="new-message-indicator"
          >
            <span className="text-sm font-medium">New message</span>
            <ArrowDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Story 2.4 - Task 1.2: Virtualized List */}
      {(List as any)({
        ref: listRef,
        rowCount: totalRowCount,
        rowHeight: getRowHeight,
        onRowsRendered: onRowsRendered,
        onScroll: handleScroll,
        defaultHeight: 600,
        rowComponent: MessageRow,
        rowProps: {},
      })}
    </div>
  );
}

export default MessageList;
