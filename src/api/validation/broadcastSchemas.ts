import { z } from 'zod/v4';
import type { LoveNote } from '../../types/models';
import { logger } from '../../utils/logger';
import { SupabaseMoodSchema, TimestampSchema, UUIDSchema } from './supabaseSchemas';
import type { SupabaseMood } from './supabaseSchemas';

/**
 * Sent on `mood-updates:<senderId>` by the account that just accepted
 * `senderId`'s partner request, so the sender's open Partner tab re-reads its
 * partner instead of showing "Connect" until a reload; see
 * `moodSyncService.announcePartnerLinked`.
 *
 * It rides the sender's own mood topic because that is the one channel an
 * unlinked account already listens on, and `couple_broadcast_partner_can_send`
 * lets exactly the new partner publish there the moment the link exists. The
 * payload is empty and trusted for nothing: it only prompts a server re-read.
 */
export const PARTNER_LINKED_EVENT = 'partner_linked';

/**
 * Sent on `mood-updates:<partnerId>` after a confirmed daily pick. The body is
 * `{ day_id }` and nothing else: never a choice. The receiver re-reads that
 * day from the server (architecture AD-11).
 */
export const DAILY_PICK_EVENT = 'daily_pick';

/** Sent on `mood-updates:<partnerId>` by `moodSyncService.broadcastMoodToPartner`. */
export const NEW_MOOD_EVENT = 'new_mood';

/**
 * Sent on `mood-updates:<partnerId>` by a device that just added, edited or
 * deleted an event or an anniversary (`moodSyncService.announceDatesChanged`),
 * so the partner's open app re-reads both instead of showing a date that is
 * gone until it next loads them. Like PARTNER_LINKED_EVENT, the payload is
 * empty and trusted for nothing: it only prompts a server re-read, and
 * `couple_broadcast_partner_can_send` lets only the partner publish on the
 * topic.
 */
export const DATES_CHANGED_EVENT = 'dates_changed';

/** Every event the `mood-updates:<uuid>` channel binds, once each, when it is created. */
export const PARTNER_EVENTS = [
  PARTNER_LINKED_EVENT,
  DAILY_PICK_EVENT,
  NEW_MOOD_EVENT,
  DATES_CHANGED_EVENT,
] as const;

export type PartnerEventName = (typeof PARTNER_EVENTS)[number];

/** A validated partner broadcast. */
export type PartnerEvent =
  | { event: typeof PARTNER_LINKED_EVENT }
  | { event: typeof DAILY_PICK_EVENT; day_id: string }
  | { event: typeof NEW_MOOD_EVENT; mood: SupabaseMood }
  | { event: typeof DATES_CHANGED_EVENT };

/**
 * Wire validation for the two couple broadcast topics
 *
 * `love-notes:<uuid>` and `mood-updates:<uuid>` carry client-to-client
 * Realtime broadcasts. `mood-updates:<uuid>` carries one registry of partner
 * events (`PartnerEvent`: `partner_linked`, `daily_pick`, `new_mood`,
 * `dates_changed`), and
 * `parsePartnerEvent` is the one door each of them passes through.
 *
 * RLS on `realtime.messages` decides who may join and who may send, but it
 * says nothing about what a permitted sender puts in the body — and until this module existed both receivers trusted the wire
 * completely: `useRealtimeMessages` destructured `payload.payload.message`
 * straight into `addNote`, and `moodSyncService` hand-built a
 * `SupabaseMoodRecord` field by field with no parse.
 *
 * Two things happen here, and both matter:
 *
 *   1. **Shape.** A zod object parse, so a missing id, a non-string content or
 *      a non-object payload is dropped instead of reaching state. Zod's default
 *      object behaviour is to STRIP unknown keys, which is what removes every
 *      client-only `LoveNote` field from the wire — `imagePreviewUrl` above
 *      all. `LoveNoteMessage.tsx:126-128` prefers `imagePreviewUrl` over the
 *      signed Storage URL and lands it in an `<img src>`, so a forged preview
 *      URL would otherwise make the victim's browser fetch an attacker host.
 *      The field is legitimate for locally created `blob:` previews; it is
 *      never legitimate off the wire.
 *
 *   2. **Direction.** The ids in the body must match the identity this client
 *      subscribed as. A love note must be addressed TO the signed-in user and
 *      FROM the partner snapshot taken at join; a mood must come FROM that same
 *      partner. RLS alone cannot cover this — authorization is evaluated at
 *      join and cached until the JWT refreshes, so a relationship that ends
 *      mid-session is caught here, at the message, not there.
 *
 * Both features share this boundary deliberately. `usePartnerMood.ts:84`
 * already filtered on the sender, but `PartnerMoodView.tsx:182-190` raised a
 * toast for any broadcast at all, so the check has to sit where every consumer
 * passes through it.
 *
 * Every rejection is a debug log and a `null`, never a throw: a forged or
 * malformed broadcast is not an application error, and a receiver that threw
 * inside a Realtime callback would take the channel's handler down with it.
 *
 * @module api/validation/broadcastSchemas
 */

