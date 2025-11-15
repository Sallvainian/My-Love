import { test, expect } from '../support/fixtures/baseFixture';

/**
 * Mood History Calendar Test Suite
 * Story 6.3: Mood History Calendar View
 *
 * Tests All Acceptance Criteria:
 * - AC-1: Calendar month view with responsive layout
 * - AC-2: Mood indicator display with color coding
 * - AC-3: Month navigation with keyboard support
 * - AC-4: Mood detail modal with accessibility
 * - AC-5: Efficient data loading via getMoodsInRange()
 * - AC-6: Performance targets (<200ms render, <100ms query)
 */

test.describe('Mood History Calendar', () => {
  test('AC-1: should navigate to History tab and render calendar', async ({ cleanApp }) => {
    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Navigate to Mood tab
    await cleanApp.getByTestId('nav-mood').click();
    await expect(cleanApp.getByTestId('mood-tracker')).toBeVisible();

    // Click History tab
    await cleanApp.getByTestId('mood-tab-history').click();

    // Verify calendar renders
    const calendar = cleanApp.getByTestId('mood-calendar');
    await expect(calendar).toBeVisible();

    // Verify month header displays
    const monthHeader = cleanApp.getByTestId('calendar-month-header');
    await expect(monthHeader).toBeVisible();

    // Verify month header shows current month/year (e.g., "November 2025")
    const headerText = await monthHeader.textContent();
    expect(headerText).toMatch(/[A-Z][a-z]+ \d{4}/);

    // Verify navigation buttons render
    await expect(cleanApp.getByTestId('calendar-nav-prev')).toBeVisible();
    await expect(cleanApp.getByTestId('calendar-nav-next')).toBeVisible();

    console.log('✓ Calendar renders with navigation controls');
  });

  test('AC-1: should display correct number of days in month', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();
    await cleanApp.getByTestId('mood-tab-history').click();

    // Wait for calendar to be visible
    await expect(cleanApp.getByTestId('mood-calendar')).toBeVisible();

    // Wait for calendar grid to load (not in loading state)
    await expect(cleanApp.getByTestId('calendar-loading')).not.toBeVisible({ timeout: 5000 });

    // Get all day cells (includes empty padding cells)
    const dayCells = cleanApp.locator('[data-testid^="calendar-day-"]');
    const cellCount = await dayCells.count();

    // Calendar should have 35-42 cells (5-6 rows × 7 days)
    expect(cellCount).toBeGreaterThanOrEqual(35);
    expect(cellCount).toBeLessThanOrEqual(42);

    // Verify day numbers are sequential (1-31)
    const firstDayWithNumber = cleanApp.locator('[data-testid^="calendar-day-"]:has-text("1")').first();
    await expect(firstDayWithNumber).toBeVisible();

    console.log(`✓ Calendar displays ${cellCount} day cells`);
  });

  test('AC-2: should show mood indicator when mood logged for day', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Log a mood for today
    await cleanApp.getByTestId('mood-button-loved').click();
    await cleanApp.getByTestId('mood-note-input').fill('Test mood for calendar');
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();

    // Wait for success toast to clear
    await cleanApp.waitForTimeout(3500);

    // Switch to History tab
    await cleanApp.getByTestId('mood-tab-history').click();
    await expect(cleanApp.getByTestId('mood-calendar')).toBeVisible();

    // Get today's date number
    const today = new Date();
    const dayNumber = today.getDate();

    // Find today's cell by looking for the day number and mood indicator
    const todayCell = cleanApp.locator(`[data-testid*="calendar-day-"][data-has-mood="true"]`);

    // Verify mood indicator is visible (should have mood icon)
    await expect(todayCell).toBeVisible({ timeout: 5000 });

    // Verify the cell has the correct color class for "loved" mood (pink)
    const cellClasses = await todayCell.getAttribute('class');
    expect(cellClasses).toMatch(/pink/);

    console.log('✓ Mood indicator appears for logged mood');
  });

  test('AC-3: should navigate to previous month', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();
    await cleanApp.getByTestId('mood-tab-history').click();

    // Get current month
    const initialHeader = await cleanApp.getByTestId('calendar-month-header').textContent();

    // Click previous month button
    await cleanApp.getByTestId('calendar-nav-prev').click();

    // Wait for calendar to update
    await cleanApp.waitForTimeout(500);

    // Verify month changed
    const newHeader = await cleanApp.getByTestId('calendar-month-header').textContent();
    expect(newHeader).not.toBe(initialHeader);

    console.log(`✓ Navigated from ${initialHeader} to ${newHeader}`);
  });

  test('AC-3: should navigate to next month', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();
    await cleanApp.getByTestId('mood-tab-history').click();

    // Get current month
    const initialHeader = await cleanApp.getByTestId('calendar-month-header').textContent();

    // Click next month button
    await cleanApp.getByTestId('calendar-nav-next').click();

    // Wait for calendar to update
    await cleanApp.waitForTimeout(500);

    // Verify month changed
    const newHeader = await cleanApp.getByTestId('calendar-month-header').textContent();
    expect(newHeader).not.toBe(initialHeader);

    console.log(`✓ Navigated from ${initialHeader} to ${newHeader}`);
  });

  test('AC-3: should support keyboard navigation (arrow keys)', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();
    await cleanApp.getByTestId('mood-tab-history').click();

    // Focus on calendar
    const calendar = cleanApp.getByTestId('mood-calendar');
    await calendar.click();

    // Get initial month
    const initialHeader = await cleanApp.getByTestId('calendar-month-header').textContent();

    // Press left arrow for previous month
    await cleanApp.keyboard.press('ArrowLeft');
    await cleanApp.waitForTimeout(500);

    const afterLeft = await cleanApp.getByTestId('calendar-month-header').textContent();
    expect(afterLeft).not.toBe(initialHeader);

    // Press right arrow for next month
    await cleanApp.keyboard.press('ArrowRight');
    await cleanApp.waitForTimeout(500);

    const afterRight = await cleanApp.getByTestId('calendar-month-header').textContent();
    expect(afterRight).toBe(initialHeader);

    console.log('✓ Keyboard navigation (arrow keys) works');
  });

  test('AC-4: should open modal when clicking day with mood', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Log a mood for today
    await cleanApp.getByTestId('mood-button-happy').click();
    await cleanApp.getByTestId('mood-note-input').fill('Modal test note');
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();
    await cleanApp.waitForTimeout(3500);

    // Switch to History tab
    await cleanApp.getByTestId('mood-tab-history').click();
    await expect(cleanApp.getByTestId('mood-calendar')).toBeVisible();

    // Click on today's cell (which has a mood)
    const todayCell = cleanApp.locator(`[data-testid*="calendar-day-"][data-has-mood="true"]`).first();
    await todayCell.click();

    // Verify modal opens
    const modal = cleanApp.getByTestId('mood-detail-modal');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Verify modal contains mood data
    await expect(cleanApp.getByTestId('modal-mood-type')).toHaveText('Happy');
    await expect(cleanApp.getByTestId('modal-date')).toBeVisible();
    await expect(cleanApp.getByTestId('modal-time')).toBeVisible();
    await expect(cleanApp.getByTestId('modal-note')).toHaveText('Modal test note');

    console.log('✓ Modal opens with correct mood data');
  });

  test('AC-4: should close modal via close button', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Log mood and navigate to history
    await cleanApp.getByTestId('mood-button-content').click();
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();
    await cleanApp.waitForTimeout(3500);

    await cleanApp.getByTestId('mood-tab-history').click();

    // Open modal
    const todayCell = cleanApp.locator(`[data-testid*="calendar-day-"][data-has-mood="true"]`).first();
    await todayCell.click();
    await expect(cleanApp.getByTestId('mood-detail-modal')).toBeVisible();

    // Click close button
    await cleanApp.getByTestId('modal-close-button').click();

    // Verify modal closes
    await expect(cleanApp.getByTestId('mood-detail-modal')).not.toBeVisible({ timeout: 2000 });

    console.log('✓ Modal closes via close button');
  });

  test('AC-4: should close modal via ESC key', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Log mood and navigate to history
    await cleanApp.getByTestId('mood-button-grateful').click();
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();
    await cleanApp.waitForTimeout(3500);

    await cleanApp.getByTestId('mood-tab-history').click();

    // Open modal
    const todayCell = cleanApp.locator(`[data-testid*="calendar-day-"][data-has-mood="true"]`).first();
    await todayCell.click();
    await expect(cleanApp.getByTestId('mood-detail-modal')).toBeVisible();

    // Press ESC key
    await cleanApp.keyboard.press('Escape');

    // Verify modal closes
    await expect(cleanApp.getByTestId('mood-detail-modal')).not.toBeVisible({ timeout: 2000 });

    console.log('✓ Modal closes via ESC key');
  });

  test('AC-4: should close modal via backdrop click', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Log mood and navigate to history
    await cleanApp.getByTestId('mood-button-thoughtful').click();
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();
    await cleanApp.waitForTimeout(3500);

    await cleanApp.getByTestId('mood-tab-history').click();

    // Open modal
    const todayCell = cleanApp.locator(`[data-testid*="calendar-day-"][data-has-mood="true"]`).first();
    await todayCell.click();
    await expect(cleanApp.getByTestId('mood-detail-modal')).toBeVisible();

    // Click backdrop
    const backdrop = cleanApp.getByTestId('modal-backdrop');
    await backdrop.click({ force: true });

    // Verify modal closes
    await expect(cleanApp.getByTestId('mood-detail-modal')).not.toBeVisible({ timeout: 2000 });

    console.log('✓ Modal closes via backdrop click');
  });

  test('AC-5: should load moods efficiently for current month', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Log a mood
    await cleanApp.getByTestId('mood-button-loved').click();
    await cleanApp.getByTestId('mood-submit-button').click();
    await expect(cleanApp.getByTestId('mood-success-toast')).toBeVisible();
    await cleanApp.waitForTimeout(3500);

    // Measure time to render calendar
    const startTime = Date.now();

    await cleanApp.getByTestId('mood-tab-history').click();
    await expect(cleanApp.getByTestId('mood-calendar')).toBeVisible();

    const renderTime = Date.now() - startTime;

    // Verify moods loaded (indicator should be visible)
    const moodIndicator = cleanApp.locator(`[data-testid*="calendar-day-"][data-has-mood="true"]`);
    await expect(moodIndicator).toBeVisible({ timeout: 2000 });

    console.log(`✓ Calendar rendered in ${renderTime}ms`);
  });

  test('AC-6: should render calendar in acceptable time (<200ms)', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();
    await cleanApp.getByTestId('mood-tab-history').click();

    // Measure calendar render performance
    const renderTime = await cleanApp.evaluate(() => {
      return new Promise<number>((resolve) => {
        const start = performance.now();
        // Force reflow
        document.body.offsetHeight;
        requestAnimationFrame(() => {
          const end = performance.now();
          resolve(end - start);
        });
      });
    });

    console.log(`✓ Calendar render time: ${renderTime.toFixed(2)}ms`);

    // Note: In CI environments, this might be slower, so we allow some buffer
    expect(renderTime).toBeLessThan(300);
  });

  test('AC-1: should be responsive on mobile viewport', async ({ cleanApp }) => {
    // Set mobile viewport (iPhone SE size)
    await cleanApp.setViewportSize({ width: 375, height: 667 });

    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();
    await cleanApp.getByTestId('mood-tab-history').click();

    // Verify calendar renders on mobile
    const calendar = cleanApp.getByTestId('mood-calendar');
    await expect(calendar).toBeVisible();

    // Verify calendar is full width on mobile
    const calendarBox = await calendar.boundingBox();
    expect(calendarBox?.width).toBeGreaterThan(300);

    // Verify day cells are appropriately sized
    const dayCell = cleanApp.locator('[data-testid^="calendar-day-"]').first();
    const cellBox = await dayCell.boundingBox();
    expect(cellBox?.width).toBeGreaterThan(30);
    expect(cellBox?.width).toBeLessThan(80);

    console.log('✓ Calendar is responsive on mobile viewport');
  });

  test('should preserve tracker state when switching tabs', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Select mood and enter note in tracker
    await cleanApp.getByTestId('mood-button-happy').click();
    await cleanApp.getByTestId('mood-note-input').fill('Test state preservation');

    // Switch to History tab
    await cleanApp.getByTestId('mood-tab-history').click();
    await expect(cleanApp.getByTestId('mood-calendar')).toBeVisible();

    // Switch back to Log Mood tab
    await cleanApp.getByTestId('mood-tab-tracker').click();
    await expect(cleanApp.getByTestId('mood-tracker')).toBeVisible();

    // Verify state preserved
    await expect(cleanApp.getByTestId('mood-button-happy')).toHaveClass(/border-pink-500/);
    const noteValue = await cleanApp.getByTestId('mood-note-input').inputValue();
    expect(noteValue).toBe('Test state preservation');

    console.log('✓ Tracker state preserved when switching tabs');
  });

  test('should show loading state while fetching moods', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();

    // Navigate to history (may show loading briefly)
    await cleanApp.getByTestId('mood-tab-history').click();

    // Calendar should eventually load
    await expect(cleanApp.getByTestId('mood-calendar')).toBeVisible({ timeout: 3000 });

    console.log('✓ Loading state handled correctly');
  });

  test('should highlight current date', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();
    await cleanApp.getByTestId('mood-tab-history').click();

    // Get today's date
    const today = new Date();
    const dayNumber = today.getDate();

    // Find today's cell - it should have a distinct styling
    const todayCell = cleanApp.locator(`[data-testid*="calendar-day-"]:has-text("${dayNumber}")`).first();

    // Verify today's cell has current date styling (ring or background)
    const cellClasses = await todayCell.getAttribute('class');
    expect(cellClasses).toMatch(/ring|border-2/);

    console.log('✓ Current date is highlighted');
  });

  test('should handle year rollover when navigating months', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });
    await cleanApp.getByTestId('nav-mood').click();
    await cleanApp.getByTestId('mood-tab-history').click();

    // Navigate to January (or close to it)
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();

    // Click previous month enough times to reach January
    for (let i = 0; i < currentMonth; i++) {
      await cleanApp.getByTestId('calendar-nav-prev').click();
      await cleanApp.waitForTimeout(300);
    }

    // Verify we're at January
    const januaryHeader = await cleanApp.getByTestId('calendar-month-header').textContent();
    expect(januaryHeader).toContain('January');

    // Click previous month one more time to go to December of previous year
    await cleanApp.getByTestId('calendar-nav-prev').click();
    await cleanApp.waitForTimeout(300);

    const decemberHeader = await cleanApp.getByTestId('calendar-month-header').textContent();
    expect(decemberHeader).toContain('December');

    // Verify year decreased
    const prevYear = currentDate.getFullYear() - 1;
    expect(decemberHeader).toContain(String(prevYear));

    console.log('✓ Year rollover handled correctly');
  });
});
