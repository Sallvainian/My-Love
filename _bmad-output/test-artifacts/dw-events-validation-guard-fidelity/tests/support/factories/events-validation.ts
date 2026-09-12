/** Shared ASCII boundary fixtures for the API and browser validation tests. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { z } from 'zod';
import type { Database } from '../../../src/types/database.types';
import { extractEventsValidationContract } from '../eventsValidationContract';
import { eventDateFrom } from './events';

type EventInsert = Database['public']['Tables']['events']['Insert'];

// The same tagged contract consumed by Vitest and the effective-schema pgTAP guard.
export const validationContract = extractEventsValidationContract(
  readFileSync(join(process.cwd(), 'supabase/tests/database/21_events_validation_contract.sql'), 'utf8')
);

/** Stable length, unique identity; ASCII keeps this separate from deferred DW-83. */
export function boundaryText(length: number, prefix = 'EVG'): string {
  const stem = `${prefix}-${faker.string.uuid()}`;
  if (!Number.isInteger(length) || length < stem.length || /[^\x20-\x7e]/.test(stem)) {
    throw new Error('Boundary text requires an ASCII prefix and room for its unique identity');
  }
  return stem.padEnd(length, 'x');
}

/** Fresh row identity plus one caller-owned calendar anchor for the entire test. */
export function validationEvent(
  userId: string,
  anchor: Date,
  overrides: Partial<EventInsert> = {}
): EventInsert {
  return {
    id: faker.string.uuid(),
    user_id: userId,
    label: boundaryText(60),
    event_date: eventDateFrom(anchor, 30),
    description: null,
    icon: validationContract.icons[0],
    ...overrides,
  };
}

// Full PostgREST row: SQL column types/nullability plus the shared CHECK contract.
// No production event Zod schema is exported; the existing API schema is spec-local.
export const EventRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  label: z.string().max(validationContract.labelMaxLength),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(validationContract.descriptionMaxLength).nullable(),
  icon: z.enum(validationContract.icons),
  created_at: z.string(),
  updated_at: z.string(),
});
