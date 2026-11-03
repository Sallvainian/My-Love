/**
 * SettingsRows -- the pieces every Settings list page is built from.
 *
 * `SettingsGroup` is an optional uppercase label above one kit card whose rows
 * are separated by a hairline, and an optional footnote under it;
 * `SettingsRow` is one list row (tile, label, value, chevron) that either
 * opens a subpage (`target`) or runs a handler; `ReadOnlyRow` is a label and a
 * value that do nothing.
 *
 * @component
 */

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Children, Fragment, isValidElement, useId, type ReactNode } from 'react';
import { useAppStore } from '../../../stores/useAppStore';
import { CARD, DIVIDER, GROUP_ROW, GROUP_TILE, SECTION_LABEL } from '../../shared/kitClasses';
import { ROW_BUTTON } from '../SwitchRow';

interface SettingsGroupProps {
  /** The uppercase label above the card; the card stands alone without one. */
  label?: string;
  /** Applied to the card. */
  testId?: string;
  /** A Footnote, or a line about the card, 8px under it; shown only with rows. */
  footnote?: ReactNode;
  /** Rows; a falsy row is skipped, and a group with none renders nothing. */
  children?: ReactNode;
}

export function SettingsGroup({ label, testId, footnote, children }: SettingsGroupProps) {
  const labelId = useId();
  const rows = Children.toArray(children);
  if (rows.length === 0) return null;

  const card = (
    <div className={CARD} data-testid={testId}>
      {rows.map((row, index) => (
        // The key `Children.toArray` gave the row, so a conditional row coming or
        // going does not remount the rows after it.
        <Fragment key={isValidElement(row) && row.key !== null ? row.key : index}>
          {index > 0 && <div className={DIVIDER} aria-hidden="true" />}
          {row}
        </Fragment>
      ))}
    </div>
  );
  if (!label && !footnote) return card;

  return (
    <section className="flex flex-col gap-2" aria-labelledby={label ? labelId : undefined}>
      {label && (
        <h2 id={labelId} className={SECTION_LABEL}>
          {label}
        </h2>
      )}
      {card}
      {footnote}
    </section>
  );
}

interface SettingsRowProps {
  label: string;
  /** The current state in a word or two, muted at the right. */
  value?: string;
  /**
   * For a value that can run long (an event's name or note): it truncates at a
   * capped width instead of spilling past the card. Other values stay whole.
   */
  truncateValue?: boolean;
  /**
   * Shown in accent in place of the value's text (an event's Icon row); the
   * value still names the row.
   */
  valueIcon?: LucideIcon;
  icon?: LucideIcon;
  /** The subpage this row opens (a path relative to `/settings`). */
  target?: string;
  /** For a row that does something other than open a subpage. */
  onClick?: () => void;
  testId?: string;
  /** Not yet usable, for a row whose page must prefill from an answer that has not arrived. */
  disabled?: boolean;
}

export function SettingsRow({
  label,
  value,
  truncateValue,
  valueIcon: ValueIcon,
  icon: Icon,
  target,
  onClick,
  testId,
  disabled,
}: SettingsRowProps) {
  const openSettingsPage = useAppStore((s) => s.openSettingsPage);

  return (
    <button
      type="button"
      onClick={target === undefined ? onClick : () => openSettingsPage(target)}
      disabled={disabled}
      className={`${ROW_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`}
      // The value is part of the row's name: "Photos, Wi-Fi only".
      aria-label={value ? `${label}, ${value}` : undefined}
      // Where focus returns when the page this row opened is left.
      data-settings-target={target}
      data-testid={testId}
    >
      {Icon && (
        <span className={GROUP_TILE} aria-hidden="true">
          <Icon className="h-4.25 w-4.25" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{label}</span>
      {ValueIcon ? (
        <ValueIcon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
      ) : (
        value && (
          <span
            className={
              truncateValue
                ? 'max-w-[60%] min-w-0 truncate text-[15px] text-muted'
                : 'shrink-0 text-[15px] whitespace-nowrap text-muted'
            }
          >
            {value}
          </span>
        )
      )}
      <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}

interface ReadOnlyRowProps {
  label: string;
  value: string;
  /**
   * Shown in accent in place of the value's text (an event's Icon row); the
   * value stays in the row as hidden text, so the row still says what it is.
   */
  valueIcon?: LucideIcon;
  testId?: string;
}

/**
 * A fact the page only shows: not a button, no chevron, no pressed state. The
 * value keeps the muted ink of any other value (never reduced opacity) and
 * wraps, so a long email breaks instead of widening the card.
 */
export function ReadOnlyRow({ label, value, valueIcon: ValueIcon, testId }: ReadOnlyRowProps) {
  return (
    <div className={`${GROUP_ROW} px-0.5`} data-testid={testId}>
      <span className="shrink-0 text-[15px] font-medium text-ink">{label}</span>
      {ValueIcon ? (
        <span className="flex min-w-0 flex-1 justify-end">
          <ValueIcon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <span className="sr-only">{value}</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 text-right text-[15px] wrap-break-word text-muted">{value}</span>
      )}
    </div>
  );
}
