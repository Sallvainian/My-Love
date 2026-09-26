/**
 * Read globs — one per server read a spec waits on before it asserts.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * Each glob goes to `interceptNetworkCall({ method: 'GET', url })`, armed
 * before the `goto`, `reload` or dock click that sends the read and awaited
 * before the first step that depends on its data. The utility matches the
 * whole request URL with picomatch, so three rules shape every pattern here:
 *
 * - `*` never crosses a `/`, and PostgREST's query string has none, so one `*`
 *   spans any stretch of it.
 * - `?` is picomatch's single-character wildcard: `table?*` matches the
 *   literal `?` that starts the query string, but also any other character
 *   there, so `love_notes?*` would match `love_notes_visible` too.
 * - postgrest-js strips the spaces from `select` and sends its commas as
 *   `%2C`, so a column list is written with `%2C`.
 *
 * Several tables are read more than one way on the same screen (the photos
 * quota read, the partner lookups on `users`, the moods backfill and the
 * partner card), so each pattern pins the query parameters that tell its read
 * apart. A bare table glob would resolve on whichever sibling read went first.
 */

/** Home's and Settings' upcoming window (`eventsService.getEventsPage`). Each
 * load sends it alongside {@link PAST_EVENTS_READ}; only load-more adds `or=`. */
export const UPCOMING_EVENTS_READ = '**/rest/v1/events*event_date=gte.*';

/** The past window of the same load. */
export const PAST_EVENTS_READ = '**/rest/v1/events*event_date=lt.*';

/** The gallery list (`photoService.listAllPhotos`); the `select=file_size`
 * quota read has no `order=`. */
export const PHOTOS_LIST_READ = '**/rest/v1/photos?*order=created_at.desc*';

/** The love-notes thread (`notesSlice.fetchNotes`). */
export const LOVE_NOTES_READ = '**/rest/v1/love_notes_visible?*';

/** A love note's send: the POST upsert into `love_notes` (`notesSlice.sendNote`).
 * Observe it with `method: 'POST'`; the thread view is only ever read. */
export const LOVE_NOTE_SEND = '**/rest/v1/love_notes?*';

/** The interactions history (`interactionService`). */
export const INTERACTIONS_READ = '**/rest/v1/interactions?*';

/** The couple's settings row (`coupleSettingsService`). */
export const COUPLE_SETTINGS_READ = '**/rest/v1/couple_settings*';

/** The account's anniversaries (`anniversariesService.fetchAnniversaries`). */
export const ANNIVERSARIES_READ = '**/rest/v1/anniversaries*';

/** The account's custom messages (`customMessagesApi.fetchCustomMessages`). */
export const CUSTOM_MESSAGES_READ = '**/rest/v1/custom_messages?*';

/** The account's favorite keys (`messageFavoritesApi.fetchFavoriteKeys`). */
export const FAVORITES_READ = '**/rest/v1/message_favorites?select=message_key*';

/** The signed-in user's own profile (`profileService`). */
export const OWN_PROFILE_READ = '**/rest/v1/users?select=display_name%2Cbirthday*';

/** The linked partner's record (`partnerService.getPartner`). */
export const PARTNER_RECORD_READ = '**/rest/v1/users?select=id%2Cemail%2Cdisplay_name%2Cbirthday*';

/** {@link PARTNER_RECORD_READ}, pinned to one partner's id. */
export function partnerRecordRead(partnerId: string): string {
  return `**/rest/v1/users?select=id%2Cemail%2Cdisplay_name%2Cbirthday&id=eq.${partnerId}*`;
}

/** The display-name gate's read of the signed-in user's own name
 * (`supabaseClient`), which decides whether the setup screen shows. */
export function gateNameRead(userId: string): string {
  return `**/rest/v1/users?select=display_name&id=eq.${userId}*`;
}

/** The signed-in user's mood history backfill (`moodSlice`'s
 * `moodApi.getMoodHistory` pages of 500). */
export function ownMoodHistoryRead(userId: string): string {
  return `**/rest/v1/moods?*user_id=eq.${userId}*limit=500*`;
}

/** The partner's mood list on the Partner screen (`fetchPartnerMoods`, 30
 * rows). */
export function partnerMoodListRead(partnerId: string): string {
  return `**/rest/v1/moods?*user_id=eq.${partnerId}*limit=30*`;
}

/** The partner's latest mood (`moodSyncService.getLatestPartnerMood`, one
 * row), shown on the Mood screen. */
export function partnerLatestMoodRead(partnerId: string): string {
  return `**/rest/v1/moods?*user_id=eq.${partnerId}*limit=1`;
}

/**
 * The `timeout` for the standalone `interceptNetworkCall` on a page in a second
 * browser context, which the fixture cannot reach (it is bound to `page` and
 * drops `timeout`). Mirrors `use.actionTimeout` in `playwright.config.ts`.
 */
export const SECOND_CONTEXT_READ_TIMEOUT = 15_000;
