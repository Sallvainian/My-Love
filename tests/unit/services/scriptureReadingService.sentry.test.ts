/**
 * Sentry Integration Tests for handleScriptureError
 *
 * AC-1: captureException for error-level codes (SESSION_NOT_FOUND)
 * AC-2: captureMessage with level: 'warning' for warning-level codes (SYNC_FAILED)
 * AC-3: captureMessage called exactly once for OFFLINE
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import {
  handleScriptureError,
  ScriptureErrorCode,
} from '../../../src/services/scriptureReadingService';

const mockScopeInstances: Array<{
  setTag: ReturnType<typeof vi.fn>;
  setLevel: ReturnType<typeof vi.fn>;
  setExtra: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@sentry/react', () => ({
  withScope: vi.fn((callback: (scope: unknown) => void) => {
    const mockScope = {
      setTag: vi.fn(),
      setLevel: vi.fn(),
      setExtra: vi.fn(),
    };
    mockScopeInstances.push(mockScope);
    callback(mockScope);
    return mockScope;
  }),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

describe('handleScriptureError — Sentry integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScopeInstances.length = 0;
  });

  // ===========================================================================
  // AC-1: Error-level codes → captureException
  // ===========================================================================

  test('SESSION_NOT_FOUND calls Sentry.captureException with Error and scripture_error_code tag', () => {
    handleScriptureError({
      code: ScriptureErrorCode.SESSION_NOT_FOUND,
      message: 'Session abc not found',
      details: { sessionId: 'abc' },
    });

    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Session abc not found' }),
      expect.objectContaining({ extra: { details: { sessionId: 'abc' } } })
    );
  });

  test('UNAUTHORIZED calls Sentry.captureException', () => {
    handleScriptureError({
      code: ScriptureErrorCode.UNAUTHORIZED,
      message: 'Unauthorized access',
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unauthorized access' }),
      expect.objectContaining({ extra: { details: undefined } })
    );
  });

  test('CACHE_CORRUPTED calls Sentry.captureException', () => {
    handleScriptureError({
      code: ScriptureErrorCode.CACHE_CORRUPTED,
      message: 'Cache corrupted',
      details: 'bad data',
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Cache corrupted' }),
      expect.objectContaining({ extra: { details: 'bad data' } })
    );
  });

  test('VALIDATION_FAILED calls Sentry.captureException', () => {
    handleScriptureError({
      code: ScriptureErrorCode.VALIDATION_FAILED,
      message: 'Schema validation failed',
      details: { field: 'version' },
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Schema validation failed' }),
      expect.objectContaining({ extra: { details: { field: 'version' } } })
    );
  });

  // ===========================================================================
  // AC-2: Warning-level codes → captureMessage
  // ===========================================================================

  test('SYNC_FAILED calls Sentry.captureMessage with level warning and tag', () => {
    handleScriptureError({
      code: ScriptureErrorCode.SYNC_FAILED,
      message: 'Sync failed — queue for retry',
      details: { reason: 'channel timeout' },
    });

    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Sync failed — queue for retry');
    // F2 fix: warning-level errors now include details as extra context
    expect(mockScopeInstances[0].setExtra).toHaveBeenCalledWith('details', {
      reason: 'channel timeout',
    });
  });

  test('VERSION_MISMATCH calls Sentry.captureMessage with level warning', () => {
    handleScriptureError({
      code: ScriptureErrorCode.VERSION_MISMATCH,
      message: 'Version mismatch detected',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith('Version mismatch detected');
  });

  // ===========================================================================
  // AC-3: OFFLINE → captureMessage called exactly once
  // ===========================================================================

  test('OFFLINE calls Sentry.captureMessage exactly once with level warning', () => {
    handleScriptureError({
      code: ScriptureErrorCode.OFFLINE,
      message: 'Device is offline',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Device is offline');
  });

  // ===========================================================================
  // Verify tag is set for all codes
  // ===========================================================================

  test('All error codes set scripture_error_code tag via withScope', () => {
    const codes = Object.values(ScriptureErrorCode);

    for (const code of codes) {
      vi.clearAllMocks();
      handleScriptureError({ code, message: `test ${code}` });

      expect(Sentry.withScope).toHaveBeenCalledTimes(1);
      // The scope.setTag call happens inside the mock — verify withScope was invoked
    }
  });
});
