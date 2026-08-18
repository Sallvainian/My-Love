/**
 * Persisted state — events must never reach localStorage
 *
 * Events are couple-shared and Supabase-only. `partialize` in `useAppStore.ts`
 * is an allowlist of `settings`, `isOnboarded` and `messageHistory`, so the
 * events keys are excluded by omission — which is exactly the kind of guarantee
 * that erodes silently. Nothing errors if a later story adds `events` to that
 * list; the couple's dates simply start surviving on the device, and on a shared
 * browser the next account rehydrates them before any fetch can correct it. That
 * is the failure `moods` already had, recorded at `useAppStore.ts:164-168` and
 * pinned by `persistedMoods.test.ts`.
 *
 * `clearAuth()` resetting the in-memory keys is the other half and is covered by
 * `signOutClearsAccountState.test.ts`. This file covers the disk.
 *
 * Scope note: only the WRITE side is asserted. `partialize` does not govern
 * reads (`useAppStore.ts:111`), so a blob that already contained `events` would
 * be rehydrated — which is why the adapter explicitly strips `moods` on the way
 * in at `useAppStore.ts:120-123`. Events get no such strip, and deliberately so:
 * no build has ever written them, so unlike `moods` there is no installed base
 * of bad blobs to defend against. Verified: adding the read-side assertion here
 * fails today. Carried as deferred work on the story rather than fixed blind.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'my-love-storage';

/** One event in memory, shaped the way `eventsService` returns them. */
const IN_MEMORY_EVENT = {
  id: 'event-1',
  userId: 'user-A',
  label: 'PRIVATE-EVENT-LABEL',
  date: new Date(2026, 8, 12),
  createdAt: new Date(2026, 0, 1),
  description: 'PRIVATE-EVENT-DESCRIPTION',
  icon: 'plane' as const,
};

describe('persisted events', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('does not write events into localStorage, and leaves the persist version alone', async () => {
    const { useAppStore } = await import('@/stores/useAppStore');

    // Hydration alone does not rewrite the key, so drive a persist the way the
    // app would: put events in memory (loadEvents does this) and change a key
    // that IS persisted.
    useAppStore.setState({
      events: [IN_MEMORY_EVENT],
      eventsIsLoading: true,
      eventsError: 'a failure worth not persisting',
      isOnboarded: true,
    });

    const raw = localStorage.getItem(STORAGE_KEY) as string;
    const parsed = JSON.parse(raw);

    expect(parsed.state).not.toHaveProperty('events');
    expect(parsed.state).not.toHaveProperty('eventsIsLoading');
    expect(parsed.state).not.toHaveProperty('eventsError');

    // Not just absent by key — absent by content, so a rename cannot smuggle it.
    expect(raw).not.toContain('PRIVATE-EVENT-LABEL');
    expect(raw).not.toContain('PRIVATE-EVENT-DESCRIPTION');

    // The E2E auth fixtures pin `version: 0`; excluding events must not bump it.
    expect(parsed.version).toBe(0);

    // The write did happen — otherwise the assertions above prove nothing.
    expect(parsed.state.isOnboarded).toBe(true);
  });
});
