# Story 6.2: Photo Upload with Progress Indicator

Status: drafted

## Story

As a **user**,
I want **to see upload progress while my photo transfers to the server**,
so that **I know the upload is working and can estimate completion time**.

## Acceptance Criteria

1. **AC 6.2.1:** Upload button disabled until photo selected
2. **AC 6.2.2:** Progress bar shows 0-100% during upload
3. **AC 6.2.3:** Progress updates at least every 100ms
4. **AC 6.2.4:** Caption input field accepts max 500 characters
5. **AC 6.2.5:** Character counter shows "X/500" for caption
6. **AC 6.2.6:** Upload creates storage file at `{user_id}/{uuid}.jpg`
7. **AC 6.2.7:** Upload creates metadata row in photos table
8. **AC 6.2.8:** Success toast displays on upload completion
9. **AC 6.2.9:** Error toast displays on upload failure with retry option
10. **AC 6.2.10:** If storage quota > 80%, warning toast displays
11. **AC 6.2.11:** If storage quota > 95%, upload rejected with error
12. **AC 6.2.12:** Upload modal closes on success, gallery shows new photo
13. **AC 6.2.13:** Network error during upload shows retry button

## Tasks / Subtasks

- [x] **Task 1: Create photoService upload methods** (AC: 6.2.6, 6.2.7, 6.2.10, 6.2.11)
  - [x] Extend `src/services/photoService.ts` with upload functionality
  - [x] Implement `uploadPhoto(input: PhotoUploadInput, onProgress?: callback)` with progress callback
  - [x] Generate unique storage path: `{userId}/{uuid}.jpg`
  - [x] Upload compressed blob to Supabase Storage with progress tracking
  - [x] Extract dimensions from compressed image (width, height)
  - [x] Insert metadata to photos table with all required fields
  - [x] Implement `checkStorageQuota(): Promise<StorageQuota>` for quota validation
  - [x] Add rollback logic: delete storage file if DB insert fails
  - [x] Return Photo object with metadata + storage_path

- [x] **Task 2: Create photosSlice Zustand store** (AC: All)
  - [x] Create `src/stores/slices/photosSlice.ts`
  - [x] Define PhotosState interface with photos array, loading states, error states
  - [x] Implement `uploadPhoto(input)` action with optimistic update
  - [x] Track upload progress state (0-100%)
  - [x] Implement storage quota warning logic (80%/95% thresholds)
  - [x] Implement `loadPhotos()` action to fetch user + partner photos
  - [x] Implement `deletePhoto(id)` action (for Story 6.4)
  - [x] Add error handling with user-friendly error messages

- [x] **Task 3: Create usePhotos hook** (AC: All)
  - [x] Create `src/hooks/usePhotos.ts`
  - [x] Wrap photosSlice with React hook interface
  - [x] Expose: photos, isUploading, uploadProgress, error, uploadPhoto(), loadPhotos()
  - [x] Implement automatic photo reload after successful upload

- [x] **Task 4: Enhance PhotoUploader with upload UI** (AC: 6.2.1-6.2.5, 6.2.8-6.2.9, 6.2.12-6.2.13)
  - [x] Update `src/components/photos/PhotoUploader.tsx`
  - [x] Add caption input field with 500 char limit and counter (AC 6.2.4, 6.2.5)
  - [x] Add upload button, disabled until photo selected (AC 6.2.1)
  - [x] Integrate progress bar showing 0-100% (AC 6.2.2, 6.2.3)
  - [x] Call `uploadPhoto()` on upload button click
  - [x] Show success toast on completion (AC 6.2.8)
  - [x] Show error toast with retry button on failure (AC 6.2.9, 6.2.13)
  - [x] Close modal on successful upload (AC 6.2.12)
  - [x] Handle cancel upload functionality

- [x] **Task 5: Add storage quota warnings** (AC: 6.2.10, 6.2.11)
  - [x] Check storage quota before upload via `checkStorageQuota()`
  - [x] If quota > 95%, reject upload with error message (AC 6.2.11)
  - [x] If quota > 80%, show warning toast after successful upload (AC 6.2.10)
  - [x] Display current storage usage in warning ("750MB of 1GB used")

