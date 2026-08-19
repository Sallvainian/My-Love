import type { Anniversary } from '../types';
import { AnniversarySchema } from '../validation/schemas';
import { logger } from '../utils/logger';

/**
 * Per-user sign-out stash for anniversaries.
 *
 * Anniversaries live only in `settings`, which `partialize` persists under one
 * device-global key and no service ever fetches — so the sign-out reset that
 * keeps them off the next account's screen would also be the one place
 * sign-out destroys data with no copy to re-derive from. Sign-out stashes the
 * outgoing user's list here instead, keyed by their userId, and their next
 * sign-in pops it back. Other accounts never read another user's entry.
 *
 * `take` POPS the entry — that is what makes the boot-with-live-session path
 * safe: INITIAL_SESSION restores only when this user's previous session ended
 * in a sign-out (the only writer), never overwriting a live persisted list
 * with a stale stash.
 *
 * Storage failures degrade to the pre-vault behavior (clear without stash):
 * reads return null, writes are dropped, nothing throws. Two bounded gaps,
 * both needing a storage that fails a write and later recovers: a failed pop
 * deletion can leave a consumed entry behind for a future boot to re-pop, and
 * a failed owner write at a sign-in transition can leave the marker naming
 * the previous user, mis-keying a later no-session-boot stash.
 *
 * The owner marker records whose list is live in `settings`: a boot with no
 * recoverable session reaches clearAuth with userId never populated, and the
 * marker is what lets that path stash the list instead of destroying it.
 */

export const VAULT_STORAGE_KEY = 'my-love-anniversary-vault';
export const OWNER_STORAGE_KEY = 'my-love-anniversary-owner';

/** Record which user's anniversaries are live in settings (null clears it). */
export function setAnniversaryOwner(userId: string | null): void {
  try {
    if (userId === null) localStorage.removeItem(OWNER_STORAGE_KEY);
    else localStorage.setItem(OWNER_STORAGE_KEY, userId);
  } catch (error) {
    logger.debug('[AnniversaryVault] Owner write failed:', error);
  }
}

export function getAnniversaryOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readVault(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch (error) {
    logger.debug('[AnniversaryVault] Unreadable vault, treating as empty:', error);
    return {};
  }
}

function writeVault(vault: Record<string, unknown>): void {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch (error) {
    logger.debug('[AnniversaryVault] Write failed, entry dropped:', error);
  }
}

/** Store the outgoing user's list, replacing any previous entry for them. */
export function stashAnniversaries(userId: string, anniversaries: Anniversary[]): void {
  const vault = readVault();
  vault[userId] = anniversaries;
  writeVault(vault);
}

/**
 * Pop this user's stashed list. `null` means no entry — the caller keeps
 * whatever is live, which is how a boot without an intervening sign-out
 * leaves the persisted settings untouched. Entries that fail schema
 * validation are dropped rather than restored.
 */
export function takeAnniversaries(userId: string): Anniversary[] | null {
  const vault = readVault();
  if (!(userId in vault)) return null;

  const entry = vault[userId];
  delete vault[userId];
  writeVault(vault);

  if (!Array.isArray(entry)) return null;
  const valid: Anniversary[] = [];
  for (const item of entry) {
    const result = AnniversarySchema.safeParse(item);
    if (result.success) valid.push(result.data);
  }
  return valid;
}
