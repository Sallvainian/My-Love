import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performanceMonitor } from '../../src/services/performanceMonitor';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.clear();
  });

  describe('measureAsync', () => {
    it('measures execution time of async operations', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };

      const result = await performanceMonitor.measureAsync('test-op', operation);

      expect(result).toBe('result');
      const metrics = performanceMonitor.getMetrics('test-op');
      expect(metrics).toBeDefined();
      expect(metrics!.count).toBe(1);
      expect(metrics!.avgDuration).toBeGreaterThanOrEqual(100);
      expect(metrics!.avgDuration).toBeLessThan(150); // Allow 50ms margin
    });

    it('tracks multiple executions and calculates average', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      };

      await performanceMonitor.measureAsync('multi-op', operation);
      await performanceMonitor.measureAsync('multi-op', operation);
      await performanceMonitor.measureAsync('multi-op', operation);

      const metrics = performanceMonitor.getMetrics('multi-op');
      expect(metrics!.count).toBe(3);
      expect(metrics!.avgDuration).toBeGreaterThanOrEqual(45); // Allow 5ms margin for timing variations
      expect(metrics!.minDuration).toBeGreaterThanOrEqual(45); // Allow 5ms margin for timing variations
      expect(metrics!.maxDuration).toBeLessThan(100);
    });

    it('propagates errors from measured operations', async () => {
      const operation = async () => {
        throw new Error('Operation failed');
      };

      await expect(
        performanceMonitor.measureAsync('error-op', operation)
      ).rejects.toThrow('Operation failed');

      // Error should not be recorded in metrics
      const metrics = performanceMonitor.getMetrics('error-op');
      expect(metrics?.count).toBeUndefined();
    });
  });

  describe('recordMetric', () => {
    it('records custom performance metrics', () => {
      performanceMonitor.recordMetric('custom-metric', 123.45);
      performanceMonitor.recordMetric('custom-metric', 67.89);

      const metrics = performanceMonitor.getMetrics('custom-metric');
      expect(metrics!.count).toBe(2);
      expect(metrics!.avgDuration).toBeCloseTo(95.67, 1);
      expect(metrics!.minDuration).toBe(67.89);
      expect(metrics!.maxDuration).toBe(123.45);
    });
  });

  describe('getAllMetrics', () => {
    it('returns all recorded metrics', async () => {
      await performanceMonitor.measureAsync('op1', async () => {});
      await performanceMonitor.measureAsync('op2', async () => {});
      performanceMonitor.recordMetric('custom', 100);

      const allMetrics = performanceMonitor.getAllMetrics();
      expect(allMetrics.size).toBe(3);
      expect(allMetrics.has('op1')).toBe(true);
      expect(allMetrics.has('op2')).toBe(true);
      expect(allMetrics.has('custom')).toBe(true);
    });
  });

  describe('clear', () => {
    it('clears all recorded metrics', async () => {
      await performanceMonitor.measureAsync('op', async () => {});
      expect(performanceMonitor.getAllMetrics().size).toBe(1);

      performanceMonitor.clear();
      expect(performanceMonitor.getAllMetrics().size).toBe(0);
    });
  });

  describe('getReport', () => {
    it('generates human-readable performance report', async () => {
      await performanceMonitor.measureAsync('db-read', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      performanceMonitor.recordMetric('db-write', 25.5);

      const report = performanceMonitor.getReport();
      expect(report).toContain('Performance Metrics Report');
      expect(report).toContain('db-read');
      expect(report).toContain('db-write');
      expect(report).toMatch(/count: 1/);
      expect(report).toMatch(/avg: \d+\.\d+ms/);
    });
  });
});
