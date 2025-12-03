# Story 6.4: Full-Screen Photo Viewer with Gestures

Status: ready-for-dev

## Story

As a **user**,
I want **to view photos in full-screen with zoom and swipe gestures**,
so that **I can appreciate our memories in detail and navigate easily between photos**.

## Acceptance Criteria

### AC 6.4.1: Full-Screen Photo Display
**Given** user clicks photo thumbnail in gallery
**When** viewer opens
**Then**
- Photo displays in full-screen modal overlay
- Black/dark background (bg-black or bg-gray-900) for focus
- Photo centered and scaled to fit screen
- Close button (X) visible in top-right corner
- Photo loads at full resolution using signed URL

### AC 6.4.2: Swipe Navigation (Touch Devices)
**Given** user is viewing photo in viewer
**When** they swipe left or right
**Then**
- Swipe left navigates to next photo (newer)
- Swipe right navigates to previous photo (older)
- Smooth transition animation between photos
- Cannot swipe past first/last photo (elastic bounce)
- Swipe gesture threshold: minimum 50px horizontal drag

### AC 6.4.3: Keyboard Navigation
**Given** user is viewing photo in viewer
**When** they press arrow keys
**Then**
- Right arrow navigates to next photo
- Left arrow navigates to previous photo
- Escape key closes viewer
- Cannot navigate past first/last photo

### AC 6.4.4: Pinch-to-Zoom Gesture (Touch Devices)
**Given** user is viewing photo in viewer
**When** they perform pinch gesture
**Then**
- Pinch out zooms in (1x to 3x scale)
- Pinch in zooms out (1x to 0.5x scale, cannot zoom below fit-to-screen)
- Zoom maintains aspect ratio
- Smooth zoom animation without lag
- Zoom persists until photo change or viewer close

### AC 6.4.5: Double-Tap/Click Zoom
**Given** user is viewing photo in viewer
**When** they double-tap (mobile) or double-click (desktop)
**Then**
- First double-tap/click: zoom to 2x at tap location
- Second double-tap/click: zoom back to fit-to-screen (1x)
- Zoom animation smooth (300ms transition)
- Tap location becomes center point of zoom

### AC 6.4.6: Pan Gesture (When Zoomed)
**Given** user has zoomed into photo
**When** they drag the photo
**Then**
- Photo pans to follow drag gesture
- Cannot pan beyond image boundaries
- Elastic resistance at boundaries
- Smooth panning at 60fps
- Pan gesture disabled when at 1x zoom (fit-to-screen)

### AC 6.4.7: Swipe-Down to Close
**Given** user is viewing photo at 1x zoom (not zoomed in)
**When** they swipe down vertically
**Then**
- Viewer closes with fade-out animation
- Returns to gallery at same scroll position
- Swipe threshold: minimum 100px vertical drag
- Swipe-down disabled when zoomed in (pan takes priority)

### AC 6.4.8: Photo Caption Display
**Given** photo has caption
**When** viewer displays photo
**Then**
- Caption displays at bottom of viewer
- Semi-transparent dark background (bg-black/80) for readability
- White text (text-white) with adequate contrast
- Caption can be up to 500 characters
- Long captions truncated with "..." and expandable on tap

### AC 6.4.9: Photo Metadata Display
**Given** user is viewing photo in viewer
**When** metadata section displays
**Then**
- Upload date shown in friendly format ("November 25, 2025" or "2 days ago")
- Photo index shown: "3 of 25"
- Owner indication: "Your photo" or partner's name
- Metadata overlays photo with fade-in animation

### AC 6.4.10: Delete Photo (Own Photos Only)
**Given** user is viewing their own photo
**When** they tap delete button
**Then**
- Delete button visible (trash icon) in viewer controls
- Tapping delete shows confirmation dialog
- Dialog: "Delete this photo? This cannot be undone."
- Confirm button: "Delete" (red, destructive)
- Cancel button: "Cancel" (gray)
- On confirm: photo deleted from storage + database + local state
- Viewer navigates to next photo (or closes if last photo)

