/**
 * E2E: the Settings pages keep the Touch Floor and the DESIGN.md palette
 *
 * Walks every Settings page a browser reaches, plus its dialogs and forms, in
 * light and dark, and holds what the 2026-11-04 hand measurement found
 * (DW-451): every target outside the dock is at least 44px in both directions
 * (a control inside a label or button counts that holder's box, so a
 * visually hidden radio counts its label row), every field's text is at least
 * 16px so iOS never zooms, and every colour drawn is a DESIGN.md token of that
 * scheme, read at run time from DESIGN.md's front matter, or the dialogs' 50%
 * black scrim. An axe scan limited to `color-contrast` runs over the same
 * states (DW-432), since the token check proves which colours appear, not
 * which pairs sit together.
 *
 * Notifications exists only in the iOS shell and is left out. Photos shows
 * only where the browser reports a connection type, so the page reports
 * `wifi`. Seeds its own events and anniversary and deletes them by id, and
 * sets this pair's couple_settings row (deleted before and after) so the
 * Together since and Wedding pages show rather than their Date pages.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../support/merged-fixtures';
import { isoDateDaysFromNow, resolveOwnPair, seedEvent } from '../../support/helpers/events';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

/** `r,g,b,a` with the alpha to two places, the form the page measurement reports. */
function hexKey(hex: string): string {
  const h = hex.replace('#', '');
  const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',') + `,${Math.round(alpha * 100) / 100}`;
}

/**
 * DESIGN.md's colour tokens by scheme: `name: '#hex'` lines of the front
 * matter's `colors:` block, `-dark` names for dark. Parsed by hand, as the
 * block is flat, rather than through a YAML parser the repo does not declare.
 */
function designPalette(): Record<Scheme, Map<string, string>> {
  const file = readFileSync(
    resolve(process.cwd(), '_bmad-output/initiative-my-love/ux-settings-page/DESIGN.md'),
    'utf8'
  );
  const front = file.split(/^---$/m)[1] ?? '';
  const block = front.split(/^colors:$/m)[1]?.split(/^\S/m)[0] ?? '';
  const palette = { light: new Map<string, string>(), dark: new Map<string, string>() };
  for (const [, name, hex] of block.matchAll(/^\s+([\w-]+):\s*'(#[0-9A-Fa-f]{6,8})'/gm)) {
    if (name.endsWith('-dark')) palette.dark.set(hexKey(hex), name);
    else palette.light.set(hexKey(hex), name);
  }
  for (const scheme of SCHEMES) palette[scheme].set('0,0,0,0.5', 'scrim');
  return palette;
}

interface Finding {
  kind: 'target' | 'field' | 'colour';
  what: string;
}

/**
 * Runs in the page: the targets under 44px, the fields under 16px and the
 * colours not in `allowed`, for everything shown outside the dock.
 */
function measureInPage(allowed: string[]): Finding[] {
  const allowedSet = new Set(allowed);
  const dock = document.querySelector('[data-testid="nav-dock"]');
  const inDock = (el: Element) => !!dock && dock.contains(el);
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    // A visually hidden element (sr-only: 1px, clipped) draws nothing.
    if (r.width <= 1 || r.height <= 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    for (let a: Element | null = el; a; a = a.parentElement) {
      if (getComputedStyle(a).opacity === '0') return false;
    }
    return true;
  };
  const name = (el: Element) =>
    (
      el.getAttribute('aria-label') ||
      (el as HTMLElement).innerText ||
      (el as HTMLInputElement).value ||
      el.getAttribute('placeholder') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  const findings: Finding[] = [];

  const targetSelector =
    'button, a[href], [role=button], [role=switch], [role=link], [role=radio], [role=checkbox], input:not([type=hidden]), select, textarea';
  for (const el of document.querySelectorAll(targetSelector)) {
    if (inDock(el)) continue;
    // The hit area is the control or the label or button that holds it.
    const holder = el.parentElement?.closest('label, button, a[href], [role=button]');
    const boxes = [el, holder].filter((b): b is Element => !!b && !inDock(b) && shown(b));
    if (boxes.length === 0) continue;
    const hit = boxes
      .map((b) => b.getBoundingClientRect())
      .reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
    if (Math.round(hit.width) < 44 || Math.round(hit.height) < 44) {
      findings.push({
        kind: 'target',
        what: `${el.tagName.toLowerCase()} "${name(el)}" ${Math.round(hit.width)}x${Math.round(hit.height)}`,
      });
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && shown(el)) {
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 16) findings.push({ kind: 'field', what: `${el.tagName.toLowerCase()} "${name(el)}" ${size}px` });
    }
  }

  const reported = new Set<string>();
  const check = (value: string, prop: string, el: Element) => {
    if (!value || value === 'none' || value.startsWith('url')) return;
    let key: string;
    const rgb = value.match(/^rgba?\(([^)]+)\)$/);
    // Tailwind's `/50` on black resolves to oklab: the dialogs' scrim.
    const black = value.match(/^oklab\(0 0 0 \/ ([\d.]+)\)$/);
    if (rgb) {
      const p = rgb[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      const a = p.length > 3 ? p[3] : 1;
      if (a === 0) return;
      key = `${p[0]},${p[1]},${p[2]},${Math.round(a * 100) / 100}`;
    } else if (black) {
      key = `0,0,0,${Math.round(Number(black[1]) * 100) / 100}`;
    } else {
      key = value;
    }
    if (allowedSet.has(key) || reported.has(`${key} ${prop}`)) return;
    reported.add(`${key} ${prop}`);
    findings.push({ kind: 'colour', what: `${key} as ${prop} of ${el.tagName.toLowerCase()} "${name(el)}"` });
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (inDock(el) || !shown(el)) continue;
    const cs = getComputedStyle(el);
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
    if (ownText || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) check(cs.color, 'color', el);
    if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') {
      check(cs.stroke, 'stroke', el);
      if (cs.fill !== 'rgb(0, 0, 0)') check(cs.fill, 'fill', el);
    }
    check(cs.backgroundColor, 'background', el);
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      if (parseFloat(cs[`border${side}Width`]) > 0) check(cs[`border${side}Color`], `border-${side.toLowerCase()}`, el);
    }
  }
  return findings;
}

