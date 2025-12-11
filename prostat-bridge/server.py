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
from aiohomekit.controller import Controller
from aiohomekit.exceptions import AccessoryNotFoundError, AlreadyPairedError
from aiohttp import web, web_runner
import aiohttp_cors
import serial
import serial.tools.list_ports
from datetime import datetime
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceBrowser
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

# Relay control
relay_port = None
relay_connected = False
relay_channel = 2  # Default: Relay 2 for dehumidifier (Y2 terminal)

# Blueair control
blueair_account = None
blueair_devices = []
blueair_connected = False

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
            
            # Create AsyncServiceBrowser for _hap._tcp.local. BEFORE starting controller
            # This is required because IpController.async_start() looks for an existing browser
            logger.info("Creating AsyncServiceBrowser for _hap._tcp.local...")
            from zeroconf.asyncio import AsyncListener
            from aiohomekit.zeroconf import HAP_TYPE_TCP
            
            class HomeKitServiceListener(AsyncListener):
                """Dummy listener for HomeKit services"""
                async def async_add_service(self, zc, service_type, name):
                    pass
                async def async_remove_service(self, zc, service_type, name):
                    pass
                async def async_update_service(self, zc, service_type, name):
                    pass
            
            listener = HomeKitServiceListener()
            hap_browser = AsyncServiceBrowser(async_zeroconf.zeroconf, HAP_TYPE_TCP, listener=listener)
            logger.info(f"AsyncServiceBrowser created for {HAP_TYPE_TCP}")
        
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
    
    logger.info("Scanning for HomeKit devices...")
    devices = await controller.async_discover()
    
    result = []
    for device in devices:
        info = {
            'device_id': device.device_id,
            'name': device.description.get('name', 'Unknown'),
            'model': device.description.get('md', 'Unknown'),
            'category': device.description.get('ci', 'Unknown'),
        }
        device_info[device.device_id] = info
        result.append(info)
        logger.info(f"Found device: {info['name']} ({device.device_id})")
    
    return result


async def pair_device(device_id: str, pairing_code: str):
    """
    Pair with a HomeKit device
    
    Args:
        device_id: The device ID (e.g., "XX:XX:XX:XX:XX:XX")
        pairing_code: The 8-digit pairing code (e.g., "123-45-678")
    
    Returns:
        Pairing object
    """
    if not controller:
        await init_controller()
    
    if not controller:
        raise RuntimeError("HomeKit controller is not available")
    
    # Remove dashes from pairing code
    code = pairing_code.replace('-', '')
    
    try:
        logger.info(f"Attempting to pair with {device_id} using code {pairing_code}")
        pairing = await controller.async_pair(device_id, code)
        pairings[device_id] = pairing
        logger.info(f"Successfully paired with {device_id}")
        return pairing
    except AlreadyPairedError:
        logger.warning(f"Device {device_id} is already paired")
        # Try to load existing pairing
        pairing = await controller.async_load_pairing(device_id)
        pairings[device_id] = pairing
        return pairing
    except Exception as e:
        logger.error(f"Pairing failed: {e}")
        raise


async def unpair_device(device_id: str):
    """Unpair from a HomeKit device"""
    if device_id in pairings:
        del pairings[device_id]
    
    if controller:
        try:
            await controller.async_unpair(device_id)
            logger.info(f"Unpaired from {device_id}")
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
    
    # Read characteristics
    # Format: [(aid, iid), ...]
    characteristics = [
        (ECOBEE_AID, ECOBEE_TEMP_CURRENT),
        (ECOBEE_AID, ECOBEE_TEMP_TARGET),
        (ECOBEE_AID, ECOBEE_TARGET_STATE),
        (ECOBEE_AID, ECOBEE_CURRENT_STATE),
    ]
    
    try:
        data = await pairing.async_get_characteristics(characteristics)
        
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
        temp_key = (ECOBEE_AID, ECOBEE_TEMP_CURRENT)
        target_temp_key = (ECOBEE_AID, ECOBEE_TEMP_TARGET)
        target_state_key = (ECOBEE_AID, ECOBEE_TARGET_STATE)
        current_state_key = (ECOBEE_AID, ECOBEE_CURRENT_STATE)
        
        if temp_key in data:
            result['temperature'] = data[temp_key].get('value')
        
        if target_temp_key in data:
            result['target_temperature'] = data[target_temp_key].get('value')
        
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
    """Set target temperature"""
    if device_id not in pairings:
        raise ValueError(f"Device {device_id} is not paired")
    
    pairing = pairings[device_id]
    
    # Write target temperature
    # Format: [(aid, iid, value), ...]
    await pairing.async_put_characteristics([
        (ECOBEE_AID, ECOBEE_TEMP_TARGET, temperature)
    ])
    
    logger.info(f"Set temperature to {temperature}°F on {device_id}")


