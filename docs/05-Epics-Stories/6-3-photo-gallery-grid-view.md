# Story 6.3: Photo Gallery Grid View

Status: done

## Story

As a **user**,
I want **to browse all shared photos in a beautiful grid layout**,
so that **I can enjoy our visual memories together**.

## Acceptance Criteria

### AC 6.3.1: Gallery Grid Layout
**Given** user navigates to Photo Gallery page
**When** page loads
**Then**
- Grid view displays photo thumbnails
- 3-column layout on mobile (min-width: 320px)
- 4-column layout on desktop (min-width: 768px)
- Both partners' photos shown together
- Photos sorted by created_at DESC (newest first)

### AC 6.3.2: Lazy Loading
**Given** gallery has many photos
**When** user scrolls through gallery
**Then**
- Images lazy load using IntersectionObserver
- Blur placeholder shown while loading
- Only visible images rendered for performance
- Smooth scrolling at 60fps maintained

### AC 6.3.3: Infinite Scroll Pagination
**Given** user scrolls to bottom of gallery
**When** more photos available
**Then**
- Next page of photos automatically loads
- Loading indicator displayed during fetch
- Scroll position preserved during data load
- No duplicate photos in grid

### AC 6.3.4: Thumbnail Styling
**Given** photos displayed in grid
**When** user views gallery
**Then**
- Aspect ratio preserved (object-cover)
- Subtle border radius applied (rounded-lg)
- Photos have consistent sizing in grid
- Hover effect: slight scale transform (1.05x)

### AC 6.3.5: Click to View Full-Screen
**Given** user views gallery grid
**When** they click a photo thumbnail
**Then**
- Full-screen photo viewer opens (Story 6.4 integration point)
- Selected photo index passed to viewer
- Viewer can navigate to next/previous photos
- Close viewer returns to same scroll position in gallery

### AC 6.3.6: Empty State
**Given** user navigates to Photo Gallery
**When** no photos exist yet
**Then**
- Empty state message displayed: "No photos yet. Start building your memories!"
- "Add Photo" button prominently displayed
- Icon or illustration shown for visual interest

### AC 6.3.7: Loading State
**Given** user navigates to Photo Gallery
**When** initial photos are loading
**Then**
- Loading skeleton grid displayed (3 or 4 columns)
- Skeleton cards show shimmer animation
- Layout doesn't shift when photos load

### AC 6.3.8: Error State
**Given** photo fetch fails
**When** error occurs
**Then**
- Error message displayed: "Failed to load photos. Try again?"
- Retry button available
- Network error handled gracefully
- User can still access PhotoUploader to add photos

### AC 6.3.9: Memory Efficiency
**Given** gallery has 100+ photos
**When** user scrolls through gallery
**Then**
- Memory usage stays under 150MB
- Only visible and near-visible images loaded
- Previous images unloaded when off-screen
- No memory leaks from unmounted components

### AC 6.3.10: Photo Metadata Display (Optional)
**Given** user views photo in grid
**When** they hover or tap photo
**Then**
- Caption displayed if present
- Upload timestamp shown in relative format ("2 hours ago", "Yesterday", "Nov 15")
- Owner indication (own photo vs partner photo)

## Tasks / Subtasks

### Task 1: Create PhotoGallery Page Component
- [x] Create `src/pages/PhotoGallery.tsx` page component
- [x] Implement responsive layout wrapper (max-width container, padding)
- [x] Add page title "Our Memories" with decorative heart icon
- [x] Create "Add Photo" floating action button (bottom-right)
- [x] Integrate PhotoUploader modal on FAB click
- [x] Add usePhotos hook to fetch photos on mount
- [x] Implement loading, error, and empty states
- [x] Add page navigation (back button, breadcrumbs)

### Task 2: Create PhotoGrid Component
- [x] Create `src/components/photos/PhotoGrid.tsx` grid component
- [x] Implement Tailwind responsive grid: `grid-cols-3 md:grid-cols-4`
- [x] Add gap spacing between items: `gap-2 md:gap-4`
- [x] Accept photos array prop with PhotoWithUrls type
- [x] Accept onPhotoClick callback for viewer integration
- [x] Implement grid container with proper aspect ratios
- [x] Add accessibility: role="grid", aria-label for grid

