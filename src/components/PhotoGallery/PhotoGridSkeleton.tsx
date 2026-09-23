/**
 * The gallery grid's layout: 3 columns at every width with a 6px gap. Shared
 * with PhotoGallery so the skeleton cannot drift from the grid it stands in for.
 */
export const PHOTO_GRID_CLASS = 'grid w-full grid-cols-3 gap-1.5';

/**
 * Photo Grid Skeleton Loader Component
 * Story 5.2: AC-4 - Loading states with skeleton loaders
 *
 * Matches PhotoGridItem's tile (aspect-square, 14px radius, card2 ground).
 */
function PhotoGridSkeleton() {
  return (
    <div
      className="aspect-square animate-pulse rounded-[14px] bg-card2"
      data-testid="photo-grid-skeleton"
      aria-label="Loading photo"
    />
  );
}

/**
 * Photo Grid Skeleton Grid Component
 * Displays a 3x3 grid of skeleton loaders during initial load, in exactly the
 * gallery grid's columns and gap. The page header and padding belong to
 * PhotoGallery.
 */
export function PhotoGridSkeletonGrid() {
  const skeletonCount = 9;

  return (
    <div data-testid="photo-gallery-skeleton">
      <div className={PHOTO_GRID_CLASS} data-testid="photo-gallery-skeleton-grid">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <PhotoGridSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    </div>
  );
}
