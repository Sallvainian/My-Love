/**
 * accountDataQueue — one account-data write or refresh at a time, but never
 * held hostage by a request that never settles (a stalled mobile socket).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type QueueModule = typeof import('../../../src/services/accountDataQueue');

let queue: QueueModule;

beforeEach(async () => {
  vi.useFakeTimers();
  // A fresh module per case: the queue is module state, and a stalled task
  // from one case must not delay the next.
  vi.resetModules();
  queue = await import('../../../src/services/accountDataQueue');
});

afterEach(() => {
  vi.useRealTimers();
});

const never = () => new Promise<never>(() => {});

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

  it('a task that never settles holds the queue for QUEUE_STALL_MS, then lets the next one run', async () => {
    const stalled = queue.serializeAccountDataWrite(never);
    const next = vi.fn(async () => 'ran');
    const queued = queue.serializeAccountDataWrite(next);

    await vi.advanceTimersByTimeAsync(queue.QUEUE_STALL_MS - 1);
    expect(next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(queued).resolves.toBe('ran');

    // The stalled caller's own promise is unchanged: still pending.
    const probe = Symbol('pending');
    expect(await Promise.race([stalled, Promise.resolve(probe)])).toBe(probe);
  });

  it('each task’s bound starts when it starts, so two stalls never overlap', async () => {
    queue.serializeAccountDataWrite(never);
    const secondStarted = vi.fn();
    queue.serializeAccountDataWrite(() => {
      secondStarted();
      return never();
    });
    const third = vi.fn(async () => {});
    queue.serializeAccountDataWrite(third);

    await vi.advanceTimersByTimeAsync(queue.QUEUE_STALL_MS);
    expect(secondStarted).toHaveBeenCalled();
    expect(third).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(queue.QUEUE_STALL_MS - 1);
    expect(third).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(third).toHaveBeenCalled();
  });
});