### AC 6.4.11: Delete Photo (Partner Photos)
**Given** user is viewing partner's photo
**When** viewer displays
**Then**
- Delete button NOT visible (user cannot delete partner photos)
- Only view and navigation controls available

### AC 6.4.12: Close Viewer
**Given** user wants to close viewer
**When** they click X button or press Escape
**Then**
- Viewer closes with fade-out animation
- Returns to PhotoGallery page at same scroll position
- All gesture handlers cleaned up
- Memory freed (revoke object URLs)

### AC 6.4.13: Performance - Gesture Responsiveness
**Given** user interacts with photo using gestures
**When** gestures are performed
**Then**
- All gesture animations run at 60fps (16.67ms frame time)
- No dropped frames during zoom or pan
- Touch response latency < 100ms
- Smooth transitions between photos < 300ms

### AC 6.4.14: Photo Preloading
**Given** user is viewing photo in viewer
**When** viewer is open
**Then**
- Next photo (right/newer) preloaded in background
- Previous photo (left/older) preloaded in background
- Preloaded images ready for instant display on navigation
- Failed preload does not block current photo display

### AC 6.4.15: Loading State
**Given** photo is loading in viewer
**When** full-resolution image loads
**Then**
- Loading spinner displayed while fetching
- Blur placeholder or thumbnail shown while loading
- Smooth fade-in when full image loads
- Error state if image fails to load (retry button)

### AC 6.4.16: Error Handling
**Given** photo fails to load
**When** error occurs
**Then**
- Error message displayed: "Failed to load photo"
- Retry button available
- User can still navigate to other photos
- Close button remains functional

## Tasks / Subtasks

### Task 1: Create PhotoViewer Modal Component
- [ ] Create `src/components/photos/PhotoViewer.tsx` modal component
- [ ] Implement full-screen modal overlay with black background
- [ ] Accept props: photos array, selectedPhotoId, onClose callback
- [ ] Calculate current photo index from selectedPhotoId
- [ ] Implement modal open/close animations (fade-in/fade-out)
- [ ] Add close button (X icon) in top-right corner
- [ ] Implement Escape key handler for close
- [ ] Add proper z-index for modal stacking (z-50)
- [ ] Prevent body scroll when modal open

### Task 2: Implement Core Photo Display
- [ ] Display selected photo centered in viewport
- [ ] Scale photo to fit screen while maintaining aspect ratio
- [ ] Load full-resolution image using signed URL
- [ ] Show loading spinner while image loads
- [ ] Implement error state with retry button
- [ ] Add blur placeholder while loading
- [ ] Optimize image rendering (object-fit: contain)

### Task 3: Add Swipe Navigation (Touch)
- [ ] Integrate framer-motion gesture library for swipe detection
- [ ] Implement swipe left handler: navigate to next photo
- [ ] Implement swipe right handler: navigate to previous photo
- [ ] Add swipe threshold: 50px horizontal drag minimum
- [ ] Prevent navigation past first/last photo (elastic bounce)
- [ ] Add smooth transition animation between photos
- [ ] Disable swipe when zoomed in (pan takes priority)

### Task 4: Add Keyboard Navigation
- [ ] Implement right arrow key handler: next photo
- [ ] Implement left arrow key handler: previous photo
- [ ] Implement Escape key handler: close viewer
- [ ] Prevent default browser shortcuts for arrow keys
- [ ] Add keyboard event listeners on component mount
- [ ] Clean up event listeners on component unmount

### Task 5: Implement Pinch-to-Zoom Gesture (Touch)
- [ ] Integrate framer-motion pinch gesture detection
- [ ] Implement zoom scale transform (1x to 3x range)
- [ ] Enforce minimum zoom: 1x (fit-to-screen)
- [ ] Enforce maximum zoom: 3x
- [ ] Apply zoom transform to image using CSS transform
- [ ] Maintain aspect ratio during zoom
- [ ] Add smooth zoom animation (200ms transition)

### Task 6: Implement Double-Tap/Click Zoom
- [ ] Detect double-tap on touch devices (2 taps within 300ms)
- [ ] Detect double-click on desktop
- [ ] First double-tap: zoom to 2x centered on tap location
- [ ] Second double-tap: zoom back to 1x (fit-to-screen)
- [ ] Calculate tap location for zoom center point
- [ ] Add smooth zoom animation (300ms transition)

