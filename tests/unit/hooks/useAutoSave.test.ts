/**
 * Unit tests for useAutoSave hook
 *
 * Story 1.4: Task 7.1 — Auto-Save Hook Tests
 *
 * Tests:
 * - visibilitychange with hidden state triggers save
 * - no save triggered when visibility is visible
 * - no save triggered when session is null
 * - no save triggered when session status is complete
 * - cleanup removes event listeners
 * - beforeunload triggers save
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoSave } from '../../../src/hooks/useAutoSave';
import type { ScriptureSession } from '../../../src/services/dbSchema';

describe('useAutoSave hook', () => {
  let documentListeners: Record<string, Array<(event: Event) => void>>;
  let windowListeners: Record<string, Array<(event: Event) => void>>;

  const mockSaveSession = vi.fn().mockResolvedValue(undefined);

  function createMockSession(overrides?: Partial<ScriptureSession>): ScriptureSession {
    return {
      id: 'session-123',
      mode: 'solo',
      userId: 'user-456',
      currentPhase: 'reading',
      currentStepIndex: 3,
      status: 'in_progress',
      version: 1,
      startedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    documentListeners = {};
    windowListeners = {};

    vi.spyOn(document, 'addEventListener').mockImplementation((event, listener) => {
      if (!documentListeners[event]) documentListeners[event] = [];
      if (typeof listener === 'function') documentListeners[event].push(listener);
    });

    vi.spyOn(document, 'removeEventListener').mockImplementation((event, listener) => {
      if (documentListeners[event] && typeof listener === 'function') {
        documentListeners[event] = documentListeners[event].filter((l) => l !== listener);
      }
    });

    vi.spyOn(window, 'addEventListener').mockImplementation((event, listener) => {
      if (!windowListeners[event]) windowListeners[event] = [];
      if (typeof listener === 'function') windowListeners[event].push(listener);
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation((event, listener) => {
      if (windowListeners[event] && typeof listener === 'function') {
        windowListeners[event] = windowListeners[event].filter((l) => l !== listener);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should trigger save on visibilitychange when hidden and session is in_progress', () => {
    const session = createMockSession();

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    renderHook(() => useAutoSave({ session, saveSession: mockSaveSession }));

    // Fire visibilitychange
    documentListeners['visibilitychange']?.forEach((fn) => fn(new Event('visibilitychange')));

    expect(mockSaveSession).toHaveBeenCalledTimes(1);
  });

  it('should not trigger save when visibility is visible', () => {
    const session = createMockSession();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });

    renderHook(() => useAutoSave({ session, saveSession: mockSaveSession }));

    documentListeners['visibilitychange']?.forEach((fn) => fn(new Event('visibilitychange')));

    expect(mockSaveSession).not.toHaveBeenCalled();
  });

  it('should not trigger save when session is null', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    renderHook(() => useAutoSave({ session: null, saveSession: mockSaveSession }));

    documentListeners['visibilitychange']?.forEach((fn) => fn(new Event('visibilitychange')));

    expect(mockSaveSession).not.toHaveBeenCalled();
  });

  it('should not trigger save when session status is complete', () => {
    const session = createMockSession({ status: 'complete' });

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    renderHook(() => useAutoSave({ session, saveSession: mockSaveSession }));

    documentListeners['visibilitychange']?.forEach((fn) => fn(new Event('visibilitychange')));

    expect(mockSaveSession).not.toHaveBeenCalled();
  });

  it('should trigger save on beforeunload when session is in_progress', () => {
    const session = createMockSession();

    renderHook(() => useAutoSave({ session, saveSession: mockSaveSession }));

    windowListeners['beforeunload']?.forEach((fn) => fn(new Event('beforeunload')));

    expect(mockSaveSession).toHaveBeenCalledTimes(1);
  });

  it('should cleanup event listeners on unmount', () => {
    const session = createMockSession();

    const { unmount } = renderHook(() =>
      useAutoSave({ session, saveSession: mockSaveSession })
    );

    expect(document.addEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
    expect(window.addEventListener).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );

    unmount();

    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });
});
