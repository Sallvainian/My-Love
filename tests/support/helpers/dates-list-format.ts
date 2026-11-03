/**
 * How the Settings Dates list writes a date, for specs that assert on it.
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */

/** One `en-US` part of a date, as the Dates list's formatters build its text. */
function part(date: Date, options: Intl.DateTimeFormatOptions, type: Intl.DateTimeFormatPartTypes) {
  return new Intl.DateTimeFormat('en-US', options).formatToParts(date).find((p) => p.type === type)!.value;
}

/** A yearly date as the Dates list writes it (`settingsFields.formatDayMonth`): `4 Apr`. */
export function dayMonth(date: Date): string {
  return `${part(date, { day: 'numeric' }, 'day')} ${part(date, { month: 'short' }, 'month')}`;
}

/**
 * A one-time date as the Dates list writes it (`settingsFields.formatListDate`):
 * `Sat 14 Nov` in the current year, `3 Feb 2022` in another.
 */
export function listDate(date: Date, now: Date): string {
  return date.getFullYear() === now.getFullYear()
    ? `${part(date, { weekday: 'short' }, 'weekday')} ${dayMonth(date)}`
    : `${dayMonth(date)} ${date.getFullYear()}`;
}