### Task 7: Implement Pan Gesture (When Zoomed)
- [ ] Enable pan gesture when zoom > 1x
- [ ] Disable pan gesture when zoom = 1x
- [ ] Implement drag handler for panning
- [ ] Calculate pan boundaries based on image dimensions
- [ ] Prevent panning beyond image edges
- [ ] Add elastic resistance at boundaries
- [ ] Ensure smooth panning at 60fps

### Task 8: Implement Swipe-Down to Close
- [ ] Detect vertical swipe down gesture (100px threshold)
- [ ] Only enable when zoom = 1x (not zoomed in)
- [ ] Trigger close animation on swipe-down
- [ ] Add smooth fade-out transition
- [ ] Return to gallery at same scroll position

### Task 9: Add Photo Caption and Metadata Overlay
- [ ] Create caption overlay at bottom with dark background
- [ ] Display caption text (if present) with white color
- [ ] Truncate long captions with "..." (expandable on tap)
- [ ] Show upload date in friendly format ("Nov 25, 2025")
- [ ] Show photo index: "3 of 25"
- [ ] Show owner: "Your photo" or partner name
- [ ] Add fade-in animation for overlay

### Task 10: Implement Delete Photo Functionality
- [ ] Add delete button (trash icon) to viewer controls
- [ ] Only show delete button for user's own photos (isOwn check)
- [ ] Implement delete confirmation dialog component
- [ ] Dialog content: "Delete this photo? This cannot be undone."
- [ ] On confirm: call deletePhoto service (storage + database)
- [ ] Update local state (remove photo from photos array)
- [ ] Navigate to next photo or close if last photo
- [ ] Show error toast if delete fails

### Task 11: Implement Photo Preloading
- [ ] Identify next photo (index + 1) for preloading
- [ ] Identify previous photo (index - 1) for preloading
- [ ] Preload adjacent photos using Image() constructor
- [ ] Cache preloaded images for instant display
- [ ] Handle preload failures gracefully (no error shown)
- [ ] Preload only when viewer is open (performance)

### Task 12: Add Navigation Controls UI
- [ ] Add previous button (left arrow icon) on left side
- [ ] Add next button (right arrow icon) on right side
- [ ] Disable previous button when at first photo
- [ ] Disable next button when at last photo
- [ ] Show index indicator: "3 of 25"
- [ ] Add hover effects for buttons
- [ ] Ensure buttons work on mobile and desktop

### Task 13: Implement Loading and Error States
- [ ] Create loading spinner component
- [ ] Show spinner while full-resolution image loads
- [ ] Create error state component with retry button
- [ ] Implement retry logic for failed image loads
- [ ] Show error toast if delete fails
- [ ] Handle network errors gracefully

### Task 14: Add Gesture State Management
- [ ] Create local state for zoom level (1x to 3x)
- [ ] Create local state for pan offset (x, y)
- [ ] Create local state for current photo index
- [ ] Reset zoom/pan when navigating to different photo
- [ ] Persist zoom/pan during same photo interaction
- [ ] Clean up state on component unmount

### Task 15: Integrate PhotoViewer with PhotoGallery
- [ ] Add PhotoViewer to PhotoGallery page
- [ ] Pass photos array from usePhotos hook
- [ ] Pass selectedPhotoId from gallery state
- [ ] Implement onClose callback to clear selection
- [ ] Test viewer opens when thumbnail clicked
- [ ] Test viewer closes and returns to correct scroll position

### Task 16: Write Unit Tests for PhotoViewer
- [ ] Create `tests/unit/components/PhotoViewer.test.tsx`
- [ ] Test viewer renders with photo data
- [ ] Test close button invokes onClose callback
- [ ] Test keyboard navigation (arrow keys, Escape)
- [ ] Test delete button visibility (own vs partner photo)
- [ ] Test photo index calculation
- [ ] Test navigation buttons disabled at boundaries
- [ ] Test caption display with and without caption

