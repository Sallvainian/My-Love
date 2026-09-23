/**
 * The one mood icon/label map (CAP-4). Every Mood surface -- the log tiles,
 * the partner chips, the timeline, the calendar, the detail modal and the
 * Partner view -- reads its icon and label from here.
 *
 * There is deliberately no per-mood colour: colour comes from whose mood it
 * is, via MOOD_TONE (`you` = the kit tint/accent pair, `partner` = the
 * ptint/partner pair).
 */
import {
  AlertCircle,
  Angry,
  Battery,
  Flame,
  Frown,
  Heart,
  Meh,
  MessageCircle,
  Smile,
  Sparkles,
  UserMinus,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { MoodType } from '../types/moods';

export interface MoodDisplay {
  icon: LucideIcon;
  label: string;
}

export const MOOD_DISPLAY: Record<MoodType, MoodDisplay> = {
  loved: { icon: Heart, label: 'Loved' },
  happy: { icon: Smile, label: 'Happy' },
  content: { icon: Meh, label: 'Content' },
  excited: { icon: Zap, label: 'Excited' },
  thoughtful: { icon: MessageCircle, label: 'Thoughtful' },
  grateful: { icon: Sparkles, label: 'Grateful' },
  sad: { icon: Frown, label: 'Sad' },
  anxious: { icon: AlertCircle, label: 'Anxious' },
  frustrated: { icon: Angry, label: 'Frustrated' },
  angry: { icon: Flame, label: 'Angry' },
  lonely: { icon: UserMinus, label: 'Lonely' },
  tired: { icon: Battery, label: 'Tired' },
};

/**
 * The Log tab's two sections, listed by name so reordering MOOD_TYPES can
 * never move a mood into the wrong group.
 */
export const POSITIVE_MOODS: readonly MoodType[] = [
  'loved',
  'happy',
  'content',
  'excited',
  'thoughtful',
  'grateful',
];

export const CHALLENGING_MOODS: readonly MoodType[] = [
  'sad',
  'anxious',
  'frustrated',
  'angry',
  'lonely',
  'tired',
];

export type MoodTone = 'you' | 'partner';

/** Background + foreground utility pair for a mood owned by `you` or `partner`. */
export const MOOD_TONE: Record<MoodTone, string> = {
  you: 'bg-tint text-accent',
  partner: 'bg-ptint text-partner',
};