- [ ] **Task 6: Write unit tests for photoService** (AC: 6.2.6, 6.2.7)
  - [ ] Create/extend `tests/unit/services/photoService.test.ts`
  - [ ] Test upload path generation format: `{userId}/{uuid}.jpg`
  - [ ] Test successful upload flow: storage + database
  - [ ] Test rollback on DB insert failure (storage file cleanup)
  - [ ] Test storage quota calculation
  - [ ] Test progress callback invocation
  - [ ] Test error handling for network failures

- [ ] **Task 7: Write integration tests for upload flow** (AC: All)
  - [ ] Create `tests/integration/photoUpload.test.tsx`
  - [ ] Test complete upload flow: compression → upload → metadata
  - [ ] Test quota validation (80%/95% thresholds)
  - [ ] Test optimistic update in Zustand store
  - [ ] Test error recovery and retry logic
  - [ ] Test caption validation (max 500 chars)

- [ ] **Task 8: Write E2E tests for upload experience** (AC: All)
  - [ ] Create `tests/e2e/photoUpload.spec.ts`
  - [ ] Test full upload workflow with UI interactions
  - [ ] Test progress bar visibility and updates
  - [ ] Test success toast display
  - [ ] Test error toast with retry button
  - [ ] Test modal close on success
  - [ ] Test storage quota warning display
  - [ ] Test network error handling

## Dev Notes

### CRITICAL Developer Context

**🔥 PREVENT COMMON MISTAKES:**
- **DO NOT** reinvent photoService - it already exists with storage methods
- **DO NOT** ignore Story 6.1 learnings - compression service is ready to use
- **DO NOT** skip rollback logic - orphaned storage files create billing issues
- **DO NOT** forget quota checks - prevent users from hitting hard limits
- **DO NOT** skip progress updates - UX requirement for long uploads

### Architecture Alignment

**Service Layer:**
- `src/services/photoService.ts` - **ALREADY EXISTS** from Story 6-0 with `getSignedUrl()`, `checkStorageQuota()`
- Extend with `uploadPhoto()` method - use existing Supabase client from service
- Pattern: Singleton service with console logging in dev mode

**State Management:**
- `src/stores/slices/photosSlice.ts` - NEW Zustand slice following architecture pattern
- Reference: `src/stores/slices/moodSlice.ts` or `src/stores/slices/loveNotesSlice.ts` for patterns
- Must use Zustand persist middleware for offline access to photo list

**Component Layer:**
- `src/components/photos/PhotoUploader.tsx` - **ALREADY EXISTS** from Story 6.1
- Enhance with upload button, progress bar, caption input, toast notifications
- Use existing `useImageCompression` hook from Story 6.1

**Hook Layer:**
- `src/hooks/usePhotos.ts` - NEW hook wrapping photosSlice
- Pattern: Simple selector + action wrapper, see `useLoveNotes.ts` for example

### Learnings from Story 6.1 (Photo Selection & Compression)

**Available Components:**
- `PhotoUploader.tsx` - Has file input, preview, compression integration
- `useImageCompression` hook - Returns `{ compress(), result, isCompressing, error }`
- `imageCompressionService` - Returns `CompressionResult` with blob, dimensions, sizes

**Compression Output:**
```typescript
interface CompressionResult {
  blob: Blob;           // Use this for upload
  width: number;        // Save to photos.width
  height: number;       // Save to photos.height
  originalSize: number; // For logging
  compressedSize: number; // Use for quota calculation
}
```

**Integration Pattern:**
```typescript
// From PhotoUploader - already working
const { compress, result, isCompressing } = useImageCompression();
await compress(selectedFile);
// result.blob is ready for upload
// result.width, result.height for metadata
```

### Learnings from Story 6-0 (Photo Storage Schema)

**PhotoService Already Available:**
```typescript
// EXISTING methods - DO NOT RECREATE
photoService.getSignedUrl(storagePath: string): Promise<string>
photoService.checkStorageQuota(): Promise<{ used: number; quota: number; percent: number }>

// ADD these new methods
photoService.uploadPhoto(input: PhotoUploadInput, onProgress?: (percent: number) => void): Promise<Photo>
```