### Task 17: Write Integration Tests for Gestures
- [ ] Create `tests/integration/photoViewerGestures.test.tsx`
- [ ] Mock framer-motion gesture handlers
- [ ] Test swipe navigation (left/right)
- [ ] Test pinch-to-zoom gesture
- [ ] Test double-tap zoom
- [ ] Test pan gesture when zoomed
- [ ] Test swipe-down to close

### Task 18: Write E2E Tests for Photo Viewer
- [ ] Create `tests/e2e/photoViewer.spec.ts`
- [ ] Test opening viewer from gallery
- [ ] Test navigation between photos
- [ ] Test closing viewer returns to gallery
- [ ] Test delete workflow (own photo only)
- [ ] Test photo metadata display
- [ ] Test viewer on mobile viewport (gestures)
- [ ] Test viewer on desktop viewport (clicks/keys)

### Task 19: Performance Testing and Optimization
- [ ] Profile gesture response time (< 100ms)
- [ ] Profile animation frame rate (60fps target)
- [ ] Test smooth zoom/pan transitions
- [ ] Profile memory usage with preloaded images
- [ ] Test on low-end mobile devices
- [ ] Optimize image rendering (GPU acceleration)
- [ ] Add will-change CSS hints for transforms

### Task 20: Accessibility Implementation
- [ ] Add ARIA labels for all buttons (close, nav, delete)
- [ ] Ensure keyboard navigation fully functional
- [ ] Add focus trap within modal (tab cycles controls)
- [ ] Add screen reader announcements for photo changes
- [ ] Test with screen reader (NVDA, VoiceOver)
- [ ] Ensure adequate color contrast for overlays
- [ ] Add visible focus indicators for keyboard users

## Dev Notes

### CRITICAL Developer Context

**🔥 PREVENT COMMON MISTAKES:**
- **DO NOT** implement gestures from scratch - use framer-motion's built-in gesture support
- **DO NOT** forget to clean up event listeners - memory leaks are critical here
- **DO NOT** allow navigation past array boundaries - causes crashes
- **DO NOT** forget to reset zoom/pan state when changing photos
- **DO NOT** show delete button on partner photos - security/trust issue
- **DO NOT** skip preloading - it's essential for smooth UX
- **DO NOT** forget focus trap - keyboard users can't escape without it
- **DO NOT** ignore performance - gesture lag destroys UX

### Architecture Alignment

**Component Structure:**
- `src/components/photos/PhotoViewer.tsx` - NEW full-screen modal component
- `src/components/photos/DeletePhotoDialog.tsx` - NEW confirmation dialog
- Pattern: Modal overlay with gesture handlers and state management

**Integration with PhotoGallery:**
```typescript
// In PhotoGallery.tsx (already exists from Story 6.3)
const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
const { photos } = usePhotos();

const handlePhotoClick = (photoId: string) => {
  setSelectedPhotoId(photoId); // Opens PhotoViewer
};

const handleViewerClose = () => {
  setSelectedPhotoId(null); // Closes PhotoViewer
};

// Render PhotoViewer conditionally
{selectedPhotoId && (
  <PhotoViewer
    photos={photos}
    selectedPhotoId={selectedPhotoId}
    onClose={handleViewerClose}
  />
)}
```

**Gesture Library Integration:**
```typescript
// Use framer-motion's gesture support
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';

// Swipe navigation
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onDragEnd={(event, info) => handleSwipe(info)}
>
  {/* Photo content */}
</motion.div>

// Pinch-to-zoom (touch devices)
<motion.div
  style={{ scale }}
  onPinch={(event, info) => handlePinch(info)}
>
  <img src={photo.fullUrl} alt={photo.caption} />
</motion.div>
```

### Learnings from Story 6.3 (Photo Gallery Grid View)

**Available Data:**
- `photos` array from `usePhotos` hook with `PhotoWithUrls` type
- Each photo includes: `signedUrl`, `caption`, `created_at`, `isOwn`
- Photos already sorted by `created_at DESC`

