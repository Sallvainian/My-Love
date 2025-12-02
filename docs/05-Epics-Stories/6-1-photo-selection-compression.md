# Story 6.1: Photo Selection & Compression

Status: Ready for Review

## Story

As a **user**,
I want **to select photos from my device and have them optimized before upload**,
so that **sharing is fast and doesn't consume excessive storage**.

## Acceptance Criteria

1. **AC 6.1.1:** File picker accepts only image types: JPEG, PNG, WebP
2. **AC 6.1.2:** Files larger than 25MB raw are rejected with error message
3. **AC 6.1.3:** Selected image displays in preview before upload
4. **AC 6.1.4:** Compression reduces image to max 2048px on longest dimension
5. **AC 6.1.5:** Compression targets 80% JPEG quality
6. **AC 6.1.6:** Compressed output is always JPEG format
7. **AC 6.1.7:** Compression completes in < 3 seconds for 10MB input
8. **AC 6.1.8:** If compression fails, original file used if < 10MB
9. **AC 6.1.9:** EXIF metadata stripped during compression (privacy)
10. **AC 6.1.10:** Camera option available on mobile devices

## Tasks / Subtasks

- [x] **Task 1: Create imageCompressionService** (AC: 6.1.4, 6.1.5, 6.1.6, 6.1.7, 6.1.9)
  - [x] Create `src/services/imageCompressionService.ts`
  - [x] Implement `compressImage(file: File): Promise<CompressionResult>` using Canvas API
  - [x] Calculate max dimensions (2048px longest side) while preserving aspect ratio
  - [x] Export to JPEG at 80% quality via `canvas.toBlob()`
  - [x] Implement EXIF stripping (Canvas redraw removes EXIF metadata)
  - [x] Add performance timing for compression benchmark (< 3s target)
  - [x] Return `CompressionResult` with blob, dimensions, originalSize, compressedSize

- [x] **Task 2: Create PhotoUploader component foundation** (AC: 6.1.1, 6.1.2, 6.1.3, 6.1.10)
  - [x] Create `src/components/photos/PhotoUploader.tsx`
  - [x] Add file input with `accept="image/jpeg,image/png,image/webp"`
  - [x] Add `capture="environment"` attribute for mobile camera access
  - [x] Implement file size validation (reject > 25MB raw)
  - [x] Display user-friendly error message for oversized files
  - [x] Show image preview using `URL.createObjectURL()`
  - [x] Clean up object URLs on component unmount to prevent memory leaks

- [x] **Task 3: Integrate compression with uploader** (AC: 6.1.4-6.1.8)
  - [x] Call `compressImage()` on file selection
  - [x] Show compression progress/status indicator
  - [x] Handle compression failure gracefully (fallback to original if < 10MB)
  - [x] Show error if original > 10MB and compression fails
  - [x] Store compressed blob for upload (next story)

- [x] **Task 4: Add useImageCompression hook** (AC: 6.1.4-6.1.9)
  - [x] Create `src/hooks/useImageCompression.ts`
  - [x] Wrap compression service with React state management
  - [x] Track compression status: `idle`, `compressing`, `complete`, `error`
  - [x] Expose: `compress(file)`, `result`, `isCompressing`, `error`

- [x] **Task 5: Write unit tests for imageCompressionService** (AC: All)
  - [x] Create `tests/unit/services/imageCompressionService.test.ts`
  - [x] Test dimension reduction (> 2048px → max 2048px)
  - [x] Test aspect ratio preservation
  - [x] Test JPEG format output
  - [x] Test compression timing (mock performance.now())
  - [x] Test fallback behavior on compression failure
  - [x] Test file type validation

- [x] **Task 6: Write component tests for PhotoUploader** (AC: 6.1.1-6.1.3, 6.1.10)
  - [x] Create `tests/unit/components/PhotoUploader.test.tsx`
  - [x] Test file input accepts only valid image types
  - [x] Test file size rejection for > 25MB
  - [x] Test preview display after selection
  - [x] Test camera option via capture attribute
  - [x] Test error message display

## Dev Notes

### Architecture Alignment

- **Service Layer:** `src/services/imageCompressionService.ts` - client-side compression via Canvas API
- **Component Layer:** `src/components/photos/PhotoUploader.tsx` - UI for file selection and preview
- **Hook Layer:** `src/hooks/useImageCompression.ts` - React state wrapper for compression
- **Dependencies:** Uses browser native Canvas API (no external library needed)

### Compression Algorithm Reference

