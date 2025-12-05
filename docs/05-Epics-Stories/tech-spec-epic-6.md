# Epic Technical Specification: Photo Gallery & Memories

Date: 2025-11-25
Author: Frank
Epic ID: 6
Status: Draft

---

## Overview

Photo Gallery & Memories is the final MVP epic that enables partners to share and preserve memorable moments through photos. This epic delivers a complete photo management experience including Supabase Storage bucket configuration, client-side image compression for optimal storage efficiency, upload with progress feedback, a responsive gallery grid view, and a full-screen photo viewer with gesture support (swipe, pinch-to-zoom). The feature transforms the relationship tracker from a communication tool into a shared memory archive.

The implementation builds upon the stable foundation established in Epic 0 (Deployment & Backend Infrastructure), Epic 1 (PWA Foundation), Epic 2 (Love Notes), and leverages the existing Supabase client configuration, authentication flow, and session management. Photos are stored in Supabase Storage (S3-compatible) with Row Level Security ensuring only partners can access shared photos.

**Key Value Proposition:** Partners can capture and share meaningful moments instantly, building a private visual timeline of their relationship accessible from any device.

## Objectives and Scope

**In Scope:**
- Create Supabase Storage bucket `photos` with appropriate RLS policies
- Create `photos` metadata table in Supabase database with RLS
- Build photo selection interface (device gallery picker or camera)
- Implement client-side image compression using browser Canvas API
- Build upload workflow with real-time progress indicator
- Create photo gallery grid view (3-column responsive layout)
- Implement lazy loading for gallery thumbnails (intersection observer)
- Build full-screen photo viewer with gesture support (swipe, pinch-to-zoom)
- Add caption input during upload (optional, max 500 chars)
- Implement photo deletion with confirmation dialog
- Display upload date and caption on photo detail view
- Handle storage quota warnings (80%+ usage notification)

**Out of Scope:**
- Push notifications for new photos (can use existing notification infrastructure later)
- Photo albums or categories (post-MVP organizational feature)
- Photo editing (cropping, filters, adjustments) - MVP shows photos as uploaded
- Shared photo albums with other users (two-partner only)
- Video uploads (MVP is photo-only)
- Photo comments or reactions (can be added in future iteration)
- Automatic backup/sync from device photo roll
- Offline photo uploads (online-first architecture per PRD)

## System Architecture Alignment

This epic aligns with the established architecture (Architecture v2.0):

**Component Integration:**
- **Storage Layer:** Supabase Storage bucket `photos` for binary files
- **Data Layer:** `photos` metadata table in Supabase PostgreSQL with RLS
- **State Management:** Zustand store (`photosSlice.ts`) - already defined in architecture
- **UI Components:** `src/components/photos/*` (PhotoThumbnail, PhotoViewer, PhotoUploader, PhotoGallery)
- **Services:** `src/services/photoService.ts` for Supabase Storage operations
- **Hooks:** `src/hooks/usePhotos.ts` for component state access

**Architecture Constraints:**
- Online-first pattern: Photo uploads require network connectivity (no offline queue for uploads)
- Client-side compression: Reduce file size before upload to optimize storage and bandwidth
- Lazy loading: Only fetch thumbnails visible in viewport (intersection observer)
- Storage quotas: Supabase free tier has 1GB storage; implement 80%/95% warning thresholds
- File size limits: Max 10MB per photo after compression; reject larger files
- Supported formats: JPEG, PNG, WebP (convert to JPEG on upload for consistency)
- URL signing: Use signed URLs with 1-hour expiry for private photo access

