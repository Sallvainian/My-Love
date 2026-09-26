import { expect as playwrightExpect } from '@playwright/test';
import { RecurseTimeoutError } from '@seontechnologies/playwright-utils/recurse';
import { describe, expect, it } from 'vitest';
import { recurseUntil } from '../../support/helpers/recurse';

// The checks assert with Playwright's `expect`, as every spec does: `recurse`
// retries only on an error whose message carries `expect(`, which Vitest's own
// assertion messages do not.
const FAST = { timeout: 300, interval: 10 };

describe('recurseUntil', () => {
  it('lets a falsy reading satisfy the check and returns it', async () => {
    const readings = [2, 1, 0];
    const value = await recurseUntil(
      async () => readings.shift() ?? 0,
      (v) => {
        playwrightExpect(v).toBe(0);
      },
      FAST
    );

    expect(value).toBe(0);
    expect(readings).toEqual([]);
  });

  it("throws the check's own expect error on timeout, not RecurseTimeoutError", async () => {
    const failure = await recurseUntil(
      async () => 7,
      (v) => {
        playwrightExpect(v, 'the reading settles on 3').toBe(3);
      },
      FAST
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(RecurseTimeoutError);
    expect((failure as Error).message).toContain('the reading settles on 3');
    expect((failure as Error).message).toContain('Expected: 3');
    expect((failure as Error).message).toContain('Received: 7');
  });

  it('refuses a check that returns a boolean', async () => {
    await expect(recurseUntil(async () => 1, (v) => v === 2, FAST)).rejects.toThrow(
      'recurseUntil: the check must assert with expect and return nothing, but it returned false'
    );
  });

  it('refuses a check that returns a promise', async () => {
    await expect(
      recurseUntil(
        async () => 1,
        async (v) => {
          playwrightExpect(v).toBe(1);
        },
        FAST
      )
    ).rejects.toThrow(
      'recurseUntil: the check must assert with expect and return nothing, but it returned a promise'
    );
  });

  it('refuses an async check that rejects, without an unhandled rejection', async () => {
    await expect(
      recurseUntil(
        async () => 1,
        async (v) => {
          playwrightExpect(v).toBe(2);
        },
        FAST
      )
    ).rejects.toThrow(
      'recurseUntil: the check must assert with expect and return nothing, but it returned a promise'
    );
  });

  it('rethrows a throw from read as the original error', async () => {
    const original = new Error('the catcher is still starting');
    const failure = await recurseUntil(
      async () => {
        throw original;
      },
      () => {},
      FAST
    ).catch((error: unknown) => error);

    expect(failure).toBe(original);
  });
});
