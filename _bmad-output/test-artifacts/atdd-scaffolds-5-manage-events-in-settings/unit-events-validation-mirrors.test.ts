/**
 * RED-PHASE ATDD SCAFFOLD — story 5, `5-manage-events-in-settings`
 *
 * TARGET PATH ON ACTIVATION: tests/unit/components/eventsValidationMirrors.test.ts
 *   (`tests/unit/components/` does not exist yet — `mkdir` it; vitest.config.ts:40
 *   already includes `tests/**\/*.test.ts`.)
 *
 * COVERS: DE.5-UNIT-001 [P1] — `test-design-epic-5.md:343`, risk R-007
 *   ("Client validation mirrors drift from the DB constraints", score 4).
 *
 * RUN: npx vitest run tests/unit/components/eventsValidationMirrors.test.ts
 *
 * MEASURED FIRST RUN: GREEN — 3 passed, run 2026-08-19 as
 * `npx vitest run tests/unit/components/eventsValidationMirrors.test.ts`.
 *
 * AND MEASURED TO DISCRIMINATE, which matters more for a guard than the pass:
 * the same three assertions were re-run against deliberately mutated copies of
 * both sources (`char_length(label) <= 100` changed to `<= 90` in the migration;
 * the `plane` entry deleted from ICON_OPTIONS). Result: 2 failed, 1 passed —
 * `expected '100' to be '90'` and
 * `expected [ 'calendar', 'ring' ] to deeply equal [ 'calendar', 'plane', 'ring' ]`,
 * with the untouched description case still green. A guard that cannot fail is
 * worth nothing, so it was made to fail before being trusted.
 *
 * This is a drift guard, not a behaviour test — it is red only if the mirrors
 * have ALREADY drifted, and the point of writing it is that nothing today
 * would notice if they did. `test-design-epic-5.md:343` names
 * it exactly that way: "A drift guard, not a behaviour test." Recorded honestly
 * rather than dressed up as red: see the ATDD checklist's Step 3 note on why this
 * run distinguishes RED from UNVERIFIED from GREEN-guard.
 *
 * WHY IT READS BOTH FILES AS TEXT: `LABEL_MAX_LENGTH`, `DESCRIPTION_MAX_LENGTH`
 * and `ICON_OPTIONS` are module-private in EventsSettings.tsx. Exporting them so
 * a test could import them would be a production change for a test's benefit,
 * and the story's Never list forbids widening this component's surface. Reading
 * the source as text costs nothing and asserts the same equality.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260818000002_create_events_table.sql'
);
const COMPONENT = join(process.cwd(), 'src/components/Settings/EventsSettings.tsx');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/** Fail loudly on a regex that stopped matching — a silent `null` would pass. */
function capture(source: string, pattern: RegExp, what: string): string {
  const match = source.match(pattern);
  if (!match?.[1]) {
    throw new Error(
      `Could not extract ${what}. The source moved or was reworded; fix this ` +
        `extraction rather than deleting the assertion — an unextractable ` +
        `constraint is exactly the drift this guard exists to catch.`
    );
  }
  return match[1];
}

describe.skip('DE.5-UNIT-001: client validation mirrors match the events CHECK constraints', () => {
  it('mirrors the label length limit', () => {
    const dbLimit = capture(
      read(MIGRATION),
      /check\s*\(\s*char_length\(label\)\s*<=\s*(\d+)\s*\)/,
      "the label CHECK from the migration"
    );
    const uiLimit = capture(
      read(COMPONENT),
      /const LABEL_MAX_LENGTH = (\d+);/,
      'LABEL_MAX_LENGTH from EventsSettings.tsx'
    );

    expect(uiLimit).toBe(dbLimit);
  });

  it('mirrors the description length limit', () => {
    const dbLimit = capture(
      read(MIGRATION),
      /check\s*\(\s*char_length\(description\)\s*<=\s*(\d+)\s*\)/,
      'the description CHECK from the migration'
    );
    const uiLimit = capture(
      read(COMPONENT),
      /const DESCRIPTION_MAX_LENGTH = (\d+);/,
      'DESCRIPTION_MAX_LENGTH from EventsSettings.tsx'
    );

    expect(uiLimit).toBe(dbLimit);
  });

  it('offers exactly the icons the CHECK constraint admits', () => {
    const dbList = capture(
      read(MIGRATION),
      /check\s*\(\s*icon in \(([^)]*)\)\s*\)/,
      'the icon CHECK from the migration'
    );
    const dbIcons = [...dbList.matchAll(/'([a-z]+)'/g)].map((match) => match[1]).sort();

    const optionsBlock = capture(
      read(COMPONENT),
      /const ICON_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/,
      'the ICON_OPTIONS array from EventsSettings.tsx'
    );
    const uiIcons = [...optionsBlock.matchAll(/value: '([a-z]+)'/g)]
      .map((match) => match[1])
      .sort();

    // Set equality both ways: an icon the DB rejects would reach the user as raw
    // Postgres constraint text, and an icon the DB admits but the form omits is
    // a value only a partner's row can ever carry.
    expect(uiIcons).toEqual(dbIcons);
  });
});
