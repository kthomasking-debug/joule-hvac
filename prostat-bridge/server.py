#!/usr/bin/env python3
"""
ProStat Bridge - HomeKit HAP Controller + Relay Control
Raspberry Pi 3/Zero 2 W backend service for hybrid thermostat control

This service:
1. Acts as a HomeKit controller for Ecobee (software control)
2. Controls dehumidifier via USB relay module (hardware control)
3. Implements advanced interlock logic (Free Dry, etc.)

Requirements:
    pip install aiohomekit aiohttp pyserial

Usage:
    python server.py
"""

import asyncio
import json
import logging
import os
import shutil
import tempfile
from pathlib import Path
from aiohomekit.controller import Controller
from aiohomekit.exceptions import AccessoryNotFoundError, AlreadyPairedError
from aiohttp import web, web_runner
import aiohttp_cors
import serial
import serial.tools.list_ports
from datetime import datetime
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceBrowser
from zeroconf import ServiceInfo
import socket
# Blueair API import (optional - service works without it)
try:
    from blueair_api import get_devices
    BLUEAIR_AVAILABLE = True
except ImportError:
    BLUEAIR_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global controller instance
controller = None
async_zeroconf = None  # Global AsyncZeroconf instance
pairings = {}  # device_id -> pairing object
device_info = {}  # device_id -> device info cache
discovered_devices = {}  # device_id -> IpDiscovery object

# Cache for discovered characteristic IDs
# format: device_id -> {'aid': 1, 'temp_target': 11, 'target_state': 12, ...}
device_characteristics_cache = {}

# Relay control
relay_port = None
relay_connected = False
relay_channel = 2  # Default: Relay 2 for dehumidifier (Y2 terminal)

# Blueair control
blueair_account = None
blueair_devices = []
blueair_connected = False
blueair_local_ip = None  # For local ESP32 devices (cached IP)
blueair_local_mode = False  # True = local ESP32, False = cloud API
blueair_mac_address = None  # MAC address for auto-discovery (e.g., "D0-EF-76-1B-B8-1C")
blueair_last_discovery = None  # Timestamp of last discovery attempt
blueair_esp32_username = None  # ESP32 API username
blueair_esp32_password = None  # ESP32 API password

# TP-Link control
tplink_devices = []  # List of discovered TP-Link devices: [{'ip': '192.168.0.100', 'alias': 'Smart Plug', 'device_id': '...', ...}]
tplink_kasa_available = False
try:
    from kasa import SmartDevice, Discover
    tplink_kasa_available = True
except ImportError:
    tplink_kasa_available = False
    logger.debug("python-kasa not available - TP-Link features disabled")

# HomeKit Bridge (for exposing devices as accessories)
homekit_bridge_driver = None
homekit_bridge_enabled = True  # Set to False to disable HomeKit bridge

# Import HomeKit bridge components (optional - only if HAP-python is installed)
try:
    from homekit_bridge import create_bridge
    HAP_PYTHON_AVAILABLE = True
except ImportError:
    HAP_PYTHON_AVAILABLE = False
    logger.warning("HAP-python not available - HomeKit bridge features disabled")

# Config file path for Blueair credentials
CONFIG_DIR = Path(__file__).parent / 'data'
BLUEAIR_CONFIG_FILE = CONFIG_DIR / 'blueair_config.json'

# System state for interlock logic
system_state = {
    'indoor_temp': None,
    'indoor_humidity': None,
    'outdoor_temp': None,
    'hvac_mode': 'off',  # 'off', 'heat', 'cool'
    'hvac_running': False,
    'hvac_fan_running': False,  # Fan-only mode
    'dehumidifier_on': False,
    'occupancy': False,  # From Ecobee motion sensor
    'blueair_fan_speed': 0,  # 0-3 (0=off, 1=low, 2=med, 3=max)
    'blueair_led_brightness': 100,  # 0-100
    'last_update': None,
}

# Interlock state tracking
interlock_state = {
    'dust_kicker_active': False,
    'dust_kicker_start_time': None,
    'noise_cancellation_active': False,
}

# Characteristic IDs for Ecobee (these may need adjustment based on actual device)
# Common HomeKit characteristics:
# Current Temperature: (aid, iid) where aid=1, iid=10 typically
# Target Temperature: aid=1, iid=11
# Target Heating Cooling State: aid=1, iid=12
# Current Heating Cooling State: aid=1, iid=13

ECOBEE_AID = 1  # Accessory ID (usually 1 for main accessory)
ECOBEE_TEMP_CURRENT = 10  # Current Temperature
ECOBEE_TEMP_TARGET = 11    # Target Temperature
ECOBEE_TARGET_STATE = 12   # Target Heating Cooling State (0=Off, 1=Heat, 2=Cool, 3=Auto)
ECOBEE_CURRENT_STATE = 13  # Current Heating Cooling State

def save_pairing_file_atomic(pairing_file, data_to_save):
    """
    Save pairing file atomically with backup.
    
    This function:
    1. Creates a backup of the existing file (if it exists)
    2. Writes to a temporary file
    3. Atomically renames the temp file to the final location
    
    This hardens against:
    - File corruption during write (atomic rename)
    - Data loss (backup allows recovery)
    """
    import os
    
    # Create backup of existing file if it exists
    backup_file = pairing_file + '.backup'
    if os.path.exists(pairing_file):
        try:
            shutil.copy2(pairing_file, backup_file)
            logger.debug(f"Created backup: {backup_file}")
        except Exception as e:
            logger.warning(f"Failed to create backup: {e}")
            # Continue anyway - backup is best-effort
    
    # Write to temporary file first (atomic write)
    try:
        # Create temp file in same directory to ensure atomic rename works
        temp_dir = os.path.dirname(pairing_file)
        os.makedirs(temp_dir, exist_ok=True)
        
        with tempfile.NamedTemporaryFile(mode='w', dir=temp_dir, delete=False, suffix='.tmp') as f:
            temp_file = f.name
            json.dump(data_to_save, f, indent=2)
            f.flush()
            os.fsync(f.fileno())  # Force write to disk
        
        # Atomic rename (this is atomic on POSIX systems)
        os.replace(temp_file, pairing_file)
        logger.debug(f"Atomically saved pairing file: {pairing_file}")
        
        # Remove old backup if we have a new successful save
        if os.path.exists(backup_file):
            try:
                os.remove(backup_file)
            except Exception:
                pass  # Best effort cleanup
                
    except Exception as e:
        logger.error(f"Failed to save pairing file atomically: {e}")
        # Try to restore from backup if write failed
        if os.path.exists(backup_file) and not os.path.exists(pairing_file):
            try:
                shutil.copy2(backup_file, pairing_file)
                logger.info(f"Restored pairing file from backup after failed write")
            except Exception as restore_err:
                logger.error(f"Failed to restore from backup: {restore_err}")
        raise


def get_local_ip():
    """Get the local IP address for mDNS advertisement"""
    try:
        # Connect to a remote address to determine the local IP
        # This doesn't actually send data, just determines the route
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            # Connect to a public DNS server (doesn't actually connect)
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
        finally:
            s.close()
        return ip
    except Exception:
        # Fallback: try to get hostname IP
        try:
            hostname = socket.gethostname()
            ip = socket.gethostbyname(hostname)
            # Only return if it's not localhost
            if ip != '127.0.0.1':
                return ip
        except Exception:
            pass
        return None


