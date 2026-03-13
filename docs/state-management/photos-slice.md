# Photos Slice

**File:** `src/stores/slices/photosSlice.ts`
**Interface:** `PhotosSlice`

## Purpose

Manages the photo gallery feature: loading photos from Supabase, uploading with client-side compression, editing metadata (caption/tags), deleting, and monitoring storage quota.

## State

| Field             | Type              | Default | Persisted | Description                                   |
| ----------------- | ----------------- | ------- | --------- | --------------------------------------------- |
| `photos`          | `PhotoWithUrls[]` | `[]`    | No        | Array of photos with signed URLs              |
| `selectedPhotoId` | `string \| null`  | `null`  | No        | Currently selected photo for viewer/carousel  |
| `isUploading`     | `boolean`         | `false` | No        | Whether a photo upload is in progress         |
| `uploadProgress`  | `number`          | `0`     | No        | Upload progress percentage (0-100)            |
| `photosError`     | `string \| null`  | `null`  | No        | Error message for photo operations            |
| `storageWarning`  | `string \| null`  | `null`  | No        | Storage quota warning message                 |
| `photosLoading`   | `boolean`         | `false` | No        | Loading state for photo operations            |
| `photosHasMore`   | `boolean`         | `true`  | No        | Whether more photos exist for infinite scroll |

## Actions

| Action               | Signature                                             | Description                                      |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `loadPhotos`         | `() => Promise<void>`                                 | Fetches photos from Supabase with signed URLs    |
| `loadMorePhotos`     | `() => Promise<void>`                                 | Loads next page of photos (infinite scroll)      |
| `uploadPhoto`        | `(input: UploadPhotoInput) => Promise<void>`          | Compresses and uploads photo to Supabase storage |
| `deletePhoto`        | `(photoId: string) => Promise<void>`                  | Deletes photo from storage and database          |
| `updatePhotoCaption` | `(photoId: string, caption: string) => Promise<void>` | Updates photo caption                            |
| `updatePhotoTags`    | `(photoId: string, tags: string[]) => Promise<void>`  | Updates photo tags                               |
| `selectPhoto`        | `(photoId: string \| null) => void`                   | Sets selected photo for viewer                   |
| `checkStorageQuota`  | `() => Promise<void>`                                 | Checks Supabase storage usage and sets warnings  |

## UploadPhotoInput Shape

```typescript
interface UploadPhotoInput {
  file: File;
  filename: string;
  caption?: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
}
```

## Storage Quota Monitoring

`checkStorageQuota()` queries Supabase storage usage and sets `storageWarning` when approaching limits. The PhotoUpload component displays this warning banner.

## Component Usage

- **PhotoGallery** -- Uses `photos`, `loadPhotos`, `loadMorePhotos`, `photosLoading`, `photosHasMore`, `selectPhoto`
- **PhotoUpload** -- Uses `uploadPhoto`, `storageWarning`
- **PhotoViewer** -- Uses `selectedPhotoId`, `deletePhoto`
- **PhotoCarousel** -- Uses `photos`, `selectedPhotoId`, `selectPhoto`
- **PhotoEditModal** -- Uses `updatePhotoCaption`, `updatePhotoTags`

## Cross-Slice Dependencies

None. Operates independently.
