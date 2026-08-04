/**
 * A loader that resolves after sign-out must not write the old account's data
 *
 * Sign Out sits in the bottom nav of the very screen that fires these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's partner, pending requests and mood notes
 * straight back on screen for whoever signs in next.
 *
 * The guard has a second half that is easy to get wrong: the loading flag is
 * raised BEFORE the await, so an early return that only skips the write leaves
 * it true forever. `PartnerMoodView` gates both of its branches on
 * `isLoadingPartner` — the partner view and the "Connect with Your Partner"
 * branch — so a stuck flag renders neither, and `ScriptureOverview` reports
 * 'loading' indefinitely. Discarding the data must also release the spinner.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const getPartner = vi.fn();
const getPendingRequests = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

vi.mock('../../../src/api/partnerService', () => ({
  partnerService: {
    getPartner: () => getPartner(),
    getPendingRequests: () => getPendingRequests(),
  },
}));

import { useAppStore } from '../../../src/stores/useAppStore';

const PARTNER_A = { id: 'USER-B-ID', displayName: 'A-PARTNER-NAME', email: 'b@example.com' };

/** A promise this test resolves by hand, so sign-out can land mid-flight */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

describe('loader identity guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().clearAuth();
    useAppStore.setState({ userId: 'USER-A-ID', isAuthenticated: true });
  });

  it('loadPartner discards a response that arrives after sign-out', async () => {
    const pending = deferred<typeof PARTNER_A>();
    getPartner.mockReturnValue(pending.promise);

    const inFlight = useAppStore.getState().loadPartner();
    expect(useAppStore.getState().isLoadingPartner).toBe(true);

    // The user taps Sign Out while the request is still open.
    useAppStore.getState().clearAuth();

    pending.settle(PARTNER_A);
    await inFlight;

    expect(useAppStore.getState().partner).toBeNull();
  });

  it('loadPartner still releases the spinner when it discards', async () => {
    const pending = deferred<typeof PARTNER_A>();
    getPartner.mockReturnValue(pending.promise);

    const inFlight = useAppStore.getState().loadPartner();
    expect(useAppStore.getState().isLoadingPartner).toBe(true);

    // The identity changes WITHOUT going through clearAuth — onAuthStateChange
    // resolving to a different user while a load raised on the previous one is
    // still open. This is the window that matters: clearAuth would itself reset
    // the flag, so routing through it cannot show whether the guard releases it.
    useAppStore.setState({ userId: 'USER-C-ID' });
    expect(useAppStore.getState().isLoadingPartner).toBe(true);

    pending.settle(PARTNER_A);
    await inFlight;

    // Stuck true renders neither branch of the partner tab and wedges
    // ScriptureOverview on 'loading'.
    expect(useAppStore.getState().isLoadingPartner).toBe(false);
    expect(useAppStore.getState().partner).toBeNull();
  });

  it('loadPendingRequests discards third-party requests after sign-out', async () => {
    const pending = deferred<{ sent: unknown[]; received: unknown[] }>();
    getPendingRequests.mockReturnValue(pending.promise);

    const inFlight = useAppStore.getState().loadPendingRequests();
    useAppStore.getState().clearAuth();

    pending.settle({
      sent: [{ id: 'req-1', toEmail: 'THIRD-PARTY-EMAIL' }],
      received: [],
    });
    await inFlight;

    const state = useAppStore.getState();
    expect(state.sentRequests).toEqual([]);
    expect(state.isLoadingRequests).toBe(false);
    expect(JSON.stringify(state)).not.toContain('THIRD-PARTY-EMAIL');
  });

  it('writes normally when the identity has not changed', async () => {
    // The guard must not break the ordinary path it wraps.
    getPartner.mockResolvedValue(PARTNER_A);

    await useAppStore.getState().loadPartner();

    expect(useAppStore.getState().partner).toEqual(PARTNER_A);
    expect(useAppStore.getState().isLoadingPartner).toBe(false);
  });
});
