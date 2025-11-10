# Story 4.2: Photo Gallery Grid View

**Epic:** 4 - Photo Gallery & Memories
**Story ID:** 4.2
**Status:** ready-for-dev
**Assignee:** Dev (Frank)
**Created:** 2025-11-07
**Sprint:** Epic 4 Implementation

---

## User Story

**As** your girlfriend
**I want** to see all my uploaded photos in a grid
**So that** I can browse my photo collection

---

## Story Context

### Epic Goal

Create a beautiful photo gallery where your girlfriend can upload, caption, and browse photos with smooth carousel animations, preserving special moments in a private, emotionally rich interface.

### Story Purpose

Story 4.2 delivers the visual browsing interface for the photo gallery by implementing a responsive grid layout that displays uploaded photos as thumbnail cards. Building directly on Story 4.1's photo upload and storage infrastructure, this story creates the primary photo discovery interface where users can view their entire photo collection at a glance.

The story addresses PRD requirements FR012, FR015 by implementing the gallery view component with responsive grid layout (2-3 columns mobile, 3-4 desktop), lazy loading pagination for performance, and tap-to-view functionality. Photos are loaded from the IndexedDB photos store established in Story 4.1 and displayed sorted by upload date (newest first). Each grid item shows a photo thumbnail with caption overlay on hover/tap, providing visual context before entering full-screen carousel view.

### Position in Epic

- ✅ **Story 4.1** (Complete): Photo upload & storage foundation
- 🔄 **Story 4.2** (Current): Photo Gallery Grid View
- ⏳ **Story 4.3** (Next): Photo Carousel with Animated Transitions
- ⏳ **Story 4.4** (Future): Photo Edit & Delete Functionality
- ⏳ **Story 4.5** (Future): Photo Gallery Navigation Integration

### Dependencies

**Requires:**
- ✅ Story 4.1 complete: photoStorageService operational, Photo types defined, photos store in IndexedDB
- ✅ Zustand photos state slice available from Story 4.1
- ✅ BottomNavigation component with Photos tab from Story 4.1

**Enables:**
- Story 4.3: Carousel will open from grid item taps
- Story 4.4: Edit/delete will be accessible from carousel
- Future features: Photo search, filtering, albums (out of scope for MVP)

### Integration Points

**Photo Loading from IndexedDB:**
- Uses photoStorageService.getAll() from Story 4.1
- Queries photos store sorted by-date index (newest first)
- Loads in batches of 20 for pagination performance

**Zustand Store Integration:**
- Extends photos state with selectedPhotoId for carousel handoff
- Action: loadPhotos() - fetches from IndexedDB and updates state
- Action: selectPhoto(id) - sets selected photo for carousel (Story 4.3)
- Loading state: isLoadingPhotos boolean for spinner display

**Component Architecture:**
- PhotoGallery component (NEW) - main grid container
- PhotoGridItem component (NEW) - individual photo card
- Uses existing BottomNavigation with Photos tab (Story 4.1)
- Prepares for PhotoCarousel handoff (Story 4.3)

**Responsive Grid Layout:**
- Tailwind CSS grid utilities: grid-cols-2 (mobile), grid-cols-3 (tablet), grid-cols-4 (desktop)
- Gap spacing: gap-2 (mobile), gap-4 (desktop)
- Aspect ratio maintained: aspect-square for uniform grid
- Caption overlay: absolute positioned with gradient backdrop

---

## Acceptance Criteria

### AC-4.2.1: Responsive Grid Layout

**Given** photo gallery is open
**When** viewing on different screen sizes
**Then** grid SHALL display:
  - 2 columns on mobile (< 640px width)
  - 3 columns on tablet (640px - 1024px width)
  - 4 columns on desktop (> 1024px width)

**Requirements:**
- Tailwind responsive breakpoints: sm:grid-cols-3, lg:grid-cols-4
- Consistent gap spacing: gap-2 (mobile), gap-4 (desktop)
- Photos maintain square aspect ratio (aspect-square)
- Grid fills available width (w-full)

