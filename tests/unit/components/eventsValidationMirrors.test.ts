/**
 * DE.5-UNIT-001 [P1], risk R-007: form declarations mirror the shared contract.
 * The pgTAP companion compares that contract with every installed events CHECK
 * after all migrations. Ordinary unit tests need no database. Actual submission
 * boundaries are covered in EventsSettings.test.tsx, independently of constants.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractEventsFormDeclarations,
  extractEventsValidationContract,
} from '../../support/eventsValidationContract';

const contract = extractEventsValidationContract(
  readFileSync(join(process.cwd(), 'supabase/tests/database/21_events_validation_contract.sql'), 'utf8')
);
const declarations = extractEventsFormDeclarations(
  readFileSync(join(process.cwd(), 'src/components/Settings/EventsSettings.tsx'), 'utf8')
);

function formSource(options: string): string {
  return `
    const LABEL_MAX_LENGTH = 100;
    const DESCRIPTION_MAX_LENGTH = 500;
    const ICON_OPTIONS = ${options};
  `;
}

function contractSource(value: unknown): string {
  return `$events_validation_contract$${JSON.stringify(value)}$events_validation_contract$`;
}

describe('DE.5-UNIT-001: client validation mirrors the events CHECK contract', () => {
  it('mirrors the label length limit', () => {
    expect(declarations.labelMaxLength).toBe(contract.labelMaxLength);
  });

  it('mirrors the description length limit', () => {
    expect(declarations.descriptionMaxLength).toBe(contract.descriptionMaxLength);
  });

  it('offers exactly the icons the CHECK contract admits', () => {
    expect([...declarations.icons].sort()).toEqual([...contract.icons].sort());
  });
});

describe('complete validation literal extraction', () => {
  const unusualIcons = ['party-hat', 'UPPER', 'icon2', 'under_score', "couple's", 'say "hi"', 'a\\b'];

  it('retains complete JSON and TypeScript icon strings, including escaped quotes', () => {
    const expected = { ...contract, icons: unusualIcons };
    const sql = contractSource(expected);
    const source = formSource(String.raw`[
      { value: 'party-hat' }, { value: 'UPPER' }, { value: 'icon2' },
      { 'value': 'under_score' }, { value: 'couple\'s' },
      { value: "say \"hi\"" }, { value: 'a\\b' }
    ]`);
    expect(extractEventsValidationContract(sql)).toEqual(expected);
    expect(extractEventsFormDeclarations(source)).toEqual(expected);
  });

  it('decodes Unicode escapes without truncating a value', () => {
    expect(extractEventsFormDeclarations(formSource(String.raw`[{ value: '\u0070arty-hat' }]`)).icons)
      .toEqual(['party-hat']);
  });

  it.each(unusualIcons)('detects a UI-only or database-contract-only icon: %s', (icon) => {
    const icons = [...contract.icons, icon];
    const options = JSON.stringify(icons.map((value) => ({ value })));
    const ui = extractEventsFormDeclarations(formSource(options));
    const database = extractEventsValidationContract(contractSource({ ...contract, icons }));
    expect(ui.icons).toEqual(icons);
    expect(database.icons).toEqual(icons);
    expect([...ui.icons].sort()).not.toEqual([...contract.icons].sort());
    expect([...declarations.icons].sort()).not.toEqual([...database.icons].sort());
  });

  it.each([
    ['computed array', 'makeOptions()'],
    ['array spread', '[...extraOptions]'],
    ['array hole', '[, { value: "ring" }]'],
    ['object spread', '[{ value: "ring", ...override }]'],
    ['computed property', '[{ ["value"]: "ring" }]'],
    ['shorthand property', '[{ value }]'],
    ['getter', '[{ get value() { return "ring"; } }]'],
    ['missing value', '[{ label: "Ring" }]'],
    ['duplicate value', '[{ value: "ring", value: "plane" }]'],
    ['expression value', '[{ value: "party" + "-hat" }]'],
    ['identifier value', '[{ value: icon }]'],
    ['template expression', '[{ value: `party-${kind}` }]'],
    ['non-string value', '[{ value: 12 }]'],
  ])('fails explicitly for unsupported icons: %s', (_name, options) => {
    expect(() => extractEventsFormDeclarations(formSource(options))).toThrow(/Unsupported ICON_OPTIONS/);
  });

  it.each([
    ['empty icons', '[]', /Too small: expected array to have >=1 items/],
    ['duplicate icons', '[{ value: "ring" }, { value: "ring" }]', /Icon values must be unique/],
  ])('rejects invalid icon contracts: %s', (_name, options, expectedError) => {
    expect(() => extractEventsFormDeclarations(formSource(options))).toThrow(expectedError);
  });

  it.each([
    ['missing declaration', ''],
    ['duplicate declaration', 'const LABEL_MAX_LENGTH = 100; const LABEL_MAX_LENGTH = 100;'],
    ['mutable declaration', 'let LABEL_MAX_LENGTH = 100;'],
    ['uninitialized declaration', 'const LABEL_MAX_LENGTH;'],
    ['expression limit', 'const LABEL_MAX_LENGTH = 50 + 50;'],
    ['string limit', 'const LABEL_MAX_LENGTH = "100";'],
  ])('fails explicitly for unsupported limits: %s', (_name, declaration) => {
    const source = formSource('[{ value: "ring" }]').replace('const LABEL_MAX_LENGTH = 100;', declaration);
    expect(() => extractEventsFormDeclarations(source)).toThrow(/LABEL_MAX_LENGTH/);
  });

  it('rejects malformed TypeScript instead of recovering a partial value', () => {
    expect(() => extractEventsFormDeclarations(formSource(String.raw`[{ value: '\uQQQQ' }]`)))
      .toThrow(/Could not parse EventsSettings/);
  });

  const missingOrDuplicateTag = 'Expected exactly one tagged events validation contract in the pgTAP SQL';

  it.each([
    ['missing tag', '{}', missingOrDuplicateTag],
    ['duplicate tag', `${contractSource(contract)}\n${contractSource(contract)}`, missingOrDuplicateTag],
    ['malformed JSON', '$events_validation_contract${bad}$events_validation_contract$', SyntaxError],
    ['string limit', contractSource({ ...contract, labelMaxLength: '100' }), /expected number, received string/],
    ['non-string icon', contractSource({ ...contract, icons: ['ring', 42] }), /expected string, received number/],
    ['empty icons', contractSource({ ...contract, icons: [] }), /Too small: expected array to have >=1 items/],
    ['duplicate icons', contractSource({ ...contract, icons: ['ring', 'ring'] }), /Icon values must be unique/],
    ['unknown shape', contractSource({ ...contract, additionalCheck: 'true' }), /unrecognized_keys/],
  ] as const)('fails explicitly for an unsupported shared contract: %s', (_name, sql, expectedError) => {
    expect(() => extractEventsValidationContract(sql)).toThrow(expectedError);
  });
});
