/**
 * RELATIONSHIP_DATES no longer carries `visits`
 *
 * Story 3 (dynamic events), CAP-4: the hardcoded `visits` array was deleted
 * in favour of the store-driven `events` list rendered from `eventsSlice`.
 * Regression guard — a future edit must not reintroduce a `visits` key here.
 */
import { describe, expect, it } from 'vitest';
import { RELATIONSHIP_DATES } from '../../../src/config/relationshipDates';

describe('RELATIONSHIP_DATES', () => {
  it('carries no visits key', () => {
    expect(RELATIONSHIP_DATES).not.toHaveProperty('visits');
    expect('visits' in RELATIONSHIP_DATES).toBe(false);
  });

  it('still carries datingStart, birthdays and wedding', () => {
    expect(RELATIONSHIP_DATES.datingStart).toBeInstanceOf(Date);
    expect(RELATIONSHIP_DATES.birthdays.frank.name).toBe('Frank');
    expect(RELATIONSHIP_DATES.birthdays.gracie.name).toBe('Gracie');
    expect(RELATIONSHIP_DATES.wedding).toBeNull();
  });
});
