#!/bin/bash
# Documentation Audit Script
# Analyzes all markdown files and outputs structured JSON for review

set -e

PROJECT_ROOT="/home/sallvain/dev/personal/My-Love"
OUTPUT_FILE="$PROJECT_ROOT/docs/audit-report.json"

# Collect all files first to avoid subshell variable scope issue
mapfile -d '' files < <(find "$PROJECT_ROOT" -name "*.md" -type f \
  ! -path "*/.git/*" \
  ! -path "*/node_modules/*" \
  ! -path "*/.bmad/*" \
  ! -path "*/.claude/commands/*" \
  ! -path "*/.claude/agents/*" \
  ! -path "*/.github/*" \
  -print0 | sort -z)

total_count=${#files[@]}

echo "{"
echo '  "generated_at": "'$(date -Iseconds)'",'
echo '  "files": ['

first=true

for file in "${files[@]}"; do
  [ -z "$file" ] && continue

  rel_path="${file#$PROJECT_ROOT/}"
  size=$(stat -c %s "$file" 2>/dev/null || echo 0)
  modified=$(stat -c %Y "$file" 2>/dev/null || echo 0)
  modified_human=$(date -d "@$modified" +%Y-%m-%d 2>/dev/null || echo "unknown")

  # Git history check
  git_commits=$(cd "$PROJECT_ROOT" && git log --oneline -- "$rel_path" 2>/dev/null | wc -l)
  last_commit_date=$(cd "$PROJECT_ROOT" && git log -1 --format="%cs" -- "$rel_path" 2>/dev/null || echo "untracked")

  # Content analysis
  word_count=$(wc -w < "$file" 2>/dev/null || echo 0)
  has_todo=$(grep -i "TODO\|FIXME\|WIP" "$file" > /dev/null 2>&1 && echo true || echo false)
  has_outdated_markers=$(grep -i "deprecated\|obsolete\|old version\|no longer" "$file" > /dev/null 2>&1 && echo true || echo false)

  # Age calculation
  days_old=$(( ($(date +%s) - modified) / 86400 ))

  # Determine category hint
  category="needs_review"
  if [ "$git_commits" -eq 0 ]; then
    category="untracked_new"
  elif [ "$days_old" -gt 60 ]; then
    category="potentially_stale"
  elif [ "$has_outdated_markers" = "true" ]; then
    category="marked_outdated"
  fi

  if [ "$first" = "true" ]; then
    first=false
  else
    echo ","
  fi

  cat << EOJSON
    {
      "path": "$rel_path",
      "size_bytes": $size,
      "word_count": $word_count,
      "modified_date": "$modified_human",
      "days_old": $days_old,
      "git_commits": $git_commits,
      "last_commit": "$last_commit_date",
      "has_todo_markers": $has_todo,
      "has_outdated_markers": $has_outdated_markers,
      "category_hint": "$category"
    }
EOJSON

done

echo ""
echo "  ],"
echo "  \"total_files\": $total_count"
echo "}"
