/**
 * NoMoodLoggedState Component
 *
 * Displays a friendly empty state when partner hasn't logged any moods yet.
 * Provides encouraging message to check in with partner.
 *
 * Story 5.3: Partner Mood Viewing & Transparency (AC-5.3.5)
 */

export function NoMoodLoggedState() {
  return (
    <div
      className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-8 text-center mb-6"
      data-testid="no-mood-logged-state"
    >
      <div className="text-6xl mb-3">💭</div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        No mood logged yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        Check in with your partner to see how they're feeling ❤️
      </p>
    </div>
  );
}
