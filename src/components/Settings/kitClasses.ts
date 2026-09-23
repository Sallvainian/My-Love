/**
 * Style-kit class strings shared by the Settings page and its countdown groups
 * (`EventsSettings`, `AnniversarySettings`), and by the surfaces with no
 * artboard of their own that borrow the same pieces: `LoginScreen`,
 * `DisplayNameSetup`, `WelcomeSplash`, `ErrorBoundary` and `ViewErrorBoundary`.
 * The dialog pieces follow the kit dialog `PhotoEditModal` /
 * `PhotoDeleteConfirmation` established; every colour is a kit token that
 * switches with the OS theme, so no per-theme variant is needed.
 */

/** A Settings card. Its `p-3` is what `DIVIDER`'s `-mx-3` cancels. */
export const CARD = 'flex flex-col gap-1.5 rounded-[20px] border border-line bg-card p-3 shadow-card';

/** Full-bleed hairline inside a Settings card: cancels its 12px padding. */
export const DIVIDER = '-mx-3 h-px bg-line';

/** A group's header row: icon tile, title and subtitle, round Add button. */
export const GROUP_ROW = 'flex min-h-12 items-center gap-3';
export const GROUP_TILE =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tint text-accent';
export const GROUP_TITLE = 'text-[15px] font-medium text-ink';
export const GROUP_SUBTITLE = 'text-[13px] text-muted';

const ICON_BUTTON =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';
export const ADD_BUTTON = `${ICON_BUTTON} bg-tint text-accent focus-visible:ring-accent`;
export const EDIT_BUTTON = `${ICON_BUTTON} bg-card2 text-muted focus-visible:ring-accent`;
export const DELETE_BUTTON = `${ICON_BUTTON} bg-dtint text-danger focus-visible:ring-danger`;

/** A list row under a group header. */
export const ITEM_ROW = 'flex min-h-12 items-center gap-3 py-1';
export const ITEM_LABEL = 'text-[15px] font-medium break-words text-ink';
export const ITEM_META = 'text-[13px] break-words text-muted';

/** Small (36px) secondary pill for in-card actions. */
export const SMALL_SECONDARY =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-semibold text-accent transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60';

/** Quiet in-card notice surface. */
export const NOTICE = 'rounded-[14px] bg-card2 p-3';

export const DIALOG_BACKDROP = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';
export const DIALOG_PANEL = 'w-full rounded-[20px] bg-card p-5 shadow-float outline-none';
export const DIALOG_TITLE = 'text-lg font-semibold text-ink';
export const DIALOG_CLOSE = `${ICON_BUTTON} bg-card2 text-muted focus-visible:ring-accent`;

const PILL =
  'flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';
export const PRIMARY_BUTTON = `${PILL} bg-fill text-white focus-visible:ring-accent`;
export const SECONDARY_BUTTON = `${PILL} bg-tint text-accent focus-visible:ring-accent`;
export const DESTRUCTIVE_BUTTON = `${PILL} bg-dtint text-danger focus-visible:ring-danger`;

export const FIELD_LABEL = 'mb-2 block text-[13px] font-semibold text-ink';
export const REQUIRED_MARK = 'text-danger';
export const FIELD_ERROR = 'mt-1 text-sm text-danger';
export const FAILURE_BOX = 'rounded-[14px] bg-dtint px-4 py-3 text-sm text-danger';

/**
 * A 48px kit input (or, with `multiline`, a textarea on the same surface).
 * `scheme-light-dark` lets native parts such as the date picker's icon follow
 * the OS theme instead of drawing dark on the dark field.
 */
export function fieldClass(hasError: boolean, multiline = false): string {
  return `w-full rounded-[14px] bg-field px-4 text-[15px] text-ink ring-inset placeholder:text-muted focus:ring-2 focus:outline-none ${
    multiline ? 'resize-none py-3' : 'h-12 scheme-light-dark'
  } ${hasError ? 'ring-2 ring-danger focus:ring-danger' : 'ring-1 ring-line focus:ring-accent'}`;
}
