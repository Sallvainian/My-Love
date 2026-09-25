import type { PanInfo } from 'motion/react';
import { AnimatePresence, motion, useMotionValue } from 'motion/react';
import {
  TriangleAlert,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  LoaderCircle,
  Trash,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isOnline } from '../../api/errorHandlers';
import { useFocusTrap } from '../../hooks';
import { usePhotoImage } from '../../hooks/usePhotoImage';
import { offlineMessage } from '../../services/accountDataError';
import type { PhotoWithUrls } from '../../services/photoService';
import { useAppStore } from '../../stores/useAppStore';

interface PhotoViewerProps {
  /** The store's live list: it can change (refresh, upload, delete) while open. */
  photos: PhotoWithUrls[];
  selectedPhotoId: string;
  onClose: () => void;
}

// AC 6.4.2: Swipe gesture configuration
const SWIPE_CONFIDENCE_THRESHOLD = 10000;
const SWIPE_VELOCITY_THRESHOLD = 500;

// AC 6.4.5: Zoom configuration
const MIN_ZOOM = 1;
const DOUBLE_TAP_ZOOM = 2;
const DOUBLE_TAP_DELAY = 300; // ms

/**
 * Full-Screen Photo Viewer Component
 * Story 6.4: Photo viewer with gesture support
 *
 * Features:
 * - Full-screen modal overlay with black background
 * - Close button and Escape key support
 * - Photo navigation with keyboard and gestures
 * - Pinch-to-zoom and double-tap zoom
 * - Pan gesture when zoomed
 * - Swipe-down to close
 * - Photo metadata and caption display
 * - Delete functionality for own photos
 * - Photo preloading (neighbours read from the image cache, or downloaded and cached)
 * - Loading and error states; a placeholder when the photo is not saved on
 *   this device (not cached, offline)
 */
