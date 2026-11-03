/**
 * SettingsRows -- the two pieces every Settings list page is built from.
 *
 * `SettingsGroup` is an optional uppercase label above one kit card whose rows
 * are separated by a hairline, and an optional footnote under it;
 * `SettingsRow` is one list row (tile, label, value, chevron) that either
 * opens a subpage (`target`) or runs a handler.
 *
 * @component
 */

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Children, Fragment, isValidElement, useId, type ReactNode } from 'react';
import { useAppStore } from '../../../stores/useAppStore';
import { CARD, DIVIDER, GROUP_TILE, SECTION_LABEL } from '../../shared/kitClasses';
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
  icon?: LucideIcon;
  /** The subpage this row opens (a path relative to `/settings`). */
  target?: string;
  /** For a row that does something other than open a subpage. */
  onClick?: () => void;
  testId?: string;
}

export function SettingsRow({ label, value, icon: Icon, target, onClick, testId }: SettingsRowProps) {
  const openSettingsPage = useAppStore((s) => s.openSettingsPage);

  return (
    <button
      type="button"
      onClick={target === undefined ? onClick : () => openSettingsPage(target)}
      className={ROW_BUTTON}
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
      {value && (
        <span className="shrink-0 text-[15px] whitespace-nowrap text-muted">{value}</span>
      )}
      <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}