**Component Integration:**
- PhotoGallery page already has state for `selectedPhotoId`
- Click handler on PhotoThumbnail already exists
- Just need to conditionally render PhotoViewer when `selectedPhotoId` is set

**Existing Services:**
- `photoService.deletePhoto(photoId)` - **ALREADY EXISTS** from Story 6.0
- `photosSlice.deletePhoto(photoId)` - **ALREADY EXISTS** for state management
- No new services needed for delete functionality

**Recent Code Patterns:**
```typescript
// From recent commits - Broadcast API pattern for realtime
// Use for future enhancement: real-time photo additions visible
// Pattern: useRealtimeMessages hook structure can be adapted

// React-window API pattern (from mood history)
// If virtual scrolling needed in future for huge photo sets
// Current implementation: standard array mapping is sufficient

// Error handling pattern (from all recent stories)
try {
  await photoService.deletePhoto(photoId);
  // Optimistic UI update
  deletePhoto(photoId);
} catch (error) {
  console.error('Failed to delete photo:', error);
  // Show error toast
}
```

### Framer Motion Gesture Patterns

**Swipe Navigation Pattern:**
```typescript
const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

const handleDragEnd = (event: any, info: PanInfo) => {
  const swipe = swipePower(info.offset.x, info.velocity.x);

  if (swipe < -swipeConfidenceThreshold && currentIndex < photos.length - 1) {
    setCurrentIndex(currentIndex + 1); // Swipe left = next photo
  } else if (swipe > swipeConfidenceThreshold && currentIndex > 0) {
    setCurrentIndex(currentIndex - 1); // Swipe right = previous photo
  }
};

<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.1}
  onDragEnd={handleDragEnd}
  animate={{ x: 0 }} // Reset position after swipe
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
  <img src={currentPhoto.fullUrl} alt={currentPhoto.caption} />
</motion.div>
```

**Pinch-to-Zoom Pattern:**
```typescript
const [scale, setScale] = useState(1);
const scaleMotionValue = useMotionValue(1);

const handlePinch = (event: any, info: any) => {
  // info.scale gives pinch scale (1 = no change, 2 = double size)
  const newScale = Math.max(0.5, Math.min(3, info.scale));
  setScale(newScale);
  scaleMotionValue.set(newScale);
};

<motion.div
  style={{ scale: scaleMotionValue }}
  onPinchStart={() => console.log('Pinch started')}
  onPinch={handlePinch}
  onPinchEnd={() => console.log('Pinch ended')}
>
  <img src={currentPhoto.fullUrl} alt={currentPhoto.caption} />
</motion.div>
```

**Pan Gesture (When Zoomed):**
```typescript
const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

const handlePan = (event: any, info: PanInfo) => {
  if (scale <= 1) return; // Only allow pan when zoomed in

  // Calculate boundaries based on scaled image size
  const maxPanX = (imageWidth * scale - viewportWidth) / 2;
  const maxPanY = (imageHeight * scale - viewportHeight) / 2;

  const newOffsetX = Math.max(-maxPanX, Math.min(maxPanX, info.offset.x));
  const newOffsetY = Math.max(-maxPanY, Math.min(maxPanY, info.offset.y));

  setPanOffset({ x: newOffsetX, y: newOffsetY });
};

<motion.div
  style={{
    scale,
    x: panOffset.x,
    y: panOffset.y,
  }}
  drag={scale > 1}
  dragConstraints={{
    left: -maxPanX,
    right: maxPanX,
    top: -maxPanY,
    bottom: maxPanY,
  }}
  dragElastic={0.1}
  onPan={handlePan}
>
  <img src={currentPhoto.fullUrl} alt={currentPhoto.caption} />
</motion.div>
```

