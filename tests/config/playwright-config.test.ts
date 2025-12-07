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

  it('detects app on first responding port', () => {
    mockExecSync.mockReturnValue('<html><title>My-Love App</title></html>');
    expect(detectAppPort()).toBe('4000');
    expect(mockExecSync).toHaveBeenCalledTimes(1);
  });

  it('finds first responding port (no title check)', () => {
    // First port responds (returns anything without throwing)
    mockExecSync.mockReturnValueOnce('');
    expect(detectAppPort()).toBe('4000');
    expect(mockExecSync).toHaveBeenCalledTimes(1);
  });

  it('returns default 5173 when no app found', () => {
    // All ports fail (throw errors)
    mockExecSync.mockImplementation(() => {
      throw new Error('ECONNREFUSED');
    });
    expect(detectAppPort()).toBe('5173');
    // Should have tried all ports
    expect(mockExecSync).toHaveBeenCalledTimes(5);
  });

  it('returns first port regardless of HTML content', () => {
    // Port responds with some HTML content - we only care that it responds
    mockExecSync.mockReturnValue('<title>MY-LOVE</title>');
    expect(detectAppPort()).toBe('4000');
  });

  it('returns first port with any valid response', () => {
    // Any response (no error thrown) means port is available
    mockExecSync.mockReturnValue('<title>My Love App</title>');
    expect(detectAppPort()).toBe('4000');
  });

  it('skips non-responding ports and continues', () => {
    // First port fails, second port responds
    mockExecSync
      .mockImplementationOnce(() => { throw new Error('ECONNREFUSED'); })
      .mockReturnValueOnce('');
    expect(detectAppPort()).toBe('5173');
    expect(mockExecSync).toHaveBeenCalledTimes(2);
  });

  it('handles timeout errors gracefully', () => {
    // All ports timeout
    mockExecSync.mockImplementation(() => {
      const error = new Error('ETIMEDOUT');
      (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
      throw error;
    });
    expect(detectAppPort()).toBe('5173');
    expect(mockExecSync).toHaveBeenCalledTimes(5);
  });
});
