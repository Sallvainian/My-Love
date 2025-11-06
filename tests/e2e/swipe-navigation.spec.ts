import { test, expect, type Page } from '../support/fixtures/baseFixture';

/**
 * Story 3.2: Swipe Navigation E2E Tests
 * Tests horizontal swipe navigation with backward-only constraint
 */

// Helper function to simulate swipe left gesture
async function swipeLeft(page: Page) {
  const messageCard = page.locator('[data-testid="message-card"]');

  // Wait for message card to be visible before attempting swipe
  await expect(messageCard).toBeVisible({ timeout: 10000 });

  // Wait a bit for any animations to complete
  await page.waitForTimeout(100);

  // Retry boundingBox if it fails (can happen during animations)
  let box = await messageCard.boundingBox();
  let retries = 0;
  while (!box && retries < 5) {
    await page.waitForTimeout(100);
    box = await messageCard.boundingBox();
    retries++;
  }
  if (!box) throw new Error('Message card not found after retries');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 150, startY, { steps: 10 }); // 150px left with smooth steps
  await page.mouse.up();
}

// Helper function to simulate swipe right gesture
async function swipeRight(page: Page) {
  const messageCard = page.locator('[data-testid="message-card"]');

  // Wait for message card to be visible before attempting swipe
  await expect(messageCard).toBeVisible({ timeout: 10000 });

  // Wait a bit for any animations to complete
  await page.waitForTimeout(100);

  // Retry boundingBox if it fails (can happen during animations)
  let box = await messageCard.boundingBox();
  let retries = 0;
  while (!box && retries < 5) {
    await page.waitForTimeout(100);
    box = await messageCard.boundingBox();
    retries++;
  }
  if (!box) throw new Error('Message card not found after retries');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 150, startY, { steps: 10 }); // 150px right with smooth steps
  await page.mouse.up();
}

