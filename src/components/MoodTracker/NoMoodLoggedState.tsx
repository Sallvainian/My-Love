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
      className="mb-6 rounded-2xl bg-gray-50 p-8 text-center dark:bg-gray-800/50"
      data-testid="no-mood-logged-state"
    >
      <div className="mb-3 text-6xl">💭</div>
      <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
        No mood logged yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        Check in with your partner to see how they're feeling ❤️
      </p>
    </div>
  );
}