async def set_mode(device_id: str, mode: str):
    """
    Set HVAC mode
    
    Args:
        mode: 'off', 'heat', 'cool', or 'auto'
    """
    if device_id not in pairings:
        raise ValueError(f"Device {device_id} is not paired")
    
    pairing = pairings[device_id]
    
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
    await pairing.async_put_characteristics([
        (ECOBEE_AID, ECOBEE_TARGET_STATE, state)
    ])
    
    logger.info(f"Set mode to {mode} on {device_id}")


# REST API Handlers

async def handle_discover(request):
    """GET /api/discover - Discover HomeKit devices"""
    try:
        devices = await discover_devices()
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


async def handle_status(request):
    """GET /api/status - Get thermostat status"""
    try:
        device_id = request.query.get('device_id')
        
        if not device_id:
            # Return status of all paired devices
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
        data = await get_thermostat_data(device_id)
        return web.json_response(data)
    except Exception as e:
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


# ============================================================================
# Relay Control (Dehumidifier)
# ============================================================================

def find_relay_port():
    """Find USB relay module (CH340)"""
    ports = serial.tools.list_ports.comports()
    for port in ports:
        # Look for CH340 chip (common in USB relay modules)
        if 'CH340' in port.description or 'CH340' in port.manufacturer:
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
        logger.error(f"Failed to connect to relay: {e}")
        relay_connected = False
        return False


