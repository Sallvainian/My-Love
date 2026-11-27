/**
 * listenToPartnerEvents: the one retry the four routed partner-channel
 * listeners share (DW-505). A rejected `subscribePartnerEvents` is retried on
 * the registry's bounded backoff; unmount, offline and the retry ceiling stop
 * it, and a subscription that lands after a cancel is handed straight back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setOnline } from '../stores/navigatorFixtures';

vi.mock('@/api/moodSyncService', () => ({
  moodSyncService: { subscribePartnerEvents: vi.fn() },
}));

import { listenToPartnerEvents } from '@/api/listenToPartnerEvents';
import { moodSyncService } from '@/api/moodSyncService';
import { RETRY_CONFIG, retryDelay } from '@/api/realtimeRetry';

const subscribe = vi.mocked(moodSyncService.subscribePartnerEvents);
const FAILURE = '[test] Could not listen:';

describe('listenToPartnerEvents', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    setOnline(true);
    subscribe.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    errorSpy.mockRestore();
    setOnline(true);
  });

  it('attaches the handlers once when the first attempt resolves, with no retry', async () => {
    const release = vi.fn();
    subscribe.mockResolvedValue(release);
    const handlers = { onStatus: vi.fn() };

    const stop = listenToPartnerEvents(handlers, { failureMessage: FAILURE });
    await vi.advanceTimersByTimeAsync(RETRY_CONFIG.maxDelay);

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(handlers);
    stop();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('retries a rejected subscribe on the doubling backoff and then holds the subscription', async () => {
    const release = vi.fn();
    const failure = new Error('setAuth failed');
    subscribe
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(release);
    const onRetry = vi.fn();

    const stop = listenToPartnerEvents({}, { failureMessage: FAILURE, onRetry });
    await vi.advanceTimersByTimeAsync(0);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(FAILURE, failure);

    await vi.advanceTimersByTimeAsync(retryDelay(0) - 1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(retryDelay(1) - 1);
    expect(subscribe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(subscribe).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);

    // Subscribed now: nothing more is attempted, and stop releases it.
    await vi.advanceTimersByTimeAsync(RETRY_CONFIG.maxDelay * 2);
    expect(subscribe).toHaveBeenCalledTimes(3);
    expect(release).not.toHaveBeenCalled();
    stop();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry ceiling and says so', async () => {
    subscribe.mockRejectedValue(new Error('down'));

    listenToPartnerEvents({}, { failureMessage: FAILURE });
    await vi.advanceTimersByTimeAsync(RETRY_CONFIG.maxDelay * (RETRY_CONFIG.maxRetries + 2));

    // The first attempt and each retry, and none after.
    expect(subscribe).toHaveBeenCalledTimes(RETRY_CONFIG.maxRetries + 1);
    expect(errorSpy).toHaveBeenCalledWith(
      `[listenToPartnerEvents] Max retries (${RETRY_CONFIG.maxRetries}) exceeded. Giving up.`
    );
  });

  it('stops retrying when cancelled', async () => {
    subscribe.mockRejectedValue(new Error('down'));

    const stop = listenToPartnerEvents({}, { failureMessage: FAILURE });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(RETRY_CONFIG.maxDelay * 2);

    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('stops retrying while the device is offline', async () => {
    subscribe.mockRejectedValue(new Error('down'));

    listenToPartnerEvents({}, { failureMessage: FAILURE });
    await vi.advanceTimersByTimeAsync(0);
    setOnline(false);
    await vi.advanceTimersByTimeAsync(RETRY_CONFIG.maxDelay * 2);

    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('hands back a subscription that resolves after a cancel', async () => {
    const release = vi.fn();
    let resolve: (fn: () => void) => void = () => {};
    subscribe.mockReturnValue(new Promise((r) => (resolve = r)));

    const stop = listenToPartnerEvents({}, { failureMessage: FAILURE });
    stop();
    resolve(release);
    await vi.advanceTimersByTimeAsync(0);

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('does not retry a rejection that lands after a cancel', async () => {
    let reject: (error: Error) => void = () => {};
    subscribe.mockReturnValue(new Promise((_, r) => (reject = r)));

    const stop = listenToPartnerEvents({}, { failureMessage: FAILURE });
    stop();
    reject(new Error('late'));
    await vi.advanceTimersByTimeAsync(RETRY_CONFIG.maxDelay * 2);

    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('releases once when stop is called twice', async () => {
    const release = vi.fn();
    subscribe.mockResolvedValue(release);

    const stop = listenToPartnerEvents({}, { failureMessage: FAILURE });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    stop();

    expect(release).toHaveBeenCalledTimes(1);
  });
});
