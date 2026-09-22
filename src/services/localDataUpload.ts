/**
 * One-time upload of a device's local account data to Supabase.
 *
 * Anniversaries, message favorites and custom messages used to live only in the
 * browser: `settings.relationship.anniversaries` in localStorage, and the
 * `messages` / `message-favorites` IndexedDB stores. Supabase is now the source
 * of truth for all three, and the local copies are read mirrors. This module
 * moves whatever a device still holds up to the server, once per user per
 * device, and is the reason the old GitHub Pages origin can be served one last
 * build (the "bridge") that uploads and then forwards to Cloudflare.
 *
 * The rules, and how each is kept:
 *
 * - INSERT-ONLY AND IDEMPOTENT. Every row carries a `client_key` derived from
 *   the local row alone (`a:<date>:<hash(label)>`, `c:<createdAt ms>:<hash(text)>`,
 *   and the bundled favorite's own `b:<hash(text)>` primary key), inserted with
 *   ON CONFLICT DO NOTHING. A re-run — including the one after the service
 *   worker's update reload cuts the first run short — collides instead of
 *   duplicating, and no server row is ever updated or deleted.
 * - A LOCAL ITEM THE SERVER ALREADY HOLDS IS SKIPPED: same text for a custom
 *   message, same date and label for an anniversary. That is what catches the
 *   same item arriving from a second device, where the key differs.
 * - THE FLAG IS LAST. `my-love-local-upload-v1:<userId>` is set only after all
 *   three uploads and the receipt succeeded. Until then nothing replaces or
 *   deletes a local row: the mirror refreshes in the slices check
 *   `hasCompletedLocalUpload` first, so a failure part-way leaves the local
 *   data exactly as it was, to be retried next launch.
 * - Ownerless legacy custom rows (from `migrationService`) are nobody's and are
 *   never read here.
 *
 * Store-free on purpose: the slices import `hasCompletedLocalUpload`, so this
 * module importing the store would be a cycle. The caller hands in the
 * anniversaries (read from settings after the vault pop) and the user id.
 *
 * @module services/localDataUpload
 */

import { supabase } from '../api/supabaseClient';
import type { Anniversary, Message } from '../types';
import { logger } from '../utils/logger';
import { requestTimeout, requireOnline, toAccountDataError } from './accountDataError';
import { serializeAccountDataWrite } from './accountDataQueue';
import { anniversariesService, type AnniversaryInsert } from './anniversariesService';
import { customMessagesApi, isMessageCategory, type CustomMessageInsert } from './customMessagesApi';
import { parseEventDate } from './eventsService';
import { bundledMessageKey, hashText, messageFavoritesApi } from './messageFavoritesApi';
import { storageService } from './storage';

export const LOCAL_UPLOAD_FLAG_PREFIX = 'my-love-local-upload-v1:';

/** Matches `VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH` and the DB CHECK. */
const MAX_MESSAGE_LENGTH = 1000;

export function localUploadFlagKey(userId: string): string {
  return `${LOCAL_UPLOAD_FLAG_PREFIX}${userId}`;
}

/** Has this device finished its one-time upload for `userId`? Unreadable storage is "no". */
export function hasCompletedLocalUpload(userId: string): boolean {
  try {
    return localStorage.getItem(localUploadFlagKey(userId)) !== null;
  } catch {
    return false;
  }
}

export interface LocalUploadCounts {
  /**
   * Local items this device held that the server now holds — inserted, or
   * already there. Items skipped as ones the server would reject are NOT
   * counted: the receipt is the evidence the old origin is retired on.
   */
  anniversaries: number;
  customMessages: number;
  favorites: number;
}

export type LocalUploadResult =
  | { status: 'already-uploaded' }
  | { status: 'uploaded'; counts: LocalUploadCounts }
  | { status: 'failed'; error: unknown };

function anniversaryContentKey(date: string, label: string): string {
  return `${date}\n${label}`;
}

function messageContentKey(text: string): string {
  // Same normalisation `customMessageService.importMessages` dedupes with.
  return text.trim().toLowerCase();
}

/** Rows to insert, and how many valid local items the server will then hold. */
interface UploadPlan<Row> {
  rows: Row[];
  held: number;
}

