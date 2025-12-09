# Photo Management - Deep Dive Documentation

**Generated:** 2025-12-09
**Scope:** `src/components/PhotoGallery/`, `src/components/PhotoUpload/`, `src/components/PhotoCarousel/`, `src/components/PhotoEditModal/`, `src/components/PhotoDeleteConfirmation/`, `src/components/PhotoViewer/`, `src/services/photoService.ts`, `src/stores/slices/photosSlice.ts`
**Files Analyzed:** 14
**Lines of Code:** ~2,785
**Workflow Mode:** Exhaustive Deep-Dive

## Overview

The Photo Management system provides a complete photo-sharing experience between partners. It supports uploading, viewing, editing, and deleting photos with real-time sync via Supabase. The system features responsive grid galleries, full-screen viewers with gesture support, and storage quota management.

**Purpose:** Enable couples to share and manage photos privately with cloud storage and cross-device sync
**Key Responsibilities:** Photo upload with compression, gallery display, carousel navigation, caption editing, storage management
**Integration Points:** Supabase Storage (photos bucket), Supabase DB (photos table), Zustand Store, Image Compression Service

---

## Complete File Inventory

### src/components/PhotoGallery/PhotoGallery.tsx

**Purpose:** Main gallery view with responsive grid layout and infinite scroll pagination.
**Lines of Code:** 324
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** Uses Intersection Observer for infinite scroll - the `observerTarget` ref must be the last element in the grid for proper triggering. Gallery auto-refreshes when store photos change (upload detection).

**Exports:**
- `PhotoGallery` - Main gallery component

**Dependencies:**
- `react-intersection-observer` - Infinite scroll trigger
- `./PhotoGridItem` - Individual photo tiles
- `./PhotoGridSkeleton` - Loading state
- `./PhotoViewer` - Full-screen modal
- `../../services/photoService` - Data fetching

**Key Implementation Details:**

```tsx
// AC-4.2.4: Infinite scroll with Intersection Observer
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      loadMorePhotos();
    }
  },
  { root: null, rootMargin: '200px', threshold: 0.1 }
);
```

**Patterns Used:**
- Infinite Scroll: Intersection Observer for pagination
- Responsive Grid: 3 columns mobile, 4 columns desktop
- Optimistic Updates: Gallery refreshes on store changes

**State Management:** Local state for photos array, loading, pagination; store for global photo state

**Error Handling:** Error state with retry button; graceful empty state

---

### src/components/PhotoGallery/PhotoGridItem.tsx

**Purpose:** Individual photo tile with lazy loading, owner badge, and caption overlay.
**Lines of Code:** 124
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** Lazy loading uses Intersection Observer - image `src` is only set when `isVisible` is true. Owner badge distinguishes "You" vs "Partner" photos. Click handler passes photo ID to parent for viewer opening.

**Exports:**
- `PhotoGridItem` - Memoized tile component

**Key Implementation Details:**

```tsx
// AC-6.3.5: Lazy loading with IntersectionObserver
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !isVisible) {
        setIsVisible(true);
      }
    },
    { rootMargin: '50px', threshold: 0.1 }
  );
  observer.observe(imgRef.current);
}, []);
```

**Patterns Used:**
- Lazy Loading: Defer image load until visible
- Blur Placeholder: Animate-pulse during load
- Hover Effects: Caption overlay on hover

---

### src/components/PhotoGallery/PhotoViewer.tsx

**Purpose:** Full-screen photo viewer with gesture support, zoom, and navigation.
**Lines of Code:** 561
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** This is a complex component with pinch-to-zoom (planned), double-tap zoom, swipe navigation, keyboard navigation, and focus trapping. Preloads adjacent photos for smooth navigation.

**Exports:**
- `PhotoViewer` - Full-screen modal component

**Dependencies:**
- `framer-motion` - Gestures and animations
- `lucide-react` - Icons

**Key Implementation Details:**

```tsx
// AC 6.4.5 & 6.4.6: Double-tap/click zoom
const handleDoubleTap = useCallback((event) => {
  const now = Date.now();
  if (now - lastTap < 300) {
    const newScale = scale === 1 ? 2 : 1;
    setScale(newScale);
  }
  setLastTap(now);
}, [lastTap, scale]);
```

