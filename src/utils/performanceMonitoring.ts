/**
 * Performance Monitoring Utilities
 *
 * Provides utilities for monitoring scroll performance and memory usage
 * in mood history timeline. Used for development debugging and performance
 * validation.
 *
 * @module utils/performanceMonitoring
 */

// Chrome-specific memory API (not in standard Performance interface)
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/**
 * Measure scroll performance and detect frame drops
 *
 * Creates a PerformanceObserver that monitors scroll frame times and
 * logs warnings when frame drops occur (> 16.67ms per frame).
 *
 * @returns PerformanceObserver instance
 *
 * @example
 * ```typescript
 * useEffect(() => {
 *   if (import.meta.env.DEV) {
 *     const observer = measureScrollPerformance();
 *     return () => observer.disconnect();
 *   }
 * }, []);
 * ```
 */
export function measureScrollPerformance(): PerformanceObserver {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'measure') {
        console.debug('[Performance] Scroll frame time:', entry.duration, 'ms');

        if (entry.duration > 16.67) {
          console.warn('[Performance] Frame drop detected:', entry.duration, 'ms');
        }
      }
    }
  });

  observer.observe({ entryTypes: ['measure'] });
  return observer;
}

/**
 * Measure current memory usage
 *
 * Returns the current JavaScript heap size in megabytes.
 * Only works in browsers that support performance.memory (Chrome, Edge).
 *
 * @returns Memory usage in MB, or 0 if not supported
 *
 * @example
 * ```typescript
 * const memoryUsage = measureMemoryUsage();
 * console.log('Current memory usage:', memoryUsage, 'MB');
 * ```
 */
export function measureMemoryUsage(): number {
  const perf = performance as PerformanceWithMemory;
  if (perf.memory) {
    const usedMB = perf.memory.usedJSHeapSize / 1048576;
    console.debug('[Memory] Used heap size:', usedMB.toFixed(2), 'MB');
    return usedMB;
  }
  return 0;
}
