import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mock is available during hoisting
const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}));

// Mock both potential import paths for child_process
vi.mock('child_process', () => ({
  execSync: mockExecSync,
  exec: vi.fn(),
  spawn: vi.fn(),
  spawnSync: vi.fn(),
  fork: vi.fn(),
  execFile: vi.fn(),
  execFileSync: vi.fn(),
  default: { execSync: mockExecSync },
}));

vi.mock('node:child_process', () => ({
  execSync: mockExecSync,
  exec: vi.fn(),
  spawn: vi.fn(),
  spawnSync: vi.fn(),
  fork: vi.fn(),
  execFile: vi.fn(),
  execFileSync: vi.fn(),
  default: { execSync: mockExecSync },
}));

// Import the actual function (VITEST env prevents side effects at module level)
import { detectAppPort } from '../../playwright.config';

describe('detectAppPort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars
    delete process.env.PORT;
    delete process.env.VITE_PORT;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns PORT env var when set', () => {
    process.env.PORT = '8080';
    expect(detectAppPort()).toBe('8080');
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('returns VITE_PORT env var when PORT not set', () => {
    process.env.VITE_PORT = '4200';
    expect(detectAppPort()).toBe('4200');
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('prefers PORT over VITE_PORT', () => {
    process.env.PORT = '9000';
    process.env.VITE_PORT = '4200';
    expect(detectAppPort()).toBe('9000');
  });

  it('detects app on first matching port by title', () => {
    mockExecSync.mockReturnValue('<html><title>My-Love App</title></html>');
    expect(detectAppPort()).toBe('4000');
    expect(mockExecSync).toHaveBeenCalledTimes(1);
  });

  it('skips ports without matching title and continues', () => {
    mockExecSync
      .mockReturnValueOnce('<html><title>Other App</title></html>')
      .mockReturnValueOnce('<html><title>My-Love</title></html>');
    expect(detectAppPort()).toBe('5173');
    expect(mockExecSync).toHaveBeenCalledTimes(2);
  });

  it('returns default 5173 when no app found', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('ECONNREFUSED');
    });
    expect(detectAppPort()).toBe('5173');
  });

  it('handles case-insensitive title matching (MY-LOVE)', () => {
    mockExecSync.mockReturnValue('<title>MY-LOVE</title>');
    expect(detectAppPort()).toBe('4000');
  });

  it('handles "my love" with space in title', () => {
    mockExecSync.mockReturnValue('<title>My Love App</title>');
    expect(detectAppPort()).toBe('4000');
  });

  it('skips port when response has no title tag', () => {
    mockExecSync
      .mockReturnValueOnce('<html><body>No title here</body></html>')
      .mockReturnValueOnce('<title>My-Love</title>');
    expect(detectAppPort()).toBe('5173');
  });

  it('handles timeout errors gracefully', () => {
    mockExecSync.mockImplementation(() => {
      const error = new Error('ETIMEDOUT');
      (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
      throw error;
    });
    expect(detectAppPort()).toBe('5173');
  });
});