**Validation:**
- Open gallery on iPhone (375px) → 2 columns displayed
- Open gallery on iPad (768px) → 3 columns displayed
- Open gallery on desktop (1920px) → 4 columns displayed
- Resize browser window → grid adapts responsively

---

### AC-4.2.2: Photos Sorted by Upload Date (Newest First)

**Given** multiple photos uploaded at different times
**When** gallery loads photos from IndexedDB
**Then** photos SHALL be sorted by uploadDate descending (newest first)

**Requirements:**
- Query uses by-date index: getAllFromIndex('photos', 'by-date')
- Result array reversed: photos.reverse() (IndexedDB returns ascending)
- Most recent upload appears at top-left of grid
- Sort order persists across app sessions

**Validation:**
- Upload 3 photos on different days (Day 1, Day 2, Day 3)
- Open gallery → Day 3 photo appears first (top-left)
- Verify order: [Day 3, Day 2, Day 1]

---

### AC-4.2.3: Caption Overlay on Hover/Tap

**Given** grid displays photos with captions
**When** user hovers over photo (desktop) OR taps photo briefly (mobile)
**Then** caption overlay SHALL display:
  - Semi-transparent gradient backdrop
  - Caption text in white (max 2 lines with ellipsis)
  - Smooth fade-in transition (150ms)

**Requirements:**
- Hover state: group/hover:opacity-100 (Tailwind)
- Gradient backdrop: bg-gradient-to-t from-black/60 to-transparent
- Caption styling: text-white text-sm font-medium line-clamp-2
- No overlay if caption is undefined (only show for photos with captions)

**Validation:**
- Desktop: Hover photo with caption "Beach sunset" → caption overlays bottom
- Mobile: Tap photo → caption appears briefly before carousel opens
- Photo without caption → no overlay shown
- Long caption (100 chars) → truncated to 2 lines with "..."

---

### AC-4.2.4: Lazy Loading Pagination

**Given** user has uploaded 50+ photos
**When** gallery initially loads
**Then** first 20 photos SHALL load, with pagination for more

**Requirements:**
- Initial load: photoStorageService.getPage(offset: 0, limit: 20)
- Infinite scroll: Load next 20 when user scrolls near bottom (threshold: 200px)
- Loading indicator: "Loading more photos..." displayed during fetch
- No duplicate photos loaded in pagination
- State management: Track current offset and hasMore flag

**Validation:**
- Upload 40 photos → gallery shows first 20
- Scroll to bottom → next 20 load automatically
- Upload 15 photos → no pagination (all fit on one page)
- IndexedDB query logs show: 2 queries for 40 photos (0-20, 20-40)

---

### AC-4.2.5: Empty State Message

**Given** no photos have been uploaded yet
**When** gallery view opens
**Then** empty state SHALL display:
  - Icon: Camera icon (Lucide camera icon)
  - Message: "No photos yet. Upload your first memory!"
  - Upload button: "Upload Photo" (opens PhotoUpload modal from Story 4.1)

**Requirements:**
- Centered layout: flex flex-col items-center justify-center
- Muted text styling: text-gray-500 dark mode compatible
- Upload button styled as primary CTA: bg-pink-500 text-white
- Empty state takes full grid container height

**Validation:**
- New user opens gallery → sees empty state message
- Click "Upload Photo" button → PhotoUpload modal opens (Story 4.1)
- Upload first photo → empty state disappears, grid displays photo

---

### AC-4.2.6: Loading Spinner During Fetch

**Given** gallery is fetching photos from IndexedDB
**When** loading state is active (isLoadingPhotos: true)
**Then** loading spinner SHALL display:
  - Centered spinner animation
  - Text: "Loading photos..."
  - Spinner styled with theme color (pink)

