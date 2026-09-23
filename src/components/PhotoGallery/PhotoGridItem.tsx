import { useEffect, useRef, useState } from 'react';
import type { PhotoWithUrls } from '../../services/photoService';
import { logger } from '../../utils/logger';

interface PhotoGridItemProps {
  photo: PhotoWithUrls;
  /** Initial on the badge of the viewer's own photos */
  ownInitial: string;
  /** Initial on the badge of the partner's photos */
  partnerInitial: string;
  /** Partner's display name for the badge's screen-reader text, null when unknown */
  partnerName: string | null;
  onPhotoClick: (photoId: string) => void;
}

/**
 * Photo Grid Item Component
 * Story 6.3: AC-6.3.4, AC-6.3.5, AC-6.3.11
 *
 * Features:
 * - Square aspect ratio thumbnail (aspect-square)
 * - Lazy loading with IntersectionObserver (AC-6.3.5)
 * - Caption overlay on hover or keyboard focus (flat dark backdrop)
 * - Owner badge display (AC-6.3.11): initial in a fill (own) or partner circle
 * - Click handler for photo selection
 * - Uses Supabase signed URLs
 */
export function PhotoGridItem({
  photo,
  ownInitial,
  partnerInitial,
  partnerName,
  onPhotoClick,
}: PhotoGridItemProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // AC-6.3.5: Lazy loading with IntersectionObserver
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      {
        rootMargin: '50px', // Preload 50px before visible
        threshold: 0.1,
      }
    );

    observer.observe(img);

    return () => {
      observer.unobserve(img);
      observer.disconnect();
    };
  }, [isVisible]);

  // AC-4.2.7: Handle photo click to open the full-screen viewer
  // The tile's aria-label (the caption) overrides its content, so the badge's
  // screen-reader text is attached as a description instead.
  const ownerTextId = `photo-owner-${photo.id}`;

  const handleClick = () => {
    onPhotoClick(photo.id);
    logger.debug(`[PhotoGallery] Selected photo: ${photo.id}`);
  };

  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-[14px] bg-card2 transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={photo.caption || `Photo ${photo.id}`}
      aria-describedby={ownerTextId}
      data-testid="photo-grid-item"
      onKeyDown={(e) => {
        // Accessibility: Support Enter/Space for keyboard navigation
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* AC-6.3.6: Blur placeholder while loading */}
      {!isLoaded && isVisible && (
        <div className="absolute inset-0 animate-pulse bg-card2" />
      )}

      {/* Photo thumbnail with lazy loading */}
      <img
        ref={imgRef}
        src={isVisible && photo.signedUrl ? photo.signedUrl : undefined}
        alt={photo.caption || 'Photo'}
        className="h-full w-full object-cover transition-opacity duration-300"
        style={{ opacity: isLoaded ? 1 : 0 }}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          console.error(`[PhotoGridItem] Failed to load image: ${photo.id}`);
          setIsLoaded(true); // Show broken image rather than eternal loading
        }}
        data-testid="photo-grid-item-image"
      />

      {/* AC-6.3.11: Owner badge */}
      <div
        className={`absolute bottom-1.5 left-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          photo.isOwn ? 'bg-fill text-white' : 'bg-partner text-card'
        }`}
        data-testid="photo-grid-item-owner-badge"
      >
        <span aria-hidden="true">{photo.isOwn ? ownInitial : partnerInitial}</span>
        <span id={ownerTextId} className="sr-only">
          {photo.isOwn ? 'Uploaded by you' : `Uploaded by ${partnerName ?? 'your partner'}`}
        </span>
      </div>

      {/* Caption overlay on hover or keyboard focus. A tap opens the viewer, so
          touch never shows it; the viewer carries the caption instead. */}
      {photo.caption && (
        <div
          className="absolute inset-x-0 bottom-0 bg-black/55 p-3 pl-8 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          data-testid="photo-grid-item-caption-overlay"
        >
          <p className="line-clamp-2 text-sm font-medium text-white">{photo.caption}</p>
        </div>
      )}
    </div>
  );
}
