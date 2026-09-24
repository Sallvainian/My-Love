/**
 * BirthdayWeddingCards Component
 *
 * Home's birthday and wedding cards (CAP-11), from server-held values that
 * reach the store through local copies, so they also show offline:
 * - your birthday and display name: `ownProfile` (kind `profile`);
 * - your partner's birthday and name: `partner` (kind `partner`);
 * - the wedding date: `coupleSettings.weddingDate` (kind `couple-settings`).
 *
 * Layout:
 * - Linked: your card and your partner's side by side, then the wedding card
 *   ("Date TBD" until one partner sets it).
 * - Unlinked: your card only, full width; no partner or wedding card.
 * - A card whose source has not answered yet (no saved copy, no server answer)
 *   is not rendered, rather than showing a "Not set yet" that may be wrong.
 *
 * A card whose birthday is not set stays in place with "Not set yet"; yours
 * adds "Set it in Settings".
 */

import { useMemo } from 'react';
import { parseEventDate } from '../../services/eventsService';
import { useAppStore } from '../../stores/useAppStore';
import { BirthdayCountdown } from './BirthdayCountdown';
import { EventCountdown } from './EventCountdown';

export function BirthdayWeddingCards() {
  const ownProfile = useAppStore((s) => s.ownProfile);
  const partner = useAppStore((s) => s.partner);
  const coupleSettings = useAppStore((s) => s.coupleSettings);

  const weddingDateString = coupleSettings?.status === 'linked' ? coupleSettings.weddingDate : null;
  // One Date per stored string: EventCountdown restarts its clock whenever the
  // `date` prop changes identity.
  const weddingDate = useMemo(
    () => (weddingDateString ? parseEventDate(weddingDateString) : null),
    [weddingDateString]
  );

  return (
    <>
      {(ownProfile || partner) && (
        <div
          className={`grid gap-3 ${ownProfile && partner ? 'grid-cols-2' : 'grid-cols-1'}`}
          data-testid="birthday-cards"
        >
          {ownProfile && (
            <BirthdayCountdown
              name={ownProfile.displayName}
              birthday={ownProfile.birthday}
              unsetDescription="Set it in Settings"
              testId="birthday-countdown-self"
            />
          )}
          {partner && (
            <BirthdayCountdown
              name={partner.displayName}
              birthday={partner.birthday}
              tone="partner"
              testId="birthday-countdown-partner"
            />
          )}
        </div>
      )}

      {/* Wedding - full width, linked couples only */}
      {coupleSettings?.status === 'linked' && (
        <EventCountdown
          key={weddingDateString ?? 'unset'}
          label="Wedding"
          icon="ring"
          date={weddingDate}
          placeholderText="Date TBD"
        />
      )}
    </>
  );
}
