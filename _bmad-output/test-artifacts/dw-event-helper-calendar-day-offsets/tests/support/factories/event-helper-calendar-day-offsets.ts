import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { faker } from '@faker-js/faker';

/** Fixed regression date; only the record's identity is customizable. */
export function createNuukGapCase(overrides: { label?: string } = {}) {
  const output = execFileSync(
    process.execPath,
    [
      '--import', 'tsx', '--input-type=module', '--eval',
      `
        import assert from 'node:assert/strict';
        import { eventDateFrom } from './tests/support/factories/events.ts';
        import { isoDateDaysFromNow } from './tests/support/helpers/events.ts';

        const anchor = new Date(2026, 2, 27, 23, 30);
        const timestamp = anchor.getTime();
        assert.equal(process.env.TZ, 'America/Nuuk');
        assert.equal(anchor.toISOString(), '2026-03-28T01:30:00.000Z');
        const gap = new Date(2026, 2, 28, 23, 30);
        assert.deepEqual(
          [gap.getDate(), gap.getHours(), gap.getMinutes(), gap.getTimezoneOffset()],
          [29, 0, 30, 60]
        );
        assert.equal(eventDateFrom(anchor, 1), '2026-03-28');
        assert.equal(anchor.getTime(), timestamp);
        const date = isoDateDaysFromNow(1, anchor);
        assert.equal(anchor.getTime(), timestamp);
        // Return the real result even if wrong: the API/UI assertions must catch it.
        process.stdout.write(JSON.stringify({ date }));
      `,
    ],
    {
      // This factory runs after staging into tests/support/factories/.
      cwd: resolve(import.meta.dirname, '../../..'),
      env: { ...process.env, TZ: 'America/Nuuk' },
      encoding: 'utf8',
      timeout: 10_000,
    }
  );
  const { date } = JSON.parse(output) as { date: string };

  return {
    label: overrides.label ?? `nuuk-gap-${faker.string.uuid()}`,
    date,
    expectedDate: '2026-03-28' as const,
    expectedLongDate: 'March 28, 2026' as const,
  };
}
