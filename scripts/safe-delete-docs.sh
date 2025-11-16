#!/bin/bash
# Safe Documentation Deletion Script
# Moves files to .trash/ directory instead of permanent deletion
# Creates backup and logs all operations

set -e

PROJECT_ROOT="/home/sallvain/dev/personal/My-Love"
TRASH_DIR="$PROJECT_ROOT/.trash/docs-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$PROJECT_ROOT/docs/deletion-log.md"
CONFIRM=false

usage() {
    echo "Usage: $0 [--confirm] [--list] <file_or_pattern>"
    echo ""
    echo "Options:"
    echo "  --confirm    Actually move files to trash (default: dry-run)"
    echo "  --list       List files that would be deleted from report"
    echo ""
    echo "Examples:"
    echo "  $0 --list                           # Show deletion candidates"
    echo "  $0 docs/old-file.md                 # Dry-run single file"
    echo "  $0 --confirm docs/old-file.md       # Move file to trash"
    echo "  $0 --confirm 'docs/sprint-artifacts/*.context.xml'  # Pattern deletion"
}

if [ "$1" = "--help" ] || [ -z "$1" ]; then
    usage
    exit 0
fi

if [ "$1" = "--list" ]; then
    echo "=== DELETE CANDIDATES ==="
    if [ -f "$PROJECT_ROOT/docs/documentation-cleanup-report.json" ]; then
        python3 -c "
import json
with open('$PROJECT_ROOT/docs/documentation-cleanup-report.json') as f:
    data = json.load(f)
for item in data['categories']['DELETE_CANDIDATE']:
    print(f\"{item['path']} ({item['reason']})\")
"
    else
        echo "Run analysis tools first to generate report"
    fi
    exit 0
fi

if [ "$1" = "--confirm" ]; then
    CONFIRM=true
    shift
fi

if [ -z "$1" ]; then
    echo "Error: No file or pattern specified"
    usage
    exit 1
fi

# Create trash directory
if [ "$CONFIRM" = "true" ]; then
    mkdir -p "$TRASH_DIR"
    echo "# Deletion Log - $(date)" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
fi

# Process files
for pattern in "$@"; do
    for file in $pattern; do
        if [ -f "$file" ]; then
            rel_path="${file#$PROJECT_ROOT/}"

            if [ "$CONFIRM" = "true" ]; then
                # Create directory structure in trash
                target_dir="$TRASH_DIR/$(dirname "$rel_path")"
                mkdir -p "$target_dir"

                # Move to trash
                mv "$file" "$target_dir/"
                echo "MOVED: $rel_path -> .trash/"

                # Log the deletion
                echo "- [$(date +%H:%M:%S)] Moved \`$rel_path\` to trash" >> "$LOG_FILE"
            else
                echo "DRY-RUN: Would move $rel_path to trash"
            fi
        else
            echo "SKIP: $file (not found or not a file)"
        fi
    done
done

if [ "$CONFIRM" = "true" ]; then
    echo ""
    echo "Files moved to: $TRASH_DIR"
    echo "To restore: mv $TRASH_DIR/<file> <original_location>"
    echo ""
    echo "Log appended to: $LOG_FILE"
fi
