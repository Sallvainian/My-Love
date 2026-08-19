/**
 * tests/e2e/settings/events-accessibility.spec.ts
 *
 * RED-PHASE ATDD scaffold — story 5 (`spec-dynamic-events`, "manage events in
 * Settings"). Every test is emitted as `test.skip(...)`; a developer activates
 * one by deleting its `.skip`.
 *
 * Test design: **DE.5-E2E-001**, three scans, all [P1]
 * (`_bmad-output/test-artifacts/test-design-epic-5.md:345`). Closes risk R-009,
 * recorded there as "No automated accessibility scan on either new dialog, on a
 * change that produced four medium a11y findings during review" (:129).
 *
 * The only AxeBuilder use anywhere in this repo is
 * `tests/e2e/scripture/scripture-accessibility.spec.ts:296-303`; the three
 * scans below copy that shape exactly. `@axe-core/playwright` is already a
 * devDependency (`package.json:55`, "^4.13.0").
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
 * ── MEASURED first run: 2 of 3 RED ─────────────────────────────────────────
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
 * The two failing targets are `button[data-testid="events-settings-add"]` and
 * `button[data-testid="events-form-submit"]` — white text on Tailwind's
 * `bg-pink-500` (#f6339a). No other axe rule fired anywhere in the three scans.
 * The delete dialog passes because its confirm button is not pink.
 *
 * These are therefore RED against a REAL production defect, not against missing
 * implementation — a WCAG 2 AA contrast failure on the primary action of both
 * the section and the form. Fixing it is a production change (a darker pink, or
 * a larger/bolder label, either of which clears 4.5:1), not a test change. It is
 * outside the story-5 diff and belongs to whoever picks up R-009.
 *
 * Test data: rows are seeded and torn down for THIS worker's pair only, keyed
 * on TEST_WORKER_INDEX through `getWorkerPairEmails()`. No partner is linked or
 * unlinked, no password is reset and no shared row is nulled — those rows
 * belong to other workers.
 *
 * No network is stubbed here, so no `skipNetworkMonitoring` annotation: the
 * merged fixtures' network-error-monitor (`tests/support/merged-fixtures.ts:29-40`)
 * should stay armed, and a 4xx/5xx during an accessibility run is real signal.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import type { TypedSupabaseClient } from '../../support/factories';
import { formatDateISO } from '../../../src/utils/dateUtils';
import { log } from '@seontechnologies/playwright-utils';
import type { Page } from '@playwright/test';

/**
 * Deliberately unlike any fixed Home testid — `Wedding` slugifies to
 * `event-countdown-wedding`, a hardcoded card that must never be shadowed by a
 * row this spec creates.
 */
const A11Y_LABEL = 'Settings A11y E2E';

async function resolveAppUserId(
  supabaseAdmin: TypedSupabaseClient,
  email: string
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (error || !data?.id) {
    throw new Error(`Could not resolve app user for ${email}: ${error?.message ?? 'not found'}`);
  }

  return data.id;
}

/** This worker's own pair, resolved to `public.users.id`s. Throws outside a worker. */
async function resolveOwnPair(
  supabaseAdmin: TypedSupabaseClient
): Promise<{ userId: string; partnerId: string }> {
  const pair = getWorkerPairEmails();
  if (!pair) {
    throw new Error('resolveOwnPair: no worker identity (TEST_WORKER_INDEX unset)');
  }

  const [userId, partnerId] = await Promise.all([
    resolveAppUserId(supabaseAdmin, pair.user1Email),
    resolveAppUserId(supabaseAdmin, pair.user2Email),
  ]);

  return { userId, partnerId };
}

/**
 * Remove every event owned by either half of this worker's pair.
 *
 * Checked, because a silently-failed clear leaves stray rows that break the
 * next test's premise and fail it pointing at the wrong code. Scoped to this
 * worker's own two users: every other row in `events` belongs to another
 * worker's pair.
 */
async function clearPairEvents(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  partnerId: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('events').delete().in('user_id', [userId, partnerId]);
  if (error) {
    throw new Error(`Failed to clear events for the worker pair: ${error.message}`);
  }
}

/**
 * Seed one row owned by `userId`, so the list, its Edit/Delete controls and
 * both dialogs are reachable without driving a create through the UI first.
 */
async function seedEvent(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  label: string,
  eventDate: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('events').insert({
    user_id: userId,
    label,
    event_date: eventDate,
    description: 'Seeded by the ATDD scaffold',
    icon: 'calendar',
  });
  if (error) {
    throw new Error(`Failed to seed the event "${label}": ${error.message}`);
  }
}

/** The list row carrying a given label. Row testids key on the event's uuid. */
function rowFor(page: Page, label: string) {
  return page.locator('[data-testid^="event-row-"]').filter({ hasText: label });
}