/**
 * Identity a love-note broadcast is validated against.
 *
 * Both fields are snapshots taken by the subscriber: `currentUserId` at
 * subscribe, `partnerId` at join and refreshed on `SUBSCRIBED`.
 */
export interface LoveNoteBroadcastIdentity {
  currentUserId: string | null;
  partnerId: string | null;
}

/** Identity a partner event is validated against. */
export interface PartnerEventIdentity {
  partnerId: string | null;
}

/** Identity a mood broadcast is validated against. */
export interface MoodBroadcastIdentity {
  partnerId: string | null;
}

/**
 * Server-side fields of a love note, and nothing else.
 *
 * Deliberately NOT derived from the `LoveNote` interface: that type carries the
 * client-only optimistic-update fields (`sending`, `error`, `tempId`,
 * `imageUploading`, `imageBlob`, `imagePreviewUrl`), none of which may cross
 * the wire. Listing only the server columns is what makes zod's strip
 * meaningful.
 */
export const LoveNoteBroadcastSchema = z.object({
  id: UUIDSchema,
  from_user_id: UUIDSchema,
  to_user_id: UUIDSchema,
  // Bounded to the DB's own range. `love_notes_content_check` is
  // `char_length(content) between 1 and 1000`, so anything outside it cannot be
  // a real row and has no business reaching the chat.
  content: z.string().min(1).max(1000),
  created_at: TimestampSchema,
  image_url: z.string().nullable().optional(),
  idempotency_key: z.string().nullable().optional(),
  // Optional: a client from before the column existed sends no such key.
  written_at: TimestampSchema.nullable().optional(),
});

/**
 * Mood wire schema: the validated mood row, minus `updated_at`.
 *
 * `moodSyncService.broadcastMoodToPartner` sends six fields and no
 * `updated_at`, so the row schema would reject every legitimate broadcast on a
 * missing key. `created_at` stays required — a mood with no timestamp is the
 * malformed case, not a tolerated one.
 */
export const MoodBroadcastSchema = SupabaseMoodSchema.extend({
  // Bounded to the DB's own range, for the same reason `content` is on the note
  // schema. `moods_note_check` is `char_length(note) <= 500`
  // (20251206024345_remote_schema.sql:117), so a longer one cannot be a real
  // row -- and PartnerMoodDisplay renders it unbounded.
  note: z.string().max(500).nullable(),
  // Non-null, unlike the row schema. `moods.created_at` is nullable in the
  // column, but a null one off the wire is indistinguishable from a missing
  // one downstream: PartnerMoodDisplay substitutes `new Date()` and renders the
  // mood as "Just now", so a forged null becomes a fake fresh mood.
  created_at: TimestampSchema,
  updated_at: TimestampSchema.nullable().optional(),
});

/**
 * Parse and authorize one love-note broadcast body.
 *
 * @param raw - The broadcast payload's `message` value, unvalidated
 * @param identity - Who this subscriber is, and who its partner was at join
 * @returns The note with client-only fields stripped, or `null` if it is
 *   malformed, misdirected, or arrived while no partner was known
 */
