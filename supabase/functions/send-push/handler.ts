/**
 * Request handling for the `send-push` Edge Function.
 *
 * Called by database triggers with the shared secret in `x-push-secret`:
 *
 * - `love_notes` AFTER INSERT (`notify_love_note_push`,
 *   20261031000000_push_devices.sql) posts `{ "note_id": "<uuid>" }`;
 * - `moods`, `photos` and `interactions` AFTER INSERT (`notify_push`,
 *   20261031020000_push_moods_photos_interactions.sql) post
 *   `{ "kind": "mood" | "photo" | "interaction", "id": "<uuid>" }`;
 * - `partner_requests` (`notify_push`, 20261031040000_push_partner_requests.sql)
 *   posts `{ "kind": "partner_request", "id": "<request id>" }` for an INSERT
 *   of a pending request and `{ "kind": "partner_accept", "id": ... }` for a
 *   `pending` to `accepted` UPDATE;
 * - `events` and `anniversaries` AFTER INSERT (`notify_push`,
 *   20261105010000_push_added_dates.sql) post `{ "kind": "event" | "anniversary",
 *   "id": "<uuid>" }`. Only an added date pushes; an edit has no trigger;
 * - the three daily kinds (push-copy.md): `daily_both_answered` posts a
 *   `daily_picks` id, `daily_nudge` a `daily_nudges` id and `daily_reminder` a
 *   `daily_reminders` id. `daily_question` and `daily_partner_picked`, which
 *   epic 8 added, are removed (story 11.2): their triggers are gone and the
 *   sender answers 400 to either, claiming nothing.
 *
 * Split out of `index.ts` so `deno test` can drive it with a fake database
 * and a fake APNs client.
 *
 * ## Authentication
 *
 * `verify_jwt` is off for this function (supabase/config.toml): the caller is
 * a database trigger, which has no user JWT. It presents a shared secret
 * instead, kept in the service-only `push_sender_settings` table that the
 * sender reads with the service role. No secret on record answers 401, so an
 * unconfigured stack accepts nothing.
 *
 * ## Why only a row id is accepted
 *
 * The sender reads the row itself with the service role and derives the
 * sender's name and the recipient from it, so a forged call can name no target
 * beyond an existing row. The recipient of a note is its `to_user_id`, of an
 * interaction its `to_user_id`, and of a mood, photo, event or anniversary the
 * sender's (the row owner's) `users.partner_id`. A partner request goes to its `to_user_id` (the asker is
 * the sender) and its acceptance to its `from_user_id` (the accepter,
 * `to_user_id`, is the sender); neither looks up a partner, since the asker is
 * not linked yet. An owner with no partner, or a recipient equal to the sender,
 * answers 200 with every count 0 and claims nothing. An interaction whose type
 * is not `poke` or `kiss` does the same, and so does a `partner_accept` whose
 * request is not `accepted` now: the post is a claim that it was, so a forged or
 * replayed one announces nothing.
 *
 * ## The daily kinds
 *
 * A second pick goes to the other member of its `couple_days` pair (not
 * `users.partner_id`), the picker is the sender: `daily_both_answered` says the
 * partner answered too, and always reads the same ("You both answered today's
 * question" over "Click to see what your partner answered!"), whatever the day
 * or the streak. A nudge goes from `from_user` to `to_user`. A reminder goes to
 * its `user_id` and its sender is the recipient's partner; no partner means
 * nothing to tell. The posted kind decides the copy and the sender never infers
 * order or variant: a reminder's stored `kind` must be `evening_self` and a
 * pick's stored `is_second` must be true for `daily_both_answered`, and a
 * mismatch is no push, claiming nothing. The sender reads no date and no
 * streak: the 8 PM reminder and both-answered wording take no argument. A nudge
 * names no streak: its body is the same for every nudge, and a held one whose
 * `released_at` is still null is dropped the same way (the release posts it
 * again). The sender never selects a pick's `choice`, and no payload carries
 * one. Only the nudge and the 8 PM reminder carry `aps.sound`.
 *
 * ## The receiver's switches
 *
 * `push_preferences` (20261031050000_push_preferences.sql) holds one boolean
 * per kind of push, one row per account; no row means every kind is on. After
 * the "nobody to tell" return and before it lists any device, the sender reads
 * the recipient's switch for the kind (`PREFERENCE_FOR_KIND`; both partner
 * kinds share `partner_requests`). A switch that is off answers 200 with every
 * count 0, claims nothing and lists no devices. A failed read answers 500.
 *
 * ## The badge
 *
 * Every payload carries `aps.badge`: the recipient's unread love notes, read
 * through `PushDb.countUnreadNotes` (`unread_love_note_count`,
 * 20261101000000_love_notes_read_markers.sql: partner notes newer than the
 * recipient's `love_notes_read_markers` row, every note when they have none).
 * `0` is sent as well, because it clears the badge. A love note's push counts
 * the note it announces, unless the recipient had Love Notes on screen and
 * marked it read before the sender ran (the note can reach them over Broadcast
 * ahead of pg_net's call), in which case the badge is 0. The count is read
 * after the switch check, with the sender's name and the devices; a failed
 * read answers 500 and claims nothing. Opening Love Notes writes the marker
 * (`mark_love_notes_read`), which resets the count.
 *
 * ## The kind
 *
 * Every payload also carries a top-level `kind` (`withKind`), the `PushKind`
 * handled: `love_note`, `mood`, `photo`, `interaction` (poke and kiss alike),
 * `partner_request`, `partner_accept`, `event`, `anniversary` or one of the three daily kinds. It is the web code's tap
 * routing key (`viewForPush`, `src/services/pushNotifications.ts`); `aps` is
 * not touched.
 *
 * ## Dedupe and the recorded path
 *
 * `push_requests` is unique on (source row, device token), one column per
 * kind. A row is claimed before the send, and a second call for the same row
 * finds every claim taken and sends nothing. With no APNs key the claimed row is the output (delivery
 * `recorded`): the request that would have been sent, for `sim push` to
 * deliver. A failed APNs send releases its claim so a later call can retry.
 *
 * ## Gone registrations
 *
 * APNs answers 410 for a token that is no longer valid (the app was removed,
 * or the device unregistered on sign-out and got a new token). The claim is
 * released and the registration deleted, counted `gone`, but only if it was
 * not registered again after APNs's `timestamp` (or, with none, after this
 * send started): a token re-registered meanwhile is live again. Any other
 * refusal deletes nothing; a 400 `BadDeviceToken` is an environment mismatch,
 * not a dead device.
 *
 * ## Stale registrations
 *
 * A registration outlives its install or session (a reinstall, an offline
 * sign-out, a session ended elsewhere) and only a 410 would remove it. A row
 * whose `updated_at` is older than `STALE_AFTER_MS` (30 days) is therefore
 * neither claimed nor sent to: it is deleted through `deleteGoneDevice` with
 * the cutoff, so a row registered again meanwhile survives, and counted `gone`
 * (a failed delete counts `failed`). A device registers on every signed-in
 * start with permission and renews on a foreground return (at most every 12
 * hours), so only one not opened for 30 days stops getting pushes until it
 * next opens.
 */

