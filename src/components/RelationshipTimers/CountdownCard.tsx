/**
 * CountdownCard
 *
 * The one countdown card shape on Home (CAP-3): an icon tile, a `muted` label,
 * a 22px/700 tabular value, and optionally a trailing figure and a description
 * line. Purely presentational -- every caller keeps its own clock
 * and math and hands this finished strings.
 *
 * Colour lives only in the tile: `you` is the kit tint/accent pair, `partner`
 * the ptint/partner pair, and `highlight` (a birthday or event that is today)
 * swaps the tile to the solid fill. The card itself is always the plain kit
 * card.
 *
 * Structure is load-bearing for tests: the label is an `<h3>`, the value is the
 * `<div>` right after it (`h3 + div`), and the description is the only `<p>`
 * sibling after the label (`tests/e2e/home/events.spec.ts` counts `h3 ~ p`),
 * so the trailing figure is a `<span>`, not a paragraph.
 *
 * The trailing figure (a countdown's live h/m/s) sits to the right of the value
 * on a full-width card and on its own line under the value on a half-width
 * one: the card is a size container and the text block a grid whose second
 * column only opens once the card is at least 18rem wide (`@2xs`). A phone's
 * two-up cards are about 8.5rem inside, too narrow for "123 days" and the
 * clock side by side.
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
  /** Small secondary figure beside or under the value (a countdown's live h/m/s). */
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
      className="@container flex flex-col gap-2.5 rounded-[20px] border border-line bg-card p-3.5 shadow-card"
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
      <div className="grid grid-cols-1 gap-x-2 gap-y-0.5 @2xs:grid-cols-[minmax(0,1fr)_auto]">
        <h3 className="text-sm font-normal break-words text-muted @2xs:col-span-2">{label}</h3>
        <div
          className={`text-[22px] font-bold tabular-nums ${valueMuted ? 'text-muted' : 'text-ink'}`}
        >
          {value}
        </div>
        {trailing && (
          <span className="text-[13px] text-muted tabular-nums @2xs:self-end @2xs:pb-1">
            {trailing}
          </span>
        )}
        {description && (
          <p className="text-[13px] break-words text-muted @2xs:col-span-2">{description}</p>
        )}
      </div>
    </div>
  );
}
