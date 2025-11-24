import { Page, Request, Response } from '@playwright/test';

/**
 * Network Monitoring Helper for Playwright Tests
 *
 * Automatically captures and validates network requests during tests.
 * Addresses Epic 0 Finding: Manual DevTools Network tab validation (AC-0.4.5)
 * created 2-day delay in Story 0.4.
 *
 * Usage:
 * ```typescript
 * import { setupNetworkMonitor } from '../support/helpers/networkMonitor';
 *
 * test('should connect to Supabase', async ({ page }) => {
 *   const monitor = setupNetworkMonitor(page);
 *   await page.goto('/');
 *
 *   // Verify Supabase API calls
 *   const supabaseRequests = monitor.getByDomain('supabase.co');
 *   expect(supabaseRequests.length).toBeGreaterThan(0);
 *   expect(monitor.hasFailedRequests()).toBe(false);
 * });
 * ```
 */

export interface NetworkEntry {
  url: string;
  method: string;
  status: number | null;
  statusText: string;
  resourceType: string;
  timestamp: number;
  duration?: number;
  size?: number;
  failure?: string;
}

export class NetworkMonitor {
  private requests: NetworkEntry[] = [];
  private requestTimings: Map<string, number> = new Map();
  private isActive = false;

  constructor(private page: Page) {}

  /**
   * Start monitoring network requests
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.page.on('request', this.handleRequest);
    this.page.on('response', this.handleResponse);
    this.page.on('requestfailed', this.handleRequestFailed);
  }

  /**
   * Stop monitoring network requests
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.page.off('request', this.handleRequest);
    this.page.off('response', this.handleResponse);
    this.page.off('requestfailed', this.handleRequestFailed);
  }

  /**
   * Handle request initiation
   */
  private handleRequest = (request: Request) => {
    this.requestTimings.set(request.url(), Date.now());
  };

  /**
   * Handle successful response
   */
  private handleResponse = async (response: Response) => {
    const request = response.request();
    const url = request.url();
    const startTime = this.requestTimings.get(url);
    const duration = startTime ? Date.now() - startTime : undefined;

    let size: number | undefined;
    try {
      const headers = await response.allHeaders();
      size = headers['content-length'] ? parseInt(headers['content-length'], 10) : undefined;
    } catch {
      size = undefined;
    }

    const entry: NetworkEntry = {
      url,
      method: request.method(),
      status: response.status(),
      statusText: response.statusText(),
      resourceType: request.resourceType(),
      timestamp: Date.now(),
      duration,
      size,
    };

    this.requests.push(entry);
    this.requestTimings.delete(url);
  };

  /**
   * Handle failed request
   */
  private handleRequestFailed = (request: Request) => {
    const url = request.url();
    const failure = request.failure();

    const entry: NetworkEntry = {
      url,
      method: request.method(),
      status: null,
      statusText: 'FAILED',
      resourceType: request.resourceType(),
      timestamp: Date.now(),
      failure: failure?.errorText || 'Request failed',
    };

    this.requests.push(entry);
    this.requestTimings.delete(url);
  };

  /**
   * Get all captured requests
   */
  getAll(): NetworkEntry[] {
    return [...this.requests];
  }

  /**
   * Get requests by status code
   */
  getByStatus(status: number): NetworkEntry[] {
    return this.requests.filter((r) => r.status === status);
  }

  /**
   * Get all successful requests (2xx status codes)
   */
  getSuccessful(): NetworkEntry[] {
    return this.requests.filter((r) => r.status !== null && r.status >= 200 && r.status < 300);
  }

  /**
   * Get all failed requests (4xx, 5xx, or network failures)
   */
  getFailed(): NetworkEntry[] {
    return this.requests.filter(
      (r) => r.status === null || r.status >= 400 || r.failure !== undefined
    );
  }

  /**
   * Get requests by domain
   */
  getByDomain(domain: string): NetworkEntry[] {
    return this.requests.filter((r) => r.url.includes(domain));
  }

  /**
   * Get requests by URL pattern
   */
  getByPattern(pattern: string | RegExp): NetworkEntry[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return this.requests.filter((r) => regex.test(r.url));
  }

