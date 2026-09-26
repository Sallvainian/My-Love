/**
 * accountDataError — the one wording for an up-front offline refusal
 * (ticket 11, CAP-4): "You are offline. <what> need(s) a connection to <action>."
 */
import { describe, expect, it, vi } from 'vitest';
import {
  AccountDataError,
  offlineMessage,
  requireOnline,
} from '../../../src/services/accountDataError';

describe('offlineMessage', () => {
  it('builds the plural sentence, defaulting to "save"', () => {
    expect(offlineMessage('Custom messages')).toBe(
      'You are offline. Custom messages need a connection to save.'
    );
    expect(offlineMessage('Photos', 'upload')).toBe(
      'You are offline. Photos need a connection to upload.'
    );
  });

  it('takes "needs" for a singular subject', () => {
    expect(offlineMessage('A poke', 'be marked as seen', 'needs')).toBe(
      'You are offline. A poke needs a connection to be marked as seen.'
    );
  });
});

describe('requireOnline', () => {
  it('keeps its existing wording, built by the helper', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    let thrown: unknown;
    try {
      requireOnline('Couple settings');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AccountDataError);
    expect((thrown as AccountDataError).code).toBe('offline');
    expect((thrown as AccountDataError).message).toBe(
      'You are offline. Couple settings need a connection to save.'
    );
    expect(() => requireOnline('Custom messages', 'load')).toThrow(
      'You are offline. Custom messages need a connection to load.'
    );
    expect(() => requireOnline('Partner requests', 'decline')).toThrow(
      'You are offline. Partner requests need a connection to decline.'
    );
  });

  it('does nothing online', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    expect(() => requireOnline('Couple settings')).not.toThrow();
  });
});