**Requirements:**
- Spinner component: Lucide Loader2 icon with animate-spin
- Loading state managed by Zustand: isLoadingPhotos boolean
- Spinner visible during: initial load, pagination fetch
- Grid hidden while loading (prevent layout shift)

**Validation:**
- Open gallery first time → see spinner while loading
- Upload 25 photos, scroll to bottom → spinner shows during pagination
- Fast device: spinner visible briefly (< 500ms for 20 photos)

---

### AC-4.2.7: Tap Photo Opens Carousel View

**Given** grid displays photos
**When** user taps any photo in grid
**Then** carousel/lightbox view SHALL open (Story 4.3 implementation)

**Requirements:**
- Click handler: onClick={() => selectPhoto(photo.id)}
- Zustand action: selectPhoto(id) sets selectedPhotoId state
- For Story 4.2: Log selected photo ID (carousel UI in Story 4.3)
- Cursor: cursor-pointer on grid items
- Tap target: min-height 120px (thumb-friendly)

**Validation:**
- Tap photo #5 → console logs: "Selected photo: 5"
- selectedPhotoId state updated to 5
- Story 4.3 will render PhotoCarousel when selectedPhotoId is set

---

## Tasks / Subtasks

- [ ] Task 1: Create PhotoGallery Component (AC: 4.2.1, 4.2.2, 4.2.5)
  - [ ] Subtask 1.1: Create component file src/components/PhotoGallery/PhotoGallery.tsx
  - [ ] Subtask 1.2: Implement responsive grid layout (2-3-4 column breakpoints)
  - [ ] Subtask 1.3: Connect to Zustand photos state
  - [ ] Subtask 1.4: Implement empty state (camera icon, message, upload button)
  - [ ] Subtask 1.5: Add data-testid attributes for E2E testing

- [ ] Task 2: Create PhotoGridItem Component (AC: 4.2.3, 4.2.7)
  - [ ] Subtask 2.1: Create component file src/components/PhotoGallery/PhotoGridItem.tsx
  - [ ] Subtask 2.2: Implement photo thumbnail display (aspect-square, object-cover)
  - [ ] Subtask 2.3: Implement caption overlay with hover/tap reveal
  - [ ] Subtask 2.4: Add onClick handler to call selectPhoto(id)
  - [ ] Subtask 2.5: Add cursor-pointer and accessibility (role, aria-label)

- [ ] Task 3: Extend Zustand Store with Gallery Actions (AC: 4.2.2, 4.2.6, 4.2.7)
  - [ ] Subtask 3.1: Add loadPhotos() action - fetches from photoStorageService.getAll()
  - [ ] Subtask 3.2: Add selectPhoto(id) action - sets selectedPhotoId state
  - [ ] Subtask 3.3: Add isLoadingPhotos state management (set true/false during load)
  - [ ] Subtask 3.4: Call loadPhotos() on app initialization (after photoStorageService init)

- [ ] Task 4: Implement Lazy Loading Pagination (AC: 4.2.4)
  - [ ] Subtask 4.1: Add getPage(offset, limit) method to photoStorageService if missing
  - [ ] Subtask 4.2: Implement infinite scroll hook (useInfiniteScroll or native Intersection Observer)
  - [ ] Subtask 4.3: Add pagination state: currentOffset, hasMore, isLoadingMore
  - [ ] Subtask 4.4: Load next batch when user scrolls near bottom (threshold: 200px)
  - [ ] Subtask 4.5: Display "Loading more photos..." during pagination fetch

- [ ] Task 5: Add Loading Spinner Component (AC: 4.2.6)
  - [ ] Subtask 5.1: Create LoadingSpinner component (Lucide Loader2 with animate-spin)
  - [ ] Subtask 5.2: Display spinner when isLoadingPhotos is true
  - [ ] Subtask 5.3: Center spinner in gallery container
  - [ ] Subtask 5.4: Add "Loading photos..." text below spinner

