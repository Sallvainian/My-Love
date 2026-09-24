/**
 * Settings — "Download photos over mobile data": a per-device switch, default
 * off, saved in localStorage and read by the background photo fill. Its helper
 * text depends on whether the browser reports the connection type.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({
  lookupOwnDisplayName: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  lookupOwnDisplayName: backend.lookupOwnDisplayName,
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../api/authService', () => ({
  authService: { getUser: backend.getUser, signOut: backend.signOut },
}));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: MotionDivProps) => {
      const { initial: _i, animate: _a, exit: _e, ...rest } = props as Record<string, unknown>;
      return <div {...(rest as HTMLAttributes<HTMLDivElement>)}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import {
  PHOTOS_OVER_MOBILE_DATA_KEY,
  getPhotosOverMobileData,
  setPhotosOverMobileData,
} from '../../../services/photoDownloadPreference';
import { Settings } from '../Settings';

const WIFI_HELPER = 'Off: the photo album is saved for offline use only on Wi-Fi.';
const UNKNOWN_HELPER =
  "This phone doesn't tell the app whether it's on Wi-Fi, so photos are saved on any connection.";

function setConnection(connection: object | undefined) {
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
}

async function renderSettings() {
  render(<Settings />);
  await waitFor(() =>
    expect(screen.getByTestId('settings-display-name').textContent).toBe('Jessie')
  );
}

describe('Settings: Download photos over mobile data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    backend.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Jessie' });
    act(() => setPhotosOverMobileData(false));
    localStorage.removeItem(PHOTOS_OVER_MOBILE_DATA_KEY);
  });

  afterEach(() => {
    cleanup();
    setConnection(undefined);
    vi.restoreAllMocks();
  });

  it('is an off switch labelled with the Wi-Fi helper when the phone reports its connection', async () => {
    setConnection(Object.assign(new EventTarget(), { type: 'wifi' }));
    await renderSettings();

    const row = screen.getByRole('switch', { name: 'Download photos over mobile data' });
    expect(row).toHaveAttribute('aria-checked', 'false');
    expect(row).toHaveAccessibleDescription(WIFI_HELPER);
    expect(screen.getByTestId('settings-mobile-data-photos-helper').textContent).toBe(WIFI_HELPER);
  });

  it("says photos are saved on any connection when the browser can't tell", async () => {
    setConnection(undefined);
    await renderSettings();

    const row = screen.getByRole('switch', { name: 'Download photos over mobile data' });
    expect(row).toHaveAccessibleDescription(UNKNOWN_HELPER);
  });

  it("treats a reported type of 'unknown' like no type at all", async () => {
    setConnection(Object.assign(new EventTarget(), { type: 'unknown' }));
    await renderSettings();

    expect(screen.getByTestId('settings-mobile-data-photos-helper').textContent).toBe(
      UNKNOWN_HELPER
    );
  });

  it('toggles and saves the choice on this device', async () => {
    setConnection(Object.assign(new EventTarget(), { type: 'cellular' }));
    await renderSettings();
    const row = screen.getByRole('switch', { name: 'Download photos over mobile data' });

    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem(PHOTOS_OVER_MOBILE_DATA_KEY)).toBe('true');
    expect(getPhotosOverMobileData()).toBe(true);

    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem(PHOTOS_OVER_MOBILE_DATA_KEY)).toBe('false');
    expect(getPhotosOverMobileData()).toBe(false);
  });

  it('shows the saved choice when the page opens again', async () => {
    act(() => setPhotosOverMobileData(true));
    await renderSettings();

    expect(
      screen.getByRole('switch', { name: 'Download photos over mobile data' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('is a native button, so Enter and Space reach it from the keyboard', async () => {
    await renderSettings();
    const row = screen.getByRole('switch', { name: 'Download photos over mobile data' });

    expect(row.tagName).toBe('BUTTON');
    expect(row).toHaveAttribute('type', 'button');
    row.focus();
    expect(row).toHaveFocus();
  });
});
