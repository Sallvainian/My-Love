#!/bin/bash
# burn-in.sh - Standalone burn-in test execution
# Usage: ./scripts/burn-in.sh [iterations] [test-pattern]
#
# Examples:
#   ./scripts/burn-in.sh              # Run all E2E tests 10x
#   ./scripts/burn-in.sh 5            # Run all E2E tests 5x
#   ./scripts/burn-in.sh 10 auth      # Run auth tests 10x

set -e

ITERATIONS=${1:-10}
TEST_PATTERN=${2:-""}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 Burn-In Test Runner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Iterations: $ITERATIONS"
if [ -n "$TEST_PATTERN" ]; then
  echo "Pattern: $TEST_PATTERN"
fi
echo ""

# Build test command
TEST_CMD="npm run test:e2e:raw"
if [ -n "$TEST_PATTERN" ]; then
  TEST_CMD="$TEST_CMD -- --grep=\"$TEST_PATTERN\""
fi

# Track results
PASSED=0
FAILED=0
FAILED_ITERATIONS=()

# Run burn-in loop
for i in $(seq 1 $ITERATIONS); do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 Iteration $i/$ITERATIONS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if eval $TEST_CMD; then
    echo "✅ Iteration $i passed"
    ((PASSED++))
  else
    echo "❌ Iteration $i FAILED"
    ((FAILED++))
    FAILED_ITERATIONS+=($i)

    # Save failure artifacts
    mkdir -p burn-in-failures/iteration-$i
    cp -r test-results/* burn-in-failures/iteration-$i/ 2>/dev/null || true
    cp -r playwright-report/* burn-in-failures/iteration-$i/ 2>/dev/null || true

    echo "Artifacts saved to: burn-in-failures/iteration-$i/"
  fi

  echo ""
done

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Burn-In Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total iterations: $ITERATIONS"
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo "Failed iterations: ${FAILED_ITERATIONS[*]}"
  echo ""
  echo "❌ BURN-IN FAILED"
  echo "Tests are FLAKY - fix before merging!"
  echo ""
  echo "Failure artifacts saved to: burn-in-failures/"
  exit 1
fi

echo ""
echo "✅ BURN-IN PASSED"
echo "Tests are stable across $ITERATIONS runs."
exit 0
