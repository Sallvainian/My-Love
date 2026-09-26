import { describe, expect, it } from 'vitest';
import { runDeferred, type Deferred } from '../../support/fixtures/cleanup';

describe('runDeferred', () => {
  it('runs the deferred functions newest first', async () => {
    const order: string[] = [];
    await runDeferred([
      { label: 'first', fn: () => order.push('first') },
      { label: 'second', fn: async () => order.push('second') },
    ]);
    expect(order).toEqual(['second', 'first']);
  });

  it('runs every function when one throws, then throws that failure with its label', async () => {
    const order: string[] = [];
    const boom = new Error('boom');
    const run = runDeferred([
      { label: 'first', fn: () => order.push('first') },
      {
        label: 'second',
        fn: () => {
          throw boom;
        },
      },
    ]);
    await expect(run).rejects.toThrow('Cleanup "second" failed: boom');
    await expect(run).rejects.toHaveProperty('cause', boom);
    expect(order).toEqual(['first']);
  });

  it('throws every failure together', async () => {
    const run = runDeferred([
      { label: 'a', fn: () => Promise.reject(new Error('one')) },
      { label: 'b', fn: () => Promise.reject('two') },
    ]);
    await expect(run).rejects.toBeInstanceOf(AggregateError);
    await expect(run).rejects.toHaveProperty('errors', [
      expect.objectContaining({ message: 'Cleanup "b" failed: two' }),
      expect.objectContaining({ message: 'Cleanup "a" failed: one' }),
    ]);
  });

  it('runs a function deferred while teardown is running', async () => {
    const order: string[] = [];
    const deferred: Deferred[] = [{ label: 'first', fn: () => order.push('first') }];
    deferred.push({
      label: 'second',
      fn: () => {
        order.push('second');
        // What a timed-out body that is still running does: defer once more.
        deferred.push({ label: 'late', fn: () => order.push('late') });
      },
    });
    await runDeferred(deferred);
    expect(order).toEqual(['second', 'late', 'first']);
  });

  it('reports a function that hangs under its label and still runs the next', async () => {
    const order: string[] = [];
    const run = runDeferred(
      [
        { label: 'first', fn: () => order.push('first') },
        { label: 'hangs', fn: () => new Promise(() => {}) },
      ],
      20
    );
    await expect(run).rejects.toThrow('Cleanup "hangs" failed: did not finish within 20ms');
    expect(order).toEqual(['first']);
  });
});
