/**
 * Performance Monitoring Service
 *
 * Tracks operation execution times using Web Performance API.
 * Provides metrics for database operations, service calls, and custom events.
 *
 * Usage:
 *   const result = await performanceMonitor.measureAsync('db-read', () => db.get(id));
 *   performanceMonitor.recordMetric('photo-upload-size', sizeInBytes);
 *   console.log(performanceMonitor.getReport());
 */

interface PerformanceMetric {
  /** Operation name (e.g., 'db-read', 'photo-upload') */
  name: string;
  /** Number of times operation was executed */
  count: number;
  /** Average execution time in milliseconds */
  avgDuration: number;
  /** Minimum execution time in milliseconds */
  minDuration: number;
  /** Maximum execution time in milliseconds */
  maxDuration: number;
  /** Total execution time in milliseconds */
  totalDuration: number;
  /** Last recorded timestamp */
  lastRecorded: number;
}

class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>();

  /**
   * Measure execution time of an async operation
   * @param name - Operation name for metric tracking
   * @param operation - Async function to measure
   * @returns Operation result
   */
  async measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
      return result;
    } catch (error) {
      // Don't record failed operations in metrics
      throw error;
    }
  }

  /**
   * Record a custom performance metric
   * @param name - Metric name
   * @param duration - Duration in milliseconds
   */
  recordMetric(name: string, duration: number): void {
    const existing = this.metrics.get(name);

    if (existing) {
      // Update existing metric
      const newCount = existing.count + 1;
      const newTotal = existing.totalDuration + duration;
      this.metrics.set(name, {
        name,
        count: newCount,
        avgDuration: newTotal / newCount,
        minDuration: Math.min(existing.minDuration, duration),
        maxDuration: Math.max(existing.maxDuration, duration),
        totalDuration: newTotal,
        lastRecorded: Date.now(),
      });
    } else {
      // Create new metric
      this.metrics.set(name, {
        name,
        count: 1,
        avgDuration: duration,
        minDuration: duration,
        maxDuration: duration,
        totalDuration: duration,
        lastRecorded: Date.now(),
      });
    }

    if (import.meta.env.DEV) {
      console.log(`[PerfMonitor] ${name}: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get metrics for a specific operation
   * @param name - Operation name
   * @returns Metric data or undefined if not found
   */
  getMetrics(name: string): PerformanceMetric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all recorded metrics
   * @returns Map of all metrics
   */
  getAllMetrics(): Map<string, PerformanceMetric> {
    return new Map(this.metrics);
  }

  /**
   * Clear all recorded metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Generate human-readable performance report
   * @returns Formatted report string
   */
  getReport(): string {
    const lines = ['Performance Metrics Report', '='.repeat(50), ''];

    // Sort by total duration (descending) to show slowest operations first
    const sorted = Array.from(this.metrics.values()).sort(
      (a, b) => b.totalDuration - a.totalDuration
    );

    for (const metric of sorted) {
      lines.push(`${metric.name}:`);
      lines.push(`  count: ${metric.count}`);
      lines.push(`  avg: ${metric.avgDuration.toFixed(2)}ms`);
      lines.push(`  min: ${metric.minDuration.toFixed(2)}ms`);
      lines.push(`  max: ${metric.maxDuration.toFixed(2)}ms`);
      lines.push(`  total: ${metric.totalDuration.toFixed(2)}ms`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();
