#!/usr/bin/env python3
"""
Test script to check Blueair connection and get device data
"""
import asyncio
import sys
import os

# Add parent directory to path to import blueair_api
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from blueair_api import get_devices
except ImportError:
    print("ERROR: blueair-api not installed. Install with: pip install blueair-api")
    sys.exit(1)

async def test_blueair():
    username = os.getenv('BLUEAIR_USERNAME', 'bunnyrita@gmail.com')
    password = os.getenv('BLUEAIR_PASSWORD', '12345678')
    
    if not username or not password:
        print("ERROR: BLUEAIR_USERNAME and BLUEAIR_PASSWORD must be set")
        print(f"Current username: {username if username else 'NOT SET'}")
        sys.exit(1)
    
    print("=" * 60)
    print("Testing Blueair Connection")
    print("=" * 60)
    print(f"Username: {username}")
    print(f"Password: {'*' * len(password)}")
    print()
    
    try:
        print("Connecting to Blueair API...")
        devices = await get_devices(username=username, password=password)
        
        print(f"✓ Connected! Found {len(devices)} device(s)")
        print()
        
        for i, device in enumerate(devices):
            print(f"Device {i}:")
            print(f"  Type: {type(device)}")
            print(f"  Dir: {[attr for attr in dir(device) if not attr.startswith('_')]}")
            print()
            
            # Try to get device attributes
            device_info = {}
            for attr in ['name', 'mac_address', 'model', 'device_id', 'id']:
                if hasattr(device, attr):
                    value = getattr(device, attr)
                    device_info[attr] = value
                    print(f"  {attr}: {value}")
            
            print()
            
            # Try to get status
            print("  Attempting to get device status...")
            try:
                if hasattr(device, 'get_status'):
                    status = await device.get_status()
                    print(f"  Status (from get_status): {status}")
                elif hasattr(device, 'status'):
                    status = device.status
                    print(f"  Status (from property): {status}")
                else:
                    print("  No status method found")
            except Exception as e:
                print(f"  Error getting status: {e}")
            
            print()
            
            # Try to get sensors
            print("  Attempting to get sensor data...")
            try:
                if hasattr(device, 'get_sensors'):
                    sensors = await device.get_sensors()
                    print(f"  Sensors (from get_sensors): {sensors}")
                elif hasattr(device, 'sensors'):
                    sensors = device.sensors
                    print(f"  Sensors (from property): {sensors}")
                else:
                    print("  No sensors method found")
            except Exception as e:
                print(f"  Error getting sensors: {e}")
            
            print()
            
            # Try to get current settings
            print("  Attempting to get current settings...")
            for attr in ['fan_speed', 'led_brightness', 'mode', 'filter_life']:
                if hasattr(device, attr):
                    try:
                        value = getattr(device, attr)
                        print(f"  {attr}: {value}")
                    except Exception as e:
                        print(f"  {attr}: Error accessing - {e}")
            
            print()
            print("-" * 60)
            print()
        
        print("=" * 60)
        print("Test Complete")
        print("=" * 60)
        
    except Exception as e:
        print(f"ERROR: Failed to connect to Blueair: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(test_blueair())