**Database Schema:**
```sql
-- photos table ALREADY EXISTS from Story 6-0
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  caption TEXT CHECK (char_length(caption) <= 500),
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

**Storage Path Pattern:**
```typescript
// Required format for RLS to work
const storagePath = `${userId}/${crypto.randomUUID()}.jpg`;
// Example: "550e8400-e29b-41d4-a716-446655440000/7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg"
```

### Supabase Upload Implementation Reference

**Upload with Progress Tracking:**
```typescript
// Example from tech-spec-epic-6.md
const { data, error } = await supabase.storage
  .from('photos')
  .upload(storagePath, compressedBlob, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'image/jpeg',
    onUploadProgress: (progress) => {
      const percent = Math.round((progress.loaded / progress.total) * 100);
      onProgress?.(percent); // Callback for progress bar
    }
  });
```

**Metadata Insert:**
```typescript
const { data: photo, error } = await supabase
  .from('photos')
  .insert({
    user_id: userId,
    storage_path: storagePath,
    filename: originalFilename,
    caption: caption || null,
    mime_type: 'image/jpeg',
    file_size: compressedSize,
    width: dimensions.width,
    height: dimensions.height
  })
  .select()
  .single();
```

**Rollback on Failure:**
```typescript
// If metadata insert fails, clean up storage file
try {
  // Upload storage...
  // Insert metadata...
} catch (error) {
  // Rollback: delete storage file
  await supabase.storage.from('photos').remove([storagePath]);
  throw error; // Re-throw for UI error handling
}
```

### Storage Quota Management

**Quota Thresholds:**
- **80% usage:** Show warning toast "Storage 80% full - consider deleting old photos"
- **95% usage:** Reject upload with error "Storage nearly full (95%) - delete photos to continue"
- **100% usage:** Supabase will reject upload automatically

**Quota Calculation:**
```typescript
interface StorageQuota {
  used: number;    // Bytes used
  quota: number;   // Total bytes (1GB for free tier = 1073741824)
  percent: number; // used / quota * 100
}

// Implementation
async checkStorageQuota(): Promise<StorageQuota> {
  const { data, error } = await supabase.storage.from('photos').list(userId);
  const totalSize = data.reduce((sum, file) => sum + file.metadata.size, 0);
  const quota = 1073741824; // 1GB in bytes
  return {
    used: totalSize,
    quota,
    percent: (totalSize / quota) * 100
  };
}
```

### TypeScript Types Reference

**From src/types/models.ts (already defined in Story 6-0):**
```typescript
export interface Photo {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  caption: string | null;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  file_size: number;
  width: number;
  height: number;
  created_at: string;
}

export interface PhotoUploadInput {
  file: File;
  caption?: string;
}

