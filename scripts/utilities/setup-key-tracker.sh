#!/bin/bash
# Setup script for Tailscale Key Tracker

echo "🔧 Setting up Tailscale Key Tracker..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Install required Python packages
echo "📦 Installing required packages..."
pip3 install icalendar --user || pip3 install ics --user

# Make script executable
chmod +x "$(dirname "$0")/tailscale-key-tracker.py"

# Create cron job for daily checks
CRON_JOB="0 9 * * * cd $(dirname "$0") && python3 tailscale-key-tracker.py alert >> ~/.joule-key-tracker.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "tailscale-key-tracker.py alert"; then
    echo "✅ Cron job already exists"
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Added daily cron job (runs at 9 AM)"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Usage:"
echo "   # Add a new device:"
echo "   python3 scripts/tailscale-key-tracker.py add --customer 'John Doe' --email 'john@example.com' --date '2025-12-28'"
echo ""
echo "   # Generate calendar file:"
echo "   python3 scripts/tailscale-key-tracker.py calendar"
echo ""
echo "   # Check status:"
echo "   python3 scripts/tailscale-key-tracker.py check"
echo ""
echo "   # List all devices:"
echo "   python3 scripts/tailscale-key-tracker.py list"
echo ""
echo "📧 Email alerts:"
echo "   Set SMTP_PASSWORD environment variable for email alerts:"
echo "   export SMTP_PASSWORD='your-gmail-app-password'"
echo "   (Add to ~/.bashrc or ~/.zshrc to make permanent)"

