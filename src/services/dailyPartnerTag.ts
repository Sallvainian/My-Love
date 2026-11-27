/**
 * The partner a Daily copy write tags its entry with, as a status rather than
 * an id or `null`: `null` would stand for both "no partner" and "the lookup
 * failed", and a failed lookup must never overwrite a stored tag
 * (`lookupPartnerId()` keeps the two apart the same way).
 *
 * @module services/dailyPartnerTag
 */

export type PartnerTag =
  /** The partner the entry was read with. */
  | { status: 'linked'; partnerId: string }
  /** The server said there is no partner: the entry is tagged `null`. */
  | { status: 'unlinked' }
  /** The lookup failed or threw: a stored tag stays, a new entry is untagged. */
  | { status: 'unknown' };

/** The tag to write: the answer's, or `stored` when the partner is unknown. */
export function resolvePartnerTag(tag: PartnerTag, stored: string | null | undefined): string | null {
  if (tag.status === 'linked') return tag.partnerId;
  if (tag.status === 'unlinked') return null;
  return stored ?? null;
}
