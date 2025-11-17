# Epic Technical Specification: Photo Gallery & Memories

Date: 2025-11-07
Author: Frank
Epic ID: 4
Status: Draft

---

## Overview

Epic 4 introduces a comprehensive photo gallery system that transforms My Love from a message-only application into a rich multimedia memory keeper. Building on the stable persistence foundation from Epic 1 and the proven testing infrastructure from Epic 2, this epic delivers on PRD requirements FR012-FR015 to enable photo upload, storage, carousel viewing, and management—all while maintaining the app's offline-first, privacy-focused architecture.

The epic addresses a core user need: preserving and reliving special relationship moments through photos. By implementing client-side photo compression and IndexedDB storage, photos remain private and accessible offline. The carousel interface with Framer Motion animations provides a premium, emotionally resonant browsing experience. The deliverable is a fully-featured photo gallery that integrates seamlessly with the existing message-driven daily experience.

## Objectives and Scope

**In Scope:**

- Photo upload with file picker supporting JPEG, PNG, WebP formats (Story 4.1)
- Client-side image compression (max 1920px width, 80% JPEG quality) to optimize storage (Story 4.1)
- Optional caption (max 500 chars) and comma-separated tags for each photo (Story 4.1)
- IndexedDB persistence in dedicated `photos` object store with metadata: id, blob, caption, tags, uploadDate (Story 4.1)
- Responsive grid gallery view (2-3 columns mobile, 3-4 desktop) with lazy loading (Story 4.2)
- Full-screen lightbox carousel with swipe navigation and Framer Motion transitions (Story 4.3)
- Edit caption/tags and delete functionality with confirmation dialog (Story 4.4)
- Top navigation integration with Photos tab and active state highlighting (Story 4.5)
- Storage quota management with graceful error handling when limit approached (Story 4.1)
- Maintain offline-first PWA functionality for all photo operations (no backend dependency)

**Out of Scope:**

- Video upload or playback (text and photos only per PRD Out of Scope line 192)
- Social sharing or public galleries (privacy-first, client-side only)
- Cross-device photo sync (single-device use case per architecture)
- Cloud storage integration (all data stays local per NFR005)
- Advanced photo editing (filters, cropping, rotation) beyond caption/tag editing
- Photo albums or collections (simple chronological gallery only)
- Facial recognition or AI-powered photo organization
- Bulk upload or drag-and-drop multiple files (single file upload per interaction)
- Photo compression quality settings (fixed at 80% quality)
- RAW image format support (JPEG/PNG/WebP only)

## System Architecture Alignment

Epic 4 extends the existing component-based SPA architecture without requiring fundamental changes:

**Component Architecture:** Adds three new primary components: PhotoGallery (grid view), PhotoCarousel (lightbox), PhotoUpload (modal form). All follow established patterns: state from Zustand, animations with Framer Motion, responsive Tailwind styling. Navigation structure leverages existing top nav pattern (Home → Photos tab).

**State Management:** Extends Zustand useAppStore with new `photos` state slice (array of Photo objects loaded from IndexedDB) and photo-related actions (uploadPhoto, deletePhoto, updatePhoto). Existing persist middleware remains unchanged—photos stored in IndexedDB, not LocalStorage, due to size constraints.

**Data Layer:** Utilizes IndexedDB with new `photos` object store (established in Epic 1 architecture, currently unused). Schema: `{ key: id (auto-increment), value: Photo, indexes: { 'by-date': uploadDate } }`. Existing storageService.ts extended with photo CRUD operations. No changes to service worker cache strategy—photos loaded from IndexedDB, not pre-cached.

**Animation Layer:** Framer Motion (existing ^12.23.24) handles carousel transitions, entrance animations, and swipe gestures. Reuses existing animation patterns from DailyMessage (similar swipe implementation from Epic 3) for consistency.

**Build/Deploy Pipeline:** No changes required. Photo gallery bundled in same Vite build. Photo data remains client-side, no backend endpoints. PWA offline functionality preserved—all photo operations work without network.

**Constraints:**

- Photos stored in IndexedDB with typical 50MB quota (compression essential to fit ~50-100 photos)
- No lazy component loading due to single-view SPA architecture (all components bundled)
- Photo compression must happen client-side (no server-side processing available)
- Grid performance limited by DOM rendering (~100 photos before virtualization needed)
- All photo operations must work offline (no backend storage, no CDN)

## Detailed Design

### Services and Modules

| Module/Service                | Responsibilities                                       | Input                              | Output                          | Owner/Story      |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------- | ------------------------------- | ---------------- |
| **PhotoUpload Component**     | File picker, preview, compression, metadata form       | User file selection, caption, tags | Photo object saved to IndexedDB | Story 4.1        |
| **Image Compression Service** | Client-side image resizing and quality reduction       | File blob, max dimensions, quality | Compressed blob                 | Story 4.1        |
| **PhotoGallery Component**    | Grid display, lazy loading, navigation to carousel     | Photo[] from Zustand               | Rendered grid with thumbnails   | Story 4.2        |
| **PhotoCarousel Component**   | Full-screen lightbox, swipe navigation, edit/delete UI | Selected photo ID, photo array     | Interactive carousel view       | Story 4.3        |
| **Photo Storage Service**     | IndexedDB CRUD for photos object store                 | Photo operations                   | Promise<Photo[]>                | Stories 4.1, 4.4 |
| **Photo State Manager**       | Zustand store slice for photo state                    | User actions                       | Updated photos array            | Stories 4.1-4.5  |
| **Thumbnail Generator**       | Generate optimized thumbnails for grid view            | Photo blob                         | Thumbnail blob (150px)          | Story 4.2        |
| **Navigation Integration**    | Top nav Photos tab with routing                        | Route changes                      | View switching                  | Story 4.5        |

**Key Module Interactions:**

- PhotoUpload Component → Image Compression Service → Photo Storage Service → IndexedDB
- PhotoGallery Component → Zustand photos state → PhotoCarousel Component (on photo tap)
- PhotoCarousel Component → Photo Storage Service → Update/Delete operations
- Navigation Integration → Zustand routing state → PhotoGallery/DailyMessage view switching

### Data Models and Contracts

**Photo Interface:**

