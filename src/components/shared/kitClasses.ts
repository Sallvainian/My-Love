/**
 * Style-kit class strings shared by the Settings pages (`SettingsRows`,
 * `SwitchRow`, `NewDatePages`), by the surfaces with no artboard
 * of their own that borrow the same pieces (`LoginScreen`, `DisplayNameSetup`,
 * `WelcomeSplash`, `ErrorBoundary` and `ViewErrorBoundary`), by the mood
 * screens' section labels and by the centred dialogs. The dialog pieces are
 * the kit dialog, as `NoteRemoveConfirmation` renders it; every colour is a
 * kit token that switches with the OS theme, so no per-theme variant is
 * needed.
 */

/** A Settings card. Its `p-3` is what `DIVIDER`'s `-mx-3` cancels. */
export const CARD = 'flex flex-col gap-1.5 rounded-[20px] border border-line bg-card p-3 shadow-card';

/** Full-bleed hairline inside a Settings card: cancels its 12px padding. */
export const DIVIDER = '-mx-3 h-px bg-line';

/** A Settings row: icon tile and text, 48px tall. */
export const GROUP_ROW = 'flex min-h-12 items-center gap-3';
export const GROUP_TILE =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tint text-accent';

const ICON_BUTTON =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';
export const ADD_BUTTON = `${ICON_BUTTON} bg-tint text-accent focus-visible:ring-accent`;

/** The small uppercase label above a section of cards. */
export const SECTION_LABEL = 'px-1 text-xs font-semibold tracking-[.08em] text-muted uppercase';

/** One sentence under a card, muted, inset 4px (DESIGN `typography.footnote`). */
export const FOOTNOTE = 'px-1 text-[13px] leading-[1.4] text-muted';

/** Quiet in-card notice surface. */
export const NOTICE = 'rounded-[14px] bg-card2 p-3';

/**
 * A centred dialog's scrim, with no stacking layer of its own. The vertical
 * padding clears the notch and home indicator, which `viewport-fit=cover` lets
 * the page draw under. A dialog that opens over another overlay adds its own
 * z utility to this; the rest use `DIALOG_BACKDROP`. Appending a second z to
 * `DIALOG_BACKDROP` would not work: Tailwind resolves two z utilities in one
 * class list by their order in the CSS, not in the string.
 */
export const DIALOG_SCRIM =
  'fixed inset-0 flex items-center justify-center bg-black/50 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]';
export const DIALOG_BACKDROP = `${DIALOG_SCRIM} z-50`;

/**
 * A dialog panel with no padding, for one whose bordered header and footer run
 * edge to edge. `max-h-full` caps it at the scrim's padded height (the scrim
 * is `fixed inset-0`, so that height is definite) and it scrolls past that.
 */
export const DIALOG_SURFACE =
  'max-h-full w-full overflow-y-auto rounded-[20px] bg-card shadow-float outline-hidden';
export const DIALOG_PANEL = `${DIALOG_SURFACE} p-5`;
export const DIALOG_TITLE = 'text-lg font-semibold text-ink';

const PILL =
  'flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';
export const PRIMARY_BUTTON = `${PILL} bg-fill text-white focus-visible:ring-accent`;
export const SECONDARY_BUTTON = `${PILL} bg-tint text-accent focus-visible:ring-accent`;
export const DESTRUCTIVE_BUTTON = `${PILL} bg-dtint text-danger focus-visible:ring-danger`;

export const FIELD_LABEL = 'mb-2 block text-[13px] font-semibold text-ink';
export const FAILURE_BOX = 'rounded-[14px] bg-dtint px-4 py-3 text-sm text-danger';

/**
 * A 48px kit input (or, with `multiline`, a textarea on the same surface).
 * `scheme-light-dark` lets native parts such as the date picker's icon follow
 * the OS theme instead of drawing dark on the dark field.
 *
 * 16px text, never smaller: iOS zooms the whole page in when a field under
 * 16px is focused and leaves it zoomed, so the page can then be dragged
 * about. Every text field in the app follows this.
 */
export function fieldClass(hasError: boolean, multiline = false): string {
  return `w-full rounded-[14px] bg-field px-4 text-base text-ink ring-inset placeholder:text-muted focus:ring-2 focus:outline-hidden ${
    multiline ? 'resize-none py-3' : 'h-12 scheme-light-dark'
  } ${hasError ? 'ring-2 ring-danger focus:ring-danger' : 'ring-1 ring-line-strong focus:ring-accent'}`;
}
