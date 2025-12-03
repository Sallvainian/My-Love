import { test, expect } from '../support/fixtures/baseFixture';

/**
 * Mood Tracker Test Suite
 * Story 6.2: Mood Tracking UI & Local Storage
 *
 * Tests All Acceptance Criteria:
 * - AC-1: Mood tab navigation
 * - AC-2: Mood type selection with animations
 * - AC-3: Optional note input with character counter
 * - AC-4: Save mood entry to IndexedDB
 * - AC-5: One mood per day constraint
 * - AC-6: Local storage via IndexedDB with by-date index
 * - AC-7: Sync status indicator
 */

test.describe('Mood Tracker', () => {
  test('AC-1: should navigate to Mood tab', async ({ cleanApp }) => {
    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Click Mood tab
    await cleanApp.getByTestId('nav-mood').click();

    // Verify MoodTracker renders
    await expect(cleanApp.getByTestId('mood-tracker')).toBeVisible();

    // Verify active tab styling
    const moodTab = cleanApp.getByTestId('nav-mood');
    await expect(moodTab).toHaveClass(/text-pink-500/);

    console.log('✓ Navigated to Mood tab successfully');
  });

  test('AC-2: should select mood type with animation', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Verify all 5 mood buttons render
    await expect(cleanApp.getByTestId('mood-button-loved')).toBeVisible();
    await expect(cleanApp.getByTestId('mood-button-happy')).toBeVisible();
    await expect(cleanApp.getByTestId('mood-button-content')).toBeVisible();
    await expect(cleanApp.getByTestId('mood-button-thoughtful')).toBeVisible();
    await expect(cleanApp.getByTestId('mood-button-grateful')).toBeVisible();

    // Select "happy" mood
    await cleanApp.getByTestId('mood-button-happy').click();

    // Verify button is selected (has pink styling)
    const happyButton = cleanApp.getByTestId('mood-button-happy');
    await expect(happyButton).toHaveClass(/border-pink-500/);
    await expect(happyButton).toHaveClass(/text-pink-500/);

    console.log('✓ Mood selection with animation works');
  });

  test('AC-3: should accept note with character counter', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Type note
    const noteInput = cleanApp.getByTestId('mood-note-input');
    const testNote = 'Feeling amazing today!';
    await noteInput.fill(testNote);

    // Verify character counter updates
    const charCounter = cleanApp.getByTestId('mood-char-counter');
    const remaining = 200 - testNote.length;
    await expect(charCounter).toHaveText(`${remaining}/200`);

    console.log('✓ Note input with character counter works');
  });

  test('AC-3: should enforce 200-char max length', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Try to enter 201 characters
    const longNote = 'a'.repeat(201);
    const noteInput = cleanApp.getByTestId('mood-note-input');
    await noteInput.fill(longNote);

    // Verify only 200 chars accepted (browser enforces maxlength)
    const actualValue = await noteInput.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(200);

    console.log('✓ 200-char max length enforced');
  });

  test('AC-4: should save mood entry to IndexedDB', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Select mood
    await cleanApp.getByTestId('mood-button-happy').click();

    // Enter note
    await cleanApp.getByTestId('mood-note-input').fill('Great day!');

    // Submit form
    await cleanApp.getByTestId('mood-submit-button').click();

    // Verify success toast appears
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible({ timeout: 3000 });

    // Verify mood saved to IndexedDB
    const moodInDB = await cleanApp.evaluate(async () => {
      const dbName = 'my-love-db';
      return new Promise((resolve) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('moods', 'readonly');
          const store = tx.objectStore('moods');
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        };
      });
    });

    expect(moodInDB).toHaveLength(1);
    expect((moodInDB as any)[0].mood).toBe('happy');
    expect((moodInDB as any)[0].note).toBe('Great day!');
    expect((moodInDB as any)[0].synced).toBe(false);

    console.log('✓ Mood entry saved to IndexedDB successfully');
  });

  test('AC-5: should enforce one mood per day (edit mode)', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Log first mood
    await cleanApp.getByTestId('mood-button-happy').click();
    await cleanApp.getByTestId('mood-note-input').fill('First mood');
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();

    // Wait for success toast to disappear
    await cleanApp.waitForTimeout(3500);

    // Try to log second mood for same day
    await cleanApp.getByTestId('mood-button-grateful').click();
    await cleanApp.getByTestId('mood-note-input').fill('Second mood');

    // Verify button text changes to "Update Mood"
    const submitButton = cleanApp.getByTestId('mood-submit-button');
    await expect(submitButton).toHaveText('Update Mood');

    // Submit update
    await submitButton.click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();

    // Verify only one mood exists in IndexedDB
    const moodsInDB = await cleanApp.evaluate(async () => {
      const dbName = 'my-love-db';
      return new Promise((resolve) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('moods', 'readonly');
          const store = tx.objectStore('moods');
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        };
      });
    });

    expect(moodsInDB).toHaveLength(1);
    expect((moodsInDB as any)[0].mood).toBe('grateful');
    expect((moodsInDB as any)[0].note).toBe('Second mood');

    console.log('✓ One mood per day constraint enforced (edit mode works)');
  });

  test('AC-6: should persist mood across browser refresh', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Save mood
    await cleanApp.getByTestId('mood-button-loved').click();
    await cleanApp.getByTestId('mood-note-input').fill('Persisted note');
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();

    // Refresh page
    await cleanApp.reload();

    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Navigate to Mood tab
    await cleanApp.getByTestId('nav-mood').click();

    // Verify mood persisted (form should be pre-populated)
    await expect(cleanApp.getByTestId('mood-button-loved')).toHaveClass(/border-pink-500/);
    const noteValue = await cleanApp.getByTestId('mood-note-input').inputValue();
    expect(noteValue).toBe('Persisted note');

    // Verify button shows "Update Mood"
    await expect(cleanApp.getByTestId('mood-submit-button')).toHaveText('Update Mood');

    console.log('✓ Mood persisted across browser refresh');
  });

  test('AC-7: should display sync status indicator', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Verify sync status shows online (or offline)
    // Note: Actual sync implementation in Story 6.4
    const syncIndicator = cleanApp.locator('text=/Online|Offline/');
    await expect(syncIndicator).toBeVisible();

    // Save a mood
    await cleanApp.getByTestId('mood-button-happy').click();
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();

    // Verify pending sync count appears
    await cleanApp.waitForTimeout(500);
    const pendingIndicator = cleanApp.locator('text=/pending sync/i');
    await expect(pendingIndicator).toBeVisible();

    console.log('✓ Sync status indicator displayed');
  });

  test('AC-6: should use by-date index for fast lookups', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Save mood
    await cleanApp.getByTestId('mood-button-happy').click();
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();

    // Verify by-date index exists
    const indexExists = await cleanApp.evaluate(async () => {
      const dbName = 'my-love-db';
      return new Promise((resolve) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('moods', 'readonly');
          const store = tx.objectStore('moods');
          const hasIndex = store.indexNames.contains('by-date');
          resolve(hasIndex);
        };
      });
    });

    expect(indexExists).toBe(true);

    console.log('✓ by-date index created for fast queries');
  });

  test('should validate required mood selection', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Try to submit without selecting mood
    const submitButton = cleanApp.getByTestId('mood-submit-button');
    await expect(submitButton).toBeDisabled();

    // Select mood
    await cleanApp.getByTestId('mood-button-content').click();

    // Verify submit button enabled
    await expect(submitButton).toBeEnabled();

    console.log('✓ Required mood validation works');
  });

  test('should handle navigation state correctly', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Navigate to Mood
    await cleanApp.getByTestId('nav-mood').click();
    await expect(cleanApp.getByTestId('mood-tracker')).toBeVisible();

    // Verify URL updated
    expect(cleanApp.url()).toContain('/mood');

    // Navigate back to Home
    await cleanApp.getByTestId('nav-home').click();
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();

    // Navigate back to Mood
    await cleanApp.getByTestId('nav-mood').click();
    await expect(cleanApp.getByTestId('mood-tracker')).toBeVisible();

    console.log('✓ Navigation state transitions work correctly');
  });
});