```typescript
// src/types/index.ts (enhanced)
interface Photo {
  id: number; // Auto-increment primary key
  imageBlob: Blob; // Compressed image data (JPEG/PNG/WebP)
  caption?: string; // Optional caption (max 500 chars)
  tags: string[]; // Array of tags (empty array if none)
  uploadDate: Date; // Upload timestamp
  originalSize: number; // Original file size in bytes (for stats)
  compressedSize: number; // Compressed size in bytes
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  mimeType: string; // 'image/jpeg' | 'image/png' | 'image/webp'
}
```

**Photo Upload Input:**

```typescript
// src/components/PhotoUpload/types.ts
interface PhotoUploadInput {
  file: File; // Selected image file
  caption?: string; // Optional caption
  tags: string[]; // Parsed from comma-separated input
}

interface CompressionOptions {
  maxWidth: number; // Default: 1920px
  maxHeight: number; // Default: 1920px
  quality: number; // Default: 0.8 (80%)
  outputFormat: 'image/jpeg' | 'image/png' | 'image/webp';
}
```

**IndexedDB Schema:**

```typescript
// Enhanced MyLoveDB with photos store
interface MyLoveDB {
  photos: {
    key: number; // Auto-increment primary key
    value: Photo;
    indexes: {
      'by-date': Date; // Index by uploadDate for chronological sort
    };
  };

  messages: {
    // Existing from Epic 1 (no changes)
    key: number;
    value: Message;
    indexes: {
      'by-category': string;
      'by-date': Date;
    };
  };
}
```

**Zustand State Extension:**

```typescript
// src/store/useAppStore.ts (new slice)
interface PhotoState {
  photos: Photo[]; // In-memory cache of all photos
  isLoadingPhotos: boolean; // Loading state for gallery
  selectedPhotoId: number | null; // Currently viewed photo in carousel
  photoError: string | null; // Error message for photo operations
}
```

### APIs and Interfaces

**Zustand Store Actions (Photo Operations):**

```typescript
// src/store/useAppStore.ts
interface PhotoActions {
  // Load & Display
  loadPhotos: () => Promise<void>;
  selectPhoto: (photoId: number) => void;
  clearPhotoSelection: () => void;

  // CRUD Operations
  uploadPhoto: (input: PhotoUploadInput) => Promise<Photo>;
  updatePhoto: (photoId: number, updates: { caption?: string; tags?: string[] }) => Promise<void>;
  deletePhoto: (photoId: number) => Promise<void>;

  // Utilities
  getPhotoById: (photoId: number) => Photo | null;
  getPhotoCount: () => number;
  getStorageUsage: () => Promise<{ used: number; quota: number }>;
}
```

**Photo Storage Service API:**

```typescript
// src/services/photoStorageService.ts
export class PhotoStorageService {
  // CRUD Operations
  async create(photo: Omit<Photo, 'id'>): Promise<Photo>;
  async update(photoId: number, updates: Partial<Photo>): Promise<void>;
  async delete(photoId: number): Promise<void>;
  async getAll(): Promise<Photo[]>;
  async getById(photoId: number): Promise<Photo | null>;

  // Pagination for large galleries
  async getPage(offset: number, limit: number): Promise<Photo[]>;

  // Utilities
  async getCount(): Promise<number>;
  async getStorageSize(): Promise<number>; // Total bytes used by photos
  async estimateQuotaRemaining(): Promise<number>; // Bytes remaining
}
```

**Image Compression Service API:**

```typescript
// src/services/imageCompressionService.ts
export class ImageCompressionService {
  async compressImage(
    file: File,
    options: CompressionOptions
  ): Promise<{
    blob: Blob;
    width: number;
    height: number;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }>;

  async generateThumbnail(
    imageBlob: Blob,
    size: number // Default: 150px
  ): Promise<Blob>;

  // Utilities
  validateImageFile(file: File): { valid: boolean; error?: string };
  estimateCompressedSize(file: File): Promise<number>;
}
```

**PhotoCarousel Component API:**

```typescript
// src/components/PhotoCarousel/PhotoCarousel.tsx
interface PhotoCarouselProps {
  photos: Photo[];
  initialPhotoId: number;
  onClose: () => void;
  onEdit: (photoId: number) => void;
  onDelete: (photoId: number) => void;
}

interface UsePhotoCarouselReturn {
  currentPhoto: Photo;
  currentIndex: number;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  navigatePrev: () => void;
  navigateNext: () => void;
  navigateToIndex: (index: number) => void;
}
```

**Framer Motion Carousel Implementation:**

```typescript
// PhotoCarousel swipe gesture integration
<motion.div
  drag="x"
  dragConstraints={{ left: canNavigateNext ? -100 : 0, right: canNavigatePrev ? 100 : 0 }}
  dragElastic={0.2}
  onDragEnd={(event, info) => {
    if (info.offset.x > 50 && canNavigatePrev) {
      navigatePrev(); // Swipe right → previous photo
    } else if (info.offset.x < -50 && canNavigateNext) {
      navigateNext(); // Swipe left → next photo
    }
  }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: direction * 300, opacity: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
  <img src={URL.createObjectURL(currentPhoto.imageBlob)} alt={currentPhoto.caption} />
</motion.div>
```

### Workflows and Sequencing

**Story Execution Sequence:** 4.1 → 4.2 → 4.3 → 4.4 → 4.5 (sequential, each builds on previous)

**Critical Workflow 1: Photo Upload (User Journey)**

```
User navigates to Photos tab (Story 4.5)
    ↓
[Story 4.2] PhotoGallery component renders empty state: "No photos yet. Upload your first memory!"
    ↓
User taps "Upload Photo" button
    ↓
[Story 4.1] PhotoUpload modal opens with file picker
    ↓
User selects photo from device (e.g., IMG_1234.jpg, 3.2MB, 4032×3024px)
    ↓
[Story 4.1] File validation:
  1. Check file type (JPEG/PNG/WebP accepted)
  2. Check file size (< 10MB recommended, warn if larger)
  3. If valid → proceed to preview
  4. If invalid → show error: "Unsupported file format. Please select a JPEG, PNG, or WebP image."
    ↓
[Story 4.1] Preview screen displays:
  - Selected image preview
  - Caption text area (optional, placeholder: "Add a caption...")
  - Tags input (optional, placeholder: "beach, sunset, memories")
  - Compression info: "Will compress to ~300KB"
    ↓
User fills in caption: "Our first beach sunset together ❤️"
User adds tags: "beach, sunset, date night"
    ↓
User taps "Upload" button
    ↓
[Story 4.1] Compression process:
  1. imageCompressionService.compressImage(file, { maxWidth: 1920, quality: 0.8 })
  2. Read file into canvas, resize if needed, export as JPEG blob
  3. Log: Original 3.2MB → Compressed 320KB (90% reduction)
    ↓
[Story 4.1] Save to IndexedDB:
  1. Create Photo object: { imageBlob: compressedBlob, caption, tags: ['beach', 'sunset', 'date night'], ... }
  2. photoStorageService.create(photo)
  3. IndexedDB transaction writes to photos store
  4. Return new photo with auto-generated ID (e.g., id: 1)
    ↓
[Story 4.1] Update Zustand state:
  1. uploadPhoto() action adds photo to photos array
  2. photos.push(newPhoto)
  3. PhotoGallery re-renders with new photo in grid
    ↓
Success feedback: "Photo uploaded! ✨" (toast notification)
    ↓
[Story 4.2] PhotoGallery displays uploaded photo in grid (newest first)
```

