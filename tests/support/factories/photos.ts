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
