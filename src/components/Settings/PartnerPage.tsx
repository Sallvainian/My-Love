/**
 * PartnerPage -- Settings > Partner (`/settings/partner`) and the top page's
 * Partner row.
 *
 * Both read the store's partner (`partnerSlice`, the same state the Partner
 * view shares), so they follow a link or an unlink with no reload. The page has
 * three states, chosen in the Partner view's order plus the `partnerKnown`
 * gate: a failed read with nothing saved (`partnerLoadError`) shows the Partner
 * view's load-error card, never the not-linked page; a partner shows read-only
 * Name, Email and Linked since (the last only when the link date is known);
 * a loaded "no partner" answer (`partnerKnown`) shows the lead line and a
 * `Go to Partner` row that opens the Partner view, where the one connect flow
 * stays; before any answer the page shows nothing under its title. There is no
 * unlink action.
 *
 * @component
 */

import { Users } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { PartnerLoadError } from '../PartnerMoodView/PartnerLoadError';
import { formatInstantDate } from './settingsFields';
import { ReadOnlyRow, SettingsGroup, SettingsRow } from './stack/SettingsRows';

const NOT_LINKED = 'Not linked';

/** The top page's Partner row: the partner's name, or `Not linked` once the server has said so. */
export function PartnerRow() {
  const partner = useAppStore((s) => s.partner);
  const partnerKnown = useAppStore((s) => s.partnerKnown);
  const partnerLoadError = useAppStore((s) => s.partnerLoadError);

  // The page's precedence: a failed read with nothing saved shows no value,
  // even over an earlier loaded answer, so the row never says `Not linked`
  // above a page that says the partner could not be loaded.
  const value = partnerLoadError
    ? undefined
    : partner
      ? partner.displayName
      : partnerKnown
        ? NOT_LINKED
        : undefined;

  return (
    <SettingsRow
      icon={Users}
      label="Partner"
      value={value}
      target="partner"
      testId="settings-partner-row"
    />
  );
}

export function PartnerPage() {
  const partner = useAppStore((s) => s.partner);
  const partnerKnown = useAppStore((s) => s.partnerKnown);
  const partnerLoadError = useAppStore((s) => s.partnerLoadError);
  const isLoadingPartner = useAppStore((s) => s.isLoadingPartner);
  const isOnline = useAppStore((s) => s.syncStatus.isOnline);
  const loadPartner = useAppStore((s) => s.loadPartner);
  const navigatePartner = useAppStore((s) => s.navigatePartner);

  if (partnerLoadError) {
    // A retry keeps the error until an answer lands; the Partner view hides the
    // card meanwhile, and so does this page (never the linked or not-linked page).
    if (isLoadingPartner) return null;
    return <PartnerLoadError isOnline={isOnline} onRetry={() => void loadPartner()} />;
  }

  if (partner) {
    const linkedSince = partner.linkedSince ? formatInstantDate(partner.linkedSince) : null;
    return (
      <SettingsGroup testId="settings-partner-card">
        <ReadOnlyRow
          key="name"
          label="Name"
          value={partner.displayName}
          testId="settings-partner-name"
        />
        <ReadOnlyRow key="email" label="Email" value={partner.email} testId="settings-partner-email" />
        {linkedSince && (
          <ReadOnlyRow
            key="linked-since"
            label="Linked since"
            value={linkedSince}
            testId="settings-partner-linked-since"
          />
        )}
      </SettingsGroup>
    );
  }

  if (partnerKnown) {
    return (
      <>
        <p
          className="px-1 text-[15px] leading-[1.45] text-muted"
          data-testid="settings-partner-lead"
        >
          You aren't linked with a partner yet.
        </p>
        <SettingsGroup>
          <SettingsRow
            key="go-to-partner"
            icon={Users}
            label="Go to Partner"
            onClick={navigatePartner}
            testId="settings-go-to-partner"
          />
        </SettingsGroup>
      </>
    );
  }

  // No answer yet: nothing under the title, and never `Not linked`.
  return null;
}
