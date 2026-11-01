import { isOnline } from '../api/errorHandlers';
import { supabase } from '../api/supabaseClient';
import { clearAppBadge } from './pushNotifications';

/**
 * Marks the signed-in account's love notes as read (story 3.8).
 *
 * The server keeps one marker per account, `love_notes_read_markers`, written
 * with the server clock through `mark_love_notes_read()`. The sender counts
 * the partner notes newer than it and puts the count in every push's badge.
 * Opening Love Notes writes the marker and clears the app icon's badge.
 *
 * Runs on every surface (the website, the Home Screen web app and every
 * shell): the marker is server state. Only the badge clear is native, and it
 * does nothing outside a shell that has the `AppBadge` plugin.
 *
 * Never throws and shows nothing: a failure is only logged. Offline it clears
 * the badge and sends no request; the caller marks again when the connection
 * returns.
 */
export async function markLoveNotesRead(): Promise<void> {
  await clearAppBadge();
  if (!isOnline()) return;
  try {
    const { error } = await supabase.rpc('mark_love_notes_read');
    if (error) {
      console.error('[LoveNotes] Could not mark notes read:', error.message);
    }
  } catch (error) {
    console.error('[LoveNotes] Could not mark notes read:', error);
  }
}
