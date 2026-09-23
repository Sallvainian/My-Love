/**
 * CountdownCard
 *
 * The one countdown card shape on Home (CAP-3): an icon tile, a `muted` label,
 * a 22px/700 tabular value, and optionally a trailing figure bottom-right and a
 * description line. Purely presentational -- every caller keeps its own clock
 * and math and hands this finished strings.
 *
 * Colour lives only in the tile: `you` is the kit tint/accent pair, `partner`
 * the ptint/partner pair, and `highlight` (a birthday or event that is today)
 * swaps the tile to the solid fill. The card itself is always the plain kit
 * card.
 *
 * Structure is load-bearing for tests: the label is an `<h3>`, the value is a
 * `<div>`, and the description is the only `<p>` sibling after the label
 * (`tests/e2e/home/events.spec.ts` counts `h3 ~ p`), so the trailing figure is
 * a `<span>`, not a paragraph.
 */
import type { LucideIcon } from 'lucide-react';

export type CountdownTone = 'you' | 'partner';

interface CountdownCardProps {
  icon: LucideIcon;
  tone?: CountdownTone;
  /** Solid fill tile with a white icon -- the day itself has arrived. */
  highlight?: boolean;
  label: string;
  value: string;
  /** Render the value in `muted` (e.g. "Date TBD"). */
  valueMuted?: boolean;
  /** Small secondary figure, bottom-right (e.g. the h/m/s remainder). */
  trailing?: string;
  description?: string;
  /** Fill the icon's shape (the Together heart). */
  iconFilled?: boolean;
  testId?: string;
}

const TONE_TILE: Record<CountdownTone, string> = {
  you: 'bg-tint text-accent',
  partner: 'bg-ptint text-partner',
};

export function CountdownCard({
  icon: Icon,
  tone = 'you',
  highlight = false,
  label,
  value,
  valueMuted = false,
  trailing,
  description,
  iconFilled = false,
  testId,
}: CountdownCardProps) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-card p-3.5 shadow-card"
      data-testid={testId}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          highlight ? 'bg-fill text-white' : TONE_TILE[tone]
        }`}
      >
        <Icon
          className={`h-[18px] w-[18px] ${iconFilled ? 'fill-current' : ''}`}
          aria-hidden="true"
        />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-normal break-words text-muted">{label}</h3>
          <div
            className={`text-[22px] font-bold tabular-nums ${valueMuted ? 'text-muted' : 'text-ink'}`}
          >
            {value}
          </div>
          {description && <p className="text-[13px] break-words text-muted">{description}</p>}
        </div>
        {trailing && (
          <span className="shrink-0 pb-1 text-[13px] text-muted tabular-nums">{trailing}</span>
        )}
      </div>
    </div>
  );
}
