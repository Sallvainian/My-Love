/**
 * The push a love note becomes. Pure: no network, no clock.
 *
 * Payload contract (story 3.1): `aps.alert.title` is the sender's display
 * name, `body` the note's text or "Sent you a picture" for a picture-only
 * note, `thread-id` is `love-notes` so love notes stack apart from every other
 * push. No image.
 *
 * Story 3.4 adds the partner's mood, photo, poke and kiss. They share one
 * thread, `partner-activity`, so they stack apart from love notes; the title
 * is again the sender's display name; no image, no `sound`.
 *
 * Story 3.5 adds the date changes (an event added or changed, the wedding
 * date, the date the couple got together, a birthday) on the same
 * `partner-activity` thread. The text never carries a date value, because the
 * recipient's timezone is unknown; an event's label is the only data in it.
 *
 * Story 3.6 adds a partner request and its acceptance, again on
 * `partner-activity`. The title is the other person's display name. A request
 * comes from someone who is not a partner yet, so with no name it falls back to
 * `Someone`; an acceptance comes from a linked partner, so it keeps `Your partner`.
 *
 * Story 3.8 adds the badge. The builders leave it out; `withBadge` puts the
 * recipient's unread love-note count in `aps.badge` of every payload, `0`
 * included (0 clears the icon's badge). There are two thread ids, pinned by
 * `payload.test.ts`: `love-notes` (`LOVE_NOTES_THREAD_ID`) for a love note and
 * `partner-activity` (`PARTNER_ACTIVITY_THREAD_ID`) for every other kind,
 * which story 4.6's reminders will use too.
 *
 * Story 3.9 adds `kind`, a top-level key beside `aps` (an APNs custom key): the
 * `PushKind` the sender handled (`love_note`, `mood`, `photo`, `interaction`,
 * `date`, `partner_request`, `partner_accept`). `withKind` puts it on every
 * payload. The web code reads it on a tap to choose the view to open
 * (`viewForPush`, `src/services/pushNotifications.ts`); `aps` is unchanged.
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
export const EVENT_ADDED_PREFIX = 'Added an event';
export const EVENT_CHANGED_PREFIX = 'Changed an event';
export const WEDDING_DATE_SET_BODY = 'Set the wedding date';
export const WEDDING_DATE_CHANGED_BODY = 'Changed the wedding date';
export const RELATIONSHIP_START_SET_BODY = 'Set the date you got together';
export const RELATIONSHIP_START_CHANGED_BODY = 'Changed the date you got together';
export const BIRTHDAY_ADDED_BODY = 'Added their birthday';
export const BIRTHDAY_CHANGED_BODY = 'Changed their birthday';
export const PARTNER_REQUEST_BODY = 'Sent you a partner request';
export const PARTNER_ACCEPT_BODY = 'Accepted your partner request';
/** Used when the asker has no display name: they are not a partner yet. */
export const FALLBACK_REQUESTER_NAME = 'Someone';

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
  /** The `PushKind` this push is about; the web code's tap routing key. Set by `withKind`. */
  kind?: string;
  aps: {
    alert: { title: string; body: string };
    'thread-id': string;
    /** The app icon's badge: the recipient's unread love notes. Set by `withBadge`. */
    badge?: number;
  };
}

/** A copy of the payload carrying `aps.badge`; the input is not changed. */
export function withBadge(payload: ApnsPayload, count: number): ApnsPayload {
  return { ...payload, aps: { ...payload.aps, badge: count } };
}

/** A copy of the payload carrying the top-level `kind`; the input is not changed. */
export function withKind(payload: ApnsPayload, kind: string): ApnsPayload {
  return { ...payload, kind };
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

/** The columns of `date_changes` the payload is built from, plus the event's label as it is now. */
export interface PushDateChange {
  subject: 'event' | 'wedding_date' | 'relationship_start' | 'birthday';
  action: 'added' | 'changed';
  /** `events.label` when the subject is an event, else null. */
  event_label: string | null;
}

/** `Added an event: Paris trip`, `Set the wedding date`, `Changed their birthday`, and so on. */
export function buildDatePayload(change: PushDateChange, senderName: string | null): ApnsPayload {
  const added = change.action === 'added';
  switch (change.subject) {
    case 'event':
      return partnerActivityPayload(
        `${added ? EVENT_ADDED_PREFIX : EVENT_CHANGED_PREFIX}: ${change.event_label ?? ''}`,
        senderName
      );
    case 'wedding_date':
      return partnerActivityPayload(added ? WEDDING_DATE_SET_BODY : WEDDING_DATE_CHANGED_BODY, senderName);
    case 'relationship_start':
      return partnerActivityPayload(
        added ? RELATIONSHIP_START_SET_BODY : RELATIONSHIP_START_CHANGED_BODY,
        senderName
      );
    case 'birthday':
      return partnerActivityPayload(added ? BIRTHDAY_ADDED_BODY : BIRTHDAY_CHANGED_BODY, senderName);
  }
}

/** `Sent you a partner request`, titled with the asker's name or `Someone`. */
export function buildPartnerRequestPayload(askerName: string | null): ApnsPayload {
  return {
    aps: {
      alert: { title: askerName?.trim() || FALLBACK_REQUESTER_NAME, body: PARTNER_REQUEST_BODY },
      'thread-id': PARTNER_ACTIVITY_THREAD_ID,
    },
  };
}

/** `Accepted your partner request`, titled with the accepter's name or `Your partner`. */
export function buildPartnerAcceptPayload(accepterName: string | null): ApnsPayload {
  return partnerActivityPayload(PARTNER_ACCEPT_BODY, accepterName);
}
