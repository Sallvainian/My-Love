#!/usr/bin/env bash
# Playwright tests with proper cleanup
# Ensures browser processes are killed after tests

set -e

# Cleanup function
cleanup() {
    echo -e "\n🧹 Cleaning up browser processes..."

    # Kill any remaining headless browsers
    pkill -f "chromium.*headless" 2>/dev/null || true
    pkill -f "headless_shell" 2>/dev/null || true

    echo "✓ Cleanup complete"
}

# Trap signals
trap cleanup EXIT SIGINT SIGTERM

# Run playwright tests
echo "🎭 Running Playwright tests..."
npx playwright test "$@"

# Explicit cleanup (trap will also run)
cleanup