import type { ApnsClient, ApnsResult } from './apns.ts';
import {
  buildInteractionPayload,
  buildLoveNotePayload,
  buildMoodPayload,
  buildPartnerAcceptPayload,
  buildPartnerRequestPayload,
  buildPhotoPayload,
  buildAnniversaryPayload,
  buildEventPayload,
  buildDailyBothAnsweredPayload,
  buildDailyNudgePayload,
  buildDailyReminderPayload,
  type ApnsPayload,
  type PushMood,
  withBadge,
  withKind,
} from './payload.ts';

/** What a push is about; each kind has its own column in `push_requests`. */
export type PushKind =
  | 'love_note'
  | 'mood'
  | 'photo'
  | 'interaction'
  | 'partner_request'
  | 'partner_accept'
  | 'event'
  | 'anniversary'
  | 'daily_nudge'
  | 'daily_reminder'
  | 'daily_both_answered';

/** The columns of `push_preferences`: one switch per kind of push the person can turn off. */
export type PushPreference =
  | 'love_notes'
  | 'moods'
  | 'photos'
  | 'pokes_and_kisses'
  | 'partner_requests'
  | 'dates'
  | 'daily_nudge'
  | 'daily_reminder'
  | 'daily_both_answered';

/** The switch each kind answers to; both partner kinds share one. */
export const PREFERENCE_FOR_KIND: Record<PushKind, PushPreference> = {
  love_note: 'love_notes',
  mood: 'moods',
  photo: 'photos',
  interaction: 'pokes_and_kisses',
  partner_request: 'partner_requests',
  partner_accept: 'partner_requests',
  event: 'dates',
  anniversary: 'dates',
  daily_nudge: 'daily_nudge',
  daily_reminder: 'daily_reminder',
  daily_both_answered: 'daily_both_answered',
};