export function parseLoveNoteBroadcast(
  raw: unknown,
  identity: LoveNoteBroadcastIdentity
): LoveNote | null {
  const { currentUserId, partnerId } = identity;

  // No identity means nothing to compare against, so nothing can be trusted.
  // This is the sign-out window and the not-yet-linked case.
  if (!currentUserId || !partnerId) {
    logger.debug('[BroadcastValidation] Dropped a love note: no partner identity to check against');
    return null;
  }

  const result = LoveNoteBroadcastSchema.safeParse(raw);
  if (!result.success) {
    logger.debug('[BroadcastValidation] Dropped a malformed love note broadcast');
    return null;
  }

  const note = result.data;

  if (note.to_user_id !== currentUserId) {
    logger.debug('[BroadcastValidation] Dropped a love note addressed to someone else');
    return null;
  }

  if (note.from_user_id !== partnerId) {
    logger.debug('[BroadcastValidation] Dropped a love note from a non-partner sender');
    return null;
  }

  return note;
}

/**
 * Parse and authorize one mood broadcast body.
 *
 * @param raw - The broadcast payload, unvalidated
 * @param identity - The partner snapshot taken at join
 * @returns A complete mood record, or `null` if it is malformed or not the
 *   partner's
 */
export function parseMoodBroadcast(
  raw: unknown,
  identity: MoodBroadcastIdentity
): SupabaseMood | null {
  const { partnerId } = identity;

  if (!partnerId) {
    logger.debug('[BroadcastValidation] Dropped a mood: no partner identity to check against');
    return null;
  }

  const result = MoodBroadcastSchema.safeParse(raw);
  if (!result.success) {
    logger.debug('[BroadcastValidation] Dropped a malformed mood broadcast');
    return null;
  }

  const mood = result.data;

  if (mood.user_id !== partnerId) {
    logger.debug('[BroadcastValidation] Dropped a mood broadcast from a non-partner sender');
    return null;
  }

  // The sender never puts `updated_at` on the wire; the receiver has always
  // used the creation time in its place.
  return { ...mood, updated_at: mood.updated_at ?? mood.created_at };
}

/**
 * Wire schema of a `daily_pick` body. Zod strips unknown keys, so a payload
 * carrying anything beside `day_id` -- a choice above all -- reaches no
 * handler with it.
 */
export const DailyPickBroadcastSchema = z.object({ day_id: UUIDSchema });

/**
 * Parse and authorize one partner broadcast, whichever event it is.
 *
 * - `partner_linked` and `dates_changed` are always returned: their bodies are
 *   trusted for nothing, they only prompt a server re-read.
 * - `new_mood` goes through `parseMoodBroadcast`.
 * - `daily_pick` needs a known partner (a channel whose account changed is
 *   muted that way) and a body of `{ day_id: uuid }`. It too only asks for a
 *   server re-read, so nothing else on the wire is read.
 *
 * @param event - The broadcast's event name
 * @param raw - The broadcast payload, unvalidated
 * @param identity - The partner snapshot taken at join
 * @returns The validated event, or `null` if it is unknown, malformed or
 *   arrived while no partner was known
 */
export function parsePartnerEvent(
  event: string,
  raw: unknown,
  identity: PartnerEventIdentity
): PartnerEvent | null {
  switch (event) {
    case PARTNER_LINKED_EVENT:
      return { event: PARTNER_LINKED_EVENT };
    case DATES_CHANGED_EVENT:
      return { event: DATES_CHANGED_EVENT };
    case NEW_MOOD_EVENT: {
      const mood = parseMoodBroadcast(raw, identity);
      return mood ? { event: NEW_MOOD_EVENT, mood } : null;
    }
    case DAILY_PICK_EVENT: {
      if (!identity.partnerId) {
        logger.debug('[BroadcastValidation] Dropped a daily pick: no partner identity to check against');
        return null;
      }
      const result = DailyPickBroadcastSchema.safeParse(raw);
      if (!result.success) {
        logger.debug('[BroadcastValidation] Dropped a malformed daily pick broadcast');
        return null;
      }
      return { event: DAILY_PICK_EVENT, day_id: result.data.day_id };
    }
    default:
      logger.debug('[BroadcastValidation] Dropped a partner broadcast of an unknown event');
      return null;
  }
}
