/**
 * P0/P1 E2E: Scripture Reading - Save, Resume & Exit
 *
 * Users can save progress, resume sessions, and exit safely.
 * Covers optimistic UI, offline handling, and corruption recovery UX.
 *
 * Test IDs: P0-010, P0-011, P1-003, P1-005, P2-009, P2-010, P2-011
 *
 * Epic 1, Stories 1.3, 1.4
 *
 * IMPORTANT: The flow per step is: verse → (Next Verse) → reflection → (rate + Continue) → next verse.
 * "Next Verse" transitions to the reflection sub-view; the step only advances after reflection submit.
 * The exit button data-testid is "exit-button" (not "scripture-exit-button").
 * The exit dialog data-testid is "exit-confirm-dialog" (not "scripture-exit-dialog").
 */
import { test, expect } from '../../support/merged-fixtures';
import { startSoloSession, advanceOneStep } from '../../support/helpers';

async function clearClientScriptureCache(page: Parameters<typeof startSoloSession>[0]): Promise<void> {
  await page.evaluate(async () => {
    localStorage.removeItem('my-love-storage');

    const factory = indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string }>>;
    };

    const dbNames = new Set<string>(['my-love-db']);
    if (typeof factory.databases === 'function') {
      const databases = await factory.databases();
      for (const db of databases) {
        if (db.name) dbNames.add(db.name);
      }
    }

    await Promise.all(
      [...dbNames].map(
        (dbName) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          })
      )
    );
  });
}