**Critical Workflow 2: Photo Carousel Navigation (User Journey)**

```
User in PhotoGallery (10 photos uploaded)
    ↓
[Story 4.2] Grid displays photos sorted by uploadDate descending
    ↓
User taps on photo #5 in grid
    ↓
[Story 4.3] PhotoCarousel opens:
  1. selectPhoto(5) action sets selectedPhotoId in Zustand
  2. PhotoCarousel component mounts with initialPhotoId: 5
  3. Full-screen overlay with semi-transparent backdrop
  4. Photo #5 displayed at center with fade-in animation (300ms)
  5. Caption and tags shown below photo
  6. Navigation arrows: ← Prev | Next →
  7. Top bar: Edit | Delete | Close (X) buttons
    ↓
User swipes left (touch gesture)
    ↓
[Story 4.3] Swipe gesture detected:
  - onDragEnd triggered, info.offset.x = -80px (threshold: -50px)
  - canNavigateNext = true (currentIndex 4, total 10 photos)
    ↓
[Story 4.3] navigateNext() action:
  1. Increment currentIndex (4 → 5)
  2. Trigger exit animation: photo #5 slides left (x: -300px, opacity: 0)
  3. Load photo #6
  4. Trigger enter animation: photo #6 slides from right (x: 300px → 0, opacity: 1)
  5. Duration: 300ms, spring physics
    ↓
[Story 4.3] Photo #6 now displayed
  - Caption: "Dinner at our favorite restaurant"
  - Tags: "food, date night, Italian"
  - Navigation: ← Prev (to #5) | Next → (to #7)
    ↓
User continues swiping through photos
    ↓
User reaches last photo (index 9)
    ↓
[Story 4.3] Drag constraint activates:
  - canNavigateNext = false
  - dragConstraints.left = 0 (prevent swipe left beyond last photo)
  - Elastic bounce effect (dragElastic: 0.2) provides subtle feedback
    ↓
User swipes down (close gesture)
    ↓
[Story 4.3] Carousel closes:
  1. onClose() callback triggered
  2. clearPhotoSelection() action clears selectedPhotoId
  3. Exit animation: fade out + scale down (200ms)
  4. PhotoCarousel unmounts
  5. PhotoGallery grid visible again
```

**Critical Workflow 3: Photo Edit & Delete (Admin Operations)**

```
User in PhotoCarousel viewing photo they want to edit
    ↓
[Story 4.4] User taps "Edit" button (pencil icon)
    ↓
PhotoEditModal opens:
  - Current photo displayed as preview
  - Caption field pre-populated: "Our first beach sunset together ❤️"
  - Tags field pre-populated: "beach, sunset, date night"
  - Save | Cancel buttons
    ↓
User edits caption: "Our magical first beach sunset together ❤️🌅"
User adds tag: "beach, sunset, date night, memories"
    ↓
User taps "Save"
    ↓
[Story 4.4] updatePhoto() action:
  1. photoStorageService.update(photoId: 5, { caption: "...", tags: [...] })
  2. IndexedDB transaction updates photo record
  3. Zustand photos array updated (find photo by ID, replace with updated)
  4. PhotoCarousel re-renders with new caption/tags
    ↓
Success feedback: "Photo updated!" (toast notification)
    ↓
PhotoEditModal closes, carousel shows updated info
    ↓
---
    ↓
User decides to delete photo
    ↓
[Story 4.4] User taps "Delete" button (trash icon)
    ↓
Confirmation dialog opens:
  - Title: "Delete this photo?"
  - Message: "This action cannot be undone."
  - Buttons: Cancel | Delete (red)
    ↓
User taps "Delete"
    ↓
[Story 4.4] deletePhoto() action:
  1. photoStorageService.delete(photoId: 5)
  2. IndexedDB transaction removes photo record
  3. Photo blob deleted (storage reclaimed)
  4. Zustand photos array updated (filter out deleted photo)
  5. PhotoCarousel navigates to next photo (or closes if last photo)
    ↓
Success feedback: "Photo deleted" (toast notification)
    ↓
PhotoGallery grid refreshes with deleted photo removed
```

**Critical Workflow 4: Storage Quota Management**

```
User attempts to upload photo #51
    ↓
[Story 4.1] Pre-upload storage check:
  1. getStorageUsage() estimates current usage: 48MB / 50MB quota
  2. Estimate compressed size of new photo: ~350KB
  3. Calculate projected usage: 48MB + 0.35MB = 48.35MB (within quota)
  4. Proceed with upload
    ↓
---
    ↓
User attempts to upload photo #101 (quota nearly full)
    ↓
[Story 4.1] Pre-upload storage check:
  1. getStorageUsage(): 49.8MB / 50MB quota (96% full)
  2. Estimate new photo: ~400KB
  3. Projected: 49.8MB + 0.4MB = 50.2MB (exceeds quota)
    ↓
[Story 4.1] Warning dialog:
  - Title: "Storage Almost Full"
  - Message: "You're using 96% of available storage. Consider deleting old photos to make room."
  - Buttons: Cancel | Upload Anyway
    ↓
User taps "Upload Anyway"
    ↓
[Story 4.1] Attempt upload:
  1. Compression completes successfully
  2. IndexedDB transaction attempts write
  3. QuotaExceededError thrown
    ↓
[Story 4.1] Error handling:
  - Catch QuotaExceededError
  - Rollback transaction
  - Show error: "Storage full! Delete some photos to free up space."
  - photoError state updated
  - Upload modal remains open (user can cancel or delete photos first)
```

