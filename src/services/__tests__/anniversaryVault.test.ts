/**
 * The vault's contract is what makes the auth-slice wiring safe:
 * - `take` POPS — a second take finds nothing, which is what keeps a plain
 *   app boot (INITIAL_SESSION with no intervening sign-out) from overwriting
 *   a live persisted list with a stale stash.
 * - `null` means "no entry" and is distinct from a stashed empty list.
 * - Corrupt storage degrades to empty instead of throwing into sign-out.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Anniversary } from '../../types';
import {
  OWNER_STORAGE_KEY,
  VAULT_STORAGE_KEY,
  getAnniversaryOwner,
  setAnniversaryOwner,
  stashAnniversaries,
  takeAnniversaries,
} from '../anniversaryVault';

const FIRST_KISS: Anniversary = { id: 1, date: '2025-11-26', label: 'First kiss' };

describe('anniversaryVault', () => {
  beforeEach(() => {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(OWNER_STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(OWNER_STORAGE_KEY);
  });

  it('records and clears the owner marker', () => {
    setAnniversaryOwner('user-a');
    expect(getAnniversaryOwner()).toBe('user-a');

    setAnniversaryOwner(null);
    expect(getAnniversaryOwner()).toBeNull();
  });

  it('round-trips a stashed list back to the same user', () => {
    stashAnniversaries('user-a', [FIRST_KISS]);

    expect(takeAnniversaries('user-a')).toEqual([FIRST_KISS]);
  });

  it('pops on take — a second take finds nothing', () => {
    stashAnniversaries('user-a', [FIRST_KISS]);

    takeAnniversaries('user-a');

    expect(takeAnniversaries('user-a')).toBeNull();
  });

  it('returns null for a user with no entry', () => {
    expect(takeAnniversaries('never-stashed')).toBeNull();
  });

  it('distinguishes a stashed empty list from no entry', () => {
    stashAnniversaries('user-a', []);

    expect(takeAnniversaries('user-a')).toEqual([]);
  });

  it('keeps entries separated by user', () => {
    const other: Anniversary = { id: 2, date: '2024-06-01', label: 'Wedding' };
    stashAnniversaries('user-a', [FIRST_KISS]);
    stashAnniversaries('user-b', [other]);

    expect(takeAnniversaries('user-b')).toEqual([other]);
    expect(takeAnniversaries('user-a')).toEqual([FIRST_KISS]);
  });

  it('treats an unreadable vault as empty instead of throwing', () => {
    localStorage.setItem(VAULT_STORAGE_KEY, 'not json at all');

    expect(takeAnniversaries('user-a')).toBeNull();

    // …and it recovers: the next stash starts a fresh vault.
    stashAnniversaries('user-a', [FIRST_KISS]);
    expect(takeAnniversaries('user-a')).toEqual([FIRST_KISS]);
  });

  it('drops entries that fail schema validation rather than restoring them', () => {
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({
        'user-a': [FIRST_KISS, { id: 'not-a-number', date: 'junk', label: '' }, 'garbage'],
      })
    );

    expect(takeAnniversaries('user-a')).toEqual([FIRST_KISS]);
  });
});