```typescript
// Compression workflow per tech-spec-epic-6.md:
// 1. Load image into Image element
// 2. Create canvas at target dimensions:
//    - If width > 2048: scale to 2048px width, proportional height
//    - If height > 2048: scale to 2048px height, proportional width
//    - Else: use original dimensions
// 3. Draw image to canvas (automatically strips EXIF)
// 4. Export as JPEG at 80% quality
// 5. Return compressed Blob + dimensions
```

### TypeScript Types Reference

```typescript
// From tech-spec-epic-6.md - already defined in src/types/models.ts:
export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}
```

### Performance Requirements

- Compression must complete in < 3 seconds for 10MB input image
- Use `performance.now()` to measure compression timing
- Consider Web Workers for heavy compression (future optimization)

### Security & Privacy

- EXIF stripping mandatory for privacy (location data, device info)
- Canvas redraw automatically removes EXIF metadata
- No original image data retained after compression

### Testing Standards

- Unit tests: Vitest with `@testing-library/react` for components
- Mock `Image` and `canvas.toBlob()` for compression tests
- Follow existing patterns from `tests/unit/services/photoService.test.ts`

### Project Structure Notes

- Service: `src/services/imageCompressionService.ts`
- Component: `src/components/photos/PhotoUploader.tsx`
- Hook: `src/hooks/useImageCompression.ts`
- Tests: `tests/unit/services/imageCompressionService.test.ts`, `tests/unit/components/PhotoUploader.test.tsx`

### Learnings from Previous Story

**From Story 6-0 (Photo Storage Schema & Buckets Setup):**

- **PhotoService Available:** Use `photoService` methods for storage operations (do not recreate)
  - `getSignedUrl(storagePath)` - Generate signed URLs for private access
  - `checkStorageQuota()` - Monitor usage against 80%/95% thresholds
  - `uploadPhoto(input)` - Upload photo to storage (for next story 6-2)
- **Types Available:** `Photo`, `PhotoWithUrls`, `CompressionResult` interfaces in `src/types/models.ts`
- **Testing Patterns:** 33 tests in photoService.test.ts - follow AAA pattern, error path coverage
- **Service Pattern:** Singleton service pattern with console logging in dev mode

[Source: docs/05-Epics-Stories/6-0-photo-storage-schema-buckets-setup.md#Dev-Agent-Record]

### References

- [Source: docs/05-Epics-Stories/tech-spec-epic-6.md#Story-6-1-Photo-Selection-Compression]
- [Source: docs/05-Epics-Stories/tech-spec-epic-6.md#Compression-Algorithm]
- [Source: docs/05-Epics-Stories/tech-spec-epic-6.md#Data-Models-and-Contracts]
- [Source: docs/02-Architecture/architecture.md#Project-Structure]
- [Source: docs/05-Epics-Stories/epics.md#Story-6.1]

## Dev Agent Record

### Context Reference

- docs/05-Epics-Stories/6-1-photo-selection-compression.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- None required - clean implementation

### Completion Notes List

- **Task 1**: Created imageCompressionService with Canvas API-based compression. Implements all ACs: 2048px max dimensions, 80% JPEG quality, performance timing with console warnings for >3s compression, EXIF stripping via canvas redraw.
- **Task 2**: Created PhotoUploader component with file input accepting JPEG/PNG/WebP, capture="environment" for mobile camera, 25MB file size validation, image preview with URL.createObjectURL(), and memory leak prevention via object URL cleanup.
- **Task 3**: Integrated compression into uploader - calls compressImage() on upload, shows error messages on failure, passes compressed blob + metadata to onUpload callback.
- **Task 4**: Created useImageCompression hook wrapping compression service with React state management. Tracks status (idle/compressing/complete/error), exposes compress(), result, isCompressing, error, and reset().
- **Task 5**: Wrote 19 unit tests for imageCompressionService covering all ACs - dimension reduction, aspect ratio preservation, JPEG output, compression timing, fallback behavior, file type validation.
- **Task 6**: Wrote 15 component tests for PhotoUploader covering file input attributes, size validation, preview display, upload workflow, object URL cleanup, and cancel functionality.

### File List

**New Files:**
- src/components/photos/PhotoUploader.tsx
- src/hooks/useImageCompression.ts
- tests/unit/services/imageCompressionService.test.ts
- tests/unit/components/PhotoUploader.test.tsx

**Modified Files:**
- src/services/imageCompressionService.ts (enhanced with full implementation)
- src/types/index.ts (CompressionOptions, CompressionResult interfaces)

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-11-26 | 0.1.0 | Story drafted via create-story workflow |
| 2025-12-02 | 1.0.0 | Implementation complete - All 6 tasks done, 34 unit tests passing (19 service + 15 component). All 10 ACs satisfied. Ready for Review. |
