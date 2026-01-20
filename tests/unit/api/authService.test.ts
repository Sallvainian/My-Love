/**
 * AuthService Unit Tests
 *
 * Tests for authentication service including:
 * - Sign in with email/password
 * - Sign up new users
 * - Sign out
 * - Session management
 * - User retrieval
 * - Auth state change subscription
 * - Password reset
 * - Google OAuth
 *
 * Security-critical tests - ensure all auth flows are properly tested.
 *
 * Anti-patterns avoided:
 * - No testing of implementation details
 * - Explicit error case testing
 * - Mock verification with specific arguments
 * - Proper async handling
 *
 * @module tests/unit/api/authService.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  createMockUser,
  createMockSession,
  createMockAuthError,
} from '../utils/testHelpers';

// Mock supabase client BEFORE importing authService
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockSignInWithOAuth = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: () => mockSignOut(),
      getSession: () => mockGetSession(),
      getUser: () => mockGetUser(),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}));

// Mock sw-db for token storage
const mockStoreAuthToken = vi.fn();
const mockClearAuthToken = vi.fn();

vi.mock('../../../src/sw-db', () => ({
  storeAuthToken: (...args: unknown[]) => mockStoreAuthToken(...args),
  clearAuthToken: () => mockClearAuthToken(),
}));

// Now import the service after mocks are set up
import {
  signIn,
  signUp,
  signOut,
  getSession,
  getUser,
  getCurrentUserId,
  getCurrentUserIdOfflineSafe,
  getAuthStatus,
  onAuthStateChange,
  resetPassword,
  signInWithGoogle,
} from '../../../src/api/authService';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset token storage mocks to resolve by default
    mockStoreAuthToken.mockResolvedValue(undefined);
    mockClearAuthToken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signIn', () => {
    it('should sign in successfully with valid credentials', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });

      mockSignInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await signIn({ email: 'test@example.com', password: 'password123' });

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should call supabase.auth.signInWithPassword with correct credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: createMockUser(), session: createMockSession() },
        error: null,
      });

      await signIn({ email: 'user@test.com', password: 'securePass' });

      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'securePass',
      });
    });

    it('should store auth token in IndexedDB after successful sign in', async () => {
      const mockSession = createMockSession({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: 1234567890,
      });
      const mockUser = createMockUser({ id: 'user-id-456' });

      mockSignInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      await signIn({ email: 'test@example.com', password: 'password' });

      expect(mockStoreAuthToken).toHaveBeenCalledTimes(1);
      expect(mockStoreAuthToken).toHaveBeenCalledWith({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: 1234567890,
        userId: 'user-id-456',
      });
    });

    it('should return error when sign in fails', async () => {
      const mockError = createMockAuthError('Invalid login credentials');

      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      });

      const result = await signIn({ email: 'test@example.com', password: 'wrongpassword' });

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toEqual(mockError);
      expect(result.error?.message).toBe('Invalid login credentials');
    });

    it('should NOT store token when sign in fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: createMockAuthError('Invalid credentials'),
      });

      await signIn({ email: 'test@example.com', password: 'wrong' });

      expect(mockStoreAuthToken).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors gracefully', async () => {
      mockSignInWithPassword.mockRejectedValue(new Error('Network error'));

      const result = await signIn({ email: 'test@example.com', password: 'password' });

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should still succeed even if token storage fails', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession();

      mockSignInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });
      mockStoreAuthToken.mockRejectedValue(new Error('IndexedDB error'));

      const result = await signIn({ email: 'test@example.com', password: 'password' });

      // Sign in should still succeed
      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });
  });

  describe('signUp', () => {
    it('should sign up successfully with valid credentials', async () => {
      const mockUser = createMockUser({ email: 'newuser@example.com' });
      const mockSession = createMockSession();

      mockSignUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await signUp({ email: 'newuser@example.com', password: 'newpassword' });

      expect(result.user?.email).toBe('newuser@example.com');
      expect(result.error).toBeNull();
    });

    it('should call supabase.auth.signUp with correct credentials', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: createMockUser(), session: createMockSession() },
        error: null,
      });

      await signUp({ email: 'new@test.com', password: 'newPass123' });

      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@test.com',
        password: 'newPass123',
      });
    });

    it('should return error when email already exists', async () => {
      const mockError = createMockAuthError('User already registered');

      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      });

      const result = await signUp({ email: 'existing@example.com', password: 'password' });

      expect(result.error?.message).toBe('User already registered');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockSignUp.mockRejectedValue(new Error('Server error'));

      const result = await signUp({ email: 'test@example.com', password: 'password' });

      expect(result.user).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      await expect(signOut()).resolves.not.toThrow();
    });

    it('should clear auth token from IndexedDB', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      await signOut();

      expect(mockClearAuthToken).toHaveBeenCalledTimes(1);
    });

    it('should throw error when sign out fails', async () => {
      const mockError = createMockAuthError('Sign out failed');
      mockSignOut.mockResolvedValue({ error: mockError });

      await expect(signOut()).rejects.toThrow();
    });

    it('should still succeed even if token clearing fails', async () => {
      mockSignOut.mockResolvedValue({ error: null });
      mockClearAuthToken.mockRejectedValue(new Error('IndexedDB error'));

      // Should not throw
      await expect(signOut()).resolves.not.toThrow();
    });
  });

  describe('getSession', () => {
    it('should return session when authenticated', async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const session = await getSession();

      expect(session).toEqual(mockSession);
    });

    it('should return null when not authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const session = await getSession();

      expect(session).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: createMockAuthError('Session error'),
      });

      const session = await getSession();

      expect(session).toBeNull();
    });

    it('should handle unexpected errors gracefully', async () => {
      mockGetSession.mockRejectedValue(new Error('Network error'));

      const session = await getSession();

      expect(session).toBeNull();
    });
  });

  describe('getUser', () => {
    it('should return user when authenticated', async () => {
      const mockUser = createMockUser();
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const user = await getUser();

      expect(user).toEqual(mockUser);
    });

    it('should return null when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const user = await getUser();

      expect(user).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: createMockAuthError('User error'),
      });

      const user = await getUser();

      expect(user).toBeNull();
    });
  });

  describe('getCurrentUserId', () => {
    it('should return user ID when authenticated', async () => {
      const mockUser = createMockUser({ id: 'specific-user-id-789' });
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userId = await getCurrentUserId();

      expect(userId).toBe('specific-user-id-789');
    });

    it('should return null when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const userId = await getCurrentUserId();

      expect(userId).toBeNull();
    });
  });

  describe('getCurrentUserIdOfflineSafe', () => {
    it('should return user ID from cached session', async () => {
      const mockUser = createMockUser({ id: 'offline-user-id' });
      const mockSession = createMockSession({ user: mockUser });
      mockGetSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const userId = await getCurrentUserIdOfflineSafe();

      expect(userId).toBe('offline-user-id');
    });

    it('should return null when no cached session', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const userId = await getCurrentUserIdOfflineSafe();

      expect(userId).toBeNull();
    });
  });

  describe('getAuthStatus', () => {
    it('should return authenticated status with user info', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      mockGetSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const status = await getAuthStatus();

      expect(status.isAuthenticated).toBe(true);
      expect(status.user).toEqual(mockUser);
      expect(status.session).toEqual(mockSession);
    });

    it('should return unauthenticated status when no session', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const status = await getAuthStatus();

      expect(status.isAuthenticated).toBe(false);
      expect(status.user).toBeNull();
      expect(status.session).toBeNull();
    });
  });

  describe('onAuthStateChange', () => {
    it('should subscribe to auth state changes', () => {
      const mockUnsubscribe = vi.fn();
      mockOnAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });

      const callback = vi.fn();
      const unsubscribe = onAuthStateChange(callback);

      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback when auth state changes', async () => {
      let capturedCallback: ((event: AuthChangeEvent, session: Session | null) => Promise<void>) | null = null;

      mockOnAuthStateChange.mockImplementation((cb) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      const userCallback = vi.fn();
      onAuthStateChange(userCallback);

      // Simulate auth state change (callback is async internally)
      const mockSession = createMockSession();
      await capturedCallback!('SIGNED_IN', mockSession);

      expect(userCallback).toHaveBeenCalledWith(mockSession);
    });

    it('should store token on SIGNED_IN event', async () => {
      let capturedCallback: ((event: AuthChangeEvent, session: Session | null) => Promise<void>) | null =
        null;

      mockOnAuthStateChange.mockImplementation((cb) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      onAuthStateChange(vi.fn());

      const mockSession = createMockSession({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_at: 9999999999,
      });

      await capturedCallback!('SIGNED_IN', mockSession);

      expect(mockStoreAuthToken).toHaveBeenCalledWith({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresAt: 9999999999,
        userId: mockSession.user.id,
      });
    });

    it('should clear token on SIGNED_OUT event', async () => {
      let capturedCallback: ((event: AuthChangeEvent, session: Session | null) => Promise<void>) | null =
        null;

      mockOnAuthStateChange.mockImplementation((cb) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      onAuthStateChange(vi.fn());

      await capturedCallback!('SIGNED_OUT', null);

      expect(mockClearAuthToken).toHaveBeenCalled();
    });

    it('should return working unsubscribe function', () => {
      const mockUnsubscribe = vi.fn();
      mockOnAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });

      const unsubscribe = onAuthStateChange(vi.fn());
      unsubscribe();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email successfully', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      const error = await resetPassword('user@example.com');

      expect(error).toBeNull();
    });

    it('should call supabase with correct email and redirect URL', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      await resetPassword('reset@test.com');

      expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('reset@test.com', {
        redirectTo: expect.stringContaining('reset-password'),
      });
    });

    it('should return error when reset fails', async () => {
      const mockError = createMockAuthError('Invalid email');
      mockResetPasswordForEmail.mockResolvedValue({ error: mockError });

      const error = await resetPassword('invalid-email');

      expect(error).toEqual(mockError);
      expect(error?.message).toBe('Invalid email');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockResetPasswordForEmail.mockRejectedValue(new Error('Network error'));

      const error = await resetPassword('user@example.com');

      expect(error).toBeDefined();
    });
  });

  describe('signInWithGoogle', () => {
    it('should initiate Google OAuth successfully', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null });

      const error = await signInWithGoogle();

      expect(error).toBeNull();
    });

    it('should call supabase with correct OAuth configuration', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null });

      await signInWithGoogle();

      expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.any(String),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
    });

    it('should return error when OAuth fails', async () => {
      const mockError = createMockAuthError('OAuth configuration error');
      mockSignInWithOAuth.mockResolvedValue({ error: mockError });

      const error = await signInWithGoogle();

      expect(error).toEqual(mockError);
    });

    it('should handle unexpected errors gracefully', async () => {
      mockSignInWithOAuth.mockRejectedValue(new Error('Network error'));

      const error = await signInWithGoogle();

      expect(error).toBeDefined();
    });
  });
});
