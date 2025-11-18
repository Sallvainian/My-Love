/**
 * Supabase Client Environment Validation Unit Tests
 *
 * Story 0.2: Environment Variables & Secrets Management
 * Tests environment variable validation logic for Supabase client initialization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Supabase Client Environment Validation', () => {
  beforeEach(() => {
    // Clear module cache to allow re-importing with new env vars
    vi.resetModules();
  });

  afterEach(() => {
    // Vitest automatically restores environment variables
    vi.unstubAllEnvs();
  });

  describe('Environment Variable Validation', () => {
    it('should throw error when VITE_SUPABASE_URL is missing', async () => {
      // Mock missing VITE_SUPABASE_URL
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'test-key');

      // Attempt to import module with missing env var
      await expect(async () => {
        await import('../../../src/api/supabaseClient');
      }).rejects.toThrow(/Supabase configuration missing/);
    });

    it('should throw error when VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY is missing', async () => {
      // Mock missing VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
      vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', '');

      // Attempt to import module with missing env var
      await expect(async () => {
        await import('../../../src/api/supabaseClient');
      }).rejects.toThrow(/Supabase configuration missing/);
    });

    it('should throw error when both environment variables are missing', async () => {
      // Mock both missing
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', '');

      // Attempt to import module with missing env vars
      await expect(async () => {
        await import('../../../src/api/supabaseClient');
      }).rejects.toThrow(/Supabase configuration missing/);
    });

    it('should log specific missing variables to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock missing VITE_SUPABASE_URL
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'test-key');

      try {
        await import('../../../src/api/supabaseClient');
      } catch {
        // Expected to throw
      }

      // Verify console.error was called with specific messages
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Supabase] Missing required environment variables'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Supabase] VITE_SUPABASE_URL:',
        '✗'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Supabase] VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY:',
        '✓'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Supabase Client Initialization', () => {
    it('should initialize Supabase client when all env vars are present', async () => {
      // Mock valid environment variables
      vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'test-anon-key');

      // Import module with valid env vars
      const { supabase, isSupabaseConfigured } = await import(
        '../../../src/api/supabaseClient'
      );

      // Verify Supabase client is defined
      expect(supabase).toBeDefined();
      expect(supabase.supabaseUrl).toBe('https://test.supabase.co');
      expect(isSupabaseConfigured()).toBe(true);
    });

    it('should configure Supabase client with correct auth options', async () => {
      // Mock valid environment variables
      vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'test-anon-key');

      // Import module
      const { supabase } = await import('../../../src/api/supabaseClient');

      // Verify auth configuration (Supabase client stores these in internal state)
      expect(supabase).toBeDefined();
      expect(supabase.auth).toBeDefined();

      // Note: Supabase client doesn't expose auth configuration directly,
      // but we can verify the client is properly initialized with auth support
      expect(typeof supabase.auth.getSession).toBe('function');
      expect(typeof supabase.auth.signInWithPassword).toBe('function');
    });
  });

  describe('isSupabaseConfigured Utility', () => {
    it('should return true when both env vars are set', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'test-key');

      const { isSupabaseConfigured } = await import(
        '../../../src/api/supabaseClient'
      );

      expect(isSupabaseConfigured()).toBe(true);
    });
  });

  describe('Error Message Quality (AC-0.2.5)', () => {
    it('should provide clear error message listing missing variables', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', '');

      try {
        await import('../../../src/api/supabaseClient');
        // Should not reach here
        expect.fail('Expected module to throw error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Supabase configuration missing');
        expect((error as Error).message).toContain('VITE_SUPABASE_URL');
        expect((error as Error).message).toContain('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
      }
    });
  });
});
