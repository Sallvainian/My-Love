import { CircleAlert, Camera, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { getOwnDisplayName, getPartnerDisplayName } from '../../api/supabaseClient';
import { useAppStore } from '../../stores/useAppStore';
import { PhotoGridItem } from './PhotoGridItem';
import { PHOTO_GRID_CLASS, PhotoGridSkeletonGrid } from './PhotoGridSkeleton';
import { PhotoViewer } from './PhotoViewer';

interface PhotoGalleryProps {
  onUploadClick?: () => void;
  /**
   * Attached to the header Upload button, which replaces the empty state's
   * Upload once the album has a photo -- so the upload dialog can return focus
   * to it when the button that opened the dialog is gone.
   */
  uploadButtonRef?: RefObject<HTMLButtonElement | null>;
}

// AC-4.2.4: Tiles revealed per scroll step
const PHOTOS_PER_PAGE = 20;
const SCROLL_THRESHOLD = 200; // pixels from bottom to trigger the next step

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
 * - Photos sorted newest first
 * - Empty state with upload CTA
 * - Page header over a skeleton grid until the list is known
 * - Renders the store's whole list (`photos`, kept offline as the `photos`
 *   local copy, spec-unified-data-storage story 10), revealing 20 more tiles
 *   per scroll step with an Intersection Observer. It never calls the photo
 *   service itself: opening the gallery asks the store for a fresh read.
 */
export function PhotoGallery({ onUploadClick, uploadButtonRef }: PhotoGalleryProps) {
  const photos = useAppStore((state) => state.photos);
  const photosLoaded = useAppStore((state) => state.photosLoaded);
  const photosLoadError = useAppStore((state) => state.photosLoadError);
  const loadPhotos = useAppStore((state) => state.loadPhotos);

  // AC-4.2.4: how many tiles are shown; grows one step per scroll trigger.
  const [visibleCount, setVisibleCount] = useState(PHOTOS_PER_PAGE);

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

  // Opening the gallery refreshes the list: the saved copy shows at once, and
  // a full server read replaces it when one answers.
  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  // Retry handler for error state
  const handleRetry = useCallback(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const hasMore = visibleCount < photos.length;
  const visiblePhotos = hasMore ? photos.slice(0, visibleCount) : photos;

  // AC-4.2.4: Setup Intersection Observer to reveal the next step of tiles
  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Reveal more when the scroll target is visible
        if (entries[0].isIntersecting) {
          setVisibleCount((count) => count + PHOTOS_PER_PAGE);
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
      observer.disconnect();
    };
  }, [hasMore, visibleCount]);

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
          ref={uploadButtonRef}
          type="button"
          onClick={onUploadClick}
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-semibold text-accent transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
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

  // Error state - the list read failed and there is no saved list to show
  if (!photosLoaded && photosLoadError && photos.length === 0) {
    return (
      <div className={pageClass} data-testid="photo-gallery-error-state">
        {renderHeader(ALBUM_SUBTITLE, false)}
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-line bg-card px-4 py-8 text-center shadow-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-dtint text-danger">
            <CircleAlert className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-ink">Failed to load photos</h2>
          <p className="max-w-xs rounded-[14px] bg-dtint px-3 py-2 text-sm text-danger" role="alert">
            {photosLoadError}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-1 h-12 rounded-full bg-fill px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="photo-gallery-error-retry-button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Story 5.2 AC-4: Skeleton loaders until the list is known (no saved copy
  // and no server answer yet)
  // Wrapped with photo-gallery testid so E2E tests can proceed during loading
  if (!photosLoaded && photos.length === 0) {
    return (
      <div className={pageClass} data-testid="photo-gallery">
        {renderHeader(ALBUM_SUBTITLE, false)}
        <PhotoGridSkeletonGrid />
      </div>
    );
  }

  // A refresh that empties the album unmounts the viewer below without its
  // onClose; drop the selection too, or the next upload would reopen it.
  if (selectedPhotoId && photos.length === 0) setSelectedPhotoId(null);

  // AC-4.2.5: Empty state when no photos uploaded
  // Only once the saved copy or the server has confirmed no photos exist
  if (photos.length === 0) {
    return (
      <div className={pageClass} data-testid="photo-gallery-empty-state">
        {renderHeader(ALBUM_SUBTITLE, false)}
        <div className="rounded-[20px] border border-line bg-card p-4 shadow-card">
          <div className="flex flex-col items-center gap-3.5 px-2 py-9 text-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-tint text-accent">
              <Camera className="h-7.5 w-7.5" aria-hidden="true" />
            </div>
            <h2 className="font-serif text-[22px] font-semibold text-ink">No photos yet</h2>
            <p className="max-w-60 text-[15px] leading-[1.45] text-muted">
              Start building your album — every photo you add shows up for both of you.
            </p>
            <button
              type="button"
              onClick={onUploadClick}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-fill px-5.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="photo-gallery-empty-upload-button"
            >
              <Camera className="h-4.5 w-4.5" aria-hidden="true" />
              Upload a photo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // The whole list is held, so the count is exact even before every tile shows.
  const countLabel = `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`;
  const subtitle = partnerName ? `${countLabel} · shared with ${partnerName}` : countLabel;

  // AC-4.2.1: 3 columns at every width, matching the skeleton exactly
  return (
    <div className={pageClass} data-testid="photo-gallery">
      {renderHeader(subtitle, true)}

      <div className={PHOTO_GRID_CLASS} data-testid="photo-gallery-grid">
        {visiblePhotos.map((photo) => (
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

      {/* AC-4.2.4: Intersection Observer trigger element for the next step */}
      {hasMore && (
        <div
          ref={observerTarget}
          className="flex w-full items-center justify-center py-8"
          data-testid="photo-gallery-load-trigger"
        />
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