/** The kinds the triggers post as `{kind, id}`; a love note posts `{note_id}`. */
const POSTED_KINDS = [
  'mood',
  'photo',
  'interaction',
  'partner_request',
  'partner_accept',
  'event',
  'anniversary',
  'daily_nudge',
  'daily_reminder',
  'daily_both_answered',
] as const;

export interface NoteRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  image_url: string | null;
}

export interface MoodRow extends PushMood {
  id: string;
  user_id: string;
}

export interface PhotoRow {
  id: string;
  user_id: string;
}

/** An `events` or `anniversaries` row: its owner and its name. */
export interface DateRow {
  id: string;
  user_id: string;
  label: string;
}

export interface InteractionRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  type: string;
}

/** A `partner_requests` row. */
export interface PartnerRequestRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
}

/** A `daily_picks` row without its `choice`, which the sender never reads. */
export interface DailyPickRow {
  id: string;
  day_id: string;
  user_id: string;
  /** True for the day's second pick: the only pick that pushes (`daily_both_answered`). */
  is_second: boolean;
}

export interface DailyNudgeRow {
  id: string;
  from_user: string;
  to_user: string;
  day_id: string;
  /** True for a nudge sent before 08:00 on the recipient's clock; it pushes only once `released_at` is set. */
  held: boolean;
  released_at: string | null;
}

export interface DailyReminderRow {
  id: string;
  user_id: string;
  kind: string;
  day_id: string;
}

/** A `couple_days` row: the pair, which is all a push reads of it. */
export interface CoupleDayRow {
  id: string;
  user_a: string;
  user_b: string;
}

export interface DeviceRow {
  token: string;
  environment: string;
  /** ISO timestamp of the last registration; `register_push_device` bumps it on every signed-in start. */
  updated_at: string;
}

export interface PushRequestRow {
  kind: PushKind;
  /** The id of the note, mood, photo, interaction, partner request, event, anniversary, second pick, nudge or reminder. */
  source_id: string;
  token: string;
  environment: string;
  payload: ApnsPayload;
  delivery: 'recorded' | 'sent';
}

/** The database surface the handler uses; every method throws on a failed read or write. */
export interface PushDb {
  getSenderSecret(): Promise<string | null>;
  getNote(noteId: string): Promise<NoteRow | null>;
  getMood(moodId: string): Promise<MoodRow | null>;
  getPhoto(photoId: string): Promise<PhotoRow | null>;
  getInteraction(interactionId: string): Promise<InteractionRow | null>;
  getPartnerRequest(requestId: string): Promise<PartnerRequestRow | null>;
  getEvent(eventId: string): Promise<DateRow | null>;
  getAnniversary(anniversaryId: string): Promise<DateRow | null>;
  getDailyPick(pickId: string): Promise<DailyPickRow | null>;
  getDailyNudge(nudgeId: string): Promise<DailyNudgeRow | null>;
  getDailyReminder(reminderId: string): Promise<DailyReminderRow | null>;
  /** The couple day's pair, or null when the day is gone. */
  getCoupleDay(dayId: string): Promise<CoupleDayRow | null>;
  /** The account's linked partner, or null when it has none. */
  getPartnerId(userId: string): Promise<string | null>;
  /** The receiver's switch: true when on or when the account has no `push_preferences` row. */
  isPushEnabled(userId: string, preference: PushPreference): Promise<boolean>;
  getDisplayName(userId: string): Promise<string | null>;
  listDevices(userId: string): Promise<DeviceRow[]>;
  /** The partner love notes the user has not opened (the badge), 0 or more. */
  countUnreadNotes(userId: string): Promise<number>;
  /** Inserts the row unless (source, token) exists; true when this call inserted it. */
  claimRequest(row: PushRequestRow): Promise<boolean>;
  releaseRequest(kind: PushKind, sourceId: string, token: string): Promise<void>;
  /**
   * Deletes the registration of a token APNs reports gone, unless it was
   * registered again after `goneAt` (ms since the epoch).
   */
  deleteGoneDevice(token: string, goneAt: number): Promise<void>;
}

