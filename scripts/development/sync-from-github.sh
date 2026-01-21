#!/bin/bash
# Pull latest changes from GitHub
# Usage: ./sync-from-github.sh

set -e

cd "$(dirname "$0")"

echo "🔄 Syncing from GitHub..."

# Fetch latest changes
echo "📥 Fetching from GitHub..."
git fetch origin

# Check if we're behind
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
if [ "$BEHIND" -gt 0 ]; then
    echo "⬇️  Pulling $BEHIND new commit(s)..."
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo "⚠️  You have uncommitted changes!"
        echo "Options:"
        echo "  1. Commit them first: git add -A && git commit -m 'message'"
        echo "  2. Stash them: git stash"
        echo "  3. Discard them: git reset --hard HEAD"
        exit 1
    fi
    
    git pull origin main
    echo "✅ Synced from GitHub successfully!"
else
    echo "✅ Already up to date with GitHub"
fi

# Show status
echo ""
echo "📊 Current status:"
git status -sb

