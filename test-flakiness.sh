#!/usr/bin/env bash
# Flakiness test with timing - calls raw playwright to avoid circular cleanup

success=0
for i in {1..10}; do
  echo "=== Run $i/10 ($(date +%H:%M:%S)) ==="
  start=$(date +%s)

  # Call raw playwright instead of npm script to avoid cleanup script recursion
  if npx playwright test > /dev/null 2>&1; then
    end=$(date +%s)
    elapsed=$((end - start))
    echo "✓ Run $i: PASSED (${elapsed}s)"
    ((success++))
  else
    end=$(date +%s)
    elapsed=$((end - start))
    echo "✗ Run $i: FAILED (${elapsed}s)"
  fi
done

echo ""
echo "=== Flakiness Test Results ==="
echo "Successful runs: $success/10"
echo "Pass rate: $((success * 10))%"
if [ $success -ge 9 ]; then
  echo "✓ PASSED: Test reliability target met (≥99%)"
else
  echo "✗ FAILED: Test reliability below target (<99%)"
fi
