/**
 * Request handling for the `send-push` Edge Function.
 *
 * Called by the `love_notes` AFTER INSERT trigger (`notify_love_note_push`,
 * 20261031000000_push_devices.sql) with `{ "note_id": "<uuid>" }` and the
 * shared secret in `x-push-secret`. Split out of `index.ts` so `deno test`
 * can drive it with a fake database and a fake APNs client.
 *
 * ## Authentication
 *
 * `verify_jwt` is off for this function (supabase/config.toml): the caller is
 * a database trigger, which has no user JWT. It presents a shared secret
 * instead, kept in the service-only `push_sender_settings` table that the
 * sender reads with the service role. No secret on record answers 401, so an
 * unconfigured stack accepts nothing.
 *
 * ## Why only a note id is accepted
 *
 * The sender reads the note itself with the service role and derives the
 * sender's name and the recipient from it, so a forged call can name no target
 * beyond an existing note.
 *
 * ## Dedupe and the recorded path
 *
 * `push_requests` is unique on (note, device token). A row is claimed before
 * the send, and a second call for the same note finds every claim taken and
 * sends nothing. With no APNs key the claimed row is the output (delivery
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
import { buildLoveNotePayload, type ApnsPayload } from './payload.ts';

export interface NoteRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  image_url: string | null;
}

export interface DeviceRow {
  token: string;
  environment: string;
}

export interface PushRequestRow {
  note_id: string;
  token: string;
  environment: string;
  payload: ApnsPayload;
  delivery: 'recorded' | 'sent';
}

/** The database surface the handler uses; every method throws on a failed read or write. */
export interface PushDb {
  getSenderSecret(): Promise<string | null>;
  getNote(noteId: string): Promise<NoteRow | null>;
  getDisplayName(userId: string): Promise<string | null>;
  listDevices(userId: string): Promise<DeviceRow[]>;
  /** Inserts the row unless (note, token) exists; true when this call inserted it. */
  claimRequest(row: PushRequestRow): Promise<boolean>;
  releaseRequest(noteId: string, token: string): Promise<void>;
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

    let noteId: unknown;
    try {
      noteId = ((await req.json()) as { note_id?: unknown }).note_id;
    } catch {
      return json(400, { error: 'Body must be JSON' });
    }
    if (typeof noteId !== 'string' || !UUID.test(noteId)) {
      return json(400, { error: 'note_id must be a uuid' });
    }

    const note = await deps.db.getNote(noteId);
    if (!note) return json(404, { error: 'Note not found' });

    const [senderName, devices] = await Promise.all([
      deps.db.getDisplayName(note.from_user_id),
      deps.db.listDevices(note.to_user_id),
    ]);
    const payload = buildLoveNotePayload(note, senderName);

    let sent = 0;
    let recorded = 0;
    let skipped = 0;
    let failed = 0;
    let gone = 0;
    const now = deps.now ?? Date.now;

    await Promise.all(
      devices.map(async (device) => {
        // One device's failure must not lose the others' counts.
        let counted = false;
        try {
          const claimed = await deps.db.claimRequest({
            note_id: note.id,
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
            await deps.db.releaseRequest(note.id, device.token);
            gone++;
            return;
          }
          if (result) console.error('[send-push] APNs refused a push:', result.status, result.reason);
          failed++;
          counted = true;
          await deps.db.releaseRequest(note.id, device.token);
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
