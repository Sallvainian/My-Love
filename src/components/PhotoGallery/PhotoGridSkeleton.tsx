/**
 * Photo Grid Skeleton Loader Component
 * Story 5.2: AC-4 - Loading states with skeleton loaders
 *
 * Features:
 * - Matches PhotoGridItem visual structure (aspect-square, rounded-lg)
 * - CSS shimmer animation (better performance than JS animation)
 * - Responsive to match grid layout
 */
export function PhotoGridSkeleton() {
  return (
    <div
      className="relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden"
      data-testid="photo-grid-skeleton"
      aria-label="Loading photo"
    >
      {/* Shimmer animation overlay */}
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

/**
 * Photo Grid Skeleton Grid Component
 * Displays a 3x3 grid of skeleton loaders during initial load
 * Story 5.2: Subtask 2.3 - Replace simple spinner with skeleton grid
 */
export function PhotoGridSkeletonGrid() {
  // Display 9 skeleton items (3x3 grid approximation)
  // Actual grid columns will be 2-3-4 based on screen size (responsive)
  const skeletonCount = 9;

  return (
    <div className="min-h-screen p-4" data-testid="photo-gallery-skeleton">
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4 w-full"
        data-testid="photo-gallery-skeleton-grid"
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <PhotoGridSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    </div>
  );
}
