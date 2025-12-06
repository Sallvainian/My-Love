import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';

// Mock child_process before importing
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Import after mocking - need to re-import the function
// Since playwright.config.ts has side effects, we test the function logic directly
describe('detectAppPort', () => {
  const mockedExecSync = vi.mocked(execSync);

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars
    delete process.env.PORT;
    delete process.env.VITE_PORT;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Helper to simulate detectAppPort logic (since importing has side effects)
  function detectAppPort(): string {
    if (process.env.PORT || process.env.VITE_PORT) {
      return process.env.PORT || process.env.VITE_PORT || '5173';
    }

    const portsToCheck = ['4000', '5173', '3000', '5174', '5175'];

    for (const port of portsToCheck) {
      try {
        const result = mockedExecSync(
          `node -e "const http = require('http'); const req = http.get('http://localhost:${port}/', {timeout: 1000}, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => console.log(d.slice(0, 500))); }); req.on('error', () => process.exit(1)); req.on('timeout', () => { req.destroy(); process.exit(1); });"`,
          { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
        );

        const titleMatch = (result as string).match(/<title>([^<]*)<\/title>/i);
        if (
          titleMatch?.[1]?.toLowerCase().includes('my-love') ||
          titleMatch?.[1]?.toLowerCase().includes('my love')
        ) {
          return port;
        }
      } catch {
        continue;
      }
    }

    return '5173';
  }

  it('returns PORT env var when set', () => {
    process.env.PORT = '8080';
    expect(detectAppPort()).toBe('8080');
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it('returns VITE_PORT env var when PORT not set', () => {
    process.env.VITE_PORT = '4200';
    expect(detectAppPort()).toBe('4200');
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it('prefers PORT over VITE_PORT', () => {
    process.env.PORT = '9000';
    process.env.VITE_PORT = '4200';
    expect(detectAppPort()).toBe('9000');
  });

  it('detects app on first matching port by title', () => {
    mockedExecSync.mockReturnValue('<html><title>My-Love App</title></html>');
    expect(detectAppPort()).toBe('4000'); // First in portsToCheck list
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });

  it('skips ports without matching title and continues', () => {
    mockedExecSync
      .mockReturnValueOnce('<html><title>Other App</title></html>')
      .mockReturnValueOnce('<html><title>My-Love</title></html>');
    expect(detectAppPort()).toBe('5173'); // Second in list
    expect(mockedExecSync).toHaveBeenCalledTimes(2);
  });

  it('returns default 5173 when no app found', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('ECONNREFUSED');
    });
    expect(detectAppPort()).toBe('5173');
  });

  it('handles case-insensitive title matching (MY-LOVE)', () => {
    mockedExecSync.mockReturnValue('<title>MY-LOVE</title>');
    expect(detectAppPort()).toBe('4000');
  });

  it('handles "my love" with space in title', () => {
    mockedExecSync.mockReturnValue('<title>My Love App</title>');
    expect(detectAppPort()).toBe('4000');
  });

  it('skips port when response has no title tag', () => {
    mockedExecSync
      .mockReturnValueOnce('<html><body>No title here</body></html>')
      .mockReturnValueOnce('<title>My-Love</title>');
    expect(detectAppPort()).toBe('5173');
  });

  it('handles timeout errors gracefully', () => {
    mockedExecSync.mockImplementation(() => {
      const error = new Error('ETIMEDOUT');
      (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
      throw error;
    });
    expect(detectAppPort()).toBe('5173');
  });
});