**FR Mapping:**
| FR | Requirement | Implementation |
|----|-------------|----------------|
| FR16 | Upload photos from device | Story 6-1, 6-2: File picker + upload service |
| FR17 | Client-side compression before upload | Story 6-1: Canvas API compression to JPEG |
| FR18 | View photo gallery grid | Story 6-3: PhotoGallery with 3-column layout |
| FR19 | Full-screen viewer with gestures | Story 6-4: PhotoViewer with pinch/swipe |
| FR20 | Add caption and tags to photos | Story 6-2: Caption input (tags deferred) |
| FR21 | Delete photos with confirmation | Story 6-4: Delete action in viewer |
| FR22 | Photos visible only to partners | Story 6-0: RLS policies on storage + table |

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| `src/lib/supabase.ts` | Supabase client singleton | Environment variables | Configured Supabase client | Epic 0/1 |
| `src/services/photoService.ts` | Photo CRUD operations with Supabase Storage | File, metadata | Upload result, signed URLs | Story 6-0, 6-2 |
| `src/services/imageCompressionService.ts` | Client-side image compression | File | Compressed Blob + dimensions | Story 6-1 |
| `src/stores/slices/photosSlice.ts` | Photo state management | User actions | State updates, API calls | Story 6-2 |
| `src/hooks/usePhotos.ts` | Hook for components to consume state | Component context | photos, isLoading, uploadPhoto | Story 6-2 |
| `src/components/photos/PhotoGallery.tsx` | Grid gallery container | Photos array | Responsive thumbnail grid | Story 6-3 |
| `src/components/photos/PhotoThumbnail.tsx` | Single thumbnail item | Photo data | Lazy-loaded thumbnail | Story 6-3 |
| `src/components/photos/PhotoViewer.tsx` | Full-screen viewer with gestures | Selected photo | Swipeable, zoomable viewer | Story 6-4 |
| `src/components/photos/PhotoUploader.tsx` | Upload UI with progress | File input | Progress indicator, preview | Story 6-2 |
| `src/pages/Photos.tsx` | Photos page container | Route params | Complete gallery interface | Story 6-3 |

### Data Models and Contracts

**Database Schema (Supabase/PostgreSQL):**

```sql
-- photos metadata table
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
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT valid_mime_type CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'))
);

-- Performance indexes
CREATE INDEX idx_photos_user_created ON photos (user_id, created_at DESC);
CREATE INDEX idx_photos_storage_path ON photos (storage_path);

-- Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Users can view their own photos
CREATE POLICY "Users can view own photos"
  ON photos FOR SELECT
  USING (auth.uid() = user_id);

-- Partners can view each other's photos
CREATE POLICY "Partners can view partner photos"
  ON photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.partner_id = photos.user_id
    )
  );

-- Users can insert their own photos
CREATE POLICY "Users can insert own photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos"
  ON photos FOR DELETE
  USING (auth.uid() = user_id);
```

**Supabase Storage Bucket Configuration:**

```sql
-- Create photos bucket (via Supabase Dashboard or API)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false);

-- Storage RLS policies
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Partners can view partner photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.partner_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**TypeScript Types:**

```typescript
// src/types/models.ts
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
  // Client-side computed
  thumbnailUrl?: string;
  fullUrl?: string;
}

export interface PhotoUploadInput {
  file: File;
  caption?: string;
}

