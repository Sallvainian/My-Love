/**
 * LoveNotes Component
 *
 * Main page container for the Love Notes chat feature.
 * Composes MessageList, MessageInput, and header into a full chat view.
 *
 * Features:
 * - Full-screen chat layout
 * - Header with title
 * - Scrollable message list
 * - Message input with send functionality
 * - Safe area handling for mobile
 * - Error state display with retry
 *
 * Story 2.1: AC-2.1.1 (message display), AC-2.1.3 (message list)
 * Story 2.2: AC-2.2.1 (message input), AC-2.2.2 (send functionality)
 */

import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { authService } from '../../api/authService';
import { getOwnDisplayName, getPartnerDisplayName } from '../../api/supabaseClient';
import { useLoveNotes } from '../../hooks/useLoveNotes';
import type { LoveNote } from '../../types/models';
import { useAppStore } from '../../stores/useAppStore';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { NoteRemoveConfirmation } from './NoteRemoveConfirmation';

/**
 * LoveNotes - Full chat page component
 *
 * Assembles the Love Notes UI with header, message list,
 * and eventually a message input (Story 2.2).
 */
export function LoveNotes(): ReactElement {
  const {
    notes,
    isLoading,
    error,
    hasMore,
    fetchOlderNotes,
    clearError,
    retryFailedMessage,
    realtimeStatus,
  } = useLoveNotes();

  /**
   * What to say about the live feed, if anything.
   *
   * Only the two states worth interrupting the chat for get text. `connected`,
   * `connecting` and `idle` render nothing at all: a working feed should not
   * narrate itself, and a badge that is always on screen is the one nobody
   * reads on the day it matters.
   *
   * `disconnected` is terminal -- the subscription gave up after five failed
   * re-joins and nothing re-arms it -- so the wording says what is true of the
   * feed rather than promising a recovery that is not coming. Reopening the
   * screen is what starts a new subscription.
   */
  const realtimeNotice =
    realtimeStatus === 'reconnecting'
      ? 'Reconnecting…'
      : realtimeStatus === 'disconnected'
        ? 'Not receiving new notes'
        : null;

  // Get navigation function and userId from store
  const navigateHome = useAppStore((state) => state.navigateHome);
  const currentUserId = useAppStore((state) => state.userId) ?? '';
  const removeNote = useAppStore((state) => state.removeNote);

  // The confirmation lives here rather than inside a message row: rows sit in
  // MessageList's overflow-hidden virtualized container and framer-motion puts a
  // transform on the message wrapper, either of which would trap a
  // fixed-position dialog inside the row.
  const [notePendingRemoval, setNotePendingRemoval] = useState<LoveNote | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Stable identity: useFocusTrap depends on the dialog's onEscape, so an inline
  // arrow here re-armed the trap and pulled focus back to Cancel on every render
  // of this screen -- one arriving realtime note was enough.
  const closeRemovalDialog = useCallback(() => setNotePendingRemoval(null), []);
  const [userName, setUserName] = useState<string>('You');
  // Partner name fetched from database (not local config)
  const [partnerName, setPartnerName] = useState<string>('Partner');

  // Fetch display names on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        // Own name from the profile row, the same place the partner's comes
        // from. It used to be read off auth user_metadata, which the setup
        // modal wrote — but `sync_user_profile()` copied that metadata over
        // `public.users.display_name` on every auth update, so the two could
        // disagree and the chat showed whichever one the caller happened to
        // ask. 20260912030000 made the profile row the single home.
        const [ownDisplayName, user] = await Promise.all([
          getOwnDisplayName(),
          authService.getUser(),
        ]);
        if (ownDisplayName) {
          setUserName(ownDisplayName);
        } else if (user?.email) {
          // Fallback to email prefix, for a profile still carrying only the
          // trigger's seed (and for a failed read, which is the same non-answer
          // as far as a rendered name is concerned).
          setUserName(user.email.split('@')[0]);
        }

        // Fetch partner's display name from database (not local config)
        const partnerDisplayName = await getPartnerDisplayName();
        if (partnerDisplayName) {
          setPartnerName(partnerDisplayName);
        }
      } catch (err) {
        console.error('[LoveNotes] Failed to fetch user info:', err);
      }
    };

    fetchUserInfo();
  }, []);

  return (
    <div className="flex h-[calc(100dvh-4rem-env(safe-area-inset-top)-var(--dock-clearance))] flex-col bg-[#FFF5F5]">
      {/* Header */}
      <header className="safe-area-top flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <button
          onClick={navigateHome}
          className="-ml-2 rounded-full p-2 transition-colors hover:bg-gray-100"
          aria-label="Go back home"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-lg font-semibold text-gray-800">Love Notes</h1>
          {realtimeNotice && (
            // `role="status"` with a polite live region, matching the error
            // banner's treatment below: this appears without the person having
            // done anything, so it has to be announced rather than only seen.
            // amber-700 and red-600 rather than the -500 pair, which is 3.82:1
            // on white and below the 4.5:1 AA floor at this size (DW-134).
            <span
              // Suffixed, not bare. `PartnerMoodView.tsx:548` already uses
              // `realtime-connection-status` for a different feed with a
              // different vocabulary; the two are never on screen together
              // today, but a spec written against the bare id would read as
              // feed-agnostic and bind to whichever view happened to be
              // mounted.
              data-testid="realtime-connection-status-notes"
              role="status"
              aria-live="polite"
              className={`text-xs ${
                realtimeStatus === 'disconnected' ? 'text-red-600' : 'text-amber-700'
              }`}
            >
              {realtimeNotice}
            </span>
          )}
        </div>

        {/* Spacer for symmetric header layout */}
        <div className="w-9" />
      </header>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button
            onClick={clearError}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/*
        The thread wrapper, and the focus destination for a removal that unmounts
        the control that requested it. It lives here rather than inside
        MessageList because MessageList has three roots -- the virtualized list,
        the empty state and the initial spinner -- and removing your last visible
        note swaps one for another in the same commit that closes the dialog. A
        destination inside MessageList is therefore gone exactly when it is
        needed. This element outlives all three.

        tabIndex -1 makes it a programmatic focus target without adding a tab
        stop. The outline is left to the browser: this is only ever focused by
        script, immediately after a keyboard-driven confirmation, so a keyboard
        user needs to see where they landed.
      */}
      <div ref={threadRef} tabIndex={-1} className="flex min-h-0 flex-1 flex-col">
        <MessageList
          notes={notes}
          currentUserId={currentUserId}
          partnerName={partnerName}
          userName={userName}
          isLoading={isLoading}
          onLoadMore={fetchOlderNotes}
          hasMore={hasMore}
          onRetry={retryFailedMessage}
          onRequestRemove={setNotePendingRemoval}
        />
      </div>

      {/* Message input - Story 2.2 */}
      <MessageInput />

      {notePendingRemoval && (
        <NoteRemoveConfirmation
          note={notePendingRemoval}
          onClose={closeRemovalDialog}
          onConfirmRemove={removeNote}
          fallbackFocusRef={threadRef}
        />
      )}
    </div>
  );
}

export default LoveNotes;
