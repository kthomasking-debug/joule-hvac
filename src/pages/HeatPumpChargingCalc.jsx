import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Info, Zap, MapPin, Bluetooth, BluetoothConnected, BookOpen } from 'lucide-react';
import { selectClasses } from '../lib/uiClasses'
import { DashboardLink } from '../components/DashboardLink';
import { getSaturationTemp, getTargetLiquidLineTemp, getSaturationPressure, refrigerantCharts } from '../lib/ptCharts.js';

// --- Haptic helper + Press-and-Hold Hook for Steppers ---
const triggerHaptic = (pattern = 10) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // vibrate accepts number or array
      // keep it short to avoid excessive vibration
      navigator.vibrate(pattern);
    }
  } catch (error) {
    // ignore if vibration API not available - log for debugging
    console.debug('Haptic API not available or failed to vibrate', error);
  }
};

const usePressAndHold = (callback, delay = 100) => {
  const [, setIsPressed] = useState(false);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const start = () => {
    setIsPressed(true);
    // immediate action + haptic feedback
    callback(); // Immediate first call
    triggerHaptic(10);
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(callback, delay);
    }, 500); // 500ms delay before rapid fire starts
  };

  const stop = () => {
    setIsPressed(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => () => stop(), []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
};

// --- Main Calculator Component ---

const HeatPumpChargingCalc = () => {
  // --- INPUTS WITH STATE PERSISTENCE ---
  const [liquidLinePressure, setLiquidLinePressure] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_liquidPressure');
    return saved ? Number(saved) : 335;
  });
  const [liquidLineTemp, setLiquidLineTemp] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_liquidTemp');
    return saved ? Number(saved) : 90;
  });
  const [targetSubcooling, setTargetSubcooling] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_targetSubcooling');
    return saved ? Number(saved) : 12;
  });

  // Multi-refrigerant + method (subcooling | superheat)
  const [refrigerant, setRefrigerant] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_refrigerant');
    return saved || 'R-410A';
  });
  const [method, setMethod] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_method');
    return saved || 'subcooling';
  });

  // Superheat inputs (used when method === 'superheat')
  const [suctionPressure, setSuctionPressure] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_suctionPressure');
    return saved ? Number(saved) : 100;
  });
  const [suctionTemp, setSuctionTemp] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_suctionTemp');
    return saved ? Number(saved) : 80;
  });
  const [indoorWetBulb, setIndoorWetBulb] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_indoorWetBulb');
    return saved || ''; // Initialize with saved value or empty string
  });
  const [outdoorDryBulb, setOutdoorDryBulb] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_outdoorDryBulb');
    return saved || ''; // Initialize with saved value or empty string
  });
  const [indoorDryBulb, setIndoorDryBulb] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_indoorDryBulb');
    return saved || ''; // Initialize with saved value or empty string
  });
  const [targetSuperheat, setTargetSuperheat] = useState(() => {
    const saved = localStorage.getItem('chargingCalc_targetSuperheat');
    return saved ? Number(saved) : 8;
  });
  const [targetSuperheatCalculated, setTargetSuperheatCalculated] = useState(false); // Track if target was calculated

  // Press-and-hold handlers (hook calls must be unconditional)
  const press_liquid_dec5 = usePressAndHold(() => setLiquidLinePressure(prev => Math.max(0, prev - 5)));
  const press_liquid_inc5 = usePressAndHold(() => setLiquidLinePressure(prev => prev + 5));
  const press_liquid_dec1 = usePressAndHold(() => setLiquidLinePressure(prev => Math.max(0, prev - 1)), 50);
  const press_liquid_inc1 = usePressAndHold(() => setLiquidLinePressure(prev => prev + 1), 50);

  const press_liquidtemp_dec5 = usePressAndHold(() => setLiquidLineTemp(prev => prev - 5));
  const press_liquidtemp_inc5 = usePressAndHold(() => setLiquidLineTemp(prev => prev + 5));
  const press_liquidtemp_dec1 = usePressAndHold(() => setLiquidLineTemp(prev => prev - 1), 50);
  const press_liquidtemp_inc1 = usePressAndHold(() => setLiquidLineTemp(prev => prev + 1), 50);

  const press_suction_dec5 = usePressAndHold(() => setSuctionPressure(prev => Math.max(0, prev - 5)));
  const press_suction_inc5 = usePressAndHold(() => setSuctionPressure(prev => prev + 5));
  const press_suction_dec1 = usePressAndHold(() => setSuctionPressure(prev => Math.max(0, prev - 1)), 50);
  const press_suction_inc1 = usePressAndHold(() => setSuctionPressure(prev => prev + 1), 50);

  const press_suctiontemp_dec5 = usePressAndHold(() => setSuctionTemp(prev => prev - 5));
  const press_suctiontemp_inc5 = usePressAndHold(() => setSuctionTemp(prev => prev + 5));
  const press_suctiontemp_dec1 = usePressAndHold(() => setSuctionTemp(prev => prev - 1), 50);
  const press_suctiontemp_inc1 = usePressAndHold(() => setSuctionTemp(prev => prev + 1), 50);

  // BLE Probe Connection State
  const [bleDevice, setBleDevice] = useState(null);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleScanning, setBleScanning] = useState(false);
  const [bleDeviceName, setBleDeviceName] = useState('');
  const [bleDataSource, setBleDataSource] = useState(false); // True when data is coming from probe
  const characteristicRef = useRef(null);
  
  // Manifold Gauge Connection State
  const [manifoldDevice, setManifoldDevice] = useState(null);
  const [manifoldConnected, setManifoldConnected] = useState(false);
  const [manifoldScanning, setManifoldScanning] = useState(false);
  const [manifoldDeviceName, setManifoldDeviceName] = useState('');
  const [manifoldDataSource, setManifoldDataSource] = useState(false); // True when pressure data is coming from manifold
  const manifoldCharacteristicRef = useRef(null);

  // Function to calculate target superheat based on wet bulb and dry bulb temps
  // This uses a simplified superheat chart approximation commonly used in the field
  const calculateTargetSuperheat = () => {
    if (!indoorWetBulb || !outdoorDryBulb) {
      alert('Please enter both Indoor Wet Bulb and Outdoor Dry Bulb temperatures.');
      return;
    }

    const iwb = Number(indoorWetBulb);
    const odb = Number(outdoorDryBulb);

    // Simplified superheat chart calculation
    // This is based on typical residential AC superheat charts
    // Formula: Base superheat adjusted by temperature conditions
    // Typical range: 5°F to 20°F depending on conditions

    // Base superheat starts around 10°F for moderate conditions
    let calculatedSuperheat = 10;

    // Adjust for outdoor temperature (higher outdoor temp = lower superheat needed)
    if (odb < 75) {
      calculatedSuperheat += (75 - odb) * 0.15; // Increase superheat in cooler weather
    } else if (odb > 95) {
      calculatedSuperheat -= (odb - 95) * 0.1; // Decrease superheat in very hot weather
    }

    // Adjust for indoor wet bulb (higher humidity = slightly lower superheat)
    if (iwb < 60) {
      calculatedSuperheat += (60 - iwb) * 0.08; // Increase in dry conditions
    } else if (iwb > 67) {
      calculatedSuperheat -= (iwb - 67) * 0.12; // Decrease in humid conditions
    }

    // Clamp to reasonable range (5°F to 20°F)
    calculatedSuperheat = Math.max(5, Math.min(20, calculatedSuperheat));

    // Round to nearest 0.5°F for practical field use
    calculatedSuperheat = Math.round(calculatedSuperheat * 2) / 2;

    setTargetSuperheat(calculatedSuperheat);
    setTargetSuperheatCalculated(true);
  };

  // Fetch local weather conditions using GPS + Open-Meteo API
  const fetchLocalConditions = async () => {
    setFetchingConditions(true);
    setLocationName('');

    try {
      // Check if geolocation is available
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your device.');
      }

      // Get current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;

      // Fetch current weather from Open-Meteo API
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit&timezone=auto`
      );

      if (!weatherResponse.ok) {
        throw new Error('Unable to fetch weather data.');
      }

      const weatherData = await weatherResponse.json();
      const currentTemp = weatherData.current.temperature_2m;
      const currentHumidity = weatherData.current.relative_humidity_2m;

      // Reverse geocode to get location name
      const reverseGeoResponse = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );

      if (reverseGeoResponse.ok) {
        const reverseGeoData = await reverseGeoResponse.json();
        const city = reverseGeoData.city || reverseGeoData.locality || '';
        const state = reverseGeoData.principalSubdivisionCode || '';
        setLocationName(`${city}, ${state}`.trim().replace(/,$/, ''));
      }

      // Auto-populate outdoor dry bulb
      setOutdoorDryBulb(Math.round(currentTemp).toString());

      // Show success message
      alert(`✓ Local conditions fetched!\n\nLocation: ${locationName || 'Current location'}\nOutdoor Temp: ${Math.round(currentTemp)}°F\nRelative Humidity: ${currentHumidity}%\n\nOutdoor Dry Bulb has been auto-filled.`);

    } catch (error) {
      let errorMessage = 'Unable to fetch local conditions.';

      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location permissions in your device settings.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your device\'s location services.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
      console.warn('Fetch local conditions error:', error);
    } finally {
      setFetchingConditions(false);
    }
  };

  /**
   * Connect to Bluetooth Environmental Probe (Pro Feature)
   * 
   * Supports professional HVAC probes with Bluetooth Low Energy (BLE):
   * - Fieldpiece JobLink System (JL3, JL3RH, JL3KH2, etc.)
   * - Testo Smart Probes (temperature/humidity sensors)
   * - Klein Tools Bluetooth Probes
   * - Any BLE device implementing Environmental Sensing Service (0x181A)
   * 
   * Requirements:
   * - Chrome, Edge, or Opera browser
   * - Android, Windows, macOS, or ChromeOS
   * - Probe must be powered on and in pairing mode
   * 
   * Data synced:
   * - Indoor Dry Bulb temperature (real-time)
   * - Indoor Wet Bulb temperature (calculated from temp + humidity)
   * - Relative Humidity (used for wet bulb calculation)
   */
  
  /**
   * Connect to Bluetooth Digital Manifold Gauge (Pro Feature)
   * 
   * Supports professional digital manifold gauges with Bluetooth Low Energy (BLE):
   * - Fieldpiece SMAN series (SMAN3, SMAN4, SM380V, SM480V)
   * - Testo 550s/557s Digital Manifolds
   * - CPS BM2U/BM4U Blackmax Series
   * - Yellow Jacket Titan Digital Manifolds
   * - Inficon D-Tek Series
   * 
   * Requirements:
   * - Chrome, Edge, or Opera browser
   * - Android, Windows, macOS, or ChromeOS
   * - Manifold must be powered on and in pairing mode
   * 
   * Data synced:
   * - High-side (liquid line) pressure (real-time)
   * - Low-side (suction) pressure (real-time)
   * - Optional: Line temperatures if gauge has integrated probes
   */
  const connectBLEProbe = async () => {
    setBleScanning(true);

    try {
      // Check if Web Bluetooth API is available
      if (!navigator.bluetooth) {
        throw new Error('Bluetooth is not supported on this device/browser. Web Bluetooth requires Chrome, Edge, or Opera on Android, Windows, macOS, or ChromeOS.');
      }

      // Request Bluetooth device
      // Common service UUIDs for environmental sensors:
      // - Environmental Sensing: 0x181A
      // - Battery Service: 0x180F
      // We'll use optional services to cast a wider net for different probe manufacturers
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '0000181a-0000-1000-8000-00805f9b34fb', // Environmental Sensing Service
          'battery_service', // Standard battery service
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (common in probes)
        ]
      });

      console.log('Selected device:', device.name);
      setBleDeviceName(device.name || 'Unknown Probe');

      // Connect to GATT Server
      const server = await device.gatt.connect();
      console.log('Connected to GATT server');

      // Try to find environmental sensing service
      let service;
      try {
        service = await server.getPrimaryService('0000181a-0000-1000-8000-00805f9b34fb');
      } catch {
        console.log('Environmental Sensing Service not found, trying Nordic UART...');
        try {
          service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        } catch {
          throw new Error('Unable to find compatible service on this device. Please ensure your probe is powered on and in pairing mode.');
        }
      }

      console.log('Service found:', service.uuid);

      // For Environmental Sensing Service, characteristic UUIDs:
      // Temperature: 0x2A6E
      // Humidity: 0x2A6F
      let tempCharacteristic, humidityCharacteristic;

      try {
        // Try standard Environmental Sensing characteristics
        tempCharacteristic = await service.getCharacteristic('00002a6e-0000-1000-8000-00805f9b34fb');
        humidityCharacteristic = await service.getCharacteristic('00002a6f-0000-1000-8000-00805f9b34fb');

        // Start notifications for temperature
        await tempCharacteristic.startNotifications();
        tempCharacteristic.addEventListener('characteristicvaluechanged', handleTemperatureChange);

        // Start notifications for humidity
        await humidityCharacteristic.startNotifications();
        humidityCharacteristic.addEventListener('characteristicvaluechanged', handleHumidityChange);

        characteristicRef.current = { temp: tempCharacteristic, humidity: humidityCharacteristic };

      } catch (e) {
        console.log('Standard characteristics not found:', e.message);
        throw new Error('This device does not appear to be a compatible environmental probe. Supported brands: Fieldpiece JobLink, Testo Smart Probes, Klein Tools probes.');
      }

      setBleDevice(device);
      setBleConnected(true);
      setBleDataSource(true);

      // Handle disconnection
      device.addEventListener('gattserverdisconnected', () => {
        console.log('Probe disconnected');
        setBleConnected(false);
        setBleDataSource(false);
        setBleDeviceName('');
      });

      alert(`✓ Connected to ${device.name || 'probe'}!\n\nEnvironmental data will now sync automatically.`);

    } catch (error) {
      console.warn('BLE connection error:', error);
      let errorMessage = 'Unable to connect to probe.';

      if (error.message.includes('User cancelled')) {
        errorMessage = 'Connection cancelled.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    } finally {
      setBleScanning(false);
    }
  };

  // Handle temperature data from BLE probe
  const handleTemperatureChange = (event) => {
    const value = event.target.value;
    // Standard Environmental Sensing temperature is in Celsius * 100 (int16)
    const tempCelsius = value.getInt16(0, true) / 100;
    const tempFahrenheit = (tempCelsius * 9 / 5) + 32;

    console.log('Temperature reading:', tempFahrenheit.toFixed(1), '°F');

    // Update Indoor Dry Bulb with live probe data
    setIndoorDryBulb(Math.round(tempFahrenheit).toString());
  };

  // Handle humidity data from BLE probe
  const handleHumidityChange = (event) => {
    const value = event.target.value;
    // Standard Environmental Sensing humidity is in % * 100 (uint16)
    const humidity = value.getUint16(0, true) / 100;

    console.log('Humidity reading:', humidity.toFixed(1), '%');

    // Calculate wet bulb temperature from dry bulb and humidity
    // This is an approximation using the simplified formula
    if (indoorDryBulb) {
      const T = Number(indoorDryBulb);
      const RH = humidity;

      // Simplified wet bulb approximation (Stull formula simplified)
      const wetBulb = T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659)) +
        Math.atan(T + RH) - Math.atan(RH - 1.676331) +
        0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) - 4.686035;

      setIndoorWetBulb(Math.round(wetBulb).toString());
      setTargetSuperheatCalculated(false); // Reset calculated flag
    }
  };

  // Disconnect BLE probe
  const disconnectBLEProbe = () => {
    if (bleDevice && bleDevice.gatt.connected) {
      bleDevice.gatt.disconnect();
      console.log('Manually disconnected from probe');
    }
    setBleConnected(false);
    setBleDataSource(false);
    setBleDeviceName('');
    setBleDevice(null);
  };

  /**
   * Connect to Bluetooth Digital Manifold Gauge
   * Automatically syncs high-side and low-side pressure readings
   */
  const connectManifoldGauge = async () => {
    setManifoldScanning(true);

    try {
      // Check if Web Bluetooth API is available
      if (!navigator.bluetooth) {
        throw new Error('Bluetooth is not supported on this device/browser. Web Bluetooth requires Chrome, Edge, or Opera on Android, Windows, macOS, or ChromeOS.');
      }

      // Request Bluetooth device
      // Common service UUIDs for digital manifold gauges
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (common in Fieldpiece SMAN)
          '0000fff0-0000-1000-8000-00805f9b34fb', // Custom service (Testo manifolds)
          'battery_service',
        ]
      });

      console.log('Selected manifold device:', device.name);
      setManifoldDeviceName(device.name || 'Unknown Manifold');

      // Connect to GATT Server
      const server = await device.gatt.connect();
      console.log('Connected to manifold GATT server');

      // Try to find compatible service
      let service;
      try {
        // Try Nordic UART Service first (Fieldpiece SMAN series)
        service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        console.log('Found Nordic UART Service (Fieldpiece compatible)');
      } catch {
        try {
          // Try custom service (Testo, CPS, Yellow Jacket)
          service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
          console.log('Found custom manifold service');
        } catch {
          throw new Error('Unable to find compatible service on this device. Please ensure your digital manifold is powered on and in pairing mode. Supported: Fieldpiece SMAN, Testo 550s/557s, CPS BM2U/BM4U.');
        }
      }

      // For Nordic UART Service:
      // RX characteristic: 6e400002-b5a3-f393-e0a9-e50e24dcca9e (write)
      // TX characteristic: 6e400003-b5a3-f393-e0a9-e50e24dcca9e (notify)
      let dataCharacteristic;

      try {
        // Get the TX (notification) characteristic for receiving pressure data
        dataCharacteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
        
        // Start notifications
        await dataCharacteristic.startNotifications();
        dataCharacteristic.addEventListener('characteristicvaluechanged', handleManifoldDataChange);

        manifoldCharacteristicRef.current = dataCharacteristic;

      } catch (e) {
        console.log('Standard UART characteristics not found, trying alternative:', e.message);
        try {
          // Try alternative characteristic for custom implementations
          const characteristics = await service.getCharacteristics();
          if (characteristics.length > 0) {
            dataCharacteristic = characteristics.find(c => c.properties.notify);
            if (dataCharacteristic) {
              await dataCharacteristic.startNotifications();
              dataCharacteristic.addEventListener('characteristicvaluechanged', handleManifoldDataChange);
              manifoldCharacteristicRef.current = dataCharacteristic;
            } else {
              throw new Error('No notifiable characteristic found');
            }
          } else {
            throw new Error('No characteristics found');
          }
        } catch {
          throw new Error('This device does not appear to be a compatible digital manifold gauge. Supported brands: Fieldpiece SMAN series, Testo 550s/557s, CPS Blackmax, Yellow Jacket Titan.');
        }
      }

      setManifoldDevice(device);
      setManifoldConnected(true);
      setManifoldDataSource(true);

      // Handle disconnection
      device.addEventListener('gattserverdisconnected', () => {
        console.log('Manifold disconnected');
        setManifoldConnected(false);
        setManifoldDataSource(false);
        setManifoldDeviceName('');
      });

      alert(`✓ Connected to ${device.name || 'manifold gauge'}!\n\nPressure readings will now sync automatically.\n\nNote: Ensure your manifold is connected to the system and displaying live readings.`);

    } catch (error) {
      console.warn('Manifold BLE connection error:', error);
      let errorMessage = 'Unable to connect to manifold gauge.';

      if (error.message.includes('User cancelled')) {
        errorMessage = 'Connection cancelled.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    } finally {
      setManifoldScanning(false);
    }
  };

  // Handle pressure/temperature data from manifold gauge
  const handleManifoldDataChange = (event) => {
    const value = event.target.value;
    
    // Parse manifold gauge data packet
    // Format varies by manufacturer, but typically includes:
    // - High-side pressure (bytes 0-3)
    // - Low-side pressure (bytes 4-7)
    // - Optional: temperatures (bytes 8+)
    
    try {
      // Fieldpiece SMAN format (simplified)
      // Pressures are typically sent as float32 in PSI
      const highSidePressure = value.getFloat32(0, true); // Little-endian
      const lowSidePressure = value.getFloat32(4, true);

      console.log('Manifold readings:', {
        highSide: highSidePressure.toFixed(1) + ' psig',
        lowSide: lowSidePressure.toFixed(1) + ' psig'
      });

      // Update pressure values based on current method
      if (method === 'subcooling') {
        setLiquidLinePressure(Math.round(highSidePressure));
      } else if (method === 'superheat') {
        setSuctionPressure(Math.round(lowSidePressure));
      }

      // Try to read temperature data if available (bytes 8-15)
      if (value.byteLength >= 16) {
        try {
          const liquidTemp = value.getFloat32(8, true);
          const suctionTemp = value.getFloat32(12, true);
          
          console.log('Temperature readings:', {
            liquidLine: liquidTemp.toFixed(1) + '°F',
            suctionLine: suctionTemp.toFixed(1) + '°F'
          });

          // Update temperatures if valid
          if (liquidTemp > 0 && liquidTemp < 200) {
            if (method === 'subcooling') {
              setLiquidLineTemp(Math.round(liquidTemp));
            }
          }
          if (suctionTemp > 0 && suctionTemp < 200) {
            if (method === 'superheat') {
              setSuctionTemp(Math.round(suctionTemp));
            }
          }
        } catch {
          // Temperature data not available or invalid format
          console.log('No temperature data available from manifold');
        }
      }

    } catch (error) {
      console.warn('Error parsing manifold data:', error);
      // Try alternative parsing for different manifold brands
      try {
        // Alternative format: 16-bit integers representing PSI * 10
        const highSidePressure = value.getUint16(0, true) / 10;
        const lowSidePressure = value.getUint16(2, true) / 10;

        console.log('Manifold readings (alt format):', {
          highSide: highSidePressure.toFixed(1) + ' psig',
          lowSide: lowSidePressure.toFixed(1) + ' psig'
        });

        if (method === 'subcooling') {
          setLiquidLinePressure(Math.round(highSidePressure));
        } else if (method === 'superheat') {
          setSuctionPressure(Math.round(lowSidePressure));
        }
      } catch (error2) {
        console.warn('Could not parse manifold data in any known format:', error2);
      }
    }
  };

  // Disconnect manifold gauge
  const disconnectManifoldGauge = () => {
    if (manifoldDevice && manifoldDevice.gatt.connected) {
      manifoldDevice.gatt.disconnect();
      console.log('Manually disconnected from manifold');
    }
    setManifoldConnected(false);
    setManifoldDataSource(false);
    setManifoldDeviceName('');
    setManifoldDevice(null);
  };

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('chargingCalc_liquidPressure', liquidLinePressure);
    localStorage.setItem('chargingCalc_liquidTemp', liquidLineTemp);
    localStorage.setItem('chargingCalc_targetSubcooling', targetSubcooling);
    localStorage.setItem('chargingCalc_refrigerant', refrigerant);
    localStorage.setItem('chargingCalc_method', method);
    localStorage.setItem('chargingCalc_suctionPressure', suctionPressure);
    localStorage.setItem('chargingCalc_suctionTemp', suctionTemp);
    localStorage.setItem('chargingCalc_targetSuperheat', targetSuperheat);

    // --- FIX APPLIED HERE: Save environmental inputs on change ---
    localStorage.setItem('chargingCalc_indoorWetBulb', indoorWetBulb);
    localStorage.setItem('chargingCalc_outdoorDryBulb', outdoorDryBulb);
    localStorage.setItem('chargingCalc_indoorDryBulb', indoorDryBulb);
  }, [liquidLinePressure, liquidLineTemp, targetSubcooling, refrigerant, method, suctionPressure, suctionTemp, targetSuperheat, indoorWetBulb, outdoorDryBulb, indoorDryBulb]);

  // PT Chart modal state
  const [showPTChart, setShowPTChart] = useState(false);

  // Job History state
  const [showHistory, setShowHistory] = useState(false);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  // Fetch local conditions state
  const [fetchingConditions, setFetchingConditions] = useState(false);
  const [locationName, setLocationName] = useState('');

  // Define free vs pro refrigerants
  const freeRefrigerants = ['R-410A', 'R-22'];
  const isRefrigerantLocked = (ref) => !isPro && !freeRefrigerants.includes(ref);
  const [jobHistory, setJobHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('chargingJobHistory');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to parse chargingJobHistory', error);
      return [];
    }
  });

  // Export job to PDF (lazy-load jsPDF when needed)
  const handleExportJob = async (job) => {
    if (!isPro) {
      setUpgradeReason('PDF export is a Pro feature. Upgrade to generate branded service reports and share with clients.');
      setShowUpgradeModal(true);
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Service Report', 20, 20);
      doc.setFontSize(12);
      doc.text(`Client: ${job.clientName}`, 20, 34);
      doc.text(`Date: ${new Date(job.timestamp).toLocaleString()}`, 20, 42);
      doc.text(`Refrigerant: ${job.refrigerant}`, 20, 50);
      doc.text(`Method: ${job.method}`, 20, 58);
      // Add readings
      let y = 70;
      Object.entries(job.inputs).forEach(([k, v]) => {
        doc.text(`${k}: ${v}`, 20, y);
        y += 8;
      });
      y += 4;
      doc.text('Results:', 20, y);
      y += 8;
      doc.text(`Status: ${job.results.chargeStatus}`, 20, y);
      y += 8;
      doc.text(`Notes: ${job.results.action || 'N/A'}`, 20, y);
      doc.save(`service-report-${job.id}.pdf`);
    } catch (e) {
      console.warn('Failed to export PDF', e);
      setUpgradeReason('Unable to generate PDF at this time. Please try again later.');
      setShowUpgradeModal(true);
    }
  };



  // --- PAYWALL / SUBSCRIPTION CHECK ---
  const isPro = useMemo(() => {
    try {
      const stored = localStorage.getItem('userSubscription');
      if (stored) {
        const obj = JSON.parse(stored);
        if (obj && obj.isPro) return true;
      }
    } catch {
      // ignore parse errors
    }
    return localStorage.getItem('isPro') === 'true';
  }, []);


  // --- SAFETY NOTICE MODAL ---
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showWinterTipsModal, setShowWinterTipsModal] = useState(false);
  const [showUserManualModal, setShowUserManualModal] = useState(false);
  const [acknowledged, setAcknowledged] = useState(() => {
    return localStorage.getItem('acknowledgedSafetyNotice') === 'true';
  });

  const handleAcknowledge = () => {
    localStorage.setItem('acknowledgedSafetyNotice', 'true');
    setAcknowledged(true);
    setShowSafetyModal(false);
  };

  useEffect(() => {
    if (!acknowledged) {
      setShowSafetyModal(true);
    }
  }, [acknowledged]);

  // --- CALCULATIONS ---
  const calculations = useMemo(() => {
    // Branch by selected method
    if (method === 'subcooling') {
      const targetTemp = getTargetLiquidLineTemp(refrigerant, liquidLinePressure, targetSubcooling);
      if (targetTemp === null) {
        return { targetTemp: 'N/A', chargeStatus: 'Invalid Subcooling Chart', statusLevel: 'error', action: '' };
      }
      const difference = liquidLineTemp - targetTemp;
      let chargeStatus = 'Charge is Good';
      let statusLevel = 'good';
      let action = 'System is properly charged. No action needed.';
      if (difference > 5) {
        chargeStatus = 'Significantly Undercharged';
        statusLevel = 'critical';
        action = 'Add refrigerant immediately';
      } else if (difference > 2) {
        chargeStatus = 'Slightly Undercharged';
        statusLevel = 'caution';
        action = 'Add small amount of refrigerant';
      } else if (difference < -5) {
        chargeStatus = 'Significantly Overcharged';
        statusLevel = 'critical';
        action = 'Recover refrigerant immediately';
      } else if (difference < -2) {
        chargeStatus = 'Slightly Overcharged';
        statusLevel = 'caution';
        action = 'Recover small amount of refrigerant';
      }
      return { method: 'subcooling', refrigerant, targetTemp, chargeStatus, statusLevel, action, difference };
    }

    // Superheat path
    if (method === 'superheat') {
      const satTemp = getSaturationTemp(refrigerant, suctionPressure);
      if (satTemp === null) {
        return { method: 'superheat', targetSuperheat, chargeStatus: 'Missing PT data for refrigerant', statusLevel: 'error', action: '' };
      }
      const actualSuperheat = suctionTemp - satTemp;
      const diff = actualSuperheat - targetSuperheat; // positive -> undercharged

      // Calculate target suction pressure if indoor dry bulb is provided
      let targetSuctionPressure = null;
      let targetSaturationTemp = null;
      if (indoorDryBulb) {
        const dryBulb = Number(indoorDryBulb);
        targetSaturationTemp = dryBulb - 35; // Design TD = 35°F
        targetSuctionPressure = getSaturationPressure(refrigerant, targetSaturationTemp);
      }

      let chargeStatus = 'Charge is Good';
      let statusLevel = 'good';
      let action = 'System is properly charged. No action needed.';
      if (diff > 5) {
        chargeStatus = 'Significantly Undercharged';
        statusLevel = 'critical';
        action = 'Add refrigerant immediately';
      } else if (diff > 2) {
        chargeStatus = 'Slightly Undercharged';
        statusLevel = 'caution';
        action = 'Add small amount of refrigerant';
      } else if (diff < -5) {
        chargeStatus = 'Significantly Overcharged';
        statusLevel = 'critical';
        action = 'Recover refrigerant immediately';
      } else if (diff < -2) {
        chargeStatus = 'Slightly Overcharged';
        statusLevel = 'caution';
        action = 'Recover small amount of refrigerant';
      }
      return { method: 'superheat', refrigerant, targetSuperheat, actualSuperheat, chargeStatus, statusLevel, action, difference: diff, satTemp, targetSuctionPressure, targetSaturationTemp };
    }

    return { chargeStatus: 'Unknown method', statusLevel: 'error', action: '' };
  }, [method, refrigerant, liquidLinePressure, liquidLineTemp, targetSubcooling, suctionPressure, suctionTemp, targetSuperheat, indoorDryBulb]);

  // Save reading handler
  const handleSaveReading = () => {
    // Check free tier limit (3 jobs)
    if (!isPro && jobHistory.length >= 3) {
      setUpgradeReason("You've reached your limit of 3 free job saves. Upgrade to Pro to save unlimited jobs and create professional PDF reports.");
      setShowUpgradeModal(true);
      return;
    }

    const clientName = prompt('Enter Client Name or Job ID (optional):');
    if (clientName === null) return; // User cancelled

    const reading = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      clientName: clientName || 'Untitled Job',
      refrigerant,
      method,
      inputs: method === 'subcooling'
        ? { liquidLinePressure, liquidLineTemp, targetSubcooling }
        : { suctionPressure, suctionTemp, targetSuperheat, indoorWetBulb, outdoorDryBulb, indoorDryBulb },
      results: calculations
    };
    const updated = [reading, ...jobHistory];
    setJobHistory(updated);
    try {
      localStorage.setItem('chargingJobHistory', JSON.stringify(updated));
      alert('Reading saved successfully!');
    } catch (e) {
      alert('Failed to save reading: ' + e.message);
    }
  };

  // Delete reading handler
  const handleDeleteReading = (id) => {
    const updated = jobHistory.filter(r => r.id !== id);
    setJobHistory(updated);
    try {
      localStorage.setItem('chargingJobHistory', JSON.stringify(updated));
    } catch (error) { console.warn('Failed to persist chargingJobHistory (delete) in HeatPumpChargingCalc', error); }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-end mb-4">
            <DashboardLink />
          </div>
          {/* Upgrade banner for free users */}
          {!isPro && (
            <div className="mb-4 p-3 rounded-md bg-gradient-to-r from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-600 border border-blue-200 dark:border-slate-500 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
                <Zap size={14} /> Pro Feature Preview
              </div>
              <p className="text-blue-800 dark:text-blue-200">You're using the free tier: R-410A & R-22 available, save up to 3 jobs. Unlock all refrigerants, unlimited saves, & PDF reports.</p>
              <div className="flex gap-2">
                <Link to="/settings" className="btn btn-primary btn-xs">Upgrade</Link>
                <button onClick={() => { setUpgradeReason('Upgrade to Pro for all refrigerants (R-134a, R-32, R-407C & more), unlimited job history and branded PDF service reports.'); setShowUpgradeModal(true); }} className="btn btn-outline btn-xs">See Benefits</button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4 border dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">A/C Charging Calculator</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{refrigerant} {method === 'subcooling' ? 'Subcooling' : 'Superheat'} Method</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              For use by EPA 608 Certified Technicians only.
              <button
                className="text-blue-600 dark:text-blue-400 underline"
                onClick={() => setShowSafetyModal(true)}
              >
                [Read full safety notice]
              </button>
            </p>

            {/* Utility buttons */}
            <div className="mt-4 flex gap-2 flex-wrap">
              <button onClick={() => setShowUserManualModal(true)} className="btn btn-primary text-sm"><BookOpen size={14} /> User Manual</button>
              <Link to="/professional" className="btn btn-outline text-sm">🔧 Professional Mode</Link>
              <button onClick={() => setShowPTChart(true)} className="btn btn-outline text-sm"><Info size={14} /> PT Chart</button>
              <button onClick={handleSaveReading} className="btn btn-outline text-sm">Save Reading</button>
              <button onClick={() => setShowHistory(true)} className="btn btn-outline text-sm">Job History ({jobHistory.length})</button>
            </div>
          </div>

          {showSafetyModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Safety Notice</h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
                  This calculator is intended for use by EPA 608 Certified Technicians only. Improper handling of refrigerants can cause serious injury or environmental harm. Always follow safety protocols and manufacturer guidelines.
                </p>
                <button
                  onClick={handleAcknowledge}
                  className="btn btn-primary px-6 py-3 text-lg"
                >
                  I Acknowledge
                </button>
              </div>
            </div>
          )}

          {showWinterTipsModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-8 relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setShowWinterTipsModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Charging a Heat Pump in Cold Weather</h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
                  This calculator uses the Subcooling Method, which is designed for charging a system in Cooling Mode. It is not a valid method for a system actively running in Heating Mode.
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">1. The Preferred Method: Charge by Weight</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      The safest and most accurate method for charging a heat pump in winter is to follow the manufacturer's instructions for charging by weight. This involves evacuating the system and adding the precise refrigerant weight listed on the unit's data plate.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">2. The Challenge of Low Ambient Temperatures</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      If you must use the subcooling method in cold weather, the system must be manually switched to operate in cooling mode. Be aware that outdoor temperatures below 65°F will cause low head pressure, making accurate subcooling readings difficult or impossible.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">3. A Word of Caution</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Some field techniques exist to artificially raise head pressure. These are non-standard procedures that carry a significant risk of equipment damage and should only be performed by highly experienced technicians who fully understand the dangers.
                    </p>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                      This application does not endorse any procedure that deviates from the manufacturer's specified charging instructions. Always prioritize safety and follow the official guidelines for the equipment you are servicing.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Final Verdict</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Your subcooling calculator works perfectly for its intended purpose. To make it a truly professional tool:
                    </p>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1 ml-4">
                      <li>• <strong>Do not add instructions for blocking the condenser fan.</strong></li>
                      <li>• <strong>Do add the "Winter Charging Tips" text above to educate your users, clarify the tool's proper use, and reinforce your app's commitment to safety and professional best practices.</strong></li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setShowWinterTipsModal(false)}
                    className="btn btn-primary px-6 py-3"
                  >
                    I Understand
                  </button>
                </div>
              </div>
            </div>
          )}

          {showUserManualModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full p-8 relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setShowUserManualModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl"
                >
                  ✕
                </button>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">User Manual: A/C Charging Calculator</h2>

                <div className="space-y-8">
                  {/* Introduction */}
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">1. Introduction</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      The A/C Charging Calculator is a professional tool designed to help EPA 608 Certified Technicians accurately diagnose and adjust the refrigerant charge of residential and light commercial air conditioning systems and heat pumps.
                    </p>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                        ⚠️ <strong>Safety First:</strong> This tool is for use by trained and certified professionals only. Improper handling of refrigerants can cause serious personal injury and equipment damage. Always follow manufacturer guidelines and safety protocols.
                      </p>
                    </div>
                  </div>

                  {/* Selecting System Parameters */}
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">2. Selecting the System Parameters</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      Before taking any readings, you must configure the calculator to match the system you are servicing.
                    </p>

                    <div className="space-y-4 ml-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Refrigerant:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Select the correct refrigerant type (e.g., R-410A, R-22) from the dropdown menu. This is critical, as all temperature and pressure calculations depend on this selection.
                        </p>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Method:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          Choose the appropriate charging method based on the system's metering device.
                        </p>
                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                          <li>• <strong>Superheat:</strong> For systems with a fixed orifice or piston metering device.</li>
                          <li>• <strong>Subcooling:</strong> For systems with a Thermostatic Expansion Valve (TXV).</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Superheat Method */}
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">3. How to Use the Superheat Method</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      When you select "Superheat," you will need to provide the following readings from your manifold gauges and temperature probes.
                    </p>

                    <div className="space-y-4 ml-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Suction Pressure (psig):</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>What it is:</strong> The pressure of the refrigerant vapor on the low-pressure side of the system.
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>How to get it:</strong> Connect your manifold's blue hose to the suction line (the larger, insulated copper line) service port and read the pressure on your low-side gauge.
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          In the example, this is 100 psig.
                        </p>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Suction Line Temp (°F):</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>What it is:</strong> The actual temperature of the refrigerant vapor in the suction line.
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>How to get it:</strong> Securely attach a temperature probe to the suction line near the service port where you are measuring pressure.
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          In the example, this is 80°F.
                        </p>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Target Superheat (°F):</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>What it is:</strong> The ideal amount of superheat the system should have, as specified by the manufacturer.
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>How to get it:</strong> The target superheat is often found on a chart inside the outdoor unit's service panel. If not, it can be calculated using the Indoor Wet Bulb and Outdoor Dry Bulb temperatures.
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          In the example, the target is 8°F.
                        </p>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Indoor Wet Bulb / Outdoor Dry Bulb (Optional):</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          Use these fields if you need to calculate the target superheat. Enter the temperatures, and the app will determine the correct target for you.
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 mt-2">
                          <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold mb-1">
                            💡 Smart Feature: Fetch Local Conditions
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Instead of manually entering the outdoor temperature, tap the <strong>"Fetch Local Conditions"</strong> button next to the environmental fields.
                            Your device will use GPS to determine your location, then automatically fetch the current outdoor temperature from a local weather station using Open-Meteo API.
                            This saves time and ensures accurate readings at the job site.
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            <strong>Note:</strong> Indoor readings (wet bulb and dry bulb) must still be measured manually at the return air with your digital psychrometer.
                          </p>
                        </div>

                        <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3 mt-3">
                          <p className="text-sm text-purple-800 dark:text-purple-200 font-semibold mb-1">
                            🔵 Pro Feature: Bluetooth Connectivity
                          </p>
                          <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                            <strong>Connect Environmental Probes:</strong> Automatically sync indoor temperature and humidity from Bluetooth-enabled probes (Fieldpiece JobLink, Testo Smart Probes, Klein Tools). 
                            The app will calculate wet bulb temperature in real-time.
                          </p>
                          <p className="text-sm text-purple-700 dark:text-purple-300">
                            <strong>Connect Digital Manifold Gauges:</strong> Automatically sync high-side and low-side pressure readings from digital manifolds (Fieldpiece SMAN series, Testo 550s/557s, CPS Blackmax, Yellow Jacket Titan).
                            No more manual entry - readings update live as your gauges display them.
                          </p>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                            <strong>Requirements:</strong> Web Bluetooth API (Chrome, Edge, or Opera on Android, Windows, macOS, ChromeOS). Device must be powered on and in pairing mode.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interpreting Results */}
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">4. Interpreting the Results</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      Once all inputs are entered, the "System Status" section will update in real-time to provide a clear diagnosis.
                    </p>

                    <div className="space-y-4 ml-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">System Charge Status:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          This is the main conclusion. A large, color-coded banner will tell you the system's condition.
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          In the example, the status is "Significantly Undercharged."
                        </p>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Action Required:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          This is a clear, direct instruction on what to do next.
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          In the example, the action is "⚡ ADD REFRIGERANT IMMEDIATELY."
                        </p>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Actual Superheat:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          This is the superheat your system is currently running at, calculated from your pressure and temperature readings.
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          In the example, the Actual Superheat is 48.2°F.
                        </p>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Target Superheat:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          This is the ideal superheat you are trying to achieve.
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          In the example, the Target Superheat is 8.0°F.
                        </p>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Reading Summary:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          This is a plain-English sentence that walks you through the app's logic, allowing you to verify the calculation at a glance. It shows how the app used your inputs to arrive at the final diagnosis.
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          In the example, it confirms: Suction 100 psig → Saturation Temp 31.8°F. Then, 80°F - 31.8°F → Actual Superheat 48.2°F.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Professional Workflow Features */}
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">5. Professional Workflow Features</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      Use the buttons at the top of the calculator to access additional tools:
                    </p>

                    <div className="space-y-2 ml-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>[PT Chart]:</strong> Opens a full Pressure-Temperature chart for the selected refrigerant.
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>[Save Reading]:</strong> Saves the current inputs and results to your Job History.
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>[Job History]:</strong> View and manage all your saved service readings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setShowUserManualModal(false)}
                    className="btn btn-primary px-6 py-3"
                  >
                    Close Manual
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* STEP 1: System Setup */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-md p-6 border-2 border-blue-200 dark:border-blue-900">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">System Setup</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Refrigerant selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Refrigerant Type</label>
                  <select
                    value={refrigerant}
                    onChange={e => {
                      const selectedRef = e.target.value;
                      if (isRefrigerantLocked(selectedRef)) {
                        setUpgradeReason(`Unlock ${selectedRef} and all professional refrigerants with a Pro subscription. Get access to R-134a, R-32, R-407C and more.`);
                        setShowUpgradeModal(true);
                      } else {
                        setRefrigerant(selectedRef);
                      }
                    }}
                    className={selectClasses}
                  >
                    {Object.keys(refrigerantCharts).map(r => (
                      <option key={r} value={r} disabled={isRefrigerantLocked(r)}>
                        {r} {isRefrigerantLocked(r) ? '🔒' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Method toggle */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Charging Method
                    <button
                      onClick={() => setShowWinterTipsModal(true)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      title="Winter Charging Tips"
                    >
                      <Info size={14} />
                    </button>
                  </label>
                  <div className="inline-flex w-full rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600">
                    <button
                      onClick={() => setMethod('subcooling')}
                      className={`flex-1 px-4 py-3 text-lg font-semibold transition-colors ${method === 'subcooling' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                    >
                      Subcooling
                    </button>
                    <button
                      onClick={() => setMethod('superheat')}
                      className={`flex-1 px-4 py-3 text-lg font-semibold transition-colors ${method === 'superheat' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                    >
                      Superheat
                    </button>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {method === 'subcooling' ? '✓ Using subcooling method (for TXV systems)' : '✓ Using superheat method (for fixed orifice systems)'}
              </p>
            </div>

            {/* STEP 2: Calculate Targets (Superheat Method Only) */}
            {method === 'superheat' && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-md p-6 border-2 border-green-200 dark:border-green-900">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">2</div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Calculate Your Targets</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">Enter environmental conditions to calculate target superheat</p>

                    <div className="flex gap-2">
                      {/* BLE Probe Connection Button */}
                      {!bleConnected ? (
                        <button
                          onClick={connectBLEProbe}
                          disabled={bleScanning}
                          className="btn btn-outline btn-sm flex items-center gap-2 border-2 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 relative"
                          title="Connect to Bluetooth environmental probe - Supports Fieldpiece JobLink, Testo Smart Probes, Klein Tools (Pro Feature)"
                        >
                          {bleScanning ? (
                            <>
                              <span className="animate-spin">⟳</span>
                              Scanning...
                            </>
                          ) : (
                            <>
                              <Bluetooth size={16} />
                              Connect Probe
                              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold shadow-lg">
                                PRO
                              </span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={disconnectBLEProbe}
                          className="btn btn-sm flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
                          title="Disconnect from probe"
                        >
                          <BluetoothConnected size={16} />
                          {bleDeviceName}
                        </button>
                      )}

                      {/* GPS Weather Fetch Button */}
                      <button
                        onClick={fetchLocalConditions}
                        disabled={fetchingConditions}
                        className="btn btn-primary btn-sm flex items-center gap-2"
                        title="Use GPS to auto-fill outdoor temperature"
                      >
                        {fetchingConditions ? (
                          <>
                            <span className="animate-spin">⟳</span>
                            Fetching...
                          </>
                        ) : (
                          <>
                            <MapPin size={16} />
                            Fetch Outdoor Conditions
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {bleConnected && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-600 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-300 font-medium flex items-center gap-2">
                        <BluetoothConnected size={16} className="text-blue-600 dark:text-blue-400" />
                        ✓ Live data syncing from: {bleDeviceName}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        Indoor temperature and humidity fields are now read-only and auto-updating from your probe.
                      </p>
                    </div>
                  )}

                  {locationName && (
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                      ✓ Using outdoor conditions from: {locationName}
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Indoor Wet Bulb (°F)
                        {bleDataSource && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">🔵 Live</span>}
                      </label>
                      <input
                        type="number"
                        value={indoorWetBulb}
                        onChange={e => {
                          if (!bleDataSource) {
                            setIndoorWetBulb(e.target.value);
                            setTargetSuperheatCalculated(false);
                          }
                        }}
                        placeholder="e.g., 63"
                        readOnly={bleDataSource}
                        className={`w-full px-3 py-2 rounded-lg border-2 dark:bg-gray-700 dark:text-gray-100 focus:outline-none ${bleDataSource
                          ? 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 cursor-not-allowed'
                          : 'border-gray-300 dark:border-gray-600 focus:border-green-500'
                          }`}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {bleDataSource ? 'Synced from probe' : 'Measured at return'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Outdoor Dry Bulb (°F)
                      </label>
                      <input
                        type="number"
                        value={outdoorDryBulb}
                        onChange={e => {
                          setOutdoorDryBulb(e.target.value);
                          setTargetSuperheatCalculated(false);
                          setLocationName('');
                        }}
                        placeholder="e.g., 85"
                        className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:border-green-500 focus:outline-none"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Or use GPS button</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Indoor Dry Bulb (°F)
                        {bleDataSource && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">🔵 Live</span>}
                      </label>
                      <input
                        type="number"
                        value={indoorDryBulb}
                        onChange={e => {
                          if (!bleDataSource) {
                            setIndoorDryBulb(e.target.value);
                          }
                        }}
                        placeholder="e.g., 75"
                        readOnly={bleDataSource}
                        className={`w-full px-3 py-2 rounded-lg border-2 dark:bg-gray-700 dark:text-gray-100 focus:outline-none ${bleDataSource
                          ? 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 cursor-not-allowed'
                          : 'border-gray-300 dark:border-gray-600 focus:border-green-500'
                          }`}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {bleDataSource ? 'Synced from probe' : 'Measured at return'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Target Superheat (°F)
                        {targetSuperheatCalculated && (
                          <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-semibold">✓ Calculated</span>
                        )}
                      </label>
                      <input
                        type="number"
                        value={targetSuperheat}
                        onChange={e => {
                          setTargetSuperheat(Number(e.target.value));
                          setTargetSuperheatCalculated(false);
                        }}
                        className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={calculateTargetSuperheat}
                      disabled={!indoorWetBulb || !outdoorDryBulb}
                      className="btn btn-primary px-6 py-2 whitespace-nowrap"
                    >
                      Calculate Target
                    </button>
                  </div>

                  {/* Targets Display */}
                  {targetSuperheatCalculated && indoorDryBulb && calculations.targetSuctionPressure && (
                    <div className="mt-4 p-4 bg-white dark:bg-gray-700 rounded-lg border-2 border-green-500 dark:border-green-600">
                      <h4 className="text-sm font-bold text-green-900 dark:text-green-300 uppercase mb-3">📊 Your Targets</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Target Superheat</div>
                          <div className="text-3xl font-bold text-green-700 dark:text-green-400">{targetSuperheat.toFixed(1)}°F</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Target Suction Pressure</div>
                          <div className="text-3xl font-bold text-green-700 dark:text-green-400">{calculations.targetSuctionPressure.toFixed(0)} psig</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Target Suction Line Temp</div>
                          <div className="text-3xl font-bold text-green-700 dark:text-green-400">{(calculations.targetSaturationTemp + targetSuperheat).toFixed(0)}°F</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2/3: Target Subcooling (Subcooling Method) */}
            {method === 'subcooling' && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-md p-6 border-2 border-green-200 dark:border-green-900">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">2</div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Set Target Subcooling</h3>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Subcooling (°F)
                    <Info size={16} className="text-gray-400" title="Find this value on the unit's data plate or manufacturer specs" />
                  </label>
                  <select
                    value={targetSubcooling}
                    onChange={e => setTargetSubcooling(Number(e.target.value))}
                    className="w-full px-4 py-3 text-2xl font-bold rounded-lg border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:border-green-500 focus:outline-none"
                  >
                    {Object.keys(refrigerantCharts[refrigerant]?.subcoolingChart?.subcoolingTargets || refrigerantCharts['R-410A'].subcoolingChart.subcoolingTargets).map(sc => (
                      <option key={sc} value={sc}>{sc}°F</option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Check the unit's data plate or manufacturer specifications for the recommended subcooling value.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 3/4: Live System Readings */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-md p-6 border-2 border-orange-200 dark:border-orange-900">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">{method === 'superheat' ? '3' : '3'}</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Enter Live System Readings</h3>
              </div>

              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">Use your gauges and temperature probes to take current readings</p>

                {/* Digital Manifold Gauge Connection */}
                <div className="flex gap-2">
                  {!manifoldConnected ? (
                    <button
                      onClick={connectManifoldGauge}
                      disabled={manifoldScanning}
                      className="btn btn-outline btn-sm flex items-center gap-2 border-2 border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 relative"
                      title="Connect to Bluetooth digital manifold gauge - Auto-sync pressure readings from Fieldpiece SMAN, Testo 550s, CPS Blackmax (Pro Feature)"
                    >
                      {manifoldScanning ? (
                        <>
                          <span className="animate-spin">⟳</span>
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Bluetooth size={16} />
                          Connect Manifold
                          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold shadow-lg">
                            PRO
                          </span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={disconnectManifoldGauge}
                      className="btn btn-sm flex items-center gap-2 bg-purple-600 text-white hover:bg-purple-700"
                      title="Disconnect from manifold gauge"
                    >
                      <BluetoothConnected size={16} />
                      {manifoldDeviceName}
                    </button>
                  )}
                </div>
              </div>

              {manifoldConnected && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500 dark:border-purple-600 rounded-lg p-3 mb-4">
                  <p className="text-sm text-purple-800 dark:text-purple-300 font-medium flex items-center gap-2">
                    <BluetoothConnected size={16} className="text-purple-600 dark:text-purple-400" />
                    ✓ Live pressure syncing from: {manifoldDeviceName}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                    Pressure fields are now read-only and auto-updating from your digital manifold gauge.
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {/* Subcooling Method Inputs */}
                {method === 'subcooling' && (
                  <>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Liquid Line Pressure (psig)
                        {manifoldDataSource && <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">🔵 Live</span>}
                        <Info size={16} className="text-gray-400" />
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          {...press_liquid_dec5}
                          disabled={manifoldDataSource}
                          className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white p-4 rounded-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Decrease pressure by 5"
                        >
                          <Minus size={24} />
                        </button>
                        <input
                          type="number"
                          value={liquidLinePressure}
                          onChange={e => !manifoldDataSource && setLiquidLinePressure(Number(e.target.value))}
                          readOnly={manifoldDataSource}
                          className={`flex-1 px-6 py-4 text-3xl font-bold text-center border-4 rounded-lg focus:outline-none dark:text-gray-100 ${
                            manifoldDataSource
                              ? 'border-purple-500 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 cursor-not-allowed'
                              : 'border-orange-300 dark:border-orange-600 dark:bg-gray-700 focus:border-orange-500'
                          }`}
                        />
                        <button
                          {...press_liquid_inc5}
                          disabled={manifoldDataSource}
                          className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white p-4 rounded-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Increase pressure by 5"
                        >
                          <Plus size={24} />
                        </button>
                      </div>
                      <div className="flex justify-between mt-2">
                        <button
                          {...press_liquid_dec1}
                          disabled={manifoldDataSource}
                          className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          -1 psi
                        </button>
                        <button
                          {...press_liquid_inc1}
                          disabled={manifoldDataSource}
                          className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          +1 psi
                        </button>
                      </div>
                      {manifoldDataSource && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-medium">
                          Synced from digital manifold
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Liquid Line Temperature (°F)
                        <Info size={16} className="text-gray-400" />
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          {...press_liquidtemp_dec5}
                          className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white p-4 rounded-lg shadow-lg active:scale-95 transition-transform"
                          aria-label="Decrease temperature by 5"
                        >
                          <Minus size={24} />
                        </button>
                        <input
                          type="number"
                          value={liquidLineTemp}
                          onChange={e => setLiquidLineTemp(Number(e.target.value))}
                          className="flex-1 px-6 py-4 text-3xl font-bold text-center border-4 border-orange-300 dark:border-orange-600 rounded-lg focus:border-orange-500 focus:outline-none dark:bg-gray-700 dark:text-gray-100"
                        />
                        <button
                          {...press_liquidtemp_inc5}
                          className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white p-4 rounded-lg shadow-lg active:scale-95 transition-transform"
                          aria-label="Increase temperature by 5"
                        >
                          <Plus size={24} />
                        </button>
                      </div>
                      <div className="flex justify-between mt-2">
                        <button
                          {...press_liquidtemp_dec1}
                          className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-semibold"
                        >
                          -1°F
                        </button>
                        <button
                          {...press_liquidtemp_inc1}
                          className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-semibold"
                        >
                          +1°F
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Superheat Method Inputs */}
                {method === 'superheat' && (
                  <>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Suction Pressure (psig)
                        {manifoldDataSource && <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">🔵 Live</span>}
                        <Info size={16} className="text-gray-400" />
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          {...press_suction_dec5}
                          disabled={manifoldDataSource}
                          className="bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus size={24} />
                        </button>
                        <input
                          type="number"
                          value={suctionPressure}
                          onChange={e => !manifoldDataSource && setSuctionPressure(Number(e.target.value))}
                          readOnly={manifoldDataSource}
                          className={`flex-1 px-6 py-4 text-3xl font-bold text-center border-4 rounded-lg focus:outline-none dark:text-gray-100 ${
                            manifoldDataSource
                              ? 'border-purple-500 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 cursor-not-allowed'
                              : 'border-orange-300 dark:border-orange-600 dark:bg-gray-700 focus:border-orange-500'
                          }`}
                        />
                        <button
                          {...press_suction_inc5}
                          disabled={manifoldDataSource}
                          className="bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={24} />
                        </button>
                      </div>
                      <div className="flex justify-between mt-2">
                        <button {...press_suction_dec1} disabled={manifoldDataSource} className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">-1 psi</button>
                        <button {...press_suction_inc1} disabled={manifoldDataSource} className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">+1 psi</button>
                      </div>
                      {manifoldDataSource && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-medium">
                          Synced from digital manifold
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Suction Line Temperature (°F)</label>
                      <div className="flex items-center gap-2">
                        <button {...press_suctiontemp_dec5} className="bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-lg shadow-lg active:scale-95 transition-transform"><Minus size={24} /></button>
                        <input type="number" value={suctionTemp} onChange={e => setSuctionTemp(Number(e.target.value))} className="flex-1 px-6 py-4 text-3xl font-bold text-center border-4 border-orange-300 dark:border-orange-600 rounded-lg focus:border-orange-500 focus:outline-none dark:bg-gray-700 dark:text-gray-100" />
                        <button {...press_suctiontemp_inc5} className="bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-lg shadow-lg active:scale-95 transition-transform"><Plus size={24} /></button>
                      </div>
                      <div className="flex justify-between mt-2">
                        <button {...press_suctiontemp_dec1} className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-semibold">-1°F</button>
                        <button {...press_suctiontemp_inc1} className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-semibold">+1°F</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* STEP 4: System Status & Diagnosis */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold mr-2">4</span>
                System Status & Diagnosis
              </h3>

              {/* Large, Color-Coded Status Indicator */}
              <div data-testid="system-status-banner" className={`rounded-2xl p-10 mb-8 text-center border-4 shadow-xl transition-all duration-300 ${calculations.statusLevel === 'good'
                ? 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-950 border-green-500 dark:border-green-600'
                : calculations.statusLevel === 'caution'
                  ? 'bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-yellow-950 dark:to-orange-950 border-yellow-500 dark:border-yellow-600'
                  : 'bg-gradient-to-br from-red-50 to-pink-100 dark:from-red-950 dark:to-pink-950 border-red-500 dark:border-red-600 animate-pulse-glow'
                }`}>
                <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${calculations.statusLevel === 'good'
                  ? 'text-green-700 dark:text-green-400'
                  : calculations.statusLevel === 'caution'
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : 'text-red-700 dark:text-red-400'
                  }`}>
                  System Charge Status
                </div>
                <div className={`text-5xl md:text-6xl font-black mb-6 leading-tight animate-count-up ${calculations.statusLevel === 'good'
                  ? 'text-green-900 dark:text-green-300'
                  : calculations.statusLevel === 'caution'
                    ? 'text-yellow-900 dark:text-yellow-300'
                    : 'text-red-900 dark:text-red-300'
                  }`}>
                  {calculations.chargeStatus}
                </div>

                {/* Temperature Difference Badge */}
                <div className="inline-block bg-white/90 dark:bg-gray-800/90 rounded-xl px-6 py-3 mb-6 shadow-lg backdrop-blur-sm">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Difference: </span>
                  <span className={`text-3xl font-black ml-2 ${calculations.statusLevel === 'good' ? 'text-green-700 dark:text-green-400' :
                    calculations.statusLevel === 'caution' ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'
                    }`}>
                    {calculations.difference > 0 ? '+' : ''}{calculations.difference.toFixed(1)}°F
                  </span>
                </div>

                {/* Action Required */}
                <div className={`text-xl font-bold uppercase tracking-wider ${calculations.statusLevel === 'good'
                  ? 'text-green-800 dark:text-green-300'
                  : calculations.statusLevel === 'caution'
                    ? 'text-yellow-800 dark:text-yellow-300'
                    : 'text-red-800 dark:text-red-300'
                  }`}>
                  ⚡ {calculations.action}
                </div>
              </div>

              {/* Detailed Readings */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {calculations.method === 'superheat' ? (
                  <>
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-2 border-blue-300 dark:border-blue-700 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-lift" data-testid="actual-superheat-card">
                      <div className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-2">Actual Superheat</div>
                      <div className="text-4xl font-black text-blue-900 dark:text-blue-300 animate-count-up">
                        {typeof calculations.actualSuperheat === 'number' ? calculations.actualSuperheat.toFixed(1) : 'N/A'}°F
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-800 dark:to-slate-900 border-2 border-gray-300 dark:border-gray-600 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-lift" data-testid="target-superheat-card">
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-2">Target Superheat</div>
                      <div className="text-4xl font-black text-gray-900 dark:text-gray-100 animate-count-up">
                        {typeof calculations.targetSuperheat === 'number' ? Number(calculations.targetSuperheat).toFixed(1) : 'N/A'}°F
                      </div>
                    </div>

                    {calculations.targetSuctionPressure && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-2 border-green-300 dark:border-green-700 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-lift">
                        <div className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-widest mb-2">Target Suction Pressure</div>
                        <div className="text-4xl font-black text-green-900 dark:text-green-300 animate-count-up">
                          {calculations.targetSuctionPressure.toFixed(0)} psig
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          At {calculations.targetSaturationTemp.toFixed(0)}°F saturation
                        </div>
                      </div>
                    )}

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-2 border-purple-300 dark:border-purple-700 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-lift">
                      <div className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest mb-2">Target Suction Line Temp</div>
                      <div className="text-4xl font-black text-purple-900 dark:text-purple-300 animate-count-up">
                        {calculations.targetSaturationTemp && typeof calculations.targetSuperheat === 'number'
                          ? (calculations.targetSaturationTemp + Number(calculations.targetSuperheat)).toFixed(0)
                          : 'N/A'}°F
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-2 border-blue-300 dark:border-blue-700 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-lift">
                      <div className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-2">Required Temp</div>
                      <div className="text-4xl font-black text-blue-900 dark:text-blue-300 animate-count-up">
                        {typeof calculations.targetTemp === 'number' ? calculations.targetTemp.toFixed(1) : 'N/A'}°F
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-800 dark:to-slate-900 border-2 border-gray-300 dark:border-gray-600 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-lift">
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-2">Measured Temp</div>
                      <div className="text-4xl font-black text-gray-900 dark:text-gray-100 animate-count-up">
                        {liquidLineTemp.toFixed(1)}°F
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {calculations.method === 'superheat' ? (
                  <>
                    <strong>Reading:</strong> Suction <strong>{suctionPressure} psig</strong>, measured suction temp <strong>{suctionTemp}°F</strong>. Saturation temp at that pressure: <strong>{calculations.satTemp != null ? calculations.satTemp.toFixed(1) + '°F' : 'N/A'}</strong>. Target superheat: <strong>{calculations.targetSuperheat}°F</strong>. Actual superheat: <strong>{calculations.actualSuperheat != null ? calculations.actualSuperheat.toFixed(1) + '°F' : 'N/A'}</strong>.
                    {calculations.targetSuctionPressure && (
                      <> Target suction pressure for indoor temp <strong>{indoorDryBulb}°F</strong>: <strong>{calculations.targetSuctionPressure.toFixed(0)} psig</strong> (at {calculations.targetSaturationTemp.toFixed(0)}°F saturation).</>
                    )}
                  </>
                ) : (
                  <>
                    <strong>Reading:</strong> At <strong>{liquidLinePressure} psig</strong> with <strong>{targetSubcooling}°F</strong> target subcooling,
                    the required liquid line temperature is <strong>{typeof calculations.targetTemp === 'number' ? calculations.targetTemp.toFixed(1) : 'N/A'}°F</strong>.
                    Your measured temperature is <strong>{liquidLineTemp}°F</strong>.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Math Details */}
        <div className="max-w-2xl mx-auto mt-6 mb-8">
          <details className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-sm">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
              <span>📐 Show math used in this calculation</span>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(formulas with your live values)</span>
            </summary>
            <div className="px-4 pb-4 pt-1 text-sm text-gray-800 dark:text-gray-200 space-y-3 border-t dark:border-gray-700">
              {calculations.method === 'superheat' ? (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300 font-semibold">Superheat method</div>
                  <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
                    <div><strong>Saturation Temperature:</strong> T_sat = PT({refrigerant}, {suctionPressure} psig) = <strong>{calculations.satTemp != null ? calculations.satTemp.toFixed(1) : 'N/A'}°F</strong></div>
                    <div><strong>Actual Superheat:</strong> SH_actual = T_suction − T_sat = {suctionTemp} − {calculations.satTemp != null ? calculations.satTemp.toFixed(1) : 'N/A'} = <strong>{calculations.actualSuperheat != null ? calculations.actualSuperheat.toFixed(1) : 'N/A'}°F</strong></div>
                    <div><strong>Target Superheat:</strong> SH_target = <strong>{typeof targetSuperheat === 'number' ? Number(targetSuperheat).toFixed(1) : 'N/A'}°F</strong></div>
                    {calculations.targetSuctionPressure && (
                      <>
                        <div><strong>Target Saturation Temp:</strong> T_target_sat = T_indoor_dry − 35°F = {indoorDryBulb}°F − 35°F = <strong>{calculations.targetSaturationTemp.toFixed(1)}°F</strong></div>
                        <div><strong>Target Suction Pressure:</strong> P_target = PT({refrigerant}, {calculations.targetSaturationTemp.toFixed(1)}°F) = <strong>{calculations.targetSuctionPressure.toFixed(0)} psig</strong></div>
                      </>
                    )}
                    <div><strong>Difference:</strong> Δ = SH_actual − SH_target = {calculations.actualSuperheat != null ? calculations.actualSuperheat.toFixed(1) : 'N/A'} − {typeof targetSuperheat === 'number' ? Number(targetSuperheat).toFixed(1) : 'N/A'} = <strong className={calculations.difference > 0 ? 'text-red-600' : 'text-green-600'}>{calculations.difference > 0 ? '+' : ''}{calculations.difference.toFixed(1)}°F</strong></div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-2 rounded">
                    <strong>Thresholds:</strong> Δ &gt; 5°F = Significantly Undercharged | Δ &gt; 2°F = Slightly Undercharged | Δ &lt; −5°F = Significantly Overcharged | Δ &lt; −2°F = Slightly Overcharged | Otherwise = Good
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-300 font-semibold">Subcooling method</div>
                  <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 space-y-1">
                    <div><strong>Saturation Temperature:</strong> T_sat = PT({refrigerant}, {liquidLinePressure} psig) = <strong>{(() => { const t = getSaturationTemp(refrigerant, liquidLinePressure); return t != null ? t.toFixed(1) : 'N/A'; })()}°F</strong></div>
                    <div><strong>Required Liquid Temp:</strong> T_required = T_sat − SC_target = {(() => { const t = getSaturationTemp(refrigerant, liquidLinePressure); return t != null ? t.toFixed(1) : 'N/A'; })()}°F − {targetSubcooling}°F = <strong>{typeof calculations.targetTemp === 'number' ? calculations.targetTemp.toFixed(1) : 'N/A'}°F</strong></div>
                    <div><strong>Measured Liquid Temp:</strong> T_measured = <strong>{liquidLineTemp.toFixed(1)}°F</strong></div>
                    <div><strong>Difference:</strong> Δ = T_measured − T_required = {liquidLineTemp.toFixed(1)} − {typeof calculations.targetTemp === 'number' ? calculations.targetTemp.toFixed(1) : 'N/A'} = <strong className={calculations.difference > 0 ? 'text-red-600' : 'text-green-600'}>{calculations.difference > 0 ? '+' : ''}{calculations.difference.toFixed(1)}°F</strong></div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-2 rounded">
                    <strong>Thresholds:</strong> Δ &gt; 5°F = Significantly Undercharged | Δ &gt; 2°F = Slightly Undercharged | Δ &lt; −5°F = Significantly Overcharged | Δ &lt; −2°F = Slightly Overcharged | Otherwise = Good
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>

        {/* PT Chart Modal */}
        {showPTChart && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={() => setShowPTChart(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pressure-Temperature Chart: {refrigerant}</h2>
                <button onClick={() => setShowPTChart(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl">×</button>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left p-2 text-gray-700 dark:text-gray-300">Pressure (psig)</th>
                      <th className="text-left p-2 text-gray-700 dark:text-gray-300">Sat. Temp (°F)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refrigerantCharts[refrigerant]?.ptTable.map((entry, idx) => {
                      const currentPressure = method === 'superheat' ? suctionPressure : liquidLinePressure;
                      const isActive = Math.abs(entry.p - currentPressure) < 10;
                      return (
                        <tr key={idx} className={`border-b dark:border-gray-700 ${isActive ? 'bg-blue-100 dark:bg-blue-900/30 font-bold' : ''}`}>
                          <td className="p-2 text-gray-800 dark:text-gray-200">{entry.p}</td>
                          <td className="p-2 text-gray-800 dark:text-gray-200">{entry.t.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
                Current pressure: <strong>{method === 'superheat' ? suctionPressure : liquidLinePressure} psig</strong>
                {calculations.satTemp && <> → Saturation: <strong>{calculations.satTemp.toFixed(1)}°F</strong></>}
              </div>
            </div>
          </div>
        )}

        {/* Job History Modal */}
        {showHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-8 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Job History</h2>
                <button onClick={() => setShowHistory(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl">×</button>
              </div>
              {jobHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">No Jobs Saved Yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Start building your professional service log by saving your first reading.
                  </p>
                  <button onClick={() => setShowHistory(false)} className="btn btn-primary">
                    Close & Start Calculating
                  </button>
                  {!isPro && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                      Free tier: Save up to 3 jobs • <button onClick={() => { setShowHistory(false); setUpgradeReason("Upgrade to Pro for unlimited job saves and PDF export."); setShowUpgradeModal(true); }} className="text-blue-600 dark:text-blue-400 underline">Upgrade for unlimited</button>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {jobHistory.map(job => (
                    <div key={job.id} className="border dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-gray-800 dark:text-gray-100">{job.clientName}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(job.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleExportJob(job)} className="text-sm text-blue-600 hover:text-blue-800">Export PDF</button>
                          <button onClick={() => handleDeleteReading(job.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>Refrigerant:</strong> {job.refrigerant}</div>
                        <div><strong>Method:</strong> {job.method}</div>
                        <div className="col-span-2"><strong>Status:</strong> <span className={job.results.statusLevel === 'good' ? 'text-green-600' : job.results.statusLevel === 'caution' ? 'text-yellow-600' : 'text-red-600'}>{job.results.chargeStatus}</span></div>
                        {job.method === 'subcooling' && (
                          <>
                            <div><strong>Liquid Pressure:</strong> {job.inputs.liquidLinePressure} psig</div>
                            <div><strong>Liquid Temp:</strong> {job.inputs.liquidLineTemp}°F</div>
                          </>
                        )}
                        {job.method === 'superheat' && (
                          <>
                            <div><strong>Suction Pressure:</strong> {job.inputs.suctionPressure} psig</div>
                            <div><strong>Suction Temp:</strong> {job.inputs.suctionTemp}°F</div>
                            {job.inputs.indoorDryBulb && <div><strong>Indoor Dry Bulb:</strong> {job.inputs.indoorDryBulb}°F</div>}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <div className="text-5xl mb-4">🔓</div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">Upgrade to Pro</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">{upgradeReason}</p>

                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 mb-6">
                  <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2">Pro Features Include:</h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 text-left space-y-1">
                    <li>✓ All refrigerants (R-134a, R-32, R-407C & more)</li>
                    <li>✓ Unlimited job history saves</li>
                    <li>✓ PDF export for professional reports</li>
                    <li>✓ Priority support</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowUpgradeModal(false)} className="flex-1 btn btn-outline">Maybe Later</button>
                  <Link to="/settings" className="flex-1 btn btn-primary" onClick={() => setShowUpgradeModal(false)}>Upgrade Now</Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default HeatPumpChargingCalc;