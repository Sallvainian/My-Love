import { test, expect, type Page } from '../support/fixtures/baseFixture';

test.describe('Admin Interface - Custom Message Management (Story 3.4)', () => {
  // Helper function to navigate to admin panel
  const navigateToAdmin = async (page: Page) => {
    await page.goto('/My-Love/admin');
    await expect(page.getByTestId('admin-title')).toBeVisible({ timeout: 5000 });
  };

  // Helper function to create a test message
  const createTestMessage = async (page: Page, text: string, category: string) => {
    await page.getByTestId('admin-create-button').click();
    await expect(page.getByTestId('admin-create-form')).toBeVisible();

    await page.getByTestId('admin-create-form-text').fill(text);
    await page.getByTestId('admin-create-form-category').selectOption(category);
    await page.getByTestId('admin-create-form-save').click();

    // Wait for modal to close
    await expect(page.getByTestId('admin-create-form')).not.toBeVisible();
  };

  test.beforeEach(async ({ cleanApp }) => {
    // cleanApp fixture handles storage clearing and welcome screen dismissal
    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
  });

  test.describe('AC-3.4.1: Admin Route Access', () => {
    test('should access admin panel via /admin route', async ({ cleanApp }) => {
      // Navigate to admin route
      await navigateToAdmin(cleanApp);

      // Verify admin panel renders
      await expect(cleanApp.getByTestId('admin-title')).toBeVisible();
      await expect(cleanApp.getByTestId('admin-title')).toHaveText('Admin Panel');

      // Verify main components are visible
      await expect(cleanApp.getByTestId('admin-create-button')).toBeVisible();
      await expect(cleanApp.getByTestId('admin-exit-button')).toBeVisible();
      await expect(cleanApp.getByTestId('admin-message-list')).toBeVisible();
    });

    test('should exit admin panel and return to main app', async ({ cleanApp }) => {
      // Navigate to admin
      await navigateToAdmin(cleanApp);

      // Click exit button
      await cleanApp.getByTestId('admin-exit-button').click();

      // Verify back to main app
      await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 5000 });
      await expect(cleanApp.getByTestId('admin-title')).not.toBeVisible();
    });
  });

  test.describe('AC-3.4.2: Message List Display with Filtering', () => {
    test('should display all 365 default messages', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Verify message count display shows 365 messages
      const countText = await cleanApp.locator('text=/Showing \\d+ of \\d+ messages/').textContent();
      expect(countText).toContain('of 365 messages');

      // Verify table is present
      await expect(cleanApp.getByTestId('admin-message-table')).toBeVisible();
    });

    test('should filter messages by category', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Get initial count
      const initialCount = await cleanApp.locator('[data-testid="admin-message-row"]').count();
      expect(initialCount).toBeGreaterThan(0);

      // Filter by "Reasons" category
      await cleanApp.getByTestId('admin-filter-category').selectOption('reason');
      await cleanApp.waitForTimeout(300); // Wait for filter to apply

      // Verify filtered results
      const filteredCount = await cleanApp.locator('[data-testid="admin-message-row"]').count();
      expect(filteredCount).toBeLessThan(initialCount);

      // Verify all visible messages are "Reasons" category
      const categoryLabels = await cleanApp.locator('[data-testid="message-row-category"]').allTextContents();
      categoryLabels.forEach(label => {
        expect(label).toContain('Reasons');
      });
    });

    test('should search messages by text', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Search for a common word (assuming "love" appears in messages)
      await cleanApp.getByTestId('admin-search-input').fill('love');
      await cleanApp.waitForTimeout(300);

      // Verify filtered results
      const searchResults = await cleanApp.locator('[data-testid="admin-message-row"]').count();
      expect(searchResults).toBeGreaterThan(0);

      // Verify search term appears in visible messages
      const messageTexts = await cleanApp.locator('[data-testid="message-row-text"]').allTextContents();
      const hasSearchTerm = messageTexts.some(text => text.toLowerCase().includes('love'));
      expect(hasSearchTerm).toBe(true);
    });

    test('should display custom badge for custom messages', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Create a custom message
      await createTestMessage(cleanApp, 'Test custom message', 'custom');

      // Filter to show only custom messages
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);

      // Verify custom badge is displayed
      const typeBadge = cleanApp.locator('[data-testid="message-row-type"]').first();
      await expect(typeBadge).toContainText('Custom');
    });
  });

  test.describe('AC-3.4.3: Create New Message Button', () => {
    test('should open CreateMessageForm modal on button click', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Click create button
      await cleanApp.getByTestId('admin-create-button').click();

      // Verify modal opens
      await expect(cleanApp.getByTestId('admin-create-form')).toBeVisible();
      await expect(cleanApp.getByTestId('admin-create-form-backdrop')).toBeVisible();

      // Verify form elements are present
      await expect(cleanApp.getByTestId('admin-create-form-text')).toBeVisible();
      await expect(cleanApp.getByTestId('admin-create-form-category')).toBeVisible();
      await expect(cleanApp.getByTestId('admin-create-form-save')).toBeVisible();
      await expect(cleanApp.getByTestId('admin-create-form-cancel')).toBeVisible();
    });

    test('should close modal on cancel button', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      await cleanApp.getByTestId('admin-create-button').click();
      await expect(cleanApp.getByTestId('admin-create-form')).toBeVisible();

      // Click cancel
      await cleanApp.getByTestId('admin-create-form-cancel').click();

      // Verify modal closes
      await expect(cleanApp.getByTestId('admin-create-form')).not.toBeVisible();
    });

    test('should close modal on backdrop click', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      await cleanApp.getByTestId('admin-create-button').click();
      await expect(cleanApp.getByTestId('admin-create-form')).toBeVisible();

      // Click backdrop
      await cleanApp.getByTestId('admin-create-form-backdrop').click();

      // Verify modal closes
      await expect(cleanApp.getByTestId('admin-create-form')).not.toBeVisible();
    });
  });

  test.describe('AC-3.4.4: Edit and Delete Buttons Per Message', () => {
    test('should display edit and delete buttons for custom messages', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Create a custom message
      await createTestMessage(cleanApp, 'Test message for editing', 'custom');

      // Filter to show custom messages
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);

      // Verify edit and delete buttons are visible
      const firstRow = cleanApp.locator('[data-testid="admin-message-row"]').first();
      await expect(firstRow.getByTestId('message-row-edit-button')).toBeVisible();
      await expect(firstRow.getByTestId('message-row-delete-button')).toBeVisible();
    });

    test('should not display edit/delete buttons for default messages', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Filter to show reason messages (default)
      await cleanApp.getByTestId('admin-filter-category').selectOption('reason');
      await cleanApp.waitForTimeout(300);

      // Verify first row is a default message
      const firstRow = cleanApp.locator('[data-testid="admin-message-row"]').first();
      const typeBadge = firstRow.locator('[data-testid="message-row-type"]');
      await expect(typeBadge).toContainText('Default');

      // Verify edit/delete buttons are not present
      await expect(firstRow.getByTestId('message-row-edit-button')).not.toBeVisible();
      await expect(firstRow.getByTestId('message-row-delete-button')).not.toBeVisible();
    });

    test('should open EditMessageForm on edit button click', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Create a custom message
      await createTestMessage(cleanApp, 'Test message for editing', 'custom');

      // Filter to custom messages and click edit
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);

      await cleanApp.locator('[data-testid="message-row-edit-button"]').first().click();

      // Verify edit modal opens with pre-populated data
      await expect(cleanApp.getByTestId('admin-edit-form')).toBeVisible();

      const textValue = await cleanApp.getByTestId('admin-edit-form-text').inputValue();
      expect(textValue).toBe('Test message for editing');
    });

    test('should open DeleteConfirmDialog on delete button click', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Create a custom message
      await createTestMessage(cleanApp, 'Test message for deletion', 'custom');

      // Filter to custom messages and click delete
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);

      await cleanApp.locator('[data-testid="message-row-delete-button"]').first().click();

      // Verify delete dialog opens
      await expect(cleanApp.getByTestId('admin-delete-dialog')).toBeVisible();
      await expect(cleanApp.getByTestId('admin-delete-dialog-confirm')).toBeVisible();
      await expect(cleanApp.getByTestId('admin-delete-dialog-cancel')).toBeVisible();
    });
  });

  test.describe('AC-3.4.5: Create Message Form Functionality', () => {
    test('should validate text length (max 500 characters)', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      await cleanApp.getByTestId('admin-create-button').click();

      // Type 501 characters
      const longText = 'a'.repeat(501);
      await cleanApp.getByTestId('admin-create-form-text').fill(longText);

      // Verify only 500 characters are accepted (textarea maxLength)
      const actualValue = await cleanApp.getByTestId('admin-create-form-text').inputValue();
      expect(actualValue.length).toBe(500);
    });

    test('should disable save button when text is empty', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      await cleanApp.getByTestId('admin-create-button').click();

      // Verify save button is disabled with empty text
      await expect(cleanApp.getByTestId('admin-create-form-save')).toBeDisabled();

      // Type some text
      await cleanApp.getByTestId('admin-create-form-text').fill('Valid message');

      // Verify save button is enabled
      await expect(cleanApp.getByTestId('admin-create-form-save')).toBeEnabled();
    });

    test('should create message and add to list', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      const testMessage = 'New test message for creation';

      // Get initial custom message count
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);
      const initialCount = await cleanApp.locator('[data-testid="admin-message-row"]').count();

      // Create message
      await createTestMessage(cleanApp, testMessage, 'custom');

      // Verify message appears in list
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);
      const newCount = await cleanApp.locator('[data-testid="admin-message-row"]').count();
      expect(newCount).toBe(initialCount + 1);

      // Verify message text is present
      const messageTexts = await cleanApp.locator('[data-testid="message-row-text"]').allTextContents();
      const hasNewMessage = messageTexts.some(text => text.includes(testMessage));
      expect(hasNewMessage).toBe(true);
    });

    test('should show character counter', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      await cleanApp.getByTestId('admin-create-button').click();

      // Type some text
      await cleanApp.getByTestId('admin-create-form-text').fill('Test message');

      // Verify character counter is visible (500 - 12 = 488 remaining)
      const formContent = await cleanApp.getByTestId('admin-create-form').textContent();
      expect(formContent).toContain('remaining');
    });
  });

  test.describe('AC-3.4.6: Edit Message Form Functionality', () => {
    test('should pre-populate form with existing message data', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      const originalMessage = 'Original message text';

      // Create message
      await createTestMessage(cleanApp, originalMessage, 'memory');

      // Open edit form
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);
      await cleanApp.locator('[data-testid="message-row-edit-button"]').first().click();

      // Verify pre-populated data
      const textValue = await cleanApp.getByTestId('admin-edit-form-text').inputValue();
      expect(textValue).toBe(originalMessage);

      const categoryValue = await cleanApp.getByTestId('admin-edit-form-category').inputValue();
      expect(categoryValue).toBe('memory');
    });

    test('should update message on save', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      const originalMessage = 'Message before edit';
      const updatedMessage = 'Message after edit';

      // Create message
      await createTestMessage(cleanApp, originalMessage, 'custom');

      // Edit message
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);
      await cleanApp.locator('[data-testid="message-row-edit-button"]').first().click();

      await cleanApp.getByTestId('admin-edit-form-text').fill(updatedMessage);
      await cleanApp.getByTestId('admin-edit-form-save').click();

      // Verify modal closes
      await expect(cleanApp.getByTestId('admin-edit-form')).not.toBeVisible();

      // Verify updated message appears in list
      await cleanApp.waitForTimeout(300);
      const messageTexts = await cleanApp.locator('[data-testid="message-row-text"]').allTextContents();
      const hasUpdatedMessage = messageTexts.some(text => text.includes(updatedMessage));
      expect(hasUpdatedMessage).toBe(true);
    });

    test('should cancel edit without saving changes', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      const originalMessage = 'Message to cancel edit';

      // Create message
      await createTestMessage(cleanApp, originalMessage, 'custom');

      // Open edit form and make changes
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);
      await cleanApp.locator('[data-testid="message-row-edit-button"]').first().click();

      await cleanApp.getByTestId('admin-edit-form-text').fill('Changed text');
      await cleanApp.getByTestId('admin-edit-form-cancel').click();

      // Verify modal closes
      await expect(cleanApp.getByTestId('admin-edit-form')).not.toBeVisible();

      // Verify original message unchanged
      const messageTexts = await cleanApp.locator('[data-testid="message-row-text"]').allTextContents();
      const hasOriginalMessage = messageTexts.some(text => text.includes(originalMessage));
      expect(hasOriginalMessage).toBe(true);
    });
  });

  test.describe('AC-3.4.7: Consistent Theme Styling', () => {
    test('should apply current theme to admin panel', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Verify admin panel has gradient background (theme-dependent)
      const adminPanel = cleanApp.locator('text=Admin Panel').locator('..');
      await expect(adminPanel).toBeVisible();

      // Verify button styling uses theme colors (gradient from pink to rose)
      const createButton = cleanApp.getByTestId('admin-create-button');
      const buttonClass = await createButton.getAttribute('class');
      expect(buttonClass).toContain('from-pink-500');
      expect(buttonClass).toContain('to-rose-500');
    });

    test('should animate modal entrance/exit', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Open create modal
      await cleanApp.getByTestId('admin-create-button').click();

      // Modal should be visible (animation complete)
      await expect(cleanApp.getByTestId('admin-create-form')).toBeVisible();

      // Close modal
      await cleanApp.getByTestId('admin-create-form-cancel').click();

      // Modal should close with animation
      await expect(cleanApp.getByTestId('admin-create-form')).not.toBeVisible({ timeout: 1000 });
    });
  });

  test.describe('AC-3.4.8: Temporary LocalStorage Persistence', () => {
    test('should persist custom messages to LocalStorage', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      const testMessage = 'Persistent test message';

      // Create message
      await createTestMessage(cleanApp, testMessage, 'custom');

      // Verify LocalStorage has custom messages
      const storedMessages = await cleanApp.evaluate(() => {
        const stored = localStorage.getItem('my-love-custom-messages');
        return stored ? JSON.parse(stored) : [];
      });

      expect(storedMessages.length).toBeGreaterThan(0);

      const hasTestMessage = storedMessages.some((msg: { text: string }) => msg.text === testMessage);
      expect(hasTestMessage).toBe(true);
    });

    test('should restore custom messages after page refresh', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      const testMessage = 'Message to persist across refresh';

      // Create message
      await createTestMessage(cleanApp, testMessage, 'custom');

      // Refresh page
      await cleanApp.reload();
      await cleanApp.waitForTimeout(1000);

      // Navigate back to admin
      await navigateToAdmin(cleanApp);

      // Verify message persisted
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);

      const messageTexts = await cleanApp.locator('[data-testid="message-row-text"]').allTextContents();
      const hasPersistedMessage = messageTexts.some(text => text.includes(testMessage));
      expect(hasPersistedMessage).toBe(true);
    });

    test('should delete message from LocalStorage', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      const testMessage = 'Message to delete';

      // Create message
      await createTestMessage(cleanApp, testMessage, 'custom');

      // Delete message
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);
      await cleanApp.locator('[data-testid="message-row-delete-button"]').first().click();
      await cleanApp.getByTestId('admin-delete-dialog-confirm').click();

      // Verify message removed from LocalStorage
      await cleanApp.waitForTimeout(300);
      const storedMessages = await cleanApp.evaluate(() => {
        const stored = localStorage.getItem('my-love-custom-messages');
        return stored ? JSON.parse(stored) : [];
      });

      const hasDeletedMessage = storedMessages.some((msg: any) => msg.text === testMessage);
      expect(hasDeletedMessage).toBe(false);
    });

    test('should update message in LocalStorage on edit', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      const originalMessage = 'Message before update';
      const updatedMessage = 'Message after update';

      // Create message
      await createTestMessage(cleanApp, originalMessage, 'custom');

      // Edit message
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);
      await cleanApp.locator('[data-testid="message-row-edit-button"]').first().click();
      await cleanApp.getByTestId('admin-edit-form-text').fill(updatedMessage);
      await cleanApp.getByTestId('admin-edit-form-save').click();

      // Verify LocalStorage updated
      await cleanApp.waitForTimeout(300);
      const storedMessages = await cleanApp.evaluate(() => {
        const stored = localStorage.getItem('my-love-custom-messages');
        return stored ? JSON.parse(stored) : [];
      });

      const hasUpdatedMessage = storedMessages.some((msg: any) => msg.text === updatedMessage);
      expect(hasUpdatedMessage).toBe(true);

      const hasOriginalMessage = storedMessages.some((msg: any) => msg.text === originalMessage);
      expect(hasOriginalMessage).toBe(false);
    });
  });

  test.describe('Integration Tests', () => {
    test('should handle multiple CRUD operations in sequence', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      // Create 3 messages
      await createTestMessage(cleanApp, 'Message 1', 'reason');
      await createTestMessage(cleanApp, 'Message 2', 'memory');
      await createTestMessage(cleanApp, 'Message 3', 'custom');

      // Verify count
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);
      let count = await cleanApp.locator('[data-testid="admin-message-row"]').count();
      expect(count).toBe(3);

      // Edit first message
      await cleanApp.locator('[data-testid="message-row-edit-button"]').first().click();
      await cleanApp.getByTestId('admin-edit-form-text').fill('Message 1 Updated');
      await cleanApp.getByTestId('admin-edit-form-save').click();
      await cleanApp.waitForTimeout(300);

      // Delete last message
      await cleanApp.locator('[data-testid="message-row-delete-button"]').last().click();
      await cleanApp.getByTestId('admin-delete-dialog-confirm').click();
      await cleanApp.waitForTimeout(300);

      // Verify final count
      count = await cleanApp.locator('[data-testid="admin-message-row"]').count();
      expect(count).toBe(2);
    });

    test('should maintain message list state when switching between admin and main app', async ({ cleanApp }) => {
      await navigateToAdmin(cleanApp);

      const testMessage = 'Message to maintain state';

      // Create message
      await createTestMessage(cleanApp, testMessage, 'custom');

      // Exit to main app
      await cleanApp.getByTestId('admin-exit-button').click();
      await expect(cleanApp.getByTestId('message-card')).toBeVisible();

      // Return to admin
      await navigateToAdmin(cleanApp);

      // Verify message still exists
      await cleanApp.getByTestId('admin-filter-category').selectOption('custom');
      await cleanApp.waitForTimeout(300);
      const messageTexts = await cleanApp.locator('[data-testid="message-row-text"]').allTextContents();
      const hasMessage = messageTexts.some(text => text.includes(testMessage));
      expect(hasMessage).toBe(true);
    });
  });
});