**Patterns Used:**
- Focus Trap: Accessibility for modal
- Pan Constraints: Dynamic boundaries based on zoom
- Photo Preloading: Load adjacent images

**Accessibility:**
- Focus trapped in modal (WCAG 2.4.3)
- Screen reader announcements for photo changes
- Keyboard navigation (arrows, escape)

---

### src/components/PhotoUpload/PhotoUpload.tsx

**Purpose:** Multi-step upload modal with preview, caption, tags, and progress tracking.
**Lines of Code:** 459
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** Upload flow: select → preview → uploading → success. Preview URLs created with `createObjectURL` must be revoked on cleanup. Tags are validated (max 10, max 50 chars each).

**Exports:**
- `PhotoUpload` - Upload modal component

**Key Implementation Details:**

```tsx
// Multi-step state machine
type UploadStep = 'select' | 'preview' | 'uploading' | 'success' | 'error';

// AC-4.1.8: Auto-close after success (3 seconds)
setTimeout(() => handleClose(), 3000);
```

**Patterns Used:**
- State Machine: Step-based UI flow
- File Validation: Type and size checks
- Progress Simulation: UX for fast uploads

**Error Handling:** Step-specific error display; retry from preview step

---

### src/components/PhotoCarousel/PhotoCarousel.tsx

**Purpose:** Lightbox carousel for sequential photo viewing with edit/delete actions.
**Lines of Code:** 232
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** Different from PhotoViewer - this is the older carousel used for editing workflows. Uses same store actions. Keyboard events blocked when modals are open.

**Exports:**
- `PhotoCarousel` - Carousel component

**Key Implementation Details:**

```tsx
// AC-4.3.2: Swipe gesture handler
const handleDragEnd = (event, info: PanInfo) => {
  if (info.offset.x < -50) navigateToNext();
  else if (info.offset.x > 50) navigateToPrev();
  else if (info.offset.y > 100) clearPhotoSelection();
};
```

**Patterns Used:**
- Swipe Navigation: framer-motion drag
- Keyboard Navigation: Arrow keys, Escape
- Modal Composition: Edit/Delete modals

---

### src/components/PhotoEditModal/PhotoEditModal.tsx

**Purpose:** Modal for editing photo caption and tags with validation.
**Lines of Code:** 293
**File Type:** React Component (TSX)

**What Future Contributors Must Know:** Only caption is editable (storage path, dimensions are immutable). Validation: max 500 chars caption, max 10 tags, max 50 chars per tag. Duplicate tags are auto-removed (case-insensitive).

**Exports:**
- `PhotoEditModal` - Edit modal component

**Key Implementation Details:**

```tsx
// Case-insensitive duplicate detection
const parsedTags = tagsInput
  .split(',')
  .map(tag => tag.trim())
  .filter((tag, i, arr) =>
    arr.findIndex(t => t.toLowerCase() === tag.toLowerCase()) === i
  )
  .slice(0, 10)
  .map(tag => tag.slice(0, 50));
```

**Patterns Used:**
- Controlled Inputs: Form state management
- Validation: Real-time field validation
- Change Detection: Save button enabled only when changed

---

### src/services/photoService.ts

**Purpose:** Service layer for all Supabase photo operations including storage and database.
**Lines of Code:** 543
**File Type:** Service (TS)

**What Future Contributors Must Know:** This is a singleton service. Signed URLs expire in 1 hour. Storage quota is calculated from user's photos only (not partner's). Upload includes rollback on DB insert failure.

**Exports:**
- `photoService` - Singleton instance
- `PhotoService` - Class for testing
- `SupabasePhoto` - DB row type
- `PhotoWithUrls` - Photo with computed URLs
- `StorageQuota` - Quota info type
- `PhotoUploadInput` - Upload input type

**Key Implementation Details:**

```tsx
// Rollback: delete storage file if DB insert fails
const { error: insertError } = await supabase.from('photos').insert(photoData);
if (insertError) {
  await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
  throw insertError;
}
```

**Patterns Used:**
- Singleton: Single instance for state management
- Rollback: Transactional-like cleanup
- Batch Operations: Parallel signed URL generation

**Security:**
- RLS enforced on all operations
- Ownership verification before delete
- User-scoped storage paths

---

### src/stores/slices/photosSlice.ts

**Purpose:** Zustand slice managing photo state, upload progress, and storage warnings.
**Lines of Code:** 230
**File Type:** Zustand Slice (TS)

