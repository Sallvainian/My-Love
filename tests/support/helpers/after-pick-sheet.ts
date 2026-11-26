/**
 * The one sheet the first picker meets right after Send my pick answers: the
 * day's writer gets "Write tomorrow's question?", everyone else "Do you want to
 * nudge your partner?" (epic daily-pushes-and-nudge, story 8.9). Either sheet
 * covers the page, so a spec that goes on to use Daily closes it first.
 */
import type { Page } from '@playwright/test';
import { expect } from '../merged-fixtures';

/**
 * Close the sheet shown after a first pick: the writer's write sheet with
 * Escape (hides it for this mount) or, with `writerCloses: 'decline'`, "No
 * thanks" (ends the day's turn, so the sheet never comes back when Daily is
 * left and opened again); anyone else's nudge sheet with Not now (nothing is
 * sent, the waiting card's Nudge button stays). Waits for the sheet to show,
 * then to be gone. `isWriter` comes from `readPairDayWriter`.
 *
 * Call it only after a first pick the server answered: a second pick, a queued
 * pick and a seeded day with no open nudge slot meet no sheet.
 */
export async function closeAfterPickSheet(
  page: Page,
  isWriter: boolean,
  writerCloses: 'escape' | 'decline' = 'escape'
): Promise<void> {
  if (isWriter) {
    const writeSheet = page.getByTestId('daily-write-sheet');
    await expect(writeSheet).toBeVisible();
    if (writerCloses === 'decline') await page.getByTestId('daily-write-decline').click();
    else await page.keyboard.press('Escape');
    await expect(writeSheet).toHaveCount(0);
    return;
  }
  const nudgeSheet = page.getByTestId('daily-nudge-sheet');
  await expect(nudgeSheet).toBeVisible();
  await page.getByTestId('daily-nudge-sheet-dismiss').click();
  await expect(nudgeSheet).toHaveCount(0);
}
