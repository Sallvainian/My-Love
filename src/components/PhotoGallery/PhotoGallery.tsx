import { useEffect, useState, useRef, useCallback } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { PhotoGridItem } from './PhotoGridItem';
import { PhotoGridSkeletonGrid } from './PhotoGridSkeleton';
import { photoStorageService } from '../../services/photoStorageService';
import type { Photo } from '../../types';

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
  const { selectPhoto, photos: storePhotos, loadPhotos } = useAppStore();

  // AC-4.2.4: Pagination state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

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
    setRetryTrigger(prev => prev + 1); // Increment to trigger useEffect
  }, []);

  // Load initial page of photos
  useEffect(() => {
    let cancelled = false;

    const loadInitialPhotos = async () => {
      console.log('[PhotoGallery] loadInitialPhotos: Starting...');
      setIsLoading(true);

      try {
        console.log('[PhotoGallery] loadInitialPhotos: Calling getPage...');
        const firstPage = await photoStorageService.getPage(0, PHOTOS_PER_PAGE);
        console.log('[PhotoGallery] loadInitialPhotos: Got response, cancelled=', cancelled, 'count=', firstPage.length);

        if (cancelled) {
          console.log('[PhotoGallery] loadInitialPhotos: Cancelled, skipping state updates');
          return;
        }

        // Batch all state updates together (React 18 automatic batching)
        console.log('[PhotoGallery] loadInitialPhotos: Setting states...');
        setPhotos(firstPage);
        setCurrentOffset(firstPage.length);
        setHasMore(firstPage.length === PHOTOS_PER_PAGE);
        setHasLoadedOnce(true);
        setIsLoading(false);

        // BUGFIX: Load photos into store so PhotoCarousel can access them
        await loadPhotos();

        console.log(`[PhotoGallery] Loaded initial ${firstPage.length} photos, hasLoadedOnce=true, isLoading=false`);
      } catch (error) {
        console.log('[PhotoGallery] loadInitialPhotos: Error, cancelled=', cancelled);
        if (cancelled) {
          console.log('[PhotoGallery] loadInitialPhotos: Cancelled in catch, skipping state updates');
          return;
        }

        console.error('[PhotoGallery] Failed to load initial photos:', error);
        console.log('[PhotoGallery] loadInitialPhotos: Setting error states...');
        setPhotos([]);
        setHasLoadedOnce(true); // Mark as loaded even on error to show empty state
        setIsLoading(false);
        setError(error instanceof Error ? error.message : 'Failed to load photos');
        console.log('[PhotoGallery] loadInitialPhotos: Error handled, hasLoadedOnce=true, isLoading=false');
      }
    };

    loadInitialPhotos();

    return () => {
      console.log('[PhotoGallery] Cleanup: Setting cancelled=true');
      cancelled = true;
    };
  }, [loadPhotos, retryTrigger]); // Re-run on mount and when retry is clicked

  // BUG FIX: Refresh gallery when store photos change (after upload)
  // This fixes the issue where uploaded photos don't appear until page refresh
  useEffect(() => {
    // Skip if we haven't loaded once yet (initial load handles this)
    if (!hasLoadedOnce) return;

    // Check if store has more photos than local state (new upload detected)
    if (storePhotos.length > photos.length) {
      console.log('[PhotoGallery] New photos detected in store, refreshing gallery...');

      // Refresh the gallery to show new photos
      const refreshGallery = async () => {
        try {
          const firstPage = await photoStorageService.getPage(0, PHOTOS_PER_PAGE);
          setPhotos(firstPage);
          setCurrentOffset(firstPage.length);
          setHasMore(firstPage.length === PHOTOS_PER_PAGE);
          console.log(`[PhotoGallery] Gallery refreshed with ${firstPage.length} photos`);
        } catch (error) {
          console.error('[PhotoGallery] Failed to refresh gallery:', error);
        }
      };

      refreshGallery();
    }
  }, [storePhotos.length, photos.length, hasLoadedOnce]); // Watch store photo count

  // AC-4.2.4: Load next page of photos
  const loadMorePhotos = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    try {
      setIsLoadingMore(true);
      const nextPage = await photoStorageService.getPage(currentOffset, PHOTOS_PER_PAGE);

      if (nextPage.length > 0) {
        setPhotos(prev => [...prev, ...nextPage]);
        setCurrentOffset(prev => prev + nextPage.length);
        setHasMore(nextPage.length === PHOTOS_PER_PAGE);

        console.log(`[PhotoGallery] Loaded ${nextPage.length} more photos (total: ${currentOffset + nextPage.length})`);
      } else {
        setHasMore(false);
        console.log('[PhotoGallery] No more photos to load');
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
    console.log('[PhotoGallery] Render - Showing ERROR state');
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
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            {error}
          </p>
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
  console.log('[PhotoGallery] Render - isLoading:', isLoading, 'hasLoadedOnce:', hasLoadedOnce, 'photos.length:', photos.length);

  if ((isLoading || !hasLoadedOnce) && photos.length === 0) {
    console.log('[PhotoGallery] Render - Showing SKELETON LOADING state');
    return <PhotoGridSkeletonGrid />;
  }

  // AC-4.2.5: Empty state when no photos uploaded (after first load attempt)
  // Only show empty state AFTER we've loaded once and confirmed no photos exist
  if (!isLoading && hasLoadedOnce && photos.length === 0) {
    console.log('[PhotoGallery] Render - Showing EMPTY state');
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        data-testid="photo-gallery-empty-state"
      >
        <div className="text-center max-w-md">
          <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-6">
            No photos yet. Upload your first memory!
          </p>
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

  console.log('[PhotoGallery] Render - Showing GRID with', photos.length, 'photos');

  // AC-4.2.1: Responsive grid layout
  // 2 columns (mobile), 3 columns (tablet sm:640px+), 4 columns (desktop lg:1024px+)
  return (
    <div className="min-h-screen p-4" data-testid="photo-gallery">
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4 w-full"
        data-testid="photo-gallery-grid"
      >
        {photos.map((photo) => (
          <PhotoGridItem
            key={photo.id}
            photo={photo}
            onPhotoClick={selectPhoto}
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
          <p className="text-gray-400 text-sm">
            You've reached the end of your memories
          </p>
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
    </div>
  );
}
