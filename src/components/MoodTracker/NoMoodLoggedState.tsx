/**
 * NoMoodLoggedState Component
 *
 * Displays a friendly empty state when partner hasn't logged any moods yet.
 * Provides encouraging message to check in with partner.
 *
 * Story 5.3: Partner Mood Viewing & Transparency (AC-5.3.5)
 */
import { Heart } from 'lucide-react';

export function NoMoodLoggedState() {
  return (
    <div
      className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-3.5 shadow-card"
      data-testid="no-mood-logged-state"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ptint text-partner">
        <Heart className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-medium text-ink">No mood logged yet</h3>
        <p className="text-[13px] text-muted">
          Check in with your partner to see how they're feeling
        </p>
      </div>
    </div>
  );
}
