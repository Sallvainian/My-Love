#!/usr/bin/env bash
# E2E test runner with proper cleanup
# This ensures child processes (dev server, browser) are killed on exit

set -e

# Cleanup function
cleanup() {
    echo -e "\n🧹 Cleaning up test processes..."

    # Kill all child processes
    jobs -p | xargs -r kill -TERM 2>/dev/null || true

    # Give them a moment to cleanup gracefully
    sleep 1

    # Force kill if still running
    jobs -p | xargs -r kill -9 2>/dev/null || true

    echo "✓ Cleanup complete"
    exit 0
}

# Trap signals
trap cleanup SIGINT SIGTERM EXIT

# Run playwright tests
# The webServer in playwright.config.ts handles dotenvx for the dev server
echo "🧪 Running Playwright E2E tests..."
npx playwright test "$@"