export interface SendPushDeps {
  db: PushDb;
  /** Null when no APNs key is configured: requests are recorded, not sent. */
  apns: ApnsClient | null;
  /** Milliseconds since the epoch; defaults to `Date.now`. */
  now?: () => number;
}

/** A registration not renewed for this long (30 days, "one month") is stale: skipped and deleted. */
export const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 1024;

/** What a request resolves to: who it is from and for, and what it says. */
interface PushSource {
  kind: PushKind;
  id: string;
  senderId: string;
  /** Null when the sender has no one to push to. */
  recipientId: string | null;
  /** Null when this row is not a push (an interaction type that is neither poke nor kiss, a first pick, an unreleased nudge, a removed reminder kind). */
  buildPayload: ((senderName: string | null) => ApnsPayload) | null;
}

type Parsed =
  | { ok: true; kind: PushKind; id: string }
  | { ok: false; message: string };

/** `{kind, id}` from a `notify_push` trigger, else `{note_id}` from the love-note trigger. */
function parseBody(body: { note_id?: unknown; kind?: unknown; id?: unknown }): Parsed {
  if (body.kind !== undefined) {
    if (typeof body.kind !== 'string' || !(POSTED_KINDS as readonly string[]).includes(body.kind)) {
      return {
        ok: false,
        message: 'kind must be mood, photo, interaction, partner_request, partner_accept, event, anniversary, ' +
          'daily_nudge, daily_reminder or daily_both_answered',
      };
    }
    if (typeof body.id !== 'string' || !UUID.test(body.id)) {
      return { ok: false, message: 'id must be a uuid' };
    }
    return { ok: true, kind: body.kind as PushKind, id: body.id };
  }
  if (typeof body.note_id !== 'string' || !UUID.test(body.note_id)) {
    return { ok: false, message: 'note_id must be a uuid' };
  }
  return { ok: true, kind: 'love_note', id: body.note_id };
}

function isPushInteraction(type: string): boolean {
  return buildInteractionPayload(type, null) !== null;
}

/** The member of the day's pair who is not `userId`; null when `userId` is in neither seat. */
function otherInPair(day: CoupleDayRow, userId: string): string | null {
  if (userId === day.user_a) return day.user_b;
  if (userId === day.user_b) return day.user_a;
  return null;
}

