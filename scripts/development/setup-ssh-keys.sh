#!/bin/bash
# Setup SSH keys for passwordless access to mini PC

MINI_PC="tom-pc@192.168.0.106"

echo "🔑 Setting up SSH key authentication..."
echo ""

# Check if SSH key exists
if [ ! -f ~/.ssh/id_rsa ] && [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "📝 Generating SSH key..."
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
    echo ""
fi

# Find the public key
if [ -f ~/.ssh/id_ed25519.pub ]; then
    PUB_KEY=~/.ssh/id_ed25519.pub
elif [ -f ~/.ssh/id_rsa.pub ]; then
    PUB_KEY=~/.ssh/id_rsa.pub
else
    echo "❌ No SSH public key found"
    exit 1
fi

echo "📋 Public key to copy:"
cat $PUB_KEY
echo ""
echo ""
echo "Now you need to copy this key to the mini PC."
echo ""
echo "Option 1: Manual copy (you'll need to enter password once):"
echo "  ssh-copy-id -i $PUB_KEY $MINI_PC"
echo ""
echo "Option 2: Manual steps:"
echo "  1. Copy the public key above"
echo "  2. SSH to mini PC: ssh $MINI_PC"
echo "  3. Run: mkdir -p ~/.ssh && chmod 700 ~/.ssh"
echo "  4. Run: echo 'PASTE_PUBLIC_KEY_HERE' >> ~/.ssh/authorized_keys"
echo "  5. Run: chmod 600 ~/.ssh/authorized_keys"
echo ""
read -p "Press Enter to try automatic copy (will prompt for password once)..."

ssh-copy-id -i $PUB_KEY $MINI_PC

echo ""
echo "✅ Testing passwordless SSH..."
ssh $MINI_PC "echo 'Passwordless SSH works!'"

echo ""
echo "✨ SSH key setup complete! You can now run commands without passwords."




