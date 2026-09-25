/**
 * LoveNotes Component
 *
 * Main page container for the Love Notes chat feature.
 * Composes the partner row, MessageList and MessageInput into a full chat view.
 *
 * Features:
 * - Full-screen chat layout
 * - Partner row (avatar, name, feed status) under a visually hidden h1
 * - Scrollable message list
 * - Message input with send functionality
 * - Safe area handling for mobile
 * - Error state display with retry
 *
 * Story 2.1: AC-2.1.1 (message display), AC-2.1.3 (message list)
 * Story 2.2: AC-2.2.1 (message input), AC-2.2.2 (send functionality)
 */

import { motion } from 'motion/react';
import { CircleAlert } from 'lucide-react';
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
 * Assembles the Love Notes UI: partner row, message list and message input,
 * on the style-kit tokens from index.css (no dark-mode variants; the kit
 * variables switch with the OS theme).
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
    removeFailedMessage,
    realtimeStatus,
  } = useLoveNotes();

  /**
   * What to announce about the live feed, if anything.
   *
   * Only the two states worth interrupting the chat for get an announced
   * notice. `connected` shows a quiet "Connected" line in the partner row that
   * is not a live region, and `connecting`/`idle` show nothing: a working feed
   * should not narrate itself, and an announcement that always fires is the
   * one nobody listens to on the day it matters.
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

  // userId and the removal action from the store
  const currentUserId = useAppStore((state) => state.userId) ?? '';
  const removeNote = useAppStore((state) => state.removeNote);

  // The confirmation lives here rather than inside a message row: rows sit in
  // MessageList's overflow-hidden virtualized container and Motion puts a
  // transform on the message wrapper, either of which would trap a
  // fixed-position dialog inside the row.
  const [notePendingRemoval, setNotePendingRemoval] = useState<LoveNote | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Stable identity: useFocusTrap depends on the dialog's onEscape, so an inline
  // arrow here re-armed the trap and pulled focus back to Cancel on every render
  // of this screen -- one arriving realtime note was enough.
  const closeRemovalDialog = useCallback(() => setNotePendingRemoval(null), []);

  // A failed note has no server row -- removeNote refuses its tempId -- so the
  // same confirmation deletes it from this device instead, queue row and all.
  const pendingTempId = notePendingRemoval?.tempId;
  const confirmRemoval = useCallback(
    async (noteId: string) => {
      if (pendingTempId) {
        removeFailedMessage(pendingTempId);
        return;
      }
      await removeNote(noteId);
    },
    [pendingTempId, removeFailedMessage, removeNote]
  );
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

  // The avatar's initial: the partner's name, or "P" while it is unknown
  // (getPartnerDisplayName answered null, or has not answered yet). The first
  // code point, not UTF-16 unit, so a name opening with an emoji is not split.
  const partnerInitial = Array.from(partnerName.trim())[0]?.toUpperCase() || 'P';

  return (
    // Fills <main>, which App pins between the top bar and the dock for this
    // view, so the page itself has nothing to scroll.
    <div className="flex min-h-0 flex-1 flex-col bg-page">
      {/* The app top bar already names the app; the view title stays for
          assistive tech and the heading outline, but is not drawn. */}
      <h1 className="sr-only">Love Notes</h1>

      {/* Partner row: who this conversation is with, and the feed status. */}
      <div className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-3" data-testid="notes-partner-row">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-partner text-base font-semibold text-card"
          aria-hidden="true"
        >
          {partnerInitial}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-base font-semibold text-ink">{partnerName}</p>
          {realtimeStatus === 'connected' && (
            // The feed status, not partner presence -- there is no presence
            // feature, so this must never read "Online". Not a live region: a
            // healthy feed should not announce itself.
            <p className="flex items-center gap-1.5 text-[13px] text-muted">
              <span className="h-2 w-2 shrink-0 rounded-full bg-good" aria-hidden="true" />
              Connected
            </p>
          )}
          {realtimeNotice && (
            // `role="status"` with a polite live region: this appears without
            // the person having done anything, so it has to be announced rather
            // than only seen. The error banner below is `role="alert"` instead.
            <p
              // Suffixed, not bare. `PartnerMoodView.tsx:548` already uses
              // `realtime-connection-status` for a different feed with a
              // different vocabulary; the two are never on screen together
              // today, but a spec written against the bare id would read as
              // feed-agnostic and bind to whichever view happened to be
              // mounted.
              data-testid="realtime-connection-status-notes"
              role="status"
              aria-live="polite"
              className={`flex items-center gap-1.5 text-[13px] ${
                realtimeStatus === 'disconnected' ? 'text-danger' : 'text-muted'
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  realtimeStatus === 'disconnected' ? 'bg-danger' : 'bg-muted'
                }`}
                aria-hidden="true"
              />
              {realtimeNotice}
            </p>
          )}
        </div>
      </div>
      <div className="h-px shrink-0 bg-line" />

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3 flex shrink-0 items-center gap-3 rounded-[14px] bg-dtint p-3"
        >
          <CircleAlert className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <p className="flex-1 text-sm text-danger" role="alert">
            {error}
          </p>
          <button onClick={clearError} className="text-sm font-semibold text-danger hover:underline">
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
          onConfirmRemove={confirmRemoval}
          fallbackFocusRef={threadRef}
        />
      )}
    </div>
  );
}