### Task 3: Create PhotoThumbnail Component
- [x] Create `src/components/photos/PhotoThumbnail.tsx` thumbnail component
- [x] Accept photo prop (PhotoWithUrls)
- [x] Accept onClick callback for click handling
- [x] Implement lazy loading with IntersectionObserver
- [x] Show blur placeholder while loading (AC 6.3.2)
- [x] Apply Tailwind styling: rounded-lg, object-cover, hover:scale-105
- [x] Display image using signed URL from photo.signedUrl
- [x] Add loading error fallback (broken image icon)
- [x] Implement accessibility: alt text, role="gridcell"

### Task 4: Implement Infinite Scroll Pagination
- [x] Create `src/hooks/useInfinitePhotos.ts` custom hook
- [x] Extend usePhotos to support pagination (offset, limit)
- [x] Implement IntersectionObserver on sentinel element
- [x] Load next page when user scrolls to bottom
- [x] Track loading state for "Load More" indicator
- [x] Prevent duplicate fetches during loading
- [x] Handle end of data (no more photos available)
- [x] Preserve scroll position during page loads

### Task 5: Add Photo Metadata Overlay (Optional)
- [x] Create `src/components/photos/PhotoMetadata.tsx` overlay component
- [x] Display caption if present (truncate long captions)
- [x] Show relative timestamp ("2 hours ago")
- [x] Show owner badge ("Your photo" vs partner name)
- [x] Implement hover/tap to reveal metadata
- [x] Add fade-in transition for overlay
- [x] Ensure accessibility: proper contrast, readable text

### Task 6: Implement Empty, Loading, Error States
- [x] Create `src/components/photos/EmptyGalleryState.tsx`
- [x] Create `src/components/photos/GalleryLoadingSkeleton.tsx`
- [x] Create `src/components/photos/GalleryErrorState.tsx`
- [x] EmptyGalleryState: message + "Add Photo" CTA + illustration
- [x] LoadingSkeleton: responsive grid of shimmer cards
- [x] ErrorState: error message + retry button + contact support link
- [x] All states use consistent Tailwind styling

### Task 7: Add PhotoGallery Route
- [x] Add route to `src/App.tsx` or router config: `/photos`
- [x] Update navigation menu to include "Photos" link
- [x] Add route guard (require authentication)
- [x] Implement page metadata (title, description)
- [x] Add to bottom navigation bar if present

### Task 8: Write Unit Tests for PhotoGrid
- [x] Create `tests/unit/components/PhotoGrid.test.tsx`
- [x] Test grid renders with photos array
- [x] Test responsive grid layout (3 cols mobile, 4 cols desktop)
- [x] Test onPhotoClick callback invoked correctly
- [x] Test empty photos array shows nothing
- [x] Test accessibility attributes present

### Task 9: Write Unit Tests for PhotoThumbnail
- [x] Create `tests/unit/components/PhotoThumbnail.test.tsx`
- [x] Test thumbnail renders with photo data
- [x] Test lazy loading behavior (IntersectionObserver mock)
- [x] Test loading placeholder shown initially
- [x] Test hover effect styling applied
- [x] Test onClick callback invoked on click
- [x] Test broken image fallback
- [x] Test accessibility attributes

### Task 10: Write Integration Tests for PhotoGallery
- [x] Create `tests/integration/photoGallery.test.tsx`
- [x] Test gallery fetches photos on mount
- [x] Test photos displayed in grid layout
- [x] Test infinite scroll loads more photos
- [x] Test empty state shown when no photos
- [x] Test loading skeleton shown during fetch
- [x] Test error state shown on fetch failure
- [x] Test "Add Photo" button opens PhotoUploader modal

### Task 11: Write E2E Tests for Photo Gallery
- [x] Create `tests/e2e/photoGallery.spec.ts`
- [x] Test full gallery browsing workflow
- [x] Test photo grid renders correctly
- [x] Test infinite scroll loads more photos
- [x] Test clicking photo opens viewer (Story 6.4 integration)
- [x] Test "Add Photo" FAB opens uploader
- [x] Test gallery updates after new photo upload
- [x] Test responsive layouts (mobile and desktop)

### Task 12: Performance Optimization
- [x] Profile memory usage with 100+ photos
- [x] Implement virtual scrolling if needed (react-window)
- [x] Optimize image loading (preload next visible images)
- [x] Add cache headers for signed URLs
- [x] Measure and optimize LCP (Largest Contentful Paint)
- [x] Ensure 60fps scrolling on mobile devices
- [x] Test on low-end devices for performance

## Dev Notes

### CRITICAL Developer Context

