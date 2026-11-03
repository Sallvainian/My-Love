/**
 * PhotosPage -- Settings > Photos: this DEVICE's choice for the background
 * photo fill (`photoImageCache.ts`), default Wi-Fi only. Photos opened on
 * screen are downloaded either way. A device preference, so it needs no
 * connection and survives sign-out; the page exists only where the browser
 * reports the connection type (`canTellMobileData`), which `Settings` enforces
 * with the page's `available`.
 *
 * Two native radios in one card, saved on change.
 *
 * @component
 */

import { Check } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import {
  getPhotosOverMobileData,
  photoDownloadLabel,
  setPhotosOverMobileData,
  subscribePhotosOverMobileData,
} from '../../services/photoDownloadPreference';
import { CARD, DIVIDER, GROUP_ROW } from '../shared/kitClasses';

const OPTIONS = [false, true] as const;

export function PhotosPage() {
  const allowed = useSyncExternalStore(
    subscribePhotosOverMobileData,
    getPhotosOverMobileData,
    getPhotosOverMobileData
  );

  return (
    <div
      role="radiogroup"
      aria-labelledby="settings-title"
      className={CARD}
      data-testid="settings-photos-options"
    >
      {OPTIONS.map((option, index) => (
        <div key={String(option)} className="contents">
          {index > 0 && <div className={DIVIDER} aria-hidden="true" />}
          <label
            className={`${GROUP_ROW} cursor-pointer rounded-[14px] has-focus-visible:ring-2 has-focus-visible:ring-accent`}
            data-testid={option ? 'settings-photos-any' : 'settings-photos-wifi'}
          >
            <input
              type="radio"
              name="settings-photos-over-mobile-data"
              className="sr-only"
              checked={allowed === option}
              onChange={() => setPhotosOverMobileData(option)}
            />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
              {photoDownloadLabel(option)}
            </span>
            {allowed === option && (
              <Check className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            )}
          </label>
        </div>
      ))}
    </div>
  );
}
