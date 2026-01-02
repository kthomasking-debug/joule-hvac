#!/usr/bin/env python3
"""
HomeKit Bridge Server
Exposes Joule devices as HomeKit accessories so they can be controlled from Apple Home app
and the Joule app.

This runs alongside the existing HTTP bridge server (server.py) which acts as a HomeKit
controller for the Ecobee. This bridge exposes devices as HomeKit accessories.
"""

import asyncio
import logging
import aiohttp
from pyhap.accessory import Accessory, Bridge
from pyhap.accessory_driver import AccessoryDriver
from pyhap.const import CATEGORY_THERMOSTAT, CATEGORY_FAN, CATEGORY_HUMIDIFIER, CATEGORY_SWITCH

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bridge API base URL (the existing HTTP bridge)
BRIDGE_API_URL = "http://localhost:8080"


class JouleThermostat(Accessory):
    """Thermostat accessory that reads from and writes to the existing bridge API"""
    
    category = CATEGORY_THERMOSTAT
    
    def __init__(self, driver, display_name, device_id=None, *args, **kwargs):
        super().__init__(driver, display_name, *args, **kwargs)
        
        self.device_id = device_id
        self.api_url = BRIDGE_API_URL
        
        # Add thermostat service
        service = self.add_preload_service('Thermostat')
        
        # Get characteristics
        self.current_temp = service.get_characteristic('CurrentTemperature')
        self.target_temp = service.get_characteristic('TargetTemperature')
        self.target_state = service.get_characteristic('TargetHeatingCoolingState')
        self.current_state = service.get_characteristic('CurrentHeatingCoolingState')
        
        # Set initial values (will be updated from API)
        self.current_temp.set_value(20.0)  # 20°C = 68°F
        self.target_temp.set_value(20.0)
        self.target_state.set_value(1)  # Heat
        self.current_state.set_value(0)  # Off
        
        # Set callbacks for when HomeKit changes values
        self.target_temp.setter_callback = self._set_target_temp
        self.target_state.setter_callback = self._set_target_state
        
        logger.info(f"JouleThermostat accessory created for device_id={device_id}")
    
    async def _fetch_status(self):
        """Fetch current status from bridge API"""
        if not self.device_id:
            logger.warning("No device_id set, cannot fetch status")
            return None
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/status"
                params = {"device_id": self.device_id}
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data
                    else:
                        logger.warning(f"Failed to fetch status: HTTP {resp.status}")
                        return None
        except Exception as e:
            logger.error(f"Error fetching thermostat status: {e}")
            return None
    
    async def _set_target_temp(self, value):
        """Called when HomeKit sets target temperature"""
        logger.info(f"HomeKit set target temperature to {value}°C ({value * 9/5 + 32:.1f}°F)")
        
        if not self.device_id:
            logger.warning("No device_id set, cannot set temperature")
            return
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/set-temperature"
                data = {
                    "device_id": self.device_id,
                    "temperature": value  # API expects Celsius
                }
                async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        logger.info(f"Successfully set temperature via bridge API")
                    else:
                        logger.error(f"Failed to set temperature: HTTP {resp.status}")
        except Exception as e:
            logger.error(f"Error setting temperature: {e}")
    
    async def _set_target_state(self, value):
        """Called when HomeKit sets mode"""
        modes = {0: "off", 1: "heat", 2: "cool", 3: "auto"}
        mode_name = modes.get(value, "unknown")
        logger.info(f"HomeKit set mode to {mode_name} ({value})")
        
        if not self.device_id:
            logger.warning("No device_id set, cannot set mode")
            return
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/set-mode"
                data = {
                    "device_id": self.device_id,
                    "mode": mode_name
                }
                async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        logger.info(f"Successfully set mode via bridge API")
                    else:
                        logger.error(f"Failed to set mode: HTTP {resp.status}")
        except Exception as e:
            logger.error(f"Error setting mode: {e}")
    
    @Accessory.run_at_interval(30)  # Update every 30 seconds
    def _run(self):
        """Periodic update - fetch from bridge API"""
        if not self.device_id:
            return
        
        # Schedule async update (driver has its own event loop)
        asyncio.create_task(self._update_from_api())
    
    async def _update_from_api(self):
        """Update accessory state from bridge API"""
        status = await self._fetch_status()
        if not status:
            return
        
        # Update current temperature (API returns Celsius)
        if 'temperature' in status and status['temperature'] is not None:
            temp_c = float(status['temperature'])
            self.current_temp.set_value(temp_c)
        
        # Update target temperature
        if 'target_temperature' in status and status['target_temperature'] is not None:
            target_c = float(status['target_temperature'])
            self.target_temp.set_value(target_c)
        
        # Update target state (mode)
        if 'target_mode' in status and status['target_mode'] is not None:
            self.target_state.set_value(int(status['target_mode']))
        
        # Update current state
        if 'current_mode' in status and status['current_mode'] is not None:
            self.current_state.set_value(int(status['current_mode']))


