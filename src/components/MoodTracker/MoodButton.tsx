import { m as motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

interface MoodButtonProps {
  mood: string;
  icon: LucideIcon;
  label: string;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * MoodButton Component
 * Story 6.2: AC-2 - Mood tile on the style kit
 *
 * A kit tile at least 76px tall (it grows with large text): unselected is a
 * plain card with a hairline ring and a `muted` icon over an `ink` label;
 * selected is the `tint` fill with a 2px `accent` ring and `accent` icon and
 * label. Colour is by owner (always `you` here), never per mood.
 */
export function MoodButton({ mood, icon: Icon, label, isSelected, onClick }: MoodButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`flex min-h-19 min-w-12 flex-col px-1 py-2 items-center justify-center gap-1.5 rounded-2xl text-[13px] font-medium transition-colors ${
        isSelected
          ? 'bg-tint text-accent ring-2 ring-accent ring-inset'
          : 'bg-card text-muted ring-1 ring-line-strong ring-inset'
      }`}
      data-testid={`mood-button-${mood}`}
      aria-label={`${label} mood`}
      aria-pressed={isSelected}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
      <span className={isSelected ? 'text-accent' : 'text-ink'}>{label}</span>
    </motion.button>
  );
}