**🔥 PREVENT COMMON MISTAKES:**
- **DO NOT** reinvent lazy loading - use IntersectionObserver API natively
- **DO NOT** forget memory cleanup - revoke object URLs and cleanup observers
- **DO NOT** load all photos at once - implement proper pagination
- **DO NOT** skip loading states - users need feedback during data fetch
- **DO NOT** ignore responsive design - grid must work on all screen sizes
- **DO NOT** forget accessibility - images need alt text, grid needs ARIA labels

### Architecture Alignment

**Page Structure:**
- `src/pages/PhotoGallery.tsx` - NEW page component
- Pattern: Self-contained page with header, grid, FAB, modal
- Reference: `src/pages/MoodTracker.tsx` or similar for page structure

**Component Layer:**
- `src/components/photos/PhotoGrid.tsx` - NEW grid container
- `src/components/photos/PhotoThumbnail.tsx` - NEW thumbnail component
- `src/components/photos/EmptyGalleryState.tsx` - NEW empty state
- `src/components/photos/GalleryLoadingSkeleton.tsx` - NEW loading skeleton
- `src/components/photos/GalleryErrorState.tsx` - NEW error state
- Pattern: Presentational components with Tailwind CSS styling

**Hook Layer:**
- `src/hooks/usePhotos.ts` - **ALREADY EXISTS** from Story 6.2
- `src/hooks/useInfinitePhotos.ts` - NEW hook for pagination
- Pattern: Extend existing usePhotos with pagination support

**Service Layer:**
- `src/services/photoService.ts` - **ALREADY EXISTS** with getPhotos(limit, offset)
- No changes needed - pagination already supported

**State Management:**
- `src/stores/slices/photosSlice.ts` - **ALREADY EXISTS**
- May need extension for pagination state (currentPage, hasMore, etc.)

### Learnings from Story 6.2 (Photo Upload with Progress)

**Available Components:**
- `PhotoUploader.tsx` - Ready to integrate in modal
- `usePhotos` hook - Provides photos array, loadPhotos(), uploadPhoto()
- `photoService` - Has getPhotos(limit, offset) for pagination
- `photosSlice` - State management with photos array

**Integration Pattern:**
```typescript
// From PhotoGallery page
const { photos, loadPhotos, isLoading, error } = usePhotos(true); // Auto-load on mount

useEffect(() => {
  loadPhotos(); // Load initial photos
}, [loadPhotos]);
```

**PhotoWithUrls Type:**
```typescript
interface PhotoWithUrls {
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
  signedUrl: string | null; // 1-hour expiry
  isOwn: boolean; // true if current user owns photo
}
```

### Learnings from Story 6-0 (Photo Storage Schema)

**Signed URL Management:**
- Signed URLs expire in 1 hour (3600 seconds)
- photoService.getSignedUrls() generates URLs in batch for performance
- URLs must be refreshed periodically for long sessions
- Failed URL generation returns null - need fallback UI

**RLS Policies:**
- Users automatically see own photos + partner photos
- No manual filtering needed in UI
- DELETE only allowed for own photos (enforced by RLS)

**Storage Path Pattern:**
```typescript
// Photos stored at: {user_id}/{uuid}.{ext}
// Example: "550e8400-e29b-41d4-a716-446655440000/7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg"
```

### Lazy Loading Implementation

**IntersectionObserver Pattern:**
```typescript
// In PhotoThumbnail component
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !isLoaded) {
        setIsLoaded(true); // Trigger image load
      }
    },
    { rootMargin: '50px' } // Preload 50px before visible
  );

  if (imgRef.current) {
    observer.observe(imgRef.current);
  }

  return () => {
    if (imgRef.current) {
      observer.unobserve(imgRef.current);
    }
  };
}, [isLoaded]);
```

**Blur Placeholder Implementation:**
```typescript
// Show blur placeholder while loading
{!isLoaded && (
  <div className="absolute inset-0 bg-gray-200 animate-pulse" />
)}
<img
  ref={imgRef}
  src={isLoaded ? photo.signedUrl : undefined}
  alt={photo.caption || 'Photo'}
  className="w-full h-full object-cover transition-opacity duration-300"
  style={{ opacity: isLoaded ? 1 : 0 }}
  loading="lazy" // Browser native lazy loading as fallback
/>
```

### Infinite Scroll Implementation

**Pagination Pattern:**
```typescript
// In useInfinitePhotos hook
const [photos, setPhotos] = useState<PhotoWithUrls[]>([]);
const [offset, setOffset] = useState(0);
const [hasMore, setHasMore] = useState(true);
const LIMIT = 50;

const loadMore = async () => {
  if (isLoading || !hasMore) return;

  const newPhotos = await photoService.getPhotos(LIMIT, offset);

  if (newPhotos.length === 0) {
    setHasMore(false);
    return;
  }

  setPhotos((prev) => [...prev, ...newPhotos]);
  setOffset((prev) => prev + LIMIT);

  if (newPhotos.length < LIMIT) {
    setHasMore(false); // Last page reached
  }
};
```

