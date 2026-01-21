#!/usr/bin/env python3
"""
Simple HomeKit Bridge Test
Creates a minimal bridge with one accessory to test the concept
"""

import asyncio
import logging
from pyhap.accessory import Accessory, Bridge
from pyhap.accessory_driver import AccessoryDriver
from pyhap.const import CATEGORY_THERMOSTAT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleThermostat(Accessory):
    """Simple thermostat accessory for testing"""
    
    category = CATEGORY_THERMOSTAT
    
    def __init__(self, driver, display_name, *args, **kwargs):
        super().__init__(driver, display_name, *args, **kwargs)
        
        # Add thermostat service
        service = self.add_preload_service('Thermostat')
        
        # Get characteristics
        self.current_temp = service.get_characteristic('CurrentTemperature')
        self.target_temp = service.get_characteristic('TargetTemperature')
        self.target_state = service.get_characteristic('TargetHeatingCoolingState')
        self.current_state = service.get_characteristic('CurrentHeatingCoolingState')
        
        # Set initial values
        self.current_temp.set_value(72.0)
        self.target_temp.set_value(72.0)
        self.target_state.set_value(1)  # Heat
        self.current_state.set_value(0)  # Off
        
        # Set callbacks for when HomeKit changes values
        self.target_temp.setter_callback = self._set_target_temp
        self.target_state.setter_callback = self._set_target_state
        
        logger.info("SimpleThermostat accessory created")
    
    def _set_target_temp(self, value):
        """Called when HomeKit sets target temperature"""
        logger.info(f"HomeKit set target temperature to {value}°F")
        # In real implementation, this would call the bridge API
    
    def _set_target_state(self, value):
        """Called when HomeKit sets mode"""
        modes = {0: "Off", 1: "Heat", 2: "Cool", 3: "Auto"}
        logger.info(f"HomeKit set mode to {modes.get(value, 'Unknown')}")
        # In real implementation, this would call the bridge API
    
    @Accessory.run_at_interval(30)  # Update every 30 seconds
    def _run(self):
        """Periodic update - simulate temperature changes"""
        # In real implementation, this would read from bridge API
        current = self.current_temp.value
        # Simulate small temperature fluctuation
        import random
        new_temp = current + random.uniform(-0.5, 0.5)
        self.current_temp.set_value(round(new_temp, 1))
        logger.debug(f"Updated current temperature to {new_temp:.1f}°F")


def main():
    """Create and start the HomeKit bridge"""
    logger.info("Creating HomeKit bridge...")
    
    # Create driver first (this handles the HAP protocol)
    driver = AccessoryDriver(
        port=51826,  # Standard HomeKit port
        persist_file='test-bridge.state'  # Save pairing info
    )
    
    # Create bridge (needs driver)
    bridge = Bridge(driver, display_name="Joule Bridge Test")
    
    # Add a simple thermostat accessory (needs driver too, AID will be auto-assigned)
    thermostat = SimpleThermostat(driver, display_name="Test Thermostat")
    bridge.add_accessory(thermostat)
    
    # Add bridge to driver
    driver.add_accessory(accessory=bridge)
    
    logger.info("=" * 60)
    logger.info("HomeKit Bridge Test Server")
    logger.info("=" * 60)
    logger.info(f"Bridge name: {bridge.display_name}")
    logger.info(f"Port: 51826")
    logger.info(f"Pairing file: test-bridge.state")
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
    main()