  /**
   * Get requests by resource type (document, script, stylesheet, image, etc.)
   */
  getByType(type: string): NetworkEntry[] {
    return this.requests.filter((r) => r.resourceType === type);
  }

  /**
   * Check if there are any failed requests
   */
  hasFailedRequests(): boolean {
    return this.getFailed().length > 0;
  }

  /**
   * Check if any requests match the pattern
   */
  hasRequestsMatching(pattern: string | RegExp): boolean {
    return this.getByPattern(pattern).length > 0;
  }

  /**
   * Get API requests (fetch, xhr)
   */
  getApiRequests(): NetworkEntry[] {
    return this.requests.filter((r) => r.resourceType === 'fetch' || r.resourceType === 'xhr');
  }

  /**
   * Clear all captured requests
   */
  clear(): void {
    this.requests = [];
    this.requestTimings.clear();
  }

  /**
   * Get formatted summary of network activity
   */
  getSummary(): string {
    const total = this.requests.length;
    const successful = this.getSuccessful().length;
    const failed = this.getFailed().length;
    const apis = this.getApiRequests().length;

    return `Network Summary: ${total} requests (${successful} successful, ${failed} failed, ${apis} API calls)`;
  }

  /**
   * Format failed requests for assertion output
   */
  formatFailures(): string {
    const failures = this.getFailed();
    if (failures.length === 0) return 'No failed requests';

    return failures
      .map(
        (r, i) =>
          `${i + 1}. [${r.method}] ${r.url}\n   Status: ${r.status || 'FAILED'} ${r.statusText}\n   ${r.failure ? `Failure: ${r.failure}` : ''}`
      )
      .join('\n');
  }

  /**
   * Get slow requests (duration > threshold ms)
   */
  getSlowRequests(thresholdMs = 5000): NetworkEntry[] {
    return this.requests.filter((r) => r.duration !== undefined && r.duration > thresholdMs);
  }
}

/**
 * Setup network monitoring for a page
 *
 * @param page Playwright Page instance
 * @param autoStart Whether to start monitoring immediately (default: true)
 * @returns NetworkMonitor instance
 *
 * @example
 * ```typescript
 * const monitor = setupNetworkMonitor(page);
 * await page.goto('/');
 *
 * // Assert Supabase connection successful
 * const supabase = monitor.getByDomain('supabase.co');
 * expect(supabase.every(r => r.status === 200)).toBe(true);
 * ```
 */
export function setupNetworkMonitor(page: Page, autoStart = true): NetworkMonitor {
  const monitor = new NetworkMonitor(page);
  if (autoStart) {
    monitor.start();
  }
  return monitor;
}

/**
 * Common network patterns for Epic 1 validation
 */
export const NETWORK_PATTERNS = {
  SUPABASE_AUTH: /supabase\.co.*\/auth\//,
  SUPABASE_REST: /supabase\.co.*\/rest\//,
  SUPABASE_REALTIME: /supabase\.co.*\/realtime\//,
  SUPABASE_STORAGE: /supabase\.co.*\/storage\//,
};

/**
 * Validate Supabase API health
 *
 * @param monitor Network monitor instance
 * @returns Object with validation results
 */
export function validateSupabaseHealth(monitor: NetworkMonitor): {
  authOk: boolean;
  restOk: boolean;
  allOk: boolean;
  failures: NetworkEntry[];
} {
  const authRequests = monitor.getByPattern(NETWORK_PATTERNS.SUPABASE_AUTH);
  const restRequests = monitor.getByPattern(NETWORK_PATTERNS.SUPABASE_REST);
  const failures = monitor.getFailed();

  const supabaseFailures = failures.filter((f) => f.url.includes('supabase.co'));

  return {
    authOk: authRequests.length > 0 && authRequests.every((r) => (r.status || 0) < 400),
    restOk: restRequests.length > 0 && restRequests.every((r) => (r.status || 0) < 400),
    allOk: supabaseFailures.length === 0,
    failures: supabaseFailures,
  };
}
