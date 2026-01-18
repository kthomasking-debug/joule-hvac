#!/usr/bin/env python3
"""
Test script to verify HomeKit bridge can start and get device_id
"""

import asyncio
import aiohttp
import sys

BRIDGE_API_URL = "http://localhost:8080"

async def get_paired_devices():
    """Get list of paired devices from bridge API"""
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{BRIDGE_API_URL}/api/paired"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get('devices', [])
                else:
                    print(f"Failed to get paired devices: HTTP {resp.status}")
                    return []
    except Exception as e:
        print(f"Error getting paired devices: {e}")
        return []

async def main():
    print("=" * 60)
    print("HomeKit Bridge Test - Get Device ID")
    print("=" * 60)
    print()
    
    print(f"Checking bridge API at {BRIDGE_API_URL}...")
    devices = await get_paired_devices()
    
    if not devices:
        print("❌ No paired devices found")
        print()
        print("To pair a device:")
        print("1. Make sure the bridge server is running (server.py)")
        print("2. Pair your Ecobee via the web UI or API")
        print("3. Then run this script again")
        sys.exit(1)
    
    print(f"✅ Found {len(devices)} paired device(s):")
    for device in devices:
        device_id = device.get('device_id')
        name = device.get('name', 'Unknown')
        print(f"   - {name} (device_id: {device_id})")
    
    print()
    print("To start the HomeKit bridge:")
    print(f"   python3 homekit_bridge.py {devices[0]['device_id']}")
    print()
    print("Or set environment variable:")
    print(f"   export ECOBEE_DEVICE_ID={devices[0]['device_id']}")
    print("   python3 homekit_bridge.py")

if __name__ == '__main__':
    asyncio.run(main())






