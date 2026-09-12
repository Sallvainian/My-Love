import type { EventSpec } from './events';
import { eventDateFrom } from './events';

export interface EventsWireFidelityData {
  label: string;
  own: EventSpec;
  partner: EventSpec;
  dates: [string, string];
}

/** Pure factory: caller supplies a fresh UUID and the fixture's single clock anchor. */
export function createEventsWireFidelityData(
  anchor: Date,
  attemptId: string
): EventsWireFidelityData {
  const label = `Wire compatibility ${attemptId}`;

  return {
    label,
    // The shared seeder materializes null/calendar; database defaults are covered by API tests.
    own: { label, dayOffset: 14 },
    partner: { label, dayOffset: 21, owner: 'partner' },
    dates: [eventDateFrom(anchor, 14), eventDateFrom(anchor, 21)],
  };
}