**Double-Tap Zoom Pattern:**
```typescript
const [lastTap, setLastTap] = useState(0);
const doubleTapDelay = 300; // ms

const handleTap = (event: React.MouseEvent | React.TouchEvent) => {
  const now = Date.now();
  const isDoubleTap = now - lastTap < doubleTapDelay;

  if (isDoubleTap) {
    // Toggle zoom: 1x <-> 2x
    const newScale = scale === 1 ? 2 : 1;
    setScale(newScale);

    // Get tap location for zoom center
    const rect = event.currentTarget.getBoundingClientRect();
    const x = 'clientX' in event ? event.clientX : event.touches[0].clientX;
    const y = 'clientY' in event ? event.clientY : event.touches[0].clientY;

    // Center zoom on tap location
    // (implementation varies based on viewport size)
  } else {
    setLastTap(now);
  }
};

<motion.div
  onClick={handleTap}
  onTouchEnd={handleTap}
  animate={{ scale }}
  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
>
  <img src={currentPhoto.fullUrl} alt={currentPhoto.caption} />
</motion.div>
```

### Photo Preloading Strategy

**Preload Adjacent Photos:**
```typescript
useEffect(() => {
  if (!photos || photos.length === 0) return;

  const preloadImage = (url: string) => {
    const img = new Image();
    img.src = url;
  };

  // Preload next photo
  if (currentIndex < photos.length - 1) {
    const nextPhoto = photos[currentIndex + 1];
    if (nextPhoto.fullUrl) {
      preloadImage(nextPhoto.fullUrl);
    }
  }

  // Preload previous photo
  if (currentIndex > 0) {
    const prevPhoto = photos[currentIndex - 1];
    if (prevPhoto.fullUrl) {
      preloadImage(prevPhoto.fullUrl);
    }
  }
}, [currentIndex, photos]);
```

### Delete Photo Workflow

**Delete Confirmation Dialog:**
```typescript
// DeletePhotoDialog.tsx
interface DeletePhotoDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  photoCaption?: string;
}

const DeletePhotoDialog: React.FC<DeletePhotoDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  photoCaption,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold mb-2">Delete Photo?</h3>
        <p className="text-gray-600 mb-4">
          This photo will be permanently deleted. This action cannot be undone.
        </p>
        {photoCaption && (
          <p className="text-sm text-gray-500 italic mb-4">"{photoCaption}"</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Delete Handler in PhotoViewer:**
```typescript
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const { deletePhoto } = usePhotos();

const handleDelete = async () => {
  const photoToDelete = photos[currentIndex];

  try {
    // Optimistic update: navigate first
    const nextIndex = currentIndex < photos.length - 1 ? currentIndex : currentIndex - 1;

    // If last photo, close viewer
    if (photos.length === 1) {
      onClose();
    } else {
      setCurrentIndex(nextIndex);
    }

    // Delete from service (storage + database)
    await deletePhoto(photoToDelete.id);

    // Success toast
    toast.success('Photo deleted');
  } catch (error) {
    console.error('Failed to delete photo:', error);
    toast.error('Failed to delete photo. Please try again.');
  } finally {
    setShowDeleteDialog(false);
  }
};
```

### Keyboard Navigation Implementation

**Event Listeners:**
```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
        if (currentIndex < photos.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
        break;
      case 'ArrowLeft':
        if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
        break;
      case 'Escape':
        onClose();
        break;
      default:
        return;
    }
    event.preventDefault(); // Prevent browser default shortcuts
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [currentIndex, photos.length, onClose]);
```

**Focus Trap for Accessibility:**
```typescript
import { useEffect, useRef } from 'react';

const useFocusTrap = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus(); // Focus first element on mount

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, []);

  return containerRef;
};
```

### Performance Optimization

**GPU-Accelerated Transforms:**
```css
/* Add to PhotoViewer component styles */
.photo-viewer-image {
  transform: translateZ(0); /* Force GPU acceleration */
  will-change: transform; /* Hint for browser optimization */
  backface-visibility: hidden; /* Prevent flickering */
}
```

**Gesture Performance:**
```typescript
// Use requestAnimationFrame for smooth gesture updates
const handleGestureUpdate = useCallback((info: any) => {
  requestAnimationFrame(() => {
    // Update transform state
    setTransform({
      scale: info.scale,
      x: info.offset.x,
      y: info.offset.y,
    });
  });
}, []);
```

**Memory Management:**
```typescript
useEffect(() => {
  // Cleanup on unmount
  return () => {
    // Revoke object URLs to free memory
    if (currentPhotoUrl) {
      URL.revokeObjectURL(currentPhotoUrl);
    }

    // Clear preloaded images
    preloadedImages.current.clear();
  };
}, []);
```

### Accessibility Requirements

**ARIA Labels:**
```typescript
<div
  role="dialog"
  aria-modal="true"
  aria-label="Photo viewer"
  aria-describedby="photo-caption"
