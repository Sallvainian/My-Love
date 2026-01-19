/**
 * Shared test utilities and factory functions
 *
 * This module provides reusable mock factories for common types used in tests.
 * Use these instead of defining local factories to ensure consistency and
 * reduce duplication across test files.
 *
 * Usage:
 * ```typescript
 * import { createMockUser, createMockMoodEntry } from '../../utils/testHelpers';
 * ```
 */

import type { Message, Photo, CustomMessage, MoodEntry, Settings, Interaction } from '@/types';
import type { User, Session, AuthError, AuthChangeEvent } from '@supabase/supabase-js';

// ============================================================================
// Auth Mocks (Supabase)
// ============================================================================

/**
 * Create a mock Supabase User object
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-123',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: { name: 'Test User' },
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

/**
 * Create a mock Supabase Session object
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  const user = createMockUser(overrides.user);
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
    ...overrides,
  } as Session;
}

/**
 * Create a mock Supabase AuthError
 */
export function createMockAuthError(message: string, status = 400): AuthError {
  return {
    name: 'AuthError',
    message,
    status,
  } as AuthError;
}

/**
 * Valid AuthChangeEvent values for type-safe testing
 */
export const AUTH_EVENTS = {
  SIGNED_IN: 'SIGNED_IN' as AuthChangeEvent,
  SIGNED_OUT: 'SIGNED_OUT' as AuthChangeEvent,
  TOKEN_REFRESHED: 'TOKEN_REFRESHED' as AuthChangeEvent,
  USER_UPDATED: 'USER_UPDATED' as AuthChangeEvent,
  PASSWORD_RECOVERY: 'PASSWORD_RECOVERY' as AuthChangeEvent,
} as const;

// ============================================================================
// Message Mocks
// ============================================================================

/**
 * Create a mock message object with default values
 */
export function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    text: 'Test message',
    category: 'reasons',
    isFavorite: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    tags: [],
    source: 'preset',
    ...overrides,
  };
}

/**
 * Create a mock custom message object
 */
export function createMockCustomMessage(overrides: Partial<CustomMessage> = {}): CustomMessage {
  return {
    id: 1,
    text: 'Custom test message',
    category: 'reasons',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    tags: [],
    ...overrides,
  };
}

/**
 * Create multiple mock messages
 */
export function createMockMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) =>
    createMockMessage({
      id: i + 1,
      text: `Test message ${i + 1}`,
    })
  );
}

// ============================================================================
// Mood Mocks
// ============================================================================

/**
 * Create a mock MoodEntry object
 * Uses fixed dates to avoid flaky tests
 */
export function createMockMoodEntry(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: 1,
    userId: 'user-123',
    mood: 'happy',
    moods: ['happy'],
    note: 'Test note',
    date: '2024-01-15',
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
    synced: false,
    ...overrides,
  };
}

/**
 * Create a mock Supabase mood record (database format)
 */
export function createMockSupabaseMood(id: string = 'supabase-mood-1') {
  return {
    id,
    user_id: 'user-123',
    mood_type: 'happy',
    mood_types: ['happy'],
    note: 'Test note',
    created_at: '2024-01-15T10:30:00.000Z',
    date: '2024-01-15',
  };
}

// ============================================================================
// Interaction Mocks
// ============================================================================

/**
 * Create a mock Interaction object
 */
export function createMockInteraction(overrides: Partial<Interaction> = {}): Interaction {
  return {
    id: 'interaction-uuid-1',
    type: 'poke',
    fromUserId: 'user-123',
    toUserId: 'partner-456',
    viewed: false,
    createdAt: new Date('2024-01-15T10:30:00.000Z'),
    ...overrides,
  };
}

/**
 * Create a mock Supabase interaction record (database format)
 */
export function createMockSupabaseInteractionRecord(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 'interaction-uuid-1',
    type: 'poke',
    from_user_id: 'user-123',
    to_user_id: 'partner-456',
    viewed: false,
    created_at: '2024-01-15T10:30:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// Settings Mocks
// ============================================================================

/**
 * Create a mock Settings object with all required fields
 */
export function createMockSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    themeName: 'sunset',
    notificationTime: '09:00',
    relationship: {
      startDate: '2023-01-01',
      partnerName: 'Partner',
      anniversaries: [],
    },
    customization: {
      accentColor: '#FF6B6B',
      fontFamily: 'Inter',
    },
    notifications: {
      enabled: true,
      time: '09:00',
    },
    ...overrides,
  };
}

// ============================================================================
// Photo Mocks
// ============================================================================

/**
 * Create a mock photo object
 */
export function createMockPhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1,
    file: new Blob(['test image data'], { type: 'image/png' }),
    caption: 'Test photo',
    tags: ['test'],
    uploadDate: new Date('2024-01-01T00:00:00Z'),
    isFavorite: false,
    ...overrides,
  };
}

/**
 * Create multiple mock photos
 */
export function createMockPhotos(count: number): Photo[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPhoto({
      id: i + 1,
      caption: `Test photo ${i + 1}`,
      uploadDate: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`),
    })
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wait for a specified time (useful for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock Date.now() to return a specific timestamp
 */
export function mockDateNow(timestamp: number): () => void {
  const original = Date.now;
  Date.now = () => timestamp;
  return () => {
    Date.now = original;
  };
}
