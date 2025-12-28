# Keeping Code in Sync Between Two Computers

This guide explains how to keep your `joule-hvac` repository synchronized between multiple computers using GitHub as the central hub.

## Quick Start

### On Computer 1 (after making changes):
```bash
./sync-to-github.sh "Your commit message"
```

### On Computer 2 (to get latest changes):
```bash
./sync-from-github.sh
```

## Detailed Workflow

### Standard Workflow

**1. On Computer A (where you made changes):**
```bash
cd ~/git/joule-hvac

# Stage all changes
git add -A

# Commit with a descriptive message
git commit -m "Add new feature X"

# Push to GitHub
git push origin main
```

**2. On Computer B (to get the changes):**
```bash
cd ~/git/joule-hvac

# Pull latest changes
git pull origin main
```

### If You Have Uncommitted Changes

**On Computer B before pulling:**
```bash
# Option 1: Commit your changes first
git add -A
git commit -m "WIP: my changes"
git pull origin main

# Option 2: Stash your changes temporarily
git stash
git pull origin main
git stash pop  # Reapply your changes

# Option 3: Discard local changes (if you don't need them)
git reset --hard HEAD
git pull origin main
```

## Handling Conflicts

If both computers modified the same file:

```bash
# On Computer B after git pull:
# Git will show conflict markers like:
# <<<<<<< HEAD
# your changes
# =======
# changes from GitHub
# >>>>>>> origin/main

# Edit the file to resolve conflicts, then:
git add <conflicted-file>
git commit -m "Resolve merge conflict"
git push origin main
```

## Best Practices

1. **Always pull before starting work:**
   ```bash
   git pull origin main
   ```

2. **Commit and push frequently:**
   - Don't let changes accumulate
   - Push at least once per day

3. **Use descriptive commit messages:**
   ```bash
   git commit -m "Fix pairing timeout issue in bridge server"
   ```

4. **Check status before pushing:**
   ```bash
   git status
   git log --oneline -5  # See recent commits
   ```

## Authentication Setup

If you get authentication errors:

**Option 1: Use SSH (Recommended)**
```bash
# Change remote to SSH
git remote set-url origin git@github.com:kthomasking-debug/joule-hvac.git

# Generate SSH key if needed
ssh-keygen -t ed25519 -C "your_email@example.com"
# Add ~/.ssh/id_ed25519.pub to GitHub Settings > SSH Keys
```

**Option 2: Use Personal Access Token**
```bash
# When prompted for password, use a GitHub Personal Access Token
# Create one at: https://github.com/settings/tokens
# Scope: repo (full control)
```

**Option 3: Use GitHub CLI**
```bash
# Install: sudo apt install gh
gh auth login
```

## Helper Scripts

Two scripts are provided:

- **`sync-to-github.sh`** - Automatically commits and pushes changes
- **`sync-from-github.sh`** - Safely pulls latest changes

Make them executable:
```bash
chmod +x sync-to-github.sh sync-from-github.sh
```

## Troubleshooting

**"Your branch is ahead of origin/main"**
- Just push: `git push origin main`

**"Your branch is behind origin/main"**
- Pull first: `git pull origin main`

**"Updates were rejected"**
- Someone else pushed. Pull first: `git pull origin main`, then push again

**"Authentication failed"**
- Set up SSH keys or use a Personal Access Token (see above)

