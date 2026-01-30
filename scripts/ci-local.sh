#!/bin/bash
# ci-local.sh - Mirror CI pipeline locally for debugging
# Usage: ./scripts/ci-local.sh [--skip-lint] [--skip-unit]

set -e

SKIP_LINT=false
SKIP_UNIT=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-lint) SKIP_LINT=true ;;
    --skip-unit) SKIP_UNIT=true ;;
    --help)
      echo "Usage: ./scripts/ci-local.sh [options]"
      echo ""
      echo "Options:"
      echo "  --skip-lint   Skip lint and type check"
      echo "  --skip-unit   Skip unit tests"
      echo "  --help        Show this help"
      exit 0
      ;;
  esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Running CI Pipeline Locally"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stage 1: Lint & Type Check
if [ "$SKIP_LINT" = false ]; then
  echo "📋 Stage 1: Lint & Type Check"
  echo "--------------------------------------------"

  echo "Running ESLint..."
  npm run lint || { echo "❌ Lint failed"; exit 1; }

  echo "Running TypeScript type check..."
  npm run typecheck || { echo "❌ Type check failed"; exit 1; }

  echo "Checking formatting..."
  npm run format:check || { echo "❌ Format check failed"; exit 1; }

  echo "✅ Lint & Type Check passed"
  echo ""
else
  echo "⏭️  Skipping lint (--skip-lint)"
  echo ""
fi

# Stage 2: Unit Tests
if [ "$SKIP_UNIT" = false ]; then
  echo "🧪 Stage 2: Unit Tests"
  echo "--------------------------------------------"

  npm run test:unit || { echo "❌ Unit tests failed"; exit 1; }

  echo "✅ Unit tests passed"
  echo ""
else
  echo "⏭️  Skipping unit tests (--skip-unit)"
  echo ""
fi

# Stage 3: E2E Tests
echo "🎭 Stage 3: E2E Tests"
echo "--------------------------------------------"

npm run test:e2e || { echo "❌ E2E tests failed"; exit 1; }

echo "✅ E2E tests passed"
echo ""

# Stage 4: Burn-in (reduced iterations for local)
echo "🔥 Stage 4: Burn-in (3 iterations)"
echo "--------------------------------------------"

for i in {1..3}; do
  echo "Burn-in iteration $i/3..."
  npm run test:e2e:raw || { echo "❌ Burn-in failed on iteration $i"; exit 1; }
done

echo "✅ Burn-in passed (3/3)"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Local CI Pipeline Passed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your changes are ready for CI!"
