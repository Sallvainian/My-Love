# Photos Slice

**File:** `src/stores/slices/photosSlice.ts`
**Interface:** `PhotosSlice`

## Purpose

Manages the photo gallery feature: loading photos from Supabase, uploading with client-side compression, editing metadata (caption/tags), deleting, and monitoring storage quota.

## State

| Field             | Type              | Default | Persisted | Description                                  |
| ----------------- | ----------------- | ------- | --------- | -------------------------------------------- |
| `photos`          | `PhotoWithUrls[]` | `[]`    | No        | Array of photos with signed URLs             |
| `selectedPhotoId` | `string \| null`  | `null`  | No        | Currently selected photo for viewer/carousel |
| `isUploading`     | `boolean`         | `false` | No        | Whether a photo upload is in progress        |
| `uploadProgress`  | `number`          | `0`     | No        | Upload progress percentage (0-100)           |
| `error`           | `string \| null`  | `null`  | No        | Error message for photo operations           |
| `storageWarning`  | `string \| null`  | `null`  | No        | Storage quota warning message                |

## Actions

| Action                | Signature                                                             | Description                                      |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| `uploadPhoto`         | `(input: PhotoUploadInput) => Promise<void>`                          | Compresses and uploads photo to Supabase storage |
| `loadPhotos`          | `() => Promise<void>`                                                 | Fetches photos from Supabase with signed URLs    |
| `deletePhoto`         | `(photoId: string) => Promise<void>`                                  | Deletes photo from storage and database          |
| `updatePhoto`         | `(photoId: string, updates: Partial<SupabasePhoto>) => Promise<void>` | Updates photo metadata (caption, tags, etc.)     |
| `selectPhoto`         | `(photoId: string \| null) => void`                                   | Sets selected photo for viewer                   |
| `clearPhotoSelection` | `() => void`                                                          | Clears selected photo                            |
| `clearError`          | `() => void`                                                          | Clears error state                               |
| `clearStorageWarning` | `() => void`                                                          | Clears storage warning                           |

## PhotoUploadInput Shape

`PhotoUploadInput` is imported from `photoService`. Exact shape depends on the service interface.

## Storage Quota Monitoring

`uploadPhoto()` checks storage quota during upload (80% warning threshold, 95% rejection threshold). The PhotoUpload component displays the `storageWarning` banner.

## Component Usage

- **PhotoGallery** -- Uses `photos`, `loadPhotos`, `selectPhoto`
- **PhotoUpload** -- Uses `uploadPhoto`, `storageWarning`
- **PhotoViewer** -- Uses `selectedPhotoId`, `deletePhoto`
- **PhotoCarousel** -- Uses `photos`, `selectedPhotoId`, `selectPhoto`
- **PhotoEditModal** -- Uses `updatePhoto` (via parent)
- **usePhotos hook** -- Wraps slice actions for component consumption

## Cross-Slice Dependencies

- **AuthSlice** -- Reads `get().userId` to scope photo operations (upload, load, delete) to the authenticated user.
