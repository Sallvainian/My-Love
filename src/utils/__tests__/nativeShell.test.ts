/**
 * markNativeShell: `data-native` on <html>, which index.css uses to hide every
 * scroll bar, is set inside the iOS shell only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markNativeShell } from '../nativeShell';

const capacitor = vi.hoisted(() => ({ isNativePlatform: vi.fn(() => false) }));
vi.mock('@capacitor/core', () => ({ Capacitor: capacitor }));

beforeEach(() => {
  document.documentElement.removeAttribute('data-native');
});

describe('markNativeShell', () => {
  it('marks <html> inside the native shell', () => {
    capacitor.isNativePlatform.mockReturnValue(true);

    markNativeShell(document.documentElement);

    expect(document.documentElement).toHaveAttribute('data-native');
  });

  it('leaves the website unmarked', () => {
    capacitor.isNativePlatform.mockReturnValue(false);

    markNativeShell(document.documentElement);

    expect(document.documentElement).not.toHaveAttribute('data-native');
  });
});