async function anniversaryRows(
  userId: string,
  pending: Anniversary[]
): Promise<UploadPlan<AnniversaryInsert>> {
  if (pending.length === 0) return { rows: [], held: 0 };
  const onServer = new Set(
    (await anniversariesService.fetchAnniversaries(userId)).map((row) =>
      anniversaryContentKey(row.date, row.label)
    )
  );
  const rows: AnniversaryInsert[] = [];
  let held = 0;
  for (const anniversary of pending) {
    if (!parseEventDate(anniversary.date) || anniversary.label.length === 0) {
      console.warn('[LocalDataUpload] Skipping an anniversary the server would reject');
      continue;
    }
    held += 1;
    const contentKey = anniversaryContentKey(anniversary.date, anniversary.label);
    if (onServer.has(contentKey)) continue;
    onServer.add(contentKey);
    rows.push({
      user_id: userId,
      event_date: anniversary.date,
      label: anniversary.label,
      description: anniversary.description ?? null,
      client_key: `a:${anniversary.date}:${await hashText(anniversary.label)}`,
    });
  }
  return { rows, held };
}

function validDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function customMessageRows(
  userId: string,
  pending: Message[]
): Promise<UploadPlan<CustomMessageInsert>> {
  if (pending.length === 0) return { rows: [], held: 0 };
  const onServer = new Set(
    (await customMessagesApi.fetchCustomMessages(userId)).map((row) => messageContentKey(row.text))
  );
  const rows: CustomMessageInsert[] = [];
  let held = 0;
  for (const message of pending) {
    const text = message.text.trim();
    if (text.length === 0 || text.length > MAX_MESSAGE_LENGTH) {
      console.warn('[LocalDataUpload] Skipping a custom message the server would reject');
      continue;
    }
    held += 1;
    const contentKey = messageContentKey(text);
    if (onServer.has(contentKey)) continue;
    onServer.add(contentKey);
    const createdAt = validDate(message.createdAt);
    const updatedAt = validDate(message.updatedAt) ?? createdAt;
    rows.push({
      user_id: userId,
      text,
      category: isMessageCategory(message.category) ? message.category : 'custom',
      active: message.active ?? true,
      is_favorite: message.isFavorite === true,
      tags: message.tags ?? [],
      // Epoch 0 for an unreadable timestamp keeps the key deterministic.
      client_key: `c:${createdAt?.getTime() ?? 0}:${await hashText(message.text)}`,
      ...(createdAt ? { created_at: createdAt.toISOString() } : {}),
      ...(updatedAt ? { updated_at: updatedAt.toISOString() } : {}),
    });
  }
  return { rows, held };
}

async function writeReceipt(userId: string, origin: string, counts: LocalUploadCounts) {
  requireOnline('Uploads');
  try {
    const { error } = await supabase.from('local_data_uploads').insert({
      user_id: userId,
      origin,
      anniversaries_count: counts.anniversaries,
      custom_messages_count: counts.customMessages,
      favorites_count: counts.favorites,
    }).abortSignal(requestTimeout());
    if (error) throw error;
  } catch (error) {
    throw toAccountDataError('LocalDataUpload.writeReceipt', error);
  }
}

async function runUpload(
  userId: string,
  localAnniversaries: Anniversary[],
  origin: string
): Promise<LocalUploadResult> {
  try {
    // Queued with the favorite toggles and mirror writes (accountDataQueue.ts):
    // a favorite turned off mid-upload must not be re-inserted by an upload
    // that read it earlier. Nothing in here calls a queued function.
    const counts = await serializeAccountDataWrite(async () => {
      const local = await storageService.readLocalAccountData(userId);
      // A row with a server id is already a server row, created in-app.
      const pendingAnniversaries = localAnniversaries.filter((anniversary) => !anniversary.serverId);
      const pendingCustom = local.customMessages.filter((message) => !message.serverId);
      const favoriteKeys = [
        ...new Set(await Promise.all(local.favoriteBundledTexts.map(bundledMessageKey))),
      ];

      const anniversaryPlan = await anniversaryRows(userId, pendingAnniversaries);
      await anniversariesService.insertAnniversariesOnce(anniversaryPlan.rows);
      const customPlan = await customMessageRows(userId, pendingCustom);
      await customMessagesApi.insertCustomMessagesOnce(customPlan.rows);
      await messageFavoritesApi.insertFavoritesOnce(userId, favoriteKeys);

      const uploaded: LocalUploadCounts = {
        anniversaries: anniversaryPlan.held,
        customMessages: customPlan.held,
        // Bundled keys all land (inserted or already there); a custom favorite
        // lands only on a row this upload inserted — a duplicate of a server
        // row leaves that row, and its flag, untouched.
        favorites: favoriteKeys.length + customPlan.rows.filter((row) => row.is_favorite).length,
      };
      await writeReceipt(userId, origin, uploaded);
      localStorage.setItem(localUploadFlagKey(userId), new Date().toISOString());
      return uploaded;
    });
    logger.info('[LocalDataUpload] Upload complete:', counts);
    return { status: 'uploaded', counts };
  } catch (error) {
    console.error('[LocalDataUpload] Upload failed; local data kept, retrying next launch:', error);
    return { status: 'failed', error };
  }
}

