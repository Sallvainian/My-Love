/**
 * sentry.ts Unit Tests
 *
 * Tests for Sentry configuration module:
 * - initSentry: no-op when DSN absent
 * - initSentry: calls Sentry.init with DSN when present
 * - initSentry: enabled:false in test env (PROD is false)
 * - setSentryUser: sets user.id and partner_id tag
 * - setSentryUser: handles null partner (uses 'none')
 * - clearSentryUser: calls setUser(null)
 * - beforeSend: removes PII (email + ip_address), preserves id
 * - beforeSend: no-throw when user is absent on event
 *
 * Story S-6: Subtask 1-2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BrowserOptions } from '@sentry/react';

// Mock @sentry/react before importing the module under test.
// vi.mock is hoisted — all Sentry calls in sentry.ts will use these fakes.
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
}));

import * as Sentry from '@sentry/react';
import { initSentry, setSentryUser, clearSentryUser } from '../sentry';

// Derive the beforeSend function type from BrowserOptions to avoid
// importing @sentry/core's Event type which conflicts with the DOM Event global.
type BeforeSendFn = NonNullable<BrowserOptions['beforeSend']>;
type SentryEvent = Parameters<BeforeSendFn>[0];
type SentryHint = Parameters<BeforeSendFn>[1];

describe('sentry config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ---------------------------------------------------------------------------
  // initSentry
  // ---------------------------------------------------------------------------

  describe('initSentry', () => {
    it('should no-op when VITE_SENTRY_DSN is absent', () => {
      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('should call Sentry.init with the provided DSN', () => {
      vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/123');

      initSentry();

      expect(Sentry.init).toHaveBeenCalledOnce();
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({ dsn: 'https://test@sentry.io/123' })
      );
    });

    it('should pass enabled:false in test environment (PROD is false)', () => {
      vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/123');

      initSentry();

      // In Vitest, import.meta.env.PROD is always false (not a production build)
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // setSentryUser
  // ---------------------------------------------------------------------------

  describe('setSentryUser', () => {
    it('should set user.id and partner_id tag', () => {
      setSentryUser('user-uuid-abc', 'partner-uuid-xyz');

      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-uuid-abc' });
      expect(Sentry.setTag).toHaveBeenCalledWith('partner_id', 'partner-uuid-xyz');
    });

    it('should use "none" for partner_id tag when partner is null', () => {
      setSentryUser('user-uuid-abc', null);

      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-uuid-abc' });
      expect(Sentry.setTag).toHaveBeenCalledWith('partner_id', 'none');
    });
  });

  // ---------------------------------------------------------------------------
  // clearSentryUser
  // ---------------------------------------------------------------------------

  describe('clearSentryUser', () => {
    it('should call Sentry.setUser(null)', () => {
      clearSentryUser();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  // ---------------------------------------------------------------------------
  // beforeSend — PII stripping
  // ---------------------------------------------------------------------------

  describe('beforeSend PII stripping', () => {
    let beforeSend: BeforeSendFn;

    beforeEach(() => {
      vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/123');
      initSentry();

      const initArg = vi.mocked(Sentry.init).mock.calls[0][0] as BrowserOptions;
      if (!initArg?.beforeSend) {
        throw new Error('beforeSend was not passed to Sentry.init — check initSentry()');
      }
      beforeSend = initArg.beforeSend;
    });

    it('should remove email from event.user', () => {
      const event: SentryEvent = {
        user: {
          id: 'user-uuid-abc',
          email: 'private@example.com',
          ip_address: '192.168.0.1',
        },
      };

      const result = beforeSend(event, {} as SentryHint) as SentryEvent | null;

      expect(result?.user?.email).toBeUndefined();
    });

    it('should remove ip_address from event.user', () => {
      const event: SentryEvent = {
        user: {
          id: 'user-uuid-abc',
          email: 'private@example.com',
          ip_address: '192.168.0.1',
        },
      };

      const result = beforeSend(event, {} as SentryHint) as SentryEvent | null;

      expect(result?.user?.ip_address).toBeUndefined();
    });

    it('should preserve user.id after PII stripping', () => {
      const event: SentryEvent = {
        user: {
          id: 'user-uuid-abc',
          email: 'private@example.com',
          ip_address: '192.168.0.1',
        },
      };

      const result = beforeSend(event, {} as SentryHint) as SentryEvent | null;

      expect(result?.user?.id).toBe('user-uuid-abc');
    });

    it('should not throw when event.user is absent', () => {
      const event: SentryEvent = { message: 'something went wrong' };

      expect(() => beforeSend(event, {} as SentryHint)).not.toThrow();
    });

    it('should return the event when event.user is absent', () => {
      const event: SentryEvent = { message: 'something went wrong' };

      const result = beforeSend(event, {} as SentryHint);

      expect(result).toBeDefined();
    });
  });
});
