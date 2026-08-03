/**
 * Sign-out must not leave one couple's private state visible to the next
 *
 * `clearAuth` is the only thing that runs on sign-out that touches store state:
 * signing out unmounts the React tree but the Zustand store itself survives, so
 * anything it does not clear is still there when the next account signs in on
 * the same device.
 *
 * It originally cleared `moods` alone. `partnerMoods` holds the *partner's*
 * entries — carrying their free-text notes, exactly as private — and `partner`
 * holds the name rendered in "Connected with {displayName}". PartnerMoodView
 * paints both before its own fetch resolves, and that fetch is gated on
 * connectivity, so offline there is no correction at all.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';
import { createAuthSlice, type AuthSlice } from '../../../src/stores/slices/authSlice';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {} },
  getPartnerId: vi.fn(),
}));

type Store = AuthSlice & Record<string, unknown>;

function createTestStore() {
  return create<Store>()(createAuthSlice as unknown as StateCreator<Store>);
}

/** A mood entry shaped like the real one, note included */
function moodEntry(userId: string, note: string) {
  return {
    id: 1,
    userId,
    mood: 'sad',
    moods: ['sad'],
    note,
    date: '2026-08-03',
    timestamp: new Date('2026-08-03T06:00:00.000Z'),
    synced: true,
  };
}

describe('clearAuth on sign-out', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    store.setState({
      userId: 'user-A',
      userEmail: 'a@example.com',
      isAuthenticated: true,
      moods: [moodEntry('user-A', 'my own private note')],
      partnerMoods: [moodEntry('user-B', "my partner's private note")],
      partner: { id: 'user-B', displayName: 'Partner B', email: 'b@example.com' },
    });
  });

  it('clears the identity', () => {
    store.getState().clearAuth();

    expect(store.getState().userId).toBeNull();
    expect(store.getState().userEmail).toBeNull();
    expect(store.getState().isAuthenticated).toBe(false);
  });

  it("clears the signed-in user's own moods", () => {
    store.getState().clearAuth();

    expect(store.getState().moods).toEqual([]);
  });

  it("clears the partner's moods, which carry the partner's private notes", () => {
    store.getState().clearAuth();

    // The half that was missed: same disclosure as `moods`, different array.
    expect(store.getState().partnerMoods).toEqual([]);
  });

  it('clears the partner identity rendered in the header', () => {
    store.getState().clearAuth();

    // PartnerMoodView prints "Connected with {partner.displayName}" from this,
    // gated only on `partner` being truthy.
    expect(store.getState().partner).toBeNull();
  });

  it('leaves nothing carrying either account behind', () => {
    store.getState().clearAuth();

    const leftover = JSON.stringify(store.getState());
    expect(leftover).not.toContain('my own private note');
    expect(leftover).not.toContain("my partner's private note");
    expect(leftover).not.toContain('Partner B');
    expect(leftover).not.toContain('user-A');
    expect(leftover).not.toContain('user-B');
  });
});
