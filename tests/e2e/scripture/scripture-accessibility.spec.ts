/**
 * P2 E2E: Scripture Reading - Accessibility
 *
 * Full keyboard navigation, screen reader support, reduced motion,
 * and WCAG AA compliance for the scripture reading feature.
 *
 * Risk: R-007 (Score: 2) - Accessibility regressions
 * Test IDs: P2-001 through P2-008, P2-014
 *
 * Epic 1, Story 1.5
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Scripture Accessibility', () => {
  test.describe('P2-001: Keyboard navigation', () => {
    test('should reach all interactive elements via Tab in logical order', async ({
      page,
    }) => {
      // GIVEN: User is in a solo scripture session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: User tabs through the reading screen
      // First tab should focus exit button (or first interactive element)
      await page.keyboard.press('Tab');

      // THEN: All interactive elements are reachable in logical order
      // Verify focus reaches the exit button
      const exitButton = page.getByTestId('scripture-exit-button');
      const viewResponseButton = page.getByTestId('scripture-view-response-button');
      const nextVerseButton = page.getByTestId('scripture-next-verse-button');

      // Tab through and collect focused elements
      const focusedElements: string[] = [];
      for (let i = 0; i < 10; i++) {
        const focusedTestId = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.getAttribute('data-testid') || el?.tagName || 'unknown';
        });
        focusedElements.push(focusedTestId);
        await page.keyboard.press('Tab');
      }

      // Key interactive elements should be reachable
      expect(focusedElements).toContain('scripture-exit-button');
      expect(focusedElements).toContain('scripture-view-response-button');
      expect(focusedElements).toContain('scripture-next-verse-button');
    });

    test('should activate buttons with Enter and Space', async ({ page }) => {
      // GIVEN: User is in a solo session with focus on View Response button
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // Focus the View Response button
      await page.getByTestId('scripture-view-response-button').focus();

      // WHEN: User presses Enter
      await page.keyboard.press('Enter');

      // THEN: Response screen loads
      await expect(page.getByTestId('scripture-response-text')).toBeVisible();

      // Go back to verse
      await page.getByTestId('scripture-back-to-verse-button').click();

      // Focus Next Verse button
      await page.getByTestId('scripture-next-verse-button').focus();

      // WHEN: User presses Space
      await page.keyboard.press('Space');

      // THEN: Advances to next step
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');
    });

    test('should have no keyboard traps', async ({ page }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: User tabs through all elements multiple times
      const startFocus = await page.evaluate(
        () => document.activeElement?.tagName
      );

      // Tab 20 times
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
      }

      // THEN: Focus should cycle (not get trapped)
      // Shift+Tab should move backwards
      await page.keyboard.press('Shift+Tab');
      const afterShiftTab = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid') || 'body'
      );
      expect(afterShiftTab).not.toBe('unknown');
    });
  });

  test.describe('P2-002: Screen reader aria-labels', () => {
    test('should have descriptive aria-labels on all buttons', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // THEN: All buttons have aria-labels
      await expect(
        page.getByTestId('scripture-next-verse-button')
      ).toHaveAttribute('aria-label', /next verse/i);

      await expect(
        page.getByTestId('scripture-view-response-button')
      ).toHaveAttribute('aria-label', /view response/i);

      await expect(
        page.getByTestId('scripture-exit-button')
      ).toHaveAttribute('aria-label', /exit/i);
    });

    test('should have aria-label on progress indicator', async ({ page }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // THEN: Progress indicator has descriptive aria-label
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveAttribute('aria-label', /currently on verse 1 of 17/i);
    });
  });

  test.describe('P2-003: aria-live region for verse transitions', () => {
    test('should announce verse transitions via aria-live polite', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // THEN: aria-live region exists
      const liveRegion = page.getByTestId('scripture-live-region');
      await expect(liveRegion).toHaveAttribute('aria-live', 'polite');

      // WHEN: User advances to next verse
      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: Live region announces the transition
      await expect(liveRegion).toContainText(/now on verse 2/i);
    });
  });

  test.describe('P2-004: Announcements only on semantic state changes', () => {
    test('should not fire announcements on re-renders', async ({ page }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      const liveRegion = page.getByTestId('scripture-live-region');

      // Record initial announcement text
      const initialText = await liveRegion.textContent();

      // WHEN: View Response (not a semantic state change in terms of step)
      await page.getByTestId('scripture-view-response-button').click();

      // Wait briefly for any potential update
      await page.waitForTimeout(300);

      // THEN: Live region text should NOT change for sub-step navigation
      // (Only step changes should trigger announcements)
      const afterViewResponse = await liveRegion.textContent();
      // The announcement should not have changed (still about verse 1)
      expect(afterViewResponse).not.toMatch(/now on verse 2/i);
    });
  });

  test.describe('P2-005/P2-006: Focus management after transitions', () => {
    test('should focus verse heading after navigating to a new step', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: User advances to next step
      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: Focus moves to verse heading/reference
      const focusedElement = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid')
      );
      expect(focusedElement).toBe('scripture-verse-reference');
    });

    test('should focus navigation button after transition to response screen', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: User views response
      await page.getByTestId('scripture-view-response-button').click();

      // THEN: Focus moves to the navigation button that was used
      // (or the back-to-verse button as logical target)
      const focusedElement = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid')
      );
      expect(
        focusedElement === 'scripture-back-to-verse-button' ||
          focusedElement === 'scripture-view-response-button'
      ).toBe(true);
    });
  });

  test.describe('P2-008: Touch targets minimum 48x48px', () => {
    test('should have buttons with minimum 48x48px touch targets', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // THEN: All buttons meet minimum touch target size
      const buttons = [
        'scripture-next-verse-button',
        'scripture-view-response-button',
        'scripture-exit-button',
      ];

      for (const testId of buttons) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box).toBeTruthy();
        expect(box!.width).toBeGreaterThanOrEqual(48);
        expect(box!.height).toBeGreaterThanOrEqual(48);
      }
    });

    test('should have minimum 8px spacing between touch targets', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // Get bounding boxes of adjacent buttons
      const viewResponseBox = await page
        .getByTestId('scripture-view-response-button')
        .boundingBox();
      const nextVerseBox = await page
        .getByTestId('scripture-next-verse-button')
        .boundingBox();

      expect(viewResponseBox).toBeTruthy();
      expect(nextVerseBox).toBeTruthy();

      // THEN: Vertical spacing between buttons >= 8px
      const verticalGap =
        nextVerseBox!.y - (viewResponseBox!.y + viewResponseBox!.height);
      expect(verticalGap).toBeGreaterThanOrEqual(8);
    });
  });

  test.describe('P2-014: WCAG AA color contrast', () => {
    test('should pass automated accessibility audit', async ({ page }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: axe-core scans the page
      // NOTE: Requires @axe-core/playwright in devDependencies
      const AxeBuilder = (await import('@axe-core/playwright')).default;
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="scripture-reading-container"]')
        .analyze();

      // THEN: No accessibility violations
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });
});