- [ ] Task 6: Integrate PhotoGallery into App Navigation (AC: 4.2.1)
  - [ ] Subtask 6.1: Update App.tsx to render PhotoGallery when Photos tab is active
  - [ ] Subtask 6.2: Add routing logic (if Photos tab clicked, show PhotoGallery, else DailyMessage)
  - [ ] Subtask 6.3: Test navigation: Home ↔ Photos tab switching

- [ ] Task 7: Create E2E Test Suite for Gallery (AC: All)
  - [ ] Subtask 7.1: Create tests/e2e/photo-gallery.spec.ts
  - [ ] Subtask 7.2: Test: Grid layout displays 2-3-4 columns on different viewports
  - [ ] Subtask 7.3: Test: Empty state shown when no photos uploaded
  - [ ] Subtask 7.4: Test: Photos sorted newest first (upload 3, verify order)
  - [ ] Subtask 7.5: Test: Caption overlay shows on hover (desktop) and tap (mobile)
  - [ ] Subtask 7.6: Test: Lazy loading pagination (upload 40 photos, verify 2 batches)
  - [ ] Subtask 7.7: Test: Loading spinner displays during initial load
  - [ ] Subtask 7.8: Test: Tap photo sets selectedPhotoId state (verify console log or state)

---

## Dev Notes

### Learnings from Previous Story (Story 4.1)

**From Story 4.1 - Photo Upload & Storage (DONE):**

**Service Layer Patterns:**
- photoStorageService singleton established at src/services/photoStorageService.ts
- Methods available: create(), getAll(), getById()
- Need to add: getPage(offset, limit) for pagination support
- IndexedDB photos store uses by-date index for chronological sorting
- Error handling: Try/catch with console logging and graceful fallbacks

**IndexedDB Photo Loading:**
- Use idb library: `await db.getAllFromIndex('photos', 'by-date')`
- Returns photos in ascending order (oldest first) - MUST reverse array
- Photo objects include: id, imageBlob, caption, tags, uploadDate, compressedSize
- Blob display: Use URL.createObjectURL(photo.imageBlob) to generate image URL
- IMPORTANT: Clean up blob URLs when component unmounts to prevent memory leaks

**Zustand Store Patterns:**
- Photos state already exists from Story 4.1: photos: Photo[], isLoadingPhotos: boolean
- Action pattern: async functions that update state and call service methods
- Loading states: Set isLoadingPhotos: true before fetch, false after completion
- Error handling: Set photoError state for UI display

**Component Patterns:**
- Use data-testid attributes for E2E tests: `data-testid="photo-gallery-grid"`
- Framer Motion for animations (if needed - Story 4.3 will use heavily)
- Responsive Tailwind: sm:, md:, lg: breakpoints for grid columns
- Empty states: Center with flex, use Lucide icons, provide clear CTA

**Files Created in Story 4.1:**
- src/components/Navigation/BottomNavigation.tsx - Photos tab already exists
- src/services/photoStorageService.ts - REUSE getAll() method
- src/types/index.ts - Photo interface already defined
- src/stores/useAppStore.ts - photos state slice already exists

**Key Insights:**
- Photos tab navigation already implemented (Story 4.1) - just needs gallery view
- PhotoUpload modal works and tested - reuse "Upload Photo" button for empty state
- Storage quota warnings implemented (80% threshold) - gallery should respect
- Compression ensures photos are ~300-500KB - grid performance should be good

### Project Structure Notes

**New Components:**
- src/components/PhotoGallery/PhotoGallery.tsx - Main gallery grid container
- src/components/PhotoGallery/PhotoGridItem.tsx - Individual photo card component
- src/components/PhotoGallery/LoadingSpinner.tsx - Reusable spinner (or inline)

**Zustand Store Extensions:**
- Add selectPhoto(id) action to set selectedPhotoId for carousel handoff
- Enhance loadPhotos() to support pagination if needed
- Add isLoadingMore state for lazy loading pagination indicator

**No New Services:**
- photoStorageService from Story 4.1 sufficient
- May need to add getPage(offset, limit) method for pagination

