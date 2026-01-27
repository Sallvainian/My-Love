/**
 * Custom Project Fixtures
 *
 * Define project-specific fixtures here. These are merged with
 * playwright-utils fixtures in ../merged-fixtures.ts.
 *
 * Pattern: Pure function → fixture wrapper
 * @see _bmad/bmm/testarch/knowledge/fixture-architecture.md
 */
import { test as base } from '@playwright/test';

// Example fixture types (extend as project grows)
type CustomFixtures = {
  // Add custom fixtures here, e.g.:
  // testUser: User;
  // supabaseClient: SupabaseClient;
};

/**
 * Custom fixtures for My-Love project.
 * Add project-specific fixtures as needed.
 */
export const test = base.extend<CustomFixtures>({
  // Example: Auto-cleanup fixture pattern
  // testUser: async ({ apiRequest }, use) => {
  //   const user = await createTestUser();
  //   await use(user);
  //   await deleteTestUser(user.id);
  // },
});

export { expect } from '@playwright/test';