## Non-Functional Requirements

### Performance

**Photo Upload Performance:**

- File validation: < 50ms (synchronous checks)
- Compression (3MB → 300KB): < 2000ms (client-side canvas processing)
- IndexedDB write: < 200ms (blob persistence)
- Total upload flow: < 3 seconds (file selection to gallery update)

**Gallery Load Performance:**

- Initial load (20 photos): < 500ms (IndexedDB query + render)
- Lazy load next batch (20 more): < 300ms (pagination query)
- Grid render performance: 60fps scroll (no janky scrolling)
- Thumbnail generation: < 100ms per thumbnail (150px size)

**Carousel Performance:**

- Photo transition animation: 300ms smooth (GPU-accelerated)
- Swipe gesture responsiveness: < 16ms per frame (60fps requirement)
- Full-resolution photo load: < 1000ms (from IndexedDB blob)
- Navigation between photos: instant (< 50ms state update)

**Bundle Size Impact:**

- PhotoGallery components: ~20KB gzipped (grid + carousel + upload modal)
- Image compression library (browser-image-compression or native canvas): 0KB (use native canvas API)
- Total Epic 4 bundle impact: < 25KB gzipped

**Memory Footprint:**

- 20 photos in memory (thumbnails): ~3MB (150px thumbnails)
- Full-resolution photos (on-demand): ~500KB per photo in memory during carousel view
- Target: < 10MB total memory for photo operations

**IndexedDB Performance:**

- Photo query (all photos): < 100ms for 100 photos
- Photo query (single photo by ID): < 20ms
- Photo delete: < 50ms
- Batch operations: < 500ms for 10 photos

### Security

**Client-Side Data Security:**

- Photos stored in IndexedDB (origin-isolated, same-origin policy enforced)
- No transmission of photos over network (fully offline storage)
- Blob data not accessible to other origins or extensions
- No backend photo storage (privacy-first architecture maintained)

**Input Validation:**

- File type validation: Accept only image/jpeg, image/png, image/webp MIME types
- File size validation: Warn if > 10MB original size (performance impact)
- Caption validation: Max 500 characters, HTML escaping via React
- Tags validation: Limit 10 tags per photo, max 50 chars per tag, sanitize input

**Blob Security:**

- Use URL.createObjectURL() for blob previews (revoke URLs after use to prevent memory leaks)
- No inline base64 data URLs (performance and security best practice)
- Validate blob integrity before display (check MIME type matches file extension)

**Storage Security:**

- IndexedDB quota limits enforced by browser (typically 50MB for origin)
- Graceful quota exceeded handling (no silent failures)
- No external file upload to cloud services (user controls data)

**XSS Prevention:**

- React escapes caption/tag text by default (no dangerouslySetInnerHTML)
- User-generated captions/tags treated as plain text only
- No execution of scripts from photo metadata (EXIF stripping optional enhancement)

### Reliability/Availability

**Photo Upload Reliability:**

- Compression failure fallback: Show error, allow retry or skip compression (save original)
- IndexedDB transaction failure: Rollback, show error with retry option
- Duplicate prevention: Check for existing photos by upload date + caption hash (optional)
- Atomic operations: Upload completes fully or not at all (no partial photos)

**Carousel Navigation Reliability:**

- Photo load failure: Show placeholder image with retry button
- Missing photo blob: Graceful error message, skip to next photo
- State synchronization: Zustand ensures carousel state matches photos array
- Edge case: Last photo deleted → auto-close carousel or navigate to previous

**Storage Reliability:**

- IndexedDB persistence: Survives browser restart, tab close/reopen
- Quota monitoring: Check available space before upload, warn at 80% usage
- Data integrity: Photos include metadata checksums (optional enhancement)
- Backup recommendation: Display "Export photos" suggestion when count > 50

**Offline Availability:**

- All photo operations work fully offline (upload, view, edit, delete)
- Service worker (Epic 1) continues to cache app shell and assets
- IndexedDB operations function normally offline (local storage)
- No network dependency for any photo functionality

**Error Recovery:**

- Photo load failure: Retry with exponential backoff (3 attempts max)
- Quota exceeded: Show specific error with actionable guidance (delete old photos)
- Compression failure: Fallback to original file with warning
- Carousel navigation conflict: Queue next photo load after current transition completes

### Observability

**Development Logging:**

- Photo upload process: `[PhotoUpload] Compressing 3.2MB → 320KB (90% reduction)`
- Storage operations: `[PhotoStorage] Saved photo ID: 5, size: 320KB, total photos: 23`
- Quota monitoring: `[Storage] Using 45MB / 50MB (90%), 5MB remaining`
- Carousel navigation: `[Carousel] Navigated to photo index 3/10`

**User-Facing Feedback:**

- Success toasts: "Photo uploaded! ✨", "Photo updated!", "Photo deleted"
- Error toasts: "Upload failed. Please try again.", "Storage full! Delete photos to free space."
- Loading indicators: Spinner during compression, "Uploading..." progress
- Quota warning: "Storage 80% full. Consider deleting old photos."

**Performance Monitoring:**

- Log compression time: `[Compression] 3.2MB compressed in 1850ms`
- Log IndexedDB operation time: `[IndexedDB] Photo query took 85ms`
- Track upload success rate: Success/failure count (local-only, no telemetry)

**Debugging Tools:**

- React DevTools: Inspect Zustand photos state, selectedPhotoId
- IndexedDB inspector (browser DevTools): View photos store, verify blobs saved
- Chrome DevTools Performance: Profile compression, rendering, animations
- Memory profiler: Monitor blob memory usage during carousel navigation

**Error Reporting:**

- ErrorBoundary (Epic 1) catches React errors in photo components
- Console.error for critical failures: IndexedDB errors, compression failures
- User-friendly error screens with recovery actions (retry, cancel, delete photos)
- No external error reporting (privacy-first, local debugging only)

## Dependencies and Integrations

### Existing Dependencies (No Changes Required)

