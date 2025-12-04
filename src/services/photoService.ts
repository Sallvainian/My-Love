/**
 * Photo Service - Supabase Storage Operations
 *
 * Manages photo storage operations using Supabase Storage.
 * Handles signed URL generation, quota monitoring, and CRUD operations.
 *
 * Story 6.0: Photo Storage Schema & Buckets Setup
 *
 * Features:
 * - Generate signed URLs for private photo access (1-hour expiry)
 * - Monitor storage quota usage with warning thresholds
 * - Foundation for upload/delete operations (future stories)
 *
 * Security:
 * - All operations enforce RLS policies
 * - Photos stored in user-specific folders: {user_id}/{filename}
 * - Private bucket requires signed URLs for access
 *
 * @module photoService
 */

import { supabase } from '../api/supabaseClient';

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
 * Photo with computed URLs for display
 */
export interface PhotoWithUrls extends SupabasePhoto {
  signedUrl: string | null;
  isOwn: boolean; // true if current user owns this photo
}

/**
 * Storage quota information
 */
export interface StorageQuota {
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
}

// Storage bucket name
const BUCKET_NAME = 'photos';

// Signed URL expiry in seconds (1 hour)
const SIGNED_URL_EXPIRY = 3600;

// Storage quota thresholds
const STORAGE_QUOTA = 1024 * 1024 * 1024; // 1GB free tier
const WARNING_THRESHOLD = 0.8; // 80%
const CRITICAL_THRESHOLD = 0.95; // 95%

