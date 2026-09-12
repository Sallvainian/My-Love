import { faker } from '@faker-js/faker';
import type { EventSpec } from '../../../../tests/support/factories/events';

/** Past nearest-first, then upcoming nearest-first; dates use coupleEvents.anchor. */
export function buildHistory({
  past,
  upcoming = 0,
  prefix = `History ${faker.string.alphanumeric(8)}`,
}: { past: number; upcoming?: number; prefix?: string }): EventSpec[] {
  return [
    ...Array.from({ length: past }, (_, index) => ({
      dayOffset: -(index + 1),
      label: `${prefix} past ${index + 1}`,
    })),
    ...Array.from({ length: upcoming }, (_, index) => ({
      dayOffset: index + 1,
      label: `${prefix} upcoming ${index + 1}`,
    })),
  ];
}
