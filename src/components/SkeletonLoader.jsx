import React, { memo } from 'react';

/**
 * Skeleton Loader Component
 * Provides a shimmering placeholder while content loads
 */
function SkeletonLoader({ 
  width = '100%', 
  height = '1rem', 
  className = '',
  rounded = true 
}) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${rounded ? 'rounded' : ''} ${className}`}
      style={{ width, height }}
      aria-label="Loading..."
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default memo(SkeletonLoader);

/**
 * Card Skeleton - For loading result cards
 */
export const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border dark:border-gray-700">
      <SkeletonLoader width="60%" height="1.5rem" className="mb-4" />
      <SkeletonLoader width="40%" height="3rem" className="mb-2" />
      <SkeletonLoader width="80%" height="1rem" className="mb-1" />
      <SkeletonLoader width="70%" height="1rem" />
    </div>
  );
});

/**
 * Analysis Results Skeleton
 */
export const AnalysisResultsSkeleton = memo(function AnalysisResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  );
});

