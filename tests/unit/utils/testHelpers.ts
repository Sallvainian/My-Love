/**
 * Shared test utilities and factory functions
 */

import type { Message, Photo, CustomMessage } from '@/types';

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
