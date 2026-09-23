import { AlertCircle, Camera, Loader2, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getOwnDisplayName, getPartnerDisplayName } from '../../api/supabaseClient';
import type { PhotoWithUrls } from '../../services/photoService';
import { photoService } from '../../services/photoService';
import { useAppStore } from '../../stores/useAppStore';
import { PhotoGridItem } from './PhotoGridItem';
import { PHOTO_GRID_CLASS, PhotoGridSkeletonGrid } from './PhotoGridSkeleton';
import { PhotoViewer } from './PhotoViewer';

interface PhotoGalleryProps {
  onUploadClick?: () => void;
}

// AC-4.2.4: Pagination configuration
const PHOTOS_PER_PAGE = 20;
const SCROLL_THRESHOLD = 200; // pixels from bottom to trigger load

// Subtitle while there is no count to show (loading, empty, error)
const ALBUM_SUBTITLE = 'Your shared album';

/** First code point, upper-cased, so a name opening with an emoji is not split. */
function initialOf(name: string | null, fallback: string): string {
  return Array.from(name?.trim() ?? '')[0]?.toUpperCase() || fallback;
}

/**
 * Photo Gallery Grid View Component
 * Story 4.2: AC-4.2.1, AC-4.2.2, AC-4.2.4, AC-4.2.5, AC-4.2.6
 *
 * Features:
 * - 3-column grid at every width, under a page header with an Upload pill
 * - Photos sorted newest first (by-date index)
 * - Empty state with upload CTA
 * - Page header over a skeleton grid during the first fetch
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

  // Owner badges and the subtitle: display names read once on mount. A null or
  // failed read leaves the fallback ("Y" / "P", no "shared with ...").
  const [ownName, setOwnName] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);

  // Intersection Observer ref for infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadNames = async () => {
      try {
        const [own, partner] = await Promise.all([getOwnDisplayName(), getPartnerDisplayName()]);
        if (cancelled) return;
        setOwnName(own?.trim() || null);
        setPartnerName(partner?.trim() || null);
      } catch {
        // Names are decoration here; the fallbacks already cover a failed read.
      }
    };

    loadNames();

    return () => {
      cancelled = true;
    };
  }, []);

  const ownInitial = initialOf(ownName, 'Y');
  const partnerInitial = initialOf(partnerName, 'P');

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

  // Page header, shared by every state. The Upload pill replaces the old
  // floating FAB and only exists once there is a grid to add to -- the empty
  // state carries its own primary Upload button.
  const renderHeader = (subtitle: string, showUpload: boolean) => (
    <header className="flex items-end justify-between gap-3 px-1 pt-1">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-serif text-[30px] leading-[1.1] font-semibold text-ink">Photos</h1>
        <p className="text-sm text-muted" data-testid="photo-gallery-subtitle">
          {subtitle}
        </p>
      </div>
      {showUpload && (
        <button
          type="button"
          onClick={onUploadClick}
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-semibold text-accent transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Upload photo"
          data-testid="photo-gallery-upload-fab"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Upload
        </button>
      )}
    </header>
  );

  const pageClass = 'flex min-h-screen flex-col gap-4 px-4 pt-3 pb-6';

  // Error state - show error message with retry button
  if (error && photos.length === 0) {
    return (
      <div className={pageClass} data-testid="photo-gallery-error-state">
        {renderHeader(ALBUM_SUBTITLE, false)}
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-line bg-card px-4 py-8 text-center shadow-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-dtint text-danger">
            <AlertCircle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-ink">Failed to load photos</h2>
          <p className="max-w-xs rounded-[14px] bg-dtint px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-1 h-12 rounded-full bg-fill px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
      <div className={pageClass} data-testid="photo-gallery">
        {renderHeader(ALBUM_SUBTITLE, false)}
        <PhotoGridSkeletonGrid />
      </div>
    );
  }

  // AC-4.2.5: Empty state when no photos uploaded (after first load attempt)
  // Only show empty state AFTER we've loaded once and confirmed no photos exist
  if (!isLoading && hasLoadedOnce && photos.length === 0) {
    return (
      <div className={pageClass} data-testid="photo-gallery-empty-state">
        {renderHeader(ALBUM_SUBTITLE, false)}
        <div className="rounded-[20px] border border-line bg-card p-4 shadow-card">
          <div className="flex flex-col items-center gap-3.5 px-2 py-9 text-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-tint text-accent">
              <Camera className="h-[30px] w-[30px]" aria-hidden="true" />
            </div>
            <h2 className="font-serif text-[22px] font-semibold text-ink">No photos yet</h2>
            <p className="max-w-[240px] text-[15px] leading-[1.45] text-muted">
              Start building your album — every photo you add shows up for both of you.
            </p>
            <button
              type="button"
              onClick={onUploadClick}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-fill px-[22px] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="photo-gallery-empty-upload-button"
            >
              <Camera className="h-[18px] w-[18px]" aria-hidden="true" />
              Upload a photo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // "20+ photos" while more pages remain: the local list is paginated, so its
  // length is only a lower bound until pagination ends.
  const countLabel = hasMore
    ? `${photos.length}+ photos`
    : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`;
  const subtitle = partnerName ? `${countLabel} · shared with ${partnerName}` : countLabel;

  // AC-4.2.1: 3 columns at every width, matching the skeleton exactly
  return (
    <div className={pageClass} data-testid="photo-gallery">
      {renderHeader(subtitle, true)}

      <div className={PHOTO_GRID_CLASS} data-testid="photo-gallery-grid">
        {photos.map((photo) => (
          <PhotoGridItem
            key={photo.id}
            photo={photo}
            ownInitial={ownInitial}
            partnerInitial={partnerInitial}
            partnerName={partnerName}
            onPhotoClick={() => setSelectedPhotoId(photo.id)}
          />
        ))}
      </div>

      {/* AC-4.2.4: Intersection Observer trigger element for infinite scroll */}
      {hasMore && (
        <div
          ref={observerTarget}
          className="flex w-full items-center justify-center py-8"
          data-testid="photo-gallery-load-trigger"
        >
          {isLoadingMore && (
            <div className="flex flex-col items-center">
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-accent" aria-hidden="true" />
              <p className="text-sm text-muted">Loading more photos...</p>
            </div>
          )}
        </div>
      )}

      {/* Story 5.2 AC-3, Subtask 4.3: "No more photos" indicator when pagination ends */}
      {!hasMore && photos.length > 0 && (
        <div
          className="flex w-full items-center justify-center py-8"
          data-testid="photo-gallery-end-message"
        >
          <p className="text-sm text-muted">You've reached the end of your memories</p>
        </div>
      )}

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
