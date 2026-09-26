/**
 * useLoveNotes loads the thread when a partner arrives in the store after the
 * chat was opened unlinked ("Partner not configured"), and only then: the
 * mount fetch is the only other load, and an ordinary start must not load
 * twice.
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../useRealtimeMessages', () => ({
  useRealtimeMessages: () => ({ status: 'connected' }),
}));

vi.mock('../../stores/slices/notesSlice', () => ({
  PARTNER_NOT_CONFIGURED: 'Partner not configured',
}));

const state: Record<string, unknown> = {};

vi.mock('../../stores/useAppStore', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) => selector(state),
}));

import { useLoveNotes } from '../useLoveNotes';

const fetchNotes = vi.fn(async () => {});

describe('useLoveNotes after a partner link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(state, {
      notes: [],
      notesIsLoading: false,
      notesError: null,
      notesHasMore: true,
      partner: null,
      fetchNotes,
      fetchOlderNotes: vi.fn(),
      clearNotesError: vi.fn(),
      sendNote: vi.fn(),
      retryFailedMessage: vi.fn(),
      removeFailedMessage: vi.fn(),
      cleanupPreviewUrls: vi.fn(),
    });
  });

  it('loads the thread once a partner arrives over "Partner not configured"', () => {
    const { rerender } = renderHook(() => useLoveNotes());
    expect(fetchNotes).toHaveBeenCalledTimes(1); // the mount fetch
    state.notesError = 'Partner not configured';
    rerender();
    expect(fetchNotes).toHaveBeenCalledTimes(1);

    state.partner = { id: 'PARTNER' };
    rerender();

    expect(fetchNotes).toHaveBeenCalledTimes(2);
  });

  it('does not load again when the saved partner lands after an ordinary mount fetch', () => {
    const { rerender } = renderHook(() => useLoveNotes());

    state.partner = { id: 'PARTNER' };
    rerender();

    expect(fetchNotes).toHaveBeenCalledTimes(1);
  });

  it('does nothing for the input-only instance', () => {
    state.notesError = 'Partner not configured';
    const { rerender } = renderHook(() => useLoveNotes(false));

    state.partner = { id: 'PARTNER' };
    rerender();

    expect(fetchNotes).not.toHaveBeenCalled();
  });
});