def get_lan_ip():
    """
    Get the LAN IP address, preferring 192.168.x.x and 172.16-31.x.x over 10.x.x.x.
    Avoids returning Tailscale (100.x), Docker (172.17/18), or overlay VPN IPs
    when the user needs the local network address for router setup.
    """
    try:
        import subprocess
        result = subprocess.run(
            ['hostname', '-I'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0 and result.stdout:
            ips = result.stdout.strip().split()
            # Prefer typical home LAN ranges: 192.168.x.x, then 172.16-31.x.x
            for ip in ips:
                if ip.startswith('192.168.'):
                    return ip
            for ip in ips:
                if ip.startswith('172.') and len(ip) >= 7:
                    second = ip.split('.')[1]
                    if second.isdigit() and 16 <= int(second) <= 31:
                        return ip
            # Fallback: use first non-loopback, non-Tailscale IP
            for ip in ips:
                if not ip.startswith('127.') and not ip.startswith('100.'):
                    return ip
            return ips[0] if ips else None
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        pass
    # Fallback to get_local_ip()
    return get_local_ip()


def get_data_directory():
    """
    Get the data directory path for storing pairings and other persistent data.
    
    Priority order:
    1. JOULE_BRIDGE_DATA_DIR environment variable (if set)
    2. ~/.local/share/joule-bridge (standard user data directory)
    3. ./data relative to server.py (fallback for backward compatibility)
    
    This ensures pairing data persists even if the code location changes.
    """
    import os
    
    # Option 1: Environment variable (highest priority)
    env_data_dir = os.getenv('JOULE_BRIDGE_DATA_DIR')
    if env_data_dir:
        data_dir = os.path.expanduser(env_data_dir)
        logger.info(f"Using data directory from JOULE_BRIDGE_DATA_DIR: {data_dir}")
        return data_dir
    
    # Option 2: Standard user data directory (most robust)
    user_data_dir = os.path.expanduser('~/.local/share/joule-bridge')
    # Check if we should migrate from old location
    old_data_dir = os.path.join(os.path.dirname(__file__), 'data')
    old_pairing_file = os.path.join(old_data_dir, 'pairings.json')
    
    # If old location has pairings but new location doesn't, use old location for now
    # (migration can be added later if needed)
    if os.path.exists(old_pairing_file) and os.path.getsize(old_pairing_file) > 2:
        if not os.path.exists(os.path.join(user_data_dir, 'pairings.json')):
            logger.info(f"Found existing pairings in old location: {old_data_dir}")
            logger.info(f"Using old location for backward compatibility. Consider migrating to: {user_data_dir}")
            return old_data_dir
    
    # Use standard location
    logger.debug(f"Using standard data directory: {user_data_dir}")
    return user_data_dir


async def init_controller():
    """Initialize the HomeKit controller"""
    global controller, async_zeroconf
    try:
        # Create AsyncZeroconf instance explicitly to avoid initialization issues
        if async_zeroconf is None:
            logger.info("Creating AsyncZeroconf instance...")
            async_zeroconf = AsyncZeroconf()
            logger.info(f"AsyncZeroconf instance created: {async_zeroconf}")
            logger.info(f"AsyncZeroconf has zeroconf attr: {hasattr(async_zeroconf, 'zeroconf')}")
            if hasattr(async_zeroconf, 'zeroconf'):
                logger.info(f"AsyncZeroconf.zeroconf value: {async_zeroconf.zeroconf}")
            
            # Create AsyncServiceBrowser for _hap._tcp.local BEFORE starting controller
            # The Controller requires this browser to exist
            logger.info("Creating AsyncServiceBrowser for _hap._tcp.local...")
            from aiohomekit.zeroconf import HAP_TYPE_TCP
            
            # Create AsyncServiceBrowser for both TCP and UDP - the Controller needs both
            # Use a simple ServiceListener from zeroconf
            from zeroconf import ServiceListener
            from aiohomekit.zeroconf import HAP_TYPE_TCP, HAP_TYPE_UDP
            
            class HomeKitServiceListener(ServiceListener):
                """Simple listener for HomeKit services"""
                def add_service(self, zc, service_type, name):
                    logger.debug(f"Service added: {name}")
                def remove_service(self, zc, service_type, name):
                    logger.debug(f"Service removed: {name}")
                def update_service(self, zc, service_type, name):
                    logger.debug(f"Service updated: {name}")
            
            listener = HomeKitServiceListener()
            # Create browsers for both TCP and UDP
            hap_browser_tcp = AsyncServiceBrowser(async_zeroconf.zeroconf, HAP_TYPE_TCP, listener=listener)
            hap_browser_udp = AsyncServiceBrowser(async_zeroconf.zeroconf, HAP_TYPE_UDP, listener=listener)
            logger.info(f"AsyncServiceBrowser created for {HAP_TYPE_TCP} and {HAP_TYPE_UDP}")
        
        # Create Controller with explicit AsyncZeroconf instance
        logger.info(f"Creating HomeKit Controller with AsyncZeroconf: {async_zeroconf}")
        controller = Controller(async_zeroconf_instance=async_zeroconf)
        logger.info(f"Controller created. Controller._async_zeroconf_instance: {controller._async_zeroconf_instance}")
        logger.info("Starting HomeKit controller...")
        await controller.async_start()
        logger.info("HomeKit controller initialized successfully")
        return controller
    except Exception as e:
        logger.warning(f"HomeKit controller initialization failed: {e}")
        logger.warning("Server will continue without HomeKit support. Some endpoints may not work.")
        import traceback
        logger.warning(f"Full traceback: {traceback.format_exc()}")
        controller = None
        return None


async def discover_devices():
    """Discover HomeKit devices on the local network"""
    if not controller:
        await init_controller()
    
    if not controller:
        raise RuntimeError("HomeKit controller is not available")
    
    # Clear cache to force fresh discovery
    discovered_devices.clear()
    
    # Get bridge MAC address to filter it out from discovery
    bridge_mac = None
    if homekit_bridge_driver and hasattr(homekit_bridge_driver, 'state'):
        try:
            mac = homekit_bridge_driver.state.mac
            if isinstance(mac, bytes):
                bridge_mac = mac.decode('utf-8')
            else:
                bridge_mac = str(mac)
            # Normalize MAC address format (remove colons, convert to uppercase)
            bridge_mac_normalized = bridge_mac.replace(':', '').upper()
            logger.debug(f"Bridge MAC address: {bridge_mac} (normalized: {bridge_mac_normalized})")
        except Exception as e:
            logger.debug(f"Could not get bridge MAC address: {e}")
    
    logger.info("Scanning for HomeKit devices...")
    devices = controller.async_discover()
    
    result = []
    seen_device_ids = set()  # Track seen device IDs to avoid duplicates
    seen_names = set()  # Track seen device names to deduplicate
    
    async for device in devices:
        # IpDiscovery objects have 'id' attribute, not 'device_id'
        # The device ID is typically in device.id or device.description.id
        device_id = getattr(device, 'id', None) or getattr(device.description, 'id', None) or str(device.description.get('id', 'Unknown'))
        
        # DEBUG: Log all discovered attributes and alternative IDs
        logger.info(f"=== RAW DEVICE DATA ===")
        logger.info(f"  device type: {type(device)}")
        logger.info(f"  device.id: {getattr(device, 'id', 'N/A')}")
        logger.info(f"  device.__dict__: {getattr(device, '__dict__', 'N/A')}")
        
        if hasattr(device, 'description'):
            logger.info(f"  description type: {type(device.description)}")
            if isinstance(device.description, dict):
                logger.info(f"  description keys: {list(device.description.keys())}")
                logger.info(f"  description: {device.description}")
            else:
                logger.info(f"  description.__dict__: {getattr(device.description, '__dict__', 'N/A')}")
        
        logger.info(f"Final device_id being used: {device_id}")
        
        # Skip duplicates (same device ID)
        if device_id in seen_device_ids:
            logger.debug(f"Skipping duplicate device: {device_id}")
            continue
        seen_device_ids.add(device_id)
        
        # Get device info from description
        description = device.description if hasattr(device, 'description') else {}
        if isinstance(description, dict):
            name = description.get('name', 'Unknown')
            model = description.get('md', 'Unknown')
            category = description.get('ci', 'Unknown')
        else:
            # If description is an object, try to get attributes
            name = getattr(description, 'name', 'Unknown')
            model = getattr(description, 'md', 'Unknown')
            category = getattr(description, 'ci', 'Unknown')
        
        # Filter out the bridge itself (by MAC address or name pattern)
        # Normalize device_id for comparison (remove colons, convert to uppercase)
        device_id_normalized = device_id.replace(':', '').upper() if device_id else ''
        
        if bridge_mac:
            bridge_mac_normalized = bridge_mac.replace(':', '').upper()
            if device_id_normalized == bridge_mac_normalized:
                logger.debug(f"Filtering out bridge itself (MAC match): {name} ({device_id})")
                continue
        
        # Also filter by name pattern "Joule Bridge" to catch any variations
        if name and 'Joule Bridge' in name:
            logger.debug(f"Filtering out bridge itself (name match): {name} ({device_id})")
            continue
        
        # For devices with the same name (like multiple Ecobee accessories),
        # keep only the first one to avoid confusion
        # The first one is typically the main accessory
        if name in seen_names:
            logger.debug(f"Skipping duplicate device name '{name}' with ID {device_id} (already have one with this name)")
            continue
        seen_names.add(name)
        
        info = {
            'device_id': device_id,
            'name': name,
            'model': model,
            'category': category,
        }
        device_info[device_id] = info
        discovered_devices[device_id] = device  # Store the actual device object for pairing
        result.append(info)
        logger.info(f"Found device: {info['name']} ({device_id})")
    
    # If we have multiple devices with the same name, try to identify the main one
    # For Ecobee, we can try to pair with the first one or let the user choose
    # For now, return all devices and let the user choose
    
    return result


async def pair_device(device_id: str, pairing_code: str):
    """
    Pair with a HomeKit device
    
    Args:
        device_id: The device ID (e.g., "XX:XX:XX:XX:XX:XX")
        pairing_code: The 8-digit pairing code (e.g., "123-45-678" or "12345678")
    
    Returns:
        Pairing object
    """
    if not controller:
        await init_controller()
    
    if not controller:
        raise RuntimeError("HomeKit controller is not available")
    
    # Keep dashes in pairing code - aiohomekit expects XXX-XX-XXX format
    # Just remove any spaces
    code = pairing_code.replace(' ', '').strip()
    
    # Validate pairing code format
    # HomeKit codes are 8 digits in XXX-XX-XXX format
    # Accept both formats: "81085888" or "810-85-888"
    digits_only = code.replace('-', '').replace(' ', '')
    
    if len(digits_only) != 8:
        raise ValueError(
            f"Invalid pairing code length. Expected 8 digits, got {len(digits_only)}. "
            f"Code provided: {pairing_code} (formatted as: {code})"
        )
    
    if not digits_only.isdigit():
        raise ValueError(
            f"Pairing code must contain only digits. Code provided: {pairing_code}"
        )
    
    # Format as XXX-XX-XXX if not already formatted
    if '-' not in code:
        code = f"{digits_only[:3]}-{digits_only[3:5]}-{digits_only[5:8]}"
        logger.info(f"Reformatted pairing code from {pairing_code} to {code}")
    else:
        # Verify dash positions are correct
        expected_format = f"{digits_only[:3]}-{digits_only[3:5]}-{digits_only[5:8]}"
        if code != expected_format:
            logger.warning(
                f"Pairing code dash positions may be incorrect. "
                f"Provided: {code}, Expected format: {expected_format}. "
                f"Using provided format: {code}"
            )
    
    logger.info(f"Pairing code validation: original='{pairing_code}', formatted='{code}', digits='{digits_only}'")
    
    # Check if we have the device from discovery
    if device_id not in discovered_devices:
        # Re-discover to get the device
        logger.info(f"Device {device_id} not in cache, re-discovering...")
        await discover_devices()
    
    if device_id not in discovered_devices:
        raise ValueError(f"Device {device_id} not found. Please discover devices first.")
    
    device = discovered_devices[device_id]
    
    try:
        logger.info(f"=== Starting pairing process ===")
        logger.info(f"Device ID: {device_id}")
        logger.info(f"Original pairing code: {pairing_code}")
        logger.info(f"Formatted pairing code: {code}")
        logger.info(f"Code digits only: {digits_only}")
        
        # Log device information
        try:
            device_info = getattr(device, 'description', None)
            if device_info:
                logger.info(f"Device description available: {device_info}")
                if isinstance(device_info, dict):
                    logger.info(f"  - Name: {device_info.get('name', 'N/A')}")
                    logger.info(f"  - Model: {device_info.get('md', 'N/A')}")
                    logger.info(f"  - Category: {device_info.get('ci', 'N/A')}")
                else:
                    logger.info(f"  - Description type: {type(device_info)}")
                    logger.info(f"  - Description: {device_info}")
        except Exception as desc_error:
            logger.warning(f"Could not get device description: {desc_error}")
        
        # Check device attributes
        logger.info(f"Device object type: {type(device)}")
        logger.info(f"Device attributes: {[attr for attr in dir(device) if not attr.startswith('_')]}")
        
        # Verify device is still reachable before attempting pairing
        try:
            # Try to get device info to verify it's reachable
            device_info = getattr(device, 'description', None)
            if device_info:
                logger.info(f"✓ Device {device_id} is reachable, proceeding with pairing")
            else:
                logger.warning(f"⚠ Device {device_id} description not available")
        except Exception as reach_check:
            logger.warning(f"⚠ Could not verify device reachability: {reach_check}")
            logger.warning(f"  Error type: {type(reach_check)}")
            logger.warning(f"  Error details: {str(reach_check)}")
        
        # Use the device's async_start_pairing method
        # This returns a callable that takes the code and returns the pairing
        # Add timeout to async_start_pairing itself in case it hangs
        logger.info(f"Calling device.async_start_pairing({device_id})...")
        start_time = asyncio.get_event_loop().time()
        try:
            finish_pairing = await asyncio.wait_for(device.async_start_pairing(device_id), timeout=10.0)
            elapsed = asyncio.get_event_loop().time() - start_time
            logger.info(f"✓ async_start_pairing completed in {elapsed:.2f} seconds")
            logger.info(f"  finish_pairing type: {type(finish_pairing)}")
            logger.info(f"  finish_pairing callable: {callable(finish_pairing)}")
        except asyncio.TimeoutError:
            elapsed = asyncio.get_event_loop().time() - start_time
            logger.error(f"✗ async_start_pairing timed out after {elapsed:.2f} seconds for {device_id}")
            logger.error(f"  This means the device did not respond to the pairing initialization request")
            logger.error(f"  Possible reasons:")
            logger.error(f"    1. Device is not in HomeKit pairing mode")
            logger.error(f"    2. Device is already paired to another controller (Apple Home)")
            logger.error(f"    3. Network connectivity issue")
            logger.error(f"    4. Device is powered off or disconnected")
            # Provide detailed diagnostic information
            error_msg = (
                "Pairing initialization timed out. The device may not be in pairing mode or may be unreachable.\n\n"
                "Common causes:\n"
                "1. Device not in HomeKit pairing mode (Menu → Settings → Installation Settings → HomeKit)\n"
                "2. Device already paired to Apple Home (must unpair first)\n"
                "3. Network connectivity issues between bridge and device\n"
                "4. Device powered off or disconnected from WiFi\n\n"
                "Troubleshooting steps:\n"
                "1. Verify the 8-digit code is visible on your Ecobee screen\n"
                "2. If paired to Apple Home, remove it: Home app → Ecobee → Settings → Remove Accessory\n"
                "3. Restart your Ecobee: Menu → Settings → Reset → Restart\n"
                "4. Ensure both bridge and Ecobee are on the same WiFi network\n"
                "5. Wait 30 seconds after unpairing before trying again"
            )
            raise RuntimeError(error_msg)
        # Call it with the pairing code to complete pairing (with timeout)
        logger.info(f"Calling finish_pairing with code: {code}...")
        pairing_start_time = asyncio.get_event_loop().time()
        try:
            pairing = await asyncio.wait_for(finish_pairing(code), timeout=30.0)
            pairing_elapsed = asyncio.get_event_loop().time() - pairing_start_time
            logger.info(f"✓ Pairing completed successfully in {pairing_elapsed:.2f} seconds")
            logger.info(f"  Pairing object type: {type(pairing)}")
            if hasattr(pairing, 'id'):
                logger.info(f"  Pairing ID: {pairing.id}")
        except asyncio.TimeoutError:
            pairing_elapsed = asyncio.get_event_loop().time() - pairing_start_time
            logger.error(f"✗ Pairing timed out after {pairing_elapsed:.2f} seconds for {device_id}")
            logger.error(f"  The device responded to initialization but pairing completion timed out")
            logger.error(f"  This usually means:")
            logger.error(f"    1. Incorrect pairing code")
            logger.error(f"    2. Device rejected the pairing code")
            logger.error(f"    3. Network latency issues")
            error_msg = (
                "Pairing timed out. The pairing process took longer than 30 seconds.\n\n"
                "Possible causes:\n"
                "1. Incorrect pairing code (double-check all 8 digits)\n"
                "2. Device not fully in pairing mode\n"
                "3. Network latency issues\n\n"
                "Try:\n"
                "1. Verify the pairing code matches exactly what's on your Ecobee screen\n"
                "2. Make sure the code is in xxx-xx-xxx format (e.g., 123-45-678)\n"
                "3. Wait 30 seconds and try again with the same code\n"
                "4. If it keeps failing, restart your Ecobee and get a fresh pairing code"
            )
            raise RuntimeError(error_msg)
        except Exception as pairing_error:
            pairing_elapsed = asyncio.get_event_loop().time() - pairing_start_time
            # Check for specific error patterns
            error_str = str(pairing_error)
            error_repr = repr(pairing_error)
            logger.error(f"✗ Pairing failed after {pairing_elapsed:.2f} seconds")
            logger.error(f"  Error type: {type(pairing_error)}")
            logger.error(f"  Error message: {error_str}")
            logger.error(f"  Error repr: {error_repr}")
            
            # Log error attributes if available
            if hasattr(pairing_error, '__dict__'):
                logger.error(f"  Error attributes: {pairing_error.__dict__}")
            
            # Check if it's a bytes error (HomeKit protocol errors)
            if isinstance(pairing_error, bytes):
                logger.error(f"  Error bytes (hex): {pairing_error.hex()}")
                logger.error(f"  Error bytes (repr): {repr(pairing_error)}")
            
            # Log traceback for debugging
            import traceback
            logger.error(f"  Full traceback:\n{traceback.format_exc()}")
            
            # HomeKit error code 0x04 typically means "already paired" or "max peers"
            if '\\x04' in error_repr or (isinstance(pairing_error, bytes) and b'\x04' in pairing_error):
                error_msg = (
                    "Device is already paired to another controller (likely Apple HomeKit).\n\n"
                    "You must unpair it from Apple Home first:\n"
                    "1. Open the Home app on your iPhone/iPad\n"
                    "2. Find your Ecobee thermostat\n"
                    "3. Long-press on the Ecobee → Settings → Remove Accessory\n"
                    "4. Wait 30 seconds for the device to reset\n"
                    "5. Verify pairing mode: Menu → Settings → Installation Settings → HomeKit\n"
                    "6. Try pairing again"
                )
                raise RuntimeError(error_msg)
            elif 'already paired' in error_str.lower() or 'max peers' in error_str.lower():
                error_msg = (
                    "Device is already paired to another controller.\n\n"
                    "Unpair from Apple Home first:\n"
                    "1. Home app → Ecobee → Settings → Remove Accessory\n"
                    "2. Wait 30 seconds\n"
                    "3. Verify pairing code is visible on Ecobee\n"
                    "4. Try pairing again"
                )
                raise RuntimeError(error_msg)
            elif 'invalid' in error_str.lower() or 'wrong' in error_str.lower() or 'incorrect' in error_str.lower():
                error_msg = (
                    f"Pairing failed: {error_str}\n\n"
                    "The pairing code appears to be incorrect.\n\n"
                    "Please:\n"
                    "1. Double-check the 8-digit code on your Ecobee screen\n"
                    "2. Make sure you're entering it in xxx-xx-xxx format\n"
                    "3. Verify the code hasn't changed (get a fresh code if needed)\n"
                    "4. Try entering the code again"
                )
                raise RuntimeError(error_msg)
            else:
                # Re-raise with more context
                error_msg = (
                    f"Pairing failed: {error_str}\n\n"
                    "Make sure:\n"
                    "1. The pairing code is correct (8 digits, xxx-xx-xxx format)\n"
                    "2. The device is in pairing mode (code visible on screen)\n"
                    "3. The device is not already paired to Apple Home\n"
                    "4. Both devices are on the same WiFi network\n"
                    "5. The bridge service is running properly"
                )
                raise RuntimeError(error_msg)
        
        # Save the pairing to our local pairings dict
        pairings[device_id] = pairing
        logger.info(f"Successfully paired with {device_id}")
        
        # Register the pairing with the controller so it can be saved
        # aiohomekit Controller.save_data() saves controller.pairings
        # We need to add the pairing to controller.pairings first
        import os
        data_dir = get_data_directory()
        os.makedirs(data_dir, exist_ok=True)
        pairing_file = os.path.join(data_dir, 'pairings.json')
        
        # Extract pairing data from the pairing object
        pairing_data = {}
        if hasattr(pairing, 'pairing_data'):
            pairing_data = pairing.pairing_data
        elif hasattr(pairing, '_pairing_data'):
            pairing_data = pairing._pairing_data
        elif hasattr(pairing, 'id'):
            # Try to get pairing data from the pairing object
            pairing_data = {'id': pairing.id if hasattr(pairing, 'id') else device_id}
        else:
            # Fallback: create minimal pairing data
            pairing_data = {'id': device_id}
        
        # Ensure device_id is in the pairing data
        if 'id' not in pairing_data:
            pairing_data['id'] = device_id
        
        # Add the pairing to controller.pairings using device_id as the alias
        if not hasattr(controller, 'pairings'):
            controller.pairings = {}
        controller.pairings[device_id] = pairing_data
        logger.info(f"Registered pairing with controller (alias: {device_id})")
        
        # Save to file with atomic write and backup
        try:
            # Try controller.save_data first (it may have its own format)
            controller.save_data(pairing_file)
            logger.info(f"Saved pairings to {pairing_file}")
        except Exception as e:
            logger.warning(f"controller.save_data failed: {e}, using atomic fallback")
            # Fallback: manually save with atomic write and backup
            try:
                save_pairing_file_atomic(pairing_file, controller.pairings)
                logger.info(f"Manually saved pairings to {pairing_file} (atomic write with backup)")
            except Exception as e2:
                logger.error(f"Atomic save also failed: {e2}")
        return pairing
    except AlreadyPairedError:
        logger.warning(f"Device {device_id} is already paired")
        # Try to load existing pairing
        pairing = await controller.load_pairing(device_id, {})
        pairings[device_id] = pairing
        return pairing
    except Exception as e:
        logger.error(f"Pairing failed: {e}")
        raise


async def unpair_device(device_id: str):
    """Unpair from a HomeKit device"""
    if not controller:
        raise RuntimeError("HomeKit controller is not available")
    
    try:
        # Find the alias/key used in controller.pairings for this device_id
        alias_to_remove = None
        if hasattr(controller, 'pairings'):
            for alias, pairing_data in controller.pairings.items():
                # Check if this pairing matches our device_id
                if isinstance(pairing_data, dict):
                    if pairing_data.get('id') == device_id or alias == device_id:
                        alias_to_remove = alias
                        break
                elif alias == device_id:
                    alias_to_remove = alias
                    break
        
        # Use controller.remove_pairing() if we found an alias
        if alias_to_remove:
            controller.remove_pairing(alias_to_remove)
            logger.info(f"Removed pairing {alias_to_remove} from controller")
        elif device_id in pairings:
            # Fallback: try using device_id directly
            controller.remove_pairing(device_id)
            logger.info(f"Removed pairing {device_id} from controller")
        else:
            logger.warning(f"Pairing for {device_id} not found in controller")
        
        # Remove from our local pairings dict
        if device_id in pairings:
            del pairings[device_id]
        
        # Save the updated pairings to file
        import os
        data_dir = get_data_directory()
        os.makedirs(data_dir, exist_ok=True)
        pairing_file = os.path.join(data_dir, 'pairings.json')
        try:
            controller.save_data(pairing_file)
            logger.info(f"Saved pairings after unpairing to {pairing_file}")
        except Exception as e:
            logger.warning(f"controller.save_data failed during unpair: {e}, using atomic fallback")
            # Fallback: manually save with atomic write and backup
            try:
                save_pairing_file_atomic(pairing_file, controller.pairings)
                logger.info(f"Manually saved pairings after unpairing (atomic write with backup)")
            except Exception as e2:
                logger.error(f"Atomic save failed during unpair: {e2}")
        
        logger.info(f"Successfully unpaired from {device_id}")
    except Exception as e:
        logger.error(f"Unpairing failed: {e}")
        raise


async def get_thermostat_data(device_id: str):
    """
    Get current thermostat data from paired device
    
    Returns:
        dict with temperature, mode, target_temp, etc.
    """
    if device_id not in pairings:
        raise ValueError(f"Device {device_id} is not paired")
    
    pairing = pairings[device_id]
    
    # Use default characteristic IDs, but try to discover correct ones
    aid = ECOBEE_AID
    temp_current_iid = ECOBEE_TEMP_CURRENT
    temp_target_iid = ECOBEE_TEMP_TARGET
    target_state_iid = ECOBEE_TARGET_STATE
    current_state_iid = ECOBEE_CURRENT_STATE
    
    # Try to get accessory information first to discover correct characteristic IDs
    try:
        # Get accessories to find the correct AID and IIDs
        if hasattr(pairing, 'list_accessories_and_characteristics'):
            accessories_data = await pairing.list_accessories_and_characteristics()
            logger.debug(f"Accessories data type: {type(accessories_data)}")
            
            # Handle both dict and list responses
            accessories_list = []
            if isinstance(accessories_data, dict):
                accessories_list = accessories_data.get('accessories', [])
            elif isinstance(accessories_data, list):
                accessories_list = accessories_data
            else:
                # Try to get accessories attribute if it's an object
                accessories_list = getattr(accessories_data, 'accessories', [])
            
            # Find thermostat service and its characteristics
            # HomeKit Thermostat service UUID: 0000004A-0000-1000-8000-0026BB765291
            for accessory in accessories_list:
                found_aid = accessory.get('aid') if isinstance(accessory, dict) else getattr(accessory, 'aid', None)
                services = accessory.get('services', []) if isinstance(accessory, dict) else getattr(accessory, 'services', [])
                
                for service in services:
                    service_type = service.get('type') if isinstance(service, dict) else getattr(service, 'type', None)
                    service_type_str = str(service_type).upper() if service_type else ''
                    
                    # Thermostat service UUID ends with 4A or contains "thermostat"
                    # More precise matching: check for the exact UUID pattern
                    is_thermostat = (
                        service_type_str.endswith('4A') or 
                        '0000004A' in service_type_str or
                        'thermostat' in service_type_str.lower()
                    )
                    
                    if is_thermostat:
                        aid = found_aid
                        characteristics = service.get('characteristics', []) if isinstance(service, dict) else getattr(service, 'characteristics', [])
                        
                        # Log all characteristics for debugging
                        logger.debug(f"Thermostat service found in AID={aid}, characteristics count: {len(characteristics)}")
                        
                        for char in characteristics:
                            iid = char.get('iid') if isinstance(char, dict) else getattr(char, 'iid', None)
                            char_type = char.get('type') if isinstance(char, dict) else getattr(char, 'type', None)
                            char_type_str = str(char_type).upper() if char_type else ''
                            
                            # Log each characteristic for debugging
                            char_value = char.get('value') if isinstance(char, dict) else getattr(char, 'value', None)
                            logger.debug(f"  Char IID={iid}, type={char_type_str}, value={char_value}")
                            
                            # More precise matching using exact UUID endings
                            # Current Temperature: 00000011-0000-1000-8000-0026BB765291
                            if char_type_str.endswith('11') or '00000011' in char_type_str:
                                temp_current_iid = iid
                                logger.debug(f"    -> Current Temperature")
                            # Target Temperature: 00000035-0000-1000-8000-0026BB765291
                            elif char_type_str.endswith('35') or '00000035' in char_type_str:
                                temp_target_iid = iid
                                logger.debug(f"    -> Target Temperature")
                            # Target Heating Cooling State: 00000033-0000-1000-8000-0026BB765291
                            elif char_type_str.endswith('33') or '00000033' in char_type_str:
                                target_state_iid = iid
                                logger.debug(f"    -> Target State")
                            # Current Heating Cooling State: 0000000F-0000-1000-8000-0026BB765291
                            elif char_type_str.endswith('0F') or '0000000F' in char_type_str:
                                current_state_iid = iid
                                logger.debug(f"    -> Current State")
                        
                        # Save discovered IDs to cache for use by set_temperature and set_mode
                        device_characteristics_cache[device_id] = {
                            'aid': aid,
                            'temp_target': temp_target_iid,
                            'target_state': target_state_iid
                        }
                        logger.info(f"Cached IIDs for {device_id}: AID={aid}, TargetTemp={temp_target_iid}, Mode={target_state_iid}")
                        
                        logger.info(f"Discovered AID={aid}, IIDs: temp={temp_current_iid}, target_temp={temp_target_iid}, target_state={target_state_iid}, current_state={current_state_iid}")
                        break
    except Exception as e:
        logger.warning(f"Could not discover characteristics, using defaults: {e}")
        import traceback
        logger.debug(traceback.format_exc())
        # Use default IDs already set above
        pass
    
    # Read characteristics
    # Format: [(aid, iid), ...]
    characteristics = [
        (aid, temp_current_iid),
        (aid, temp_target_iid),
        (aid, target_state_iid),
        (aid, current_state_iid),
    ]
    
    try:
        # Try async_get_characteristics first (properly decrypts), fallback to get_characteristics
        try:
            data = await pairing.async_get_characteristics(characteristics)
        except AttributeError:
            # Fallback if async_get_characteristics doesn't exist
            logger.warning("async_get_characteristics not available, using get_characteristics")
            data = await pairing.get_characteristics(characteristics)
        
        # Parse response
        # Data format: {(aid, iid): {'value': value, ...}, ...}
        result = {
            'device_id': device_id,
            'temperature': None,
            'target_temperature': None,
            'target_mode': None,  # 0=Off, 1=Heat, 2=Cool, 3=Auto
            'current_mode': None,
            'mode': 'off',  # Human-readable
        }
        
        # Extract values
        temp_key = (aid, temp_current_iid)
        target_temp_key = (aid, temp_target_iid)
        target_state_key = (aid, target_state_iid)
        current_state_key = (aid, current_state_iid)
        
        if temp_key in data:
            # HomeKit returns temperature in Celsius
            temp_c = data[temp_key].get('value')
            if temp_c is not None:
                # Check if value is base64 encoded (encrypted) - if so, we need to decrypt
                if isinstance(temp_c, str) and (temp_c.endswith('=') or len(temp_c) > 20):
                    logger.warning(f"Temperature value appears encrypted (base64): {temp_c[:20]}...")
                    # Try to decode base64 and extract numeric value
                    try:
                        import base64
                        decoded = base64.b64decode(temp_c)
                        # The decoded value might be in a specific format - try to extract float
                        # For now, log it and skip
                        logger.warning(f"Encrypted temperature value detected, characteristic may need different ID or pairing issue")
                        result['temperature'] = None
                    except Exception as e:
                        logger.warning(f"Could not decode temperature: {e}")
                        result['temperature'] = None
                else:
                    # Ensure temp_c is a number (convert string to float if needed)
                    try:
                        temp_c = float(temp_c)
                        result['temperature'] = temp_c  # Native Celsius
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Invalid temperature value: {temp_c} ({type(temp_c)}): {e}")
                        result['temperature'] = None
        
        if target_temp_key in data:
            # HomeKit returns temperature in Celsius
            target_temp_c = data[target_temp_key].get('value')
            if target_temp_c is not None:
                # Ensure target_temp_c is a number (convert string to float if needed)
                try:
                    target_temp_c = float(target_temp_c)
                    result['target_temperature'] = target_temp_c  # Native Celsius
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid target temperature value: {target_temp_c} ({type(target_temp_c)}): {e}")
                    result['target_temperature'] = None
        
        if target_state_key in data:
            state = data[target_state_key].get('value')
            result['target_mode'] = state
            result['mode'] = {0: 'off', 1: 'heat', 2: 'cool', 3: 'auto'}.get(state, 'unknown')
        
        if current_state_key in data:
            result['current_mode'] = data[current_state_key].get('value')
        
        return result
    except Exception as e:
        logger.error(f"Error reading thermostat data: {e}")
        raise


async def set_temperature(device_id: str, temperature: float):
    """Set target temperature (temperature is in Celsius for HomeKit/Canada)"""
    if device_id not in pairings:
        raise ValueError(f"Device {device_id} is not paired")
    
    pairing = pairings[device_id]
    
    # --- FIX: Ensure cache is populated before trying to set ---
    if device_id not in device_characteristics_cache:
        logger.info(f"Cache miss for {device_id}, fetching characteristics before setting temperature...")
        try:
            # This populates the cache
            await get_thermostat_data(device_id)
        except Exception as e:
            logger.warning(f"Could not refresh data before setting: {e}")
    # ---------------------------------------------------------

    # Determine correct IDs
    aid = ECOBEE_AID
    iid = ECOBEE_TEMP_TARGET
    
    # Use cached IDs if available
    if device_id in device_characteristics_cache:
        cache = device_characteristics_cache[device_id]
        aid = cache.get('aid', aid)
        iid = cache.get('temp_target', iid)
        logger.debug(f"Using cached IDs for set_temperature: AID={aid}, IID={iid}")
    else:
        logger.warning(f"Using default IDs for set_temperature (AID={aid}, IID={iid}) - this may fail.")
    
    # Write target temperature (Already in Celsius)
    try:
        await pairing.put_characteristics([
            (aid, iid, temperature)
        ])
        logger.info(f"Set temperature to {temperature}°C on {device_id}")
    except Exception as e:
        logger.error(f"Failed to set temperature on AID {aid}, IID {iid}: {e}")
        # If it fails despite our best efforts, refresh cache for next time
        await get_thermostat_data(device_id)
        raise


async def set_mode(device_id: str, mode: str):
    """
    Set HVAC mode
    
    Args:
        mode: 'off', 'heat', 'cool', or 'auto'
    """
    if device_id not in pairings:
        raise ValueError(f"Device {device_id} is not paired")
    
    pairing = pairings[device_id]

    # --- FIX: Ensure cache is populated before trying to set ---
    if device_id not in device_characteristics_cache:
        logger.info(f"Cache miss for {device_id}, fetching characteristics before setting mode...")
        try:
            await get_thermostat_data(device_id)
        except Exception as e:
            logger.warning(f"Could not refresh data before setting: {e}")
    # ---------------------------------------------------------
    
    # Determine correct IDs
    aid = ECOBEE_AID
    iid = ECOBEE_TARGET_STATE
    
    # Use cached IDs if available
    if device_id in device_characteristics_cache:
        cache = device_characteristics_cache[device_id]
        aid = cache.get('aid', aid)
        iid = cache.get('target_state', iid)
        logger.debug(f"Using cached IDs for set_mode: AID={aid}, IID={iid}")
    else:
        logger.warning(f"Using default IDs for set_mode (AID={aid}, IID={iid}) - this may fail.")

    # Map mode to HomeKit state
    mode_map = {
        'off': 0,
        'heat': 1,
        'cool': 2,
        'auto': 3,
    }
    
    state = mode_map.get(mode.lower())
    if state is None:
        raise ValueError(f"Invalid mode: {mode}")
    
    # Write target state
    try:
        await pairing.put_characteristics([
            (aid, iid, state)
        ])
        logger.info(f"Set mode to {mode} on {device_id}")
    except Exception as e:
        logger.error(f"Failed to set mode on AID {aid}, IID {iid}: {e}")
        await get_thermostat_data(device_id)
        raise


# REST API Handlers

async def handle_discover(request):
    """GET /api/discover - Discover HomeKit devices"""
    try:
        devices = await discover_devices()
        logger.info(f"✓ Discovery complete - returning {len(devices)} device(s)")
        for d in devices:
            logger.info(f"  - {d.get('name')} (device_id={d.get('device_id')})")
        return web.json_response({'devices': devices})
    except Exception as e:
        logger.error(f"Discovery error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_pair(request):
    """POST /api/pair - Pair with a device"""
    try:
        data = await request.json()
        device_id = data.get('device_id')
        pairing_code = data.get('pairing_code')
        
        if not device_id or not pairing_code:
            return web.json_response(
                {'error': 'device_id and pairing_code required'}, 
                status=400
            )
        
        # Check if we already have the device in cache (from recent discovery)
        if device_id not in discovered_devices:
            # Device not in cache - do a fresh discovery to find it
            logger.info(f"Device {device_id} not in cache. Performing fresh discovery...")
            fresh_devices = await discover_devices()
            
            # Check if device is now in cache after fresh discovery
            if device_id not in discovered_devices:
                # Still not found - provide helpful error
                current_ids = [d.get('device_id') for d in fresh_devices] if fresh_devices else []
                error_msg = f"Device {device_id} not found. "
                if current_ids:
                    error_msg += f"Available devices: {', '.join(current_ids)}. "
                error_msg += "Make sure the Ecobee is in HomeKit pairing mode and visible on the network."
                logger.warning(f"Pairing error: {error_msg}")
                return web.json_response({'error': error_msg}, status=400)
        
        logger.info(f"Device {device_id} found in cache. Starting pairing...")
        await pair_device(device_id, pairing_code)
        return web.json_response({'success': True, 'device_id': device_id})
    except Exception as e:
        logger.error(f"Pairing error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_unpair(request):
    """POST /api/unpair - Unpair from a device"""
    try:
        data = await request.json()
        device_id = data.get('device_id')
        
        if not device_id:
            return web.json_response({'error': 'device_id required'}, status=400)
        
        await unpair_device(device_id)
        return web.json_response({'success': True})
    except Exception as e:
        logger.error(f"Unpairing error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_pairing_diagnostics(request):
    """GET /api/pairing/diagnostics - Check pairing status and common issues"""
    try:
        diagnostics = {
            'issues': [],
            'recommendations': [],
            'status': 'ok'
        }
        
        # 1. Check for stale pairings that don't match discovered devices
        discovered_devices.clear()
        fresh_devices = await discover_devices()
        discovered_ids = set(d['device_id'] for d in fresh_devices) if fresh_devices else set()
        stored_ids = set(pairings.keys())
        
        diagnostics['discovered_devices'] = list(discovered_ids)
        diagnostics['stored_pairings'] = list(stored_ids)
        
        # Check for stale pairings (stored but not discovered)
        stale_pairings = stored_ids - discovered_ids
        if stale_pairings:
            diagnostics['issues'].append({
                'type': 'stale_pairings',
                'message': f"Stored pairings not found on network: {list(stale_pairings)}",
                'severity': 'warning'
            })
            diagnostics['recommendations'].append(
                f"Clear stale pairings with POST /api/unpair for: {list(stale_pairings)}"
            )
            diagnostics['status'] = 'warning'
        
        # Check for unpaired devices
        unpaired_devices = discovered_ids - stored_ids
        if unpaired_devices:
            diagnostics['issues'].append({
                'type': 'unpaired_devices',
                'message': f"Devices available for pairing: {list(unpaired_devices)}",
                'severity': 'info'
            })
        
        # Check if any paired devices are reachable
        working_pairings = []
        broken_pairings = []
        for device_id in stored_ids & discovered_ids:
            try:
                await get_thermostat_data(device_id)
                working_pairings.append(device_id)
            except Exception as e:
                broken_pairings.append({'device_id': device_id, 'error': str(e)})
        
        diagnostics['working_pairings'] = working_pairings
        if broken_pairings:
            diagnostics['issues'].append({
                'type': 'broken_pairings',
                'message': f"Paired devices with errors: {broken_pairings}",
                'severity': 'error'
            })
            diagnostics['status'] = 'error'
        
        # Add general recommendations
        if not fresh_devices:
            diagnostics['issues'].append({
                'type': 'no_devices',
                'message': "No HomeKit devices found on network",
                'severity': 'error'
            })
            diagnostics['recommendations'].append(
                "Ensure Ecobee is on the same network and HomeKit is enabled"
            )
            diagnostics['status'] = 'error'
        
        return web.json_response(diagnostics)
    except Exception as e:
        logger.error(f"Diagnostics error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_clear_stale_pairings(request):
    """POST /api/pairing/clear-stale - Remove pairings for devices not on network"""
    try:
        discovered_devices.clear()
        fresh_devices = await discover_devices()
        discovered_ids = set(d['device_id'] for d in fresh_devices) if fresh_devices else set()
        
        cleared = []
        for device_id in list(pairings.keys()):
            if device_id not in discovered_ids:
                try:
                    await unpair_device(device_id)
                    cleared.append(device_id)
                except Exception as e:
                    logger.warning(f"Failed to clear stale pairing {device_id}: {e}")
        
        return web.json_response({
            'success': True,
            'cleared_pairings': cleared,
            'remaining_pairings': list(pairings.keys())
        })
    except Exception as e:
        logger.error(f"Clear stale pairings error: {e}")
        return web.json_response({'error': str(e)}, status=500)


# Global pairing status for HMI display
pairing_status = {
    'mode': 'idle',  # idle, wizard_started, discovered, pairing, success, error
    'code': None,    # Partial pairing code for display (e.g., "123-XX-XXX")
    'device_count': 0,
    'error': None,
    'timestamp': None
}

async def handle_pairing_status_get(request):
    """GET /api/pairing/status - Get current pairing status for HMI display"""
    global pairing_status
    return web.json_response(pairing_status)

async def handle_pairing_status_post(request):
    """POST /api/pairing/status - Update pairing status (called by web wizard)"""
    global pairing_status
    try:
        data = await request.json()
        pairing_status['mode'] = data.get('mode', 'idle')
        pairing_status['code'] = data.get('code')
        pairing_status['device_count'] = data.get('device_count', 0)
        pairing_status['error'] = data.get('error')
        pairing_status['timestamp'] = datetime.now().isoformat()
        
        logger.info(f"Pairing status updated: {pairing_status['mode']}")
        return web.json_response({'success': True})
    except Exception as e:
        logger.error(f"Pairing status update error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_status(request):
    """GET /api/status - Get thermostat status"""
    try:
        device_id = request.query.get('device_id')
        
        # Handle null or empty device_id string
        if device_id and device_id.lower() in ('null', 'none', ''):
            device_id = None
        
        if not device_id:
            # Return status of all paired devices
            # Try to load from controller if pairings dict is empty
            if not pairings and controller and hasattr(controller, 'pairings') and controller.pairings:
                logger.info("Pairings dict empty, loading from controller")
                for alias, pairing_data in controller.pairings.items():
                    try:
                        device_id_from_pairing = pairing_data.get('id') if isinstance(pairing_data, dict) else alias
                        pairing = controller.load_pairing(alias, pairing_data if isinstance(pairing_data, dict) else {})
                        pairings[device_id_from_pairing] = pairing
                    except Exception as e:
                        logger.warning(f"Failed to load pairing for {alias}: {e}")
            
            if not pairings:
                return web.json_response({'devices': []})
            
            results = []
            for did in pairings.keys():
                try:
                    data = await get_thermostat_data(did)
                    results.append(data)
                except Exception as e:
                    logger.error(f"Error getting status for {did}: {e}")
                    results.append({'device_id': did, 'error': str(e)})
            
            return web.json_response({'devices': results})
        
        # Get specific device
        if device_id not in pairings:
            # This is expected when no device is paired - log at debug level
            logger.debug(f"Status request for unpaired device: {device_id}")
            return web.json_response(
                {'error': f"Device {device_id} is not paired"}, 
                status=404  # 404 Not Found is more appropriate than 500 for missing resource
            )
        
        data = await get_thermostat_data(device_id)
        return web.json_response(data)
    except ValueError as e:
        # ValueError for "not paired" is expected - log at debug level
        if "not paired" in str(e).lower():
            logger.debug(f"Status error: {e}")
            return web.json_response({'error': str(e)}, status=404)
        else:
            logger.error(f"Status error: {e}")
            return web.json_response({'error': str(e)}, status=500)
    except Exception as e:
        # Other exceptions are unexpected - log as error
        logger.error(f"Status error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_set_temperature(request):
    """POST /api/set-temperature - Set target temperature"""
    try:
        data = await request.json()
        device_id = data.get('device_id')
        temperature = data.get('temperature')
        
        if not device_id or temperature is None:
            return web.json_response(
                {'error': 'device_id and temperature required'}, 
                status=400
            )
        
        await set_temperature(device_id, float(temperature))
        return web.json_response({'success': True})
    except Exception as e:
        logger.error(f"Set temperature error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_set_mode(request):
    """POST /api/set-mode - Set HVAC mode"""
    try:
        data = await request.json()
        device_id = data.get('device_id')
        mode = data.get('mode')
        
        if not device_id or not mode:
            return web.json_response(
                {'error': 'device_id and mode required'}, 
                status=400
            )
        
        await set_mode(device_id, mode)
        return web.json_response({'success': True})
    except Exception as e:
        logger.error(f"Set mode error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_paired_devices(request):
    """GET /api/paired - List all paired devices"""
    devices = []
    for device_id in pairings.keys():
        info = device_info.get(device_id, {'device_id': device_id})
        devices.append(info)
    
    return web.json_response({'devices': devices})


async def handle_primary_device(request):
    """
    GET /api/primary - Get the primary (first) paired device ID
    This is the single source of truth for which device to use.
    """
    try:
        # Get all paired devices
        device_ids = list(pairings.keys())
        
        if not device_ids:
            return web.json_response({
                'device_id': None,
                'error': 'No devices paired'
            }, status=200)
        
        # Primary device is the first one (or could be based on priority/name)
        primary_id = device_ids[0]
        
        # Get device info if available
        info = device_info.get(primary_id, {})
        
        # Validate the device is still actually paired and reachable
        try:
            # Quick validation - try to get status
            status_data = await get_thermostat_data(primary_id)
            return web.json_response({
                'device_id': primary_id,
                'name': info.get('name', 'Unknown'),
                'validated': True,
                'status': {
                    'temperature': status_data.get('temperature'),
                    'target_temperature': status_data.get('target_temperature'),
                    'mode': status_data.get('mode'),
                }
            })
        except Exception as e:
            # Device is paired but not reachable
            logger.warning(f"Primary device {primary_id} is paired but not reachable: {e}")
            return web.json_response({
                'device_id': primary_id,
                'name': info.get('name', 'Unknown'),
                'validated': False,
                'error': f'Device paired but not reachable: {str(e)}'
            })
    except Exception as e:
        logger.error(f"Error getting primary device: {e}")
        return web.json_response({'error': str(e)}, status=500)


# ============================================================================
# Relay Control (Dehumidifier)
# ============================================================================

def find_relay_port():
    """Find USB relay module (CH340)"""
    ports = serial.tools.list_ports.comports()
    for port in ports:
        # Look for CH340 chip (common in USB relay modules)
        # Handle None values for description/manufacturer
        description = port.description or ""
        manufacturer = port.manufacturer or ""
        if 'CH340' in description or 'CH340' in manufacturer:
            return port.device
        # Also check for common relay module VID/PID
        if port.vid == 0x1a86 and port.pid == 0x7523:  # CH340 VID/PID
            return port.device
    return None


async def init_relay():
    """Initialize USB relay connection"""
    global relay_port, relay_connected
    
    try:
        port_path = find_relay_port()
        if not port_path:
            logger.warning("No USB relay module found. Dehumidifier control disabled.")
            return False
        
        relay_port = serial.Serial(
            port_path,
            baudrate=9600,
            timeout=1,
            write_timeout=1
        )
        relay_connected = True
        logger.info(f"USB relay connected on {port_path}")
        return True
    except Exception as e:
        # Relay is optional hardware - log as warning, not error
        logger.warning(f"USB relay not available: {e}. Dehumidifier control disabled.")
        relay_connected = False
        return False


async def control_relay(channel, on):
    """
    Control relay channel (AT command format for CH340)
    NON-BLOCKING VERSION
    
    Args:
        channel: Relay number (1-8, 1-based)
        on: True to turn on, False to turn off
    """
    global relay_port, relay_connected
    
    if not relay_connected or not relay_port:
        raise Exception("Relay not connected")
    
    try:
        command = f"AT+{'ON' if on else 'OFF'}{channel}\r\n"
        data = command.encode()
        
        # Get the running event loop
        loop = asyncio.get_running_loop()
        
        # Run the blocking serial write in a separate thread
        await loop.run_in_executor(None, relay_port.write, data)
        
        logger.info(f"Relay {channel} {'ON' if on else 'OFF'}")
        return True
    except Exception as e:
        logger.error(f"Failed to control relay: {e}")
        relay_connected = False
        raise


async def get_relay_status(channel):
    """Get relay status (may not be supported by all modules)"""
    # Most CH340 modules don't support status readback
    # Return last known state from system_state
    return system_state.get('dehumidifier_on', False)


# ============================================================================
# Interlock Logic (Free Dry, etc.)
# ============================================================================

async def evaluate_interlock_logic():
    """
    Evaluate interlock logic for dehumidifier control with SAFETY CHECK for stale data.
    
    Rules:
    1. Free Dry: If outdoor_temp < 18.3°C AND indoor_humidity > 55% → Run dehumidifier
    2. AC Overcool: If outdoor_temp > 26.6°C → Disable dehumidifier, let AC handle it
    3. Min on/off times: Respect minimum runtime to prevent short cycling
    4. Safety: If data is stale (>15 minutes), force dehumidifier OFF
    """
    global system_state
    
    # --- SAFETY CHECK START ---
    last_update_str = system_state.get('last_update')
    if last_update_str:
        try:
            last_update = datetime.fromisoformat(last_update_str)
            time_diff = (datetime.now() - last_update).total_seconds()
            
            # If data is older than 15 minutes (900 seconds)
            if time_diff > 900:
                logger.warning(f"SAFETY: System state is stale ({int(time_diff)}s old). Forcing Dehumidifier OFF.")
                
                # Only force off if it's currently on
                if system_state.get('dehumidifier_on', False):
                    await control_relay(relay_channel, False)
                    system_state['dehumidifier_on'] = False
                
                return {
                    'should_run': False,
                    'reason': f"SAFETY STOP: Data stale (>15m).",
                    'current_state': False,
                }
        except Exception as e:
            logger.error(f"Error parsing last_update: {e}")
    # --- SAFETY CHECK END ---

    indoor_humidity = system_state.get('indoor_humidity')
    outdoor_temp = system_state.get('outdoor_temp')
    hvac_mode = system_state.get('hvac_mode')
    hvac_running = system_state.get('hvac_running')
    current_dehu_state = system_state.get('dehumidifier_on', False)
    
    # Rule 1: Free Dry Logic
    # If it's cool outside (< 18.3°C / 65°F) and humid inside (> 55%), run dehumidifier
    free_dry_condition = (
        outdoor_temp is not None and outdoor_temp < 18.3 and
        indoor_humidity is not None and indoor_humidity > 55
    )
    
    # Rule 2: AC Overcool Logic
    # If it's hot outside (> 26.6°C / 80°F), let AC handle dehumidification
    ac_overcool_condition = (
        outdoor_temp is not None and outdoor_temp > 26.6 and
        hvac_mode == 'cool' and hvac_running
    )
    
    # Decision logic
    should_run = False
    reason = ""
    
    if ac_overcool_condition:
        # AC is running and it's hot - let AC dehumidify for "free"
        should_run = False
        reason = "AC overcool mode (outdoor > 26.6°C, AC running)"
    elif free_dry_condition:
        # Cool outside, humid inside - run dehumidifier
        should_run = True
        reason = f"Free dry mode (outdoor {outdoor_temp}°C < 18.3°C, humidity {indoor_humidity}% > 55%)"
    else:
        # Default: Use humidity setpoint logic (can be extended)
        # For now, keep current state unless explicitly changed
        should_run = current_dehu_state
        reason = "Maintaining current state"
    
    # Only change if state needs to change
    if should_run != current_dehu_state:
        try:
            await control_relay(relay_channel, should_run)
            system_state['dehumidifier_on'] = should_run
            logger.info(f"Dehumidifier {'ON' if should_run else 'OFF'}: {reason}")
        except Exception as e:
            logger.error(f"Failed to control dehumidifier: {e}")
    
    return {
        'should_run': should_run,
        'reason': reason,
        'current_state': current_dehu_state,
    }


# ============================================================================
# API Handlers for Relay Control
# ============================================================================

async def handle_relay_status(request):
    """GET /api/relay/status - Get relay status"""
    try:
        status = await get_relay_status(relay_channel)
        return web.json_response({
            'connected': relay_connected,
            'channel': relay_channel,
            'on': status,
            'system_state': system_state,
        })
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def handle_relay_control(request):
    """POST /api/relay/control - Manually control relay"""
    try:
        data = await request.json()
        channel = data.get('channel', relay_channel)
        on = data.get('on', False)
        
        await control_relay(channel, on)
        system_state['dehumidifier_on'] = on
        
        return web.json_response({
            'success': True,
            'channel': channel,
            'on': on,
        })
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def handle_update_system_state(request):
    """POST /api/system-state - Update system state for interlock logic"""
    try:
        data = await request.json()
        
        # Update system state
        if 'indoor_temp' in data:
            system_state['indoor_temp'] = data['indoor_temp']
        if 'indoor_humidity' in data:
            system_state['indoor_humidity'] = data['indoor_humidity']
        if 'outdoor_temp' in data:
            system_state['outdoor_temp'] = data['outdoor_temp']
        if 'hvac_mode' in data:
            system_state['hvac_mode'] = data['hvac_mode']
        if 'hvac_running' in data:
            system_state['hvac_running'] = data['hvac_running']
        if 'hvac_fan_running' in data:
            system_state['hvac_fan_running'] = data['hvac_fan_running']
        if 'occupancy' in data:
            system_state['occupancy'] = data['occupancy']
        
        system_state['last_update'] = datetime.now().isoformat()
        
        # Evaluate interlock logic
        interlock_result = await evaluate_interlock_logic()
        
        # Also evaluate noise cancellation if occupancy changed
        if 'occupancy' in data:
            await evaluate_noise_cancellation()
        
        return web.json_response({
            'success': True,
            'system_state': system_state,
            'interlock_result': interlock_result,
        })
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def handle_evaluate_interlock(request):
    """POST /api/interlock/evaluate - Manually trigger interlock evaluation"""
    try:
        result = await evaluate_interlock_logic()
        # Also evaluate noise cancellation
        await evaluate_noise_cancellation()
        return web.json_response(result)
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


# ============================================================================
# Blueair Control Functions
# ============================================================================

def load_blueair_config():
    """Load Blueair configuration from config file"""
    try:
        if BLUEAIR_CONFIG_FILE.exists():
            with open(BLUEAIR_CONFIG_FILE, 'r') as f:
                config = json.load(f)
                return (
                    config.get('username'),
                    config.get('password'),
                    config.get('mac_address'),
                    config.get('local_ip'),
                    config.get('esp32_username'),
                    config.get('esp32_password')
                )
    except Exception as e:
        logger.warning(f"Failed to load Blueair config: {e}")
    return None, None, None, None, None, None

def save_blueair_config(username=None, password=None, mac_address=None, local_ip=None, esp32_username=None, esp32_password=None):
    """Save Blueair configuration to config file"""
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        
        # Load existing config to preserve values not being updated
        existing_config = {}
        if BLUEAIR_CONFIG_FILE.exists():
            try:
                with open(BLUEAIR_CONFIG_FILE, 'r') as f:
                    existing_config = json.load(f)
            except:
                pass
        
        # Update only provided values
        config = {**existing_config}
        if username is not None:
            config['username'] = username
        if password is not None:
            config['password'] = password
        if mac_address is not None:
            config['mac_address'] = mac_address.upper().replace('-', ':')
        if local_ip is not None:
            config['local_ip'] = local_ip
        if esp32_username is not None:
            config['esp32_username'] = esp32_username
        if esp32_password is not None:
            config['esp32_password'] = esp32_password
        
        with open(BLUEAIR_CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        # Set restrictive permissions (owner read/write only)
        os.chmod(BLUEAIR_CONFIG_FILE, 0o600)
        logger.info("Blueair configuration saved to config file")
        return True
    except Exception as e:
        logger.error(f"Failed to save Blueair config: {e}")
        return False

async def discover_blueair_esp32():
    """Discover Blueair ESP32 device on local network using mDNS or MAC address"""
    global blueair_local_ip, blueair_mac_address
    
    # Get MAC address from environment or config file (priority: env > config)
    mac_env = os.getenv('BLUEAIR_MAC_ADDRESS', '').upper().replace('-', ':')
    if not mac_env:
        # Try loading from config file
        _, _, mac_from_config, _, _, _ = load_blueair_config()
        if mac_from_config:
            mac_env = mac_from_config.upper().replace('-', ':')
    
    if mac_env:
        blueair_mac_address = mac_env
    
    # Try mDNS discovery first (if ESP32 advertises itself as blueair.local)
    try:
        from zeroconf.asyncio import AsyncZeroconf
        from zeroconf import ServiceBrowser, ServiceListener
        
        class BlueairListener(ServiceListener):
            def __init__(self):
                self.found_ip = None
            
            def add_service(self, zeroconf, service_type, name):
                info = zeroconf.get_service_info(service_type, name)
                if info and info.addresses:
                    self.found_ip = str(info.addresses[0])
                    logger.info(f"Found Blueair ESP32 via mDNS: {self.found_ip}")
        
        listener = BlueairListener()
        zeroconf = AsyncZeroconf()
        browser = ServiceBrowser(zeroconf.zeroconf, "_http._tcp.local.", listener)
        
        # Wait up to 2 seconds for discovery
        await asyncio.sleep(2)
        
        if listener.found_ip:
            blueair_local_ip = listener.found_ip
            browser.cancel()
            await zeroconf.async_close()
            return listener.found_ip
        
        browser.cancel()
        await zeroconf.async_close()
    except Exception as e:
        logger.debug(f"mDNS discovery failed: {e}")
    
    # Fall back to MAC address scanning if MAC is provided
    if blueair_mac_address:
        try:
            import subprocess
            import re
            
            # Try arp command (Linux)
            try:
                result = subprocess.run(['arp', '-a'], capture_output=True, text=True, timeout=5)
                for line in result.stdout.split('\n'):
                    if blueair_mac_address.replace(':', '-').lower() in line.lower():
                        # Extract IP from arp output (format: hostname (192.168.0.107) at ...)
                        match = re.search(r'\((\d+\.\d+\.\d+\.\d+)\)', line)
                        if match:
                            found_ip = match.group(1)
                            logger.info(f"Found Blueair ESP32 via ARP scan: {found_ip}")
                            blueair_local_ip = found_ip
                            return found_ip
            except Exception as e:
                logger.debug(f"ARP scan failed: {e}")
        except Exception as e:
            logger.debug(f"MAC address discovery failed: {e}")
    
    return None


async def _try_rediscover_blueair():
    """Try to rediscover Blueair ESP32 if connection fails (background task)"""
    global blueair_local_ip, blueair_last_discovery
    
    # Only rediscover if it's been more than 30 seconds since last attempt
    if blueair_last_discovery:
        time_diff = (datetime.now() - blueair_last_discovery).total_seconds()
        if time_diff < 30:
            return  # Too soon to retry
    
    try:
        discovered_ip = await discover_blueair_esp32()
        if discovered_ip and discovered_ip != blueair_local_ip:
            logger.info(f"Blueair ESP32 IP changed: {blueair_local_ip} -> {discovered_ip}")
            blueair_local_ip = discovered_ip
            blueair_last_discovery = datetime.now()
    except Exception as e:
        logger.debug(f"Rediscovery attempt failed: {e}")


async def init_blueair():
    """Initialize Blueair connection (cloud API or local ESP32)"""
    global blueair_account, blueair_devices, blueair_connected, blueair_local_ip, blueair_local_mode, blueair_last_discovery
    
    # Check for manual IP override first (highest priority)
    manual_ip = os.getenv('BLUEAIR_LOCAL_IP')
    if manual_ip:
        blueair_local_ip = manual_ip
        blueair_local_mode = True
        blueair_connected = True
        blueair_devices = [{'ip': manual_ip, 'name': 'Blueair ESP32', 'local': True}]
        logger.info(f"Blueair local ESP32 mode (manual IP): {manual_ip}")
        return True
    
    # Try auto-discovery (finds device by MAC address)
    discovered_ip = await discover_blueair_esp32()
    if discovered_ip:
        # IMPORTANT: Verify the device actually has a web API before enabling local mode
        # (The Blueair Pure 211 Max is a commercial product that only works via cloud API,
        # even though it has a MAC address we can find. It has no local web server.)
        try:
            import aiohttp
            from aiohttp import BasicAuth
            url = f"http://{discovered_ip}/api/status"
            auth = None
            if blueair_esp32_username and blueair_esp32_password:
                auth = BasicAuth(blueair_esp32_username, blueair_esp32_password)
            async with aiohttp.ClientSession() as session:
                async with session.get(url, auth=auth, timeout=aiohttp.ClientTimeout(total=3)) as resp:
                    if resp.status == 200:
                        blueair_local_ip = discovered_ip
                        blueair_local_mode = True
                        blueair_connected = True
                        blueair_devices = [{'ip': discovered_ip, 'name': 'Blueair ESP32', 'local': True}]
                        blueair_last_discovery = datetime.now()
                        logger.info(f"Blueair local ESP32 mode (auto-discovered): {discovered_ip}")
                        return True
                    else:
                        logger.info(f"Device at {discovered_ip} found by MAC but HTTP returned {resp.status} - not an ESP32 web server")
        except Exception as e:
            logger.info(f"Device at {discovered_ip} found by MAC but has no web API: {e}")
            logger.info("This is likely a commercial Blueair device - will use cloud API instead.")
    
    # If we have a cached IP from previous discovery, try it
    if blueair_local_ip:
        # Verify the cached IP is still reachable
        try:
            import aiohttp
            from aiohttp import BasicAuth
            url = f"http://{blueair_local_ip}/api/status"
            auth = None
            if blueair_esp32_username and blueair_esp32_password:
                auth = BasicAuth(blueair_esp32_username, blueair_esp32_password)
            async with aiohttp.ClientSession() as session:
                async with session.get(url, auth=auth, timeout=aiohttp.ClientTimeout(total=2)) as resp:
                    if resp.status == 200:
                        blueair_local_mode = True
                        blueair_connected = True
                        blueair_devices = [{'ip': blueair_local_ip, 'name': 'Blueair ESP32', 'local': True}]
                        logger.info(f"Blueair local ESP32 mode (cached IP): {blueair_local_ip}")
                        return True
        except:
            # Cached IP is no longer valid, clear it and try discovery again
            logger.warning(f"Cached Blueair IP {blueair_local_ip} is no longer reachable, will retry discovery")
            blueair_local_ip = None
    
    # Fall back to cloud API
    if not BLUEAIR_AVAILABLE:
        logger.info("Blueair API not available - Blueair features disabled")
        logger.info("Set BLUEAIR_LOCAL_IP environment variable for local ESP32 device.")
        blueair_connected = False
        return False
    
    try:
        # Get credentials from environment variables first, then config file
        username = os.getenv('BLUEAIR_USERNAME')
        password = os.getenv('BLUEAIR_PASSWORD')
        mac_from_env = os.getenv('BLUEAIR_MAC_ADDRESS')
        ip_from_env = os.getenv('BLUEAIR_LOCAL_IP')
        
        # If not in environment, try config file
        if not username or not password:
            username, password, mac_from_config, ip_from_config, esp32_user, esp32_pass = load_blueair_config()
            if mac_from_config and not mac_from_env:
                blueair_mac_address = mac_from_config.upper().replace('-', ':')
            if ip_from_config and not ip_from_env:
                manual_ip = ip_from_config
        
        if not username or not password:
            logger.info("Blueair credentials not set. Blueair features will be disabled.")
            logger.info("Set BLUEAIR_USERNAME and BLUEAIR_PASSWORD environment variables, or use /api/blueair/credentials endpoint.")
            logger.info("Alternatively, set BLUEAIR_LOCAL_IP for local ESP32 device.")
            blueair_connected = False
            return False
        
        # Try to get devices using available API
        try:
            # get_devices returns a tuple: (api, devices_list)
            blueair_api_instance, devices_list = await get_devices(username=username, password=password)
            blueair_account = blueair_api_instance  # Store the API instance for control operations
            blueair_devices = devices_list  # Store the list of Device objects
            blueair_connected = True
            blueair_local_mode = False
            logger.info(f"Blueair connected: {len(blueair_devices)} device(s) found")
            for i, device in enumerate(blueair_devices):
                logger.info(f"  Device {i}: {device.name} (UUID: {device.uuid})")
            return True
        except Exception as api_error:
            error_msg = str(api_error)
            logger.warning(f"Blueair API error: {error_msg}. Blueair features will be disabled.")
            # Log more details for debugging
            if "invalid password" in error_msg.lower() or "login" in error_msg.lower():
                logger.warning(f"Authentication failed. Please verify username and password are correct.")
                logger.debug(f"Username: {username}, Password length: {len(password) if password else 0}")
            blueair_connected = False
            return False
    except Exception as e:
        logger.warning(f"Failed to initialize Blueair: {e}. Blueair features will be disabled.")
        blueair_connected = False
        return False


async def control_blueair_fan(device_index=0, speed=0):
    """
    Control Blueair fan speed
    
    Args:
        device_index: Device index (default: 0 for first device)
        speed: Fan speed (0=off, 1=low, 2=medium, 3=max)
    """
    global blueair_account, blueair_devices, blueair_connected, blueair_local_mode, blueair_local_ip
    
    if not blueair_connected or not blueair_devices:
        raise Exception("Blueair not connected")
    
    if device_index >= len(blueair_devices):
        raise Exception(f"Device index {device_index} out of range")
    
    try:
        # Local ESP32 mode
        if blueair_local_mode and blueair_local_ip:
            import aiohttp
            from aiohttp import BasicAuth
            url = f"http://{blueair_local_ip}/api/fan"
            auth = None
            if blueair_esp32_username and blueair_esp32_password:
                auth = BasicAuth(blueair_esp32_username, blueair_esp32_password)
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json={'speed': speed}, auth=auth, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        system_state['blueair_fan_speed'] = speed
                        logger.info(f"Blueair ESP32 fan speed set to {speed}")
                        return True
                    elif resp.status == 401:
                        raise Exception(f"ESP32 authentication failed (401). Check username/password.")
                    else:
                        raise Exception(f"ESP32 returned status {resp.status}")
        else:
            # Cloud API mode - Device objects have set_fan_speed(new_speed: str)
            device = blueair_devices[device_index]
            await device.set_fan_speed(str(speed))  # API requires string
            system_state['blueair_fan_speed'] = speed
            logger.info(f"Blueair fan speed set to {speed} on device {device.name}")
            return True
    except Exception as e:
        logger.error(f"Failed to control Blueair fan: {e}")
        raise


async def control_blueair_led(device_index=0, brightness=100):
    """
    Control Blueair LED brightness
    
    Args:
        device_index: Device index (default: 0 for first device)
        brightness: LED brightness (0-100, 0=off)
    """
    global blueair_account, blueair_devices, blueair_connected, blueair_local_mode, blueair_local_ip
    
    if not blueair_connected or not blueair_devices:
        raise Exception("Blueair not connected")
    
    if device_index >= len(blueair_devices):
        raise Exception(f"Device index {device_index} out of range")
    
    try:
        # Local ESP32 mode
        if blueair_local_mode and blueair_local_ip:
            import aiohttp
            from aiohttp import BasicAuth
            url = f"http://{blueair_local_ip}/api/led"
            auth = None
            if blueair_esp32_username and blueair_esp32_password:
                auth = BasicAuth(blueair_esp32_username, blueair_esp32_password)
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json={'brightness': brightness}, auth=auth, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                        if resp.status == 200:
                            system_state['blueair_led_brightness'] = brightness
                            logger.info(f"Blueair ESP32 LED brightness set to {brightness}%")
                            return True
                        elif resp.status == 401:
                            raise Exception(f"ESP32 authentication failed (401). Check username/password.")
                        else:
                            raise Exception(f"ESP32 returned status {resp.status}")
            except Exception as e:
                # Try to rediscover if connection failed
                await _try_rediscover_blueair()
                raise
        else:
            # Cloud API mode - Device objects have set_brightness(new_brightness: int)
            device = blueair_devices[device_index]
            await device.set_brightness(brightness)
            system_state['blueair_led_brightness'] = brightness
            logger.info(f"Blueair LED brightness set to {brightness}% on device {device.name}")
            return True
    except Exception as e:
        logger.error(f"Failed to control Blueair LED: {e}")
        raise


async def get_blueair_status(device_index=0):
    """Get Blueair device status"""
    global blueair_devices, blueair_connected, blueair_local_mode, blueair_local_ip, blueair_esp32_username, blueair_esp32_password
    
    if not blueair_connected or not blueair_devices:
        return None
    
    if device_index >= len(blueair_devices):
        return None
    
    try:
        # Local ESP32 mode
        if blueair_local_mode and blueair_local_ip:
            import aiohttp
            from aiohttp import BasicAuth
            url = f"http://{blueair_local_ip}/api/status"
            auth = None
            if blueair_esp32_username and blueair_esp32_password:
                auth = BasicAuth(blueair_esp32_username, blueair_esp32_password)
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, auth=auth, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            logger.debug(f"ESP32 API response (full): {json.dumps(data, indent=2)}")  # Debug log to see ALL data we're getting
                            
                            # Build status data with all available fields from ESP32
                            status_data = {
                                'device_index': device_index,
                                'fan_speed': data.get('fan_speed', system_state.get('blueair_fan_speed', 0)),
                                'led_brightness': data.get('led_brightness', system_state.get('blueair_led_brightness', 100)),
                                'device_name': 'Blueair ESP32',
                                'ip_address': blueair_local_ip,
                            }
                            
                            # Include any additional fields the ESP32 might provide
                            # (matching the cloud API structure from openhab-blueair repository)
                            optional_fields = [
                                'mode', 'filter_status', 'wifi_status', 'filter_life', 
                                'filter_usage_days', 'filterlevel', 'uuid', 'mac', 
                                'firmware', 'model', 'name', 'timezone', 'roomLocation',
                                'child_lock', 'auto_mode_dependency', 'filterType',
                                'mcuFirmware', 'wlanDriver', 'lastSyncDate', 'compatibility'
                            ]
                            for field in optional_fields:
                                if field in data:
                                    status_data[field] = data[field]
                            
                            # Also include any other unexpected fields (forward-compatible)
                            for key, value in data.items():
                                if key not in status_data and key not in ['fan_speed', 'led_brightness']:
                                    status_data[key] = value
                            
                            # Update system state with actual values
                            if 'fan_speed' in data:
                                system_state['blueair_fan_speed'] = data['fan_speed']
                            if 'led_brightness' in data:
                                system_state['blueair_led_brightness'] = data['led_brightness']
                            
                            additional_fields = [k for k in status_data.keys() if k not in ['device_index', 'fan_speed', 'led_brightness', 'device_name', 'ip_address']]
                            logger.info(f"Blueair ESP32 status retrieved: fan_speed={status_data['fan_speed']}, led_brightness={status_data['led_brightness']}, additional_fields={additional_fields}")
                            return status_data
                        elif resp.status == 401:
                            logger.warning(f"ESP32 authentication failed (401). Check username/password.")
                            return None
                        else:
                            logger.warning(f"ESP32 returned status {resp.status}")
                            # Try to rediscover if IP changed
                            await _try_rediscover_blueair()
                            return None
            except Exception as e:
                logger.warning(f"Failed to get ESP32 status: {e}")
                # Try to rediscover if connection failed
                await _try_rediscover_blueair()
                # Return cached state if available
                return {
                    'device_index': device_index,
                    'fan_speed': system_state.get('blueair_fan_speed', 0),
                    'led_brightness': system_state.get('blueair_led_brightness', 100),
                    'device_name': 'Blueair ESP32',
                    'ip_address': blueair_local_ip,
                }
        
        # Cloud API mode - blueair_devices is a list of Device objects
        device = blueair_devices[device_index]
        
        # Refresh device data from the cloud API
        try:
            await device.refresh()
        except Exception as refresh_error:
            logger.warning(f"Failed to refresh Blueair device data: {refresh_error}")
        
        # Build status from Device object attributes
        status_data = {
            'device_index': device_index,
            'fan_speed': device.fan_speed if device.fan_speed is not None and device.fan_speed is not NotImplemented else system_state.get('blueair_fan_speed', 0),
            'led_brightness': device.brightness if device.brightness is not None and device.brightness is not NotImplemented else system_state.get('blueair_led_brightness', 100),
            'device_name': device.name,
            'uuid': device.uuid,
            'mac': device.mac,
            'model': device.model,
            'firmware': device.firmware,
            'room_location': device.room_location,
        }
        
        # Add sensor data if available
        try:
            sensors = {}
            if device.pm25 is not NotImplemented and device.pm25 is not None:
                sensors['pm25'] = device.pm25
            if device.pm10 is not NotImplemented and device.pm10 is not None:
                sensors['pm10'] = device.pm10
            if device.pm1 is not NotImplemented and device.pm1 is not None:
                sensors['pm1'] = device.pm1
            if device.voc is not NotImplemented and device.voc is not None:
                sensors['voc'] = device.voc
            if device.co2 is not NotImplemented and device.co2 is not None:
                sensors['co2'] = device.co2
            if device.temperature is not NotImplemented and device.temperature is not None:
                sensors['temperature'] = device.temperature
            if device.humidity is not NotImplemented and device.humidity is not None:
                sensors['humidity'] = device.humidity
            if sensors:
                status_data['sensors'] = sensors
        except Exception as sensor_error:
            # If we can't get sensor data, that's okay
            logger.debug(f"Could not get Blueair sensor data: {sensor_error}")
        
        # Update system state cache
        system_state['blueair_fan_speed'] = status_data['fan_speed']
        system_state['blueair_led_brightness'] = status_data['led_brightness']
        
        return status_data
    except Exception as e:
        logger.error(f"Failed to get Blueair status: {e}")
        return None


async def start_dust_kicker_cycle():
    """
    Start the "Dust Kicker" cycle:
    1. Ecobee turns HVAC Fan ON (to stir up dust)
    2. Wait 30 seconds
    3. Blueair to MAX (to catch the dust)
    4. Run for 10 minutes
    5. Turn both down to "Silent"
    """
    global interlock_state
    
    if interlock_state['dust_kicker_active']:
        logger.warning("Dust Kicker cycle already active")
        return
    
    interlock_state['dust_kicker_active'] = True
    interlock_state['dust_kicker_start_time'] = datetime.now()
    
    logger.info("Starting Dust Kicker cycle...")
    
    try:
        # Step 1: Turn on HVAC fan (via Ecobee - would need to implement)
        # For now, we'll just log it
        logger.info("Step 1: HVAC Fan ON (stirring up dust)")
        
        # Step 2: Wait 30 seconds
        await asyncio.sleep(30)
        logger.info("Step 2: 30 seconds elapsed")
        
        # Step 3: Blueair to MAX
        await control_blueair_fan(0, 3)  # Max speed
        logger.info("Step 3: Blueair set to MAX (catching dust)")
        
        # Step 4: Run for 10 minutes
        await asyncio.sleep(600)  # 10 minutes
        logger.info("Step 4: 10 minutes elapsed")
        
        # Step 5: Turn both to silent
        await control_blueair_fan(0, 1)  # Low speed (silent)
        logger.info("Step 5: Blueair set to Silent mode")
        # HVAC fan would be turned off here (via Ecobee)
        
        logger.info("Dust Kicker cycle complete")
    except Exception as e:
        logger.error(f"Dust Kicker cycle error: {e}")
    finally:
        interlock_state['dust_kicker_active'] = False
        interlock_state['dust_kicker_start_time'] = None


async def evaluate_noise_cancellation():
    """
    Noise Cancellation Mode:
    - Occupancy detected → LEDs OFF, Fan to LOW (Whisper mode)
    - No occupancy → Fan to Turbo Mode (scrub air while gone)
    """
    global system_state, interlock_state
    
    occupancy = system_state.get('occupancy', False)
    
    if not blueair_connected:
        return
    
    try:
        if occupancy:
            # Occupancy detected - quiet mode
            if not interlock_state['noise_cancellation_active']:
                logger.info("Occupancy detected - activating Noise Cancellation mode")
                await control_blueair_led(0, 0)  # LEDs OFF
                await control_blueair_fan(0, 1)  # Low speed (Whisper)
                interlock_state['noise_cancellation_active'] = True
        else:
            # No occupancy - turbo mode
            if interlock_state['noise_cancellation_active']:
                logger.info("No occupancy - activating Turbo mode")
                await control_blueair_fan(0, 3)  # Max speed (Turbo)
                interlock_state['noise_cancellation_active'] = False
    except Exception as e:
        logger.error(f"Noise Cancellation mode error: {e}")


# ============================================================================
# API Handlers for Blueair Control
# ============================================================================

async def handle_blueair_status(request):
    """GET /api/blueair/status - Get Blueair status"""
    try:
        device_index = int(request.query.get('device_index', 0))
        status = await get_blueair_status(device_index)
        if status:
            return web.json_response({
                'connected': blueair_connected,
                'devices_count': len(blueair_devices),
                'status': status,
            })
        else:
            return web.json_response({'error': 'Device not found'}, status=404)
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def handle_blueair_fan(request):
    """POST /api/blueair/fan - Control Blueair fan speed"""
    try:
        data = await request.json()
        device_index = data.get('device_index', 0)
        speed = data.get('speed', 0)
        
        if speed < 0 or speed > 3:
            return web.json_response({'error': 'Speed must be 0-3'}, status=400)
        
        await control_blueair_fan(device_index, speed)
        return web.json_response({
            'success': True,
            'device_index': device_index,
            'speed': speed,
        })
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def handle_blueair_led(request):
    """POST /api/blueair/led - Control Blueair LED brightness"""
    try:
        data = await request.json()
        device_index = data.get('device_index', 0)
        brightness = data.get('brightness', 100)
        
        if brightness < 0 or brightness > 100:
            return web.json_response({'error': 'Brightness must be 0-100'}, status=400)
        
        await control_blueair_led(device_index, brightness)
        return web.json_response({
            'success': True,
            'device_index': device_index,
            'brightness': brightness,
        })
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def handle_dust_kicker(request):
    """POST /api/blueair/dust-kicker - Start Dust Kicker cycle"""
    try:
        # Start cycle in background (don't wait for it)
        asyncio.create_task(start_dust_kicker_cycle())
        return web.json_response({
            'success': True,
            'message': 'Dust Kicker cycle started',
        })
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def handle_get_blueair_credentials(request):
    """GET /api/blueair/credentials - Get Blueair credentials status (without password)"""
    try:
        # Check environment variables
        env_username = os.getenv('BLUEAIR_USERNAME')
        env_password = os.getenv('BLUEAIR_PASSWORD')
        env_mac = os.getenv('BLUEAIR_MAC_ADDRESS')
        env_ip = os.getenv('BLUEAIR_LOCAL_IP')
        
        # Check config file
        config_username, config_password, config_mac, config_ip, config_esp32_user, config_esp32_pass = load_blueair_config()
        
        has_credentials = bool(
            (env_username and env_password) or 
            (config_username and config_password)
        )
        
        return web.json_response({
            'has_credentials': has_credentials,
            'source': 'environment' if (env_username and env_password) else ('config' if (config_username and config_password) else None),
            'username': env_username or config_username or None,
            'mac_address': env_mac or config_mac or None,
            'local_ip': env_ip or config_ip or None,
            'esp32_username': config_esp32_user or 'bunnyrita@gmail.com',
            'connected': blueair_connected,
            'devices_count': len(blueair_devices),
        })
    except Exception as e:
        logger.error(f"Get Blueair credentials error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_blueair_credentials(request):
    """POST /api/blueair/credentials - Set Blueair credentials or local device config"""
    try:
        data = await request.json()
        
        # Check if this is a local ESP32 configuration
        local_ip = data.get('local_ip')
        mac_address = data.get('mac_address')
        
        if local_ip or mac_address:
            # Local ESP32 mode - save MAC address and/or IP
            global blueair_local_ip, blueair_mac_address, blueair_esp32_username, blueair_esp32_password
            
            # Get ESP32 credentials from request or use defaults
            esp32_username = data.get('esp32_username', 'bunnyrita@gmail.com')
            esp32_password = data.get('esp32_password', '12345678')
            
            if save_blueair_config(mac_address=mac_address, local_ip=local_ip, esp32_username=esp32_username, esp32_password=esp32_password):
                # Update global variables
                if mac_address:
                    blueair_mac_address = mac_address.upper().replace('-', ':')
                if local_ip:
                    blueair_local_ip = local_ip
                blueair_esp32_username = esp32_username
                blueair_esp32_password = esp32_password
                blueair_esp32_username = esp32_username
                blueair_esp32_password = esp32_password
                
                # Reinitialize to use new settings
                result = await init_blueair()
                if result:
                    return web.json_response({
                        'success': True,
                        'message': 'Blueair local device configured',
                        'ip_address': blueair_local_ip,
                        'mac_address': blueair_mac_address,
                    })
                else:
                    return web.json_response({
                        'success': False,
                        'message': 'Configuration saved but device not reachable. Check IP/MAC address.',
                    }, status=400)
            else:
                return web.json_response({
                    'error': 'Failed to save configuration'
                }, status=500)
        
        # Cloud API mode (original behavior)
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return web.json_response(
                {'error': 'username and password required for cloud API, or local_ip/mac_address for ESP32'}, 
                status=400
            )
        
        # Save credentials to config file
        if save_blueair_config(username=username, password=password):
            # Reinitialize Blueair connection with new credentials
            result = await init_blueair()
            if result:
                return web.json_response({
                    'success': True,
                    'message': 'Blueair credentials saved and connection established',
                    'devices_count': len(blueair_devices),
                })
            else:
                # Get more specific error message from logs
                error_details = "Check username/password."
                if "invalid password" in str(api_error).lower():
                    error_details = "Invalid password. Please verify your Blueair account password is correct."
                elif "login" in str(api_error).lower():
                    error_details = "Login failed. Please verify your Blueair account credentials."
                
                return web.json_response({
                    'success': False,
                    'error': f'Credentials saved but failed to connect. {error_details}',
                    'error_type': 'authentication_failed',
                }, status=400)
        else:
            return web.json_response({
                'error': 'Failed to save credentials'
            }, status=500)
    except Exception as e:
        logger.error(f"Set Blueair credentials error: {e}")
        return web.json_response({'error': str(e)}, status=500)


# ============================================================================
# TP-Link Control Functions
# ============================================================================

async def discover_tplink_devices():
    """Discover TP-Link Kasa devices on the local network"""
    global tplink_devices
    
    if not tplink_kasa_available:
        logger.warning("python-kasa not available - cannot discover TP-Link devices")
        return []
    
    try:
        from kasa import Discover
        
        logger.info("Discovering TP-Link Kasa devices on local network...")
        devices = await Discover.discover()
        
        discovered = []
        for ip, device in devices.items():
            try:
                await device.update()  # Get device info
                device_info = {
                    'ip': ip,
                    'alias': device.alias,
                    'device_id': device.device_id,
                    'model': device.model,
                    'mac': device.mac,
                    'is_on': device.is_on if hasattr(device, 'is_on') else None,
                    'display_name': device.alias,  # Use alias as display name
                }
                discovered.append(device_info)
                logger.info(f"Found TP-Link device: {device.alias} ({ip}) - {device.model}")
            except Exception as e:
                logger.warning(f"Error getting info for TP-Link device at {ip}: {e}")
        
        tplink_devices = discovered
        return discovered
    except Exception as e:
        logger.error(f"Error discovering TP-Link devices: {e}")
        return []


async def get_tplink_status(device_id):
    """Get status of a TP-Link device by device_id or IP"""
    if not tplink_kasa_available:
        return None
    
    try:
        from kasa import SmartDevice
        
        # Find device by device_id or IP
        device = None
        for dev_info in tplink_devices:
            if dev_info.get('device_id') == device_id or dev_info.get('ip') == device_id:
                device = SmartDevice(dev_info['ip'])
                break
        
        if not device:
            # Try direct connection if device_id looks like an IP
            if device_id and '.' in device_id:
                device = SmartDevice(device_id)
            else:
                logger.warning(f"TP-Link device not found: {device_id}")
                return None
        
        await device.update()
        
        return {
            'device_id': device.device_id,
            'alias': device.alias,
            'ip': device.host,
            'is_on': device.is_on if hasattr(device, 'is_on') else None,
            'model': device.model,
            'mac': device.mac,
        }
    except Exception as e:
        logger.error(f"Error getting TP-Link device status: {e}")
        return None


async def set_tplink_switch(device_id, on):
    """Set TP-Link switch/plug on/off state"""
    if not tplink_kasa_available:
        return False
    
    try:
        from kasa import SmartDevice
        
        # Find device by device_id or IP
        device = None
        for dev_info in tplink_devices:
            if dev_info.get('device_id') == device_id or dev_info.get('ip') == device_id:
                device = SmartDevice(dev_info['ip'])
                break
        
        if not device:
            # Try direct connection if device_id looks like an IP
            if device_id and '.' in device_id:
                device = SmartDevice(device_id)
            else:
                logger.warning(f"TP-Link device not found: {device_id}")
                return False
        
        await device.update()
        await device.turn_on() if on else await device.turn_off()
        
        logger.info(f"Set TP-Link device {device.alias} ({device.host}) to {'ON' if on else 'OFF'}")
        return True
    except Exception as e:
        logger.error(f"Error setting TP-Link device state: {e}")
        return False


async def handle_tplink_discover(request):
    """GET /api/tplink/discover - Discover TP-Link devices"""
    try:
        devices = await discover_tplink_devices()
        return web.json_response({
            'devices': devices,
            'count': len(devices)
        })
    except Exception as e:
        logger.error(f"TP-Link discovery error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_tplink_status(request):
    """GET /api/tplink/status - Get TP-Link device status"""
    try:
        device_id = request.query.get('device_id')
        if not device_id:
            return web.json_response({'error': 'device_id required'}, status=400)
        
        status = await get_tplink_status(device_id)
        if status:
            return web.json_response(status)
        else:
            return web.json_response({'error': 'Device not found or unreachable'}, status=404)
    except Exception as e:
        logger.error(f"TP-Link status error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_tplink_switch(request):
    """POST /api/tplink/switch - Control TP-Link switch/plug"""
    try:
        data = await request.json()
        device_id = data.get('device_id')
        on = data.get('on', False)
        
        if not device_id:
            return web.json_response({'error': 'device_id required'}, status=400)
        
        success = await set_tplink_switch(device_id, on)
        if success:
            return web.json_response({'success': True, 'on': on})
        else:
            return web.json_response({'error': 'Failed to set device state'}, status=500)
    except Exception as e:
        logger.error(f"TP-Link switch error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_energyplus_status(request):
    """GET /api/energyplus/status - Check EnergyPlus service status"""
    try:
        # Import energyplus functions (they're in a separate file)
        import sys
        import os
        import importlib.util
        
        # Get the directory where server.py is located (prostat-bridge/)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Get the repo root (parent of prostat-bridge/)
        repo_root = os.path.dirname(current_dir)
        # Path to energyplus-service.py
        energyplus_path = os.path.join(repo_root, 'server', 'energyplus-service.py')
        
        # Also try alternative paths in case server.py is copied elsewhere
        alternative_paths = [
            energyplus_path,  # Standard location: repo_root/server/energyplus-service.py
            os.path.join(os.path.expanduser('~'), 'git', 'joule-hvac', 'server', 'energyplus-service.py'),  # Remote bridge location
            os.path.join(current_dir, '..', 'server', 'energyplus-service.py'),  # Relative from prostat-bridge
        ]
        
        energyplus_available = False
        for path in alternative_paths:
            if os.path.exists(path):
                try:
                    spec = importlib.util.spec_from_file_location("energyplus_service", path)
                    energyplus_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(energyplus_module)
                    energyplus_available = getattr(energyplus_module, 'ENERGYPLUS_AVAILABLE', False)
                    break
                except Exception as e:
                    logger.debug(f"Could not load EnergyPlus from {path}: {e}")
                    continue
        
        if not energyplus_available:
            logger.info("EnergyPlus module not found - using simplified calculations")
        
        return web.json_response({
            'status': 'ok',
            'energyplus_available': energyplus_available,
            'method': 'simplified' if not energyplus_available else 'energyplus'
        })
    except Exception as e:
        logger.error(f"Error checking EnergyPlus status: {e}")
        return web.json_response({
            'status': 'error',
            'energyplus_available': False,
            'method': 'simplified',
            'error': str(e)
        }, status=500)

async def handle_energyplus_calculate(request):
    """POST /api/energyplus/calculate - Run EnergyPlus load calculation"""
    try:
        params = await request.json()
        
        # Import energyplus functions
        import sys
        import os
        import importlib.util
        
        # Get the directory where server.py is located (prostat-bridge/)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Get the repo root (parent of prostat-bridge/)
        repo_root = os.path.dirname(current_dir)
        # Path to energyplus-service.py
        energyplus_path = os.path.join(repo_root, 'server', 'energyplus-service.py')
        
        # Also try alternative paths
        alternative_paths = [
            energyplus_path,  # Standard location
            os.path.join(os.path.expanduser('~'), 'git', 'joule-hvac', 'server', 'energyplus-service.py'),  # Remote bridge
            os.path.join(current_dir, '..', 'server', 'energyplus-service.py'),  # Relative
        ]
        
        energyplus_module = None
        for path in alternative_paths:
            if os.path.exists(path):
                try:
                    spec = importlib.util.spec_from_file_location("energyplus_service", path)
                    energyplus_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(energyplus_module)
                    break
                except Exception as e:
                    logger.debug(f"Could not load EnergyPlus from {path}: {e}")
                    continue
        
        if energyplus_module:
            try:
                run_energyplus_simulation = getattr(energyplus_module, 'run_energyplus_simulation')
                results = run_energyplus_simulation(params)
            except AttributeError:
                # Fallback to simplified
                calculate_load_simplified = getattr(energyplus_module, 'calculate_load_simplified')
                results = calculate_load_simplified(params)
        else:
            # If module not found, return simplified calculation
            logger.warning("EnergyPlus module not found, using simplified calculation")
            results = {
                'heatingLoadBtuHr': params.get('squareFeet', 2000) * 22.67 * params.get('insulationLevel', 1.0) * 70,
                'coolingLoadBtuHr': params.get('squareFeet', 2000) * 22.67 * params.get('insulationLevel', 1.0) * 25 * 1.2,
                'method': 'simplified',
                'error': 'EnergyPlus module not available - using simplified calculation'
            }
        
        return web.json_response(results)
    except Exception as e:
        logger.error(f"Error calculating EnergyPlus load: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return web.json_response({'error': str(e)}, status=500)

async def handle_rebates_calculate(request):
    """POST /api/rebates/calculate - Calculate equipment rebates"""
    try:
        data = await request.json()
        zip_code = data.get('zip_code', '')
        equipment_sku = data.get('equipment_sku', '')
        
        if not zip_code or not equipment_sku:
            return web.json_response({'error': 'Missing zip_code or equipment_sku'}, status=400)
        
        # Import rebate calculation function
        import sys
        import os
        import importlib.util
        
        # Get the directory where server.py is located (prostat-bridge/)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Get the repo root (parent of prostat-bridge/)
        repo_root = os.path.dirname(current_dir)
        # Path to energyplus-service.py
        energyplus_path = os.path.join(repo_root, 'server', 'energyplus-service.py')
        
        # Also try alternative paths
        alternative_paths = [
            energyplus_path,  # Standard location
            os.path.join(os.path.expanduser('~'), 'git', 'joule-hvac', 'server', 'energyplus-service.py'),  # Remote bridge
            os.path.join(current_dir, '..', 'server', 'energyplus-service.py'),  # Relative
        ]
        
        energyplus_module = None
        for path in alternative_paths:
            if os.path.exists(path):
                try:
                    spec = importlib.util.spec_from_file_location("energyplus_service", path)
                    energyplus_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(energyplus_module)
                    break
                except Exception as e:
                    logger.debug(f"Could not load EnergyPlus from {path}: {e}")
                    continue
        
        if energyplus_module:
            try:
                calculate_rebates = getattr(energyplus_module, 'calculate_rebates')
                results = calculate_rebates(zip_code, equipment_sku)
            except AttributeError:
                logger.warning("calculate_rebates function not found in EnergyPlus module")
                return web.json_response({'error': 'Rebate calculation not available'}, status=500)
        else:
            logger.warning("EnergyPlus module not found for rebate calculation")
            return web.json_response({'error': 'Rebate calculation not available'}, status=500)
        
        return web.json_response(results)
    except Exception as e:
        logger.error(f"Error calculating rebates: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return web.json_response({'error': str(e)}, status=500)

async def handle_check_bridge_processes(request):
    """GET /api/bridge/processes - Check for multiple bridge processes"""
    import subprocess
    import os
    
    try:
        # Find all python3 processes running server.py
        result = subprocess.run(
            ['pgrep', '-f', 'python3.*server.py'],
            capture_output=True,
            text=True,
            timeout=2
        )
        
        pids = [pid.strip() for pid in result.stdout.strip().split('\n') if pid.strip()]
        current_pid = os.getpid()
        
        # Filter out current process
        other_pids = [pid for pid in pids if pid != str(current_pid)]
        
        return web.json_response({
            'current_pid': current_pid,
            'total_processes': len(pids),
            'duplicate_processes': len(other_pids),
            'other_pids': other_pids,
            'has_duplicates': len(other_pids) > 0
        })
    except subprocess.TimeoutExpired:
        return web.json_response({'error': 'Timeout checking processes'}, status=500)
    except Exception as e:
        logger.error(f"Error checking bridge processes: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_ota_version(request):
    """GET /api/ota/version - Get current bridge version"""
    try:
        import subprocess
        from pathlib import Path
        
        # Try to get version from git
        git_repo = Path.home() / "git" / "joule-hvac"
        version = "unknown"
        
        if (git_repo / ".git").exists():
            try:
                result = subprocess.run(
                    ["git", "rev-parse", "HEAD"],
                    cwd=git_repo,
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    version = result.stdout.strip()[:8]
            except Exception:
                pass
        
        # Fallback: check version file
        version_file = Path.home() / "prostat-bridge" / "VERSION"
        if version_file.exists():
            version = version_file.read_text().strip()
        
        return web.json_response({
            "version": version,
            "service_path": str(Path.home() / "prostat-bridge")
        })
    except Exception as e:
        logger.error(f"Error getting version: {e}")
        return web.json_response({"error": str(e)}, status=500)


async def handle_ota_check(request):
    """GET /api/ota/check - Check for available updates"""
    try:
        import subprocess
        from pathlib import Path
        
        git_repo = Path.home() / "git" / "joule-hvac"
        repo_url = "https://github.com/kthomasking-debug/joule-hvac.git"
        
        # Get current version
        current_version = "unknown"
        if (git_repo / ".git").exists():
            try:
                result = subprocess.run(
                    ["git", "rev-parse", "HEAD"],
                    cwd=git_repo,
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    current_version = result.stdout.strip()[:8]
            except Exception:
                pass
        
        # Get latest version from GitHub
        latest_version = None
        try:
            result = subprocess.run(
                ["git", "ls-remote", "--heads", repo_url, "main"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                latest_version = result.stdout.split()[0][:8]
        except Exception as e:
            logger.warning(f"Could not check for updates: {e}")
        
        update_available = latest_version and latest_version != current_version
        
        return web.json_response({
            "current_version": current_version,
            "latest_version": latest_version or current_version,
            "update_available": update_available
        })
    except Exception as e:
        logger.error(f"Error checking for updates: {e}")
        return web.json_response({"error": str(e)}, status=500)


async def handle_ota_update(request):
    """POST /api/ota/update - Perform OTA update"""
    try:
        import subprocess
        import shutil
        from pathlib import Path
        from datetime import datetime
        
        git_repo = Path.home() / "git" / "joule-hvac"
        service_path = Path.home() / "prostat-bridge"
        repo_url = "https://github.com/kthomasking-debug/joule-hvac.git"
        backup_path = Path.home() / ".joule-bridge-backups"
        
        # Create backup
        backup_path.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = backup_path / f"server.py.{timestamp}"
        
        current_server = service_path / "server.py"
        if current_server.exists():
            shutil.copy2(current_server, backup_file)
            logger.info(f"Created backup: {backup_file}")
        
        # Update git repo
        if not (git_repo / ".git").exists():
            git_repo.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                ["git", "clone", repo_url, str(git_repo)],
                check=True,
                timeout=60
            )
        else:
            subprocess.run(
                ["git", "pull", "origin", "main"],
                cwd=git_repo,
                check=True,
                timeout=60
            )
        
        # Copy updated server.py
        source_file = git_repo / "prostat-bridge" / "server.py"
        if not source_file.exists():
            raise FileNotFoundError(f"Source file not found: {source_file}")
        
        service_path.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, service_path / "server.py")
        
        # Save version
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=git_repo,
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                version = result.stdout.strip()[:8]
                (service_path / "VERSION").write_text(version)
        except Exception:
            pass
        
        # Restart service
        restart_success = False
        try:
            result = subprocess.run(
                ["sudo", "systemctl", "restart", "prostat-bridge"],
                capture_output=True,
                text=True,
                timeout=10
            )
            restart_success = result.returncode == 0
        except Exception as e:
            logger.error(f"Service restart failed: {e}")
            # Rollback on failure
            if backup_file.exists():
                shutil.copy2(backup_file, service_path / "server.py")
                subprocess.run(["sudo", "systemctl", "restart", "prostat-bridge"], timeout=10)
                return web.json_response({
                    "success": False,
                    "error": "Service restart failed, rolled back to previous version",
                    "backup": str(backup_file)
                }, status=500)
        
        if restart_success:
            return web.json_response({
                "success": True,
                "version": version if 'version' in locals() else "unknown",
                "backup": str(backup_file),
                "message": "Update completed successfully"
            })
        else:
            return web.json_response({
                "success": False,
                "error": "Service restart failed"
            }, status=500)
            
    except subprocess.TimeoutExpired:
        return web.json_response({
            "success": False,
            "error": "Update timed out. Check network connection."
        }, status=500)
    except Exception as e:
        logger.error(f"OTA update failed: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)


async def handle_restart_bridge(request):
    """POST /api/bridge/restart - Restart the bridge service remotely"""
    try:
        import asyncio
        
        logger.info("Remote restart requested")
        
        # Send response immediately, then restart in background
        # This prevents the connection from being dropped before response is sent
        async def restart_in_background():
            try:
                # Wait a moment to ensure response is sent
                await asyncio.sleep(0.5)
                
                # Restart the service
                process = await asyncio.create_subprocess_exec(
                    "sudo", "systemctl", "restart", "prostat-bridge",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
                
                if process.returncode == 0:
                    logger.info("Service restarted successfully via API")
                else:
                    logger.error(f"Service restart failed: {stderr.decode()}")
            except asyncio.TimeoutError:
                logger.error("Service restart timed out")
            except Exception as e:
                logger.error(f"Error restarting service: {e}")
        
        # Schedule restart in background
        asyncio.create_task(restart_in_background())
        
        # Return response immediately
        return web.json_response({
            "success": True,
            "message": "Bridge service restart initiated"
        })
            
    except Exception as e:
        logger.error(f"Error initiating service restart: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)


async def handle_wifi_status(request):
    """GET /api/wifi/status - Get current WiFi connection status"""
    try:
        import subprocess
        
        # Get current WiFi connection info
        wifi_info = {
            'connected': False,
            'ssid': None,
            'frequency': None,
            'frequency_ghz': None,
            'ip_address': None,
            'interface': None,
            'is_2_4ghz': None
        }
        
        # Try to get WiFi info using iwconfig
        try:
            result = subprocess.run(
                ['iwconfig'], 
                capture_output=True, 
                text=True, 
                timeout=2
            )
            for line in result.stdout.split('\n'):
                if 'wlan' in line.lower() or 'wifi' in line.lower():
                    # Extract SSID
                    if 'ESSID:' in line:
                        ssid = line.split('ESSID:')[1].split()[0].strip('"')
                        wifi_info['ssid'] = ssid
                        wifi_info['connected'] = True
                        wifi_info['interface'] = line.split()[0]
                    # Extract frequency
                    if 'Frequency:' in line:
                        freq_str = line.split('Frequency:')[1].split()[0]
                        try:
                            freq_ghz = float(freq_str)
                            wifi_info['frequency'] = freq_str
                            wifi_info['frequency_ghz'] = freq_ghz
                            wifi_info['is_2_4ghz'] = 2.4 <= freq_ghz < 3.0
                        except:
                            pass
        except Exception as e:
            logger.debug(f"iwconfig failed: {e}")
        
        # Try NetworkManager as fallback
        if not wifi_info['connected']:
            try:
                result = subprocess.run(
                    ['nmcli', '-t', '-f', 'ACTIVE,SSID,FREQ,DEVICE', 'device', 'wifi'],
                    capture_output=True,
                    text=True,
                    timeout=2
                )
                for line in result.stdout.split('\n'):
                    if line.startswith('yes:'):
                        parts = line.split(':')
                        if len(parts) >= 4:
                            wifi_info['connected'] = True
                            wifi_info['ssid'] = parts[1] if parts[1] else None
                            wifi_info['interface'] = parts[3] if parts[3] else None
                            if parts[2]:
                                try:
                                    freq_ghz = float(parts[2]) / 1000.0  # MHz to GHz
                                    wifi_info['frequency_ghz'] = freq_ghz
                                    wifi_info['is_2_4ghz'] = 2.4 <= freq_ghz < 3.0
                                except:
                                    pass
            except Exception as e:
                logger.debug(f"nmcli failed: {e}")
        
        # Get IP address
        if wifi_info['interface']:
            try:
                result = subprocess.run(
                    ['ip', 'addr', 'show', wifi_info['interface']],
                    capture_output=True,
                    text=True,
                    timeout=2
                )
                for line in result.stdout.split('\n'):
                    if 'inet ' in line and not '127.0.0.1' in line:
                        wifi_info['ip_address'] = line.split()[1].split('/')[0]
                        break
            except:
                pass
        
        return web.json_response(wifi_info)
    except Exception as e:
        logger.error(f"Error getting WiFi status: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_wifi_scan(request):
    """GET /api/wifi/scan - Scan for available WiFi networks"""
    try:
        import subprocess
        
        networks = []
        
        # Try NetworkManager first (most reliable)
        try:
            result = subprocess.run(
                ['nmcli', '-t', '-f', 'SSID,SIGNAL,SECURITY,FREQ', 'device', 'wifi', 'list'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            for line in result.stdout.strip().split('\n'):
                if not line or line.startswith('--'):
                    continue
                parts = line.split(':')
                if len(parts) >= 4:
                    ssid = parts[0]
                    signal = parts[1]
                    security = parts[2]
                    freq_mhz = parts[3] if len(parts) > 3 else ''
                    
                    # Skip empty SSIDs
                    if not ssid or ssid == '--':
                        continue
                    
                    # Calculate frequency in GHz and determine band
                    freq_ghz = None
                    is_2_4ghz = None
                    if freq_mhz:
                        try:
                            freq_ghz = float(freq_mhz) / 1000.0
                            is_2_4ghz = 2.4 <= freq_ghz < 3.0
                        except:
                            pass
                    
                    networks.append({
                        'ssid': ssid,
                        'signal': int(signal) if signal.isdigit() else 0,
                        'security': security if security else 'open',
                        'frequency_ghz': freq_ghz,
                        'is_2_4ghz': is_2_4ghz,
                        'band': '2.4 GHz' if is_2_4ghz else '5 GHz' if freq_ghz else 'Unknown'
                    })
        except Exception as e:
            logger.debug(f"nmcli scan failed: {e}")
        
        # Sort by signal strength (strongest first)
        networks.sort(key=lambda x: x['signal'], reverse=True)
        
        return web.json_response({
            'networks': networks,
            'count': len(networks)
        })
    except Exception as e:
        logger.error(f"Error scanning WiFi: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_wifi_connect(request):
    """POST /api/wifi/connect - Connect to a WiFi network"""
    try:
        import subprocess
        data = await request.json()
        
        ssid = data.get('ssid')
        password = data.get('password', '')
        
        if not ssid:
            return web.json_response({'error': 'SSID required'}, status=400)
        
        # Use NetworkManager to connect
        try:
            if password:
                # Connect with password
                result = subprocess.run(
                    ['nmcli', 'device', 'wifi', 'connect', ssid, 'password', password],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
            else:
                # Connect to open network
                result = subprocess.run(
                    ['nmcli', 'device', 'wifi', 'connect', ssid],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
            
            if result.returncode == 0:
                # Wait a moment for connection to establish
                await asyncio.sleep(2)
                return web.json_response({
                    'success': True,
                    'message': f'Connected to {ssid}',
                    'ssid': ssid
                })
            else:
                error_msg = result.stderr.strip() or result.stdout.strip()
                return web.json_response({
                    'success': False,
                    'error': error_msg or 'Connection failed'
                }, status=400)
        except subprocess.TimeoutExpired:
            return web.json_response({'error': 'Connection timeout'}, status=500)
        except Exception as e:
            logger.error(f"WiFi connection error: {e}")
            return web.json_response({'error': str(e)}, status=500)
    except Exception as e:
        logger.error(f"Error connecting to WiFi: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_wifi_disconnect(request):
    """POST /api/wifi/disconnect - Disconnect from current WiFi network"""
    try:
        import subprocess
        
        # Find WiFi interface
        result = subprocess.run(
            ['nmcli', '-t', '-f', 'DEVICE', 'device', 'status'],
            capture_output=True,
            text=True,
            timeout=2
        )
        
        wifi_device = None
        for line in result.stdout.split('\n'):
            if 'wlan' in line.lower() or 'wifi' in line.lower():
                parts = line.split(':')
                if len(parts) >= 2:
                    wifi_device = parts[0]
                    break
        
        if not wifi_device:
            return web.json_response({'error': 'No WiFi device found'}, status=400)
        
        # Disconnect
        result = subprocess.run(
            ['nmcli', 'device', 'disconnect', wifi_device],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return web.json_response({
                'success': True,
                'message': 'Disconnected from WiFi'
            })
        else:
            return web.json_response({
                'success': False,
                'error': result.stderr.strip() or 'Disconnect failed'
            }, status=400)
    except Exception as e:
        logger.error(f"Error disconnecting WiFi: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_kill_duplicate_bridges(request):
    """POST /api/bridge/kill-duplicates - Kill all duplicate bridge processes"""
    import subprocess
    import os
    
    try:
        # Find all python3 processes running server.py
        result = subprocess.run(
            ['pgrep', '-f', 'python3.*server.py'],
            capture_output=True,
            text=True,
            timeout=2
        )
        
        pids = [pid.strip() for pid in result.stdout.strip().split('\n') if pid.strip()]
        current_pid = os.getpid()
        
        # Filter out current process
        other_pids = [pid for pid in pids if pid != str(current_pid)]
        
        if not other_pids:
            return web.json_response({
                'success': True,
                'message': 'No duplicate processes found',
                'killed': []
            })
        
        # Kill other processes
        killed = []
        for pid in other_pids:
            try:
                subprocess.run(['kill', pid], timeout=1, check=False)
                killed.append(pid)
            except Exception as e:
                logger.warning(f"Failed to kill process {pid}: {e}")
        
        return web.json_response({
            'success': True,
            'message': f'Killed {len(killed)} duplicate process(es)',
            'killed': killed
        })
    except subprocess.TimeoutExpired:
        return web.json_response({'error': 'Timeout killing processes'}, status=500)
    except Exception as e:
        logger.error(f"Error killing duplicate bridges: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_bridge_logs(request):
    """GET /api/bridge/logs - Get recent bridge logs for remote debugging"""
    try:
        lines = int(request.query.get('lines', 100))
        lines = min(lines, 500)  # Cap at 500 lines
        
        logs = []
        
        # Try to read from journalctl first (systemd logs)
        try:
            process = await asyncio.create_subprocess_exec(
                "journalctl", "-u", "prostat-bridge", "-n", str(lines), "--no-pager",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=5)
            if process.returncode == 0 and stdout:
                logs = stdout.decode().strip().split('\n')
        except Exception as e:
            logger.debug(f"Could not read journalctl logs: {e}")
        
        # Fallback to /tmp/prostat-bridge.log
        if not logs:
            log_file = Path("/tmp/prostat-bridge.log")
            if log_file.exists():
                try:
                    with open(log_file, 'r') as f:
                        all_lines = f.readlines()
                        logs = [l.rstrip() for l in all_lines[-lines:]]
                except Exception as e:
                    logger.debug(f"Could not read log file: {e}")
        
        return web.json_response({
            "success": True,
            "lines": len(logs),
            "logs": logs
        })
    except Exception as e:
        logger.error(f"Error getting logs: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)


def get_tailscale_ip():
    """Get Tailscale IP address if available"""
    try:
        import subprocess
        # Try to get Tailscale IP
        result = subprocess.run(['tailscale', 'ip', '-4'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            ip = result.stdout.strip()
            if ip and ip.startswith('100.'):  # Tailscale IPs are in 100.x.x.x range
                return ip
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        pass
    
    # Fallback: check network interfaces for tailscale0
    try:
        import subprocess
        result = subprocess.run(['ip', 'addr', 'show', 'tailscale0'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                if 'inet ' in line:
                    # Extract IP from line like "    inet 100.x.x.x/32 scope global tailscale0"
                    parts = line.strip().split()
                    if len(parts) >= 2:
                        ip = parts[1].split('/')[0]
                        if ip.startswith('100.'):
                            return ip
    except Exception:
        pass
    
    return None


def get_tailscale_status():
    """Get Tailscale connection status"""
    try:
        import subprocess
        result = subprocess.run(['tailscale', 'status', '--json'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            import json
            status = json.loads(result.stdout)
            return {
                "installed": True,
                "running": status.get('BackendState') == 'Running',
                "logged_in": status.get('Self', {}).get('Online', False),
                "hostname": status.get('Self', {}).get('HostName', ''),
                "dns_name": status.get('Self', {}).get('DNSName', '').rstrip('.'),
            }
    except FileNotFoundError:
        return {"installed": False}
    except Exception as e:
        return {"installed": True, "error": str(e)}
    
    return {"installed": False}


async def handle_bridge_info(request):
    """GET /api/bridge/info - Get comprehensive bridge system info for support"""
    try:
        import platform
        import sys
        
        # Get Tailscale info for remote support
        tailscale_ip = get_tailscale_ip()
        tailscale_status = get_tailscale_status()
        
        # Get username from home directory or environment
        username = None
        try:
            import os
            from pathlib import Path
            home_path = Path.home()
            # Extract username from /home/username path
            if str(home_path).startswith('/home/'):
                username = home_path.parts[-1] if len(home_path.parts) > 1 else None
            # Fallback to environment variable
            if not username:
                username = os.getenv('USER') or os.getenv('USERNAME')
        except Exception:
            pass
        
        lan_ip = get_lan_ip()
        
        # Get MAC address (device ID) from wlan0 or eth0
        device_id = None
        try:
            for iface in ['wlan0', 'eth0']:
                mac_path = f'/sys/class/net/{iface}/address'
                if os.path.exists(mac_path):
                    with open(mac_path, 'r') as f:
                        device_id = f.read().strip().upper().replace(':', '-')
                        break
        except Exception:
            pass
        
        info = {
            "hostname": socket.gethostname(),
            "device_id": device_id,
            "username": username,
            "platform": platform.platform(),
            "python_version": sys.version,
            "local_ip": lan_ip or get_local_ip(),
            "lan_ip": lan_ip,
            "tailscale_ip": tailscale_ip,
            "tailscale": tailscale_status,
            "uptime": None,
            "memory": None,
            "disk": None,
        }
        
        # Get uptime
        try:
            with open('/proc/uptime', 'r') as f:
                uptime_seconds = float(f.readline().split()[0])
                hours = int(uptime_seconds // 3600)
                minutes = int((uptime_seconds % 3600) // 60)
                info["uptime"] = f"{hours}h {minutes}m"
        except Exception:
            pass
        
        # Get memory info
        try:
            with open('/proc/meminfo', 'r') as f:
                meminfo = {}
                for line in f:
                    parts = line.split(':')
                    if len(parts) == 2:
                        key = parts[0].strip()
                        value = int(parts[1].strip().split()[0])
                        meminfo[key] = value
                
                total_mb = meminfo.get('MemTotal', 0) / 1024
                available_mb = meminfo.get('MemAvailable', 0) / 1024
                info["memory"] = {
                    "total_mb": round(total_mb),
                    "available_mb": round(available_mb),
                    "used_percent": round((1 - available_mb / total_mb) * 100) if total_mb > 0 else 0
                }
        except Exception:
            pass
        
        # Get disk info
        try:
            import shutil
            total, used, free = shutil.disk_usage('/')
            info["disk"] = {
                "total_gb": round(total / (1024**3), 1),
                "free_gb": round(free / (1024**3), 1),
                "used_percent": round(used / total * 100)
            }
        except Exception:
            pass
        
        return web.json_response({
            "success": True,
            **info
        })
    except Exception as e:
        logger.error(f"Error getting bridge info: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)


# Tailscale install (for remote support)
async def handle_tailscale_install(request):
    """POST /api/bridge/tailscale/install - Install Tailscale on the bridge (requires sudo)"""
    try:
        import subprocess
        # Check if already installed
        result = subprocess.run(['which', 'tailscale'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return web.json_response({
                'success': True,
                'message': 'Tailscale is already installed. Run "sudo tailscale up" on the bridge to sign in.',
                'already_installed': True
            })
        # Run official Tailscale install script (requires sudo for apt)
        result = subprocess.run(
            ['sudo', 'sh', '-c', 'curl -fsSL https://tailscale.com/install.sh | sh'],
            capture_output=True,
            text=True,
            timeout=120
        )
        if result.returncode == 0:
            return web.json_response({
                'success': True,
                'message': 'Tailscale installed. Have the customer run "sudo tailscale up" on the bridge and open the link to sign in. The remote URL will then appear here.'
            })
        return web.json_response({
            'success': False,
            'error': result.stderr or result.stdout or 'Install failed',
            'hint': 'If sudo requires a password, the customer can install manually: curl -fsSL https://tailscale.com/install.sh | sh'
        }, status=500)
    except subprocess.TimeoutExpired:
        return web.json_response({
            'success': False,
            'error': 'Install timed out (2 min). Try running manually on the bridge: curl -fsSL https://tailscale.com/install.sh | sh'
        }, status=500)
    except Exception as e:
        logger.exception("Tailscale install failed")
        return web.json_response({
            'success': False,
            'error': str(e),
            'hint': 'Customer can install manually: curl -fsSL https://tailscale.com/install.sh | sh'
        }, status=500)


# ngrok tunnel management
ngrok_process = None
ngrok_public_url = None

async def handle_ngrok_start(request):
    """POST /api/bridge/ngrok/start - Start an ngrok tunnel for remote support"""
    global ngrok_process, ngrok_public_url
    
    try:
        import subprocess
        import json as json_module
        
        # Check if ngrok is installed
        try:
            result = subprocess.run(['which', 'ngrok'], capture_output=True, text=True, timeout=5)
            if result.returncode != 0:
                return web.json_response({
                    'success': False,
                    'error': 'ngrok is not installed. Install with: curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok'
                }, status=400)
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': f'Failed to check ngrok installation: {e}'
            }, status=500)
        
        # Kill any existing ngrok process
        if ngrok_process:
            try:
                ngrok_process.terminate()
                ngrok_process.wait(timeout=5)
            except Exception:
                pass
            ngrok_process = None
            ngrok_public_url = None
        
        # Also kill any stray ngrok processes
        subprocess.run(['pkill', '-f', 'ngrok'], capture_output=True, timeout=5)
        await asyncio.sleep(1)
        
        # Start ngrok tunnel
        ngrok_process = subprocess.Popen(
            ['ngrok', 'http', '8080', '--log=stdout', '--log-format=json'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for ngrok to start and get the public URL
        await asyncio.sleep(3)
        
        # Query ngrok API for the public URL
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get('http://127.0.0.1:4040/api/tunnels', timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        tunnels = data.get('tunnels', [])
                        for tunnel in tunnels:
                            if tunnel.get('proto') == 'https':
                                ngrok_public_url = tunnel.get('public_url')
                                break
                        if not ngrok_public_url and tunnels:
                            ngrok_public_url = tunnels[0].get('public_url')
        except Exception as e:
            logger.warning(f"Failed to get ngrok URL from API: {e}")
        
        if ngrok_public_url:
            logger.info(f"ngrok tunnel started: {ngrok_public_url}")
            return web.json_response({
                'success': True,
                'url': ngrok_public_url,
                'message': 'ngrok tunnel started successfully'
            })
        else:
            return web.json_response({
                'success': False,
                'error': 'ngrok started but could not get public URL. Check if ngrok is authenticated.'
            }, status=500)
            
    except Exception as e:
        logger.error(f"Error starting ngrok: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


async def handle_ngrok_stop(request):
    """POST /api/bridge/ngrok/stop - Stop the ngrok tunnel"""
    global ngrok_process, ngrok_public_url
    
    try:
        import subprocess
        
        if ngrok_process:
            try:
                ngrok_process.terminate()
                ngrok_process.wait(timeout=5)
            except Exception:
                ngrok_process.kill()
            ngrok_process = None
        
        # Also kill any stray ngrok processes
        subprocess.run(['pkill', '-f', 'ngrok'], capture_output=True, timeout=5)
        
        ngrok_public_url = None
        logger.info("ngrok tunnel stopped")
        
        return web.json_response({
            'success': True,
            'message': 'ngrok tunnel stopped'
        })
    except Exception as e:
        logger.error(f"Error stopping ngrok: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


async def handle_ngrok_status(request):
    """GET /api/bridge/ngrok/status - Get ngrok tunnel status"""
    global ngrok_process, ngrok_public_url
    
    try:
        import subprocess
        
        # Check if ngrok is installed
        ngrok_installed = False
        try:
            result = subprocess.run(['which', 'ngrok'], capture_output=True, text=True, timeout=5)
            ngrok_installed = result.returncode == 0
        except Exception:
            pass
        
        # Check if tunnel is running
        tunnel_running = False
        current_url = ngrok_public_url
        
        if ngrok_process and ngrok_process.poll() is None:
            tunnel_running = True
            # Try to get fresh URL from ngrok API
            try:
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    async with session.get('http://127.0.0.1:4040/api/tunnels', timeout=aiohttp.ClientTimeout(total=2)) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            tunnels = data.get('tunnels', [])
                            for tunnel in tunnels:
                                if tunnel.get('proto') == 'https':
                                    current_url = tunnel.get('public_url')
                                    ngrok_public_url = current_url
                                    break
                            if not current_url and tunnels:
                                current_url = tunnels[0].get('public_url')
                                ngrok_public_url = current_url
            except Exception:
                pass
        else:
            # Check if there's an ngrok process we didn't start
            try:
                result = subprocess.run(['pgrep', '-f', 'ngrok'], capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    tunnel_running = True
                    # Try to get URL from API
                    try:
                        import aiohttp
                        async with aiohttp.ClientSession() as session:
                            async with session.get('http://127.0.0.1:4040/api/tunnels', timeout=aiohttp.ClientTimeout(total=2)) as resp:
                                if resp.status == 200:
                                    data = await resp.json()
                                    tunnels = data.get('tunnels', [])
                                    for tunnel in tunnels:
                                        if tunnel.get('proto') == 'https':
                                            current_url = tunnel.get('public_url')
                                            break
                                    if not current_url and tunnels:
                                        current_url = tunnels[0].get('public_url')
                    except Exception:
                        pass
            except Exception:
                pass
        
        return web.json_response({
            'installed': ngrok_installed,
            'running': tunnel_running,
            'url': current_url,
            'install_command': 'curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok'
        })
    except Exception as e:
        logger.error(f"Error checking ngrok status: {e}")
        return web.json_response({
            'installed': False,
            'running': False,
            'url': None,
            'error': str(e)
        }, status=500)


async def handle_service_status(request):
    """GET /api/bridge/service-status - Check systemd service status"""
    try:
        import subprocess
        
        service_name = "prostat-bridge"
        status_info = {
            "service_name": service_name,
            "installed": False,
            "enabled": False,
            "active": False,
            "running": False,
            "failed": False,
            "status_text": None,
            "error": None,
        }
        
        # Check if service file exists
        service_file = f"/etc/systemd/system/{service_name}.service"
        if os.path.exists(service_file):
            status_info["installed"] = True
        else:
            status_info["error"] = f"Service file not found at {service_file}"
            return web.json_response(status_info)
        
        # Check if service is enabled
        try:
            result = subprocess.run(
                ["systemctl", "is-enabled", service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            status_info["enabled"] = result.returncode == 0 and result.stdout.strip() == "enabled"
        except Exception as e:
            logger.warning(f"Error checking if service is enabled: {e}")
        
        # Check if service is active/running
        try:
            result = subprocess.run(
                ["systemctl", "is-active", service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            status_info["active"] = result.returncode == 0
            status_info["running"] = result.stdout.strip() == "active"
        except Exception as e:
            logger.warning(f"Error checking if service is active: {e}")
        
        # Check if service failed
        try:
            result = subprocess.run(
                ["systemctl", "is-failed", service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            status_info["failed"] = result.returncode == 0 and result.stdout.strip() == "failed"
        except Exception as e:
            logger.warning(f"Error checking if service failed: {e}")
        
        # Get detailed status
        try:
            result = subprocess.run(
                ["systemctl", "status", service_name, "--no-pager", "-l"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0 or result.stdout:
                # Extract key info from status output
                lines = result.stdout.split('\n')
                status_info["status_text"] = '\n'.join(lines[:20])  # First 20 lines
        except Exception as e:
            logger.warning(f"Error getting service status: {e}")
        
        return web.json_response(status_info)
    except Exception as e:
        logger.error(f"Error checking service status: {e}")
        return web.json_response({
            "error": str(e),
            "service_name": "prostat-bridge"
        }, status=500)


# ============================================================================
# Settings Management Handlers - Remote Configuration via Tailscale
# ============================================================================

SETTINGS_FILE = None  # Will be set in main()

def get_settings_file_path():
    """Get the path to the settings storage file"""
    data_dir = get_data_directory()
    return os.path.join(data_dir, 'user_settings.json')

def load_settings():
    """Load settings from file"""
    settings_file = get_settings_file_path()
    try:
        if os.path.exists(settings_file):
            with open(settings_file, 'r') as f:
                return json.load(f)
        return {}
    except Exception as e:
        logger.error(f"Error loading settings: {e}")
        return {}

def save_settings(settings):
    """Save settings to file"""
    settings_file = get_settings_file_path()
    try:
        # Ensure data directory exists
        os.makedirs(os.path.dirname(settings_file), exist_ok=True)
        
        # Atomic write with backup
        backup_file = settings_file + '.backup'
        if os.path.exists(settings_file):
            shutil.copy2(settings_file, backup_file)
        
        # Write new settings
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)
        
        logger.info(f"Settings saved to {settings_file}")
        return True
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        return False

async def handle_get_settings(request):
    """GET /api/settings - Get all user settings
    
    Returns data in format expected by e-ink display:
    {
        'last_forecast_summary': {...},
        'userSettings': {...},
        'location': {...}
    }
    """
    try:
        settings = load_settings()
        
        # Try to load forecast data if available
        forecast_data = None
        try:
            # Check for forecast data in settings file or separate cache
            forecast_file = os.path.join(get_data_directory(), 'last_forecast_summary.json')
            if os.path.exists(forecast_file):
                with open(forecast_file, 'r') as f:
                    forecast_data = json.load(f)
            # Also check if it's stored in settings
            elif 'last_forecast_summary' in settings:
                forecast_data = settings.get('last_forecast_summary')
        except Exception as e:
            logger.debug(f"Could not load forecast data: {e}")
        
        # Extract location from settings
        location = settings.get('location') or settings.get('userLocation')
        
        # Return in format expected by e-ink display (flat structure, not nested)
        return web.json_response({
            'last_forecast_summary': forecast_data,
            'userSettings': settings,
            'location': location
        })
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def handle_get_setting(request):
    """GET /api/settings/{key} - Get a specific setting"""
    try:
        key = request.match_info.get('key')
        if not key:
            return web.json_response({
                'success': False,
                'error': 'Setting key is required'
            }, status=400)
        
        settings = load_settings()
        value = settings.get(key)
        
        return web.json_response({
            'success': True,
            'key': key,
            'value': value
        })
    except Exception as e:
        logger.error(f"Error getting setting: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def handle_set_setting(request):
    """POST /api/settings/{key} - Set a specific setting"""
    try:
        key = request.match_info.get('key')
        if not key:
            return web.json_response({
                'success': False,
                'error': 'Setting key is required'
            }, status=400)
        
        data = await request.json()
        value = data.get('value')
        
        if value is None:
            return web.json_response({
                'success': False,
                'error': 'Value is required'
            }, status=400)
        
        settings = load_settings()
        settings[key] = value
        
        if save_settings(settings):
            return web.json_response({
                'success': True,
                'key': key,
                'value': value
            })
        else:
            return web.json_response({
                'success': False,
                'error': 'Failed to save settings'
            }, status=500)
    except Exception as e:
        logger.error(f"Error setting setting: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def handle_set_settings_batch(request):
    """POST /api/settings - Set multiple settings at once"""
    try:
        data = await request.json()
        settings_update = data.get('settings', {})
        
        if not settings_update:
            return web.json_response({
                'success': False,
                'error': 'Settings object is required'
            }, status=400)
        
        settings = load_settings()
        settings.update(settings_update)
        
        if save_settings(settings):
            return web.json_response({
                'success': True,
                'settings': settings
            })
        else:
            return web.json_response({
                'success': False,
                'error': 'Failed to save settings'
            }, status=500)
    except Exception as e:
        logger.error(f"Error setting settings: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)

async def handle_delete_setting(request):
    """DELETE /api/settings/{key} - Delete a specific setting"""
    try:
        key = request.match_info.get('key')
        if not key:
            return web.json_response({
                'success': False,
                'error': 'Setting key is required'
            }, status=400)
        
        settings = load_settings()
        if key in settings:
            del settings[key]
            if save_settings(settings):
                return web.json_response({
                    'success': True,
                    'key': key,
                    'message': 'Setting deleted'
                })
            else:
                return web.json_response({
                    'success': False,
                    'error': 'Failed to save settings'
                }, status=500)
        else:
            return web.json_response({
                'success': False,
                'error': 'Setting not found'
            }, status=404)
    except Exception as e:
        logger.error(f"Error deleting setting: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


async def handle_cost_estimate(request):
    """POST /api/cost-estimate - Calculate weekly/monthly HVAC cost estimate
    Uses actual utility rates from user settings. Validates input bounds."""
    try:
        data = await request.json()
        outdoor_temp = data.get('outdoor_temp')
        target_temp = data.get('target_temp')
        duration_hours = data.get('duration_hours', 168)
        
        if outdoor_temp is None or target_temp is None:
            return web.json_response({
                'success': False,
                'error': 'outdoor_temp and target_temp are required'
            }, status=400)
        
        # Validate inputs
        try:
            outdoor_temp = float(outdoor_temp)
            target_temp = float(target_temp)
            duration_hours = max(1, int(duration_hours))
            
            if outdoor_temp < -50 or outdoor_temp > 130:
                return web.json_response({
                    'success': False,
                    'error': 'outdoor_temp must be -50°F to 130°F'
                }, status=400)
            
            if target_temp < 60 or target_temp > 85:
                return web.json_response({
                    'success': False,
                    'error': 'target_temp must be 60°F to 85°F'
                }, status=400)
        except (ValueError, TypeError):
            return web.json_response({
                'success': False,
                'error': 'Temperatures must be numbers'
            }, status=400)
        
        # Load actual rates from user settings
        electricity_rate = 0.13
        building_sqft = 1500
        
        try:
            settings_file = CONFIG_DIR / 'user_settings.json'
            if settings_file.exists():
                with open(settings_file) as f:
                    s = json.load(f)
                    if s.get('electricityRate'):
                        electricity_rate = float(s['electricityRate'])
                    if s.get('squareFeet'):
                        building_sqft = float(s['squareFeet'])
        except Exception as e:
            logger.debug(f"Settings load: {e}")
        
        # Calculate BTU requirement based on temp diff and building size
        temp_diff = abs(target_temp - outdoor_temp)
        btu_per_sqft_per_deg = 12
        estimated_btu_hr = building_sqft * temp_diff * btu_per_sqft_per_deg
        
        # Convert to kWh (1kWh=3412 BTU, 70% HVAC efficiency)
        estimated_kwh_per_hour = estimated_btu_hr / 3412 / 0.7
        
        # Calculate cost
        estimated_cost = estimated_kwh_per_hour * duration_hours * electricity_rate
        weekly_cost = (estimated_cost / duration_hours) * 168
        monthly_cost = weekly_cost * 4.33
        
        if temp_diff > 5:
            weekly_cost = max(weekly_cost, 1.00)
            monthly_cost = max(monthly_cost, 4.00)
        
        return web.json_response({
            'success': True,
            'weeklyCost': round(weekly_cost, 2),
            'monthlyCost': round(monthly_cost, 2),
            'electricity_rate': electricity_rate
        })
    except Exception as e:
        logger.error(f"Cost estimate error: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


async def handle_setpoint_delta(request):
    """POST /api/setpoint - Adjust temperature with validation and bounds checking"""
    try:
        data = await request.json()
        delta = data.get('delta', 0)
        
        if not isinstance(delta, (int, float)):
            return web.json_response({
                'success': False,
                'error': 'delta must be number'
            }, status=400)
        
        # Validate delta is within safe bounds
        try:
            delta = float(delta)
            if abs(delta) > 10:
                return web.json_response({
                    'success': False,
                    'error': f'delta must be -10 to +10°F (got {delta})'
                }, status=400)
        except (ValueError, TypeError):
            return web.json_response({
                'success': False,
                'error': 'delta must be valid number'
            }, status=400)
        
        # Get primary device
        device_ids = list(pairings.keys())
        if not device_ids:
            return web.json_response({
                'success': False,
                'error': 'No device paired'
            }, status=400)
        
        device_id = device_ids[0]
        
        try:
            status = await get_thermostat_data(device_id)
            current_target_c = status.get('target_temperature')
            
            if current_target_c is None:
                return web.json_response({
                    'success': False,
                    'error': 'Cannot get current temperature'
                }, status=500)
            
            # Convert Celsius to Fahrenheit, apply delta
            current_target_f = (current_target_c * 9/5) + 32
            new_target_f = current_target_f + delta
            
            # Validate result is in safe range (60°F - 85°F)
            if new_target_f < 60 or new_target_f > 85:
                return web.json_response({
                    'success': False,
                    'error': f'Result {round(new_target_f, 1)}°F outside safe range (60-85°F)'
                }, status=400)
            
            # Convert back to Celsius for HomeKit
            new_target_c = (new_target_f - 32) * 5/9
            new_target_c = round(new_target_c, 1)
            
            await set_temperature(device_id, new_target_c)
            
            logger.info(f"Setpoint: {current_target_f:.1f}°F → {new_target_f:.1f}°F")
            
            return web.json_response({
                'success': True,
                'new_target': round(new_target_f, 1),
                'new_target_c': new_target_c,
                'previous_target': round(current_target_f, 1)
            })
        except Exception as e:
            logger.error(f"Setpoint error: {e}")
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    except Exception as e:
        logger.error(f"Setpoint handler error: {e}")
        return web.json_response({
            'success': False,
            'error': str(e)
        }, status=500)


# ============================================================================
# TTS (Text-to-Speech) Handlers - Optional Feature
# ============================================================================

# Global TTS model cache
tts_model = None
tts_available = False

def load_tts_model():
    """Load Coqui TTS model (lazy loading). Returns True if successful."""
    global tts_model, tts_available
    
    if tts_model is not None:
        return True
    
    try:
        from TTS.api import TTS
        
        logger.info("Loading Coqui TTS model...")
        model_name = os.getenv("TTS_MODEL", "tts_models/en/ljspeech/tacotron2-DDC")
        
        tts = TTS(model_name=model_name, progress_bar=False)
        tts_model = tts
        tts_available = True
        
        logger.info(f"TTS model loaded: {model_name}")
        return True
        
    except ImportError:
        logger.warning("Coqui TTS not installed. TTS features disabled. Install with: pip install TTS")
        tts_available = False
        return False
    except Exception as e:
        logger.error(f"Failed to load TTS model: {e}")
        tts_available = False
        return False


async def handle_tts_health(request):
    """GET /api/tts/health - TTS service health check"""
    model_loaded = load_tts_model()
    return web.json_response({
        "status": "ok" if model_loaded else "unavailable",
        "model_loaded": model_loaded,
        "service": "coqui-tts"
    })


async def handle_tts_synthesize(request):
    """POST /api/tts/synthesize - Convert text to speech"""
    try:
        data = await request.json()
        text = data.get("text", "")
        speaker_id = data.get("speaker_id", None)
        language = data.get("language", "en")
        
        if not text:
            return web.json_response({"error": "Text is required"}, status=400)
        
        # Load model if not already loaded
        if not load_tts_model():
            return web.json_response({
                "error": "TTS model not available. Install Coqui TTS: pip install TTS"
            }, status=503)
        
        logger.info(f"Synthesizing speech for text: {text[:50]}...")
        
        # Generate audio
        import numpy as np
        import soundfile as sf
        import io
        import base64
        
        wav = tts_model.tts(text=text, speaker=speaker_id, language=language)
        
        # Ensure audio is in correct format
        if isinstance(wav, np.ndarray):
            if wav.dtype != np.float32:
                wav = wav.astype(np.float32)
            if wav.max() > 1.0 or wav.min() < -1.0:
                wav = wav / np.max(np.abs(wav))
        
        # Write to bytes buffer
        buffer = io.BytesIO()
        sf.write(buffer, wav, 22050, format='WAV')
        buffer.seek(0)
        
        # Convert to base64 for JSON response
        audio_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        
        return web.json_response({
            "audio": audio_base64,
            "format": "wav",
            "sample_rate": 22050,
            "text": text
        })
        
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}", exc_info=True)
        return web.json_response({"error": str(e)}, status=500)


async def handle_tts_voices(request):
    """GET /api/tts/voices - Get available voices"""
    try:
        if not load_tts_model():
            return web.json_response({"voices": []})
        
        voices = []
        try:
            if hasattr(tts_model, 'speaker_manager') and tts_model.speaker_manager:
                speaker_ids = tts_model.speaker_manager.speaker_ids
                voices = [{"id": sid, "name": f"Speaker {sid}"} for sid in speaker_ids]
        except:
            pass
        
        if not voices:
            voices = [{"id": None, "name": "Default"}]
        
        return web.json_response({"voices": voices})
        
    except Exception as e:
        logger.error(f"Error getting voices: {e}")
        return web.json_response({"voices": []})
async def handle_homekit_bridge_pairing_info(request):
    """GET /api/homekit-bridge/pairing-info - Get HomeKit bridge pairing code and info"""
    global homekit_bridge_driver
    
    if not HAP_PYTHON_AVAILABLE:
        return web.json_response({
            'available': False,
            'error': 'HAP-python not installed'
        }, status=503)
    
    if not homekit_bridge_driver:
        return web.json_response({
            'available': False,
            'error': 'HomeKit bridge not started'
        }, status=503)
    
    try:
        # Get setup code from driver state
        pincode = homekit_bridge_driver.state.pincode
        if isinstance(pincode, bytes):
            pincode = pincode.decode('utf-8')
        
        # Format as XXX-XX-XXX
        pincode_formatted = pincode if '-' in pincode else f"{pincode[:3]}-{pincode[3:5]}-{pincode[5:]}"
        
        # Get setup ID for QR code
        setup_id = homekit_bridge_driver.state.setup_id.decode('utf-8') if isinstance(homekit_bridge_driver.state.setup_id, bytes) else homekit_bridge_driver.state.setup_id
        
        # Get MAC address for QR code
        mac = homekit_bridge_driver.state.mac.decode('utf-8') if isinstance(homekit_bridge_driver.state.mac, bytes) else homekit_bridge_driver.state.mac
        
        # Generate QR code data (HomeKit format)
        # Format: X-HM://[setup_id][mac]
        qr_data = f"X-HM://{setup_id}{mac.replace(':', '')}"
        
        # Check if already paired
        is_paired = len(homekit_bridge_driver.state.paired_clients) > 0
        
        return web.json_response({
            'available': True,
            'pincode': pincode_formatted,
            'setup_id': setup_id,
            'mac': mac,
            'qr_data': qr_data,
            'paired': is_paired,
            'paired_clients_count': len(homekit_bridge_driver.state.paired_clients),
            'port': 51826
        })
    except Exception as e:
        logger.error(f"Error getting HomeKit bridge pairing info: {e}", exc_info=True)
        return web.json_response({
            'available': False,
            'error': str(e)
        }, status=500)


async def start_homekit_bridge():
    """Start the HomeKit bridge server (exposes devices as accessories)"""
    global homekit_bridge_driver
    
    if not HAP_PYTHON_AVAILABLE:
        logger.warning("Cannot start HomeKit bridge: HAP-python not available")
        return
    
    try:
        # Get device_id from pairings (direct access, no HTTP call needed)
        device_id = None
        if pairings:
            # Get first paired device
            device_id = list(pairings.keys())[0]
            logger.info(f"Found paired device for HomeKit bridge: {device_id}")
        else:
            logger.warning("No paired device found - HomeKit bridge will start without accessories")
            logger.info("Pair a device first, then restart the bridge to enable HomeKit accessories")
        
        # Get persist file path
        import os
        data_dir = get_data_directory()
        persist_file = os.path.join(data_dir, 'homekit-bridge.state')
        
        # Check if Blueair is available
        blueair_available = False
        try:
            blueair_status = await get_blueair_status(0)
            blueair_available = blueair_status is not None
            if blueair_available:
                logger.info("Blueair is available, will add Air Purifier accessory")
        except Exception as e:
            logger.debug(f"Could not check Blueair status: {e}")
        
        # Discover TP-Link devices
        tplink_devices_list = []
        if tplink_kasa_available:
            try:
                discovered = await discover_tplink_devices()
                if discovered:
                    tplink_devices_list = discovered
                    logger.info(f"Found {len(discovered)} TP-Link device(s), will add to bridge")
            except Exception as e:
                logger.debug(f"Could not discover TP-Link devices: {e}")
        
        # Create bridge
        driver, bridge = create_bridge(
            device_id=device_id,
            port=51826,
            persist_file=persist_file,
            blueair_available=blueair_available,
            tplink_devices=tplink_devices_list
        )
        
        homekit_bridge_driver = driver
        
        # Start driver in background thread (it's blocking)
        import threading
        def run_driver():
            try:
                driver.start()
            except Exception as e:
                logger.error(f"HomeKit bridge driver error: {e}")
        
        bridge_thread = threading.Thread(target=run_driver, daemon=True)
        bridge_thread.start()
        
        logger.info("=" * 60)
        logger.info("HomeKit Bridge Server Started")
        logger.info("=" * 60)
        logger.info(f"Bridge name: {bridge.display_name}")
        logger.info(f"Port: 51826")
        logger.info(f"Pairing file: {persist_file}")
        accessories_list = []
        if device_id:
            logger.info(f"Device ID: {device_id}")
            logger.info("Thermostat accessory available")
            accessories_list.append("Thermostat")
        if blueair_available:
            logger.info("Air Purifier accessory available")
            accessories_list.append("Air Purifier")
        if not accessories_list:
            logger.info("No accessories (pair a device or configure Blueair first)")
        else:
            logger.info(f"Accessories: {', '.join(accessories_list)}")
        logger.info("")
        logger.info("To pair with Apple Home app:")
        logger.info("1. Open Apple Home app")
        logger.info("2. Tap '+' → Add Accessory")
        logger.info("3. Scan QR code or enter PIN (check logs for PIN)")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Failed to start HomeKit bridge: {e}", exc_info=True)
        logger.warning("Continuing without HomeKit bridge...")


async def init_app():
    """Initialize the aiohttp application"""
    app = web.Application()
    
    # Enable CORS for local web app
    cors = aiohttp_cors.setup(app, defaults={
        "*": aiohttp_cors.ResourceOptions(
            allow_credentials=True,
            expose_headers="*",
            allow_headers="*",
            allow_methods="*"
        )
    })
    
    # Routes - HomeKit
    app.router.add_get('/api/discover', handle_discover)
    app.router.add_post('/api/pair', handle_pair)
    app.router.add_post('/api/unpair', handle_unpair)
    app.router.add_get('/api/pairing/diagnostics', handle_pairing_diagnostics)
    app.router.add_get('/api/diagnose', handle_pairing_diagnostics)  # Alias for frontend compatibility
    app.router.add_post('/api/pairing/clear-stale', handle_clear_stale_pairings)
    app.router.add_post('/api/auto-fix', handle_clear_stale_pairings)  # Alias for frontend compatibility
    app.router.add_get('/api/pairing/status', handle_pairing_status_get)
    app.router.add_post('/api/pairing/status', handle_pairing_status_post)
    app.router.add_get('/api/status', handle_status)
    app.router.add_post('/api/set-temperature', handle_set_temperature)
    app.router.add_post('/api/set-mode', handle_set_mode)
    app.router.add_get('/api/paired', handle_paired_devices)
    app.router.add_get('/api/primary', handle_primary_device)
    
    # Routes - Relay Control
    app.router.add_get('/api/relay/status', handle_relay_status)
    app.router.add_post('/api/relay/control', handle_relay_control)
    app.router.add_post('/api/system-state', handle_update_system_state)
    app.router.add_post('/api/interlock/evaluate', handle_evaluate_interlock)
    
    # Routes - Blueair Control
    app.router.add_get('/api/blueair/status', handle_blueair_status)
    app.router.add_get('/api/blueair/credentials', handle_get_blueair_credentials)
    app.router.add_post('/api/blueair/credentials', handle_blueair_credentials)
    app.router.add_post('/api/blueair/fan', handle_blueair_fan)
    app.router.add_post('/api/blueair/led', handle_blueair_led)
    app.router.add_post('/api/blueair/dust-kicker', handle_dust_kicker)
    
    # TP-Link endpoints
    app.router.add_get('/api/tplink/discover', handle_tplink_discover)
    app.router.add_get('/api/tplink/status', handle_tplink_status)
    app.router.add_post('/api/tplink/switch', handle_tplink_switch)
    
    # Health check
    app.router.add_get('/health', lambda r: web.json_response({'status': 'ok'}))
    
    # HomeKit Bridge pairing info
    app.router.add_get('/api/homekit-bridge/pairing-info', handle_homekit_bridge_pairing_info)
    
    # OTA Update endpoints
    app.router.add_get('/api/ota/version', handle_ota_version)
    app.router.add_get('/api/ota/check', handle_ota_check)
    app.router.add_post('/api/ota/update', handle_ota_update)
    
    # Bridge process management
    app.router.add_get('/api/bridge/processes', handle_check_bridge_processes)
    app.router.add_post('/api/bridge/kill-duplicates', handle_kill_duplicate_bridges)
    app.router.add_post('/api/bridge/restart', handle_restart_bridge)
    app.router.add_get('/api/bridge/logs', handle_bridge_logs)
    app.router.add_get('/api/bridge/info', handle_bridge_info)
    app.router.add_get('/api/bridge/service-status', handle_service_status)
    app.router.add_post('/api/bridge/tailscale/install', handle_tailscale_install)
    app.router.add_post('/api/bridge/ngrok/start', handle_ngrok_start)
    app.router.add_post('/api/bridge/ngrok/stop', handle_ngrok_stop)
    app.router.add_get('/api/bridge/ngrok/status', handle_ngrok_status)
    
    # EnergyPlus endpoints
    app.router.add_get('/api/energyplus/status', handle_energyplus_status)
    app.router.add_post('/api/energyplus/calculate', handle_energyplus_calculate)
    app.router.add_post('/api/rebates/calculate', handle_rebates_calculate)
    
    # TTS endpoints (optional feature)
    app.router.add_get('/api/tts/health', handle_tts_health)
    app.router.add_post('/api/tts/synthesize', handle_tts_synthesize)
    app.router.add_get('/api/tts/voices', handle_tts_voices)
    
    # Settings management endpoints (remote configuration via Tailscale)
    app.router.add_get('/api/settings', handle_get_settings)
    app.router.add_get('/api/settings/{key}', handle_get_setting)
    app.router.add_post('/api/settings', handle_set_settings_batch)
    app.router.add_post('/api/settings/{key}', handle_set_setting)
    app.router.add_delete('/api/settings/{key}', handle_delete_setting)
    
    # E-ink display endpoints
    app.router.add_post('/api/cost-estimate', handle_cost_estimate)
    app.router.add_post('/api/setpoint', handle_setpoint_delta)
    
    # WiFi configuration endpoints
    app.router.add_get('/api/wifi/status', handle_wifi_status)
    app.router.add_get('/api/wifi/scan', handle_wifi_scan)
    app.router.add_post('/api/wifi/connect', handle_wifi_connect)
    app.router.add_post('/api/wifi/disconnect', handle_wifi_disconnect)
    
    # Enable CORS for all routes
    for route in list(app.router.routes()):
        cors.add(route)
    
    # Serve static files from the web app build directory
    # This allows the Pi to serve the full web UI at http://joule-bridge.local
    # Try multiple possible locations
    possible_paths = [
        Path('/home/pi/git/joule-hvac/dist'),  # Pi deployment path
        Path(__file__).parent.parent / 'dist',  # Development path
        Path('/home/pi/dist'),  # Fallback
    ]
    web_app_dir = None
    for path in possible_paths:
        if path.exists():
            web_app_dir = path
            break
    
    if web_app_dir:
        logger.info(f"Serving web app from {web_app_dir}")
        app.router.add_static('/assets', web_app_dir / 'assets', name='assets')
        
        # Serve index.html for all non-API routes (SPA fallback)
        async def serve_spa(request):
            """Serve index.html for client-side routing"""
            index_file = web_app_dir / 'index.html'
            if index_file.exists():
                return web.FileResponse(index_file)
            return web.Response(text='Web app not built. Run: npm run build', status=404)
        
        # Add SPA fallback route (must be last)
        app.router.add_get('/{path:.*}', serve_spa)
    else:
        logger.warning(f"Web app directory not found: {web_app_dir}")
        logger.warning("Run 'npm run build' to build the web app")
    
    return app


# Auto-reconnect background task
auto_reconnect_running = False
auto_reconnect_interval = 30  # Check every 30 seconds
last_device_health = {}  # device_id -> {'reachable': bool, 'last_check': timestamp, 'reconnect_attempts': int}

async def auto_reconnect_task():
    """
    Background task that periodically checks if paired devices are reachable.
    If a device becomes unreachable, attempts to re-discover and reconnect.
    """
    global auto_reconnect_running, last_device_health
    auto_reconnect_running = True
    logger.info(f"Starting auto-reconnect background task (interval: {auto_reconnect_interval}s)")
    
    while auto_reconnect_running:
        try:
            await asyncio.sleep(auto_reconnect_interval)
            
            if not pairings:
                continue
            
            for device_id, pairing in list(pairings.items()):
                now = datetime.now()
                
                # Initialize health tracking for this device
                if device_id not in last_device_health:
                    last_device_health[device_id] = {
                        'reachable': True, 
                        'last_check': now,
                        'reconnect_attempts': 0
                    }
                
                try:
                    # Try to get thermostat status to check if device is reachable
                    data = await asyncio.wait_for(
                        get_thermostat_data(device_id), 
                        timeout=10  # 10 second timeout for health check
                    )
                    
                    # Device is reachable
                    if not last_device_health[device_id]['reachable']:
                        logger.info(f"Device {device_id} is reachable again")
                    
                    last_device_health[device_id] = {
                        'reachable': True,
                        'last_check': now,
                        'reconnect_attempts': 0
                    }
                    
                except asyncio.TimeoutError:
                    logger.warning(f"Health check timeout for device {device_id}")
                    await attempt_reconnect(device_id)
                    
                except Exception as e:
                    error_str = str(e).lower()
                    if 'not paired' in error_str or 'accessory not found' in error_str:
                        logger.warning(f"Device {device_id} appears unreachable: {e}")
                        await attempt_reconnect(device_id)
                    else:
                        # Log other errors but don't attempt reconnect for unexpected errors
                        logger.debug(f"Health check error for {device_id}: {e}")
                        
        except asyncio.CancelledError:
            logger.info("Auto-reconnect task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in auto-reconnect task: {e}")
            # Continue running even if there's an error
            await asyncio.sleep(5)
    
    logger.info("Auto-reconnect task stopped")

async def attempt_reconnect(device_id: str):
    """Attempt to reconnect to a device through re-discovery"""
    global last_device_health
    
    if device_id not in last_device_health:
        last_device_health[device_id] = {
            'reachable': False,
            'last_check': datetime.now(),
            'reconnect_attempts': 0
        }
    
    health = last_device_health[device_id]
    health['reachable'] = False
    health['reconnect_attempts'] += 1
    health['last_check'] = datetime.now()
    
    # Limit reconnect attempts (max 3, then wait longer)
    if health['reconnect_attempts'] > 3:
        logger.info(f"Device {device_id} unreachable after 3 reconnect attempts, waiting longer before retry")
        # Reset attempts counter after a longer wait (handled by the interval)
        if health['reconnect_attempts'] > 6:
            health['reconnect_attempts'] = 0  # Reset to try again
        return
    
    logger.info(f"Attempting reconnect for device {device_id} (attempt {health['reconnect_attempts']})")
    
    try:
        # Run discovery to find updated device info (IP may have changed)
        logger.info(f"Running discovery to find {device_id}...")
        await discover_devices()
        await asyncio.sleep(2)
        
        # Try to reload the pairing
        if controller and hasattr(controller, 'pairings') and device_id in controller.pairings:
            pairing_data = controller.pairings[device_id]
            try:
                pairing = controller.load_pairing(device_id, pairing_data if isinstance(pairing_data, dict) else {})
                pairings[device_id] = pairing
                logger.info(f"Successfully reconnected to device {device_id}")
                health['reachable'] = True
                health['reconnect_attempts'] = 0
            except Exception as e:
                logger.warning(f"Failed to reload pairing for {device_id}: {e}")
        else:
            logger.debug(f"Device {device_id} not found in controller pairings")
            
    except Exception as e:
        logger.warning(f"Reconnect attempt failed for {device_id}: {e}")


async def main():
    """Main entry point"""
    global async_zeroconf  # Declare at top of function before any use
    logger.info("Starting ProStat Bridge...")
    
    # Initialize HomeKit controller first
    await init_controller()
    
    # Load existing pairings if available
    import os
    data_dir = get_data_directory()
    os.makedirs(data_dir, exist_ok=True)  # Ensure data directory exists
    pairing_file = os.path.join(data_dir, 'pairings.json')
    
    if controller:
        if os.path.exists(pairing_file):
            try:
                # Check if file is not empty
                file_size = os.path.getsize(pairing_file)
                if file_size > 2:  # More than just "{}"
                    # Validate JSON structure before loading (hardens against file corruption)
                    should_load = True
                    try:
                        with open(pairing_file, 'r') as f:
                            json.load(f)  # Validate JSON is parseable
                    except (json.JSONDecodeError, ValueError) as json_err:
                        logger.error(f"Pairing file {pairing_file} contains invalid JSON: {json_err}")
                        # Try to restore from backup if main file is corrupted
                        backup_file = pairing_file + '.backup'
                        if os.path.exists(backup_file):
                            try:
                                logger.info(f"Attempting to restore from backup: {backup_file}")
                                shutil.copy2(backup_file, pairing_file)
                                logger.info(f"Restored pairing file from backup")
                                # Re-validate the restored file
                                with open(pairing_file, 'r') as f:
                                    json.load(f)
                                # If restore succeeded, continue with loading
                            except Exception as restore_err:
                                logger.error(f"Backup restore failed: {restore_err}")
                                logger.info("Skipping corrupted pairing file - you may need to re-pair")
                                should_load = False
                        else:
                            logger.info("No backup available - you may need to re-pair")
                            should_load = False
                    
                    if should_load:
                        # Small delay to let network initialize (hardens against network timing issues)
                        await asyncio.sleep(2)
                        controller.load_data(pairing_file)
                        logger.info(f"Loaded existing pairings from {pairing_file}")
                        # Populate pairings dictionary from controller's internal pairings
                        # The controller stores pairings in controller.pairings dict
                        if hasattr(controller, 'pairings') and controller.pairings:
                            for alias, pairing_data in controller.pairings.items():
                                # Get device_id from pairing data or use alias
                                device_id = pairing_data.get('id') if isinstance(pairing_data, dict) else alias
                                # Load the pairing object with retry and re-discovery
                                try:
                                    pairing = controller.load_pairing(alias, pairing_data if isinstance(pairing_data, dict) else {})
                                    pairings[device_id] = pairing
                                    logger.info(f"Loaded pairing for device {device_id} (alias: {alias})")
                                except Exception as e:
                                    logger.warning(f"Failed to load pairing for {alias}: {e}")
                                    # Retry with re-discovery (hardens against IP changes and device unreachable)
                                    try:
                                        logger.info(f"Attempting re-discovery for {device_id} before retry...")
                                        await discover_devices()
                                        await asyncio.sleep(1)
                                        pairing = controller.load_pairing(alias, pairing_data if isinstance(pairing_data, dict) else {})
                                        pairings[device_id] = pairing
                                        logger.info(f"Successfully loaded pairing for {device_id} after re-discovery")
                                    except Exception as e2:
                                        logger.warning(f"Failed to load pairing for {alias} after re-discovery: {e2}")
                        else:
                            logger.info("No pairings found in controller after loading file")
                else:
                    logger.info(f"Pairing file {pairing_file} is empty, skipping load")
            except Exception as e:
                logger.warning(f"Failed to load pairings from {pairing_file}: {e}")
                logger.info("Continuing without loaded pairings - you may need to re-pair")
        else:
            logger.info(f"No pairing file found at {pairing_file}, starting fresh")
    
    # Pairing health check on startup
    if pairings:
        logger.info("Running pairing health check on startup...")
        healthy_count = 0
        unhealthy_devices = []
        for device_id in list(pairings.keys()):
            try:
                data = await get_thermostat_data(device_id)
                if data and 'current_temperature' in data:
                    healthy_count += 1
                    logger.info(f"  ✓ Device {device_id[:8]}... is healthy (temp: {data.get('current_temperature')}°)")
                else:
                    unhealthy_devices.append(device_id)
                    logger.warning(f"  ✗ Device {device_id[:8]}... returned no data")
            except Exception as e:
                unhealthy_devices.append(device_id)
                logger.warning(f"  ✗ Device {device_id[:8]}... is unreachable: {e}")
        
        if unhealthy_devices:
            logger.warning(f"Pairing health check: {healthy_count} healthy, {len(unhealthy_devices)} unreachable")
            logger.warning("Unreachable devices may need re-pairing if they persist.")
            # Update global pairing status for HMI
            global pairing_status
            pairing_status['mode'] = 'unhealthy'
            pairing_status['error'] = f"{len(unhealthy_devices)} device(s) unreachable"
            pairing_status['timestamp'] = datetime.now().isoformat()
        else:
            logger.info(f"Pairing health check: All {healthy_count} device(s) healthy")
            pairing_status['mode'] = 'healthy'
            pairing_status['timestamp'] = datetime.now().isoformat()
    
    # Initialize relay (optional - service works without it)
    await init_relay()
    
    # Initialize Blueair (optional - service works without it)
    await init_blueair()
    
    # Start HomeKit Bridge (for exposing devices as accessories)
    if homekit_bridge_enabled and HAP_PYTHON_AVAILABLE:
        await start_homekit_bridge()
    elif homekit_bridge_enabled and not HAP_PYTHON_AVAILABLE:
        logger.warning("HomeKit bridge is enabled but HAP-python is not installed")
        logger.warning("Install with: pip install HAP-python")
    
    # Create and run web server
    app = await init_app()
    
    # Run on all interfaces, port 8080
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    
    logger.info("ProStat Bridge listening on http://0.0.0.0:8080")
    logger.info("API endpoints:")
    logger.info("  HomeKit:")
    logger.info("    GET  /api/discover - Discover HomeKit devices")
    logger.info("    POST /api/pair - Pair with device")
    logger.info("    POST /api/unpair - Unpair from device")
    logger.info("    GET  /api/pairing/diagnostics - Check pairing issues")
    logger.info("    POST /api/pairing/clear-stale - Clear stale pairings")
    logger.info("    GET  /api/status?device_id=... - Get thermostat status")
    logger.info("    POST /api/set-temperature - Set temperature")
    logger.info("    POST /api/set-mode - Set HVAC mode")
    logger.info("    GET  /api/paired - List paired devices")
    logger.info("    GET  /api/primary - Get primary device ID (validated)")
    logger.info("  Relay Control:")
    logger.info("    GET  /api/relay/status - Get relay status")
    logger.info("    POST /api/relay/control - Control relay manually")
    logger.info("    POST /api/system-state - Update system state for interlock")
    logger.info("    POST /api/interlock/evaluate - Evaluate interlock logic")
    logger.info("  Blueair Control:")
    logger.info("    GET  /api/blueair/status - Get Blueair status")
    logger.info("    POST /api/blueair/fan - Control fan speed (0-3)")
    logger.info("    POST /api/blueair/led - Control LED brightness (0-100)")
    logger.info("    POST /api/blueair/dust-kicker - Start Dust Kicker cycle")
    
    await site.start()
    
    # Register mDNS service for easy discovery
    mdns_service = None
    if async_zeroconf:
        try:
            local_ip = get_local_ip()
            if local_ip:
                service_type = "_http._tcp.local."
                hostname = socket.gethostname().split('.')[0]  # Get just hostname, not FQDN
                port = 8080
                
                # Try preferred name first: joule-bridge.local
                preferred_name = "joule-bridge._http._tcp.local."
                from zeroconf._exceptions import NonUniqueNameException
                
                # Register hostname via Avahi if available (for hostname resolution)
                # This makes joule-bridge.local resolve to the IP
                try:
                    import subprocess
                    result = subprocess.run(
                        ['avahi-set-host-name', 'joule-bridge'],
                        capture_output=True,
                        timeout=5,
                        check=False
                    )
                    if result.returncode == 0:
                        logger.info("Registered hostname 'joule-bridge' via Avahi")
                    else:
                        logger.debug(f"Avahi hostname registration returned: {result.returncode}")
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    logger.debug("avahi-set-host-name not available, hostname registration skipped")
                except Exception as e:
                    logger.debug(f"Hostname registration attempt failed: {e}")
                
                # Create service info with preferred name
                # Use "joule-bridge.local." as server name for hostname resolution
                info = ServiceInfo(
                    service_type,
                    preferred_name,
                    addresses=[socket.inet_aton(local_ip)],
                    port=port,
                    properties={
                        b'path': b'/',
                        b'name': b'Joule Bridge'
                    },
                    server="joule-bridge.local."
                )
                
                try:
                    # Try to register with preferred name, allowing automatic name change if conflict
                    await async_zeroconf.async_register_service(info, allow_name_change=True)
                    mdns_service = info
                    actual_name = info.name
                    logger.info(f"Registered mDNS service: {actual_name} at http://{local_ip}:{port}")
                    
                    # Extract the hostname part for user-friendly display
                    if actual_name.startswith("joule-bridge"):
                        display_name = actual_name.replace("._http._tcp.local.", "")
                        logger.info(f"Bridge discoverable as: http://{display_name}:{port}")
                    else:
                        logger.info(f"Bridge accessible at: http://{hostname}.local:{port} or http://{local_ip}:{port}")
                except NonUniqueNameException as e:
                    # If preferred name conflicts, try hostname-based unique name
                    logger.warning(f"Preferred name '{preferred_name}' is already in use, using hostname-based name")
                    fallback_name = f"joule-bridge-{hostname}._http._tcp.local."
                    info = ServiceInfo(
                        service_type,
                        fallback_name,
                        addresses=[socket.inet_aton(local_ip)],
                        port=port,
                        properties={
                            b'path': b'/',
                            b'name': b'Joule Bridge'
                        },
                        server="joule-bridge.local."
                    )
                    await async_zeroconf.async_register_service(info, allow_name_change=True)
                    mdns_service = info
                    logger.info(f"Registered mDNS service with fallback name: {info.name} at http://{local_ip}:{port}")
                    logger.info(f"Bridge accessible at: http://{hostname}.local:{port} or http://{local_ip}:{port}")
            else:
                logger.warning("Could not determine local IP address for mDNS advertisement")
        except Exception as e:
            logger.warning(f"Failed to register mDNS service: {e}")
            logger.warning(f"mDNS registration error details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.debug(f"mDNS registration traceback: {traceback.format_exc()}")
            logger.info("Bridge will still work, but must be accessed by IP address")
    
    # Start auto-reconnect background task
    reconnect_task = asyncio.create_task(auto_reconnect_task())
    logger.info("Auto-reconnect background task started")
    
    # Keep running
    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        # Stop auto-reconnect task
        global auto_reconnect_running
        auto_reconnect_running = False
        reconnect_task.cancel()
        try:
            await reconnect_task
        except asyncio.CancelledError:
            pass
        
        # Unregister mDNS service
        if mdns_service and async_zeroconf:
            try:
                await async_zeroconf.async_unregister_service(mdns_service)
                logger.info("Unregistered mDNS service")
            except Exception as e:
                logger.warning(f"Failed to unregister mDNS service: {e}")
        
        await runner.cleanup()
        # Cleanup AsyncZeroconf
        if async_zeroconf:
            logger.info("Closing AsyncZeroconf...")
            await async_zeroconf.async_close()
            async_zeroconf = None


if __name__ == '__main__':
    asyncio.run(main())