export interface PhotosState {
  photos: Photo[];
  isLoading: boolean;
  error: string | null;
  storageWarning: string | null;
  selectedPhotoId: string | null;
  hasMore: boolean;
  // Actions
  loadPhotos: (page?: number) => Promise<void>;
  uploadPhoto: (input: PhotoUploadInput) => Promise<Photo>;
  deletePhoto: (photoId: string) => Promise<void>;
  selectPhoto: (photoId: string) => void;
  clearSelection: () => void;
  getStorageUsage: () => Promise<{ used: number; quota: number; percent: number }>;
  clearStorageWarning: () => void;
}

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}
```

### APIs and Interfaces

**Supabase Storage Operations:**

| Operation | Method | Request | Response | Error Codes |
|-----------|--------|---------|----------|-------------|
| Upload photo | `supabase.storage.from('photos').upload()` | `{ path, file, options }` | `{ data: { path }, error }` | 413 (too large), 403 (forbidden) |
| Get signed URL | `supabase.storage.from('photos').createSignedUrl()` | `{ path, expiresIn }` | `{ data: { signedUrl }, error }` | 404 (not found) |
| Delete photo | `supabase.storage.from('photos').remove()` | `[path]` | `{ data, error }` | 404 (not found) |
| List files | `supabase.storage.from('photos').list()` | `{ path, options }` | `{ data: FileObject[], error }` | 403 (forbidden) |

**Database Operations:**

| Operation | Method | Request | Response | Error Codes |
|-----------|--------|---------|----------|-------------|
| Insert metadata | `supabase.from('photos').insert()` | Photo metadata | `{ data: Photo, error }` | 23505 (duplicate) |
| Fetch photos | `supabase.from('photos').select()` | Filter, pagination | `{ data: Photo[], error }` | PGRST301 (connection) |
| Delete metadata | `supabase.from('photos').delete()` | Photo ID | `{ data, error }` | 404 (not found) |

### Workflows and Sequencing

**Photo Upload Flow:**
```
1. User taps "+" button → PhotoUploader opens
2. Select photo source → Camera OR Gallery picker
3. File selected → Validate type (JPEG/PNG/WebP) and size (< 25MB raw)
4. Show preview → Display image with caption input
5. User enters optional caption → Max 500 chars
6. User taps "Upload" → Start upload workflow
7. Compress image → Canvas API → Target 80% quality, max 2048px dimension
8. Check storage quota → If > 95%, reject with error
9. Generate storage path → `{user_id}/{uuid}.jpg`
10. Upload to Supabase Storage → Show progress bar (0-100%)
11. Insert metadata → Create photos table row
12. If > 80% quota → Show storage warning toast
13. Add to local state → Optimistic update (already uploaded)
14. Close uploader → Show success toast
15. Gallery refreshes → New photo at top
```

**Gallery Load Flow:**
```
1. Photos page mounts → loadPhotos() called
2. Fetch own photos + partner photos → Two queries with union
3. Sort by created_at DESC → Newest first
4. Generate thumbnail URLs → Signed URLs with 1hr expiry
5. Render grid → 3-column layout with aspect ratio boxes
6. Lazy load images → IntersectionObserver for viewport
7. User scrolls → Load more as needed (pagination)
8. User taps thumbnail → selectPhoto(id) → PhotoViewer opens
```

**Photo Viewer Flow:**
```
1. User taps thumbnail → PhotoViewer modal opens
2. Load full-resolution image → Signed URL
3. Display with gestures enabled:
   - Swipe left/right → Navigate photos
   - Pinch to zoom → Scale transform (0.5x - 3x)
   - Double tap → Toggle zoom (fit vs 2x)
   - Swipe down → Close viewer
4. Show caption + date → Overlay at bottom
5. Delete button → Confirmation dialog
6. Confirm delete → Remove from storage + database + state
7. Navigate to next photo → Or close if last photo
```

**Compression Algorithm:**
```
1. Load image into Image element
2. Create canvas at target dimensions:
   - If width > 2048: scale to 2048px width, proportional height
   - If height > 2048: scale to 2048px height, proportional width
   - Else: use original dimensions
