import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';

type ContrastPalette = {
  defaultBackground: string;
  hoverBackground: string;
  foreground: string;
};

async function resolveRuntimeColor(
  page: Page,
  kind: 'background' | 'foreground',
  value: string
): Promise<string> {
  return page.evaluate(
    ({ kind: requestedKind, value: requestedValue }) => {
      const probe = document.createElement('span');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.position = 'fixed';
      probe.style.visibility = 'hidden';

      if (requestedKind === 'background') {
        probe.style.backgroundColor = requestedValue;
      } else {
        probe.style.color = requestedValue;
      }

      document.body.appendChild(probe);
      try {
        const style = getComputedStyle(probe);
        return requestedKind === 'background' ? style.backgroundColor : style.color;
      } finally {
        probe.remove();
      }
    },
    { kind, value }
  );
}

async function readBackground(target: Locator): Promise<string> {
  return target.evaluate((element) => getComputedStyle(element).backgroundColor);
}

async function readForeground(target: Locator): Promise<string> {
  return target.evaluate((element) => getComputedStyle(element).color);
}

async function assertPinkPrimaryContrast(options: {
  page: Page;
  target: Locator;
  testId: string;
  palette: ContrastPalette;
  settleHover: (target: Locator) => Promise<string>;
}): Promise<void> {
  const { page, target, testId, palette, settleHover } = options;
  await expect(target).toBeVisible();

  const scanId = `tea-contrast-${testId}`;
  const previousId = await target.getAttribute('id');
  await target.evaluate((element, id) => {
    element.id = id;
  }, scanId);

  try {
    expect(await readBackground(target), `${testId} should resolve to --color-pink-600`).toBe(
      palette.defaultBackground
    );
    expect(await readForeground(target), `${testId} should keep white text`).toBe(
      palette.foreground
    );

    const defaultScan = await new AxeBuilder({ page })
      .include(`#${scanId}`)
      .withRules(['color-contrast'])
      .analyze();
    expect(defaultScan.violations, `${testId} default contrast should pass`).toEqual([]);

    await target.hover();
    const settledHover = await settleHover(target);
    expect(settledHover, `${testId} should settle to --color-pink-700 on hover`).toBe(
      palette.hoverBackground
    );
    expect(await readForeground(target), `${testId} hover should keep white text`).toBe(
      palette.foreground
    );

    const hoverScan = await new AxeBuilder({ page })
      .include(`#${scanId}`)
      .withRules(['color-contrast'])
      .analyze();
    expect(hoverScan.violations, `${testId} hover contrast should pass`).toEqual([]);
  } finally {
    await target.evaluate(
      (element, state) => {
        if (element.id !== state.scanId) return;
        if (state.previousId === null) {
          element.removeAttribute('id');
        } else {
          element.id = state.previousId;
        }
      },
      { scanId, previousId }
    );
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

const scenarios = [
  { caseId: 'DWPB-E2E-001a', colorScheme: 'light' },
  { caseId: 'DWPB-E2E-001b', colorScheme: 'dark' },
] as const;

test.describe('Pink primary button contrast in Settings Events', () => {
  for (const { caseId, colorScheme } of scenarios) {
    test(`[P1] ${caseId} keeps representative primary actions WCAG AA in ${colorScheme} mode`, async ({
      page,
      coupleEvents,
      recurse,
      log,
    }) => {
      await coupleEvents.clear();
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });

      await log({
        level: 'step',
        message: `Open the empty Events settings state in ${colorScheme} mode`,
      });
      await page.goto('/');
      await navigateTo(page, 'settings');
      await expect(page.getByTestId('settings-view')).toBeVisible();
      await expect(page.getByTestId('events-settings-empty')).toBeVisible();
      await expect(page.getByTestId('events-settings-empty-add')).toBeVisible();

      const palette: ContrastPalette = {
        defaultBackground: await resolveRuntimeColor(
          page,
          'background',
          'var(--color-pink-600)'
        ),
        hoverBackground: await resolveRuntimeColor(
          page,
          'background',
          'var(--color-pink-700)'
        ),
        foreground: await resolveRuntimeColor(page, 'foreground', 'white'),
      };

      const settleHover = (target: Locator) =>
        recurse(
          () => readBackground(target),
          (background) => background === palette.hoverBackground,
          { timeout: 5000, interval: 50, log: 'settling pink primary hover transition' }
        );

      await log({
        level: 'step',
        message: 'Verify the section and formerly missed empty-state primary actions',
      });
      await assertPinkPrimaryContrast({
        page,
        target: page.getByTestId('events-settings-add'),
        testId: 'events-settings-add',
        palette,
        settleHover,
      });
      await assertPinkPrimaryContrast({
        page,
        target: page.getByTestId('events-settings-empty-add'),
        testId: 'events-settings-empty-add',
        palette,
        settleHover,
      });

      await page.getByTestId('events-settings-empty-add').click();
      const dialog = page.getByTestId('events-form');
      await expect(dialog).toBeVisible();
      await recurse(
        () =>
          dialog.evaluate((element) => {
            const panel = element.firstElementChild;
            const panelOpacity =
              panel instanceof HTMLElement ? getComputedStyle(panel).opacity : '0';
            return `${getComputedStyle(element).opacity}:${panelOpacity}`;
          }),
        (opacityPair) => opacityPair === '1:1',
        { timeout: 5000, interval: 50, log: 'settling the events form dialog' }
      );

      await log({
        level: 'step',
        message: 'Verify the historically failing form submit action',
      });
      await assertPinkPrimaryContrast({
        page,
        target: page.getByTestId('events-form-submit'),
        testId: 'events-form-submit',
        palette,
        settleHover,
      });
    });
  }
});
