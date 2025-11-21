# PHOTOS SLICE

## File

`src/stores/slices/photosSlice.ts`

## Purpose

Manages photo gallery: upload, compression, storage quota monitoring, CRUD, and carousel state.

## State Interface

```typescript
export interface PhotosSlice {
  // State
  photos: Photo[];
  isLoadingPhotos: boolean;
  photoError: string | null;
  storageWarning: string | null;
  selectedPhotoId: number | null;

  // Actions
  loadPhotos: () => Promise<void>;
  uploadPhoto: (input: PhotoUploadInput) => Promise<Photo>;
  getPhotoById: (photoId: number) => Photo | null;
  getStorageUsage: () => Promise<{ used: number; quota: number; percentUsed: number }>;
  clearStorageWarning: () => void;
  updatePhoto: (photoId: number, updates: { caption?: string; tags: string[] }) => Promise<void>;
  deletePhoto: (photoId: number) => Promise<void>;
  selectPhoto: (photoId: number) => void;
  clearPhotoSelection: () => void;
}
```

## State Shape

```typescript
{
  photos: [
    {
      id: number,
      imageBlob: Blob,              // Compressed image
      caption?: string,
      tags: string[],
      uploadDate: Date,
      originalSize: number,         // Bytes
      compressedSize: number,       // Bytes
      width: number,                // Pixels
      height: number,               // Pixels
      mimeType: 'image/jpeg',
    }
  ],

  isLoadingPhotos: boolean,         // Upload/load in progress
  photoError: string | null,        // Error message
  storageWarning: string | null,    // "Storage 85% full..."
  selectedPhotoId: number | null,   // Current carousel photo
}
```

## Initial State

```typescript
photos: [],
isLoadingPhotos: false,
photoError: null,
storageWarning: null,
selectedPhotoId: null,
```

## Actions

### loadPhotos()

**Type**: Async  
**Source**: IndexedDB (photoStorageService)  
**Persistence**: IndexedDB (photos not persisted to LocalStorage)

**Process**:

1. Set `isLoadingPhotos = true`
2. Fetch all photos from IndexedDB
3. Update `photos` state
4. Set `isLoadingPhotos = false`

**Error Handling**: Logs error → clears state → falls back to empty array

### uploadPhoto(input)

**Type**: Async  
**Input**: `PhotoUploadInput { file: File, caption?: string, tags?: string }`  
**Returns**: `Photo` (with generated ID)

**Process**:

1. **Validation**:
   - Validate file (mime type, size)
   - Log warnings if file is large
2. **Tag Processing**:
   - Split by comma
   - Trim whitespace
   - Remove duplicates (case-insensitive)
   - Limit to 10 tags
   - Limit each tag to 50 chars
3. **Caption Processing**:
   - Limit to 500 chars
4. **Compression**:
   - Call `imageCompressionService.compressImage(file)`
   - Returns: blob, width, height, originalSize, compressedSize
5. **Quota Check**:
   - Estimate remaining quota via `photoStorageService.estimateQuotaRemaining()`
   - If ≥ 80% full: warn (set `storageWarning`)
   - If ≥ 95% full: reject with "Storage full" error
6. **Save to IndexedDB**:
   - Create Photo object with compressed blob
   - Save via `photoStorageService.create(photo)`
7. **Optimistic UI Update**:
   - Add photo to beginning of `photos` array (newest first)
   - Set `isLoadingPhotos = false`

**Error Handling**: Logs error → sets `photoError` → re-throws for UI

### getPhotoById(photoId)

**Type**: Sync query  
**Returns**: `Photo | null`

**Logic**:

```typescript
return get().photos.find((p) => p.id === photoId) || null;
```

### getStorageUsage()

**Type**: Async query  
**Returns**: `{ used: number; quota: number; percentUsed: number }`

**Process**:

1. Call `photoStorageService.estimateQuotaRemaining()`
2. Return quota info object

**Error Handling**: Returns conservative defaults (0 used, 50MB quota, 0%)

### clearStorageWarning()

**Type**: Sync  
**Sets**: `storageWarning = null`

**Use Case**: User dismisses warning notification

### updatePhoto(photoId, updates)

**Type**: Async  
**Input**: `{ caption?: string; tags: string[] }`

**Process**:

1. Update in IndexedDB via `photoStorageService.update()`
2. Optimistic UI update: merge fields into matching photo
3. Log success

### deletePhoto(photoId)

**Type**: Async  
**Constraints**: Special logic if photo is selected in carousel

**Process**:

1. Get current photo index before deletion
2. Delete from IndexedDB
3. Optimistic UI update: filter out photo
4. If deleted photo was selected:
   - If no photos left: clear selection
   - Else if not last photo: navigate to same index (next photo)
   - Else if was last photo: navigate to new last photo

**AC-4.4.7**: Smart navigation after delete

### selectPhoto(photoId)

**Type**: Sync  
**Sets**: `selectedPhotoId = photoId`

**Use Case**: Open carousel at specific photo

### clearPhotoSelection()

**Type**: Sync  
**Sets**: `selectedPhotoId = null`

**Use Case**: Close carousel

## Storage Quota Management

**Thresholds**:

- < 80%: Normal operation
- 80-95%: Warning displayed
- ≥ 95%: Reject uploads

**AC-4.1.9**: Show UI notification at 80% full

**Limits**:

- Default quota: 50MB
- Storage type: IndexedDB (persists across sessions)

## Persistence

- **What**: NOT persisted to LocalStorage
- **Where**: IndexedDB only
- **When**: Photos loaded on demand via `loadPhotos()`
- **Blobs**: Stored as Blob objects in IndexedDB

## Dependencies

**Cross-Slice**: None (self-contained)

**External**:

- `photoStorageService` (IndexedDB CRUD)
- `imageCompressionService` (compression algorithm)

---