>
  <button
    aria-label="Close viewer"
    onClick={onClose}
  >
    <X className="w-6 h-6" />
  </button>

  <button
    aria-label="Previous photo"
    onClick={handlePrevious}
    disabled={currentIndex === 0}
    aria-disabled={currentIndex === 0}
  >
    <ChevronLeft className="w-8 h-8" />
  </button>

  <button
    aria-label="Next photo"
    onClick={handleNext}
    disabled={currentIndex === photos.length - 1}
    aria-disabled={currentIndex === photos.length - 1}
  >
    <ChevronRight className="w-8 h-8" />
  </button>

  {currentPhoto.isOwn && (
    <button
      aria-label="Delete photo"
      onClick={() => setShowDeleteDialog(true)}
    >
      <Trash2 className="w-6 h-6" />
    </button>
  )}
</div>
```

**Screen Reader Announcements:**
```typescript
const announcePhotoChange = (index: number, total: number) => {
  const announcement = `Photo ${index + 1} of ${total}`;

  // Create temporary live region for announcement
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.className = 'sr-only'; // Screen reader only
  liveRegion.textContent = announcement;

  document.body.appendChild(liveRegion);

  setTimeout(() => {
    document.body.removeChild(liveRegion);
  }, 1000);
};

useEffect(() => {
  announcePhotoChange(currentIndex, photos.length);
}, [currentIndex, photos.length]);
```

### UI/UX Requirements

**Modal Overlay Styling:**
```typescript
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
  {/* Photo viewer content */}
</div>
```

**Photo Container:**
```typescript
<div className="relative w-full h-full flex items-center justify-center">
  <motion.img
    src={currentPhoto.fullUrl}
    alt={currentPhoto.caption || 'Photo'}
    className="max-w-full max-h-full object-contain"
    style={{ scale, x: panOffset.x, y: panOffset.y }}
  />
</div>
```

**Controls Overlay:**
```typescript
{/* Top controls */}
<div className="absolute top-4 right-4 z-10 flex gap-2">
  {currentPhoto.isOwn && (
    <button
      onClick={() => setShowDeleteDialog(true)}
      className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"
    >
      <Trash2 className="w-6 h-6 text-white" />
    </button>
  )}
  <button
    onClick={onClose}
    className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"
  >
    <X className="w-6 h-6 text-white" />
  </button>
</div>

{/* Navigation arrows */}
<button
  onClick={handlePrevious}
  disabled={currentIndex === 0}
  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
>
  <ChevronLeft className="w-8 h-8 text-white" />
</button>

<button
  onClick={handleNext}
  disabled={currentIndex === photos.length - 1}
  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
>
  <ChevronRight className="w-8 h-8 text-white" />
</button>

{/* Bottom metadata overlay */}
<div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white p-4">
  <div className="text-sm text-gray-300 mb-1">
    Photo {currentIndex + 1} of {photos.length} • {currentPhoto.isOwn ? 'Your photo' : partnerName}
  </div>
  {currentPhoto.caption && (
    <p id="photo-caption" className="text-base">
      {currentPhoto.caption}
    </p>
  )}
  <div className="text-sm text-gray-400 mt-1">
    {formatDate(currentPhoto.created_at)}
  </div>
