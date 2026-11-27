/**
 * `createTrailingRead` on its own: one read in flight plus one trailing pass per key.
 * `readOnce` is a mock whose call count is exact without any wait, because a chain starts
 * its read synchronously in `call()`; each read is held open by a `deferred`.
 */
import { describe, expect, it, vi } from 'vitest';
import { createTrailingRead } from '../../../src/stores/trailingRead';
import { deferred } from './loaderIdentityGuardsFixture';

describe('createTrailingRead', () => {
  it('starts a read at once for a call that finds none running', () => {
    const readOnce = vi.fn(() => deferred<void>().promise);
    const trailingRead = createTrailingRead(() => 'A', readOnce);

    void trailingRead.call();

    expect(readOnce).toHaveBeenCalledTimes(1);
  });

  it('a call that arrives while a read is open waits: no read of its own until that one ends', async () => {
    const running = deferred<void>();
    const trailing = deferred<void>();
    const readOnce = vi
      .fn()
      .mockReturnValueOnce(running.promise)
      .mockReturnValueOnce(trailing.promise);
    const trailingRead = createTrailingRead(() => 'A', readOnce);

    const first = trailingRead.call();
    const second = trailingRead.call();
    expect(readOnce).toHaveBeenCalledTimes(1);
    running.settle();
    await first;
    await vi.waitFor(() => expect(readOnce).toHaveBeenCalledTimes(2));
    trailing.settle();
    await second;

    expect(readOnce).toHaveBeenCalledTimes(2);
  });

  it('calls that arrive while a read is open share one trailing pass', async () => {
    const running = deferred<void>();
    const readOnce = vi.fn().mockReturnValueOnce(running.promise).mockResolvedValue(undefined);
    const trailingRead = createTrailingRead(() => 'A', readOnce);

    const calls = [trailingRead.call(), trailingRead.call(), trailingRead.call()];
    running.settle();
    await Promise.all(calls);

    expect(readOnce).toHaveBeenCalledTimes(2);
  });

  it('tells the read whether a trailing pass is waiting behind it', async () => {
    const running = deferred<void>();
    const asked: boolean[] = [];
    const readOnce = vi.fn(async (trailingRequested: () => boolean) => {
      if (readOnce.mock.calls.length === 1) await running.promise;
      asked.push(trailingRequested());
    });
    const trailingRead = createTrailingRead(() => 'A', readOnce);

    const calls = [trailingRead.call(), trailingRead.call()];
    running.settle();
    await Promise.all(calls);

    expect(asked).toEqual([true, false]);
  });

  it("an old key's read ending leaves the new key's read in the slot", async () => {
    let key = 'A';
    const old = deferred<void>();
    const fresh = deferred<void>();
    const pass = deferred<void>();
    const readOnce = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise)
      .mockReturnValueOnce(pass.promise);
    const trailingRead = createTrailingRead(() => key, readOnce);

    const oldCall = trailingRead.call();
    key = 'B';
    const freshCall = trailingRead.call();
    expect(readOnce).toHaveBeenCalledTimes(2);
    old.settle();
    await oldCall;

    // The new key's read is still open, so this call waits for a pass after it.
    const joined = trailingRead.call();
    expect(readOnce).toHaveBeenCalledTimes(2);
    fresh.settle();
    await freshCall;
    await vi.waitFor(() => expect(readOnce).toHaveBeenCalledTimes(3));
    pass.settle();
    await joined;

    expect(readOnce).toHaveBeenCalledTimes(3);
  });

  it('a trailing pass asked for under a key that changed is not sent, and its call settles', async () => {
    let key = 'A';
    const running = deferred<void>();
    const readOnce = vi.fn().mockReturnValueOnce(running.promise);
    const trailingRead = createTrailingRead(() => key, readOnce);

    const first = trailingRead.call();
    const dropped = trailingRead.call();
    key = 'B';
    running.settle();
    await first;

    await expect(dropped).resolves.toBeUndefined();
    expect(readOnce).toHaveBeenCalledTimes(1);
  });

  it('a call with nobody signed in settles at once and reads nothing', async () => {
    const readOnce = vi.fn();
    const trailingRead = createTrailingRead(() => null, readOnce);

    await expect(trailingRead.call()).resolves.toBeUndefined();

    expect(readOnce).not.toHaveBeenCalled();
  });

  it('a failing read rejects the call it covers and the next call starts a new read', async () => {
    const readOnce = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const trailingRead = createTrailingRead(() => 'A', readOnce);

    await expect(trailingRead.call()).rejects.toThrow('boom');
    await trailingRead.call();

    expect(readOnce).toHaveBeenCalledTimes(2);
  });
});
