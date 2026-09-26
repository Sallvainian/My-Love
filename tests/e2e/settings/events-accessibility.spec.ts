/**
 * tests/e2e/settings/events-accessibility.spec.ts
 *
 * Active ATDD accessibility coverage for story 5 (`spec-dynamic-events`,
 * "manage events in Settings"), activated under the configured runner by DW-30.
 *
 * Test design: **DE.5-E2E-001**, three original scans, all [P1]
 * (`_bmad-output/test-artifacts/test-design-epic-5.md:345`). Closes risk R-009,
 * recorded there as "No automated accessibility scan on either new dialog, on a
 * change that produced four medium a11y findings during review" (:129).
 *
 * DW-28 adds a fourth [P1] scan for the formerly unmeasured empty state, using
 * the same clear/navigate/AxeBuilder pattern as the original three scans.
 * `@axe-core/playwright` is already a devDependency (`package.json:55`,
 * "^4.13.0").
 *
 * Scope note: each scan is `.include()`d on this story's own subtree, never the
 * whole Settings view. The test design records the reason at :527-531 — a
 * view-wide scan risks landing red on pre-existing violations elsewhere in
 * Settings (AnniversarySettings), "for reasons unrelated to story 5".
 *
 * Run:
 *   supabase start
 *   npx playwright test tests/e2e/settings/events-accessibility.spec.ts --project=chromium
 *
 * ── HISTORICAL measured first run: 2 of 3 RED ──────────────────────────────
 *
 * Executed during the story-5 ATDD run (2026-08-19) against the local stack,
 * `npx playwright test tests/e2e/settings/events-accessibility.spec.ts
 * --project=chromium --workers=1`. Result: **1 passed, 2 failed.**
 *
 *   DE.5-E2E-001a (events section)  FAILED — 1 axe rule, `color-contrast`,
 *                                   impact "serious"
 *   DE.5-E2E-001b (form dialog)     FAILED — same rule, same cause
 *   DE.5-E2E-001c (delete dialog)   PASSED — zero violations
 *
 * One defect, two elements, one root cause. Verbatim from the axe node data:
 *
 *   "Element has insufficient color contrast of 3.58 (foreground color:
 *    #ffffff, background color: #f6339a, font size: 12.0pt (16px), font weight:
 *    normal). Expected contrast ratio of 4.5:1"
 *
 * At the time, the two failing targets were
 * `button[data-testid="events-settings-add"]` and
 * `button[data-testid="events-form-submit"]` — white text on Tailwind's
 * `bg-pink-500` (#f6339a). No other axe rule fired anywhere in the three scans.
 * The delete dialog passed because its confirm button was not pink.
 *
 * Those results were therefore RED against a real production defect, not
 * against missing implementation: a WCAG 2 AA contrast failure on the primary
 * action of both the section and the form. DW-28 resolved that root cause by
 * moving the matching surfaces to measured Tailwind v4 `pink-600` defaults and
 * `pink-700` hover states. All four scans now run as regression coverage.
 *
 * Test data: rows are seeded and torn down for THIS worker's pair only, keyed
 * on TEST_WORKER_INDEX through `getWorkerPairEmails()`. No partner is linked or
 * unlinked, no password is reset and no shared row is nulled — those rows
 * belong to other workers.
 *
 * No network is stubbed here, so no `skipNetworkMonitoring` annotation: the
 * merged fixtures' network-error-monitor (`tests/support/merged-fixtures.ts:31-41`)
 * should stay armed, and a 4xx/5xx during an accessibility run is real signal.
 */
import { test, expect } from '../../support/merged-fixtures';
import {
  clearOwnPairEvents,
  clearPairEvents,
  isoDateDaysFromNow,
  resolveOwnPair,
  seedEvent,
} from '../../support/helpers/events';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';
import { log } from '@seontechnologies/playwright-utils';
import type { Page } from '@playwright/test';
import type { TypedSupabaseClient } from '../../support/factories';

/**
 * Deliberately unlike any fixed Home testid — `Wedding` slugifies to
 * `event-countdown-wedding`, a hardcoded card that must never be shadowed by a
 * row this spec creates.
 */
const A11Y_LABEL = 'Settings A11y E2E';

/**
 * Seed the one upcoming row these scans run over: labelled, described and
 * iconed, so every field of the row and of the edit form is populated.
 */
async function seedA11yEvent(supabaseAdmin: TypedSupabaseClient, userId: string) {
  await seedEvent(supabaseAdmin, {
    userId,
    label: A11Y_LABEL,
    eventDate: isoDateDaysFromNow(30),
    description: 'Seeded by the accessibility test',
    icon: 'calendar',
  });
}

