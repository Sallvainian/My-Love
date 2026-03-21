#!/usr/bin/env bash
# Dead code analysis using tsr (TypeScript Remove)
# Filters out known false positives:
#   - React.lazy dynamic imports (tsr can't follow import().then() chains)
#   - Auto-generated database.types.ts
#   - Vitest setup files (configured in vitest.config.ts, not imported)
#
# Usage: npm run deadcode

set -uo pipefail

# Base entrypoints
entrypoints=(
  'src/main\.tsx$'
  'src/sw\.ts$'
  'tests/.*\.test\.tsx?$'
  'tests/.*\.spec\.ts$'
  'src/.*__tests__/.*\.test\.tsx?$'
  'tests/support/.*\.ts$'
)

# Collect dynamically-imported file basenames for exclusion
declare -a lazy_names=()

while IFS= read -r import_path; do
  # Extract just the final path segment (e.g. 'PhotoGallery' from './components/PhotoGallery/PhotoGallery')
  basename=$(echo "$import_path" | sed "s|'||g" | awk -F/ '{print $NF}')
  if [[ -n "$basename" && "$basename" != "virtual:pwa-register" ]]; then
    lazy_names+=("$basename")
  fi
done < <(grep -ohrE "import\('[^']+'\)" src/ | grep -oE "'[^']+'" | sort -u)

# Build grep exclusion pattern
# Start with known false positives
exclude_parts=(
  "database[.]types[.]ts"
  "tests/setup[.]ts"
  # Barrel files where consumers import sub-modules directly (not dead, just bypassed)
  "validation/index[.]ts"
  # Hooks barrel — useFocusTrap and useNetworkStatus are imported through it
  "hooks/index[.]ts"
)

# Add lazy-imported component names
for name in "${lazy_names[@]}"; do
  exclude_parts+=("$name")
done

# Join patterns with |
exclude_regex=$(printf '%s|' "${exclude_parts[@]}")
exclude_regex="${exclude_regex%|}"  # trim trailing |

# Run tsr
output=$(npx tsr --project tsconfig.tsr.json "${entrypoints[@]}" 2>&1)
tsr_exit=$?

# Show header line (tsconfig + project info)
echo "$output" | head -2

# Filter and show results
filtered_output=$(echo "$output" | tail -n +3 | grep -Ev "$exclude_regex" || true)
echo "$filtered_output"

# Count stats
total=$(echo "$output" | grep -E -c '^(export|file)' || true)
filtered=$(echo "$filtered_output" | grep -E -c '^(export|file)' || true)
hidden=$((total - filtered))

echo ""
echo "--- $filtered issues found ($hidden false positives filtered out) ---"

if [[ "$filtered" -gt 0 ]]; then
  exit "$tsr_exit"
else
  exit 0
fi
