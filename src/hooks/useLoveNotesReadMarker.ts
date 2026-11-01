/**
 * useLoveNotesReadMarker
 *
 * Marks the signed-in account's love notes as read while Love Notes is on
 * screen (story 3.8), so the server's unread count, and the app icon's badge
 * with it, stay right. "On screen" means the component using this hook is
 * mounted and `document.visibilityState` is `visible`. While it is, it marks:
 *
 * - once on mount;
 * - when the document becomes visible again;
 * - when the newest note from the partner changes id (one arrived, or the
 *   list loaded one newer than the copy it started with);
 * - on every push the shell reports while the app is in front, and again a
 *   moment later for the badge (below);
 * - when the connection returns (a mark made offline sent no request).
 *
 * Marking never throws and shows nothing (`markLoveNotesRead`).
 */

import { useEffect, useRef } from 'react';
import { markLoveNotesRead } from '../services/loveNotesReadService';
import { clearAppBadge, onForegroundPush } from '../services/pushNotifications';
import type { LoveNote } from '../types/models';

/**
 * The push plugin reports a foreground push to the web view and then returns
 * the presentation options, so iOS sets the payload's badge after the first
 * clear, not before it (measured on the Duo simulator in story 3.8: the clear
 * landed, the badge came back). The badge is cleared once more after this wait.
 */
export const FOREGROUND_BADGE_RECLEAR_MS = 1_000;

function isVisible(): boolean {
  return document.visibilityState === 'visible';
}

/** The id of the newest note in chat order (oldest first) that the signed-in user did not send. */
function newestPartnerNoteId(notes: LoveNote[], userId: string): string | null {
  for (let i = notes.length - 1; i >= 0; i--) {
    if (notes[i].from_user_id !== userId) return notes[i].id;
  }
  return null;
}

export function useLoveNotesReadMarker(notes: LoveNote[], userId: string): void {
  const newestId = newestPartnerNoteId(notes, userId);
  // The newest partner note this mount has already accounted for; the mount's
  // own mark covers the one present then.
  const seenIdRef = useRef<string | null>(newestId);

  useEffect(() => {
    const markIfVisible = () => {
      if (isVisible()) void markLoveNotesRead();
    };

    const reclears = new Set<ReturnType<typeof setTimeout>>();
    const onPush = () => {
      if (!isVisible()) return;
      void markLoveNotesRead();
      const timer = setTimeout(() => {
        reclears.delete(timer);
        if (isVisible()) void clearAppBadge();
      }, FOREGROUND_BADGE_RECLEAR_MS);
      reclears.add(timer);
    };

    markIfVisible();
    window.addEventListener('online', markIfVisible);
    document.addEventListener('visibilitychange', markIfVisible);
    const stopForegroundPush = onForegroundPush(onPush);
    return () => {
      window.removeEventListener('online', markIfVisible);
      document.removeEventListener('visibilitychange', markIfVisible);
      stopForegroundPush();
      reclears.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (newestId === seenIdRef.current) return;
    seenIdRef.current = newestId;
    // Null means no partner note is left (all removed): nothing to read.
    if (newestId !== null && isVisible()) void markLoveNotesRead();
  }, [newestId]);
}