function futureDate(dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return formatDateISO(date);
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching events-crud.spec.ts:139-144.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.afterEach(async ({ supabaseAdmin }) => {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  await clearPairEvents(supabaseAdmin, userId, partnerId);
});

test.describe('Settings events accessibility (DE.5-E2E-001)', () => {
  test.skip(
    '[P1] DE.5-E2E-001a the settled events section has no axe violations',
    async ({ page, supabaseAdmin }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      // Seeded rather than left empty: a row brings the list, the row heading,
      // the date line and the two icon-only controls (`event-edit-<id>`,
      // `event-delete-<id>`, EventsSettings.tsx:360,369) into the scan. The
      // empty state would scan almost nothing.
      await seedEvent(supabaseAdmin, userId, A11Y_LABEL, futureDate(30));

      // Set for parity with scripture-accessibility.spec.ts:281-291, and it
      // costs nothing — but be clear about what it does NOT do here. That spec
      // works because every scripture component routes its durations through
      // `useMotionConfig`, which maps `useReducedMotion()` to `duration: 0`
      // (src/hooks/useMotionConfig.ts:11-16). EventsSettings does not: its rows
      // and both dialogs carry hardcoded framer-motion props
      // (EventsSettings.tsx:313-314, 585-586, 598-599, 932-933, 945-946), and
      // `grep -rn "MotionConfig" src/` finds no wrapper that would apply the
      // preference globally. So the explicit settle below — not this line — is
      // what makes the measured colours the settled ones.
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await log.step('Open Settings and let the events section settle');
      await page.goto('/');
      await navigateTo(page, 'settings');
      await expect(page.getByTestId('settings-view')).toBeVisible();

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

  test.skip(
    '[P1] DE.5-E2E-001b the open add/edit form dialog has no axe violations',
    async ({ page, supabaseAdmin, recurse }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      // A row is seeded so the form can be opened in its EDIT shape: pre-filled
      // label, date and description, plus the icon radio group — the widest
      // version of this dialog, and the one review found four issues on.
      await seedEvent(supabaseAdmin, userId, A11Y_LABEL, futureDate(30));

      // Same caveat as above: this does not zero these dialogs' animations.
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await log.step('Open the edit form for the seeded row');
      await page.goto('/');
      await navigateTo(page, 'settings');

      const row = rowFor(page, A11Y_LABEL);
      await expect(row).toBeVisible();
      await row.locator('[data-testid^="event-edit-"]').click();

      const dialog = page.getByTestId('events-form');
      await expect(dialog).toBeVisible();
      await expect(page.getByTestId('events-form-label')).toHaveValue(A11Y_LABEL);

      // Two animated layers, so two settles. The backdrop wrapper carries the
      // testid and fades 0 -> 1 (EventsSettings.tsx:585-586). The panel inside
      // it runs scale 0.9 / opacity 0 -> 1 (:598-599) and has no testid of its
      // own, so it is reached as the wrapper's only element child from inside
      // the evaluate. That child walk is a settle, never an assertion target —
      // every assertion below addresses an element by its testid or its role.
      await expect(dialog).toHaveCSS('opacity', '1');
      await recurse(
        () =>
          dialog.evaluate((element) => {
            const panel = element.firstElementChild;
            return panel instanceof HTMLElement ? getComputedStyle(panel).opacity : '0';
          }),
        (opacity) => opacity === '1',
        { timeout: 5000, interval: 100, log: 'settling the events form dialog' }
      );

      await log.step('Scan the open form dialog');
      const AxeBuilder = (await import('@axe-core/playwright')).default;
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="events-form"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  );

  test.skip(
    '[P1] DE.5-E2E-001c the open delete confirmation has no axe violations',
    async ({ page, supabaseAdmin, recurse }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      await seedEvent(supabaseAdmin, userId, A11Y_LABEL, futureDate(30));

      // Same caveat again — see DE.5-E2E-001a.
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await log.step('Open the delete confirmation for the seeded row');
      await page.goto('/');
      await navigateTo(page, 'settings');

      const row = rowFor(page, A11Y_LABEL);
      await expect(row).toBeVisible();
      await row.locator('[data-testid^="event-delete-"]').click();

      const dialog = page.getByTestId('events-delete-confirmation');
      await expect(dialog).toBeVisible();
      // Nothing is confirmed here: the scan is of the dialog at rest, so the
      // seeded row survives into the afterEach teardown.
      await expect(page.getByTestId('events-delete-cancel')).toBeVisible();

      // Wrapper at EventsSettings.tsx:932-933, panel at :945-946.
      await expect(dialog).toHaveCSS('opacity', '1');
      await recurse(
        () =>
          dialog.evaluate((element) => {
            const panel = element.firstElementChild;
            return panel instanceof HTMLElement ? getComputedStyle(panel).opacity : '0';
          }),
        (opacity) => opacity === '1',
        { timeout: 5000, interval: 100, log: 'settling the delete confirmation dialog' }
      );

      await log.step('Scan the open delete confirmation');
      const AxeBuilder = (await import('@axe-core/playwright')).default;
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[data-testid="events-delete-confirmation"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  );
});