**Tech Stack (No New Dependencies):**
- Existing Tailwind CSS for responsive grid (grid, grid-cols-*, gap)
- Existing Lucide icons for empty state (Camera icon) and spinner (Loader2)
- Existing zustand for state management
- Existing idb for IndexedDB operations

### Alignment with Unified Project Structure

**Component Co-location:**
- Create src/components/PhotoGallery/ directory (follows PhotoUpload pattern)
- Co-locate PhotoGallery and PhotoGridItem components
- Consistent with established component organization

**Responsive Design Patterns:**
- Use existing Tailwind breakpoints: sm:, md:, lg:
- Follow mobile-first approach (2 columns base, 3-4 on larger screens)
- Existing app is mobile-optimized - maintain consistency

**State Management Consistency:**
- Follow Story 4.1 patterns: actions call service methods, update state
- Loading states managed in Zustand (isLoadingPhotos, isLoadingMore)
- Error handling with photoError state

**Navigation Integration:**
- Photos tab already exists in BottomNavigation (Story 4.1)
- App.tsx needs routing logic to show PhotoGallery when Photos tab active
- Maintain consistent navigation patterns from existing DailyMessage view

### References

**Technical Specifications:**
- [tech-spec-epic-4.md#story-42-photo-gallery-grid-view](../tech-spec-epic-4.md) - Detailed technical requirements for grid layout, lazy loading
- [epics.md#story-42-photo-gallery-grid-view](../epics.md#story-42-photo-gallery-grid-view) - User story and acceptance criteria

**Architecture References:**
- [architecture.md#component-overview](../architecture.md#component-overview) - Component patterns and best practices
- [architecture.md#state-management](../architecture.md#state-management) - Zustand store patterns
- [architecture.md#data-architecture](../architecture.md#data-architecture) - IndexedDB schema and query patterns

**Related Stories:**
- [4-1-photo-upload-storage.md](./4-1-photo-upload-storage.md) - Service layer patterns, photo storage implementation (completed)
- Story 4.3 (next): Photo Carousel - will open from grid item taps, receives selectedPhotoId
- Story 4.4 (future): Photo Edit & Delete - will be accessible from carousel
- Story 4.5 (future): Photo Gallery Navigation Integration - full navigation patterns

---

## Change Log

**2025-11-07** - Story drafted (create-story workflow)

---

## Dev Agent Record

### Context Reference

- [4-2-photo-gallery-grid-view.context.xml](./4-2-photo-gallery-grid-view.context.xml)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

**Implementation Plan (2025-11-07)**

Story 4.2 builds on Story 4.1's photo storage infrastructure. Analysis shows:
- photoStorageService.getAll() already handles by-date sorting ✅
- Zustand photos state exists but needs selectedPhotoId for carousel handoff
- App.tsx navigation exists but needs PhotoGallery component integration
- Missing: getPage() for pagination, PhotoGallery/PhotoGridItem components

**Approach:**
1. Create PhotoGallery component with responsive Tailwind grid (2-3-4 cols)
2. Create PhotoGridItem component with aspect-square thumbnails + caption overlay
3. Extend Zustand: Add selectedPhotoId state and selectPhoto(id) action
4. Add getPage(offset, limit) to photoStorageService for lazy loading
5. Implement infinite scroll with Intersection Observer API
6. Create LoadingSpinner component (Lucide Loader2)
7. Update App.tsx to render PhotoGallery when currentView === 'photos'
8. E2E tests covering all 7 ACs with real IndexedDB/blob validation

**Key Technical Decisions:**
- Use URL.createObjectURL() for blob display (cleanup in useEffect return)
- Tailwind group/hover pattern for caption overlays (AC-4.2.3)
- Intersection Observer threshold: 200px from bottom (AC-4.2.4)
- Initial pagination: 20 photos per batch for performance
- Empty state: Reuse existing PhotoUpload modal for "Upload Photo" button

### Completion Notes List

### File List