export interface PhotosState {
  photos: Photo[];
  isLoading: boolean;
  uploadProgress: number; // 0-100
  error: string | null;
  storageWarning: string | null;
  // Actions
  loadPhotos: () => Promise<void>;
  uploadPhoto: (input: PhotoUploadInput) => Promise<Photo>;
  deletePhoto: (photoId: string) => Promise<void>;
  clearError: () => void;
  clearStorageWarning: () => void;
}
```

### Recent Commits Context (Last 5 Commits)

```
9a02e56 fix(realtime): replace postgres_changes with Broadcast API for partner mood updates
2399826 fix(e2e): improve authentication handling in mood logging tests
d14d983 fix(tests): mock Supabase client properly in useLoveNotes tests
b6795f5 fix(photos): add test for dimension failure and improve error handling
bf367f7 feat(photos): implement AC-6.1.8 fallback to original file on compression failure
```

**Key Learnings:**
- **Realtime:** Broadcast API is preferred over postgres_changes (if needed for future)
- **Testing:** Proper Supabase client mocking is critical for test reliability
- **Photos:** Compression failure handling already implemented with fallback logic
- **Error Handling:** Team values thorough error path testing

### Testing Standards from Story 6.1

**Test Organization:**
- Unit tests: `tests/unit/services/photoService.test.ts` (extend existing from Story 6-0)
- Component tests: `tests/unit/components/PhotoUploader.test.tsx` (extend existing from Story 6.1)
- Integration tests: `tests/integration/photoUpload.test.tsx` (new)
- E2E tests: `tests/e2e/photoUpload.spec.ts` (new)

**Coverage Requirements:**
- photoService upload method: 100% coverage
- photosSlice actions: 100% coverage
- Error paths: network failure, quota exceeded, rollback scenarios
- Edge cases: simultaneous uploads, very large captions, special characters

**Existing Test Patterns from Story 6-0:**
- 33 tests in photoService.test.ts - follow AAA pattern
- Mock Supabase client responses for storage and database
- Test both success and error paths
- Use `vi.clearAllMocks()` in beforeEach

### Performance Requirements

**Upload Performance:**
- Progress updates: Every 100ms minimum (AC 6.2.3)
- Total upload time: < 10s for 1MB compressed photo on 4G
- UI responsiveness: No blocking during upload (use async)

**Optimistic Updates:**
- Add photo to local state immediately on upload start
- Mark as "uploading" with progress indicator
- Replace with server response on completion
- Remove on failure with error state

### Security Considerations

**Input Validation:**
- Caption max length: 500 chars (DB constraint)
- File type: Must be image (validated in Story 6.1)
- File size: Max 10MB after compression (Story 6.1)
- XSS prevention: Sanitize caption on display (not in DB)

**Storage Security:**
- RLS policies ALREADY CONFIGURED in Story 6-0
- Storage path must match user_id for RLS to work
- Signed URLs have 1-hour expiry (from photoService.getSignedUrl())

### UI/UX Requirements

**Progress Feedback:**
- Linear progress bar (0-100%) with smooth transitions
- Percentage text: "Uploading... 45%"
- Disable upload button during upload
- Show cancel button during upload
- Vibration feedback on completion (navigator.vibrate([30]))

**Toast Notifications:**
- Success: "Photo uploaded successfully!" (green, 3s duration)
- Error: "Upload failed. [Retry]" (red, persistent until dismissed)
- Warning: "Storage 80% full - consider deleting old photos" (yellow, 5s duration)
- Quota error: "Storage nearly full (95%) - delete photos to continue" (red, persistent)

**Caption Input:**
- Placeholder: "Add a caption (optional)"
- Character counter: "0/500" → "150/500" (changes to red at 490+)
- Multi-line textarea, 3 rows visible
- Auto-resize up to 5 rows

### Project Structure Notes

**New Files:**
- `src/stores/slices/photosSlice.ts`
- `src/hooks/usePhotos.ts`
- `tests/integration/photoUpload.test.tsx`
- `tests/e2e/photoUpload.spec.ts`

**Modified Files:**
- `src/services/photoService.ts` (add uploadPhoto method)
- `src/components/photos/PhotoUploader.tsx` (add upload UI)
- `tests/unit/services/photoService.test.ts` (add upload tests)
- `tests/unit/components/PhotoUploader.test.tsx` (add upload UI tests)

### References

- [Source: docs/05-Epics-Stories/tech-spec-epic-6.md#Story-6-2-Photo-Upload-with-Progress-Indicator]
- [Source: docs/05-Epics-Stories/tech-spec-epic-6.md#Detailed-Design-Services-and-Modules]
- [Source: docs/05-Epics-Stories/tech-spec-epic-6.md#Workflows-and-Sequencing-Photo-Upload-Flow]
- [Source: docs/05-Epics-Stories/tech-spec-epic-6.md#APIs-and-Interfaces]
- [Source: docs/05-Epics-Stories/6-1-photo-selection-compression.md#Learnings-from-Previous-Story]
- [Source: docs/05-Epics-Stories/6-0-photo-storage-schema-buckets-setup.md#Dev-Notes]
- [Source: docs/02-Architecture/architecture.md#State-Management-Zustand]
- [Source: docs/05-Epics-Stories/epics.md#Story-6.2]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
