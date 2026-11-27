/**
 * What a snapshot says about nudges (src/services/dailyNudges.ts): the one
 * reader of `nudges` and of the legacy `nudge` by slot, the closing instant
 * check, and the per-source "stays sent" merge.
 */
import { describe, expect, it } from 'vitest';
import {
  hasNudgeClosed,
  isNudgeSent,
  keepNudgesSent,
  nudgeState,
  withNudgeSent,
} from '../../../src/services/dailyNudges';
import {
  NUDGE_CLOSES_AT,
  dailySnapshot,
  legacyNudgeSnapshot,
  nudgesSnapshot,
  waitingSnapshot,
} from '../stores/dailyQuestionFixture';

describe('nudgeState', () => {
  it('reads nudges: each source and the closing instant', () => {
    expect(nudgeState(nudgesSnapshot({ prompt: true, closesAt: '2026-11-06T10:00:00+00:00' }))).toEqual({
      promptSent: true,
      buttonSent: false,
      closesAt: '2026-11-06T10:00:00+00:00',
    });
    expect(nudgeState(nudgesSnapshot({ button: true, closesAt: null }))).toEqual({
      promptSent: false,
      buttonSent: true,
      closesAt: null,
    });
  });

  it('reads a day saved by the build before story 11.1 by slot, with no closing instant', () => {
    expect(nudgeState(legacyNudgeSnapshot('after_pick', true))).toEqual({
      promptSent: true,
      buttonSent: false,
      closesAt: null,
    });
    expect(nudgeState(legacyNudgeSnapshot('evening', true))).toEqual({
      promptSent: false,
      buttonSent: true,
      closesAt: null,
    });
  });

  it.each([
    ['a spent-less slot', legacyNudgeSnapshot('after_pick', false)],
    ['a null slot', legacyNudgeSnapshot(null, false)],
    ['a day with neither field', waitingSnapshot('this')],
    ['a day nobody picked on', dailySnapshot()],
  ])('reads %s as nothing sent and no closing instant', (_label, snapshot) => {
    expect(nudgeState(snapshot)).toEqual({ promptSent: false, buttonSent: false, closesAt: null });
  });

  it('reads no snapshot as nothing sent', () => {
    expect(nudgeState(null)).toEqual({ promptSent: false, buttonSent: false, closesAt: null });
    expect(nudgeState(undefined)).toEqual({ promptSent: false, buttonSent: false, closesAt: null });
  });

  it('prefers nudges to the legacy nudge', () => {
    const both = { ...legacyNudgeSnapshot('after_pick', true), ...nudgesSnapshot() };
    expect(nudgeState(both).promptSent).toBe(false);
  });
});

describe('isNudgeSent', () => {
  it('picks the source', () => {
    const state = nudgeState(nudgesSnapshot({ prompt: true }));
    expect(isNudgeSent(state, 'prompt')).toBe(true);
    expect(isNudgeSent(state, 'button')).toBe(false);
  });
});

describe('hasNudgeClosed', () => {
  const at = Date.parse('2026-11-06T10:00:00+00:00');

  it('is false before the instant and true from it on', () => {
    expect(hasNudgeClosed('2026-11-06T10:00:00+00:00', at - 1)).toBe(false);
    expect(hasNudgeClosed('2026-11-06T10:00:00+00:00', at)).toBe(true);
    expect(hasNudgeClosed('2026-11-06T10:00:00+00:00', at + 1)).toBe(true);
  });

  it('reads an offset instant as the instant it is', () => {
    expect(hasNudgeClosed('2026-11-06T00:00:00-10:00', at - 1)).toBe(false);
    expect(hasNudgeClosed('2026-11-06T00:00:00-10:00', at)).toBe(true);
  });

  it('never closes with no instant, or one that cannot be read', () => {
    expect(hasNudgeClosed(null, Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(hasNudgeClosed('not a time', Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe('withNudgeSent', () => {
  it('marks the source sent and keeps the other and the closing instant', () => {
    expect(withNudgeSent(nudgesSnapshot({ button: true }), 'prompt')).toEqual(
      nudgesSnapshot({ prompt: true, button: true })
    );
  });

  it('reads a legacy day by slot first, so its sent slot is not lost', () => {
    expect(withNudgeSent(legacyNudgeSnapshot('evening', true), 'prompt')).toMatchObject({
      nudges: { prompt_sent: true, button_sent: true, closes_at: null },
    });
  });
});

describe('keepNudgesSent', () => {
  it('sets a source sent when the other has it', () => {
    expect(keepNudgesSent(nudgesSnapshot(), nudgesSnapshot({ prompt: true }))).toEqual(
      nudgesSnapshot({ prompt: true })
    );
    expect(keepNudgesSent(nudgesSnapshot(), nudgesSnapshot({ button: true }))).toEqual(
      nudgesSnapshot({ button: true })
    );
  });

  it('keeps the sources apart and takes both when each has one', () => {
    expect(keepNudgesSent(nudgesSnapshot({ prompt: true }), nudgesSnapshot({ button: true }))).toEqual(
      nudgesSnapshot({ prompt: true, button: true })
    );
  });

  it("keeps the entry's closing instant, null included", () => {
    const entry = nudgesSnapshot({ closesAt: null });
    expect(keepNudgesSent(entry, nudgesSnapshot({ prompt: true }))).toEqual(
      nudgesSnapshot({ prompt: true, closesAt: null })
    );
    const later = nudgesSnapshot({ closesAt: '2026-11-08T00:00:00+00:00' });
    expect(keepNudgesSent(later, nudgesSnapshot({ prompt: true })).nudges?.closes_at).toBe(
      '2026-11-08T00:00:00+00:00'
    );
  });

  it.each([
    ['an other with nothing sent', nudgesSnapshot({ prompt: true }), nudgesSnapshot()],
    ['an other with the same sent', nudgesSnapshot({ prompt: true }), nudgesSnapshot({ prompt: true })],
    ['no other', nudgesSnapshot(), undefined],
    ['an other with no nudge fields', nudgesSnapshot(), waitingSnapshot('this')],
  ])('leaves the entry as it is for %s', (_label, entry, other) => {
    expect(keepNudgesSent(entry, other)).toBe(entry);
  });

  it('leaves an entry with no nudge fields as it is when the other sent nothing', () => {
    const entry = waitingSnapshot('this');
    expect(keepNudgesSent(entry, nudgesSnapshot())).toEqual({
      ...entry,
      nudges: { prompt_sent: false, button_sent: false, closes_at: NUDGE_CLOSES_AT },
    });
    expect(keepNudgesSent(entry, waitingSnapshot('this'))).toBe(entry);
  });

  it("takes the other's closing instant when the entry carries no nudges (a saved legacy day kept)", () => {
    const entry = legacyNudgeSnapshot('after_pick', true);
    expect(keepNudgesSent(entry, nudgesSnapshot({ button: true }))).toMatchObject({
      nudges: { prompt_sent: true, button_sent: true, closes_at: NUDGE_CLOSES_AT },
    });
  });

  it('reads the entry by slot, so a legacy sent source survives an other that has none', () => {
    const entry = legacyNudgeSnapshot('evening', true);
    expect(keepNudgesSent(entry, nudgesSnapshot())).toMatchObject({
      nudges: { prompt_sent: false, button_sent: true },
    });
  });
});