class PhotoService {
  /**
   * Generate a signed URL for private photo access
   *
   * @param storagePath - Path in storage bucket (e.g., "{user_id}/photo.jpg")
   * @param expiresIn - Expiry time in seconds (default: 1 hour)
   * @returns Signed URL or null on error
   *
   * AC 6.0.8: Users can read own photos
   * AC 6.0.9: Partners can read each other's photos
   */
  async getSignedUrl(storagePath: string, expiresIn: number = SIGNED_URL_EXPIRY): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, expiresIn);

      if (error) {
        console.error('[PhotoService] Error creating signed URL:', error);
        return null;
      }

      if (import.meta.env.DEV) {
        console.log('[PhotoService] Created signed URL for:', storagePath);
      }

      return data?.signedUrl ?? null;
    } catch (error) {
      console.error('[PhotoService] Error in getSignedUrl:', error);
      return null;
    }
  }

  /**
   * Generate signed URLs for multiple photos
   *
   * @param storagePaths - Array of storage paths
   * @param expiresIn - Expiry time in seconds (default: 1 hour)
   * @returns Map of storage path to signed URL
   */
  async getSignedUrls(
    storagePaths: string[],
    expiresIn: number = SIGNED_URL_EXPIRY
  ): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();

    try {
      // Generate URLs in parallel for better performance
      const results = await Promise.allSettled(
        storagePaths.map(async (path) => {
          const url = await this.getSignedUrl(path, expiresIn);
          return { path, url };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.url) {
          urlMap.set(result.value.path, result.value.url);
        }
      }

      if (import.meta.env.DEV) {
        console.log(`[PhotoService] Generated ${urlMap.size}/${storagePaths.length} signed URLs`);
      }
    } catch (error) {
      console.error('[PhotoService] Error in getSignedUrls:', error);
    }

    return urlMap;
  }

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

      if (import.meta.env.DEV) {
        console.log(`[PhotoService] Storage usage: ${percent.toFixed(1)}% (${warning})`);
      }

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
   * Get photos for current user and their partner
   * Photos are sorted by created_at DESC (newest first)
   *
   * @param limit - Maximum photos to fetch (default: 50)
   * @param offset - Offset for pagination (default: 0)
   * @returns Array of photos with signed URLs
   *
   * AC 6.0.3: Users can view own photos
   * AC 6.0.4: Partners can view each other's photos
   */
  async getPhotos(limit: number = 50, offset: number = 0): Promise<PhotoWithUrls[]> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      // Query photos - RLS policies filter to own + partner photos
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[PhotoService] Error fetching photos:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Generate signed URLs for all photos
      const storagePaths = data.map((photo) => photo.storage_path);
      const urlMap = await this.getSignedUrls(storagePaths);

      // Map to PhotoWithUrls
      const photosWithUrls: PhotoWithUrls[] = data.map((photo) => ({
        ...photo,
        signedUrl: urlMap.get(photo.storage_path) || null,
        isOwn: photo.user_id === currentUser.user.id,
      }));

      if (import.meta.env.DEV) {
        console.log(`[PhotoService] Fetched ${photosWithUrls.length} photos`);
      }

      return photosWithUrls;
    } catch (error) {
      console.error('[PhotoService] Error in getPhotos:', error);
      return [];
    }
  }

  /**
   * Upload a photo to Supabase Storage and create metadata record
   *
   * @param input - Photo upload input from compression service
   * @param onProgress - Optional callback for upload progress (0-100%)
   * @returns Created photo record or null on error
   *
   * AC 6.0.5: Users can INSERT photos only with their own user_id
   * AC 6.0.7: Storage RLS restricts uploads to user's own folder
   * AC 6.2.2: Progress bar shows 0-100% during upload
   * AC 6.2.3: Progress updates at least every 100ms
   * AC 6.2.10: Warning if storage quota > 80%
   * AC 6.2.11: Upload rejected if storage quota > 95%
   */
  async uploadPhoto(
    input: PhotoUploadInput,
    onProgress?: (percent: number) => void
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
        throw new Error(
          `Storage nearly full (${quota.percent}%) - delete photos to continue`
        );
      }

      const userId = currentUser.user.id;
      const fileExt = input.mimeType.split('/')[1]; // jpeg, png, webp
      const uniqueId = crypto.randomUUID();
      const storagePath = `${userId}/${uniqueId}.${fileExt}`;

      // Upload to Supabase Storage (AC 6.2.2, 6.2.3)
      // Note: Supabase storage.upload() doesn't support native progress tracking
      // Progress simulation handled at component level if needed
      if (onProgress) {
        // Simulate progress for UX (upload is fast for compressed images)
        onProgress(25);
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, input.file, {
          contentType: input.mimeType,
          upsert: false, // Don't overwrite existing
        });

      if (onProgress) {
        onProgress(75);
      }

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

      const { data: photo, error: insertError } = await supabase
        .from('photos')
        .insert(photoData)
        .select()
        .single();

      if (insertError) {
        // Rollback: delete the uploaded file if DB insert fails
        console.error('[PhotoService] Database insert error:', insertError);
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        throw insertError;
      }

      if (import.meta.env.DEV) {
        console.log('[PhotoService] Photo uploaded:', photo?.id);
      }

      // Check quota after upload and warn if approaching limit
      const newQuota = await this.checkStorageQuota();
      if (newQuota.warning === 'approaching' || newQuota.warning === 'critical') {
        console.warn(`[PhotoService] Storage warning: ${newQuota.percent}% used`);
      }

      if (onProgress) {
        onProgress(100);
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
      const { error: deleteError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (deleteError) {
        console.error('[PhotoService] Database delete error:', deleteError);
        return false;
      }

      if (import.meta.env.DEV) {
        console.log('[PhotoService] Photo deleted:', photoId);
      }

      return true;
    } catch (error) {
      console.error('[PhotoService] Error in deletePhoto:', error);
      return false;
    }
  }

  /**
   * Get a single photo by ID with signed URL
   *
   * @param photoId - Photo ID
   * @returns Photo with signed URL or null
   */
  async getPhoto(photoId: string): Promise<PhotoWithUrls | null> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      const { data: photo, error } = await supabase
        .from('photos')
        .select('*')
        .eq('id', photoId)
        .single();

      if (error || !photo) {
        console.error('[PhotoService] Photo not found:', photoId);
        return null;
      }

      const signedUrl = await this.getSignedUrl(photo.storage_path);

      return {
        ...photo,
        signedUrl,
        isOwn: photo.user_id === currentUser.user.id,
      };
    } catch (error) {
      console.error('[PhotoService] Error in getPhoto:', error);
      return null;
    }
  }

  /**
   * Update a photo's metadata (caption only - other fields are immutable)
   *
   * @param photoId - Photo ID to update
   * @param updates - Partial photo update (only caption is mutable)
   * @returns true if updated successfully
   *
   * AC 6.0.6: Users can UPDATE only their own photos
   */
  async updatePhoto(photoId: string, updates: Partial<SupabasePhoto>): Promise<boolean> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      // Only allow updating caption - all other fields are immutable
      const allowedUpdates: Partial<SupabasePhoto> = {};
      if (updates.caption !== undefined) {
        allowedUpdates.caption = updates.caption;
      }

      if (Object.keys(allowedUpdates).length === 0) {
        console.warn('[PhotoService] No valid fields to update');
        return false;
      }

      const { error } = await supabase
        .from('photos')
        .update(allowedUpdates)
        .eq('id', photoId)
        .eq('user_id', currentUser.user.id); // Ensure ownership

      if (error) {
        console.error('[PhotoService] Update error:', error);
        return false;
      }

      if (import.meta.env.DEV) {
        console.log('[PhotoService] Photo updated:', photoId);
      }

      return true;
    } catch (error) {
      console.error('[PhotoService] Error in updatePhoto:', error);
      return false;
    }
  }
}

// Export singleton instance
export const photoService = new PhotoService();

// Export class for testing
export { PhotoService };