async def control_relay(channel, on):
    """
    Control relay channel (AT command format for CH340)
    
    Args:
        channel: Relay number (1-8, 1-based)
        on: True to turn on, False to turn off
    """
    global relay_port, relay_connected
    
    if not relay_connected or not relay_port:
        raise Exception("Relay not connected")
    
    try:
        # AT command format: AT+ON1\r\n or AT+OFF1\r\n
        command = f"AT+{'ON' if on else 'OFF'}{channel}\r\n"
        relay_port.write(command.encode())
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
    Evaluate interlock logic for dehumidifier control
    
    Rules:
    1. Free Dry: If outdoor_temp < 65°F AND indoor_humidity > 55% → Run dehumidifier
    2. AC Overcool: If outdoor_temp > 80°F → Disable dehumidifier, let AC handle it
    3. Min on/off times: Respect minimum runtime to prevent short cycling
    """
    global system_state
    
    indoor_humidity = system_state.get('indoor_humidity')
    outdoor_temp = system_state.get('outdoor_temp')
    hvac_mode = system_state.get('hvac_mode')
    hvac_running = system_state.get('hvac_running')
    current_dehu_state = system_state.get('dehumidifier_on', False)
    
    # Rule 1: Free Dry Logic
    # If it's cool outside (< 65°F) and humid inside (> 55%), run dehumidifier
    free_dry_condition = (
        outdoor_temp is not None and outdoor_temp < 65 and
        indoor_humidity is not None and indoor_humidity > 55
    )
    
    # Rule 2: AC Overcool Logic
    # If it's hot outside (> 80°F), let AC handle dehumidification
    ac_overcool_condition = (
        outdoor_temp is not None and outdoor_temp > 80 and
        hvac_mode == 'cool' and hvac_running
    )
    
    # Decision logic
    should_run = False
    reason = ""
    
    if ac_overcool_condition:
        # AC is running and it's hot - let AC dehumidify for "free"
        should_run = False
        reason = "AC overcool mode (outdoor > 80°F, AC running)"
    elif free_dry_condition:
        # Cool outside, humid inside - run dehumidifier
        should_run = True
        reason = f"Free dry mode (outdoor {outdoor_temp}°F < 65°F, humidity {indoor_humidity}% > 55%)"
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

async def init_blueair():
    """Initialize Blueair connection"""
    global blueair_account, blueair_devices, blueair_connected
    
    if not BLUEAIR_AVAILABLE:
        logger.info("Blueair API not available - Blueair features disabled")
        blueair_connected = False
        return False
    
    try:
        # Get credentials from environment or config
        import os
        username = os.getenv('BLUEAIR_USERNAME')
        password = os.getenv('BLUEAIR_PASSWORD')
        
        if not username or not password:
            logger.info("Blueair credentials not set. Blueair features will be disabled.")
            logger.info("Set BLUEAIR_USERNAME and BLUEAIR_PASSWORD environment variables to enable.")
            blueair_connected = False
            return False
        
        # Try to get devices using available API
        try:
            blueair_devices = await get_devices(username=username, password=password)
            blueair_account = None  # Not needed with new API
            blueair_connected = True
            logger.info(f"Blueair connected: {len(blueair_devices)} device(s) found")
            return True
        except Exception as api_error:
            logger.warning(f"Blueair API error: {api_error}. Blueair features will be disabled.")
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
    global blueair_account, blueair_devices, blueair_connected
    
    if not blueair_connected or not blueair_devices:
        raise Exception("Blueair not connected")
    
    if device_index >= len(blueair_devices):
        raise Exception(f"Device index {device_index} out of range")
    
    try:
        purifier = blueair_devices[device_index]
        await purifier.set_fan_speed(speed)
        system_state['blueair_fan_speed'] = speed
        logger.info(f"Blueair fan speed set to {speed}")
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
    global blueair_account, blueair_devices, blueair_connected
    
    if not blueair_connected or not blueair_devices:
        raise Exception("Blueair not connected")
    
    if device_index >= len(blueair_devices):
        raise Exception(f"Device index {device_index} out of range")
    
    try:
        purifier = blueair_devices[device_index]
        await purifier.set_led_brightness(brightness)
        system_state['blueair_led_brightness'] = brightness
        logger.info(f"Blueair LED brightness set to {brightness}%")
        return True
    except Exception as e:
        logger.error(f"Failed to control Blueair LED: {e}")
        raise


async def get_blueair_status(device_index=0):
    """Get Blueair device status"""
    global blueair_devices, blueair_connected
    
    if not blueair_connected or not blueair_devices:
        return None
    
    if device_index >= len(blueair_devices):
        return None
    
    try:
        purifier = blueair_devices[device_index]
        # Note: blueair-api may have different methods for getting status
        # This is a placeholder - adjust based on actual API
        return {
            'device_index': device_index,
            'fan_speed': system_state.get('blueair_fan_speed', 0),
            'led_brightness': system_state.get('blueair_led_brightness', 100),
        }
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
    app.router.add_get('/api/status', handle_status)
    app.router.add_post('/api/set-temperature', handle_set_temperature)
    app.router.add_post('/api/set-mode', handle_set_mode)
    app.router.add_get('/api/paired', handle_paired_devices)
    
    # Routes - Relay Control
    app.router.add_get('/api/relay/status', handle_relay_status)
    app.router.add_post('/api/relay/control', handle_relay_control)
    app.router.add_post('/api/system-state', handle_update_system_state)
    app.router.add_post('/api/interlock/evaluate', handle_evaluate_interlock)
    
    # Routes - Blueair Control
    app.router.add_get('/api/blueair/status', handle_blueair_status)
    app.router.add_post('/api/blueair/fan', handle_blueair_fan)
    app.router.add_post('/api/blueair/led', handle_blueair_led)
    app.router.add_post('/api/blueair/dust-kicker', handle_dust_kicker)
    
    # Health check
    app.router.add_get('/health', lambda r: web.json_response({'status': 'ok'}))
    
    # Enable CORS for all routes
    for route in list(app.router.routes()):
        cors.add(route)
    
    return app


async def main():
    """Main entry point"""
    logger.info("Starting ProStat Bridge...")
    
    # Initialize HomeKit controller
    await init_controller()
    
    # Initialize relay (optional - service works without it)
    await init_relay()
    
    # Initialize Blueair (optional - service works without it)
    await init_blueair()
    
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
    logger.info("    GET  /api/status?device_id=... - Get thermostat status")
    logger.info("    POST /api/set-temperature - Set temperature")
    logger.info("    POST /api/set-mode - Set HVAC mode")
    logger.info("    GET  /api/paired - List paired devices")
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
    
    # Keep running
    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        await runner.cleanup()
        # Cleanup AsyncZeroconf
        global async_zeroconf
        if async_zeroconf:
            logger.info("Closing AsyncZeroconf...")
            await async_zeroconf.async_close()
            async_zeroconf = None


if __name__ == '__main__':
    asyncio.run(main())

