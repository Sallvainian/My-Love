import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoveNote } from '../../types/models';

const mark = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const clearBadge = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const foreground = vi.hoisted(() => ({
  handlers: new Set<() => void>(),
}));

vi.mock('../../services/loveNotesReadService', () => ({ markLoveNotesRead: mark }));
vi.mock('../../services/pushNotifications', () => ({
  clearAppBadge: clearBadge,
  onForegroundPush: (handler: () => void) => {
    foreground.handlers.add(handler);
    return () => foreground.handlers.delete(handler);
  },
}));

import { FOREGROUND_BADGE_RECLEAR_MS, useLoveNotesReadMarker } from '../useLoveNotesReadMarker';

const ME = 'me';
const PARTNER = 'partner';

function note(id: string, from: string): LoveNote {
  return {
    id,
    from_user_id: from,
    to_user_id: from === ME ? PARTNER : ME,
    content: id,
    created_at: '2026-11-01T10:00:00.000Z',
  };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

function fireVisibilityChange(state: 'visible' | 'hidden') {
  setVisibility(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useLoveNotesReadMarker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    foreground.handlers.clear();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('marks once on mount, whatever the list holds', () => {
    renderHook(() => useLoveNotesReadMarker([note('a', PARTNER), note('b', ME)], ME));

    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('does not mark on mount when the document is hidden', () => {
    setVisibility('hidden');

    renderHook(() => useLoveNotesReadMarker([], ME));

    expect(mark).not.toHaveBeenCalled();
  });

  it('marks again when the document becomes visible, not when it hides', () => {
    renderHook(() => useLoveNotesReadMarker([], ME));
    mark.mockClear();

    fireVisibilityChange('hidden');
    expect(mark).not.toHaveBeenCalled();
    fireVisibilityChange('visible');
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('marks when a new partner note arrives on screen', () => {
    const { rerender } = renderHook(({ notes }) => useLoveNotesReadMarker(notes, ME), {
      initialProps: { notes: [note('a', PARTNER)] },
    });
    mark.mockClear();

    rerender({ notes: [note('a', PARTNER), note('b', PARTNER)] });

    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('marks when the list loads a partner note newer than the copy it started with', () => {
    const { rerender } = renderHook(({ notes }) => useLoveNotesReadMarker(notes, ME), {
      initialProps: { notes: [] as LoveNote[] },
    });
    mark.mockClear();

    rerender({ notes: [note('a', PARTNER)] });

    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('ignores the signed-in user\'s own notes', () => {
    const { rerender } = renderHook(({ notes }) => useLoveNotesReadMarker(notes, ME), {
      initialProps: { notes: [note('a', PARTNER)] },
    });
    mark.mockClear();

    rerender({ notes: [note('a', PARTNER), note('mine', ME)] });
    rerender({ notes: [note('a', PARTNER), note('mine', ME), note('mine2', ME)] });

    expect(mark).not.toHaveBeenCalled();
  });

  it('marks the same newest partner note once, however often the list changes', () => {
    const { rerender } = renderHook(({ notes }) => useLoveNotesReadMarker(notes, ME), {
      initialProps: { notes: [note('a', PARTNER)] },
    });
    mark.mockClear();

    rerender({ notes: [note('a', PARTNER), note('b', PARTNER)] });
    rerender({ notes: [note('a', PARTNER), note('b', PARTNER)] });
    rerender({ notes: [note('a', PARTNER), note('b', PARTNER), note('mine', ME)] });
    rerender({ notes: [note('older', PARTNER), note('a', PARTNER), note('b', PARTNER), note('mine', ME)] });

    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('does not mark a note that arrives while the document is hidden, nor again later for it', () => {
    const { rerender } = renderHook(({ notes }) => useLoveNotesReadMarker(notes, ME), {
      initialProps: { notes: [note('a', PARTNER)] },
    });
    mark.mockClear();
    setVisibility('hidden');

    rerender({ notes: [note('a', PARTNER), note('b', PARTNER)] });
    expect(mark).not.toHaveBeenCalled();

    // Coming back to the front marks through visibilitychange, once.
    fireVisibilityChange('visible');
    expect(mark).toHaveBeenCalledTimes(1);
    rerender({ notes: [note('a', PARTNER), note('b', PARTNER)] });
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('marks on a foreground push while visible, and not while hidden', () => {
    renderHook(() => useLoveNotesReadMarker([], ME));
    mark.mockClear();

    expect(foreground.handlers.size).toBe(1);
    foreground.handlers.forEach((handler) => handler());
    expect(mark).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    foreground.handlers.forEach((handler) => handler());
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('clears the badge once more after a foreground push, once iOS has set it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderHook(() => useLoveNotesReadMarker([], ME));

    foreground.handlers.forEach((handler) => handler());
    expect(clearBadge).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FOREGROUND_BADGE_RECLEAR_MS - 1);
    expect(clearBadge).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(clearBadge).toHaveBeenCalledTimes(1);
  });

  it('skips the later clear when the document hid meanwhile, and drops it on unmount', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { unmount } = renderHook(() => useLoveNotesReadMarker([], ME));

    foreground.handlers.forEach((handler) => handler());
    setVisibility('hidden');
    vi.advanceTimersByTime(FOREGROUND_BADGE_RECLEAR_MS);
    expect(clearBadge).not.toHaveBeenCalled();

    setVisibility('visible');
    foreground.handlers.forEach((handler) => handler());
    unmount();
    vi.advanceTimersByTime(FOREGROUND_BADGE_RECLEAR_MS);
    expect(clearBadge).not.toHaveBeenCalled();
  });

  it('marks again when the connection returns', () => {
    renderHook(() => useLoveNotesReadMarker([], ME));
    mark.mockClear();

    window.dispatchEvent(new Event('online'));

    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('removes every listener on unmount', () => {
    const { unmount } = renderHook(() => useLoveNotesReadMarker([], ME));
    unmount();
    mark.mockClear();

    fireVisibilityChange('visible');
    window.dispatchEvent(new Event('online'));
    foreground.handlers.forEach((handler) => handler());

    expect(foreground.handlers.size).toBe(0);
    expect(mark).not.toHaveBeenCalled();
  });
});
