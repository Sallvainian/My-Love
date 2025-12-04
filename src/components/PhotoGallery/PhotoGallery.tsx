import { useEffect, useState, useRef, useCallback } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { PhotoGridItem } from './PhotoGridItem';
import { PhotoGridSkeletonGrid } from './PhotoGridSkeleton';
import { PhotoViewer } from './PhotoViewer';
import { photoService } from '../../services/photoService';
import type { PhotoWithUrls } from '../../services/photoService';

interface PhotoGalleryProps {
  onUploadClick?: () => void;
}

// AC-4.2.4: Pagination configuration
const PHOTOS_PER_PAGE = 20;
const SCROLL_THRESHOLD = 200; // pixels from bottom to trigger load

/**
 * Photo Gallery Grid View Component
 * Story 4.2: AC-4.2.1, AC-4.2.2, AC-4.2.4, AC-4.2.5, AC-4.2.6
 *
 * Features:
 * - Responsive grid layout (2-3-4 columns)
 * - Photos sorted newest first (by-date index)
 * - Empty state with upload CTA
 * - Loading spinner during fetch
 * - Lazy loading pagination with Intersection Observer
 */
export function PhotoGallery({ onUploadClick }: PhotoGalleryProps) {
  const { photos: storePhotos, loadPhotos } = useAppStore();

  // AC-4.2.4: Pagination state
  const [photos, setPhotos] = useState<PhotoWithUrls[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Story 6.4: Photo viewer state
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  // Intersection Observer ref for infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  // Retry handler for error state
  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setHasLoadedOnce(false);
    setPhotos([]);
    setCurrentOffset(0);
    setHasMore(true);
    setRetryTrigger((prev) => prev + 1); // Increment to trigger useEffect
  }, []);

  // Load initial page of photos
  useEffect(() => {
    let cancelled = false;

    const loadInitialPhotos = async () => {
      setIsLoading(true);

      try {
        const firstPage = await photoService.getPhotos(PHOTOS_PER_PAGE, 0);

        if (cancelled) return;

        // Batch all state updates together (React 18 automatic batching)
        setPhotos(firstPage);
        setCurrentOffset(firstPage.length);
        setHasMore(firstPage.length === PHOTOS_PER_PAGE);
        setHasLoadedOnce(true);
        setIsLoading(false);

        // BUGFIX: Load photos into store so PhotoCarousel can access them
        await loadPhotos();
      } catch (error) {
        if (cancelled) return;

        console.error('[PhotoGallery] Failed to load initial photos:', error);
        setPhotos([]);
        setHasLoadedOnce(true); // Mark as loaded even on error to show empty state
        setIsLoading(false);
        setError(error instanceof Error ? error.message : 'Failed to load photos');
      }
    };

    loadInitialPhotos();

    return () => {
      cancelled = true;
    };
  }, [loadPhotos, retryTrigger]); // Re-run on mount and when retry is clicked

  // BUG FIX: Refresh gallery when store photos change (after upload)
  // This fixes the issue where uploaded photos don't appear until page refresh
  // P1 FIX: Added cleanup to prevent memory leak on unmount
  useEffect(() => {
    // Skip if we haven't loaded once yet (initial load handles this)
    if (!hasLoadedOnce) return;

    // Check if store has more photos than local state (new upload detected)
    if (storePhotos.length > photos.length) {
      let cancelled = false;

      // Refresh the gallery to show new photos
      const refreshGallery = async () => {
        try {
          const firstPage = await photoService.getPhotos(PHOTOS_PER_PAGE, 0);

          if (cancelled) return;

          setPhotos(firstPage);
          setCurrentOffset(firstPage.length);
          setHasMore(firstPage.length === PHOTOS_PER_PAGE);
        } catch (error) {
          if (cancelled) return;

          console.error('[PhotoGallery] Failed to refresh gallery:', error);
        }
      };

      refreshGallery();

      return () => {
        cancelled = true;
      };
    }
  }, [storePhotos.length, photos.length, hasLoadedOnce]); // Watch store photo count

  // AC-4.2.4: Load next page of photos
  const loadMorePhotos = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    try {
      setIsLoadingMore(true);
      const nextPage = await photoService.getPhotos(PHOTOS_PER_PAGE, currentOffset);

      if (nextPage.length > 0) {
        setPhotos((prev) => [...prev, ...nextPage]);
        setCurrentOffset((prev) => prev + nextPage.length);
        setHasMore(nextPage.length === PHOTOS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('[PhotoGallery] Failed to load more photos:', error);
      setError(error instanceof Error ? error.message : 'Failed to load more photos');
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentOffset, hasMore, isLoadingMore]);

  // AC-4.2.4: Setup Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || isLoadingMore || photos.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Trigger load when scroll target is visible
        if (entries[0].isIntersecting) {
          loadMorePhotos();
        }
      },
      {
        root: null, // viewport
        rootMargin: `${SCROLL_THRESHOLD}px`, // Trigger 200px before reaching element
        threshold: 0.1,
      }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, isLoadingMore, loadMorePhotos, photos.length]);

  // Error state - show error message with retry button
  if (error && photos.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        data-testid="photo-gallery-error-state"
      >
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Failed to load photos
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={handleRetry}
            className="bg-pink-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-pink-600 transition-colors"
            data-testid="photo-gallery-error-retry-button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Story 5.2 AC-4: Skeleton loaders during initial fetch
  // Show skeleton grid if actively loading OR haven't loaded yet
  // Wrapped with photo-gallery testid so E2E tests can proceed during loading
  if ((isLoading || !hasLoadedOnce) && photos.length === 0) {
    return (
      <div data-testid="photo-gallery">
        <PhotoGridSkeletonGrid />
      </div>
    );
  }

  // AC-4.2.5: Empty state when no photos uploaded (after first load attempt)
  // Only show empty state AFTER we've loaded once and confirmed no photos exist
  if (!isLoading && hasLoadedOnce && photos.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        data-testid="photo-gallery-empty-state"
      >
        <div className="text-center max-w-md">
          <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-6">No photos yet. Start building your memories!</p>
          <button
            onClick={onUploadClick}
            className="bg-pink-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-pink-600 transition-colors"
            data-testid="photo-gallery-empty-upload-button"
          >
            Upload Photo
          </button>
        </div>
      </div>
    );
  }

  // AC-4.2.1: Responsive grid layout
  // 3 columns (mobile), 4 columns (desktop md:768px+)
  return (
    <div className="min-h-screen p-4" data-testid="photo-gallery">
      <div
        className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3 w-full"
        data-testid="photo-gallery-grid"
      >
        {photos.map((photo) => (
          <PhotoGridItem
            key={photo.id}
            photo={photo}
            onPhotoClick={() => setSelectedPhotoId(photo.id)}
          />
        ))}
      </div>

      {/* AC-4.2.4: Intersection Observer trigger element for infinite scroll */}
      {hasMore && (
        <div
          ref={observerTarget}
          className="w-full py-8 flex items-center justify-center"
          data-testid="photo-gallery-load-trigger"
        >
          {isLoadingMore && (
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-pink-500 animate-spin mb-2" />
              <p className="text-gray-500 text-sm">Loading more photos...</p>
            </div>
          )}
        </div>
      )}

      {/* Story 5.2 AC-3, Subtask 4.3: "No more photos" indicator when pagination ends */}
      {!hasMore && photos.length > 0 && (
        <div
          className="w-full py-8 flex items-center justify-center"
          data-testid="photo-gallery-end-message"
        >
          <p className="text-gray-400 text-sm">You've reached the end of your memories</p>
        </div>
      )}

      {/* Floating action button (FAB) for uploading more photos */}
      <button
        onClick={onUploadClick}
        className="fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center z-10"
        aria-label="Upload photo"
        data-testid="photo-gallery-upload-fab"
      >
        <Camera className="w-6 h-6" />
      </button>

      {/* Story 6.4: PhotoViewer modal */}
      {selectedPhotoId && (
        <PhotoViewer
          photos={photos}
          selectedPhotoId={selectedPhotoId}
          onClose={() => setSelectedPhotoId(null)}
        />
      )}
    </div>
  );
}
