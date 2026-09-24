/**
 * Photo Service - Supabase Storage Operations
 *
 * Manages photo storage operations using Supabase Storage: the full photo
 * list, image downloads, quota monitoring, upload and delete.
 *
 * Story 6.0: Photo Storage Schema & Buckets Setup
 *
 * Features:
 * - `listAllPhotos()` reads every photo row (own + partner, RLS-filtered),
 *   newest first, in pages of 500. It signs nothing: images are shown from the
 *   per-account image cache or downloaded by storage path (`downloadPhoto`),
 *   never through a signed URL, so they can be kept for offline use
 *   (`photoImageCache.ts`, spec-unified-data-storage story 10).
 * - Monitor storage quota usage with warning thresholds
 * - Upload and delete need a connection; nothing is queued.
 *
 * Security:
 * - All operations enforce RLS policies
 * - Photos stored in user-specific folders: {user_id}/{filename}
 * - Private bucket; images are read with the authenticated `download()` API
 *
 * @module photoService
 */

import { handleSupabaseError, isPostgrestError } from '../api/errorHandlers';
import { supabase } from '../api/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Photo metadata as stored in Supabase database
 * Different from IndexedDB Photo type (local storage)
 */
export interface SupabasePhoto {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  caption: string | null;
  mime_type: string; // DB constraint enforces: 'image/jpeg' | 'image/png' | 'image/webp'
  file_size: number;
  width: number;
  height: number;
  created_at: string;
}

/**
 * A photo row as the gallery holds it. `signedUrl` is always `null` since
 * story 10 (images are shown from the image cache or downloaded by storage
 * path); the field stays so the saved `photos` copy keeps one plain shape.
 */
export interface PhotoWithUrls extends SupabasePhoto {
  signedUrl: string | null;
  isOwn: boolean; // true if current user owns this photo
}

/**
 * Storage quota information
 */
interface StorageQuota {
  used: number; // bytes used
  quota: number; // total quota in bytes (1GB free tier)
  percent: number; // percentage used (0-100)
  warning: 'none' | 'approaching' | 'critical' | 'exceeded';
}

/**
 * Photo upload input from compression service
 */
export interface PhotoUploadInput {
  file: Blob;
  filename: string;
  caption?: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  /**
   * Stable identifier for one logical upload, reused across every retry of it.
   *
   * Without it each attempt minted a fresh UUID, so a retry after an ambiguous
   * failure wrote a second storage object and a second photos row -- the same
   * picture twice in the shared gallery, both counting against the quota.
   *
   * Caller-generated rather than derived from the bytes: the retry path
   * re-runs compressImage() from scratch, and compression is not guaranteed to
   * be byte-identical, so a content hash would not survive the retry it exists
   * to cover.
   */
  idempotencyKey?: string;
}

// Storage bucket name
const BUCKET_NAME = 'photos';

// Rows per request in `listAllPhotos`; a shorter page ends the read.
const LIST_PAGE_SIZE = 500;

// Storage quota thresholds
const STORAGE_QUOTA = 1024 * 1024 * 1024; // 1GB free tier
const WARNING_THRESHOLD = 0.8; // 80%
const CRITICAL_THRESHOLD = 0.95; // 95%

/**
 * The PostgREST `or` filter for rows after `last` in `listAllPhotos`' order
 * (created_at desc, id desc): an older `created_at`, or the same one with a
 * smaller `id`. Values are double-quoted because a timestamp carries `.` and
 * `:` (reserved in a logic tree); neither a timestamp nor a uuid can hold a
 * `"` or `\`, so no escaping is needed inside the quotes.
 */
function photosAfter(last: Pick<SupabasePhoto, 'created_at' | 'id'>): string {
  const at = `"${last.created_at}"`;
  const id = `"${last.id}"`;
  return `created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`;
}

class PhotoService {
  /**
   * Check storage quota usage
   *
   * @returns Storage quota information with warning level
   *
   * Security note: Uses database photos table to calculate usage
   * since direct storage bucket size queries are admin-only
   */
  async checkStorageQuota(): Promise<StorageQuota> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      // Get total file size from photos metadata table
      // This calculates only the current user's photos
      const { data, error } = await supabase
        .from('photos')
        .select('file_size')
        .eq('user_id', currentUser.user.id);

      if (error) {
        console.error('[PhotoService] Error fetching storage usage:', error);
        // Return safe default if query fails
        return {
          used: 0,
          quota: STORAGE_QUOTA,
          percent: 0,
          warning: 'none',
        };
      }

      const usedBytes = data?.reduce((sum, photo) => sum + (photo.file_size || 0), 0) || 0;
      const percent = (usedBytes / STORAGE_QUOTA) * 100;

      let warning: StorageQuota['warning'] = 'none';
      if (percent >= 100) {
        warning = 'exceeded';
      } else if (percent >= CRITICAL_THRESHOLD * 100) {
        warning = 'critical';
      } else if (percent >= WARNING_THRESHOLD * 100) {
        warning = 'approaching';
      }

