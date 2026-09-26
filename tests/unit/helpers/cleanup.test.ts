import { describe, expect, it } from 'vitest';
import { runDeferred } from '../../support/fixtures/cleanup';

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
});
