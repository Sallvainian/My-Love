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
 * - `events`, `couple_settings` and `users` (`notify_date_change`,
 *   20261031030000_push_date_changes.sql) log each push-worthy change in
 *   `date_changes` and post `{ "kind": "date", "id": "<date_changes id>" }`;
 * - `partner_requests` (`notify_push`, 20261031040000_push_partner_requests.sql)
 *   posts `{ "kind": "partner_request", "id": "<request id>" }` for an INSERT
 *   of a pending request and `{ "kind": "partner_accept", "id": ... }` for a
 *   `pending` to `accepted` UPDATE.
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
 * interaction its `to_user_id`, and of a mood, photo or date change the
 * sender's `users.partner_id` (a date change names its sender in
 * `date_changes.sender_id`; an event change whose event is gone is a 404). A
 * partner request goes to its `to_user_id` (the asker is the sender) and its
 * acceptance to its `from_user_id` (the accepter, `to_user_id`, is the sender);
 * neither looks up a partner, since the asker is not linked yet. An owner with
 * no partner, or a recipient equal to the sender, answers 200 with every count
 * 0 and claims nothing. An interaction whose type is not `poke` or `kiss` does
 * the same, and so does a `partner_accept` whose request is not `accepted` now:
 * the post is a claim that it was, so a forged or replayed one announces nothing.
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
 */

import type { ApnsClient, ApnsResult } from './apns.ts';
import {
  buildDatePayload,
  buildInteractionPayload,
  buildLoveNotePayload,
  buildMoodPayload,
  buildPartnerAcceptPayload,
  buildPartnerRequestPayload,
  buildPhotoPayload,
  type ApnsPayload,
  type PushDateChange,
  type PushMood,
} from './payload.ts';

/** What a push is about; each kind has its own column in `push_requests`. */
export type PushKind =
  | 'love_note'
  | 'mood'
  | 'photo'
  | 'interaction'
  | 'date'
  | 'partner_request'
  | 'partner_accept';

/** The kinds the triggers post as `{kind, id}`; a love note posts `{note_id}`. */
const POSTED_KINDS = ['mood', 'photo', 'interaction', 'date', 'partner_request', 'partner_accept'] as const;

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

export interface InteractionRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  type: string;
}

/** A `date_changes` row, with the event's label as it is when read. */
export interface DateChangeRow extends PushDateChange {
  id: string;
  sender_id: string;
}

/** A `partner_requests` row. */
export interface PartnerRequestRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
}

export interface DeviceRow {
  token: string;
  environment: string;
}

export interface PushRequestRow {
  kind: PushKind;
  /** The id of the note, mood, photo, interaction, date change or partner request. */
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
  /** The change with its event's label when it is about an event; null when the change is gone. */
  getDateChange(changeId: string): Promise<DateChangeRow | null>;
  getPartnerRequest(requestId: string): Promise<PartnerRequestRow | null>;
  /** The account's linked partner, or null when it has none. */
  getPartnerId(userId: string): Promise<string | null>;
  getDisplayName(userId: string): Promise<string | null>;
  listDevices(userId: string): Promise<DeviceRow[]>;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 1024;

/** What a request resolves to: who it is from and for, and what it says. */
interface PushSource {
  kind: PushKind;
  id: string;
  senderId: string;
  /** Null when the sender has no one to push to. */
  recipientId: string | null;
  /** Null when this row is not a push (an interaction type that is neither poke nor kiss). */
  buildPayload: ((senderName: string | null) => ApnsPayload) | null;
}

type Parsed =
  | { ok: true; kind: PushKind; id: string }
  | { ok: false; message: string };

/** `{kind, id}` from a `notify_push` or `notify_date_change` trigger, else `{note_id}` from the love-note trigger. */
function parseBody(body: { note_id?: unknown; kind?: unknown; id?: unknown }): Parsed {
  if (body.kind !== undefined) {
    if (typeof body.kind !== 'string' || !(POSTED_KINDS as readonly string[]).includes(body.kind)) {
      return {
        ok: false,
        message: 'kind must be mood, photo, interaction, date, partner_request or partner_accept',
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

/** Reads the row and finds its sender and recipient; null when the row is gone. */
async function resolveSource(db: PushDb, kind: PushKind, id: string): Promise<PushSource | null> {
  switch (kind) {
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
    case 'date': {
      const change = await db.getDateChange(id);
      // An event change whose event is gone has no label to push.
      if (!change || (change.subject === 'event' && change.event_label === null)) return null;
      return {
        kind,
        id,
        senderId: change.sender_id,
        recipientId: await db.getPartnerId(change.sender_id),
        buildPayload: (name) => buildDatePayload(change, name),
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

    const source = await resolveSource(deps.db, parsed.kind, parsed.id);
    if (!source) return json(404, { error: 'Not found' });

    // Nobody to tell: an unlinked owner, a self-addressed row or a type that
    // is not a push. Nothing is claimed.
    if (!source.recipientId || source.recipientId === source.senderId || !source.buildPayload) {
      return json(200, { sent, recorded, skipped, failed, gone });
    }

    const [senderName, devices] = await Promise.all([
      deps.db.getDisplayName(source.senderId),
      deps.db.listDevices(source.recipientId),
    ]);
    const payload = source.buildPayload(senderName);
    const now = deps.now ?? Date.now;

    await Promise.all(
      devices.map(async (device) => {
        // One device's failure must not lose the others' counts.
        let counted = false;
        try {
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
