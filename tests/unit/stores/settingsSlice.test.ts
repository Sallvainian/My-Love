import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createSettingsSlice, type SettingsSlice } from '../../../src/stores/slices/settingsSlice';
import type { Settings } from '../../../src/types';

// Helper to create a test store
const createTestStore = () => {
  return create<SettingsSlice>()((...args) => createSettingsSlice(...args));
};

// Helper to get default valid settings
const getDefaultSettings = (): Settings => ({
  themeName: 'sunset',
  notificationTime: '09:00',
  relationship: {
    startDate: '2020-01-01',
    partnerName: 'Partner',
    anniversaries: [],
  },
  customization: {
    accentColor: '#ff6b9d',
    fontFamily: 'system-ui',
  },
  notifications: {
    enabled: true,
    time: '09:00',
  },
});

describe('settingsSlice Validation', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('setSettings() validation', () => {
    it('should reject invalid theme name', () => {
      const invalidSettings = {
        ...getDefaultSettings(),
        themeName: 'invalid_theme' as any,
      };

      expect(() => store.getState().setSettings(invalidSettings)).toThrow();
    });

    it('should reject missing partner name', () => {
      const invalidSettings = {
        ...getDefaultSettings(),
        relationship: {
          ...getDefaultSettings().relationship,
          partnerName: '', // Invalid: empty string
        },
      };

      expect(() => store.getState().setSettings(invalidSettings)).toThrow();
    });

    it('should reject invalid date format', () => {
      const invalidSettings = {
        ...getDefaultSettings(),
        relationship: {
          ...getDefaultSettings().relationship,
          startDate: 'invalid-date', // Invalid: not YYYY-MM-DD format
        },
      };

      expect(() => store.getState().setSettings(invalidSettings)).toThrow();
    });

    it('should reject invalid notification time format', () => {
      const invalidSettings = {
        ...getDefaultSettings(),
        notificationTime: '9:00', // Invalid: should be HH:MM format (09:00)
      };

      expect(() => store.getState().setSettings(invalidSettings)).toThrow();
    });

    it('should accept valid settings', () => {
      const validSettings: Settings = {
        themeName: 'ocean',
        notificationTime: '14:30',
        relationship: {
          startDate: '2020-06-15',
          partnerName: 'Jane Doe',
          anniversaries: [
            {
              id: 1,
              date: '2020-06-15',
              label: 'First Meeting',
              description: 'The day we met',
            },
          ],
        },
        customization: {
          accentColor: '#3b82f6',
          fontFamily: 'Inter',
        },
        notifications: {
          enabled: false,
          time: '08:00',
        },
      };

      expect(() => store.getState().setSettings(validSettings)).not.toThrow();
      expect(store.getState().settings).toEqual(validSettings);
    });
  });

  describe('updateSettings() validation', () => {
    beforeEach(() => {
      // Initialize with valid settings
      store.getState().setSettings(getDefaultSettings());
    });

    it('should reject invalid theme in update', () => {
      expect(() =>
        store.getState().updateSettings({ themeName: 'invalid' as any })
      ).toThrow();
    });

    it('should reject invalid partial update that breaks validation', () => {
      expect(() =>
        store.getState().updateSettings({
          relationship: {
            ...getDefaultSettings().relationship,
            partnerName: '', // Invalid: empty string
          },
        })
      ).toThrow();
    });

    it('should accept valid partial update', () => {
      const update = { themeName: 'lavender' as const };

      expect(() => store.getState().updateSettings(update)).not.toThrow();
      expect(store.getState().settings?.themeName).toBe('lavender');
    });

    it('should validate merged settings on update', () => {
      const update = {
        notificationTime: '16:45',
      };

      expect(() => store.getState().updateSettings(update)).not.toThrow();
      expect(store.getState().settings?.notificationTime).toBe('16:45');
    });
  });
});
