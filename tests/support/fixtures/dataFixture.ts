/**
 * Data Fixture
 *
 * Provides data factory fixtures with automatic cleanup.
 * Use for tests that need to seed database data.
 *
 * Usage:
 * ```typescript
 * import { test, expect } from './dataFixture';
 *
 * test('displays sent message', async ({ page, loveNoteFactory }) => {
 *   const note = await loveNoteFactory.createNote({ content: 'Hello!' });
 *   await page.goto('/love-notes');
 *   await expect(page.getByText('Hello!')).toBeVisible();
 *   // Note is automatically cleaned up after test
 * });
 * ```
 */
import { test as base, expect } from '@playwright/test';
import { LoveNoteFactory } from './factories/love-note-factory';

interface DataFixtures {
  /**
   * Factory for creating test love notes.
   * Notes are automatically deleted after test completes.
   */
  loveNoteFactory: LoveNoteFactory;
}

export const test = base.extend<DataFixtures>({
  loveNoteFactory: async ({}, use) => {
    const factory = new LoveNoteFactory();
    await use(factory);
    await factory.cleanup();
  },
});

export { expect };