</div>
```

### Testing Standards

**Test Coverage Requirements:**
- PhotoViewer component: 100% coverage
- DeletePhotoDialog component: 100% coverage
- Gesture handlers: 90%+ coverage
- Integration with PhotoGallery: 100% coverage
- E2E viewer workflow: Full user journey

**Key Test Scenarios:**
- Viewer opens with correct photo
- Navigation between photos works (swipe, keyboard, buttons)
- Zoom gestures work correctly (pinch, double-tap)
- Pan gesture works when zoomed
- Delete workflow (confirmation, execution, state update)
- Close viewer returns to correct scroll position
- Keyboard shortcuts functional (arrows, Escape)
- Accessibility (screen reader, focus trap)
- Performance (60fps gestures, smooth transitions)

**E2E Test Example:**
```typescript
// tests/e2e/photoViewer.spec.ts
test('Photo viewer workflow', async ({ page }) => {
  await page.goto('/photos');

  // Open viewer
  await page.click('[data-testid="photo-thumbnail-0"]');
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Navigate to next photo
  await page.click('[aria-label="Next photo"]');
  await expect(page.locator('text=Photo 2 of')).toBeVisible();

  // Navigate via keyboard
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('text=Photo 1 of')).toBeVisible();

  // Close viewer
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});

test('Delete own photo', async ({ page }) => {
  await page.goto('/photos');
  await page.click('[data-testid="photo-thumbnail-0"]'); // Own photo

  // Click delete button
  await expect(page.locator('[aria-label="Delete photo"]')).toBeVisible();
  await page.click('[aria-label="Delete photo"]');

  // Confirm deletion
  await expect(page.locator('text=Delete Photo?')).toBeVisible();
  await page.click('text=Delete');

  // Verify photo removed
  await expect(page.locator('text=Photo deleted')).toBeVisible();
});

test('Cannot delete partner photo', async ({ page }) => {
  await page.goto('/photos');
  await page.click('[data-testid="partner-photo-thumbnail-0"]');

  // Delete button should not exist
  await expect(page.locator('[aria-label="Delete photo"]')).not.toBeVisible();
});
```

### Integration Points

**PhotoGallery Integration (Story 6.3):**
- PhotoGallery already has `selectedPhotoId` state
- PhotoGallery already has `handlePhotoClick` to set selection
- Just need to render PhotoViewer when `selectedPhotoId` is set
- PhotoViewer receives `photos` array from `usePhotos` hook

**PhotoUploader Integration (Story 6.2):**
- After upload, new photo appears in gallery
- Gallery can open viewer to newly uploaded photo
- No changes needed to PhotoUploader

**usePhotos Hook Integration:**
- Hook already provides `deletePhoto(photoId)` action
- PhotoViewer calls `deletePhoto` on confirmation
- State automatically updates to remove photo

### Project Structure

**New Files:**
- `src/components/photos/PhotoViewer.tsx` - Main viewer component
- `src/components/photos/DeletePhotoDialog.tsx` - Confirmation dialog
- `tests/unit/components/PhotoViewer.test.tsx` - Unit tests
- `tests/unit/components/DeletePhotoDialog.test.tsx` - Unit tests
- `tests/integration/photoViewerGestures.test.tsx` - Gesture integration tests
- `tests/e2e/photoViewer.spec.ts` - E2E tests

**Modified Files:**
- `src/pages/PhotoGallery.tsx` - Add PhotoViewer integration
- Possibly: `src/stores/slices/photosSlice.ts` - If delete action needs updates

**No Changes Needed:**
- `src/services/photoService.ts` - Delete already implemented
- `src/hooks/usePhotos.ts` - Delete action already exists
- `src/components/photos/PhotoUploader.tsx` - Works independently

### References

- [Source: docs/05-Epics-Stories/epics.md#Story-6.4-Full-Screen-Photo-Viewer-with-Gestures]
- [Source: docs/05-Epics-Stories/tech-spec-epic-6.md#Story-6-4-Full-Screen-Photo-Viewer-with-Gestures]
- [Source: docs/05-Epics-Stories/6-3-photo-gallery-grid-view.md#Dev-Notes]
- [Source: docs/05-Epics-Stories/6-0-photo-storage-schema-buckets-setup.md#RLS-Policies]
- [Source: docs/02-Architecture/architecture.md#Component-Architecture]
- [Source: docs/01-PRD/prd.md#FR34-Photo-Viewer-with-Gestures]
- [Source: Framer Motion Docs: Gestures]
- [Source: MDN Web Docs: Touch Events]
- [Source: Web.dev: Accessible Modal Dialogs]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List
