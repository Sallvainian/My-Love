/**
 * Text fields are 16px, never smaller.
 *
 * iOS zooms the whole page in when a field under 16px is focused and leaves it
 * zoomed, so the page can then be dragged sideways and out of frame. The
 * shared field class and the one-off fields each carry their own size, so each
 * is checked here.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldClass } from '../kitClasses';

const SMALL_TEXT = /\btext-(?:\[(?:[0-9]|1[0-5])px\]|(?:xs|sm)\b)/;

describe('text field font size', () => {
  it.each([
    ['single-line', false, false],
    ['single-line with an error', true, false],
    ['multiline', false, true],
  ])('fieldClass (%s) is 16px', (_name, hasError, multiline) => {
    const classes = fieldClass(hasError, multiline);
    expect(classes.split(/\s+/)).toContain('text-base');
    expect(classes).not.toMatch(SMALL_TEXT);
  });

  it.each([
    'src/components/love-notes/MessageInput.tsx',
    'src/components/PartnerMoodView/PartnerMoodView.tsx',
    'src/components/MoodTracker/MoodTracker.tsx',
    'src/components/PhotoUpload/PhotoUpload.tsx',
  ])('%s styles no field smaller than 16px', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');
    const fieldClasses = [...source.matchAll(/className=["`{][^\n]*\bbg-(?:field|card)\b[^\n]*/g)]
      .map((match) => match[0])
      .filter((line) => /\b(?:resize-none|placeholder:)/.test(line));
    expect(fieldClasses.length).toBeGreaterThan(0);
    for (const line of fieldClasses) {
      expect(line).not.toMatch(SMALL_TEXT);
    }
  });
});
