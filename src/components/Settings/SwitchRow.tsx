/**
 * SwitchRow — one Settings row that is a switch: icon tile, label, helper
 * line and a track and thumb. A native button with `role="switch"`, so Enter
 * and Space reach it from the keyboard; `aria-checked` carries the state.
 *
 * Extracted from Settings' "Download photos over mobile data" row, which
 * renders through it unchanged, and reused by the push section. `id` names the
 * row's test id (`<id>`, `<id>-helper`) and the label and helper ids that
 * `aria-labelledby` and `aria-describedby` point at.
 *
 * @component
 */

import type { LucideIcon } from 'lucide-react';
import { GROUP_ROW as ROW, GROUP_TILE as TILE } from '../shared/kitClasses';

export const ROW_BUTTON = `${ROW} w-full rounded-[14px] text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent`;

interface SwitchRowProps {
  id: string;
  icon: LucideIcon;
  label: string;
  helper: string;
  checked: boolean;
  /** Called with the state the click asks for: the opposite of `checked`. */
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

export function SwitchRow({ id, icon: Icon, label, helper, checked, onChange, disabled }: SwitchRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-helper`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={disabled ? `${ROW_BUTTON} disabled:cursor-not-allowed disabled:opacity-60` : ROW_BUTTON}
      data-testid={id}
    >
      <span className={TILE} aria-hidden="true">
        <Icon className="h-4.25 w-4.25" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={`${id}-label`} className="text-[15px] font-medium text-ink">
          {label}
        </span>
        <span
          id={`${id}-helper`}
          className="text-[13px] wrap-break-word text-muted"
          data-testid={`${id}-helper`}
        >
          {helper}
        </span>
      </span>
      {/* The switch's track and thumb; the state itself is `aria-checked`. */}
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-fill' : 'bg-line-strong'
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-card shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}
