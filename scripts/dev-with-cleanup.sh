#!/usr/bin/env bash
# Development server with proper cleanup
# This ensures child processes are killed when you Ctrl+C

set -e

# Cleanup function
cleanup() {
    echo -e "\n🧹 Cleaning up processes..."

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

# Start vite in the background (env vars loaded by mise + fnox)
echo "🚀 Starting Vite dev server..."
npx vite &
VITE_PID=$!

# Wait for vite to exit
wait $VITE_PID