**Sentinel Element for Scroll Detection:**
```typescript
// In PhotoGallery component
const sentinelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore(); // Load next page
      }
    },
    { threshold: 0.1 }
  );

  if (sentinelRef.current) {
    observer.observe(sentinelRef.current);
  }

  return () => {
    if (sentinelRef.current) {
      observer.unobserve(sentinelRef.current);
    }
  };
}, [hasMore, loadMore]);

// In JSX
return (
  <>
    <PhotoGrid photos={photos} />
    {hasMore && <div ref={sentinelRef} className="h-20" />}
    {isLoading && <LoadingIndicator />}
  </>
);
```

### Responsive Grid Styling

**Tailwind Grid Classes:**
```typescript
// Mobile: 3 columns, Desktop: 4 columns
<div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-4 p-4">
  {photos.map((photo) => (
    <PhotoThumbnail key={photo.id} photo={photo} onClick={() => openViewer(photo.id)} />
  ))}
</div>
```

**Aspect Ratio Container:**
```typescript
// Maintain consistent aspect ratio for all thumbnails
<div className="relative aspect-square overflow-hidden rounded-lg hover:scale-105 transition-transform duration-200 cursor-pointer">
  <img
    src={photo.signedUrl}
    alt={photo.caption || 'Photo'}
    className="absolute inset-0 w-full h-full object-cover"
  />
</div>
```

### Memory Management

**Object URL Cleanup:**
```typescript
// Clean up blob URLs to prevent memory leaks
useEffect(() => {
  return () => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  };
}, [blobUrl]);
```

**IntersectionObserver Cleanup:**
```typescript
// Always cleanup observers to prevent memory leaks
useEffect(() => {
  const observer = new IntersectionObserver(callback);

  if (element) {
    observer.observe(element);
  }

  return () => {
    observer.disconnect(); // Cleanup ALL observations
  };
}, [element]);
```

**Image Reference Cleanup:**
```typescript
// Unload images that scroll out of view
useEffect(() => {
  if (!isVisible && imgRef.current) {
    imgRef.current.src = ''; // Clear src to free memory
  }
}, [isVisible]);
```

### Performance Optimization Targets

**Performance Metrics:**
- **LCP (Largest Contentful Paint):** < 2.5s for first photos visible
- **FID (First Input Delay):** < 100ms for interactions
- **CLS (Cumulative Layout Shift):** < 0.1 (no layout shift)
- **Memory Usage:** < 150MB for 100+ photos
- **Frame Rate:** 60fps scrolling on mobile

**Optimization Strategies:**
- Lazy load images with IntersectionObserver
- Preload next 3-5 images while scrolling
- Use WebP format for better compression
- Implement virtual scrolling for 500+ photos (react-window)
- Cache signed URLs for 30 minutes (before 1-hour expiry)
- Debounce scroll events (300ms)

### Accessibility Requirements

**Image Accessibility:**
```typescript
<img
  src={photo.signedUrl}
  alt={photo.caption || `Photo uploaded ${formatDate(photo.created_at)}`}
  role="img"
  aria-label={photo.caption || 'Photo'}
/>
```

**Grid Accessibility:**
```typescript
<div role="grid" aria-label="Photo gallery">
  {photos.map((photo) => (
    <div key={photo.id} role="gridcell">
      <PhotoThumbnail photo={photo} />
    </div>
  ))}
</div>
```

**Interactive Elements:**
```typescript
<button
  onClick={openViewer}
  aria-label={`View photo: ${photo.caption || 'Untitled'}`}
  className="focus:outline-none focus:ring-2 focus:ring-pink-500"
>
  <PhotoThumbnail photo={photo} />
</button>
```

### UI/UX Requirements

**Grid Spacing:**
- Mobile: 8px gap (gap-2)
- Desktop: 16px gap (gap-4)
- Container padding: 16px (p-4)

**Thumbnail Hover Effects:**
```css
/* Tailwind classes */
.thumbnail {
  @apply transition-transform duration-200 hover:scale-105 hover:shadow-lg cursor-pointer;
}
```

**Loading Skeleton:**
```typescript
// Shimmer animation skeleton
<div className="animate-pulse">
  {Array.from({ length: 12 }).map((_, i) => (
    <div key={i} className="aspect-square bg-gray-200 rounded-lg" />
  ))}
</div>
```

