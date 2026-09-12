import { faker } from '@faker-js/faker';
import type { Database } from '../../../src/types/database.types';
import { eventDateFrom } from './events';

export type EventWireRow = Database['public']['Tables']['events']['Row'];

/** One wire row for either live API setup or the controlled browser response. */
export function createSessionEventRow(
  userId: string,
  overrides: Partial<EventWireRow> = {}
): EventWireRow {
  const anchor = new Date();
  const timestamp = anchor.toISOString();
  return {
    id: faker.string.uuid(),
    user_id: userId,
    label: `Session event ${faker.string.alphanumeric(10)}`,
    event_date: eventDateFrom(anchor, 30),
    created_at: timestamp,
    updated_at: timestamp,
    description: null,
    icon: 'calendar',
    ...overrides,
  };
}