| Package              | Version   | Type        | Purpose           | Epic 4 Usage                                              |
| -------------------- | --------- | ----------- | ----------------- | --------------------------------------------------------- |
| **react**            | ^19.1.1   | production  | UI framework      | PhotoGallery, PhotoCarousel, PhotoUpload components       |
| **react-dom**        | ^19.1.1   | production  | React rendering   | No changes                                                |
| **zustand**          | ^5.0.8    | production  | State management  | Extended store with photos slice                          |
| **idb**              | ^8.0.3    | production  | IndexedDB wrapper | Photo CRUD via photoStorageService                        |
| **framer-motion**    | ^12.23.24 | production  | Animations        | Carousel swipe gestures, transitions, entrance animations |
| **lucide-react**     | ^0.548.0  | production  | Icons             | Upload, Edit, Delete, Close, Navigation icons             |
| **workbox-window**   | ^7.3.0    | production  | Service worker    | No changes (inherited from Epic 1)                        |
| **typescript**       | ~5.9.3    | development | Type safety       | Photo, PhotoUploadInput interfaces                        |
| **vite**             | ^7.1.7    | development | Build tool        | Bundle photo components, no changes                       |
| **tailwindcss**      | ^3.4.18   | development | Styling           | PhotoGallery/Carousel styling                             |
| **@playwright/test** | ^1.56.1   | development | E2E testing       | Test Epic 4 photo features                                |

**Total Dependencies:** 0 new production dependencies—Epic 4 uses only existing stack

### Browser APIs Used

**Native Canvas API for Image Compression:**

```typescript
// No external library needed—use native browser APIs
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// Resize and compress using canvas.toBlob()
```

**Web APIs:**

- `<input type="file" accept="image/*">` - File picker for photo upload
- `FileReader API` - Read selected file as data URL for preview
- `Canvas API` - Client-side image compression and thumbnail generation
- `Blob API` - Store compressed image data
- `URL.createObjectURL()` - Generate blob URLs for image display
- `IndexedDB API (via idb)` - Photo persistence in photos store

### Integration Points

**Framer Motion Carousel Integration:**

```typescript
// PhotoCarousel uses existing framer-motion ^12.23.24 (Epic 3 pattern)
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

// Similar to Epic 3 swipe navigation pattern
<AnimatePresence mode="wait" custom={direction}>
  <motion.div
    key={currentPhoto.id}
    drag="x"
    dragConstraints={{ left: -100, right: 100 }}
    onDragEnd={(e, info: PanInfo) => handleSwipe(info)}
    initial={{ x: direction * 300, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: direction * -300, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
  >
    <img src={photoURL} alt={currentPhoto.caption} />
  </motion.div>
</AnimatePresence>
```

**Zustand Store Extension:**

```typescript
// Existing store (src/store/useAppStore.ts) enhanced with photos slice
interface AppState {
  // Existing (Epic 1-3) - NO CHANGES
  settings: Settings | null;
  messages: Message[];
  messageHistory: MessageHistory;

  // NEW (Epic 4) - Added fields
  photos: Photo[];
  isLoadingPhotos: boolean;
  selectedPhotoId: number | null;
  photoError: string | null;
}
```

**IndexedDB Schema Enhancement:**

```typescript
// New photos object store added to existing database
const db = await openDB<MyLoveDB>('my-love-db', 2, {
  // Version 1 → 2
  upgrade(db, oldVersion, newVersion, transaction) {
    if (oldVersion < 2) {
      // Migration: Create photos store
      const photosStore = db.createObjectStore('photos', {
        keyPath: 'id',
        autoIncrement: true,
      });
      photosStore.createIndex('by-date', 'uploadDate', { unique: false });
    }
  },
});
```

**No External Services Integration:**

- No cloud storage (photos stored locally only)
- No CDN for photo serving (IndexedDB blobs)
- No backend photo API (client-side only per architecture)
- No image processing services (native canvas API)

### Storage Quota Considerations

**IndexedDB Usage Projection:**

- Existing (Epic 1-3): ~1MB (messages, settings, history)
- Epic 4 Addition:
  - 50 photos × 350KB avg (compressed): ~17.5MB
  - 100 photos × 350KB avg: ~35MB
  - 150 photos × 350KB avg: ~52.5MB (approaching typical 50MB quota)

**Quota Management Strategy:**

- Compress all photos to ≤ 500KB (1920px max, 80% quality)
- Monitor quota via StorageManager API: `navigator.storage.estimate()`
- Warn user at 80% usage: "Storage 80% full (40MB/50MB)"
- Block uploads at 95% usage: "Storage almost full! Delete photos to continue."
- Suggest deleting oldest photos when approaching limit

**Browser Compatibility (Storage Quotas):**

- Chrome/Edge: ~60% of disk space (typically 50-100MB for images)
- Firefox: ~50MB default (user can increase)
- Safari: ~50MB default
- Recommendation: Optimize for 50MB quota (target 40MB max usage for 100 photos)

## Acceptance Criteria (Authoritative)

### Story 4.1: Photo Upload & Storage

**AC-4.1.1** "Photos" tab in navigation opens photo gallery view
**AC-4.1.2** "Upload Photo" button triggers file picker (image files only: JPEG, PNG, WebP)
**AC-4.1.3** Selected photo previewed before upload with metadata display
**AC-4.1.4** Caption text area (optional, max 500 characters)
**AC-4.1.5** Tags input field (comma-separated, optional, max 10 tags)
**AC-4.1.6** Photo compressed client-side (max 1920px width, 80% quality) before storage
**AC-4.1.7** Photo saved to IndexedDB `photos` store with metadata: id, blob, caption, tags, uploadDate
**AC-4.1.8** Success feedback shown after upload: "Photo uploaded! ✨"
**AC-4.1.9** Error handling: file too large (warn >10MB), unsupported format, storage quota exceeded

### Story 4.2: Photo Gallery Grid View

**AC-4.2.1** Gallery displays photos in responsive grid (2-3 columns mobile, 3-4 desktop)
**AC-4.2.2** Photos loaded from IndexedDB sorted by uploadDate descending (newest first)
**AC-4.2.3** Each grid item shows photo thumbnail with caption overlay on hover/tap
**AC-4.2.4** Lazy loading implemented (load 20 photos at a time, pagination)
**AC-4.2.5** Empty state message shown if no photos uploaded: "No photos yet. Upload your first memory!"
**AC-4.2.6** Loading spinner displayed while fetching photos from IndexedDB
**AC-4.2.7** Tapping photo opens carousel/lightbox view (Story 4.3)

### Story 4.3: Photo Carousel with Animated Transitions