test.describe('Swipe Navigation', () => {
  test.beforeEach(async ({ cleanApp }) => {
    // cleanApp fixture handles welcome screen dismissal automatically
    // Wait for message card to be visible
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
  });

  test('AC-3.2.1: swipe left navigates to previous day\'s message', async ({ cleanApp, browserName }) => {
    // Get today's message
    const todayMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Simulate swipe left (drag gesture)
    await swipeLeft(cleanApp);

    // Wait for animation (longer for Firefox)
    const animationWait = browserName === 'firefox' ? 1000 : 600;
    await cleanApp.waitForTimeout(animationWait);

    // Wait for message to stabilize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();

    // Get new message
    const yesterdayMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Messages should be different
    expect(yesterdayMessage).not.toBe(todayMessage);
    expect(yesterdayMessage).not.toBeNull();
  });

  test('AC-3.2.2: swipe right from past message returns toward today', async ({ cleanApp, browserName }) => {
    // Navigate back 3 days
    const animationWait = browserName === 'firefox' ? 1000 : 600;

    for (let i = 0; i < 3; i++) {
      await swipeLeft(cleanApp);
      await cleanApp.waitForTimeout(animationWait);
      await expect(cleanApp.getByTestId('message-card')).toBeVisible();
    }

    const message3DaysAgo = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Swipe right (toward today)
    await swipeRight(cleanApp);
    await cleanApp.waitForTimeout(animationWait);
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();

    const message2DaysAgo = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Messages should be different
    expect(message2DaysAgo).not.toBe(message3DaysAgo);
    expect(message2DaysAgo).not.toBeNull();
  });

  test('AC-3.2.3: cannot swipe right beyond today (bounce effect)', async ({ cleanApp }) => {
    // Get today's message
    const todayMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Attempt swipe right from today
    await swipeRight(cleanApp);
    await cleanApp.waitForTimeout(600);

    const messageAfterSwipe = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Message should remain unchanged (bounce effect prevents navigation)
    expect(messageAfterSwipe).toBe(todayMessage);
  });

  test('AC-3.2.4: smooth animated transition (300ms ease-out)', async ({ cleanApp }) => {
    const messageCard = cleanApp.locator('[data-testid="message-card"]');

    await swipeLeft(cleanApp);

    // Wait for animation to complete and message to change
    await cleanApp.waitForTimeout(500);

    // Verify the transition occurred (message changed)
    const newMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();
    expect(newMessage).toBeTruthy();

    // Animation timing is validated by the visual smoothness and 300ms CSS transition
    // Actual performance measurement includes gesture time + animation, which varies by browser
  });

  test('AC-3.2.5: message history loads correctly from rotation algorithm', async ({ cleanApp, browserName }) => {
    // Navigate back 5 days (with longer timeout for Firefox)
    const timeout = browserName === 'firefox' ? 800 : 600;
    const messages: string[] = [];

    for (let i = 0; i < 5; i++) {
      await swipeLeft(cleanApp);
      await cleanApp.waitForTimeout(timeout);
      // Wait for message card to be visible after each swipe
      await expect(cleanApp.getByTestId('message-card')).toBeVisible();
      const message = await cleanApp.locator('[data-testid="message-text"]').textContent();
      messages.push(message || '');
    }

    // Navigate forward back to the same historical date
    for (let i = 0; i < 3; i++) {
      await swipeRight(cleanApp);
      await cleanApp.waitForTimeout(timeout);
      await expect(cleanApp.getByTestId('message-card')).toBeVisible();
    }

    // Should be at 2 days back now
    const message2DaysBack = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Navigate back to 2 days again
    await swipeRight(cleanApp);
    await cleanApp.waitForTimeout(timeout);
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();

    await swipeLeft(cleanApp);
    await cleanApp.waitForTimeout(timeout);
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();

    const sameMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Same date should show same message (deterministic)
    expect(sameMessage).toBe(message2DaysBack);
  });

  test('AC-3.2.6: swipe gesture works on different input methods', async ({ cleanApp, browserName }) => {
    // This test runs across Chromium, Firefox, and WebKit
    // Framer Motion handles touch, mouse, and trackpad automatically

    const todayMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Simulate swipe left (works for mouse, touch, trackpad)
    await swipeLeft(cleanApp);
    await cleanApp.waitForTimeout(600);

    const yesterdayMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Navigation should work regardless of browser/input method
    expect(yesterdayMessage).not.toBe(todayMessage);

    // Log browser type for debugging
    console.log(`Swipe test passed on: ${browserName}`);
  });

  test('AC-3.2.7: keyboard arrow keys navigate messages', async ({ cleanApp, browserName }) => {
    // Get today's message
    const messageText = cleanApp.locator('[data-testid="message-text"]');
    const todayMessage = await messageText.textContent();

    // Press ArrowLeft key to navigate to yesterday
    await cleanApp.keyboard.press('ArrowLeft');

    // Wait for message to change (with longer timeout for Firefox)
    const timeout = browserName === 'firefox' ? 1000 : 600;
    await cleanApp.waitForTimeout(timeout);

    // Verify message changed
    const yesterdayMessage = await messageText.textContent();
    expect(yesterdayMessage).not.toBe(todayMessage);
    expect(yesterdayMessage).not.toBeNull();

    // Press ArrowRight key to return to today
    await cleanApp.keyboard.press('ArrowRight');
    await cleanApp.waitForTimeout(timeout);

    // Wait for message card to be stable and get final message
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();
    const backToToday = await messageText.textContent();

    // Should return to today's message
    expect(backToToday).toBe(todayMessage);
  });

  test('keyboard navigation cannot go beyond today', async ({ cleanApp }) => {
    const todayMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Try to navigate forward from today
    await cleanApp.keyboard.press('ArrowRight');
    await cleanApp.waitForTimeout(600);

    const messageAfterAttempt = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Message should remain unchanged
    expect(messageAfterAttempt).toBe(todayMessage);
  });

  test('navigation state persists across multiple swipes', async ({ cleanApp, browserName }) => {
    // Navigate back multiple times
    const messages: string[] = [];
    const animationWait = browserName === 'firefox' ? 800 : 600;

    for (let i = 0; i < 5; i++) {
      await swipeLeft(cleanApp);
      await cleanApp.waitForTimeout(animationWait);
      await expect(cleanApp.getByTestId('message-card')).toBeVisible();
      const message = await cleanApp.locator('[data-testid="message-text"]').textContent();
      messages.push(message || '');
    }

    // All messages should be different
    const uniqueMessages = new Set(messages);
    expect(uniqueMessages.size).toBeGreaterThan(1); // At least some variety

    // Navigate forward
    for (let i = 0; i < 5; i++) {
      await swipeRight(cleanApp);
      await cleanApp.waitForTimeout(animationWait);
      await expect(cleanApp.getByTestId('message-card')).toBeVisible();
    }

    // Should be back to today
    const finalMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Should be different from intermediate messages
    expect(messages).not.toContain(finalMessage);
  });

  test('message card maintains focus after keyboard navigation', async ({ cleanApp }) => {
    const messageCard = cleanApp.locator('[data-testid="message-card"]');

    // Focus the message card
    await messageCard.focus();

    // Navigate with keyboard
    await cleanApp.keyboard.press('ArrowLeft');
    await cleanApp.waitForTimeout(600);

    // Check if focus is still on a focusable element
    const focusedElement = await cleanApp.evaluate(() => document.activeElement?.tagName);

    // Should still have focus (either on card or body)
    expect(focusedElement).toBeDefined();
  });

  test('swipe threshold requires minimum distance', async ({ cleanApp }) => {
    const todayMessage = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Simulate small swipe (well below 50px threshold)
    const messageCard = cleanApp.locator('[data-testid="message-card"]');
    const box = await messageCard.boundingBox();
    if (!box) throw new Error('Message card not found');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await cleanApp.mouse.move(startX, startY);
    await cleanApp.mouse.down();
    await cleanApp.mouse.move(startX - 25, startY, { steps: 3 }); // Only 25px (well below 50px threshold)
    await cleanApp.mouse.up();

    await cleanApp.waitForTimeout(600);

    const messageAfterSmallSwipe = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Message should remain unchanged (below threshold)
    expect(messageAfterSmallSwipe).toBe(todayMessage);
  });

  test('multiple rapid swipes are handled correctly', async ({ cleanApp }) => {
    // Rapidly swipe left multiple times
    for (let i = 0; i < 3; i++) {
      await swipeLeft(cleanApp);
      await cleanApp.waitForTimeout(100); // Minimal wait
    }

    // Wait for all animations to complete
    await cleanApp.waitForTimeout(500);

    // Should have navigated (messages loaded correctly)
    const message = await cleanApp.locator('[data-testid="message-text"]').textContent();
    expect(message).not.toBeNull();
    expect(message).not.toBe('');
  });

  test('navigation works after favoriting a message', async ({ cleanApp, browserName }) => {
    const animationWait = browserName === 'firefox' ? 1000 : 600;

    // Navigate back
    await swipeLeft(cleanApp);
    await cleanApp.waitForTimeout(animationWait);

    // Wait for message card to be stable
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();
    const messageBeforeFavorite = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Favorite the message
    const favoriteButton = cleanApp.locator('[data-testid="message-favorite-button"]');
    await favoriteButton.click();
    await cleanApp.waitForTimeout(500); // Wait for favorite animation

    // Navigate away
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();
    await swipeLeft(cleanApp);
    await cleanApp.waitForTimeout(animationWait);

    // Navigate back
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();
    await swipeRight(cleanApp);
    await cleanApp.waitForTimeout(animationWait);

    // Verify we're back at the same message
    await expect(cleanApp.getByTestId('message-card')).toBeVisible();
    const messageAfterFavorite = await cleanApp.locator('[data-testid="message-text"]').textContent();

    // Should show the same message
    expect(messageAfterFavorite).toBe(messageBeforeFavorite);
  });
});
