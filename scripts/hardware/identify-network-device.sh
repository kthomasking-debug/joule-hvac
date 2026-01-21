#!/bin/bash
# identify-network-device.sh
# Helper script to identify a device on your network

IP="${1:-192.168.0.104}"
MAC="${2:-FE-B6-68-2D-88-A7}"

echo "=========================================="
echo "Network Device Identifier"
echo "=========================================="
echo "IP Address: $IP"
echo "MAC Address: $MAC"
echo ""

# Check if device is online
echo "1. Checking if device is online..."
if ping -c 1 -W 2 "$IP" > /dev/null 2>&1; then
    echo "   ✓ Device is online and responding to ping"
else
    echo "   ✗ Device is not responding to ping"
    echo "   (It may still be online but blocking ICMP)"
fi
echo ""

# Check MAC vendor
echo "2. Looking up MAC vendor..."
VENDOR=$(curl -s "https://api.macvendors.com/$MAC" 2>/dev/null)
if [ -n "$VENDOR" ] && [ "$VENDOR" != "Not Found" ]; then
    echo "   ✓ Vendor: $VENDOR"
else
    echo "   ? Vendor: Unknown or not found in database"
fi
echo ""

# Port scan
echo "3. Scanning common ports..."
if command -v nmap &> /dev/null; then
    echo "   Scanning ports 80, 443, 8080, 8443..."
    nmap -p 80,443,8080,8443 "$IP" 2>/dev/null | grep -E "(PORT|open|closed|filtered)" | head -10
else
    echo "   (nmap not installed - skipping port scan)"
    echo "   Install with: sudo apt-get install nmap"
fi
echo ""

# Try HTTP access
echo "4. Testing HTTP access..."
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://$IP" 2>/dev/null)
if [ "$HTTP_RESPONSE" != "000" ] && [ "$HTTP_RESPONSE" != "" ]; then
    echo "   ✓ HTTP response: $HTTP_RESPONSE"
    echo "   Try opening: http://$IP in your browser"
else
    echo "   ✗ No HTTP response"
fi
echo ""

# Try HTTPS access
echo "5. Testing HTTPS access..."
HTTPS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 -k "https://$IP" 2>/dev/null)
if [ "$HTTPS_RESPONSE" != "000" ] && [ "$HTTPS_RESPONSE" != "" ]; then
    echo "   ✓ HTTPS response: $HTTPS_RESPONSE"
    echo "   Try opening: https://$IP in your browser (may show certificate warning)"
else
    echo "   ✗ No HTTPS response"
fi
echo ""

# Network info
echo "6. Network information..."
if command -v arp &> /dev/null; then
    ARP_ENTRY=$(arp -n "$IP" 2>/dev/null | grep "$IP")
    if [ -n "$ARP_ENTRY" ]; then
        echo "   ARP entry found:"
        echo "   $ARP_ENTRY"
    fi
fi
echo ""

# Recommendations
echo "=========================================="
echo "Recommendations:"
echo "=========================================="
echo "1. Check your router's admin panel for device details"
echo "2. Unplug your Blueair and see if this device disappears"
echo "3. Check the Blueair mobile app for device IP address"
echo "4. Try accessing http://$IP in a web browser"
echo ""
echo "If this is your Blueair:"
echo "- The device connects via WiFi to your network"
echo "- Control is through Blueair's cloud API (not local network)"
echo "- Set BLUEAIR_USERNAME and BLUEAIR_PASSWORD in bridge service"
echo "- Verify connection: curl http://192.168.0.106:8080/api/blueair/status"
echo ""


