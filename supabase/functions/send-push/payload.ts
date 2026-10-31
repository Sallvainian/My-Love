/**
 * The push a love note becomes. Pure: no network, no clock.
 *
 * Payload contract (story 3.1): `aps.alert.title` is the sender's display
 * name, `body` the note's text or "Sent you a picture" for a picture-only
 * note, `thread-id` is `love-notes` so love notes stack apart from every other
 * push. No image, and no `badge` (the unread count arrives in story 3.8).
 */

export const LOVE_NOTES_THREAD_ID = 'love-notes';
export const PICTURE_ONLY_BODY = 'Sent you a picture';
/** Used when the sender has no display name on record. */
export const FALLBACK_SENDER_NAME = 'Your partner';

/** The columns of `love_notes` the payload is built from. */
export interface PushNote {
  content: string;
  image_url: string | null;
}

export interface ApnsPayload {
  aps: {
    alert: { title: string; body: string };
    'thread-id': string;
  };
}

/**
 * A picture-only note stores no caption. The column cannot be empty, so the
 * client's stand-in text counts as no text too.
 */
function hasCaption(note: PushNote): boolean {
  return note.content.trim().length > 0;
}

export function buildLoveNotePayload(note: PushNote, senderName: string | null): ApnsPayload {
  const title = senderName?.trim() || FALLBACK_SENDER_NAME;
  const body = note.image_url && !hasCaption(note) ? PICTURE_ONLY_BODY : note.content;
  return {
    aps: {
      alert: { title, body },
      'thread-id': LOVE_NOTES_THREAD_ID,
    },
  };
}
