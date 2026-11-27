/**
 * Installed builds from before story 11.1 still read the day (criterion 18,
 * R4). The frozen copy of their snapshot schema is
 * `tests/support/helpers/old-build-day-schema.ts`: if the server's answer parses
 * under it, an old build loads and shows the day, with no `nudge` and so no
 * nudge prompt and a greyed button until it takes the live update.
 */
import { describe, expect, it } from 'vitest';
import { DailyDaySnapshotSchema } from '../../../src/api/validation/dailyQuestionSchemas';
import {
  OldBuildAnswerSchema as OldAnswerSchema,
  OldBuildSnapshotSchema as OldSnapshotSchema,
} from '../../support/helpers/old-build-day-schema';
import { dailySnapshot, nudgesSnapshot } from '../stores/dailyQuestionFixture';

/** The key set the new server answers a day with (pgTAP DAILY-038 pins it). */
function serverAnswer(snapshot: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
}

describe('an installed build from before story 11.1 reading the day the new server answers', () => {
  it('parses a day with nudges and no nudge, and sees no nudge', () => {
    const wire = serverAnswer(
      nudgesSnapshot({ prompt: true, closesAt: '2030-09-11T10:00:00+00:00' }) as Record<string, unknown>
    );
    expect(wire).not.toHaveProperty('nudge');

    const old = OldSnapshotSchema.safeParse(wire);

    expect(old.success).toBe(true);
    expect(old.data).not.toHaveProperty('nudge');
    expect(old.data).not.toHaveProperty('nudges');
    expect(old.data).toMatchObject({ day_id: wire.day_id, state: 'me', my_choice: 'this' });
  });

  it('parses the whole answer, the way get_daily_day returns it, and a day nobody picked on', () => {
    expect(
      OldAnswerSchema.safeParse({
        status: 'ok',
        snapshot: serverAnswer(nudgesSnapshot() as Record<string, unknown>),
      }).success
    ).toBe(true);
    expect(
      OldAnswerSchema.safeParse({
        status: 'ok',
        snapshot: serverAnswer(dailySnapshot({ nudges: { prompt_sent: false, button_sent: false, closes_at: null } }) as Record<string, unknown>),
      }).success
    ).toBe(true);
  });

  it('still parses a past-question snapshot with a null closing instant', () => {
    const wire = serverAnswer(
      nudgesSnapshot({ closesAt: null }, { state: 'both', partner_choice: 'that', same: false }) as Record<string, unknown>
    );
    expect(OldSnapshotSchema.safeParse(wire).success).toBe(true);
  });

  it('would fail on the answer a slot the old build does not know: why the server leaves nudge out', () => {
    const withNewSlot = { ...serverAnswer(nudgesSnapshot() as Record<string, unknown>), nudge: { slot: 'prompt', spent: false } };
    expect(OldSnapshotSchema.safeParse(withNewSlot).success).toBe(false);
  });

  it('and the new schema reads the same wire answer, with its nudges', () => {
    const wire = serverAnswer(nudgesSnapshot({ button: true }) as Record<string, unknown>);
    expect(DailyDaySnapshotSchema.parse(wire)).toMatchObject({
      nudges: { prompt_sent: false, button_sent: true },
    });
  });
});
