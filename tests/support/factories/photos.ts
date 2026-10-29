import type { PhotoWithUrls, SupabasePhoto } from '../../../src/services/photoService';
import type { Database } from '../../../src/types/database.types';

type PhotoInsert = Database['public']['Tables']['photos']['Insert'];

/** What a seeded photo row must name; everything else has a default. */
export type PhotoInsertInput = Pick<PhotoInsert, 'user_id' | 'storage_path' | 'file_size'> &
  Partial<PhotoInsert>;

/**
 * A `photos` insert body for a small PNG the spec has already uploaded to
 * `storage_path`. `file_size` is the uploaded byte count, so the row always
 * describes the object it points at. Given `id` and `created_at` too, it is a
 * whole row as the gallery's read returns it, for a spec that fakes that read.
 */
export function createPhotoInsert(input: PhotoInsertInput): PhotoInsert {
  return {
    filename: input.storage_path.split('/').pop() ?? 'photo.png',
    caption: null,
    mime_type: 'image/png',
    width: 2,
    height: 2,
    ...input,
  };
}

/** What a whole photos row must name; everything else has a default. */
export type PhotoRowInput = Pick<
  SupabasePhoto,
  'id' | 'user_id' | 'storage_path' | 'caption' | 'mime_type' | 'created_at'
> &
  Partial<SupabasePhoto>;

/**
 * The `file_size` of a row that names none. The gallery never reads
 * `file_size`, so the value carries no meaning beyond being a byte count; 68
 * is simply the number the component tests each pasted before this existed.
 */
export const DEFAULT_PHOTO_FILE_SIZE = 68;

/**
 * A whole photos row as the gallery's read returns it, built on
 * `createPhotoInsert` and checked against `SupabasePhoto`, for a unit test that
 * fakes that read.
 */
export function createPhotoRow(input: PhotoRowInput): SupabasePhoto {
  const row = { ...input, file_size: input.file_size ?? DEFAULT_PHOTO_FILE_SIZE };
  return { ...createPhotoInsert(row), ...row };
}

/** A photos row as the gallery holds it: `createPhotoRow` plus the two client fields. */
export function createPhotoWithUrls(input: PhotoRowInput, isOwn = true): PhotoWithUrls {
  return { ...createPhotoRow(input), signedUrl: null, isOwn };
}
