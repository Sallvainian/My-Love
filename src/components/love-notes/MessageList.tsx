/**
 * MessageList Component
 *
 * Scrollable list for Love Notes messages.
 * Uses simple scrolling with auto-scroll to bottom.
 *
 * Features:
 * - Auto-scroll to bottom on initial load and new messages
 * - Smooth scroll behavior
 * - Empty state when no messages
 * - Loading indicator
 *
 * Note: Virtualization can be added later if performance becomes an issue
 * with 50+ messages. For MVP, simple scrolling provides good UX.
 *
 * Story 2.1: AC-2.1.3 (message list display)
 */

import { useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Loader2 } from 'lucide-react';
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
}

/**
 * MessageList - Scrollable message container
 *
 * Renders love notes in a performant scrollable list.
 * Shows empty state or loading indicator as appropriate.
 */
export function MessageList({
  notes,
  currentUserId,
  partnerName,
  userName,
  isLoading,
  onLoadMore,
  hasMore = false,
}: MessageListProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToBottom = useRef(false);
  const prevNotesLength = useRef(notes.length);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (notes.length > 0 && containerRef.current && !hasScrolledToBottom.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      hasScrolledToBottom.current = true;
    }
  }, [notes.length]);

  // Scroll to bottom when new message is added
  useEffect(() => {
    if (
      notes.length > prevNotesLength.current &&
      containerRef.current &&
      hasScrolledToBottom.current
    ) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
    prevNotesLength.current = notes.length;
  }, [notes.length]);

  // Handle scroll for infinite loading
  const handleScroll = () => {
    if (!containerRef.current || !hasMore || isLoading || !onLoadMore) return;

    // Load more when scrolled near top (100px threshold)
    if (containerRef.current.scrollTop < 100) {
      onLoadMore();
    }
  };

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

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Loading indicator at top for loading older messages */}
      <AnimatePresence>
        {isLoading && notes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-white/90 rounded-full px-4 py-2 shadow-md flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin text-[#FF6B6B]" />
            <span className="text-sm text-gray-600">Loading...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable message container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
      >
        {notes.map((note) => {
          const isOwnMessage = note.from_user_id === currentUserId;
          const senderName = isOwnMessage ? userName : partnerName;

          return (
            <LoveNoteMessage
              key={note.id}
              message={note}
              isOwnMessage={isOwnMessage}
              senderName={senderName}
            />
          );
        })}
      </div>
    </div>
  );
}

export default MessageList;