/** Reads the row and finds its sender and recipient; null when the row is gone. */
async function resolveSource(db: PushDb, kind: PushKind, id: string): Promise<PushSource | null> {
  switch (kind) {
    case 'daily_both_answered': {
      const pick = await db.getDailyPick(id);
      if (!pick) return null;
      // Only a second pick is `daily_both_answered`. A first pick is no push, claiming nothing,
      // so the second pick's own post still records.
      if (!pick.is_second) {
        return { kind, id, senderId: pick.user_id, recipientId: null, buildPayload: null };
      }
      const day = await db.getCoupleDay(pick.day_id);
      if (!day) return null;
      // The pair's other member, not users.partner_id; the second picker is the sender and the
      // first picker the recipient. The wording is the same whatever the day or the streak, so
      // no date and no streak is read.
      const recipientId = otherInPair(day, pick.user_id);
      return {
        kind,
        id,
        senderId: pick.user_id,
        recipientId,
        buildPayload: recipientId ? () => buildDailyBothAnsweredPayload() : null,
      };
    }
    case 'daily_nudge': {
      const nudge = await db.getDailyNudge(id);
      if (!nudge) return null;
      // A nudge held until the partner's 8 AM posts nothing yet: its insert trigger skips it and
      // `release_held_daily_nudges` posts it again with `released_at` set. A held row that arrives
      // unreleased is no push, claiming nothing, so the release's post still sends.
      const unreleased = nudge.held && nudge.released_at === null;
      return {
        kind,
        id,
        senderId: nudge.from_user,
        recipientId: nudge.to_user,
        buildPayload: unreleased ? null : (name) => buildDailyNudgePayload(name),
      };
    }
    case 'daily_reminder': {
      const reminder = await db.getDailyReminder(id);
      if (!reminder) return null;
      // The stored kind must be `evening_self`, the one reminder there is. A row of any other kind
      // (the removed `morning` and `evening_partner`) is no push, claiming nothing.
      const partnerId = reminder.kind === 'evening_self' ? await db.getPartnerId(reminder.user_id) : null;
      // The reminder's sender is the recipient's partner; with none there is nobody to tell.
      if (!partnerId) {
        return { kind, id, senderId: reminder.user_id, recipientId: null, buildPayload: null };
      }
      return {
        kind,
        id,
        senderId: partnerId,
        recipientId: reminder.user_id,
        buildPayload: () => buildDailyReminderPayload(),
      };
    }
    case 'love_note': {
      const note = await db.getNote(id);
      if (!note) return null;
      return {
        kind,
        id,
        senderId: note.from_user_id,
        recipientId: note.to_user_id,
        buildPayload: (name) => buildLoveNotePayload(note, name),
      };
    }
    case 'mood': {
      const mood = await db.getMood(id);
      if (!mood) return null;
      return {
        kind,
        id,
        senderId: mood.user_id,
        recipientId: await db.getPartnerId(mood.user_id),
        buildPayload: (name) => buildMoodPayload(mood, name),
      };
    }
    case 'photo': {
      const photo = await db.getPhoto(id);
      if (!photo) return null;
      return {
        kind,
        id,
        senderId: photo.user_id,
        recipientId: await db.getPartnerId(photo.user_id),
        buildPayload: (name) => buildPhotoPayload(name),
      };
    }
    case 'interaction': {
      const interaction = await db.getInteraction(id);
      if (!interaction) return null;
      return {
        kind,
        id,
        senderId: interaction.from_user_id,
        recipientId: interaction.to_user_id,
        // Only poke and kiss are pushes; any other type has no payload.
        buildPayload: isPushInteraction(interaction.type)
          ? (name) => buildInteractionPayload(interaction.type, name) as ApnsPayload
          : null,
      };
    }
    case 'partner_request': {
      const request = await db.getPartnerRequest(id);
      if (!request) return null;
      // The asker is not a partner yet, so the recipient is the row's to_user_id.
      return {
        kind,
        id,
        senderId: request.from_user_id,
        recipientId: request.to_user_id,
        buildPayload: (name) => buildPartnerRequestPayload(name),
      };
    }
    case 'event': {
      const event = await db.getEvent(id);
      if (!event) return null;
      return {
        kind,
        id,
        senderId: event.user_id,
        recipientId: await db.getPartnerId(event.user_id),
        buildPayload: (name) => buildEventPayload(event.label, name),
      };
    }
    case 'anniversary': {
      const anniversary = await db.getAnniversary(id);
      if (!anniversary) return null;
      return {
        kind,
        id,
        senderId: anniversary.user_id,
        recipientId: await db.getPartnerId(anniversary.user_id),
        buildPayload: (name) => buildAnniversaryPayload(anniversary.label, name),
      };
    }
    case 'partner_accept': {
      const request = await db.getPartnerRequest(id);
      if (!request) return null;
      return {
        kind,
        id,
        senderId: request.to_user_id,
        recipientId: request.from_user_id,
        // The post claims an acceptance; a request that is not accepted now is no push.
        buildPayload: request.status === 'accepted' ? (name) => buildPartnerAcceptPayload(name) : null,
      };
    }
  }
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Compares without stopping at the first differing byte. */
export function secretsMatch(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export async function handleSendPush(req: Request, deps: SendPushDeps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const expected = await deps.db.getSenderSecret();
    const given = req.headers.get('x-push-secret');
    if (!expected || !given || !secretsMatch(given, expected)) {
      return json(401, { error: 'Unauthorized' });
    }

    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > MAX_BODY_BYTES) return json(413, { error: 'Body too large' });

    let parsed: Parsed;
    try {
      const body = await req.json();
      if (typeof body !== 'object' || body === null) return json(400, { error: 'Body must be a JSON object' });
      parsed = parseBody(body);
    } catch {
      return json(400, { error: 'Body must be JSON' });
    }
    if (!parsed.ok) return json(400, { error: parsed.message });

    let sent = 0;
    let recorded = 0;
    let skipped = 0;
    let failed = 0;
    let gone = 0;

    const now = deps.now ?? Date.now;
    const source = await resolveSource(deps.db, parsed.kind, parsed.id);
    if (!source) return json(404, { error: 'Not found' });

    // Nobody to tell: an unlinked owner, a self-addressed row or a type that
    // is not a push. Nothing is claimed.
    if (!source.recipientId || source.recipientId === source.senderId || !source.buildPayload) {
      return json(200, { sent, recorded, skipped, failed, gone });
    }

    // The receiver's switch for this kind. Off builds nothing for any of their
    // devices; a failed read throws and answers 500 like any other failed read.
    if (!(await deps.db.isPushEnabled(source.recipientId, PREFERENCE_FOR_KIND[source.kind]))) {
      return json(200, { sent, recorded, skipped, failed, gone });
    }

    const [senderName, devices, unread] = await Promise.all([
      deps.db.getDisplayName(source.senderId),
      deps.db.listDevices(source.recipientId),
      deps.db.countUnreadNotes(source.recipientId),
    ]);
    const payload = withKind(withBadge(source.buildPayload(senderName), unread), source.kind);
    const staleCutoff = now() - STALE_AFTER_MS;

    await Promise.all(
      devices.map(async (device) => {
        // One device's failure must not lose the others' counts.
        let counted = false;
        try {
          if (Date.parse(device.updated_at) < staleCutoff) {
            // Not claimed and not sent; the delete re-checks updated_at, so a
            // row registered again since the read stays.
            await deps.db.deleteGoneDevice(device.token, staleCutoff);
            gone++;
            return;
          }
          const claimed = await deps.db.claimRequest({
            kind: source.kind,
            source_id: source.id,
            token: device.token,
            environment: device.environment,
            payload,
            delivery: deps.apns ? 'sent' : 'recorded',
          });
          if (!claimed) {
            skipped++;
            return;
          }
          if (!deps.apns) {
            recorded++;
            return;
          }
          const startedAt = now();
          let result: ApnsResult | null = null;
          try {
            result = await deps.apns.send(device.token, device.environment, payload);
          } catch (error) {
            console.error('[send-push] APNs send failed:', error instanceof Error ? error.message : error);
          }
          if (result?.ok) {
            sent++;
            return;
          }
          if (result?.status === 410) {
            // Delete first, so a failed release cannot keep a dead registration.
            // A failure from here on is counted failed by the catch below.
            await deps.db.deleteGoneDevice(device.token, result.timestamp ?? startedAt);
            await deps.db.releaseRequest(source.kind, source.id, device.token);
            gone++;
            return;
          }
          if (result) console.error('[send-push] APNs refused a push:', result.status, result.reason);
          failed++;
          counted = true;
          await deps.db.releaseRequest(source.kind, source.id, device.token);
        } catch (error) {
          console.error('[send-push] device failed:', error instanceof Error ? error.message : error);
          if (!counted) failed++;
        }
      })
    );

    return json(200, { sent, recorded, skipped, failed, gone });
  } catch (error) {
    console.error('[send-push] failed:', error instanceof Error ? error.message : error);
    return json(500, { error: 'Internal error' });
  }
}