      logger.debug(`[PhotoService] Storage usage: ${percent.toFixed(1)}% (${warning})`);

      return {
        used: usedBytes,
        quota: STORAGE_QUOTA,
        percent: Math.round(percent * 10) / 10, // Round to 1 decimal
        warning,
      };
    } catch (error) {
      console.error('[PhotoService] Error in checkStorageQuota:', error);
      return {
        used: 0,
        quota: STORAGE_QUOTA,
        percent: 0,
        warning: 'none',
      };
    }
  }

  /**
   * Every photo row the signed-in account can read (own + partner, filtered by
   * RLS), newest `created_at` first, ties by `id` (descending), so paging is a
   * stable total order. Pages the server LIST_PAGE_SIZE rows at a time, each
   * page keyed on the last row of the previous one (`photosAfter`), until a
   * short page. Signs nothing.
   *
   * @throws When any page fails. A partial list is never returned: the caller
   * replaces its whole list and copy with the answer, so a short read would
   * look like photos deleted on the server.
   * @throws When there is no session. The request would go out as anon, RLS
   * would answer `[]`, and the caller would save that over the copy and drop
   * every cached image.
   */
  async listAllPhotos(): Promise<SupabasePhoto[]> {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth?.session) {
      throw new Error('Not authenticated');
    }

    const rows: SupabasePhoto[] = [];
    // Keyset paging: each page starts strictly after the last row of the one
    // before, in the same (created_at desc, id desc) order. Offset paging
    // skipped a photo when a delete landed between two page reads (and the
    // caller then pruned it and its cached image), and repeated one when an
    // insert did.
    let last: SupabasePhoto | undefined;
    for (;;) {
      let query = supabase.from('photos').select('*');
      if (last) query = query.or(photosAfter(last));
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(LIST_PAGE_SIZE);

      if (error) {
        console.error('[PhotoService] Error listing photos:', error);
        throw new Error(error.message);
      }

      const page = data ?? [];
      rows.push(...page);
      if (page.length < LIST_PAGE_SIZE) break;
      last = page[page.length - 1];
    }

    logger.debug(`[PhotoService] Listed ${rows.length} photos`);
    return rows;
  }

  /**
   * Download one photo's image as a Blob with the authenticated Storage
   * `download()` API — no signed URL, so the result can be cached by storage
   * path (`imageCache.ts`) and shown offline later.
   *
   * @throws When the download fails (offline included).
   */
  async downloadPhoto(storagePath: string): Promise<Blob> {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(storagePath);
    if (error || !data) {
      throw new Error(`Failed to download photo: ${error?.message ?? 'no data'}`);
    }
    return data;
  }

  /**
   * Upload a photo to Supabase Storage and create metadata record
   *
   * @param input - Photo upload input from compression service
   * @param onCheckError - Optional callback reporting friendly metadata CHECK text before rollback
   * completes; the upload still resolves to null on failure.
   * @returns Created photo record or null on error
   *
   * AC 6.0.5: Users can INSERT photos only with their own user_id
   * AC 6.0.7: Storage RLS restricts uploads to user's own folder
   * AC 6.2.10: Warning if storage quota > 80%
   * AC 6.2.11: Upload rejected if storage quota > 95%
   */
  async uploadPhoto(
    input: PhotoUploadInput,
    onCheckError?: (message: string) => void
  ): Promise<SupabasePhoto | null> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      // Check storage quota before upload - reject if critical (AC 6.2.11)
      const quota = await this.checkStorageQuota();
      if (quota.warning === 'exceeded') {
        throw new Error('Storage quota exceeded. Please delete some photos to free up space.');
      }
      if (quota.warning === 'critical') {
        throw new Error(`Storage nearly full (${quota.percent}%) - delete photos to continue`);
      }

      const userId = currentUser.user.id;
      const fileExt = input.mimeType.split('/')[1]; // jpeg, png, webp
      // Falls back to a fresh id so a caller that does not track retries keeps
      // the old one-path-per-call behaviour rather than silently colliding.
      // `||`, not `??`: an empty key is absent, not a key. PhotoUpload clears
      // its ref to '' on reset, and treating that as valid would give every
      // upload by this user the single path `${userId}/.${fileExt}`.
      const uniqueId = input.idempotencyKey || crypto.randomUUID();
      const storagePath = `${userId}/${uniqueId}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, input.file, {
          contentType: input.mimeType,
          // Overwrite permitted: with a stable path a retry targets the object
          // its own earlier attempt wrote, and `upsert: false` would turn a
          // silent duplicate into a hard conflict on every retry. The path is
          // namespaced by user id, so this can only overwrite the caller's own
          // in-flight upload.
          //
          // Requires UPDATE on storage.objects for this bucket — an overwrite is
          // an UPDATE, not an INSERT. Granted by
          // 20260803000000_photos_storage_update_policy.sql; without it RLS
          // rejects every retry, which is the one case this path exists for.
          upsert: true,
        });

      if (uploadError) {
        console.error('[PhotoService] Storage upload error:', uploadError);
        throw uploadError;
      }

      // Create metadata record in photos table
      const photoData = {
        user_id: userId,
        storage_path: storagePath,
        filename: input.filename,
        caption: input.caption || null,
        mime_type: input.mimeType,
        file_size: input.file.size,
        width: input.width,
        height: input.height,
      };

      // storage_path already carries a UNIQUE constraint, so it is the conflict
      // target -- no new column needed. DO NOTHING rather than merge-duplicates:
      // photos grants SELECT/INSERT/DELETE and no UPDATE, and a retry should
      // resolve to the row already stored rather than rewrite it.
      //
      // KNOWN LIMIT: DO NOTHING discards this payload wholesale, so if the first
      // attempt committed and the user then edited the caption on the error
      // screen before tapping Retry, that edit is silently dropped and the
      // stored caption is returned instead. Applying it would need an UPDATE
      // policy on public.photos, which would also let a user rewrite photos they
      // had already shared -- a deliberate trade, not an oversight.
      const { data: inserted, error: insertError } = await supabase
        .from('photos')
        .upsert(photoData, { onConflict: 'storage_path', ignoreDuplicates: true })
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('[PhotoService] Database insert error:', insertError);
        if (isPostgrestError(insertError) && insertError.code === '23514') {
          onCheckError?.(handleSupabaseError(insertError).message);
        }

        // Roll the object back only once nothing is known to point at it.
        //
        // The rollback was safe while every attempt uploaded to its own random
        // path. With a stable path a retry overwrites the object the first
        // attempt wrote, and that attempt may have committed its photos row
        // before its response was lost -- so deleting here would strand a
        // gallery entry whose image is gone for good.
        //
        // A lookup that fails counts as "do not delete", not "nothing found".
        // The insert most likely failed because the network did, which is
        // exactly when this check fails too, and the asymmetry matters: an
        // orphaned object costs quota, a wrong delete costs the photo.
        const { data: committedRow, error: lookupError } = await supabase
          .from('photos')
          .select('id')
          .eq('storage_path', storagePath)
          .maybeSingle();

        if (lookupError) {
          console.warn(
            '[PhotoService] Keeping uploaded object: could not check whether a row references it',
            lookupError
          );
        } else if (!committedRow) {
          await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        } else {
          logger.debug('[PhotoService] Keeping uploaded object: photo row already references it');
        }

        throw insertError;
      }

      // No row back means this path was already recorded -- the earlier attempt
      // did commit. Read that row instead of inserting a second one, and do NOT
      // remove the storage object: it is the one that row points at.
      let photo = inserted;
      if (!photo) {
        const existing = await supabase
          .from('photos')
          .select()
          .eq('storage_path', storagePath)
          .single();

        if (existing.error) {
          console.error('[PhotoService] Failed to resolve existing photo:', existing.error);
          throw existing.error;
        }
        photo = existing.data;
      }

      logger.debug('[PhotoService] Photo uploaded:', photo?.id);

      // Check quota after upload and warn if approaching limit
      const newQuota = await this.checkStorageQuota();
      if (newQuota.warning === 'approaching' || newQuota.warning === 'critical') {
        console.warn(`[PhotoService] Storage warning: ${newQuota.percent}% used`);
      }

      return photo;
    } catch (error) {
      console.error('[PhotoService] Error in uploadPhoto:', error);
      return null;
    }
  }

  /**
   * Delete a photo from storage and database
   *
   * @param photoId - Photo ID to delete
   * @returns true if deleted successfully
   *
   * AC 6.0.6: Users can DELETE only their own photos
   */
  async deletePhoto(photoId: string): Promise<boolean> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      // Get photo to verify ownership and get storage path
      const { data: photo, error: fetchError } = await supabase
        .from('photos')
        .select('storage_path, user_id')
        .eq('id', photoId)
        .single();

      if (fetchError || !photo) {
        console.error('[PhotoService] Photo not found:', photoId);
        return false;
      }

      // Verify ownership (additional check, RLS should already enforce this)
      if (photo.user_id !== currentUser.user.id) {
        console.error('[PhotoService] Cannot delete photo owned by another user');
        return false;
      }

      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([photo.storage_path]);

      if (storageError) {
        console.error('[PhotoService] Storage delete error:', storageError);
        // Continue to delete metadata even if storage delete fails
        // (file might already be missing)
      }

      // Delete metadata record
      const { error: deleteError } = await supabase.from('photos').delete().eq('id', photoId);

      if (deleteError) {
        console.error('[PhotoService] Database delete error:', deleteError);
        return false;
      }

      logger.debug('[PhotoService] Photo deleted:', photoId);

      return true;
    } catch (error) {
      console.error('[PhotoService] Error in deletePhoto:', error);
      return false;
    }
  }
}

// Export singleton instance
export const photoService = new PhotoService();
