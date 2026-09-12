import type { PhotoWithUrls } from '../../../src/services/photoService';

export const OWN_PHOTO_ID = '59000000-0000-4000-8000-000000000001';
export const OWN_PHOTO_CAPTION = 'DW-59 bright own photo';
export const PARTNER_PHOTO_CAPTION = 'DW-59 bright partner photo';

/** Browser-local fixture: real PNG bytes, no upload, signed URL request, or database mutation. */
export function createWhitePhotoFixture(
  isOwn: boolean,
  overrides: Partial<PhotoWithUrls> = {}
): PhotoWithUrls {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 240;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D canvas is required for the white photo fixture');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 240, 240);
  const signedUrl = canvas.toDataURL('image/png');
  const userId = isOwn
    ? '59000000-0000-4000-8000-000000000011'
    : '59000000-0000-4000-8000-000000000012';
  return {
    id: isOwn ? OWN_PHOTO_ID : '59000000-0000-4000-8000-000000000002',
    user_id: userId,
    storage_path: `${userId}/white.png`,
    filename: 'white.png',
    caption: isOwn ? OWN_PHOTO_CAPTION : PARTNER_PHOTO_CAPTION,
    mime_type: 'image/png',
    file_size: atob(signedUrl.split(',')[1]).length,
    width: 240,
    height: 240,
    created_at: '2026-09-12T00:00:00.000Z',
    signedUrl,
    isOwn,
    ...overrides,
  };
}