export function PhotoViewer({
  photos,
  selectedPhotoId,
  onClose,
}: PhotoViewerProps) {
  const { deletePhoto } = useAppStore();

  // The shown photo is tracked by id, not index: `photos` is the store's live
  // list, which a refresh or an upload can reorder while the viewer is open.
  // The index is derived from the id each render. Only when that id is gone
  // (its own delete, or removed by a refresh) does the viewer fall back to the
  // index it last stood on, clamped to the list.
  const [currentId, setCurrentId] = useState(selectedPhotoId);
  const [anchorIndex, setAnchorIndex] = useState(() =>
    Math.max(0, photos.findIndex((p) => p.id === selectedPhotoId))
  );
  const foundIndex = photos.findIndex((p) => p.id === currentId);
  const currentIndex =
    foundIndex >= 0 ? foundIndex : Math.min(anchorIndex, Math.max(photos.length - 1, 0));

  // AC 6.4.14: Gesture state management
  const [scale, setScale] = useState(MIN_ZOOM);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // The photo the open confirmation asks about, captured when it opens. The
  // delete targets this id, never whatever photo the viewer shows at click
  // time: a refresh can remove the named photo while the dialog is up, and the
  // viewer then falls back to a different photo at the same index.
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  // Bumped by Retry so the image is read or downloaded again.
  const [retryKey, setRetryKey] = useState(0);

  // AC 6.4.6: Double-tap zoom state
  const [lastTap, setLastTap] = useState(0);

  // AC 6.4.4: Pinch-to-zoom state (removed - not supported by Motion)

  // Motion values for smooth animations
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // AC 6.4.12 & WCAG 2.4.3: Focus trap for modal
  const containerRef = useRef<HTMLDivElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Dismissing the confirmation must hand focus somewhere still mounted: Cancel
  // or Delete takes focus while the dialog is up, and letting it unmount
  // focused would blur to <body>, killing the container-scoped trap for the
  // rest of the session. The delete button is the opener; the container
  // (tabIndex -1) is the fallback for the confirm path, where the new current
  // photo may not be the user's own and the delete button gone with it.
  //
  // The restore runs in an effect, not inside closeDeleteDialog: the viewer's
  // own controls are disabled while the confirmation is up (which is what
  // confines the trap's Tab cycle to Cancel/Delete), and focusing a
  // still-disabled button before the re-enabling render commits is a no-op.
  const restoreAfterDialogRef = useRef(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const closeDeleteDialog = useCallback(() => {
    restoreAfterDialogRef.current = true;
    setShowDeleteDialog(false);
    setDeleteError(null);
  }, []);
  useEffect(() => {
    if (!showDeleteDialog && restoreAfterDialogRef.current) {
      restoreAfterDialogRef.current = false;
      (deleteButtonRef.current ?? containerRef.current)?.focus();
    }
  }, [showDeleteDialog]);

  // The confirmation renders inside containerRef -- stacked visually (z-60) but
  // not in the DOM tree -- so its Escape bubbles to the trap's listener. It has
  // to dismiss the confirmation, not the viewer.
  //
  // Read through refs so the callback stays referentially stable: a new
  // onEscape re-runs useFocusTrap's arming effect, and that re-run moves focus
  // back to the container's first focusable -- the trash button -- stealing it
  // from the Cancel button the confirmation just auto-focused.
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);
  const showDeleteDialogRef = useRef(showDeleteDialog);
  const onCloseRef = useRef(onClose);
  // Layout effect, not passive: handleEscape reads these from a native keydown
  // listener, which can fire in the window between commit and passive flush.
  useLayoutEffect(() => {
    showDeleteDialogRef.current = showDeleteDialog;
    onCloseRef.current = onClose;
  }, [showDeleteDialog, onClose]);
  // A failed delete keeps the confirmation open with its alert. The Delete
  // button that held focus was disabled for the request, so hand focus to
  // Cancel -- still inside the dialog, and the safe choice on an irreversible
  // action -- once the re-enabling render has committed.
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (deleteError && !isDeleting) {
      cancelButtonRef.current?.focus();
    }
  }, [deleteError, isDeleting]);

  const handleCancelDialog = useCallback(() => {
    if (isDeletingRef.current) return;
    closeDeleteDialog();
  }, [closeDeleteDialog]);

  const handleEscape = useCallback(() => {
    if (showDeleteDialogRef.current) {
      // Suppressed mid-delete: dismissing while the request is in flight leaves
      // isDeletingRef set, so the next Delete would be silently swallowed and
      // the pending finally would close whatever confirmation is open by then.
      if (isDeletingRef.current) return;
      closeDeleteDialog();
      return;
    }
    onCloseRef.current();
  }, [closeDeleteDialog]);

  useFocusTrap(containerRef, true, { onEscape: handleEscape });

  const currentPhoto = photos[currentIndex];
  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex < photos.length - 1;

  // The image's intrinsic size is not a layout measurement — the browser hands it to us on
  // the load event, so we record it there instead of reading it back off an element ref
  // afterwards. Reading the ref during render was the original bug: on the first render the
  // <img> is not mounted, so the pan boundaries came back as the zero box and the photo
  // could not be panned until some unrelated re-render recomputed them. With the size in
  // state the boundaries become a pure function of (intrinsic size, zoom) and can be derived
  // during render — no measure-then-setState round trip, and no render where a zoomed photo
  // is stuck with the previous photo's box.
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  // AC 6.4.6: Calculate dynamic pan boundaries based on zoom level
  const dragConstraints = useMemo(() => {
    // A zero size means the image has not reported its dimensions yet — never loaded, or the
    // load failed — so there is nothing to pan inside. Same no-pan box the old unmounted-ref
    // guard returned.
    if (naturalSize.width === 0 || naturalSize.height === 0 || scale <= MIN_ZOOM) {
      return { left: 0, right: 0, top: 0, bottom: 0 };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - 200; // Account for controls and overlays

    // Calculate rendered image size using object-contain logic
    const imgAspect = naturalSize.width / naturalSize.height;
    const viewportAspect = viewportWidth / viewportHeight;

    let renderedWidth: number;
    let renderedHeight: number;

    if (imgAspect > viewportAspect) {
      // Image is wider than viewport
      renderedWidth = viewportWidth * 0.9; // 90% of viewport for padding
      renderedHeight = renderedWidth / imgAspect;
    } else {
      // Image is taller than viewport
      renderedHeight = viewportHeight * 0.9;
      renderedWidth = renderedHeight * imgAspect;
    }

    // Calculate scaled dimensions
    const scaledWidth = renderedWidth * scale;
    const scaledHeight = renderedHeight * scale;

    // How much the image extends beyond the viewport
    const maxX = Math.max(0, (scaledWidth - viewportWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - viewportHeight) / 2);

    return {
      left: -maxX,
      right: maxX,
      top: -maxY,
      bottom: maxY,
    };
  }, [naturalSize, scale]);

  // The shown image: cached Blob, else downloaded and cached, else a placeholder.
  const image = usePhotoImage(currentPhoto?.storage_path, { retryKey });

  // AC 6.4.11: Photo preloading. The neighbours go through the same path, so
  // a neighbour not cached yet is downloaded and cached before it is shown.
  usePhotoImage(canNavigateNext ? photos[currentIndex + 1]?.storage_path : null);
  usePhotoImage(canNavigatePrev ? photos[currentIndex - 1]?.storage_path : null);

  const showImageError = imageError || image.status === 'error';
  const imageNotSaved = !showImageError && image.status === 'unavailable';

  // Return the viewer to an untransformed state waiting on a load. Used when navigating to a
  // different photo and when retrying a failed one — both arrive at the same place.
  const resetTransform = useCallback(() => {
    setScale(MIN_ZOOM);
    x.set(0);
    y.set(0);
    setImageError(false);
    setIsLoading(true);
    // The incoming photo has not reported its size yet, and the outgoing one's is no longer
    // true of anything on screen. Zeroing here holds the same invariant handleImageError
    // does — no image reporting a size means no pan — and closes the window where a
    // double-tap during the new photo's load would size its drag box from the old aspect
    // ratio. The ref-reading effect this replaced got the clearing for free, because
    // key={photo.id} remounts the <img> and naturalWidth is 0 until decode.
    setNaturalSize({ width: 0, height: 0 });
    // A tap that landed before the reset must not pair with one that lands after it.
    // handleDoubleTap only compares `now - lastTap` against DOUBLE_TAP_DELAY, so a stale
    // timestamp makes the next single tap zoom: tap the error card, tap Retry ~200ms later,
    // and a single tap on the freshly loaded photo is still inside the 300ms window. Same
    // shape when navigating — tap photo A, advance, tap photo B quickly. Zero is safe rather
    // than arbitrary: `now` is epoch milliseconds, so the first comparison after a reset is
    // never under the threshold.
    setLastTap(0);
  }, [x, y]);

  // A refresh can remove the photo on screen (deleted on another device). The
  // viewer then shows the photo now at its index: adopt it and reset, as
  // navigation does, so it does not inherit the removed photo's zoom, pan or
  // load error. A layout effect, so the reset lands before the new <img> can
  // report its load.
  useLayoutEffect(() => {
    if (foundIndex >= 0 || !currentPhoto) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt the photo a refresh left on screen
    setCurrentId(currentPhoto.id);
    setAnchorIndex(currentIndex);
    resetTransform();
  }, [foundIndex, currentPhoto, currentIndex, resetTransform]);

  // Navigate to next/previous photo
  const navigatePhoto = useCallback(
    (direction: 'next' | 'prev') => {
      const target =
        direction === 'next' && canNavigateNext
          ? currentIndex + 1
          : direction === 'prev' && canNavigatePrev
            ? currentIndex - 1
            : null;
      if (target === null) return;
      setCurrentId(photos[target].id);
      setAnchorIndex(target);
      resetTransform();
    },
    [canNavigateNext, canNavigatePrev, currentIndex, photos, resetTransform]
  );

  // AC 6.4.1: Prevent body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // AC 6.4.3: Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // useFocusTrap handles Escape whenever focus is inside the container.
        // Focus can still land on <body> -- a focused nav button becoming
        // disabled at either end of the gallery, or a focused Retry button
        // unmounting -- and <body> is an ancestor of the container, so its
        // listener never sees the key again. Cover only that case, so a
        // single Escape still runs the escape path exactly once.
        if (!containerRef.current?.contains(document.activeElement)) {
          handleEscape();
          event.preventDefault();
        }
        return;
      }
      // Navigation is suspended while the delete confirmation is up: it names a
      // specific photo, and moving the viewer behind it would leave the dialog
      // asking about a photo that is no longer on screen.
      if (showDeleteDialog) return;
      switch (event.key) {
        case 'ArrowRight':
          navigatePhoto('next');
          event.preventDefault();
          break;
        case 'ArrowLeft':
          navigatePhoto('prev');
          event.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigatePhoto, showDeleteDialog, handleEscape]);

  // WCAG: Screen reader announcements for photo changes
  useEffect(() => {
    // Create live region for screen reader announcements
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';

    const announcement = `Photo ${currentIndex + 1} of ${photos.length}${
      currentPhoto?.caption ? '. ' + currentPhoto.caption : ''
    }`;
    liveRegion.textContent = announcement;

    document.body.appendChild(liveRegion);

    return () => {
      // Cleanup: remove live region
      if (document.body.contains(liveRegion)) {
        document.body.removeChild(liveRegion);
      }
    };
  }, [currentIndex, photos.length, currentPhoto?.caption]);

  // AC 6.4.2: Swipe navigation
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      // Only allow swipe navigation when not zoomed in
      if (scale > MIN_ZOOM) return;

      const swipe = Math.abs(info.offset.x) * Math.abs(info.velocity.x);

      // Swipe left = next photo (newer)
      if (swipe > SWIPE_CONFIDENCE_THRESHOLD && info.velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
        navigatePhoto('next');
      }
      // Swipe right = previous photo (older)
      else if (swipe > SWIPE_CONFIDENCE_THRESHOLD && info.velocity.x > SWIPE_VELOCITY_THRESHOLD) {
        navigatePhoto('prev');
      }
      // AC 6.4.7: Swipe down to close
      else if (Math.abs(info.offset.y) > 100 && info.velocity.y > 0 && scale === MIN_ZOOM) {
        onClose();
      }

      // Reset position
      x.set(0);
      y.set(0);
    },
    [scale, navigatePhoto, onClose, x, y]
  );

  // AC 6.4.5 & 6.4.6: Double-tap/click zoom
  const handleDoubleTap = useCallback(
    (_event: React.MouseEvent | React.TouchEvent) => {
      const now = Date.now();
      const isDoubleTap = now - lastTap < DOUBLE_TAP_DELAY;

      if (isDoubleTap) {
        // Toggle zoom: 1x <-> 2x
        const newScale = scale === MIN_ZOOM ? DOUBLE_TAP_ZOOM : MIN_ZOOM;
        setScale(newScale);

        // Pan offset handled by motion values x and y
      }

      setLastTap(now);
    },
    [lastTap, scale]
  );

  // AC 6.4.10: Delete photo handler.
  //
  // Navigation waits for the outcome. deletePhoto resolves false rather than
  // rejecting, and on false the viewer stays where it is and the confirmation
  // stays open with an error, so Delete can be retried. On success the store
  // drops the row and the viewer moves to the next photo; only the last photo
  // steps back, and the only photo closes.
  //
  // Re-entry would send a second delete while the first is in flight. The
  // ref is the guard (state lags a render); the state disables the Delete
  // button so a double-tap has nothing to land on. Cancel stays enabled as
  // the trap's one focusable, guarded in its handler instead.
  const handleDeleteConfirm = useCallback(async () => {
    if (isDeletingRef.current) return;
    // The photo the dialog names, resolved by the id captured when it opened.
    // Gone from the list means a refresh removed it (deleted elsewhere): there
    // is nothing left to confirm, and deleting the photo now at its index
    // would permanently delete one the user never chose.
    const deletedIndex = photos.findIndex((p) => p.id === deleteTargetId);
    if (deletedIndex < 0) {
      closeDeleteDialog();
      return;
    }
    // Refused before any request: the dialog stays open with the reason, and
    // the deleteError effect moves focus onto Cancel.
    if (!isOnline()) {
      setDeleteError(offlineMessage('Photos', 'delete'));
      return;
    }
    isDeletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);
    // The index is where the viewer stands if the list changes before the
    // delete returns.
    const photoToDelete = photos[deletedIndex];
    const next = photos[deletedIndex + 1] ?? photos[deletedIndex - 1];
    setAnchorIndex(deletedIndex);
    let deleted = false;

    try {
      // Delete from storage + database + store
      deleted = await deletePhoto(photoToDelete.id);
      if (!deleted) return;

      if (!next) {
        onClose();
      } else {
        setCurrentId(next.id);
        resetTransform();
      }
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
      if (deleted) {
        // Routed through closeDeleteDialog so the post-commit effect places
        // focus: the trash button if the next photo is the user's own, the
        // container otherwise. By then unmounts and re-enables have committed.
        closeDeleteDialog();
      } else {
        // The photo is still here; say so, and leave the dialog open for a
        // retry. The deleteError effect moves focus onto Cancel.
        setDeleteError('Failed to delete photo. Please try again.');
      }
    }
  }, [photos, deleteTargetId, onClose, deletePhoto, resetTransform, closeDeleteDialog]);

  // The confirmation always asks about the photo on screen. When a refresh
  // removes that photo while the dialog is up, the viewer falls back to the
  // photo now at its index, and the dialog would name a photo the user never
  // chose -- so it closes instead. Not mid-delete: the user's own delete drops
  // the row before it resolves, and handleDeleteConfirm closes the dialog then.
  // An effect, not a render-time adjustment: closeDeleteDialog flags the focus
  // restore through a ref, which must not be written during render.
  useEffect(() => {
    if (showDeleteDialog && !isDeleting && currentPhoto?.id !== deleteTargetId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dialog reset when the store's list drops the photo it names
      closeDeleteDialog();
    }
  }, [showDeleteDialog, isDeleting, currentPhoto?.id, deleteTargetId, closeDeleteDialog]);

  // AC 6.4.15: Image loading handlers
  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setIsLoading(false);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    // Clearing the size is what keeps the failure state un-pannable. The <img> unmounts on
    // error, but the outer motion.div keeps its drag and double-tap handlers, so a stale
    // size from the previous photo would hand a zoomed error card a real drag box — and
    // handleDragEnd returns early while zoomed, before it recentres, so the offset would
    // survive a retry with nothing to spring it back.
    setNaturalSize({ width: 0, height: 0 });
    setIsLoading(false);
    setImageError(true);
  }, []);

  // Retry wants exactly what navigation wants: an untransformed viewer waiting on a load. It
  // shares resetTransform rather than restating it, because these two paths silently drifting
  // is the whole bug.
  //
  // Why the tap is stopped here. onClick={handleDoubleTap} is on the outer motion.div, which
  // stays mounted while the image is errored — only the <img> is behind the !imageError
  // guard — and the Retry button is inside it. So one tap on Retry runs both handlers, and
  // handleDoubleTap's setScale lands second. Tap the error card, then tap Retry a moment
  // later, and the second tap reads as a double-tap: the reset is immediately undone and the
  // photo returns at 2x with a live drag box on a card nobody deliberately zoomed. Stopping
  // propagation also keeps this tap from seeding lastTap for the next tap on the photo that
  // is about to load.
  const handleRetryLoad = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      resetTransform();
      setRetryKey((key) => key + 1);
    },
    [resetTransform]
  );

  if (!currentPhoto) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        // AC 6.4.1: Full-screen modal overlay with black background
        className="fixed inset-0 z-50 flex items-center justify-center bg-black"
        data-testid="photo-viewer-overlay"
        // tabIndex -1 keeps this container reachable by focus without adding a
        // tab stop. useFocusTrap binds Escape and the Tab cycle to this element,
        // and everything the user is most likely to click -- the photo, the
        // backdrop, the caption bar -- is non-focusable, so a click would
        // otherwise blur to <body>. <body> is an ancestor, and keydown bubbles
        // upward, so the listener here would never see the event again and both
        // Escape and the trap would go dead for the rest of the session.
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Photo viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* AC 6.4.12: Top controls - Close and Delete buttons.
            Every viewer control (these two, the nav chevrons, and Retry in the
            error card) takes disabled={showDeleteDialog}: the
            confirmation renders inside the trap's container, so without it the
            Tab cycle reaches them under the overlay and Enter operates them --
            navigating or closing behind an open delete confirmation. Disabling
            them also drops them from FOCUSABLE_SELECTOR's button:not([disabled]),
            confining Tab to Cancel/Delete. */}
        <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 z-10 flex gap-2">
          {/* AC 6.4.10: Delete button (own photos only) */}
          {currentPhoto.isOwn && (
            <button
              ref={deleteButtonRef}
              onClick={() => {
                setDeleteTargetId(currentPhoto.id);
                setShowDeleteDialog(true);
              }}
              disabled={showDeleteDialog}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-card transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent text-danger"
              aria-label="Delete photo"
            >
              <Trash className="h-5 w-5" aria-hidden="true" />
            </button>
          )}

          {/* AC 6.4.1: Close button */}
          <button
            onClick={onClose}
            disabled={showDeleteDialog}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent text-ink"
            aria-label="Close viewer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* AC 6.4.12: Navigation buttons */}
        <button
          onClick={() => navigatePhoto('prev')}
          disabled={showDeleteDialog || !canNavigatePrev}
          className="absolute top-1/2 left-4 z-10 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-card transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent text-ink disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>

        <button
          onClick={() => navigatePhoto('next')}
          disabled={showDeleteDialog || !canNavigateNext}
          className="absolute top-1/2 right-4 z-10 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-card transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent text-ink disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next photo"
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>

        {/* AC 6.4.2, 6.4.4, 6.4.5, 6.4.7: Photo with gesture support */}
        <div className="relative flex h-full w-full items-center justify-center p-4">
          <motion.div
            drag={scale === MIN_ZOOM ? true : scale > MIN_ZOOM}
            dragConstraints={dragConstraints}
            dragElastic={scale === MIN_ZOOM ? 0.2 : 0.1}
            onDragEnd={handleDragEnd}
            onClick={handleDoubleTap}
            className="relative cursor-pointer"
            style={{
              x,
              y,
              scale,
              // AC 6.4.13: GPU acceleration for performance
              transform: 'translateZ(0)',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
          >
            {/* AC 6.4.15: Loading spinner */}
            {(isLoading || image.status === 'loading') && !showImageError && !imageNotSaved && (
              <div className="absolute inset-0 flex items-center justify-center">
                <LoaderCircle className="h-12 w-12 animate-spin text-white" />
              </div>
            )}

            {/* AC 6.4.16: Error state */}
            {showImageError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <p className="mb-4">Failed to load photo</p>
                <button
                  onClick={handleRetryLoad}
                  disabled={showDeleteDialog}
                  className="h-11 rounded-full bg-card px-5 text-[15px] font-semibold text-ink transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Listed, but its image is not on this device and cannot be fetched */}
            {imageNotSaved && (
              <div
                className="flex min-h-50 min-w-60 flex-col items-center justify-center gap-2 px-6 text-center text-white"
                data-testid="photo-viewer-not-saved"
              >
                <ImageOff className="h-8 w-8" aria-hidden="true" />
                <p>This photo is not saved on this device</p>
              </div>
            )}

            {/* AC 6.4.1: Photo display */}
            {!showImageError && !imageNotSaved && image.url && (
              <motion.img
                key={currentPhoto.id} // Force remount on photo change
                src={image.url}
                alt={currentPhoto.caption || 'Photo'}
                className="max-h-[calc(100vh-8rem)] max-w-full object-contain"
                style={{ opacity: isLoading ? 0 : 1 }}
                onLoad={handleImageLoad}
                onError={handleImageError}
                draggable={false}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            )}
          </motion.div>
        </div>

        {/* AC 6.4.8, 6.4.9: Photo caption and metadata */}
        <motion.div
          className="absolute right-0 bottom-0 left-0 rounded-t-[20px] border-t border-line bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-ink"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mb-1 text-sm text-muted">
            Photo {currentIndex + 1} of {photos.length} •{' '}
            {currentPhoto.isOwn ? 'Your photo' : 'Partner photo'}
          </div>
          {currentPhoto.caption && (
            <p id="photo-caption" className="line-clamp-2 text-base">
              {currentPhoto.caption}
            </p>
          )}
          <div className="mt-1 text-sm text-muted">
            {new Date(currentPhoto.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </motion.div>

        {/* AC 6.4.10: Delete confirmation dialog */}
        {showDeleteDialog && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-viewer-delete-title"
          >
            <motion.div
              className="mx-4 w-full max-w-md rounded-[20px] bg-card shadow-float"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dtint text-danger">
                  <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 id="photo-viewer-delete-title" className="text-lg font-semibold text-ink">
                  Delete Photo?
                </h3>
              </div>
              <div className="space-y-4 px-5 py-4">
                <p className="text-[15px] text-ink">
                  This photo will be permanently deleted. This action cannot be undone.
                </p>
                {currentPhoto.caption && (
                  <p className="line-clamp-2 rounded-[14px] bg-card2 px-3 py-2 text-sm text-muted italic">
                    "{currentPhoto.caption}"
                  </p>
                )}
                {deleteError && (
                  <div
                    className="rounded-[14px] bg-dtint px-4 py-3 text-sm text-danger"
                    role="alert"
                    data-testid="photo-viewer-delete-error"
                  >
                    {deleteError}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-line px-5 py-4">
                {/* autoFocus: nothing else moves focus into this dialog, and
                    without it a keyboard user is left on the trash button
                    behind the overlay, inside a subtree the confirmation
                    visually covers. Cancel, because delete is irreversible. */}
                {/* Cancel stays enabled mid-delete -- with every other control
                    disabled the trap would have zero focusables and Tab walks
                    out of the modal -- but its handler is guarded like Escape:
                    dismissing mid-flight would orphan the pending finally. */}
                <button
                  ref={cancelButtonRef}
                  autoFocus
                  onClick={handleCancelDialog}
                  className="h-12 rounded-full bg-tint px-5 text-[15px] font-semibold text-accent transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex h-12 items-center gap-2 rounded-full bg-dtint px-5 text-[15px] font-semibold text-danger transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-50"
                >
                  {isDeleting && (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