**AC-4.3.1** Tapping grid photo opens full-screen lightbox carousel
**AC-4.3.2** Swipe left/right navigates between photos (smooth 300ms spring transition)
**AC-4.3.3** Photo displayed at optimal size (fills screen, maintains aspect ratio)
**AC-4.3.4** Caption and tags displayed below photo
**AC-4.3.5** Close button exits carousel (or swipe down gesture)
**AC-4.3.6** Keyboard navigation works (arrow keys, Escape to close)
**AC-4.3.7** Framer Motion animations: entrance fade-in, swipe transitions with spring physics
**AC-4.3.8** Edit and Delete buttons visible in carousel top bar

### Story 4.4: Photo Edit & Delete Functionality

**AC-4.4.1** Edit button in carousel opens edit modal
**AC-4.4.2** Edit modal shows: current photo preview, editable caption, editable tags, save/cancel
**AC-4.4.3** Save button updates IndexedDB entry and refreshes carousel
**AC-4.4.4** Delete button shows confirmation dialog: "Delete this photo? This action cannot be undone."
**AC-4.4.5** Confirmed delete removes photo from IndexedDB and refreshes gallery
**AC-4.4.6** Deleted photos no longer appear in grid or carousel
**AC-4.4.7** Carousel navigates to next photo after delete (or closes if last photo)

### Story 4.5: Photo Gallery Navigation Integration

**AC-4.5.1** Top navigation bar includes "Photos" tab with camera icon
**AC-4.5.2** Active tab highlighted to show current view (Home vs Photos)
**AC-4.5.3** Navigation transitions smoothly between Home and Photos (no jarring reloads)
**AC-4.5.4** Photo count badge on Photos tab (e.g., "23" photos) - optional
**AC-4.5.5** Deep linking supported: direct URL access to photo gallery
**AC-4.5.6** Browser back button works correctly (Photos → Home navigation)

**Total Acceptance Criteria:** 35 atomic, testable criteria across 5 stories

## Traceability Mapping

| AC ID        | Spec Section      | Component/Module                 | Test Approach                                               |
| ------------ | ----------------- | -------------------------------- | ----------------------------------------------------------- |
| **AC-4.1.1** | Services          | Navigation, PhotoGallery         | E2E: Navigate to Photos tab, verify gallery renders         |
| **AC-4.1.2** | Services          | PhotoUpload component            | E2E: Click upload button, verify file picker opens          |
| **AC-4.1.3** | Services          | PhotoUpload preview              | E2E: Select file, verify preview shown with metadata        |
| **AC-4.1.4** | Data Models       | Photo.caption                    | E2E: Enter caption (max 500 chars), verify saved            |
| **AC-4.1.5** | Data Models       | Photo.tags                       | E2E: Enter tags (comma-separated), verify parsed and saved  |
| **AC-4.1.6** | APIs              | imageCompressionService          | Unit test: Verify compression (3MB → <500KB)                |
| **AC-4.1.7** | APIs              | photoStorageService.create()     | E2E: Upload photo, verify in IndexedDB photos store         |
| **AC-4.1.8** | NFR Observability | Toast notification               | E2E: Upload complete, verify success message shown          |
| **AC-4.1.9** | NFR Reliability   | Error handling                   | E2E: Test errors (large file, wrong format, quota exceeded) |
| **AC-4.2.1** | Services          | PhotoGallery grid layout         | E2E: Verify responsive grid (2-3 mobile, 3-4 desktop)       |
| **AC-4.2.2** | Workflows         | Photo query sorting              | E2E: Upload 3 photos, verify newest first in grid           |
| **AC-4.2.3** | Services          | Grid item hover/tap              | E2E: Hover/tap grid item, verify caption overlay shown      |
| **AC-4.2.4** | NFR Performance   | Lazy loading                     | E2E: Upload 40 photos, verify pagination (20 at a time)     |
| **AC-4.2.5** | Services          | Empty state                      | E2E: New user, verify empty state message shown             |
| **AC-4.2.6** | Services          | Loading indicator                | E2E: Verify spinner shown during IndexedDB load             |
| **AC-4.2.7** | Workflows         | Grid to carousel navigation      | E2E: Tap photo, verify carousel opens                       |
| **AC-4.3.1** | Services          | PhotoCarousel modal              | E2E: Tap grid photo, verify full-screen carousel opens      |
| **AC-4.3.2** | APIs              | Swipe gesture navigation         | E2E: Swipe left/right, verify photo transitions             |
| **AC-4.3.3** | Services          | Photo display sizing             | Visual test: Verify photo fills screen, aspect preserved    |
| **AC-4.3.4** | Services          | Caption/tags display             | E2E: Verify caption and tags shown below photo              |
| **AC-4.3.5** | Services          | Close carousel                   | E2E: Click close button, verify carousel exits              |
| **AC-4.3.6** | Services          | Keyboard navigation              | E2E: Arrow keys navigate, Escape closes                     |
| **AC-4.3.7** | NFR Performance   | Framer Motion animations         | Visual test: Verify smooth 300ms transitions                |
| **AC-4.3.8** | Services          | Edit/Delete buttons              | E2E: Verify buttons visible in carousel top bar             |
| **AC-4.4.1** | Services          | PhotoEditModal                   | E2E: Click Edit, verify modal opens                         |
| **AC-4.4.2** | Services          | Edit form fields                 | E2E: Verify photo preview, editable fields                  |
| **AC-4.4.3** | APIs              | photoStorageService.update()     | E2E: Edit photo, save, verify IndexedDB updated             |
| **AC-4.4.4** | Services          | Delete confirmation              | E2E: Click Delete, verify confirmation dialog               |
| **AC-4.4.5** | APIs              | photoStorageService.delete()     | E2E: Confirm delete, verify removed from IndexedDB          |
| **AC-4.4.6** | Workflows         | Gallery refresh after delete     | E2E: Delete photo, verify no longer in grid                 |
| **AC-4.4.7** | Services          | Carousel navigation after delete | E2E: Delete photo, verify navigates to next or closes       |
| **AC-4.5.1** | Services          | Navigation integration           | E2E: Verify Photos tab with camera icon in top nav          |
| **AC-4.5.2** | Services          | Active tab highlighting          | E2E: Navigate to Photos, verify active state styling        |
| **AC-4.5.3** | Services          | Smooth transitions               | E2E: Navigate Home ↔ Photos, verify no reloads             |
| **AC-4.5.4** | Services          | Photo count badge                | E2E: Upload 5 photos, verify "5" badge on tab               |
| **AC-4.5.5** | Services          | Deep linking                     | E2E: Navigate to /photos directly, verify gallery loads     |
| **AC-4.5.6** | Services          | Browser back button              | E2E: Photos → Home, click back, verify returns to Photos    |

