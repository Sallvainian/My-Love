/**
 * Performance Monitoring Utilities
 *
 * Provides utilities for monitoring scroll performance and memory usage
 * in mood history timeline. Used for development debugging and performance
 * validation.
 *
 * @module utils/performanceMonitoring
 */

import { logger } from './logger';

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
        logger.debug('[Performance] Scroll frame time:', entry.duration, 'ms');

        if (entry.duration > 16.67) {
          console.warn('[Performance] Frame drop detected:', entry.duration, 'ms');
        }
      }
    }
  });

  observer.observe({ entryTypes: ['measure'] });
  return observer;
}
