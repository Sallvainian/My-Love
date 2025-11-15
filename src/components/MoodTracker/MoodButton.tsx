import { motion } from 'framer-motion';
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
 * Story 6.2: AC-2 - Mood button with Framer Motion animations
 *
 * Features:
 * - Scale animation on selection (1.1x scale)
 * - Color feedback (pink when selected, gray when not)
 * - Icon from lucide-react
 * - Visual highlight for selected state
 */
export function MoodButton({ mood, icon: Icon, label, isSelected, onClick }: MoodButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        scale: isSelected ? 1.1 : 1,
        backgroundColor: isSelected ? 'rgba(236, 72, 153, 0.1)' : 'rgba(243, 244, 246, 1)',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-colors ${
        isSelected
          ? 'border-pink-500 text-pink-500'
          : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
      }`}
      data-testid={`mood-button-${mood}`}
      aria-label={`${label} mood`}
      aria-pressed={isSelected}
    >
      <Icon className="w-8 h-8" />
      <span className="text-sm font-medium">{label}</span>
    </motion.button>
  );
}