/** The list row carrying a given label. Row testids key on the event's uuid. */
function rowFor(page: Page, label: string) {
  return page.locator('[data-testid^="event-row-"]').filter({ hasText: label });
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching events-crud.spec.ts:139-144.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.afterEach(async ({ supabaseAdmin }) => {
  await clearOwnPairEvents(supabaseAdmin);
});

test.describe('Settings events accessibility (DE.5-E2E-001)', () => {
  test(
    '[P1] DE.5-E2E-001a the settled events section has no axe violations',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      // Seeded rather than left empty: a row brings the list, the row heading,
      // the date line and the two icon-only controls (`event-edit-<id>`,
      // `event-delete-<id>`, EventsSettings.tsx:360,369) into the scan. The
      // empty state would scan almost nothing.
      await seedA11yEvent(supabaseAdmin, userId);

      // emulateMedia reducedMotion is set here, and it costs nothing — but
      // EventsSettings does not map that preference to zero-duration motion:
      // its rows and both dialogs carry hardcoded Motion props
      // (EventsSettings.tsx:313-314, 585-586, 598-599, 932-933, 945-946), and
      // `grep -rn "MotionConfig" src/` finds no wrapper that would apply the
      // preference globally. So the explicit settle below — not this line — is
      // what makes the measured colours the settled ones.
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await log.step('Open Settings and let the events section settle');
      await openSettingsFromHome(page, interceptNetworkCall);

      const row = rowFor(page, A11Y_LABEL);
      await expect(row).toBeVisible();
      // The row IS the animated element (`initial={{ opacity: 0, y: 20 }}`,
      // EventsSettings.tsx:313), so its own settled opacity is the signal. axe
      // computes the colour it sees at scan time; a scan landing mid-fade
      // measures a blend of text and background and reports whatever that
      // blend happened to be.
      await expect(row).toHaveCSS('opacity', '1');

      await log.step('Scan the events section');
      const AxeBuilder = (await import('@axe-core/playwright')).default;
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="events-settings"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  );

  test(
    '[P1] DE.5-E2E-001b the open add/edit form dialog has no axe violations',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      // A row is seeded so the form can be opened in its EDIT shape: pre-filled
      // label, date and description, plus the icon radio group — the widest
      // version of this dialog, and the one review found four issues on.
      await seedA11yEvent(supabaseAdmin, userId);

      // Same caveat as above: this does not zero these dialogs' animations.
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await log.step('Open the edit form for the seeded row');
      await openSettingsFromHome(page, interceptNetworkCall);

      const row = rowFor(page, A11Y_LABEL);
      await expect(row).toBeVisible();
      await row.locator('[data-testid^="event-edit-"]').click();

      const dialog = page.getByTestId('events-form');
      await expect(dialog).toBeVisible();
      await expect(page.getByTestId('events-form-label')).toHaveValue(A11Y_LABEL);

      // Two animated layers, so two settles: the backdrop wrapper fades 0 -> 1,
      // and the panel inside it runs scale 0.9 / opacity 0 -> 1.
      await expect(dialog).toHaveCSS('opacity', '1');
      await expect(page.getByTestId('events-form-panel')).toHaveCSS('opacity', '1');

      await log.step('Scan the open form dialog');
      const AxeBuilder = (await import('@axe-core/playwright')).default;
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="events-form"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  );

  test(
    '[P1] DE.5-E2E-001c the open delete confirmation has no axe violations',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      await seedA11yEvent(supabaseAdmin, userId);

      // Same caveat again — see DE.5-E2E-001a.
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await log.step('Open the delete confirmation for the seeded row');
      await openSettingsFromHome(page, interceptNetworkCall);

      const row = rowFor(page, A11Y_LABEL);
      await expect(row).toBeVisible();
      await row.locator('[data-testid^="event-delete-"]').click();

      const dialog = page.getByTestId('events-delete-confirmation');
      await expect(dialog).toBeVisible();
      // Nothing is confirmed here: the scan is of the dialog at rest, so the
      // seeded row survives into the afterEach teardown.
      await expect(page.getByTestId('events-delete-cancel')).toBeVisible();

      // The wrapper and its panel settle as in DE.5-E2E-001b.
      await expect(dialog).toHaveCSS('opacity', '1');
      await expect(page.getByTestId('events-delete-panel')).toHaveCSS('opacity', '1');

      await log.step('Scan the open delete confirmation');
      const AxeBuilder = (await import('@axe-core/playwright')).default;
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="events-delete-confirmation"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  );

  test(
    '[P1] DE.5-E2E-001d the empty events section has no axe violations',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      // Intentionally do not seed a row: this renders the empty-state Add
      // action that the three original scans never exercised.
      await clearPairEvents(supabaseAdmin, userId, partnerId);

      await page.emulateMedia({ reducedMotion: 'reduce' });

      await log.step('Open Settings with an empty events section');
      await openSettingsFromHome(page, interceptNetworkCall);

      const eventsSection = page.getByTestId('events-settings');
      await expect(eventsSection).toBeVisible();
      await expect(page.getByTestId('events-settings-empty-add')).toBeVisible();

      await log.step('Scan the empty events section');
      const AxeBuilder = (await import('@axe-core/playwright')).default;
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="events-settings"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  );
});