class JouleAirPurifier(Accessory):
    """Air Purifier accessory for Blueair integration"""
    
    category = CATEGORY_FAN
    
    def __init__(self, driver, display_name, device_index=0, *args, **kwargs):
        super().__init__(driver, display_name, *args, **kwargs)
        
        self.device_index = device_index
        self.api_url = BRIDGE_API_URL
        
        # Add Fan service with air purifier type
        service = self.add_preload_service('Fan', chars=['On', 'RotationSpeed'])
        
        # Get characteristics
        self.on = service.get_characteristic('On')
        self.rotation_speed = service.get_characteristic('RotationSpeed')
        
        # Set initial values (will be updated from API)
        self.on.set_value(False)  # Off
        self.rotation_speed.set_value(0)  # 0%
        
        # Set callbacks for when HomeKit changes values
        self.on.setter_callback = self._set_on
        self.rotation_speed.setter_callback = self._set_rotation_speed
        
        logger.info(f"JouleAirPurifier accessory created for device_index={device_index}")
    
    async def _fetch_status(self):
        """Fetch current status from bridge API"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/blueair/status"
                params = {"device_index": self.device_index}
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data
                    else:
                        logger.warning(f"Failed to fetch Blueair status: HTTP {resp.status}")
                        return None
        except Exception as e:
            logger.error(f"Error fetching Blueair status: {e}")
            return None
    
    async def _set_on(self, value):
        """Called when HomeKit sets on/off state"""
        logger.info(f"HomeKit set air purifier to {'ON' if value else 'OFF'}")
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/blueair/fan"
                # If turning off, set speed to 0, otherwise keep current speed or set to 1
                current_speed = self.rotation_speed.value if hasattr(self.rotation_speed, 'value') else 1
                speed = 0 if not value else max(1, int(current_speed * 3 / 100))  # Convert 0-100% to 0-3
                data = {
                    "device_index": self.device_index,
                    "speed": speed
                }
                async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        logger.info(f"Successfully set air purifier state via bridge API")
                    else:
                        logger.error(f"Failed to set air purifier state: HTTP {resp.status}")
        except Exception as e:
            logger.error(f"Error setting air purifier state: {e}")
    
    async def _set_rotation_speed(self, value):
        """Called when HomeKit sets rotation speed (0-100%)"""
        # Convert 0-100% to 0-3 speed levels
        # 0% = 0, 1-33% = 1, 34-66% = 2, 67-100% = 3
        speed = 0
        if value > 0:
            if value <= 33:
                speed = 1
            elif value <= 66:
                speed = 2
            else:
                speed = 3
        
        logger.info(f"HomeKit set air purifier speed to {speed} (from {value}%)")
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/blueair/fan"
                data = {
                    "device_index": self.device_index,
                    "speed": speed
                }
                async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        logger.info(f"Successfully set air purifier speed via bridge API")
                    else:
                        logger.error(f"Failed to set air purifier speed: HTTP {resp.status}")
        except Exception as e:
            logger.error(f"Error setting air purifier speed: {e}")
    
    @Accessory.run_at_interval(30)  # Update every 30 seconds
    def _run(self):
        """Periodic update - fetch from bridge API"""
        # Schedule async update (driver has its own event loop)
        asyncio.create_task(self._update_from_api())
    
    async def _update_from_api(self):
        """Update accessory state from bridge API"""
        status = await self._fetch_status()
        if not status:
            return
        
        # Update on/off state (fan_speed 0 = off, 1-3 = on)
        if 'fan_speed' in status and status['fan_speed'] is not None:
            fan_speed = int(status['fan_speed'])
            self.on.set_value(fan_speed > 0)
            
            # Convert fan speed (0-3) to rotation speed (0-100%)
            # 0 = 0%, 1 = 33%, 2 = 66%, 3 = 100%
            if fan_speed == 0:
                rotation_percent = 0
            elif fan_speed == 1:
                rotation_percent = 33
            elif fan_speed == 2:
                rotation_percent = 66
            else:  # fan_speed == 3
                rotation_percent = 100
            self.rotation_speed.set_value(rotation_percent)


class TPLinkSwitch(Accessory):
    """TP-Link Smart Switch/Plug accessory"""
    
    category = CATEGORY_SWITCH
    
    def __init__(self, driver, display_name, device_ip=None, device_id=None, *args, **kwargs):
        super().__init__(driver, display_name, *args, **kwargs)
        
        self.device_ip = device_ip
        self.device_id = device_id
        self.api_url = BRIDGE_API_URL
        
        # Add Switch service
        service = self.add_preload_service('Switch')
        
        # Get On characteristic
        self.on = service.get_characteristic('On')
        
        # Set initial value (will be updated from API)
        self.on.set_value(False)  # Off
        
        # Set callback for when HomeKit changes value
        self.on.setter_callback = self._set_on
        
        logger.info(f"TPLinkSwitch accessory created for device_ip={device_ip}, device_id={device_id}")
    
    async def _fetch_status(self):
        """Fetch current status from bridge API"""
        if not self.device_id:
            logger.warning("No device_id set, cannot fetch status")
            return None
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/tplink/status"
                params = {"device_id": self.device_id}
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data
                    else:
                        logger.warning(f"Failed to fetch TP-Link status: HTTP {resp.status}")
                        return None
        except Exception as e:
            logger.error(f"Error fetching TP-Link status: {e}")
            return None
    
    async def _set_on(self, value):
        """Called when HomeKit sets on/off state"""
        logger.info(f"HomeKit set TP-Link switch to {'ON' if value else 'OFF'}")
        
        if not self.device_id:
            logger.warning("No device_id set, cannot set switch state")
            return
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/tplink/switch"
                data = {
                    "device_id": self.device_id,
                    "on": value
                }
                async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        logger.info(f"Successfully set TP-Link switch state via bridge API")
                    else:
                        logger.error(f"Failed to set TP-Link switch state: HTTP {resp.status}")
        except Exception as e:
            logger.error(f"Error setting TP-Link switch state: {e}")
    
    @Accessory.run_at_interval(30)  # Update every 30 seconds
    def _run(self):
        """Periodic update - fetch from bridge API"""
        if not self.device_id:
            return
        
        # Schedule async update (driver has its own event loop)
        asyncio.create_task(self._update_from_api())
    
    async def _update_from_api(self):
        """Update accessory state from bridge API"""
        status = await self._fetch_status()
        if not status:
            return
        
        # Update on/off state
        if 'is_on' in status and status['is_on'] is not None:
            self.on.set_value(bool(status['is_on']))


def create_bridge(device_id=None, port=51826, persist_file='homekit-bridge.state', blueair_available=False, tplink_devices=None):
    """Create and configure the HomeKit bridge"""
    logger.info("Creating HomeKit bridge...")
    
    # Create driver
    driver = AccessoryDriver(
        port=port,
        persist_file=persist_file
    )
    
    # Create bridge
    bridge = Bridge(driver, display_name="Joule Bridge")
    
    # Add thermostat accessory if device_id is provided
    if device_id:
        thermostat = JouleThermostat(driver, display_name="Thermostat", device_id=device_id)
        bridge.add_accessory(thermostat)
        logger.info(f"Added thermostat accessory for device_id={device_id}")
    else:
        logger.warning("No device_id provided, bridge created without thermostat accessory")
    
    # Add air purifier accessory if Blueair is available
    if blueair_available:
        air_purifier = JouleAirPurifier(driver, display_name="Air Purifier", device_index=0)
        bridge.add_accessory(air_purifier)
        logger.info("Added air purifier accessory for Blueair")
    
    # Add TP-Link switches/plugs if available
    if tplink_devices:
        for idx, tplink_device in enumerate(tplink_devices):
            device_ip = tplink_device.get('ip')
            device_id = tplink_device.get('device_id') or tplink_device.get('alias', f'TP-Link {idx+1}')
            display_name = tplink_device.get('display_name') or tplink_device.get('alias', f'TP-Link Switch {idx+1}')
            
            switch = TPLinkSwitch(driver, display_name=display_name, device_ip=device_ip, device_id=device_id)
            bridge.add_accessory(switch)
            logger.info(f"Added TP-Link switch accessory: {display_name} ({device_ip})")
    
    # Add bridge to driver
    driver.add_accessory(accessory=bridge)
    
    return driver, bridge


async def get_primary_device_id():
    """Get the primary (first) paired device ID from bridge API"""
    try:
        async with aiohttp.ClientSession() as session:
            # Try /api/primary first (recommended)
            url = f"{BRIDGE_API_URL}/api/primary"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    device_id = data.get('device_id')
                    if device_id:
                        return device_id
            
            # Fallback to /api/paired
            url = f"{BRIDGE_API_URL}/api/paired"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    devices = data.get('devices', [])
                    if devices:
                        return devices[0].get('device_id')
    except Exception as e:
        logger.warning(f"Could not get device_id from bridge API: {e}")
    return None


def main():
    """Main entry point"""
    import sys
    
    # Get device_id from command line, environment, or API
    device_id = None
    if len(sys.argv) > 1:
        device_id = sys.argv[1]
    elif os.environ.get('ECOBEE_DEVICE_ID'):
        device_id = os.environ.get('ECOBEE_DEVICE_ID')
    else:
        # Try to get from bridge API
        logger.info("No device_id provided, attempting to get from bridge API...")
        try:
            device_id = asyncio.run(get_primary_device_id())
            if device_id:
                logger.info(f"Found device_id from bridge API: {device_id}")
            else:
                logger.warning("No paired devices found in bridge API")
        except Exception as e:
            logger.warning(f"Could not connect to bridge API: {e}")
    
    if not device_id:
        logger.warning("No device_id available. Usage: python homekit_bridge.py <device_id>")
        logger.warning("Or set ECOBEE_DEVICE_ID environment variable")
        logger.warning("Or ensure bridge API is running and has a paired device")
        logger.warning("Bridge will be created but won't have any accessories")
    
    # Create bridge
    driver, bridge = create_bridge(device_id=device_id)
    
    logger.info("=" * 60)
    logger.info("HomeKit Bridge Server")
    logger.info("=" * 60)
    logger.info(f"Bridge name: {bridge.display_name}")
    logger.info(f"Port: 51826")
    logger.info(f"Pairing file: homekit-bridge.state")
    logger.info(f"Bridge API: {BRIDGE_API_URL}")
    if device_id:
        logger.info(f"Device ID: {device_id}")
    logger.info("")
    logger.info("To pair:")
    logger.info("1. Open Apple Home app")
    logger.info("2. Tap '+' → Add Accessory")
    logger.info("3. Scan QR code or enter PIN (will be displayed)")
    logger.info("")
    logger.info("Press Ctrl+C to stop")
    logger.info("=" * 60)
    
    # Start the driver (this blocks)
    try:
        driver.start()
    except KeyboardInterrupt:
        logger.info("Stopping bridge...")
        driver.stop()


if __name__ == '__main__':
    import os
    main()