3. Draw image to canvas
4. Export as JPEG at 80% quality
5. Return compressed Blob + dimensions
6. Calculate compression ratio for logging
```

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Photo compression time | < 3s for 10MB image | Client-side profiling |
| Upload progress responsiveness | Updates every 100ms | Progress callback frequency |
| Gallery initial load (20 thumbnails) | < 1s | Network + render profiling |
| Thumbnail lazy load (per batch) | < 500ms | IntersectionObserver timing |
| Full-resolution image load | < 2s on 4G | Network timing |
| Photo viewer gesture response | < 16ms (60fps) | Frame rate profiling |
| Gallery scroll performance | 60fps with 100+ photos | Chrome DevTools Performance |
| Memory usage (50 photos loaded) | < 150MB | Browser Memory panel |

Source: NFR-P4 (Photo Upload Performance), NFR-P6 (Memory Usage)

### Security

| Requirement | Implementation | Validation |
|-------------|----------------|------------|
| Storage bucket private | `public: false` on bucket creation | Attempt unauthenticated access |
| RLS on photos table | Policies for SELECT/INSERT/DELETE | Query as unauthorized user |
| RLS on storage objects | Folder-based user_id validation | Cross-user access attempt |
| Signed URL expiry | 1-hour expiry for all URLs | Attempt access with expired URL |
| File type validation | Client + server mime type check | Upload malformed file |
| File size limits | Max 10MB after compression | Upload oversized file |
| EXIF stripping | Remove metadata before upload | Check uploaded file for EXIF |
| Caption XSS prevention | Sanitize caption on display | Input XSS payload |

Source: NFR-S3 (Data at Rest Protection), NFR-S5 (Input Validation)

### Reliability/Availability

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| Network loss during upload | Cancel upload, show error | Manual retry button |
| Partial upload (storage success, DB fail) | Rollback storage upload | Automatic cleanup |
| Signed URL expired | Regenerate URL on access | Transparent to user |
| Gallery load failure | Show error state | Pull-to-refresh retry |
| Compression failure | Fall back to original (if < 10MB) | Error toast if too large |
| Storage quota exceeded | Reject upload with clear message | Suggest deleting old photos |
| Browser tab backgrounding | Pause upload, resume on focus | Resume logic |

Source: NFR-R1 (Error Tolerance), NFR-R2 (Data Integrity)

### Observability

| Signal | Type | Purpose |
|--------|------|---------|
| `photo.upload.started` | Event log | Track upload attempts |
| `photo.upload.progress` | Metric | Monitor upload progress |
| `photo.upload.completed` | Event log | Track successful uploads |
| `photo.upload.failed` | Error log | Capture upload failures with context |
| `photo.compression.ratio` | Metric | Track compression effectiveness |
| `photo.deleted` | Event log | Track photo deletions |
| `storage.quota.warning` | Warning log | Track when users approach quota |
| `signed_url.generated` | Debug log | Track URL generation frequency |

Implementation: Console logging in development, structured logger for future analytics.

## Dependencies and Integrations

| Dependency | Version | Purpose | Constraint |
|------------|---------|---------|------------|
| @supabase/supabase-js | ^2.81.1 | Storage, Database, Auth | Already installed, compatible |
| zustand | ^5.0.8 | State management | Already installed, compatible |
| framer-motion | ^12.23.24 | Gesture handling (pinch, swipe) | Already installed, use for viewer |
| lucide-react | ^0.554.0 | Icons (camera, upload, trash) | Already installed |
| react | ^19.1.1 | UI framework | Already installed |

**No New Dependencies Required** - All functionality achievable with existing packages:
- **Image compression**: Native Canvas API (no library needed)
- **Gesture handling**: framer-motion already installed (useGesture hook alternative)
- **Lazy loading**: Native IntersectionObserver API
- **File picker**: Native HTML input[type=file] with accept attribute

**Integration Points:**
- **Supabase Auth:** Requires authenticated session for all photo operations
- **Supabase Storage:** `photos` bucket for binary file storage
- **Supabase Database:** `photos` table for metadata with RLS
- **Zustand Store:** `photosSlice` for client-side state management
- **Profiles Table:** Partner relationship for cross-user photo access

**Epic Dependencies:**
- **Epic 0:** Supabase project configuration, environment variables
- **Epic 1:** Authentication flow, session management, error handling patterns
- **Partner Pairing (Story 0-3):** `profiles.partner_id` for partner photo access

## Acceptance Criteria (Authoritative)

### Story 6-0: Photo Storage Schema & Buckets Setup
1. **AC 6.0.1:** Supabase Storage bucket `photos` exists with `public: false`
2. **AC 6.0.2:** `photos` metadata table exists with columns: id, user_id, storage_path, filename, caption, mime_type, file_size, width, height, created_at
3. **AC 6.0.3:** RLS policy allows users to SELECT only their own photos
4. **AC 6.0.4:** RLS policy allows partners to SELECT each other's photos (via profiles.partner_id)
5. **AC 6.0.5:** RLS policy allows users to INSERT photos only with their own user_id
6. **AC 6.0.6:** RLS policy allows users to DELETE only their own photos
7. **AC 6.0.7:** Storage RLS policy restricts uploads to user's own folder (`{user_id}/`)
8. **AC 6.0.8:** Storage RLS policy allows users to read their own photos
9. **AC 6.0.9:** Storage RLS policy allows partners to read each other's photos
10. **AC 6.0.10:** Indexes exist on (user_id, created_at) for efficient queries

### Story 6-1: Photo Selection & Compression
11. **AC 6.1.1:** File picker accepts only image types: JPEG, PNG, WebP
12. **AC 6.1.2:** Files larger than 25MB raw are rejected with error message
13. **AC 6.1.3:** Selected image displays in preview before upload
14. **AC 6.1.4:** Compression reduces image to max 2048px on longest dimension
15. **AC 6.1.5:** Compression targets 80% JPEG quality
16. **AC 6.1.6:** Compressed output is always JPEG format
17. **AC 6.1.7:** Compression completes in < 3 seconds for 10MB input
18. **AC 6.1.8:** If compression fails, original file used if < 10MB
19. **AC 6.1.9:** EXIF metadata stripped during compression (privacy)
20. **AC 6.1.10:** Camera option available on mobile devices

### Story 6-2: Photo Upload with Progress Indicator
21. **AC 6.2.1:** Upload button disabled until photo selected
22. **AC 6.2.2:** Progress bar shows 0-100% during upload
23. **AC 6.2.3:** Progress updates at least every 100ms
24. **AC 6.2.4:** Caption input field accepts max 500 characters
25. **AC 6.2.5:** Character counter shows "X/500" for caption
26. **AC 6.2.6:** Upload creates storage file at `{user_id}/{uuid}.jpg`
27. **AC 6.2.7:** Upload creates metadata row in photos table
28. **AC 6.2.8:** Success toast displays on upload completion
29. **AC 6.2.9:** Error toast displays on upload failure with retry option
30. **AC 6.2.10:** If storage quota > 80%, warning toast displays
31. **AC 6.2.11:** If storage quota > 95%, upload rejected with error
32. **AC 6.2.12:** Upload modal closes on success, gallery shows new photo
33. **AC 6.2.13:** Network error during upload shows retry button

### Story 6-3: Photo Gallery Grid View
34. **AC 6.3.1:** Gallery displays photos in 3-column responsive grid
35. **AC 6.3.2:** Photos sorted by created_at DESC (newest first)
36. **AC 6.3.3:** Gallery shows both user's photos AND partner's photos
37. **AC 6.3.4:** Thumbnails use signed URLs with 1-hour expiry
38. **AC 6.3.5:** Thumbnails lazy load as user scrolls (IntersectionObserver)
39. **AC 6.3.6:** Loading skeleton displays while thumbnails load
40. **AC 6.3.7:** Tapping thumbnail opens PhotoViewer at that photo
41. **AC 6.3.8:** Empty state displays "No photos yet" with upload prompt
42. **AC 6.3.9:** Pull-to-refresh reloads gallery
43. **AC 6.3.10:** Gallery maintains 60fps scroll with 100+ photos
44. **AC 6.3.11:** Photos show small badge indicating owner (You/Partner)

### Story 6-4: Full-Screen Photo Viewer with Gestures
45. **AC 6.4.1:** Viewer displays full-resolution photo
46. **AC 6.4.2:** Swipe left/right navigates between photos
47. **AC 6.4.3:** Pinch gesture zooms photo (0.5x to 3x range)
48. **AC 6.4.4:** Double tap toggles between fit-to-screen and 2x zoom
49. **AC 6.4.5:** Swipe down closes viewer
50. **AC 6.4.6:** Caption displays at bottom of viewer (if exists)
51. **AC 6.4.7:** Upload date displays in friendly format ("Nov 25, 2025")
52. **AC 6.4.8:** Delete button visible only on user's own photos
53. **AC 6.4.9:** Delete requires confirmation dialog
54. **AC 6.4.10:** Delete removes from storage + database + local state
55. **AC 6.4.11:** After delete, viewer navigates to next photo (or closes if last)
56. **AC 6.4.12:** X button in corner closes viewer
57. **AC 6.4.13:** Gesture animations run at 60fps

## Traceability Mapping

| AC | Spec Section | Component(s) | Test Idea |
|----|--------------|--------------|-----------|
| AC 6.0.1 | Data Models | Supabase SQL migration | Verify bucket exists, public=false |
| AC 6.0.2 | Data Models | Supabase SQL migration | Verify table schema matches spec |
| AC 6.0.3-6 | Data Models | RLS policies | Query as user, partner, third-party |
| AC 6.0.7-9 | Data Models | Storage RLS policies | Upload/read as different users |
| AC 6.0.10 | Data Models | SQL indexes | Explain query plan on photo fetch |
| AC 6.1.1 | Services | PhotoUploader | Upload non-image, verify rejection |
| AC 6.1.2 | Services | PhotoUploader | Upload 30MB file, verify rejection |
| AC 6.1.3 | Workflows | PhotoUploader | Visual test: preview displays |
| AC 6.1.4-6 | Services | imageCompressionService | Unit test: verify output dimensions + format |
| AC 6.1.7 | Performance | imageCompressionService | Perf test: time 10MB compression |
| AC 6.1.8 | Workflows | imageCompressionService | Mock compression failure, verify fallback |
| AC 6.1.9 | Security | imageCompressionService | Upload with EXIF, verify stripped |
| AC 6.1.10 | Services | PhotoUploader | E2E: verify camera option on mobile UA |
| AC 6.2.1-3 | Workflows | PhotoUploader | E2E: upload flow with progress |
| AC 6.2.4-5 | Services | PhotoUploader | Unit test: caption validation |
| AC 6.2.6-7 | Workflows | photoService | Integration: verify storage path + DB row |
| AC 6.2.8-9 | Workflows | PhotoUploader | E2E: success/error toast display |
| AC 6.2.10-11 | Workflows | photosSlice | Unit test: quota thresholds |
| AC 6.2.12 | Workflows | PhotoUploader | E2E: modal closes, gallery updates |
| AC 6.2.13 | Reliability | PhotoUploader | E2E: simulate network error, retry |
| AC 6.3.1 | Services | PhotoGallery | Visual test: 3-column grid layout |
| AC 6.3.2 | Services | photosSlice | Unit test: sort order |
| AC 6.3.3 | Workflows | photosSlice, usePhotos | Integration: fetch user + partner photos |
| AC 6.3.4 | APIs | photoService | Unit test: URL generation + expiry |
| AC 6.3.5-6 | Services | PhotoThumbnail | E2E: verify lazy load behavior |
| AC 6.3.7 | Workflows | PhotoGallery | E2E: tap thumbnail opens viewer |
| AC 6.3.8 | Services | PhotoGallery | E2E: empty state display |
| AC 6.3.9 | Workflows | PhotoGallery | E2E: pull-to-refresh functionality |
| AC 6.3.10 | Performance | PhotoGallery | Perf test: scroll 100+ photos at 60fps |
| AC 6.3.11 | Services | PhotoThumbnail | Visual test: owner badge display |
| AC 6.4.1 | Services | PhotoViewer | E2E: full-res image loads |
| AC 6.4.2-5 | Services | PhotoViewer (gestures) | Manual test: gesture interactions |
| AC 6.4.6-7 | Services | PhotoViewer | Visual test: caption + date display |
| AC 6.4.8 | Security | PhotoViewer | E2E: delete button visibility by owner |
| AC 6.4.9-11 | Workflows | PhotoViewer, photosSlice | E2E: delete flow + navigation |
| AC 6.4.12 | Services | PhotoViewer | E2E: close button functionality |
| AC 6.4.13 | Performance | PhotoViewer | Perf test: gesture animations 60fps |

## Risks, Assumptions, Open Questions

| Type | Item | Mitigation/Next Step |
|------|------|---------------------|
| **Risk** | Supabase Storage free tier limited to 1GB | Implement quota monitoring; warn at 80%; consider paid tier for heavy users |
| **Risk** | Large images may cause memory pressure on mobile | Aggressive compression (2048px max); lazy loading; unload off-screen images |
| **Risk** | Canvas API compression inconsistent across browsers | Test on Chrome, Safari, Firefox; provide fallback for edge cases |
| **Risk** | Gesture library conflicts with existing framer-motion usage | Use framer-motion's built-in gesture support; avoid mixing libraries |
| **Risk** | Signed URLs may expire while user is viewing gallery | Implement URL refresh logic; regenerate on 403 errors |
| **Risk** | Upload interruption causes orphaned storage files | Implement cleanup: delete storage file if DB insert fails |
| **Risk** | iOS Safari file picker may have limitations | Test thoroughly on iOS; document known issues |
| **Assumption** | Partner relationship established via Epic 0-3 | Verify `profiles.partner_id` exists and is set before Epic 6 |
| **Assumption** | Supabase Storage bucket RLS works as documented | Test RLS policies before implementing client code |
| **Assumption** | 10MB compressed limit is sufficient for photo quality | Can adjust compression quality/dimensions if needed |
| **Assumption** | 1-hour signed URL expiry balances security vs UX | Monitor for user complaints; extend if needed |
| **Assumption** | framer-motion can handle pinch-to-zoom gestures | Prototype gesture handling early; research alternatives if issues |
| **Question** | Should we generate thumbnails server-side for better performance? | Recommend: No for MVP; use signed URLs + lazy load; optimize later if needed |
| **Question** | Should we implement image caching in service worker? | Recommend: Yes; cache thumbnails aggressively; full images less so |
| **Question** | How to handle photo orientation from mobile cameras? | Recommend: Canvas compression normalizes orientation; test with rotated photos |
| **Question** | Should we show storage usage to users proactively? | Recommend: Yes; add settings page with "X MB of 1GB used" display |
| **Question** | What happens when partner is unpaired - hide their photos? | Recommend: Keep photos accessible; they're shared memories. Document decision. |

## Test Strategy Summary

**Test Levels:**

1. **Unit Tests (Vitest):**
   - `imageCompressionService`: compression dimensions, quality, format conversion, EXIF stripping
   - `photoService`: storage path generation, signed URL creation, metadata operations
   - `photosSlice`: state actions, quota calculations, optimistic updates
   - Caption validation: max length, character handling
   - File type validation: MIME type checking, size limits

2. **Integration Tests (Vitest):**
   - `usePhotos` hook: state management with mocked Supabase
   - Photo upload flow: compression → storage → database
   - Gallery load: fetch user + partner photos with pagination
   - RLS policy verification: queries as different user roles
   - Error handling: network failures, rollback logic

3. **E2E Tests (Playwright):**
   - Full upload flow: select → compress → upload → gallery refresh
   - Gallery navigation: scroll, lazy load, tap to view
   - Photo viewer: open, navigate, close, delete
   - Error states: network failure handling, retry functionality
   - Cross-browser: Chrome, Safari, Firefox

4. **Manual/Exploratory Tests:**
   - Gesture interactions: pinch-to-zoom, swipe navigation, double-tap
   - Mobile device testing: iOS Safari, Android Chrome
   - Camera capture flow on mobile
   - Large photo handling (10MB+ files)
   - Performance under load (100+ photos)

**Coverage Targets:**
- Services (photoService, compressionService): 100%
- Zustand store actions: 100%
- Component rendering logic: 90%
- API integration paths: 100%
- Error handling paths: 90%

**Edge Cases:**
- Empty gallery state
- Single photo (no navigation arrows)
- Maximum caption length (500 chars)
- File type rejection (video, PDF, etc.)
- Oversized file rejection (> 25MB raw, > 10MB compressed)
- Compression failure fallback
- Network timeout during upload
- Storage quota exceeded
- Partner photo access after unpairing
- Expired signed URL handling
- Very long captions with special characters/emoji
- Portrait vs landscape orientation handling
- Simultaneous uploads (if user taps upload twice quickly)

**Performance Benchmarks:**
- Compression: < 3s for 10MB image
- Gallery load: < 1s for 20 thumbnails
- Scroll: 60fps with 100+ photos
- Gesture response: < 16ms latency
- Upload progress: updates every 100ms
