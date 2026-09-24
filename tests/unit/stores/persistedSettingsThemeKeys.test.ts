/**
 * Persisted state — the removed theme system's settings keys do not come back
 *
 * `settings.themeName` and `settings.customization` belonged to the pre-kit
 * theme system, which nothing reads any more. `SettingsSchema` is not strict,
 * so a blob saved before the removal still parses with them inside, and
 * because Zustand replaces `settings` whole from the blob, every later write
 * would carry them forward. The storage adapter drops them from `settings` on
 * the way in (`STALE_PERSISTED_SETTINGS_KEYS` in `useAppStore.ts`), without
 * bumping the persist version the E2E auth fixtures pin.
 *
 * The same holds for the settings the couple-settings move retired
 * (spec-unified-data-storage story 3): `notificationTime` and `notifications`
 * (read by nothing), and `relationship.startDate` / `relationship.partnerName`
 * (hard-coded defaults, replaced by the server-held `coupleSettings` and
 * `partner.displayName`). An old device's blob carries all four; they are
 * stripped on load and the blob still parses.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'my-love-storage';

/** Settings as the current build writes them, shaped to pass `SettingsSchema`. */
const CURRENT_SETTINGS = {
  relationship: {
    anniversaries: [{ id: 1, date: '2020-02-14', label: 'First date', serverId: 'srv-1' }],
  },
};

/** Settings as a build before the couple-settings move wrote them. */
const PRE_COUPLE_SETTINGS = {
  notificationTime: '21:30',
  relationship: {
    ...CURRENT_SETTINGS.relationship,
    startDate: '2020-01-01',
    partnerName: 'A',
  },
  notifications: { enabled: false, time: '21:30' },
};

/**
 * What survives: everything but the two theme keys — and the anniversaries,
 * which are blanked on the way in because they live in the per-account local
 * copy now (`persistedAnniversaries.test.ts`).
 */
const EXPECTED_SETTINGS = {
  ...CURRENT_SETTINGS,
  relationship: { ...CURRENT_SETTINGS.relationship, anniversaries: [] },
};

/** A blob saved by a build that still had the theme system. */
function legacyBlob(base: object = CURRENT_SETTINGS): string {
  return JSON.stringify({
    version: 0,
    state: {
      isOnboarded: true,
      settings: {
        ...base,
        themeName: 'ocean',
        customization: { accentColor: '#ff8888', fontFamily: 'serif' },
      },
      messageHistory: { shownMessages: [['2026-07-26', 3]], currentIndex: 7 },
    },
  });
}

async function hydrateFrom(raw: string) {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, raw);

  vi.resetModules();
  const { useAppStore } = await import('@/stores/useAppStore');
  return useAppStore;
}

describe('persisted settings from the removed theme system', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('rehydrates without themeName or customization, and the rest of settings intact', async () => {
    const useAppStore = await hydrateFrom(legacyBlob());
    const settings = useAppStore.getState().settings;

    // Exact equality: the two keys are gone and nothing else was lost or reset
    // to a default on the way.
    expect(settings).toEqual(EXPECTED_SETTINGS);
    expect(settings).not.toHaveProperty('themeName');
    expect(settings).not.toHaveProperty('customization');

    // Stripping inside `settings` must not look like corruption to the adapter.
    expect(useAppStore.getState().isOnboarded).toBe(true);
    expect(useAppStore.getState().messageHistory.currentIndex).toBe(7);
  });

  it('leaves them out of the next write, at the same persist version', async () => {
    const useAppStore = await hydrateFrom(legacyBlob());

    // Hydration alone does not rewrite the key, so drive a persist.
    useAppStore.setState({ isOnboarded: true });

    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);

    expect(parsed.version).toBe(0);
    expect(parsed.state.settings).toEqual(EXPECTED_SETTINGS);
  });

  it('rehydrates an old device without the start date, partner name or notification keys', async () => {
    const useAppStore = await hydrateFrom(legacyBlob(PRE_COUPLE_SETTINGS));
    const settings = useAppStore.getState().settings;

    expect(settings).toEqual(EXPECTED_SETTINGS);
    expect(settings).not.toHaveProperty('notificationTime');
    expect(settings).not.toHaveProperty('notifications');
    expect(settings?.relationship).not.toHaveProperty('startDate');
    expect(settings?.relationship).not.toHaveProperty('partnerName');
    // The blob still parsed: nothing else was reset.
    expect(useAppStore.getState().messageHistory.currentIndex).toBe(7);

    useAppStore.setState({ isOnboarded: true });
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(parsed.version).toBe(0);
    expect(parsed.state.settings).toEqual(EXPECTED_SETTINGS);
  });

  it('drops only a non-object settings value, keeping the rest of the blob', async () => {
    const useAppStore = await hydrateFrom(
      JSON.stringify({
        version: 0,
        state: {
          isOnboarded: true,
          settings: 'corrupt',
          messageHistory: { shownMessages: [['2026-07-26', 3]], currentIndex: 7 },
        },
      })
    );

    expect(useAppStore.getState().isOnboarded).toBe(true);
    expect(useAppStore.getState().messageHistory.currentIndex).toBe(7);
  });
});