## Risks, Assumptions, Open Questions

### Risks

**R1: IndexedDB Quota Exceeded with Large Photo Collection (HIGH)**

- **Risk:** User uploads 150+ photos, exhausts typical 50MB IndexedDB quota
- **Impact:** Future uploads fail, app becomes unusable for photo feature
- **Mitigation:** Aggressive compression (target 300KB per photo), quota monitoring with 80% warning, suggest deleting old photos, implement export/archive feature
- **Owner:** Story 4.1

**R2: Client-Side Compression Performance on Low-End Devices (MEDIUM)**

- **Risk:** 5MP photo compression takes >5 seconds on older mobile devices
- **Impact:** Poor user experience, users abandon upload flow
- **Mitigation:** Show progress indicator during compression, async processing with Web Workers (future enhancement), skip compression for small photos (<1MB)
- **Owner:** Story 4.1

**R3: Memory Leaks from Blob URLs in Carousel (MEDIUM)**

- **Risk:** Carousel navigation creates blob URLs without revoking, causes memory leak
- **Impact:** Browser tab crashes or slows down after viewing many photos
- **Mitigation:** Use useEffect cleanup to revoke URLs, limit simultaneous blob URL creation (preload next/prev only), profile memory usage during testing
- **Owner:** Story 4.3

**R4: Grid Rendering Performance with 100+ Photos (MEDIUM)**

- **Risk:** Rendering 100+ photo thumbnails causes janky scrolling or initial load delay
- **Impact:** Poor user experience, perceived app slowness
- **Mitigation:** Lazy loading (20 photos at a time), virtualization with react-window (future enhancement), thumbnail size optimization (150px max)
- **Owner:** Story 4.2

**R5: Photo Loss on Browser Data Clear (LOW)**

- **Risk:** User clears browser data, loses all photos (no backup/restore mechanism yet)
- **Impact:** Catastrophic data loss, user dissatisfaction
- **Mitigation:** Prominent warning: "Photos stored locally. Clear browser data will delete all photos.", implement export feature (future enhancement), consider IndexedDB backup to file
- **Owner:** Epic 4 general

### Assumptions

**A1: 50MB IndexedDB Quota Sufficient for Typical Use**

- **Assumption:** Average user uploads 50-100 photos, fits within 50MB quota at 350KB avg compressed size
- **Validation:** 100 photos × 350KB = 35MB (70% of 50MB quota, acceptable)
- **Impact if wrong:** User hits quota sooner, needs delete/export features implemented earlier

**A2: Client-Side Compression Quality Acceptable**

- **Assumption:** 80% JPEG quality at 1920px max provides good visual quality for sentimental photos
- **Validation:** Industry standard (Facebook/Instagram use similar compression)
- **Impact if wrong:** Users complain about quality loss; add compression quality setting (future enhancement)

**A3: No Backend Photo Storage Needed**

- **Assumption:** Single-device use case, no cross-device photo sync required per PRD
- **Validation:** PRD Out of Scope: cross-device sync (line 183)
- **Impact if wrong:** Users want photos on multiple devices; would require backend storage (major architecture change)

**A4: Canvas API Performance Sufficient**

- **Assumption:** Native browser Canvas API fast enough for client-side compression (no external library needed)
- **Validation:** Canvas API handles 5MP images in ~1-2 seconds on modern devices
- **Impact if wrong:** Use browser-image-compression library as fallback (adds ~10KB bundle size)

**A5: Photo Gallery Replaces Memories Feature Entirely**

- **Assumption:** Photo gallery satisfies "memories" requirement from PRD (no separate text-based memories needed)
- **Validation:** PRD FR012-FR015 focus on photo gallery only
- **Impact if wrong:** Add text-based memory entries (journal feature) in future epic

### Open Questions

**Q1: Should Thumbnail Generation Be Separate from Full-Resolution Storage?** (Priority: MEDIUM)

- **Question:** Store both full-resolution (compressed) + separate thumbnail (150px) to optimize grid load performance?
- **Impact:** Doubles storage per photo (350KB + 15KB = 365KB), but faster grid rendering
- **Recommendation:** Start without separate thumbnails, monitor grid performance, add if needed
- **Decision needed by:** Story 4.2 implementation

**Q2: What Compression Quality Setting Should Be User-Configurable?** (Priority: LOW)

- **Question:** Allow users to choose compression level (High: 90%, Medium: 80%, Low: 60%)?
- **Impact:** More flexibility vs. more complexity, settings UI needed
- **Recommendation:** Start with fixed 80% quality, add setting if users request it
- **Decision needed by:** Story 4.1 implementation

**Q3: Should Photo Gallery Support Video Upload?** (Priority: LOW)

- **Question:** Add video support (MP4, WebM) in addition to photos?
- **Impact:** Significant storage increase (videos ~10-50MB), separate player UI needed
- **Recommendation:** PRD Out of Scope: video uploads (line 192), defer to future epic
- **Decision needed by:** Epic 4 planning (already decided: out of scope)

**Q4: Should Deleted Photos Go to Trash/Archive First?** (Priority: LOW)

- **Question:** Soft delete with 30-day trash period before permanent deletion?
- **Impact:** Prevents accidental loss, but adds complexity (trash UI, auto-cleanup)
- **Recommendation:** Implement confirmation dialog only for MVP, add trash feature later if requested
- **Decision needed by:** Story 4.4 implementation

**Q5: Should Photo Carousel Support Fullscreen API?** (Priority: LOW)

- **Question:** Use Fullscreen API for true fullscreen viewing (hides browser chrome)?
- **Impact:** Better immersive experience, but requires permission, may confuse users
- **Recommendation:** Use CSS fullscreen modal (100vw/100vh) for MVP, add Fullscreen API if users request
- **Decision needed by:** Story 4.3 implementation

## Test Strategy Summary

### Test Approach Philosophy

**Integration Testing Focus:**

- Epic 4 leverages existing Playwright E2E infrastructure from Epic 2
- Tests validate full user journeys: upload → grid view → carousel → edit/delete
- Focus on critical paths: happy path upload, carousel navigation, quota management
- Photo operations tested with real IndexedDB and blob storage (not mocked)

