import { useEffect, useState } from 'react';
import type { Photo } from '../../types';

interface PhotoGridItemProps {
  photo: Photo;
  onPhotoClick: (photoId: number) => void;
}

/**
 * Photo Grid Item Component
 * Story 4.2: AC-4.2.3, AC-4.2.7
 *
 * Features:
 * - Square aspect ratio thumbnail (aspect-square)
 * - Caption overlay on hover/tap (gradient backdrop)
 * - Click handler for photo selection (carousel handoff)
 * - Blob URL cleanup to prevent memory leaks
 */
export function PhotoGridItem({ photo, onPhotoClick }: PhotoGridItemProps) {
  const [imageUrl, setImageUrl] = useState<string>('');

  // AC-4.2.3: Generate blob URL for image display
  // IMPORTANT: Clean up blob URLs to prevent memory leaks
  useEffect(() => {
    if (photo.imageBlob) {
      const url = URL.createObjectURL(photo.imageBlob);
      setImageUrl(url);

      // Cleanup: Revoke blob URL when component unmounts
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [photo.imageBlob]);

  // AC-4.2.7: Handle photo click for carousel view (Story 4.3)
  const handleClick = () => {
    onPhotoClick(photo.id);
    console.log(`[PhotoGallery] Selected photo: ${photo.id}`);
  };

  return (
    <div
      className="group relative aspect-square overflow-hidden rounded-lg cursor-pointer"
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
      {/* Photo thumbnail */}
      <img
        src={imageUrl}
        alt={photo.caption || 'Photo'}
        className="w-full h-full object-cover"
        data-testid="photo-grid-item-image"
      />

      {/* AC-4.2.3: Caption overlay on hover/tap */}
      {photo.caption && (
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent
                     p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          data-testid="photo-grid-item-caption-overlay"
        >
          <p className="text-white text-sm font-medium line-clamp-2">{photo.caption}</p>
        </div>
      )}
    </div>
  );
}
