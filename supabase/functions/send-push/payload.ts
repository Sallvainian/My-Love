/**
 * The push a love note becomes. Pure: no network, no clock.
 *
 * Payload contract (story 3.1): `aps.alert.title` is the sender's display
 * name, `body` the note's text or "Sent you a picture" for a picture-only
 * note, `thread-id` is `love-notes` so love notes stack apart from every other
 * push. No image, and no `badge` (the unread count arrives in story 3.8).
 *
 * Story 3.4 adds the partner's mood, photo, poke and kiss. They share one
 * thread, `partner-activity`, so they stack apart from love notes; the title
 * is again the sender's display name; no image, no `badge`, no `sound`.
 */

export const LOVE_NOTES_THREAD_ID = 'love-notes';
export const PICTURE_ONLY_BODY = 'Sent you a picture';
/** Used when the sender has no display name on record. */
export const FALLBACK_SENDER_NAME = 'Your partner';
/** The lock-screen stack for a partner's mood, photo, poke and kiss. */
export const PARTNER_ACTIVITY_THREAD_ID = 'partner-activity';
export const MOOD_BODY_PREFIX = 'Logged a mood';
export const PHOTO_BODY = 'Added a photo';
export const POKE_BODY = 'Poked you';
export const KISS_BODY = 'Sent you a kiss';

/**
 * Display labels for the 12 mood types, in `MOOD_TYPES` order. A copy: this
 * function cannot import `src/`. The source is `MOOD_DISPLAY`
 * (`src/constants/moodDisplay.ts`); change both together.
 */
export const MOOD_LABELS: Record<string, string> = {
  loved: 'Loved',
  happy: 'Happy',
  content: 'Content',
  excited: 'Excited',
  thoughtful: 'Thoughtful',
  grateful: 'Grateful',
  sad: 'Sad',
  anxious: 'Anxious',
  frustrated: 'Frustrated',
  angry: 'Angry',
  lonely: 'Lonely',
  tired: 'Tired',
};

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

/** The columns of `moods` the payload is built from. */
export interface PushMood {
  mood_type: string | null;
  mood_types: string[] | null;
}

function isMoodType(value: unknown): value is string {
  return typeof value === 'string' && Object.hasOwn(MOOD_LABELS, value);
}

/**
 * The labels of a mood, by the rule of `normalizeMoodValues`
 * (`src/types/moods.ts`): the valid `mood_types` in stored order, else
 * `mood_type` when valid, else none. No reordering and no deduplication.
 */
export function moodLabels(mood: PushMood): string[] {
  const valid = Array.isArray(mood.mood_types) ? mood.mood_types.filter(isMoodType) : [];
  if (valid.length === 0 && isMoodType(mood.mood_type)) valid.push(mood.mood_type);
  return valid.map((value) => MOOD_LABELS[value]);
}

function partnerActivityPayload(body: string, senderName: string | null): ApnsPayload {
  return {
    aps: {
      alert: { title: senderName?.trim() || FALLBACK_SENDER_NAME, body },
      'thread-id': PARTNER_ACTIVITY_THREAD_ID,
    },
  };
}

/** `Logged a mood: Happy, Grateful`; the mood's note is never included. */
export function buildMoodPayload(mood: PushMood, senderName: string | null): ApnsPayload {
  const labels = moodLabels(mood);
  return partnerActivityPayload(
    labels.length > 0 ? `${MOOD_BODY_PREFIX}: ${labels.join(', ')}` : MOOD_BODY_PREFIX,
    senderName
  );
}

export function buildPhotoPayload(senderName: string | null): ApnsPayload {
  return partnerActivityPayload(PHOTO_BODY, senderName);
}

/** Null for a type that is not a push (only `poke` and `kiss` are). */
export function buildInteractionPayload(type: string, senderName: string | null): ApnsPayload | null {
  if (type === 'poke') return partnerActivityPayload(POKE_BODY, senderName);
  if (type === 'kiss') return partnerActivityPayload(KISS_BODY, senderName);
  return null;
}
