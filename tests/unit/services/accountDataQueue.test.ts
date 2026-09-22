/**
 * accountDataQueue — strictly one account-data write, refresh or upload at a
 * time. Nothing ever starts beside a running task, however long it takes: a
 * stalled request is bounded where it is made (`requestTimeout()`), never by
 * releasing the queue, which would let the stalled task finish beside its
 * successor and erase that write from the mirror.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type QueueModule = typeof import('../../../src/services/accountDataQueue');

let queue: QueueModule;

beforeEach(async () => {
  vi.useFakeTimers();
  // A fresh module per case: the queue is module state, and a task left
  // pending by one case must not hold the next.
  vi.resetModules();
  queue = await import('../../../src/services/accountDataQueue');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('serializeAccountDataWrite', () => {
  it('runs tasks one at a time, in call order', async () => {
    const order: string[] = [];
    let finishFirst: () => void = () => {};
    const first = queue.serializeAccountDataWrite(
      () => new Promise<void>((resolve) => {
        order.push('first:start');
        finishFirst = () => {
          order.push('first:end');
          resolve();
        };
      })
    );
    const second = queue.serializeAccountDataWrite(async () => {
      order.push('second');
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['first:start']);
    finishFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  it('a rejected task rejects its own caller and releases the queue', async () => {
    const failed = queue.serializeAccountDataWrite(async () => {
      throw new Error('boom');
    });
    const next = queue.serializeAccountDataWrite(async () => 'ran');

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ran');
  });

  it('never starts a task beside a slow one, however long it runs', async () => {
    let finishSlow: () => void = () => {};
    const slow = queue.serializeAccountDataWrite(
      () => new Promise<void>((resolve) => {
        finishSlow = resolve;
      })
    );
    const next = vi.fn(async () => 'ran');
    const queued = queue.serializeAccountDataWrite(next);

    // Far past any timer a release-on-timeout queue would use.
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(next).not.toHaveBeenCalled();

    finishSlow();
    await slow;
    await expect(queued).resolves.toBe('ran');
  });
});
