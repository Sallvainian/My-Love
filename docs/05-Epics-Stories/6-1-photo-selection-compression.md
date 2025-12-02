# Story 6.1: Photo Selection & Compression

Status: drafted

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

- [ ] **Task 1: Create imageCompressionService** (AC: 6.1.4, 6.1.5, 6.1.6, 6.1.7, 6.1.9)
  - [ ] Create `src/services/imageCompressionService.ts`
  - [ ] Implement `compressImage(file: File): Promise<CompressionResult>` using Canvas API
  - [ ] Calculate max dimensions (2048px longest side) while preserving aspect ratio
  - [ ] Export to JPEG at 80% quality via `canvas.toBlob()`
  - [ ] Implement EXIF stripping (Canvas redraw removes EXIF metadata)
  - [ ] Add performance timing for compression benchmark (< 3s target)
  - [ ] Return `CompressionResult` with blob, dimensions, originalSize, compressedSize

- [ ] **Task 2: Create PhotoUploader component foundation** (AC: 6.1.1, 6.1.2, 6.1.3, 6.1.10)
  - [ ] Create `src/components/photos/PhotoUploader.tsx`
  - [ ] Add file input with `accept="image/jpeg,image/png,image/webp"`
  - [ ] Add `capture="environment"` attribute for mobile camera access
  - [ ] Implement file size validation (reject > 25MB raw)
  - [ ] Display user-friendly error message for oversized files
  - [ ] Show image preview using `URL.createObjectURL()`
  - [ ] Clean up object URLs on component unmount to prevent memory leaks

- [ ] **Task 3: Integrate compression with uploader** (AC: 6.1.4-6.1.8)
  - [ ] Call `compressImage()` on file selection
  - [ ] Show compression progress/status indicator
  - [ ] Handle compression failure gracefully (fallback to original if < 10MB)
  - [ ] Show error if original > 10MB and compression fails
  - [ ] Store compressed blob for upload (next story)

- [ ] **Task 4: Add useImageCompression hook** (AC: 6.1.4-6.1.9)
  - [ ] Create `src/hooks/useImageCompression.ts`
  - [ ] Wrap compression service with React state management
  - [ ] Track compression status: `idle`, `compressing`, `complete`, `error`
  - [ ] Expose: `compress(file)`, `result`, `isCompressing`, `error`

- [ ] **Task 5: Write unit tests for imageCompressionService** (AC: All)
  - [ ] Create `tests/unit/services/imageCompressionService.test.ts`
  - [ ] Test dimension reduction (> 2048px → max 2048px)
  - [ ] Test aspect ratio preservation
  - [ ] Test JPEG format output
  - [ ] Test compression timing (mock performance.now())
  - [ ] Test fallback behavior on compression failure
  - [ ] Test file type validation

- [ ] **Task 6: Write component tests for PhotoUploader** (AC: 6.1.1-6.1.3, 6.1.10)
  - [ ] Create `tests/unit/components/PhotoUploader.test.tsx`
  - [ ] Test file input accepts only valid image types
  - [ ] Test file size rejection for > 25MB
  - [ ] Test preview display after selection
  - [ ] Test camera option via capture attribute
  - [ ] Test error message display

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

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-11-26 | 0.1.0 | Story drafted via create-story workflow |