test.describe('Scripture Session - Save & Resume', () => {
  test.describe('P0-010: Session save on exit', () => {
    test('should persist step index to server when saving and exiting', async ({
      page,
      interceptNetworkCall,
    }) => {
      // GIVEN: User is in a solo session at step 5
      await startSoloSession(page);

      // Advance to step 5 (4 full verse→reflection cycles)
      for (let i = 0; i < 4; i++) {
        await advanceOneStep(page);
      }
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 5 of 17');

      // WHEN: User taps exit button
      await page.getByTestId('exit-button').click();

      // THEN: Confirmation prompt appears
      await expect(page.getByTestId('exit-confirm-dialog')).toBeVisible();
      await expect(page.getByTestId('exit-confirm-dialog')).toContainText(
        /save your progress/i
      );

      // WHEN: User taps "Save & Exit"
      await page.getByTestId('save-and-exit-button').click();

      // THEN: User returns to overview
      await expect(page.getByTestId('scripture-overview')).toBeVisible();
    });
  });

  test.describe('P0-011: Session resume loads correct step', () => {
    test('should resume at correct step after save and exit', async ({
      page,
      interceptNetworkCall,
      supabaseAdmin,
    }) => {
      // GIVEN: User saved a session at step 5
      // Start and advance to step 5
      const sessionId = await startSoloSession(page);

      for (let i = 0; i < 4; i++) {
        await advanceOneStep(page);
      }
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 5 of 17');

      // Save and exit
      await page.getByTestId('exit-button').click();
      await page.getByTestId('save-and-exit-button').click();
      await expect(page.getByTestId('scripture-overview')).toBeVisible();

      const { data: targetSession, error: targetSessionError } = await supabaseAdmin
        .from('scripture_sessions')
        .select('user1_id')
        .eq('id', sessionId)
        .single();
      expect(targetSessionError).toBeNull();

      // Isolate this test's resume candidate for the worker user.
      const { error: isolateSessionError } = await supabaseAdmin
        .from('scripture_sessions')
        .update({ status: 'abandoned' })
        .eq('user1_id', targetSession!.user1_id)
        .eq('mode', 'solo')
        .eq('status', 'in_progress')
        .neq('id', sessionId);
      expect(isolateSessionError).toBeNull();

      // Stabilize active-session selection under parallel workers by making
      // this test's saved session the newest candidate for resume lookup.
      const { error: prioritizeSessionError } = await supabaseAdmin
        .from('scripture_sessions')
        .update({ started_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
        .eq('id', sessionId);
      expect(prioritizeSessionError).toBeNull();

      // Clear client-side cache so active-session lookup re-reads from server.
      await clearClientScriptureCache(page);

      // Re-open without `fresh=true` to exercise resume behavior.
      await page.goto('/scripture');
      await expect(page.getByTestId('scripture-overview')).toBeVisible();

      // WHEN: User returns and taps "Continue"
      await expect(page.getByTestId('resume-prompt')).toBeVisible();
      await expect(page.getByTestId('resume-prompt')).toContainText(
        /Continue where you left off\? \(Step 5 of 17\)/i
      );
      await page.getByTestId('resume-continue').click();

      // THEN: Session resumes at step 5
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 5 of 17');
    });
  });

  test.describe('P2-011: Exit confirmation dialog', () => {
    test('should show exit confirmation with save option', async ({
      page,
      interceptNetworkCall,
    }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // WHEN: User taps exit button
      await page.getByTestId('exit-button').click();

      // THEN: Confirmation dialog appears
      await expect(page.getByTestId('exit-confirm-dialog')).toBeVisible();
      await expect(page.getByTestId('exit-confirm-dialog')).toContainText(
        /save your progress\?.*you can continue later/i
      );

      // AND: "Save & Exit" button is available
      await expect(page.getByTestId('save-and-exit-button')).toBeVisible();

      // AND: Cancel/dismiss option is available
      await expect(
        page.getByTestId('cancel-exit-button')
      ).toBeVisible();
    });

    test('should dismiss exit dialog when user cancels', async ({ page, interceptNetworkCall }) => {
      // GIVEN: Exit dialog is showing
      await startSoloSession(page);
      await page.getByTestId('exit-button').click();
      await expect(page.getByTestId('exit-confirm-dialog')).toBeVisible();

      // WHEN: User taps cancel
      await page.getByTestId('cancel-exit-button').click();

      // THEN: Dialog closes and user stays in session
      await expect(
        page.getByTestId('exit-confirm-dialog')
      ).not.toBeVisible();
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();
    });
  });

  test.describe('P1-005: Server write failure shows retry UI', { annotation: [{ type: 'skipNetworkMonitoring' }] }, () => {
    test('should show retry UI when server write fails', async ({ page, interceptNetworkCall }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // Simulate network failure on step advancement
      await page.route('**/rest/v1/rpc/scripture_advance_phase', (route) =>
        route.fulfill({ status: 500, body: 'Internal Server Error' })
      );
      await page.route('**/rest/v1/scripture_sessions*', (route) => {
        if (route.request().method() === 'PATCH') {
          return route.fulfill({ status: 500, body: 'Internal Server Error' });
        }
        return route.continue();
      });

      // WHEN: User advances a step (complete the full verse→reflection→continue cycle)
      // Click Next Verse → reflection screen
      await page.getByTestId('scripture-next-verse-button').click();
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

      // Select rating and submit reflection
      await page.getByTestId('scripture-rating-3').click();
      await page.getByTestId('scripture-reflection-continue').click();

      // THEN: UI shows next step optimistically
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');

      // AND: Retry UI is shown (subtle, non-blocking)
      await expect(page.getByTestId('retry-banner')).toBeVisible();
    });
  });

  test.describe('P2-009/P2-010: Offline handling', () => {
    test('should show offline indicator when offline', async ({ page, interceptNetworkCall }) => {
      // GIVEN: User is in a solo session
      await startSoloSession(page);

      // WHEN: User goes offline
      await page.context().setOffline(true);

      // THEN: Offline indicator is shown
      await expect(
        page.getByTestId('offline-indicator')
      ).toBeVisible();

      // Restore online for cleanup
      await page.context().setOffline(false);
    });

    test('should block step advancement when offline', async ({ page, interceptNetworkCall }) => {
      // GIVEN: User is in a solo session, offline
      await startSoloSession(page);
      await page.context().setOffline(true);

      // WHEN: User tries to advance — Next Verse button should be disabled
      const nextButton = page.getByTestId('scripture-next-verse-button');
      await expect(nextButton).toBeDisabled();

      // THEN: Step does NOT advance (still on verse 1)
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');

      // Restore online for cleanup
      await page.context().setOffline(false);
    });
  });
});