**Progressive Test Coverage:**

- Story 4.1: E2E upload tests (compression, validation, IndexedDB persistence)
- Story 4.2: E2E grid tests (layout, lazy loading, empty state)
- Story 4.3: E2E carousel tests (swipe navigation, animations, keyboard)
- Story 4.4: E2E edit/delete tests (CRUD operations, confirmation dialogs)
- Story 4.5: E2E navigation tests (tab switching, deep linking)

### Test Coverage Targets

**Epic 4 Feature Coverage (Estimated 20 new test cases):**

| Feature                                       | Test Suite                | Test Count | Story |
| --------------------------------------------- | ------------------------- | ---------- | ----- |
| **Photo Upload**                              | photo-upload.spec.ts      | 5          | 4.1   |
| - Upload photo with compression               |                           | 1          |       |
| - Upload with caption and tags                |                           | 1          |       |
| - File validation (invalid format, too large) |                           | 1          |       |
| - Storage quota exceeded error                |                           | 1          |       |
| - Verify IndexedDB persistence                |                           | 1          |       |
| **Photo Gallery Grid**                        | photo-gallery.spec.ts     | 4          | 4.2   |
| - Grid displays uploaded photos               |                           | 1          |       |
| - Responsive layout (mobile/desktop)          |                           | 1          |       |
| - Empty state (no photos)                     |                           | 1          |       |
| - Lazy loading pagination                     |                           | 1          |       |
| **Photo Carousel**                            | photo-carousel.spec.ts    | 6          | 4.3   |
| - Carousel opens on photo tap                 |                           | 1          |       |
| - Swipe navigation (left/right)               |                           | 2          |       |
| - Keyboard navigation (arrows, Escape)        |                           | 2          |       |
| - Close carousel                              |                           | 1          |       |
| **Photo Edit & Delete**                       | photo-edit-delete.spec.ts | 3          | 4.4   |
| - Edit photo caption and tags                 |                           | 1          |       |
| - Delete photo with confirmation              |                           | 1          |       |
| - Gallery refreshes after delete              |                           | 1          |       |
| **Navigation Integration**                    | navigation.spec.ts        | 2          | 4.5   |
| - Photos tab navigation                       |                           | 1          |       |
| - Deep linking to photo gallery               |                           | 1          |       |

**Total:** 20 test cases × 3 browsers (Chromium, Firefox, WebKit) = 60 test executions

### Test Execution Strategy

**Local Development:**

- Command: `npm run test:e2e` (all tests, all browsers)
- Command: `npx playwright test photo-upload.spec.ts --headed` (debug specific suite)
- Parallel execution: 4 workers (inherited from Epic 2)
- Target execution time: < 10 minutes (Epics 1-4 cumulative suite)

**CI (GitHub Actions):**

- Trigger: Push to main, all pull requests (inherited from Epic 2)
- Epic 4 tests run alongside Epic 1-3 tests (cumulative suite)
- Target execution time: < 15 minutes (comprehensive suite)
- PR blocking: Any test failure blocks merge

### Test Data Management

**Photo Test Fixtures:**

```typescript
// tests/fixtures/photos.ts
export const testPhotos = {
  smallJpeg: 'tests/fixtures/test-photo-small.jpg', // 800×600, 150KB
  largeJpeg: 'tests/fixtures/test-photo-large.jpg', // 4032×3024, 3.2MB
  pngImage: 'tests/fixtures/test-photo.png', // 1920×1080, 1.5MB
  invalidFile: 'tests/fixtures/test-document.pdf', // Invalid image file
};

export const testPhotoMetadata: Omit<Photo, 'id' | 'imageBlob'> = {
  caption: 'Our first beach sunset together ❤️',
  tags: ['beach', 'sunset', 'date night'],
  uploadDate: new Date('2025-11-01'),
  originalSize: 3200000,
  compressedSize: 320000,
  width: 1920,
  height: 1440,
  mimeType: 'image/jpeg',
};
```

**Playwright Test Helpers (Enhanced):**

```typescript
// tests/support/helpers/photoHelpers.ts
export async function uploadTestPhoto(
  page: Page,
  photoPath: string,
  caption?: string,
  tags?: string[]
): Promise<void> {
  // Helper to upload photo via UI
}

export async function getPhotoCount(page: Page): Promise<number> {
  // Helper to count photos in IndexedDB
}

export async function clearPhotos(page: Page): Promise<void> {
  // Helper to delete all photos from IndexedDB
}
```

### Definition of Done (Testing Perspective)

**Story 4.1 Complete When:**

- 5 photo upload tests pass (happy path, validation, errors)
- Compression verified (3MB → <500KB)
- IndexedDB persistence validated

**Story 4.2 Complete When:**

- 4 gallery grid tests pass (layout, lazy load, empty state)
- Responsive design validated (mobile/desktop)
- Grid performance acceptable (<500ms load)

**Story 4.3 Complete When:**

- 6 carousel tests pass (swipe, keyboard, animations)
- Smooth 300ms transitions verified visually
- No browser navigation conflicts (Safari tested)

**Story 4.4 Complete When:**

- 3 edit/delete tests pass (CRUD operations)
- Confirmation dialogs validated
- Gallery refreshes correctly after operations

**Story 4.5 Complete When:**

- 2 navigation tests pass (tab switching, deep linking)
- Active tab highlighting verified
- Browser back button works correctly

### Regression Testing

**Epic 1-3 Tests Must Still Pass:**

- All 37 Epic 1 tests (message display, persistence)
- All 25 Epic 3 tests (message library, swipe navigation)
- Target: 0 regressions from Epic 4 changes
- If regression detected: fix before marking story complete

### Performance Testing

**Bundle Size Validation:**

- Pre-Epic 4: ~200KB gzipped (Epic 1-3 baseline)
- Post-Epic 4: < 225KB gzipped (25KB budget)
- Measure: `npm run build && du -h dist/assets/*.js`

**Photo Operation Performance:**

- Upload + compression: < 3 seconds (3MB photo)
- Grid render (20 photos): < 500ms
- Carousel transition: 300ms smooth (60fps)
- Measure: Playwright performance traces

**Lighthouse Score:**

- Pre-Epic 4: > 90 Performance score
- Post-Epic 4: Maintain > 90 (no regression)
- Measure: Lighthouse CI in GitHub Actions