const inFlight = new Map<string, Promise<LocalUploadResult>>();

/**
 * Upload this device's local data for `userId`, once. Never throws: a failure
 * is logged and returned, the flag stays unset, and the app carries on.
 *
 * Concurrent calls for the same user share one run (StrictMode double effects,
 * an auth event landing twice).
 *
 * @param localAnniversaries - `settings.relationship.anniversaries`, read after
 *   the sign-in vault pop, while `userId` is the signed-in user
 */
export function uploadLocalData(
  userId: string,
  localAnniversaries: Anniversary[],
  origin: string = window.location.origin
): Promise<LocalUploadResult> {
  if (hasCompletedLocalUpload(userId)) return Promise.resolve({ status: 'already-uploaded' });
  const running = inFlight.get(userId);
  if (running) return running;
  const run = runUpload(userId, localAnniversaries, origin).finally(() => inFlight.delete(userId));
  inFlight.set(userId, run);
  return run;
}

/**
 * The same path, search and hash on the bridge target, minus the old origin's
 * base path: `/My-Love/photos?x#y` → `<target>/photos?x#y`.
 */
export function legacyBridgeUrl(
  target: string,
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
  base: string = import.meta.env.BASE_URL
): string {
  const prefix = base.replace(/\/+$/, '');
  let path = location.pathname;
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) {
    path = path.slice(prefix.length);
  }
  if (!path.startsWith('/')) path = `/${path}`;
  return `${target.replace(/\/+$/, '')}${path}${location.search}${location.hash}`;
}

/**
 * On the bridge build only, leave the old origin for the new one — and only
 * once `userId`'s upload flag is set, so no device forwards away from data it
 * has not handed over. A failed navigation leaves the app working where it is.
 *
 * @returns whether the forward was started
 */
export function forwardFromLegacyOrigin(userId: string, target: string | undefined): boolean {
  if (!target || !hasCompletedLocalUpload(userId)) return false;
  try {
    window.location.replace(legacyBridgeUrl(target, window.location));
    return true;
  } catch (error) {
    console.error('[LocalDataUpload] Could not forward to the new origin:', error);
    return false;
  }
}

export type AccountDataSyncOutcome = 'failed' | 'stale' | 'forwarded' | 'refreshed';

/**
 * Everything that follows a sign-in, in order: upload this device's local data
 * (once per user per device), then — on the bridge build — leave the old
 * origin, or otherwise refresh the mirrors from the server.
 *
 * - A failed upload does neither: the local data stays authoritative, the
 *   device stays on the origin that holds it, and the next launch retries.
 * - An account that changed during the upload does neither: the forward and
 *   the refresh belong to the account that raised them.
 * - A forward that could not start falls through to the refresh, so the app
 *   keeps working where it is.
 *
 * Store-free, like the rest of this module: the caller supplies the identity
 * check and the refresh (App.tsx passes the two slice loaders).
 *
 * @param localAnniversaries - settings' list, read after the sign-in vault pop
 */
export async function syncAccountDataAfterSignIn(
  userId: string,
  localAnniversaries: Anniversary[],
  deps: {
    isStillCurrent: () => boolean;
    refresh: () => Promise<unknown>;
    /** `VITE_LEGACY_BRIDGE_TARGET`; unset everywhere but the bridge build. */
    bridgeTarget: string | undefined;
  }
): Promise<AccountDataSyncOutcome> {
  const result = await uploadLocalData(userId, localAnniversaries);
  if (result.status === 'failed') return 'failed';
  if (!deps.isStillCurrent()) return 'stale';
  if (forwardFromLegacyOrigin(userId, deps.bridgeTarget)) return 'forwarded';
  await deps.refresh();
  return 'refreshed';
}
