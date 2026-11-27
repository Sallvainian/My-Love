/**
 * The sheets the first picker meets right after Send my pick answers (epic
 * daily-pushes-and-nudge, story 8.9, as story 11.1 reshaped it): everyone is
 * asked "Do you want to nudge your partner?", and the day's writer is asked
 * "Write tomorrow's question?" first, the nudge prompt following it however it
 * closes. Either sheet covers the page, so a spec that goes on to use Daily
 * closes them first.
 */
import type { Page } from '@playwright/test';
import { expect } from '../merged-fixtures';

/**
 * Close the sheets shown after a first pick. The day's writer's write sheet is
 * closed with Escape (hides it for this mount) or, with `writerCloses: 'decline'`,
 * "No thanks" (ends the day's turn, so the sheet never comes back when Daily is
 * left and opened again). Then, for the writer once that sheet is gone and for
 * anyone else at once, the nudge prompt is closed with Not now (nothing is sent,
 * the waiting card's Nudge button stays). Waits for each sheet to show, then to
 * be gone. `isWriter` comes from `readPairDayWriter`.
 *
 * Call it only after a first pick the server answered: a second pick, a queued
 * pick and a seeded day that takes no nudge (the partner has answered, or the
 * day has ended on their clock) meet no nudge sheet.
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
  }
  const nudgeSheet = page.getByTestId('daily-nudge-sheet');
  await expect(nudgeSheet).toBeVisible();
  await page.getByTestId('daily-nudge-sheet-dismiss').click();
  await expect(nudgeSheet).toHaveCount(0);
}
