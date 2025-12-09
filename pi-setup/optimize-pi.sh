#!/bin/bash
# Optimize Raspberry Pi 5 for better performance
# Adds overclocking and cooling optimizations

set -e

echo "⚡ Optimizing Raspberry Pi 5 for Joule RAG..."

# Check if config.txt exists
if [ ! -f /boot/firmware/config.txt ] && [ ! -f /boot/config.txt ]; then
    echo "⚠️  Warning: Could not find config.txt. This script may not work on your Pi."
    exit 1
fi

CONFIG_FILE="/boot/firmware/config.txt"
if [ ! -f "$CONFIG_FILE" ]; then
    CONFIG_FILE="/boot/config.txt"
fi

# Backup config
echo "💾 Backing up config.txt..."
sudo cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

# Add overclocking settings (mild OC to 2.8 GHz)
echo "⚡ Adding overclocking settings..."
if ! grep -q "# Joule RAG Optimizations" "$CONFIG_FILE"; then
    sudo tee -a "$CONFIG_FILE" > /dev/null <<EOF

# Joule RAG Optimizations
# Mild overclock to 2.8 GHz for better LLM performance
arm_freq=2800
gpu_freq=750
over_voltage=2
# Enable turbo mode
force_turbo=0
# Better thermal management
temp_limit=80
EOF
    echo "✅ Overclocking settings added"
else
    echo "✅ Overclocking settings already present"
fi

# Install temperature monitoring
echo "🌡️  Setting up temperature monitoring..."
sudo apt-get install -y lm-sensors

# Create temperature check script
sudo tee /usr/local/bin/check-pi-temp > /dev/null <<'EOF'
#!/bin/bash
vcgencmd measure_temp
EOF
sudo chmod +x /usr/local/bin/check-pi-temp

echo ""
echo "✅ Optimization complete!"
echo ""
echo "⚠️  IMPORTANT:"
echo "1. Make sure you have adequate cooling (heatsink + fan)"
echo "2. Reboot for changes to take effect: sudo reboot"
echo "3. Monitor temperature: check-pi-temp"
echo "4. If you see throttling, reduce overclock or improve cooling"
echo ""





