/**
 * Reflection Test Helpers
 *
 * Shared helpers for scripture reflection API tests.
 * Extracted from duplicated functions across multiple spec files.
 */
import { faker } from '@faker-js/faker';

/** Generate a dynamic reflection note for test isolation. */
export function generateReflectionNote(prefix = 'test'): string {
  return `${prefix}-${faker.lorem.sentence()}`;
}

/** Generate a dynamic rating (1-5) for test isolation. */
export function generateRating(): number {
  return faker.number.int({ min: 1, max: 5 });
}
