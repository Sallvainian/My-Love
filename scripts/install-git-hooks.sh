#!/bin/bash

# Install Overnight Dev Git Hooks
# Copies pre-commit and commit-msg hooks to .git/hooks/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "🌙 Installing Overnight Dev Git Hooks..."

# Check if we're in a git repository
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "❌ Error: Not a git repository"
    exit 1
fi

# Copy hooks
cp "$SCRIPT_DIR/git-hooks/pre-commit" "$HOOKS_DIR/pre-commit"
cp "$SCRIPT_DIR/git-hooks/commit-msg" "$HOOKS_DIR/commit-msg"

# Make hooks executable
chmod +x "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/commit-msg"

echo "✅ Git hooks installed successfully!"
echo ""
echo "Hooks installed:"
echo "  - pre-commit: Runs linting and tests"
echo "  - commit-msg: Enforces conventional commit format"
echo ""
echo "Configuration: .overnight-dev.json"
echo ""
echo "To test the hooks:"
echo "  git commit --allow-empty -m \"test: verify overnight dev hooks\""
