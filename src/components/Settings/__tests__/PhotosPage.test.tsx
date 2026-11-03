/**
 * PhotosPage: this device's photo-download choice as two radios, saved on
 * change. A device preference, so it needs no connection: choosing while
 * offline saves it and sends no request.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHOTOS_OVER_MOBILE_DATA_KEY,
  getPhotosOverMobileData,
  photoDownloadLabel,
  setPhotosOverMobileData,
} from '../../../services/photoDownloadPreference';
import { PhotosPage } from '../PhotosPage';

// The page labels its group by the h1 the stack renders; stand one in.
function renderPage() {
  return render(
    <>
      <h1 id="settings-title">Photos</h1>
      <PhotosPage />
    </>
  );
}

describe('PhotosPage', () => {
  beforeEach(() => {
    act(() => setPhotosOverMobileData(false));
    localStorage.removeItem(PHOTOS_OVER_MOBILE_DATA_KEY);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('names the two choices', () => {
    expect(photoDownloadLabel(false)).toBe('Wi-Fi only');
    expect(photoDownloadLabel(true)).toBe('Any connection');
  });

  it('is one group named by the page title with a radio for each choice', () => {
    renderPage();

    const group = screen.getByRole('radiogroup', { name: 'Photos' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Wi-Fi only' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Any connection' })).toBeInTheDocument();
  });

  it('checks Wi-Fi only by default, with one check shown', () => {
    const { container } = renderPage();

    expect(screen.getByRole('radio', { name: 'Wi-Fi only' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Any connection' })).not.toBeChecked();
    expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(1);
    expect(screen.getByTestId('settings-photos-wifi').querySelector('svg.lucide-check')).not.toBeNull();
  });

  it('shows the saved choice when the page opens', () => {
    act(() => setPhotosOverMobileData(true));
    renderPage();

    expect(screen.getByRole('radio', { name: 'Any connection' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Wi-Fi only' })).not.toBeChecked();
  });

  it('saves a choice on change, moving the check, and can change it back', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.click(screen.getByRole('radio', { name: 'Any connection' }));
    expect(screen.getByRole('radio', { name: 'Any connection' })).toBeChecked();
    expect(localStorage.getItem(PHOTOS_OVER_MOBILE_DATA_KEY)).toBe('true');
    expect(getPhotosOverMobileData()).toBe(true);
    expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(1);
    expect(screen.getByTestId('settings-photos-any').querySelector('svg.lucide-check')).not.toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Wi-Fi only' }));
    expect(screen.getByRole('radio', { name: 'Wi-Fi only' })).toBeChecked();
    expect(localStorage.getItem(PHOTOS_OVER_MOBILE_DATA_KEY)).toBe('false');
    expect(getPhotosOverMobileData()).toBe(false);
  });

  it('saves while offline and sends no request', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Any connection' }));

    expect(getPhotosOverMobileData()).toBe(true);
    expect(localStorage.getItem(PHOTOS_OVER_MOBILE_DATA_KEY)).toBe('true');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is operable from the keyboard: arrows move and select within the group', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Wi-Fi only' }));
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('radio', { name: 'Any connection' })).toBeChecked();
    expect(getPhotosOverMobileData()).toBe(true);
  });
});
