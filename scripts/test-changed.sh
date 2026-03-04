#!/bin/bash
# test-changed.sh - Run only tests affected by recent changes
# Usage: ./scripts/test-changed.sh [base-branch]
#
# Examples:
#   ./scripts/test-changed.sh          # Compare against main
#   ./scripts/test-changed.sh develop  # Compare against develop

set -e

BASE_BRANCH=${1:-main}

echo "Detecting changed test files (vs $BASE_BRANCH)..."

CHANGED=$(git diff --name-only "origin/$BASE_BRANCH...HEAD" | grep -E '\.(spec|test)\.(ts|tsx|js|jsx)$' || true)

if [ -z "$CHANGED" ]; then
  echo "No test files changed — nothing to run."
  exit 0
fi

echo "Changed test files:"
echo "$CHANGED" | while read -r file; do echo "  $file"; done
echo ""

# Separate unit tests (vitest) from E2E tests (playwright)
UNIT_TESTS=$(echo "$CHANGED" | grep -E '^(tests/unit/|src/)' || true)
E2E_TESTS=$(echo "$CHANGED" | grep -E '^tests/e2e/' || true)

if [ -n "$UNIT_TESTS" ]; then
  echo "Running changed unit tests..."
  # shellcheck disable=SC2086
  npx vitest run $UNIT_TESTS --silent
  echo ""
fi

if [ -n "$E2E_TESTS" ]; then
  echo "Running changed E2E tests..."
  # shellcheck disable=SC2086
  npx playwright test $E2E_TESTS
  echo ""
fi

echo "All changed tests passed."