test.describe('Settings Touch Floor and DESIGN.md tokens', () => {
  const seeded = { events: [] as string[], anniversaries: [] as string[] };
  let pair: { user_a: string; user_b: string } | null = null;

  test.beforeEach(async ({ page }) => {
    seeded.events = [];
    seeded.anniversaries = [];
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Photos shows only where the browser reports a connection type.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: Object.assign(new EventTarget(), { type: 'wifi' }),
        configurable: true,
      });
    });
  });

  test.afterEach(async ({ supabaseAdmin }) => {
    if (pair) {
      const { error } = await supabaseAdmin
        .from('couple_settings')
        .delete()
        .eq('user_a', pair.user_a)
        .eq('user_b', pair.user_b);
      if (error) throw new Error(`Failed to delete the pair's couple settings: ${error.message}`);
      pair = null;
    }
    if (seeded.events.length > 0) {
      const { error } = await supabaseAdmin.from('events').delete().in('id', seeded.events);
      if (error) throw new Error(`Failed to delete the events this spec seeded: ${error.message}`);
    }
    if (seeded.anniversaries.length > 0) {
      const { error } = await supabaseAdmin.from('anniversaries').delete().in('id', seeded.anniversaries);
      if (error) throw new Error(`Failed to delete the anniversary this spec seeded: ${error.message}`);
    }
  });

  test('[P1] should keep 44px targets, 16px fields, DESIGN.md colours and AA contrast on every page', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    test.setTimeout(240_000);
    const palette = designPalette();
    expect(palette.light.size).toBeGreaterThan(10);
    expect(palette.dark.size).toBeGreaterThan(10);

    // GIVEN: an own upcoming event, a partner's, an own past one, and an anniversary
    const anchor = new Date();
    const stamp = `${testInfo.parallelIndex}-${Date.now()}`;
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const own = await seedEvent(supabaseAdmin, {
      userId,
      label: `Floor own ${stamp}`,
      eventDate: isoDateDaysFromNow(12, anchor),
      description: 'Pack light',
      icon: 'plane',
    });
    const partners = await seedEvent(supabaseAdmin, {
      userId: partnerId,
      label: `Floor partner ${stamp}`,
      eventDate: isoDateDaysFromNow(9, anchor),
      description: 'Row G',
    });
    const past = await seedEvent(supabaseAdmin, {
      userId,
      label: `Floor past ${stamp}`,
      eventDate: isoDateDaysFromNow(-20, anchor),
    });
    seeded.events.push(own, partners, past);
    const { data: anniversary, error } = await supabaseAdmin
      .from('anniversaries')
      .insert({ user_id: userId, event_date: '2021-04-04', label: `Floor anniversary ${stamp}` })
      .select('id')
      .single();
    if (error || !anniversary) throw new Error(`Failed to seed the anniversary: ${error?.message}`);
    seeded.anniversaries.push(anniversary.id);
    pair = userId < partnerId ? { user_a: userId, user_b: partnerId } : { user_a: partnerId, user_b: userId };
    await supabaseAdmin.from('couple_settings').delete().eq('user_a', pair.user_a).eq('user_b', pair.user_b);
    const { error: coupleError } = await supabaseAdmin.from('couple_settings').insert({
      ...pair,
      relationship_start: '2020-02-03T19:30:00Z',
      wedding_date: isoDateDaysFromNow(200, anchor),
    });
    if (coupleError) throw new Error(`Failed to seed the couple settings: ${coupleError.message}`);

    const findings: string[] = [];
    const settled = async () => {
      await expect
        .poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length))
        .toBe(0);
    };
    /** Measures the state on screen in both schemes, then goes back to light. */
    const measure = async (state: string) => {
      for (const scheme of SCHEMES) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await settled();
        const found = await page.evaluate(measureInPage, [...palette[scheme].keys()]);
        for (const f of found) findings.push(`${state} (${scheme}) ${f.kind}: ${f.what}`);
        const axe = await new AxeBuilder({ page })
          .withRules(['color-contrast'])
          .exclude('[data-testid="nav-dock"]')
          .analyze();
        for (const v of axe.violations) {
          for (const node of v.nodes) {
            findings.push(`${state} (${scheme}) contrast: ${node.target.join(' ')} ${node.failureSummary ?? ''}`.trim());
          }
        }
      }
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    };
    const heading = (name: string) =>
      expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    const back = async (to: string) => {
      await page.goBack();
      await heading(to);
    };
    const open = async (testId: string, to: string) => {
      await page.getByTestId(testId).click();
      await heading(to);
    };
    const dialog = async (testId: string, state: string, cancelTestId: string) => {
      await expect(page.getByTestId(testId)).toBeVisible();
      await measure(state);
      await page.getByTestId(cancelTestId).click();
      await expect(page.getByTestId(testId)).toHaveCount(0);
    };

    // WHEN: every page is walked from the top page down
    await openSettingsFromHome(page, interceptNetworkCall);
    await heading('Settings');
    await expect(page.getByTestId('settings-photos-row')).toBeVisible();
    await measure('top');
    await page.getByTestId('settings-sign-out-everywhere').click();
    await dialog(
      'settings-sign-out-everywhere-confirmation',
      'log out everywhere',
      'settings-sign-out-everywhere-confirmation-cancel'
    );

    await open('settings-profile-row', 'Profile');
    await measure('profile');
    await open('settings-profile-name', 'Name');
    await measure('name');
    await back('Profile');
    await open('settings-profile-birthday', 'Birthday');
    await measure('birthday');
    await back('Profile');
    await back('Settings');

    await open('settings-partner-row', 'Partner');
    await measure('partner');
    await back('Settings');
    await open('settings-photos-row', 'Photos');
    await measure('photos');
    await back('Settings');

    await open('settings-dates-row', 'Dates');
    await expect(page.getByTestId(`settings-dates-event-${own}`)).toBeVisible();
    await expect(page.getByTestId(`settings-dates-event-${past}`)).toBeVisible();
    await measure('dates');
    await page.getByTestId('settings-dates-add').click();
    await expect(page.getByTestId('settings-kind-chooser')).toBeVisible();
    await measure('kind chooser');
    await page.getByTestId('settings-kind-chooser-event').click();
    await heading('New event');
    await measure('new event');
    await page.getByTestId('settings-cancel').click();
    await heading('Dates');
    await page.getByTestId('settings-dates-add').click();
    await page.getByTestId('settings-kind-chooser-anniversary').click();
    await heading('New anniversary');
    await measure('new anniversary');
    await page.getByTestId('settings-cancel').click();
    await heading('Dates');

    await open(`settings-dates-event-${own}`, `Floor own ${stamp}`);
    await measure('own event');
    await page.getByTestId('settings-event-date').click();
    await heading('Date');
    await measure('event date');
    await back(`Floor own ${stamp}`);
    await page.getByTestId('settings-event-note').click();
    await heading('Note');
    await measure('event note');
    await back(`Floor own ${stamp}`);
    await page.getByTestId('settings-event-icon').click();
    await heading('Icon');
    await measure('event icon');
    await back(`Floor own ${stamp}`);
    await page.getByTestId('settings-event-delete').click();
    await dialog(
      'settings-event-delete-confirmation',
      'delete event',
      'settings-event-delete-confirmation-cancel'
    );
    await back('Dates');

    await open(`settings-dates-event-${partners}`, `Floor partner ${stamp}`);
    await measure("partner's event");
    await back('Dates');
    await open(`settings-dates-event-${past}`, `Floor past ${stamp}`);
    await measure('past event');
    await back('Dates');
    await open(`settings-dates-anniversary-${anniversary.id}`, `Floor anniversary ${stamp}`);
    await measure('anniversary');
    await back('Dates');

    await open('settings-dates-together-since', 'Together since');
    await measure('together since');
    await page.getByTestId('settings-date-row').click();
    await heading('Date');
    await measure('together since date');
    await back('Together since');
    await back('Dates');
    await open('settings-dates-wedding', 'Wedding');
    await measure('wedding');
    await back('Dates');
    await open('settings-dates-birthday-self', 'Your birthday');
    await measure('your birthday');
    await back('Dates');
    // Titled with the partner's name.
    await page.getByTestId('settings-dates-birthday-partner').click();
    await expect(page.getByRole('heading', { level: 1, name: /'s birthday$/ })).toBeVisible();
    await measure("partner's birthday");

    // THEN: nothing fell short
    expect(findings).toEqual([]);
  });
});
