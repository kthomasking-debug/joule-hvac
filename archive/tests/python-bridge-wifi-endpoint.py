#!/usr/bin/env python3
"""
WiFi Signal Strength Endpoint for Joule Bridge
Add this to your Node.js bridge or run as separate service on Pi
"""

import subprocess
import re
from flask import Flask, jsonify

app = Flask(__name__)

def get_wifi_signal():
    """
    Read WiFi signal strength from iwconfig and convert to 0-3 bars
    Returns: dict with bars (0-3), dbm, and quality percentage
    """
    try:
        result = subprocess.check_output(['iwconfig', 'wlan0'], stderr=subprocess.DEVNULL).decode()
        
        # Extract signal level in dBm
        dbm_match = re.search(r'Signal level=(-?\d+) dBm', result)
        if dbm_match:
            dbm = int(dbm_match.group(1))
            
            # Convert dBm to bars (0-3)
            # -50 dBm or better = excellent (3 bars)
            # -60 dBm = good (2 bars)
            # -70 dBm = fair (1 bar)
            # Below -70 dBm = poor (0 bars)
            if dbm >= -50:
                bars = 3
            elif dbm >= -60:
                bars = 2
            elif dbm >= -70:
                bars = 1
            else:
                bars = 0
            
            # Calculate quality percentage (dBm to %)
            # -30 dBm = 100%, -90 dBm = 0%
            quality = max(0, min(100, 2 * (dbm + 100)))
            
            return {
                'bars': bars,
                'dbm': dbm,
                'quality': quality,
                'interface': 'wlan0'
            }
        
        # Fallback: try to get Link Quality instead
        quality_match = re.search(r'Link Quality=(\d+)/(\d+)', result)
        if quality_match:
            current = int(quality_match.group(1))
            maximum = int(quality_match.group(2))
            quality_pct = int((current / maximum) * 100)
            
            # Convert quality to bars
            if quality_pct >= 75:
                bars = 3
            elif quality_pct >= 50:
                bars = 2
            elif quality_pct >= 25:
                bars = 1
            else:
                bars = 0
            
            return {
                'bars': bars,
                'quality': quality_pct,
                'interface': 'wlan0'
            }
        
        return {'bars': 0, 'error': 'Could not parse signal'}
        
    except subprocess.CalledProcessError:
        return {'bars': 0, 'error': 'iwconfig failed'}
    except FileNotFoundError:
        return {'bars': 0, 'error': 'iwconfig not found'}
    except Exception as e:
        return {'bars': 0, 'error': str(e)}

@app.route('/api/wifi/signal', methods=['GET'])
def wifi_signal():
    """Endpoint that returns WiFi signal strength"""
    signal_data = get_wifi_signal()
    return jsonify(signal_data)

if __name__ == '__main__':
    # Test locally
    print("Testing WiFi signal detection:")
    print(get_wifi_signal())
    
    # Run as service (optional)
    # app.run(host='0.0.0.0', port=3003)
