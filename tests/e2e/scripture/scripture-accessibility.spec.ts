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
 *
 * Source data-testid mapping (from SoloReadingFlow.tsx):
 *   solo-reading-flow, exit-button, sr-announcer, retry-banner,
 *   scripture-view-response-button, scripture-next-verse-button,
 *   scripture-back-to-verse-button, scripture-response-text,
 *   scripture-verse-reference, scripture-verse-text,
 *   scripture-progress-indicator, scripture-bookmark-button
 *
 * NOTE: exit-button has aria-label="Exit reading".
 * NOTE: view-response-button and next-verse-button have NO explicit aria-label
 *       — they use visible button text ("View Response", "Next Verse").
 * NOTE: "Next Verse" advances directly to the next verse.
 */
import { test, expect } from '../../support/merged-fixtures';
import { startSoloSession } from '../../support/helpers';

test.describe('Scripture Accessibility', () => {
  test.describe('P2-001: Keyboard navigation', () => {
    test('should reach all interactive elements via Tab in logical order', async ({ page }) => {
      // GIVEN: User is in a solo scripture session
      await startSoloSession(page);

      // WHEN: User tabs through the reading screen
      // First tab should focus exit button (or first interactive element)
      await page.keyboard.press('Tab');

      // THEN: All interactive elements are reachable in logical order
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
      expect(focusedElements).toContain('exit-button');
      expect(focusedElements).toContain('scripture-view-response-button');
      expect(focusedElements).toContain('scripture-next-verse-button');
    });

    test('should activate buttons with Enter and Space', async ({ page }) => {
      // GIVEN: User is in a solo session with focus on View Response button
      await startSoloSession(page);

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

      // THEN: Advances directly to verse 2
      await expect(page.getByTestId('scripture-progress-indicator')).toHaveText('Verse 2 of 17');
    });

    test('should have no keyboard traps', async ({ page }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // WHEN: User tabs through the screen repeatedly.
      // Record where focus lands after every press. A trap is only detectable
      // from the sequence — inspecting the final element tells you nothing,
      // because trapped focus sits on an ordinary element and reports an
      // ordinary testid, which is indistinguishable from the healthy case.
      const readFocus = () =>
        page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return 'body';
          return el.getAttribute('data-testid') || el.tagName;
        });

      const focusSequence: string[] = [];
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        focusSequence.push(await readFocus());
      }

      // THEN: Tab actually moved focus — more than one element was reached
      const distinctFocused = new Set(focusSequence);
      expect(distinctFocused.size).toBeGreaterThan(1);

      // AND: The tab ring cycled rather than dead-ending. 20 presses over this
      // screen's handful of focusables must revisit at least one element; a
      // sequence with no repeat means focus escaped or kept walking away.
      expect(focusSequence.length).toBeGreaterThan(distinctFocused.size);

      // AND: Shift+Tab reverses out of wherever the last Tab landed
      await page.keyboard.press('Shift+Tab');
      expect(await readFocus()).not.toBe(focusSequence[focusSequence.length - 1]);
    });
  });

  test.describe('P2-002: Screen reader aria-labels', () => {
    test('should have descriptive aria-labels on buttons that have them', async ({ page }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // THEN: Exit button has aria-label (source: aria-label="Exit reading")
      await expect(page.getByTestId('exit-button')).toHaveAttribute('aria-label', 'Exit reading');

      // AND: Next Verse button uses visible text (no explicit aria-label)
      await expect(page.getByTestId('scripture-next-verse-button')).toBeVisible();
      await expect(page.getByTestId('scripture-next-verse-button')).toHaveText(
        /Next Verse|Complete Reading/
      );

      // AND: View Response button uses visible text (no explicit aria-label)
      await expect(page.getByTestId('scripture-view-response-button')).toBeVisible();
      await expect(page.getByTestId('scripture-view-response-button')).toHaveText('View Response');
    });

    test('should have aria-label on progress indicator', async ({ page }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // THEN: Progress indicator has descriptive aria-label
      await expect(page.getByTestId('scripture-progress-indicator')).toHaveAttribute(
        'aria-label',
        /currently on verse 1 of 17/i
      );
    });
  });

  test.describe('P2-003: aria-live region for verse transitions', () => {
    test('should announce verse transitions via aria-live polite', async ({
      page,
      interceptNetworkCall,
    }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // THEN: aria-live region exists (source testid: sr-announcer)
      const liveRegion = page.getByTestId('sr-announcer');
      await expect(liveRegion).toHaveAttribute('aria-live', 'polite');

      // WHEN: User clicks Next Verse to advance to verse 2
      const stepAdvance = interceptNetworkCall({
        method: 'PATCH',
        url: '**/rest/v1/scripture_sessions*',
      });

      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: Live region announces the transition.
      // Assert BEFORE awaiting the PATCH. The announcement is driven by the
      // optimistic store update in scriptureReadingSlice.advanceStep, which runs
      // before the network call, and useSoloReadingFlow clears it 1s later. Waiting
      // on the round trip first lets a slow PATCH wipe the text before we look.
      await expect(liveRegion).toContainText(/verse 2/i);

      // Settle the in-flight write so teardown doesn't race it.
      await stepAdvance;
    });
  });

  test.describe('P2-004: Announcements only on semantic state changes', () => {
    test('should not fire announcements on re-renders', async ({ page }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      const liveRegion = page.getByTestId('sr-announcer');

      // Record initial announcement text
      const _initialText = await liveRegion.textContent();

      // WHEN: View Response (not a semantic state change in terms of step)
      await page.getByTestId('scripture-view-response-button').click();

      // Wait for the response screen to render — proves the click took effect
      // and gives the aria-live region time to update if it was going to.
      await expect(page.getByTestId('response-screen')).toBeVisible();

      // THEN: Live region text should NOT change for sub-step navigation
      // (Only step changes should trigger announcements)
      const afterViewResponse = await liveRegion.textContent();
      // The announcement should not have changed (still about verse 1)
      expect(afterViewResponse).not.toMatch(/verse 2/i);
    });
  });

  test.describe('P2-005/P2-006: Focus management after transitions', () => {
    test('should manage focus after Next Verse advances step', async ({ page }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // WHEN: User clicks Next Verse (advances to verse 2)
      await page.getByTestId('scripture-next-verse-button').click();
      await expect(page.getByTestId('scripture-progress-indicator')).toHaveText('Verse 2 of 17');

      // THEN: Focus moves to the verse heading, which is what
      // useReadingNavigation focuses on a step change (useReadingNavigation.ts:64).
      // toBeFocused() is web-first and retries, which it must: the app focuses
      // inside a requestAnimationFrame, so a one-shot page.evaluate races it.
      await expect(page.getByTestId('scripture-verse-reference')).toBeFocused();
    });

    test('should focus navigation button after transition to response screen', async ({ page }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // WHEN: User views response
      await page.getByTestId('scripture-view-response-button').click();

      // THEN: Focus moves to the navigation button that was used
      // (or the back-to-verse button as logical target)
      const focusedElement = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid')
      );
      expect(
        focusedElement === 'scripture-back-to-verse-button' ||
          focusedElement === 'scripture-view-response-button'
      ).toBe(true);
    });
  });

  test.describe('P2-008: Touch targets minimum 48x48px', () => {
    test('should have buttons with minimum 48x48px touch targets', async ({ page }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // THEN: All buttons meet minimum touch target size
      const buttons = [
        'scripture-next-verse-button',
        'scripture-view-response-button',
        'exit-button',
      ];

      for (const testId of buttons) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box).toBeTruthy();
        expect(box!.width).toBeGreaterThanOrEqual(48);
        expect(box!.height).toBeGreaterThanOrEqual(48);
      }
    });

    test('should have minimum 8px spacing between touch targets', async ({ page }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // Get bounding boxes of adjacent buttons
      const viewResponseBox = await page
        .getByTestId('scripture-view-response-button')
        .boundingBox();
      const nextVerseBox = await page.getByTestId('scripture-next-verse-button').boundingBox();

      expect(viewResponseBox).toBeTruthy();
      expect(nextVerseBox).toBeTruthy();

      // THEN: Vertical spacing between buttons >= 8px
      const verticalGap = nextVerseBox!.y - (viewResponseBox!.y + viewResponseBox!.height);
      expect(verticalGap).toBeGreaterThanOrEqual(8);
    });
  });

  test.describe('P2-014: WCAG AA color contrast', () => {
    test('should pass automated accessibility audit', async ({ page }) => {
      // GIVEN: User is in a solo session, with motion reduced.
      //
      // This is not cosmetic. The verse content fades in, and axe computes the
      // colour it sees at scan time — so a scan that lands mid-fade measures the
      // text blended toward the background and reports whatever the blend
      // happened to be (observed: 1.94 #ca93ec, 2.09 #bc9bcf, 4.47 #9a30e0), or
      // skips the element entirely and reports no violation at all. The audit
      // has to measure settled colours to mean anything. useMotionConfig maps
      // prefers-reduced-motion to duration 0 (useMotionConfig.ts:15-16), so this
      // removes the transition rather than racing it.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await startSoloSession(page);

      // WHEN: axe-core scans the page
      // NOTE: Requires @axe-core/playwright in devDependencies
      const AxeBuilder = (await import('@axe-core/playwright')).default;
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="solo-reading-flow"]')
        .analyze();

      // THEN: No accessibility violations
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });
});
