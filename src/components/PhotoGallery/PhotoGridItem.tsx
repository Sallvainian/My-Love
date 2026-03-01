import { useEffect, useState, useRef } from 'react';
import type { PhotoWithUrls } from '../../services/photoService';
import { User } from 'lucide-react';

interface PhotoGridItemProps {
  photo: PhotoWithUrls;
  onPhotoClick: (photoId: string) => void;
}

/**
 * Photo Grid Item Component
 * Story 6.3: AC-6.3.4, AC-6.3.5, AC-6.3.11
 *
 * Features:
 * - Square aspect ratio thumbnail (aspect-square)
 * - Lazy loading with IntersectionObserver (AC-6.3.5)
 * - Caption overlay on hover/tap (gradient backdrop)
 * - Owner badge display (AC-6.3.11)
 * - Click handler for photo selection
 * - Uses Supabase signed URLs
 */
export function PhotoGridItem({ photo, onPhotoClick }: PhotoGridItemProps) {
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

  // AC-4.2.7: Handle photo click for carousel view (Story 4.3)
  const handleClick = () => {
    onPhotoClick(photo.id);
    console.log(`[PhotoGallery] Selected photo: ${photo.id}`);
  };

  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg transition-transform duration-200 hover:scale-105"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={photo.caption || `Photo ${photo.id}`}
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
        <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700" />
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
      <div className="absolute top-2 right-2">
        <div
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
            photo.isOwn ? 'bg-pink-500/90 text-white' : 'bg-blue-500/90 text-white'
          }`}
          data-testid="photo-grid-item-owner-badge"
        >
          <User className="h-3 w-3" />
          <span>{photo.isOwn ? 'You' : 'Partner'}</span>
        </div>
      </div>

      {/* Caption overlay on hover/tap */}
      {photo.caption && (
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          data-testid="photo-grid-item-caption-overlay"
        >
          <p className="line-clamp-2 text-sm font-medium text-white">{photo.caption}</p>
        </div>
      )}
    </div>
  );
}
