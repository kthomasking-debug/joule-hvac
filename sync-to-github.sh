#!/bin/bash
# Sync local changes to GitHub
# Usage: ./sync-to-github.sh [commit-message]

set -e

cd "$(dirname "$0")"

echo "🔄 Syncing to GitHub..."

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "📝 Staging all changes..."
    git add -A
    
    if [ -n "$1" ]; then
        COMMIT_MSG="$1"
    else
        COMMIT_MSG="Update from $(hostname) - $(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    echo "💾 Committing: $COMMIT_MSG"
    git commit -m "$COMMIT_MSG"
fi

# Check if ahead of origin
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
if [ "$AHEAD" -gt 0 ]; then
    echo "⬆️  Pushing $AHEAD commit(s) to GitHub..."
    git push origin main
    echo "✅ Pushed to GitHub successfully!"
else
    echo "✅ Already in sync with GitHub"
fi

# Show status
echo ""
echo "📊 Current status:"
git status -sb

