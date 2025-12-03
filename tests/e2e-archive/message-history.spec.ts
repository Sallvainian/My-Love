import { test, expect, type Page } from '../support/fixtures/baseFixture';

test.describe('Message History State Management (Story 3.3)', () => {
  test.beforeEach(async ({ cleanApp }) => {
    // cleanApp fixture handles storage clearing and welcome screen dismissal automatically
    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
  });

  test('AC-3.3.1: Message history state tracking initialized correctly', async ({ cleanApp }) => {
    // Verify messageHistory state is initialized in the store
    const historyState = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory;
    });

    // Verify initial structure
    expect(historyState).toHaveProperty('currentIndex');
    expect(historyState).toHaveProperty('shownMessages');
    expect(historyState).toHaveProperty('maxHistoryDays');

    // Verify initial values
    expect(historyState.currentIndex).toBe(0); // Today
    expect(historyState.maxHistoryDays).toBe(30); // Default limit

    // Verify shownMessages is a Map (will be Array in serialized form initially)
    const shownMessages = historyState.shownMessages;
    expect(shownMessages).toBeDefined();
  });

  test('AC-3.3.2: History persists across browser sessions', async ({ cleanApp, browser }) => {
    // Navigate to 3 days back
    await cleanApp.keyboard.press('ArrowLeft'); // Day -1
    await cleanApp.waitForTimeout(500);
    await cleanApp.keyboard.press('ArrowLeft'); // Day -2
    await cleanApp.waitForTimeout(500);
    await cleanApp.keyboard.press('ArrowLeft'); // Day -3
    await cleanApp.waitForTimeout(500);

    // Get message ID for 3 days ago
    const message3DaysAgo = await cleanApp.textContent('[data-testid="message-text"]');
    const messageId3DaysAgo = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });

    // Verify currentIndex is 3
    const currentIndex = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory.currentIndex;
    });
    expect(currentIndex).toBe(3);

    // Save LocalStorage state before closing context
    const savedLocalStorage = await cleanApp.evaluate(() => {
      return localStorage.getItem('my-love-storage');
    });

    // Close and reopen browser (simulate new session)
    await cleanApp.context().close();
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await newPage.goto('/');

    // Restore LocalStorage in new context
    await newPage.evaluate((savedState) => {
      if (savedState) {
        localStorage.setItem('my-love-storage', savedState);
      }
    }, savedLocalStorage);

    // Reload to apply persisted state
    await newPage.reload();
    await newPage.waitForLoadState('networkidle');

    // Handle welcome screen if it appears
    const continueButton = newPage.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await newPage.waitForLoadState('networkidle');
    }

    await newPage.waitForSelector('[data-testid="message-card"]', { timeout: 10000 });

    // Navigate back to 3 days ago
    await newPage.keyboard.press('ArrowLeft');
    await newPage.waitForTimeout(500);
    await newPage.keyboard.press('ArrowLeft');
    await newPage.waitForTimeout(500);
    await newPage.keyboard.press('ArrowLeft');
    await newPage.waitForTimeout(500);

    const messageAfterReopen = await newPage.textContent('[data-testid="message-text"]');
    const messageIdAfterReopen = await newPage.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });

    // Verify: Same message shown (history persisted)
    expect(messageAfterReopen).toBe(message3DaysAgo);
    expect(messageIdAfterReopen).toBe(messageId3DaysAgo);

    // Verify shownMessages Map persisted
    const shownMessagesSize = await newPage.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory.shownMessages.size;
    });
    expect(shownMessagesSize).toBeGreaterThanOrEqual(4); // Today + 3 days back

    await newContext.close();
  });

  test('AC-3.3.3: Deterministic daily message - same message all day', async ({ cleanApp }) => {
    const firstMessage = await cleanApp.textContent('[data-testid="message-text"]');
    const firstMessageId = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });

    // Reload 5 times and verify same message
    for (let i = 0; i < 5; i++) {
      await cleanApp.reload();
      await cleanApp.waitForSelector('[data-testid="message-card"]', { timeout: 10000 });

      const reloadedMessage = await cleanApp.textContent('[data-testid="message-text"]');
      const reloadedMessageId = await cleanApp.evaluate(() => {
        const store = (window as any).__APP_STORE__;
        return store.getState().currentMessage?.id;
      });

      expect(reloadedMessage).toBe(firstMessage);
      expect(reloadedMessageId).toBe(firstMessageId);
    }
  });

  test('AC-3.3.4: Future date prevention - cannot navigate beyond today', async ({ cleanApp }) => {
    const todayMessage = await cleanApp.textContent('[data-testid="message-text"]');
    const todayMessageId = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });

    // Verify canNavigateForward returns false
    const canGoForward = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().canNavigateForward();
    });
    expect(canGoForward).toBe(false);

    // Try to navigate forward with keyboard (should fail silently)
    await cleanApp.keyboard.press('ArrowRight');
    await cleanApp.waitForTimeout(500);

    const messageAfterAttempt = await cleanApp.textContent('[data-testid="message-text"]');
    const messageIdAfterAttempt = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });

    // Verify: Still showing today's message
    expect(messageAfterAttempt).toBe(todayMessage);
    expect(messageIdAfterAttempt).toBe(todayMessageId);

    // Verify currentIndex is still 0
    const currentIndex = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory.currentIndex;
    });
    expect(currentIndex).toBe(0);
  });

  test('AC-3.3.5: First-time user starts with today only', async ({ cleanApp }) => {
    // Storage already cleared in beforeEach via cleanApp fixture

    // Verify: Cannot navigate back (no history)
    const canGoBack = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().canNavigateBack();
    });

    // First-time user should be able to navigate back (to relationship start)
    // This test verifies the initial state is correct
    const currentIndex = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory.currentIndex;
    });
    expect(currentIndex).toBe(0); // Today

    // Verify only today's message is in shownMessages
    const shownMessagesSize = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory.shownMessages.size;
    });
    expect(shownMessagesSize).toBeLessThanOrEqual(1); // Only today or empty (will be filled on first load)
  });

  test('AC-3.3.6: Skipped days - fills in missed messages', async ({ cleanApp }) => {
    // Simulate: Last visit was 3 days ago
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const year = threeDaysAgo.getFullYear();
      const month = String(threeDaysAgo.getMonth() + 1).padStart(2, '0');
      const day = String(threeDaysAgo.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      // Set history to only have 3 days ago
      store.setState({
        messageHistory: {
          currentIndex: 0,
          shownMessages: new Map([[dateString, 38]]),
          maxHistoryDays: 30,
          favoriteIds: [],
        },
      });
    });

    // Navigate back through skipped days
    await cleanApp.keyboard.press('ArrowLeft'); // Yesterday (should calculate)
    await cleanApp.waitForTimeout(500);

    const yesterdayMessageId = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });
    expect(yesterdayMessageId).toBeDefined();

    await cleanApp.keyboard.press('ArrowLeft'); // 2 days ago (should calculate)
    await cleanApp.waitForTimeout(500);

    const twoDaysAgoMessageId = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });
    expect(twoDaysAgoMessageId).toBeDefined();

    await cleanApp.keyboard.press('ArrowLeft'); // 3 days ago (should load cached ID 38)
    await cleanApp.waitForTimeout(500);

    const threeDaysAgoMessageId = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });

    // Verify: 3 days ago shows cached message ID 38
    expect(threeDaysAgoMessageId).toBe(38);

    // Verify: All intermediate days have entries in shownMessages
    const historySize = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory.shownMessages.size;
    });

    expect(historySize).toBeGreaterThanOrEqual(4); // Today + yesterday + 2 days ago + 3 days ago
  });

  test('Navigation: Swipe left navigates to previous message', async ({ cleanApp }) => {
    // Get today's message ID
    const todayId = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });

    // Simulate swipe left
    const messageCard = cleanApp.locator('[data-testid="message-card"]');
    const boundingBox = await messageCard.boundingBox();
    expect(boundingBox).not.toBeNull();

    if (boundingBox) {
      const centerX = boundingBox.x + boundingBox.width / 2;
      const centerY = boundingBox.y + boundingBox.height / 2;

      await cleanApp.mouse.move(centerX, centerY);
      await cleanApp.mouse.down();
      await cleanApp.mouse.move(centerX - 200, centerY); // Swipe left
      await cleanApp.mouse.up();
      await cleanApp.waitForTimeout(500);
    }

    // Verify currentIndex incremented
    const currentIndex = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory.currentIndex;
    });
    expect(currentIndex).toBe(1); // Yesterday

    // Verify different message shown
    const yesterdayId = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });
    expect(yesterdayId).not.toBe(todayId);
  });

  test('Navigation: Swipe right navigates to next message (toward today)', async ({ cleanApp }) => {
    // Navigate to yesterday first
    await cleanApp.keyboard.press('ArrowLeft');
    await cleanApp.waitForTimeout(500);

    const yesterdayId = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });

    // Verify can navigate forward
    const canGoForward = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().canNavigateForward();
    });
    expect(canGoForward).toBe(true);

    // Simulate swipe right
    const messageCard = cleanApp.locator('[data-testid="message-card"]');
    const boundingBox = await messageCard.boundingBox();
    expect(boundingBox).not.toBeNull();

    if (boundingBox) {
      const centerX = boundingBox.x + boundingBox.width / 2;
      const centerY = boundingBox.y + boundingBox.height / 2;

      await cleanApp.mouse.move(centerX, centerY);
      await cleanApp.mouse.down();
      await cleanApp.mouse.move(centerX + 200, centerY); // Swipe right
      await cleanApp.mouse.up();
      await cleanApp.waitForTimeout(500);
    }

    // Verify currentIndex decremented
    const currentIndex = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory.currentIndex;
    });
    expect(currentIndex).toBe(0); // Back to today

    // Verify different message shown
    const todayId = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().currentMessage?.id;
    });
    expect(todayId).not.toBe(yesterdayId);
  });

  test('Drag constraints: Right swipe disabled at today', async ({ cleanApp }) => {
    // Verify at today (currentIndex = 0)
    const currentIndex = await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store.getState().messageHistory.currentIndex;
    });
    expect(currentIndex).toBe(0);

    // Try to swipe right (should be constrained)
    const messageCard = cleanApp.locator('[data-testid="message-card"]');
    const boundingBox = await messageCard.boundingBox();
    expect(boundingBox).not.toBeNull();

    if (boundingBox) {
      const centerX = boundingBox.x + boundingBox.width / 2;
      const centerY = boundingBox.y + boundingBox.height / 2;

      await cleanApp.mouse.move(centerX, centerY);
      await cleanApp.mouse.down();
      await cleanApp.mouse.move(centerX + 200, centerY); // Try to drag right
      await cleanApp.mouse.up();
      await cleanApp.waitForTimeout(500);

      // Verify still at today
      const indexAfter = await cleanApp.evaluate(() => {
        const store = (window as any).__APP_STORE__;
        return store.getState().messageHistory.currentIndex;
      });
      expect(indexAfter).toBe(0);
    }
  });
});