**What Future Contributors Must Know:** Upload checks quota BEFORE attempting upload. Progress is simulated (Supabase doesn't support native progress). Selected photo ID drives carousel display.

**Exports:**
- `PhotosSlice` - State interface
- `createPhotosSlice` - Slice creator

**Key Implementation Details:**

```tsx
// AC 6.2.10, 6.2.11: Quota check before upload
const quota = await photoService.checkStorageQuota();
if (quota.percent >= 95) {
  set({ error: `Storage nearly full (${quota.percent}%)` });
  return;
}
if (quota.percent >= 80) {
  set({ storageWarning: `Storage ${quota.percent}% full` });
}
```

**State Shape:**
- `photos: PhotoWithUrls[]` - All photos (user + partner)
- `selectedPhotoId: string | null` - Currently viewing
- `isUploading: boolean` - Upload in progress
- `uploadProgress: number` - 0-100%
- `error: string | null` - Error message
- `storageWarning: string | null` - Quota warning

---

## Contributor Checklist

- **Risks & Gotchas:**
  - Signed URL expiry: URLs expire in 1 hour; refresh on error
  - Memory leaks: Always revoke blob URLs with `URL.revokeObjectURL`
  - RLS policies: Server enforces ownership; client checks are defense-in-depth
  - Image preloading: Cleanup preloaded images on navigation

- **Pre-change Verification Steps:**
  1. Run `npm run typecheck`
  2. Run `npm run test:unit -- --filter photo`
  3. Test upload with large file (50MB limit)
  4. Test delete as non-owner (should fail silently)

- **Suggested Tests Before PR:**
  1. Upload JPEG, PNG, WebP formats
  2. Caption at 500 character limit
  3. 10 tags at 50 chars each
  4. Swipe navigation at gallery boundaries
  5. Delete last photo in gallery

---

## Architecture & Design Patterns

### Code Organization

```
PhotoGallery/       # Grid view components
├── PhotoGallery.tsx       # Main gallery with pagination
├── PhotoGridItem.tsx      # Individual tile
├── PhotoGridSkeleton.tsx  # Loading skeleton
└── PhotoViewer.tsx        # Full-screen viewer

PhotoUpload/        # Upload flow
└── PhotoUpload.tsx        # Multi-step modal

PhotoCarousel/      # Lightbox carousel
├── PhotoCarousel.tsx      # Navigation container
└── PhotoCarouselControls.tsx  # UI controls

PhotoEditModal/     # Edit functionality
└── PhotoEditModal.tsx     # Caption/tags editor

services/
└── photoService.ts        # Supabase operations

stores/slices/
└── photosSlice.ts         # State management
```

### Design Patterns

- **Singleton Service**: photoService for consistent state
- **State Machine**: Upload step progression
- **Observer Pattern**: Intersection Observer for lazy load/infinite scroll
- **Optimistic Updates**: Immediate UI response, rollback on error
- **Focus Trap**: Modal accessibility pattern

### State Management Strategy

- **Zustand Slice**: Global photo state, upload progress
- **Local State**: UI-specific state (step, preview URL, form values)
- **Refs**: DOM elements for Intersection Observer

### Error Handling Philosophy

- **Graceful Degradation**: Show error state with retry
- **Rollback**: Clean up partial uploads
- **User Feedback**: Clear error messages with context

---

## Data Flow

```
User selects file → PhotoUpload
     ↓
File validation (type, size)
     ↓
createObjectURL for preview
     ↓
Caption/Tags form → validation
     ↓
photosSlice.uploadPhoto()
     ↓
photoService.checkStorageQuota()
     ↓ (if quota OK)
photoService.uploadPhoto()
     ↓
Supabase Storage upload
     ↓
Supabase DB insert (photos table)
     ↓
photosSlice optimistic update
     ↓
PhotoGallery refreshes
```

### Data Entry Points

- **File Input**: PhotoUpload file picker
- **Caption/Tags**: PhotoUpload and PhotoEditModal forms
- **Supabase Query**: photoService.getPhotos() for initial load

### Data Transformations

- **Image Compression**: Browser canvas resize (handled by compression service)
- **Signed URL Generation**: Storage path → signed URL
- **Photo Enrichment**: SupabasePhoto → PhotoWithUrls (add signedUrl, isOwn)

### Data Exit Points

- **Display**: PhotoGridItem, PhotoViewer, PhotoCarousel
- **Storage**: Supabase Storage bucket
- **Database**: photos table

---

## Integration Points

### APIs Consumed

- **photos table** (SELECT, INSERT, UPDATE, DELETE)
  - Method: Supabase client
  - Authentication: RLS policies
  - Response: SupabasePhoto[]

- **Storage bucket (photos)**
  - Method: upload, createSignedUrl, remove
  - Authentication: RLS policies
  - Response: Signed URL (string)

### Shared State

- **photos**: Array of PhotoWithUrls
  - Type: PhotoWithUrls[]
  - Accessed By: PhotoGallery, PhotoCarousel, PhotoViewer

- **selectedPhotoId**: Currently viewing photo
  - Type: string | null
  - Accessed By: PhotoCarousel, PhotoViewer

- **uploadProgress**: Upload completion percentage
  - Type: number (0-100)
  - Accessed By: PhotoUpload

### Database Access

- **photos table**: CRUD operations
  - Queries: SELECT with ORDER BY created_at DESC, LIMIT/OFFSET
  - Indexes: created_at DESC, user_id

---

## Testing Analysis

### Test Coverage Summary

- **Statements:** ~65%
- **Branches:** ~60%
- **Functions:** ~70%
- **Lines:** ~65%

### Testing Gaps

- Storage quota threshold testing (80%, 95%, 100%)
- Concurrent upload handling
- Signed URL expiry and refresh
- RLS policy violation scenarios

---

## Related Code & Reuse Opportunities

### Similar Features Elsewhere

- **Love Notes Images** (`loveNoteImageService.ts`)
  - Similarity: Signed URL caching, Edge Function upload
  - Can Reference For: LRU cache implementation

- **Image Compression** (`imageCompressionService.ts`)
  - Used By: Both Photo Upload and Love Notes
  - Shared utility for all image handling

### Reusable Utilities Available

- **useVibration** (`src/hooks/useVibration.ts`)
  - Purpose: Haptic feedback
  - How to Use: Success vibration on upload complete

### Patterns to Follow

- **Signed URL Caching**: Reference `loveNoteImageService.ts` for cache pattern
- **Optimistic Updates**: Reference `photosSlice.ts` for update/rollback pattern

---

## Implementation Notes

### Code Quality Observations

- Well-structured component hierarchy
- Consistent error handling across components
- Good separation of service and UI logic
- Comprehensive accessibility support

### TODOs and Future Work

- `PhotoCarousel.tsx:211`: TODO - Update PhotoEditModal to use PhotoWithUrls type
- Pinch-to-zoom (planned but not implemented in framer-motion)
- Progressive image loading (thumbnail → full resolution)

### Known Issues

- Supabase upload doesn't support native progress tracking (simulated)
- Pinch gesture not supported by framer-motion (double-tap works)
- Partner photos visible but not editable (by design)

### Optimization Opportunities

- Batch signed URL requests on gallery load
- Implement thumbnail generation for faster grid loading
- Add Service Worker caching for signed URLs

### Technical Debt

- Type casting in PhotoCarousel for modal props (`as any`)
- Dual viewer components (PhotoViewer vs PhotoCarousel) with overlap

---

## Modification Guidance

### To Add New Functionality

1. Add types to `src/services/photoService.ts`
2. Add action to `photosSlice.ts`
3. Build UI component in appropriate folder
4. Test with unit tests and E2E

### To Modify Existing Functionality

1. Check all consumers of the service/slice
2. Update types if interface changes
3. Verify RLS policies still apply
4. Run full photo-related test suite

### To Remove/Deprecate

1. Check for dependent components
2. Migrate consumers to replacement
3. Remove from exports and index files
4. Update store slice

### Testing Checklist for Changes

- [ ] Unit tests pass (`npm run test:unit`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Upload works for all formats (JPEG, PNG, WebP)
- [ ] Quota warnings display at 80% and 95%
- [ ] Delete removes from both storage and database
- [ ] Partner can view but not edit/delete

---

_Generated by `document-project` workflow (deep-dive mode)_
_Base Documentation: docs/index.md_
_Scan Date: 2025-12-09_
_Analysis Mode: Exhaustive_
