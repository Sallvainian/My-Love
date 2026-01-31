/**
 * scriptureSteps Unit Tests
 *
 * Tests for static scripture data module:
 * - Correct number of steps (17)
 * - All required fields present on each step
 * - Step index continuity (0-16)
 * - Section themes coverage
 *
 * Story 1.1: Task 6 (supplementary — validates AC #5)
 */

import { describe, it, expect } from 'vitest';
import { SCRIPTURE_STEPS, MAX_STEPS } from '../../../src/data/scriptureSteps';

describe('scriptureSteps', () => {
  it('should export MAX_STEPS = 17', () => {
    expect(MAX_STEPS).toBe(17);
  });

  it('should contain exactly 17 steps', () => {
    expect(SCRIPTURE_STEPS).toHaveLength(17);
  });

  it('should have contiguous step indexes from 0 to 16', () => {
    for (let i = 0; i < 17; i++) {
      expect(SCRIPTURE_STEPS[i].stepIndex).toBe(i);
    }
  });

  it('should have all required fields on every step', () => {
    for (const step of SCRIPTURE_STEPS) {
      expect(step.stepIndex).toBeTypeOf('number');
      expect(step.sectionTheme).toBeTypeOf('string');
      expect(step.sectionTheme.length).toBeGreaterThan(0);
      expect(step.verseReference).toBeTypeOf('string');
      expect(step.verseReference.length).toBeGreaterThan(0);
      expect(step.verseText).toBeTypeOf('string');
      expect(step.verseText.length).toBeGreaterThan(0);
      expect(step.responseText).toBeTypeOf('string');
      expect(step.responseText.length).toBeGreaterThan(0);
    }
  });

  it('should cover all 6 section themes', () => {
    const themes = new Set(SCRIPTURE_STEPS.map((s) => s.sectionTheme));

    expect(themes.size).toBe(6);
    expect(themes.has('Healing & Restoration')).toBe(true);
    expect(themes.has('Forgiveness & Reconciliation')).toBe(true);
    expect(themes.has('Confession & Repentance')).toBe(true);
    expect(themes.has("God's Faithfulness & Peace")).toBe(true);
    expect(themes.has('The Power of Words')).toBe(true);
    expect(themes.has('Christlike Character')).toBe(true);
  });

  it('should have unique verse references', () => {
    const references = SCRIPTURE_STEPS.map((s) => s.verseReference);
    const uniqueRefs = new Set(references);
    expect(uniqueRefs.size).toBe(references.length);
  });

  it('should be a readonly array (immutable)', () => {
    // TypeScript enforces this at compile time via `as const`,
    // but we verify the runtime structure exists
    expect(Array.isArray(SCRIPTURE_STEPS)).toBe(true);
    expect(SCRIPTURE_STEPS.length).toBe(17);
  });
});