**Empty State Illustration:**
- Use lucide-react icons: Camera, Heart, Image
- Friendly message: "No photos yet. Start building your memories!"
- Prominent "Add Photo" button with coral background

**Error State:**
- Red-tinted background for error message
- Clear error text with actionable solution
- Retry button with loading state
- Support/help link if error persists

### Testing Standards

**Test Coverage Requirements:**
- PhotoGrid component: 100% coverage
- PhotoThumbnail component: 100% coverage
- useInfinitePhotos hook: 100% coverage
- PhotoGallery page: 90%+ coverage
- E2E gallery workflow: Full user journey

**Key Test Scenarios:**
- Grid renders correctly with 0, 1, 10, 100+ photos
- Lazy loading triggers on scroll
- Infinite scroll loads next page
- Click photo opens viewer (mock integration)
- Empty, loading, error states render correctly
- Memory usage stays under threshold with 100+ photos
- Responsive grid works on mobile and desktop
- Accessibility attributes present and correct

### Recent Commits Context

**Latest Commits:**
```
9a02e56 fix(realtime): replace postgres_changes with Broadcast API for partner mood updates
2399826 fix(e2e): improve authentication handling in mood logging tests
d14d983 fix(tests): mock Supabase client properly in useLoveNotes tests
b6795f5 fix(photos): add test for dimension failure and improve error handling
```

**Key Learnings:**
- Realtime: Use Broadcast API, not postgres_changes (for future real-time features)
- Testing: Proper Supabase mocking critical for test reliability
- Photos: Comprehensive error handling and fallback logic established
- E2E: Authentication mocking patterns well-established

### Integration Points

**Story 6.4 Integration (Full-Screen Viewer):**
```typescript
// PhotoGallery will pass selected photo to viewer
const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

const handlePhotoClick = (photoId: string) => {
  setSelectedPhotoId(photoId);
  // PhotoViewer modal will open in Story 6.4
};

// PhotoViewer receives:
// - photos array (for navigation)
// - selectedPhotoId (initial photo)
// - onClose callback (returns to gallery)
```

**PhotoUploader Integration:**
```typescript
// Gallery has FAB that opens PhotoUploader modal
const [showUploader, setShowUploader] = useState(false);

const handleUploadSuccess = () => {
  setShowUploader(false);
  loadPhotos(); // Refresh gallery to show new photo
};

<PhotoUploader
  onUploadSuccess={handleUploadSuccess}
  onCancel={() => setShowUploader(false)}
/>
```

### Project Structure

**New Files:**
- `src/pages/PhotoGallery.tsx`
- `src/components/photos/PhotoGrid.tsx`
- `src/components/photos/PhotoThumbnail.tsx`
- `src/components/photos/EmptyGalleryState.tsx`
- `src/components/photos/GalleryLoadingSkeleton.tsx`
- `src/components/photos/GalleryErrorState.tsx`
- `src/hooks/useInfinitePhotos.ts`
- `tests/unit/components/PhotoGrid.test.tsx`
- `tests/unit/components/PhotoThumbnail.test.tsx`
- `tests/integration/photoGallery.test.tsx`
- `tests/e2e/photoGallery.spec.ts`

**Modified Files:**
- `src/App.tsx` (add /photos route)
- `src/stores/slices/photosSlice.ts` (possibly extend for pagination)
- Navigation menu component (add Photos link)

**No Changes Needed:**
- `src/services/photoService.ts` - Already has pagination
- `src/hooks/usePhotos.ts` - Already has loadPhotos()
- `src/components/photos/PhotoUploader.tsx` - Ready to use

### References

- [Source: docs/05-Epics-Stories/epics.md#Story-6.3-Photo-Gallery-Grid-View]
- [Source: docs/05-Epics-Stories/tech-spec-epic-6.md#Story-6-3-Photo-Gallery-Grid-View]
- [Source: docs/05-Epics-Stories/6-2-photo-upload-progress-indicator.md#Dev-Notes]
- [Source: docs/05-Epics-Stories/6-0-photo-storage-schema-buckets-setup.md#Dev-Notes]
- [Source: docs/02-Architecture/architecture.md#Component-Architecture]
- [Source: docs/01-PRD/prd.md#FR32-FR33-Photo-Gallery]
- [Source: MDN Web Docs: IntersectionObserver API]
- [Source: Web.dev: Lazy Loading Images and Video]
- [Source: React Docs: Performance Optimization]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List
