/**
 * Persisted state — anniversaries never live in the device-global blob
 *
 * Anniversaries are account data. Their saved copy is the per-account local
 * copy (`services/localCopy.ts`, kind `anniversaries`), so `partialize` writes
 * `settings.relationship.anniversaries` as `[]`, and the storage adapter blanks
 * a non-empty list in a blob written before that move — without bumping the
 * persist version the E2E auth fixtures pin.
 *
 * The retired anniversary vault kept each signed-out account's list under a
 * device-global localStorage key; both of its keys are removed on load. Its
 * owner marker seeds the new device-owner marker, so a no-session boot right
 * after the upgrade still knows whose saved data to delete.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'my-love-storage';
const VAULT_KEY = 'my-love-anniversary-vault';
const OLD_OWNER_KEY = 'my-love-anniversary-owner';
const OWNER_KEY = 'my-love-account-owner';

const SECRET_LABEL = 'PREVIOUS-ACCOUNT-ANNIVERSARY';

const SETTINGS_WITH_ANNIVERSARIES = {
  notificationTime: '09:00',
  relationship: {
    startDate: '2020-01-01',
    partnerName: 'A',
    anniversaries: [{ id: 1, date: '2020-02-14', label: SECRET_LABEL, serverId: 'srv-1' }],
  },
  notifications: { enabled: true, time: '09:00' },
};

function oldBlob(): string {
  return JSON.stringify({
    version: 0,
    state: {
      isOnboarded: true,
      settings: SETTINGS_WITH_ANNIVERSARIES,
      messageHistory: { shownMessages: [['2026-07-26', 3]], currentIndex: 7 },
    },
  });
}

async function loadStore() {
  vi.resetModules();
  const { useAppStore } = await import('@/stores/useAppStore');
  return useAppStore;
}

describe('anniversaries in the persisted blob', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('blanks an old blob’s anniversaries on load, keeping the rest of settings', async () => {
    localStorage.setItem(STORAGE_KEY, oldBlob());

    const useAppStore = await loadStore();
    const settings = useAppStore.getState().settings!;

    // The rest of the blob survives; its removed couple and notification keys
    // are stripped on the same load.
    expect(settings).toEqual({ relationship: { anniversaries: [] } });
    expect(useAppStore.getState().messageHistory.currentIndex).toBe(7);
  });

  it('writes anniversaries as [] even while they are in memory, at persist version 0', async () => {
    const useAppStore = await loadStore();
    const settings = useAppStore.getState().settings!;

    useAppStore.setState({
      settings: {
        ...settings,
        relationship: {
          ...settings.relationship,
          anniversaries: SETTINGS_WITH_ANNIVERSARIES.relationship.anniversaries,
        },
      },
    });

    // In memory for Home and Settings…
    expect(useAppStore.getState().settings!.relationship.anniversaries).toHaveLength(1);
    // …but never on disk.
    const raw = localStorage.getItem(STORAGE_KEY)!;
    expect(raw).not.toContain(SECRET_LABEL);
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(0);
    expect(parsed.state.settings.relationship.anniversaries).toEqual([]);
  });
});

describe('the retired anniversary vault', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('removes both vault keys on load', async () => {
    localStorage.setItem(
      VAULT_KEY,
      JSON.stringify({ 'USER-B': [{ id: 1, date: '2020-02-14', label: SECRET_LABEL }] })
    );
    localStorage.setItem(OLD_OWNER_KEY, 'USER-A');

    await loadStore();

    expect(localStorage.getItem(VAULT_KEY)).toBeNull();
    expect(localStorage.getItem(OLD_OWNER_KEY)).toBeNull();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(localStorage.getItem(key), key).not.toContain(SECRET_LABEL);
    }
  });

  it('carries the old owner marker over to the device-owner marker', async () => {
    localStorage.setItem(OLD_OWNER_KEY, 'USER-A');

    await loadStore();

    expect(localStorage.getItem(OWNER_KEY)).toBe('USER-A');
  });

  it('never overwrites a device-owner marker that is already set', async () => {
    localStorage.setItem(OLD_OWNER_KEY, 'USER-A');
    localStorage.setItem(OWNER_KEY, 'USER-B');

    await loadStore();

    expect(localStorage.getItem(OWNER_KEY)).toBe('USER-B');
  });
});
